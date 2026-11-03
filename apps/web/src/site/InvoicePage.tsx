import { INVOICE_STATUS_NAME, INVOICE_STATUS_TONE, amountInWords, invoiceAsText, invoiceTotals, money } from '@kreators/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useParams } from 'react-router';
import { Button } from '../components/Button';
import { DocActions } from '../components/DocActions';
import { Inert } from '../components/Inert';
import { Busy, Skeleton, SkeletonCard } from '../components/Skeleton';
import { InvoiceView, invoiceDate } from '../components/InvoiceView';
import { CopyTextButton, LinkTrouble } from '../components/PortalLock';
import { StatusTag } from '../components/StatusTag';
import { todayLocal } from '../lib/date';
import { publicApi, type PublicInvoice } from '../lib/api';
import { fileTitle } from '../lib/printDoc';
import { SiteLayout } from './SiteLayout';

/**
 * The few things a client opens an invoice for, first: how much, by when, and whether it is paid. The due day and the total in words
 * show only where the invoice's own switches allow (the server already took out what is off). An overdue one is said kindly.
 */
function InvoiceSummary({ invoice: inv, canWrite }: { invoice: PublicInvoice['invoice']; /** The note box is open to the client, so the overdue line can point at it. */ canWrite: boolean }) {
  const t = invoiceTotals(inv.items, inv.doc);
  const pay = t.tdsDeducted > 0 ? t.netReceivable : t.total;
  const overdue = inv.status === 'sent' && Boolean(inv.dueDate && inv.dueDate < todayLocal());
  const tone = overdue ? 'bad' : inv.status === 'sent' ? 'warn' : INVOICE_STATUS_TONE[inv.status];
  const word = overdue ? 'Overdue' : inv.status === 'sent' ? 'To pay' : INVOICE_STATUS_NAME[inv.status];
  return (
    <section className="no-print rounded-card bg-card p-md shadow-toy-soft" aria-labelledby="inv-sum">
      <div className="flex flex-wrap items-start justify-between gap-sm">
        <h2 id="inv-sum" className="m-0 min-w-0 text-[24px]">{`${inv.doc.title || 'Invoice'} ${inv.number}`}</h2>
        <StatusTag tone={tone}>{word}</StatusTag>
      </div>
      <p className="mt-sm m-0 font-display text-[32px] font-extrabold leading-none tabular-nums">{money(pay, inv.currency)}</p>
      <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">{t.tdsDeducted > 0 ? `${inv.status === 'paid' ? 'After TDS' : 'To pay after TDS'}, of ${money(t.total, inv.currency)} in all` : inv.status === 'paid' ? 'Total' : 'Total to pay'}</p>
      {inv.doc.show.words && <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">{amountInWords(pay, inv.currency)}</p>}
      {inv.status === 'paid' ? (
        <p className="mt-sm m-0 text-[16px] font-bold">{inv.paidAt ? `Paid on ${invoiceDate(inv.paidAt.slice(0, 10))}. Thank you.` : 'Paid. Thank you.'}</p>
      ) : overdue && inv.dueDate ? (
        <p className="mt-sm m-0 rounded-inner p-sm text-[16px] font-bold" style={{ background: 'var(--tint-orange)' }}>
          {`This was due on ${invoiceDate(inv.dueDate)}. If it is already on its way, thank you, and you can ignore this.${canWrite ? ' If something is holding it up, write below.' : ''}`}
        </p>
      ) : inv.dueDate ? (
        <p className="mt-sm m-0 text-[16px] font-bold">{`Due by ${invoiceDate(inv.dueDate)}`}</p>
      ) : null}
      {inv.status !== 'paid' && inv.status !== 'void' && inv.doc.show.bank && (inv.doc.bank.account || inv.doc.bank.upi) && <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">How to pay is on the invoice below, under the bank details.</p>}
    </section>
  );
}

/** The client's view of an invoice, from the link the creator sent: read it, save a copy as a PDF, or ask for a change. */
export function InvoicePage() {
  const { token = '' } = useParams();
  const q = useQuery({ queryKey: ['invoice', token], queryFn: () => publicApi.invoice(token), retry: false });
  const d = q.data;
  const inv = d?.invoice;
  const [text, setText] = useState('');
  const [done, setDone] = useState('');
  const [asking, setAsking] = useState(false);
  const send = useMutation({
    mutationFn: () => publicApi.invoiceComment(token, text),
    onSuccess: async () => {
      setText('');
      setAsking(false);
      setDone('Sent. The person who made this invoice has been told.');
      await q.refetch();
    },
    onError: (e: Error) => setDone(e.message),
  });
  return (
    <SiteLayout wide={false} minimal>
      <div className="pt-lg">
        {q.isPending && (
          <Busy label="Loading the invoice" className="grid gap-md">
            <Skeleton className="h-[48px] w-1/2" />
            <SkeletonCard lines={8} />
          </Busy>
        )}
        {q.isError && <LinkTrouble error={q.error} what="invoice" onRetry={() => void q.refetch()} />}
        {inv && d && (
          <>
            <InvoiceSummary invoice={inv} canWrite={d.canComment} />
            <div className="no-print mt-sm mb-sm flex flex-wrap items-center gap-sm">
              {inv.revisedAt && <StatusTag tone="warn">{`Revised ${invoiceDate(inv.revisedAt.slice(0, 10))}`}</StatusTag>}
              <DocActions fileName={fileTitle(inv.doc.title || 'Invoice', inv.number)} canDownload={d.canDownload} />
              <CopyTextButton text={() => invoiceAsText(inv)} />
            </div>
            <InvoiceView invoice={inv} />
            {inv.revisedAt && <p className="no-print mt-sm m-0 text-[14px] font-semibold text-ink-soft">This invoice was changed after it was first sent. What you see is the latest version.</p>}

            {(d.canComment || d.comments.length > 0) && (
              <section className="no-print mt-lg rounded-card bg-card p-md shadow-toy-soft" aria-labelledby="inv-ask">
                <h2 id="inv-ask" className="text-[24px]">
                  Questions about this invoice
                </h2>
                <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Spot a mistake, or need a PO number on it? Write here. The invoice does not change until the sender changes it.</p>
                {d.comments.length > 0 && (
                  <ul className="mt-sm m-0 flex list-none flex-col gap-xs p-0">
                    {d.comments.map((c) => (
                      <li key={c.id} className={`rounded-tile p-sm ${c.author === 'client' ? 'bg-paper' : 'bg-card-strong'}`}>
                        <p className="m-0 text-[12px] font-extrabold uppercase tracking-wide text-ink-soft">{c.author === 'client' ? 'You' : inv.ownerName}</p>
                        <p className="m-0 whitespace-pre-wrap text-[14px] font-semibold">
                          <Inert text={c.body} />
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
                {d.canComment && !asking && (
                  <div className="mt-sm flex flex-wrap items-center gap-sm">
                    <Button variant="outline" onClick={() => setAsking(true)} aria-expanded={false} aria-controls="inv-ask-text">
                      Ask for a change
                    </Button>
                    {done && (
                      <p role="status" className="m-0 text-[14px] font-bold">
                        {done}
                      </p>
                    )}
                  </div>
                )}
                {d.canComment && asking && (
                  <>
                    <label htmlFor="inv-ask-text" className="mt-sm block text-[14px] font-bold">
                      Your note
                    </label>
                    {/* Opened by a tap, so the keyboard lands in it at once. */}
                    <textarea id="inv-ask-text" autoFocus rows={3} maxLength={600} value={text} onChange={(e) => setText(e.target.value)} className="mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]" />
                    <div className="mt-xs flex flex-wrap items-center gap-sm">
                      <Button onClick={() => send.mutate()} disabled={!text.trim() || send.isPending}>
                        {send.isPending ? 'Sending' : 'Send'}
                      </Button>
                      <Button variant="ghost" onClick={() => setAsking(false)}>
                        Cancel
                      </Button>
                      {done && (
                        <p role="status" className="m-0 text-[14px] font-bold">
                          {done}
                        </p>
                      )}
                    </div>
                  </>
                )}
              </section>
            )}
            <p className="no-print mt-md m-0 text-[12px] font-semibold text-ink-mute">Sent with kreators.app.</p>
          </>
        )}
      </div>
    </SiteLayout>
  );
}
