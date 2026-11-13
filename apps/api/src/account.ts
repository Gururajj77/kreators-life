import { inBatches, nowIso } from './db';
import { noteStmt } from './notes';
import { limitKey, logEvent } from './ops';
import { cancelEventSeats } from './routes/party';
import { routeTurn } from './cronTick';
import { tripsOf } from './d1Batch';

/** The most round trips the seats of cancelled events take from a delete. The rest of what others wait on and the delete's own statements, about twelve trips, need the rest of the free plan's fifty. */
const SEATS_TRIPS = 20;
/** Past this, a host's clubs, sessions and paid questions have taken too much to go on to the delete in this invocation. */
const CLOSING_TRIPS = 30;

/** A host with more events and guests than one invocation can close. Every step can run twice, so asking again goes on from where this stopped. */
export class StillClosing extends Error {
  constructor() {
    super('There is a lot to close on this account. Tap delete again to go on.');
    this.name = 'StillClosing';
  }
}

/**
 * What others were waiting on from this person. An event, a run or a session still to come cannot happen without them, so it is cancelled
 * and whoever was coming is told, with the points paid for a ticket back. Each step can run twice: an event already cancelled goes on to its seats, and a
 * note has a fixed id, so asking again after a stop finishes the job and tells nobody twice.
 */
async function closeWhatOthersWaitOn(db: D1Database, userId: string): Promise<void> {
  const now = nowIso();
  // Every event still to come moves in one statement. Then the seats, as many as fit: a seat left open goes on the next ticks (`finishCancelledEvents`), each
  // guest once, whether or not the host is still here, so a host with a hundred guests never has to tap delete twice for them.
  await db.prepare("UPDATE events SET status = 'cancelled' WHERE host_user_id = ? AND status = 'published' AND ends_at >= ?").bind(userId, now).run();
  const events = await db
    .prepare("SELECT id, title FROM events e WHERE e.host_user_id = ? AND e.status = 'cancelled' AND e.ends_at >= ? AND EXISTS (SELECT 1 FROM event_registrations r WHERE r.event_id = e.id AND r.status IN ('registered','attended','waitlisted'))")
    .bind(userId, now)
    .all<{ id: string; title: string }>();
  const share = await routeTurn(db, () => tripsOf(db), SEATS_TRIPS)();
  for (const ev of events.results) {
    if (share.left() < 2) break;
    await cancelEventSeats(db, ev, share);
  }
  // A run club closes with its host, and its runs still to come with it. Its members are told once, by the club, before the club moves, so a stop in between tells them again by nobody.
  const clubs = await db.prepare("SELECT id, name FROM run_clubs WHERE host_user_id = ? AND status = 'active'").bind(userId).all<{ id: string; name: string }>();
  if (clubs.results.length) {
    const members = await db.prepare("SELECT club_id, user_id FROM run_members WHERE status = 'member' AND user_id != ? AND club_id IN (SELECT id FROM run_clubs WHERE host_user_id = ? AND status = 'active')").bind(userId, userId).all<{ club_id: string; user_id: string }>();
    const names = new Map(clubs.results.map((k) => [k.id, k.name]));
    await inBatches(db, members.results.map((m) => noteStmt(db, { id: `closed-club-${m.club_id}-${m.user_id}`, userId: m.user_id, kind: 'run', title: `Closed: ${names.get(m.club_id) ?? 'your run club'}`, body: 'The host closed their account, so the club and its runs still to come have stopped.', link: '/run' }, 'once')));
    await db.batch([
      db.prepare("UPDATE runs SET status = 'cancelled' WHERE status = 'published' AND starts_at >= ? AND club_id IN (SELECT id FROM run_clubs WHERE host_user_id = ?)").bind(now, userId),
      db.prepare("UPDATE run_clubs SET status = 'closed' WHERE host_user_id = ?").bind(userId),
    ]);
  }
  // Sessions still to come, on either side. The seller's buyer is told how to get their money back; the buyer's seller gets the time free.
  const seats = await db
    .prepare("SELECT k.id, k.owner_id, k.buyer_id, k.starts_at, p.title FROM bookings k JOIN products p ON p.id = k.product_id WHERE (k.owner_id = ?1 OR k.buyer_id = ?1) AND k.status IN ('requested','confirmed') AND k.starts_at >= ?2")
    .bind(userId, now)
    .all<{ id: string; owner_id: string; buyer_id: string; starts_at: string; title: string }>();
  await inBatches(db, seats.results.flatMap((s) => [
    db.prepare("UPDATE bookings SET status = 'cancelled' WHERE id = ?").bind(s.id),
    s.owner_id === userId
      ? noteStmt(db, { id: `closed-booking-${s.id}`, userId: s.buyer_id, kind: 'booking', title: `Cancelled: ${s.title}`, body: 'The host closed their account, so this session will not happen. If you paid, write to the team under Help.', link: '/library#bk-heading' }, 'once')
      : noteStmt(db, { id: `closed-booking-${s.id}`, userId: s.owner_id, kind: 'booking', title: 'A session was cancelled', body: new Date(s.starts_at).toUTCString(), link: '/shop/bookings' }, 'once'),
  ]));
  // A paid question that may now never be answered. The row stays for the buyer, who is told what to do.
  const asked = await db.prepare("SELECT d.id, d.buyer_id, p.title FROM dm_requests d JOIN products p ON p.id = d.product_id WHERE d.owner_id = ? AND d.status = 'open'").bind(userId).all<{ id: string; buyer_id: string; title: string }>();
  if (tripsOf(db) > CLOSING_TRIPS) throw new StillClosing();
  await inBatches(db, asked.results.map((d) => noteStmt(db, { id: `closed-dm-${d.id}`, userId: d.buyer_id, kind: 'dm', title: `Your question on ${d.title} may not get an answer`, body: 'The seller closed their account. If you paid, write to the team under Help.', link: '/library#dm-heading' }, 'once')));
}

/**
 * Delete an account. One place, used by the person themselves (Profile, delete) and by an admin from the People list. The rule for each table
 * is in scripts/data-coverage.mjs, which scripts/scan.sh holds to this list and to the export: what is private goes; what other people or the
 * books rely on stays with the person's name and words taken out (the row points at the "Deleted member" account, which keeps its id).
 *
 * Fifty statements to a round trip, and every one can run twice (a DELETE, or an UPDATE to fixed values). The account's own details and its
 * sessions go last, so a run that stops halfway leaves someone signed in who can simply ask again.
 */
export async function deleteAccount(db: D1Database, userId: string, env: { CLICK_SALT?: string }): Promise<void> {
  // The sign-in counts are kept under a salted hash of the email, which only this code can work out. Read now, since the last batch takes the email off.
  const account = await db.prepare('SELECT email FROM users WHERE id = ?').bind(userId).first<{ email: string | null }>();
  const emailKey = await limitKey(env, account?.email ?? '');
  await closeWhatOthersWaitOn(db, userId);
  await inBatches(db, [
    // First, while the address and the name are still on the account: the outbox keeps no mail for someone who is gone, a lead with their
    // own address in someone else's list goes, and their name comes off a campaign's log ("<name> accepted") before the role it is about.
    // Two statements, not one with an OR: each finds its rows through its own index.
    db.prepare('DELETE FROM email_outbox WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM email_outbox WHERE to_email = (SELECT email FROM users WHERE id = ?)').bind(userId),
    // A refund's reason on an order's timeline is in someone's own words, and can name them. The order stays for the books, without it.
    db.prepare("UPDATE timeline_events SET data_json = '' WHERE entity = 'order' AND type = 'order.refunded' AND entity_id IN (SELECT id FROM orders WHERE buyer_id = ?1 OR owner_id = ?1)").bind(userId),
    // A follow note someone holds keeps its words, but not a link to this person: their id leaves with them, and a stranger can take an old handle.
    db.prepare("UPDATE notifications SET link = NULL WHERE kind = 'follow' AND user_id IN (SELECT owner_id FROM follows WHERE follower_id = ?1) AND link IN ('/people/' || ?1, '/u/' || (SELECT handle FROM users WHERE id = ?1))").bind(userId),
    db.prepare('DELETE FROM leads WHERE lower(email) = (SELECT lower(email) FROM users WHERE id = ?)').bind(userId),
    db.prepare("UPDATE campaign_events SET note = replace(note, (SELECT display_name FROM users WHERE id = ?1), 'Deleted member') WHERE event_type = 'assignment' AND campaign_id IN (SELECT campaign_id FROM campaign_assignments WHERE creator_user_id = ?1)").bind(userId),
    // The pictures and videos on what is about to go, before the rows they hang from.
    db.prepare("DELETE FROM media_items WHERE owner_type = 'preowned' AND owner_id IN (SELECT id FROM preowned_listings WHERE seller_id = ?)").bind(userId),
    db.prepare("DELETE FROM media_items WHERE owner_type = 'event' AND owner_id IN (SELECT id FROM events WHERE host_user_id = ?)").bind(userId),
    db.prepare("DELETE FROM media_items WHERE owner_type = 'product' AND owner_id IN (SELECT id FROM products WHERE owner_id = ?1 AND id NOT IN (SELECT product_id FROM orders) AND id NOT IN (SELECT product_id FROM bookings))").bind(userId),
    // Events about the person go with them: what they did in the app (funnel counts) and the views and taps on their public page.
    db.prepare('DELETE FROM analytics_events WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM page_events WHERE owner_id = ?').bind(userId),
    db.prepare('DELETE FROM session_evictions WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM subtasks WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM nodes WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM media_files WHERE owner_id = ?').bind(userId),
    db.prepare('DELETE FROM water_logs WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM reminder_prefs WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM focus_prefs WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM calendar_feeds WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM custom_reminders WHERE user_id = ?').bind(userId),
    // Agency: the clients, deliverables, time, agreements and metrics go. An invoice stays for the books with the totals, and loses who it was for, the bank and the link.
    // The Agency team: every row where they own the agency or are on someone's team, then their name off what they did on others' agencies
    // (the lines and notes stay on the owner's books as "A former team member").
    db.prepare('DELETE FROM agency_team WHERE owner_id = ? OR member_id = ?').bind(userId, userId),
    // Connections the team made with them (Admin, Connect people) go; one they made as staff keeps its row without who made it. The audit
    // lines about those connections keep the fact and lose their words first (the two ids and the reason staff typed, which may name them).
    db.prepare("UPDATE audit_logs SET before_summary = '', after_summary = '' WHERE resource_type = 'team_connection' AND resource_id IN (SELECT id FROM team_connections WHERE first_user_id = ?1 OR second_user_id = ?1)").bind(userId),
    db.prepare('DELETE FROM team_connections WHERE first_user_id = ? OR second_user_id = ?').bind(userId, userId),
    db.prepare('UPDATE team_connections SET created_by = NULL WHERE created_by = ?').bind(userId),
    // Joining by invite (2026-11-10): a code they made that nobody used is taken back and every label they gave goes (it may name someone);
    // a used code stays, pointing at the "Deleted member" row, so it can never be used again. Their waitlist row (by their email, read
    // before the account row is wiped at the end) goes, and a waitlist decision they made loses who made it.
    db.prepare("UPDATE invite_codes SET revoked_at = COALESCE(revoked_at, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')), revoked_by = COALESCE(revoked_by, ?1) WHERE created_by = ?1 AND used_by IS NULL").bind(userId),
    db.prepare("UPDATE invite_codes SET label = '' WHERE created_by = ?").bind(userId),
    db.prepare('DELETE FROM waitlist WHERE email = (SELECT email FROM users WHERE id = ?)').bind(userId),
    db.prepare('UPDATE waitlist SET decided_by = NULL WHERE decided_by = ?').bind(userId),
    db.prepare('UPDATE agency_log SET actor_id = NULL WHERE actor_id = ?').bind(userId),
    db.prepare('UPDATE agency_notes SET author_id = NULL WHERE author_id = ?').bind(userId),
    db.prepare('DELETE FROM portal_sessions WHERE client_id IN (SELECT id FROM agency_clients WHERE user_id = ?)').bind(userId),
    db.prepare('DELETE FROM team_link_sessions WHERE client_id IN (SELECT id FROM agency_clients WHERE user_id = ?)').bind(userId),
    db.prepare('DELETE FROM retired_portal_links WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM agency_password_requests WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM agency_cycles WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM agency_retainers WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM agency_log WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM agency_doc_comments WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM agency_doc_log WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM agency_docs WHERE user_id = ?').bind(userId),
    // A house template the person made as the admin stays for everyone; only the pointer to who made it goes.
    db.prepare('UPDATE agency_house_templates SET created_by = NULL WHERE created_by = ?').bind(userId),
    db.prepare('DELETE FROM agency_templates WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM agency_contracts WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM agency_time WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM agency_notes WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM agency_items WHERE user_id = ?').bind(userId),
    // Every invoice, an Agency one or one from Finance's own route.
    db.prepare("UPDATE invoices SET client_name = 'Deleted client', client_email = '', items_json = '[]', note = '', doc_json = '{}', agency_client_id = NULL, agency_cycle_id = NULL, token = 'GONE' || hex(randomblob(8)) WHERE user_id = ?").bind(userId),
    db.prepare('DELETE FROM agency_clients WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM agency_settings WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM kpi_values WHERE kpi_id IN (SELECT id FROM kpis WHERE user_id = ?)').bind(userId),
    db.prepare('DELETE FROM kpis WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM kpi_prefs WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM discount_redemptions WHERE user_id = ?').bind(userId),
    db.prepare("DELETE FROM media_items WHERE added_by = ? AND url LIKE '/api/public/media/%'").bind(userId),
    // Chat channels: a private room the person owns goes with them, then their lines and seats everywhere else.
    db.prepare("DELETE FROM channel_messages WHERE channel_id IN (SELECT id FROM channels WHERE scope = 'bond' AND created_by = ?)").bind(userId),
    db.prepare("DELETE FROM channel_members WHERE channel_id IN (SELECT id FROM channels WHERE scope = 'bond' AND created_by = ?)").bind(userId),
    db.prepare("DELETE FROM channels WHERE scope = 'bond' AND created_by = ?").bind(userId),
    db.prepare('DELETE FROM channel_messages WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM channel_members WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM event_messages WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM run_messages WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM run_discussion_reads WHERE user_id = ?').bind(userId),
    // School cohort discussions: their lines go, except that a line others replied under keeps its place with its words wiped,
    // so the replies stay where they were. How they chose to appear in each cohort goes too.
    db.prepare('DELETE FROM cohort_talk WHERE user_id = ? AND id NOT IN (SELECT parent_id FROM cohort_talk WHERE parent_id IS NOT NULL)').bind(userId),
    db.prepare("UPDATE cohort_talk SET body = '', deleted_at = COALESCE(deleted_at, ?), deleted_by = COALESCE(deleted_by, ?) WHERE user_id = ?").bind(nowIso(), userId, userId),
    db.prepare('DELETE FROM cohort_talk_prefs WHERE user_id = ?').bind(userId),
    // Invites to private School programs: theirs go, and an invite they sent stays without who sent it.
    db.prepare('DELETE FROM program_invites WHERE user_id = ?').bind(userId),
    db.prepare('UPDATE program_invites SET invited_by = NULL WHERE invited_by = ?').bind(userId),
    db.prepare('DELETE FROM event_networking WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM community_mutes WHERE user_id = ?').bind(userId),
    // Blocks on either side: nobody keeps a "Deleted member" on their list, and there is no one left to block.
    db.prepare('DELETE FROM block_aliases WHERE blocker_id = ?1 OR blocked_id = ?1').bind(userId),
    db.prepare('DELETE FROM blocks WHERE blocker_id = ?1 OR blocked_id = ?1').bind(userId),
    db.prepare('DELETE FROM not_to_do WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM day_types WHERE user_id = ?').bind(userId),
    // Time blocks (migration 0089): the slots first, then the pattern, the templates and the blocks.
    db.prepare('DELETE FROM day_template_slots WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM week_patterns WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM day_templates WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM time_blocks WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM reviews WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM review_templates WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM review_schedules WHERE user_id = ?').bind(userId),
    // Pre-owned gear: theirs goes, and on someone else's listing they were the buyer of, the listing stays and loses who bought it. A
    // chat with a buyer who is gone goes whole, so a seller never keeps a thread with a "Deleted member".
    db.prepare('DELETE FROM preowned_listings WHERE seller_id = ?').bind(userId),
    db.prepare('DELETE FROM preowned_offers WHERE buyer_id = ?').bind(userId),
    db.prepare('UPDATE preowned_listings SET buyer_id = NULL WHERE buyer_id = ?').bind(userId),
    db.prepare('DELETE FROM preowned_messages WHERE buyer_id = ?').bind(userId),
    db.prepare('DELETE FROM run_entries WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM run_members WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM run_collab_applications WHERE user_id = ?').bind(userId),
    // A club nobody else joined or ran with goes whole. Any other stays closed under its name, so the runs its members logged still read,
    // with the host's words (what it is, when it meets, where a run starts) taken out.
    db.prepare("DELETE FROM event_photos WHERE set_by = ?1 OR (app = 'party' AND event_id IN (SELECT id FROM events WHERE host_user_id = ?1)) OR (app = 'run' AND event_id IN (SELECT r.id FROM runs r JOIN run_clubs k ON k.id = r.club_id WHERE k.host_user_id = ?1))").bind(userId),
    db.prepare('DELETE FROM run_clubs WHERE host_user_id = ?1 AND id NOT IN (SELECT club_id FROM run_members WHERE user_id != ?1) AND id NOT IN (SELECT club_id FROM run_entries WHERE user_id != ?1)').bind(userId),
    db.prepare("UPDATE runs SET meeting_point = '' WHERE club_id IN (SELECT id FROM run_clubs WHERE host_user_id = ?)").bind(userId),
    db.prepare("UPDATE run_clubs SET status = 'closed', description = '', meets = '' WHERE host_user_id = ?").bind(userId),
    db.prepare('DELETE FROM wellbeing_logs WHERE user_id = ?').bind(userId),
    // Supplements in Fitness (migration 0104): the ticks, the list and the switches.
    db.prepare('DELETE FROM supplement_days WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM supplements WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM fitness_prefs WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM journal_entries WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM gratitude_days WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM gratitude_offers WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM gratitude_seen WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM gratitude_prefs WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM chat_messages WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM notifications WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM portfolio_items WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM kyc_profiles WHERE user_id = ?').bind(userId),
    // The strategy session: the map, the scores, the routine and the contract.
    db.prepare('DELETE FROM assessments WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM placements WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM routines WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM contracts WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM routine_days WHERE user_id = ?').bind(userId),
    // An ask for the live call goes; one that was paid stays for the books with its amount and loses who it was for.
    db.prepare("DELETE FROM call_requests WHERE user_id = ? AND status NOT IN ('paid', 'booked', 'done')").bind(userId),
    db.prepare('UPDATE call_requests SET user_id = NULL WHERE user_id = ?').bind(userId),
    // The content strategist's folders hold research and drafts about the person's brands: they go too.
    db.prepare('DELETE FROM brand_pieces WHERE brand_id IN (SELECT id FROM brands WHERE owner_id = ?)').bind(userId),
    db.prepare('DELETE FROM research_runs WHERE brand_id IN (SELECT id FROM brands WHERE owner_id = ?)').bind(userId),
    db.prepare('DELETE FROM brand_sources WHERE brand_id IN (SELECT id FROM brands WHERE owner_id = ?)').bind(userId),
    db.prepare('DELETE FROM brands WHERE owner_id = ?').bind(userId),
    // What the assistant did goes; the credit ledger stays, like the money rows, for the books.
    db.prepare('DELETE FROM assistant_actions WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM assistant_runs WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM attendee_claims WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM card_unlocks WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM badge_grants WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM badge_awards WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM focus_rounds WHERE user_id = ?').bind(userId),
    db.prepare("UPDATE app_logs SET actor_id = NULL, actor_name = 'Deleted member' WHERE actor_id = ?").bind(userId),
    db.prepare('DELETE FROM discover_drafts WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM discover_settings WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM discover_results WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM discover_extras WHERE user_id = ?').bind(userId),
    // Coaching ends with the account, on either side, and its notes, change log and coach line go with it.
    db.prepare("UPDATE coach_links SET status = 'ended', ended_at = ?, ended_by = ? WHERE (coach_id = ? OR student_id = ?) AND status IN ('pending','active')").bind(nowIso(), userId, userId, userId),
    db.prepare('DELETE FROM coach_notes WHERE coach_id = ? OR student_id = ?').bind(userId, userId),
    db.prepare('DELETE FROM coach_log WHERE coach_id = ? OR student_id = ?').bind(userId, userId),
    db.prepare('DELETE FROM coach_profiles WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM coach_prefs WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM coach_invites WHERE coach_id = ?').bind(userId),
    db.prepare('DELETE FROM retired_coach_invites WHERE coach_id = ?').bind(userId),
    db.prepare('DELETE FROM community_post_follows WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM community_reply_reactions WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM event_reminders WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM terms_acceptances WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM user_consents WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM consent_records WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM community_replies WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM community_posts WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM bond_messages WHERE user_id = ?').bind(userId),
    // Nobody keeps a "Deleted member" as a friend, an open request or a Club member, and a seat at an event still to come is
    // given up; a seat at one that is over stays for the host's records (and is left out of every list by `liveUser`).
    db.prepare('DELETE FROM friendships WHERE requester_id = ?1 OR recipient_id = ?1').bind(userId),
    db.prepare('DELETE FROM follows WHERE follower_id = ?1 OR owner_id = ?1').bind(userId),
    db.prepare('DELETE FROM introductions WHERE requester_user_id = ?1 OR recipient_user_id = ?1').bind(userId),
    db.prepare('DELETE FROM community_likes WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM memberships WHERE user_id = ?').bind(userId),
    db.prepare('UPDATE memberships SET manager_user_id = NULL WHERE manager_user_id = ?').bind(userId),
    db.prepare('UPDATE memberships SET approved_by = NULL WHERE approved_by = ?').bind(userId),
    db.prepare("UPDATE event_registrations SET status = 'cancelled' WHERE user_id = ? AND status IN ('registered','waitlisted') AND event_id IN (SELECT id FROM events WHERE ends_at >= ?)").bind(userId, nowIso()),
    db.prepare('UPDATE event_registrations SET networking_opt_in = 0 WHERE user_id = ?').bind(userId),
    // A rating left on an event is only ever read as an average and a count, both live, so they stay true without it.
    db.prepare('DELETE FROM event_feedback WHERE user_id = ?').bind(userId),
    // An event of theirs that nobody ever signed up for goes. One with guests keeps its name, so their history still reads, and loses the
    // host's words, place and link. Its code goes either way.
    db.prepare("DELETE FROM attendee_codes WHERE app = 'party' AND thing_id IN (SELECT id FROM events WHERE host_user_id = ?)").bind(userId),
    db.prepare('DELETE FROM events WHERE host_user_id = ? AND id NOT IN (SELECT event_id FROM event_registrations)').bind(userId),
    db.prepare("UPDATE events SET description = '', venue = '', online_url = NULL WHERE host_user_id = ?").bind(userId),
    db.prepare('DELETE FROM circle_messages WHERE user_id = ?').bind(userId),
    // Circles: the sign-up note and the seat. Left in place, a sign-up would be seated at a table by the next match.
    db.prepare('DELETE FROM circle_signups WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM circle_members WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM preowned_messages WHERE sender_id = ?').bind(userId),
    db.prepare('DELETE FROM support_tickets WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM finance_dues WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM finance_goals WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM finance_recurring WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM finance_budgets WHERE user_id = ?').bind(userId),
    // Finance entries they typed are their own record, not the books, so they go. What came from an invoice stays beside the invoice and
    // loses its words (its note names the client).
    db.prepare("DELETE FROM finance_transactions WHERE user_id = ? AND source IN ('manual', 'recurring', 'due')").bind(userId),
    db.prepare("UPDATE finance_transactions SET note = '', counterparty = '', splits_json = '[]' WHERE user_id = ?").bind(userId),
    db.prepare("UPDATE credit_ledger SET note = '' WHERE user_id = ?").bind(userId),
    // A reward reservation nobody will collect is closed, no gear ships and the points stay spent (the ledger keeps the line).
    db.prepare("UPDATE redemptions SET status = 'cancelled', updated_at = ? WHERE user_id = ? AND status = 'reserved'").bind(nowIso(), userId),
    db.prepare("UPDATE redemptions SET note = '' WHERE user_id = ?").bind(userId),
    // The Shop. Reviews they wrote go rather than stay under no name: the words are theirs and could point back at them, and a blank star
    // nobody can read proves nothing. No rating is stored anywhere (a product's average and a seller's trust are read live from the rows
    // left), so the rating stays true to the reviews still there.
    db.prepare('DELETE FROM testimonials WHERE author_id = ?').bind(userId),
    db.prepare('DELETE FROM leads WHERE owner_id = ?').bind(userId),
    db.prepare('DELETE FROM broadcasts WHERE owner_id = ?').bind(userId),
    // Sequences and automations go first, or the cron would go on sending under a deleted name.
    db.prepare('DELETE FROM sequence_sends WHERE sequence_id IN (SELECT id FROM sequences WHERE owner_id = ?)').bind(userId),
    db.prepare('DELETE FROM sequences WHERE owner_id = ?').bind(userId),
    db.prepare('DELETE FROM dm_sends WHERE automation_id IN (SELECT id FROM dm_automations WHERE owner_id = ?)').bind(userId),
    db.prepare('DELETE FROM dm_automations WHERE owner_id = ?').bind(userId),
    // Through the link, whose index holds them: a click's owner is its link's.
    db.prepare('DELETE FROM link_clicks INDEXED BY idx_clicks_link WHERE link_id IN (SELECT id FROM tracked_links WHERE owner_id = ?)').bind(userId),
    db.prepare('DELETE FROM tracked_links WHERE owner_id = ?').bind(userId),
    db.prepare('DELETE FROM content_items WHERE owner_id = ?').bind(userId),
    db.prepare('DELETE FROM funnels WHERE owner_id = ?').bind(userId),
    db.prepare('DELETE FROM coupons WHERE owner_id = ?').bind(userId),
    db.prepare('DELETE FROM availability WHERE owner_id = ?').bind(userId),
    db.prepare('DELETE FROM availability_overrides WHERE owner_id = ?').bind(userId),
    // What they asked or typed as a buyer. The order stays for the books; a question goes with its answer, which was for them.
    db.prepare('DELETE FROM dm_requests WHERE buyer_id = ?').bind(userId),
    db.prepare("UPDATE orders SET intake_json = '[]', refund_reason = '', click_id = NULL WHERE buyer_id = ?").bind(userId),
    db.prepare("UPDATE bookings SET note = '', intake_json = '[]' WHERE buyer_id = ?").bind(userId),
    db.prepare('UPDATE bookings SET meeting_url = NULL WHERE owner_id = ?').bind(userId),
    db.prepare('DELETE FROM certificates WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM lesson_progress WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM quiz_attempts WHERE user_id = ?').bind(userId),
    // What they sell: never sold goes, sold is archived and stays for the people who bought it.
    db.prepare('DELETE FROM products WHERE owner_id = ?1 AND id NOT IN (SELECT product_id FROM orders) AND id NOT IN (SELECT product_id FROM bookings)').bind(userId),
    db.prepare("UPDATE products SET status = 'archived' WHERE owner_id = ?").bind(userId),
    // Private courses: their invites, and the invite list of their own courses, go with the account; an invite they sent to
    // someone else's course stays for that course and loses who sent it.
    db.prepare('DELETE FROM product_invites WHERE user_id = ?1 OR product_id IN (SELECT id FROM products WHERE owner_id = ?1)').bind(userId),
    db.prepare('UPDATE product_invites SET invited_by = NULL WHERE invited_by = ?').bind(userId),
    // School: their place in a cohort and all they handed in (the feedback on it goes too). Feedback they wrote on someone else's stays,
    // since that person relies on it. A program or a cohort they ran stays for the learners and the team, without them.
    db.prepare('DELETE FROM submission_feedback WHERE submission_id IN (SELECT id FROM submissions WHERE learner_user_id = ?)').bind(userId),
    db.prepare('DELETE FROM submissions WHERE learner_user_id = ?').bind(userId),
    db.prepare('DELETE FROM attendance WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM enrollments WHERE learner_user_id = ?').bind(userId),
    db.prepare('UPDATE cohorts SET manager_user_id = NULL WHERE manager_user_id = ?').bind(userId),
    db.prepare('UPDATE programs SET created_by = NULL WHERE created_by = ?').bind(userId),
    // Work: an application is their cover note and portfolio, and nothing is paid through it, so it goes.
    db.prepare('DELETE FROM application_events WHERE application_id IN (SELECT id FROM applications WHERE creator_user_id = ?)').bind(userId),
    db.prepare('DELETE FROM applications WHERE creator_user_id = ?').bind(userId),
    db.prepare('UPDATE application_events SET actor_user_id = NULL WHERE actor_user_id = ?').bind(userId),
    // Content rewards: an entry that was paid stays, because the reward's pool is added up from it, without its link or what was written
    // on it. Any other goes.
    db.prepare('DELETE FROM social_metrics WHERE submission_id IN (SELECT id FROM bounty_submissions WHERE user_id = ?)').bind(userId),
    db.prepare("DELETE FROM bounty_submissions WHERE user_id = ? AND status != 'paid'").bind(userId),
    db.prepare("UPDATE bounty_submissions SET url = '', evidence_note = '', dispute_note = '' WHERE user_id = ?").bind(userId),
    // TV and Fund: a pitch still being read, or refused, goes. One the team said yes to stays for the team's record, with its stage, budget
    // and decisions, and without the person's title or words. Their name comes off notes they wrote as a reviewer (the screen says Staff).
    db.prepare("DELETE FROM decision_log WHERE proposal_id IN (SELECT id FROM proposals WHERE user_id = ? AND stage IN ('submitted', 'review', 'diligence', 'rejected'))").bind(userId),
    db.prepare("DELETE FROM proposals WHERE user_id = ? AND stage IN ('submitted', 'review', 'diligence', 'rejected')").bind(userId),
    db.prepare("UPDATE proposals SET title = 'Deleted pitch', pitch = '' WHERE user_id = ?").bind(userId),
    db.prepare('UPDATE decision_log SET actor_user_id = NULL WHERE actor_user_id = ?').bind(userId),
    // Army: a role they never took goes; one they took stays on the brand's campaign, with the fee, as its record. A brand or campaign they
    // started stays for the people on it; a brand of theirs with nothing and nobody else in it goes (an ask still waiting is nobody; it goes with the brand).
    db.prepare("DELETE FROM campaign_assignments WHERE creator_user_id = ? AND status IN ('offered', 'declined')").bind(userId),
    db.prepare("UPDATE deliverable_versions SET note = '' WHERE submitted_by = ?").bind(userId),
    db.prepare('UPDATE campaign_events SET actor_user_id = NULL WHERE actor_user_id = ?').bind(userId),
    db.prepare('UPDATE campaigns SET owner_user_id = NULL WHERE owner_user_id = ?').bind(userId),
    db.prepare('DELETE FROM organizations WHERE created_by = ?1 AND id NOT IN (SELECT organization_id FROM organization_members WHERE user_id != ?1 AND status = \'active\') AND id NOT IN (SELECT organization_id FROM campaigns) AND id NOT IN (SELECT organization_id FROM bounties WHERE organization_id IS NOT NULL) AND id NOT IN (SELECT organization_id FROM opportunities WHERE organization_id IS NOT NULL) AND id NOT IN (SELECT organization_id FROM run_collabs WHERE organization_id IS NOT NULL)').bind(userId),
    db.prepare('DELETE FROM organization_members WHERE user_id = ?').bind(userId),
    db.prepare('UPDATE organizations SET created_by = NULL WHERE created_by = ?').bind(userId),
    // What the team made for everyone stays without who made it: published knowledge, verified tools, store items and kits. A draft and an
    // unverified suggestion are only theirs, so they go.
    db.prepare('DELETE FROM resources WHERE author_id = ? AND published = 0').bind(userId),
    db.prepare('UPDATE resources SET author_id = NULL WHERE author_id = ?').bind(userId),
    db.prepare('DELETE FROM tools WHERE suggested_by = ? AND verified = 0').bind(userId),
    db.prepare('UPDATE tools SET suggested_by = NULL WHERE suggested_by = ?').bind(userId),
    db.prepare('UPDATE store_items SET created_by = NULL WHERE created_by = ?').bind(userId),
    db.prepare('UPDATE store_kits SET created_by = NULL WHERE created_by = ?').bind(userId),
    // Their own progress and the marks on it. The points ledger stays for the books; xp pays nothing, so it goes.
    db.prepare('DELETE FROM onboarding_answers WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM spark_completions WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM xp_events WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM relationship_scores WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM honors WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM season_results WHERE user_id = ?').bind(userId),
    db.prepare("DELETE FROM flag_overrides WHERE subject_type = 'user' AND subject_id = ?").bind(userId),
    // The audit log keeps the fact: who (an id with no name behind it), what, on which thing. The words come off anything they did or that
    // was done to them; what they did to someone else's account as staff keeps its detail, for accountability.
    db.prepare("UPDATE audit_logs SET before_summary = '', after_summary = '' WHERE actor_user_id = ? AND resource_type != 'user'").bind(userId),
    db.prepare("UPDATE audit_logs SET before_summary = '', after_summary = '' WHERE resource_type = 'user' AND resource_id = ?").bind(userId),
    // Last of all: the counts keyed by their id or a hash of their email, any open password link, the sessions and the account's own details.
    // Until this batch runs they are still signed in and can ask again. The two raw forms are rows written before the hash (2026-11-07): they
    // live two days (`RETENTION_DAYS.rateLimits`), so those two can go with a later deploy.
    db.prepare("DELETE FROM rate_limits WHERE key IN (?2, ?3, 'signin-email:' || (SELECT email FROM users WHERE id = ?1), 'forgot-email:' || (SELECT email FROM users WHERE id = ?1)) OR key LIKE '%:' || ?1").bind(userId, `signin-email:${emailKey}`, `forgot-email:${emailKey}`),
    db.prepare('DELETE FROM password_resets WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM board_cache').bind(),
    db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(userId),
    db.prepare(`UPDATE users SET display_name = 'Deleted member', stats_json = NULL, stats_at = NULL, creator_type = '', email = NULL, phone = '', birth_date = '', password_hash = NULL, password_salt = NULL, handle = NULL, bio = '', avatar_url = '', socials_json = '{}', links_json = '[]', public_json = '{"pagePublic":false,"allowFriendRequests":false,"allowChats":false}', skills = '[]', categories = '[]', goals = '[]', interests = '[]', identities = '[]', intake_json = '{}', experience_level = '', availability = '', city = '', area = '', lat = NULL, lng = NULL, location = '', timezone = 'Asia/Kolkata', reminder_time = NULL, open_to_intros = 0, role = 'user', permissions = '[]', modules = '{}', friend_code = NULL, referral_code = NULL, referred_by = NULL, leaderboard_opt_in = 0, is_pro = 0, xp = 0, streak = 0, best_streak = 0, last_checkin = NULL, onboarded_at = NULL, getting_started_hidden_at = NULL, time_blocks_seeded_at = NULL, app_prefs_json = NULL, date_prefs_json = NULL, daily_view_json = NULL, ai_tables_json = NULL, attendee_event = NULL WHERE id = ?`).bind(userId),
  ]);
  await logEvent(db, 'user', userId, 'account.deleted');
}
