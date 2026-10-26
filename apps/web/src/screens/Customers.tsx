import type { KycProfile } from '@kreators/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { Button } from '../components/Button';
import { BackLink } from '../components/PageHeader';
import { Screen } from '../components/Screen';
import { Sheet } from '../components/Sheet';
import { api, publicApi } from '../lib/api';
import { useAuthed, useRefreshAll } from '../lib/queries';
import { Pager, usePage } from '../components/Pager';
import { useSession } from '../lib/store';

const err = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);
const field = 'mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]';

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-tile bg-card p-sm shadow-toy-soft">
      <p className="m-0 font-display text-[24px] font-extrabold leading-none">{value}</p>
      <p className="mt-xs m-0 text-[12px] font-bold text-ink-soft">{label}</p>
    </div>
  );
}

const KYC_PILL: Record<KycProfile['status'], { label: string; cls: string }> = {
  none: { label: 'not given', cls: 'bg-paper text-ink-soft' },
  pending: { label: 'waiting for review', cls: 'bg-r3 text-ink-fixed' },
  approved: { label: 'approved', cls: 'bg-r4 text-on-fill' },
  rejected: { label: 'needs another look', cls: 'bg-r1 text-white' },
};

export function Customers() {
  const pg = usePage();
  const customers = useAuthed(['customers', pg.query], () => api.customers(pg.query));
  const payouts = useAuthed(['payouts'], api.payouts);
  const kyc = useAuthed(['kyc'], api.kyc);
  const config = useQuery({ queryKey: ['payments-config'], queryFn: publicApi.config, staleTime: 60_000 });
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
  const live = config.data?.mode === 'razorpay';

  return (
    <Screen>
      <header className="pt-lg">
        <BackLink to="/shop">Shop</BackLink>
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
                {c.orders} {c.orders === 1 ? 'order' : 'orders'}, {c.points} points{c.cents > 0 ? `, ${(c.cents / 100).toFixed(2)}${live ? '' : ' test'}` : ''}. First {new Date(c.firstAt).toLocaleDateString()}, last {new Date(c.lastAt).toLocaleDateString()}. Came from {c.source}.
              </p>
            </li>
          ))}
        </ul>
        <Pager page={customers.data?.page} label="customers" />
      </section>

      <section className="mt-lg" aria-labelledby="pay-heading">
        <h2 id="pay-heading" className="text-[24px]">
          Payouts
        </h2>
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">
          Payments: <span className={`rounded-pill px-xs text-[12px] font-extrabold leading-[20px] ${live ? 'bg-r4 text-on-fill' : 'bg-r3 text-ink-fixed'}`}>{live ? 'live' : 'test mode'}</span>. Points move the moment someone buys.{' '}
          {live ? 'Money is collected by the provider and paid out to the account below once it is approved.' : 'Money stays in test mode until a payment provider is connected.'} The platform keeps {p ? (p.feeBps / 100).toFixed(p.feeBps % 100 === 0 ? 0 : 2) : '…'}% of each sale.
        </p>

        <KycSection kyc={kyc.data?.kyc ?? null} onChange={() => void kyc.refetch()} />

        {p && (
          <div className="mt-md grid grid-cols-3 gap-xs">
            <Stat label="gross points" value={p.grossPoints} />
            <Stat label="platform fee" value={p.feePoints} />
            <Stat label="affiliate share" value={p.affiliatePoints} />
            <Stat label="net to you" value={p.netPoints} />
            <Stat label="refunded" value={p.refundedPoints} />
            <Stat label={live ? 'money' : 'test money'} value={(p.testCents / 100).toFixed(2)} />
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
              {r.status !== 'refunded' && r.status !== 'pending' && r.status !== 'failed' && r.status !== 'expired' && (
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
            {refunding?.title}: the buyer gets every point back, your share and any affiliate share come back out, and any booking or open question is cancelled. Money goes back through the provider.
          </p>
          <label className="block">
            <span className="block text-[14px] font-bold">Reason, shown to no one but you</span>
            <input autoFocus value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} className={field} />
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

/** Where money payouts go. Only the last digits are kept; the PAN is matched by hash. */
function KycSection({ kyc, onChange }: { kyc: KycProfile | null; onChange: () => void }) {
  const [legalName, setLegalName] = useState('');
  const [pan, setPan] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [address, setAddress] = useState('');
  const submit = useMutation({
    mutationFn: () => api.submitKyc({ legalName, pan, bankAccount, ifsc, address }),
    onSuccess: () => {
      setPan('');
      setBankAccount('');
      onChange();
    },
  });
  const status = kyc?.status ?? 'none';
  const pill = KYC_PILL[status];
  const open = status !== 'approved' && status !== 'pending';
  return (
    <section className="mt-md rounded-card bg-card p-md shadow-toy-soft" aria-labelledby="kyc-heading">
      <div className="flex flex-wrap items-center justify-between gap-xs">
        <h3 id="kyc-heading" className="text-[18px]">
          Payout details
        </h3>
        <span className={`rounded-pill px-xs text-[12px] font-extrabold leading-[20px] ${pill.cls}`}>{pill.label}</span>
      </div>
      {kyc && status !== 'none' && (
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">
          {kyc.legalName}, PAN ending {kyc.panLast4}, account ending {kyc.bankLast4}, {kyc.ifsc}.{kyc.submittedAt ? ` Sent ${new Date(kyc.submittedAt).toLocaleDateString()}.` : ''}
          {kyc.note ? ` Note from the team: ${kyc.note}` : ''}
        </p>
      )}
      <p className="mt-xs m-0 text-[12px] font-semibold text-ink-soft">Payouts in money need these approved by the team. We keep only the last four digits of your PAN and account; card details never come to us.</p>
      {open && (
        <form
          className="mt-sm flex flex-col gap-md"
          onSubmit={(e) => {
            e.preventDefault();
            submit.mutate();
          }}
        >
          <label className="block">
            <span className="block text-[14px] font-bold">Legal name, as on your PAN</span>
            <input value={legalName} onChange={(e) => setLegalName(e.target.value)} required maxLength={120} className={field} />
          </label>
          <div className="grid grid-cols-2 gap-xs">
            <label className="block">
              <span className="block text-[14px] font-bold">PAN</span>
              <input value={pan} onChange={(e) => setPan(e.target.value.toUpperCase())} required maxLength={10} placeholder="ABCDE1234F" className={field} />
            </label>
            <label className="block">
              <span className="block text-[14px] font-bold">IFSC</span>
              <input value={ifsc} onChange={(e) => setIfsc(e.target.value.toUpperCase())} required maxLength={11} placeholder="HDFC0001234" className={field} />
            </label>
          </div>
          <label className="block">
            <span className="block text-[14px] font-bold">Bank account number</span>
            <input value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} required maxLength={34} inputMode="numeric" className={field} />
          </label>
          <label className="block">
            <span className="block text-[14px] font-bold">Address</span>
            <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} maxLength={300} className={field} />
          </label>
          {submit.isError && (
            <p role="alert" className="m-0 rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
              {err(submit.error, 'Could not send that.')}
            </p>
          )}
          <Button type="submit" disabled={submit.isPending}>
            {status === 'rejected' ? 'Send again' : 'Send for review'}
          </Button>
        </form>
      )}
    </section>
  );
}
