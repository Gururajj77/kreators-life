import { nowIso } from './db';
import { logEvent } from './ops';

/**
 * Delete an account: the personal details go, the person's own things go, and the money records stay anonymised for the books.
 * One place, used by the person themselves (Profile, delete) and by an admin from the People list.
 */
export async function deleteAccount(db: D1Database, userId: string): Promise<void> {
  await db.batch([
    db.prepare("UPDATE users SET display_name = 'Deleted member', email = NULL, phone = '', birth_date = '', password_hash = NULL, password_salt = NULL, handle = NULL, bio = '', avatar_url = '', socials_json = '{}', skills = '[]', categories = '[]', goals = '[]', interests = '[]', identities = '[]', intake_json = '{}', city = '', area = '', lat = NULL, lng = NULL, location = '', reminder_time = NULL, open_to_intros = 0, permissions = '[]', friend_code = NULL, leaderboard_opt_in = 0 WHERE id = ?").bind(userId),
    db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM subtasks WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM nodes WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM media_files WHERE owner_id = ?').bind(userId),
    db.prepare('DELETE FROM water_logs WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM reminder_prefs WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM custom_reminders WHERE user_id = ?').bind(userId),
    db.prepare("DELETE FROM media_items WHERE added_by = ? AND url LIKE '/api/public/media/%'").bind(userId),
    db.prepare('DELETE FROM event_messages WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM event_networking WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM community_mutes WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM blocks WHERE blocker_id = ?').bind(userId),
    db.prepare('DELETE FROM not_to_do WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM reviews WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM review_templates WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM preowned_listings WHERE seller_id = ?').bind(userId),
    db.prepare('DELETE FROM preowned_offers WHERE buyer_id = ?').bind(userId),
    db.prepare('DELETE FROM run_entries WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM run_members WHERE user_id = ?').bind(userId),
    db.prepare("UPDATE run_clubs SET status = 'closed' WHERE host_user_id = ?").bind(userId),
    db.prepare('DELETE FROM wellbeing_logs WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM journal_entries WHERE user_id = ?').bind(userId),
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
    db.prepare('DELETE FROM focus_rounds WHERE user_id = ?').bind(userId),
    db.prepare("UPDATE app_logs SET actor_id = NULL, actor_name = 'Deleted member' WHERE actor_id = ?").bind(userId),
    db.prepare('DELETE FROM discover_drafts WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM discover_settings WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM discover_results WHERE user_id = ?').bind(userId),
    // Coaching ends with the account, on either side, and its notes, change log and coach line go with it.
    db.prepare("UPDATE coach_links SET status = 'ended', ended_at = ?, ended_by = ? WHERE (coach_id = ? OR student_id = ?) AND status IN ('pending','active')").bind(nowIso(), userId, userId, userId),
    db.prepare('DELETE FROM coach_notes WHERE coach_id = ? OR student_id = ?').bind(userId, userId),
    db.prepare('DELETE FROM coach_log WHERE coach_id = ? OR student_id = ?').bind(userId, userId),
    db.prepare('DELETE FROM coach_profiles WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM community_post_follows WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM community_reply_reactions WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM event_reminders WHERE user_id = ?').bind(userId),
    db.prepare("UPDATE products SET status = 'archived' WHERE owner_id = ?").bind(userId),
  ]);
  await logEvent(db, 'user', userId, 'account.deleted');
}
