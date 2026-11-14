import { describe, expect, it } from 'vitest';
import { dataTableByKey, parseTableQuery, tableSql, type TableSqlContext } from './dataTables';

// The review of 2026-11-14: AI chat's read of the Companion chat table leaves out every answer the server's one rule holds back (`heldBack` in
// apps/api/src/aiOpen.ts, worked out as `{aiHeld}`), from the page, the count and a search alike, so an answer that quoted the journal never
// reaches a model once Journal entries is shut. The person's own lines and the screen's read stay whole.

const ctx: TableSqlContext = { view: 'owner', ownerId: 'u1', viewerId: 'u1', today: '2026-11-14', zone: 'Asia/Kolkata' };

describe('Companion chat to AI chat', () => {
  it('leaves out the held answers from the page, the count and a search, and only for AI chat', async () => {
    const { DatabaseSync } = await import('node:sqlite');
    const db = new DatabaseSync(':memory:');
    db.exec(`CREATE TABLE chat_messages (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, role TEXT NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL, model TEXT NOT NULL DEFAULT '');
      INSERT INTO chat_messages (id, user_id, role, body, created_at, model) VALUES
        ('m1', 'u1', 'user', 'What did I write?', '2026-11-14T01:00:00Z', ''),
        ('m2', 'u1', 'assistant', 'You wrote about the quiet lake.', '2026-11-14T01:00:01Z', 'xing#reads:journal'),
        ('m3', 'u1', 'assistant', 'Two tasks are left today.', '2026-11-14T01:00:02Z', 'xing#reads:tasks'),
        ('m4', 'u1', 'assistant', 'An older answer about the lake.', '2026-11-14T01:00:03Z', 'xing'),
        ('m5', 'u1', 'assistant', 'Take a short walk.', '2026-11-14T01:00:04Z', 'local'),
        ('m6', 'u2', 'assistant', 'Someone else.', '2026-11-14T01:00:05Z', 'xing#reads:journal');`);
    const t = dataTableByKey.companionChat!;
    const run = (more: Partial<TableSqlContext>, q: Record<string, string> = {}) => {
      const s = tableSql(t, parseTableQuery(t, { count: '1', ...q }), { ...ctx, ...more });
      const named = (sql: string, binds: readonly unknown[]) => ({ sql: sql.replace(/\?(\d+)/g, '@p$1'), args: Object.fromEntries(binds.map((v, i) => [`p${i + 1}`, v as string | number])) });
      const r = named(s.sql, s.binds);
      const n = named(s.countSql!, s.countBinds);
      return { ids: (db.prepare(r.sql).all(r.args) as { _id: string }[]).map((x) => x._id).sort(), total: (db.prepare(n.sql).get(n.args) as { n: number }).n };
    };
    const held = ['xing#reads:journal', 'xing'];
    // The screen (no AI chat) sees every line of its own, whatever is held.
    expect(run({ aiHeld: held })).toEqual({ ids: ['m1', 'm2', 'm3', 'm4', 'm5'], total: 5 });
    // AI chat with nothing held reads the same.
    expect(run({ ai: true })).toEqual({ ids: ['m1', 'm2', 'm3', 'm4', 'm5'], total: 5 });
    // AI chat with Journal entries shut: the answer that read it and the older one that does not say are gone from the page and the count.
    expect(run({ ai: true, aiHeld: held })).toEqual({ ids: ['m1', 'm3', 'm5'], total: 3 });
    // And a search never finds a held answer by its words.
    expect(run({ ai: true, aiHeld: held }, { q: 'lake' })).toEqual({ ids: [], total: 0 });
    expect(run({ ai: true }, { q: 'lake' })).toEqual({ ids: ['m2', 'm4'], total: 2 });
    db.close();
  });
});
