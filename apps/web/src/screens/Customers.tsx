import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { Sheet } from '../components/Sheet';
import { api } from '../lib/api';
import { useAuthed, useRefreshAll } from '../lib/queries';
import { useSession } from '../lib/store';

const err = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-tile bg-card p-sm shadow-toy-soft">
      <p className="m-0 font-display text-[24px] font-extrabold leading-none">{value}</p>
      <p className="mt-xs m-0 text-[12px] font-bold text-ink-soft">{label}</p>
    </div>
  );
}

export function Customers() {
  const customers = useAuthed(['customers'], api.customers);
  const payouts = useAuthed(['payouts'], api.payouts);
  const refresh = useRefreshAll();
  const token = useSession((s) => s.token);
  const [refunding, setRefunding] = useState<{ id: string; title: string } | null>(null);
  const [reason, setReason] = useState('');
  const [csvError, setCsvError] = useState<string | null>(null);
  const refund = useMutation({
    mutationFn: () => api.refund(refunding!.id, reason),
    onSuccess: () => {
      setRefunding(null);
      setReason('');
      void Promise.all([payouts.refetch(), customers.refetch()]);
      refresh();
    },
  });

  const downloadCsv = async () => {
    setCsvError(null);
    try {
      const res = await fetch(api.customersCsvUrl, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) throw new Error('Could not build the file.');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'customers.csv';
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e) {
      setCsvError(err(e, 'Could not download.'));
    }
  };

  const p = payouts.data;

  return (
    <Screen>
      <header className="pt-lg">
        <Link to="/shop" className="inline-flex min-h-[44px] items-center gap-xs font-bold text-ink-soft">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 5l-7 7 7 7" />
          </svg>
          Shop
        </Link>
        <h1 className="text-[30px]">Customers</h1>
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Everyone who bought from you, and what lands in your balance after fees.</p>
      </header>

      <section className="mt-md" aria-labelledby="cust-heading">
        <div className="flex items-center justify-between gap-sm">
          <h2 id="cust-heading" className="text-[24px]">
            People
          </h2>
          <Button variant="outline" onClick={() => void downloadCsv()} disabled={!customers.data || customers.data.customers.length === 0}>
            Download CSV
          </Button>
        </div>
        {csvError && (
          <p role="alert" className="mt-sm m-0 rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
            {csvError}
          </p>
        )}
        {customers.data && customers.data.customers.length === 0 && <p className="mt-sm m-0 text-[14px] font-semibold text-ink-soft">No buyers yet.</p>}
        <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
          {customers.data?.customers.map((c) => (
            <li key={c.userId} className="rounded-tile bg-card p-sm shadow-toy-soft">
              <p className="m-0 text-[16px] font-bold">
                {c.handle ? (
                  <Link to={`/u/${c.handle}`} className="underline underline-offset-4">
                    {c.name}
                  </Link>
                ) : (
                  c.name
                )}
                {c.email && <span className="font-semibold text-ink-soft"> {c.email}</span>}
              </p>
              <p className="m-0 text-[14px] font-semibold text-ink-soft">
                {c.orders} {c.orders === 1 ? 'order' : 'orders'}, {c.points} points{c.cents > 0 ? `, ${(c.cents / 100).toFixed(2)} test` : ''}. First {new Date(c.firstAt).toLocaleDateString()}, last {new Date(c.lastAt).toLocaleDateString()}. Came from {c.source}.
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-lg" aria-labelledby="pay-heading">
        <h2 id="pay-heading" className="text-[24px]">
          Payouts
        </h2>
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">
          Points move the moment someone buys. Money stays in test mode until a payment provider is connected. The platform keeps {p ? (p.feeBps / 100).toFixed(p.feeBps % 100 === 0 ? 0 : 2) : '…'}% of each sale.
        </p>
        {p && (
          <div className="mt-sm grid grid-cols-3 gap-xs">
            <Stat label="gross points" value={p.grossPoints} />
            <Stat label="platform fee" value={p.feePoints} />
            <Stat label="affiliate share" value={p.affiliatePoints} />
            <Stat label="net to you" value={p.netPoints} />
            <Stat label="refunded" value={p.refundedPoints} />
            <Stat label="test money" value={(p.testCents / 100).toFixed(2)} />
          </div>
        )}
        {p && p.rows.length === 0 && <p className="mt-sm m-0 text-[14px] font-semibold text-ink-soft">No sales yet.</p>}
        <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
          {p?.rows.map((r) => (
            <li key={r.orderId} className="rounded-tile bg-card p-sm shadow-toy-soft">
              <p className="m-0 text-[16px] font-bold">
                {r.buyerName}, {r.productTitle}
              </p>
              <p className="m-0 text-[14px] font-semibold text-ink-soft">
                {r.points} points, fee {r.fee}, affiliate {r.affiliate}, net {r.net}. {r.status}, {new Date(r.createdAt).toLocaleDateString()}.
              </p>
              {r.status !== 'refunded' && (
                <Button variant="ghost" className="mt-xs" onClick={() => setRefunding({ id: r.orderId, title: r.productTitle })}>
                  Refund
                </Button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <Sheet open={refunding !== null} onClose={() => setRefunding(null)} title="Refund in full">
        <form
          className="flex flex-col gap-md"
          onSubmit={(e) => {
            e.preventDefault();
            refund.mutate();
          }}
        >
          <p className="m-0 text-[14px] font-semibold text-ink-soft">
            {refunding?.title}: the buyer gets every point back, your share and any affiliate share come back out, and any booking or open question is cancelled.
          </p>
          <label className="block">
            <span className="block text-[14px] font-bold">Reason, shown to no one but you</span>
            <input autoFocus value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} className="mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]" />
          </label>
          {refund.isError && (
            <p role="alert" className="m-0 rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
              {err(refund.error, 'Could not refund.')}
            </p>
          )}
          <Button type="submit" size="lg" full disabled={refund.isPending}>
            Refund now
          </Button>
        </form>
      </Sheet>
    </Screen>
  );
}
