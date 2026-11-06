import { COURAGE, levelByValue, MAP_BAND_META, MAP_BANDS, MAP_LEVELS, placementFlags, RELATIONSHIP_BY_KEY, STAR_WORDS, starsOf, type MapBand, type Placement, type RelationshipKey } from '@kreators/shared';
import { useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { Avatar } from './Avatar';

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
          <p className="m-0 flex items-baseline justify-between gap-sm text-eyebrow uppercase text-ink-soft">
            <span>{MAP_BAND_META[b].name}</span>
            {!compact && <span className="normal-case tracking-normal">{MAP_BAND_META[b].blurb}</span>}
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
                      <span className="block text-subhead">
                        {l.name}
                        {courage ? '. Live above this line.' : ''}
                      </span>
                      {!compact && <span className="block text-caption text-ink-soft">“{l.sounds}”</span>}
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
      {placements.length > 0 && <p className="m-0 text-caption text-ink-soft">A full face is where you live. A faded one is where you drop under stress.</p>}
    </div>
  );
}

/**
 * The scale the map comes from, from Shame (20) up to Full Consciousness (1000). The map you place yourself on
 * runs from Shame to Oneness; the levels above it show where it leads. Title case, as on the chart.
 */
const ABOVE_THE_MAP: readonly { value: number; name: string }[] = [
  { value: 1000, name: 'Full Consciousness' },
  { value: 900, name: 'Supra Causal Truth' },
  { value: 850, name: 'Divine Grace & Love Union' },
  { value: 800, name: 'The Great Void' },
  { value: 700, name: 'Awareness' },
  { value: 670, name: 'Non-Duality' },
  { value: 600, name: 'Presence' },
];
const SCALE = [...ABOVE_THE_MAP, ...[...MAP_LEVELS].reverse().map((l) => ({ value: l.value, name: l.name.replace(/\b\w/g, (c) => c.toUpperCase()) }))];

/** Who you take yourself to be at each part of the scale. */
const SELVES: readonly { lines: string[]; from: number; to: number }[] = [
  { lines: ['Absolute Self - 1000'], from: 1000, to: 1000 },
  { lines: ['Supra Causal Self - 850'], from: 850, to: 850 },
  { lines: ['Causal Self - 800'], from: 800, to: 800 },
  { lines: ['Universal Self - 700'], from: 700, to: 700 },
  { lines: ['Galactic Self - 600'], from: 600, to: 600 },
  { lines: ['Planetary Self - 540'], from: 540, to: 540 },
  { lines: ['Higher Self', '400 - 539'], from: 500, to: 400 },
  { lines: ['Rational Linear', 'Emotional Self', '200 - 399'], from: 350, to: 200 },
  { lines: ['Lower Ego Self', '20 - 199'], from: 175, to: 20 },
];
const SELF_SPANS: readonly { from: number; to: number; color: string }[] = [
  { from: 1000, to: 400, color: 'var(--color-r6)' },
  { from: 350, to: 200, color: 'var(--color-scale-green)' },
  { from: 175, to: 20, color: 'var(--color-r1)' },
];
/** Where that is. */
const PLACES: readonly { name: string; from: number; to: number; color: string }[] = [
  { name: 'Heaven', from: 1000, to: 540, color: 'var(--color-r6)' },
  { name: 'Paradise', from: 500, to: 400, color: 'var(--color-scale-blue)' },
  { name: 'In Between', from: 350, to: 200, color: 'var(--color-scale-green)' },
  { name: 'Purgatory', from: 175, to: 100, color: 'var(--color-r2)' },
  { name: 'Hell', from: 75, to: 20, color: 'var(--color-r1)' },
];
/** The dimensions inside the funnel. A dark fill takes white words, a light one the dark ink. `narrow` is the wording where the funnel is thin. */
const DIMENSIONS: readonly { lines: string[]; narrow?: string[]; from: number; to: number; light?: boolean; top?: boolean }[] = [
  { lines: ['12th Dimension'], from: 1000, to: 900 },
  { lines: [], from: 850, to: 850 },
  { lines: ['Enlightenment'], from: 800, to: 800, light: true },
  { lines: ['I AM Presence'], from: 700, to: 600 },
  { lines: ['5th Dimension'], from: 540, to: 540 },
  { lines: ['New Humanity', 'Consciousness'], from: 500, to: 400 },
  { lines: ['4th Dimension'], narrow: ['4th', 'Dimension'], from: 350, to: 200, light: true },
  { lines: ['3rd Dimension'], narrow: ['3rd', 'Dimension'], from: 175, to: 20, light: true, top: true },
];
const CATEGORIES: readonly { lines: string[]; band: MapBand; from: number; to: number; color: string }[] = [
  { lines: ['Self-Realization'], band: 'realization', from: 1000, to: 400, color: 'var(--color-r6)' },
  { lines: ['Self-Empowerment'], band: 'empowerment', from: 350, to: 200, color: 'var(--color-r2)' },
  { lines: ['Victim/Abuser', 'Consciousness'], band: 'victim', from: 175, to: 20, color: 'var(--color-r1)' },
];
/** The funnel's colours, top to bottom, as shares of its height: silver and black at the top, gold, then violet down to red. */
const n = SCALE.length;
const STOPS: readonly [number, string][] = [
  [0, 'var(--color-scale-silver)'],
  [0.015, 'var(--color-scale-silver)'],
  [0.015, 'var(--color-scale-night)'],
  [3 / n, 'var(--color-scale-night)'],
  [3 / n, 'var(--color-scale-gold)'],
  [4 / n, 'var(--color-scale-gold)'],
  [4 / n, 'var(--color-r6)'],
  [6 / n, 'var(--color-r6)'],
  [7.5 / n, 'var(--color-scale-violet)'],
  [9 / n, 'var(--color-scale-blue)'],
  [10.5 / n, 'var(--color-scale-sky)'],
  [12 / n, 'var(--color-scale-green)'],
  [14.5 / n, 'var(--color-scale-lime)'],
  [15.5 / n, 'var(--color-r3)'],
  [18.5 / n, 'var(--color-r2)'],
  [1, 'var(--color-r1)'],
];
/** A level's colour in the funnel: the stop nearest its row's middle, so a tag beside a level wears the colour the picture gives it. */
export function scaleColor(value: number): string {
  const i = SCALE.findIndex((l) => l.value === value);
  if (i < 0) return 'var(--color-ink-mute)';
  const at = (i + 0.5) / n;
  let best = STOPS[0]!;
  for (const s of STOPS) if (Math.abs(s[0] - at) < Math.abs(best[0] - at)) best = s;
  return best[1];
}
/** The dimension a level sits in, as the funnel names it (the four rows the map's own levels fall in). */
export function dimensionOf(value: number): { short: string; full: string } {
  if (value >= 540) return { short: '5th Dimension', full: '5th Dimension' };
  if (value >= 400) return { short: 'New Humanity', full: 'New Humanity Consciousness' };
  if (value >= 200) return { short: '4th Dimension', full: '4th Dimension' };
  return { short: '3rd Dimension', full: '3rd Dimension' };
}
/** The category a band sits under on the chart's right side, with its colour there. */
const categoryOf = (band: MapBand) => CATEGORIES.find((c) => c.band === band)!;

/**
 * Where a level sits on the picture above it, as two tags: its number on the scale in the funnel's colour for that row,
 * and its dimension in the colour of its category (Self-Realization, Self-Empowerment, Victim/Abuser). The tag look is
 * the app's own: a pale wash of the colour, a dot in the full colour and ink words, so it reads in both themes. A ticked
 * level's wash deepens. The words are always there, so colour is never the only sign.
 */
export function LevelTags({ value, on = false, stack = false, className = '' }: { value: number; on?: boolean; stack?: boolean; className?: string }) {
  const level = levelByValue(value);
  if (!level) return null;
  const dim = dimensionOf(value);
  const cat = categoryOf(level.band);
  const wash = (c: string) => `color-mix(in srgb, ${c} ${on ? 30 : 16}%, transparent)`;
  const tag = 'tag inline-flex shrink-0 items-center gap-xs rounded-pill px-sm text-caption font-medium leading-[24px] text-ink';
  const dot = (c: string) => <span aria-hidden="true" className="inline-block size-[8px] shrink-0 rounded-pill" style={{ background: c }} />;
  return (
    // `stack` puts the two tags one over the other on a phone (the top right corner of a narrow row), side by side from `md`.
    <span className={`${stack ? 'flex flex-col items-end gap-xs md:flex-row md:flex-wrap md:items-center md:justify-end' : 'flex flex-wrap items-center justify-end gap-xs'} ${className}`}>
      {/* Each tag holds its widest value's width (the numbers 20 to 540, the dimensions), so on a list of levels the dots and words line
          up in two columns whatever the row says. */}
      <span className={`${tag} type-figure min-w-[64px]`} style={{ background: wash(scaleColor(value)) }} title={`Level ${value} on the map of consciousness`}>
        {dot(scaleColor(value))}
        <span className="sr-only">Level </span>
        {value}
      </span>
      <span className={`${tag} min-w-[128px]`} style={{ background: wash(cat.color) }} title={`${dim.full}, ${cat.lines.join(' ')}`}>
        {dot(cat.color)}
        {dim.short}
      </span>
    </span>
  );
}

// A row of 22 for each level, in the drawing's own units.
const Y0 = 30;
const R = 22;
const H = Y0 + n * R + 10;

/**
 * Two ways to lay the chart out. Wide is the whole chart in one picture, as the chart draws it. Narrow, for a
 * phone, keeps the funnel, the levels and the categories at a size that reads, and leaves the self and the
 * place out.
 */
interface Layout {
  w: number;
  /** The funnel's left edge and its width at the top. */
  fx: number;
  fw: number;
  heads: readonly (readonly [string, number])[];
  sizes: { head: number; level: number; dim: number; cat: number; band: number; note: number };
  /** The categories' words end at catX; their spans sit at spanX. */
  catX: number;
  spanX: number;
  /** The Courage line ends at noteX, with its words above it (wide) or under it (narrow). */
  noteX: number;
  noteBelow: boolean;
  /** Self Identification and Location drawn on the left of the funnel. */
  sides: boolean;
  /** The widest the picture grows, so its words never get large. */
  max: number;
}
const WIDE: Layout = {
  w: 720,
  fx: 225,
  fw: 260,
  heads: [
    ['Self Identification', 80],
    ['Location', 186],
    ['Dimension, Vibration & Color', 355],
    ['Level of Consciousness', 560],
    ['Category', 668],
  ],
  sizes: { head: 10, level: 11, dim: 10, cat: 13, band: 10, note: 9.5 },
  catX: 702,
  spanX: 712,
  noteX: 602,
  noteBelow: false,
  sides: true,
  max: 720,
};
// On a phone the words are at least 11px at a 390px screen (11.5 units of a 344-unit picture in a column of about 326px), so the
// funnel is narrower, the heads are short, and the category words move under the picture as a legend (see ConsciousnessMap).
const NARROW: Layout = {
  w: 344,
  fx: 1,
  fw: 120,
  heads: [
    ['Dimension', 61],
    ['Level of Consciousness', 228],
  ],
  sizes: { head: 11.5, level: 11.5, dim: 11.5, cat: 11.5, band: 11.5, note: 11.5 },
  catX: 334,
  spanX: 338,
  noteX: 300,
  noteBelow: true,
  sides: false,
  max: 440,
};

/** A line with a head at each end, like the chart's spans. */
function Span({ x, y1, y2, color }: { x: number; y1: number; y2: number; color: string }) {
  return <path d={`M${x} ${y1 + 1}V${y2 - 1}M${x - 3.5} ${y1 + 6}L${x} ${y1 + 1}L${x + 3.5} ${y1 + 6}M${x - 3.5} ${y2 - 6}L${x} ${y2 - 1}L${x + 3.5} ${y2 - 6}`} fill="none" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" style={{ stroke: color }} />;
}

function ScaleDrawing({ L }: { L: Layout }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const row = (v: number) => SCALE.findIndex((l) => l.value === v);
  const top = (v: number) => Y0 + row(v) * R;
  const bottom = (v: number) => Y0 + (row(v) + 1) * R;
  const middle = (from: number, to: number) => (top(from) + bottom(to)) / 2;
  const edge = (y: number) => L.fx + L.fw - ((y - Y0) / (n * R)) * (L.fw / 2);
  const funnel = `${L.fx},${Y0} ${L.fx + L.fw},${Y0} ${L.fx + L.fw / 2},${Y0 + n * R}`;
  const courage = bottom(COURAGE);
  const { sizes } = L;
  const lines = (texts: string[], x: number, y: number, size: number, anchor: 'start' | 'middle' | 'end', className: string, style?: CSSProperties) =>
    texts.map((t, i) => (
      <text key={t} x={x} y={y + (i - (texts.length - 1) / 2) * (size + 3) + size * 0.36} fontSize={size} textAnchor={anchor} className={className} style={style}>
        {t}
      </text>
    ));
  return (
    <svg
      viewBox={`0 0 ${L.w} ${H}`}
      width="100%"
      className="mx-auto block h-auto"
      style={{ maxWidth: L.max }}
      role="img"
      aria-label="The scale of consciousness, from Shame at 20 at the bottom to Full Consciousness at 1000 at the top. Self-Realization from 400 up, Self-Empowerment from 200 to 399, and Victim or Abuser Consciousness below 200. Live above Courage, at 200."
    >
      <defs>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="0" y2="1">
          {STOPS.map(([o, c], i) => (
            <stop key={i} offset={o} style={{ stopColor: c }} />
          ))}
        </linearGradient>
        <clipPath id={`${id}c`}>
          <polygon points={funnel} />
        </clipPath>
      </defs>

      {/* The column heads. */}
      {L.heads.map(([t, x]) => (
        <text key={t} x={x} y={14} fontSize={sizes.head} textAnchor="middle" className="" style={{ fill: 'var(--color-ink-soft)' }}>
          {t}
        </text>
      ))}

      {L.sides && (
        <>
          {/* Who you take yourself to be, and the spans they cover. */}
          {SELF_SPANS.map((sp) => (
            <Span key={sp.from} x={8} y1={top(sp.from) + 2} y2={bottom(sp.to) - 2} color={sp.color} />
          ))}
          {SELVES.map((sf) => (
            <g key={sf.lines[0]}>{lines(sf.lines, 80, middle(sf.from, sf.to), 10.5, 'middle', 'font-semibold', { fill: 'var(--color-ink)' })}</g>
          ))}
          {/* Where that is. */}
          {PLACES.map((pl) => (
            <g key={pl.name}>
              <Span x={152} y1={top(pl.from) + 2} y2={bottom(pl.to) - 2} color={pl.color} />
              {lines([pl.name], 160, middle(pl.from, pl.to), 11, 'start', 'font-semibold', { fill: 'var(--color-ink)' })}
            </g>
          ))}
        </>
      )}

      {/* The funnel, its dimensions, and the lines between them. */}
      <polygon points={funnel} fill={`url(#${id}g)`} strokeWidth={1.5} strokeLinejoin="round" className="stroke-line" />
      <g clipPath={`url(#${id}c)`}>
        {DIMENSIONS.slice(0, -1).map((d) => (
          <line key={d.to} x1={L.fx} x2={L.fx + L.fw} y1={bottom(d.to)} y2={bottom(d.to)} strokeWidth={1} strokeOpacity={0.6} style={{ stroke: 'var(--color-ink-fixed)' }} />
        ))}
        <line x1={L.fx} x2={L.fx + L.fw} y1={bottom(900)} y2={bottom(900)} strokeWidth={1} strokeOpacity={0.5} style={{ stroke: 'var(--color-scale-silver)' }} />
      </g>
      {DIMENSIONS.map((d) => {
        const words = (!L.sides && d.narrow) || d.lines;
        if (!words.length) return null;
        const y = d.top ? top(d.from) + R * (words.length > 1 ? 1.1 : 1) : middle(d.from, d.to);
        const cx = L.fx + L.fw / 2;
        // White words on a dark band. Where the band fades towards sky blue ("New Humanity Consciousness") the fill alone falls
        // under 4.5:1, so each word carries a soft halo in the chart's fixed ink, painted under the letters.
        if (!d.light)
          return (
            <g key={d.from}>
              {lines(words, cx, y, sizes.dim, 'middle', 'font-semibold', { fill: 'var(--color-on-fill)', stroke: 'var(--color-ink-fixed)', strokeOpacity: 0.55, strokeWidth: 3, strokeLinejoin: 'round', paintOrder: 'stroke' })}
            </g>
          );
        // A light band (gold, lime, yellow) puts its words on a small card-coloured chip in the theme's own ink, so they read in
        // both themes whatever sits under the picture.
        const cw = Math.max(...words.map((t) => t.length)) * sizes.dim * 0.6 + 10;
        const ch = words.length * (sizes.dim + 3) + 4;
        // Low in the funnel the chip is wider than the funnel, so on a phone it would run into the level words beside it ("3rd
        // Dimension" over "150 - Anger"). There it moves left until its right edge stays clear of the words at its own foot.
        const right = L.sides ? cx + cw / 2 : Math.min(cx + cw / 2, edge(y + ch / 2) + 1);
        const chipX = Math.max(L.fx - 1, right - cw);
        const tx = chipX + cw / 2;
        return (
          <g key={d.from}>
            <rect x={chipX} y={y - ch / 2} width={cw} height={ch} rx={ch / 2 > 10 ? 8 : ch / 2} style={{ fill: 'var(--color-card-strong)' }} fillOpacity={0.92} />
            {lines(words, tx, y, sizes.dim, 'middle', 'font-semibold', { fill: 'var(--color-ink)' })}
          </g>
        );
      })}

      {/* Every level, beside its slice. */}
      {SCALE.map((l) => {
        const y = top(l.value) + R / 2;
        return (
          <text key={l.value} x={edge(y) + 7} y={y + sizes.level * 0.36} fontSize={sizes.level} className="font-semibold" style={{ fill: 'var(--color-ink)' }}>
            {l.value} - {l.name}
          </text>
        );
      })}

      {/* The Courage line. */}
      <line x1={edge(courage) + 2} x2={L.noteX} y1={courage} y2={courage} strokeWidth={1.5} strokeDasharray="4 4" className="stroke-ink-mute" />
      <text x={L.noteX} y={L.noteBelow ? courage + sizes.note + 3 : courage - 4} fontSize={sizes.note} textAnchor="end" className="" style={{ fill: 'var(--color-ink-soft)' }}>
        Live above this line
      </text>

      {/* The three categories, and the app's band names under them. */}
      {CATEGORIES.map((c) => {
        const y = middle(c.from, c.to);
        return (
          <g key={c.band}>
            <Span x={L.spanX} y1={top(c.from) + 2} y2={bottom(c.to) - 2} color={c.color} />
            {/* The words in ink, so they read on the page in both themes; the colour is on the span beside them. Fill is set inline (not a
                className) so it always wins over any other rule and never picks up the span's own colour. */}
            {L.sides && (
              <>
                {lines(c.lines, L.catX, y - 6, sizes.cat, 'end', 'font-semibold', { fill: 'var(--color-ink)' })}
                <text x={L.catX} y={y + (c.lines.length * (sizes.cat + 3)) / 2 + 4} fontSize={sizes.band} textAnchor="end" className="" style={{ fill: 'var(--color-ink-soft)' }}>
                  {MAP_BAND_META[c.band].name}
                </text>
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/**
 * The map's picture: the whole scale of consciousness, drawn the way the chart it comes from draws it. On the
 * left, who you take yourself to be and where that is; in the middle, a funnel of the dimensions, widest at the
 * top; beside it every level with its number, from Full Consciousness at 1000 down to Shame at 20; on the
 * right, the three categories, with the app's band names under them; and the Courage line. Placements are still
 * picked by name. It fits its column: the whole chart when there is room, and on a phone the narrow layout,
 * never a sideways scroll.
 */
export function ConsciousnessMap() {
  const box = useRef<HTMLElement>(null);
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.innerWidth < 600);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const check = () => setNarrow(el.clientWidth < 560);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    // Set apart from the lines around it: a line above and below, with room, so the heading never runs into the chat.
    <figure ref={box} className="mx-0 my-md border-y-2 border-line py-md">
      <p className="m-0 text-left text-title2 font-medium uppercase tracking-[0.08em] md:text-center">Consciousness</p>
      <p className="mt-xs m-0 text-left text-callout md:text-center">7 ways to move up the scale of consciousness</p>
      <div className="mt-sm">
        <ScaleDrawing L={narrow ? NARROW : WIDE} />
      </div>
      {narrow && (
        // On a phone the three categories are a legend under the picture, matched to the coloured spans at its right edge.
        <ul className="mt-sm m-0 flex list-none flex-col gap-xs p-0">
          {CATEGORIES.map((c) => (
            <li key={c.band} className="flex items-center gap-sm text-subhead">
              <span aria-hidden="true" className="h-[16px] w-[4px] shrink-0 rounded-pill" style={{ background: c.color }} />
              <span>
                {c.lines.join(' ')} <span className="text-ink-soft">({MAP_BAND_META[c.band].name})</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </figure>
  );
}

/** Core and floor per relationship as one bar each on the 20 to 540 scale, names only, never numbers. */
export function PlacementChart({ placements, focus = [], away = [], compact = false }: { placements: Placement[]; focus?: RelationshipKey[]; /** Pillars set aside as not part of life right now: named, without a bar. */ away?: RelationshipKey[]; compact?: boolean }) {
  const pct = (v: number) => ((v - 20) / (540 - 20)) * 100;
  return (
    <ul className="m-0 flex list-none flex-col gap-xs p-0">
      {placements.map((p) => {
        const rel = RELATIONSHIP_BY_KEY[p.relationship];
        const f = placementFlags(p);
        const left = pct(f.floor);
        const width = Math.max(2, pct(f.core) - left);
        const inFocus = focus.includes(p.relationship);
        if (away.includes(p.relationship))
          return (
            <li key={p.relationship} className="flex items-center gap-sm rounded-tile bg-card p-sm shadow-toy-soft">
              <Avatar relationship={rel.key} size={28} decorative still />
              <span className="min-w-0 flex-1 text-subhead font-semibold">{rel.name}</span>
              <span className="text-caption text-ink-soft">Set aside for now</span>
            </li>
          );
        return (
          <li key={p.relationship} className={`rounded-tile bg-card p-sm shadow-toy-soft ${inFocus ? 'ring-2 ring-ink' : ''}`}>
            <div className="flex items-center gap-sm">
              <Avatar relationship={rel.key} size={28} decorative still />
              <span className="min-w-0 flex-1 text-subhead">
                {rel.name}
                {inFocus ? <span className="text-ink-soft"> · focus</span> : null}
              </span>
              <span className="text-caption text-ink-soft">
                {levelByValue(f.floor)?.name} to {levelByValue(f.core)?.name}
              </span>
            </div>
            <div className="relative mt-xs h-[8px] rounded-pill bg-line" aria-hidden="true">
              <span className="absolute top-0 h-full w-px bg-ink-mute" style={{ left: `${pct(COURAGE)}%` }} />
              <span className="absolute top-0 h-full rounded-pill" style={{ left: `${left}%`, width: `${width}%`, background: rel.color }} />
            </div>
            {!compact && (f.required || f.volatile || f.capped) && (
              <p className="mt-xs m-0 text-caption text-ink-soft">
                {[f.required && 'The floor is under Courage: a good place to start.', f.volatile && 'A big drop under stress, so check it each week.', f.capped && 'Held at Acceptance until you can show more.'].filter(Boolean).join(' ')}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** One line for a pillar page: where it usually lives, where it drops, and what that means. */
export function placementLine(p: Placement, away = false): string {
  if (away) return 'Set aside: not part of your life right now. It sits at Neutrality until you turn it back on in your life map.';
  const f = placementFlags(p);
  const core = levelByValue(f.core)?.name ?? '';
  const floor = levelByValue(f.floor)?.name ?? '';
  const base = f.core === f.floor ? `On the map you live at ${core} and hold it under stress.` : `On the map you live at ${core} and drop to ${floor} under stress.`;
  const extra = [f.required && 'That floor is under Courage, so it is a good place to start.', f.volatile && 'The drop is big, so check it each week.', f.capped && 'Held at Acceptance until you can show more.'].filter(Boolean).join(' ');
  return extra ? `${base} ${extra}` : base;
}

/** One scorecard row in stars, as it was rated: a score out of ten is two points a star. */
export function ScoreRow({ label, value, color }: { label: string; value: number | undefined; color: string }) {
  const stars = value === undefined ? null : starsOf(value);
  return (
    <li className="flex items-center justify-between gap-sm rounded-tile bg-card p-sm shadow-toy-soft">
      <span className="min-w-0 flex-1 text-subhead font-semibold">{label}</span>
      <span className="flex shrink-0 items-center gap-[2px]" role="img" aria-label={`${label}: ${stars === null ? 'not rated' : `${stars} of 5 stars, ${STAR_WORDS[Math.max(0, stars - 1)]?.toLowerCase()}`}`}>
        {[1, 2, 3, 4, 5].map((n) => (
          <svg key={n} viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path d="M12 2.8l2.8 5.7 6.3.9-4.6 4.4 1.1 6.2L12 17.1 6.4 20l1.1-6.2-4.6-4.4 6.3-.9z" strokeWidth="1.8" strokeLinejoin="round" style={stars !== null && n <= stars ? { fill: color, stroke: color } : { fill: 'none', stroke: 'var(--color-ink-mute)' }} />
          </svg>
        ))}
      </span>
    </li>
  );
}
