import { Hono } from 'hono';
import {
  parsePublicSettings,
  normalizePhone,
  phoneProblem,
  CHARACTER_STAGES,
  MODULE_BY_KEY,
  MODULES,
  daysSince,
  evolutionFor,
  IDENTITY_STAGES,
  levelFromXp,
  RELATIONSHIPS,
  type MeResponse,
  type RelationshipKey,
  type RelationshipState,
} from '@kreators/shared';
import { keepHiddenTables, knownTableKeys, parseAiTables, TABLE_LIST_MAX, tablesShownNow } from '@kreators/shared/dataTables';
import type { AppEnv } from '../env';
import { badgeState, badgesFor, DELETED_NAME_PROBLEM, keptStats, getUser, honorKeys, httpUrl, isDeletedName, LINK_PROBLEM, newFriendCode, newId, nowIso, objectBody, parseModules, randomCode, str, toUser, publicOf } from '../db';
import { appsOn, resolveAccess } from '../access';
import { tableSwitchesOn } from '../tablesShare';
import { hashPassword, randomHex, safeEqual } from './auth';
import { sendEmail, track } from '../ops';
import { deleteAccount, StillClosing } from '../account';
import { askToCoach, isCoach } from '../coaching';
import { currencyOf, GONE_NOW, parseSocials } from '../db';
import { appPrefsProblem, dailyViewProblem, parseDailyView, datePrefsProblem, isAutoHandle, isCurrency, MAX_INTERESTS, parseAppPrefs, parseDatePrefs, parseIdentities, parseLinkBlocks, passwordProblem, TRACKED_EVENTS, type TrackedEvent } from '@kreators/shared';
import type { Organization, PortfolioItem } from '@kreators/shared';

export const me = new Hono<AppEnv>();

me.get('/', async (c) => {
  const db = c.env.DB;
  let user = c.get('user');
  if (!user.referral_code) {
    await db.prepare('UPDATE users SET referral_code = ? WHERE id = ? AND referral_code IS NULL').bind(randomCode(), user.id).run();
    user = (await getUser(db, user.id)) ?? user;
  }
  const [scores, counts, stats, honors, resolved, unread, orgs, answeredRows, switches] = await Promise.all([
    db
      .prepare('SELECT relationship, score, xp FROM relationship_scores WHERE user_id = ?')
      .bind(user.id)
      .all<{ relationship: RelationshipKey; score: number; xp: number }>(),
    // Only the foundations here: the tasks under each pillar are read by Pillars, the one screen that shows them (GET /me/pillar-tasks), since this answer is read after every write.
    db
      .prepare("SELECT relationship, COUNT(*) AS pillars, MIN(created_at) AS first_pillar FROM nodes INDEXED BY idx_nodes_user_done WHERE user_id = ? AND kind = 'pillar' AND status != 'archived' GROUP BY relationship")
      .bind(user.id)
      .all<{ relationship: RelationshipKey; pillars: number; first_pillar: string | null }>(),
    keptStats(db, user),
    honorKeys(db, user),
    resolveAccess(db, user),
    db.prepare('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL').bind(user.id).first<{ n: number }>(),
    db.prepare("SELECT o.*, m.role AS my_role FROM organizations o JOIN organization_members m ON m.organization_id = o.id WHERE m.user_id = ? AND m.status = 'active' ORDER BY o.name").bind(user.id).all<{ id: string; name: string; type: Organization['type']; status: Organization['status']; created_at: string; my_role: 'owner' | 'member' }>(),
    db.prepare('SELECT DISTINCT relationship FROM onboarding_answers WHERE user_id = ?').bind(user.id).all<{ relationship: string }>(),
    // The settings inside an app that a table needs on too (Business metrics), one row by its key in the same round trip.
    tableSwitchesOn(db, user.id),
  ]);
  // The badges: what the counts earn, what was earned before, and what the team gave. New ones are written down here.
  const held = await badgeState(db, user, { stats });

  const scoreBy = new Map(scores.results.map((s) => [s.relationship, s]));
  const countBy = new Map(counts.results.map((s) => [s.relationship, s]));
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
      stage: evolutionFor(CHARACTER_STAGES, xp, floorAgeDays ?? 0).stage.stage,
      floorAgeDays,
      answered: answered.has(r.key),
    };
  });

  const body: MeResponse = {
    // AI chat's tables are the ones shown now: a table whose app is hidden stays in the stored list, unseen, and comes back with its app.
    user: {
      ...toUser(user),
      aiTables: tablesShownNow(parseAiTables(user.ai_tables_json ?? null), [...appsOn(resolved.access), ...switches]),
      tableSwitches: switches.map((k) => k.replace(/^switch:/, '')),
    },
    relationships,
    badges: held.keys,
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

// The open and ticked tasks under each pillar, for Pillars' cards. It visits every task the person has, so only the screen that shows them asks.
me.get('/pillar-tasks', async (c) => {
  const rows = await c.env.DB.prepare(
    "SELECT relationship, SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_tasks, SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS done_tasks FROM nodes INDEXED BY idx_nodes_user_done WHERE user_id = ? AND kind = 'task' AND status IN ('active', 'done') GROUP BY relationship",
  )
    .bind(c.get('user').id)
    .all<{ relationship: RelationshipKey; active_tasks: number; done_tasks: number }>();
  return c.json({ pillars: rows.results.map((r) => ({ relationship: r.relationship, activeTasks: r.active_tasks, doneTasks: r.done_tasks })) });
});

// The badge gallery: what you hold with its date, and the count behind every rule so a bar can be drawn. Only you see this.
me.get('/badges', async (c) => c.json(await badgesFor(c.env.DB, c.get('user'))));

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
  if (!current || !safeEqual(await hashPassword(current, user.password_salt), user.password_hash)) return c.json({ error: 'the current password is not right' }, 400);
  const weak = passwordProblem(password, user.email);
  if (weak) return c.json({ error: weak.charAt(0).toLowerCase() + weak.slice(1) }, 400);
  const salt = randomHex(16);
  const token = (c.req.header('Authorization') ?? '').slice(7).trim();
  await db.batch([
    db.prepare('UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?').bind(await hashPassword(password, salt), salt, user.id),
    db.prepare('DELETE FROM sessions WHERE user_id = ? AND token != ?').bind(user.id, token),
  ]);
  // A short note that the password changed, so a change nobody asked for is noticed. A failed mail never stops the change.
  await sendEmail(db, c.env, { userId: user.id, to: user.email, subject: 'Your kreators.app password was changed', body: 'Your password was just changed and your other devices were signed out.\n\nIf this was you, there is nothing to do. If it was not, reset your password from the sign-in page and write to us.' }).catch(() => undefined);
  return c.json({ ok: true });
});

// A new friend code, when the old one (or a QR code with it) has spread too far. The old code stops working at once, as a code nobody has.
// Requests already sent stay; nothing else holds the code. Core, so it works with Bond off (limit `prefs`).
me.post('/friend-code', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const code = newFriendCode();
  await db.prepare('UPDATE users SET friend_code = ? WHERE id = ?').bind(code, user.id).run();
  return c.json({ friendCode: code });
});

/** The first path parts the public API answers itself under /api/public (index.ts and routes/store.ts), never a person's page name. */
const PAGE_NAMES_IN_USE = new Set(['agency', 'books', 'business', 'calendar', 'certificates', 'config', 'contracts', 'events', 'explore', 'invoices', 'media', 'people', 'products', 'unsubscribe', 'vitals']);

me.patch('/', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req
    .json<Record<string, unknown>>()
    .catch(() => ({}) as Record<string, unknown>);
  const displayName = typeof body.displayName === 'string' ? body.displayName.trim().slice(0, 40) : user.display_name;
  if (isDeletedName(displayName)) return c.json({ error: DELETED_NAME_PROBLEM }, 400);
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
      // A name the public API already answers at /api/public/<name> would hide that person's page (2026-11-07: /public/events came in), so it reads as taken.
      if (PAGE_NAMES_IN_USE.has(h)) return c.json({ error: 'that page name is taken' }, 409);
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
  // The currency their own money is kept in: rupees by default, any of CURRENCIES for someone abroad. Anything else keeps what was there.
  const currency = isCurrency(body.currency) ? body.currency : currencyOf(user);
  // How the app groups start and the order of apps inside each (Profile, Features): the whole set at once, refused when a group or an
  // app is unknown or an app is placed in another group's order.
  let appPrefs = user.app_prefs_json ?? null;
  if ('appPrefs' in body) {
    const bad = appPrefsProblem(body.appPrefs);
    if (bad) return c.json({ error: bad }, 400);
    appPrefs = JSON.stringify(parseAppPrefs(body.appPrefs));
  }
  // How dates and times read on their screens: either part, over what they had; anything but one of the choices is refused.
  let datePrefs = user.date_prefs_json ?? null;
  if ('datePrefs' in body) {
    const bad = datePrefsProblem(body.datePrefs);
    if (bad) return c.json({ error: bad }, 400);
    datePrefs = JSON.stringify(parseDatePrefs({ ...parseDatePrefs(datePrefs), ...(body.datePrefs as object) }));
  }
  // Daily's View menu (2026-11-12): the sections the person hid, the whole set at once; an unknown section or one listed twice is refused.
  let dailyView = user.daily_view_json ?? null;
  if ('dailyView' in body) {
    const bad = dailyViewProblem(body.dailyView);
    if (bad) return c.json({ error: bad }, 400);
    const view = parseDailyView(body.dailyView);
    dailyView = view.hidden.length ? JSON.stringify(view) : null;
  }
  const avatarUrl = 'avatarUrl' in body ? (/^https?:\/\//.test(str(body.avatarUrl, 500)) ? str(body.avatarUrl, 500) : '') : user.avatar_url;
  const socials = body.socials && typeof body.socials === 'object' ? JSON.stringify(parseSocials(JSON.stringify(body.socials))) : user.socials_json;
  const publicJson = body.publicSettings && typeof body.publicSettings === 'object' ? JSON.stringify(parsePublicSettings({ ...publicOf(user), ...(body.publicSettings as Record<string, unknown>) })) : user.public_json;
  // Link blocks: cleaned in shared, every block gets an id here so clicks can be counted.
  const links = Array.isArray(body.links) ? JSON.stringify(parseLinkBlocks(body.links).map((b) => ({ ...b, id: b.id || newId().slice(0, 12) }))) : user.links_json;
  await db
    .prepare('UPDATE users SET display_name = ?, creator_type = ?, leaderboard_opt_in = ?, bio = ?, reminder_time = ?, handle = ?, skills = ?, categories = ?, goals = ?, experience_level = ?, availability = ?, location = ?, open_to_intros = ?, interests = ?, identities = ?, city = ?, area = ?, lat = ?, lng = ?, timezone = ?, currency = ?, app_prefs_json = ?, date_prefs_json = ?, daily_view_json = ?, avatar_url = ?, socials_json = ?, public_json = ?, links_json = ?, phone = ? WHERE id = ?')
    .bind(displayName, focus, optIn, bio, reminderTime, handle, skills, categories, goals, experienceLevel, availability, location, openToIntros, interests, identities, city, area, lat, lng, timezone, currency, appPrefs, datePrefs, dailyView, avatarUrl, socials, publicJson, links, phone, user.id)
    .run();
  if (handle && isAutoHandle(user.handle) && !isAutoHandle(handle)) await track(db, user.id, 'profile_published', { minutesSinceSignup: Math.round((Date.now() - new Date(user.created_at).getTime()) / 60_000) });
  // Picking the Life coach tag on Profile asks to become one, as the setup chat does (askToCoach tells the admins once).
  const hadCoach = (() => { try { return (JSON.parse(user.identities || '[]') as unknown[]).includes('coach'); } catch { return false; } })();
  const coach = !hadCoach && (JSON.parse(identities || '[]') as unknown[]).includes('coach') && !isCoach(user) ? await askToCoach(db, user, '') : null;
  const fresh = await getUser(db, user.id);
  return c.json({ user: fresh ? toUser(fresh) : null, ...(coach ? { coach } : {}) });
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
  const url = httpUrl(body.url);
  if (!title || !url) return c.json({ error: `a title and ${LINK_PROBLEM}` }, 400);
  const id = newId();
  await c.env.DB.prepare('INSERT INTO portfolio_items (id, user_id, title, description, url, visibility, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(id, c.get('user').id, title, str(body.description, 500), url, body.visibility === 'private' ? 'private' : 'public', nowIso())
    .run();
  const row = await c.env.DB.prepare('SELECT * FROM portfolio_items WHERE id = ?').bind(id).first<PortfolioRow>();
  return c.json({ item: row ? toPortfolio(row) : null }, 201);
});

// Change a piece of work on your Public page (2026-11-14, All tables): its title, its words, its link and who sees it, each alone keeping the
// rest, with POST's own rules (a link that is not http or https is refused out loud).
me.patch('/portfolio/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const prev = await db.prepare('SELECT * FROM portfolio_items WHERE id = ? AND user_id = ?').bind(c.req.param('id'), user.id).first<PortfolioRow>();
  if (!prev) return c.json({ error: 'not found' }, 404);
  const body = await objectBody(c);
  const title = 'title' in body ? str(body.title, 120) : prev.title;
  if (!title) return c.json({ error: 'a title for the piece' }, 400);
  const url = 'url' in body ? httpUrl(body.url) : prev.url;
  if (!url) return c.json({ error: LINK_PROBLEM }, 400);
  if ('visibility' in body && body.visibility !== 'public' && body.visibility !== 'private') return c.json({ error: 'Pick who sees it.' }, 400);
  const visibility = 'visibility' in body ? (body.visibility === 'private' ? 'private' : 'public') : prev.visibility;
  const res = await db
    .prepare('UPDATE portfolio_items SET title = ?, description = ?, url = ?, visibility = ? WHERE id = ? AND user_id = ?')
    .bind(title, 'description' in body ? str(body.description, 500) : prev.description, url, visibility, prev.id, user.id)
    .run();
  if (!res.meta.changes) return c.json({ error: 'not found' }, 404);
  const row = await db.prepare('SELECT * FROM portfolio_items WHERE id = ?').bind(prev.id).first<PortfolioRow>();
  return c.json({ item: row ? toPortfolio(row) : null });
});

me.delete('/portfolio/:id', async (c) => {
  const res = await c.env.DB.prepare('DELETE FROM portfolio_items WHERE id = ? AND user_id = ?').bind(c.req.param('id'), c.get('user').id).run();
  if (!res.meta.changes) return c.json({ error: GONE_NOW }, 409);
  return c.json({ ok: true });
});

// Everything we hold about you, as one JSON file.
// AI chat's tables (2026-11-14, the founder: "give one toggle for ai chat access just next to coach button too and even in profile section"):
// one table switched with { table, on } (Show to AI chat at the top of a table, or one switch under AI chat on the Profile tab), or the whole
// list with { tables } (Share all, Share none). One table is applied to the list as it stands, inside a write guarded on the list it read, so
// a tap in one place never puts back a table switched in another; a lost race reads again once, then answers 409.
me.patch('/ai-tables', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  // A body that is not an object (null, a list) reads as empty and gets the plain 400 below, never a 500.
  const body = await objectBody(c);
  const one = body.table !== undefined || body.on !== undefined;
  const bad = one
    ? typeof body.table !== 'string' || typeof body.on !== 'boolean' || body.tables !== undefined || knownTableKeys([body.table]).length !== 1
    : !Array.isArray(body.tables) || body.tables.length > TABLE_LIST_MAX;
  if (bad) return c.json({ error: 'Name one table and whether AI chat may read it, or send the list of tables.' }, 400);
  // The apps on for the person now (2026-11-14, the review): a whole list (Share all, Share none) speaks only for the tables they can see, so a
  // table whose app is hidden keeps its switch for when the app comes back, and the answer carries only the tables shown now, as GET /me does.
  const [resolvedNow, switches] = await Promise.all([resolveAccess(db, user), tableSwitchesOn(db, user.id)]);
  const on = [...appsOn(resolvedNow.access), ...switches];
  let stored = user.ai_tables_json ?? null;
  for (let tries = 0; tries < 2; tries++) {
    if (tries) stored = (await db.prepare('SELECT ai_tables_json FROM users WHERE id = ?').bind(user.id).first<{ ai_tables_json: string | null }>())?.ai_tables_json ?? null;
    const before = parseAiTables(stored);
    const after = one ? knownTableKeys(body.on ? [...before, body.table] : before.filter((k) => k !== body.table)) : knownTableKeys(keepHiddenTables(knownTableKeys(body.tables), before, on));
    if (after.join() === before.join()) return c.json({ aiTables: tablesShownNow(after, on) });
    const res = await db.prepare('UPDATE users SET ai_tables_json = ? WHERE id = ? AND ai_tables_json IS ?').bind(after.length ? JSON.stringify(after) : null, user.id, stored).run();
    if ((res.meta.changes ?? 0) === 1) return c.json({ aiTables: tablesShownNow(after, on) });
  }
  return c.json({ error: 'That changed somewhere else just now. Try again.' }, 409);
});

me.get('/export', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const asked = nowIso();
  const tables: [string, string][] = [
    ['nodes', 'SELECT * FROM nodes WHERE user_id = ?'],
    ['subtasks', 'SELECT * FROM subtasks WHERE user_id = ?'],
    ['wellbeing', 'SELECT * FROM wellbeing_logs WHERE user_id = ?'],
    // Supplements in Fitness (migration 0104): the list, each day one was taken, and the switches.
    ['supplements', 'SELECT id, name, kind, amount, time_of_day, days_json, position, paused_at, created_at, updated_at FROM supplements WHERE user_id = ?'],
    ['supplementDays', 'SELECT supplement_id, day, taken_at FROM supplement_days WHERE user_id = ?'],
    ['fitnessPrefs', 'SELECT * FROM fitness_prefs WHERE user_id = ?'],
    ['journal', 'SELECT * FROM journal_entries WHERE user_id = ?'],
    // Gratitude for the day on Journal (migration 0102): the three lines and the prompt each answered.
    ['gratitude', 'SELECT day, lines_json, created_at, updated_at FROM gratitude_days WHERE user_id = ?'],
    // Its prompts per person (migration 0106): the prompts kept for the open days, the prompts seen by round, and the usual three.
    ['gratitudeOffers', 'SELECT day, prompts_json, created_at, updated_at FROM gratitude_offers WHERE user_id = ?'],
    ['gratitudeSeen', 'SELECT grp, prompt, round, how, day, seen_at FROM gratitude_seen WHERE user_id = ?'],
    ['gratitudePrefs', 'SELECT usual_json, updated_at FROM gratitude_prefs WHERE user_id = ?'],
    ['orders', 'SELECT * FROM orders WHERE buyer_id = ? OR owner_id = ?'],
    // Private courses: the ones you were invited to, and the people you invited to yours.
    ['productInvites', 'SELECT i.product_id, i.user_id, i.created_at FROM product_invites i JOIN products p ON p.id = i.product_id WHERE i.user_id = ? OR p.owner_id = ?'],
    ['bookings', 'SELECT * FROM bookings WHERE buyer_id = ? OR owner_id = ?'],
    ['finance', 'SELECT * FROM finance_transactions WHERE user_id = ?'],
    // Never a paper's link key (invoices, agreements, other documents, a client link or team link): whoever holds the file could open a client's paper with it.
    ['invoices', "SELECT id, user_id, number, client_name, client_email, items_json, total_cents, currency, status, issue_date, due_date, note, (token IS NOT NULL AND token != '') AS has_link, paid_at, created_at, agency_client_id, doc_json, revised_at, agency_cycle_id, voided_from FROM invoices WHERE user_id = ?"],
    ['points', 'SELECT * FROM points_ledger WHERE user_id = ?'],
    ['notifications', 'SELECT * FROM notifications WHERE user_id = ?'],
    ['notToDo', 'SELECT * FROM not_to_do WHERE user_id = ?'],
    ['notToDoDays', 'SELECT * FROM not_to_do_days WHERE user_id = ?'],
    ['dayTypes', 'SELECT * FROM day_types WHERE user_id = ?'],
    // Time blocks, day templates, their slots and the weekly pattern (migration 0089); the date changes are in dayTypes above.
    ['timeBlocks', 'SELECT * FROM time_blocks WHERE user_id = ?'],
    ['dayTemplates', 'SELECT * FROM day_templates WHERE user_id = ?'],
    ['dayTemplateSlots', 'SELECT * FROM day_template_slots WHERE user_id = ?'],
    ['weekPattern', 'SELECT * FROM week_patterns WHERE user_id = ?'],
    ['reviews', 'SELECT * FROM reviews WHERE user_id = ?'],
    ['reviewTemplates', 'SELECT * FROM review_templates WHERE user_id = ?'],
    ['reviewSchedules', 'SELECT * FROM review_schedules WHERE user_id = ?'],
    ['listings', 'SELECT * FROM preowned_listings WHERE seller_id = ?'],
    ['offers', 'SELECT * FROM preowned_offers WHERE buyer_id = ?'],
    ['runEntries', 'SELECT * FROM run_entries WHERE user_id = ?'],
    ['runClubs', 'SELECT * FROM run_members WHERE user_id = ?'],
    ['assessments', 'SELECT * FROM assessments WHERE user_id = ?'],
    ['placements', 'SELECT * FROM placements WHERE user_id = ?'],
    ['routines', 'SELECT * FROM routines WHERE user_id = ?'],
    ['contracts', 'SELECT * FROM contracts WHERE user_id = ?'],
    ['routineDays', 'SELECT * FROM routine_days WHERE user_id = ?'],
    ['callRequests', 'SELECT id, status, amount_cents, currency, created_at, paid_at FROM call_requests WHERE user_id = ?'],
    ['brands', 'SELECT * FROM brands WHERE owner_id = ?'],
    ['brandSources', 'SELECT s.* FROM brand_sources s JOIN brands b ON b.id = s.brand_id WHERE b.owner_id = ?'],
    ['brandPieces', 'SELECT p.* FROM brand_pieces p JOIN brands b ON b.id = p.brand_id WHERE b.owner_id = ?'],
    ['assistantActions', 'SELECT * FROM assistant_actions WHERE user_id = ?'],
    ['creditAccount', 'SELECT * FROM credit_accounts WHERE user_id = ?'],
    ['creditLedger', 'SELECT * FROM credit_ledger WHERE user_id = ?'],
    ['attendeeClaims', 'SELECT * FROM attendee_claims WHERE user_id = ?'],
    ['cardUnlocks', 'SELECT * FROM card_unlocks WHERE user_id = ?'],
    ['badgeGrants', 'SELECT * FROM badge_grants WHERE user_id = ?'],
    ['badgeAwards', 'SELECT * FROM badge_awards WHERE user_id = ?'],
    ['focusRounds', 'SELECT * FROM focus_rounds WHERE user_id = ?'],
    ['discoverDraft', 'SELECT * FROM discover_drafts WHERE user_id = ?'],
    ['discoverSettings', 'SELECT * FROM discover_settings WHERE user_id = ?'],
    ['discoverResults', 'SELECT * FROM discover_results WHERE user_id = ?'],
    ['discoverExtras', 'SELECT * FROM discover_extras WHERE user_id = ?'],
    // Coaching, on either side: the links, the notes, the change log, and a coach's own line.
    ['coachLinks', 'SELECT * FROM coach_links WHERE coach_id = ? OR student_id = ?'],
    ['coachNotes', 'SELECT * FROM coach_notes WHERE coach_id = ? OR student_id = ?'],
    ['coachLog', 'SELECT * FROM coach_log WHERE coach_id = ? OR student_id = ?'],
    // Connections the team made with them (Admin, Connect people): the kind, the state and when, never who on the team or the other's answer.
    ['teamConnections', 'SELECT id, kind, mode, place, status, created_at, answered_at, ended_at, came_true_at FROM team_connections WHERE first_user_id = ? OR second_user_id = ?'],
    // Invite codes they made and the one they joined with: the label, the dates and whether it is used, never the code itself (a live key) or who used it.
    // The label is the maker's private words, so only the maker's own rows carry it (the safety review, 2026-11-10).
    ['inviteCodes', "SELECT id, CASE WHEN created_by = ? THEN label ELSE '' END AS label, created_at, expires_at, revoked_at, used_at, setup_done_at, active_at, CASE WHEN created_by = ? THEN 'made' ELSE 'joined with' END AS mine, 1 AS has_link FROM invite_codes WHERE created_by = ? OR used_by = ?"],
    // Their waitlist row, found by the account's email.
    ['waitlist', 'SELECT name, email, note, status, created_at, decided_at FROM waitlist WHERE email = (SELECT email FROM users WHERE id = ?)'],
    ['coachProfile', 'SELECT * FROM coach_profiles WHERE user_id = ?'],
    // What shows on their Coaching pages, and that a coach has an invite link (never the token: it is a live key).
    ['coachPrefs', 'SELECT * FROM coach_prefs WHERE user_id = ?'],
    ['coachInvite', 'SELECT coach_id, created_at FROM coach_invites WHERE coach_id = ?'],
    ['postsFollowed', 'SELECT * FROM community_post_follows WHERE user_id = ?'],
    ['replyReactions', 'SELECT * FROM community_reply_reactions WHERE user_id = ?'],
    ['seasonResults', 'SELECT * FROM season_results WHERE user_id = ?'],
    // What the person added to events, listings and lessons, and who they blocked. Uploaded files are listed without their bytes.
    ['uploads', 'SELECT id, mime, size, created_at FROM media_files WHERE owner_id = ?'],
    ['mediaItems', 'SELECT * FROM media_items WHERE added_by = ?'],
    ['eventMessages', 'SELECT * FROM event_messages WHERE user_id = ?'],
    ['channelLines', 'SELECT seq, id, channel_id, body, anonymous, reply_to, created_at, deleted_at FROM channel_messages WHERE user_id = ?'],
    ['channelSeats', 'SELECT * FROM channel_members WHERE user_id = ?'],
    ['channelsMade', 'SELECT * FROM channels WHERE created_by = ?'],
    ['runLines', 'SELECT seq, id, run_id, body, anonymous, reply_to, created_at, deleted_at FROM run_messages WHERE user_id = ?'],
    ['runDiscussionReads', 'SELECT * FROM run_discussion_reads WHERE user_id = ?'],
    ['cohortTalkLines', 'SELECT id, cohort_id, thread_id, parent_id, reply_to_id, depth, body, created_at, deleted_at FROM cohort_talk WHERE user_id = ?'],
    ['cohortTalkPrefs', 'SELECT * FROM cohort_talk_prefs WHERE user_id = ?'],
    ['programInvites', 'SELECT program_id, created_at FROM program_invites WHERE user_id = ?'],
    ['eventNetworking', 'SELECT * FROM event_networking WHERE user_id = ?'],
    // Blocks by name; a block made from an anonymous post is exported as the made-up name only, never who it was (migration 0099).
    ['blocks', 'SELECT blocked_id, reason, created_at FROM blocks WHERE blocker_id = ? AND by_name = 1'],
    ['anonymousBlocks', 'SELECT alias, created_at FROM block_aliases WHERE blocker_id = ?'],
    ['waterLogs', 'SELECT * FROM water_logs WHERE user_id = ?'],
    ['reminderPrefs', 'SELECT * FROM reminder_prefs WHERE user_id = ?'],
    ['focusPrefs', 'SELECT * FROM focus_prefs WHERE user_id = ?'],
    ['calendarFeed', 'SELECT user_id, enabled, created_at FROM calendar_feeds WHERE user_id = ?'],
    ['customReminders', 'SELECT * FROM custom_reminders WHERE user_id = ?'],
    ['agencySettings', 'SELECT * FROM agency_settings WHERE user_id = ?'],
    // The password hash and salt of a client link or a team link are never exported, nor are their sessions.
    ['agencyClients', 'SELECT id, user_id, name, contact_name, contact_email, status, health, channels_json, retainer_cents, pieces_per_month, hours_per_month, renewal_date, notes, campaign_id, billing_json, (portal_token IS NOT NULL) AS has_client_link, portal_json, created_at, updated_at, stage, stage_since, lifecycle_json, ticks_json, revisions_per_piece, (portal_pass_hash IS NOT NULL) AS portal_has_password, portal_pass_set_at, portal_last_opened_day, onboarding_json, onboarded_at, onboarding_needed, (team_link_token IS NOT NULL) AS has_team_link, team_link_json, (team_link_pass_hash IS NOT NULL) AS team_link_has_password, team_link_pass_set_at, team_link_opened_day FROM agency_clients WHERE user_id = ?'],
    ['agencyPasswordRequests', 'SELECT * FROM agency_password_requests WHERE user_id = ?'],
    ['agencyRetainers', 'SELECT * FROM agency_retainers WHERE user_id = ?'],
    ['agencyCycles', 'SELECT * FROM agency_cycles WHERE user_id = ?'],
    ['agencyLog', 'SELECT * FROM agency_log WHERE user_id = ?'],
    ['agencyItems', 'SELECT * FROM agency_items WHERE user_id = ?'],
    ['agencyNotes', 'SELECT * FROM agency_notes WHERE user_id = ?'],
    ['agencyTime', 'SELECT * FROM agency_time WHERE user_id = ?'],
    ['agencyContracts', "SELECT id, user_id, client_id, title, template_key, status, doc_json, (token IS NOT NULL AND token != '') AS has_link, answers_json, acceptance_json, sent_at, signed_at, revised_at, created_at, updated_at, voided_from FROM agency_contracts WHERE user_id = ?"],
    ['agencyDocComments', 'SELECT * FROM agency_doc_comments WHERE user_id = ?'],
    ['agencyDocs', "SELECT id, user_id, client_id, kind, title, status, body_json, (token IS NOT NULL AND token != '') AS has_link, answers_json, approval_json, sent_at, approved_at, revised_at, created_at, updated_at, voided_from FROM agency_docs WHERE user_id = ?"],
    ['agencyDocLog', 'SELECT * FROM agency_doc_log WHERE user_id = ?'],
    ['agencyTemplates', 'SELECT * FROM agency_templates WHERE user_id = ?'],
    // The Agency team: the people on yours, and the teams you joined (without the client it ties you to or the owner's details).
    ['agencyTeam', 'SELECT * FROM agency_team WHERE owner_id = ?'],
    ['agencyTeamsJoined', 'SELECT id, owner_id, role, status, access_json, invited_at, joined_at, removed_at FROM agency_team WHERE member_id = ?'],
    ['kpiPrefs', 'SELECT * FROM kpi_prefs WHERE user_id = ?'],
    ['discountRedemptions', 'SELECT r.id, c.code, r.area, r.ref, r.item_id, r.off_cents, r.off_points, r.currency, r.released_at, r.created_at FROM discount_redemptions r JOIN discount_codes c ON c.id = r.code_id WHERE r.user_id = ?'],
    ['kpis', 'SELECT * FROM kpis WHERE user_id = ?'],
    ['kpiValues', 'SELECT v.* FROM kpi_values v JOIN kpis k ON k.id = v.kpi_id WHERE k.user_id = ?'],
    // What you agreed to and chose, and the rest of what you wrote or earned.
    ['termsAcceptances', 'SELECT * FROM terms_acceptances WHERE user_id = ?'],
    ['privacyChoices', 'SELECT * FROM user_consents WHERE user_id = ?'],
    ['privacyChoiceLog', 'SELECT * FROM consent_records WHERE user_id = ?'],
    // The model alone: a line's stored model also says what its answer read from All tables (aiOpen.ts, `withReads`), which is the app's own.
    ['companionChat', "SELECT id, user_id, role, body, created_at, CASE WHEN instr(model, '#reads:') > 0 THEN substr(model, 1, instr(model, '#reads:') - 1) ELSE model END AS model FROM chat_messages WHERE user_id = ?"],
    ['portfolio', 'SELECT * FROM portfolio_items WHERE user_id = ?'],
    // The product events kept against you (checkout started, paid, failed, refunded), so the export covers what delete removes.
    ['productEvents', 'SELECT name, props_json, created_at FROM analytics_events WHERE user_id = ?'],
    ['payoutDetails', 'SELECT user_id, status, legal_name, pan_last4, bank_last4, ifsc, address, submitted_at, decided_at FROM kyc_profiles WHERE user_id = ?'],
    ['posts', 'SELECT * FROM community_posts WHERE user_id = ?'],
    ['replies', 'SELECT * FROM community_replies WHERE user_id = ?'],
    ['bondMessages', 'SELECT * FROM bond_messages WHERE user_id = ?'],
    ['circleMessages', 'SELECT * FROM circle_messages WHERE user_id = ?'],
    ['listingMessages', 'SELECT * FROM preowned_messages WHERE sender_id = ?'],
    ['supportTickets', 'SELECT * FROM support_tickets WHERE user_id = ?'],
    ['financeDues', 'SELECT * FROM finance_dues WHERE user_id = ?'],
    ['financeGoals', 'SELECT * FROM finance_goals WHERE user_id = ?'],
    ['financeRecurring', 'SELECT * FROM finance_recurring WHERE user_id = ?'],
    ['financeBudgets', 'SELECT * FROM finance_budgets WHERE user_id = ?'],
    ['xpEvents', 'SELECT * FROM xp_events WHERE user_id = ?'],
    ['pillarScores', 'SELECT * FROM relationship_scores WHERE user_id = ?'],
    // 2026-11-07, the cross-check (scripts/data-coverage.mjs): the rest of what a person wrote or what is about them. No hash, salt, session or
    // code someone else could use, and of another person nothing beyond what this person is shown on their own screens.
    ['accountDetails', 'SELECT lat, lng, referred_by, fee_bps, is_pro, getting_started_hidden_at, time_blocks_seeded_at FROM users WHERE id = ?'],
    ['onboardingAnswers', 'SELECT question_id, relationship, value, points, created_at FROM onboarding_answers WHERE user_id = ?'],
    ['smallActs', 'SELECT date, relationship, created_at FROM spark_completions WHERE user_id = ?'],
    ['honors', 'SELECT honor_key, note, awarded_at FROM honors WHERE user_id = ?'],
    ['rewardReservations', 'SELECT * FROM redemptions WHERE user_id = ?'],
    ['appOverrides', "SELECT flag_key, enabled, expires_at, reason, created_at FROM flag_overrides WHERE subject_type = 'user' AND subject_id = ?"],
    ['researchRuns', 'SELECT r.* FROM research_runs r JOIN brands b ON b.id = r.brand_id WHERE b.owner_id = ?'],
    // People: friends, who you follow and who follows you, introductions, reactions, and Bond chats (made-up names only: a chat never names the other person).
    ['friends', 'SELECT id, requester_id, recipient_id, status, created_at, answered_at FROM friendships WHERE requester_id = ? OR recipient_id = ?'],
    ['following', 'SELECT owner_id, created_at FROM follows WHERE follower_id = ?'],
    ['followers', 'SELECT follower_id, created_at FROM follows WHERE owner_id = ?'],
    ['introductions', 'SELECT * FROM introductions WHERE requester_user_id = ? OR recipient_user_id = ?'],
    ['postReactions', 'SELECT post_id, kind, created_at FROM community_likes WHERE user_id = ?'],
    ['bondChats', 'SELECT id, source, created_at, last_message_at, CASE WHEN a_user_id = ? THEN a_alias ELSE b_alias END AS my_alias, CASE WHEN a_user_id = ? THEN b_alias ELSE a_alias END AS their_alias FROM bond_chats WHERE a_user_id = ? OR b_user_id = ?'],
    ['mutes', 'SELECT reason, created_at FROM community_mutes WHERE user_id = ?'],
    ['clubMembership', 'SELECT id, membership_type, status, note, decision_note, starts_at, ends_at, created_at FROM memberships WHERE user_id = ?'],
    ['organizations', 'SELECT o.id, o.name, o.type, m.role, m.status, m.created_at FROM organization_members m JOIN organizations o ON o.id = m.organization_id WHERE m.user_id = ?'],
    // Events: your seats and what you said about them, and what you host. A code is a live key, so a host's code is never in here. A circle's seat is your own row only.
    ['eventSeats', 'SELECT id, event_id, status, registered_at, checked_in_at, networking_opt_in, paid_points FROM event_registrations WHERE user_id = ?'],
    ['eventFeedback', 'SELECT event_id, rating, comment, created_at FROM event_feedback WHERE user_id = ?'],
    ['eventsHosted', 'SELECT * FROM events WHERE host_user_id = ?'],
    ['eventPhotoLinks', 'SELECT app, event_id, url, note, updated_at FROM event_photos WHERE set_by = ?'],
    ['attendeeCodesSet', 'SELECT app, thing_id, xp, created_at, updated_at FROM attendee_codes WHERE created_by = ?'],
    ['circleSignups', 'SELECT event_id, note, status, created_at FROM circle_signups WHERE user_id = ?'],
    ['circleSeats', 'SELECT group_id, alias, character, revealed, status FROM circle_members WHERE user_id = ?'],
    ['circlesMade', 'SELECT * FROM circle_events WHERE created_by = ?'],
    ['runClubsHosted', 'SELECT * FROM run_clubs WHERE host_user_id = ?'],
    ['runsHosted', 'SELECT r.id, r.club_id, r.title, r.meeting_point, r.starts_at, r.ends_at, r.metres, r.xp, r.status, r.created_at FROM runs r JOIN run_clubs k ON k.id = r.club_id WHERE k.host_user_id = ?'],
    ['collabApplications', 'SELECT * FROM run_collab_applications WHERE user_id = ?'],
    ['collabsPosted', 'SELECT * FROM run_collabs WHERE created_by = ?'],
    // Work, rewards, Army, TV and Fund: what you sent in, what was said about it, and what you posted or wrote as a reviewer.
    ['applications', 'SELECT * FROM applications WHERE creator_user_id = ?'],
    ['applicationLog', 'SELECT e.application_id, e.event_type, e.note, e.created_at FROM application_events e LEFT JOIN applications a ON a.id = e.application_id WHERE e.actor_user_id = ? OR a.creator_user_id = ?'],
    ['opportunitiesPosted', 'SELECT * FROM opportunities WHERE created_by = ?'],
    ['rewardsMade', 'SELECT * FROM bounties WHERE created_by = ?'],
    ['rewardEntries', 'SELECT * FROM bounty_submissions WHERE user_id = ?'],
    ['rewardEntryNumbers', 'SELECT m.submission_id, m.views, m.likes, m.comments, m.shares, m.source, m.note, m.fetched_at FROM social_metrics m JOIN bounty_submissions s ON s.id = m.submission_id WHERE s.user_id = ?'],
    ['campaignsOwned', 'SELECT * FROM campaigns WHERE owner_user_id = ?'],
    ['campaignRoles', 'SELECT * FROM campaign_assignments WHERE creator_user_id = ?'],
    ['campaignLog', 'SELECT campaign_id, event_type, note, created_at FROM campaign_events WHERE actor_user_id = ?'],
    ['deliverableVersions', 'SELECT * FROM deliverable_versions WHERE submitted_by = ?'],
    ['deliverableFeedback', 'SELECT f.id, f.deliverable_version_id, f.comment, f.status, f.created_at FROM feedback_items f JOIN deliverable_versions v ON v.id = f.deliverable_version_id WHERE f.author_user_id = ? OR v.submitted_by = ?'],
    ['pitches', 'SELECT * FROM proposals WHERE user_id = ?'],
    ['pitchLog', 'SELECT l.proposal_id, l.from_stage, l.to_stage, l.note, l.created_at FROM decision_log l LEFT JOIN proposals p ON p.id = l.proposal_id WHERE l.actor_user_id = ? OR p.user_id = ?'],
    // School: as a learner, and what you made or ran.
    ['enrollments', 'SELECT * FROM enrollments WHERE learner_user_id = ?'],
    ['handIns', 'SELECT * FROM submissions WHERE learner_user_id = ?'],
    ['handInFeedback', 'SELECT f.submission_id, f.comment, f.grade, f.created_at FROM submission_feedback f LEFT JOIN submissions s ON s.id = f.submission_id WHERE f.reviewer_user_id = ? OR s.learner_user_id = ?'],
    ['attendance', 'SELECT session_id, status, checked_in_at FROM attendance WHERE user_id = ?'],
    ['programsMade', 'SELECT * FROM programs WHERE created_by = ?'],
    ['programLessons', 'SELECT i.* FROM learning_items i JOIN programs p ON p.id = i.program_id WHERE p.created_by = ?'],
    ['programAssignments', 'SELECT a.* FROM course_assignments a JOIN programs p ON p.id = a.program_id WHERE p.created_by = ?'],
    ['cohortsManaged', 'SELECT * FROM cohorts WHERE manager_user_id = ?'],
    // The Shop, as a seller: what you sell, the people you gathered (their names and emails, as your own list shows them), and how a link did, in counts.
    ['products', 'SELECT * FROM products WHERE owner_id = ?'],
    ['productLessons', 'SELECT l.* FROM lessons l JOIN products p ON p.id = l.product_id WHERE p.owner_id = ?'],
    ['coupons', 'SELECT * FROM coupons WHERE owner_id = ?'],
    ['availability', 'SELECT * FROM availability WHERE owner_id = ?'],
    ['availabilityOverrides', 'SELECT * FROM availability_overrides WHERE owner_id = ?'],
    ['leads', 'SELECT * FROM leads WHERE owner_id = ?'],
    ['broadcasts', 'SELECT * FROM broadcasts WHERE owner_id = ?'],
    ['sequences', 'SELECT * FROM sequences WHERE owner_id = ?'],
    ['dmAutomations', 'SELECT * FROM dm_automations WHERE owner_id = ?'],
    ['dmSends', 'SELECT s.automation_id, s.recipient_handle, s.status, s.created_at FROM dm_sends s JOIN dm_automations a ON a.id = s.automation_id WHERE a.owner_id = ?'],
    ['trackedLinks', 'SELECT * FROM tracked_links WHERE owner_id = ?'],
    ['linkClicks', 'SELECT link_id, country, COUNT(*) AS clicks, MIN(created_at) AS first_at, MAX(created_at) AS last_at FROM link_clicks INDEXED BY idx_clicks_link WHERE link_id IN (SELECT id FROM tracked_links WHERE owner_id = ?) GROUP BY link_id, country'],
    ['contentItems', 'SELECT * FROM content_items WHERE owner_id = ?'],
    ['funnels', 'SELECT * FROM funnels WHERE owner_id = ?'],
    ['pageVisits', 'SELECT kind, ref, COUNT(*) AS n, MIN(created_at) AS first_at, MAX(created_at) AS last_at FROM page_events WHERE owner_id = ? GROUP BY kind, ref'],
    ['reviewsReceived', 'SELECT product_id, rating, body, approved, created_at FROM testimonials WHERE owner_id = ?'],
    // The Shop, as a buyer: your reviews, your paid questions and their answers, what you finished, and a list that holds your own address.
    ['reviewsWritten', 'SELECT id, product_id, rating, body, approved, created_at FROM testimonials WHERE author_id = ?'],
    ['dmQuestions', 'SELECT * FROM dm_requests WHERE buyer_id = ? OR owner_id = ?'],
    ['certificates', 'SELECT code, product_id, issued_at FROM certificates WHERE user_id = ?'],
    ['lessonProgress', 'SELECT lesson_id, completed_at FROM lesson_progress WHERE user_id = ?'],
    ['quizAttempts', 'SELECT lesson_id, score, passed, created_at FROM quiz_attempts WHERE user_id = ?'],
    ['listsYouAreOn', 'SELECT owner_id, source, message, created_at FROM leads WHERE lower(email) = (SELECT lower(email) FROM users WHERE id = ?)'],
    // What you made for everyone as the team, and notes you wrote on someone else's Agency.
    ['knowledgeWritten', 'SELECT * FROM resources WHERE author_id = ?'],
    ['toolsSuggested', 'SELECT * FROM tools WHERE suggested_by = ?'],
    ['storeItemsMade', 'SELECT * FROM store_items WHERE created_by = ?'],
    ['storeKitsMade', 'SELECT * FROM store_kits WHERE created_by = ?'],
    ['houseTemplatesMade', 'SELECT * FROM agency_house_templates WHERE created_by = ?'],
    ['discountCodesMade', 'SELECT code, kind, note, created_at FROM discount_codes WHERE created_by = ?'],
    ['agencyNotesWritten', 'SELECT id, item_id, body, created_at FROM agency_notes WHERE author_id = ? AND user_id != ?'],
    // What the app itself keeps about you. Mail by subject only: a body can hold a live link.
    ['emailsSent', 'SELECT to_email, subject, status, created_at, sent_at FROM email_outbox WHERE user_id = ?'],
    ['appLog', 'SELECT at, area, method, path, status FROM app_logs WHERE actor_id = ?'],
    ['auditTrail', "SELECT action, resource_type, resource_id, created_at FROM audit_logs WHERE actor_user_id = ? OR (resource_type = 'user' AND resource_id = ?)"],
    ['accountTimeline', "SELECT entity, type, data_json, created_at FROM timeline_events WHERE entity IN ('user', 'kyc') AND entity_id = ?"],
  ];
  const out: Record<string, unknown> = { exportedAt: nowIso(), user: toUser(user) };
  // Nothing of their own to export yet: the starting set is the app's, kept in code until their first change. Said plainly, since a date, a weekday or a task can name one by its id.
  if (!user.time_blocks_seeded_at) out.timeBlocksNote = 'You have not changed your time blocks or day templates, so those lists are empty and you are on the app’s starting set. An id like t-deep-… or b-deep-… on a day, a weekday or a task names a starting one.';
  // Every table in a few batches (one round trip each) instead of one trip per table.
  for (let i = 0; i < tables.length; i += 30) {
    const part = tables.slice(i, i + 30);
    const got = await db.batch(part.map(([, sql]) => db.prepare(sql).bind(...(sql.match(/\?/g) ?? []).map(() => user.id))));
    part.forEach(([name], j) => {
      out[name] = got[j]?.results ?? [];
    });
  }
  await db.prepare("INSERT INTO data_requests (id, kind, requested_at, completed_at, outcome) VALUES (?, 'export', ?, ?, 'sent')").bind(newId(), asked, nowIso()).run();
  return c.json(out);
});

// Delete the account: personal details go, money records stay anonymised for the books.
me.delete('/', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json<{ confirm?: string }>().catch(() => ({}) as { confirm?: string });
  if (body.confirm !== 'DELETE') return c.json({ error: 'send confirm: DELETE' }, 400);
  // The request is logged without a name: the date, and that it was done.
  const requestId = newId();
  const asked = nowIso();
  try {
    await deleteAccount(db, user.id, c.env);
  } catch (e) {
    if (e instanceof StillClosing) return c.json({ error: e.message, again: true }, 409);
    throw e;
  }
  await db.prepare("INSERT INTO data_requests (id, kind, requested_at, completed_at, outcome) VALUES (?, 'delete', ?, ?, 'account deleted')").bind(requestId, asked, nowIso()).run();
  // The app log's line for this very request is written after the answer, from the session's person: it names nobody now the account is gone.
  c.set('user', undefined as never);
  return c.json({ ok: true });
});

// The web app reports a few product events of its own, for the funnels under Admin.
me.post('/events', async (c) => {
  const body = await c.req.json<{ name?: string; props?: Record<string, unknown> }>().catch(() => ({}) as Record<string, never>);
  if (!(TRACKED_EVENTS as readonly string[]).includes(String(body.name))) return c.json({ error: 'unknown event' }, 400);
  await track(c.env.DB, c.get('user').id, body.name as TrackedEvent, body.props && typeof body.props === 'object' ? body.props : {});
  return c.json({ ok: true });
});

/** The list form of PATCH /me/modules, read whole: the apps and their new state, or why the whole list is refused. */
function readModuleChanges(raw: unknown): { key: string; on: boolean }[] | string {
  if (!Array.isArray(raw) || raw.length === 0) return 'name at least one app';
  if (raw.length > MODULES.length) return 'that is more apps than there are';
  const seen = new Set<string>();
  const changes: { key: string; on: boolean }[] = [];
  for (const item of raw as unknown[]) {
    const { key, on } = (item !== null && typeof item === 'object' ? item : {}) as { key?: unknown; on?: unknown };
    const m = typeof key === 'string' ? MODULE_BY_KEY[key] : undefined;
    if (!m) return 'no such module';
    if (m.locked) return 'that one stays on';
    if (typeof on !== 'boolean') return 'say true or false for each app';
    if (seen.has(m.key)) return 'name each app once';
    seen.add(m.key);
    changes.push({ key: m.key, on });
  }
  return changes;
}

// Hide or show your own apps: one with { key, on }, or several with { changes: [{ key, on }, ...] }. The list is one write, since several
// calls at once would each read the same old list and overwrite each other, and a list with anything wrong in it writes nothing.
me.patch('/modules', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await objectBody(c);
  const mine = parseModules(user.modules);
  if (body.changes !== undefined) {
    const changes = readModuleChanges(body.changes);
    if (typeof changes === 'string') return c.json({ error: changes }, 400);
    for (const { key, on } of changes) mine[key] = on;
  } else {
    const m = typeof body.key === 'string' ? MODULE_BY_KEY[body.key] : undefined;
    if (!m) return c.json({ error: 'no such module' }, 404);
    if (m.locked) return c.json({ error: 'that one stays on' }, 400);
    mine[m.key] = body.on !== false;
  }
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
    db.prepare('DELETE FROM badge_awards WHERE user_id = ?').bind(user.id),
    db.prepare('DELETE FROM spark_completions WHERE user_id = ?').bind(user.id),
    db.prepare('DELETE FROM onboarding_answers WHERE user_id = ?').bind(user.id),
    db.prepare('DELETE FROM assessments WHERE user_id = ?').bind(user.id),
    db.prepare('DELETE FROM placements WHERE user_id = ?').bind(user.id),
    db.prepare('DELETE FROM routines WHERE user_id = ?').bind(user.id),
    db.prepare('DELETE FROM contracts WHERE user_id = ?').bind(user.id),
    db.prepare('DELETE FROM routine_days WHERE user_id = ?').bind(user.id),
    // Starting over clears what the assistant did; a plan and its credits are paid for, so they stay, and so do unlocked card games and an ask for the live call. Attendee claims
    // and run entries stay too: clearing them would let the same event's code, or the same run, pay again. A life
    // coach stays as well, with the notes and the change log: that is a person, not progress. The tasks a coach
    // added go with the pyramids.
    db.prepare('DELETE FROM assistant_actions WHERE user_id = ?').bind(user.id),
    db.prepare('DELETE FROM assistant_runs WHERE user_id = ?').bind(user.id),
    db.prepare('DELETE FROM discover_drafts WHERE user_id = ?').bind(user.id),
    db.prepare('DELETE FROM focus_rounds WHERE user_id = ?').bind(user.id),
    db.prepare('DELETE FROM discover_settings WHERE user_id = ?').bind(user.id),
    db.prepare('DELETE FROM discover_results WHERE user_id = ?').bind(user.id),
    db.prepare('DELETE FROM discover_extras WHERE user_id = ?').bind(user.id),
    db.prepare('DELETE FROM points_ledger WHERE user_id = ?').bind(user.id),
    db.prepare("DELETE FROM redemptions WHERE user_id = ? AND status = 'reserved'").bind(user.id),
    db.prepare('UPDATE relationship_scores SET score = 0, xp = 0 WHERE user_id = ?').bind(user.id),
    db
      .prepare("UPDATE users SET xp = 0, points = 0, streak = 0, best_streak = 0, last_checkin = NULL, onboarded_at = NULL, attendee_event = NULL, reminder_time = NULL, identities = '[]', intake_json = '{}', stats_json = NULL, stats_at = NULL WHERE id = ?")
      .bind(user.id),
  ]);
  return c.json({ ok: true, at: nowIso() });
});
