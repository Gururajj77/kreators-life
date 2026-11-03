// The logo's spot, taken over by a small ticking chip while a focus clock runs or waits paused in Mindful minutes, on every page, not
// only Mindful's own. Tapping it goes back to the clock. It reads the shared snapshot in lib/focusSession.ts, so it is right whether
// Mindful is open in this tab or was left on another page.
import { useState } from 'react';
import { Link } from 'react-router';
import { Clock, Pause, Play, RotateCcw, Square } from 'lucide-react';
import { mmss, useTicker } from '../lib/focusClocks';
import { useFocusPortal } from '../lib/focusPortal';
import { snapshotLeftMs, useFocusSession, type FocusSnapshot } from '../lib/focusSession';
import { Icon } from './Icon';

/** Spoken time for the label: "18 minutes 20 seconds", so a screen reader hears words, not "18:20". */
function spoken(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  const mins = m > 0 ? `${m} ${m === 1 ? 'minute' : 'minutes'}` : '';
  const secs = sec > 0 || m === 0 ? `${sec} ${sec === 1 ? 'second' : 'seconds'}` : '';
  return [mins, secs].filter(Boolean).join(' ');
}

/**
 * The pill's colour says how far along the part is, the way a traffic light would, in the pillar colours: a focus countdown is calm blue
 * while more than half is left, green past halfway, orange in the last five minutes and red in the last minute (with a soft pulse). A
 * break is violet, breathing green, the stopwatch (which counts up) indigo.
 */
function stage(s: FocusSnapshot, leftMs: number): { fill: string; urgent: boolean } {
  if (s.kind === 'stopwatch') return { fill: 'bg-r6', urgent: false };
  if (s.kind === 'short' || s.kind === 'long') return { fill: 'bg-r7', urgent: false };
  if (s.kind === 'breathe') return { fill: 'bg-r4', urgent: false };
  if (leftMs <= 60_000) return { fill: 'bg-r1', urgent: true };
  if (leftMs <= 5 * 60_000) return { fill: 'bg-r2', urgent: false };
  if (s.totalMs > 0 && leftMs <= s.totalMs / 2) return { fill: 'bg-r4', urgent: false };
  return { fill: 'bg-r5', urgent: false };
}

/** The phone top-left logo and the laptop sidebar logo are the same size and shape; this pill fills the same box so nothing shifts. */
export function FocusPill({ compact = false }: { compact?: boolean }) {
  const snap = useFocusSession((s) => s.snap);
  // Mindful showing: its own Stop sheet asks whether to keep a part. Anywhere else the clock is parked out of sight, so the pill asks itself.
  const onMindful = useFocusPortal((s) => s.target !== null);
  const [asking, setAsking] = useState(false);
  // A re-render once a second while something is active, so the seconds keep counting even with nothing else on the page changing.
  const [, bump] = useState(0);
  useTicker(snap.active, () => bump((n) => n + 1), 1000);
  if (!snap.active) return null;
  const ms = snapshotLeftMs(snap);
  const counting = snap.kind === 'stopwatch';
  const paused = !snap.running;
  // Counting down rounds up, so the last second reads 0:01; counting up rounds down.
  const shown = mmss(ms, !counting);
  const { fill, urgent } = stage(snap, ms);
  const when = counting ? `${spoken(ms)} so far` : paused ? `paused with ${spoken(ms)} left` : `${spoken(ms)} left`;
  const aria = `${snap.label}${snap.taskTitle ? `, ${snap.taskTitle}` : ''}, ${when}. Back to Mindful minutes.`;
  const send = useFocusSession.getState().send;
  const control = 'focus-pill-btn flex size-[44px] shrink-0 items-center justify-center rounded-pill text-on-fill';
  // A Timer or a Pomodoro focus part past a whole minute asks first: keep the minutes so far, or throw them away.
  const kept = snap.kind === 'timer' || snap.kind === 'focus' ? Math.floor(Math.max(0, snap.totalMs - ms) / 60_000) : 0;
  const stop = () => {
    if (kept >= 1 && !onMindful) setAsking(true);
    else send('stop');
  };
  return (
    // With a mouse over it (or the keyboard inside it), the pill opens three controls beside the time: restart this part, stop, and
    // pause or resume, left to right. On a touch screen a tap opens Mindful, where the full controls are.
    <div className={`focus-pill-wrap ${fill} flex items-center rounded-pill ${paused ? 'is-paused' : ''}`} data-urgent={urgent && !paused ? '' : undefined}>
      <Link
        to="/mindful"
        aria-label={aria.replace(/\s+/g, ' ').trim()}
        className={`focus-pill toy flex min-h-[44px] min-w-[44px] flex-1 items-center justify-center gap-xs whitespace-nowrap rounded-pill px-sm text-on-fill ${compact ? '' : 'font-display text-[16px] font-extrabold tracking-tight'}`}
      >
        <Icon icon={paused ? Pause : Clock} size={16} />
        <span className="text-[14px] font-extrabold tabular-nums">{shown}</span>
        {/* From the tablet width up, the task after the time; a phone's pill stays the time alone. */}
        {snap.taskTitle && (
          <span className="hidden max-w-[160px] truncate text-[14px] font-bold md:inline-block" aria-hidden="true">
            {snap.taskTitle}
          </span>
        )}
      </Link>
      {asking && (
        <span className="flex items-center gap-xs pr-xs" role="group" aria-label={`Stop. Keep ${kept} ${kept === 1 ? 'minute' : 'minutes'}?`}>
          <button type="button" className="focus-pill-btn min-h-[44px] whitespace-nowrap rounded-pill px-sm text-[14px] font-extrabold text-on-fill" onClick={() => (setAsking(false), send('stopKeep'))}>
            Keep {kept} min
          </button>
          <button type="button" className="focus-pill-btn min-h-[44px] whitespace-nowrap rounded-pill px-sm text-[14px] font-extrabold text-on-fill" onClick={() => (setAsking(false), send('stopDrop'))}>
            Throw away
          </button>
        </span>
      )}
      {!asking && (
      <span className="focus-pill-ctl items-center" role="group" aria-label="Clock controls">
        <button type="button" className={control} onClick={() => send('restart')} aria-label="Restart this part" title="Restart">
          <Icon icon={RotateCcw} size={16} />
        </button>
        <button type="button" className={control} onClick={stop} aria-label={counting ? 'Stop and keep the whole minutes' : 'Stop'} title="Stop">
          <Icon icon={Square} size={14} filled />
        </button>
        <button type="button" className={control} onClick={() => send('toggle')} aria-label={snap.running ? 'Pause' : 'Resume'} title={snap.running ? 'Pause' : 'Resume'}>
          <Icon icon={snap.running ? Pause : Play} size={16} filled={!snap.running} />
        </button>
      </span>
      )}
    </div>
  );
}
