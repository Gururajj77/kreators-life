import { formatCount } from '@kreators/shared';
import { EFFORT_LEVELS, moveLine, RUN_TOOL_KINDS, type MoveLog } from '@kreators/shared/fitness';
import { useMutation } from '@tanstack/react-query';
import { ArrowUpRight } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { api } from '../lib/api';
import { dayLabel, todayLocal } from '../lib/date';
import { focusHeadingAfter } from '../lib/focusHeading';
import { useModule } from '../lib/modules';
import { useAuthed, useRefreshAll } from '../lib/queries';
import { AnimatedIcon } from './AnimatedIcon';
import { ConfirmDelete } from './ConfirmDelete';
import { Icon } from './Icon';
import { MoveForm } from './MoveForm';

/**
 * Kreators Run's own tool (2026-11-07): log a run or a walk on your own, today or yesterday, with no club and no start code. It writes the
 * same movement log as Fitness (`/run/move` and `/fitness/move` share one action on the server), counts as movement in Life, and pays
 * nothing, so it is kept apart from a club entry: no xp, no points, no run badge.
 */
export function RunMoveTool() {
  const today = todayLocal();
  const refresh = useRefreshAll();
  const q = useAuthed(['run', 'moves', today], () => api.runMoves(today));
  const fitness = useModule('fitness');
  const [toDelete, setToDelete] = useState<MoveLog | null>(null);
  const remove = useMutation({
    mutationFn: (id: string) => api.deleteMove(id, 'run'),
    onSuccess: () => {
      setToDelete(null);
      // The row and its trash button go, so the keyboard's place moves to this card's heading.
      focusHeadingAfter('run-own');
      return refresh();
    },
  });
  const moves = q.data?.moves ?? [];
  return (
    <section data-pillar="friendship" className="mt-md rounded-card p-md" style={{ background: 'var(--tint-orange)' }} aria-labelledby="run-own">
      <h2 id="run-own" className="text-title2">
        Log a run or walk
      </h2>
      <p className="mt-xs m-0 text-subhead text-ink-soft">On your own, with no club or code. It counts as movement in Life and pays nothing.</p>
      <div className="mt-md">
        <MoveForm kinds={RUN_TOOL_KINDS} solid={false} saveLabel="Save it" onSave={(body) => api.logMove(body, 'run')} onDone={() => void refresh()} />
      </div>
      {moves.length > 0 && (
        <div className="mt-md">
          <div className="flex flex-wrap items-baseline justify-between gap-xs">
            <h3 className="m-0 text-headline">On your own, last 7 days</h3>
            <p className="m-0 text-subhead text-ink-soft">{formatCount(q.data?.minutes ?? 0)} min</p>
          </div>
          <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
            {moves.map((m) => (
              <li key={m.id} className="flex items-center gap-sm rounded-tile bg-card p-sm shadow-toy-soft">
                <span className="min-w-0 flex-1">
                  <span className="block text-card-title">{moveLine(m)}</span>
                  <span className="block truncate text-card-note text-ink-soft">{[dayLabel(m.date), m.effort ? EFFORT_LEVELS[m.effort - 1] : '', m.note].filter(Boolean).join(' · ')}</span>
                </span>
                <button type="button" onClick={() => setToDelete(m)} aria-label={`Remove ${moveLine(m)} on ${dayLabel(m.date)}`} title="Remove" className="toy toy-flat flex size-[44px] shrink-0 items-center justify-center rounded-pill text-ink-soft hover:text-r1">
                  <AnimatedIcon name="trash" size={20} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {fitness?.on && (
        <Link to="/fitness" className="mt-sm inline-flex min-h-[44px] items-center gap-xs text-subhead font-semibold underline-offset-4 hover:underline">
          Every workout in Fitness
          <Icon icon={ArrowUpRight} size={16} className="read-arrow" />
        </Link>
      )}
      <ConfirmDelete
        open={toDelete !== null}
        title="Remove this?"
        body={toDelete ? `${moveLine(toDelete)} on ${dayLabel(toDelete.date)}. It comes off your movement in Life. This cannot be undone.` : ''}
        pending={remove.isPending}
        failed={remove.isError}
        yes="Yes, remove it"
        onYes={() => toDelete && remove.mutate(toDelete.id)}
        onClose={() => {
          setToDelete(null);
          remove.reset();
        }}
      />
    </section>
  );
}
