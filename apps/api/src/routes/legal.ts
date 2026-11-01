// Legal records and the public pages that need the server: what a person accepted and chose, the business details the owner sets,
// copyright notices, and the one-click unsubscribe. The choices are stored per person and changed from Profile; the popup asks once.
import { CONSENT_PURPOSES, CONSENT_VERSION, LEGAL_DOCS, LEGAL_VERSION, NO_CONSENT, parseConsent, type BusinessInfo, type ConsentChoices } from '@kreators/shared';
import { Hono } from 'hono';
import { newId, notify, nowIso, str } from '../db';
import type { AppEnv, Env } from '../env';
import { unsubscribeToken } from '../ops';

export const meLegal = new Hono<AppEnv>();
export const legalPublic = new Hono<{ Bindings: Env }>();

interface ConsentRow { purpose: string; granted: number; banner_version: number }

/** What a person has agreed to and chosen. `decided` is false until they answer the popup at the current wording. */
export async function legalStateFor(db: D1Database, userId: string) {
  const acc = await db.prepare('SELECT doc, version, MAX(accepted_at) AS at FROM terms_acceptances WHERE user_id = ? GROUP BY doc, version').bind(userId).all<{ doc: string; version: string; at: string }>();
  const accepted = Object.fromEntries(LEGAL_DOCS.map((d) => [d.key, acc.results.find((a) => a.doc === d.key && a.version === LEGAL_VERSION)?.at ?? null]));
  const rows = await db.prepare('SELECT purpose, granted, banner_version FROM user_consents WHERE user_id = ?').bind(userId).all<ConsentRow>();
  const consent: ConsentChoices = { ...NO_CONSENT };
  for (const r of rows.results) if (r.purpose in consent) consent[r.purpose as keyof ConsentChoices] = r.granted === 1;
  const decided = CONSENT_PURPOSES.every((p) => rows.results.some((r) => r.purpose === p.key && r.banner_version >= CONSENT_VERSION));
  return { legalVersion: LEGAL_VERSION, acceptedAt: accepted, needsAcceptance: LEGAL_DOCS.some((d) => !accepted[d.key]), consent, decided, bannerVersion: CONSENT_VERSION };
}

/** Record acceptance of the current terms and privacy policy. Append-only: a repeat for the same version adds nothing. */
export async function recordAcceptance(db: D1Database, userId: string, how: 'signup' | 'notice'): Promise<void> {
  const now = nowIso();
  await db.batch(
    LEGAL_DOCS.map((d) =>
      db
        .prepare('INSERT INTO terms_acceptances (id, user_id, doc, version, how, accepted_at) SELECT ?, ?, ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM terms_acceptances WHERE user_id = ? AND doc = ? AND version = ?)')
        .bind(newId(), userId, d.key, LEGAL_VERSION, how, now, userId, d.key, LEGAL_VERSION),
    ),
  );
}

/** Save the choices: each purpose is one row, and every change is also written to the log with where it was made. */
export async function saveConsent(db: D1Database, userId: string, choices: ConsentChoices, source: 'popup' | 'profile' | 'unsubscribe'): Promise<void> {
  const before = await db.prepare('SELECT purpose, granted, banner_version FROM user_consents WHERE user_id = ?').bind(userId).all<ConsentRow>();
  const now = nowIso();
  const stmts: D1PreparedStatement[] = [];
  for (const p of CONSENT_PURPOSES) {
    const was = before.results.find((r) => r.purpose === p.key);
    const granted = choices[p.key] ? 1 : 0;
    // A first answer, a changed answer, or an answer at a newer wording is a new line in the log.
    if (!was || was.granted !== granted || was.banner_version < CONSENT_VERSION) {
      stmts.push(db.prepare('INSERT INTO consent_records (id, user_id, purpose, granted, source, banner_version, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(newId(), userId, p.key, granted, source, CONSENT_VERSION, now));
    }
    stmts.push(
      db
        .prepare('INSERT INTO user_consents (user_id, purpose, granted, banner_version, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id, purpose) DO UPDATE SET granted = excluded.granted, banner_version = excluded.banner_version, updated_at = excluded.updated_at')
        .bind(userId, p.key, granted, CONSENT_VERSION, now),
    );
  }
  await db.batch(stmts);
}

meLegal.get('/', async (c) => c.json(await legalStateFor(c.env.DB, c.get('user').id)));
meLegal.put('/consent', async (c) => {
  const body = await c.req.json<{ choices?: unknown; source?: unknown }>().catch(() => ({}) as { choices?: unknown; source?: unknown });
  await saveConsent(c.env.DB, c.get('user').id, parseConsent(body.choices), body.source === 'profile' ? 'profile' : 'popup');
  return c.json(await legalStateFor(c.env.DB, c.get('user').id));
});
meLegal.post('/accept', async (c) => {
  await recordAcceptance(c.env.DB, c.get('user').id, 'notice');
  return c.json(await legalStateFor(c.env.DB, c.get('user').id));
});

// ---- the business behind kreators.app: set by the owner as Worker variables, never written in code ----
export function businessFrom(env: Env): BusinessInfo {
  const v = (x: string | undefined) => (x ?? '').trim();
  const agent = v(env.DMCA_AGENT) || v(env.BUSINESS_NAME);
  return {
    name: v(env.BUSINESS_NAME),
    address: v(env.BUSINESS_ADDRESS),
    email: v(env.BUSINESS_EMAIL),
    registration: v(env.BUSINESS_REG),
    vat: v(env.BUSINESS_VAT),
    dmcaAgent: agent,
    dmcaAddress: v(env.DMCA_ADDRESS) || v(env.BUSINESS_ADDRESS),
    dmcaEmail: v(env.DMCA_EMAIL) || v(env.BUSINESS_EMAIL),
    dmcaRegistered: v(env.DMCA_REGISTERED) === 'yes',
  };
}
legalPublic.get('/business', (c) => c.json({ business: businessFrom(c.env) }));

// ---- copyright notices: anyone can send one; the team is told at once ----
legalPublic.post('/copyright-notice', async (c) => {
  const db = c.env.DB;
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const kind = body.kind === 'counter' ? 'counter' : 'notice';
  const name = str(body.name, 120);
  const email = str(body.email, 200).toLowerCase();
  const work = str(body.work, 1000);
  const urls = str(body.urls, 2000);
  const statement = str(body.statement, 1000);
  const signature = str(body.signature, 120);
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return c.json({ error: 'a name and a working email, so we can answer you' }, 400);
  if (!work || !urls) return c.json({ error: 'say which work was copied and where it is shown' }, 400);
  if (!signature) return c.json({ error: 'type your full name as your signature' }, 400);
  const id = newId();
  await db.prepare('INSERT INTO copyright_notices (id, kind, name, email, work, urls, statement, signature, status, note, created_at, resolved_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)').bind(id, kind, name, email, work, urls, statement, signature, 'new', '', nowIso()).run();
  const admins = await db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 20").all<{ id: string }>();
  for (const a of admins.results) await notify(db, a.id, 'team', kind === 'counter' ? 'Copyright counter-notice' : 'Copyright notice', `${name} sent one about ${urls.slice(0, 160)}`, '/admin');
  return c.json({ ok: true, reference: id.slice(0, 8) }, 201);
});

// ---- one-click unsubscribe from marketing email: the link carries a token that only we can make ----
async function userForToken(env: Env, token: string): Promise<string | null> {
  const [id] = token.split('.');
  if (!id || (await unsubscribeToken(env, id)) !== token) return null;
  return id;
}
legalPublic.get('/unsubscribe/:token', async (c) => {
  const id = await userForToken(c.env, c.req.param('token'));
  if (!id) return c.json({ error: 'that link is not valid' }, 404);
  return c.json({ ok: true });
});
legalPublic.post('/unsubscribe/:token', async (c) => {
  const id = await userForToken(c.env, c.req.param('token'));
  if (!id) return c.json({ error: 'that link is not valid' }, 404);
  const state = await legalStateFor(c.env.DB, id);
  await saveConsent(c.env.DB, id, { ...state.consent, marketing: false }, 'unsubscribe');
  return c.json({ ok: true });
});
