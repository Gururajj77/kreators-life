import { ROUTE_TRIPS, tripsOf } from '../d1Batch';
import { Hono, type Context } from 'hono';
import {
  AGENT_LIMITS,
  ASSISTANT_MODEL_BY_ID,
  ASSISTANT_MODELS,
  creditsFor,
  CRISIS_LINE,
  CRISIS_RE,
  DEFAULT_ZONE,
  isPaidPlan,
  LOCALE,
  MOODS,
  RELATIONSHIP_BY_KEY,
  sparkFor,
  type ChatMessage,
  type CompanionReply,
  type CompanionStatus,
  type RelationshipKey,
} from '@kreators/shared';
import type { AppEnv } from '../env';
import { newId, nowIso, streakNow } from '../db';
import { accountOf, creditAccount, spend, usedToday } from '../credits';
import { summaryFor } from './wellbeing';
import { ToolError } from '../assistant/dispatch';
import { checkArgs, TOOL_BY_NAME, type Tool } from '../assistant/tools';
import { chat, MAX_OUT, ModelError, modelKeepsNothing, modelOf, tokensOf, tokensOfMessages, type Message, type ModelConfig, type ToolCall, type ToolSpec } from '../assistant/model';
import { closeRun, dateFrom, fit, ioFor, markStop, openRun, parseToolArgs, runIdOf, stopAsked, toolsOn, zoneFrom, type AppFetch, type Turn } from '../assistant/run';

/**
 * The Companion: a short chat about how the person is doing. With a plan and a model connected it answers through
 * the assistant's model layer (agent `companion`, the one ledger, Stop through `assistant_runs`); it may look at the
 * person's day with a few read tools and never changes anything. Without a plan, with no credits or the day's cap
 * used, or when the model fails before it says anything, the built-in companion answers instead, free: Workers AI
 * on our own host, else the rules. It never answers with a paywall.
 *
 * Crisis words are checked on what the person wrote before anything else (no model call, no ledger row), and again
 * on a model's reply. Mood, sleep and the wellbeing score reach a model only when it keeps nothing.
 */

/** The read tools the Companion may call: the day, and for a model that keeps nothing, the trackers and the journal. */
export const COMPANION_TOOLS: ReadonlySet<string> = new Set(['get_daily', 'get_routine', 'get_reminders', 'get_week_plan', 'get_wellbeing', 'get_focus', 'read_journal', 'read_table']);
for (const name of COMPANION_TOOLS) if (TOOL_BY_NAME[name]?.risk !== 'read') console.error(`companion: ${name} is not a read tool`);

const ONLY_READS = 'The Companion only reads. Bumling can change things.';
/** The most one tool result may add to the context, in characters. */
const MAX_RESULT = 8_000;
/** Tool calls run from one model turn; the rest are answered with a note. */
const MAX_CALLS = 4;
/** A read tool's route at most, in D1 round trips. One message is one invocation, with fifty queries on the free plan. */
const TOOL_TRIPS = 8;
/** The chat lines a model may see, before they are fitted to the plan's context. */
const HISTORY = 40;
const MAX_TEXT = 2000;

interface Row {
  id: string;
  role: 'user' | 'assistant';
  body: string;
  model?: string | null;
  created_at: string;
}
const toMsg = (r: Row): ChatMessage => ({ id: r.id, role: r.role, body: r.body, createdAt: r.created_at, ...(r.model ? { model: r.model } : {}) });

/** What anyone may be told about the person's day. */
interface PlainFacts {
  name: string;
  streak: number;
  weakest: { name: string; character: string; question: string } | null;
  spark: string;
  openTasks: number;
  nextTask: string | null;
}
/** Wellbeing: only for Workers AI on our own host, the rules, and a model that keeps nothing. */
interface WellFacts {
  score: number;
  label: string;
  mood: string | null;
  sleep: number | null;
}

async function factsFor(c: Context<AppEnv>, date: string): Promise<{ plain: PlainFacts; well: WellFacts }> {
  const db = c.env.DB;
  const user = c.get('user');
  const [weak, tasks, summary] = await Promise.all([
    db.prepare('SELECT relationship FROM relationship_scores WHERE user_id = ? ORDER BY score ASC, xp ASC LIMIT 1').bind(user.id).first<{ relationship: RelationshipKey }>(),
    db
      // A task the person hid (2026-11-12) stays quiet here too: hidden_until is its last hidden day, the person's own.
      .prepare("SELECT title FROM nodes WHERE user_id = ? AND kind = 'task' AND status = 'active' AND (hidden_until IS NULL OR hidden_until < ?) ORDER BY COALESCE(do_date, due_date) IS NULL, COALESCE(do_date, due_date) ASC LIMIT 5")
      .bind(user.id, date)
      .all<{ title: string }>(),
    summaryFor(db, user.id, date, streakNow(user.streak, user.last_checkin, date)),
  ]);
  const rel = weak ? RELATIONSHIP_BY_KEY[weak.relationship] : null;
  const mood = summary.parts.find((p) => p.kind === 'mood')?.latest ?? null;
  const sleep = summary.parts.find((p) => p.kind === 'sleep')?.latest ?? null;
  return {
    plain: {
      name: user.display_name || 'friend',
      streak: streakNow(user.streak, user.last_checkin, date),
      weakest: rel ? { name: rel.name.toLowerCase(), character: rel.character, question: rel.question } : null,
      spark: rel ? sparkFor(rel.key, date) : 'Take three slow breaths.',
      openTasks: tasks.results.length,
      nextTask: tasks.results[0]?.title ?? null,
    },
    well: {
      score: summary.score,
      label: summary.label.toLowerCase(),
      mood: mood ? (MOODS.find((m) => m.value === mood)?.name.toLowerCase() ?? null) : null,
      sleep,
    },
  };
}

/** The companion without a model: it reflects what it knows and asks one real question. */
function localReply(text: string, p: PlainFacts, f: WellFacts): string {
  const t = text.toLowerCase();
  const lines: string[] = [];
  if (/\b(tired|exhaust\w*|sleep\w*|insomnia|awake)\b/.test(t)) {
    lines.push(f.sleep ? `You logged ${f.sleep} hours last night.` : 'You have not logged sleep yet, so I am guessing here.');
    lines.push('Tonight, pick one thing: phone charging outside the bedroom, or a fixed time to be in bed. Which one feels possible?');
  } else if (/\b(stress\w*|anxious|anxiety|overwhelm\w*|panic\w*|pressure\w*)\b/.test(t)) {
    lines.push('Let us slow it down for sixty seconds. Breathe in for four, hold for four, out for six, three times.');
    lines.push('Then tell me: what is the one thing on the pile that actually has a deadline today?');
  } else if (/\b(sad|down|low|lonely|alone|cry|empty)\b/.test(t)) {
    lines.push('Thank you for saying it plainly. That takes something.');
    if (p.weakest) lines.push(`${p.weakest.character} on your ${p.weakest.name} pillar keeps asking: ${p.weakest.question}`);
    lines.push('Who is one person you could send a two-line message to in the next hour?');
  } else if (/\b(angry|furious|annoyed|frustrat\w*)\b/.test(t)) {
    lines.push('Anger usually points at something you care about. What got stepped on?');
  } else if (/\b(happy|great|good|amazing|proud|won|win)\b/.test(t)) {
    lines.push(`Good. Write that down in your journal before the feed eats it. ${p.streak > 0 ? `Day ${p.streak} of your streak, too.` : ''}`.trim());
    lines.push('What did you do differently that made today go well?');
  } else if (/\b(what|should|how|help|idea|next)\b/.test(t)) {
    if (p.nextTask) lines.push(`The next task on your pillars is "${p.nextTask}". That is a good place to start.`);
    else lines.push('Your pillars have no open tasks right now. Build a pyramid and it will give you three.');
    lines.push(`Today's small act: ${p.spark}`);
  } else {
    lines.push(`I hear you, ${p.name}.`);
    lines.push(f.mood ? `You marked today as ${f.mood}.` : 'You have not marked a mood today.');
    lines.push('What would make the next hour one percent better?');
  }
  if (lines.length < 3) lines.push(`Your wellbeing score is ${f.score}, ${f.label}.`);
  return lines.join(' ');
}

const plainLine = (p: PlainFacts) =>
  `name ${p.name}; streak ${p.streak} days; weakest pillar ${p.weakest ? `${p.weakest.name} (its question: ${p.weakest.question})` : 'unknown'}; open tasks ${p.openTasks}; next task ${p.nextTask ?? 'none'}; today's small act "${p.spark}"`;
const wellLine = (f: WellFacts) => `wellbeing ${f.score} (${f.label}); mood today ${f.mood ?? 'unknown'}; sleep last night ${f.sleep ?? 'unknown'} hours`;

/** The Companion's rules for a model. It is the Companion, never Bumling. */
export function companionPrompt(p: { plain: PlainFacts; well: WellFacts | null; date: string; weekday: string; timeZone: string; tools: string[] }): string {
  return `You are the Companion inside kreators.app. You talk with the person about how they are doing.

Today is ${p.weekday} ${p.date}, in ${p.timeZone}.

How you talk:
- Warm, brief and concrete: under 90 words. End with one question.
- Never diagnose, never give medical or legal advice, and never name a condition.
- If they mention harming themselves, tell them to call their local emergency number or go to the nearest hospital, or call Tele-MANAS on 14416 in India, right away.
- No links, emoji, tables or headings. Short, plain sentences a teenager can read.
- ${p.tools.length ? 'You can look at their day with your tools; you cannot change anything.' : 'You cannot change anything in the app.'} If they want something changed, tell them Bumling, the assistant button, can do it.
- ${p.tools.includes('read_journal') ? 'Read the journal only when they ask about their journal. Never bring it up yourself.' : 'You cannot read their journal or their trackers with this model. If they ask, say a private model can.'}

What you know about them: ${plainLine(p.plain)}.${p.well ? ` ${wellLine(p.well)}.` : ''}`;
}

/** Wellbeing reaches a model only when nothing sent is kept: the host keeps nothing, and a listed model is a private one. */
const keepsNothing = (cfg: ModelConfig) => modelKeepsNothing(cfg);

/** A crisis line found in a model's reply that has not already pointed to help gets the crisis line added. */
const withCrisis = (reply: string) => (CRISIS_RE.test(reply) && !reply.includes('14416') ? `${reply}\n\n${CRISIS_LINE}` : reply);

export function companionRoutes(appFetch: AppFetch) {
  const companion = new Hono<AppEnv>();

  companion.get('/', async (c) => {
    const db = c.env.DB;
    const user = c.get('user');
    const cfg = modelOf(c.env);
    // The newest 80 lines, oldest first on screen: a long chat keeps its latest lines in view instead of stopping at line 80.
    const [rows, account] = await Promise.all([
      db.prepare('SELECT * FROM chat_messages WHERE user_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 80').bind(user.id).all<Row>(),
      creditAccount(db, user.id),
    ]);
    const status: CompanionStatus = {
      messages: rows.results.reverse().map(toMsg),
      builtIn: c.env.AI ? 'workers-ai' : 'local',
      connected: Boolean(cfg),
      model: cfg?.model ?? null,
      models: cfg ? ASSISTANT_MODELS : [],
      account,
    };
    return c.json(status);
  });

  companion.post('/', async (c) => {
    const db = c.env.DB;
    const user = c.get('user');
    const body = await c.req.json<{ body?: unknown; model?: unknown; runId?: unknown; context?: { date?: unknown; timeZone?: unknown } }>().catch(() => ({}) as { body?: unknown; model?: unknown; runId?: unknown; context?: undefined });
    const text = typeof body.body === 'string' ? body.body.trim().slice(0, MAX_TEXT) : '';
    if (!text) return c.json({ error: 'say something first' }, 400);

    const now = nowIso();
    const mine: ChatMessage = { id: newId(), role: 'user', body: text, createdAt: now };
    const save = async (reply: string, model: string): Promise<ChatMessage> => {
      const line: ChatMessage = { id: newId(), role: 'assistant', body: reply, createdAt: nowIso(), model };
      await db.prepare('INSERT INTO chat_messages (id, user_id, role, body, model, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(line.id, user.id, 'assistant', line.body, model, line.createdAt).run();
      return line;
    };
    await db.prepare('INSERT INTO chat_messages (id, user_id, role, body, model, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(mine.id, user.id, 'user', text, '', now).run();

    // A crisis first: the words go to no model, and nothing is charged.
    if (CRISIS_RE.test(text)) {
      const reply: CompanionReply = { messages: [mine, await save(CRISIS_LINE, 'crisis')], model: 'crisis', stopped: null };
      return c.json(reply);
    }

    const date = dateFrom(body.context?.date);
    const timeZone = zoneFrom(body.context?.timeZone, user.timezone || DEFAULT_ZONE);
    const facts = await factsFor(c, date);

    // The free answer: Workers AI on our own host with every fact (it keeps nothing), else the rules.
    const builtIn = async (fallback?: CompanionReply['fallback']) => {
      let reply: string | null = null;
      if (c.env.AI) {
        try {
          const history = await db.prepare('SELECT role, body FROM chat_messages WHERE user_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 12').bind(user.id).all<{ role: string; body: string }>();
          const system = `You are the Companion inside kreators.app, a daily game about seven relationships. Be warm, brief (under 90 words), concrete, and end with one question. Never diagnose or give medical advice; if someone mentions self-harm, tell them to contact local emergency services or a crisis line right away. Facts about this person: ${plainLine(facts.plain)}; ${wellLine(facts.well)}.`;
          const res = (await c.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
            messages: [{ role: 'system', content: system }, ...history.results.reverse().map((m) => ({ role: m.role, content: m.body }))],
            max_tokens: 220,
          })) as { response?: string };
          reply = typeof res?.response === 'string' && res.response.trim() ? res.response.trim() : null;
        } catch {
          reply = null;
        }
      }
      const model = reply ? 'workers-ai' : 'local';
      const out: CompanionReply = { messages: [mine, await save(withCrisis(reply ?? localReply(text, facts.plain, facts.well)), model)], model, stopped: null, ...(fallback ? { fallback } : {}) };
      return c.json(out);
    };

    // The model, when there is a plan, credits left and room in the day's cap for the Companion. Never a paywall.
    const cfg = modelOf(c.env, body.model);
    if (!cfg) return builtIn();
    const acct = await accountOf(db, user.id);
    if (!isPaidPlan(acct.plan)) return builtIn('plan');
    const limit = AGENT_LIMITS[acct.plan].companion;
    const left = acct.plan_credits + acct.extra_credits;
    if (left <= 0) return builtIn('credits');
    const used = (await usedToday(db, user.id)).companion;
    if (used >= limit.perDay) return builtIn('day');
    const budget = Math.min(left, limit.perMessage, limit.perDay - used);

    const priv = keepsNothing(cfg);
    const tools = (await toolsOn(c)).filter((t) => COMPANION_TOOLS.has(t.name) && t.risk === 'read' && (priv || !t.sensitive));
    const byName = new Map<string, Tool>(tools.map((t) => [t.name, t]));
    const specs: ToolSpec[] = tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.params } }));
    const system = companionPrompt({
      plain: facts.plain,
      well: priv ? facts.well : null,
      date,
      weekday: new Date(`${date}T12:00:00Z`).toLocaleDateString(LOCALE, { weekday: 'long', timeZone: 'Etc/UTC' }),
      timeZone,
      tools: tools.map((t) => t.name),
    });
    const history = await db
      .prepare('SELECT role, body, model FROM chat_messages WHERE user_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?')
      .bind(user.id, HISTORY)
      .all<{ role: Turn['role']; body: string; model: string | null }>();
    // A model that may keep data never reads a reply that was written from wellbeing: the built-in companion's and a
    // private model's lines (and old lines that do not say who wrote them) stay out; the person's own words go in.
    const sawNoWellbeing = (m: string | null) => m === 'crisis' || m === cfg.model || ASSISTANT_MODEL_BY_ID[m ?? '']?.private === false;
    const turns: Turn[] = history.results
      .reverse()
      .filter((r) => priv || r.role === 'user' || sawNoWellbeing(r.model))
      .map((r) => ({ role: r.role, text: r.body }));
    const fixed = tokensOf(system) + tokensOf(JSON.stringify(specs));
    const messages: Message[] = [{ role: 'system', content: system }, ...fit(turns, limit.contextTokens - fixed - MAX_OUT)];

    const io = ioFor(c, date, appFetch, priv);
    const runId = runIdOf(body.runId);
    await openRun(db, user.id, runId);
    const tokens = { input: 0, output: 0 };
    let reply = '';
    let stopped: CompanionReply['stopped'] = null;
    let failed = false;

    // Reads only: a name off the list (a write included) is answered and never run.
    const runCall = async (tc: ToolCall): Promise<string> => {
      const tool = byName.get(tc.function.name);
      if (!tool) return JSON.stringify({ error: COMPANION_TOOLS.has(tc.function.name) && TOOL_BY_NAME[tc.function.name] ? 'That is not open to this model, or its app is switched off.' : ONLY_READS });
      const raw = parseToolArgs(tc);
      if (raw === null) return JSON.stringify({ error: 'The arguments were not valid JSON.' });
      const args = checkArgs(tool.params, raw);
      if (typeof args === 'string') return JSON.stringify({ error: args });
      try {
        const out = await tool.run(args, io);
        const said = JSON.stringify(out.data ?? { ok: true });
        return said.length <= MAX_RESULT ? said : JSON.stringify({ truncated: true, chars: said.length, note: 'Too long to read in full. Ask for less.' });
      } catch (e) {
        return JSON.stringify({ error: e instanceof ToolError ? e.message : 'That did not work.' });
      }
    };

    for (let step = 0; step < limit.steps; step += 1) {
      if (await stopAsked(db, user.id, runId)) {
        stopped = 'user';
        break;
      }
      if (tripsOf(db) + step + TOOL_TRIPS >= ROUTE_TRIPS) {
        stopped = 'steps';
        break;
      }
      // Stop before a call that could push the message past what it may spend.
      const next = creditsFor({ input: tokensOfMessages(messages) + tokensOf(JSON.stringify(specs)), output: MAX_OUT }, cfg.price);
      if (creditsFor(tokens, cfg.price) + next > budget) {
        if (!tokens.input) {
          // Not even one call fits: the built-in companion answers, and nothing is charged.
          await closeRun(db, runId);
          return builtIn(budget >= left ? 'credits' : budget >= limit.perDay - used ? 'day' : 'error');
        }
        stopped = budget >= left ? 'credits' : 'limit';
        break;
      }
      let res: Awaited<ReturnType<typeof chat>>;
      try {
        res = await chat(cfg, messages, specs);
      } catch (e) {
        if (!(e instanceof ModelError)) console.error(e);
        // Nothing used yet: the built-in companion answers, so the Companion is never worse than without a plan.
        if (!tokens.input) {
          await closeRun(db, runId);
          return builtIn('error');
        }
        reply = `I stopped partway: ${e instanceof ModelError ? e.message : 'The model could not answer.'}`;
        failed = true;
        break;
      }
      tokens.input += res.usage.input;
      tokens.output += res.usage.output;
      if (!res.toolCalls.length) {
        reply = res.content;
        break;
      }
      // Stop tapped while the model was thinking: its calls are not run.
      if (await stopAsked(db, user.id, runId)) {
        stopped = 'user';
        break;
      }
      messages.push({ role: 'assistant', content: res.content || null, tool_calls: res.toolCalls });
      for (const [i, tc] of res.toolCalls.entries()) {
        const room = tripsOf(db) + step + TOOL_TRIPS <= ROUTE_TRIPS;
        messages.push({ role: 'tool', tool_call_id: tc.id, content: !room ? JSON.stringify({ error: 'Not run: this message has done what one message can. Answer from what you have.' }) : i < MAX_CALLS ? await runCall(tc) : JSON.stringify({ error: `Not run: at most ${MAX_CALLS} at once. Call it again.` }) });
      }
      if (step === limit.steps - 1) stopped = 'steps';
    }
    await closeRun(db, runId);

    if (stopped === 'user') reply = 'Stopped.';
    if (!reply) {
      reply =
        stopped === 'credits'
          ? 'I stopped there because your credits ran out. Say it again and the built-in companion will answer.'
          : stopped === 'limit' || stopped === 'steps'
            ? 'I looked, but ran out of room to answer in one message. Say “go on” and I will keep going.'
            : 'I am here. Say a little more about how today is going?';
    }
    // Charged once, through the one ledger: a free model still writes its usage row with the tokens and the model.
    const credits = tokens.input || tokens.output ? await spend(db, user.id, 'companion', creditsFor(tokens, cfg.price), tokens, cfg.model) : undefined;
    const out: CompanionReply = {
      messages: [mine, await save(withCrisis(reply.slice(0, 4000)), cfg.model)],
      model: cfg.model,
      ...(credits ? { credits } : {}),
      stopped,
      ...(failed ? { failed } : {}),
    };
    return c.json(out);
  });

  // Stop a running message: it ends before its next model call or tool. Its own route, so it works with the assistant off.
  companion.post('/stop', async (c) => {
    const body = await c.req.json<{ runId?: unknown }>().catch(() => ({}) as { runId?: unknown });
    const runId = runIdOf(body.runId);
    if (!runId) return c.json({ error: 'Which run?' }, 400);
    await markStop(c.env.DB, c.get('user').id, runId);
    return c.json({ ok: true });
  });

  companion.delete('/', async (c) => {
    await c.env.DB.prepare('DELETE FROM chat_messages WHERE user_id = ?').bind(c.get('user').id).run();
    return c.json({ ok: true });
  });

  return companion;
}
