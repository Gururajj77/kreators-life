import { COURAGE, levelByValue, MAP_BAND_META, MAP_BANDS, MAP_LEVELS, placementFlags, RELATIONSHIP_BY_KEY, type Placement, type RelationshipKey } from '@kreators/shared';
import { Avatar } from './Avatar';
import { Segments } from './Charts';

/**
 * The map as a ladder: sixteen named levels in three bands, Oneness on top, Shame at the bottom, the Courage
 * line marked. With placements, each pillar's character sits on its core level and a faded one on its floor,
 * so the whole life is on one picture. Names only, never numbers.
 */
export function MapLadder({ placements = [], compact = false }: { placements?: Placement[]; compact?: boolean }) {
  const flagged = placements.map((p) => ({ key: p.relationship, f: placementFlags(p) }));
  const coresAt = (v: number) => flagged.filter((x) => x.f.core === v).map((x) => x.key);
  const floorsAt = (v: number) => flagged.filter((x) => x.f.floor === v && x.f.floor !== x.f.core).map((x) => x.key);
  const levels = [...MAP_LEVELS].reverse();
  const bands = [...MAP_BANDS].reverse();
  return (
    <div className="flex flex-col gap-xs" role="img" aria-label={placements.length ? 'Your seven on the map' : 'The map, Shame at the bottom, Oneness on top'}>
      {bands.map((b) => (
        <section key={b} className="rounded-tile bg-card p-sm shadow-toy-soft">
          <p className="m-0 flex items-baseline justify-between gap-sm text-[12px] font-extrabold uppercase tracking-wide text-ink-soft">
            <span>{MAP_BAND_META[b].name}</span>
            {!compact && <span className="normal-case tracking-normal font-semibold">{MAP_BAND_META[b].blurb}</span>}
          </p>
          <ol className="mt-xs m-0 flex list-none flex-col p-0">
            {levels
              .filter((l) => l.band === b)
              .map((l) => {
                const cores = coresAt(l.value);
                const floors = floorsAt(l.value);
                const courage = l.value === COURAGE;
                return (
                  <li key={l.value} className={`flex min-h-[32px] items-center gap-sm border-t border-line py-xs first:border-t-0 ${courage ? 'rounded-tile bg-paper px-xs' : ''}`}>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-bold">
                        {l.name}
                        {courage ? '. Live above this line.' : ''}
                      </span>
                      {!compact && <span className="block text-[12px] font-semibold text-ink-soft">“{l.sounds}”</span>}
                    </span>
                    {(cores.length > 0 || floors.length > 0) && (
                      <span className="flex shrink-0 items-center gap-xs">
                        {floors.map((k) => (
                          <span key={`f-${k}`} className="opacity-40" title={`${RELATIONSHIP_BY_KEY[k].name} drops here`}>
                            <Avatar relationship={k} size={22} decorative still />
                          </span>
                        ))}
                        {cores.map((k) => (
                          <span key={`c-${k}`} title={`${RELATIONSHIP_BY_KEY[k].name} lives here`}>
                            <Avatar relationship={k} size={26} decorative still />
                          </span>
                        ))}
                      </span>
                    )}
                  </li>
                );
              })}
          </ol>
        </section>
      ))}
      {placements.length > 0 && <p className="m-0 text-[12px] font-bold text-ink-soft">A full face is where you live. A faded one is where you drop under stress.</p>}
    </div>
  );
}

/** Core and floor per relationship as one bar each on the 20 to 540 scale, names only, never numbers. */
export function PlacementChart({ placements, focus = [], compact = false }: { placements: Placement[]; focus?: RelationshipKey[]; compact?: boolean }) {
  const pct = (v: number) => ((v - 20) / (540 - 20)) * 100;
  return (
    <ul className="m-0 flex list-none flex-col gap-xs p-0">
      {placements.map((p) => {
        const rel = RELATIONSHIP_BY_KEY[p.relationship];
        const f = placementFlags(p);
        const left = pct(f.floor);
        const width = Math.max(2, pct(f.core) - left);
        const inFocus = focus.includes(p.relationship);
        return (
          <li key={p.relationship} className={`rounded-tile bg-card p-sm shadow-toy-soft ${inFocus ? 'ring-2 ring-ink' : ''}`}>
            <div className="flex items-center gap-sm">
              <Avatar relationship={rel.key} size={28} decorative still />
              <span className="min-w-0 flex-1 text-[14px] font-bold">
                {rel.name}
                {inFocus ? <span className="text-ink-soft"> · focus</span> : null}
              </span>
              <span className="text-[12px] font-bold text-ink-soft">
                {levelByValue(f.floor)?.name} to {levelByValue(f.core)?.name}
              </span>
            </div>
            <div className="relative mt-xs h-[8px] rounded-pill bg-line" aria-hidden="true">
              <span className="absolute top-0 h-full w-px bg-ink-mute" style={{ left: `${pct(COURAGE)}%` }} />
              <span className="absolute top-0 h-full rounded-pill" style={{ left: `${left}%`, width: `${width}%`, background: rel.color }} />
            </div>
            {!compact && (f.required || f.volatile || f.capped) && (
              <p className="mt-xs m-0 text-[12px] font-bold text-ink-soft">
                {[f.required && 'Month one focus: the floor is under Courage.', f.volatile && 'A big drop under stress, so check it each week.', f.capped && 'Held at Acceptance until you can show more.'].filter(Boolean).join(' ')}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** One line for a pillar page: where it usually lives, where it drops, and what that means. */
export function placementLine(p: Placement): string {
  const f = placementFlags(p);
  const core = levelByValue(f.core)?.name ?? '';
  const floor = levelByValue(f.floor)?.name ?? '';
  const base = f.core === f.floor ? `On the map you live at ${core} and hold it under stress.` : `On the map you live at ${core} and drop to ${floor} under stress.`;
  const extra = [f.required && 'That floor is under Courage, so this is a focus for month one.', f.volatile && 'The drop is big, so check it each week.', f.capped && 'Held at Acceptance until you can show more.'].filter(Boolean).join(' ');
  return extra ? `${base} ${extra}` : base;
}

/** A score row out of ten, drawn as segments. */
export function ScoreRow({ label, value, color }: { label: string; value: number | undefined; color: string }) {
  return (
    <li className="flex items-center justify-between gap-sm rounded-tile bg-card p-sm shadow-toy-soft">
      <span className="min-w-0 flex-1 text-[14px] font-bold">{label}</span>
      <span className="flex items-center gap-sm">
        <Segments value={value ?? null} max={10} color={color} label={`${label}: ${value ?? 'not rated'} of ten`} />
        <span className="w-[32px] text-right text-[12px] font-bold text-ink-soft">{value ?? '–'}</span>
      </span>
    </li>
  );
}
