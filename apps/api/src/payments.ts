import type { PaymentsConfig } from '@kreators/shared';
import type { Env } from './env';
import { fetchT, isTimeout, TIMEOUT } from './http';

/**
 * The payment provider sits behind this interface so Stripe or a creator's own keys can be added
 * without touching checkout. Without keys the test provider records orders and charges nothing.
 */
export interface PaymentProvider {
  name: 'test' | 'razorpay';
  createOrder(input: { amountCents: number; currency: string; receipt: string; notes?: Record<string, string> }): Promise<{ providerOrderId: string }>;
  verifyWebhook(rawBody: string, signature: string): Promise<boolean>;
  parseWebhook(json: unknown): { type: string; providerOrderId: string | null; providerPaymentId: string | null; amountCents: number | null; eventId: string | null };
  refund(providerPaymentId: string, amountCents: number): Promise<{ refundId: string }>;
}

/** HMAC-SHA256 of a body as hex: how a provider signs what it sends. */
export async function hmacHex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export class TestProvider implements PaymentProvider {
  name = 'test' as const;
  async createOrder(input: { receipt: string }) {
    return { providerOrderId: `test_${input.receipt}` };
  }
  async verifyWebhook() {
    return false;
  }
  parseWebhook() {
    return { type: 'ignored', providerOrderId: null, providerPaymentId: null, amountCents: null, eventId: null };
  }
  async refund(providerPaymentId: string) {
    return { refundId: `test_rf_${providerPaymentId}` };
  }
}

/** Razorpay over its REST API. Orders are created server-side; the browser opens Razorpay Checkout with the order id. */
export class RazorpayProvider implements PaymentProvider {
  name = 'razorpay' as const;
  constructor(private keyId: string, private keySecret: string, private webhookSecret: string) {}
  private get auth() {
    return `Basic ${btoa(`${this.keyId}:${this.keySecret}`)}`;
  }
  async createOrder(input: { amountCents: number; currency: string; receipt: string; notes?: Record<string, string> }) {
    // One try, never repeated: a second order for the same buy is worse than telling the person to tap again.
    try {
      const res = await fetchT('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: this.auth },
        body: JSON.stringify({ amount: input.amountCents, currency: input.currency, receipt: input.receipt.slice(0, 40), notes: input.notes ?? {} }),
      }, TIMEOUT.payments);
      if (!res.ok) throw new Error(`Razorpay refused the order (${res.status})`);
      const data = (await res.json()) as { id: string };
      return { providerOrderId: data.id };
    } catch (e) {
      if (isTimeout(e)) throw new Error('The payment provider took too long to answer. Nothing was charged; try again in a moment.');
      throw e;
    }
  }
  async verifyWebhook(rawBody: string, signature: string) {
    if (!this.webhookSecret || !signature) return false;
    const expected = await hmacHex(this.webhookSecret, rawBody);
    // Compared without stopping at the first different character, so the time it takes says nothing about the signature.
    if (expected.length !== signature.length) return false;
    let diff = 0;
    for (let i = 0; i < expected.length; i += 1) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
    return diff === 0;
  }
  parseWebhook(json: unknown) {
    const j = json as { event?: string; payload?: { payment?: { entity?: { id?: string; order_id?: string; amount?: number } }; refund?: { entity?: { payment_id?: string; amount?: number } } } };
    const p = j.payload?.payment?.entity;
    const r = j.payload?.refund?.entity;
    return { type: j.event ?? 'unknown', providerOrderId: p?.order_id ?? null, providerPaymentId: p?.id ?? r?.payment_id ?? null, amountCents: p?.amount ?? r?.amount ?? null, eventId: null };
  }
  async refund(providerPaymentId: string, amountCents: number) {
    // Never repeated here. If the clock runs out the refund may still have gone through, so the message says to check first.
    try {
      const res = await fetchT(`https://api.razorpay.com/v1/payments/${encodeURIComponent(providerPaymentId)}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: this.auth },
        body: JSON.stringify({ amount: amountCents }),
      }, TIMEOUT.payments);
      if (!res.ok) throw new Error(`Razorpay refused the refund (${res.status})`);
      const data = (await res.json()) as { id: string };
      return { refundId: data.id };
    } catch (e) {
      if (isTimeout(e)) throw new Error('The payment provider took too long to answer. The refund may still have gone through: check the Razorpay dashboard before trying again.');
      throw e;
    }
  }
}

export function providerFor(env: Env): PaymentProvider {
  if (env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET) return new RazorpayProvider(env.RAZORPAY_KEY_ID, env.RAZORPAY_KEY_SECRET, env.RAZORPAY_WEBHOOK_SECRET ?? '');
  return new TestProvider();
}

export function paymentsConfig(env: Env): PaymentsConfig {
  const live = Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);
  return { mode: live ? 'razorpay' : 'test', keyId: live ? (env.RAZORPAY_KEY_ID ?? null) : null, currency: 'INR' };
}
