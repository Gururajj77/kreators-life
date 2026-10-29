import { Hono, type Context } from 'hono';
import {
  AGENT_LIMITS,
  ASSISTANT_MODELS,
  creditsFor,
  isPaidPlan,
  MODULES,
  PLANS,
  type AssistantCall,
  type AssistantPaywall,
  type AssistantReceipt,
  type AssistantReply,
  type AssistantStatus,
  type AssistantTurn,
} from '@kreators/shared';
import type { AppEnv, Env } from '../env';
import { resolveAccess } from '../access';
import { accountOf, creditAccount, spend, usedToday } from '../credits';
import { DATE_RE, dateNearToday, newId, nowIso, shiftDate } from '../db';
import { caller, ToolError, type Req } from '../assistant/dispatch';
import { checkArgs, TOOL_BY_NAME, TOOLS, type Args, type Tool, type ToolIO } from '../assistant/tools';
import { chat, MAX_OUT, ModelError, modelOf, tokensOf, tokensOfMessages, type Message, type ToolCall, type ToolSpec } from '../assistant/model';

/**
 * The assistant: typing to a model that does things in the app as the person. It needs a plan and credits; the
 * free flows in the panel never come here. Each message runs a short loop: the model reads, acts through the
 * tools, and says what it did. Writes are logged with how to undo them; removals and settling wait for Confirm.
 * What a message cost in tokens is taken from the person's credits once, at the end.
 */

type ExecCtx = Context<AppEnv>['executionCtx'];
type AppFetch = (req: Request, env: Env, ctx?: ExecCtx) => Response | Promise<Response>;

interface ActionRow {
  id: string;
  user_id: string;
  tool: string;
  label: string;
  status: AssistantReceipt['status'];
  args_json: string;
  undo_json: string;
  refresh_json: string;
  error: string;
  created_at: string;
  updated_at: string;
}

const toReceipt = (r: ActionRow): AssistantReceipt => ({
  id: r.id,
  tool: r.tool,
  label: r.label,
  status: r.status,
  error: r.error,
  undo: r.status === 'done' && r.undo_json !== '',
  refresh: JSON.parse(r.refresh_json || '[]') as string[],
});

const MAX_TURNS = 40;
/** The most a tool result may add to the model's context, in characters. */
const MAX_RESULT = 12_000;
/** The most tool calls run from one model turn; the rest are answered with a note so the model can call them again. */
const MAX_CALLS = 8;
/** A run id from the browser, for Stop. */
const RUN_RE = /^[A-Za-z0-9-]{8,64}$/;
/** What the assistant says back for the model, when it asked leave to do what the person already asked for. */
const GO_AHEAD = 'Yes, go ahead. Do it now, without asking again.';

/**
 * True when a reply ends by asking leave to act ("Do you want me to tick it?"), not by asking which thing is meant.
 * A question that offers a choice ("which one", "A or B") is a real question and is left for the person.
 */
export function asksLeave(text: string): boolean {
  const last = text.trim().split(/(?<=[.!?])\s+/).at(-1) ?? '';
  if (/\bwhich\b|\bor\b/i.test(last)) return false;
  return /\?\s*$/.test(last) ? /\b(shall i|should i|can i|may i|do you want me to|would you like me to|want me to|is (that|this) (ok|okay|fine)|go ahead)\b/i.test(last) : /\blet me know if you('d| would)? (like|want) me to\b/i.test(last);
}
const MAX_TEXT = 4000;
/** A card waiting for Confirm goes stale after an hour; the person asks again. */
const PENDING_MS = 3_600_000;

function screenOf(path: string): string {
  const hit = [...MODULES].sort((a, b) => b.path.length - a.path.length).find((m) => path === m.path || path.startsWith(`${m.path}/`));
  return hit && hit.key !== 'assistant' ? hit.name : 'the app';
}

function systemPrompt(p: { name: string; date: string; weekday: string; timeZone: string; screen: string }): string {
  return `You are Bumling, the guide inside kreators.app. You do things in the app for the person you are talking to, by calling the tools. You act only as them, on their own things.

${p.name ? `Their name is ${p.name}. ` : ''}Today is ${p.weekday} ${p.date}, in ${p.timeZone}. They are on ${p.screen === 'the app' ? 'a screen of the app' : `the ${p.screen} screen`}, and it updates under you as you act.

How you work:
- Finish the job in one go. When they ask for something, look up what you need with a read tool and then do it, in the same turn. Never ask "shall I" or "do you want me to": asking you was the go-ahead.
- Use the real ids a read tool gives. Never make up an id.
- When they say they did something, do it in the app: tick the task, check them in, log the sleep, add the money.
- Ask only when it is unclear which item they mean, or a number you need is missing. Then ask in one short line, naming the choices.
- After you act, say what changed in one or two short sentences. The screen lists each change with an Undo, so never list ids.
- When a tool says no, say why in plain words and what they can do instead. Never say something was done when the tool failed.
- Removing things and settling money wait for the person: the tool puts a card on screen. Tell them to tap Confirm.
- Read the journal only when they ask about their journal. Never bring it up yourself. If you have no tool for the journal or the trackers, say this model cannot read them and they can pick a private one.
- Money amounts go in as they said them, in their own currency.
- You cannot pay, buy, post, message people, or change settings. Say so and point them to the screen for it.
- The app's words: seven pillars, each a pyramid of layers (foundation, guiding principle, value goal, goal outcome, project, task); the small act; the not to do list; Daily; reviews by period.
- Write short, plain sentences a teenager can read. No emoji, no tables, no headings.`;
}

/** The turns that fit in the plan's context, newest kept first. The last line is always the person's. */
function fit(turns: AssistantTurn[], budget: number): Message[] {
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

function parseTurns(raw: unknown): AssistantTurn[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(-MAX_TURNS)
    .filter((t): t is { role: string; text: string; note?: unknown } => Boolean(t) && typeof t === 'object' && (t.role === 'user' || t.role === 'assistant') && typeof t.text === 'string')
    .map((t) => ({ role: t.role as AssistantTurn['role'], text: t.text.trim().slice(0, MAX_TEXT), ...(typeof t.note === 'string' && t.note ? { note: t.note.slice(0, 1000) } : {}) }))
    .filter((t) => t.text);
}

const tokenOf = (c: Context<AppEnv>) => {
  const h = c.req.header('Authorization') ?? '';
  return h.startsWith('Bearer ') ? h.slice(7).trim() : '';
};
const ctxOf = (c: Context<AppEnv>): ExecCtx | undefined => {
  try {
    return c.executionCtx;
  } catch {
    return undefined;
  }
};
/** The person's date from the device, when it is a real date near today; else the server's. */
const dateFrom = (v: unknown) => (typeof v === 'string' && DATE_RE.test(v) && dateNearToday(v) ? v : new Date().toISOString().slice(0, 10));

async function record(db: D1Database, userId: string, tool: Tool, r: { status: ActionRow['status']; label: string; args?: Args; undo?: Req | null; error?: string }): Promise<ActionRow> {
  const now = nowIso();
  const row: ActionRow = {
    id: newId(),
    user_id: userId,
    tool: tool.name,
    label: r.label.slice(0, 200),
    status: r.status,
    args_json: r.args ? JSON.stringify(r.args) : '',
    undo_json: r.undo ? JSON.stringify(r.undo) : '',
    refresh_json: JSON.stringify(tool.refresh),
    error: (r.error ?? '').slice(0, 300),
    created_at: now,
    updated_at: now,
  };
  await db
    .prepare('INSERT INTO assistant_actions (id, user_id, tool, label, status, args_json, undo_json, refresh_json, error, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(row.id, row.user_id, row.tool, row.label, row.status, row.args_json, row.undo_json, row.refresh_json, row.error, row.created_at, row.updated_at)
    .run();
  return row;
}

const errorOf = (e: unknown) => {
  if (e instanceof ToolError) return e.message;
  console.error(e);
  return 'Something broke on our side.';
};

export function assistantRoutes(appFetch: AppFetch) {
  const assistant = new Hono<AppEnv>();

  /** A caller as this person, through the whole app: session, switches, limits and all. */
  const ioFor = (c: Context<AppEnv>, date: string): ToolIO => ({
    date,
    yesterday: shiftDate(date, -1),
    call: caller((req) => Promise.resolve(appFetch(req, c.env, ctxOf(c))), tokenOf(c)),
  });

  const toolsOn = async (c: Context<AppEnv>): Promise<Tool[]> => {
    const { access } = await resolveAccess(c.env.DB, c.get('user'));
    const on = (keys: readonly string[] | null) => !keys || keys.some((k) => access[k]?.available && access[k]?.on);
    return TOOLS.filter((t) => on(t.needs));
  };

  const refuse = (c: Context<AppEnv>, paywall: AssistantPaywall, error: string, status: 402 | 429) => c.json({ error, paywall }, status);

  assistant.get('/', async (c) => {
    const cfg = modelOf(c.env);
    const status: AssistantStatus = { connected: Boolean(cfg), model: cfg?.model ?? null, models: cfg ? ASSISTANT_MODELS : [], account: await creditAccount(c.env.DB, c.get('user').id) };
    return c.json(status);
  });

  assistant.post('/', async (c) => {
    const db = c.env.DB;
    const user = c.get('user');
    const body = await c.req.json<{ messages?: unknown; model?: unknown; runId?: unknown; context?: { path?: unknown; date?: unknown; timeZone?: unknown } }>().catch(() => ({}) as { messages?: unknown; model?: unknown; runId?: unknown; context?: undefined });
    const cfg = modelOf(c.env, body.model);
    if (!cfg) return c.json({ error: 'Typing to the assistant is not set up on this server yet. The flows still work.' }, 503);

    // The paywall: a plan, credits left, and room in the day's cap for this agent.
    const acct = await accountOf(db, user.id);
    if (!isPaidPlan(acct.plan)) return refuse(c, 'plan', 'Typing to the assistant is part of a plan. The flows stay free.', 402);
    const limit = AGENT_LIMITS[acct.plan].assistant;
    const left = acct.plan_credits + acct.extra_credits;
    if (left <= 0) return refuse(c, 'credits', 'You are out of credits. Top up, or wait for your plan to start again.', 402);
    const used = (await usedToday(db, user.id)).assistant;
    if (used >= limit.perDay) return refuse(c, 'day', `You used today's ${limit.perDay.toLocaleString('en-US')} credits for the assistant on ${PLANS[acct.plan].name}. They free up over the next 24 hours.`, 429);
    const budget = Math.min(left, limit.perMessage, limit.perDay - used);

    const turns = parseTurns(body.messages);
    if (!turns.length || turns[turns.length - 1]!.role !== 'user') return c.json({ error: 'Say something first.' }, 400);
    const date = dateFrom(body.context?.date);
    const timeZone = typeof body.context?.timeZone === 'string' && /^[A-Za-z0-9_+\-/]{1,64}$/.test(body.context.timeZone) ? body.context.timeZone : 'UTC';
    const path = typeof body.context?.path === 'string' ? body.context.path.slice(0, 200) : '';

    // A model that keeps data is never offered the journal or the trackers to read.
    const tools = (await toolsOn(c)).filter((t) => cfg.private || !t.sensitive);
    const byName = new Map(tools.map((t) => [t.name, t]));
    const specs: ToolSpec[] = tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.risk === 'confirm' ? `${t.description} It waits for the person to tap Confirm.` : t.description, parameters: t.params } }));
    const system = systemPrompt({ name: user.display_name, date, weekday: new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' }), timeZone, screen: screenOf(path) });
    const fixed = tokensOf(system) + tokensOf(JSON.stringify(specs));
    const messages: Message[] = [{ role: 'system', content: system }, ...fit(turns, limit.contextTokens - fixed - MAX_OUT)];

    const io = ioFor(c, date);
    // Stop: the browser names this run, and Stop marks it. A mark that came first (a fast tap) is kept, not reset.
    const runId = typeof body.runId === 'string' && RUN_RE.test(body.runId) ? body.runId : null;
    if (runId) {
      await db.batch([
        db.prepare('DELETE FROM assistant_runs WHERE created_at < ?').bind(new Date(Date.now() - 86_400_000).toISOString()),
        db.prepare('INSERT OR IGNORE INTO assistant_runs (id, user_id, stopped_at, created_at) VALUES (?, ?, NULL, ?)').bind(runId, user.id, nowIso()),
      ]);
    }
    const stopAsked = async () => Boolean(runId && (await db.prepare('SELECT stopped_at FROM assistant_runs WHERE id = ? AND user_id = ?').bind(runId, user.id).first<{ stopped_at: string | null }>())?.stopped_at);
    let nudged = false;
    const calls: AssistantCall[] = [];
    const rows: ActionRow[] = [];
    const tokens = { input: 0, output: 0 };
    let text = '';
    let stopped: AssistantReply['stopped'] = null;
    let waiting = false;
    let failed = false;

    const runCall = async (tc: ToolCall): Promise<string> => {
      const name = tc.function.name;
      const tool = byName.get(name);
      if (!tool) {
        const error = TOOL_BY_NAME[name] ? 'That app is switched off on this account.' : 'There is no such tool.';
        calls.push({ tool: name, args: {}, ok: false, error });
        return JSON.stringify({ error });
      }
      let raw: unknown;
      try {
        // Some models wrap the arguments in a code fence.
        raw = JSON.parse((tc.function.arguments || '{}').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '') || '{}');
      } catch {
        calls.push({ tool: name, args: {}, ok: false, error: 'bad arguments' });
        return JSON.stringify({ error: 'The arguments were not valid JSON.' });
      }
      const args = checkArgs(tool.params, raw);
      if (typeof args === 'string') {
        calls.push({ tool: name, args: {}, ok: false, error: args });
        return JSON.stringify({ error: args });
      }
      if (tool.risk === 'confirm') {
        try {
          const label = tool.describe ? await tool.describe(args, io) : tool.title;
          rows.push(await record(db, user.id, tool, { status: 'pending', label, args }));
          calls.push({ tool: name, args, ok: true });
          waiting = true;
          return JSON.stringify({ waiting: true, said: 'A card with Confirm and Cancel is on the screen. Nothing happens until they tap Confirm.' });
        } catch (e) {
          const error = errorOf(e);
          calls.push({ tool: name, args, ok: false, error });
          return JSON.stringify({ error });
        }
      }
      try {
        const out = await tool.run(args, io);
        if (tool.risk === 'write') rows.push(await record(db, user.id, tool, { status: 'done', label: out.label ?? tool.title, undo: out.undo ?? null }));
        calls.push({ tool: name, args, ok: true });
        // Never cut JSON in half: a result too long to read is replaced by a note to ask for less.
        const said = JSON.stringify(out.data ?? { ok: true });
        return said.length <= MAX_RESULT ? said : JSON.stringify({ truncated: true, chars: said.length, note: 'Too long to read in full. Call it again with a narrower filter (a pillar, a layer, dates or a smaller limit).' });
      } catch (e) {
        const error = errorOf(e);
        if (tool.risk === 'write') rows.push(await record(db, user.id, tool, { status: 'failed', label: tool.title, error }));
        calls.push({ tool: name, args, ok: false, error });
        return JSON.stringify({ error });
      }
    };

    for (let step = 0; step < limit.steps; step += 1) {
      if (await stopAsked()) {
        stopped = 'user';
        break;
      }
      // Stop before a call that could push the message past what it may spend.
      const next = creditsFor({ input: tokensOfMessages(messages) + tokensOf(JSON.stringify(specs)), output: MAX_OUT }, cfg.price);
      if (creditsFor(tokens, cfg.price) + next > budget) {
        stopped = budget >= left ? 'credits' : 'limit';
        break;
      }
      let res: Awaited<ReturnType<typeof chat>>;
      try {
        res = await chat(cfg, messages, specs);
      } catch (e) {
        if (!(e instanceof ModelError)) console.error(e);
        const said = e instanceof ModelError ? e.message : 'The model could not answer.';
        // Nothing happened yet: answer with an error, so it is shown as one and not kept as the assistant's words.
        if (!calls.length && !tokens.input) return c.json({ error: said, model: cfg.model }, 502);
        text = `I stopped partway: ${said}`;
        failed = true;
        break;
      }
      tokens.input += res.usage.input;
      tokens.output += res.usage.output;
      if (!res.toolCalls.length) {
        // It asked leave to do what was asked, before changing anything: say yes for the person, once, and go on.
        if (!nudged && !rows.length && step < limit.steps - 1 && asksLeave(res.content)) {
          nudged = true;
          messages.push({ role: 'assistant', content: res.content }, { role: 'user', content: GO_AHEAD });
          continue;
        }
        text = res.content;
        break;
      }
      // Stop tapped while the model was thinking: its calls are not run.
      if (await stopAsked()) {
        stopped = 'user';
        break;
      }
      // Every call the model made gets an answer; past MAX_CALLS the answer says to call it again.
      messages.push({ role: 'assistant', content: res.content || null, tool_calls: res.toolCalls });
      for (const [i, tc] of res.toolCalls.entries()) {
        messages.push({ role: 'tool', tool_call_id: tc.id, content: i < MAX_CALLS ? await runCall(tc) : JSON.stringify({ error: `Not run: at most ${MAX_CALLS} at once. Call it again.` }) });
      }
      if (waiting) {
        text = res.content;
        break;
      }
      if (step === limit.steps - 1) stopped = 'steps';
    }

    if (runId) await db.prepare('DELETE FROM assistant_runs WHERE id = ?').bind(runId).run();
    if (stopped === 'user') text = rows.length ? 'Stopped. Here is what I did before you stopped; each one has an Undo.' : 'Stopped. Nothing was changed.';
    if (!text) {
      text = waiting
        ? 'Tap Confirm on the card to go ahead, or Cancel.'
        : stopped === 'credits'
          ? 'I stopped there because your credits ran out. Top up to keep going.'
          : stopped === 'limit'
            ? `I stopped there to stay under ${PLANS[acct.plan].name}'s cap for one message. Say “go on” to continue.`
            : stopped === 'steps'
              ? 'I stopped there, at the most steps one message can take. Say “go on” to continue.'
              : rows.length
                ? 'Done.'
                : 'I am not sure what to do with that. Tell me what you did, or what you want changed.';
    }

    const credits = await spend(db, user.id, 'assistant', creditsFor(tokens, cfg.price), tokens, cfg.model);
    const receipts = rows.map(toReceipt);
    const reply: AssistantReply = {
      text,
      model: cfg.model,
      failed,
      receipts,
      note: receipts.map((r) => `${r.status} ${r.tool}: ${r.label}`).join('; ').slice(0, 900),
      calls,
      credits,
      stopped,
    };
    return c.json(reply);
  });

  // Stop a running message. It ends before its next model call or tool, and answers with what it had done. A mark
  // made before the run starts (a very fast tap) is kept for it. Only the owner's own run can be stopped.
  assistant.post('/stop', async (c) => {
    const body = await c.req.json<{ runId?: unknown }>().catch(() => ({}) as { runId?: unknown });
    if (typeof body.runId !== 'string' || !RUN_RE.test(body.runId)) return c.json({ error: 'Which run?' }, 400);
    const now = nowIso();
    await c.env.DB.prepare(
      'INSERT INTO assistant_runs (id, user_id, stopped_at, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET stopped_at = excluded.stopped_at WHERE assistant_runs.user_id = excluded.user_id',
    )
      .bind(body.runId, c.get('user').id, now, now)
      .run();
    return c.json({ ok: true });
  });

  const actionOf = (c: Context<AppEnv>) => c.env.DB.prepare('SELECT * FROM assistant_actions WHERE id = ? AND user_id = ?').bind(c.req.param('id'), c.get('user').id).first<ActionRow>();
  const settle = async (db: D1Database, row: ActionRow, change: Partial<Pick<ActionRow, 'status' | 'label' | 'undo_json' | 'error'>>): Promise<ActionRow> => {
    const next = { ...row, ...change, args_json: '', updated_at: nowIso() };
    await db.prepare('UPDATE assistant_actions SET status = ?, label = ?, args_json = ?, undo_json = ?, error = ?, updated_at = ? WHERE id = ?').bind(next.status, next.label, next.args_json, next.undo_json, next.error, next.updated_at, row.id).run();
    return next;
  };

  // A card the model put up: the person taps Confirm, and only then does it run, as them, through the same tool.
  assistant.post('/actions/:id/confirm', async (c) => {
    const db = c.env.DB;
    const row = await actionOf(c);
    if (!row) return c.json({ error: 'not found' }, 404);
    if (row.status !== 'pending') return c.json({ error: 'That was already decided.', receipt: toReceipt(row) }, 409);
    if (Date.parse(row.created_at) < Date.now() - PENDING_MS) {
      const gone = await settle(db, row, { status: 'cancelled', error: 'Too old. Ask again.' });
      return c.json({ error: 'That card is more than an hour old. Ask again.', receipt: toReceipt(gone) }, 410);
    }
    const tool = TOOL_BY_NAME[row.tool];
    if (!tool || !(await toolsOn(c)).includes(tool)) return c.json({ error: 'That app is switched off on this account.' }, 403);
    const body = await c.req.json<{ date?: unknown }>().catch(() => ({}) as { date?: unknown });
    try {
      const out = await tool.run(JSON.parse(row.args_json || '{}') as Args, ioFor(c, dateFrom(body.date)));
      return c.json({ receipt: toReceipt(await settle(db, row, { status: 'done', label: out.label ?? tool.title, undo_json: out.undo ? JSON.stringify(out.undo) : '' })) });
    } catch (e) {
      const error = errorOf(e);
      return c.json({ error, receipt: toReceipt(await settle(db, row, { status: 'failed', error })) }, 400);
    }
  });

  assistant.post('/actions/:id/cancel', async (c) => {
    const row = await actionOf(c);
    if (!row) return c.json({ error: 'not found' }, 404);
    if (row.status !== 'pending') return c.json({ error: 'That was already decided.', receipt: toReceipt(row) }, 409);
    return c.json({ receipt: toReceipt(await settle(c.env.DB, row, { status: 'cancelled' })) });
  });

  // Undo runs the reverse the tool wrote down when it acted: a route call, as the person, never anything the model chose.
  assistant.post('/actions/:id/undo', async (c) => {
    const db = c.env.DB;
    const row = await actionOf(c);
    if (!row) return c.json({ error: 'not found' }, 404);
    if (row.status !== 'done' || !row.undo_json) return c.json({ error: 'That cannot be undone.', receipt: toReceipt(row) }, 409);
    const body = await c.req.json<{ date?: unknown }>().catch(() => ({}) as { date?: unknown });
    try {
      const a = await ioFor(c, dateFrom(body.date)).call(JSON.parse(row.undo_json) as Req);
      if (!a.ok && a.status !== 409) throw new ToolError(typeof a.data?.error === 'string' ? a.data.error : `That did not work (${a.status}).`);
      return c.json({ receipt: toReceipt(await settle(db, row, { status: 'undone', undo_json: '' })) });
    } catch (e) {
      return c.json({ error: errorOf(e), receipt: toReceipt(row) }, 400);
    }
  });

  return assistant;
}
