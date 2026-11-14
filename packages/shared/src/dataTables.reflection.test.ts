import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  dataTableByKey,
  editValue,
  isPastDay,
  noEditWhyOf,
  noRemoveWhyOf,
  parseTableQuery,
  plainCall,
  removeCallFor,
  removeCallOf,
  removeStateOf,
  removeWords,
  REVIEW_ANSWERS_TEXT_MAX,
  rowEditable,
  tableColumn,
  tableEditable,
  tableSql,
  type DataTable,
} from './dataTables';
import { MAX_REVIEW_PROMPTS, REVIEW_ANSWER_MAX, REVIEW_PROMPT_MAX } from './index';
import { GRATITUDE_LINE_MAX } from './gratitude';

// All tables' Edit and Delete for Reflection (2026-11-14, the founder: "all tables need to be editable ... each entry for the original user and
// not for coach, and not even ai"): Reviews, Business metrics, Body and mind, Journal, Life coaching, and Discover and AI chat. What is particular
// to these twenty-six: which columns change through which of the app's own routes, how each row goes, and the day rule of decision 6.

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const today = '2026-11-14';
const ctx = { view: 'owner' as const, ownerId: 'u1', viewerId: 'u1', today, zone: 'Asia/Kolkata' };
const t = (k: string): DataTable => dataTableByKey[k]!;
const editable = (k: string) => t(k).columns.filter((col) => col.edit).map((col) => col.key);
const col = (k: string, c: string) => tableColumn(t(k), c)!;

const REFLECTION = [
  'reviews', 'reviewReminders', 'reviewTemplates',
  'businessMetrics', 'businessMetricValues',
  'mood', 'sleep', 'stress', 'mindfulMinutes', 'movement', 'eating', 'water', 'focusSessions', 'supplements', 'supplementDays',
  'journal', 'gratitude',
  'lifeCoaches', 'coachStudents', 'coachingLog', 'studentsLog', 'coachCard',
  'discoverResults', 'discoverAddOns', 'companionChat', 'assistantChanges',
];

describe('All tables, Reflection: Edit and Delete for the owner (2026-11-14)', () => {
  it('covers every Reflection table: an edit or why not, a remove or why not', () => {
    const groups = new Set(['reviews', 'business', 'body', 'journal', 'coaching', 'selfAi']);
    const mine = Object.values(dataTableByKey).filter((x) => groups.has(x.group)).map((x) => x.key).sort();
    expect(mine).toEqual([...REFLECTION].sort());
    for (const k of REFLECTION) {
      const x = t(k);
      expect(tableEditable(x) || Boolean(x.noEditWhy), `${k} edit`).toBe(true);
      expect(Boolean(x.remove) || Boolean(x.noRemoveWhy), `${k} remove`).toBe(true);
      if (!tableEditable(x)) expect(noEditWhyOf(x), k).toMatch(/^[A-Z].*\.$/);
      if (!x.remove) expect(noRemoveWhyOf(x), k).toMatch(/^[A-Z].*\.$/);
    }
  });

  it('changes what each app lets its owner change, through its own routes', () => {
    expect(editable('reviews')).toEqual(['answers', 'rating', 'highlight']);
    expect(editable('reviewReminders')).toEqual(['kind', 'name', 'anchor', 'time', 'repeat', 'enabled']);
    expect(editable('reviewTemplates')).toEqual(['name', 'questions']);
    expect(editable('businessMetrics')).toEqual(['name', 'direction', 'cadence', 'target']);
    expect(editable('businessMetricValues')).toEqual(['value', 'note']);
    expect(editable('mood')).toEqual(['mood', 'active', 'ate', 'slept', 'note']);
    expect(editable('mindfulMinutes')).toEqual(['minutes', 'from']);
    expect(editable('movement')).toEqual(['kind', 'minutes', 'distance', 'effort', 'note']);
    expect(editable('water')).toEqual(['ml']);
    expect(editable('supplements')).toEqual(['name', 'kind', 'amount', 'time', 'days', 'paused']);
    // Records, ledgers and other people's words stay as they are.
    for (const k of ['supplementDays', 'coachStudents', 'coachingLog', 'studentsLog', 'discoverResults', 'discoverAddOns', 'companionChat', 'assistantChanges']) {
      expect(editable(k), k).toEqual([]);
      expect(t(k).noEditWhy, k).toBeTruthy();
    }
    // A review's numbers (its snapshot) are never a column, nor its questions; the edits go to PATCH /reviews/:id, never PUT /reviews.
    for (const c of t('reviews').columns) if (c.edit) expect([c.edit.method, c.edit.path], c.key).toEqual(['PATCH', '/reviews/:id']);
    expect(JSON.stringify(t('reviews'))).not.toContain('snapshot');
    const route = read('../../../apps/api/src/routes/reviews.ts');
    const patchRoute = route.slice(route.indexOf("reviews.patch('/:id'"), route.indexOf("reviews.delete('/:id'"));
    // It sets only the rating, the highlight and the answers; the questions are only its guard.
    expect([...patchRoute.matchAll(/sets\.push\('(\w+) = \?'\)/g)].map((m) => m[1])).toEqual(['rating', 'highlight', 'answers_json']);
    expect(patchRoute).not.toContain('snapshot_json');
  });

  it('removes each row the way its own app asks: a second tap for a small personal row, a sheet for history or someone else’s access', () => {
    const asks: Record<string, 'twice' | 'sheet'> = {
      reviews: 'sheet', reviewReminders: 'twice', reviewTemplates: 'twice', businessMetrics: 'sheet', businessMetricValues: 'twice',
      mood: 'twice', sleep: 'twice', stress: 'twice', mindfulMinutes: 'twice', movement: 'twice', eating: 'twice', water: 'twice',
      focusSessions: 'twice', supplements: 'twice', supplementDays: 'twice', journal: 'twice', gratitude: 'twice',
      lifeCoaches: 'sheet', coachStudents: 'sheet', discoverResults: 'sheet', discoverAddOns: 'sheet', companionChat: 'twice',
    };
    for (const [k, ask] of Object.entries(asks)) expect(t(k).remove?.ask, k).toBe(ask);
    for (const k of ['coachingLog', 'studentsLog', 'coachCard', 'assistantChanges']) {
      expect(t(k).remove, k).toBeUndefined();
      expect(t(k).noRemoveWhy, k).toBeTruthy();
    }
    expect(removeWords(t('supplementDays'), 1).title).toBe('Untick 1 row?');
    expect(removeWords(t('supplementDays'), 3).yes).toBe('Yes, untick them');
    expect(removeWords(t('gratitude'), 1).ask).toBe('Tap again to clear');
    expect(removeWords(t('lifeCoaches'), 2)).toMatchObject({ title: 'End coaching with 2 coaches?', yes: 'Yes, end the coaching' });
  });

  it('builds each remove’s call from the row’s own ids, never another person’s', () => {
    const one = (k: string, id: string, cells: Record<string, string | null> = {}, fields: Record<string, unknown> = {}) => {
      const state = removeStateOf(t(k), cells, fields);
      if (!state || 'why' in state) return state;
      return removeCallFor(removeCallOf(t(k).remove!, state.at)!, id, cells, fields, today);
    };
    expect(one('mood', 'r1')).toEqual({ method: 'DELETE', path: '/wellbeing/mood/r1' });
    expect(one('mindfulMinutes', 'r2')).toEqual({ method: 'DELETE', path: '/wellbeing/mindful/r2' });
    expect(one('water', 'w1')).toEqual({ method: 'DELETE', path: `/reminders/water/w1?day=${today}` });
    expect(one('gratitude', '2026-01-05')).toEqual({ method: 'DELETE', path: `/journal/gratitude/2026-01-05?day=${today}` });
    expect(one('supplementDays', 's1:2026-01-05', { supplementId: 's1', day: '2026-01-05' })).toEqual({ method: 'PUT', path: '/fitness/supplements/s1/day', body: { taken: false, date: '2026-01-05' } });
    // A value's key holds a colon: the metric's id and the period come from its hidden owner-only cells.
    expect(one('businessMetricValues', 'k1:2026-11-01', { kpiId: 'k1', periodStart: '2026-11-01' })).toEqual({ method: 'DELETE', path: '/reviews/kpis/k1/values/2026-11-01' });
    expect(one('businessMetricValues', 'k1:2026-11-01', { periodStart: '2026-11-01' })).toBeNull();
    expect(one('companionChat', 'm1')).toEqual({ method: 'DELETE', path: '/companion/messages/m1' });
    expect(one('discoverAddOns', 'design')).toEqual({ method: 'DELETE', path: '/discover/more/design' });
    expect(one('reviews', 'rv1')).toEqual({ method: 'DELETE', path: '/reviews/rv1' });
    // Coaching: a running link is ended, the person's own ask taken back, an ask they answer turned down; one already over stays.
    expect(removeStateOf(t('lifeCoaches'), { status: 'active', asker: 'them' })).toEqual({ did: 'ended', at: 0 });
    expect(removeStateOf(t('lifeCoaches'), { status: 'pending', asker: 'you' })).toEqual({ did: 'taken back', at: 2 });
    expect(removeStateOf(t('lifeCoaches'), { status: 'pending', asker: 'them' })).toEqual({ did: 'turned down', at: 1 });
    expect(removeStateOf(t('lifeCoaches'), { status: 'pending', asker: 'team' })).toEqual({ did: 'turned down', at: 1 });
    expect(removeStateOf(t('coachStudents'), { status: 'pending', asker: 'them' })).toEqual({ did: 'turned down', at: 1 });
    expect(removeStateOf(t('coachStudents'), { status: 'pending', asker: 'team' })).toEqual({ did: 'taken back', at: 2 });
    expect(removeStateOf(t('coachStudents'), { status: 'ended', asker: 'you' })).toEqual({ why: 'It has already ended.' });
    expect(removeStateOf(t('coachStudents'), { status: 'declined', asker: 'them' })).toEqual({ why: 'It has already ended.' });
    expect(one('coachStudents', 'l1', { status: 'active', asker: 'you' })).toEqual({ method: 'DELETE', path: '/me/coach/links/l1' });
    expect(one('lifeCoaches', 'l2', { status: 'pending', asker: 'them' })).toEqual({ method: 'POST', path: '/me/coach/links/l2/answer', body: { yes: false } });
    // Every id a path holds is the row's own or an owner-only cell or private field; never a coach's or a student's id.
    for (const k of REFLECTION) {
      const spec = t(k).remove;
      if (!spec) continue;
      const calls = [...(spec.call ? [spec.call] : []), ...(spec.outcomes ?? []).flatMap((o) => ('call' in o ? [o.call] : []))];
      for (const c of calls) expect(c.path, k).not.toMatch(/:(coach|student|user|other)Id/);
    }
  });

  it('sends each edit to its own route in the words that route reads', () => {
    expect(plainCall(col('water', 'ml'), 'w1', {}, 300, today)).toEqual({ method: 'PATCH', path: `/reminders/water/w1?day=${today}`, body: { ml: 300 } });
    expect(plainCall(col('businessMetricValues', 'value'), 'k1:2026-11-01', { kpiId: 'k1', periodStart: '2026-11-01' }, 12.5, today)).toEqual({ method: 'PATCH', path: '/reviews/kpis/k1/values/2026-11-01', body: { valueTyped: 12.5 } });
    expect(plainCall(col('businessMetricValues', 'note'), 'k1:2026-11-01', { kpiId: 'k1', periodStart: '2026-11-01' }, 'A slow week', today)?.path).toBe('/reviews/kpis/k1/values/2026-11-01');
    expect(plainCall(col('businessMetrics', 'target'), 'k1', {}, 1500.5, today)).toEqual({ method: 'PATCH', path: '/reviews/kpis/k1', body: { targetTyped: 1500.5 } });
    expect(plainCall(col('reviews', 'answers'), 'rv1', {}, 'What went well?: The edit', today)).toEqual({ method: 'PATCH', path: '/reviews/rv1', body: { answersText: 'What went well?: The edit' } });
    expect(plainCall(col('mindfulMinutes', 'minutes'), 'm1', {}, 20, today)).toEqual({ method: 'PATCH', path: '/wellbeing/mindful/m1', body: { minutes: 20 } });
    expect(plainCall(col('movement', 'distance'), 'mv1', {}, '5.25', today)).toEqual({ method: 'PATCH', path: '/fitness/move/mv1', body: { km: '5.25' } });
    expect(plainCall(col('supplements', 'days'), 's1', {}, 'weekdays', today)).toEqual({ method: 'PATCH', path: '/fitness/supplements/s1', body: { days: 'weekdays' } });
    // A review's rating: a number 1 to 5, or none.
    expect(editValue(col('reviews', 'rating'), '4')).toEqual({ value: 4 });
    expect(editValue(col('reviews', 'rating'), 'none')).toEqual({ value: null });
    // A review reminder's repeat: a plain rule as its JSON, Once as null; a rule with chosen days is shown, never picked here.
    const repeat = col('reviewReminders', 'repeat');
    expect(editValue(repeat, 'weekdays')).toEqual({ value: '{"kind":"weekdays","every":1}' });
    expect(editValue(repeat, 'none')).toEqual({ value: null });
    expect('error' in editValue(repeat, 'custom')).toBe(true);
    // Mindful minutes: a break, a breath or by hand; a focus round's own stays one.
    const from = col('mindfulMinutes', 'from');
    expect(editValue(from, 'breathe')).toEqual({ value: 'breathe' });
    expect(editValue(from, 'none')).toEqual({ value: null });
    expect('error' in editValue(from, 'focus')).toBe(true);
    // The longest answers block holds every question, colon and answer at their most (the route checks each answer again).
    expect(REVIEW_ANSWERS_TEXT_MAX).toBe(MAX_REVIEW_PROMPTS * (REVIEW_PROMPT_MAX + 2 + REVIEW_ANSWER_MAX) + (MAX_REVIEW_PROMPTS - 1) * 2);
    expect(col('reviewTemplates', 'questions').edit?.maxLength).toBe(MAX_REVIEW_PROMPTS * (REVIEW_PROMPT_MAX + 1));
    expect(col('gratitude', 'line1').edit?.maxLength).toBe(GRATITUDE_LINE_MAX);
  });

  it('lets water and gratitude change on any past day, never one still to come (decision 6)', () => {
    for (const [k, c] of [['water', 'ml'], ['gratitude', 'line1']] as const) {
      const x = t(k);
      expect(col(k, c).edit?.when, k).toBe('past');
      expect(rowEditable(x, col(k, c), { day: '2025-03-01' }, today), k).toBe(true);
      expect(rowEditable(x, col(k, c), { day: today }, today), k).toBe(true);
      expect(rowEditable(x, col(k, c), { day: '2026-11-15' }, today), k).toBe(false);
    }
    expect(isPastDay('2026-11-15', today)).toBe(false);
    // The routes take the same rule: a day up to the person's own today.
    const journal = read('../../../apps/api/src/routes/journal.ts');
    expect(journal).toContain("if (!t) return c.json({ error: 'A day still to come cannot be written yet.' }, 400);");
    // Never a day before the account began (the review of 2026-11-14), for a gratitude day, a supplement tick or a routine day.
    expect(journal).toContain('beforeStart(day, startDay(user.created_at, user.timezone), t)) return c.json({ error: BEFORE_JOINED }, 400)');
    expect(journal).toContain("journal.delete('/gratitude/:day'");
    const supplements = read('../../../apps/api/src/routes/supplements.ts');
    expect(supplements).not.toContain('logDay(');
    // A tick is held to the person's own today (the device's, within a day of their zone's), never a window round the server's UTC date, so
    // their own tomorrow is refused, for one tick and Mark all taken alike; an untick clears any day.
    expect(supplements).not.toContain('dateNearOwnDay(');
    expect(supplements).toContain("const own = personDay(typeof today === 'string' ? today : null, zone);");
    expect(supplements).toContain("return taking && day > own ? { error: 'A day still to come cannot be ticked yet.' } : { day, own };");
    expect(supplements).toContain('tickDay(body.date, body.today, user.timezone, true)');
    expect(supplements).toContain('tickDay(body.date, body.today, user.timezone, body.taken)');
    expect(supplements).toContain("body.taken && beforeStart(day, startDay(row.created_at, user.timezone), today)");
    expect(supplements.match(/startDay\(user\.created_at, user\.timezone\)/g)?.length).toBe(2);
    const water = read('../../../apps/api/src/routes/reminders.ts');
    expect(water).toContain("if (row.day > today) return c.json({ error: 'A day still to come cannot be changed yet.' }, 400);");
  });

  it('keeps a focus round and its mindful minutes in step, both ways (decision 7)', () => {
    const w = read('../../../apps/api/src/routes/wellbeing.ts');
    const patchRoute = w.slice(w.indexOf("wellbeing.patch('/mindful/:id'"), w.indexOf('// Delete a round'));
    expect(patchRoute).toContain('UPDATE focus_rounds SET minutes = ? WHERE log_id = ? AND user_id = ?');
    expect(patchRoute).toContain('NOT EXISTS (SELECT 1 FROM focus_rounds f WHERE f.log_id = wellbeing_logs.id AND f.user_id = ?)');
    // Deleting the minutes a round wrote leaves the round, no longer pointing at them, in the same batch.
    expect(w).toContain("db.prepare('UPDATE focus_rounds SET log_id = NULL WHERE log_id = ? AND user_id = ?').bind(id, userId), del");
  });

  it('reads the fields a form fills, as the app types them', async () => {
    const { DatabaseSync } = await import('node:sqlite');
    const db = new DatabaseSync(':memory:');
    db.exec(`CREATE TABLE reviews (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, kind TEXT NOT NULL, period_start TEXT NOT NULL, period_end TEXT NOT NULL, template_id TEXT, template_name TEXT NOT NULL DEFAULT '', prompts_json TEXT NOT NULL, answers_json TEXT NOT NULL, rating INTEGER, highlight TEXT NOT NULL DEFAULT '', snapshot_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE review_templates (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, kind TEXT NOT NULL, name TEXT NOT NULL, prompts_json TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE review_schedules (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, kind TEXT NOT NULL, name TEXT NOT NULL DEFAULT '', anchor TEXT NOT NULL, time TEXT NOT NULL, repeat_json TEXT, enabled INTEGER NOT NULL DEFAULT 1, next_on TEXT, created_at TEXT NOT NULL);
      CREATE TABLE supplements (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL, kind TEXT NOT NULL, amount TEXT NOT NULL DEFAULT '', time_of_day TEXT NOT NULL, days_json TEXT NOT NULL, position INTEGER NOT NULL DEFAULT 0, paused_at TEXT, pauses_json TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL);
      CREATE TABLE wellbeing_logs (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, kind TEXT NOT NULL, date TEXT NOT NULL, value REAL NOT NULL, extra TEXT NOT NULL DEFAULT '{}', note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL);
      CREATE TABLE kpis (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL, unit TEXT NOT NULL, direction TEXT NOT NULL, cadence TEXT NOT NULL, target INTEGER NOT NULL DEFAULT 0, source TEXT NOT NULL DEFAULT 'manual', created_at TEXT NOT NULL);
      CREATE TABLE kpi_values (kpi_id TEXT NOT NULL, period_start TEXT NOT NULL, value INTEGER NOT NULL, note TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL, PRIMARY KEY (kpi_id, period_start));
      CREATE TABLE agency_settings (user_id TEXT PRIMARY KEY, profile_json TEXT, currency TEXT);
      INSERT INTO reviews (id, user_id, kind, period_start, period_end, prompts_json, answers_json, created_at, updated_at) VALUES
        ('rv1', 'u1', 'week', '2026-11-02', '2026-11-08', '["What went well?","What got in the way?","What next?"]', '["The edit","","Rest"]', 'x', 'x');
      INSERT INTO review_templates (id, user_id, kind, name, prompts_json, created_at, updated_at) VALUES ('tp1', 'u1', 'week', 'Mine', '["One?","Two?"]', 'x', 'x');
      INSERT INTO review_schedules (id, user_id, kind, anchor, time, repeat_json, created_at) VALUES
        ('s1', 'u1', 'week', '2026-11-01', '09:00', NULL, '1'),
        ('s2', 'u1', 'week', '2026-11-01', '09:00', '{"kind":"monthly","every":1,"days":[],"until":null}', '2'),
        ('s3', 'u1', 'week', '2026-11-01', '09:00', '{"kind":"weekly","every":2,"days":[1],"until":null}', '3'),
        ('s4', 'u1', 'week', '2026-11-01', '09:00', 'not json', '4');
      INSERT INTO supplements (id, user_id, name, kind, time_of_day, days_json, created_at) VALUES
        ('p1', 'u1', 'D3', 'vitamin', 'morning', '[1,2,3,4,5,6,7]', '1'), ('p2', 'u1', 'Iron', 'mineral', 'meal', '[1,3,5]', '2'), ('p3', 'u1', 'Fish oil', 'omega3', 'night', '[6,7]', '3');
      INSERT INTO wellbeing_logs (id, user_id, kind, date, value, extra, created_at) VALUES
        ('mv1', 'u1', 'move', '2026-11-14', 30, '{"kind":"run","metres":5250}', '1'), ('mv2', 'u1', 'move', '2026-11-13', 30, '{"kind":"run","metres":10000}', '2'), ('mv3', 'u1', 'move', '2026-11-12', 30, '{"kind":"yoga"}', '3');
      INSERT INTO kpis (id, user_id, name, unit, direction, cadence, target, created_at) VALUES ('k1', 'u1', 'Revenue', 'money', 'up', 'month', 150050, '1'), ('k2', 'u1', 'Hours', 'hours', 'up', 'month', 0, '2');
      INSERT INTO kpi_values (kpi_id, period_start, value, updated_at) VALUES ('k1', '2026-11-01', 250000, 'x'), ('k2', '2026-11-01', 90, 'x');`);
    const named = (sql: string, binds: readonly unknown[]) => ({ sql: sql.replace(/\?(\d+)/g, '@p$1'), args: Object.fromEntries(binds.map((v, i) => [`p${i + 1}`, v as string | number])) });
    const rows = (k: string) => {
      const s = tableSql(t(k), parseTableQuery(t(k), {}), ctx);
      const n = named(s.sql, s.binds);
      return db.prepare(n.sql).all(n.args) as Record<string, unknown>[];
    };
    // Every saved question, in order, with its answer after a colon, the unanswered too: the block PATCH /reviews/:id reads back.
    expect(rows('reviews')[0]!.answersText).toBe('What went well?: The edit\n\nWhat got in the way?: \n\nWhat next?: Rest');
    expect(rows('reviewTemplates')[0]!.questionLines).toBe('One?\nTwo?');
    // A plain repeat by its name; one with chosen days, a step or bad JSON reads custom.
    expect(rows('reviewReminders').map((r) => [r._id, r.repeatPick])).toEqual([['s1', 'none'], ['s2', 'monthly'], ['s3', 'custom'], ['s4', 'custom']]);
    expect(rows('supplements').map((r) => [r._id, r.daySet])).toEqual([['p1', 'every'], ['p2', 'custom'], ['p3', 'weekends']]);
    // A distance as the form fills it: whole metres kept, no trailing zeros.
    expect(rows('movement').map((r) => [r._id, r.kmTyped])).toEqual([['mv1', '5.25'], ['mv2', '10'], ['mv3', null]]);
    // A target or value as Reviews types it: an amount for money, hours for hours; no target reads empty.
    expect(rows('businessMetrics').map((r) => [r._id, r.targetTyped])).toEqual([['k2', null], ['k1', 1500.5]]);
    expect(rows('businessMetricValues').map((r) => [r._id, r.kpiId, r.valueTyped])).toEqual([['k2:2026-11-01', 'k2', 1.5], ['k1:2026-11-01', 'k1', 2500]]);
  });

  it('never lets a coach, an admin or AI chat change or remove a row: the fields a form fills are the owner’s alone', () => {
    for (const k of REFLECTION) {
      for (const c of t(k).columns) {
        // A hidden cell a form or a remove reads is the owner's only, so nobody else is ever sent it.
        if (c.hidden && ['answersText', 'questionLines', 'repeatPick', 'daySet', 'kmTyped', 'targetTyped', 'kpiId', 'periodStart', 'valueTyped', 'supplementId'].includes(c.key)) expect(c.ownerOnly, `${k}.${c.key}`).toBe(true);
      }
    }
    // The owner's mount alone has the write routes; nothing in the assistant reaches the new owner routes.
    const tools = read('../../../apps/api/src/assistant/tools.ts');
    for (const path of ['/wellbeing/mindful/', '/reminders/water/${', '/companion/messages', '/reviews/kpis/', "values/"]) expect(tools, path).not.toContain(path);
  });
});
