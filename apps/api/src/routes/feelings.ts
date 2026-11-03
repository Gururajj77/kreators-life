import { Hono } from 'hono';
import {
  AGENT_LIMITS,
  ASSISTANT_MODEL_BY_ID,
  ASSISTANT_MODELS,
  creditsFor,
  feelingsFromModel,
  feelingsPrompt,
  FEELINGS_TEXT_MAX,
  isPaidPlan,
  isRelationshipKey,
  PLANS,
  RELATIONSHIP_BY_KEY,
  type AssistantPaywall,
  type FeelingsReadResult,
} from '@kreators/shared';
import type { AppEnv } from '../env';
import { accountOf, spend, usedToday } from '../credits';
import { chat, MAX_OUT, ModelError, modelOf, tokensOf, type Message, type ToolSpec } from '../assistant/model';

/**
 * "Read with AI" on the strategy session's map card: the person's own words about one relationship go to a model,
 * which answers with level numbers on the map. The rules (`readFeelings`) stay the default and free; this door is
 * for someone with a plan, and only through a model in ASSISTANT_MODELS that keeps nothing (`private`). The words
 * are sent once and never stored or logged here: no assistant_actions row, no app log beyond the bare path, and the
 * credit ledger keeps only the tokens and the model. The person still ticks the levels that fit.
 */
export const feelings = new Hono<AppEnv>();

const SUGGEST: ToolSpec = {
  type: 'function',
  function: {
    name: 'suggest_levels',
    description: 'The one to four map levels the words point to most, as their numbers.',
    parameters: { type: 'object', properties: { levels: { type: 'array', items: { type: 'integer' }, maxItems: 4 } }, required: ['levels'] },
  },
};

const refuse = (paywall: AssistantPaywall, error: string) => ({ error, paywall });

feelings.post('/', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const body = await c.req.json<{ text?: unknown; relationship?: unknown; model?: unknown }>().catch(() => ({}) as { text?: unknown; relationship?: unknown; model?: unknown });
  const text = typeof body.text === 'string' ? body.text.trim().slice(0, FEELINGS_TEXT_MAX) : '';
  if (text.length < 3) return c.json({ error: 'Write a few words first.' }, 400);

  // Only a model that keeps nothing: the one picked, when it is private, else the first private one on the list.
  const picked = typeof body.model === 'string' ? body.model : ASSISTANT_MODELS.find((m) => m.private)?.id;
  if (!picked || !ASSISTANT_MODEL_BY_ID[picked]?.private) return c.json({ error: 'Reading your words with AI needs a model that keeps nothing. Pick a private one, or tap Read my words.' }, 400);
  const cfg = modelOf(c.env, picked);
  if (!cfg) return c.json({ error: 'Reading with AI is not set up on this server yet. Read my words still works.' }, 503);
  if (cfg.model !== picked || !cfg.private) return c.json({ error: 'Reading your words with AI needs a model that keeps nothing. Pick a private one, or tap Read my words.' }, 400);

  // The paywall, the same as typing to the assistant: a plan, credits left and room in the day's cap.
  const acct = await accountOf(db, user.id);
  if (!isPaidPlan(acct.plan)) return c.json(refuse('plan', 'Reading with AI is part of a plan. Read my words stays free.'), 402);
  const limit = AGENT_LIMITS[acct.plan].feelings;
  const left = acct.plan_credits + acct.extra_credits;
  if (left <= 0) return c.json(refuse('credits', 'You are out of credits. Read my words stays free.'), 402);
  const used = (await usedToday(db, user.id)).feelings;
  if (used >= limit.perDay) return c.json(refuse('day', `You used today's ${limit.perDay.toLocaleString('en-US')} credits for the feelings reader on ${PLANS[acct.plan].name}. Read my words stays free.`), 429);
  const budget = Math.min(left, limit.perMessage, limit.perDay - used);

  const about = isRelationshipKey(body.relationship) ? RELATIONSHIP_BY_KEY[body.relationship].name.toLowerCase() : undefined;
  const system = feelingsPrompt(about);
  const messages: Message[] = [
    { role: 'system', content: system },
    { role: 'user', content: text },
  ];
  const guess = { input: tokensOf(system) + tokensOf(text) + tokensOf(JSON.stringify(SUGGEST)) + 8, output: MAX_OUT };
  if (guess.input > limit.contextTokens) return c.json({ error: 'That is a lot of words. Shorten it a little, or tap Read my words.' }, 400);
  if (creditsFor(guess, cfg.price) > budget) return c.json(refuse('credits', 'Not enough credits left for this. Read my words stays free.'), 402);

  let res: Awaited<ReturnType<typeof chat>>;
  try {
    res = await chat(cfg, messages, [SUGGEST]);
  } catch (e) {
    // Never log the words: only that the model failed.
    if (!(e instanceof ModelError)) console.error('feelings reader failed');
    return c.json({ error: e instanceof ModelError ? e.message : 'The model could not answer. Read my words still works.' }, 502);
  }
  const call = res.toolCalls.find((t) => t.function.name === SUGGEST.function.name);
  let answer: unknown = res.content;
  if (call) {
    try {
      answer = JSON.parse((call.function.arguments || '{}').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '') || '{}');
    } catch {
      answer = call.function.arguments;
    }
  }
  const levels = feelingsFromModel(answer);
  // Charged once, through the one ledger, with the tokens and the model and never the words.
  const credits = await spend(db, user.id, 'feelings', creditsFor(res.usage, cfg.price), res.usage, cfg.model);
  const out: FeelingsReadResult = { levels, model: ASSISTANT_MODEL_BY_ID[cfg.model]?.name ?? cfg.model, credits };
  return c.json(out);
});
