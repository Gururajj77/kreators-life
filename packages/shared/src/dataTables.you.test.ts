import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ASSISTANT_ACTION_OPTIONS,
  audienceOf,
  COACH_ABOUT_MOST,
  COACH_LINK_STATE_OPTIONS,
  COACH_LOG_OPTIONS,
  COACH_SHARE_PART_WORDS,
  coachTableKeys,
  CONSENT_SOURCE_OPTIONS,
  DATA_TABLES,
  dataTableByKey,
  DISCOUNT_AREA_OPTIONS,
  editValue,
  EXTRA_KIND_OPTIONS,
  HONOR_WORDS,
  INVITE_STATE_OPTIONS,
  KYC_STATE_OPTIONS,
  LEGAL_DOC_OPTIONS,
  listTables,
  LIVE_CALL_STATE_OPTIONS,
  parseTableQuery,
  plainCall,
  PLAN_OPTIONS,
  rowEditable,
  SERVER_DERIVES,
  tableAllowed,
  tableReach,
  tableSql,
  TICKET_STATE_OPTIONS,
  type ColumnOption,
  type DataTable,
} from './dataTables';
import {
  COACH_ABOUT_MAX,
  COACH_SHARE_META,
  COACH_SHARE_PARTS,
  DEFAULT_COACH_SHARE,
  DISCOUNT_AREA_META,
  DISCOUNT_AREAS,
  EXTRA_KINDS,
  HONORS,
  LEGAL_DOCS,
  LIVE_CALL_STATUSES,
  parseCoachShare,
  planName,
  PLANS,
} from './index';
import { INVITE_STATE_LABEL, INVITE_STATES } from './invites';

// All tables' seventh batch (2026-11-14, the founder: "ok, add them"): You. Its own file, beside dataTables.test.ts, which holds the rules every
// table meets (the schema, the owner's index, secrets, routes and words); this one holds what is particular to these twenty-one.

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const pairs = (o: readonly ColumnOption[]) => o.filter((x) => !x.isNull).map((x) => [x.value, x.label]);
const editable = (k: string) => dataTableByKey[k]!.columns.filter((col) => col.edit).map((col) => col.key);
const ctx = { view: 'owner' as const, ownerId: 'u1', viewerId: 'u1', today: '2026-11-14', zone: 'Asia/Kolkata' };
/** Every SQL string a table holds. */
const textOf = (t: DataTable) =>
  [t.from, t.owner, t.where ?? '', t.coachWhere ?? '', t.othersWhere ?? '', t.idSql, ...t.columns.flatMap((col) => [col.sql ?? '', col.sortSql ?? '', col.searchSql ?? '', col.filterSql ?? '', ...(col.sortTerms ?? [])]), ...Object.values(t.privateSelect ?? {})].join(' ');
/** The member's own union type in a source file, as its values: `type CoachLinkStatus = 'pending' | 'active'` gives the two. */
const unionOf = (src: string, name: string): string[] => {
  const m = new RegExp(`${name}(?:\\s*=|:)\\s*((?:'[^']+'\\s*\\|?\\s*)+)`).exec(src);
  return m ? [...m[1]!.matchAll(/'([^']+)'/g)].map((x) => x[1]!) : [];
};

describe('All tables: You (2026-11-14)', () => {
  // The person's own records, with nobody else's details or words in them: the old rules.
  const OWN = ['vibeCheckAnswers', 'liveCalls', 'coachCard', 'plan', 'discountsUsed', 'payoutDetails', 'honors', 'seasonPlaces', 'calendarLink', 'privacyRecords', 'termsAccepted'];
  // Another person's name or words: a coach or a student and the log between them, the founder's own (Discover's results, the Companion chat),
  // what the assistant changed (its labels name clients, pieces and body and mind logs), a code's label naming who it is for, the team's answers.
  const OTHERS = ['lifeCoaches', 'coachStudents', 'coachingLog', 'studentsLog', 'discoverResults', 'discoverAddOns', 'companionChat', 'assistantChanges', 'inviteCodes', 'teamMessages'];
  const BATCH = [...OWN, ...OTHERS];

  it('holds every table, each with its audience and the app its records belong to, in its category', () => {
    for (const k of BATCH) expect(dataTableByKey[k], k).toBeTruthy();
    expect(DATA_TABLES.filter((t) => ['coaching', 'selfAi', 'invites'].includes(t.group)).map((t) => t.key).sort()).toEqual(
      ['lifeCoaches', 'coachStudents', 'coachingLog', 'studentsLog', 'coachCard', 'discoverResults', 'discoverAddOns', 'companionChat', 'assistantChanges', 'inviteCodes', 'teamMessages'].sort(),
    );
    expect(Object.fromEntries(['vibeCheckAnswers', 'liveCalls', 'plan', 'discountsUsed', 'payoutDetails', 'honors', 'seasonPlaces', 'calendarLink', 'privacyRecords', 'termsAccepted'].map((k) => [k, dataTableByKey[k]!.group]))).toEqual({
      vibeCheckAnswers: 'pillars', liveCalls: 'pillars', plan: 'money', discountsUsed: 'money', payoutDetails: 'money', honors: 'account', seasonPlaces: 'account',
      calendarLink: 'account', privacyRecords: 'account', termsAccepted: 'account',
    });
    for (const k of OWN) {
      const t = dataTableByKey[k]!;
      expect(audienceOf(t), k).toBe('own');
      expect(tableReach(t), k).toEqual({ coach: true, admin: true, ai: 'any' });
      expect(coachTableKeys([k]), k).toEqual([k]);
    }
    for (const k of OTHERS) {
      const t = dataTableByKey[k]!;
      expect(audienceOf(t), k).toBe('others');
      expect(tableReach(t), k).toEqual({ coach: false, admin: false, ai: 'private' });
      expect(tableAllowed(t, 'coach', [k], null), k).toBe(false);
      expect(tableAllowed(t, 'admin', [], null), k).toBe(false);
      expect(coachTableKeys([k]), k).toEqual([]);
    }
    // The apps each belongs to: a coach's side, the card, Discover, the Companion, Help, the leaderboard and the Shop's payouts. The student's own side
    // of coaching and its log stay core, as My coach does (nobody is stuck with a coach); the assistant is locked on, so its changes always list.
    expect(Object.fromEntries(BATCH.map((k) => [k, dataTableByKey[k]!.needs ?? null]))).toEqual({
      vibeCheckAnswers: null, liveCalls: null, coachCard: ['coaching'], plan: null, discountsUsed: null, payoutDetails: ['shop'], honors: null, seasonPlaces: ['leaderboard'],
      calendarLink: null, privacyRecords: null, termsAccepted: null, lifeCoaches: null, coachStudents: ['coaching'], coachingLog: null, studentsLog: ['coaching'], discoverResults: ['discover'],
      discoverAddOns: ['discover'], companionChat: ['companion'], assistantChanges: null, inviteCodes: null, teamMessages: ['help'],
    });
    const keysFor = (on: string[]) => listTables('owner', [], on).flatMap((g) => g.tables.map((t) => t.key));
    for (const k of ['coachStudents', 'studentsLog', 'coachCard', 'discoverResults', 'companionChat', 'seasonPlaces', 'teamMessages', 'payoutDetails']) expect(keysFor([]), k).not.toContain(k);
    for (const k of ['lifeCoaches', 'coachingLog', 'assistantChanges', 'inviteCodes', 'honors', 'termsAccepted', 'plan']) expect(keysFor([]), k).toContain(k);
    expect(keysFor(['coaching'])).toEqual(expect.arrayContaining(['coachStudents', 'studentsLog', 'coachCard']));
    expect(keysFor(['discover'])).not.toContain('companionChat');
    // Life coaching and Discover and AI chat sit under Reflection after Journal, where Coaching, Discover and the Companion are; Invites and help
    // under Essentials after Account, where Help is.
    const groups = listTables('owner', [], null);
    const order = groups.map((g) => g.key);
    expect(groups.filter((g) => ['coaching', 'selfAi', 'invites'].includes(g.key)).map((g) => [g.key, g.name, g.appGroup])).toEqual([
      ['coaching', 'Life coaching', 'wellbeing'],
      ['selfAi', 'Discover and AI chat', 'wellbeing'],
      ['invites', 'Invites and help', 'core'],
    ]);
    expect(order.indexOf('coaching')).toBe(order.indexOf('journal') + 1);
    expect(order.indexOf('selfAi')).toBe(order.indexOf('coaching') + 1);
    expect(order.indexOf('invites')).toBe(order.indexOf('account') + 1);
    // An admin's list holds the person's own records, never one with other people's details.
    const adminKeys = listTables('admin', [], null).flatMap((g) => g.tables.map((t) => t.key));
    for (const k of OWN) expect(adminKeys, k).toContain(k);
    for (const k of OTHERS) expect(adminKeys, k).not.toContain(k);
  });

  it('says each state, step, kind and place in the app’s own words', () => {
    const coaching = read('./coaching.ts');
    expect(pairs(COACH_LINK_STATE_OPTIONS).map(([k]) => k)).toEqual(unionOf(coaching, 'type CoachLinkStatus'));
    expect(pairs(COACH_LOG_OPTIONS).map(([k]) => k)).toEqual(unionOf(coaching, 'type CoachLogAction'));
    expect(COACH_SHARE_PART_WORDS.map(([k, name, unset]) => [k, name, unset === 1])).toEqual(COACH_SHARE_PARTS.map((k) => [k, COACH_SHARE_META[k].name, DEFAULT_COACH_SHARE[k]]));
    expect(COACH_ABOUT_MOST).toBe(COACH_ABOUT_MAX);
    expect(pairs(EXTRA_KIND_OPTIONS)).toEqual(EXTRA_KINDS.map((k) => [k.key, k.name]));
    expect(HONOR_WORDS.map(([k, n, tier]) => [k, n, tier])).toEqual(HONORS.map((h) => [h.key, h.name, h.tier]));
    expect(pairs(LEGAL_DOC_OPTIONS)).toEqual(LEGAL_DOCS.map((d) => [d.key, d.name]));
    expect(pairs(INVITE_STATE_OPTIONS)).toEqual(INVITE_STATES.map((k) => [k, INVITE_STATE_LABEL[k]]));
    expect(pairs(LIVE_CALL_STATE_OPTIONS).map(([k]) => k)).toEqual([...LIVE_CALL_STATUSES]);
    expect(pairs(PLAN_OPTIONS)).toEqual([['none', planName('none')], ...Object.values(PLANS).map((p) => [p.key, p.name])]);
    expect(pairs(DISCOUNT_AREA_OPTIONS)).toEqual(DISCOUNT_AREAS.map((k) => [k, DISCOUNT_AREA_META[k].name]));
    expect(pairs(ASSISTANT_ACTION_OPTIONS).map(([k]) => k).sort()).toEqual(unionOf(read('./assistant.ts'), 'type AssistantActionStatus').sort());
    expect(pairs(KYC_STATE_OPTIONS).map(([k]) => k)).toEqual(unionOf(read('./studio.ts').split('export interface KycProfile')[1] ?? '', 'status'));
    expect(read('../../../apps/web/src/screens/Customers.tsx')).toContain("pending: { label: 'waiting for review'");
    expect(pairs(TICKET_STATE_OPTIONS).map(([k]) => k)).toEqual(['open', 'answered', 'closed']);
    expect(read('../../../apps/api/src/routes/support.ts')).toContain("oneOf(body.status, ['open', 'answered', 'closed'] as const");
    expect(pairs(CONSENT_SOURCE_OPTIONS).map(([k]) => k)).toEqual(['popup', 'profile', 'unsubscribe']);
    expect(read('../../../apps/api/src/routes/legal.ts')).toContain("source: 'popup' | 'profile' | 'unsubscribe'");
    for (const k of ['vibeQuestion', 'vibeAnswer', 'discoverResult', 'discoverAddOn', 'answeredBy'] as const) expect(SERVER_DERIVES).toContain(k);
  });

  it('never selects a code, a token, a hash, a payment id, an answer, the assistant’s arguments or who on the team did something', () => {
    const NEVER: Record<string, RegExp> = {
      inviteCodes: /\bt\.code\b|used_by|revoked_by|waitlist_id/,
      calendarLink: /token/,
      payoutDetails: /pan_hash|decided_by/,
      liveCalls: /provider/,
      discountsUsed: /\bt\.ref\b|code_id|discount_codes/,
      assistantChanges: /args_json|undo_json|refresh_json|\bt\.tool\b/,
      discoverResults: /answers_json/,
      discoverAddOns: /answers_json|draft_json/,
      lifeCoaches: /created_by|ended_by|share_json'?\s*AS/,
      coachStudents: /created_by|ended_by/,
      coachingLog: /actor_id|target_id|before_json|after_json|link_id/,
      studentsLog: /actor_id|target_id|before_json|after_json|link_id/,
      teamMessages: /\bt\.user_id\b(?!\s*=\s*\?1)/,
    };
    for (const [k, re] of Object.entries(NEVER)) expect(textOf(dataTableByKey[k]!), k).not.toMatch(re);
    // A share is read part by part, never sent whole (its tables list is the coach's own business on the Profile tab).
    for (const k of ['lifeCoaches', 'coachStudents']) expect(Object.keys(dataTableByKey[k]!.privateSelect ?? {}), k).toEqual([]);
    // Who used a code is never named to its maker; the answer by a team member names them as Help does.
    expect(dataTableByKey.inviteCodes!.columns.map((col) => col.key)).toEqual(['label', 'state', 'linkWorks', 'made', 'runsOut', 'usedOn']);
    // A design's birth details never leave the table: its summary is extrasProfile's, worked out on the server from the stored result.
    expect(dataTableByKey.discoverAddOns!.columns.find((col) => col.key === 'found')?.derive).toBe('discoverAddOn');
  });

  it('changes only through the app’s own routes: the parts shared with a coach, the coach card and the calendar link', () => {
    expect(Object.fromEntries(BATCH.map((k) => [k, editable(k)]).filter(([, v]) => (v as string[]).length > 0))).toEqual({
      lifeCoaches: ['daily', 'pillars', 'routine', 'lifeMap', 'reflection', 'patterns'],
      coachCard: ['about', 'open'],
      calendarLink: ['on'],
    });
    for (const k of BATCH) if (editable(k).length === 0) expect(dataTableByKey[k]!.readOnlyWhy, k).toBeTruthy();
    const coaches = dataTableByKey.lifeCoaches!;
    const patterns = coaches.columns.find((col) => col.key === 'patterns')!;
    expect(patterns.edit).toMatchObject({ method: 'PATCH', path: '/me/coach/links/:id/share', field: 'patterns', input: 'toggle', when: 'linkOpen' });
    // Only while the link is asked or running, as the route itself holds.
    expect(rowEditable(coaches, patterns, { status: 'active' }, '2026-11-14')).toBe(true);
    expect(rowEditable(coaches, patterns, { status: 'pending' }, '2026-11-14')).toBe(true);
    expect(rowEditable(coaches, patterns, { status: 'ended' }, '2026-11-14')).toBe(false);
    expect(rowEditable(coaches, patterns, { status: 'declined' }, '2026-11-14')).toBe(false);
    expect(plainCall(patterns, 'link-1', { status: 'active' }, true, '2026-11-14')).toEqual({ method: 'PATCH', path: '/me/coach/links/link-1/share', body: { patterns: true } });
    const coach = read('../../../apps/api/src/routes/coach.ts');
    expect(coach).toContain("for (const k of COACH_SHARE_PARTS) if (typeof body[k] === 'boolean') after[k] = body[k] as boolean;");
    expect(coach).toContain("if (link.status !== 'pending' && link.status !== 'active') return c.json({ error: 'This coaching has ended.' }, 400);");
    // The coach card: the words on it (at most COACH_ABOUT_MAX, as the route cuts them) and whether it takes new students, one field a call.
    const card = dataTableByKey.coachCard!;
    const about = card.columns.find((col) => col.key === 'about')!;
    expect(plainCall(about, 'card', {}, 'Calm and kind.', '2026-11-14')).toEqual({ method: 'PUT', path: '/coach/profile', body: { about: 'Calm and kind.' } });
    expect(editValue(about, 'x'.repeat(COACH_ABOUT_MAX + 1))).toHaveProperty('error');
    expect(coach).toContain("const about = typeof body.about === 'string' ? str(body.about, COACH_ABOUT_MAX) : before.about;");
    expect(coach).toContain("const open = typeof body.open === 'boolean' ? body.open : before.open;");
    // The calendar link: on or off through the Profile tab's own route, which keeps the same link when switched on again.
    const on = dataTableByKey.calendarLink!.columns.find((col) => col.key === 'on')!;
    expect(plainCall(on, 'calendar', {}, false, '2026-11-14')).toEqual({ method: 'POST', path: '/me/calendar', body: { on: false } });
    expect(read('../../../apps/api/src/routes/calendar.ts')).toContain('const token = !prev || body.fresh ? randomCode(24) : prev.token;');
  });

  it('reads a share, a code’s state, a plan and Discover’s own yes for AI chat as the app does', async () => {
    const { DatabaseSync } = await import('node:sqlite');
    const db = new DatabaseSync(':memory:');
    db.exec(`CREATE TABLE users (id TEXT PRIMARY KEY, display_name TEXT, handle TEXT);
      CREATE TABLE coach_links (id TEXT PRIMARY KEY, coach_id TEXT NOT NULL, student_id TEXT NOT NULL, status TEXT NOT NULL, asked_by TEXT NOT NULL, created_by TEXT, share_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL, answered_at TEXT, ended_at TEXT, ended_by TEXT, patterns_asked_at TEXT);
      CREATE TABLE invite_codes (id TEXT PRIMARY KEY, code TEXT NOT NULL, created_by TEXT, label TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, expires_at TEXT, revoked_at TEXT, revoked_by TEXT, used_by TEXT, used_at TEXT, waitlist_id TEXT, setup_done_at TEXT, active_at TEXT);
      CREATE TABLE credit_accounts (user_id TEXT PRIMARY KEY, plan TEXT NOT NULL DEFAULT 'none', plan_started_at TEXT, plan_until TEXT, plan_credits INTEGER NOT NULL DEFAULT 0, extra_credits INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL);
      CREATE TABLE discover_results (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, answers_json TEXT NOT NULL, result_json TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE discover_extras (user_id TEXT NOT NULL, kind TEXT NOT NULL, draft_json TEXT, answers_json TEXT, result_json TEXT, taken_at TEXT, updated_at TEXT NOT NULL, PRIMARY KEY (user_id, kind));
      CREATE TABLE discover_settings (user_id TEXT PRIMARY KEY, steps INTEGER NOT NULL DEFAULT 1, assistant INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL, mind INTEGER NOT NULL DEFAULT 0);
      INSERT INTO users (id, display_name, handle) VALUES ('u1', 'Asha', 'asha'), ('k1', 'Coach Kim', 'kim'), ('k2', 'Coach Lee', 'lee'), ('k3', 'Coach Mo', 'mo');
      INSERT INTO coach_links (id, coach_id, student_id, status, asked_by, share_json, created_at) VALUES
        ('l1', 'k1', 'u1', 'active', 'coach', '{"daily":false,"patterns":true,"tables":["tasks"]}', '2026-11-01T00:00:00Z'),
        ('l2', 'k2', 'u1', 'pending', 'admin', '{}', '2026-11-02T00:00:00Z'),
        ('l3', 'k3', 'u1', 'ended', 'student', 'not json', '2026-11-03T00:00:00Z');
      INSERT INTO invite_codes (id, code, created_by, label, created_at, expires_at, revoked_at, used_at) VALUES
        ('c1', 'AAAA', 'u1', 'For Priya', '2026-11-01T00:00:00Z', '2999-01-01T00:00:00Z', NULL, NULL),
        ('c2', 'BBBB', 'u1', '', '2026-11-02T00:00:00Z', '2001-01-01T00:00:00Z', NULL, NULL),
        ('c3', 'CCCC', 'u1', '', '2026-11-03T00:00:00Z', NULL, '2026-11-04T00:00:00Z', '2026-11-05T00:00:00Z'),
        ('c4', 'DDDD', 'u1', '', '2026-11-04T00:00:00Z', NULL, '2026-11-05T00:00:00Z', NULL);
      INSERT INTO credit_accounts (user_id, plan, plan_until, plan_credits, extra_credits, updated_at) VALUES ('u1', 'pro', '2001-01-01T00:00:00Z', 900, 50, '2026-11-01T00:00:00Z');
      INSERT INTO discover_results (id, user_id, answers_json, result_json, created_at) VALUES ('d1', 'u1', '{}', '{}', '2026-11-01T00:00:00Z');
      INSERT INTO discover_extras (user_id, kind, result_json, taken_at, updated_at) VALUES ('u1', 'type', '{}', '2026-11-01T00:00:00Z', 'x'), ('u1', 'mind', '{}', '2026-11-01T00:00:00Z', 'x'), ('u1', 'love', NULL, NULL, 'x');`);
    const named = (sql: string, binds: readonly unknown[]) => ({ sql: sql.replace(/\?(\d+)/g, '@p$1'), args: Object.fromEntries(binds.map((v, i) => [`p${i + 1}`, v as string | number])) });
    const rows = (k: string, more: Partial<typeof ctx> & { ai?: boolean } = {}) => {
      const t = dataTableByKey[k]!;
      const s = tableSql(t, parseTableQuery(t, {}), { ...ctx, ...more });
      const n = named(s.sql, s.binds);
      return db.prepare(n.sql).all(n.args) as Record<string, unknown>[];
    };
    // A part stored as true or false reads as it is; one not named reads on, Patterns off (DEFAULT_COACH_SHARE); a share that is not JSON reads as
    // the defaults, as parseCoachShare does.
    const share = rows('lifeCoaches');
    expect(share.map((r) => [r._id, r.daily, r.patterns, r.reflection])).toEqual([['l3', 1, 0, 1], ['l2', 1, 0, 1], ['l1', 0, 1, 1]]);
    for (const r of share) {
      const raw = (db.prepare('SELECT share_json FROM coach_links WHERE id = ?').get(r._id as string) as { share_json: string }).share_json;
      const want = parseCoachShare(raw);
      for (const part of COACH_SHARE_PARTS) expect([r._id, part, r[part] === 1]).toEqual([r._id, part, want[part]]);
    }
    expect(share.map((r) => [r.coach, r.asker])).toEqual([['Coach Mo', 'you'], ['Coach Lee', 'team'], ['Coach Kim', 'them']]);
    // A code's state: used beats taken back, which beats expired (inviteStateOf), and only an open one's link works.
    expect(rows('inviteCodes').map((r) => [r._id, r.state, r.linkWorks, r.label])).toEqual([['c4', 'revoked', 0, null], ['c3', 'used', 0, null], ['c2', 'expired', 0, null], ['c1', 'open', 1, 'For Priya']]);
    // A plan whose time is up reads as ended with no plan credits left, before the account is read again; extras stay.
    expect(rows('plan').map((r) => [r._id, r.plan, r.running, r.planCredits, r.extraCredits])).toEqual([['plan', 'pro', 0, 0, 50]]);
    // Discover: the owner sees every finished result and add-on; AI chat only with Discover's own yes for the assistant, and how the mind works
    // only with its own switch too. A draft is never read.
    expect(rows('discoverResults').length).toBe(1);
    expect(rows('discoverAddOns').map((r) => r._id).sort()).toEqual(['mind', 'type']);
    expect(rows('discoverResults', { ai: true }).length).toBe(0);
    expect(rows('discoverAddOns', { ai: true }).length).toBe(0);
    db.exec(`INSERT INTO discover_settings (user_id, assistant, mind, updated_at) VALUES ('u1', 1, 0, 'x')`);
    expect(rows('discoverResults', { ai: true }).length).toBe(1);
    expect(rows('discoverAddOns', { ai: true }).map((r) => r._id)).toEqual(['type']);
    db.exec(`UPDATE discover_settings SET mind = 1`);
    expect(rows('discoverAddOns', { ai: true }).map((r) => r._id).sort()).toEqual(['mind', 'type']);
    db.close();
  });

  it('reads the coaching log one side a table, each page straight off its index, with a coach’s own invite lines on the coach’s side', async () => {
    const { DatabaseSync } = await import('node:sqlite');
    const db = new DatabaseSync(':memory:');
    db.exec(`CREATE TABLE users (id TEXT PRIMARY KEY, display_name TEXT, handle TEXT);
      CREATE TABLE coach_log (id TEXT PRIMARY KEY, link_id TEXT, coach_id TEXT NOT NULL, student_id TEXT NOT NULL, actor_id TEXT, action TEXT NOT NULL, label TEXT NOT NULL, target_id TEXT, before_json TEXT NOT NULL DEFAULT '', after_json TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL);
      CREATE INDEX coach_log_pair ON coach_log (coach_id, student_id, created_at);
      CREATE INDEX coach_log_student ON coach_log (student_id, created_at);
      ${read('../../../apps/api/migrations/0161_coach_log_coach_index.sql')}
      INSERT INTO users (id, display_name, handle) VALUES ('u1', 'Asha', 'asha'), ('k1', 'Coach Kim', 'kim'), ('s1', 'Ravi', 'ravi');
      INSERT INTO coach_log (id, coach_id, student_id, action, label, created_at) VALUES
        ('g1', 'k1', 'u1', 'link.ask', 'Coach Kim asked', '2026-11-01T00:00:00Z'),
        ('g2', 'k1', 'u1', 'link.yes', 'Asha said yes', '2026-11-02T00:00:00Z'),
        ('g3', 'u1', 's1', 'link.ask', 'Asha asked Ravi', '2026-11-03T00:00:00Z'),
        ('g4', 'u1', 'u1', 'invite.renew', 'Invite link renewed', '2026-11-04T00:00:00Z');`);
    const named = (sql: string, binds: readonly unknown[]) => ({ sql: sql.replace(/\?(\d+)/g, '@p$1'), args: Object.fromEntries(binds.map((v, i) => [`p${i + 1}`, v as string | number])) });
    const built = (k: string, q: Record<string, string> = {}) => tableSql(dataTableByKey[k]!, parseTableQuery(dataTableByKey[k]!, q), ctx);
    const plan = (k: string, q: Record<string, string> = {}) => {
      const n = named(`EXPLAIN QUERY PLAN ${built(k, q).sql}`, built(k, q).binds);
      return (db.prepare(n.sql).all(n.args) as { detail: string }[]).map((r) => r.detail).join(' | ');
    };
    const rows = (k: string) => {
      const n = named(built(k).sql, built(k).binds);
      return (db.prepare(n.sql).all(n.args) as Record<string, unknown>[]).map((r) => [r.person, r.step]);
    };
    for (const k of ['coachingLog', 'studentsLog']) {
      expect(plan(k), k).not.toMatch(/TEMP B-TREE|MULTI-INDEX/);
      expect(plan(k, { dir: 'asc' }), k).not.toMatch(/TEMP B-TREE/);
    }
    expect(plan('coachingLog')).toMatch(/coach_log_student/);
    expect(plan('studentsLog')).toMatch(/idx_coach_log_coach_created/);
    // As a student, the lines with a coach; as a coach, the lines with a student and the invite link's own, which name no one.
    expect(rows('coachingLog')).toEqual([['Coach Kim', 'link.yes'], ['Coach Kim', 'link.ask']]);
    expect(rows('studentsLog')).toEqual([[null, 'invite.renew'], ['Ravi', 'link.ask']]);
    db.close();
  });
});
