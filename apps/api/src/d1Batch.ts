/**
 * Reads that do not wait for each other go out as one `db.batch`, on every request and every cron tick. On Workers Free one invocation may make
 * 50 D1 queries, a batch counts as one, and a screen's reads are mostly `Promise.all` of statements that know nothing of each other. So instead
 * of each route building its own batch, the binding gathers every read made in one turn of the event loop (index.ts wraps it once per
 * invocation). A route still writes `await db.prepare(...).first()`, and what comes back is exactly what it would have got.
 *
 * Only a SELECT waits. A write, a `raw` and a caller's own `batch` go at once, after sending what was gathered first, so nothing changes order.
 * A batch is one transaction and a failed statement takes the rest with it, so when a batch fails each read is sent again alone and only the
 * one that is really at fault fails its own caller. A batch that fails costs more trips, but only on the way to an error.
 */

/** The most reads in one trip. D1 caps a batch by size only; the same number as `inBatches`, so one slow read never holds many hundreds. */
const MAX_READS = 50;

const WRITES = /\b(?:INSERT|UPDATE|DELETE|REPLACE)\b/i;
/** A statement that cannot change anything: a SELECT, or a WITH that holds no write. */
function isRead(sql: string): boolean {
  const start = sql.trimStart().slice(0, 6).toUpperCase();
  return start === 'SELECT' || (start.startsWith('WITH') && !WRITES.test(sql));
}

interface Waiting {
  stmt: D1PreparedStatement;
  resolve: (res: D1Result<unknown>) => void;
  reject: (err: unknown) => void;
}

class Gatherer {
  private waiting: Waiting[] = [];
  private armed = false;
  /** Round trips this invocation has made. */
  trips = 0;
  constructor(readonly db: D1Database) {}

  /** Keeps a read for this turn of the event loop. A timer, not a microtask: a screen's next wave of reads takes several microtasks to appear. */
  read(stmt: D1PreparedStatement): Promise<D1Result<unknown>> {
    return new Promise((resolve, reject) => {
      this.waiting.push({ stmt, resolve, reject });
      if (!this.armed) {
        this.armed = true;
        setTimeout(() => this.send(), 0);
      }
    });
  }

  /** Sends what was gathered. Called by the timer, and first of all by anything that goes at once, so it never overtakes an earlier read. */
  send(): void {
    this.armed = false;
    const reads = this.waiting;
    if (reads.length === 0) return;
    this.waiting = [];
    for (let i = 0; i < reads.length; i += MAX_READS) this.trip(reads.slice(i, i + MAX_READS));
  }

  private trip(part: Waiting[]): void {
    this.trips += 1;
    const alone = (w: Waiting) => void w.stmt.all().then(w.resolve, w.reject);
    if (part.length === 1) return alone(part[0]!);
    this.db.batch(part.map((w) => w.stmt)).then(
      (res) => part.forEach((w, i) => w.resolve(res[i]!)),
      () => {
        this.trips += part.length;
        part.forEach(alone);
      },
    );
  }

  /** A write, or anything else that goes at once. */
  now(): void {
    this.send();
    this.trips += 1;
  }
}

class GatheredStatement {
  constructor(
    readonly inner: D1PreparedStatement,
    private readonly isRead: boolean,
    private readonly gather: Gatherer,
  ) {}
  bind(...values: unknown[]): GatheredStatement {
    return new GatheredStatement(this.inner.bind(...values), this.isRead, this.gather);
  }
  async first<T>(column?: string): Promise<T | null> {
    if (!this.isRead) {
      this.gather.now();
      return column === undefined ? this.inner.first<T>() : this.inner.first<T>(column);
    }
    const res = await this.gather.read(this.inner);
    const row = res.results[0] as Record<string, unknown> | undefined;
    if (!row) return null;
    return (column === undefined ? row : row[column]) as T;
  }
  all<T>(): Promise<D1Result<T>> {
    if (this.isRead) return this.gather.read(this.inner) as Promise<D1Result<T>>;
    this.gather.now();
    return this.inner.all<T>();
  }
  run<T>(): Promise<D1Result<T>> {
    this.gather.now();
    return this.inner.run<T>();
  }
  raw<T>(options?: { columnNames?: boolean }): Promise<unknown> {
    this.gather.now();
    return options?.columnNames ? this.inner.raw<T>({ columnNames: true }) : this.inner.raw<T>();
  }
}

/** The binding for one invocation, with its reads gathered. Never kept past it: a D1 call belongs to the request that made it. */
export function batchedReads(db: D1Database): D1Database {
  const gather = new Gatherer(db);
  const batched = {
    prepare: (sql: string) => new GatheredStatement(db.prepare(sql), isRead(sql), gather),
    batch(stmts: readonly unknown[]) {
      gather.now();
      return db.batch(stmts.map((s) => (s instanceof GatheredStatement ? s.inner : (s as D1PreparedStatement))));
    },
    exec(sql: string) {
      gather.now();
      return db.exec(sql);
    },
    /** Round trips so far in this invocation: `tripsOf` below. */
    tripsSoFar: () => gather.trips,
    dump: () => (db as unknown as { dump: () => Promise<ArrayBuffer> }).dump(),
    withSession: () => batched,
  };
  return batched as unknown as D1Database;
}

/**
 * Round trips this invocation has made so far, for a route whose work can grow past what one invocation may do on the free plan (the assistant's tools, a cancel for six hundred
 * guests). It stops while it can still answer. Zero on a binding that was not wrapped.
 */
export const tripsOf = (db: D1Database): number => (db as unknown as { tripsSoFar?: () => number }).tripsSoFar?.() ?? 0;

/** The most round trips a route that checks lets itself reach, leaving room to answer, under the check's 45 and the platform's 50. */
export const ROUTE_TRIPS = 40;
