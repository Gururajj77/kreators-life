/**
 * The guard on Workers Free (the founder, 2026-11-07: the app stays on the free plan). There, one invocation may make 50 D1 queries and a
 * `db.batch()` counts as one; the 51st fails. So a route or a cron tick has to stay under 50 round trips, and the smoke suite fails past 45.
 *
 * Switched on by one Worker variable, `D1_GUARD`, which blueprint.sh and the test server set and production never does. Off, index.ts looks
 * at that one property and calls straight through, so this file costs nothing. On, the env's D1 binding is wrapped for the one invocation,
 * and the answer says what it cost:
 *   X-D1-Round-Trips    each first, all, run, raw, exec and batch is one
 *   X-D1-Rows-Read      D1's own `meta.rows_read`, added up
 *   X-D1-Rows-Written   D1's own `meta.rows_written`, added up
 *   X-D1-Last-Tick      the last cron tick's numbers as JSON, on every answer, since /__scheduled answers before anything can read it
 */

export interface D1Tally {
  trips: number;
  rowsRead: number;
  rowsWritten: number;
}

export const newTally = (): D1Tally => ({ trips: 0, rowsRead: 0, rowsWritten: 0 });

function addMeta(tally: D1Tally, meta: unknown): void {
  const m = (meta ?? {}) as { rows_read?: unknown; rows_written?: unknown };
  if (typeof m.rows_read === 'number') tally.rowsRead += m.rows_read;
  if (typeof m.rows_written === 'number') tally.rowsWritten += m.rows_written;
}

/** A statement that counts itself. `first` is sent as `all`, which is what D1 does with it anyway, because `first` hands back no meta. */
class CountedStatement {
  constructor(
    readonly inner: D1PreparedStatement,
    private readonly tally: D1Tally,
  ) {}
  bind(...values: unknown[]): CountedStatement {
    return new CountedStatement(this.inner.bind(...values), this.tally);
  }
  async first<T>(column?: string): Promise<T | null> {
    this.tally.trips += 1;
    const res = await this.inner.all<Record<string, unknown>>();
    addMeta(this.tally, res.meta);
    const row = res.results[0];
    if (!row) return null;
    return (column === undefined ? row : row[column]) as T;
  }
  async all<T>(): Promise<D1Result<T>> {
    this.tally.trips += 1;
    const res = await this.inner.all<T>();
    addMeta(this.tally, res.meta);
    return res;
  }
  async run<T>(): Promise<D1Result<T>> {
    this.tally.trips += 1;
    const res = await this.inner.run<T>();
    addMeta(this.tally, res.meta);
    return res;
  }
  async raw<T>(options?: { columnNames?: boolean }): Promise<unknown> {
    this.tally.trips += 1;
    return options?.columnNames ? this.inner.raw<T>({ columnNames: true }) : this.inner.raw<T>();
  }
}

/** The binding, counting every round trip into `tally`. */
export function countingD1(db: D1Database, tally: D1Tally): D1Database {
  const counted = {
    prepare: (sql: string) => new CountedStatement(db.prepare(sql), tally),
    async batch(stmts: readonly unknown[]) {
      tally.trips += 1;
      const res = await db.batch(stmts.map((s) => (s instanceof CountedStatement ? s.inner : (s as D1PreparedStatement))));
      for (const r of res) addMeta(tally, r.meta);
      return res;
    },
    async exec(sql: string) {
      tally.trips += 1;
      return db.exec(sql);
    },
    dump: () => (db as unknown as { dump: () => Promise<ArrayBuffer> }).dump(),
    withSession: () => counted,
  };
  return counted as unknown as D1Database;
}

/** The last tick's numbers: a Worker in dev keeps one isolate, so the next answer can carry them. */
let lastTick: (D1Tally & { at: string; cron: string; result?: unknown }) | null = null;
export const noteTick = (tally: D1Tally, cron: string, result?: unknown): void => {
  lastTick = { ...tally, at: new Date().toISOString(), cron, result };
};

/**
 * One fetch under the guard: a wrapped env, every waitUntil waited for (so a log line written after the answer is counted), then the headers.
 * Only ever runs with D1_GUARD set.
 */
export async function guardedFetch<E extends { DB: D1Database }>(req: Request, env: E, ctx: ExecutionContext, handler: (req: Request, env: E, ctx: ExecutionContext) => Promise<Response>): Promise<Response> {
  const tally = newTally();
  const pending: Promise<unknown>[] = [];
  const res = await handler(req, { ...env, DB: countingD1(env.DB, tally) }, {
    waitUntil: (p: Promise<unknown>) => {
      pending.push(p);
      ctx.waitUntil(p);
    },
    passThroughOnException: () => ctx.passThroughOnException(),
    props: (ctx as unknown as { props?: unknown }).props,
  } as unknown as ExecutionContext);
  await Promise.allSettled(pending);
  const out = new Response(res.body, res);
  out.headers.set('X-D1-Round-Trips', String(tally.trips));
  out.headers.set('X-D1-Rows-Read', String(tally.rowsRead));
  out.headers.set('X-D1-Rows-Written', String(tally.rowsWritten));
  if (lastTick) out.headers.set('X-D1-Last-Tick', JSON.stringify(lastTick));
  return out;
}
