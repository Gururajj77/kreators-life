#!/usr/bin/env node
/**
 * The promise on /privacy and in CLAUDE.md: the export and the delete cover every table that holds what a person wrote or what is about them
 * (2026-11-07, when the cross-check added 77 tables to the export and 66 to the delete). Run by scripts/scan.sh; prints one line per problem and exits 1 when there is any.
 *
 * Every table with a column that names a person must have a line below. It says where the table lands in the export (`GET /me/export` in
 * apps/api/src/routes/me.ts) and what happens on delete (`deleteAccount` in apps/api/src/account.ts). A line is checked against the code:
 * - export: each named key must be in the export's list and read this table. `null` needs a reason (never a hash, a session or a live key).
 * - on delete: 'goes' needs a DELETE of the table in deleteAccount, 'wiped' an UPDATE of it, 'both' each, 'cascade' a foreign key from a parent
 *   that goes, 'stays' a reason (what other people or the books rely on; the row points at the "Deleted member" account, which has no name).
 *
 * `node scripts/data-coverage.mjs --table` prints the whole table, with what the erase of progress (`POST /me/reset`) does, as markdown.
 */
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');

// [table, export key or keys (null for none), on delete, why (needed for null, 'stays', and anything a reader would ask about)]
const COVERAGE = [
  ['agency_clients', 'agencyClients', 'goes', 'The link password hash and salt are left out of the export.'],
  ['agency_contracts', 'agencyContracts', 'goes'],
  ['agency_cycles', 'agencyCycles', 'goes'],
  ['agency_doc_comments', 'agencyDocComments', 'goes'],
  ['agency_doc_log', 'agencyDocLog', 'goes'],
  ['agency_docs', 'agencyDocs', 'goes'],
  ['agency_house_templates', 'houseTemplatesMade', 'wiped', 'A house template stays for everyone; only who made it goes.'],
  ['agency_items', 'agencyItems', 'goes'],
  ['agency_log', 'agencyLog', 'both', 'Lines on their own agency go; on someone else\'s, they stay there as "A former team member".'],
  ['agency_notes', ['agencyNotes', 'agencyNotesWritten'], 'both', 'Notes on their own agency go; a note on someone else\'s stays on that owner\'s books without who wrote it.'],
  ['agency_password_requests', 'agencyPasswordRequests', 'goes'],
  ['agency_retainers', 'agencyRetainers', 'goes'],
  ['agency_settings', 'agencySettings', 'goes'],
  ['agency_team', ['agencyTeam', 'agencyTeamsJoined'], 'goes'],
  ['agency_templates', 'agencyTemplates', 'goes'],
  ['agency_time', 'agencyTime', 'goes'],
  ['analytics_events', 'productEvents', 'goes'],
  ['app_logs', 'appLog', 'wiped', 'Thirty days, then gone. Their name comes off at once.'],
  ['application_events', 'applicationLog', 'both', 'Lines on their own application go; a reviewer\'s note stays without who wrote it.'],
  ['applications', 'applications', 'goes', 'A cover note and a portfolio. Nothing is paid through it.'],
  ['assessments', 'assessments', 'goes'],
  ['assistant_actions', 'assistantActions', 'goes'],
  ['assistant_runs', null, 'goes', 'Lives only while a message runs: an id and a time.'],
  ['attendance', 'attendance', 'goes'],
  ['attendee_claims', 'attendeeClaims', 'goes'],
  ['attendee_codes', 'attendeeCodesSet', 'goes', 'The code itself is a live key, so it is left out of the export.'],
  ['audit_logs', 'auditTrail', 'stays', 'The record of who did what, for accountability. The id points at the account with no name; the delete writes no name here.'],
  ['availability', 'availability', 'goes'],
  ['availability_overrides', 'availabilityOverrides', 'goes'],
  ['badge_awards', 'badgeAwards', 'goes'],
  ['badge_grants', 'badgeGrants', 'goes'],
  ['block_aliases', 'anonymousBlocks', 'goes', 'On either side. The export holds the made-up name only.'],
  ['blocks', 'blocks', 'goes', 'On either side.'],
  ['bond_chats', 'bondChats', 'stays', 'Made-up names and ids only; the other person keeps their own lines. The export never names the other person.'],
  ['bond_messages', 'bondMessages', 'goes'],
  ['bookings', 'bookings', 'wiped', 'For the books. A session still to come is cancelled and the other side told; the note, answers and meeting link come off.'],
  ['bounties', 'rewardsMade', 'stays', 'A brand brief entrants rely on. It shows the brand, never who posted it.'],
  ['bounty_submissions', 'rewardEntries', 'both', 'A paid entry stays, because the pool is added up from it, without its link or notes. Any other goes.'],
  ['brand_pieces', 'brandPieces', 'goes'],
  ['brand_sources', 'brandSources', 'goes'],
  ['brands', 'brands', 'goes'],
  ['broadcasts', 'broadcasts', 'goes'],
  ['calendar_feeds', 'calendarFeed', 'goes', 'The token is a live key, so it is left out of the export.'],
  ['call_requests', 'callRequests', 'both', 'An ask goes; a paid one stays for the books without who it was for.'],
  ['campaign_assignments', 'campaignRoles', 'goes', 'A role never taken goes. One taken stays on the brand\'s campaign with its fee, as its record.'],
  ['campaign_events', 'campaignLog', 'wiped', 'The brand\'s log. Their id and their name in "<name> accepted" come off.'],
  ['campaigns', 'campaignsOwned', 'wiped', 'The brand\'s. Only who owned it goes.'],
  ['card_unlocks', 'cardUnlocks', 'goes'],
  ['certificates', 'certificates', 'goes', 'A public page would otherwise check it under the deleted name.'],
  ['channel_members', 'channelSeats', 'goes'],
  ['channel_messages', 'channelLines', 'goes'],
  ['channels', 'channelsMade', 'goes', 'A private room goes with its owner. A public room a guide opened stays for the people in it.'],
  ['chat_messages', 'companionChat', 'goes'],
  ['circle_events', 'circlesMade', 'stays', 'Run by events staff as a team. It shows no name.'],
  ['circle_members', 'circleSeats', 'goes'],
  ['circle_messages', 'circleMessages', 'goes'],
  ['circle_signups', 'circleSignups', 'goes', 'Left in place, the next match would seat them at a table.'],
  ['coach_invites', 'coachInvite', 'goes', 'The token is a live key, so it is left out of the export.'],
  ['coach_links', 'coachLinks', 'wiped', 'Ended, on either side; the other person keeps that it ended.'],
  ['coach_log', 'coachLog', 'goes'],
  ['coach_notes', 'coachNotes', 'goes'],
  ['coach_prefs', 'coachPrefs', 'goes'],
  ['coach_profiles', 'coachProfile', 'goes'],
  ['cohort_talk', 'cohortTalkLines', 'both', 'A line others replied under keeps its place with its words wiped.'],
  ['cohort_talk_prefs', 'cohortTalkPrefs', 'goes'],
  ['cohorts', 'cohortsManaged', 'wiped', 'The learners\' and the team\'s. Only who managed it goes.'],
  ['community_likes', 'postReactions', 'goes'],
  ['community_mutes', 'mutes', 'goes'],
  ['community_post_follows', 'postsFollowed', 'goes'],
  ['community_posts', 'posts', 'goes'],
  ['community_replies', 'replies', 'goes'],
  ['community_reply_reactions', 'replyReactions', 'goes'],
  ['community_settings', null, 'stays', 'A setting for everyone, with the id of who last changed it. No words of theirs.'],
  ['consent_records', 'privacyChoiceLog', 'goes'],
  ['content_items', 'contentItems', 'goes'],
  ['contracts', 'contracts', 'goes'],
  ['copyright_notices', null, 'stays', 'A public form with no account behind it; goes three years after it is settled. It cannot be linked to a person.'],
  ['coupons', 'coupons', 'goes'],
  ['credit_accounts', 'creditAccount', 'stays', 'A money record for the books. Balances and dates only.'],
  ['credit_ledger', 'creditLedger', 'wiped', 'A money record for the books. Its note comes off.'],
  ['custom_reminders', 'customReminders', 'goes'],
  ['day_template_slots', 'dayTemplateSlots', 'goes'],
  ['day_templates', 'dayTemplates', 'goes'],
  ['day_types', 'dayTypes', 'goes'],
  ['decision_log', 'pitchLog', 'both', 'Goes with a pitch that goes. A reviewer\'s note stays and the screen says Staff.'],
  ['deliverable_versions', 'deliverableVersions', 'wiped', 'The work the brand reviewed: the link stays for the brand, their note comes off.'],
  ['discount_codes', 'discountCodesMade', 'stays', 'A team code everyone can use. The id of who made it, no name.'],
  ['discount_redemptions', 'discountRedemptions', 'goes'],
  ['discover_drafts', 'discoverDraft', 'goes'],
  ['discover_extras', 'discoverExtras', 'goes'],
  ['discover_results', 'discoverResults', 'goes'],
  ['discover_settings', 'discoverSettings', 'goes'],
  ['dm_automations', 'dmAutomations', 'goes', 'Goes first, or the app would go on sending under a deleted name.'],
  ['dm_requests', 'dmQuestions', 'goes', 'A buyer\'s question goes with its answer. On a seller\'s side it stays for the buyer who paid, and they are told if it is still open.'],
  ['dm_sends', 'dmSends', 'goes', 'The export has the public handle, status and time their own screen shows, never an outside id.'],
  ['email_outbox', 'emailsSent', 'goes', 'The export has the subject only: a body can hold a live link.'],
  ['enrollments', 'enrollments', 'goes'],
  ['event_feedback', 'eventFeedback', 'goes', 'Only ever read as a live average and count, so both stay true.'],
  ['event_messages', 'eventMessages', 'goes'],
  ['event_networking', 'eventNetworking', 'goes'],
  ['event_photos', 'eventPhotoLinks', 'goes'],
  ['event_registrations', 'eventSeats', 'wiped', 'A seat still to come is given up. A seat at one that is over stays for the host\'s records, left out of every list by liveUser.'],
  ['event_reminders', null, 'goes', 'Only that a reminder went, so it goes once.'],
  ['events', 'eventsHosted', 'both', 'One still to come is cancelled, guests told and paid back. With no guests ever it goes; with guests it keeps its name for their history and loses the words, place and link.'],
  ['feedback_items', 'deliverableFeedback', 'stays', 'A brand\'s comment on work, which the creator relies on. Their name is gone from the account it points at.'],
  ['finance_budgets', 'financeBudgets', 'goes'],
  ['finance_dues', 'financeDues', 'goes'],
  ['finance_goals', 'financeGoals', 'goes'],
  ['finance_recurring', 'financeRecurring', 'goes'],
  ['finance_transactions', 'finance', 'both', 'What they typed is their own record and goes. What an invoice booked stays beside the invoice without its words.'],
  ['fitness_prefs', 'fitnessPrefs', 'goes'],
  ['flag_overrides', 'appOverrides', 'goes', 'The ones about them. One they set about someone else keeps their id only.'],
  ['focus_prefs', 'focusPrefs', 'goes'],
  ['focus_rounds', 'focusRounds', 'goes'],
  ['follows', ['following', 'followers'], 'goes', 'On either side.'],
  ['friendships', 'friends', 'goes', 'On either side.'],
  ['funnels', 'funnels', 'goes'],
  ['gratitude_days', 'gratitude', 'goes'],
  ['gratitude_offers', 'gratitudeOffers', 'goes'],
  ['gratitude_prefs', 'gratitudePrefs', 'goes'],
  ['gratitude_seen', 'gratitudeSeen', 'goes'],
  ['honors', 'honors', 'goes'],
  ['introductions', 'introductions', 'goes', 'On either side.'],
  ['invoices', 'invoices', 'wiped', 'For the books, with the totals. Who it was for, the lines, the bank and the link come off, on every invoice.'],
  ['journal_entries', 'journal', 'goes'],
  ['kpi_prefs', 'kpiPrefs', 'goes'],
  ['kpi_values', 'kpiValues', 'goes'],
  ['kpis', 'kpis', 'goes'],
  ['kyc_profiles', 'payoutDetails', 'goes', 'The PAN hash is left out of the export.'],
  ['leads', ['leads', 'listsYouAreOn'], 'goes', 'They hold other people\'s names and emails, so they go with the account that gathered them. A lead with this person\'s own address, in someone else\'s list, goes too.'],
  ['lesson_progress', 'lessonProgress', 'goes'],
  ['link_clicks', 'linkClicks', 'goes', 'The export has counts by link and country, never an address hash or a browser.'],
  ['media_files', 'uploads', 'goes', 'The export lists a file without its bytes.'],
  ['media_items', 'mediaItems', 'goes', 'What they uploaded, and every link on what goes with them. A link they added to something that stays keeps its place.'],
  ['memberships', 'clubMembership', 'both', 'Their own goes. On someone else\'s, who managed or approved it comes off.'],
  ['nodes', 'nodes', 'goes'],
  ['not_to_do', 'notToDo', 'goes'],
  ['not_to_do_days', 'notToDoDays', 'cascade'],
  ['notifications', 'notifications', 'goes', 'Their own inbox. A note already in someone else\'s inbox keeps the words it was written with: it names no sender, so it cannot be found.'],
  ['onboarding_answers', 'onboardingAnswers', 'goes'],
  ['opportunities', 'opportunitiesPosted', 'stays', 'A brand\'s or the team\'s listing that applicants rely on. It shows the brand, never who posted it.'],
  ['orders', 'orders', 'wiped', 'For the books. What the buyer typed and their click id come off.'],
  ['organization_members', 'organizations', 'goes'],
  ['organizations', 'organizations', 'both', 'A brand with nothing and nobody else in it goes. Any other stays for its people without who started it.'],
  ['page_events', 'pageVisits', 'goes', 'The export has counts by kind and block.'],
  ['password_resets', null, 'goes', 'A hash of a live link. Never exported.'],
  ['placements', 'placements', 'goes'],
  ['points_ledger', 'points', 'stays', 'A money record for the books. Amounts and reasons only.'],
  ['portfolio_items', 'portfolio', 'goes'],
  ['preowned_listings', 'listings', 'both', 'Theirs go. On one they bought from someone else, who bought it comes off.'],
  ['preowned_messages', 'listingMessages', 'goes', 'Their lines, and a whole chat when they were its buyer.'],
  ['preowned_offers', 'offers', 'goes'],
  ['product_invites', 'productInvites', 'both', 'Theirs and their own course\'s go. One they sent to someone else\'s course loses who sent it.'],
  ['products', 'products', 'both', 'Never sold goes. Sold is archived and stays for the people who bought it.'],
  ['program_invites', 'programInvites', 'both', 'Theirs go. One they sent loses who sent it.'],
  ['programs', 'programsMade', 'wiped', 'Only the team makes a program, and learners rely on it. Only who made it goes.'],
  ['proposals', 'pitches', 'both', 'Still being read, or refused: goes. Said yes to: stays for the team\'s record with its stage and budget, without the title or the words.'],
  ['quiz_attempts', 'quizAttempts', 'goes'],
  ['rate_limits', null, 'goes', 'A count by id, or by a salted hash of an address or a typed email. Cleared after two days anyway, and at once for this account.'],
  ['redemptions', 'rewardReservations', 'wiped', 'For the books, with the points spent. A reservation is closed so no gear ships, and the note comes off.'],
  ['relationship_scores', 'pillarScores', 'goes'],
  ['reminder_prefs', 'reminderPrefs', 'goes'],
  ['research_runs', 'researchRuns', 'goes'],
  ['resources', 'knowledgeWritten', 'both', 'A draft goes. A published piece stays for readers without who wrote it.'],
  ['retired_coach_invites', null, 'goes', 'A hash of a closed link. Never exported.'],
  ['retired_portal_links', null, 'goes', 'A hash of a closed link. Never exported.'],
  ['review_schedules', 'reviewSchedules', 'goes'],
  ['review_templates', 'reviewTemplates', 'goes'],
  ['reviews', 'reviews', 'goes'],
  ['routine_days', 'routineDays', 'goes'],
  ['routines', 'routines', 'goes'],
  ['run_clubs', 'runClubsHosted', 'both', 'A club nobody else joined or ran with goes. Any other stays closed under its name without the host\'s words.'],
  ['run_collab_applications', 'collabApplications', 'goes'],
  ['run_collabs', 'collabsPosted', 'stays', 'A brand\'s offer clubs rely on. It shows the brand, never who posted it.'],
  ['run_discussion_reads', 'runDiscussionReads', 'goes'],
  ['run_entries', 'runEntries', 'goes'],
  ['run_members', 'runClubs', 'goes'],
  ['run_messages', 'runLines', 'goes'],
  ['runs', 'runsHosted', 'wiped', 'One still to come is cancelled, and the place it starts comes off. The code is a live key, so it is left out of the export.'],
  ['season_results', 'seasonResults', 'goes', 'A past board keeps its other places.'],
  ['sequence_sends', null, 'goes', 'Only that a message went, by order id.'],
  ['sequences', 'sequences', 'goes', 'Goes first, or the cron would go on sending under a deleted name.'],
  ['session_evictions', null, 'goes', 'A signed-out token. Never exported.'],
  ['sessions', null, 'goes', 'A session is never exported.'],
  ['social_metrics', 'rewardEntryNumbers', 'goes'],
  ['spark_completions', 'smallActs', 'goes'],
  ['store_items', 'storeItemsMade', 'wiped', 'The team\'s shelf. Only who added it goes.'],
  ['store_kits', 'storeKitsMade', 'wiped', 'The team\'s shelf. Only who made it goes.'],
  ['submission_feedback', 'handInFeedback', 'goes', 'On their own hand-in it goes. Feedback they wrote on someone else\'s stays, since that person relies on it.'],
  ['submissions', 'handIns', 'goes'],
  ['subtasks', 'subtasks', 'goes'],
  ['supplement_days', 'supplementDays', 'goes'],
  ['supplements', 'supplements', 'goes'],
  ['support_tickets', 'supportTickets', 'goes'],
  ['invite_codes', 'inviteCodes', 'wiped', 'A code they made that nobody used is taken back and every label they gave is cleared; a used code stays under the "Deleted member" row so it can never be used again. The code itself is never exported (a live key).'],
  ['waitlist', 'waitlist', 'both', 'Their row (by their email) goes; a decision they made as an admin stays without who made it.'],
  ['team_connections', 'teamConnections', 'both', 'A connection the team made with them goes; one they made as staff stays without who made it.'],
  ['team_link_sessions', null, 'goes', 'A hash of a session. Never exported.'],
  ['portal_sessions', null, 'goes', 'A hash of a session. Never exported.'],
  ['terms_acceptances', 'termsAcceptances', 'goes'],
  ['testimonials', ['reviewsWritten', 'reviewsReceived'], 'goes', 'A review goes rather than stay under no name: the words could point back at them. Ratings are read live, so a product\'s average stays true to the reviews left.'],
  ['time_blocks', 'timeBlocks', 'goes'],
  ['timeline_events', 'accountTimeline', 'stays', 'What happened to an order or an account, by id, with no words: a refund\'s reason comes off when either side of the order goes.'],
  ['tools', 'toolsSuggested', 'both', 'An unverified suggestion goes. A verified tool stays for everyone without who suggested it.'],
  ['tracked_links', 'trackedLinks', 'goes', 'The link stops working.'],
  ['user_consents', 'privacyChoices', 'goes'],
  ['users', ['accountDetails'], 'wiped', 'The row stays, named "Deleted member", so the books have someone to point at. Everything about the person comes off. The export also carries toUser as `user`; never the password hash or salt.'],
  ['water_logs', 'waterLogs', 'goes'],
  ['webhook_events', null, 'stays', 'A payment provider\'s raw message, with no account behind it; its text is cleared after a year. It cannot be linked to a person.'],
  ['week_patterns', 'weekPattern', 'goes'],
  ['wellbeing_logs', 'wellbeing', 'goes'],
  ['xp_events', 'xpEvents', 'goes'],
];

/** A column that names a person. A table with one must have a line above. */
const PERSON = /(^|_)(user|owner|author|buyer|seller|sender|member|coach|student|actor|requester|recipient|follower|blocker|blocked|host|manager|reviewer|learner|creator)(_user)?(_id)?$|_by$/;

// ---- the schema, from the migrations themselves
const dir = join(ROOT, 'apps/api/migrations');
const db = new DatabaseSync(':memory:');
db.exec('PRAGMA foreign_keys = OFF');
for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) db.exec(readFileSync(join(dir, f), 'utf8'));
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map((r) => r.name);
const columns = (t) => db.prepare(`PRAGMA table_info("${t}")`).all().map((c) => c.name);
const foreignKeys = (t) => db.prepare(`PRAGMA foreign_key_list("${t}")`).all();

// ---- the code
const account = readFileSync(join(ROOT, 'apps/api/src/account.ts'), 'utf8');
const me = readFileSync(join(ROOT, 'apps/api/src/routes/me.ts'), 'utf8');
const exportBlock = me.slice(me.indexOf("me.get('/export'"), me.indexOf('// Delete the account: personal'));
const resetBlock = me.slice(me.indexOf("me.post('/reset'"));
const exportKeys = new Map();
for (const m of exportBlock.matchAll(/\[\s*'(\w+)',\s*(['"])([\s\S]*?)\2\s*\],/g)) exportKeys.set(m[1], m[3]);
const verb = (sql, v, t) => new RegExp(`\\b${v}\\s+${t}\\b`).test(sql);
const deletes = (t) => verb(account, 'DELETE FROM', t);
const updates = (t) => verb(account, 'UPDATE', t);

const problems = [];
const lineOf = new Map(COVERAGE.map((row) => [row[0], row]));
for (const t of tables) if (columns(t).some((c) => PERSON.test(c)) && !lineOf.has(t)) problems.push(`${t}: it holds a person (${columns(t).filter((c) => PERSON.test(c)).join(', ')}). Say what the export and deleteAccount do with it, and give it a line in scripts/data-coverage.mjs.`);
for (const [t, keys, onDelete, why] of COVERAGE) {
  if (!tables.includes(t)) {
    problems.push(`${t}: has a line in scripts/data-coverage.mjs but no table in the migrations.`);
    continue;
  }
  if (keys === null && !why) problems.push(`${t}: not in the export, and no reason says why.`);
  for (const key of keys === null ? [] : [keys].flat()) {
    const sql = exportKeys.get(key);
    if (sql === undefined) problems.push(`${t}: the export has no key "${key}".`);
    else if (!new RegExp(`\\b${t}\\b`).test(sql)) problems.push(`${t}: the export key "${key}" does not read this table.`);
  }
  if (onDelete === 'stays' && !why) problems.push(`${t}: stays on delete, and no reason says why.`);
  if ((onDelete === 'goes' || onDelete === 'both') && !deletes(t)) problems.push(`${t}: said to go on delete, but deleteAccount has no DELETE FROM ${t}.`);
  if ((onDelete === 'wiped' || onDelete === 'both') && !updates(t)) problems.push(`${t}: said to be wiped on delete, but deleteAccount has no UPDATE ${t}.`);
  if (onDelete === 'cascade' && !foreignKeys(t).some((k) => k.on_delete === 'CASCADE' && deletes(k.table))) problems.push(`${t}: said to go by a foreign key, but no parent that goes cascades to it.`);
}

if (process.argv.includes('--table')) {
  const keysOf = (keys) => (keys === null ? 'no' : [keys].flat().join(', '));
  const eraseOf = (t) => (verb(resetBlock, 'DELETE FROM', t) ? 'goes' : verb(resetBlock, 'UPDATE', t) ? 'reset' : 'stays');
  console.log('| Table | In the export | On delete | On erase | Why |');
  console.log('| --- | --- | --- | --- | --- |');
  for (const [t, keys, onDelete, why] of [...COVERAGE].sort((a, b) => a[0].localeCompare(b[0]))) console.log(`| ${t} | ${keysOf(keys)} | ${onDelete} | ${eraseOf(t)} | ${why ?? ''} |`);
  const rest = tables.filter((t) => !lineOf.has(t));
  console.log(`\nNo person in them (${rest.length}): ${rest.join(', ')}`);
}
for (const p of problems) console.log(p);
process.exit(problems.length ? 1 : 0);
