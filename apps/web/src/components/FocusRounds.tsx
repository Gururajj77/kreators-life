import { RELATIONSHIP_BY_KEY } from '@kreators/shared';
import { useQuery } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { api } from '../lib/api';
import { todayLocal } from '../lib/date';
import { useSession } from '../lib/store';
import { Button } from './Button';
import { Toggle } from './Toggle';

type Phase = 'focus' | 'short' | 'long';
interface Settings {
  /** Minutes of focus in a round, of a mini break, and of the long break. */
  focus: number;
  short: number;
  long: number;
  /** Rounds of focus before the long break. The mini breaks between them are one fewer. */
  every: number;
  /** How many times the whole run (the rounds, then the long break) goes round before it stops. Zero means until you stop. */
  cycles: number;
  auto: boolean;
  logBreaks: boolean;
  logFocus: boolean;
}
const PRESETS: { name: string; focus: number; short: number; long: number; every: number }[] = [
  { name: 'Classic', focus: 25, short: 5, long: 30, every: 4 },
  { name: 'Deep', focus: 50, short: 10, long: 30, every: 3 },
  { name: 'Light', focus: 15, short: 3, long: 15, every: 4 },
];
const DEFAULTS: Settings = { ...PRESETS[0]!, cycles: 0, auto: false, logBreaks: true, logFocus: false };
const LABEL: Record<Phase, string> = { focus: 'Focus', short: 'Mini break', long: 'Long break' };
const SETTINGS_KEY = 'kreators.focusRounds.settings';
const DAY_KEY = 'kreators.focusRounds.day';
const MAX_PART_MIN = 180;

const clampInt = (v: unknown, lo: number, hi: number, fallback: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;
};
function readSettings(): Settings {
  try {
    const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') as Partial<Settings>;
    return {
      focus: clampInt(raw.focus, 1, 120, DEFAULTS.focus),
      short: clampInt(raw.short, 1, 60, DEFAULTS.short),
      long: clampInt(raw.long, 1, 120, DEFAULTS.long),
      every: clampInt(raw.every, 1, 12, DEFAULTS.every),
      cycles: clampInt(raw.cycles, 0, 12, DEFAULTS.cycles),
      auto: raw.auto === true,
      logBreaks: raw.logBreaks !== false,
      logFocus: raw.logFocus === true,
    };
  } catch {
    return DEFAULTS;
  }
}
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

/** A soft two-note chime. Silent where the browser has no audio. */
function chime() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    [660, 880].forEach((hz, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = hz;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.28);
      gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + i * 0.28 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.28 + 0.6);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.28);
      osc.stop(ctx.currentTime + i * 0.28 + 0.65);
    });
    window.setTimeout(() => void ctx.close(), 1500);
  } catch {
    // no sound here
  }
}

const mmss = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const hoursMin = (min: number) => (min >= 60 ? `${Math.floor(min / 60)} h ${min % 60 ? `${min % 60} min` : ''}`.trim() : `${min} min`);

/** A plain line for what the settings add up to. */
export function planLine(s: Settings): string {
  const cycle = s.every * s.focus + (s.every - 1) * s.short + s.long;
  const minis = s.every - 1;
  const run = `${s.focus} min of focus, ${s.every} ${s.every === 1 ? 'session' : 'sessions'}${minis > 0 ? ` with ${minis} mini ${minis === 1 ? 'break' : 'breaks'} of ${s.short} min` : ''}, then a ${s.long} min long break`;
  return `${run}. ${s.cycles > 0 ? `${s.cycles} ${s.cycles === 1 ? 'time' : 'times'}, ${hoursMin(cycle * s.cycles - s.long)} before the last long break.` : `That is ${hoursMin(cycle)} for one go, and it carries on until you stop.`}`;
}

function Stepper({ label, value, min, max, onChange, unit = '', hint }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void; unit?: string; hint?: string }) {
  return (
    <div className="rounded-tile bg-card p-xs">
      <span className="block text-[12px] font-extrabold text-ink-soft">{label}</span>
      <div className="mt-xs flex items-center justify-between gap-xs">
        <button type="button" aria-label={`Less ${label.toLowerCase()}`} disabled={value <= min} onClick={() => onChange(value - 1)} className="toy toy-soft flex size-[44px] items-center justify-center rounded-pill border border-line bg-card-strong text-[20px] font-extrabold disabled:opacity-40">
          −
        </button>
        <span className="font-display text-[22px] font-extrabold" aria-live="polite">
          {value}
          {unit && <span className="text-[12px] font-bold text-ink-soft"> {unit}</span>}
        </span>
        <button type="button" aria-label={`More ${label.toLowerCase()}`} disabled={value >= max} onClick={() => onChange(value + 1)} className="toy toy-soft flex size-[44px] items-center justify-center rounded-pill border border-line bg-card-strong text-[20px] font-extrabold disabled:opacity-40">
          +
        </button>
      </div>
      {hint && <span className="mt-xs block text-[12px] font-semibold text-ink-mute">{hint}</span>}
    </div>
  );
}

/**
 * Pomodoro-style sessions for Mindful minutes. The classic run is 25 minutes of focus and a 5 minute mini break, four times, then a 30 minute
 * long break; every part of it can be changed, also while it runs: the length of a round, of a mini break and of the long break, how many
 * rounds come before the long break (so how many mini breaks), and how many times the run goes round. A change to the kind of part you are
 * in moves its end; the "adjust this part" buttons change only the part you are in. The clock runs on an end time, so a background tab stays
 * right. A round can be pointed at one of your tasks; a finished round is kept, with the task, for the dashboard.
 */
export function FocusRounds({ onLog, onRound }: { onLog: (minutes: number, kind: 'break' | 'focus') => void; onRound: (minutes: number, nodeId: string | null) => void }) {
  const reduce = useReducedMotion();
  const token = useSession((s) => s.token);
  const [settings, setSettings] = useState<Settings>(readSettings);
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
  const endsAt = useRef<number | null>(null);
  const lock = useRef<{ release: () => Promise<void> } | null>(null);
  const tasks = useQuery({ queryKey: ['focus-tasks'], queryFn: api.focusTasks, enabled: Boolean(token), staleTime: 60_000 });
  const picked = tasks.data?.tasks.find((t) => t.id === taskId) ?? null;

  // "Start focus" on a task opens this with the task picked and its estimate as the first round's length. That is only this round: the saved lengths do not change.
  const [params] = useSearchParams();
  useEffect(() => {
    const t = params.get('task');
    const m = clampInt(params.get('min'), 0, MAX_PART_MIN, 0);
    if (t) setTaskId(t);
    if (m > 0) {
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

  // Change the part you are in by some milliseconds: the end moves, and so does the ring's total.
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
    setSettings(next);
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    } catch {
      // not kept, still works
    }
    if (finished && next.cycles !== settings.cycles) setFinished(false);
    if (delta === 0) return;
    if (idleAtFull) {
      setPartMs(length(phase, next));
      setLeftMs(length(phase, next));
    } else nudge(delta);
  };

  // Keep the screen awake while a round runs, where the browser allows it.
  useEffect(() => {
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
    if (running && nav.wakeLock) void nav.wakeLock.request('screen').then((l) => (lock.current = l)).catch(() => undefined);
    return () => {
      void lock.current?.release().catch(() => undefined);
      lock.current = null;
    };
  }, [running]);

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
        chime();
        try {
          navigator.vibrate?.([200, 100, 200]);
        } catch {
          // no vibration here
        }
        if (wasFocus) {
          const next = { day: todayLocal(), rounds: day.rounds + 1, minutes: day.minutes + minutes };
          setDay(next);
          try {
            localStorage.setItem(DAY_KEY, JSON.stringify(next));
          } catch {
            // not kept
          }
          onRound(minutes, taskId || null);
          if (settings.logFocus) onLog(minutes, 'focus');
        } else if (settings.logBreaks) onLog(minutes, 'break');
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

  // The clock: a look at the end time a few times a second.
  useEffect(() => {
    if (!running) return;
    const t = window.setInterval(() => {
      const left = (endsAt.current ?? 0) - Date.now();
      if (left <= 0) finish(true);
      else setLeftMs(left);
    }, 250);
    return () => window.clearInterval(t);
  }, [running, finish]);

  // The tab says how long is left, so it can be read from another tab.
  useEffect(() => {
    const base = document.title;
    if (running) document.title = `${mmss(leftMs)} ${LABEL[phase]} · kreators.app`;
    return () => {
      document.title = base;
    };
  }, [running, leftMs, phase]);

  const start = () => {
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
  const reset = () => {
    endsAt.current = null;
    setRunning(false);
    setRound(1);
    setCycle(1);
    setFinished(false);
    begin('focus', false);
    setSaid('Back to the first session.');
  };

  const progress = partMs ? Math.min(1, Math.max(0, 1 - leftMs / partMs)) : 0;
  const isBreak = phase !== 'focus';
  const R = 88;
  const C = 2 * Math.PI * R;
  const color = isBreak ? 'var(--color-r4)' : 'var(--color-r1)';
  const slots = Array.from({ length: settings.every }, (_, i) => i + 1);

  return (
    <section className="mt-md rounded-card p-md text-center" style={{ background: isBreak ? 'var(--tint-green)' : 'var(--tint-yellow)' }} aria-labelledby="focus-heading">
      <h2 id="focus-heading" className="text-[24px]">
        Focus sessions
      </h2>
      <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Work in sessions, breathe in the breaks. Today: {day.rounds} {day.rounds === 1 ? 'session' : 'sessions'}, {day.minutes} min of focus.</p>

      <div className="relative mx-auto mt-md flex h-[200px] w-[200px] items-center justify-center" role="timer" aria-label={`${LABEL[phase]}, ${mmss(leftMs)} left`}>
        <svg viewBox="0 0 200 200" className="absolute inset-0 size-full -rotate-90" aria-hidden="true">
          <circle cx="100" cy="100" r={R} fill="none" stroke="var(--color-line)" strokeWidth="10" />
          <circle cx="100" cy="100" r={R} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - progress)} />
        </svg>
        <motion.div
          className="flex size-[132px] flex-col items-center justify-center rounded-pill bg-card font-display text-ink shadow-toy-soft"
          animate={running && isBreak && !reduce ? { scale: [1, 1.12, 1.12, 1] } : { scale: 1 }}
          transition={running && isBreak && !reduce ? { duration: 10, times: [0, 0.4, 0.5, 1], repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' } : { duration: 0.3 }}
        >
          <span className="text-[34px] font-extrabold leading-none">{mmss(leftMs)}</span>
          <span className="mt-xs text-[12px] font-extrabold uppercase tracking-wide text-ink-soft">{LABEL[phase]}</span>
        </motion.div>
      </div>

      <div className="mt-sm flex items-center justify-center gap-xs" role="img" aria-label={`Session ${round} of ${settings.every}${settings.cycles > 0 ? `, run ${cycle} of ${settings.cycles}` : ''}`}>
        {slots.map((n) => (
          <span key={n} className="block size-[12px] rounded-pill" style={{ background: n < round || (n === round && isBreak) ? 'var(--color-ink)' : n === round ? color : 'var(--color-line)' }} />
        ))}
        <span className="ml-xs text-[12px] font-extrabold text-ink-soft" aria-hidden="true">
          +
        </span>
        <span className="block size-[14px] rounded-pill border-2" style={{ borderColor: phase === 'long' ? 'var(--color-r4)' : 'var(--color-line)', background: phase === 'long' ? 'var(--color-r4)' : 'transparent' }} title="The long break" />
      </div>
      <p className="mt-xs m-0 text-[12px] font-bold text-ink-soft">
        {finished
          ? 'All the runs are done. Start again whenever you like.'
          : `Session ${round} of ${settings.every}${settings.cycles > 0 ? `, run ${cycle} of ${settings.cycles}` : ''}. ${isBreak ? 'Breathe in as the circle grows, out as it shrinks.' : picked ? `On it: ${picked.title}` : 'One thing at a time.'}`}
      </p>

      {/* The task for the session: one of your own, still to do. Changing it takes effect from the next session that ends. */}
      <label className="mt-sm block text-left">
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
      </label>

      <div className="mt-md grid grid-cols-[1fr_auto_auto] gap-xs">
        {running ? (
          <Button size="lg" variant="outline" onClick={pause}>
            Pause
          </Button>
        ) : (
          <Button size="lg" onClick={start}>
            {leftMs < partMs - 500 ? 'Resume' : `Start ${LABEL[phase].toLowerCase()}`}
          </Button>
        )}
        <Button size="lg" variant="outline" onClick={() => finish(false)} aria-label="Skip to the next part">
          Skip
        </Button>
        <Button size="lg" variant="ghost" onClick={reset} aria-label="Start again from session one">
          Reset
        </Button>
      </div>

      {/* This part only: a minute or five more or less, whether it runs or waits. */}
      <div className="mt-sm flex flex-wrap items-center justify-center gap-xs" role="group" aria-label={`Adjust this ${LABEL[phase].toLowerCase()}`}>
        <span className="text-[12px] font-extrabold text-ink-soft">This {LABEL[phase].toLowerCase()}:</span>
        {[-5, -1, 1, 5].map((m) => (
          <button key={m} type="button" onClick={() => nudge(m * 60_000)} className="toy toy-soft min-h-[40px] min-w-[44px] rounded-pill border border-line bg-card-strong px-sm text-[14px] font-extrabold">
            {m > 0 ? `+${m}` : `−${-m}`}
          </button>
        ))}
        <span className="text-[12px] font-bold text-ink-soft">min</span>
      </div>

      {/* The plan: every length and count, changeable at any time. */}
      <div className="mt-md text-left">
        <p className="m-0 text-[14px] font-extrabold">Your plan</p>
        <div className="scroll-row mt-xs flex gap-xs" role="group" aria-label="Plans to start from">
          {PRESETS.map((p) => {
            const on = settings.focus === p.focus && settings.short === p.short && settings.long === p.long && settings.every === p.every;
            return (
              <button key={p.name} type="button" aria-pressed={on} onClick={() => save({ ...settings, ...p })} className={`toy min-h-[44px] shrink-0 rounded-pill border-2 px-sm text-[14px] font-bold ${on ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}>
                {p.name} {p.focus}/{p.short}
              </button>
            );
          })}
        </div>
        <div className="mt-xs grid grid-cols-2 gap-xs">
          <Stepper label="Focus session" value={settings.focus} min={1} max={120} unit="min" onChange={(v) => save({ ...settings, focus: v })} />
          <Stepper label="Mini break" value={settings.short} min={1} max={60} unit="min" onChange={(v) => save({ ...settings, short: v })} />
          <Stepper label="Sessions before the long break" value={settings.every} min={1} max={12} hint={settings.every > 1 ? `${settings.every - 1} mini ${settings.every - 1 === 1 ? 'break' : 'breaks'} between them` : 'No mini breaks'} onChange={(v) => save({ ...settings, every: v })} />
          <Stepper label="Long break" value={settings.long} min={1} max={120} unit="min" onChange={(v) => save({ ...settings, long: v })} />
          <Stepper label="Runs, then stop (0 is until I stop)" value={settings.cycles} min={0} max={12} hint={settings.cycles === 0 ? 'Carries on until you stop' : `${settings.cycles} long ${settings.cycles === 1 ? 'break' : 'breaks'} in all`} onChange={(v) => save({ ...settings, cycles: v })} />
        </div>
        <p className="mt-xs m-0 text-[12px] font-semibold text-ink-soft">{planLine(settings)}</p>
      </div>

      <div className="mt-sm flex flex-col gap-xs text-left">
        <Toggle compact on={settings.auto} onChange={(v) => save({ ...settings, auto: v })} label="Start the next part by itself" />
        <Toggle compact on={settings.logBreaks} onChange={(v) => save({ ...settings, logBreaks: v })} label="Count finished breaks as mindful minutes" />
        <Toggle compact on={settings.logFocus} onChange={(v) => save({ ...settings, logFocus: v })} label="Count finished focus sessions as mindful minutes too" />
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        {said}
      </p>
    </section>
  );
}
