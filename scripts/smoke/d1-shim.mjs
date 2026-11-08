// A D1 binding over node:sqlite, for measuring only: counts round trips and statements, and can be held to the platform's limit (the next call throws, as D1 does on the free plan).
// It runs no Worker and touches no server's database. cron-stress.mjs uses it.
import { DatabaseSync } from 'node:sqlite';

export function makeD1(path) {
  const db = new DatabaseSync(path, { enableForeignKeyConstraints: false });
  db.exec('PRAGMA journal_mode = MEMORY; PRAGMA synchronous = OFF;');
  const stats = { trips: 0, statements: 0, sqlMs: 0, limit: Infinity };
  const trip = () => {
    stats.trips += 1;
    if (stats.trips > stats.limit) throw new Error('Too many API requests by single Worker invocation');
  };
  const norm = (a) => a.map((v) => (v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : v));
  function exec1(sql, args) {
    const t = process.hrtime.bigint();
    let run = sql;
    const bound = norm(args);
    let named = null;
    if (/\?\d/.test(sql)) {
      const used = new Set();
      run = sql.replace(/\?(\d+)/g, (_, n) => {
        used.add(Number(n));
        return `@p${n}`;
      });
      named = {};
      for (const n of used) named[`p${n}`] = bound[n - 1] ?? null;
    }
    const st = db.prepare(run);
    const reads = /^\s*(SELECT|WITH)/i.test(sql) || /\bRETURNING\b/i.test(sql);
    let out;
    if (reads) {
      const rows = named ? st.all(named) : st.all(...bound);
      out = { results: rows, success: true, meta: { changes: 0, rows_read: rows.length } };
    } else {
      const r = named ? st.run(named) : st.run(...bound);
      out = { results: [], success: true, meta: { changes: Number(r.changes) } };
    }
    stats.sqlMs += Number(process.hrtime.bigint() - t) / 1e6;
    stats.statements += 1;
    return out;
  }
  class Stmt {
    constructor(sql, args = []) {
      this.sql = sql;
      this.args = args;
    }
    bind(...a) {
      return new Stmt(this.sql, a);
    }
    async all() {
      trip();
      return exec1(this.sql, this.args);
    }
    async run() {
      trip();
      return exec1(this.sql, this.args);
    }
    async first(col) {
      trip();
      const r = exec1(this.sql, this.args).results[0] ?? null;
      return col && r ? r[col] : r;
    }
    async raw() {
      trip();
      return exec1(this.sql, this.args).results.map((r) => Object.values(r));
    }
  }
  return {
    raw: db,
    stats,
    prepare: (sql) => new Stmt(sql),
    async batch(list) {
      trip();
      db.exec('BEGIN');
      try {
        const out = list.map((s) => exec1(s.sql, s.args));
        db.exec('COMMIT');
        return out;
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
    async exec(sql) {
      trip();
      db.exec(sql);
      return { count: 1, duration: 0 };
    },
    withSession() {
      return this;
    },
  };
}
