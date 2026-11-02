import {
  autoStage,
  parseLifecycleDates,
  parseRetainerOptions,
  parseStage,
  retainerCycles,
  retainerMonthlyCents,
  retainerTotalCents,
  type AgencyRetainer,
  type AgencyStageKey,
  type ClientLifecycle,
  type LifecycleLogLine,
  type RetainerStatus,
  type StageEvent,
} from '@kreators/shared';
import { newId, nowIso } from './db';

/**
 * The server side of a client's way from enquiry to monthly delivery: the audit line, the guarded stage move, the stages the app moves by
 * itself, and the owner's view of it all. Owner only: every query takes the owner's id.
 */

export interface RetainerRow {
  id: string;
  user_id: string;
  client_id: string;
  status: RetainerStatus;
  options_json: string;
  months: number | null;
  discount_bps: number;
  fee_cents: number;
  pieces_per_month: number;
  revisions_per_piece: number;
  start_day: string | null;
  auto_send: number;
  chosen_at: string | null;
  confirmed_at: string | null;
  ended_at: string | null;
  created_at: string;
}

/** One line in the client's log. A statement, so it can ride in a batch with the change it describes. */
export function logStmt(db: D1Database, userId: string, clientId: string, actor: 'me' | 'client' | 'auto', kind: string, text: string): D1PreparedStatement {
  return db.prepare('INSERT INTO agency_log (id, user_id, client_id, actor, kind, text, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(newId(), userId, clientId, actor, kind, text.slice(0, 300), nowIso());
}

/**
 * Moves a client from one stage to another only if it is still where the caller saw it (`WHERE stage = from`), so two taps or a tap and the
 * cron move it once. Writes the log line when it moved. True when it did.
 */
export async function moveStage(db: D1Database, userId: string, clientId: string, from: AgencyStageKey, to: AgencyStageKey, actor: 'me' | 'client' | 'auto', text: string): Promise<boolean> {
  const now = nowIso();
  const res = await db.prepare('UPDATE agency_clients SET stage = ?, stage_since = ?, updated_at = ? WHERE id = ? AND user_id = ? AND stage = ?').bind(to, now, now, clientId, userId, from).run();
  if (!res.meta.changes) return false;
  await logStmt(db, userId, clientId, actor, 'stage', text).run();
  return true;
}

/** Applies a stage event the app saw (an agreement sent or signed, an offer, a retainer started): forward only, once. */
export async function applyStageEvent(db: D1Database, userId: string, clientId: string, event: StageEvent, text: string): Promise<AgencyStageKey | null> {
  const row = await db.prepare('SELECT stage FROM agency_clients WHERE id = ? AND user_id = ?').bind(clientId, userId).first<{ stage: string }>();
  if (!row) return null;
  const from = parseStage(row.stage);
  const to = autoStage(from, event);
  if (!to) return null;
  return (await moveStage(db, userId, clientId, from, to, 'auto', text)) ? to : null;
}

/**
 * A client moves on when its agreement does: an agreement sent takes an enquiry to Agreement sent, and a signed one takes an enquiry or a
 * sent client to Agreement signed. Another part of the app signs the agreement, so this is read rather than called there: the client page,
 * the client's link and the cron all run it, and it does nothing the second time. Pass a client to look at one, none for all (the cron).
 */
export async function syncStageFromAgreements(db: D1Database, only?: { userId: string; clientId: string }): Promise<number> {
  const rows = await db
    .prepare(
      `SELECT c.id, c.user_id, c.stage,
        EXISTS (SELECT 1 FROM agency_contracts k WHERE k.client_id = c.id AND k.status = 'signed') AS signed,
        EXISTS (SELECT 1 FROM agency_contracts k WHERE k.client_id = c.id AND k.status = 'sent') AS sent
       FROM agency_clients c
       WHERE c.stage IN ('enquiry', 'agreement_sent') ${only ? 'AND c.id = ?1 AND c.user_id = ?2' : ''}
       AND EXISTS (SELECT 1 FROM agency_contracts k WHERE k.client_id = c.id AND k.status IN ('sent', 'signed')) LIMIT 300`,
    )
    .bind(...(only ? [only.clientId, only.userId] : []))
    .all<{ id: string; user_id: string; stage: string; signed: number; sent: number }>();
  let moved = 0;
  for (const r of rows.results) {
    const from = parseStage(r.stage);
    const event: StageEvent = r.signed ? 'agreement_signed' : 'agreement_sent';
    const to = autoStage(from, event);
    if (to && (await moveStage(db, r.user_id, r.id, from, to, 'auto', event === 'agreement_signed' ? 'The agreement was signed.' : 'The agreement was sent.'))) moved += 1;
  }
  return moved;
}

/** The retainer as the owner sees it. `made` is the months it has made so far (`YYYY-MM`). */
export function toRetainer(r: RetainerRow, made: string[]): AgencyRetainer {
  const options = parseRetainerOptions(r.options_json);
  const chosen = r.months ?? null;
  const cycles = r.start_day && chosen ? retainerCycles(r.start_day, chosen) : [];
  const next = cycles.find((c) => !made.includes(c.month)) ?? null;
  return {
    id: r.id,
    status: r.status,
    options,
    months: chosen,
    feeCents: r.fee_cents,
    discountBps: r.discount_bps,
    monthlyCents: chosen ? retainerMonthlyCents(r.fee_cents, r.discount_bps) : null,
    totalCents: chosen ? retainerTotalCents(r.fee_cents, chosen, r.discount_bps) : null,
    piecesPerMonth: r.pieces_per_month,
    revisionsPerPiece: r.revisions_per_piece,
    startDay: r.start_day,
    endDay: cycles.length > 0 ? cycles[cycles.length - 1]!.end : null,
    autoSend: r.auto_send === 1,
    nextCycle: r.status === 'active' && next ? { n: next.n, day: next.day } : null,
    cyclesMade: made.length,
    chosenAt: r.chosen_at,
    createdAt: r.created_at,
  };
}

/** The retainer that matters now: the running one, else one waiting on an answer, else the latest that ended. */
export async function currentRetainer(db: D1Database, userId: string, clientId: string): Promise<RetainerRow | null> {
  return db
    .prepare("SELECT * FROM agency_retainers WHERE client_id = ? AND user_id = ? ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'chosen' THEN 1 WHEN 'offered' THEN 2 WHEN 'ended' THEN 3 ELSE 4 END, created_at DESC LIMIT 1")
    .bind(clientId, userId)
    .first<RetainerRow>();
}

export async function monthsMade(db: D1Database, retainerId: string): Promise<string[]> {
  const rows = await db.prepare('SELECT month FROM agency_cycles WHERE retainer_id = ? ORDER BY n').bind(retainerId).all<{ month: string }>();
  return rows.results.map((r) => r.month);
}

interface LifeClient {
  id: string;
  stage: string;
  stage_since: string | null;
  lifecycle_json: string;
  ticks_json: string;
  revisions_per_piece: number;
  portal_pass_hash: string | null;
  portal_pass_set_at: string | null;
  portal_last_opened_day: string | null;
}

function ticksOf(raw: string): Record<string, boolean> {
  try {
    const v = JSON.parse(raw || '{}') as unknown;
    if (!v || typeof v !== 'object') return {};
    const out: Record<string, boolean> = Object.create(null);
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) if (x === true && /^[a-z_]{1,20}:[a-z_]{1,20}$/.test(k)) out[k] = true;
    return { ...out };
  } catch {
    return {};
  }
}

/** The owner's view of a client's lifecycle: stage, days, checklist, password state, retainer and the log. */
export async function lifecycleFor(db: D1Database, userId: string, row: LifeClient): Promise<ClientLifecycle> {
  const [retainerRow, log, trial] = await Promise.all([
    currentRetainer(db, userId, row.id),
    db.prepare('SELECT id, actor, kind, text, created_at FROM agency_log WHERE client_id = ? AND user_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 30').bind(row.id, userId).all<{ id: string; actor: LifecycleLogLine['actor']; kind: string; text: string; created_at: string }>(),
    db.prepare('SELECT id FROM agency_items WHERE client_id = ? AND user_id = ? AND trial = 1 ORDER BY created_at LIMIT 1').bind(row.id, userId).first<{ id: string }>(),
  ]);
  const made = retainerRow ? await monthsMade(db, retainerRow.id) : [];
  return {
    stage: parseStage(row.stage),
    stageSince: row.stage_since,
    dates: parseLifecycleDates(row.lifecycle_json),
    ticks: ticksOf(row.ticks_json),
    revisionsPerPiece: row.revisions_per_piece,
    password: { set: Boolean(row.portal_pass_hash), setAt: row.portal_pass_set_at, lastOpenedDay: row.portal_last_opened_day },
    retainer: retainerRow ? toRetainer(retainerRow, made) : null,
    log: log.results.map((l) => ({ id: l.id, actor: l.actor, kind: l.kind, text: l.text, at: l.created_at })),
    trialItemId: trial?.id ?? null,
  };
}
