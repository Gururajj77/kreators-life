import { LIVE_CALL_CENTS, money, PLAN_CURRENCY, type LiveCallAnswer, type LiveCallRequest } from '@kreators/shared';
import { useState } from 'react';
import { api } from '../lib/api';
import { useAuthed } from '../lib/queries';
import { loadRazorpay } from '../lib/razorpay';
import { Button } from './Button';
import { ErrorLine } from './ErrorLine';

/**
 * The live call with a coach, a paid service (POST /session/call, liveCall.ts). Asking keeps the ask and tells the team; the
 * payment window opens only when the server sent an order to pay, which it does only while payments are live. The browser
 * never marks it paid: the payment webhook does.
 */

/** Opens the payment window for an ask that carries an order. 'opened-paid' once Razorpay says it went through, 'closed' if the window was shut, 'none' with nothing to pay. */
export async function payForCall(a: LiveCallAnswer): Promise<'opened-paid' | 'closed' | 'none'> {
  const p = a.payment;
  if (!p || !p.keyId) return 'none';
  await loadRazorpay();
  if (!window.Razorpay) throw new Error('Could not load the payment window.');
  const Razorpay = window.Razorpay;
  return new Promise((resolve) => {
    new Razorpay({
      key: p.keyId!,
      amount: p.amountCents,
      currency: p.currency,
      order_id: p.providerOrderId,
      name: 'kreators.app',
      description: 'Live call with a coach',
      handler: () => resolve('opened-paid'),
      modal: { ondismiss: () => resolve('closed') },
    }).open();
  });
}

/** One plain line on where an ask stands. */
export function liveCallLine(r: LiveCallRequest): string {
  const price = money(r.amountCents, r.currency);
  if (r.status === 'paid') return `Paid ${price}. The team will write to you to set a time.`;
  if (r.status === 'booked') return 'Paid and booked. The team has written to you with the time.';
  if (r.status === 'paying') return `Waiting for the ${price} payment. If you paid, this updates in a moment.`;
  return `Asked for. Nothing was charged; the team will write to you to set a time and how to pay the ${price}.`;
}

/** The live call on the life map: where an ask stands, or a way to ask for one. */
export function LiveCallLine() {
  const q = useAuthed(['live-call'], api.liveCall);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const r = q.data?.request ?? null;
  const ask = async () => {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const a = await api.askLiveCall();
      const paid = await payForCall(a);
      setNote(paid === 'opened-paid' ? 'Thank you. The payment is being confirmed, and the team will write to you to set a time.' : paid === 'closed' ? 'The payment window closed, so nothing was charged. Tap again whenever you like.' : a.note);
      await q.refetch();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  if (q.isLoading) return null;
  return (
    <div className="mt-sm">
      <p className="m-0 text-subhead font-semibold">Live call with a coach</p>
      {r ? (
        <p className="m-0 text-subhead text-ink-soft">{note ?? liveCallLine(r)}</p>
      ) : (
        <>
          <p className="m-0 text-subhead text-ink-soft">{note ?? `A person goes through your answers with you, for ${money(LIVE_CALL_CENTS, PLAN_CURRENCY)}. The app works without it.`}</p>
          <Button type="button" variant="outline" className="mt-xs" disabled={busy} onClick={ask}>
            {busy ? 'Asking' : 'Ask for a live call'}
          </Button>
        </>
      )}
      {r?.status === 'paying' && !note && (
        <Button type="button" variant="outline" className="mt-xs" disabled={busy} onClick={ask}>
          {busy ? 'Opening' : 'Pay for the call'}
        </Button>
      )}
      <ErrorLine e={error} className="mt-xs" />
    </div>
  );
}
