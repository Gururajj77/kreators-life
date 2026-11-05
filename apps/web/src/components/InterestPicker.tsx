import { INTEREST_GROUPS, MAX_INTERESTS } from '@kreators/shared';
import { Fold } from './Fold';
import { AppIcon } from './AppIcon';

/**
 * Interests in groups, the way a dating app lays them out: a heading per group and a chip per interest.
 * Up to ten can be on. Once ten are on, the rest go quiet until one is taken off. The count sits at the
 * top so nobody has to guess how many are left.
 */
export function InterestPicker({ value, onChange, legend = 'Interests', hint }: { value: string[]; onChange: (next: string[]) => void; legend?: string; hint?: string }) {
  const full = value.length >= MAX_INTERESTS;
  const toggle = (o: string) => {
    if (value.includes(o)) onChange(value.filter((v) => v !== o));
    else if (!full) onChange([...value, o]);
  };
  return (
    <fieldset className="m-0 border-0 p-0">
      <legend className="text-subhead font-semibold">{legend}</legend>
      <div className="mt-xs flex items-start justify-between gap-sm">
        {hint ? <p className="m-0 text-caption text-ink-soft">{hint}</p> : <span />}
        <span className={`shrink-0 rounded-pill px-sm text-caption font-medium leading-[28px] ${full ? 'bg-ink text-on-ink' : 'bg-paper text-ink-soft'}`} aria-live="polite">
          {value.length} of {MAX_INTERESTS} on
        </span>
      </div>
      {/* Folded by default, open only where something is already picked: the full list is about a hundred chips, and a
          long page of them would push Save off the bottom of the screen. */}
      <div className="mt-sm flex flex-col gap-xs">
        {INTEREST_GROUPS.map((g) => {
          const on = g.options.filter((o) => value.includes(o)).length;
          return (
            <Fold key={g.key} title={<span className="inline-flex items-center gap-xs"><AppIcon name={g.icon} size={18} />{g.name}</span>} hint={on > 0 ? `${on} on` : undefined} defaultOpen={on > 0}>
              <div className="flex flex-wrap gap-xs" role="group" aria-label={g.name}>
                {g.options.map((o) => {
                  const picked = value.includes(o);
                  return (
                    <button key={o} type="button" aria-pressed={picked} disabled={full && !picked} onClick={() => toggle(o)} className={`toy min-h-[44px] rounded-pill border-2 px-sm text-subhead font-medium disabled:opacity-50 ${picked ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}>
                      {o}
                    </button>
                  );
                })}
              </div>
            </Fold>
          );
        })}
      </div>
    </fieldset>
  );
}
