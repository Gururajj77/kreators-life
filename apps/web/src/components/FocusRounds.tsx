import { BREAK_BEATS, FOCUS_PRESETS, FOCUS_QUALITY, focusQualityName, RELATIONSHIP_BY_KEY, type FocusSettings } from '@kreators/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import gsap from 'gsap';
import { memo, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { api } from '../lib/api';
import { todayLocal } from '../lib/date';
import { MAX_PART_MIN, mmss, nextLeft, useCountdown, useStopwatch, useTicker, wholeMinutes } from '../lib/focusClocks';
import { useFocusPrefs } from '../lib/focusPrefs';
import { useFocusSession, type FocusKind } from '../lib/focusSession';
import { playBeats, playChime, unlockAudio, useAmbient } from '../lib/sound';
import { useSession } from '../lib/store';
import { Button } from './Button';
import { ChipSelect, type ChipOption } from './ChipSelect';
import { prefersReducedMotion } from './fx/env';
import { useSlider } from './fx/useSlider';
import { RulerPicker } from './RulerPicker';
import { Sheet } from './Sheet';
import { SoundControls } from './SoundControls';
import { Toggle } from './Toggle';

type Phase = 'focus' | 'short' | 'long';
type Mode = 'timer' | 'pomodoro' | 'stopwatch';
type Settings = FocusSettings;
const LABEL: Record<Phase, string> = { focus: 'Focus', short: 'Mini break', long: 'Long break' };
const MODES: readonly { key: Mode; name: string; blurb: string }[] = [
  { key: 'timer', name: 'Timer', blurb: 'One countdown, no breaks.' },
  { key: 'pomodoro', name: 'Pomodoro', blurb: 'Focus sessions with breaks.' },
  { key: 'stopwatch', name: 'Stopwatch', blurb: 'Counts up from zero.' },
];
const DAY_KEY = 'kreators.focusRounds.day';
const TAB_KEY = 'kreators.focusTab';
const TIMER_KEY = 'kreators.focusTimerMin';
const RULER = { min: 5, max: 120, step: 5, labelEvery: 10 } as const;

const clampInt = (v: unknown, lo: number, hi: number, fallback: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;
};
/** Today's rounds, kept on this device. A new day starts from nothing. */
function readDay(): { day: string; rounds: number; minutes: number } {
  const day = todayLocal();
  try {
    const raw = JSON.parse(localStorage.getItem(DAY_KEY) ?? '{}') as { day?: string; rounds?: number; minutes?: number };
    if (raw.day === day) return { day, rounds: raw.rounds ?? 0, minutes: raw.minutes ?? 0 };
  } catch {
    // start fresh
  }
  return { day, rounds: 0, minutes: 0 };
}
const readTab = (): Mode => {
  try {
    const v = localStorage.getItem(TAB_KEY);
    return v === 'timer' || v === 'pomodoro' || v === 'stopwatch' ? v : 'pomodoro';
  } catch {
    return 'pomodoro';
  }
};
const readTimerMin = (): number | null => {
  try {
    const n = Number(localStorage.getItem(TIMER_KEY));
    return Number.isFinite(n) && n >= 1 && n <= MAX_PART_MIN ? Math.round(n) : null;
  } catch {
    return null;
  }
};
const keep = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // not kept on this device
  }
};

const hoursMin = (min: number) => (min >= 60 ? `${Math.floor(min / 60)} h ${min % 60 ? `${min % 60} min` : ''}`.trim() : `${min} min`);

/** A plain line for what the settings add up to. */
export function planLine(s: Settings): string {
  const cycle = s.every * s.focus + (s.every - 1) * s.short + s.long;
  const minis = s.every - 1;
  const run = `${s.focus} min of focus, ${s.every} ${s.every === 1 ? 'session' : 'sessions'}${minis > 0 ? ` with ${minis} mini ${minis === 1 ? 'break' : 'breaks'} of ${s.short} min` : ''}, then a ${s.long} min long break`;
  return `${run}. ${s.cycles > 0 ? `${s.cycles} ${s.cycles === 1 ? 'time' : 'times'}, ${hoursMin(cycle * s.cycles - s.long)} before the last long break.` : `That is ${hoursMin(cycle)} for one go, and it carries on until you stop.`}`;
}

/** The choices on a setting chip: the usual few, and the person's own number when it is not one of them (kept from before). */
const optionsOf = (usual: readonly number[], current: number, label: (n: number) => string): ChipOption[] => {
  const all = usual.includes(current) ? usual : [...usual, current].sort((a, b) => a - b);
  return all.map((n) => ({ value: n, label: label(n) }));
};
const SHORT_CHOICES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20, 25, 30] as const;
const LONG_CHOICES = [5, 10, 15, 20, 25, 30, 40, 45, 60, 90, 120] as const;
const EVERY_CHOICES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

/** Small line icons for the round buttons. Each is drawn on a 24 box, with the stroke taking the button's colour. */
function Icon({ name }: { name: 'gear' | 'sound' | 'mute' | 'music' | 'task' }) {
  const paths: Record<typeof name, ReactNode> = {
    gear: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
      </>
    ),
    sound: (
      <>
        <path d="M11 5 6 9H3v6h3l5 4z" />
        <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
      </>
    ),
    mute: (
      <>
        <path d="M11 5 6 9H3v6h3l5 4z" />
        <path d="m16 9 6 6M22 9l-6 6" />
      </>
    ),
    music: (
      <>
        <path d="M9 18V5l11-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="17" cy="16" r="3" />
      </>
    ),
    task: (
      <>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="4.5" />
        <circle cx="12" cy="12" r="0.8" />
      </>
    ),
  };
  return (
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
}

/** A round glass button that floats by the panel: a name for screen readers, and the same name as a tooltip on hover and keyboard focus. */
function RoundButton({ at, label, icon, onClick, opens = false }: { at: 'tl' | 'tr' | 'br' | 'bc'; label: string; icon: 'gear' | 'sound' | 'mute' | 'music' | 'task'; onClick: () => void; /** It opens a dialog. */ opens?: boolean }) {
  return (
    <button type="button" className="mf-round toy" data-at={at} data-tip={label} aria-label={label} aria-haspopup={opens ? 'dialog' : undefined} onClick={onClick}>
      <Icon name={icon} />
    </button>
  );
}

/** The sixty marks of a stopwatch's minute: the ones the seconds hand has passed light up. Only for the eye. */
const SecondsStrip = memo(function SecondsStrip({ seconds, live }: { seconds: number; live: boolean }) {
  return (
    <div className="mf-secs" aria-hidden="true">
      {Array.from({ length: 60 }, (_, i) => (
        <i key={i} data-on={live && i <= seconds ? '' : undefined} data-five={i % 5 === 0 ? '' : undefined} />
      ))}
    </div>
  );
});

/** A circle that grows as you breathe in and shrinks as you breathe out, while a break runs. A still circle otherwise. */
function BreathOrb({ active }: { active: boolean }) {
  const orb = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = orb.current;
    if (!el) return;
    if (!active || prefersReducedMotion()) {
      gsap.set(el, { scale: 1 });
      return;
    }
    // Ten seconds a breath: four in, one held, five out.
    const tl = gsap.timeline({ repeat: -1 });
    tl.to(el, { scale: 1.4, duration: 4, ease: 'sine.inOut' }).to(el, { scale: 1.4, duration: 1 }).to(el, { scale: 1, duration: 5, ease: 'sine.inOut' });
    return () => {
      tl.kill();
      gsap.set(el, { scale: 1 });
    };
  }, [active]);
  return (
    <div className="mf-orb-row" aria-hidden="true">
      <div ref={orb} className="mf-orb" />
    </div>
  );
}

/**
 * The focus panel of Mindful minutes: a dark slate glass card with three kinds of clock (Timer, Pomodoro, Stopwatch) under one row of tabs,
 * a ruler to choose how long a focus part is, the time in large figures, and the break settings as four small chips. Four round buttons float
 * by it (settings, sounds on or off, background music, the task being worked on). Every clock runs on an end time or a start instant, so a
 * background tab stays right; it keeps the screen awake, chimes and buzzes at the end, and puts the time in the tab's title.
 *
 * What logs: a Pomodoro focus round is always kept for the dashboard and counts as mindful minutes only if that switch is on; a finished
 * break counts only if its switch is on; a finished Timer and a stopped Stopwatch (whole minutes, at most a day, nothing under a minute) are
 * kept the same way and only when the "focus sessions count as mindful minutes" switch is on. Skipping or stopping a part early counts nothing.
 */
export function FocusRounds({ onLog, onRound }: { onLog: (minutes: number, kind: 'break' | 'focus') => void; onRound: (minutes: number, nodeId: string | null) => void | Promise<string | void | undefined> }) {
  const qc = useQueryClient();
  // How the last finished focus session felt. Asked after a session, never in the way of the clock; a rating is private and pays nothing.
  const [rate, setRate] = useState<{ id: string | null; mode: 'ask' | 'rated'; value: number | null; failed: boolean } | null>(null);
  const rateSeq = useRef(0);
  const token = useSession((s) => s.token);
  const { settings, set: setPrefs, ready } = useFocusPrefs();
  const fromUrl = useRef(false);
  const [params] = useSearchParams();
  const [mode, setModeState] = useState<Mode>(() => (params.get('task') || params.get('min') ? 'pomodoro' : readTab()));
  const [phase, setPhase] = useState<Phase>('focus');
  const [round, setRound] = useState(1);
  const [cycle, setCycle] = useState(1);
  const [running, setRunning] = useState(false);
  const [partMs, setPartMs] = useState(settings.focus * 60_000);
  const [leftMs, setLeftMs] = useState(settings.focus * 60_000);
  const [day, setDay] = useState(readDay);
  const [taskId, setTaskId] = useState('');
  const [finished, setFinished] = useState(false);
  const [said, setSaid] = useState('');
  const [sheet, setSheet] = useState<'settings' | 'music' | 'task' | null>(null);
  const endsAt = useRef<number | null>(null);
  const lock = useRef<{ release: () => Promise<void> } | null>(null);
  const tasks = useQuery({ queryKey: ['focus-tasks'], queryFn: () => api.focusTasks(), enabled: Boolean(token), staleTime: 60_000 });
  const picked = tasks.data?.tasks.find((t) => t.id === taskId) ?? null;
  const tabs = useSlider<HTMLDivElement>('[aria-pressed="true"]', mode);

  // The Timer's length is its own, kept on this device; until the person sets one it follows their saved focus length.
  const [timerMin, setTimerMin] = useState<number | null>(readTimerMin);
  const timerLen = timerMin ?? settings.focus;
  const stopwatch = useStopwatch();

  /** A finished focus part is kept: today's tally, the dashboard's round (with its rating), and mindful minutes when that switch is on. */
  const recordFocus = (minutes: number, always: boolean) => {
    if (!always && !settings.logFocus) return;
    // A page left open past midnight starts the new day from nothing, not from yesterday's tally.
    const now = todayLocal();
    const base = day.day === now ? day : { day: now, rounds: 0, minutes: 0 };
    const next = { day: base.day, rounds: base.rounds + 1, minutes: base.minutes + minutes };
    setDay(next);
    keep(DAY_KEY, JSON.stringify(next));
    const made = onRound(minutes, taskId || null);
    rateSeq.current += 1;
    const mine = rateSeq.current;
    setRate({ id: null, mode: 'ask', value: null, failed: false });
    // The round's id arrives a moment later; it only goes to the round it belongs to.
    void Promise.resolve(made)
      .then((id) => {
        if (typeof id === 'string' && rateSeq.current === mine) setRate((r) => (r && r.id === null ? { ...r, id } : r));
      })
      .catch(() => undefined);
    if (settings.logFocus) onLog(minutes, 'focus');
  };
  const buzz = () => {
    if (!settings.vibrate) return;
    try {
      navigator.vibrate?.([200, 100, 200]);
    } catch {
      // no vibration here
    }
  };

  const timer = useCountdown(timerLen * 60_000, (ms) => {
    if (settings.sound) {
      playChime();
      buzz();
    }
    recordFocus(Math.max(1, Math.round(ms / 60_000)), false);
    setSaid('Timer done.');
  });
  // An idle timer follows its length (and the saved focus length arriving late).
  useEffect(() => {
    timer.sync(timerLen * 60_000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerLen, ready]);

  const anyRunning = running || timer.running || stopwatch.running;

  // The same state, written out for any other page to read: the small chip in place of the logo. FocusRounds itself never unmounts on
  // a route change (it lives in FocusRoundsHost, mounted once by Shell, and only portals its panel in and out of Mindful's layout), so
  // nothing here needs to be picked back up; this is only for the chip, which lives in a different part of the page.
  useEffect(() => {
    const isBreak = mode === 'pomodoro' && phase !== 'focus';
    const kind: FocusKind = mode === 'timer' ? 'timer' : mode === 'stopwatch' ? 'stopwatch' : phase;
    const label = mode === 'timer' ? 'Timer' : mode === 'stopwatch' ? 'Stopwatch' : isBreak ? LABEL[phase] : `Session ${round} of ${settings.every}`;
    const active = mode === 'timer' ? timer.running || !timer.atFull : mode === 'stopwatch' ? stopwatch.running || stopwatch.ms > 0 : running || leftMs < partMs - 500;
    useFocusSession.getState().publish({
      active,
      kind,
      label,
      running: mode === 'timer' ? timer.running : mode === 'stopwatch' ? stopwatch.running : running,
      round,
      cycle,
      totalMs: mode === 'timer' ? timer.total : partMs,
      endsAt: mode === 'timer' && timer.running ? timer.getEndsAt() : mode === 'pomodoro' && running ? endsAt.current : null,
      leftMs: mode === 'timer' ? timer.left : leftMs,
      // While running, the whole total so far lives in the anchor (`now - started = ms`), so `snapshotLeftMs` can tick
      // it forward on its own between publishes; folding the same total into swAccumMs too would count it twice and
      // double the time a chip elsewhere in the app shows. Paused, there is no running segment to anchor, so the total
      // sits in swAccumMs alone.
      swStartedAt: mode === 'stopwatch' && stopwatch.running ? Date.now() - (stopwatch.ms ?? 0) : null,
      swAccumMs: mode === 'stopwatch' && !stopwatch.running ? stopwatch.ms : 0,
      taskTitle: picked?.title ?? null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, phase, round, cycle, running, partMs, leftMs, timer.running, timer.left, timer.total, timer.atFull, stopwatch.running, stopwatch.ms, settings.every, picked?.title]);
  const setMode = (m: Mode) => {
    setModeState(m);
    keep(TAB_KEY, m);
    setSaid(`${MODES.find((x) => x.key === m)!.name}.`);
  };

  // "Start focus" on a task opens this with the task picked and its estimate as the first round's length. That is only this round: the saved lengths do not change.
  useEffect(() => {
    const t = params.get('task');
    const m = clampInt(params.get('min'), 0, MAX_PART_MIN, 0);
    if (t) setTaskId(t);
    if (m > 0) {
      fromUrl.current = true;
      setPhase('focus');
      setPartMs(m * 60_000);
      setLeftMs(m * 60_000);
      setSaid(`Ready for ${m} minutes. Press Start.`);
    }
    // Only when the page opens with those.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const length = useCallback((p: Phase, s: Settings) => (p === 'focus' ? s.focus : p === 'short' ? s.short : s.long) * 60_000, []);
  const idleAtFull = !running && leftMs >= partMs - 500;

  // Change the part you are in by some milliseconds: the end moves, and so does the total.
  const nudge = (deltaMs: number) => {
    const part = Math.min(MAX_PART_MIN * 60_000, Math.max(60_000, partMs + deltaMs));
    const real = part - partMs;
    if (real === 0) return;
    setPartMs(part);
    if (running && endsAt.current !== null) {
      endsAt.current += real;
      setLeftMs(Math.max(1000, endsAt.current - Date.now()));
    } else setLeftMs((l) => Math.max(1000, l + real));
  };

  const save = (next: Settings) => {
    const key = phase === 'focus' ? 'focus' : phase === 'short' ? 'short' : 'long';
    const delta = (next[key] - settings[key]) * 60_000;
    setPrefs(next);
    if (finished && next.cycles !== settings.cycles) setFinished(false);
    if (delta === 0) return;
    if (idleAtFull) {
      setPartMs(length(phase, next));
      setLeftMs(length(phase, next));
    } else nudge(delta);
  };

  // The ruler picks the focus length (only while the clock waits at its full time): the saved length, and this part, move together.
  const pickFocus = (v: number) => {
    fromUrl.current = false;
    setPrefs({ ...settings, focus: v });
    setPartMs(v * 60_000);
    setLeftMs(v * 60_000);
  };

  // The person's saved lengths arrive from their account a moment after the page opens: an idle timer picks them up.
  useEffect(() => {
    if (fromUrl.current || running || leftMs < partMs - 500) return;
    const ms = length(phase, settings);
    if (ms !== partMs) {
      setPartMs(ms);
      setLeftMs(ms);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.focus, settings.short, settings.long, ready]);

  // A background sound plays while a clock runs, when sounds are on.
  useAmbient(anyRunning && settings.sound, settings.ambient, settings.ambientVolume);

  // Keep the screen awake while a clock runs, where the browser allows it.
  useEffect(() => {
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
    if (anyRunning && nav.wakeLock) void nav.wakeLock.request('screen').then((l) => (lock.current = l)).catch(() => undefined);
    return () => {
      void lock.current?.release().catch(() => undefined);
      lock.current = null;
    };
  }, [anyRunning]);

  const begin = (nextPhase: Phase, go: boolean) => {
    const ms = length(nextPhase, settings);
    setPhase(nextPhase);
    setPartMs(ms);
    setLeftMs(ms);
    endsAt.current = go ? Date.now() + ms : null;
    setRunning(go);
  };

  const finish = useCallback(
    (counted: boolean) => {
      const wasFocus = phase === 'focus';
      const minutes = Math.max(1, Math.round(partMs / 60_000));
      if (counted) {
        if (settings.sound) {
          // A soft beat when a mini break starts, three when the long break starts, and a chime when a break gives way to focus.
          const to: Phase | null = wasFocus ? (round >= settings.every ? 'long' : 'short') : null;
          if (to) {
            if (to === 'long' ? settings.soundLong : settings.soundShort) playBeats(BREAK_BEATS[to]);
          } else if (phase === 'long' ? settings.soundLong : settings.soundShort) playChime();
          buzz();
        }
        if (wasFocus) recordFocus(minutes, true);
        else {
          setRate(null);
          if (settings.logBreaks) onLog(minutes, 'break');
        }
      }
      const go = counted && settings.auto;
      if (wasFocus) {
        const next: Phase = round >= settings.every ? 'long' : 'short';
        begin(next, go);
        setSaid(`${LABEL[next]}.`);
        return;
      }
      if (phase === 'long') {
        // The run went round once.
        if (settings.cycles > 0 && cycle >= settings.cycles) {
          setFinished(true);
          setRound(1);
          setCycle(1);
          begin('focus', false);
          setSaid('All done. Well done.');
          return;
        }
        setCycle(cycle + 1);
        setRound(1);
      } else setRound(round + 1);
      begin('focus', go);
      setSaid('Focus.');
    },
    [phase, partMs, day, taskId, settings, round, cycle, onLog, onRound], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // The Pomodoro clock: a look at the end time a few times a second.
  useTicker(running, () => {
    const left = (endsAt.current ?? 0) - Date.now();
    if (left <= 0) finish(true);
    else setLeftMs((p) => nextLeft(p, left));
  });

  // The tab says how long is left, so it can be read from another tab.
  const tabTime = mode === 'timer' ? mmss(timer.left) : mode === 'stopwatch' ? mmss(stopwatch.ms, false) : mmss(leftMs);
  const tabName = mode === 'timer' ? 'Timer' : mode === 'stopwatch' ? 'Stopwatch' : LABEL[phase];
  useEffect(() => {
    const base = document.title;
    if (anyRunning) document.title = `${tabTime} ${tabName} · kreators.app`;
    return () => {
      document.title = base;
    };
  }, [anyRunning, tabTime, tabName]);

  const start = () => {
    unlockAudio();
    setRate(null);
    setFinished(false);
    endsAt.current = Date.now() + leftMs;
    setRunning(true);
    setSaid(`${LABEL[phase]} started.`);
  };
  const pause = () => {
    setLeftMs(Math.max(0, (endsAt.current ?? 0) - Date.now()));
    endsAt.current = null;
    setRunning(false);
    setSaid('Paused.');
  };
  const rateIt = (value: number) => {
    if (!rate || !rate.id) return;
    const id = rate.id;
    setRate({ ...rate, mode: 'rated', value, failed: false });
    void api
      .focusQuality(id, value)
      .then(() => qc.invalidateQueries({ queryKey: ['focus'] }))
      .catch(() => setRate((r) => (r && r.id === id ? { ...r, mode: 'ask', value: null, failed: true } : r)));
  };
  // A rating shows for a few seconds, then folds away. "Change" brings the choices back.
  useEffect(() => {
    if (rate?.mode !== 'rated') return;
    const t = window.setTimeout(() => setRate(null), 7000);
    return () => window.clearTimeout(t);
  }, [rate?.mode, rate?.value]);
  const reset = () => {
    setRate(null);
    endsAt.current = null;
    setRunning(false);
    setRound(1);
    setCycle(1);
    setFinished(false);
    begin('focus', false);
    setSaid('Back to the first session.');
  };

  // The one button at the top right, for whichever clock is showing.
  const on = mode === 'timer' ? timer.running : mode === 'stopwatch' ? stopwatch.running : running;
  const paused = mode === 'timer' ? !timer.atFull && !timer.running : mode === 'stopwatch' ? stopwatch.ms > 0 && !stopwatch.running : leftMs < partMs - 500 && !running;
  const press = () => {
    if (mode === 'timer') {
      if (timer.running) {
        timer.pause();
        setSaid('Paused.');
      } else {
        unlockAudio();
        setRate(null);
        timer.start();
        setSaid('Timer started.');
      }
    } else if (mode === 'stopwatch') {
      if (stopwatch.running) {
        stopwatch.pause();
        setSaid('Paused.');
      } else {
        unlockAudio();
        stopwatch.start();
        setSaid('Stopwatch started.');
      }
    } else if (running) pause();
    else start();
  };
  // Stopwatch: stop saves the whole minutes (when the switch is on) and goes back to zero; Reset throws the time away.
  const stopStopwatch = () => {
    const minutes = wholeMinutes(stopwatch.reset());
    if (minutes >= 1 && settings.logFocus) {
      recordFocus(minutes, false);
      setSaid(`Stopped. ${minutes} ${minutes === 1 ? 'minute' : 'minutes'} kept.`);
    } else setSaid(minutes >= 1 ? 'Stopped. Nothing kept, since focus sessions do not count as mindful minutes.' : 'Stopped. Under a minute, so nothing was kept.');
  };

  const isBreak = mode === 'pomodoro' && phase !== 'focus';
  const accent = isBreak ? 'r4' : 'r2';
  const slots = Array.from({ length: settings.every }, (_, i) => i + 1);
  const progress = mode === 'timer' ? (timer.total ? 1 - timer.left / timer.total : 0) : mode === 'pomodoro' ? (partMs ? 1 - leftMs / partMs : 0) : 0;
  const readout = mode === 'timer' ? mmss(timer.left) : mode === 'stopwatch' ? mmss(stopwatch.ms, false) : mmss(leftMs);
  const nudgeable = mode !== 'stopwatch';
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

  return (
    <section className="mt-md" aria-labelledby="focus-heading">
      <h2 id="focus-heading" className="text-[24px]">
        Focus sessions
      </h2>
      <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Work in sessions, breathe in the breaks. Today: {plural(day.day === todayLocal() ? day.rounds : 0, 'session')}, {day.day === todayLocal() ? day.minutes : 0} min of focus.</p>

      <div className="mf-stage mt-sm">
        <div className="night-card mf-panel rounded-card" data-accent={accent}>
          <div className="mf-top">
            <div ref={tabs.ref} role="group" aria-label="Kind of clock" className="fx-slide mf-tabs">
              {MODES.map((m) => (
                <button key={m.key} type="button" aria-pressed={mode === m.key} disabled={anyRunning && mode !== m.key} onClick={() => setMode(m.key)}>
                  {m.name}
                </button>
              ))}
            </div>
            <button type="button" className="mf-start toy" onClick={press}>
              {on ? 'Pause' : paused ? 'Resume' : 'Start'}
            </button>
          </div>

          <div className="mf-dial">
            <div className="mf-ruler">
              {mode === 'stopwatch' ? (
                <SecondsStrip seconds={Math.floor(stopwatch.ms / 1000) % 60} live={stopwatch.ms > 0} />
              ) : isBreak ? (
                <BreathOrb active={running} />
              ) : mode === 'timer' ? (
                <RulerPicker
                  label="Timer length"
                  tone="night"
                  accent="r2"
                  {...RULER}
                  value={timerLen}
                  disabled={!timer.atFull}
                  onChange={(v) => {
                    setTimerMin(v);
                    keep(TIMER_KEY, String(v));
                  }}
                  valueText={(v) => `${v} minutes`}
                  format={(v) => String(v)}
                />
              ) : (
                <RulerPicker label="Focus length" tone="night" accent="r2" {...RULER} value={Math.round(partMs / 60_000)} disabled={!idleAtFull} onChange={pickFocus} valueText={(v) => `${v} minutes`} format={(v) => String(v)} />
              )}
            </div>
            <div className="mf-time-wrap">
              <span className="mf-time" role="timer" aria-label={`${mode === 'pomodoro' ? LABEL[phase] : MODES.find((m) => m.key === mode)!.name}, ${readout}${mode === 'stopwatch' ? '' : ' left'}`}>
                {readout}
              </span>
            </div>
          </div>
          {mode !== 'stopwatch' && (
            <div className="mf-bar" aria-hidden="true">
              <span style={{ transform: `scaleX(${Math.min(1, Math.max(0, progress))})` }} />
            </div>
          )}

          {mode === 'pomodoro' ? (
            <div className="mf-sets" role="group" aria-label="Breaks and sessions">
              <ChipSelect label="Short break" value={settings.short} valueLabel={`${settings.short}m`} options={optionsOf(SHORT_CHOICES, settings.short, (n) => `${n} min`)} onChange={(v) => save({ ...settings, short: v })} />
              <ChipSelect label="Long break" value={settings.long} valueLabel={`${settings.long}m`} options={optionsOf(LONG_CHOICES, settings.long, (n) => `${n} min`)} onChange={(v) => save({ ...settings, long: v })} />
              <ChipSelect label="Sessions between long breaks" value={settings.every} valueLabel={String(settings.every)} options={optionsOf(EVERY_CHOICES, settings.every, (n) => `${n} ${n === 1 ? 'session' : 'sessions'}`)} onChange={(v) => save({ ...settings, every: v })} />
              <ChipSelect
                label="Total sessions"
                value={settings.cycles}
                valueLabel={settings.cycles === 0 ? 'Open' : String(settings.cycles * settings.every)}
                options={[{ value: 0, label: 'Until I stop' }, ...Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: `${(i + 1) * settings.every} ${(i + 1) * settings.every === 1 ? 'session' : 'sessions'}, ${plural(i + 1, 'long break')}` }))]}
                onChange={(v) => save({ ...settings, cycles: v })}
              />
            </div>
          ) : (
            <p id="mf-mode-line" className="mf-line">
              {mode === 'timer' ? 'One countdown, no breaks. It counts as mindful minutes only if you switch that on in settings.' : 'Counts up from zero. Stop saves the whole minutes, if you switch that on in settings. Under a minute counts for nothing.'}
            </p>
          )}

          <div className="mf-actions" role="group" aria-label="Clock actions">
            {mode === 'pomodoro' && (
              <>
                <button type="button" className="mf-mini toy" onClick={() => finish(false)} aria-label="Skip to the next part">
                  Skip
                </button>
                <button type="button" className="mf-mini toy" onClick={reset} aria-label="Start again from session one">
                  Reset
                </button>
              </>
            )}
            {mode === 'timer' && (
              <button
                type="button"
                className="mf-mini toy"
                disabled={timer.atFull}
                onClick={() => {
                  timer.stop();
                  setSaid('Stopped. Nothing was kept.');
                }}
                aria-label="Stop the timer and keep nothing"
              >
                Stop
              </button>
            )}
            {mode === 'stopwatch' && (
              <>
                <button type="button" className="mf-mini toy" disabled={stopwatch.ms === 0} onClick={stopStopwatch} aria-label="Stop the stopwatch and save the whole minutes">
                  Stop
                </button>
                <button
                  type="button"
                  className="mf-mini toy"
                  disabled={stopwatch.ms === 0}
                  onClick={() => {
                    stopwatch.reset();
                    setSaid('Back to zero. Nothing was kept.');
                  }}
                  aria-label="Back to zero and keep nothing"
                >
                  Reset
                </button>
              </>
            )}
            {nudgeable && (
              <span className="mf-nudge" role="group" aria-label={`Adjust this ${mode === 'timer' ? 'timer' : LABEL[phase].toLowerCase()}`}>
                <span className="mf-nudge-label">This part</span>
                {[-5, -1, 1, 5].map((m) => (
                  <button key={m} type="button" className="mf-mini toy" onClick={() => (mode === 'timer' ? timer.nudge(m * 60_000) : nudge(m * 60_000))} aria-label={`${m > 0 ? 'Add' : 'Take off'} ${Math.abs(m)} ${Math.abs(m) === 1 ? 'minute' : 'minutes'}`}>
                    {m > 0 ? `+${m}` : `−${-m}`}
                  </button>
                ))}
              </span>
            )}
          </div>

          {mode === 'pomodoro' && (
            <div className="mf-status">
              <div className="mf-dots" role="img" aria-label={`Session ${round} of ${settings.every}${settings.cycles > 0 ? `, run ${cycle} of ${settings.cycles}` : ''}`}>
                {slots.map((n) => (
                  <span key={n} data-state={n < round || (n === round && isBreak) ? 'done' : n === round ? 'now' : 'next'} />
                ))}
                <span className="mf-plus" aria-hidden="true">
                  +
                </span>
                <span className="mf-long" data-on={phase === 'long' ? '' : undefined} title="The long break" />
              </div>
              <p className="mf-line">
                {finished
                  ? 'All the runs are done. Start again whenever you like.'
                  : `Session ${round} of ${settings.every}${settings.cycles > 0 ? `, run ${cycle} of ${settings.cycles}` : ''}. ${isBreak ? 'Breathe in as the circle grows, out as it shrinks.' : picked ? `On it: ${picked.title}` : 'One thing at a time.'}`}
              </p>
            </div>
          )}
          {mode !== 'pomodoro' && picked && <p className="mf-line">On it: {picked.title}</p>}

          {rate && (
            <div className="mf-rate" role="group" aria-label="How focused you were">
              {rate.mode === 'rated' ? (
                <div className="flex items-center justify-between gap-sm">
                  <p className="m-0 text-[14px] font-bold" role="status">
                    Rated {focusQualityName(rate.value)}
                  </p>
                  <button type="button" className="mf-mini toy" onClick={() => setRate({ ...rate, mode: 'ask' })}>
                    Change
                  </button>
                </div>
              ) : (
                <>
                  <p className="m-0 text-[14px] font-extrabold">How focused were you?</p>
                  <div className="mt-xs flex flex-wrap gap-xs">
                    {FOCUS_QUALITY.map((q) => (
                      <button key={q.value} type="button" disabled={!rate.id} onClick={() => rateIt(q.value)} aria-pressed={rate.value === q.value} className="mf-mini toy">
                        {q.name}
                      </button>
                    ))}
                    <button type="button" className="mf-mini toy" onClick={() => setRate(null)}>
                      Skip
                    </button>
                  </div>
                  {rate.failed && (
                    <p role="alert" className="mt-xs m-0 text-[12px] font-bold">
                      That did not save. Try again.
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <div className="mf-rounds">
          <RoundButton at="tl" label="Focus on a task" icon="task" opens onClick={() => setSheet('task')} />
          <RoundButton at="tr" label="Timer settings" icon="gear" opens onClick={() => setSheet('settings')} />
          <RoundButton at="br" label={settings.sound ? 'Sounds are on. Turn them off' : 'Sounds are off. Turn them on'} icon={settings.sound ? 'sound' : 'mute'} onClick={() => save({ ...settings, sound: !settings.sound })} />
          <RoundButton at="bc" label="Background music" icon="music" opens onClick={() => setSheet('music')} />
        </div>
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {said}
      </p>

      <Sheet open={sheet === 'task'} onClose={() => setSheet(null)} title="Focus on a task">
        <label className="block">
          <span className="block text-[14px] font-bold">Working on</span>
          <select value={taskId} onChange={(e) => setTaskId(e.target.value)} className="mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]">
            <option value="">No task picked</option>
            {tasks.data?.tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {RELATIONSHIP_BY_KEY[t.relationship].name}: {t.title}
                {t.dueDate ? ` (due ${t.dueDate})` : ''}
              </option>
            ))}
          </select>
          {tasks.data && tasks.data.tasks.length === 0 && <span className="mt-xs block text-[12px] font-semibold text-ink-soft">No open tasks yet. Add one in Pillars and it shows up here.</span>}
          <span className="mt-xs block text-[12px] font-semibold text-ink-soft">The task is saved with each session that ends from now on. Change it any time.</span>
        </label>
        <Button className="mt-md" full onClick={() => setSheet(null)}>
          Done
        </Button>
      </Sheet>

      <Sheet open={sheet === 'music'} onClose={() => setSheet(null)} title="Background music">
        <SoundControls settings={settings} onChange={save} part="music" />
        <Button className="mt-md" full onClick={() => setSheet(null)}>
          Done
        </Button>
      </Sheet>

      <Sheet open={sheet === 'settings'} onClose={() => setSheet(null)} title="Timer settings">
        <p className="m-0 text-[14px] font-extrabold">Your plan</p>
        <div className="scroll-row mt-xs flex gap-xs" role="group" aria-label="Plans to start from">
          {FOCUS_PRESETS.map((p) => {
            const same = settings.focus === p.focus && settings.short === p.short && settings.long === p.long && settings.every === p.every;
            return (
              <button key={p.name} type="button" aria-pressed={same} onClick={() => save({ ...settings, ...p })} className={`toy min-h-[44px] shrink-0 rounded-pill border-2 px-sm text-[14px] font-bold ${same ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}>
                {p.name} {p.focus}/{p.short}
              </button>
            );
          })}
        </div>
        <p className="mt-xs m-0 text-[12px] font-semibold text-ink-soft">{planLine(settings)}</p>
        <div className="mt-sm flex flex-col gap-xs text-left">
          <Toggle compact on={settings.logFocus} onChange={(v) => save({ ...settings, logFocus: v })} label="Count finished focus sessions as mindful minutes" />
          <Toggle compact on={settings.logBreaks} onChange={(v) => save({ ...settings, logBreaks: v })} label="Count finished breaks as mindful minutes" />
          <Toggle compact on={settings.auto} onChange={(v) => save({ ...settings, auto: v })} label="Start the next part by itself" />
        </div>
        <div className="mt-md border-t border-line pt-sm">
          <SoundControls settings={settings} onChange={save} breaks />
        </div>
        <Button className="mt-md" full onClick={() => setSheet(null)}>
          Done
        </Button>
      </Sheet>
    </section>
  );
}
