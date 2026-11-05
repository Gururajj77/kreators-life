import { INDIAN_STATES, money, pinCodeProblem, formatCount, type KycProfile } from '@kreators/shared';
import { longDate } from '../lib/date';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { Button } from '../components/Button';
import { AppCover } from '../components/AppCover';
import { Screen } from '../components/Screen';
import { Sheet } from '../components/Sheet';
import { api, downloadCsv as fetchCsv, errorText, publicApi } from '../lib/api';
import { useAuthed, useRefreshAll } from '../lib/queries';
import { Pager, usePage } from '../components/Pager';
import { FIELD } from '../lib/ui';
import { StatusTag } from '../components/StatusTag';


function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-tile bg-card p-sm shadow-toy-soft">
      <p className="m-0 text-title2 type-figure leading-none">{typeof value === 'number' ? formatCount(value) : value}</p>
      <p className="mt-xs m-0 text-caption text-ink-soft">{label}</p>
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
  const po = usePage('po');
  const payouts = useAuthed(['payouts', po.query], () => api.payouts(po.query));
  const kyc = useAuthed(['kyc'], api.kyc);
  const config = useQuery({ queryKey: ['payments-config'], queryFn: publicApi.config, staleTime: 60_000 });
  const refresh = useRefreshAll();
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
      await fetchCsv(api.customersCsvUrl, 'customers.csv');
    } catch (e) {
      setCsvError(errorText(e, 'Could not download.'));
    }
  };

  const p = payouts.data;
  const live = config.data?.mode === 'razorpay';

  return (
    <Screen>
      <AppCover back={{ to: '/shop', label: 'Shop' }} title="Customers" lede="Everyone who bought from you, and what lands in your balance after fees." />

      <section className="mt-md" aria-labelledby="cust-heading">
        <div className="flex items-center justify-between gap-sm">
          <h2 id="cust-heading" className="text-title2">
            People
          </h2>
          <Button variant="outline" onClick={() => void downloadCsv()} disabled={!customers.data || customers.data.customers.length === 0}>
            Download CSV
          </Button>
        </div>
        {csvError && (
          <p role="alert" className="mt-sm m-0 rounded-tile bg-r1/15 p-sm text-subhead">
            {csvError}
          </p>
        )}
        {customers.data && customers.data.customers.length === 0 && <p className="mt-sm m-0 text-subhead text-ink-soft">No buyers yet. They appear here after someone buys one of your products.</p>}
        <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
          {customers.data?.customers.map((c) => (
            <li key={c.userId} className="rounded-tile bg-card p-sm shadow-toy-soft">
              <p className="m-0 text-headline">
                {c.handle ? (
                  <Link to={`/u/${c.handle}`} className="underline underline-offset-4">
                    {c.name}
                  </Link>
                ) : (
                  c.name
                )}
                {c.email && <span className="text-ink-soft"> {c.email}</span>}
              </p>
              <p className="m-0 text-subhead text-ink-soft">
                {formatCount(c.orders)} {c.orders === 1 ? 'order' : 'orders'}, {formatCount(c.points)} points{c.cents > 0 ? `, ${money(c.cents)}${live ? '' : ' test'}` : ''}. First {longDate(c.firstAt)}, last {longDate(c.lastAt)}. Came from {c.source}.
              </p>
            </li>
          ))}
        </ul>
        <Pager page={customers.data?.page} label="customers" />
      </section>

      <section className="mt-lg" aria-labelledby="pay-heading">
        <h2 id="pay-heading" className="text-title2">
          Payouts
        </h2>
        <p className="mt-xs m-0 text-subhead text-ink-soft">
          Payments: <StatusTag tone={live ? 'good' : 'warn'}>{live ? 'live' : 'test mode'}</StatusTag>. Points move the moment someone buys.{' '}
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
            <Stat label={live ? 'money' : 'test money'} value={money(p.testCents)} />
          </div>
        )}
        {p && p.rows.length === 0 && <p className="mt-sm m-0 text-subhead text-ink-soft">No sales yet. Each sale is listed here with its fee.</p>}
        <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
          {p?.rows.map((r) => (
            <li key={r.orderId} className="rounded-tile bg-card p-sm shadow-toy-soft">
              <p className="m-0 text-headline">
                {r.buyerName}, {r.productTitle}
              </p>
              <p className="m-0 text-subhead text-ink-soft">
                {formatCount(r.points)} points, fee {formatCount(r.fee)}, affiliate {formatCount(r.affiliate)}, net {formatCount(r.net)}. {r.status}, {longDate(r.createdAt)}.
              </p>
              {r.status !== 'refunded' && r.status !== 'pending' && r.status !== 'failed' && r.status !== 'expired' && (
                <Button variant="ghost" className="mt-xs" onClick={() => setRefunding({ id: r.orderId, title: r.productTitle })}>
                  Refund
                </Button>
              )}
            </li>
          ))}
        </ul>
        <Pager page={p?.page} prefix="po" label="sales" />
      </section>

      <Sheet open={refunding !== null} onClose={() => setRefunding(null)} title="Refund in full">
        <form
          className="flex flex-col gap-md"
          onSubmit={(e) => {
            e.preventDefault();
            refund.mutate();
          }}
        >
          <p className="m-0 text-subhead text-ink-soft">
            {refunding?.title}: the buyer gets every point back, your share and any affiliate share come back out, and any booking or open question is cancelled. Money goes back through the provider.
          </p>
          <label className="block">
            <span className="block text-subhead">Reason, shown to no one but you</span>
            <input autoFocus value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} className={FIELD} />
          </label>
          {refund.isError && (
            <p role="alert" className="m-0 rounded-tile bg-r1/15 p-sm text-subhead">
              {errorText(refund.error, 'Could not refund.')}
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
  const [line, setLine] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pin, setPin] = useState('');
  const pinWrong = pin.length > 0 ? pinCodeProblem(pin) : null;
  // One address line for the server, "street, city, State PIN", so the stored column stays as it was.
  const address = [line.trim(), city.trim(), [state, pin.trim()].filter(Boolean).join(' ')].filter(Boolean).join(', ');
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
        <h3 id="kyc-heading" className="text-headline">
          Payout details
        </h3>
        <span className={`rounded-pill px-xs text-caption font-medium leading-[20px] ${pill.cls}`}>{pill.label}</span>
      </div>
      {kyc && status !== 'none' && (
        <p className="mt-xs m-0 text-subhead text-ink-soft">
          {kyc.legalName}, PAN ending {kyc.panLast4}, account ending {kyc.bankLast4}, {kyc.ifsc}.{kyc.submittedAt ? ` Sent ${longDate(kyc.submittedAt)}.` : ''}
          {kyc.note ? ` Note from the team: ${kyc.note}` : ''}
        </p>
      )}
      <p className="mt-xs m-0 text-caption text-ink-soft">Payouts in money need these approved by the team. We keep only the last four digits of your PAN and account; card details never come to us.</p>
      {open && (
        <form
          className="mt-sm flex flex-col gap-md"
          onSubmit={(e) => {
            e.preventDefault();
            submit.mutate();
          }}
        >
          <label className="block">
            <span className="block text-subhead">Legal name, as on your PAN</span>
            <input value={legalName} onChange={(e) => setLegalName(e.target.value)} required maxLength={120} className={FIELD} />
          </label>
          <div className="grid grid-cols-2 gap-xs">
            <label className="block">
              <span className="block text-subhead font-semibold">PAN</span>
              <input value={pan} onChange={(e) => setPan(e.target.value.toUpperCase())} required maxLength={10} placeholder="ABCDE1234F" className={FIELD} />
            </label>
            <label className="block">
              <span className="block text-subhead font-semibold">IFSC</span>
              <input value={ifsc} onChange={(e) => setIfsc(e.target.value.toUpperCase())} required maxLength={11} placeholder="HDFC0001234" className={FIELD} />
            </label>
          </div>
          <label className="block">
            <span className="block text-subhead font-semibold">Bank account number</span>
            <input value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} required maxLength={34} inputMode="numeric" className={FIELD} />
          </label>
          <label className="block">
            <span className="block text-subhead font-semibold">Address</span>
            <input value={line} onChange={(e) => setLine(e.target.value)} required maxLength={200} placeholder="Flat, building, street" autoComplete="street-address" className={FIELD} />
          </label>
          <div className="grid grid-cols-1 gap-xs sm:grid-cols-3">
            <label className="block">
              <span className="block text-subhead font-semibold">City</span>
              <input value={city} onChange={(e) => setCity(e.target.value)} required maxLength={60} autoComplete="address-level2" className={FIELD} />
            </label>
            <label className="block">
              <span className="block text-subhead font-semibold">State</span>
              <select value={state} onChange={(e) => setState(e.target.value)} required autoComplete="address-level1" className={FIELD}>
                <option value="">Pick one</option>
                {INDIAN_STATES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block text-subhead font-semibold">PIN code</span>
              <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} required inputMode="numeric" maxLength={6} placeholder="560038" autoComplete="postal-code" aria-invalid={pinWrong ? true : undefined} className={FIELD} />
              {pinWrong && <span className="mt-xs block text-caption text-ink-soft">{pinWrong}</span>}
            </label>
          </div>
          {submit.isError && (
            <p role="alert" className="m-0 rounded-tile bg-r1/15 p-sm text-subhead">
              {errorText(submit.error, 'Could not send that.')}
            </p>
          )}
          <Button type="submit" disabled={submit.isPending || Boolean(pinWrong)}>
            {status === 'rejected' ? 'Send again' : 'Send for review'}
          </Button>
        </form>
      )}
    </section>
  );
}
