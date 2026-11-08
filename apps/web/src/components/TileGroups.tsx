import { useId, type ReactNode } from 'react';
import { evenGrid, evenTile, type EvenAt, type EvenCols } from '../lib/bento';

/** Past this many tiles in one block they go in categories (the founder, 2026-11-07: "whenever there are more than 10-12"). */
export const TILE_BLOCK_MAX = 10;

export interface TileGroup<T> {
  key: string;
  /** The category's name, in the quiet eyebrow over its tiles. */
  name: string;
  tiles: readonly T[];
}

/** The screen steps the side-by-side line can use, widest last; app.css lists the classes for each (`@source inline`). */
const STEPS: readonly Exclude<EvenAt, 'base'>[] = ['sm', 'md', 'lg', 'xl', '@lg', '@3xl'];
const PREFIX: Record<Exclude<EvenAt, 'base'>, string> = { sm: 'sm:', md: 'md:', lg: 'lg:', xl: 'xl:', '@lg': '@lg:', '@3xl': '@3xl:' };

/** The widest step and its column count; none when the grid has one column at every width. */
function widest(cols: EvenCols): { prefix: string; n: number } | null {
  for (const at of [...STEPS].reverse()) {
    const n = cols[at];
    if (n) return { prefix: PREFIX[at], n };
  }
  return null;
}

/**
 * Short categories side by side at the grid's widest step, so a category of one tile never takes a whole row beside rows of four: while the
 * next one still fits the columns it joins the line, and each takes its tile count of them, so every tile on that line is one width. On a
 * smaller screen they stack, and each keeps its own even rows.
 */
function linesOf<T>(groups: readonly TileGroup<T>[], most: number): TileGroup<T>[][] {
  const lines: TileGroup<T>[][] = [];
  for (const g of groups) {
    const last = lines[lines.length - 1];
    const used = last?.reduce((n, x) => n + x.tiles.length, 0) ?? 0;
    if (last && used + g.tiles.length <= most) last.push(g);
    else lines.push([g]);
  }
  return lines;
}

/**
 * Tiles in categories once a block has more than `TILE_BLOCK_MAX`, so a long wall of numbers reads in parts: a category's name, then its tiles
 * in their own even rows (lib/bento.ts). A category with nothing to show goes, so a heading never stands alone. At or under the limit it is the
 * one even block it always was, in the order `flat` gives (else the categories' order).
 *
 * `render` gets one tile and its span classes, for the grid's direct child (a `StatTile` or an `li`, which sets its own key). `list` makes each grid a `ul`.
 * `whole` keeps one small block in one piece past the limit, and says why (Home's By period alone, the founder, 2026-11-07: thirteen tiles under seven headings ran longer than the tiles); the limit stays ten for every other block.
 */
export function TileGroups<T>({
  groups,
  flat,
  cols,
  render,
  gap = 'gap-xs',
  list = false,
  whole,
  className = '',
}: {
  groups: readonly TileGroup<T>[];
  flat?: readonly T[];
  cols: EvenCols;
  render: (tile: T, className: string, index: number) => ReactNode;
  gap?: 'gap-xs' | 'gap-sm';
  list?: boolean;
  whole?: string;
  className?: string;
}) {
  const shown = groups.filter((g) => g.tiles.length > 0);
  const total = shown.reduce((n, g) => n + g.tiles.length, 0);
  const grid = (tiles: readonly T[], extra = '') => {
    const cls = `grid ${gap} ${list ? 'list-none p-0 m-0' : ''} ${evenGrid(tiles.length, cols)} ${extra}`;
    const body = tiles.map((t, i) => render(t, evenTile(i, tiles.length, cols), i));
    return list ? <ul className={cls}>{body}</ul> : <div className={cls}>{body}</div>;
  };
  if (whole || total <= TILE_BLOCK_MAX) return <div className={className} data-tile-list={whole}>{grid(flat ?? shown.flatMap((g) => [...g.tiles]))}</div>;
  const step = widest(cols);
  return (
    <div className={`flex flex-col gap-md ${className}`}>
      {(step ? linesOf(shown, step.n) : shown.map((g) => [g])).map((line) => {
        if (line.length === 1) return <Category key={line[0]!.key} name={line[0]!.name} grid={grid(line[0]!.tiles)} />;
        const across = line.reduce((n, g) => n + g.tiles.length, 0);
        return (
          <div key={line.map((g) => g.key).join('-')} className={`grid ${gap} gap-y-md grid-cols-1 ${step!.prefix}grid-cols-${across}`}>
            {line.map((g) => (
              <Category key={g.key} name={g.name} className={`${step!.prefix}col-span-${g.tiles.length}`} grid={grid(g.tiles, 'flex-1')} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function Category({ name, grid, className = '' }: { name: string; grid: ReactNode; className?: string }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={`flex min-w-0 flex-col ${className}`} data-tile-group={name}>
      <h3 id={id} className="m-0 mb-xs text-eyebrow uppercase text-ink-soft break-after-avoid">
        {name}
      </h3>
      {grid}
    </section>
  );
}
