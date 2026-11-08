/**
 * Even rows, so a grid of tiles never ends in a lone tile or a ragged row (the founder, 2026-11-07: "evenly distributed to maintain full
 * widths"). The one rule: for `count` tiles in a grid of at most `cols` columns, take the fewest rows that hold them, and share the tiles
 * between those rows so two rows differ by at most one tile, the shorter rows first (the first tiles are the ones that matter most, so
 * they are the wider ones). Every tile in a row is the same width and every row reaches the grid's full width.
 *
 *   6 in 4 columns: 3 + 3.  5 in 4: 2 + 3.  7 in 4: 3 + 4.  10 in 4: 3 + 3 + 4.  4 in 3: 2 + 2.  5 in 2: 1 + 2 + 2.
 *
 * Only two columns can leave a row of one (an odd count): that tile is the lead and takes the row.
 */
export function evenRows(count: number, cols: number): number[] {
  if (count <= 0) return [];
  // All in one row when they fit (a week of seven is seven columns); past one row, at most six, so the shared tracks stay few.
  if (count <= cols) return [count];
  const c = Math.max(1, Math.min(MAX_COLS, Math.floor(cols)));
  const rows = Math.ceil(count / c);
  const small = Math.floor(count / rows);
  const big = count % rows;
  return Array.from({ length: rows }, (_, r) => (r < rows - big ? small : small + 1));
}

const MAX_COLS = 6;
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

/**
 * The grid behind `evenRows`: rows of k and k + 1 tiles share one set of tracks (k times k + 1 of them, or k when every row is full), and
 * each tile spans its row's share. So 2 + 3 tiles is six tracks, spans 3, 3, 2, 2, 2. At most 30 tracks (5 + 6 in six columns); one row
 * of seven is seven.
 */
export function evenSpans(count: number, cols: number): { tracks: number; spans: number[] } {
  const rows = evenRows(count, cols);
  const tracks = rows.reduce((l, k) => (l / gcd(l, k)) * k, 1);
  return { tracks, spans: rows.flatMap((k) => Array.from({ length: k }, () => tracks / k)) };
}

/**
 * Where a grid's column count changes: the phone (`base`), the screen steps (`sm`, and the height-aware `md` and `lg` of app.css) or,
 * for a grid inside an `@container`, that box's own steps (`@lg` is 32rem, `@3xl` 48rem). One grid uses screen steps or box steps, never both.
 */
export type EvenAt = 'base' | 'sm' | 'md' | 'lg' | 'xl' | '@lg' | '@3xl';
export type EvenCols = { base: number } & Partial<Record<Exclude<EvenAt, 'base'>, number>>;
const ORDER: readonly EvenAt[] = ['base', 'sm', 'md', 'lg', 'xl', '@lg', '@3xl'];
const PREFIX: Record<EvenAt, string> = { base: '', sm: 'sm:', md: 'md:', lg: 'lg:', xl: 'xl:', '@lg': '@lg:', '@3xl': '@3xl:' };

// The class names are built here, so app.css lists every one for Tailwind (`@source inline`, under the custom variants): grid-cols 1 to 7,
// 12, 20 and 30, and col-span 1 to 6, at each step above.
function classes(cols: EvenCols, pick: (at: number) => string): string {
  const out: string[] = [];
  let last = '';
  for (const at of ORDER) {
    const n = cols[at];
    if (!n) continue;
    const name = pick(n);
    if (name === last) continue;
    last = name;
    out.push(`${PREFIX[at]}${name}`);
  }
  return out.join(' ');
}

/** The grid's column classes for `count` tiles: `<ul className={`grid gap-sm ${evenGrid(n, { base: 2, md: 4 })}`}>`. */
export function evenGrid(count: number, cols: EvenCols): string {
  return classes(cols, (n) => `grid-cols-${evenSpans(count, n).tracks}`);
}

/** Tile `i`'s span classes in that grid, so each row is one width and reaches the full width. */
export function evenTile(i: number, count: number, cols: EvenCols): string {
  return classes(cols, (n) => `col-span-${evenSpans(count, n).spans[i] ?? 1}`);
}

/**
 * The one name for a cell's size in a `.bento` grid (app.css), so a screen says what a cell is rather than spelling its spans: a large cell
 * is two columns and two rows (the one that matters most, usually with `bento-feature`), medium two columns, wide the whole row, tall two rows
 * and small one cell. The spans only apply from the tablet width; a phone stacks every cell in one column. A hand-made bento like this must
 * still come out in full rows (scripts/smoke/bento-probe.js checks).
 */
export const BENTO_SIZE = {
  large: 'bento-w2 bento-h2',
  medium: 'bento-w2',
  wide: 'bento-w4',
  tall: 'bento-h2',
  small: '',
} as const;
