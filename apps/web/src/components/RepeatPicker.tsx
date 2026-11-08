import { REPEAT_KINDS, MAX_REPEAT_EVERY, repeatLabel, type Repeat, type RepeatKind } from '@kreators/shared';
import { FIELD } from '../lib/ui';
import { inZone } from '../lib/date';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const pad = (n: number) => String(n).padStart(2, '0');
const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/**
 * A day of the month, as a date: the same month as `anchor`, or the next one that has that many days (a 31st starts in a month with a 31st, so
 * the rule keeps its day and shorter months fall on their last day).
 */
export function anchorOnDay(anchor: string, day: number): string {
  let y = Number(anchor.slice(0, 4));
  let m = Number(anchor.slice(5, 7));
  for (let i = 0; i < 12; i += 1) {
    if (daysIn(y, m) >= day) return `${y}-${pad(m)}-${pad(day)}`;
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return anchor;
}

/**
 * How something repeats, for a task and for a scheduled review: none, every day, weekdays, every week (choose which days), every month (choose
 * the day of the month) or every year, every one or more of them, with an end day if wanted. The rule is the one the server reads, so a task and a
 * review repeat the same way. `anchor` is the first day; `onAnchor` lets the monthly day move it.
 */
export function RepeatPicker({ value, anchor, onChange, onAnchor, note = '' }: { value: Repeat | null; anchor: string; onChange: (r: Repeat | null) => void; onAnchor?: (day: string) => void; note?: string }) {
  const rule = value;
  const setRule = (patch: Partial<Repeat>) => rule && onChange({ ...rule, ...patch });
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(anchor);
  return (
    <div>
      <label className="block">
        <span className="block text-subhead font-semibold">Repeat</span>
        <select
          value={rule?.kind ?? 'none'}
          onChange={(e) => onChange(e.target.value === 'none' ? null : { kind: e.target.value as RepeatKind, every: rule?.every ?? 1, days: [], until: rule?.until ?? null })}
          className={FIELD}
        >
          <option value="none">Does not repeat</option>
          {REPEAT_KINDS.map((k) => (
            <option key={k.key} value={k.key}>
              {k.name}
            </option>
          ))}
        </select>
      </label>
      {rule && (
        <div className="mt-xs flex flex-col gap-xs">
          {rule.kind !== 'weekdays' && (
            <label className="flex items-center gap-xs text-subhead font-semibold">
              Every
              <input type="number" min={1} max={MAX_REPEAT_EVERY} value={rule.every} onChange={(e) => setRule({ every: Math.min(MAX_REPEAT_EVERY, Math.max(1, Math.round(Number(e.target.value)) || 1)) })} className="w-[72px] rounded-tile border-2 border-line bg-paper px-sm py-xs text-body" />
              {REPEAT_KINDS.find((k) => k.key === rule.kind)?.unit}
              {rule.every === 1 ? '' : 's'}
            </label>
          )}
          {rule.kind === 'weekly' && (
            <div>
              <span className="block text-subhead font-semibold">On these days</span>
              <div className="mt-xs flex flex-wrap gap-xs" role="group" aria-label="Days of the week">
                {WEEKDAYS.map((d, i) => {
                  const n = i + 1;
                  const on = rule.days.includes(n);
                  return (
                    <button key={d} type="button" aria-pressed={on} onClick={() => setRule({ days: on ? rule.days.filter((x) => x !== n) : [...rule.days, n].sort() })} className={`toy min-h-[44px] min-w-[44px] rounded-pill border-2 px-xs text-subhead font-medium ${on ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}>
                      {d}
                    </button>
                  );
                })}
              </div>
              <p className="mt-xs m-0 text-caption text-ink-soft">None picked means the day of the first date.</p>
            </div>
          )}
          {rule.kind === 'monthly' && onAnchor && valid && (
            <label className="block">
              <span className="block text-subhead font-semibold">Day of the month</span>
              <select value={Number(anchor.slice(8, 10))} onChange={(e) => onAnchor(anchorOnDay(anchor, Number(e.target.value)))} className={FIELD}>
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <span className="mt-xs block text-caption text-ink-soft">A day past the end of a short month falls on its last day.</span>
            </label>
          )}
          {rule.kind === 'yearly' && valid && <p className="m-0 text-subhead font-semibold">On {inZone(anchor, { day: 'numeric', month: 'long' })}</p>}
          <label className="block">
            <span className="block text-subhead font-semibold">Stop after (optional)</span>
            <input type="date" value={rule.until ?? ''} onChange={(e) => setRule({ until: e.target.value || null })} className={FIELD} />
          </label>
          <p className="m-0 text-caption text-ink-soft">
            {repeatLabel(rule, valid ? anchor : null)}.{note ? ` ${note}` : ''}
          </p>
        </div>
      )}
    </div>
  );
}
