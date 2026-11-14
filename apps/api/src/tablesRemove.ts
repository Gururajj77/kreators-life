import type { DataTable, RemoveCall, RemoveRecipe, TableRow } from '@kreators/shared/dataTables';
import type { Req } from './assistant/dispatch';
import type { ReadCtx } from './tablesRead';

/**
 * All tables' removes the server builds itself (2026-11-14): a route that takes a whole object, so one row's remove must send what the route
 * keeps besides it (the day's gratitude emptied sends the three lines and the version it read; a budget cleared sends every budget again). A
 * table names one with `recipe` on its RemoveCall; a plain call (a path, a fixed body, cells, the day) is `removeCallFor` in the registry and
 * needs nothing here.
 *
 * A builder gets the row as the owner's own read left it (its cells and private fields, `fields`, with the remove's rules), and answers the
 * request to send as the person, or a refusal in plain words. It may read more, owner only (`ctx.subject.id`), each read one round trip that
 * the bulk route counts; it never writes: the delegated route does, with its own checks. Add the key to `RemoveRecipe` in the registry and its
 * builder here together, and a test that builds it (dataTables.actions.test.ts reads this file for every recipe a table names).
 */

export interface RemoveRecipeArgs {
  db: D1Database;
  table: DataTable;
  call: RemoveCall;
  row: TableRow;
  fields: Record<string, unknown>;
  ctx: ReadCtx;
}
export type RemoveBuilder = (a: RemoveRecipeArgs) => Promise<Req | { error: string }>;

export const REMOVE_RECIPES: Readonly<Record<Exclude<RemoveRecipe, 'plain'>, RemoveBuilder>> = {};

/** The builder for a recipe, or undefined (a plain call, or a key with no builder: refused as "cannot be changed here"). */
export function removeBuilder(recipe: RemoveRecipe | undefined): RemoveBuilder | undefined {
  if (!recipe || recipe === 'plain') return undefined;
  return (REMOVE_RECIPES as Readonly<Partial<Record<string, RemoveBuilder>>>)[recipe];
}
