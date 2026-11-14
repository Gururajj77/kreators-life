import { Hono } from 'hono';
import { DEFAULT_ZONE, zonedToUtc, type JournalEntry } from '@kreators/shared';
import {
  GRATITUDE_LINES,
  gratitudeMarkRound,
  gratitudeOfferFor,
  gratitudeOfferFrom,
  gratitudePick,
  gratitudePromptByKey,
  gratitudeSkip,
  gratitudeWritten,
  isGratitudeGroup,
  parseGratitudeLines,
  parseGratitudeUsual,
  readGratitudeLines,
  type GratitudeDay,
  type GratitudeGroup,
  type GratitudeSeen,
} from '@kreators/shared/gratitude';
import type { AppEnv } from '../env';
import { aiTableShut } from '../aiOpen';
import { BEFORE_JOINED, beforeStart, DATE_RE, dateNearToday, dayInZone, newId, nowIso, pageOf, paged, shiftDate, startDay } from '../db';

export const journal = new Hono<AppEnv>();

interface Row {
  id: string;
  title: string;
  body: string;
  emotion: number | null;
  stress: number | null;
  stressors: string;
  created_at: string;
  updated_at: string;
}

function toEntry(r: Row): JournalEntry {
  let stressors: string[] = [];
  try {
    stressors = JSON.parse(r.stressors || '[]') as string[];
  } catch {
    stressors = [];
  }
  return { id: r.id, title: r.title, body: r.body, emotion: r.emotion, stress: r.stress, stressors, createdAt: r.created_at, updatedAt: r.updated_at };
}

function parse(body: Record<string, unknown>, prev?: Row) {
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 120) : (prev?.title ?? '');
  const text = typeof body.body === 'string' ? body.body.trim().slice(0, 5000) : (prev?.body ?? '');
  const emotion = typeof body.emotion === 'number' && body.emotion >= 1 && body.emotion <= 5 ? Math.round(body.emotion) : body.emotion === null ? null : (prev?.emotion ?? null);
  const stress = typeof body.stress === 'number' && body.stress >= 1 && body.stress <= 5 ? Math.round(body.stress) : body.stress === null ? null : (prev?.stress ?? null);
  const stressors = Array.isArray(body.stressors) ? body.stressors.filter((s): s is string => typeof s === 'string').slice(0, 8) : prev ? (JSON.parse(prev.stressors || '[]') as string[]) : [];
  return { title, text, emotion, stress, stressors };
}

/** A day the calendar can write to: a real date, today or earlier (a day ahead is allowed for time zones). */
const pastDay = (v: unknown): v is string => typeof v === 'string' && DATE_RE.test(v) && v <= shiftDate(new Date().toISOString().slice(0, 10), 1);
/** A day in the person's own zone as the UTC instants it runs between, so an entry written at 3 am in India files on that day, like gratitude. */
const dayBounds = (day: string, zone: string): [string, string] => [zonedToUtc(day, 0, zone || DEFAULT_ZONE).toISOString(), zonedToUtc(shiftDate(day, 1), 0, zone || DEFAULT_ZONE).toISOString()];

// One month of the calendar: for each day with an entry, how many and how it felt on average.
journal.get('/days', async (c) => {
  const month = c.req.query('month') ?? '';
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return c.json({ error: 'send month as YYYY-MM' }, 400);
  const next = shiftDate(`${month}-01`, 32).slice(0, 7);
  const zone = c.get('user').timezone;
  const [from] = dayBounds(`${month}-01`, zone);
  const [to] = dayBounds(`${next}-01`, zone);
  const [entries, grat] = await Promise.all([
    // Filed on the person's own day (their zone), never the UTC date.
    c.env.DB.prepare('SELECT created_at, emotion FROM journal_entries WHERE user_id = ? AND created_at >= ? AND created_at < ?').bind(c.get('user').id, from, to).all<{ created_at: string; emotion: number | null }>(),
    // The days that have gratitude written, for the calendar's small mark. Days only, never a word.
    c.env.DB.prepare('SELECT day FROM gratitude_days WHERE user_id = ? AND day >= ? AND day < ? ORDER BY day').bind(c.get('user').id, `${month}-01`, `${next}-01`).all<{ day: string }>(),
  ]);
  const byDay = new Map<string, { n: number; sum: number; felt: number }>();
  for (const r of entries.results) {
    const d = dayInZone(zone, new Date(r.created_at));
    const b = byDay.get(d) ?? { n: 0, sum: 0, felt: 0 };
    b.n += 1;
    if (r.emotion !== null) {
      b.sum += r.emotion;
      b.felt += 1;
    }
    byDay.set(d, b);
  }
  const days = [...byDay].sort(([a], [b]) => (a < b ? -1 : 1)).map(([date, b]) => ({ date, count: b.n, emotion: b.felt ? Math.round(b.sum / b.felt) : null }));
  return c.json({ days, gratitude: grat.results.map((r) => r.day) });
});

// ---- Gratitude for the day (migration 0102): three lines a day, each under a prompt, one row per person per day. Journal data:
// owner only, every query filters by the session user, and nothing here is ever read for anyone else.
interface GratitudeRow {
  day: string;
  lines_json: string;
  updated_at: string;
}
const toGratitude = (r: GratitudeRow): GratitudeDay => ({ day: r.day, lines: readGratitudeLines(r.lines_json, r.day), updatedAt: r.updated_at });

// ---- The prompts per person (migration 0106; the rules are in '@kreators/shared/gratitude'). A day's three prompts are made once
// when the day is first opened and kept in gratitude_offers, so every reload, tab and device shows the same three; the seen marks
// (written under, or skipped) decide which prompt of a group comes next; the usual three, when pinned, shape each new day.

/** A day's kept prompts, or null when the row is not three real prompts from three different groups. */
function readPrompts(json: string): string[] | null {
  try {
    const v: unknown = JSON.parse(json);
    if (!Array.isArray(v) || v.length !== GRATITUDE_LINES) return null;
    const groups = new Set<string>();
    for (const k of v) {
      const p = typeof k === 'string' ? gratitudePromptByKey(k) : null;
      if (!p || groups.has(p.group)) return null;
      groups.add(p.group);
    }
    return v as string[];
  } catch {
    return null;
  }
}

/** The device's today when `day` is that day or the day before, else null. `today` must be near the server's own date. */
function openToday(day: string, today: unknown): string | null {
  const t = typeof today === 'string' && DATE_RE.test(today) && dateNearToday(today) ? today : null;
  return t && DATE_RE.test(day) && (day === t || day === shiftDate(t, -1)) ? t : null;
}

/**
 * The device's today when `day` is that day or any day before it, else null (2026-11-14, the founder: gratitude may change on any past day,
 * never one still to come). Saving a day's lines and clearing a day take it; the prompts (Another prompt, the pillar picker) and the screen's
 * card still open only on today or yesterday (`openToday`). `today` must be near the server's own date.
 */
function pastToday(day: string, today: unknown): string | null {
  const t = typeof today === 'string' && DATE_RE.test(today) && dateNearToday(today) ? today : null;
  return t && DATE_RE.test(day) && day <= t ? t : null;
}

/** The person's seen marks in the round each group is in and the round before: all the rules read. */
async function seenMarks(db: D1Database, uid: string): Promise<GratitudeSeen[]> {
  const r = await db
    .prepare('SELECT prompt, round, seen_at FROM gratitude_seen s WHERE user_id = ?1 AND round >= (SELECT MAX(round) FROM gratitude_seen m WHERE m.user_id = ?1 AND m.grp = s.grp) - 1')
    .bind(uid)
    .all<{ prompt: string; round: number; seen_at: string }>();
  return r.results.map((m) => ({ prompt: m.prompt, round: m.round, at: m.seen_at }));
}

/** The usual three the person pinned, or null. */
async function usualOf(db: D1Database, uid: string): Promise<GratitudeGroup[] | null> {
  const r = await db.prepare('SELECT usual_json FROM gratitude_prefs WHERE user_id = ?').bind(uid).first<{ usual_json: string }>();
  if (!r) return null;
  try {
    const u = parseGratitudeUsual(JSON.parse(r.usual_json));
    return typeof u === 'string' ? null : u;
  } catch {
    return null;
  }
}

/** The prompts kept for the days on either side of `day`, so two open days never show the same one. */
async function nearPrompts(db: D1Database, uid: string, day: string): Promise<string[]> {
  const r = await db.prepare('SELECT prompts_json FROM gratitude_offers WHERE user_id = ? AND day IN (?, ?)').bind(uid, shiftDate(day, -1), shiftDate(day, 1)).all<{ prompts_json: string }>();
  return r.results.flatMap((x) => readPrompts(x.prompts_json) ?? []);
}

/** The day's three prompts for this person and the exact row they were read from (the guard for a change). Made once, then kept. */
async function dayOffer(db: D1Database, uid: string, day: string): Promise<{ prompts: string[]; json: string }> {
  const read = () => db.prepare('SELECT prompts_json FROM gratitude_offers WHERE user_id = ? AND day = ?').bind(uid, day).first<{ prompts_json: string }>();
  const have = await read();
  const kept = have ? readPrompts(have.prompts_json) : null;
  if (have && kept) return { prompts: kept, json: have.prompts_json };
  const [saved, near, usual, marks] = await Promise.all([
    db.prepare('SELECT lines_json FROM gratitude_days WHERE user_id = ? AND day = ?').bind(uid, day).first<{ lines_json: string }>(),
    nearPrompts(db, uid, day),
    usualOf(db, uid),
    seenMarks(db, uid),
  ]);
  const fresh = gratitudeOfferFor({ day, marks, usual, exclude: near });
  // A day written before its prompts were kept keeps the prompts its lines answered.
  const prompts = saved ? gratitudeOfferFrom(readGratitudeLines(saved.lines_json, day), fresh) : fresh;
  const json = JSON.stringify(prompts);
  const now = nowIso();
  await db.batch([
    // Made once: a second tab opening the day at the same moment reads the first one's (or a row that could not be read is mended).
    have
      ? db.prepare('UPDATE gratitude_offers SET prompts_json = ?, updated_at = ? WHERE user_id = ? AND day = ? AND prompts_json = ?').bind(json, now, uid, day, have.prompts_json)
      : db.prepare('INSERT INTO gratitude_offers (user_id, day, prompts_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id, day) DO NOTHING').bind(uid, day, json, now, now),
    // Only the open days need their prompts; older ones go as new ones are made (a written day keeps its own in gratitude_days).
    db.prepare('DELETE FROM gratitude_offers WHERE user_id = ? AND day < ?').bind(uid, shiftDate(day, -3)),
  ]);
  const got = await read();
  const again = got ? readPrompts(got.prompts_json) : null;
  return got && again ? { prompts: again, json: got.prompts_json } : { prompts, json };
}

/** Which of a saved day's lines have words. */
const writtenOf = (row: { lines_json: string; day: string } | null): boolean[] => {
  const lines = row ? readGratitudeLines(row.lines_json, row.day) : [];
  return Array.from({ length: GRATITUDE_LINES }, (_, i) => Boolean(lines[i]?.text.trim()));
};
/** A guard for a change of prompts: none of these lines has words on the server at the moment of the write. */
const emptyGuard = (lines: number[]) =>
  `NOT EXISTS (SELECT 1 FROM gratitude_days WHERE user_id = ? AND day = ? AND (${lines.map(() => "trim(coalesce(json_extract(lines_json, ?), '')) <> ''").join(' OR ')}))`;
const emptyGuardArgs = (uid: string, day: string, lines: number[]) => [uid, day, ...lines.map((i) => `$[${i}].text`)];

// One day (?day=, any day up to today), or a page of days newest first (optionally ?from= and ?to=), for the assistant's journal read.
// With ?today= (the device's day) and a day that is today or yesterday, the answer also carries the day's three prompts for this person
// (`prompts`, made on the first open and kept) and their usual three (`usual`), which the card and the assistant write under.
journal.get('/gratitude', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const day = c.req.query('day');
  if (day !== undefined) {
    if (!pastDay(day)) return c.json({ error: 'pick a day that is not in the future' }, 400);
    const open = openToday(day, c.req.query('today'));
    // AI chat's write_gratitude reads only today or yesterday here, to place new lines. Any other day is a read of the words, so AI chat gets it
    // only as the page of days below gets it: while Gratitude is open to AI chat, on a model that keeps nothing.
    if (!open) {
      const shut = aiTableShut(c, 'gratitude');
      if (shut) return shut;
    }
    const [row, offer, usual] = await Promise.all([
      db.prepare('SELECT day, lines_json, updated_at FROM gratitude_days WHERE user_id = ? AND day = ?').bind(user.id, day).first<GratitudeRow>(),
      open ? dayOffer(db, user.id, day) : null,
      open ? usualOf(db, user.id) : null,
    ]);
    return c.json({ gratitude: row ? toGratitude(row) : null, ...(offer ? { prompts: offer.prompts, usual } : {}) });
  }
  // The page of days is how AI chat reads gratitude (read_journal): only while the person opened the Gratitude table to it, on a model that
  // keeps nothing (2026-11-14, the founder's yes). One day above stays open: write_gratitude reads it to place new lines and tells the model none.
  const shut = aiTableShut(c, 'gratitude');
  if (shut) return shut;
  const from = c.req.query('from');
  const to = c.req.query('to');
  const ask = pageOf(c);
  const rows = await db
    .prepare('SELECT day, lines_json, updated_at FROM gratitude_days WHERE user_id = ? AND day >= ? AND day <= ? ORDER BY day DESC LIMIT ? OFFSET ?')
    .bind(user.id, from && DATE_RE.test(from) ? from : '0000-01-01', to && DATE_RE.test(to) ? to : '9999-12-31', ask.limit, ask.offset)
    .all<GratitudeRow>();
  const pg = paged(rows.results, ask);
  return c.json({ page: pg.page, days: pg.items.map(toGratitude) });
});

// The usual three (migration 0106): three different groups that each new day starts with, or null (or []) to go back to the rotation.
// Owner only; the days already open keep their prompts.
journal.put('/gratitude-settings', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json<{ usual?: unknown }>().catch(() => ({}) as { usual?: unknown });
  if (!('usual' in body)) return c.json({ error: 'send usual: three pillars, or null' }, 400);
  const usual = parseGratitudeUsual(body.usual);
  if (typeof usual === 'string') return c.json({ error: usual }, 400);
  if (usual) {
    await db
      .prepare('INSERT INTO gratitude_prefs (user_id, usual_json, updated_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET usual_json = excluded.usual_json, updated_at = excluded.updated_at')
      .bind(user.id, JSON.stringify(usual), nowIso())
      .run();
  } else await db.prepare('DELETE FROM gratitude_prefs WHERE user_id = ?').bind(user.id).run();
  return c.json({ usual });
});

// "Another prompt" on an empty line of today or yesterday: the prompt there counts as seen and the line takes the next prompt of the
// same group this person has not seen. `prompt` is the one the screen shows; the change is guarded on the exact prompts read and on
// the line having no words, so two taps or two tabs never skip twice. 409 with the day's prompts when the screen was behind.
journal.post('/gratitude/:day/another', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const day = c.req.param('day');
  const body = await c.req.json<{ index?: unknown; prompt?: unknown; today?: unknown }>().catch(() => ({}) as { index?: unknown; prompt?: unknown; today?: unknown });
  if (!openToday(day, body.today)) return c.json({ error: 'Only today or yesterday can be changed.' }, 400);
  const index = typeof body.index === 'number' && Number.isInteger(body.index) && body.index >= 0 && body.index < GRATITUDE_LINES ? body.index : null;
  if (index === null) return c.json({ error: 'say which line' }, 400);
  const [offer, row] = await Promise.all([dayOffer(db, user.id, day), db.prepare('SELECT day, lines_json FROM gratitude_days WHERE user_id = ? AND day = ?').bind(user.id, day).first<{ day: string; lines_json: string }>()]);
  if (writtenOf(row)[index]) return c.json({ error: 'That line is written. Clear it for another prompt.', prompts: offer.prompts }, 409);
  if (offer.prompts[index] !== body.prompt) return c.json({ error: 'changed', prompts: offer.prompts }, 409);
  const [marks, near] = await Promise.all([seenMarks(db, user.id), nearPrompts(db, user.id, day)]);
  const now = nowIso();
  const s = gratitudeSkip(offer.prompts, index, marks, near, now);
  if (!s) return c.json({ error: 'changed', prompts: offer.prompts }, 409);
  const next = JSON.stringify(s.prompts);
  const p = gratitudePromptByKey(offer.prompts[index]!)!;
  const held = 'EXISTS (SELECT 1 FROM gratitude_offers WHERE user_id = ? AND day = ? AND prompts_json = ?)';
  const done = await db.batch([
    // The mark first, written only while the day still holds the prompts this read (in one transaction with the change below).
    ...(s.mark
      ? [
          db
            .prepare(`INSERT OR IGNORE INTO gratitude_seen (user_id, grp, prompt, round, how, day, seen_at) SELECT ?, ?, ?, ?, 'skipped', ?, ? WHERE ${held} AND ${emptyGuard([index])}`)
            .bind(user.id, p.group, s.mark.prompt, s.mark.round, day, now, user.id, day, offer.json, ...emptyGuardArgs(user.id, day, [index])),
        ]
      : []),
    db
      .prepare(`UPDATE gratitude_offers SET prompts_json = ?, updated_at = ? WHERE user_id = ? AND day = ? AND prompts_json = ? AND ${emptyGuard([index])}`)
      .bind(next, now, user.id, day, offer.json, ...emptyGuardArgs(user.id, day, [index])),
  ]);
  if (!done[done.length - 1]!.meta.changes) return c.json({ error: 'changed', prompts: (await dayOffer(db, user.id, day)).prompts }, 409);
  return c.json({ prompts: s.prompts });
});

// The pillar picker on an empty line of today or yesterday: the line takes `group`. Another line with that group swaps prompts with it
// when that line is empty, and is refused when it is written. Picking is not skipping, so nothing is marked seen. Guarded like a skip.
journal.post('/gratitude/:day/pick', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const day = c.req.param('day');
  const body = await c.req.json<{ index?: unknown; group?: unknown; prompt?: unknown; today?: unknown }>().catch(() => ({}) as { index?: unknown; group?: unknown; prompt?: unknown; today?: unknown });
  if (!openToday(day, body.today)) return c.json({ error: 'Only today or yesterday can be changed.' }, 400);
  const index = typeof body.index === 'number' && Number.isInteger(body.index) && body.index >= 0 && body.index < GRATITUDE_LINES ? body.index : null;
  if (index === null) return c.json({ error: 'say which line' }, 400);
  if (!isGratitudeGroup(body.group)) return c.json({ error: 'Pick one of the pillars, or the day.' }, 400);
  const [offer, row] = await Promise.all([dayOffer(db, user.id, day), db.prepare('SELECT day, lines_json FROM gratitude_days WHERE user_id = ? AND day = ?').bind(user.id, day).first<{ day: string; lines_json: string }>()]);
  if (offer.prompts[index] !== body.prompt) return c.json({ error: 'changed', prompts: offer.prompts }, 409);
  const [marks, near] = await Promise.all([seenMarks(db, user.id), nearPrompts(db, user.id, day)]);
  const picked = gratitudePick(offer.prompts, index, body.group, writtenOf(row), marks, near);
  if (typeof picked === 'string') return c.json({ error: picked, prompts: offer.prompts }, 409);
  const moved = picked.flatMap((k, i) => (k !== offer.prompts[i] ? [i] : []));
  if (!moved.length) return c.json({ prompts: offer.prompts });
  const done = await db
    .prepare(`UPDATE gratitude_offers SET prompts_json = ?, updated_at = ? WHERE user_id = ? AND day = ? AND prompts_json = ? AND ${emptyGuard(moved)}`)
    .bind(JSON.stringify(picked), nowIso(), user.id, day, offer.json, ...emptyGuardArgs(user.id, day, moved))
    .run();
  if (!done.meta.changes) return c.json({ error: 'changed', prompts: (await dayOffer(db, user.id, day)).prompts }, 409);
  return c.json({ prompts: picked });
});

// Save a day's three lines as the person goes. Any day up to the device's today can change (2026-11-14, the founder: any past day, never one
// still to come; Journal's card itself opens only today and yesterday, and All tables changes an older one). All three empty removes the day,
// so a day with nothing written never counts. `ifUpdatedAt` is the
// version the screen read: another tab's newer save answers 409 `changed`, and the screen reloads. The lines sit under the day's own
// prompts for this person (see above): an empty line takes its place's prompt, and words under any other prompt answer 409 `changed`
// (another tab moved it). A line that gets words for the first time marks its prompt seen, so it does not come back in that round.
journal.put('/gratitude/:day', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const day = c.req.param('day');
  const body = await c.req.json<{ lines?: unknown; today?: unknown; ifUpdatedAt?: unknown }>().catch(() => ({}) as { lines?: unknown; today?: unknown; ifUpdatedAt?: unknown });
  const t = pastToday(day, body.today);
  if (!t) return c.json({ error: 'A day still to come cannot be written yet.' }, 400);
  // Never a day before the account began (the review of 2026-11-14): it would make an offer and mark prompts seen for a day that never was.
  if (beforeStart(day, startDay(user.created_at, user.timezone), t)) return c.json({ error: BEFORE_JOINED }, 400);
  const sent = parseGratitudeLines(body.lines);
  if (typeof sent === 'string') return c.json({ error: sent }, 400);
  const read = () => db.prepare('SELECT day, lines_json, updated_at FROM gratitude_days WHERE user_id = ? AND day = ?').bind(user.id, day).first<GratitudeRow>();
  const [offer, cur] = await Promise.all([dayOffer(db, user.id, day), read()]);
  const changed = async () => {
    const now = await read();
    return c.json({ error: 'changed', gratitude: now ? toGratitude(now) : null, prompts: (await dayOffer(db, user.id, day)).prompts }, 409);
  };
  // The version the screen read ('' for a day with nothing yet). The write itself is guarded on it, so two saves at once never both pass.
  const expect = typeof body.ifUpdatedAt === 'string' ? body.ifUpdatedAt : null;
  if (expect !== null && expect !== (cur?.updated_at ?? '')) return changed();
  if (sent.some((l, i) => l.text && l.prompt !== offer.prompts[i])) return changed();
  const lines = sent.map((l, i) => ({ prompt: offer.prompts[i]!, text: l.text }));
  const before = writtenOf(cur);
  if (gratitudeWritten(lines) === 0) {
    if (expect === null) await db.prepare('DELETE FROM gratitude_days WHERE user_id = ? AND day = ?').bind(user.id, day).run();
    else if (expect !== '') {
      const gone = await db.prepare('DELETE FROM gratitude_days WHERE user_id = ? AND day = ? AND updated_at = ?').bind(user.id, day, expect).run();
      if (!gone.meta.changes) return changed();
    }
    return c.json({ gratitude: null, prompts: offer.prompts });
  }
  const now = nowIso();
  const json = JSON.stringify(lines);
  // Every write is also guarded on the day's prompts as read, so a skip or a pick in another tab at the same moment answers 409 here.
  const held = 'EXISTS (SELECT 1 FROM gratitude_offers WHERE user_id = ? AND day = ? AND prompts_json = ?)';
  const done =
    expect === null
      ? await db
          .prepare(`INSERT INTO gratitude_days (user_id, day, lines_json, created_at, updated_at) SELECT ?, ?, ?, ?, ? WHERE ${held} ON CONFLICT(user_id, day) DO UPDATE SET lines_json = excluded.lines_json, updated_at = excluded.updated_at`)
          .bind(user.id, day, json, now, now, user.id, day, offer.json)
          .run()
      : expect === ''
        ? await db.prepare(`INSERT INTO gratitude_days (user_id, day, lines_json, created_at, updated_at) SELECT ?, ?, ?, ?, ? WHERE ${held} ON CONFLICT(user_id, day) DO NOTHING`).bind(user.id, day, json, now, now, user.id, day, offer.json).run()
        : await db.prepare(`UPDATE gratitude_days SET lines_json = ?, updated_at = ? WHERE user_id = ? AND day = ? AND updated_at = ? AND ${held}`).bind(json, now, user.id, day, expect, user.id, day, offer.json).run();
  if (!done.meta.changes) return changed();
  // A line written for the first time marks its prompt seen, in that group's round for this person (once: a mark per prompt and round).
  const fresh = lines.flatMap((l, i) => (l.text && !before[i] ? [l.prompt] : []));
  if (fresh.length) {
    const marks = await seenMarks(db, user.id);
    const add = fresh.flatMap((k) => {
      const round = gratitudeMarkRound(k, marks);
      const p = gratitudePromptByKey(k);
      return round === null || !p ? [] : [db.prepare("INSERT OR IGNORE INTO gratitude_seen (user_id, grp, prompt, round, how, day, seen_at) VALUES (?, ?, ?, ?, 'wrote', ?, ?)").bind(user.id, p.group, k, round, day, now)];
    });
    if (add.length) await db.batch(add);
  }
  return c.json({ gratitude: { day, lines, updatedAt: now } satisfies GratitudeDay, prompts: offer.prompts });
});

// Clear a day's gratitude (All tables, 2026-11-14): its three lines go, as emptying all three on Journal does. Any day up to the device's today
// (`?day=`), never one still to come. The seen marks stay, as they always do (a mark is never taken back). Owner only; a second send finds
// nothing and says so.
journal.delete('/gratitude/:day', async (c) => {
  const day = c.req.param('day');
  if (!pastToday(day, c.req.query('day'))) return c.json({ error: 'A day still to come cannot be changed yet.' }, 400);
  const gone = await c.env.DB.prepare('DELETE FROM gratitude_days WHERE user_id = ? AND day = ?').bind(c.get('user').id, day).run();
  if (!(gone.meta.changes ?? 0)) return c.json({ error: 'not found' }, 404);
  return c.json({ ok: true });
});

journal.get('/', async (c) => {
  // AI chat (read_journal) reads the entries only while the person opened the Journal entries table to it, on a model that keeps nothing
  // (2026-11-14, the founder's yes). Nothing is read for a refusal, and the screens send no mark, so they never meet one.
  const shut = aiTableShut(c, 'journal');
  if (shut) return shut;
  const db = c.env.DB;
  const user = c.get('user');
  const ask = pageOf(c);
  // ?date= lists one day's entries, for the calendar.
  const day = c.req.query('date');
  const rows = pastDay(day)
    ? await db.prepare('SELECT * FROM journal_entries WHERE user_id = ? AND created_at >= ? AND created_at < ? ORDER BY created_at DESC LIMIT ? OFFSET ?').bind(user.id, ...dayBounds(day, user.timezone), ask.limit, ask.offset).all<Row>()
    : await db.prepare('SELECT * FROM journal_entries WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?').bind(user.id, ask.limit, ask.offset).all<Row>();
  const pg = paged(rows.results, ask);
  const stats = await db
    .prepare(
      `SELECT COUNT(*) AS total,
        SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) AS this_month,
        SUM(CASE WHEN emotion >= 4 THEN 1 ELSE 0 END) AS positive,
        SUM(CASE WHEN emotion <= 2 THEN 1 ELSE 0 END) AS negative
       FROM journal_entries WHERE user_id = ?`,
    )
    .bind(new Date().toISOString().slice(0, 7) + '-01', user.id)
    .first<{ total: number; this_month: number; positive: number; negative: number }>();
  // Each entry says the day it is filed on (the person's own, in their zone), so nothing reading this has to work it out from the UTC date.
  return c.json({ page: pg.page, entries: pg.items.map((r) => ({ ...toEntry(r), day: dayInZone(user.timezone, new Date(r.created_at)) })), stats: { total: stats?.total ?? 0, thisMonth: stats?.this_month ?? 0, positive: stats?.positive ?? 0, negative: stats?.negative ?? 0 } });
});

journal.post('/', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const p = parse(body);
  if (!p.text && !p.title) return c.json({ error: 'write something first' }, 400);
  const id = newId();
  const now = nowIso();
  // An entry added from a calendar day belongs to that day: noon in the person's own zone.
  if (body.date !== undefined && !pastDay(body.date)) return c.json({ error: 'pick a day that is not in the future' }, 400);
  const at = typeof body.date === 'string' ? zonedToUtc(body.date, 12 * 60, user.timezone || DEFAULT_ZONE).toISOString() : now;
  await db
    .prepare('INSERT INTO journal_entries (id, user_id, title, body, emotion, stress, stressors, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(id, user.id, p.title || 'Untitled', p.text, p.emotion, p.stress, JSON.stringify(p.stressors), at, now)
    .run();
  const row = await db.prepare('SELECT * FROM journal_entries WHERE id = ?').bind(id).first<Row>();
  return c.json({ entry: row ? toEntry(row) : null }, 201);
});

journal.patch('/:id', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const prev = await db.prepare('SELECT * FROM journal_entries WHERE id = ? AND user_id = ?').bind(c.req.param('id'), user.id).first<Row>();
  if (!prev) return c.json({ error: 'not found' }, 404);
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const p = parse(body, prev);
  await db
    .prepare('UPDATE journal_entries SET title = ?, body = ?, emotion = ?, stress = ?, stressors = ?, updated_at = ? WHERE id = ?')
    .bind(p.title || 'Untitled', p.text, p.emotion, p.stress, JSON.stringify(p.stressors), nowIso(), prev.id)
    .run();
  const row = await db.prepare('SELECT * FROM journal_entries WHERE id = ?').bind(prev.id).first<Row>();
  return c.json({ entry: row ? toEntry(row) : null });
});

journal.delete('/:id', async (c) => {
  const gone = await c.env.DB.prepare('DELETE FROM journal_entries WHERE id = ? AND user_id = ?').bind(c.req.param('id'), c.get('user').id).run();
  // Nothing went (another tab, or a second send of the same delete): said, never a quiet yes.
  if (!(gone.meta.changes ?? 0)) return c.json({ error: 'not found' }, 404);
  return c.json({ ok: true });
});
