import type { D1Tally } from './d1Guard';

/**
 * A cron tick's budget on Workers Free (the founder, 2026-11-07). One invocation may make 50 D1 queries and has 10 ms of CPU, so a tick can never do
 * everything that might be due. It spends at most `TICK_TRIPS` round trips and calls out of the Worker; what it did not reach is still due and goes
 * on the next tick, fifteen minutes on.
 *
 * How jobs share it. Every job first reads what it has to do, all together, so that is one or two trips (`batchedReads`). A job with nothing to do
 * is finished and takes no part. The rest take turns, one at a time: the `first` jobs up front (the security alerts, and event reminders, which are worth nothing once the event
 * starts), each with up to half of what is left, and the others in an order that moves on by one each tick, so each job is at the front in its turn. Those get an equal part of what
 * is left (`left / jobs still waiting`), or `need` trips if they cannot do one piece of work with less and that much is left; what a job does not use passes to the jobs after it.
 * So no job can starve the next.
 *
 * Every job must leave nothing half done: what it sends in one batch is one transaction, what is sent is marked in that same batch, and the read
 * at the top of the next tick leaves out what was sent. A job that had to leave work says so (`more`). For a `timed` job that widens the reminders' hour; for an `hourly` one it
 * brings the hourly jobs back on the next tick (see cron.ts); any other job simply runs again next tick.
 */
export const TICK_TRIPS = 38;
/**
 * And of work: the most statements a tick sends. Trips alone would let it build a thousand statements, and on Free it has 10 ms of CPU. One statement costs about 16 microseconds
 * of JavaScript on a Mac, so this is about 6 ms there (a Mac is not a Worker, so it leaves room). Shared out the same way as the trips.
 */
export const TICK_STATEMENTS = 400;
/** Statements in one trip, as `inBatches`. */
const PER_TRIP = 50;

export interface Share {
  /** Round trips this job may still use. */
  left(): number;
  /** As many of these as fit in what is left, at `perItem` statements each. Says so when some have to wait. */
  fit<T>(items: readonly T[], perItem: number): T[];
  /** Statements fifty to a trip, stopping when the share is spent (the answer is then shorter than what was given). */
  send<T = unknown>(stmts: readonly D1PreparedStatement[]): Promise<D1Result<T>[]>;
  /** One call out of the Worker: on the free plan those count against the same fifty, as far as anyone can tell. */
  outbound(): void;
  /** Some work had to wait for the next tick. */
  more(): void;
}

/** Wait for this job's turn. `need` is the least it can do one piece of work with (an Agency month is about twenty trips). */
export type Turn = (need?: number) => Promise<Share>;

/** For a route that calls a job for one person, outside any tick: no limit, and nothing to wait for. */
export function openTurn(db: D1Database): Turn {
  const share: Share = {
    left: () => Number.POSITIVE_INFINITY,
    fit: (items) => [...items],
    send: async <T>(stmts: readonly D1PreparedStatement[]) => {
      const out: D1Result<T>[] = [];
      for (let i = 0; i < stmts.length; i += PER_TRIP) out.push(...(await db.batch<T>(stmts.slice(i, i + PER_TRIP))));
      return out;
    },
    outbound: () => undefined,
    more: () => undefined,
  };
  return async () => share;
}

/** For a route that runs a job and must stop in time: the rest waits for the next tick, which runs the same job. `sofar` says how many round trips the invocation has made. */
export function routeTurn(db: D1Database, sofar: () => number, limit: number): Turn {
  const open = openTurn(db);
  return async (need) => {
    const base = await open(need);
    const left = () => Math.max(0, limit - sofar());
    return {
      ...base,
      left,
      fit: <T>(items: readonly T[], perItem: number) => items.slice(0, Math.floor((left() * PER_TRIP) / perItem)),
      send: async <T>(stmts: readonly D1PreparedStatement[]) => {
        const out: D1Result<T>[] = [];
        for (let i = 0; i < stmts.length && left() > 0; i += PER_TRIP) out.push(...(await db.batch<T>(stmts.slice(i, i + PER_TRIP))));
        return out;
      },
    };
  };
}

export interface Job {
  name: string;
  /** Goes before the turns that move, with up to half of what is left: the security alerts and event reminders. */
  first?: boolean;
  /** Holds a reminder with an hour to go in: what it leaves widens that hour. */
  timed?: boolean;
  /** Runs only on the first tick of the hour, unless one of these left work. */
  hourly?: boolean;
  /** An hourly job on a tick that is not the hour's first, there only because one of them left work: it takes what the others leave, so a backlog never makes a reminder late. */
  spare?: boolean;
  run: (turn: Turn) => Promise<number>;
}

interface InLine {
  job: Job;
  order: number;
  need: number;
  go: (share: Share) => void;
}

export class Tick {
  /** A reminder job left work for the next tick. */
  behind = false;
  /** An hourly job left work, so they run again on the next tick, not in an hour. */
  hourlyLeft = false;
  /** What went wrong, one line a job: a failed job never stops the others. */
  readonly errors: string[] = [];
  private fetches = 0;
  private statements = 0;

  constructor(
    readonly db: D1Database,
    private readonly tally: D1Tally,
    private readonly limit: number,
    /** Which job is at the front this tick: moves on by one each tick (the tick's number, from the clock, so nothing is stored). */
    private readonly rotor: number,
  ) {}

  used(): number {
    return this.tally.trips + this.fetches;
  }
  left(): number {
    return Math.max(0, this.limit - this.used());
  }

  private shareOf(job: Job, trips: number, statements: number): Share {
    const end = this.used() + trips;
    const left = () => Math.max(0, end - this.used());
    const stop = this.statements + statements;
    const leaving = () => {
      if (job.timed) this.behind = true;
      if (job.hourly) this.hourlyLeft = true;
    };
    return {
      left,
      fit: <T>(items: readonly T[], perItem: number): T[] => {
        const room = Math.floor(Math.min(left() * PER_TRIP, Math.max(0, stop - this.statements)) / perItem);
        if (room >= items.length) return [...items];
        leaving();
        return items.slice(0, room);
      },
      send: async <T>(stmts: readonly D1PreparedStatement[]) => {
        const out: D1Result<T>[] = [];
        for (let i = 0; i < stmts.length; i += PER_TRIP) {
          if (left() <= 0) {
            leaving();
            break;
          }
          const part = stmts.slice(i, i + PER_TRIP);
          this.statements += part.length;
          out.push(...(await this.db.batch<T>(part)));
        }
        return out;
      },
      outbound: () => {
        this.fetches += 1;
      },
      more: leaving,
    };
  }

  /** Runs the jobs: all reading at once, then one at a time. Answers how much each did. */
  async run(jobs: readonly Job[]): Promise<Record<string, number>> {
    const done: Record<string, number> = {};
    const count = jobs.length;
    let reading = count;
    let busy = false;
    const line: InLine[] = [];
    const next = () => {
      if (busy || reading > 0 || line.length === 0) return;
      line.sort((a, b) => a.order - b.order);
      const head = line.shift()!;
      busy = true;
      const room = this.left();
      const parts = head.job.first ? Math.min(2, line.length + 1) : head.job.spare ? line.length + 1 : line.filter((x) => !x.job.spare).length + 1;
      head.go(this.shareOf(head.job, Math.max(Math.floor(room / parts), Math.min(head.need, room)), Math.floor(Math.max(0, TICK_STATEMENTS - this.statements) / parts)));
    };
    await Promise.all(
      jobs.map(async (job, i) => {
        let inTurn = false;
        const turn: Turn = (need = 1) =>
          new Promise((go) => {
            inTurn = true;
            reading -= 1;
            line.push({ job, order: job.first ? i - count : (job.spare ? count : 0) + (i + count - (this.rotor % count)) % count, need, go });
            next();
          });
        try {
          done[job.name] = await job.run(turn);
        } catch (e) {
          done[job.name] = 0;
          this.errors.push(`${job.name}: ${e instanceof Error ? `${e.name}: ${e.message}` : String(e)}`.slice(0, 120));
        }
        if (inTurn) busy = false;
        else reading -= 1;
        next();
      }),
    );
    return done;
  }
}
