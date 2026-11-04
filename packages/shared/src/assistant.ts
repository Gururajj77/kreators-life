import { byKey } from './core.ts';
import { money } from './money.ts';

// ---------------------------------------------------------------------------
// The assistant and credits. The assistant does things in the app as the person: the free flows, and, with a
// plan, typing to a model that calls the same API routes the screens use. Typing is paid for in credits: one
// credit is a tenth of a US cent of model use, worked out from the tokens with whole numbers only.
// ---------------------------------------------------------------------------

/** "12.50" or 12.5 to 1250. Integer cents only, never a float: the decimal is read as text. */
export function centsFrom(input: string | number): number | null {
  const m = /^\s*(\d{1,9})(?:[.,](\d{1,2}))?\s*$/.exec(String(input));
  if (!m) return null;
  const cents = Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0') || '0');
  return cents > 0 ? cents : null;
}

/** A model's price in US micro-dollars per million tokens, which is the same number as picodollars per token. */
export interface ModelPrice {
  input: number;
  output: number;
}
/** One credit is US$0.001, which is 10^9 picodollars. */
export const PICO_PER_CREDIT = 1_000_000_000;
/** Known prices. A deployment can override them with ASSISTANT_PRICE_IN and ASSISTANT_PRICE_OUT. */
export const MODEL_PRICES: Readonly<Record<string, ModelPrice>> = {
  'moonshotai/kimi-k2.6': { input: 541_500, output: 2_280_000 },
};
/** What a model with no known price is charged: high on purpose, so a missing price never undercharges. */
export const FALLBACK_PRICE: ModelPrice = { input: 3_000_000, output: 15_000_000 };
/** OpenRouter's free models (ids ending in ":free") cost nothing, so a message on one spends no credits. */
export const FREE_PRICE: ModelPrice = { input: 0, output: 0 };
export const priceOf = (model: string): ModelPrice => (model.endsWith(':free') ? FREE_PRICE : (MODEL_PRICES[model] ?? FALLBACK_PRICE));

/** A model the assistant can run on, picked in the panel for now. */
export interface AssistantModel {
  id: string;
  name: string;
  by: string;
  /**
   * True when OpenRouter lists a zero-retention host for it. Only then is the assistant offered the journal and the
   * trackers to read, and only then is OpenRouter told to keep nothing. A model that keeps data never sees them.
   */
  private: boolean;
  /** Its reasoning cannot be switched off, so it gets more room to answer. Every other model is asked not to reason. */
  thinks?: boolean;
}
/**
 * The models to pick from while the assistant is being tried out: OpenRouter's free models that take tools (checked
 * against OpenRouter's model list on 29 Oct 2026). Free models are limited by OpenRouter to 20 requests a minute,
 * and 50 a day until the key's account has bought US$10 of credits. The first one is the default.
 */
export const ASSISTANT_MODELS: readonly AssistantModel[] = [
  { id: 'nvidia/nemotron-3-ultra-550b-a55b:free', name: 'Nemotron 3 Ultra', by: 'NVIDIA', private: false },
  { id: 'nvidia/nemotron-3.5-super-vl:free', name: 'Nemotron 3.5 Super VL', by: 'NVIDIA', private: false },
  { id: 'nvidia/nemotron-3.5-lightning:free', name: 'Nemotron 3.5 Lightning', by: 'NVIDIA', private: false },
  { id: 'xingchen-agi/xing4.0-29b-a4b:free', name: 'Xing4.0 29B', by: 'XingChen', private: true },
  { id: 'poolside/laguna-s-2.1:free', name: 'Laguna S 2.1', by: 'Poolside', private: false },
  { id: 'poolside/laguna-xs-2.1:free', name: 'Laguna XS 2.1', by: 'Poolside', private: false },
  { id: 'dots-studio/dots-3-note-preview:free', name: 'Dots3-Note Preview', by: 'Dots Studio', private: false },
  { id: 'thinkingmachines/inkling:free', name: 'Inkling', by: 'Thinking Machines', private: false },
  { id: 'thinkingmachines/inkling-small:free', name: 'Inkling Small', by: 'Thinking Machines', private: false },
  { id: 'recursive/flint-v1.0:free', name: 'Flint', by: 'Recursive', private: false, thinks: true },
  { id: 'cohere/north-mini-code:free', name: 'North Mini Code', by: 'Cohere', private: false },
  { id: 'google/gemma-4-31b-it:free', name: 'Gemma 4 31B', by: 'Google', private: false },
  { id: 'google/gemma-4-26b-a4b-it:free', name: 'Gemma 4 26B', by: 'Google', private: false },
  { id: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free', name: 'Nemotron 3 Nano Omni', by: 'NVIDIA', private: false },
  { id: 'liquid/lfm-2.5-2.6b:free', name: 'LFM2.5 2.6B', by: 'Liquid', private: false, thinks: true },
];
export const ASSISTANT_MODEL_BY_ID: Readonly<Record<string, AssistantModel>> = byKey(ASSISTANT_MODELS.map((m) => [m.id, m]));

/** "0.5415" (US dollars per million tokens) to 541500 micro-dollars, read as text so no float is involved. */
export function microsFrom(input: string): number | null {
  const m = /^\s*(\d{1,5})(?:\.(\d{1,6}))?\s*$/.exec(input);
  if (!m) return null;
  return Number(m[1]) * 1_000_000 + Number((m[2] ?? '').padEnd(6, '0') || '0');
}

/** The credits some tokens cost at a price, rounded up to a whole credit. Whole numbers all the way through. */
export function creditsFor(tokens: { input: number; output: number }, price: ModelPrice): number {
  const pico = Math.max(0, Math.round(tokens.input)) * price.input + Math.max(0, Math.round(tokens.output)) * price.output;
  const rest = pico % PICO_PER_CREDIT;
  return (pico - rest) / PICO_PER_CREDIT + (rest > 0 ? 1 : 0);
}

export const PAID_PLANS = ['pro', 'pro_max', 'ultra'] as const;
export type PaidPlan = (typeof PAID_PLANS)[number];
export type PlanKey = PaidPlan | 'none';
export const isPaidPlan = (v: unknown): v is PaidPlan => (PAID_PLANS as readonly unknown[]).includes(v);

export interface Plan {
  key: PaidPlan;
  name: string;
  /** What it costs, in paise (INR) a period. */
  priceCents: number;
  /** Credits for each period. They do not carry over. */
  credits: number;
  blurb: string;
}
/** A plan runs this many days, then ends unless it is renewed. */
export const PLAN_DAYS = 30;
/** Plans, top-ups and the live call are priced and charged in rupees (India first; the founder set the prices, 2026-11-03). */
export const PLAN_CURRENCY = 'INR';
/** The live strategy call, in paise: Rs 10,000. */
export const LIVE_CALL_CENTS = 1_000_000;
/** About what one assistant message costs, to say how far credits go. A guess, and said as one. */
export const TYPICAL_MESSAGE_CREDITS = 12;
export const messagesFor = (credits: number): number => Math.floor(Math.max(0, credits) / TYPICAL_MESSAGE_CREDITS);
/** "10,000 credits a month, about 833 messages." Built from the credits, so the line never drifts from the plan. */
const planBlurb = (credits: number): string =>
  `${credits.toLocaleString('en-IN')} credits a month, about ${messagesFor(credits).toLocaleString('en-IN')} messages.`;
/** The only three plans, priced in paise. Each gives a fixed number of credits a month. */
export const PLANS: Readonly<Record<PaidPlan, Plan>> = {
  pro: { key: 'pro', name: 'Pro', priceCents: 149_900, credits: 10_000, blurb: planBlurb(10_000) },
  pro_max: { key: 'pro_max', name: 'Pro Max', priceCents: 1_249_900, credits: 100_000, blurb: planBlurb(100_000) },
  ultra: { key: 'ultra', name: 'Ultra', priceCents: 4_999_900, credits: 400_000, blurb: planBlurb(400_000) },
};
/** "₹1,499 for 30 days": a plan's price the way every screen says it. */
export const planPriceLabel = (key: PaidPlan): string => `${money(PLANS[key].priceCents, PLAN_CURRENCY)} for ${PLAN_DAYS} days`;
export const planName = (key: string): string => (isPaidPlan(key) ? PLANS[key].name : 'No plan');

export interface TopUpPack {
  key: string;
  priceCents: number;
  credits: number;
}
/** Extra credits on top of a plan. They stay until used. */
export const TOPUP_PACKS: readonly TopUpPack[] = [
  { key: 'small', priceCents: 89_900, credits: 8_000 },
  { key: 'medium', priceCents: 229_900, credits: 20_000 },
  { key: 'large', priceCents: 449_900, credits: 40_000 },
];
/** True once a payment provider takes money for plans and top-ups. Until then the team switches plans on. */
export const PAYMENTS_LIVE = false;
/** The most credits the team can grant in one go. */
export const MAX_CREDIT_GRANT = 1_000_000;

/** The agents that spend credits. More join this list as they move onto a model. */
export const AGENTS = ['assistant', 'feelings', 'companion'] as const;
export type AgentKey = (typeof AGENTS)[number];
export const AGENT_META: Readonly<Record<AgentKey, { name: string; blurb: string }>> = {
  assistant: { name: 'Assistant', blurb: 'Does things in the app when you type what you want.' },
  feelings: { name: 'Feelings reader', blurb: 'Reads your own words in the strategy session and suggests levels on the map. Only a model that keeps nothing.' },
  companion: { name: 'Companion', blurb: 'Talks about how you are doing. Your mood and sleep reach only a model that keeps nothing.' },
};
export interface AgentLimit {
  /** How much the agent reads per message, in tokens: its own rules, its tools, the chat so far and what it looks up. */
  contextTokens: number;
  /** The most one message may spend, in credits. */
  perMessage: number;
  /** The most the agent may spend in any 24 hours, in credits. */
  perDay: number;
  /** How many rounds of tools one message may take. */
  steps: number;
}
/** Each plan's limits, per agent. One place to change them. */
export const AGENT_LIMITS: Readonly<Record<PaidPlan, Record<AgentKey, AgentLimit>>> = {
  // The Companion is a short chat with a few read tools: smaller than the assistant.
  // The feelings reader reads one short line and answers with numbers: one step, a small context, a few credits.
  pro: { assistant: { contextTokens: 16_000, perMessage: 60, perDay: 1_000, steps: 6 }, feelings: { contextTokens: 2_000, perMessage: 10, perDay: 200, steps: 1 }, companion: { contextTokens: 8_000, perMessage: 20, perDay: 400, steps: 3 } },
  pro_max: { assistant: { contextTokens: 64_000, perMessage: 250, perDay: 8_000, steps: 10 }, feelings: { contextTokens: 3_000, perMessage: 20, perDay: 800, steps: 1 }, companion: { contextTokens: 16_000, perMessage: 60, perDay: 2_000, steps: 4 } },
  ultra: { assistant: { contextTokens: 128_000, perMessage: 600, perDay: 30_000, steps: 12 }, feelings: { contextTokens: 4_000, perMessage: 40, perDay: 2_000, steps: 1 }, companion: { contextTokens: 32_000, perMessage: 120, perDay: 6_000, steps: 4 } },
};

/** Plan credits are spent first, then the extra ones. Never more than there is. */
export function spendSplit(cost: number, plan: number, extra: number): { plan: number; extra: number } {
  const want = Math.max(0, Math.round(cost));
  const fromPlan = Math.min(want, Math.max(0, plan));
  return { plan: fromPlan, extra: Math.min(want - fromPlan, Math.max(0, extra)) };
}

export interface CreditAccount {
  plan: PlanKey;
  planName: string;
  planUntil: string | null;
  planCredits: number;
  extraCredits: number;
  total: number;
  /** The plan's limits per agent, or null without a plan. */
  limits: Record<AgentKey, AgentLimit> | null;
  /** Credits each agent spent in the last 24 hours. */
  usedToday: Record<AgentKey, number>;
}
export type CreditReason = 'plan' | 'topup' | 'admin' | 'usage' | 'expire';
export interface CreditEntry {
  id: string;
  bucket: 'plan' | 'extra';
  amount: number;
  reason: CreditReason;
  agent: AgentKey | null;
  note: string;
  tokens: { input: number; output: number } | null;
  createdAt: string;
}
export interface CreditsResponse {
  account: CreditAccount;
  /** Credits used per day over the last thirty days, oldest first. */
  usage: { date: string; credits: number }[];
  plans: Plan[];
  topUps: readonly TopUpPack[];
  paymentsLive: boolean;
}

/** One line of the chat, as the client keeps it. `note` is what the assistant did that turn, for its memory. */
export interface AssistantTurn {
  role: 'user' | 'assistant';
  text: string;
  note?: string;
  /** The client's own record of the receipts a reply made, so the note it sends says what is true now (after an Undo). */
  actions?: string[];
}
export interface AssistantContext {
  /** The screen the person is on. */
  path: string;
  /** The person's own date and zone; the model never picks "today". */
  date: string;
  timeZone: string;
}
export type AssistantActionStatus = 'done' | 'failed' | 'pending' | 'undone' | 'cancelled';
/** One thing the assistant did, or waits to do until the person confirms. */
export interface AssistantReceipt {
  id: string;
  tool: string;
  label: string;
  status: AssistantActionStatus;
  error: string;
  /** True when Undo can take it back. */
  undo: boolean;
  /** The query keys on screen that show this change. */
  refresh: string[];
}
export interface AssistantCall {
  tool: string;
  args: Record<string, unknown>;
  ok: boolean;
  error?: string;
}
export interface AssistantReply {
  text: string;
  /** The model that answered. */
  model: string;
  receipts: AssistantReceipt[];
  note: string;
  calls: AssistantCall[];
  credits: { spent: number; left: number };
  /** Why it stopped early, when it did: the message's cap, the credits ran out, the step cap, or the person tapped Stop. */
  stopped: 'limit' | 'credits' | 'steps' | 'user' | null;
  /** The model failed after some tools ran; the text says so, and the receipts show what did happen. */
  failed?: boolean;
}
export interface AssistantStatus {
  /** A model is set up on the server. */
  connected: boolean;
  /** The server's default model, used when none is picked. */
  model: string | null;
  /** The models that can be picked in the panel. */
  models: readonly AssistantModel[];
  account: CreditAccount;
}
/** Why typing is refused: no plan, no credits left, or the day's cap reached. */
export type AssistantPaywall = 'plan' | 'credits' | 'day';
