/**
 * Outbound HTTP with a clock on it.
 *
 * A Worker that waits on a slow partner holds the person's tap for as long as the partner takes. Every call out of the API
 * goes through `fetchT` with one of the named timeouts below, so a stuck provider ends in a short, plain error instead of a
 * hang. `fetchT` never retries: a payment or a send must not run twice because a clock ran out.
 */

/** Milliseconds, by what the call is for. Change a number here and nowhere else. */
export const TIMEOUT = {
  /** A single lookup a person is not waiting long for: a metric, a mail send, a webhook reply. */
  quick: 5_000,
  /** The payment provider: creating an order, asking for a refund. Never retried. */
  payments: 15_000,
  /** Reading a page or a partner's search for the content strategist. */
  research: 15_000,
  /** One model call for the assistant (the person can also press Stop). */
  assistant: 60_000,
  /** A long piece written by a model for the content strategist. */
  strategist: 90_000,
  /** One run of the Agent Reach bridge (a search, outliers, a transcript): it drives other sites, so it is the slowest. */
  reach: 120_000,
} as const;

type TimeoutName = keyof typeof TIMEOUT;

/** True when an error is a clock running out (or a caller's abort), however the runtime spells it. */
export function isTimeout(e: unknown): boolean {
  const name = (e as { name?: string } | null)?.name;
  return name === 'TimeoutError' || name === 'AbortError';
}

/**
 * `fetch` that gives up after `ms`. A signal already in `init` is kept: whichever ends first wins (AbortSignal.any where the
 * runtime has it; otherwise the caller's own signal is used and the timer is raced by hand).
 */
export function fetchT(url: string | URL | Request, init: RequestInit | undefined, ms: number): Promise<Response> {
  const timer = AbortSignal.timeout(ms);
  const own = init?.signal as AbortSignal | undefined | null;
  const any = (AbortSignal as unknown as { any?: (signals: AbortSignal[]) => AbortSignal }).any;
  const signal = own ? (typeof any === 'function' ? any([own, timer]) : own) : timer;
  return fetch(url, { ...init, signal } as RequestInit);
}

/** Race any promise (a binding call that takes no signal, such as Workers AI) against a clock. The work is not cancelled, only no longer waited for. */
export function withTimeout<T>(work: Promise<T>, ms: number, what = 'The request'): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const clock = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(Object.assign(new Error(`${what} took too long.`), { name: 'TimeoutError' })), ms);
  });
  return Promise.race([work, clock]).finally(() => clearTimeout(timer));
}
