import { SUPPLEMENT_TIME_META, type SupplementTime } from '@kreators/shared/fitness';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router';
import { api } from '../lib/api';
import { useAuthed } from '../lib/queries';
import { AppIcon } from './AppIcon';
import { CheckRow } from './CheckRow';
import { ErrorLine } from './ErrorLine';
import { Fold } from './Fold';
import { Icon } from './Icon';

/**
 * Supplements on Daily (2026-11-07): one closed fold, "Supplements" with "2 of 4 today", right after Habits, only while Fitness is on, the
 * person switched on both Track supplements and Show on Daily and something is on the list today (the server answers `show: false`
 * otherwise). It opens in place to today's items as tick rows by part of the day, with "Edit list" to Fitness. Never a task, never in the
 * sort or the six shown, and it never shows history. Its own small chunk, downloaded only for someone with Fitness on.
 */
export function SupplementsToday({ date }: { date: string }) {
  const qc = useQueryClient();
  const q = useAuthed(['supplements-today', date], () => api.supplementsToday(date));
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ['supplements-today'] }), qc.invalidateQueries({ queryKey: ['supplements'] })]);
  const tick = useMutation({ mutationFn: (v: { id: string; taken: boolean }) => api.tickSupplement(v.id, date, v.taken), onSuccess: refresh });
  const group = useMutation({ mutationFn: (t: SupplementTime) => api.tickSupplementGroup(date, t), onSuccess: refresh });
  const d = q.data;
  if (!d?.show) return null;
  return (
    <section className="mt-lg" aria-label="Supplements">
      {/* A supplement reminder (with Show on Daily on) opens Daily on `#supplements`, which lands here and opens it (lib/useLandOnHash.ts). */}
      <Fold id="supplements" title="Supplements" hint={`${d.taken} of ${d.total} today`}>
        <div className="grid gap-md pt-sm">
          <ErrorLine e={tick.error ?? group.error} />
          {d.groups.map((g) => {
            const open = g.items.filter((s) => !s.taken).length;
            return (
              <div key={g.time}>
                <div className="flex flex-wrap items-center justify-between gap-xs">
                  <h3 className="m-0 inline-flex items-center gap-xs text-headline">
                    <AppIcon name={SUPPLEMENT_TIME_META[g.time].icon} size={18} />
                    {SUPPLEMENT_TIME_META[g.time].name}
                  </h3>
                  {open > 0 && (
                    <button type="button" disabled={group.isPending} onClick={() => group.mutate(g.time)} className="inline-flex min-h-[44px] items-center text-caption font-semibold underline underline-offset-4 hover:text-ink">
                      Mark all taken
                    </button>
                  )}
                </div>
                <ul className="mt-xs flex list-none flex-col gap-xs p-0 m-0">
                  {g.items.map((s) => (
                    <li key={s.id}>
                      <CheckRow checked={s.taken} busy={tick.isPending && tick.variables?.id === s.id} onToggle={() => tick.mutate({ id: s.id, taken: !s.taken })} title={s.name} subtitle={s.amount || undefined} />
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
          <div className="flex justify-end">
            <Link to="/fitness#supplements" className="inline-flex min-h-[44px] items-center gap-xs text-subhead font-semibold underline-offset-4 hover:underline">
              Edit list
              <Icon icon={ArrowUpRight} size={16} className="read-arrow" />
            </Link>
          </div>
        </div>
      </Fold>
    </section>
  );
}
