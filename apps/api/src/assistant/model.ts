import { ASSISTANT_MODEL_BY_ID, ASSISTANT_MODELS, microsFrom, priceOf, type ModelPrice } from '@kreators/shared';
import type { Env } from '../env';

/**
 * The assistant's model, provider neutral: any endpoint that speaks the OpenAI chat completions shape with tools.
 * OpenRouter by default, which reaches many models through one API, so swapping models is one setting, or a pick in
 * the panel from ASSISTANT_MODELS. A model with a zero-retention host is asked to keep nothing and may read the
 * journal and the trackers; one without (most free models) is sent without that ask, and never offered those reads.
 */

export const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';
export const DEFAULT_MODEL = ASSISTANT_MODELS[0]!.id;
/** The most one model call may write. Reasoning is asked to be off, so this is the answer alone. */
export const MAX_OUT = 1024;
/** For a model whose reasoning cannot be switched off: its thinking and the answer share this. Only free models are like this today. */
export const MAX_OUT_THINKING = 8192;

export interface ModelConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  price: ModelPrice;
  openRouter: boolean;
  /** OpenRouter is asked for zero-retention providers only. */
  zdr: boolean;
  /** Nothing sent is kept: the journal and the trackers may be read. */
  private: boolean;
  /** Its reasoning cannot be switched off (ASSISTANT_MODELS says so). */
  thinks: boolean;
}

/**
 * The model for one message: the one picked in the panel when the server offers it, else ASSISTANT_MODEL, else the
 * first of ASSISTANT_MODELS. A model from the list is private only when OpenRouter lists a zero-retention host for
 * it; any other model on OpenRouter is asked for zero retention (unless ASSISTANT_ZDR is "off"), and a provider of
 * the deployment's own choosing is trusted as set up.
 */
export function modelOf(env: Env, picked?: unknown): ModelConfig | null {
  if (!env.ASSISTANT_API_KEY) return null;
  const baseUrl = (env.ASSISTANT_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
  const fallback = env.ASSISTANT_MODEL || DEFAULT_MODEL;
  const model = typeof picked === 'string' && ASSISTANT_MODEL_BY_ID[picked] ? picked : fallback;
  const inPrice = microsFrom(env.ASSISTANT_PRICE_IN ?? '');
  const outPrice = microsFrom(env.ASSISTANT_PRICE_OUT ?? '');
  const price = model === fallback && inPrice !== null && outPrice !== null ? { input: inPrice, output: outPrice } : priceOf(model);
  const openRouter = /(^|\.)openrouter\.ai\//.test(baseUrl.replace(/^https?:\/\//, ''));
  const listed = ASSISTANT_MODEL_BY_ID[model];
  const zdr = openRouter && (listed ? listed.private : env.ASSISTANT_ZDR !== 'off');
  return { baseUrl, apiKey: env.ASSISTANT_API_KEY, model, price, openRouter, zdr, private: openRouter ? zdr : true, thinks: Boolean(listed?.thinks) };
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}
export type Message =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: ToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string };
export interface ToolSpec {
  type: 'function';
  function: { name: string; description: string; parameters: unknown };
}

export class ModelError extends Error {}

/** Rough tokens in a text: about three characters a token, on the high side, so budgets hold. */
export const tokensOf = (text: string) => Math.ceil(text.length / 3);
export const tokensOfMessages = (messages: Message[]) => messages.reduce((n, m) => n + 4 + tokensOf(m.content ?? '') + ('tool_calls' in m && m.tool_calls ? tokensOf(JSON.stringify(m.tool_calls)) : 0), 0);

interface Completion {
  choices?: { finish_reason?: string | null; error?: { message?: string }; message?: { content?: string | { type?: string; text?: string }[] | null; tool_calls?: ToolCall[] } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  error?: { message?: string };
}

/** Some hosts send the reply as a list of parts; the text parts are the reply. */
const textOf = (content: unknown): string =>
  typeof content === 'string' ? content : Array.isArray(content) ? content.map((p) => (p && typeof p === 'object' && typeof (p as { text?: unknown }).text === 'string' ? (p as { text: string }).text : '')).join('') : '';

/** One model call. The tokens come from the provider; when it does not say, they are estimated, never zero. */
export async function chat(cfg: ModelConfig, messages: Message[], tools: ToolSpec[]): Promise<{ content: string; toolCalls: ToolCall[]; usage: { input: number; output: number } }> {
  const body = {
    model: cfg.model,
    messages,
    // tool_choice is left out: "auto" is the default, and some models (Flint, Inkling) do not take it.
    ...(tools.length ? { tools } : {}),
    // No temperature: some models take only their own (Kimi K2.6), and each host's default is the model's own.
    // Reasoning shares max_tokens with the answer, so it is asked to be off: a model that thinks first can spend the
    // whole budget thinking and come back empty. A model whose reasoning cannot be switched off gets more room.
    max_tokens: cfg.thinks ? MAX_OUT_THINKING : MAX_OUT,
    ...(cfg.openRouter && !cfg.thinks ? { reasoning: { effort: 'none' } } : {}),
    // A private model is held to hosts that keep nothing. Free models keep data, so asking would find no host at all.
    ...(cfg.openRouter && cfg.zdr ? { provider: { data_collection: 'deny', zdr: true } } : {}),
  };
  let res: Response;
  try {
    res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.apiKey}`, 'Content-Type': 'application/json', ...(cfg.openRouter ? { 'HTTP-Referer': 'https://kreators.app', 'X-Title': 'kreators.app' } : {}) },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });
  } catch {
    throw new ModelError('Could not reach the model. Try again in a moment.');
  }
  const json = (await res.json().catch(() => null)) as Completion | null;
  const choice = json?.choices?.[0];
  const message = choice?.message;
  if (!res.ok || !message) {
    const said = json?.error?.message;
    console.error('assistant model error', res.status, cfg.model, said ?? '');
    throw new ModelError(said ? `The model could not answer: ${said.slice(0, 200)}` : `The model could not answer (${res.status}).`);
  }
  const content = textOf(message.content).trim();
  const toolCalls = (message.tool_calls ?? []).filter((t) => t?.type === 'function' && typeof t.function?.name === 'string');
  // A reply that stopped on an error, or ran out of room before it said anything, is not an answer.
  if (choice?.finish_reason === 'error') {
    console.error('assistant model stopped on an error', cfg.model, choice.error?.message ?? '');
    throw new ModelError(`The model stopped partway${choice.error?.message ? `: ${choice.error.message.slice(0, 200)}` : '.'} Try again, or pick another model.`);
  }
  if (choice?.finish_reason === 'length' && !content && !toolCalls.length) throw new ModelError('The model ran out of room before it answered. Try again, or pick another model.');
  return {
    content,
    toolCalls,
    usage: {
      input: json?.usage?.prompt_tokens || tokensOfMessages(messages) + tokensOf(JSON.stringify(tools)),
      output: json?.usage?.completion_tokens || tokensOf(content) + tokensOf(JSON.stringify(toolCalls)),
    },
  };
}
