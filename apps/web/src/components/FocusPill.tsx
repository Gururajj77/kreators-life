// The logo's spot, taken over by a small ticking chip while a focus clock runs or waits paused in Mindful minutes, on every page, not
// only Mindful's own. Tapping it goes back to the clock. It reads the shared snapshot in lib/focusSession.ts, so it is right whether
// Mindful is open in this tab or was left on another page.
import { useState } from 'react';
import { Link } from 'react-router';
import { Clock } from 'lucide-react';
import { useTicker } from '../lib/focusClocks';
import { snapshotLeftMs, useFocusSession } from '../lib/focusSession';
import { Icon } from './Icon';

/** "25m" once a minute is left, "45s" under that, so the chip never reads 0m while real time remains. */
function shortLeft(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  return `${Math.round(s / 60)}m`;
}

/** The phone top-left logo and the laptop sidebar logo are the same size and shape; this pill fills the same box so nothing shifts. */
export function FocusPill({ compact = false }: { compact?: boolean }) {
  const snap = useFocusSession((s) => s.snap);
  // A re-render once a second while something is active, so the number keeps counting even with nothing else on the page changing.
  const [, bump] = useState(0);
  useTicker(snap.active, () => bump((n) => n + 1), 1000);
  if (!snap.active) return null;
  const left = shortLeft(snapshotLeftMs(snap));
  const counting = snap.kind === 'stopwatch';
  const paused = !snap.running && !counting;
  const when = counting ? `${left} so far` : paused ? `paused with ${left} left` : `${left} left`;
  const aria = `${snap.label}${snap.taskTitle ? `, ${snap.taskTitle}` : ''}, ${when}. Back to Mindful minutes.`;
  return (
    <Link
      to="/mindful"
      aria-label={aria.replace(/\s+/g, ' ').trim()}
      className={`toy toy-soft bg-r5 flex min-h-[44px] min-w-[44px] items-center justify-center gap-xs whitespace-nowrap rounded-pill px-sm text-on-fill ${compact ? '' : 'font-display text-[16px] font-extrabold tracking-tight'}`}
    >
      <Icon icon={Clock} size={16} className={paused ? 'opacity-70' : ''} />
      <span className="text-[14px] font-extrabold tabular-nums">{left}</span>
    </Link>
  );
}
