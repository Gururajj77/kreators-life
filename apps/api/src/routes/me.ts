import { Hono } from 'hono';
import {
  parsePublicSettings,
  normalizePhone,
  phoneProblem,
  CHARACTER_STAGES,
  MODULE_BY_KEY,
  daysSince,
  evolutionFor,
  IDENTITY_STAGES,
  levelFromXp,
  RELATIONSHIPS,
  type MeResponse,
  type RelationshipKey,
  type RelationshipState,
} from '@kreators/shared';
import type { AppEnv } from '../env';
import { computeBadges, getStats, getUser, grantedBadges, honorKeys, withGranted, newId, nowIso, parseModules, randomCode, str, toUser, publicOf } from '../db';
import { resolveAccess } from '../access';
import { hashPassword, randomHex } from './auth';
import { logEvent, track } from '../ops';
import { deleteAccount } from '../account';
import { parseSocials } from '../db';
import { isAutoHandle, MAX_INTERESTS, parseIdentities, parseLinkBlocks, passwordProblem, TRACKED_EVENTS, type TrackedEvent } from '@kreators/shared';
import type { Organization, PortfolioItem } from '@kreators/shared';

export const me = new Hono<AppEnv>();

me.get('/', async (c) => {
  const db = c.env.DB;
  let user = c.get('user');
  if (!user.referral_code) {
    await db.prepare('UPDATE users SET referral_code = ? WHERE id = ? AND referral_code IS NULL').bind(randomCode(), user.id).run();
    user = (await getUser(db, user.id)) ?? user;
  }
  const [scores, counts, stats, honors, resolved, unread, orgs] = await Promise.all([
    db
      .prepare('SELECT relationship, score, xp FROM relationship_scores WHERE user_id = ?')
      .bind(user.id)
      .all<{ relationship: RelationshipKey; score: number; xp: number }>(),
    db
      .prepare(
        `SELECT relationship,
          SUM(CASE WHEN kind = 'pillar' AND status != 'archived' THEN 1 ELSE 0 END) AS pillars,
          SUM(CASE WHEN kind = 'task' AND status = 'active' THEN 1 ELSE 0 END) AS active_tasks,
          SUM(CASE WHEN kind = 'task' AND status = 'done' THEN 1 ELSE 0 END) AS done_tasks,
          MIN(CASE WHEN kind = 'pillar' AND status != 'archived' THEN created_at END) AS first_pillar
         FROM nodes WHERE user_id = ? GROUP BY relationship`,
      )
      .bind(user.id)
      .all<{ relationship: RelationshipKey; pillars: number; active_tasks: number; done_tasks: number; first_pillar: string | null }>(),
    getStats(db, user.id),
    honorKeys(db, user),
    resolveAccess(db, user),
    db.prepare('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL').bind(user.id).first<{ n: number }>(),
    db.prepare("SELECT o.*, m.role AS my_role FROM organizations o JOIN organization_members m ON m.organization_id = o.id WHERE m.user_id = ? AND m.status = 'active' ORDER BY o.name").bind(user.id).all<{ id: string; name: string; type: Organization['type']; status: Organization['status']; created_at: string; my_role: 'owner' | 'member' }>(),
  ]);

  const scoreBy = new Map(scores.results.map((s) => [s.relationship, s]));
  const countBy = new Map(counts.results.map((s) => [s.relationship, s]));
  const answeredRows = await db.prepare('SELECT DISTINCT relationship FROM onboarding_answers WHERE user_id = ?').bind(user.id).all<{ relationship: string }>();
  const answered = new Set(answeredRows.results.map((r) => r.relationship));

  const relationships: RelationshipState[] = RELATIONSHIPS.map((r) => {
    const s = scoreBy.get(r.key);
    const n = countBy.get(r.key);
    const xp = s?.xp ?? 0;
    const floorAgeDays = n?.first_pillar ? daysSince(n.first_pillar) : null;
    return {
      key: r.key,
      score: s?.score ?? 0,
      xp,
      level: levelFromXp(xp),
      pillars: n?.pillars ?? 0,
      activeTasks: n?.active_tasks ?? 0,
      doneTasks: n?.done_tasks ?? 0,
      stage: evolutionFor(CHARACTER_STAGES, xp, floorAgeDays ?? 0).stage.stage,
      floorAgeDays,
      answered: answered.has(r.key),
    };
  });

  const body: MeResponse = {
    user: toUser(user),
    relationships,
    badges: withGranted(computeBadges(user, stats), await grantedBadges(db, user.id)),
    honors,
    identity: evolutionFor(IDENTITY_STAGES, user.xp, daysSince(user.created_at)),
    moduleSettings: resolved.settings,
    access: resolved.access,
    unread: unread?.n ?? 0,
    organizations: orgs.results.map((o) => ({ id: o.id, name: o.name, type: o.type, status: o.status, myRole: o.my_role, createdAt: o.created_at })),
    stats: { tasksDone: stats.tasksDone, sparksDone: stats.sparksDone, projectsCleared: stats.projectsCleared },
  };
  return c.json(body);
});

// How many times each link block on your page was tapped. Only you see this.
me.get('/link-clicks', async (c) => {
  const user = c.get('user');
  const rows = await c.env.DB.prepare("SELECT ref, COUNT(*) AS n FROM page_events WHERE owner_id = ? AND kind = 'click' AND ref LIKE 'block:%' GROUP BY ref").bind(user.id).all<{ ref: string; n: number }>();
  const clicks: Record<string, number> = {};
  for (const r of rows.results) clicks[r.ref.slice(6)] = r.n;
  return c.json({ clicks });
});

// Change the password: the current one first, then the new one. Every other session is signed out.
me.post('/password', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json<{ current?: string; password?: string }>().catch(() => ({}) as { current?: string; password?: string });
  const current = typeof body.current === 'string' ? body.current : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!user.email || !user.password_hash || !user.password_salt) return c.json({ error: 'create an account first' }, 400);
  if (!current || (await hashPassword(current, user.password_salt)) !== user.password_hash) return c.json({ error: 'the current password is not right' }, 400);
  const weak = passwordProblem(password, user.email);
  if (weak) return c.json({ error: weak.charAt(0).toLowerCase() + weak.slice(1) }, 400);
  const salt = randomHex(16);
  const token = (c.req.header('Authorization') ?? '').slice(7).trim();
  await db.batch([
    db.prepare('UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?').bind(await hashPassword(password, salt), salt, user.id),
    db.prepare('DELETE FROM sessions WHERE user_id = ? AND token != ?').bind(user.id, token),
  ]);
  return c.json({ ok: true });
});

me.patch('/', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req
    .json<Record<string, unknown>>()
    .catch(() => ({}) as Record<string, unknown>);
  const displayName = typeof body.displayName === 'string' ? body.displayName.trim().slice(0, 40) : user.display_name;
  const focus = typeof body.focus === 'string' ? body.focus.trim().slice(0, 40) : user.creator_type;
  const optIn = typeof body.leaderboardOptIn === 'boolean' ? (body.leaderboardOptIn ? 1 : 0) : user.leaderboard_opt_in;
  const bio = typeof body.bio === 'string' ? body.bio.trim().slice(0, 200) : user.bio;
  // The phone can be changed; the date of birth is set once at sign-up.
  let phone = user.phone ?? '';
  if (typeof body.phone === 'string') {
    const bad = phoneProblem(body.phone);
    if (bad) return c.json({ error: bad.charAt(0).toLowerCase() + bad.slice(1) }, 400);
    phone = normalizePhone(body.phone);
  }
  const reminderTime = body.reminderTime === null ? null : typeof body.reminderTime === 'string' && /^\d{2}:\d{2}$/.test(body.reminderTime) ? body.reminderTime : user.reminder_time;
  let handle = user.handle;
  // Everyone keeps a username; it can change but not go blank.
  if (typeof body.handle === 'string' && body.handle.trim()) {
    const h = body.handle.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(h)) return c.json({ error: 'a page name is 3 to 20 letters, numbers or underscores' }, 400);
    if (h !== user.handle) {
      const taken = await db.prepare('SELECT id FROM users WHERE handle = ? AND id != ?').bind(h, user.id).first();
      if (taken) return c.json({ error: 'that page name is taken' }, 409);
    }
    handle = h;
  }
  const list = (key: string, prev: string, max = 12) => (Array.isArray(body[key]) ? JSON.stringify((body[key] as unknown[]).filter((x): x is string => typeof x === 'string').map((x) => x.trim().slice(0, 40)).filter(Boolean).slice(0, max)) : prev);
  const skills = list('skills', user.skills);
  const categories = list('categories', user.categories);
  const goals = list('goals', user.goals);
  const experienceLevel = str(body.experienceLevel, 40, user.experience_level);
  const availability = str(body.availability, 40, user.availability);
  const location = str(body.location, 80, user.location);
  const openToIntros = typeof body.openToIntros === 'boolean' ? (body.openToIntros ? 1 : 0) : user.open_to_intros;
  const interests = list('interests', user.interests, MAX_INTERESTS);
  // Identity tags from Profile: the same validator as the setup chat.
  const identities = Array.isArray(body.identities) ? JSON.stringify(parseIdentities(body.identities)) : user.identities;
  const city = str(body.city, 80, user.city);
  const area = str(body.area, 80, user.area);
  // Coordinates are optional and only used server-side to keep circles close by.
  const lat = body.lat === null ? null : typeof body.lat === 'number' && Math.abs(body.lat) <= 90 ? body.lat : user.lat;
  const lng = body.lng === null ? null : typeof body.lng === 'number' && Math.abs(body.lng) <= 180 ? body.lng : user.lng;
  const timezone = (() => {
    const z = str(body.timezone, 60);
    if (!z) return user.timezone || 'Asia/Kolkata';
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: z });
      return z;
    } catch {
      return user.timezone || 'Asia/Kolkata';
    }
  })();
  const avatarUrl = 'avatarUrl' in body ? (/^https?:\/\//.test(str(body.avatarUrl, 500)) ? str(body.avatarUrl, 500) : '') : user.avatar_url;
  const socials = body.socials && typeof body.socials === 'object' ? JSON.stringify(parseSocials(JSON.stringify(body.socials))) : user.socials_json;
  const publicJson = body.publicSettings && typeof body.publicSettings === 'object' ? JSON.stringify(parsePublicSettings({ ...publicOf(user), ...(body.publicSettings as Record<string, unknown>) })) : user.public_json;
  // Link blocks: cleaned in shared, every block gets an id here so clicks can be counted.
  const links = Array.isArray(body.links) ? JSON.stringify(parseLinkBlocks(body.links).map((b) => ({ ...b, id: b.id || newId().slice(0, 12) }))) : user.links_json;
  await db
    .prepare('UPDATE users SET display_name = ?, creator_type = ?, leaderboard_opt_in = ?, bio = ?, reminder_time = ?, handle = ?, skills = ?, categories = ?, goals = ?, experience_level = ?, availability = ?, location = ?, open_to_intros = ?, interests = ?, identities = ?, city = ?, area = ?, lat = ?, lng = ?, timezone = ?, avatar_url = ?, socials_json = ?, public_json = ?, links_json = ?, phone = ? WHERE id = ?')
    .bind(displayName, focus, optIn, bio, reminderTime, handle, skills, categories, goals, experienceLevel, availability, location, openToIntros, interests, identities, city, area, lat, lng, timezone, avatarUrl, socials, publicJson, links, phone, user.id)
    .run();
  if (handle && isAutoHandle(user.handle) && !isAutoHandle(handle)) await track(db, user.id, 'profile_published', { minutesSinceSignup: Math.round((Date.now() - new Date(user.created_at).getTime()) / 60_000) });
  const fresh = await getUser(db, user.id);
  return c.json({ user: fresh ? toUser(fresh) : null });
});

interface PortfolioRow { id: string; title: string; description: string; url: string; visibility: 'public' | 'private'; created_at: string }
const toPortfolio = (r: PortfolioRow): PortfolioItem => ({ id: r.id, title: r.title, description: r.description, url: r.url, visibility: r.visibility, createdAt: r.created_at });

me.get('/portfolio', async (c) => {
  const rows = await c.env.DB.prepare('SELECT * FROM portfolio_items WHERE user_id = ? ORDER BY created_at DESC').bind(c.get('user').id).all<PortfolioRow>();
  return c.json({ items: rows.results.map(toPortfolio) });
});

me.post('/portfolio', async (c) => {
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const title = str(body.title, 120);
  const url = str(body.url, 500);
  if (!title || !url) return c.json({ error: 'a title and a link' }, 400);
  const id = newId();
  await c.env.DB.prepare('INSERT INTO portfolio_items (id, user_id, title, description, url, visibility, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(id, c.get('user').id, title, str(body.description, 500), url, body.visibility === 'private' ? 'private' : 'public', nowIso())
    .run();
  const row = await c.env.DB.prepare('SELECT * FROM portfolio_items WHERE id = ?').bind(id).first<PortfolioRow>();
  return c.json({ item: row ? toPortfolio(row) : null }, 201);
});

me.delete('/portfolio/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM portfolio_items WHERE id = ? AND user_id = ?').bind(c.req.param('id'), c.get('user').id).run();
  return c.json({ ok: true });
});

// Everything we hold about you, as one JSON file.
me.get('/export', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const tables: [string, string][] = [
    ['nodes', 'SELECT * FROM nodes WHERE user_id = ?'],
    ['subtasks', 'SELECT * FROM subtasks WHERE user_id = ?'],
    ['wellbeing', 'SELECT * FROM wellbeing_logs WHERE user_id = ?'],
    ['journal', 'SELECT * FROM journal_entries WHERE user_id = ?'],
    ['orders', 'SELECT * FROM orders WHERE buyer_id = ? OR owner_id = ?'],
    ['bookings', 'SELECT * FROM bookings WHERE buyer_id = ? OR owner_id = ?'],
    ['finance', 'SELECT * FROM finance_transactions WHERE user_id = ?'],
    ['invoices', 'SELECT * FROM invoices WHERE user_id = ?'],
    ['points', 'SELECT * FROM points_ledger WHERE user_id = ?'],
    ['notifications', 'SELECT * FROM notifications WHERE user_id = ?'],
    ['notToDo', 'SELECT * FROM not_to_do WHERE user_id = ?'],
    ['notToDoDays', 'SELECT * FROM not_to_do_days WHERE user_id = ?'],
    ['reviews', 'SELECT * FROM reviews WHERE user_id = ?'],
    ['reviewTemplates', 'SELECT * FROM review_templates WHERE user_id = ?'],
    ['listings', 'SELECT * FROM preowned_listings WHERE seller_id = ?'],
    ['offers', 'SELECT * FROM preowned_offers WHERE buyer_id = ?'],
    ['runEntries', 'SELECT * FROM run_entries WHERE user_id = ?'],
    ['runClubs', 'SELECT * FROM run_members WHERE user_id = ?'],
    ['assessments', 'SELECT * FROM assessments WHERE user_id = ?'],
    ['placements', 'SELECT * FROM placements WHERE user_id = ?'],
    ['routines', 'SELECT * FROM routines WHERE user_id = ?'],
    ['contracts', 'SELECT * FROM contracts WHERE user_id = ?'],
    ['routineDays', 'SELECT * FROM routine_days WHERE user_id = ?'],
    ['brands', 'SELECT * FROM brands WHERE owner_id = ?'],
    ['brandSources', 'SELECT s.* FROM brand_sources s JOIN brands b ON b.id = s.brand_id WHERE b.owner_id = ?'],
    ['brandPieces', 'SELECT p.* FROM brand_pieces p JOIN brands b ON b.id = p.brand_id WHERE b.owner_id = ?'],
    ['assistantActions', 'SELECT * FROM assistant_actions WHERE user_id = ?'],
    ['creditAccount', 'SELECT * FROM credit_accounts WHERE user_id = ?'],
    ['creditLedger', 'SELECT * FROM credit_ledger WHERE user_id = ?'],
    ['attendeeClaims', 'SELECT * FROM attendee_claims WHERE user_id = ?'],
    ['cardUnlocks', 'SELECT * FROM card_unlocks WHERE user_id = ?'],
    ['badgeGrants', 'SELECT * FROM badge_grants WHERE user_id = ?'],
    ['focusRounds', 'SELECT * FROM focus_rounds WHERE user_id = ?'],
    ['discoverDraft', 'SELECT * FROM discover_drafts WHERE user_id = ?'],
    ['discoverSettings', 'SELECT * FROM discover_settings WHERE user_id = ?'],
    ['discoverResults', 'SELECT * FROM discover_results WHERE user_id = ?'],
    // Coaching, on either side: the links, the notes, the change log, and a coach's own line.
    ['coachLinks', 'SELECT * FROM coach_links WHERE coach_id = ? OR student_id = ?'],
    ['coachNotes', 'SELECT * FROM coach_notes WHERE coach_id = ? OR student_id = ?'],
    ['coachLog', 'SELECT * FROM coach_log WHERE coach_id = ? OR student_id = ?'],
    ['coachProfile', 'SELECT * FROM coach_profiles WHERE user_id = ?'],
    ['postsFollowed', 'SELECT * FROM community_post_follows WHERE user_id = ?'],
    ['replyReactions', 'SELECT * FROM community_reply_reactions WHERE user_id = ?'],
    ['seasonResults', 'SELECT * FROM season_results WHERE user_id = ?'],
    // What the person added to events, listings and lessons, and who they blocked. Uploaded files are listed without their bytes.
    ['uploads', 'SELECT id, mime, size, created_at FROM media_files WHERE owner_id = ?'],
    ['mediaItems', 'SELECT * FROM media_items WHERE added_by = ?'],
    ['eventMessages', 'SELECT * FROM event_messages WHERE user_id = ?'],
    ['eventNetworking', 'SELECT * FROM event_networking WHERE user_id = ?'],
    ['blocks', 'SELECT * FROM blocks WHERE blocker_id = ?'],
    ['waterLogs', 'SELECT * FROM water_logs WHERE user_id = ?'],
    ['reminderPrefs', 'SELECT * FROM reminder_prefs WHERE user_id = ?'],
    ['customReminders', 'SELECT * FROM custom_reminders WHERE user_id = ?'],
  ];
  const out: Record<string, unknown> = { exportedAt: nowIso(), user: toUser(user) };
  for (const [name, sql] of tables) {
    const binds = (sql.match(/\?/g) ?? []).map(() => user.id);
    out[name] = (await db.prepare(sql).bind(...binds).all()).results;
  }
  return c.json(out);
});

// Delete the account: personal details go, money records stay anonymised for the books.
me.delete('/', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json<{ confirm?: string }>().catch(() => ({}) as { confirm?: string });
  if (body.confirm !== 'DELETE') return c.json({ error: 'send confirm: DELETE' }, 400);
  await deleteAccount(db, user.id);
  return c.json({ ok: true });
});

// The web app reports a few product events of its own, for the funnels under Admin.
me.post('/events', async (c) => {
  const body = await c.req.json<{ name?: string; props?: Record<string, unknown> }>().catch(() => ({}) as Record<string, never>);
  if (!(TRACKED_EVENTS as readonly string[]).includes(String(body.name))) return c.json({ error: 'unknown event' }, 400);
  await track(c.env.DB, c.get('user').id, body.name as TrackedEvent, body.props && typeof body.props === 'object' ? body.props : {});
  return c.json({ ok: true });
});

// Switch one of your own modules on or off.
me.patch('/modules', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json<{ key?: string; on?: boolean }>().catch(() => ({}) as { key?: string; on?: boolean });
  const m = body.key ? MODULE_BY_KEY[body.key] : undefined;
  if (!m) return c.json({ error: 'no such module' }, 404);
  if (m.locked) return c.json({ error: 'that one stays on' }, 400);
  const mine = parseModules(user.modules);
  mine[m.key] = body.on !== false;
  await db.prepare('UPDATE users SET modules = ? WHERE id = ?').bind(JSON.stringify(mine), user.id).run();
  return c.json({ modules: mine });
});

// Wipe progress but keep the device session, so the person can start over.
me.post('/reset', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  await db.batch([
    db.prepare('DELETE FROM nodes WHERE user_id = ?').bind(user.id),
    db.prepare('DELETE FROM not_to_do WHERE user_id = ?').bind(user.id),
    db.prepare('DELETE FROM reviews WHERE user_id = ?').bind(user.id),
    db.prepare('DELETE FROM xp_events WHERE user_id = ?').bind(user.id),
    db.prepare('DELETE FROM spark_completions WHERE user_id = ?').bind(user.id),
    db.prepare('DELETE FROM onboarding_answers WHERE user_id = ?').bind(user.id),
    db.prepare('DELETE FROM assessments WHERE user_id = ?').bind(user.id),
    db.prepare('DELETE FROM placements WHERE user_id = ?').bind(user.id),
    db.prepare('DELETE FROM routines WHERE user_id = ?').bind(user.id),
    db.prepare('DELETE FROM contracts WHERE user_id = ?').bind(user.id),
    db.prepare('DELETE FROM routine_days WHERE user_id = ?').bind(user.id),
    // Starting over clears what the assistant did; a plan and its credits are paid for, so they stay, and so do unlocked card games. Attendee claims
    // and run entries stay too: clearing them would let the same event's code, or the same run, pay again. A life
    // coach stays as well, with the notes and the change log: that is a person, not progress. The tasks a coach
    // added go with the pyramids.
    db.prepare('DELETE FROM assistant_actions WHERE user_id = ?').bind(user.id),
    db.prepare('DELETE FROM assistant_runs WHERE user_id = ?').bind(user.id),
    db.prepare('DELETE FROM discover_drafts WHERE user_id = ?').bind(user.id),
    db.prepare('DELETE FROM focus_rounds WHERE user_id = ?').bind(user.id),
    db.prepare('DELETE FROM discover_settings WHERE user_id = ?').bind(user.id),
    db.prepare('DELETE FROM discover_results WHERE user_id = ?').bind(user.id),
    db.prepare('DELETE FROM points_ledger WHERE user_id = ?').bind(user.id),
    db.prepare("DELETE FROM redemptions WHERE user_id = ? AND status = 'reserved'").bind(user.id),
    db.prepare('UPDATE relationship_scores SET score = 0, xp = 0 WHERE user_id = ?').bind(user.id),
    db
      .prepare("UPDATE users SET xp = 0, points = 0, streak = 0, best_streak = 0, last_checkin = NULL, onboarded_at = NULL, reminder_time = NULL, identities = '[]', intake_json = '{}' WHERE id = ?")
      .bind(user.id),
  ]);
  return c.json({ ok: true, at: nowIso() });
});
