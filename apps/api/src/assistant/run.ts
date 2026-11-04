import type { Context } from 'hono';
import type { AppEnv, Env } from '../env';
import { resolveAccess } from '../access';
import { DATE_RE, dateNearToday, nowIso, shiftDate } from '../db';
import { caller } from './dispatch';
import { TOOLS, type Tool, type ToolIO } from './tools';
import { tokensOf, type Message, type ToolCall } from './model';

/**
 * What every agent that runs on the assistant's model layer shares: the caller as the person, the tools their
 * switches allow, the device's day, the history that fits, and Stop through `assistant_runs`. One version, used by
 * the assistant and the Companion, so neither has its own copy.
 */

export type ExecCtx = Context<AppEnv>['executionCtx'];
export type AppFetch = (req: Request, env: Env, ctx?: ExecCtx) => Response | Promise<Response>;

export const tokenOf = (c: Context<AppEnv>) => {
  const h = c.req.header('Authorization') ?? '';
  return h.startsWith('Bearer ') ? h.slice(7).trim() : '';
};
export const ctxOf = (c: Context<AppEnv>): ExecCtx | undefined => {
  try {
    return c.executionCtx;
  } catch {
    return undefined;
  }
};
/** The person's date from the device, when it is a real date near today; else the server's. */
export const dateFrom = (v: unknown) => (typeof v === 'string' && DATE_RE.test(v) && dateNearToday(v) ? v : new Date().toISOString().slice(0, 10));
/** The person's zone from the device when it looks like one, else their own, else the default. */
export const zoneFrom = (v: unknown, fallback: string) => (typeof v === 'string' && /^[A-Za-z0-9_+\-/]{1,64}$/.test(v) ? v : fallback);

/** A caller as this person, through the whole app: session, switches, limits and all. */
export const ioFor = (c: Context<AppEnv>, date: string, appFetch: AppFetch): ToolIO => ({
  date,
  yesterday: shiftDate(date, -1),
  call: caller((req) => Promise.resolve(appFetch(req, c.env, ctxOf(c))), tokenOf(c)),
});

/** The tools whose apps are on for this person. */
export const toolsOn = async (c: Context<AppEnv>): Promise<Tool[]> => {
  const { access } = await resolveAccess(c.env.DB, c.get('user'));
  const on = (keys: readonly string[] | null) => !keys || keys.some((k) => access[k]?.available && access[k]?.on);
  return TOOLS.filter((t) => on(t.needs));
};

/** A tool call's arguments as JSON. Some models wrap them in a code fence. Null when they are not JSON. */
export function parseToolArgs(tc: ToolCall): unknown | null {
  try {
    return JSON.parse((tc.function.arguments || '{}').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '') || '{}');
  } catch {
    return null;
  }
}

/** One line of a chat so far, as an agent keeps it. */
export interface Turn {
  role: 'user' | 'assistant';
  text: string;
  /** What the assistant did then, for the next turn. */
  note?: string;
}

/** The turns that fit in the plan's context, newest kept first. The last line is always the person's. */
export function fit(turns: Turn[], budget: number): Message[] {
  const out: Message[] = [];
  let used = 0;
  for (let i = turns.length - 1; i >= 0; i -= 1) {
    const t = turns[i]!;
    const content = t.role === 'assistant' && t.note ? `${t.text}\n\n(What I did then: ${t.note})` : t.text;
    const cost = tokensOf(content) + 4;
    if (out.length > 0 && used + cost > budget) break;
    out.unshift({ role: t.role, content: out.length === 0 && cost > budget ? content.slice(-Math.max(400, budget * 3)) : content });
    used += cost;
  }
  while (out.length > 1 && out[0]!.role === 'assistant') out.shift();
  return out;
}

// ---------------------------------------------------------------------------
// Stop: the browser names a run, and Stop marks it. Rows live only while a message runs.
// ---------------------------------------------------------------------------

/** A run id from the browser, for Stop. */
export const RUN_RE = /^[A-Za-z0-9-]{8,64}$/;
export const runIdOf = (v: unknown): string | null => (typeof v === 'string' && RUN_RE.test(v) ? v : null);

/** Open a run. A mark that came first (a fast tap on Stop) is kept, not reset. Old rows are swept. */
export async function openRun(db: D1Database, userId: string, runId: string | null): Promise<void> {
  if (!runId) return;
  await db.batch([
    db.prepare('DELETE FROM assistant_runs WHERE created_at < ?').bind(new Date(Date.now() - 86_400_000).toISOString()),
    db.prepare('INSERT OR IGNORE INTO assistant_runs (id, user_id, stopped_at, created_at) VALUES (?, ?, NULL, ?)').bind(runId, userId, nowIso()),
  ]);
}

/** True once the owner tapped Stop on this run. */
export async function stopAsked(db: D1Database, userId: string, runId: string | null): Promise<boolean> {
  return Boolean(runId && (await db.prepare('SELECT stopped_at FROM assistant_runs WHERE id = ? AND user_id = ?').bind(runId, userId).first<{ stopped_at: string | null }>())?.stopped_at);
}

export async function closeRun(db: D1Database, runId: string | null): Promise<void> {
  if (runId) await db.prepare('DELETE FROM assistant_runs WHERE id = ?').bind(runId).run();
}

/** Mark a run stopped. A mark made before the run starts is kept for it. Only the owner's own run can be marked. */
export async function markStop(db: D1Database, userId: string, runId: string): Promise<void> {
  const now = nowIso();
  await db
    .prepare('INSERT INTO assistant_runs (id, user_id, stopped_at, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET stopped_at = excluded.stopped_at WHERE assistant_runs.user_id = excluded.user_id')
    .bind(runId, userId, now, now)
    .run();
}
