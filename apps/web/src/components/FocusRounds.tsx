import { BREAK_BEATS, BREATH_CUES, BREATH_PATTERNS, breathAtPace, breathPatternFor, breathRounds, FOCUS_MAX_MINUTES, FOCUS_PRESETS, FOCUS_QUALITY, focusQualityName, RELATIONSHIP_BY_KEY, type BreathStepKind, type FocusMode, type FocusRoundRow, type FocusSettings } from '@kreators/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router';
import { focusRunActive, parseFocusRun, resumeFrom, type FocusRun, type FocusResume } from '@kreators/shared/focusRun';
import { api } from '../lib/api';
import { clockTime, todayLocal } from '../lib/date';
import { MAX_PART_MIN, mmss, nextLeft, useCountdown, useStopwatch, useTicker, wholeMinutes } from '../lib/focusClocks';
import { useFocusPrefs } from '../lib/focusPrefs';
import { useFocusPortal } from '../lib/focusPortal';
import { claimPart, FOCUS_TAB_ID, focusChannel, focusRunOwner, markPartDone, partDone, readFocusRun, snapshotLeftMs, useFocusSession, writeFocusRun, type FocusKind, type FocusSnapshot, type FocusTabMessage } from '../lib/focusSession';
import { useRefreshAll } from '../lib/queries';
import { useDebounced } from '../lib/useDebounced';
import { chip, FIELD } from '../lib/ui';
import { playBeats, playBreathCue, playChime, unlockAudio, useAmbient } from '../lib/sound';
import { BreathFour } from './BreathFour';
import { useFocus, useSession } from '../lib/store';
import { Button } from './Button';
import { ChipSelect, type ChipOption } from './ChipSelect';
import { RoundButton as RoundButtonBase } from './RoundButton';
import { useSlider } from './fx/useSlider';
import { RulerPicker } from './RulerPicker';
import { Sheet } from './Sheet';
import { TabRow } from './TabRow';
import { SoundControls } from './SoundControls';
import { Toggle } from './Toggle';
import { Icon as LucideGlyph } from './Icon';
import { AnimatedIcon } from './AnimatedIcon';
import { EighthNotes, Play, Square, Target } from 'lucide-react';

type Phase = 'focus' | 'short' | 'long';
type Mode = 'breathe' | 'timer' | 'pomodoro' | 'stopwatch';
type Settings = FocusSettings;
const LABEL: Record<Phase, string> = { focus: 'Focus', short: 'Mini break', long: 'Long break' };
const MODES: readonly { key: Mode; name: string; blurb: string }[] = [
  { key: 'breathe', name: 'Breathe', blurb: 'Breathe with the circle.' },
  { key: 'timer', name: 'Timer', blurb: 'One countdown, no breaks.' },
  { key: 'pomodoro', name: 'Pomodoro', blurb: 'Focus sessions with breaks.' },
  { key: 'stopwatch', name: 'Stopwatch', blurb: 'Counts up from zero.' },
];
const TAB_KEY = 'kreators.focusTab';
const TIMER_KEY = 'kreators.focusTimerMin';
const BREATHE_KEY = 'kreators.breatheMin';
const BREATHE_LENGTHS = [1, 3, 5, 10];
/** The fifth quick length, only while the panel is narrow (a phone, or a tablet beside the sidebar), where the lengths have a row of their own (`.mf-quick-extra`). */
const PHONE_BREATHE_LENGTH = 25;
const RULER = { min: 5, max: 120, step: 5, labelEvery: 10 } as const;

const clampInt = (v: unknown, lo: number, hi: number, fallback: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;
};
/** Yesterday on this device, as YYYY-MM-DD: a forgotten session can be added for today or yesterday. */
function yesterdayLocal(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
/** "1 h 5 m", "40 m": a length said short, for the buttons after a long time away. */
const spanShort = (ms: number) => {
  const m = Math.floor(Math.max(0, ms) / 60_000);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
};
const MODE_NAME: Record<FocusMode, string> = { timer: 'Timer', pomodoro: 'Pomodoro', stopwatch: 'Stopwatch', manual: 'Added' };
/** True while someone is typing in a box, so a shortcut key types its letter instead. */
const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
const DAY_LETTERS = [
  { n: 1, short: 'Mo', long: 'Mon' },
  { n: 2, short: 'Tu', long: 'Tue' },
  { n: 3, short: 'We', long: 'Wed' },
  { n: 4, short: 'Th', long: 'Thu' },
  { n: 5, short: 'Fr', long: 'Fri' },
  { n: 6, short: 'Sa', long: 'Sat' },
  { n: 7, short: 'Su', long: 'Sun' },
] as const;
const readTab = (): Mode => {
  try {
    const v = localStorage.getItem(TAB_KEY);
    return v === 'breathe' || v === 'timer' || v === 'pomodoro' || v === 'stopwatch' ? v : 'breathe';
  } catch {
    return 'breathe';
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

/**
 * The round buttons' glyphs: lucide icons through the one wrapper; settings is the animated gear and the sound switch the animated
 * speaker from useanimations (a still glyph until they load). The speaker is the one master switch: its waves go and a slash
 * crosses it when sounds are turned off, and come back when they are turned on.
 */
function RoundGlyph({ name, active = false }: { name: 'gear' | 'sound' | 'mute' | 'music' | 'task' | 'full'; active?: boolean }) {
  if (name === 'gear') return <AnimatedIcon name="settings" size={20} />;
  // The card table's own focus-mode glyph: corner brackets that point in once it is on.
  if (name === 'full') return <AnimatedIcon name="maximizeMinimize" size={20} active={active} />;
  if (name === 'sound' || name === 'mute') return <AnimatedIcon name="volume" size={20} active={name === 'mute'} />;
  const glyph = { music: EighthNotes, task: Target }[name];
  return <LucideGlyph icon={glyph} size={20} />;
}

/** A round glass button that floats by the panel: a name for screen readers, and the same name as a tooltip on hover and keyboard focus. */
function RoundButton({ at, label, icon, onClick, opens = false, pressed }: { at: 'tl' | 'tr' | 'br' | 'bc'; label: string; icon: 'gear' | 'sound' | 'mute' | 'music' | 'task' | 'full'; onClick: () => void; /** It opens a dialog. */ opens?: boolean; /** A switch that stays on (full screen). */ pressed?: boolean }) {
  return (
    <RoundButtonBase at={at} label={label} onClick={onClick} opens={opens} pressed={pressed}>
      <RoundGlyph name={icon} active={pressed} />
    </RoundButtonBase>
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


/**
 * Pick the task a session is for: the tasks focused on lately first (up to five, newest first), then a search over every open task
 * (300 ms after the last key), then what it finds. "No task" is a row like the rest. Each row is a 44px tap.
 */
function TaskPicker({ value, onPick, enabled, hint = 'The task is saved with each session that ends from now on.' }: { value: string; onPick: (id: string, title: string | null) => void; enabled: boolean; hint?: string }) {
  const [q, setQ] = useState('');
  const dq = useDebounced(q.trim(), 300);
  const recent = useQuery({ queryKey: ['focus-recent'], queryFn: () => api.focusRecent(), enabled, staleTime: 30_000 });
  const found = useQuery({ queryKey: ['focus-tasks', dq], queryFn: () => api.focusTasks(dq), enabled, staleTime: 30_000 });
  const recentIds = new Set(recent.data?.tasks.map((t) => t.id) ?? []);
  const results = (found.data?.tasks ?? []).filter((t) => dq !== '' || !recentIds.has(t.id)).slice(0, dq ? 12 : 8);
  const row = (id: string, title: string, sub: string | null) => (
    <li key={id || 'none'}>
      <button
        type="button"
        aria-pressed={value === id}
        onClick={() => onPick(id, id ? title : null)}
        className={`toy flex min-h-[44px] w-full items-center justify-between gap-sm rounded-tile border-2 px-sm py-xs text-left text-headline ${value === id ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}
      >
        <span className="min-w-0 truncate">{title}</span>
        {sub && <span className="shrink-0 text-caption opacity-80">{sub}</span>}
      </button>
    </li>
  );
  const sub = (t: { relationship: keyof typeof RELATIONSHIP_BY_KEY; dueDate: string | null }) => `${RELATIONSHIP_BY_KEY[t.relationship].name}${t.dueDate ? `, ${t.dueDate}` : ''}`;
  return (
    <div>
      <ul className="m-0 flex list-none flex-col gap-xs p-0">
        {row('', 'No task', null)}
      </ul>
      {(recent.data?.tasks.length ?? 0) > 0 && (
        <>
          <p className="mt-sm m-0 text-subhead font-semibold">Recent</p>
          <ul className="mt-xs m-0 flex list-none flex-col gap-xs p-0" aria-label="Tasks you focused on lately">
            {recent.data!.tasks.map((t) => row(t.id, t.title, sub(t)))}
          </ul>
        </>
      )}
      <label className="mt-sm block">
        <span className="block text-subhead font-semibold">Find a task</span>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} className={FIELD} placeholder="Type part of its name" aria-describedby="focus-find-hint" />
      </label>
      <ul className="mt-xs m-0 flex list-none flex-col gap-xs p-0" aria-label={dq ? `Tasks matching ${dq}` : 'Your next open tasks'}>
        {results.map((t) => row(t.id, t.title, sub(t)))}
      </ul>
      <p id="focus-find-hint" className="mt-xs m-0 text-caption text-ink-soft">
        {found.data && results.length === 0 ? (dq ? 'No open task by that name.' : 'No open tasks yet. Add one in Pillars and it shows up here.') : hint}
      </p>
    </div>
  );
}

/**
 * Change a finished session (its length and its task) or delete it, or add one that was forgotten, for today or yesterday. A session that
 * also counted as mindful minutes changes its log with it, on the server. Delete asks once more first.
 */
function SessionEditor({ edit, onClose, enabled, owner, logFocus }: { edit: FocusRoundRow | 'new'; onClose: () => void; enabled: boolean; owner: string; logFocus: boolean }) {
  const qc = useQueryClient();
  const refresh = useRefreshAll();
  const fresh = edit === 'new';
  const [minutes, setMinutes] = useState(fresh ? 25 : edit.minutes);
  const [nodeId, setNodeId] = useState(fresh ? '' : (edit.nodeId ?? ''));
  const [title, setTitle] = useState<string | null>(fresh ? null : edit.title || null);
  const [day, setDay] = useState<'today' | 'yesterday'>('today');
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const max = Math.max(240, Math.ceil(minutes / 30) * 30);
  const done = (mindful: boolean) => {
    void qc.invalidateQueries({ queryKey: ['focus'] });
    void qc.invalidateQueries({ queryKey: ['focus-today'] });
    void qc.invalidateQueries({ queryKey: ['focus-recent'] });
    if (mindful) refresh();
    onClose();
  };
  const fail = () => {
    setBusy(false);
    setError('That did not save. Try again.');
  };
  const save = () => {
    setBusy(true);
    setError('');
    if (fresh)
      void api
        .logFocus(minutes, nodeId || null, day === 'today' ? todayLocal() : yesterdayLocal(), { mode: 'manual', mindful: logFocus, clientRef: `${owner || 'me'}:manual:${Date.now()}` })
        .then((r) => done(r.logged))
        .catch(fail);
    else
      void api
        .editFocus(edit.id, { minutes, nodeId: nodeId || null })
        .then(() => done(edit.mindful))
        .catch(fail);
  };
  const remove = () => {
    if (fresh) return;
    setBusy(true);
    void api
      .deleteFocus(edit.id)
      .then(() => done(edit.mindful))
      .catch(fail);
  };
  return (
    <>
      {fresh && (
        <div className="flex gap-xs" role="group" aria-label="Which day">
          <button type="button" aria-pressed={day === 'today'} onClick={() => setDay('today')} className={chip(day === 'today')}>
            Today
          </button>
          <button type="button" aria-pressed={day === 'yesterday'} onClick={() => setDay('yesterday')} className={chip(day === 'yesterday')}>
            Yesterday
          </button>
        </div>
      )}
      <p className="mt-sm m-0 text-subhead font-semibold">
        Length: {minutes} {minutes === 1 ? 'minute' : 'minutes'}
      </p>
      <RulerPicker label="Session length" min={1} max={max} step={1} labelEvery={30} majorStep={5} value={minutes} onChange={setMinutes} valueText={(v) => `${v} ${v === 1 ? 'minute' : 'minutes'}`} format={(v) => String(v)} />
      <p className="mt-sm m-0 text-subhead font-semibold">Task: {title ?? 'No task'}</p>
      <div className="mt-xs">
        <TaskPicker
          value={nodeId}
          enabled={enabled}
          hint={fresh ? 'Pick the task this session was for, or leave it on No task.' : 'Pick another task to move this session to it.'}
          onPick={(id, t) => {
            setNodeId(id);
            setTitle(t);
          }}
        />
      </div>
      {!fresh && edit.mindful && <p className="mt-sm m-0 text-caption text-ink-soft">It also counted as mindful minutes. Those change with it.</p>}
      {error && (
        <p role="alert" className="mt-sm m-0 text-subhead">
          {error}
        </p>
      )}
      <Button className="mt-md" full disabled={busy} onClick={save}>
        {fresh ? 'Add this session' : 'Save'}
      </Button>
      {!fresh &&
        (asking ? (
          <div className="mt-sm grid grid-cols-2 gap-xs" role="group" aria-label="Delete this session?">
            <Button variant="outline" disabled={busy} onClick={remove}>
              Delete it
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => setAsking(false)}>
              Keep it
            </Button>
          </div>
        ) : (
          <Button className="mt-sm" variant="outline" full disabled={busy} onClick={() => setAsking(true)}>
            Delete this session
          </Button>
        ))}
    </>
  );
}

/**
 * The focus panel of Mindfulness: a dark slate glass card with three kinds of clock (Timer, Pomodoro, Stopwatch) under one row of tabs,
 * a ruler to choose how long a focus part is, the time in large figures, and the break settings as four small chips. Four round buttons float
 * by it (settings, sounds on or off, background music, the task being worked on). Every clock runs on an end time or a start instant, so a
 * background tab stays right; it keeps the screen awake, chimes and buzzes at the end, and puts the time in the tab's title.
 *
 * What logs: a Pomodoro focus round is always kept for the dashboard and counts as mindful minutes only if that switch is on; a finished
 * break counts only if its switch is on; a finished Timer and a stopped Stopwatch (whole minutes, at most a day, nothing under a minute) are
 * kept the same way and only when the "focus sessions count as mindful minutes" switch is on. Skipping or stopping a part early counts nothing.
 */
export function FocusRounds({
  onLog,
  onRound,
}: {
  onLog: (minutes: number, kind: 'break' | 'breathe') => void;
  /** Keep a finished focus session; with `mindful` it also counts as mindful minutes, in the same write. Resolves to the round's id. */
  onRound: (minutes: number, nodeId: string | null, more: { clientRef: string; mode: FocusMode; mindful: boolean }) => void | Promise<string | void | undefined>;
}) {
  const qc = useQueryClient();
  // How the last finished focus session felt. Asked after a session, never in the way of the clock; a rating is private and pays nothing.
  const [rate, setRate] = useState<{ id: string | null; mode: 'ask' | 'rated'; value: number | null; failed: boolean } | null>(null);
  const rateSeq = useRef(0);
  const token = useSession((s) => s.token);
  const owner = focusRunOwner(token);
  // A clock this tab wrote down before a reload or a full page load (sessionStorage, this session's own), picked back up as it was.
  const [resumed] = useState<FocusResume | null>(() => {
    const run = parseFocusRun(readFocusRun(), owner);
    return run && focusRunActive(run) ? resumeFrom(run, Date.now()) : null;
  });
  // The parts that ran out while the page was gone end without a chime (the browser would not play one before a tap anyway).
  const quietEnds = useRef(new Set([resumed?.run.endsAt, resumed?.timer.due ? resumed.timer.endsAt : null, resumed?.breathe.due ? resumed.breathe.endsAt : null].filter((n): n is number => typeof n === 'number' && n <= Date.now())));
  const { settings, set: setPrefs, ready } = useFocusPrefs();
  const fromUrl = useRef(false);
  const [params] = useSearchParams();
  const loc = useLocation();
  const [mode, setModeState] = useState<Mode>(() => resumed?.run.mode ?? readTab());
  const [phase, setPhase] = useState<Phase>(resumed?.run.phase ?? 'focus');
  const [round, setRound] = useState(resumed?.run.round ?? 1);
  const [cycle, setCycle] = useState(resumed?.run.cycle ?? 1);
  const [running, setRunning] = useState(resumed?.pomodoro.running ?? false);
  const [partMs, setPartMs] = useState(resumed?.run.partMs ?? settings.focus * 60_000);
  const [leftMs, setLeftMs] = useState(resumed?.pomodoro.leftMs ?? settings.focus * 60_000);
  const [taskId, setTaskId] = useState(resumed?.run.taskId ?? '');
  // The picked task's title, from the picker; a task picked before a reload is looked up in the open tasks below.
  const [taskTitle, setTaskTitle] = useState<string | null>(null);
  const [finished, setFinished] = useState(resumed?.run.finished ?? false);
  const [said, setSaidState] = useState('');
  // The same line goes to the shared store, so FocusRoundsHost can say it while this panel is parked off Mindful (aria-hidden there).
  const setSaid = (text: string) => {
    setSaidState(text);
    useFocusSession.getState().say(text);
  };
  const [sheet, setSheet] = useState<'settings' | 'music' | 'task' | 'keys' | null>(null);
  // Stop past a whole minute asks: keep the minutes so far, or throw them away.
  const [stopAsk, setStopAsk] = useState<{ minutes: number; mode: 'timer' | 'pomodoro' } | null>(null);
  // A finished session being changed, or 'new' for one added afterwards.
  const [edit, setEdit] = useState<FocusRoundRow | 'new' | null>(null);
  // The panel sits in a page's slot (Mindful or Home), not parked: it can be seen, so its own sheets ask and full screen holds.
  const onMindful = useFocusPortal((st) => st.target !== null);
  // Only Mindful takes the laptop's shortcut keys; on Home Space must not start a clock.
  const keysHere = useFocusPortal((st) => st.page === 'mindful');
  const fullOn = useFocus((st) => st.on);
  const setFull = useFocus((st) => st.set);
  // Another tab already runs the clock this tab was copied with: this one shows that clock and runs nothing itself.
  const [elsewhere, setElsewhere] = useState<{ tab: string; snap: FocusSnapshot | null } | null>(null);
  const endsAt = useRef<number | null>(resumed?.pomodoro.running ? resumed.run.endsAt : null);
  const lock = useRef<{ release: () => Promise<void> } | null>(null);
  const tasks = useQuery({ queryKey: ['focus-tasks', ''], queryFn: () => api.focusTasks(), enabled: Boolean(token), staleTime: 60_000 });
  const pickedTitle = taskId ? (taskTitle ?? tasks.data?.tasks.find((t) => t.id === taskId)?.title ?? null) : null;
  const picked = pickedTitle ? { id: taskId, title: pickedTitle } : null;
  const pickTask = (id: string, title: string | null) => {
    setTaskId(id);
    setTaskTitle(title);
  };
  // Today's finished sessions, from the server: the list under the panel, and the tally in the line under the heading.
  const todayKey = todayLocal();
  const today = useQuery({ queryKey: ['focus-today', todayKey], queryFn: () => api.focusToday(todayKey), enabled: Boolean(token), staleTime: 30_000 });
  const todayRounds = today.data?.rounds ?? [];
  const todayMinutes = todayRounds.reduce((n, r) => n + r.minutes, 0);
  const tabs = useSlider<HTMLDivElement>('[aria-pressed="true"]', mode);

  // The Timer's length is its own, kept on this device; until the person sets one it follows their saved focus length.
  const [timerMin, setTimerMin] = useState<number | null>(readTimerMin);
  const timerLen = timerMin ?? settings.focus;
  const stopwatch = useStopwatch(resumed?.run.sw);

  /**
   * A finished focus part is kept: the dashboard's round (with its rating), and mindful minutes when that switch is on, in one write.
   * `ref` names the part (owner, clock and end time), so the same part sent twice, from a duplicated tab, is kept once.
   */
  const recordFocus = (minutes: number, always: boolean, ref?: string) => {
    if (!always && !settings.logFocus) return;
    const kept = Math.min(FOCUS_MAX_MINUTES, Math.max(1, minutes));
    const clock: FocusMode = mode === 'pomodoro' ? 'pomodoro' : mode === 'stopwatch' ? 'stopwatch' : 'timer';
    const made = onRound(kept, taskId || null, { clientRef: ref ?? `${owner || 'me'}:${clock}:m${Date.now()}`, mode: clock, mindful: settings.logFocus });
    rateSeq.current += 1;
    const mine = rateSeq.current;
    setRate({ id: null, mode: 'ask', value: null, failed: false });
    // The round's id arrives a moment later; it only goes to the round it belongs to.
    void Promise.resolve(made)
      .then((id) => {
        if (typeof id === 'string' && rateSeq.current === mine) setRate((r) => (r && r.id === null ? { ...r, id } : r));
      })
      .catch(() => undefined);
  };
  /** The one tab that should chime and log a part that ended at `endedAt` (a duplicated tab stands aside). */
  const partName = (clock: string, endedAt: number) => `${owner || 'me'}:${clock}:${endedAt}`;
  const buzz = () => {
    if (!settings.vibrate) return;
    try {
      navigator.vibrate?.([200, 100, 200]);
    } catch {
      // no vibration here
    }
  };

  const timer = useCountdown(
    timerLen * 60_000,
    (ms, endedAt) => {
      setSaid('Timer done.');
      // Already counted before a reload that came too soon to write the new state: it ends, and is not logged again.
      if (partDone(endedAt)) return;
      markPartDone(endedAt);
      const name = partName('timer', endedAt);
      void claimPart(name).then((mine) => {
        if (!mine) return;
        if (settings.sound && !quietEnds.current.has(endedAt)) {
          playChime();
          buzz();
        }
        recordFocus(Math.max(1, Math.round(ms / 60_000)), false, name);
      });
    },
    resumed?.run.timer,
  );
  // An idle timer follows its length (and the saved focus length arriving late).
  useEffect(() => {
    timer.sync(timerLen * 60_000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerLen, ready]);

  // Breathe: a countdown with the circle; a finished one always counts as mindful minutes (it is what the tab is for).
  const [breatheMin, setBreatheMin] = useState<number>(() => {
    try {
      return clampInt(localStorage.getItem(BREATHE_KEY), 1, 30, 3);
    } catch {
      return 3;
    }
  });
  const breathe = useCountdown(
    breatheMin * 60_000,
    (ms, endedAt) => {
      const rounds = breathRounds(breathAtPace(breathPatternFor(settings.breath), settings.breathPace), ms);
      const done = `Done. ${rounds} ${rounds === 1 ? 'round' : 'rounds'} of ${breathPatternFor(settings.breath).name}, ${Math.max(1, Math.round(ms / 60_000))} min. It counts as mindful minutes.`;
      setSaid(done);
      setBreathDone(done);
      if (partDone(endedAt)) return;
      markPartDone(endedAt);
      void claimPart(partName('breathe', endedAt)).then((mine) => {
        if (!mine) return;
        if (settings.sound && !quietEnds.current.has(endedAt)) {
          playChime();
          buzz();
        }
        onLog(Math.max(1, Math.round(ms / 60_000)), 'breathe');
      });
    },
    resumed?.run.breathe,
  );
  useEffect(() => {
    breathe.sync(breatheMin * 60_000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [breatheMin]);
  // The pattern Breathe and the breaks follow, the cue at each step, and the line shown after a session (how many rounds).
  // Each count lasts settings.breathPace seconds (1.0 to 5.0), so the pattern as drawn and timed is the written one at that pace.
  const pattern = breathAtPace(breathPatternFor(settings.breath), settings.breathPace);
  // What the slider sets before a session: the seconds each count lasts, or the whole length in minutes (the founder's left/right switch).
  const [breathRuler, setBreathRuler] = useState<'count' | 'total'>('total');
  const [breathDone, setBreathDone] = useState<string | null>(null);
  const breatheElapsed = () => breathe.total - (breathe.running ? Math.max(0, (breathe.getEndsAt() ?? 0) - Date.now()) : breathe.left);
  const cue = (kind: BreathStepKind) => {
    if (settings.sound) playBreathCue(kind, settings.breathCue, settings.ambientVolume);
  };
  const pickBreathe = (v: number) => {
    setBreatheMin(v);
    keep(BREATHE_KEY, String(v));
  };

  const anyRunning = running || timer.running || stopwatch.running || breathe.running;

  // ---- One running copy of a clock. A duplicated tab copies this tab's written-down run; on load it asks the other tabs on the
  // 'kreators.focus' channel whether one already runs it (same owner, clock and end time). If one answers, this tab stops its copy
  // without logging anything and shows that tab's clock read-only. The claim in lib/focusSession.ts and the server's clientRef still
  // keep a part to one log if a message is missed.
  const liveKey = useRef<string | null>(null);
  const resumedKey = useRef<string | null>(
    (() => {
      if (!resumed) return null;
      const r = resumed.run;
      const end = r.mode === 'pomodoro' ? (resumed.pomodoro.running ? r.endsAt : null) : r.mode === 'timer' ? r.timer.endsAt : r.mode === 'breathe' ? r.breathe.endsAt : r.sw.startedAt;
      return end !== null && end !== undefined ? `${owner}:${r.mode}:${end}` : null;
    })(),
  );
  const channel = useRef<BroadcastChannel | null>(null);
  const elsewhereRef = useRef(elsewhere);
  elsewhereRef.current = elsewhere;
  const standAside = useRef<(tab: string) => void>(() => undefined);
  standAside.current = (tab: string) => {
    timer.stop();
    breathe.stop();
    stopwatch.reset();
    endsAt.current = null;
    setRunning(false);
    setRound(1);
    setCycle(1);
    setFinished(false);
    setPhase('focus');
    setPartMs(settings.focus * 60_000);
    setLeftMs(settings.focus * 60_000);
    setElsewhere({ tab, snap: null });
    setSaid('This clock is running in another tab.');
  };
  useEffect(() => {
    const ch = focusChannel();
    channel.current = ch;
    if (!ch) return;
    const hear = (e: MessageEvent<FocusTabMessage>) => {
      const m = e.data;
      if (!m || typeof m !== 'object' || m.from === FOCUS_TAB_ID) return;
      if (m.t === 'who') {
        // Two tabs that both picked up the same record: only the one with the lower name keeps it.
        const both = resumedKey.current === m.key;
        if (liveKey.current === m.key && !elsewhereRef.current && (!both || FOCUS_TAB_ID < m.from)) ch.postMessage({ t: 'mine', key: m.key, from: FOCUS_TAB_ID, to: m.from } satisfies FocusTabMessage);
      } else if (m.t === 'mine') {
        if (m.to === FOCUS_TAB_ID && m.key === resumedKey.current && !elsewhereRef.current) standAside.current(m.from);
      } else if (m.t === 'snap') {
        if (elsewhereRef.current?.tab !== m.from) return;
        if (!m.snap.active) {
          setElsewhere(null);
          useFocusSession.getState().clear();
          setSaid('The other tab stopped its clock. You can start one here.');
        } else {
          setElsewhere({ tab: m.from, snap: m.snap });
          useFocusSession.getState().publish(m.snap);
        }
      } else if (m.t === 'gone' && elsewhereRef.current?.tab === m.from) {
        setElsewhere(null);
        useFocusSession.getState().clear();
        setSaid('The other tab closed. You can start a clock here.');
      }
    };
    ch.addEventListener('message', hear);
    if (resumedKey.current) ch.postMessage({ t: 'who', key: resumedKey.current, from: FOCUS_TAB_ID } satisfies FocusTabMessage);
    const bye = () => {
      try {
        if (liveKey.current) ch.postMessage({ t: 'gone', key: liveKey.current, from: FOCUS_TAB_ID } satisfies FocusTabMessage);
      } catch {
        // already closed
      }
    };
    window.addEventListener('pagehide', bye);
    return () => {
      bye();
      window.removeEventListener('pagehide', bye);
      ch.removeEventListener('message', hear);
      ch.close();
      channel.current = null;
    };
  }, []);
  // The other tab's clock keeps ticking here, read-only.
  const [, bumpRemote] = useState(0);
  useTicker(Boolean(elsewhere?.snap?.running), () => bumpRemote((n) => n + 1), 1000);

  // The same state, written out for any other page to read (the small chip in place of the logo), and written down in this tab
  // (sessionStorage) so a reload or a full page load picks the clock back up. FocusRounds never unmounts on a route change (it lives in
  // FocusRoundsHost, mounted once at the root for as long as someone is signed in, and only portals its panel in and out of Mindful's
  // layout); the record is for the times the whole page goes: a reload, a deploy's fresh chunk, a typed address.
  useEffect(() => {
    // A tab showing another tab's clock publishes that one (from the channel), never its own idle copy.
    if (elsewhere) return;
    const isBreak = mode === 'pomodoro' && phase !== 'focus';
    const kind: FocusKind = mode === 'breathe' ? 'breathe' : mode === 'timer' ? 'timer' : mode === 'stopwatch' ? 'stopwatch' : phase;
    const label = mode === 'breathe' ? 'Breathe' : mode === 'timer' ? 'Timer' : mode === 'stopwatch' ? 'Stopwatch' : isBreak ? LABEL[phase] : `Session ${round} of ${settings.every}`;
    const active = mode === 'breathe' ? breathe.running || !breathe.atFull : mode === 'timer' ? timer.running || !timer.atFull : mode === 'stopwatch' ? stopwatch.running || stopwatch.ms > 0 : running || leftMs < partMs - 500 || phase !== 'focus' || round > 1 || cycle > 1;
    const runningEnd = mode === 'breathe' && breathe.running ? breathe.getEndsAt() : mode === 'timer' && timer.running ? timer.getEndsAt() : mode === 'pomodoro' && running ? endsAt.current : mode === 'stopwatch' && stopwatch.running ? stopwatch.anchor().startedAt : null;
    liveKey.current = runningEnd !== null ? `${owner}:${mode}:${runningEnd}` : null;
    const snap: FocusSnapshot = {
      active,
      kind,
      label,
      running: mode === 'breathe' ? breathe.running : mode === 'timer' ? timer.running : mode === 'stopwatch' ? stopwatch.running : running,
      round,
      cycle,
      totalMs: mode === 'breathe' ? breathe.total : mode === 'timer' ? timer.total : partMs,
      endsAt: mode === 'breathe' && breathe.running ? breathe.getEndsAt() : mode === 'timer' && timer.running ? timer.getEndsAt() : mode === 'pomodoro' && running ? endsAt.current : null,
      leftMs: mode === 'breathe' ? breathe.left : mode === 'timer' ? timer.left : leftMs,
      // While running, the whole total so far lives in the anchor (`now - started = ms`), so `snapshotLeftMs` can tick
      // it forward on its own between publishes; folding the same total into swAccumMs too would count it twice and
      // double the time a chip elsewhere in the app shows. Paused, there is no running segment to anchor, so the total
      // sits in swAccumMs alone.
      swStartedAt: mode === 'stopwatch' && stopwatch.running ? Date.now() - (stopwatch.ms ?? 0) : null,
      swAccumMs: mode === 'stopwatch' && !stopwatch.running ? stopwatch.ms : 0,
      taskTitle: picked?.title ?? null,
    };
    useFocusSession.getState().publish(snap);
    // Any copy of this clock open in another tab (a duplicated tab) shows this one, read-only.
    try {
      channel.current?.postMessage({ t: 'snap', key: liveKey.current ?? '', from: FOCUS_TAB_ID, snap } satisfies FocusTabMessage);
    } catch {
      // the channel closed
    }
    // Only this session's own record, and only while something is worth keeping: an untouched, stopped or finished clock clears it.
    if (!owner || focusRunOwner(useSession.getState().token) !== owner) return;
    const run: FocusRun = {
      v: 1,
      owner,
      mode,
      phase,
      round,
      cycle,
      partMs,
      leftMs: running && endsAt.current !== null ? Math.max(0, endsAt.current - Date.now()) : leftMs,
      endsAt: running ? endsAt.current : null,
      timer: { total: timer.total, left: timer.left, endsAt: timer.running ? timer.getEndsAt() : null },
      breathe: { total: breathe.total, left: breathe.left, endsAt: breathe.running ? breathe.getEndsAt() : null },
      sw: stopwatch.anchor(),
      taskId,
      finished,
    };
    writeFocusRun(active || focusRunActive(run) ? JSON.stringify(run) : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, phase, round, cycle, running, partMs, leftMs, timer.running, timer.left, timer.total, timer.atFull, breathe.running, breathe.left, breathe.total, breathe.atFull, stopwatch.running, stopwatch.ms, settings.every, picked?.title, taskId, finished, owner, elsewhere]);
  const setMode = (m: Mode) => {
    setModeState(m);
    keep(TAB_KEY, m);
    setSaid(`${MODES.find((x) => x.key === m)!.name}.`);
  };

  // "Start focus" on a task opens Mindful with the task picked and its estimate as the first round's length. That is only this round: the
  // saved lengths do not change. This clock is mounted once for the whole visit (whatever page came first), so it listens for every
  // arrival at that address, not only the first; while a clock is already running or paused part-way, it leaves that clock alone.
  const urlTask = loc.pathname === '/mindful' ? params.get('task') : null;
  const urlMin = loc.pathname === '/mindful' ? params.get('min') : null;
  const busy = useRef(false);
  busy.current = running || leftMs < partMs - 500 || phase !== 'focus' || round > 1 || cycle > 1 || timer.running || !timer.atFull || breathe.running || !breathe.atFull || stopwatch.running || stopwatch.ms > 0;
  useEffect(() => {
    if (!urlTask && !urlMin) return;
    if (busy.current) {
      setSaid('A clock is already going. Stop it first to start one for this task.');
      return;
    }
    const m = clampInt(urlMin, 0, MAX_PART_MIN, 0);
    setModeState('pomodoro');
    keep(TAB_KEY, 'pomodoro');
    if (urlTask) setTaskId(urlTask);
    if (m > 0) {
      fromUrl.current = true;
      setPhase('focus');
      setPartMs(m * 60_000);
      setLeftMs(m * 60_000);
      setSaid(`Ready for ${m} minutes. Press Start.`);
    }
    // Each arrival at a "Start focus" address, once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlTask, urlMin, loc.key]);

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
    const ask = () => {
      if (anyRunning && nav.wakeLock && document.visibilityState === 'visible') void nav.wakeLock.request('screen').then((l) => (lock.current = l)).catch(() => undefined);
    };
    ask();
    // The browser lets the lock go when the tab is hidden; it is asked for again when the tab comes back.
    document.addEventListener('visibilitychange', ask);
    return () => {
      document.removeEventListener('visibilitychange', ask);
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
      // A part is named by the end time it ran out at: marked before its log goes, so a reload that came too soon to write the next
      // part down moves on without counting it twice.
      const endedAt = counted ? endsAt.current : null;
      const already = partDone(endedAt);
      if (counted && !already) markPartDone(endedAt);
      if (counted && !already) {
        // Only the one tab that claims the part chimes and logs it; a duplicated tab moves on in silence.
        const name = endedAt !== null ? partName(phase === 'focus' ? 'pomodoro' : phase, endedAt) : `${owner || 'me'}:${phase}:m${Date.now()}`;
        const to: Phase | null = wasFocus ? (round >= settings.every ? 'long' : 'short') : null;
        const was = phase;
        if (!wasFocus) setRate(null);
        void claimPart(name).then((mine) => {
          if (!mine) return;
          if (settings.sound && !(endedAt !== null && quietEnds.current.has(endedAt))) {
            // A soft beat when a mini break starts, three when the long break starts, and a chime when a break gives way to focus.
            if (to) {
              if (to === 'long' ? settings.soundLong : settings.soundShort) playBeats(BREAK_BEATS[to]);
            } else if (was === 'long' ? settings.soundLong : settings.soundShort) playChime();
            buzz();
          }
          if (wasFocus) recordFocus(minutes, true, name);
          else if (settings.logBreaks) onLog(minutes, 'break');
        });
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
    [phase, partMs, taskId, settings, round, cycle, onLog, onRound, owner, mode], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // The Pomodoro clock: a look at the end time a few times a second.
  useTicker(running, () => {
    const left = (endsAt.current ?? 0) - Date.now();
    if (left <= 0) finish(true);
    else setLeftMs((p) => nextLeft(p, left));
  });

  // The tab says how long is left, so it can be read from another tab.
  const tabTime = mode === 'breathe' ? mmss(breathe.left) : mode === 'timer' ? mmss(timer.left) : mode === 'stopwatch' ? mmss(stopwatch.ms, false) : mmss(leftMs);
  const tabName = mode === 'breathe' ? 'Breathe' : mode === 'timer' ? 'Timer' : mode === 'stopwatch' ? 'Stopwatch' : LABEL[phase];

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
  const on = mode === 'breathe' ? breathe.running : mode === 'timer' ? timer.running : mode === 'stopwatch' ? stopwatch.running : running;
  const paused = mode === 'breathe' ? !breathe.atFull && !breathe.running : mode === 'timer' ? !timer.atFull && !timer.running : mode === 'stopwatch' ? stopwatch.ms > 0 && !stopwatch.running : leftMs < partMs - 500 && !running;
  // On every page, since this clock is mounted for the whole visit: the page's own title is kept aside while a clock runs or waits paused,
  // and put back when it stops. While a print dialog is open the title is the document's file name (lib/printDoc.ts), so it is left alone.
  const pageTitle = useRef<string | null>(null);
  const printing = useRef(false);
  useEffect(() => {
    const before = () => (printing.current = true);
    const after = () => (printing.current = false);
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => {
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint', after);
      if (pageTitle.current !== null) document.title = pageTitle.current;
    };
  }, []);
  useEffect(() => {
    if (printing.current) return;
    if (anyRunning || paused) {
      if (pageTitle.current === null) pageTitle.current = document.title;
      // With a task picked, the task is in the title: "18:20 · Edit vlog intro · kreators.app".
      document.title = picked ? `${anyRunning ? '' : 'Paused '}${tabTime} · ${picked.title} · kreators.app` : `${anyRunning ? '' : 'Paused '}${tabTime} ${tabName} · kreators.app`;
    } else if (pageTitle.current !== null) {
      document.title = pageTitle.current;
      pageTitle.current = null;
    }
  }, [anyRunning, paused, tabTime, tabName, picked?.title]);

  const press = () => {
    if (mode === 'breathe') {
      if (breathe.running) {
        breathe.pause();
        setSaid('Paused.');
      } else {
        unlockAudio();
        setBreathDone(null);
        breathe.start();
        setSaid('Breathe in as the circle grows, out as it shrinks.');
      }
    } else if (mode === 'timer') {
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

  // Stop on a Timer or a Pomodoro focus part: past a whole minute it asks (keep the minutes so far, or throw them away); under a minute it
  // stops as before and keeps nothing. A break or a breath stops at once. While it asks, the clock waits paused.
  const stopMinutes = (): number => {
    if (mode === 'timer') return timer.atFull ? 0 : Math.floor(timer.elapsed() / 60_000);
    if (mode === 'pomodoro' && phase === 'focus') return Math.floor((partMs - (running && endsAt.current !== null ? Math.max(0, endsAt.current - Date.now()) : leftMs)) / 60_000);
    return 0;
  };
  const stopNow = (keepMinutes: number) => {
    setStopAsk(null);
    if (keepMinutes >= 1) recordFocus(keepMinutes, true);
    if (mode === 'timer') timer.stop();
    else reset();
    setSaid(keepMinutes >= 1 ? `Stopped. ${keepMinutes} ${keepMinutes === 1 ? 'minute' : 'minutes'} kept.` : mode === 'timer' ? 'Stopped. Nothing was kept.' : 'Stopped. The part you were in counts for nothing; back to session one.');
  };
  const askStop = () => {
    if (mode === 'breathe') {
      const rounds = breathRounds(pattern, breatheElapsed());
      breathe.stop();
      const line = `Stopped after ${rounds} ${rounds === 1 ? 'round' : 'rounds'}. Nothing was kept.`;
      setSaid(line);
      setBreathDone(line);
      return;
    }
    if (mode === 'stopwatch') {
      if (stopwatch.ms > 0 || stopwatch.running) stopStopwatch();
      return;
    }
    const n = stopMinutes();
    // Off Mindful the panel is parked out of sight, so a sheet could not be seen: the pill asks there itself.
    if (n < 1 || !onMindful) return stopNow(0);
    if (mode === 'timer' && timer.running) timer.pause();
    if (mode === 'pomodoro' && running) pause();
    setStopAsk({ minutes: n, mode });
  };

  // The pill on other pages (FocusPill) can restart this part, stop, or pause and resume; it sends a request and this clock does it,
  // exactly as its own buttons would.
  const command = useFocusSession((st) => st.command);
  // A request already in the store when this clock mounts (a remount, a hot reload) is an old one: it is never carried out again.
  const staleCommand = useRef(useFocusSession.getState().command?.at ?? null);
  useEffect(() => {
    if (!command || command.at === staleCommand.current) return;
    if (elsewhere) return;
    if (command.kind === 'toggle') press();
    else if (command.kind === 'stop') askStop();
    else if (command.kind === 'stopKeep') stopNow(stopMinutes());
    else if (command.kind === 'stopDrop') stopNow(0);
    else {
      unlockAudio();
      setRate(null);
      if (mode === 'breathe') breathe.restart();
      else if (mode === 'timer') timer.restart();
      else if (mode === 'stopwatch') {
        stopwatch.reset();
        stopwatch.start();
      } else begin(phase, true);
      setSaid('Started again from the beginning of this part.');
    }
    // Only when a new request arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [command?.at]);

  // Laptop keys, on Mindful only, never while typing in a box or with a sheet open: Space starts or pauses, S stops (asking as Stop
  // does), K skips to the next Pomodoro part, ? lists them. Space on a focused button or slider is left to that control.
  const onKey = useRef<(e: KeyboardEvent) => void>(() => undefined);
  onKey.current = (e: KeyboardEvent) => {
    if (!keysHere || elsewhere || e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || typing(e.target)) return;
    // Only a modal sheet holds the keys: the privacy card (a dialog that is not modal) must not.
    if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
    const control = e.target instanceof HTMLElement && e.target.closest('button, a, [role="slider"], [role="tab"]');
    if (e.key === ' ' && !control) {
      e.preventDefault();
      press();
    } else if (e.key === 's' || e.key === 'S') {
      e.preventDefault();
      askStop();
    } else if ((e.key === 'k' || e.key === 'K') && mode === 'pomodoro') {
      e.preventDefault();
      finish(false);
    } else if (e.key === '?') {
      e.preventDefault();
      setSheet('keys');
    }
  };
  useEffect(() => {
    const listen = (e: KeyboardEvent) => onKey.current(e);
    document.addEventListener('keydown', listen);
    return () => document.removeEventListener('keydown', listen);
  }, []);

  // Full screen, the card table's focus mode: the menu, the assistant and the reminders bubble step aside, and the browser's own full
  // screen is asked for where it has one. Escape, the same button, or leaving Mindful ends it.
  const fullMine = useRef(false);
  const setFullScreen = (on: boolean) => {
    fullMine.current = on;
    setFull(on);
    try {
      if (on && !document.fullscreenElement) void document.documentElement.requestFullscreen?.().catch(() => undefined);
      if (!on && document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    } catch {
      // no browser full screen here: the app's own still works
    }
  };
  useEffect(() => {
    if (!fullOn || !fullMine.current) return;
    const esc = (e: KeyboardEvent) => {
      // A modal sheet takes Escape first; the privacy card (not modal) never stops it, or full screen could not be left.
      if (e.key === 'Escape' && !document.querySelector('[role="dialog"][aria-modal="true"]')) setFullScreen(false);
    };
    const fs = () => {
      if (!document.fullscreenElement) setFullScreen(false);
    };
    window.addEventListener('keydown', esc);
    document.addEventListener('fullscreenchange', fs);
    return () => {
      window.removeEventListener('keydown', esc);
      document.removeEventListener('fullscreenchange', fs);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullOn]);
  useEffect(() => {
    if (!onMindful && fullMine.current) setFullScreen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onMindful]);

  // Continue a finished session: the same clock, length and task, started at once. Only while no clock is going.
  const continueRound = (r: FocusRoundRow) => {
    if (busy.current || elsewhere) return;
    unlockAudio();
    setRate(null);
    setFinished(false);
    pickTask(r.nodeId ?? '', r.nodeId ? r.title || null : null);
    const m = Math.min(MAX_PART_MIN, Math.max(1, r.minutes));
    const to: Mode = r.mode === 'pomodoro' || r.mode === 'stopwatch' ? r.mode : 'timer';
    setModeState(to);
    keep(TAB_KEY, to);
    if (to === 'timer') {
      setTimerMin(m);
      keep(TIMER_KEY, String(m));
      timer.begin(m * 60_000);
      setSaid(`Timer started, ${m} minutes${r.title ? ` on ${r.title}` : ''}.`);
    } else if (to === 'pomodoro') {
      fromUrl.current = true;
      setPhase('focus');
      setPartMs(m * 60_000);
      setLeftMs(m * 60_000);
      endsAt.current = Date.now() + m * 60_000;
      setRunning(true);
      setSaid(`Focus started, ${m} minutes${r.title ? ` on ${r.title}` : ''}.`);
    } else {
      stopwatch.start();
      setSaid(`Stopwatch started${r.title ? ` on ${r.title}` : ''}.`);
    }
  };

  const isBreak = mode === 'pomodoro' && phase !== 'focus';
  const accent = isBreak || mode === 'breathe' ? 'r4' : 'r2';
  const slots = Array.from({ length: settings.every }, (_, i) => i + 1);
  const progress = mode === 'breathe' ? (breathe.total ? 1 - breathe.left / breathe.total : 0) : mode === 'timer' ? (timer.total ? 1 - timer.left / timer.total : 0) : mode === 'pomodoro' ? (partMs ? 1 - leftMs / partMs : 0) : 0;
  const remote = elsewhere?.snap ?? null;
  const readout = remote ? mmss(snapshotLeftMs(remote), remote.kind !== 'stopwatch') : mode === 'breathe' ? mmss(breathe.left) : mode === 'timer' ? mmss(timer.left) : mode === 'stopwatch' ? mmss(stopwatch.ms, false) : mmss(leftMs);
  const idle = !busy.current && !elsewhere;
  const goal = settings.goalMinutes;
  const nudgeable = mode !== 'stopwatch' && mode !== 'breathe';
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

  // In full screen the whole section (its heading, its round buttons and the panel) covers the page on its own, phone and laptop alike.
  const covering = fullOn && fullMine.current && onMindful;
  useEffect(() => {
    if (!covering) return;
    const was = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = was;
    };
  }, [covering]);

  return (
    <section className={covering ? 'mf-cover' : 'mt-md'} data-cover={covering || undefined} aria-labelledby="focus-heading">
      {/* The heading and its line on the left; the four round buttons (task, settings, sounds, music) at the right, level with the
          bottom of that line. On a narrow phone they wrap under it, at the right. */}
      <div className="flex flex-wrap items-end justify-between gap-sm">
        <div className="min-w-0 flex-[1_1_220px]">
          <h2 id="focus-heading" className="text-title2">
            Breathe and focus
          </h2>
          <p className="mt-xs m-0 text-subhead text-ink-soft">
            Breathe with the circle, or work in sessions with breaks. Today: {plural(todayRounds.length, 'session')}, {todayMinutes} min of focus.
          </p>
        </div>
        <div className="mf-rounds ml-auto" role="group" aria-label="Focus tools">
          <RoundButton at="bc" label="Focus on a task" icon="task" opens onClick={() => setSheet('task')} />
          <RoundButton at="bc" label="Timer settings" icon="gear" opens onClick={() => setSheet('settings')} />
          <RoundButton at="bc" label={settings.sound ? 'Sounds are on. Turn them off' : 'Sounds are off. Turn them on'} icon={settings.sound ? 'sound' : 'mute'} onClick={() => save({ ...settings, sound: !settings.sound })} />
          <RoundButton at="tr" label="Background music" icon="music" opens onClick={() => setSheet('music')} />
          <RoundButton at="tr" label={fullOn ? 'Leave full screen' : 'Full screen'} icon="full" pressed={fullOn} onClick={() => setFullScreen(!fullOn)} />
        </div>
      </div>

      <div className="mf-stage mt-sm">
        <div className="night-card mf-panel rounded-card" data-accent={accent}>
          <div className="mf-top">
            <div ref={tabs.ref} role="group" aria-label="Kind of clock" className="fx-slide mf-tabs">
              {MODES.map((m) => (
                <button key={m.key} type="button" aria-pressed={mode === m.key} disabled={(anyRunning || Boolean(elsewhere)) && mode !== m.key} onClick={() => setMode(m.key)}>
                  {m.name}
                </button>
              ))}
            </div>
            <button type="button" className="mf-start toy" onClick={press} disabled={Boolean(elsewhere)}>
              {on ? 'Pause' : paused ? 'Resume' : 'Start'}
            </button>
          </div>
          {elsewhere && (
            <p className="mf-line" role="status">
              Running in another tab{remote?.taskTitle ? `, on ${remote.taskTitle}` : ''}. Stop it there to start one here.
            </p>
          )}

          {/* Breathe before a session: the seconds a count lasts on the left and the whole length on the right are both buttons; the
              slider between them sets whichever is picked. */}
          {/* data-rect-quiet: the dial ticks every second (the time, the breath, the seconds strip); the text balancer leaves it alone. */}
          <div data-rect-quiet="" className={`mf-dial ${mode === 'breathe' && breathe.atFull ? 'mf-dial-breathe' : ''}`}>
            {mode === 'breathe' && breathe.atFull && (
              <button type="button" className="mf-time-btn mf-pace" aria-pressed={breathRuler === 'count'} onClick={() => setBreathRuler('count')} aria-label={`Seconds per count, ${settings.breathPace.toFixed(1)}. Set it with the slider.`}>
                <span className="mf-time">{settings.breathPace.toFixed(1)}s</span>
                <span className="mf-time-cap">per count</span>
              </button>
            )}
            <div className="mf-ruler">
              {mode === 'breathe' ? (
                breathe.atFull ? (
                  breathRuler === 'count' ? (
                    <RulerPicker label="Seconds per count" tone="night" accent="r4" min={10} max={50} step={1} labelEvery={5} majorStep={5} value={Math.round(settings.breathPace * 10)} onChange={(v) => save({ ...settings, breathPace: v / 10 })} valueText={(v) => `each count lasts ${(v / 10).toFixed(1)} seconds`} format={(v) => (v / 10).toFixed(1)} />
                  ) : (
                    <RulerPicker label="Breathing length" tone="night" accent="r4" min={1} max={30} step={1} labelEvery={5} majorStep={5} value={breatheMin} onChange={pickBreathe} valueText={(v) => `${v} ${v === 1 ? 'minute' : 'minutes'}`} format={(v) => String(v)} />
                  )
                ) : (
                  <BreathFour pattern={pattern} pace={settings.breathPace} running={breathe.running} elapsedMs={breatheElapsed} onStep={cue} />
                )
              ) : mode === 'stopwatch' ? (
                <SecondsStrip seconds={Math.floor(stopwatch.ms / 1000) % 60} live={stopwatch.ms > 0} />
              ) : isBreak ? (
                <BreathFour pattern={pattern} pace={settings.breathPace} running={running} elapsedMs={() => partMs - (running ? Math.max(0, (endsAt.current ?? 0) - Date.now()) : leftMs)} onStep={cue} />
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
              {mode === 'breathe' && breathe.atFull ? (
                <button type="button" className="mf-time-btn" aria-pressed={breathRuler === 'total'} onClick={() => setBreathRuler('total')} aria-label={`Total length, ${readout}. Set it with the slider.`}>
                  <span className="mf-time">{readout}</span>
                  <span className="mf-time-cap">total</span>
                </button>
              ) : (
                <span className="mf-time" role="timer" aria-label={`${mode === 'pomodoro' ? LABEL[phase] : MODES.find((m) => m.key === mode)!.name}, ${readout}${mode === 'stopwatch' ? '' : ' left'}`}>
                  {readout}
                </span>
              )}
            </div>
          </div>
          {mode !== 'stopwatch' && (
            <div className="mf-bar" aria-hidden="true">
              <span style={{ transform: `scaleX(${Math.min(1, Math.max(0, progress))})` }} />
            </div>
          )}

          {mode === 'breathe' ? (
            <>
              <div className="mf-sets" role="group" aria-label="How to breathe">
                <ChipSelect
                  label="Pattern"
                  value={Math.max(0, BREATH_PATTERNS.findIndex((p) => p.key === pattern.key))}
                  valueLabel={pattern.name}
                  options={BREATH_PATTERNS.map((p, i) => ({ value: i, label: `${p.name} · ${p.counts}` }))}
                  onChange={(i) => save({ ...settings, breath: BREATH_PATTERNS[i]!.key })}
                />
                <ChipSelect
                  label="At each step"
                  value={Math.max(0, BREATH_CUES.findIndex((c) => c.key === settings.breathCue))}
                  valueLabel={BREATH_CUES.find((c) => c.key === settings.breathCue)?.name ?? 'Soft chime'}
                  options={BREATH_CUES.map((c, i) => ({ value: i, label: c.name }))}
                  onChange={(i) => save({ ...settings, breathCue: BREATH_CUES[i]!.key })}
                />
                {/* At the right end of the pickers' line: the quick lengths while idle, Stop while it runs (no row of its own). */}
                <div className={`mf-quick ${breathe.atFull ? 'mf-quick-lengths' : ''}`} role="group" aria-label={breathe.atFull ? 'Quick lengths' : 'Clock actions'}>
                  {breathe.atFull
                    ? [...BREATHE_LENGTHS, PHONE_BREATHE_LENGTH].map((m) => (
                        // A phone has the room for one longer sit (25 minutes) as a fifth even pill; a laptop keeps the four beside the pickers.
                        <button key={m} type="button" aria-pressed={breatheMin === m} onClick={() => pickBreathe(m)} className={`mf-mini toy min-w-[44px] ${m === PHONE_BREATHE_LENGTH ? 'mf-quick-extra' : ''}`}>
                          {m} min
                        </button>
                      ))
                    : (
                        <button
                          type="button"
                          className="mf-mini toy inline-flex min-w-[44px] items-center gap-xs"
                          onClick={() => {
                            const rounds = breathRounds(pattern, breatheElapsed());
                            breathe.stop();
                            const line = `Stopped after ${rounds} ${rounds === 1 ? 'round' : 'rounds'}. Nothing was kept.`;
                            setSaid(line);
                            setBreathDone(line);
                          }}
                          aria-label="Stop breathing and keep nothing"
                        >
                          <LucideGlyph icon={Square} size={14} filled />
                          Stop
                        </button>
                      )}
                </div>
              </div>
              <p className="mf-line">{breathDone && breathe.atFull ? breathDone : pattern.line}</p>
            </>
          ) : mode === 'pomodoro' ? (
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

          <div className="mf-actions fill-row" role="group" aria-label="Clock actions">
            {mode === 'pomodoro' && (
              <>
                <button type="button" className="mf-mini toy inline-flex min-w-[44px] items-center gap-xs" onClick={() => finish(false)} aria-label="Skip to the next part">
                  <AnimatedIcon name="skipForward" size={16} />
                  Skip
                </button>
                <button
                  type="button"
                  className="mf-mini toy inline-flex min-w-[44px] items-center gap-xs"
                  disabled={!anyRunning && !paused && round === 1 && cycle === 1 && phase === 'focus'}
                  onClick={askStop}
                  aria-label="Stop the sessions and go back to session one"
                >
                  <LucideGlyph icon={Square} size={14} filled />
                  Stop
                </button>
              </>
            )}
            {mode === 'timer' && (
              <button
                type="button"
                className="mf-mini toy min-w-[44px]"
                disabled={timer.atFull}
                onClick={askStop}
                aria-label="Stop the timer"
              >
                Stop
              </button>
            )}
            {mode === 'stopwatch' && (
              <>
                <button type="button" className="mf-mini toy min-w-[44px]" disabled={stopwatch.ms === 0} onClick={stopStopwatch} aria-label="Stop the stopwatch and save the whole minutes">
                  Stop
                </button>
                <button
                  type="button"
                  className="mf-mini toy min-w-[44px]"
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
            {nudgeable && (
              <span className="mf-nudge" role="group" aria-label={`Adjust this ${mode === 'timer' ? 'timer' : LABEL[phase].toLowerCase()}`}>
                <span className="mf-nudge-label">This part</span>
                {[-5, -1, 1, 5].map((m) => (
                  <button key={m} type="button" className="mf-mini toy min-w-[44px]" disabled={Boolean(elsewhere)} onClick={() => (mode === 'timer' ? timer.nudge(m * 60_000) : nudge(m * 60_000))} aria-label={`${m > 0 ? 'Add' : 'Take off'} ${Math.abs(m)} ${Math.abs(m) === 1 ? 'minute' : 'minutes'}`}>
                    {m > 0 ? `+${m}` : `−${-m}`}
                  </button>
                ))}
              </span>
            )}
          </div>

          {mode !== 'pomodoro' && picked && <p className="mf-line">On it: {picked.title}</p>}

          {rate && (
            <div className="mf-rate" role="group" aria-label="How focused you were">
              {rate.mode === 'rated' ? (
                <div className="flex items-center justify-between gap-sm">
                  <p className="m-0 text-subhead font-semibold" role="status">
                    Rated {focusQualityName(rate.value)}
                  </p>
                  <button type="button" className="mf-mini toy min-w-[44px]" onClick={() => setRate({ ...rate, mode: 'ask' })}>
                    Change
                  </button>
                </div>
              ) : (
                <>
                  <p className="m-0 text-subhead font-semibold">How focused were you?</p>
                  <div className="mt-xs flex flex-wrap gap-xs">
                    {FOCUS_QUALITY.map((q) => (
                      <button key={q.value} type="button" disabled={!rate.id} onClick={() => rateIt(q.value)} aria-pressed={rate.value === q.value} className="mf-mini toy min-w-[44px]">
                        {q.name}
                      </button>
                    ))}
                    <button type="button" className="mf-mini toy min-w-[44px]" onClick={() => setRate(null)}>
                      Skip
                    </button>
                  </div>
                  {rate.failed && (
                    <p role="alert" className="mt-xs m-0 text-caption">
                      That did not save. Try again.
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </div>

      </div>

      {/* Today's sessions, newest first: tap one to change or delete it; Continue starts the same clock, length and task again. */}
      <div className="mt-md" hidden={covering} role="group" aria-labelledby="focus-today-heading">
        <div className="flex flex-wrap items-end justify-between gap-sm">
          <div className="min-w-0 flex-[1_1_220px]">
            <h3 id="focus-today-heading" className="text-headline">
              Today
            </h3>
            <p className="mt-xs m-0 text-subhead text-ink-soft" data-focus-goal={goal ?? undefined}>
              {goal ? `${todayMinutes} of ${goal} minutes today${todayMinutes >= goal ? '. Goal met.' : '.'}` : `${plural(todayRounds.length, 'session')}, ${todayMinutes} min of focus.`}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setEdit('new')}>
            Add a session I forgot
          </Button>
        </div>
        {today.isError && (
          <p role="alert" className="mt-sm m-0 text-subhead">
            Could not load today's sessions. Try again in a moment.
          </p>
        )}
        {today.data && todayRounds.length === 0 && <p className="mt-sm m-0 text-subhead text-ink-soft">No sessions yet today. A finished one shows up here.</p>}
        {todayRounds.length > 0 && (
          <ul className="mt-sm m-0 flex list-none flex-col gap-xs p-0" aria-label="Today's sessions">
            {todayRounds.map((r) => (
              <li key={r.id} className="flex items-stretch gap-xs" data-focus-round={r.id}>
                <button
                  type="button"
                  onClick={() => setEdit(r)}
                  aria-haspopup="dialog"
                  aria-label={`${clockTime(r.createdAt)}, ${r.minutes} minutes, ${r.title || 'no task'}${r.quality ? `, ${focusQualityName(r.quality)}` : ''}. Change or delete it.`}
                  className="toy toy-soft flex min-h-[44px] min-w-0 flex-1 items-center gap-sm rounded-tile bg-card px-sm py-xs text-left shadow-toy-soft"
                >
                  <span className="min-w-[64px] shrink-0 text-subhead font-semibold tabular-nums">{clockTime(r.createdAt)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-headline">{r.title || 'No task'}</span>
                    <span className="block text-caption text-ink-soft">
                      {r.minutes} min{r.mode ? `, ${MODE_NAME[r.mode]}` : ''}
                      {r.quality ? `, ${focusQualityName(r.quality)}` : ''}
                    </span>
                  </span>
                </button>
                <button type="button" className={`${chip(false)} gap-xs`} disabled={!idle} onClick={() => continueRound(r)} aria-label={`Continue: ${r.minutes} minutes${r.title ? ` on ${r.title}` : ''}`}>
                  <LucideGlyph icon={Play} size={16} />
                  Continue
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {said}
      </p>

      <Sheet open={stopAsk !== null} onClose={() => setStopAsk(null)} title="Stop here?">
        <p className="m-0 text-callout">
          {stopAsk ? `You focused for ${plural(stopAsk.minutes, 'minute')}. Keep it, or throw it away?` : ''}
        </p>
        <div className="mt-md grid grid-cols-2 gap-xs">
          <Button variant="outline" onClick={() => stopNow(stopAsk?.minutes ?? 0)}>
            Keep {stopAsk?.minutes ?? 0} {stopAsk?.minutes === 1 ? 'minute' : 'minutes'}
          </Button>
          <Button variant="outline" onClick={() => stopNow(0)}>
            Throw it away
          </Button>
        </div>
        <p className="mt-sm m-0 text-caption text-ink-soft">Close this to carry on. The clock waits, paused.</p>
      </Sheet>

      <Sheet open={stopwatch.away !== null} onClose={stopwatch.keepAll} title="You were away a while">
        <p className="m-0 text-callout">The stopwatch kept running while this tab was out of sight. How much counts?</p>
        <div className="mt-md grid grid-cols-1 gap-xs sm:grid-cols-2">
          <Button variant="outline" onClick={stopwatch.keepAll}>
            Keep all {spanShort(stopwatch.away?.allMs ?? 0)}
          </Button>
          <Button variant="outline" onClick={stopwatch.keepUpTo}>
            Keep up to when you left ({spanShort(stopwatch.away?.uptoMs ?? 0)})
          </Button>
        </div>
      </Sheet>

      <Sheet open={sheet === 'keys'} onClose={() => setSheet(null)} title="Keyboard shortcuts">
        <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-md gap-y-xs text-callout">
          {[
            ['Space', 'Start or pause'],
            ['S', 'Stop'],
            ['K', 'Skip to the next part (Pomodoro)'],
            ['?', 'Show this list'],
          ].map(([k, what]) => (
            <div key={k} className="contents">
              <dt className="font-mono font-semibold">{k}</dt>
              <dd className="m-0">{what}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-sm m-0 text-caption text-ink-soft">They work on this page, and never while you type in a box.</p>
        <Button className="mt-md" full onClick={() => setSheet(null)}>
          Done
        </Button>
      </Sheet>

      <Sheet open={edit !== null} onClose={() => setEdit(null)} title={edit === 'new' ? 'Add a session I forgot' : 'Change this session'}>
        {edit !== null && <SessionEditor key={edit === 'new' ? 'new' : edit.id} edit={edit} onClose={() => setEdit(null)} enabled={Boolean(token)} owner={owner} logFocus={settings.logFocus} />}
      </Sheet>

      <Sheet open={sheet === 'task'} onClose={() => setSheet(null)} title="Focus on a task">
        <p className="m-0 text-subhead font-semibold">Working on: {picked?.title ?? 'No task'}</p>
        <div className="mt-xs">
          <TaskPicker
            value={taskId}
            enabled={Boolean(token) && sheet === 'task'}
            onPick={(id, title) => {
              pickTask(id, title);
              setSheet(null);
            }}
          />
        </div>
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
        <p className="m-0 text-subhead font-semibold">Your plan</p>
        <TabRow
          className="mt-xs"
          label="Plans to start from"
          items={FOCUS_PRESETS.map((p) => ({ key: p.name, label: `${p.name} ${p.focus}/${p.short}` }))}
          value={FOCUS_PRESETS.find((p) => settings.focus === p.focus && settings.short === p.short && settings.long === p.long && settings.every === p.every)?.name ?? ''}
          onChange={(name) => {
            const p = FOCUS_PRESETS.find((x) => x.name === name);
            if (p) save({ ...settings, ...p });
          }}
          pillClass={(on) => `toy min-h-[44px] rounded-pill border-2 px-sm text-subhead font-medium ${on ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}
        />
        <p className="mt-xs m-0 text-caption text-ink-soft">{planLine(settings)}</p>
        <div className="mt-sm flex flex-col gap-xs text-left">
          <Toggle compact on={settings.logFocus} onChange={(v) => save({ ...settings, logFocus: v })} label="Count finished focus sessions as mindful minutes" />
          <Toggle compact on={settings.logBreaks} onChange={(v) => save({ ...settings, logBreaks: v })} label="Count finished breaks as mindful minutes" />
          <Toggle compact on={settings.auto} onChange={(v) => save({ ...settings, auto: v })} label="Start the next part by itself" />
        </div>
        <div className="mt-md border-t border-line pt-sm text-left">
          <Toggle compact on={settings.goalMinutes !== null} onChange={(v) => save({ ...settings, goalMinutes: v ? (settings.goalMinutes ?? 60) : null })} label="A daily focus goal" />
          {settings.goalMinutes !== null && (
            <>
              <p className="mt-xs m-0 text-subhead font-semibold">{settings.goalMinutes} minutes a day</p>
              <RulerPicker label="Daily focus goal" min={15} max={480} step={15} labelEvery={60} majorStep={60} value={settings.goalMinutes} onChange={(v) => save({ ...settings, goalMinutes: v })} valueText={(v) => `${v} minutes a day`} format={(v) => (v % 60 === 0 ? `${v / 60}h` : String(v))} />
              <p className="mt-xs m-0 text-caption text-ink-soft">It shows under the timer. No streak, nothing to lose.</p>
            </>
          )}
        </div>
        <div className="mt-md border-t border-line pt-sm text-left">
          <Toggle compact on={settings.reminderTime !== null} onChange={(v) => save({ ...settings, reminderTime: v ? (settings.reminderTime ?? '09:00') : null })} label="Remind me to focus" />
          {settings.reminderTime !== null && (
            <>
              <label className="mt-xs block">
                <span className="block text-subhead font-semibold">At</span>
                <input type="time" value={settings.reminderTime} onChange={(e) => /^\d\d:\d\d$/.test(e.target.value) && save({ ...settings, reminderTime: e.target.value })} className={FIELD} />
              </label>
              <div className="mt-sm grid grid-cols-7 gap-xs" role="group" aria-label="On these days">
                {DAY_LETTERS.map((d) => {
                  const onDay = settings.reminderDays.includes(d.n);
                  return (
                    <button
                      key={d.n}
                      type="button"
                      aria-pressed={onDay}
                      aria-label={d.long}
                      onClick={() => save({ ...settings, reminderDays: onDay ? settings.reminderDays.filter((n) => n !== d.n) : [...settings.reminderDays, d.n].sort((a, b) => a - b) })}
                      className={`toy min-h-[44px] min-w-0 rounded-pill border-2 px-xs text-subhead font-medium ${onDay ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}
                    >
                      <span className="sm:hidden">{d.short}</span>
                      <span className="hidden sm:inline">{d.long}</span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-xs m-0 text-caption text-ink-soft">One inbox note on those days, in your time zone. It skips a day you already focused.</p>
            </>
          )}
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
