/**
 * Bento spans, so a grid of tiles never ends in a lone tile. Given how many tiles there are and how many columns the grid has, the first
 * tiles (the ones that matter most) take two columns until the last row is full. Placing is worked out the way the grid does it, so a wide tile
 * never leaves a hole behind it.
 */
export function bentoSpans(count: number, cols: number): number[] {
  if (count <= 0 || cols < 2) return Array.from({ length: Math.max(0, count) }, () => 1);
  let extra = (cols - (count % cols)) % cols;
  const spans: number[] = [];
  let at = 0;
  for (let i = 0; i < count; i += 1) {
    let span = 1;
    if (extra > 0 && at + 2 <= cols) {
      span = 2;
      extra -= 1;
    }
    at += span;
    if (at >= cols) at = 0;
    spans.push(span);
  }
  // Anything that could not be spread (a row that cannot take a wide tile) goes to the last tile.
  if (at !== 0 && spans.length > 0) spans[spans.length - 1]! += cols - at;
  return spans;
}

// Tailwind reads class names as written, so every one is spelled out.
const BASE = ['', 'col-span-1', 'col-span-2', 'col-span-3', 'col-span-4', 'col-span-5', 'col-span-6'];
const WIDE = ['', 'md:col-span-1', 'md:col-span-2', 'md:col-span-3', 'md:col-span-4', 'md:col-span-5', 'md:col-span-6'];

/** The classes for tile `i` of `count`: its span on a phone (`base` columns) and on a laptop (`wide` columns). */
export function bento(i: number, count: number, base: number, wide: number): string {
  const a = Math.min(6, bentoSpans(count, base)[i] ?? 1);
  const b = Math.min(6, bentoSpans(count, wide)[i] ?? 1);
  return `${BASE[a]} ${WIDE[b]}`;
}
