import { Hono } from 'hono';
import { levelProgress, nudgeFor, RELATIONSHIPS, type HomeFloor, type HomeResponse, type HomeUpNext, type RelationshipKey } from '@kreators/shared';
import type { AppEnv } from '../env';
import { parseList } from '../db';
import { lifeSummary } from './life';
import { summaryFor } from './wellbeing';

/**
 * One screen that answers "how am I doing" before "what do I do": the numbers and their trend,
 * today's three, the floors, the five areas, money and sales when those modules are on, and what is next.
 */
export const home = new Hono<AppEnv>();

const dayOf = (iso: string) => iso.slice(0, 10);

home.get('/', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const date = c.req.query('date') && /^\d{4}-\d{2}-\d{2}$/.test(c.req.query('date') ?? '') ? (c.req.query('date') as string) : new Date().toISOString().slice(0, 10);
  const hourRaw = Number(c.req.query('hour'));
  const hour = Number.isFinite(hourRaw) && hourRaw >= 0 && hourRaw <= 23 ? Math.floor(hourRaw) : new Date().getUTCHours();
  const month = date.slice(0, 7);
  const nowIso = new Date().toISOString();
  const soon = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
  const days: string[] = [];
  for (let i = 13; i >= 0; i -= 1) days.push(new Date(new Date(`${date}T00:00:00Z`).getTime() - i * 86_400_000).toISOString().slice(0, 10));
  const since = `${days[0]}T00:00:00`;

  const [xpRows, taskRows, floors, pillars, sparkDone, waiting, doneRecently, unread, fin, dues, overdue, dueSoon, shopCounts, orderDays, events, bookings, circles, life, wb, journalDays, chat, srcRows, reads] = await Promise.all([
    db.prepare('SELECT substr(created_at, 1, 10) AS d, SUM(amount) AS xp FROM xp_events WHERE user_id = ? AND created_at >= ? GROUP BY d').bind(user.id, since).all<{ d: string; xp: number }>(),
    db.prepare("SELECT substr(completed_at, 1, 10) AS d, COUNT(*) AS n FROM nodes WHERE user_id = ? AND kind = 'task' AND status = 'done' AND completed_at >= ? GROUP BY d").bind(user.id, since).all<{ d: string; n: number }>(),
    db.prepare('SELECT relationship, xp FROM relationship_scores WHERE user_id = ?').bind(user.id).all<{ relationship: RelationshipKey; xp: number }>(),
    db.prepare("SELECT relationship, COUNT(*) AS n FROM nodes WHERE user_id = ? AND kind = 'pillar' AND status = 'active' GROUP BY relationship").bind(user.id).all<{ relationship: RelationshipKey; n: number }>(),
    db.prepare('SELECT relationship FROM spark_completions WHERE user_id = ? AND date = ?').bind(user.id, date).first<{ relationship: RelationshipKey }>(),
    db.prepare("SELECT COUNT(*) AS n FROM nodes WHERE user_id = ? AND kind = 'task' AND status = 'active' AND (due_date IS NULL OR due_date <= ?)").bind(user.id, date).first<{ n: number }>(),
    db.prepare("SELECT COUNT(*) AS n FROM nodes WHERE user_id = ? AND kind = 'task' AND status = 'done' AND completed_at >= ?").bind(user.id, new Date(Date.now() - 86_400_000).toISOString()).first<{ n: number }>(),
    db.prepare('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL').bind(user.id).first<{ n: number }>(),
    db.prepare('SELECT kind, currency, SUM(amount_cents) AS cents, COUNT(*) AS n FROM finance_transactions WHERE user_id = ? AND date LIKE ? GROUP BY kind, currency').bind(user.id, `${month}%`).all<{ kind: 'income' | 'expense'; currency: string; cents: number; n: number }>(),
    db.prepare("SELECT direction, SUM(amount_cents) AS cents FROM finance_dues WHERE user_id = ? AND status = 'open' GROUP BY direction").bind(user.id).all<{ direction: 'owe' | 'owed'; cents: number }>(),
    db.prepare("SELECT COUNT(*) AS n FROM invoices WHERE user_id = ? AND status = 'sent' AND due_date IS NOT NULL AND due_date < ?").bind(user.id, date).first<{ n: number }>(),
    db.prepare("SELECT COUNT(*) AS n FROM finance_dues WHERE user_id = ? AND status = 'open' AND direction = 'owe' AND due_date IS NOT NULL AND due_date <= ?").bind(user.id, soon).first<{ n: number }>(),
    db
      .prepare(
        `SELECT
          (SELECT COUNT(*) FROM products WHERE owner_id = ?1 AND status != 'archived') AS products,
          (SELECT COUNT(*) FROM orders WHERE owner_id = ?1 AND status IN ('paid','test') AND created_at >= ?2) AS orders,
          (SELECT COALESCE(SUM(points),0) FROM orders WHERE owner_id = ?1 AND status IN ('paid','test') AND created_at >= ?2) AS points,
          (SELECT COALESCE(SUM(cents),0) FROM orders WHERE owner_id = ?1 AND status IN ('paid','test') AND created_at >= ?2) AS cents,
          (SELECT currency FROM orders WHERE owner_id = ?1 AND cents > 0 ORDER BY created_at DESC LIMIT 1) AS currency,
          (SELECT COUNT(*) FROM page_events WHERE owner_id = ?1 AND kind = 'view') AS views,
          (SELECT COUNT(*) FROM follows WHERE owner_id = ?1) AS followers`,
      )
      .bind(user.id, `${month}-01T00:00:00`)
      .first<{ products: number; orders: number; points: number; cents: number; currency: string | null; views: number; followers: number }>(),
    db.prepare("SELECT substr(created_at, 1, 10) AS d, COUNT(*) AS n FROM orders WHERE owner_id = ? AND status IN ('paid','test') AND created_at >= ? GROUP BY d").bind(user.id, since).all<{ d: string; n: number }>(),
    db
      .prepare("SELECT e.id, e.title, e.starts_at FROM event_registrations r JOIN events e ON e.id = r.event_id WHERE r.user_id = ? AND r.status = 'registered' AND e.starts_at >= ? AND e.status = 'published' ORDER BY e.starts_at ASC LIMIT 3")
      .bind(user.id, nowIso)
      .all<{ id: string; title: string; starts_at: string }>(),
    db
      .prepare("SELECT b.id, b.starts_at, b.buyer_id, p.title FROM bookings b JOIN products p ON p.id = b.product_id WHERE (b.buyer_id = ?1 OR b.owner_id = ?1) AND b.status IN ('requested','confirmed') AND b.starts_at >= ?2 ORDER BY b.starts_at ASC LIMIT 3")
      .bind(user.id, nowIso)
      .all<{ id: string; starts_at: string; buyer_id: string; title: string }>(),
    db
      .prepare('SELECT g.id, g.name, g.chat_opens_at, e.title, e.starts_at FROM circle_members m JOIN circle_groups g ON g.id = m.group_id JOIN circle_events e ON e.id = g.event_id WHERE m.user_id = ? AND e.starts_at >= ? ORDER BY e.starts_at ASC LIMIT 2')
      .bind(user.id, nowIso)
      .all<{ id: string; name: string; chat_opens_at: string; title: string; starts_at: string }>(),
    lifeSummary(db, user.id),
    summaryFor(db, user.id, date, user.streak),
    db.prepare('SELECT substr(created_at, 1, 10) AS d, COUNT(*) AS n FROM journal_entries WHERE user_id = ? AND created_at >= ? GROUP BY d').bind(user.id, `${new Date(new Date(`${date}T00:00:00Z`).getTime() - 60 * 86_400_000).toISOString().slice(0, 10)}T00:00:00`).all<{ d: string; n: number }>(),
    db.prepare("SELECT COUNT(*) AS n FROM chat_messages WHERE user_id = ? AND role = 'user'").bind(user.id).first<{ n: number }>(),
    db.prepare('SELECT source, SUM(amount) AS xp FROM xp_events WHERE user_id = ? AND created_at >= ? GROUP BY source').bind(user.id, since).all<{ source: string; xp: number }>(),
    db.prepare('SELECT id, title, kind, tags FROM resources WHERE published = 1 ORDER BY created_at DESC LIMIT 2').all<{ id: string; title: string; kind: string; tags: string }>(),
  ]);

  const xpByDay = new Map(xpRows.results.map((r) => [r.d, r.xp]));
  const tasksByDay = new Map(taskRows.results.map((r) => [r.d, r.n]));
  const series = days.map((d) => ({ date: d, xp: xpByDay.get(d) ?? 0, tasks: tasksByDay.get(d) ?? 0 }));
  const xpToday = xpByDay.get(date) ?? 0;
  const xpWeek = series.slice(-7).reduce((s, d) => s + d.xp, 0);
  const lp = levelProgress(user.xp);
  const pillarsOf = new Map(pillars.results.map((p) => [p.relationship, p.n]));
  const floorList: HomeFloor[] = RELATIONSHIPS.map((r) => {
    const xp = floors.results.find((f) => f.relationship === r.key)?.xp ?? 0;
    const p = levelProgress(xp);
    return { relationship: r.key, level: p.level, xp, pct: p.pct, built: (pillarsOf.get(r.key) ?? 0) > 0 };
  });
  const hasFloor = floorList.some((f) => f.built);

  const checkedIn = user.last_checkin === date;
  const taskDone = (doneRecently?.n ?? 0) > 0;
  const tasksWaiting = waiting?.n ?? 0;
  const weakest = [...floorList].sort((a, b) => a.xp - b.xp)[0]?.relationship ?? 'self';
  const sparkRelationship = sparkDone?.relationship ?? weakest;
  const today: HomeResponse['today'] = {
    checkedIn,
    sparkDone: Boolean(sparkDone),
    sparkRelationship,
    taskDone,
    tasksWaiting,
    streak: user.streak,
    doneCount: Number(checkedIn) + Number(Boolean(sparkDone)) + Number(taskDone),
  };

  const income = fin.results.filter((f) => f.kind === 'income').reduce((s, f) => s + f.cents, 0);
  const expense = fin.results.filter((f) => f.kind === 'expense').reduce((s, f) => s + f.cents, 0);
  const owedToMe = dues.results.find((d) => d.direction === 'owed')?.cents ?? 0;
  const iOwe = dues.results.find((d) => d.direction === 'owe')?.cents ?? 0;
  const hasMoney = fin.results.length > 0 || dues.results.length > 0 || (overdue?.n ?? 0) > 0;
  const money: HomeResponse['money'] = hasMoney
    ? { currency: fin.results[0]?.currency ?? 'INR', incomeCents: income, expenseCents: expense, owedToMeCents: owedToMe, iOweCents: iOwe, overdueInvoices: overdue?.n ?? 0, dueSoon: dueSoon?.n ?? 0 }
    : null;

  const ordersByDay = new Map(orderDays.results.map((r) => [r.d, r.n]));
  const shop: HomeResponse['shop'] =
    shopCounts && shopCounts.products > 0
      ? {
          products: shopCounts.products,
          ordersMonth: shopCounts.orders,
          pointsMonth: shopCounts.points,
          centsMonth: shopCounts.cents,
          currency: shopCounts.currency ?? 'INR',
          views: shopCounts.views,
          followers: shopCounts.followers,
          days: days.map((d) => ({ date: d, orders: ordersByDay.get(d) ?? 0 })),
        }
      : null;

  const upNext: HomeUpNext[] = [
    ...events.results.map((e) => ({ kind: 'event' as const, title: e.title, at: e.starts_at, path: `/party/${e.id}` })),
    ...bookings.results.map((b) => ({ kind: (b.buyer_id === user.id ? 'session' : 'booking') as 'session' | 'booking', title: b.title, at: b.starts_at, path: b.buyer_id === user.id ? '/library' : '/shop/bookings' })),
    ...circles.results.map((g) => ({
      kind: 'circle' as const,
      title: `${g.title}, ${g.name}`,
      at: g.starts_at,
      path: `/circles/${g.id}`,
      note: new Date(g.chat_opens_at).getTime() <= Date.now() ? 'chat is open' : `chat opens ${dayOf(g.chat_opens_at)}`,
    })),
  ]
    .sort((a, b) => a.at.localeCompare(b.at))
    .slice(0, 4);

  // Journal: entries this month, the run of days with an entry ending today or yesterday, and the last seven days as dots.
  const journalByDay = new Map(journalDays.results.map((r) => [r.d, r.n]));
  const entriesMonth = journalDays.results.filter((r) => r.d.startsWith(month)).reduce((s, r) => s + r.n, 0);
  let streakDays = 0;
  for (let i = journalByDay.has(date) ? 0 : 1; ; i += 1) {
    const d = new Date(new Date(`${date}T00:00:00Z`).getTime() - i * 86_400_000).toISOString().slice(0, 10);
    if (!journalByDay.has(d)) break;
    streakDays += 1;
    if (streakDays > 365) break;
  }
  const last7 = days.slice(-7);
  const trackers: HomeResponse['trackers'] = {
    score: wb.score,
    label: wb.label,
    mood: { today: wb.week.find((w) => w.date === date)?.mood ?? null, week: wb.week.map((w) => w.mood) },
    sleep: { latest: wb.parts.find((p) => p.kind === 'sleep')?.latest ?? null, avg7: wb.parts.find((p) => p.kind === 'sleep')?.avg7 ?? null, week: wb.week.map((w) => w.sleep) },
    stress: { latest: wb.parts.find((p) => p.kind === 'stress')?.latest ?? null, week: wb.week.map((w) => w.stress) },
    mindful: { minutesWeek: wb.week.reduce((s, w) => s + w.mindful, 0), week: wb.week.map((w) => w.mindful) },
    journal: { entriesMonth, streakDays, week: last7.map((d) => journalByDay.has(d)), days14: days.map((d) => journalByDay.has(d)) },
  };

  // The ledger's sources: checkin, spark, task (and its cap and undo), done (ripples to the rungs above), project_clear and project_reopen.
  const bucket = (src: string): 'checkin' | 'spark' | 'task' | 'ripple' | 'other' => (src === 'checkin' ? 'checkin' : src === 'spark' ? 'spark' : src.startsWith('task') ? 'task' : src === 'done' || src.startsWith('project') ? 'ripple' : 'other');
  const xpBySource = (['checkin', 'spark', 'task', 'ripple', 'other'] as const).map((k) => ({ source: k, xp: srcRows.results.filter((r) => bucket(r.source) === k).reduce((s, r) => s + r.xp, 0) })).filter((x) => x.xp > 0);

  const res: HomeResponse = {
    date,
    trackers,
    xpBySource,
    companion: { messages: chat?.n ?? 0 },
    resources: reads.results.map((r) => ({ id: r.id, title: r.title, kind: r.kind, tag: parseList(r.tags)[0] ?? '' })),
    today,
    xp: { total: user.xp, today: xpToday, week: xpWeek, level: lp.level, into: lp.into, span: lp.span },
    points: user.points,
    days: series,
    floors: floorList,
    life: { overall: life.overall, label: life.label, areas: life.areas.map((a) => ({ key: a.key, score: a.score, trend: a.trend })) },
    money,
    shop,
    upNext,
    unread: unread?.n ?? 0,
    nudge: nudgeFor({ checkedIn, sparkDone: Boolean(sparkDone), taskDone, tasksWaiting, hasFloor, xpToday, streak: user.streak, hour }),
  };
  return c.json(res);
});
