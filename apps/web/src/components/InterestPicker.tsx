import { INTEREST_GROUPS, MAX_INTERESTS } from '@kreators/shared';

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
      <legend className="text-[14px] font-bold">{legend}</legend>
      <div className="mt-xs flex items-start justify-between gap-sm">
        {hint ? <p className="m-0 text-[12px] font-bold text-ink-soft">{hint}</p> : <span />}
        <span className={`shrink-0 rounded-pill px-sm text-[12px] font-extrabold leading-[28px] ${full ? 'bg-ink text-on-ink' : 'bg-paper text-ink-soft'}`} aria-live="polite">
          {value.length} of {MAX_INTERESTS} on
        </span>
      </div>
      <div className="mt-sm flex flex-col gap-md">
        {INTEREST_GROUPS.map((g) => {
          const on = g.options.filter((o) => value.includes(o)).length;
          return (
            <div key={g.key}>
              <p className="m-0 flex items-center gap-xs text-[14px] font-bold">
                <span aria-hidden="true">{g.emoji}</span>
                {g.name}
                {on > 0 && <span className="font-semibold text-ink-soft">{on} on</span>}
              </p>
              <div className="mt-xs flex flex-wrap gap-xs" role="group" aria-label={g.name}>
                {g.options.map((o) => {
                  const picked = value.includes(o);
                  return (
                    <button key={o} type="button" aria-pressed={picked} disabled={full && !picked} onClick={() => toggle(o)} className={`toy min-h-[40px] rounded-pill border-2 px-sm py-xs text-[14px] font-bold disabled:opacity-50 ${picked ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}>
                      {o}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
