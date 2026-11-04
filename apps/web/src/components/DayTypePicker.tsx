import { DAY_TYPES, dayTypeOf, RELATIONSHIP_BY_KEY, type DayKind, type DayTypeKey, type DayTypeResponse } from '@kreators/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { keys, useAuthed } from '../lib/queries';
import { SELECT_SM } from '../lib/ui';

const dayTypeKey = (date: string) => ['dayType', date] as const;

/** The kind of day the person picked for `date` (their own today), and a setter that shows the change at once and saves it. */
export function useDayType(date: string) {
  const qc = useQueryClient();
  const q = useAuthed(dayTypeKey(date), () => api.dayType(date, date));
  const save = useMutation({
    mutationFn: (kind: DayTypeKey | null) => api.setDayType(date, date, kind),
    onMutate: async (kind) => {
      await qc.cancelQueries({ queryKey: dayTypeKey(date) });
      const before = qc.getQueryData<DayTypeResponse>(dayTypeKey(date));
      qc.setQueryData<DayTypeResponse>(dayTypeKey(date), { date, kind });
      return { before };
    },
    onError: (_e, _k, ctx) => qc.setQueryData(dayTypeKey(date), ctx?.before),
    onSuccess: (r) => {
      qc.setQueryData(dayTypeKey(date), r);
      // The server picks which tasks Daily shows by the kind of day, so a P0 is never left out; read the list again.
      void qc.invalidateQueries({ queryKey: keys.today(date) });
    },
  });
  return { type: dayTypeOf(q.data?.kind ?? null), set: (k: DayTypeKey | null) => save.mutate(k), failed: save.isError };
}

/**
 * "Kind of day" on Daily: one dropdown (Any day, then the kinds from DAY_TYPES), placed by Daily at the left of the Sort by row so the
 * two controls share one line from the laptop width up (beside the sidebar a tablet has no room for both) and take a line each below it. Nothing is picked to start with.
 */
export function DayTypeSelect({ type, onPick }: { type: DayKind | null; onPick: (k: DayTypeKey | null) => void }) {
  return (
    <label className="flex shrink-0 items-center gap-xs">
      <span className="shrink-0 text-[14px] font-bold text-ink-soft">Kind of day</span>
      <select value={type?.key ?? ''} onChange={(e) => onPick((e.target.value || null) as DayTypeKey | null)} className={`${SELECT_SM} min-w-0 flex-1 lg:w-[240px] lg:flex-none`}>
        <option value="">Any day</option>
        {DAY_TYPES.map((d) => (
          <option key={d.key} value={d.key}>
            {d.name}
          </option>
        ))}
      </select>
    </label>
  );
}

/** The quiet line under the day and sort controls: why the order changed, or that the person's own sort is in charge. */
export function DayTypeNote({ type, failed, ownSort }: { type: DayKind | null; failed?: boolean; ownSort: string | null }) {
  const lead = type ? RELATIONSHIP_BY_KEY[type.lead] : null;
  return (
    <>
      {type && lead && (
        <p className="mt-xs m-0 text-[12px] font-semibold text-ink-soft" aria-live="polite">
          {ownSort ? `Sorted by ${ownSort}, as you chose. Pick By context to put the ${lead.name} pillar first.` : `Sorted by context. P0 stays on top. ${type.why}`}
        </p>
      )}
      {failed && (
        <p className="mt-xs m-0 text-[12px] font-bold text-ink-soft" role="alert">
          Could not save that. Try again.
        </p>
      )}
    </>
  );
}
