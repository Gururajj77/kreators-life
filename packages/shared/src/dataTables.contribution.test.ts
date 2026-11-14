import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  AGENCY_TIME_MAX_MINUTES,
  CAMPAIGN_EVENT_OPTIONS,
  DATA_TABLES,
  dataTableByKey,
  editValue,
  parseTableQuery,
  plainCall,
  removeCallFor,
  removeCallOf,
  removeStateOf,
  rowEditable,
  rowFromRaw,
  tableColumn,
  tableEditable,
  tableSql,
  WORK_REVIEW_STEPS,
  WORK_WITHDRAW_SHUT,
  type DataTable,
  type RemoveCall,
} from './dataTables';
import { AGENCY_MAX_MINUTES } from './index';

// All tables' Edit and remove for the Contribution apps (2026-11-14, the founder: "all tables need to be editable ... each entry for the original
// user", with his decisions: records stay, greyed with why; a small personal row on a second tap, history or someone's access in a sheet; leave a
// cohort with no refund, turn down a program or course invite, withdraw a Win entry before review). Learning, Teaching, Work, Army, Win, Agency
// and Agency paperwork: every table either edits and removes through its app's own route, as the person, or says why not.

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const today = '2026-11-14';
const ctx = { view: 'owner' as const, ownerId: 'u1', viewerId: 'u1', today, zone: 'Asia/Kolkata' };
const GROUPS = ['learning', 'teaching', 'work', 'army', 'win', 'agency', 'agencyPaper'];
const t = (k: string): DataTable => dataTableByKey[k]!;
const callAt = (k: string, at: number): RemoveCall => removeCallOf(t(k).remove!, at)!;

describe('All tables: Edit and remove in the Contribution apps (2026-11-14)', () => {
  it('says how every table’s rows are edited and removed here, or why not', () => {
    const mine = DATA_TABLES.filter((x) => GROUPS.includes(x.group));
    expect(mine.length).toBe(36);
    for (const x of mine) {
      expect(tableEditable(x) || Boolean(x.noEditWhy), `${x.key} edit`).toBe(true);
      expect(Boolean(x.remove) || Boolean(x.noRemoveWhy), `${x.key} remove`).toBe(true);
    }
    const removes = Object.fromEntries(mine.filter((x) => x.remove).map((x) => [x.key, [x.remove!.verb, x.remove!.ask]]));
    expect(removes).toEqual({
      enrolments: ['Leave', 'sheet'],
      handIns: ['Withdraw', 'twice'],
      programInvites: ['Decline', 'sheet'],
      cohortLines: ['Take down', 'twice'],
      programsMade: ['Delete', 'sheet'],
      programInvitesSent: ['Withdraw', 'sheet'],
      workListings: ['Delete', 'sheet'],
      workApplications: ['Withdraw', 'sheet'],
      armyRoles: ['Decline', 'sheet'],
      armyBrands: ['Leave', 'sheet'],
      armyBrandTeams: ['Remove', 'sheet'],
      armyCampaigns: ['Cancel', 'sheet'],
      winRewards: ['Close', 'sheet'],
      winEntries: ['Withdraw', 'twice'],
      agencyClients: ['Delete', 'sheet'],
      agencyPieces: ['Delete', 'sheet'],
      agencyNotes: ['Delete', 'sheet'],
      agencyTime: ['Delete', 'sheet'],
      agencyRetainers: ['End', 'sheet'],
      agencyTeam: ['Remove', 'sheet'],
      agencyInvoices: ['Delete', 'sheet'],
      agencyAgreements: ['Delete', 'sheet'],
      agencyDocuments: ['Delete', 'sheet'],
      agencyTemplates: ['Delete', 'twice'],
    });
    // Records stay: a finished lesson, a quiz's score, a certificate, a check-in, an application's steps, work sent and feedback on it, the
    // campaign's and a client's logs, a reviewer's note, someone's application and a cohort's places.
    for (const k of ['lessonProgress', 'quizAttempts', 'certificates', 'attendance', 'workApplicationSteps', 'armyWorkSent', 'armyFeedback', 'armyCampaignLog', 'winReviewerNotes', 'agencyLog', 'workApplicants', 'cohortsRun'])
      expect(t(k).noRemoveWhy, k).toMatch(/^[A-Z].*\.$/);
  });

  it('keeps paid, signed and approved paper and a reviewed entry as they are, in the app’s own words', () => {
    const inv = t('agencyInvoices');
    expect(removeStateOf(inv, { status: 'draft' })).toEqual({ did: 'deleted', at: 0 });
    expect(removeStateOf(inv, { status: 'sent' })).toEqual({ did: 'voided', at: 1 });
    expect(removeStateOf(inv, { status: 'paid' })).toEqual({ why: 'Paid invoices stay for the books.' });
    expect(removeStateOf(inv, { status: 'void' })).toEqual({ why: 'A void invoice is void already.' });
    // A sent invoice is voided only while still sent: the route checks `ifStatus` against the state it reads, and setInvoiceStatus again.
    expect(removeCallFor(callAt('agencyInvoices', 1), 'i1', { status: 'sent' }, {}, today)).toEqual({ method: 'PATCH', path: '/agency/invoices/i1', body: { status: 'void', ifStatus: 'sent' } });
    const ag = t('agencyAgreements');
    expect(removeStateOf(ag, { status: 'draft' }, { _q0: 1 })).toEqual({ did: 'deleted', at: 0 });
    expect(removeStateOf(ag, { status: 'sent' }, { _q0: 0 })).toEqual({ did: 'voided', at: 1 });
    expect(removeStateOf(ag, { status: 'signed' }, { _q0: 0 })).toEqual({ why: 'A signed agreement is a record. Void it on its own page in Agency.' });
    expect(removeStateOf(ag, { status: 'void' }, { _q0: 0 })).toEqual({ why: 'It was signed before it was voided, so it stays for the books.' });
    expect(removeCallFor(callAt('agencyAgreements', 1), 'k1', {}, {}, today)?.body).toEqual({ status: 'void', ifStatus: 'sent' });
    expect(removeStateOf(t('agencyDocuments'), { status: 'approved' })).toEqual({ why: 'An approved document is a record, so it stays.' });
    expect(removeStateOf(t('agencyDocuments'), { status: 'sent' })).toHaveProperty('why');
    expect(removeStateOf(t('agencyDocuments'), { status: 'draft' })).toEqual({ did: 'deleted', at: 0 });
    for (const st of ['verified', 'paid', 'rejected', 'disputed']) expect(removeStateOf(t('winEntries'), { status: st }), st).toEqual({ why: 'A reviewer has looked at it, so it stays.' });
    expect(removeStateOf(t('winEntries'), { status: 'submitted' })).toEqual({ did: 'withdrawn', at: -1 });
    expect(removeStateOf(t('winRewards'), { status: 'paid' })).toEqual({ why: 'Its pool was paid out, so it stays as it ended.' });
    expect(removeStateOf(t('winRewards'), { status: 'open' })).toEqual({ did: 'closed', at: 0 });
    expect(removeStateOf(t('enrolments'), { status: 'completed' })).toEqual({ why: 'A program you finished stays as you finished it.' });
    expect(removeStateOf(t('enrolments'), { status: 'enrolled' })).toEqual({ did: 'left', at: 0 });
    expect(removeStateOf(t('armyRoles'), { status: 'accepted' })).toHaveProperty('why');
    expect(removeStateOf(t('armyRoles'), { status: 'offered' })).toEqual({ did: 'declined', at: -1 });
    for (const st of WORK_WITHDRAW_SHUT) expect(removeStateOf(t('workApplications'), { status: st }), st).toHaveProperty('why');
    expect(removeStateOf(t('workApplications'), { status: 'reviewing' })).toEqual({ did: 'withdrawn', at: -1 });
    expect(removeStateOf(t('armyCampaigns'), { stage: 'delivered' })).toHaveProperty('why');
    expect(removeStateOf(t('armyCampaigns'), { stage: 'brief' })).toEqual({ did: 'cancelled', at: 2 });
    expect(removeStateOf(t('agencyRetainers'), { status: 'chosen' })).toEqual({ did: 'withdrawn', at: 0 });
    expect(removeStateOf(t('agencyRetainers'), { status: 'active' })).toEqual({ did: 'ended', at: 1 });
    expect(removeStateOf(t('agencyRetainers'), { status: 'ended' })).toEqual({ why: 'It ended already.' });
    expect(removeStateOf(t('agencyTeam'), { status: 'removed' })).toEqual({ why: 'They are off the team already.' });
    expect(removeStateOf(t('programsMade'), { state: 'public' })).toHaveProperty('why');
    expect(removeStateOf(t('programsMade'), { state: 'archived' })).toEqual({ did: 'deleted', at: 0 });
    expect(removeStateOf(t('cohortLines'), { takenDown: true })).toEqual({ why: 'It is taken down already.' });
    expect(removeStateOf(t('armyBrandTeams'), { role: 'owner', status: 'active' })).toEqual({ why: 'An owner stays on the team.' });
    expect(removeStateOf(t('armyBrandTeams'), { role: 'member', status: 'invited' })).toEqual({ did: 'taken back', at: 1 });
  });

  it('builds each call from the row’s own ids, another person’s id only from a private field', () => {
    // The program's id is the owner's hidden cell (rows are keyed by their own number); the invited person's id is read by the server only.
    expect(removeCallFor(callAt('programInvitesSent', -1), '7', { programId: 'p1' }, { invitedId: 'u2' }, today)).toEqual({ method: 'DELETE', path: '/school/programs/p1/invites/u2' });
    expect(removeCallFor(callAt('programInvitesSent', -1), '7', { programId: 'p1' }, {}, today)).toBeNull();
    expect(t('programInvitesSent').privateSelect).toEqual({ invitedId: 't.user_id' });
    expect(removeCallFor(callAt('armyBrandTeams', 2), 'o1-4', { orgId: 'o1' }, { memberId: 'u2' }, today)).toEqual({ method: 'DELETE', path: '/orgs/o1/members/u2' });
    expect(t('armyBrandTeams').privateSelect).toEqual({ memberId: 't.user_id' });
    for (const [k, key] of [['programInvitesSent', 'invitedId'], ['armyBrandTeams', 'memberId']] as const) {
      expect(tableColumn(t(k), key), k).toBeUndefined();
      const { row, fields } = rowFromRaw(t(k), { _id: 'r', [`_p_${key}`]: 'u2' }, 'owner');
      expect(key in row.cells, k).toBe(false);
      expect(fields[key], k).toBe('u2');
    }
    expect(removeCallFor(callAt('programInvites', -1), '9', { programId: 'p1' }, {}, today)).toEqual({ method: 'DELETE', path: '/school/programs/p1/invite' });
    expect(removeCallFor(callAt('programsMade', 0), '9', { programId: 'p1' }, {}, today)).toEqual({ method: 'DELETE', path: '/school/programs/p1' });
    expect(removeCallFor(callAt('cohortLines', -1), '3', { cohortId: 'k1', lineId: 'l1' }, {}, today)).toEqual({ method: 'DELETE', path: '/school/cohorts/k1/talk/l1' });
    expect(removeCallFor(callAt('armyBrands', 0), 'o1', {}, {}, today)).toEqual({ method: 'POST', path: '/me/org-invites/o1/answer', body: { yes: false } });
    expect(removeCallFor(callAt('armyBrands', 1), 'o1', {}, {}, today)).toEqual({ method: 'DELETE', path: '/orgs/o1/membership' });
    expect(removeCallFor(callAt('enrolments', 0), 'e1', {}, {}, today)).toEqual({ method: 'POST', path: '/school/enrollments/e1/leave' });
    expect(removeCallFor(callAt('workApplications', -1), 'a1', {}, {}, today)).toEqual({ method: 'POST', path: '/work/applications/a1', body: { status: 'withdrawn' } });
    expect(removeCallFor(callAt('armyRoles', -1), 'r1', {}, {}, today)).toEqual({ method: 'POST', path: '/army/assignments/r1', body: { status: 'declined' } });
    // The ids that open something by themselves (a program, a cohort, a line, a brand, a reward) are hidden cells only the owner's read selects.
    for (const [k, cell] of [['programsMade', 'programId'], ['programInvites', 'programId'], ['programInvitesSent', 'programId'], ['cohortsRun', 'cohortId'], ['cohortLines', 'cohortId'], ['cohortLines', 'lineId'], ['armyBrandTeams', 'orgId'], ['winEntries', 'rewardId']] as const) {
      const col = tableColumn(t(k), cell)!;
      expect([col.hidden, col.ownerOnly], `${k}.${cell}`).toEqual([true, true]);
      for (const view of ['coach', 'admin'] as const) expect(tableSql(t(k), parseTableQuery(t(k), {}, view), { ...ctx, view, viewerId: 'v9' }).sql, `${k} ${view}`).not.toContain(`AS "${cell}"`);
    }
  });

  it('edits only what each app’s own route takes, in the words and limits it keeps', () => {
    const steps = tableColumn(t('workApplicants'), 'status')!;
    expect(steps.edit?.offer).toEqual(WORK_REVIEW_STEPS);
    expect(editValue(steps, 'selected')).toEqual({ value: 'selected' });
    expect('error' in editValue(steps, 'withdrawn')).toBe(true);
    expect(plainCall(steps, 'a1', {}, 'rejected', today)).toEqual({ method: 'POST', path: '/work/applications/a1', body: { status: 'rejected' } });
    const seats = tableColumn(t('cohortsRun'), 'seats')!;
    expect('error' in editValue(seats, 0)).toBe(true);
    expect('error' in editValue(seats, 1001)).toBe(true);
    expect(plainCall(seats, '4', { cohortId: 'k1' }, 30, today)).toEqual({ method: 'PATCH', path: '/school/cohorts/k1', body: { capacity: 30 } });
    expect(plainCall(seats, '4', {}, 30, today)).toBeNull();
    const shown = tableColumn(t('cohortLines'), 'shownAs')!;
    expect(plainCall(shown, '3', { cohortId: 'k1' }, 'public', today)).toEqual({ method: 'PUT', path: '/school/cohorts/k1/talk/me', body: { visibility: 'public' } });
    expect(AGENCY_TIME_MAX_MINUTES).toBe(AGENCY_MAX_MINUTES);
    const minutes = tableColumn(t('agencyTime'), 'minutes')!;
    expect('error' in editValue(minutes, 0)).toBe(true);
    expect('error' in editValue(minutes, AGENCY_MAX_MINUTES + 1)).toBe(true);
    expect(plainCall(minutes, 't1', {}, 90, today)).toEqual({ method: 'PATCH', path: '/agency/time/t1', body: { minutes: 90 } });
    expect(plainCall(tableColumn(t('agencyClients'), 'stage')!, 'c1', {}, 'agreementSent', today)).toEqual({ method: 'POST', path: '/agency/clients/c1/stage', body: { to: 'agreementSent' } });
    expect(tableColumn(t('agencyTeam'), 'role')!.edit?.offer).toEqual(['content_creator', 'videographer', 'editor']);
    expect('error' in editValue(tableColumn(t('agencyTeam'), 'role')!, 'client')).toBe(true);
    // An invoice's number and day change while a draft or sent, as its own page changes them; a paid or void one waits, in its words.
    const inv = t('agencyInvoices');
    for (const key of ['number', 'issued']) {
      const col = tableColumn(inv, key)!;
      expect(rowEditable(inv, col, { status: 'sent' }, today), key).toBe(true);
      expect(rowEditable(inv, col, { status: 'paid' }, today), key).toBe(false);
    }
    const link = tableColumn(t('winEntries'), 'link')!;
    expect(plainCall(link, 's1', { rewardId: 'b1' }, 'https://example.com/v', today)).toEqual({ method: 'POST', path: '/win/b1/submit', body: { url: 'https://example.com/v' } });
    expect(plainCall(tableColumn(t('agencyPieces'), 'link')!, 'p1', {}, '', today)).toEqual({ method: 'PATCH', path: '/agency/items/p1?day=2026-11-14', body: { link: '' } });
    // A reward's terms: every change is a new version every entrant hears of, so each column says so.
    for (const col of t('winRewards').columns) if (col.edit) expect(col.edit.path, col.key).toBe('/win/:id');
    expect(CAMPAIGN_EVENT_OPTIONS.some((o) => o.value === 'details')).toBe(true);
  });

  it('holds the routes to the rules the tables lean on: guarded writes, plain words, and a limit each', () => {
    const school = read('../../../apps/api/src/routes/school.ts');
    expect(school).toContain("UPDATE enrollments SET status = 'withdrawn' WHERE id = ? AND learner_user_id = ? AND status = 'enrolled'");
    expect(school).toContain("DELETE FROM submissions WHERE id = ?1 AND learner_user_id = ?2 AND status = 'submitted' AND NOT EXISTS (SELECT 1 FROM submission_feedback f WHERE f.submission_id = ?1)");
    expect(school).toContain('DELETE FROM program_invites WHERE program_id = ?1 AND user_id = ?2 AND NOT EXISTS');
    expect(school).toContain("UPDATE cohorts SET name = ?1, capacity = ?2 WHERE id = ?3 AND ?2 >= (SELECT COUNT(*) FROM enrollments e WHERE e.cohort_id = ?3 AND e.status != 'withdrawn')");
    const work = read('../../../apps/api/src/routes/work.ts');
    expect(work).toContain(`export const WITHDRAW_SHUT: readonly string[] = [${WORK_WITHDRAW_SHUT.map((s) => `'${s}'`).join(', ')}];`);
    expect(work).toContain("WHERE id = ? AND status = ?').bind(next, now, next, now, a.id, a.status)");
    expect(work).toContain("DELETE FROM opportunities WHERE id = ?1 AND status = 'draft' AND published_at IS NULL AND NOT EXISTS");
    // The tables offer what Work's own page offers: the reviewer's four steps, and Withdraw only where the page shows it.
    const screen = read('../../../apps/web/src/screens/Work.tsx');
    expect(screen).toContain(`const decisions: ApplicationStatus[] = [${WORK_REVIEW_STEPS.map((s) => `'${s}'`).join(', ')}];`);
    expect(screen).toContain(`{![${WORK_WITHDRAW_SHUT.map((s) => `'${s}'`).join(', ')}].includes(mine.status) && (`);
    const army = read('../../../apps/api/src/routes/army.ts');
    expect(army).toContain('terms_accepted_at = COALESCE(terms_accepted_at, ?) WHERE id = ? AND status = ?');
    expect(army).toContain('WHERE id = ? AND updated_at = ?');
    expect(army).toContain("await logEvent(db, prev.id, user.id, 'details'");
    const orgs = read('../../../apps/api/src/routes/orgs.ts');
    expect(orgs).toContain("orgs.delete('/:id/membership'");
    expect(orgs).toContain("(role != 'owner' OR (SELECT COUNT(*) FROM organization_members o WHERE o.organization_id = ?1 AND o.role = 'owner' AND o.status = 'active') > 1)");
    const win = read('../../../apps/api/src/routes/win.ts');
    expect(win).toContain("if (b.status === 'paid') return c.json({ error: 'Its pool was paid out, so it stays as it ended.' }, 409);");
    expect(win).toContain("DELETE FROM bounty_submissions WHERE id = ?1 AND user_id = ?2 AND status = 'submitted'");
    const agency = read('../../../apps/api/src/routes/agency.ts');
    expect(agency).toContain("agency.patch('/time/:id'");
    expect(agency).toContain('if (linkRefused(body)) return c.json({ error: AGENCY_LINK_PROBLEM }, 400);');
    const docs = read('../../../apps/api/src/routes/agencyDocs.ts');
    expect(docs.match(/typeof body\.ifStatus === 'string' && body\.ifStatus !== row\.status/g)?.length).toBe(2);
    expect(read('../../../apps/api/src/routes/finance.ts')).toContain('if (from !== undefined && prev.status !== from) return toInvoice(prev);');
    const limits = read('../../../apps/api/src/limits.ts');
    for (const [method, path] of [
      ['DELETE', '/school/programs/:id/invite'], ['POST', '/school/enrollments/:id/leave'], ['DELETE', '/school/submissions/:id'], ['PATCH', '/school/cohorts/:id'],
      ['PATCH', '/work/opportunities/:id'], ['DELETE', '/work/opportunities/:id'], ['DELETE', '/orgs/:id/membership'], ['DELETE', '/win/submissions/:id'],
      ['PATCH', '/agency/time/:id'],
    ] as const)
      expect(limits, `${method} ${path}`).toContain(`{ method: '${method}', path: '${path}', limit: `);
    // No new assistant tool: AI chat reads, never changes.
    const tools = read('../../../apps/api/src/assistant/tools.ts');
    for (const p of ['/enrollments/', '/school/submissions/', '/membership', '/win/submissions/', '/agency/time/', '/invite`']) expect(tools, p).not.toContain(p);
  });

  it('works each SQL rule out in the same read as the row, the owner’s rows only (in-memory SQLite)', async () => {
    const { DatabaseSync } = await import('node:sqlite');
    const db = new DatabaseSync(':memory:');
    const run = (sql: string, binds: readonly unknown[]) => db.prepare(sql.replace(/\?(\d+)/g, '@p$1')).all(Object.fromEntries(binds.map((v, i) => [`p${i + 1}`, v as string | number]))) as Record<string, unknown>[];
    const stateOf = (k: string, ids: string[]) => {
      const s = tableSql(t(k), { ...parseTableQuery(t(k), {}), count: false }, { ...ctx, ids, rules: true });
      return Object.fromEntries(run(s.sql, s.binds).map((r) => {
        const { row, fields } = rowFromRaw(t(k), r, 'owner');
        return [row.id, removeStateOf(t(k), row.cells, fields)];
      }));
    };
    db.exec(`
      CREATE TABLE agency_contracts (id TEXT, user_id TEXT, client_id TEXT, title TEXT, status TEXT, sent_at TEXT, signed_at TEXT, revised_at TEXT, updated_at TEXT, created_at TEXT, voided_from TEXT);
      CREATE TABLE agency_clients (id TEXT, user_id TEXT, name TEXT);
      CREATE TABLE opportunities (id TEXT, organization_id TEXT, created_by TEXT, title TEXT, opportunity_type TEXT, status TEXT, club_only INTEGER, location_mode TEXT, location_text TEXT, compensation_min INTEGER, compensation_max INTEGER, deadline TEXT, description TEXT, deliverables TEXT, eligibility TEXT, featured INTEGER, created_at TEXT, published_at TEXT, currency TEXT, skills_required TEXT);
      CREATE TABLE organizations (id TEXT, name TEXT, type TEXT, status TEXT);
      CREATE TABLE applications (id TEXT, opportunity_id TEXT, status TEXT);
      CREATE TABLE organization_members (organization_id TEXT, user_id TEXT, role TEXT, status TEXT, created_at TEXT);
      CREATE TABLE blocks (blocker_id TEXT, blocked_id TEXT, by_name INTEGER);
      CREATE TABLE program_invites (program_id TEXT, user_id TEXT, created_at TEXT);
      CREATE TABLE programs (id TEXT, name TEXT, published INTEGER, visibility TEXT);
      CREATE TABLE cohorts (id TEXT, program_id TEXT, name TEXT);
      CREATE TABLE enrollments (id TEXT, cohort_id TEXT, learner_user_id TEXT, status TEXT);
      CREATE TABLE agency_notes (id TEXT, user_id TEXT, item_id TEXT, author TEXT, author_id TEXT, kind TEXT, shared INTEGER, body TEXT, via_team_link INTEGER, created_at TEXT);
      CREATE TABLE agency_items (id TEXT, user_id TEXT, client_id TEXT, title TEXT);
      CREATE TABLE users (id TEXT, display_name TEXT);
    `);
    // Agreements: a draft and a void one never signed are deleted; one voided after signing stays; someone else's is never read.
    for (const [id, user, status, from] of [['d', 'u1', 'draft', null], ['v', 'u1', 'void', 'sent'], ['vs', 'u1', 'void', 'signed'], ['s', 'u1', 'sent', null], ['x', 'u2', 'draft', null]] as const)
      db.prepare('INSERT INTO agency_contracts (id, user_id, title, status, voided_from, updated_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, user, 'A', status, from, '2026-11-01', '2026-11-01');
    expect(stateOf('agencyAgreements', ['d', 'v', 'vs', 's', 'x'])).toEqual({
      d: { did: 'deleted', at: 0 },
      v: { did: 'deleted', at: 0 },
      vs: { why: 'It was signed before it was voided, so it stays for the books.' },
      s: { did: 'voided', at: 1 },
    });
    // A Work listing: deleted only while never published and nobody applied; a published one is closed.
    for (const [id, status, pub] of [['never', 'draft', null], ['applied', 'draft', null], ['once', 'draft', '2026-10-01'], ['live', 'published', '2026-10-01']] as const)
      db.prepare('INSERT INTO opportunities (id, created_by, title, status, published_at, created_at, club_only, featured) VALUES (?, ?, ?, ?, ?, ?, 0, 0)').run(id, 'u1', 'L', status, pub, '2026-11-01');
    db.prepare("INSERT INTO applications VALUES ('a1', 'applied', 'withdrawn')").run();
    expect(stateOf('workListings', ['never', 'applied', 'once', 'live'])).toEqual({
      never: { did: 'deleted', at: 0 },
      applied: { why: 'It was published once, so it stays. Its applications keep their history.' },
      once: { why: 'It was published once, so it stays. Its applications keep their history.' },
      live: { did: 'closed', at: 1 },
    });
    // A brand: an ask is turned down, a member leaves, and its only owner stays (a second owner may leave).
    db.exec("INSERT INTO organizations VALUES ('o1', 'One', 'brand', 'active'), ('o2', 'Two', 'brand', 'active'), ('o3', 'Three', 'brand', 'active'), ('o4', 'Four', 'brand', 'active')");
    db.exec(`INSERT INTO organization_members VALUES ('o1', 'u1', 'member', 'invited', '1'), ('o2', 'u1', 'member', 'active', '2'), ('o3', 'u1', 'owner', 'active', '3'),
      ('o4', 'u1', 'owner', 'active', '4'), ('o4', 'u3', 'owner', 'active', '5')`);
    expect(stateOf('armyBrands', ['o1', 'o2', 'o3', 'o4'])).toEqual({
      o1: { did: 'turned down', at: 0 },
      o2: { did: 'left', at: 1 },
      o3: { why: 'You are its only owner, so you stay with it.' },
      o4: { did: 'left', at: 1 },
    });
    // A program invite is declined only while no place in one of its cohorts was taken.
    db.exec("INSERT INTO programs VALUES ('p1', 'Open', 0, 'private'), ('p2', 'Joined', 0, 'private'); INSERT INTO cohorts VALUES ('k2', 'p2', 'K')");
    db.exec("INSERT INTO program_invites VALUES ('p1', 'u1', '1'), ('p2', 'u1', '2'); INSERT INTO enrollments VALUES ('e1', 'k2', 'u1', 'enrolled')");
    expect(stateOf('programInvites', ['1', '2'])).toEqual({ 1: { did: 'declined', at: -1 }, 2: { why: 'You joined one of its cohorts, so the invite stays.' } });
    // An Agency note: your own lines only, never your client's or a teammate's.
    db.exec(`INSERT INTO agency_notes (id, user_id, author, author_id, body, created_at) VALUES ('n1', 'u1', 'me', NULL, 'Mine', '1'), ('n2', 'u1', 'client', NULL, 'Theirs', '2'),
      ('n3', 'u1', 'team', 'u5', 'A teammate', '3'), ('n4', 'u1', 'team', 'u1', 'Mine for the team', '4')`);
    const notes = stateOf('agencyNotes', ['n1', 'n2', 'n3', 'n4']);
    expect(notes.n1).toEqual({ did: 'deleted', at: -1 });
    expect(notes.n4).toEqual({ did: 'deleted', at: -1 });
    for (const k of ['n2', 'n3']) expect(notes[k], k).toEqual({ why: 'A line someone else wrote stays as they wrote it.' });
  });

  it('works out a hand-in’s "no feedback yet" through an index, never every feedback line (the review of 2026-11-14)', async () => {
    const rule = t('handIns').remove?.only?.where ?? '';
    expect(rule).toContain('NOT EXISTS (SELECT 1 FROM submission_feedback f WHERE f.submission_id = t.id)');
    const { DatabaseSync } = await import('node:sqlite');
    const db = new DatabaseSync(':memory:');
    db.exec(`CREATE TABLE submissions (id TEXT PRIMARY KEY, learner_user_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'submitted');
      CREATE TABLE submission_feedback (id TEXT PRIMARY KEY, submission_id TEXT NOT NULL, reviewer_user_id TEXT NOT NULL, comment TEXT NOT NULL, grade TEXT, created_at TEXT NOT NULL);
      ${read('../../../apps/api/migrations/0169_submission_feedback_index.sql')}`);
    const plan = (sql: string) => (db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all() as { detail: string }[]).map((r) => r.detail).join(' | ');
    // Each row the owner's page shows, and the route's own guarded delete.
    expect(plan(`SELECT t.id, (${rule}) AS q FROM submissions t WHERE t.learner_user_id = 'u1'`)).toMatch(/SEARCH f USING (COVERING )?INDEX idx_submission_feedback_submission/);
    expect(plan(`SELECT 1 FROM submissions WHERE id = 's1' AND NOT EXISTS (SELECT 1 FROM submission_feedback f WHERE f.submission_id = 's1')`)).toMatch(/idx_submission_feedback_submission/);
  });
});
