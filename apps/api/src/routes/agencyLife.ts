import { Hono, type Context } from 'hono';
import {
  AGENCY_STAGE_BY_KEY,
  AGENCY_TITLE_MAX,
  RETAINER_DEFAULT_OPTIONS,
  RETAINER_PIECES_MAX,
  REVISIONS_MAX,
  emptyLifecycleDates,
  lifecycleDatesProblem,
  moveProblem,
  parseLifecycleDates,
  parseRetainerOptions,
  parseStage,
  portalPasswordProblem,
  previousStage,
  stageIndex,
  CONTRACT_TEMPLATE_BY_KEY,
  PASSWORD_REQUEST_REASON_MAX,
  contractGaps,
  contractVarsFor,
  onboardingProblem,
  onboardingToBilling,
  parseContractDoc,
  parseDocStyle,
  parseOnboarding,
  withProfilePackages,
  type ClientOnboarding,
  type ContractAnswer,
  type ContractDoc,
  type ContractQuestion,
} from '@kreators/shared';
import { fillEmail, emptyEmailVars } from '@kreators/shared/agencyEmail';
import type { AppEnv } from '../env';
import { dayFromDevice, nameOf, newId, notify, nowIso, num, randomCode, shiftDate, str } from '../db';
import { sendEmail } from '../ops';
import { ownLogo, publicUrl } from '../agencyPaper';
import { dateOrNull, moneyIn } from '../agencyUtil';
import { clientRow, settingsFor } from './agency';
import { runAgencyCycles } from '../agencyCycles';
import { applyStageEvent, closePasswordRequest, logStmt, moveStage, syncStageFromAgreements, type RetainerRow } from '../lifecycle';
import { actorOf } from '../agencyTeamAccess';
import { teamLockRowForToken } from '../teamLinkAccess';
import { agencyFace, clearPortalSessions, clientOfDocument, closedLinkAnswer, lockRowForToken, newPortalPassword, passwordColumns, requirePortalAccess, unlockPortal, type LockRow } from '../portalAccess';

/**
 * Agency lifecycle, the owner's side: move a client along, set the days and tick the checklist, put a password on the client's link, add
 * the trial video, offer a retainer and confirm the length the client chose. Owner only: every query filters by the session user.
 * The client's side (unlock the link, choose a length) is `agencyLifePublic`, mounted at /public/agency.
 */
export const agencyLife = new Hono<AppEnv>();
export const agencyLifePublic = new Hono<AppEnv>();

const bodyOf = (c: { req: { json: <T>() => Promise<T> } }) => c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);

/** Whether an offer is open or a retainer runs, for the stage move rules. */
async function stageFacts(db: D1Database, userId: string, clientId: string): Promise<{ offerOpen: boolean; retainerActive: boolean }> {
  const rows = await db.prepare("SELECT status FROM agency_retainers WHERE client_id = ? AND user_id = ? AND status IN ('offered', 'chosen', 'active')").bind(clientId, userId).all<{ status: string }>();
  return { offerOpen: rows.results.some((r) => r.status === 'offered' || r.status === 'chosen'), retainerActive: rows.results.some((r) => r.status === 'active') };
}

// ---- the stage

// One step forward at a time, or one back to undo a slip. Guarded: it moves only if the client is still in the stage the owner saw.
agencyLife.post('/clients/:id/stage', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const row = await clientRow(db, user.id, c.req.param('id'));
  if (!row) return c.json({ error: 'not found' }, 404);
  const body = await bodyOf(c);
  const from = parseStage(row.stage);
  const to = typeof body.to === 'string' ? parseStage(body.to) : null;
  if (!to || to !== body.to) return c.json({ error: 'pick a stage' }, 400);
  if (body.undo === true) {
    if (to !== previousStage(from)) return c.json({ error: 'You can only step back one stage.' }, 400);
  } else {
    const problem = moveProblem(from, to, await stageFacts(db, user.id, row.id));
    if (problem) return c.json({ error: problem }, 400);
  }
  const text = body.undo === true ? `Stepped back to ${AGENCY_STAGE_BY_KEY[to].name}.` : `Moved to ${AGENCY_STAGE_BY_KEY[to].name}.`;
  if (!(await moveStage(db, user.id, row.id, from, to, actorOf(c), text))) return c.json({ error: 'They moved while you looked. Reload and try again.' }, 409);
  return c.json({ stage: to });
});

// The days, and the changes included in each piece.
agencyLife.put('/clients/:id/lifecycle', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const row = await clientRow(db, user.id, c.req.param('id'));
  if (!row) return c.json({ error: 'not found' }, 404);
  const body = await bodyOf(c);
  const prev = parseLifecycleDates(row.lifecycle_json);
  const next = parseLifecycleDates({ ...prev, ...Object.fromEntries(Object.entries(body).filter(([k]) => k in emptyLifecycleDates())) });
  // A day that was sent but is not a real day is refused, not quietly dropped.
  for (const k of ['strategyDay', 'trialDue', 'pilotStart', 'pilotEnd'] as const) {
    if (k in body && body[k] !== null && body[k] !== '' && !dateOrNull(body[k])) return c.json({ error: 'that is not a real day' }, 400);
  }
  if ('strategyLink' in body && body.strategyLink && !next.strategyLink) return c.json({ error: 'the call link must start with https' }, 400);
  const problem = lifecycleDatesProblem(next);
  if (problem) return c.json({ error: problem }, 400);
  const revisions = 'revisionsPerPiece' in body ? (num(body.revisionsPerPiece, row.revisions_per_piece, 0, REVISIONS_MAX) ?? row.revisions_per_piece) : row.revisions_per_piece;
  await db.prepare('UPDATE agency_clients SET lifecycle_json = ?, revisions_per_piece = ?, updated_at = ? WHERE id = ? AND user_id = ?').bind(JSON.stringify(next), revisions, nowIso(), row.id, user.id).run();
  return c.json({ dates: next, revisionsPerPiece: revisions });
});

// A tick on the stage's checklist. The keys are the checklist's own, so nothing else is stored.
agencyLife.post('/clients/:id/checklist', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const row = await clientRow(db, user.id, c.req.param('id'));
  if (!row) return c.json({ error: 'not found' }, 404);
  const body = await bodyOf(c);
  const key = typeof body.key === 'string' ? body.key : '';
  const [stage, step] = key.split(':');
  const known = AGENCY_STAGE_BY_KEY[parseStage(stage)];
  if (!stage || parseStage(stage) !== stage || !known.steps.some((s) => s.key === step)) return c.json({ error: 'not a step' }, 400);
  let ticks: Record<string, boolean> = {};
  try {
    ticks = JSON.parse(row.ticks_json || '{}') as Record<string, boolean>;
  } catch {
    ticks = {};
  }
  if (body.done === true) ticks[key] = true;
  else delete ticks[key];
  await db.prepare('UPDATE agency_clients SET ticks_json = ?, updated_at = ? WHERE id = ? AND user_id = ?').bind(JSON.stringify(ticks), nowIso(), row.id, user.id).run();
  return c.json({ ticks });
});

// ---- the password on the client's link

// Set one, generate one (returned once), or clear it. Every open session of the client ends. The log says what happened, never the word.
agencyLife.put('/clients/:id/password', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const row = await clientRow(db, user.id, c.req.param('id'));
  if (!row) return c.json({ error: 'not found' }, 404);
  const body = await bodyOf(c);
  const now = nowIso();
  if (body.clear === true) {
    await db.batch([
      db.prepare('UPDATE agency_clients SET portal_pass_hash = NULL, portal_pass_salt = NULL, portal_pass_set_at = NULL, updated_at = ? WHERE id = ? AND user_id = ?').bind(now, row.id, user.id),
      clearPortalSessions(db, row.id),
      closePasswordRequest(db, user.id, row.id),
      logStmt(db, user.id, row.id, 'me', 'password', 'The password on the client link was removed.'),
    ]);
    return c.json({ set: false });
  }
  const generated = body.generate === true;
  const password = generated ? newPortalPassword(row.name) : typeof body.password === 'string' ? body.password : '';
  const problem = portalPasswordProblem(password, row.name);
  if (problem) return c.json({ error: problem }, 400);
  const col = await passwordColumns(password);
  await db.batch([
    db.prepare('UPDATE agency_clients SET portal_pass_hash = ?, portal_pass_salt = ?, portal_pass_set_at = ?, updated_at = ? WHERE id = ? AND user_id = ?').bind(col.hash, col.salt, now, now, row.id, user.id),
    clearPortalSessions(db, row.id),
    // A new password answers the client's ask for one, in the same batch.
    closePasswordRequest(db, user.id, row.id),
    logStmt(db, user.id, row.id, 'me', 'password', `A password was ${row.portal_pass_hash ? 'changed' : 'set'} for the client link.`),
  ]);
  return c.json(generated ? { set: true, password } : { set: true });
});

// The owner dismisses the client's ask for a new password without changing it (they talked, and it was not shared after all).
agencyLife.post('/clients/:id/password-request/close', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const row = await clientRow(db, user.id, c.req.param('id'));
  if (!row) return c.json({ error: 'not found' }, 404);
  const [res] = await db.batch([closePasswordRequest(db, user.id, row.id), logStmt(db, user.id, row.id, 'me', 'password', 'The ask for a new password was dismissed.')]);
  return c.json({ ok: true, closed: (res?.meta.changes ?? 0) > 0 });
});

// ---- the trial video

// Adds the trial video to the pipeline, once, due on the trial's day. It goes through the pipeline and the client's review like any piece.
agencyLife.post('/clients/:id/trial-video', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const row = await clientRow(db, user.id, c.req.param('id'));
  if (!row) return c.json({ error: 'not found' }, 404);
  const have = await db.prepare('SELECT id FROM agency_items WHERE client_id = ? AND user_id = ? AND trial = 1').bind(row.id, user.id).first<{ id: string }>();
  if (have) return c.json({ id: have.id }, 200);
  const due = parseLifecycleDates(row.lifecycle_json).trialDue;
  const id = newId();
  const now = nowIso();
  await db.batch([
    db.prepare("INSERT INTO agency_items (id, user_id, client_id, title, kind, platform, stage, due_date, trial, created_at, updated_at) VALUES (?, ?, ?, ?, 'video', '', 'idea', ?, 1, ?, ?)").bind(id, user.id, row.id, 'Trial video'.slice(0, AGENCY_TITLE_MAX), due, now, now),
    logStmt(db, user.id, row.id, actorOf(c), 'trial', 'The trial video was added to the pipeline.'),
  ]);
  return c.json({ id }, 201);
});

// ---- changes on a piece

// The owner adds changes to one piece (or takes some away, down to what is already spent). Written into the thread so the client's page and the log agree.
agencyLife.post('/items/:id/changes', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const item = await db
    .prepare('SELECT i.id, i.client_id, i.revisions, COALESCE(i.revisions_allowed, c.revisions_per_piece) AS allowed FROM agency_items i JOIN agency_clients c ON c.id = i.client_id WHERE i.id = ? AND i.user_id = ?')
    .bind(c.req.param('id'), user.id)
    .first<{ id: string; client_id: string; revisions: number; allowed: number }>();
  if (!item) return c.json({ error: 'not found' }, 404);
  const body = await bodyOf(c);
  const add = Math.round(Number(body.add));
  if (!Number.isInteger(add) || add === 0 || Math.abs(add) > 5) return c.json({ error: 'add or take away up to five' }, 400);
  const to = Math.min(REVISIONS_MAX, Math.max(item.revisions, item.allowed + add));
  const res = await db.prepare('UPDATE agency_items SET revisions_allowed = ?, updated_at = ? WHERE id = ? AND user_id = ? AND COALESCE(revisions_allowed, ?) = ?').bind(to, nowIso(), item.id, user.id, item.allowed, item.allowed).run();
  if (!res.meta.changes) return c.json({ error: 'it changed while you looked; try again' }, 409);
  await db.batch([
    db.prepare("INSERT INTO agency_notes (id, user_id, item_id, author, kind, shared, body, created_at) VALUES (?, ?, ?, 'me', 'note', 1, ?, ?)").bind(newId(), user.id, item.id, `Changes included: ${item.allowed} became ${to}.`, nowIso()),
  ]);
  return c.json({ allowed: to });
});

// ---- the retainer

interface OwnedRetainer extends RetainerRow { client_name: string; client_stage: string }
async function ownedRetainer(db: D1Database, userId: string, id: string): Promise<OwnedRetainer | null> {
  return db.prepare('SELECT r.*, c.name AS client_name, c.stage AS client_stage FROM agency_retainers r JOIN agency_clients c ON c.id = r.client_id WHERE r.id = ? AND r.user_id = ?').bind(id, userId).first<OwnedRetainer>();
}

// Offer a retainer: some lengths, each with an optional discount. The month's fee, the pieces and the changes come from the client unless typed here.
agencyLife.post('/clients/:id/retainer', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const row = await clientRow(db, user.id, c.req.param('id'));
  if (!row) return c.json({ error: 'not found' }, 404);
  const from = parseStage(row.stage);
  if (stageIndex(from) < stageIndex('pilot')) return c.json({ error: 'Move the client to the pilot month first. A retainer comes after it.' }, 400);
  const body = await bodyOf(c);
  const fee = 'feeCents' in body ? moneyIn(body.feeCents) : row.retainer_cents;
  if (fee <= 0) return c.json({ error: 'Set the monthly retainer on the client first.' }, 400);
  const pieces = 'piecesPerMonth' in body ? (num(body.piecesPerMonth, 0, 0, RETAINER_PIECES_MAX) ?? 0) : Math.min(row.pieces_per_month, RETAINER_PIECES_MAX);
  const revisions = 'revisionsPerPiece' in body ? (num(body.revisionsPerPiece, row.revisions_per_piece, 0, REVISIONS_MAX) ?? row.revisions_per_piece) : row.revisions_per_piece;
  const options = 'options' in body ? parseRetainerOptions(body.options) : [...RETAINER_DEFAULT_OPTIONS];
  if (options.length === 0) return c.json({ error: 'Offer at least one length, from 1 to 24 months.' }, 400);
  const open = await db.prepare("SELECT id, status FROM agency_retainers WHERE client_id = ? AND user_id = ? AND status IN ('offered', 'chosen', 'active')").bind(row.id, user.id).all<{ id: string; status: string }>();
  if (open.results.some((r) => r.status === 'active')) return c.json({ error: 'A retainer is running. Offer the renewal once it ends.' }, 400);
  if (open.results.some((r) => r.status === 'chosen')) return c.json({ error: 'The client chose a length. Confirm it, or withdraw it first.' }, 400);
  const now = nowIso();
  const id = newId();
  await db.batch([
    // A new offer replaces one nobody has answered.
    db.prepare("UPDATE agency_retainers SET status = 'withdrawn', updated_at = ? WHERE client_id = ? AND user_id = ? AND status = 'offered'").bind(now, row.id, user.id),
    db
      .prepare("INSERT INTO agency_retainers (id, user_id, client_id, status, options_json, fee_cents, pieces_per_month, revisions_per_piece, auto_send, created_at, updated_at) VALUES (?, ?, ?, 'offered', ?, ?, ?, ?, ?, ?, ?)")
      .bind(id, user.id, row.id, JSON.stringify(options), fee, pieces, revisions, body.autoSend === false ? 0 : 1, now, now),
    logStmt(db, user.id, row.id, actorOf(c), 'retainer', `A retainer offer was sent: ${options.map((o) => `${o.months} months`).join(', ')}.`),
  ]);
  await applyStageEvent(db, user.id, row.id, 'offer_sent', 'The retainer offer was sent.');
  return c.json({ id }, 201);
});

// Confirm the length the client chose and start the retainer. status 'chosen' -> 'active' in one guarded statement.
agencyLife.post('/retainers/:id/confirm', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const r = await ownedRetainer(db, user.id, c.req.param('id'));
  if (!r) return c.json({ error: 'not found' }, 404);
  if (r.status !== 'chosen' || !r.months) return c.json({ error: 'The client has not chosen a length yet.' }, 409);
  const other = await db.prepare("SELECT 1 AS x FROM agency_retainers WHERE client_id = ? AND user_id = ? AND status = 'active' AND id != ?").bind(r.client_id, user.id, r.id).first();
  if (other) return c.json({ error: 'A retainer is already running for this client.' }, 400);
  const body = await bodyOf(c);
  const today = dayFromDevice(c.req.query('day'));
  const startDay = dateOrNull(body.startDay) ?? today;
  if (startDay < shiftDate(today, -31) || startDay > shiftDate(today, 366)) return c.json({ error: 'Pick a start day within a year.' }, 400);
  const now = nowIso();
  const res = await db
    .prepare("UPDATE agency_retainers SET status = 'active', start_day = ?, auto_send = ?, confirmed_at = ?, updated_at = ? WHERE id = ? AND user_id = ? AND status = 'chosen'")
    .bind(startDay, body.autoSend === false ? 0 : r.auto_send, now, now, r.id, user.id)
    .run();
  if (!res.meta.changes) return c.json({ error: 'Someone already confirmed it.' }, 409);
  await logStmt(db, user.id, r.client_id, actorOf(c), 'retainer', `The retainer started on ${startDay} for ${r.months} months.`).run();
  await applyStageEvent(db, user.id, r.client_id, 'retainer_active', 'The retainer started.');
  // The first month now, if its day has come in the owner's zone; the cron makes the rest.
  const made = await runAgencyCycles(db, { retainerId: r.id });
  return c.json({ ok: true, made });
});

// End a running retainer early: the months not yet made are not made.
agencyLife.post('/retainers/:id/end', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const r = await ownedRetainer(db, user.id, c.req.param('id'));
  if (!r) return c.json({ error: 'not found' }, 404);
  const now = nowIso();
  const res = await db.prepare("UPDATE agency_retainers SET status = 'ended', ended_at = ?, updated_at = ? WHERE id = ? AND user_id = ? AND status = 'active'").bind(now, now, r.id, user.id).run();
  if (!res.meta.changes) return c.json({ error: 'That retainer is not running.' }, 409);
  await logStmt(db, user.id, r.client_id, actorOf(c), 'retainer', 'The retainer was ended.').run();
  return c.json({ ok: true });
});

// Auto-send on or off for a retainer that is offered, chosen or running: when off, each month's invoice stays a draft for the owner to send.
agencyLife.post('/retainers/:id/auto-send', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await bodyOf(c);
  const res = await db.prepare("UPDATE agency_retainers SET auto_send = ?, updated_at = ? WHERE id = ? AND user_id = ? AND status IN ('offered', 'chosen', 'active')").bind(body.on === false ? 0 : 1, nowIso(), c.req.param('id'), user.id).run();
  if (!res.meta.changes) return c.json({ error: 'not found' }, 404);
  return c.json({ ok: true, on: body.on !== false });
});

// Take back an offer, or a length the client chose that the owner does not accept.
agencyLife.post('/retainers/:id/withdraw', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const r = await ownedRetainer(db, user.id, c.req.param('id'));
  if (!r) return c.json({ error: 'not found' }, 404);
  const now = nowIso();
  const res = await db.prepare("UPDATE agency_retainers SET status = 'withdrawn', updated_at = ? WHERE id = ? AND user_id = ? AND status IN ('offered', 'chosen')").bind(now, r.id, user.id).run();
  if (!res.meta.changes) return c.json({ error: 'There is nothing to take back.' }, 409);
  await logStmt(db, user.id, r.client_id, actorOf(c), 'retainer', 'The retainer offer was withdrawn.').run();
  return c.json({ ok: true });
});

// ---- the client's side: unlock the link, choose a length

agencyLifePublic.post('/:token/unlock', async (c) => {
  const token = c.req.param('token');
  const client = await lockRowForToken(c.env.DB, token);
  if (!client) {
    const closed = await closedLinkAnswer(c, token);
    if (closed) return closed;
  }
  return unlockPortal(c, client, client?.id ?? token);
});

// The client picks a length from the open offer. offered -> chosen (or chosen again, before the owner confirms), only an offered length.
agencyLifePublic.post('/:token/retainer', async (c) => {
  const db = c.env.DB;
  const lock = await lockRowForToken(db, c.req.param('token'));
  if (!lock) return (await closedLinkAnswer(c, c.req.param('token'))) ?? c.json({ error: 'no page at this link' }, 404);
  const denied = await requirePortalAccess(c, lock.id);
  if (denied) return denied;
  const client = await db.prepare('SELECT user_id, name FROM agency_clients WHERE id = ?').bind(lock.id).first<{ user_id: string; name: string }>();
  if (!client) return c.json({ error: 'no page at this link' }, 404);
  const r = await db.prepare("SELECT * FROM agency_retainers WHERE client_id = ? AND status IN ('offered', 'chosen') ORDER BY created_at DESC LIMIT 1").bind(lock.id).first<RetainerRow>();
  if (!r) return c.json({ error: 'There is no offer to answer.' }, 409);
  const body = await bodyOf(c);
  const months = Math.round(Number(body.months));
  const option = parseRetainerOptions(r.options_json).find((o) => o.months === months);
  if (!option) return c.json({ error: 'Pick one of the lengths offered.' }, 400);
  const now = nowIso();
  const res = await db
    .prepare("UPDATE agency_retainers SET status = 'chosen', months = ?, discount_bps = ?, chosen_at = ?, updated_at = ? WHERE id = ? AND status IN ('offered', 'chosen')")
    .bind(option.months, option.discountBps, now, now, r.id)
    .run();
  if (!res.meta.changes) return c.json({ error: 'The offer changed. Reload the page.' }, 409);
  await logStmt(db, client.user_id, lock.id, 'client', 'retainer', `The client chose ${option.months} months.`).run();
  await notify(db, client.user_id, 'agency', `${client.name} chose ${option.months} months`, 'Confirm it to start the retainer.', `/agency/${lock.id}`);
  return c.json({ ok: true });
});

// ---- onboarding: the client fills in their details and the trial brief once, at their link

interface OnboardingClient {
  id: string; user_id: string; name: string; contact_name: string; contact_email: string; billing_json: string; channels_json: string; pieces_per_month: number; hours_per_month: number;
  revisions_per_piece: number; retainer_cents: number; onboarding_json: string; onboarded_at: string | null; onboarding_needed: number;
}
const ONBOARDING_SELECT = 'SELECT id, user_id, name, contact_name, contact_email, billing_json, channels_json, pieces_per_month, hours_per_month, revisions_per_piece, retainer_cents, onboarding_json, onboarded_at, onboarding_needed FROM agency_clients WHERE id = ?';

/**
 * The agreement the form's brief comes from: the owner's newest own template made from the Trial and pilot one, else the built-in one.
 * Its brief section's questions are the questions the client answers, so the ids and words are the agreement's own.
 */
async function trialTemplate(db: D1Database, userId: string): Promise<ContractDoc> {
  const rows = await db.prepare("SELECT doc_json FROM agency_templates WHERE user_id = ? AND kind = 'contract' ORDER BY updated_at DESC LIMIT 20").bind(userId).all<{ doc_json: string }>();
  for (const r of rows.results) {
    let doc: ContractDoc | null = null;
    try {
      doc = parseContractDoc(JSON.parse(r.doc_json || 'null'));
    } catch {
      doc = null;
    }
    if (doc && doc.templateKey === 'trial' && doc.sections.some((x) => x.kind === 'brief')) return doc;
  }
  return structuredClone(CONTRACT_TEMPLATE_BY_KEY.trial!.doc);
}
/** The saved draft as JSON, or nothing when it cannot be read. */
const savedDraft = (raw: string): unknown => {
  try {
    return JSON.parse(raw || '{}');
  } catch {
    return {};
  }
};
const briefOf = (doc: ContractDoc): ContractQuestion[] => doc.sections.filter((x) => x.kind === 'brief').flatMap((x) => x.questions ?? []);

/** The client behind a link, once it is unlocked: the lock row and the onboarding columns, or the answer to send instead. */
async function onboardingDoor(c: Context<AppEnv>): Promise<{ client: OnboardingClient } | { res: Response }> {
  const db = c.env.DB;
  const lock = await lockRowForToken(db, c.req.param('token') ?? '');
  if (!lock) return { res: (await closedLinkAnswer(c, c.req.param('token') ?? '')) ?? c.json({ error: 'no page at this link' }, 404) };
  const denied = await requirePortalAccess(c, lock.id);
  if (denied) return { res: denied };
  const client = await db.prepare(ONBOARDING_SELECT).bind(lock.id).first<OnboardingClient>();
  if (!client) return { res: c.json({ error: 'no page at this link' }, 404) };
  c.header('Cache-Control', 'no-store');
  return { client };
}

/** The brief's answers as the agreement keeps them, with the reference links written into the question that asks for them. */
function answersFrom(o: ClientOnboarding, questions: readonly ContractQuestion[]): Record<string, ContractAnswer> {
  const out: Record<string, ContractAnswer> = {};
  for (const q of questions) {
    const a = o.brief[q.id];
    if (a) out[q.id] = { picked: [...a.picked], other: a.other, text: a.text, ...(a.fields ? { fields: { ...a.fields } } : {}), ...(a.links ? { links: [...a.links] } : {}) };
  }
  // The agreement asks for the links in a question of its own when it has one; otherwise they go into its last question for words.
  if (o.references.length > 0 && !questions.some((q) => q.links)) {
    const texts = questions.filter((q) => q.text);
    const target = texts.find((q) => /reference|example|videos? that show/i.test(q.label)) ?? texts[texts.length - 1];
    if (target) {
      const prev = out[target.id] ?? { picked: [], other: '', text: '' };
      const links = `References:\n${o.references.join('\n')}`;
      out[target.id] = { ...prev, text: (prev.text.trim() ? `${prev.text.trim()}\n\n${links}` : links).slice(0, 1500) };
    }
  }
  return out;
}

// What the form needs: the draft so far, the brief's questions from the agreement, and the two things the owner already typed.
agencyLifePublic.get('/:token/onboarding', async (c) => {
  const door = await onboardingDoor(c);
  if ('res' in door) return door.res;
  const { client } = door;
  const questions = briefOf(await trialTemplate(c.env.DB, client.user_id));
  return c.json({
    draft: parseOnboarding(savedDraft(client.onboarding_json), questions),
    questions,
    prefill: { brand: client.name, email: client.contact_email },
    done: Boolean(client.onboarded_at),
  });
});

// Saved as the client goes, on Next and when they leave a field. Only the form's own fields and the agreement's own questions are kept.
agencyLifePublic.put('/:token/onboarding', async (c) => {
  const door = await onboardingDoor(c);
  if ('res' in door) return door.res;
  const { client } = door;
  if (client.onboarded_at) return c.json({ error: 'This form was already sent.' }, 409);
  const body = await bodyOf(c);
  const questions = briefOf(await trialTemplate(c.env.DB, client.user_id));
  const draft = parseOnboarding(body.draft, questions);
  await c.env.DB.prepare('UPDATE agency_clients SET onboarding_json = ?, updated_at = ? WHERE id = ? AND onboarded_at IS NULL').bind(JSON.stringify(draft), nowIso(), client.id).run();
  return c.json({ ok: true });
});

// Sent once: the details land on the client record (billing, contact), the agreement is made from the trial template and filled in,
// and the owner is told in the inbox and by one email. Guarded on onboarded_at, so two taps send it once.
agencyLifePublic.post('/:token/onboarding/submit', async (c) => {
  const db = c.env.DB;
  const door = await onboardingDoor(c);
  if ('res' in door) return door.res;
  const { client } = door;
  if (client.onboarded_at) return c.json({ error: 'This form was already sent.' }, 409);
  const body = await bodyOf(c);
  const template = await trialTemplate(db, client.user_id);
  const questions = briefOf(template);
  const o = parseOnboarding('draft' in body ? body.draft : savedDraft(client.onboarding_json), questions);
  const problem = onboardingProblem(o, questions);
  if (problem) return c.json({ error: problem.message, step: problem.step, field: problem.field }, 400);
  const now = nowIso();
  const billing = onboardingToBilling(o, client.name);
  const claimed = await db
    .prepare('UPDATE agency_clients SET billing_json = ?, contact_name = ?, contact_email = ?, onboarding_json = ?, onboarded_at = ?, updated_at = ? WHERE id = ? AND onboarded_at IS NULL')
    .bind(JSON.stringify(billing), o.pocName.slice(0, 80), o.email.slice(0, 120), JSON.stringify(o), now, now, client.id)
    .run();
  if (!claimed.meta.changes) return c.json({ error: 'This form was already sent.' }, 409);

  // The agreement, once: filled from the business profile and what the client just said, the brief answered from the form.
  const settings = await settingsFor(db, client.user_id);
  const have = await db.prepare("SELECT id, status, token FROM agency_contracts WHERE client_id = ? AND user_id = ? AND (template_key = 'trial' OR doc_json LIKE '%\"templateKey\":\"trial\"%') AND status != 'void' LIMIT 1").bind(client.id, client.user_id).first<{ id: string; status: string; token: string | null }>();
  let contractToken: string | null = have?.status === 'sent' || have?.status === 'signed' ? have.token : null;
  let made: 'sent' | 'draft' | null = null;
  if (!have) {
    const facts = { name: o.legalName || client.name, brands: o.brands || client.name, address: billing.address, contactName: o.pocName, piecesPerMonth: client.pieces_per_month, hoursPerMonth: client.hours_per_month, revisionsPerPiece: client.revisions_per_piece, retainerCents: client.retainer_cents, currency: settings.currency };
    const vars = { ...contractVarsFor(settings.profile, facts), client: o.legalName || client.name, brands: o.brands || client.name, clientContact: o.pocName, clientTitle: o.designation, pocName: o.pocName };
    // The same look and price table a new agreement gets from POST /agency/contracts: a typed agreement keeps its own look (only the page
    // size is the person's), and the owner's own packages fill a price table the template leaves empty.
    const typed = parseDocStyle(template.style).layout === 'typed';
    const style = typed ? parseDocStyle({ ...parseDocStyle(template.style), page: parseDocStyle(settings.profile.docStyle).page }) : parseDocStyle(template.style, parseDocStyle(settings.profile.docStyle));
    const doc: ContractDoc = await ownLogo(db, client.user_id, { ...template, currency: settings.currency, vars, style, sections: withProfilePackages(template.sections, settings.profile) });
    // Sent at once when the business side is complete (its details and a priced package table); otherwise a draft for the owner to finish.
    const pkg = doc.sections.find((x) => x.kind === 'packages');
    const ready = contractGaps(doc).every((g) => g.from !== 'profile') && (!pkg || (pkg.packages ?? []).some((p) => p.feeCents > 0));
    const id = newId();
    const token = ready ? randomCode(16) : null;
    await db
      .prepare('INSERT INTO agency_contracts (id, user_id, client_id, title, template_key, status, doc_json, answers_json, token, sent_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, client.user_id, client.id, doc.title, 'trial', ready ? 'sent' : 'draft', JSON.stringify(doc), JSON.stringify(answersFrom(o, questions)), token, ready ? now : null, now, now)
      .run();
    made = ready ? 'sent' : 'draft';
    contractToken = token;
    if (ready) await syncStageFromAgreements(db, { userId: client.user_id, clientId: client.id });
  }
  await logStmt(db, client.user_id, client.id, 'client', 'onboarding', 'Onboarding finished.').run();
  const what = made === 'sent' ? 'Their agreement is filled in and sent to them to accept.' : made === 'draft' ? 'Their agreement is ready as a draft. Add your business details, then send it.' : 'Their details are on their page.';
  await notify(db, client.user_id, 'agency', `${client.name} finished onboarding`, what, `/agency/${client.id}`);
  // One email to the owner's own address: the brand and a link to the client page, never the answers. Not marketing.
  const owner = await db.prepare('SELECT email, display_name FROM users WHERE id = ?').bind(client.user_id).first<{ email: string | null; display_name: string }>();
  if (owner?.email) {
    const mail = fillEmail('onboarding-done', { ...emptyEmailVars(), names: (nameOf(owner) || '').split(/\s+/)[0] ?? '', engagement: client.name, status: what, link: publicUrl(c.env, `/agency/${client.id}`) });
    await sendEmail(db, c.env, { userId: client.user_id, to: owner.email, subject: mail.subject, body: mail.body, private: true });
  }
  return c.json({ ok: true, contract: made, contractToken });
});

// ---- a client asks for a new password, from the lock screen or their page

// No session needed, so it works from the lock screen. The same answer for an unknown link, a known one and one already asked about,
// so it never confirms a link. One open ask per client (the partial unique index); the reason stays in that row only.
agencyLifePublic.post('/password-request', async (c) => {
  const db = c.env.DB;
  const body = await bodyOf(c);
  const kind = body.kind === 'contract' || body.kind === 'invoice' || body.kind === 'doc' || body.kind === 'team' ? body.kind : 'agency';
  const token = typeof body.token === 'string' ? body.token.slice(0, 40) : '';
  const reason = str(body.reason, PASSWORD_REQUEST_REASON_MAX);
  // 'team' is the team link (the client's own team): its own ask, its own note, never touching the client link's.
  const team = kind === 'team';
  const client: LockRow | null = kind === 'agency' ? await lockRowForToken(db, token) : kind === 'team' ? await teamLockRowForToken(db, token) : await clientOfDocument(db, kind, token);
  c.header('Cache-Control', 'no-store');
  if (!client || !client.portal_pass_hash) return c.json({ ok: true });
  const now = nowIso();
  const res = await db.prepare('INSERT OR IGNORE INTO agency_password_requests (id, client_id, user_id, reason, created_at, link) VALUES (?, ?, ?, ?, ?, ?)').bind(newId(), client.id, client.user_id, reason, now, team ? 'team' : 'client').run();
  if (!res.meta.changes) return c.json({ ok: true });
  const who = team ? `${client.name}'s team` : client.name;
  const what = team ? 'the team link' : 'their page';
  await db.batch([
    logStmt(db, client.user_id, client.id, 'client', 'password', team ? 'Their team asked for a new password for the team link.' : 'The client asked for a new password.'),
    // One stable note per client and link, so a second ask after a dismissal brings the same line back to the top instead of adding another.
    db.prepare('INSERT OR REPLACE INTO notifications (id, user_id, kind, title, body, link, read_at, created_at) VALUES (?, ?, ?, ?, ?, ?, NULL, ?)').bind(team ? `pwreq-team-${client.id}` : `pwreq-${client.id}`, client.user_id, 'agency', `${who} asked for a new password`, team ? 'Set a new one for the team link on their page, then send it to them yourself.' : 'Set a new one on their page, then send it to them yourself.', `/agency/${client.id}${team ? '?cseg=link' : ''}`, now),
  ]);
  const owner = await db.prepare('SELECT email FROM users WHERE id = ?').bind(client.user_id).first<{ email: string | null }>();
  if (owner?.email) {
    const face = await agencyFace(db, client.user_id);
    const link = publicUrl(c.env, `/agency/${client.id}`);
    await sendEmail(db, c.env, {
      userId: client.user_id,
      to: owner.email,
      subject: `${who} asked for a new password`,
      body: `${who} asked for a new password for ${what}${face.agencyName ? ` with ${face.agencyName}` : ''}.\n\nSet a new one on their page, then send it to them yourself, by a different channel from the link.${link ? `\n\n${link}` : ''}`,
      private: true,
    });
  }
  return c.json({ ok: true });
});
