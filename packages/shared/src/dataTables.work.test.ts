import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  APPLICATION_STATUS_OPTIONS,
  audienceOf,
  CAMPAIGN_EVENT_OPTIONS,
  CAMPAIGN_STATUS_OPTIONS,
  coachTableKeys,
  DATA_TABLES,
  dataTableByKey,
  editValue,
  listTables,
  OPPORTUNITY_TYPE_OPTIONS,
  parseTableQuery,
  PITCH_BUDGET_MAX_CENTS,
  plainCall,
  PROPOSAL_STAGE_OPTIONS,
  rowEditable,
  tableAllowed,
  tableColumn,
  tableReach,
  tableSql,
  type ColumnOption,
} from './dataTables';
import { APPLICATION_STATUSES, CAMPAIGN_STATUS_META, CAMPAIGN_STATUSES, OPPORTUNITY_TYPES, PROPOSAL_STAGES } from './index';

// All tables' fourth batch (2026-11-14, the founder: "ok, add them"): Work, Win, Army, TV, Fund and Club. Its own file, beside
// dataTables.test.ts, which holds the rules every table meets (the schema, the owner's index, secrets, routes and words); this one holds what is
// particular to these seventeen.

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const today = '2026-11-14';
const editable = (k: string) => dataTableByKey[k]!.columns.filter((col) => col.edit).map((col) => col.key);
const pairs = (o: readonly ColumnOption[]) => o.filter((x) => !x.isNull).map((x) => [x.value, x.label]);
const ctx = { view: 'owner' as const, ownerId: 'u1', viewerId: 'u1', today, zone: 'Asia/Kolkata' };

describe('All tables: Work, Win, Army, TV, Fund and Club (2026-11-14)', () => {
  // The person's own records, with nobody else's details or words in them: the old rules.
  const OWN = ['workListings', 'workApplications', 'workApplicationSteps', 'armyRoles', 'armyWorkSent', 'armyBrands', 'winRewards', 'winEntries', 'tvPitches', 'fundApplications', 'clubMembership'];
  // Another person's name or words: who applied to the person's listings, what a brand or the team wrote on their work, their brands' teams,
  // campaigns (the team's and staff's words, who on staff runs each) and campaign log (who did each step), and a Win reviewer's notes.
  const OTHERS = ['workApplicants', 'armyFeedback', 'armyBrandTeams', 'armyCampaigns', 'armyCampaignLog', 'winReviewerNotes'];
  const BATCH = [...OWN, ...OTHERS];

  it('holds every table, each with its audience and the app its records belong to', () => {
    for (const k of BATCH) expect(dataTableByKey[k], k).toBeTruthy();
    expect(DATA_TABLES.filter((t) => ['work', 'army', 'win', 'pitches', 'club'].includes(t.group)).map((t) => t.key).sort()).toEqual([...BATCH].sort());
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
    expect(Object.fromEntries(BATCH.map((k) => [k, dataTableByKey[k]!.needs ?? null]))).toEqual({
      workListings: ['work'], workApplicants: ['work'], workApplications: ['work'], workApplicationSteps: ['work'],
      armyRoles: ['army'], armyWorkSent: ['army'], armyFeedback: ['army'], armyBrandTeams: ['army'], armyCampaigns: ['army'], armyCampaignLog: ['army'],
      // A brand's team is used in Army, Work, Win and Kreators Run, and an ask is answered on the Profile tab: no one app.
      armyBrands: null,
      winRewards: ['win'], winEntries: ['win'], winReviewerNotes: ['win'],
      tvPitches: ['tv'], fundApplications: ['fund'], clubMembership: ['club'],
    });
    const keysFor = (on: string[]) => listTables('owner', [], on).flatMap((g) => g.tables.map((t) => t.key));
    expect(keysFor([])).toContain('armyBrands');
    for (const k of BATCH.filter((x) => x !== 'armyBrands')) expect(keysFor([]), k).not.toContain(k);
    expect(keysFor(['work'])).toEqual(expect.arrayContaining(['workListings', 'workApplicants', 'workApplications', 'workApplicationSteps']));
    expect(keysFor(['tv'])).toContain('tvPitches');
    expect(keysFor(['tv'])).not.toContain('fundApplications');
    expect(keysFor(['fund'])).toContain('fundApplications');
    expect(keysFor(['club'])).toContain('clubMembership');
    // Each category under the app group whose toggle it sits in, as the Apps page groups those apps.
    const appGroupOf = Object.fromEntries(listTables('owner', [], null).map((g) => [g.key, g.appGroup]));
    expect([appGroupOf.work, appGroupOf.army, appGroupOf.win, appGroupOf.pitches, appGroupOf.club]).toEqual(['earn', 'earn', 'earn', 'creator', 'community']);
  });

  it('says each kind and state in the app’s own words', () => {
    expect(OPPORTUNITY_TYPE_OPTIONS.map((o) => o.value)).toEqual([...OPPORTUNITY_TYPES]);
    // Work names a kind by its key with the underscore as a space (typeName), capitalised here.
    for (const o of OPPORTUNITY_TYPE_OPTIONS) expect(o.label.toLowerCase(), o.value).toBe(o.value.replace('_', ' '));
    expect(APPLICATION_STATUS_OPTIONS.map((o) => o.value)).toEqual([...APPLICATION_STATUSES]);
    for (const o of APPLICATION_STATUS_OPTIONS) expect(o.label.toLowerCase(), o.value).toBe(o.value);
    expect(pairs(CAMPAIGN_STATUS_OPTIONS)).toEqual(CAMPAIGN_STATUSES.map((k) => [k, CAMPAIGN_STATUS_META[k]]));
    expect(PROPOSAL_STAGE_OPTIONS.map((o) => o.value)).toEqual([...PROPOSAL_STAGES]);
    const proposals = read('../../../apps/web/src/screens/Proposals.tsx');
    for (const [v, label] of pairs(PROPOSAL_STAGE_OPTIONS)) expect(proposals, v).toContain(`${v}: '${label}'`);
    // An entry's state as Win says it (STATUS_LABEL), capitalised.
    const win = read('../../../apps/web/src/screens/Win.tsx');
    for (const [v, label] of pairs(dataTableByKey.winEntries!.columns.find((col) => col.key === 'status')!.options!)) expect(win.toLowerCase(), v).toContain(`${v}: '${label!.toLowerCase()}'`);
    // Every step Army's log records has words (logEvent in routes/army.ts).
    const army = read('../../../apps/api/src/routes/army.ts');
    const steps = new Set([...army.matchAll(/logEvent\(db, [^,]+, [^,]+, '(\w+)'/g)].map((m) => m[1]!));
    for (const s of ['created', 'deliverable', 'assignment', 'version', 'status']) expect(steps.has(s), s).toBe(true);
    for (const s of steps) expect(CAMPAIGN_EVENT_OPTIONS.some((o) => o.value === s), s).toBe(true);
    // A version's review reads approved or changes as the review route stores them.
    expect(army).toContain("oneOf(body.status, ['approved', 'changes'] as const, 'changes')");
  });

  it('never reads a reviewer’s or staff member’s id, a step’s note, a decision’s note or a teammate’s email', () => {
    const textOf = (k: string) => {
      const t = dataTableByKey[k]!;
      return [t.from, t.owner, t.where ?? '', t.idSql, ...t.columns.flatMap((col) => [col.sql ?? '', col.sortSql ?? '', col.searchSql ?? '', ...(col.sortTerms ?? [])]), ...Object.values(t.privateSelect ?? {})].join(' ');
    };
    for (const k of BATCH) {
      const text = textOf(k);
      expect(text, k).not.toMatch(/reviewer_id|approved_by|decision_note|decision_log|\bemail\b|recorded_by/);
      // Who took a step, runs a campaign or manages a membership is only joined for a name, or asked whether it is the person or anyone: never
      // a cell's id.
      for (const col of dataTableByKey[k]!.columns)
        for (const m of (col.sql ?? '').matchAll(/(actor_user_id|owner_user_id|manager_user_id|author_user_id|creator_user_id|submitted_by|created_by)(.{0,12})/g))
          expect(m[2], `${k}.${col.key} ${m[1]}`).toMatch(/^( IS (NOT )?NULL| = \?1 )/);
    }
    // A step's note on an application is the listing's words, which Work shows only in part: never read.
    expect(textOf('workApplicationSteps')).not.toMatch(/\bt\.note\b/);
    // A reviewer's note on an entry is its own table, for the person and AI chat on a model that keeps nothing; never in the entries.
    expect(textOf('winEntries')).not.toContain('evidence_note');
    expect(tableColumn(dataTableByKey.winReviewerNotes!, 'note')!.sql).toBe('t.evidence_note');
    expect(dataTableByKey.winReviewerNotes!.where).toBe("t.evidence_note <> ''");
    // The Club's manager shows only as whether there is one.
    expect(tableColumn(dataTableByKey.clubMembership!, 'manager')!.sql).toBe('(t.manager_user_id IS NOT NULL)');
    // An ask to join a brand that a block by name with an owner took away reads as none, as on the Profile tab.
    expect(dataTableByKey.armyBrands!.where).toMatch(/^\(t\.status = 'active' OR \(og\.status = 'active' AND NOT EXISTS \(SELECT 1 FROM organization_members ob WHERE/);
    expect(dataTableByKey.armyBrands!.where).toContain('bn.by_name = 1');
  });

  it('reads money kept in whole units as cents, in its own currency', () => {
    const cents: [string, string, string][] = [
      ['workListings', 'payFrom', 't.compensation_min * 100'],
      ['workListings', 'payTo', 't.compensation_max * 100'],
      ['armyRoles', 'fee', 't.fee_amount * 100'],
      ['armyCampaigns', 'budget', 't.budget_amount * 100'],
      ['tvPitches', 'budget', 't.budget_amount * 100'],
      ['fundApplications', 'budget', 't.budget_amount * 100'],
    ];
    for (const [k, col, sql] of cents) {
      const c = tableColumn(dataTableByKey[k]!, col)!;
      expect([c.kind, c.sql, c.currency], `${k}.${col}`).toEqual(['money', sql, 'currency']);
      expect(tableColumn(dataTableByKey[k]!, 'currency')?.hidden, k).toBe(true);
    }
  });

  it('changes only through Work’s and the pitches’ own routes, and only while the app would take it', () => {
    expect(editable('workListings')).toEqual(['status', 'clubOnly']);
    expect(editable('tvPitches')).toEqual(['title', 'budget', 'pitch']);
    expect(editable('fundApplications')).toEqual(['title', 'budget', 'pitch']);
    for (const k of BATCH.filter((x) => !['workListings', 'tvPitches', 'fundApplications'].includes(x))) {
      expect(editable(k), k).toEqual([]);
      expect(dataTableByKey[k]!.readOnlyWhy, k).toBeTruthy();
    }
    // A listing goes between Draft and Published from a draft or a closed one, as Work's Publish and Back to draft do in one tap; Close asks
    // first in Work, so it is never picked here, and a published listing is closed there.
    const listings = dataTableByKey.workListings!;
    const status = tableColumn(listings, 'status')!;
    expect(status.edit?.offer).toEqual(['draft', 'published']);
    expect(rowEditable(listings, status, { status: 'draft' }, today)).toBe(true);
    expect(rowEditable(listings, status, { status: 'closed' }, today)).toBe(true);
    expect(rowEditable(listings, status, { status: 'published' }, today)).toBe(false);
    expect(editValue(status, 'published')).toEqual({ value: 'published' });
    expect('error' in editValue(status, 'closed')).toBe(true);
    expect(plainCall(status, 'o1', { status: 'draft' }, 'published', today)).toEqual({ method: 'PATCH', path: '/work/opportunities/o1', body: { status: 'published' } });
    // Club only goes alone: the route keeps the listing's state when no state is sent.
    expect(plainCall(tableColumn(listings, 'clubOnly')!, 'o1', {}, true, today)).toEqual({ method: 'PATCH', path: '/work/opportunities/o1', body: { clubOnly: true } });
    const work = read('../../../apps/api/src/routes/work.ts');
    expect(work).toContain("const status = oneOf(body.status, ['draft', 'published', 'closed'] as const, prev.status);");
    expect(work).toContain("const clubOnly = typeof body.clubOnly === 'boolean' ? (body.clubOnly ? 1 : 0) : prev.club_only;");
    // A pitch changes only while the team has not started reading it, the whole set each time (the route takes all three), as the server builds it.
    const pitches = dataTableByKey.tvPitches!;
    for (const key of ['title', 'budget', 'pitch']) {
      const col = tableColumn(pitches, key)!;
      expect([col.edit?.recipe, col.edit?.when, col.edit?.path, col.edit?.method], key).toEqual(['pitchWhole', 'pitchWaiting', '/proposals/:id', 'PATCH']);
      expect(rowEditable(pitches, col, { stage: 'submitted' }, today), key).toBe(true);
      expect(rowEditable(pitches, col, { stage: 'review' }, today), key).toBe(false);
      expect(plainCall(col, 'p1', {}, 'x', today), key).toBeNull();
    }
    expect('error' in editValue(tableColumn(pitches, 'title')!, '  ')).toBe(true);
    expect('error' in editValue(tableColumn(pitches, 'budget')!, PITCH_BUDGET_MAX_CENTS + 100)).toBe(true);
    expect(editValue(tableColumn(pitches, 'budget')!, 125050)).toEqual({ value: 125050 });
    const proposals = read('../../../apps/api/src/routes/proposals.ts');
    expect(proposals).toContain("UPDATE proposals SET title = ?, pitch = ?, budget_amount = ?, updated_at = ? WHERE id = ? AND user_id = ? AND stage = 'submitted'");
    expect(proposals).toContain('Math.min(1e12, Math.round(cents / 100))');
    const route = read('../../../apps/api/src/routes/tables.ts');
    expect(route).toContain("case 'pitchWhole': {");
    expect(route).toContain('return { method: \'PATCH\', path: `/proposals/${encodeURIComponent(row.id)}`, body };');
    // A role on a campaign is answered in Army, beside its brief and terms: accepting is agreeing to them.
    expect(dataTableByKey.armyRoles!.readOnlyWhy).toMatch(/brief and terms/);
  });

  it('reads each page in an order an index serves, the owner first, and a pitch by its own kind', () => {
    const order = (k: string) => tableSql(dataTableByKey[k]!, parseTableQuery(dataTableByKey[k]!, {}), ctx).sql.split(' ORDER BY ')[1];
    expect(order('workApplicants')).toMatch(/^o\.created_at DESC, o\.rowid DESC, t\.submitted_at DESC, t\.rowid DESC, t\.id DESC LIMIT/);
    expect(order('workApplicationSteps')).toMatch(/^a\.updated_at DESC, a\.rowid DESC, t\.created_at DESC, t\.rowid DESC, t\.id DESC LIMIT/);
    expect(order('armyFeedback')).toMatch(/^v\.submitted_at DESC, v\.rowid DESC, t\.created_at DESC, t\.rowid DESC, t\.id DESC LIMIT/);
    expect(order('armyCampaignLog')).toMatch(/^m\.created_at DESC, m\.rowid DESC, cp\.updated_at DESC, cp\.rowid DESC, t\.created_at DESC, t\.rowid DESC, t\.id DESC LIMIT/);
    expect(order('workApplications')).toMatch(/^t\.updated_at DESC, t\.id DESC LIMIT/);
    expect(order('tvPitches')).toMatch(/^t\.updated_at DESC, t\.id DESC LIMIT/);
    expect(tableSql(dataTableByKey.tvPitches!, parseTableQuery(dataTableByKey.tvPitches!, {}), ctx).sql).toContain("t.user_id = ?1 AND t.kind = 'tv'");
    expect(tableSql(dataTableByKey.fundApplications!, parseTableQuery(dataTableByKey.fundApplications!, {}), ctx).sql).toContain("t.user_id = ?1 AND t.kind = 'fund'");
    // Each joined owner is an inner join: no row is read without the person on it.
    expect(dataTableByKey.workApplicants!.from).toMatch(/^applications t JOIN opportunities o ON/);
    expect(dataTableByKey.armyBrandTeams!.from).toMatch(/^organization_members t JOIN organization_members ow ON ow\.organization_id = t\.organization_id AND ow\.role = 'owner' AND ow\.status = 'active'/);
    for (const k of ['armyCampaigns', 'armyCampaignLog']) expect(dataTableByKey[k]!.from, k).toContain("JOIN organization_members m ON m.organization_id = ");
    const migration = read('../../../apps/api/migrations/0157_work_table_indexes.sql');
    for (const ix of [
      'opportunities (created_by, created_at)', 'applications (creator_user_id, updated_at)', 'applications (opportunity_id, submitted_at)',
      'application_events (application_id, created_at)', 'bounties (created_by, created_at)', 'campaign_assignments (creator_user_id, created_at)',
      'deliverable_versions (submitted_by, submitted_at)', 'feedback_items (deliverable_version_id, created_at)', 'campaigns (organization_id, updated_at)',
      'campaign_deliverables (campaign_id, created_at)', 'campaign_events (campaign_id, created_at)', 'organization_members (user_id, created_at)',
      'organization_members (organization_id, created_at)', 'proposals (user_id, kind, updated_at)',
    ]) expect(migration, ix).toContain(` ON ${ix};`);
  });
});
