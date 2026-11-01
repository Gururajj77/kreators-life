import { RELATIONSHIPS } from '@kreators/shared';

/**
 * A relationship's fill as the theme token (`--color-r1` to `--color-r7`, in the order of the seven floors), never the hex the shared model
 * carries. The token is the one that is tuned for contrast (white text on it holds 4.5:1; orange and yellow take the dark ink through
 * `--color-on-fill`, which app.css turns for any element whose style reads var(--color-r2) or var(--color-r3)), so a fill drawn from it and
 * text in `var(--color-on-fill)` always read.
 */
/** A colour the shared model carries for one of the seven, turned into its token; any other colour is left as it is. */
export function fillFor(color: string): string {
  const r = RELATIONSHIPS.find((x) => x.color.toLowerCase() === color.toLowerCase());
  return r ? fillVar(r) : color;
}

export const fillVar = (r: { floor: number }) => `var(--color-r${r.floor})`;
/** The foreground to put on {@link fillVar}. */
export const ON_FILL = 'var(--color-on-fill)';
