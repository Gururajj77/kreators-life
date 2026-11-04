import type { AssistantModel, CreditAccount } from './assistant.ts';
import type { ChatMessage } from './community.ts';

/**
 * The Companion: a short chat about how the person is doing. With a plan it answers through the assistant's model
 * layer (agent `companion`, the one ledger); without one, Workers AI or the rules answer, free, as before.
 */

/**
 * Words that mean someone may be in danger. Checked on what the person wrote BEFORE anything else (no model call, no
 * ledger row), and again on a model's reply. The stems take any ending, so "suicide" and "suicidal" both match.
 */
export const CRISIS_RE = /\b(suicid\w*|kill(ing)? myself|end it all|self[- ]harm\w*|want to die|end my life|hurt(ing)? myself|take my (own )?life)\b/i;

/** What the Companion says when CRISIS_RE matches. It never goes through a model. */
export const CRISIS_LINE =
  'I am really glad you told me, and I want you to talk to a person right now. If you are in immediate danger, call your local emergency number. In India you can call Tele-MANAS on 14416 at any hour. I will still be here after.';

/** The free answers: Workers AI on our own host, or the rules. */
export type CompanionBuiltIn = 'workers-ai' | 'local';

export interface CompanionStatus {
  messages: ChatMessage[];
  /** What answers without a plan. */
  builtIn: CompanionBuiltIn;
  /** A model is set up on the server (the assistant's). */
  connected: boolean;
  /** The server's default model. */
  model: string | null;
  /** The models that can be picked, the assistant's list. */
  models: readonly AssistantModel[];
  account: CreditAccount;
}

export interface CompanionReply {
  /** The person's line, then the reply. */
  messages: ChatMessage[];
  /** Who answered: a model id, 'workers-ai', 'local' or 'crisis'. */
  model: string;
  /** What a model message cost, when one ran. */
  credits?: { spent: number; left: number };
  stopped: 'user' | 'limit' | 'credits' | 'steps' | null;
  /** The model broke partway; what it used is still charged. */
  failed?: boolean;
  /**
   * Why the built-in companion answered instead of the model: no plan (the normal free state, not shown), credits run
   * out, the day's cap used, or the model failed before it said anything.
   */
  fallback?: 'plan' | 'credits' | 'day' | 'error';
}
