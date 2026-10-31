import { INVOICE_STATUS_NAME, INVOICE_STATUS_TONE } from '@kreators/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useParams } from 'react-router';
import { Button } from '../components/Button';
import { Inert } from '../components/Inert';
import { InvoiceView, invoiceDate } from '../components/InvoiceView';
import { StatusTag } from '../components/StatusTag';
import { publicApi } from '../lib/api';
import { SiteLayout } from './SiteLayout';

/** The client's view of an invoice, from the link the creator sent: read it, save a copy as a PDF, or ask for a change. */
export function InvoicePage() {
  const { token = '' } = useParams();
  const q = useQuery({ queryKey: ['invoice', token], queryFn: () => publicApi.invoice(token) });
  const d = q.data;
  const inv = d?.invoice;
  const [text, setText] = useState('');
  const [done, setDone] = useState('');
  const send = useMutation({
    mutationFn: () => publicApi.invoiceComment(token, text),
    onSuccess: async () => {
      setText('');
      setDone('Sent. The person who made this invoice has been told.');
      await q.refetch();
    },
    onError: (e: Error) => setDone(e.message),
  });
  // The saved PDF is named by the invoice number.
  const print = () => {
    const before = document.title;
    const restore = () => {
      document.title = before;
      window.removeEventListener('afterprint', restore);
    };
    window.addEventListener('afterprint', restore);
    document.title = inv?.number ?? 'Invoice';
    window.print();
  };
  return (
    <SiteLayout wide={false}>
      <div className="pt-lg">
        {q.isPending && <p className="m-0 text-[16px] font-semibold text-ink-soft">Loading…</p>}
        {q.isError && (
          <div role="alert" className="rounded-card bg-card p-md shadow-toy-soft">
            <h1 className="text-[30px]">No invoice at this link</h1>
            <p className="mt-xs m-0 text-[16px] font-semibold text-ink-soft">Ask the person who sent it for a fresh link.</p>
          </div>
        )}
        {inv && d && (
          <>
            <div className="no-print mb-sm flex flex-wrap items-center justify-between gap-sm">
              <div className="flex flex-wrap items-center gap-sm">
                <StatusTag tone={INVOICE_STATUS_TONE[inv.status]}>{INVOICE_STATUS_NAME[inv.status]}</StatusTag>
                {inv.revisedAt && <StatusTag tone="warn">{`Revised ${invoiceDate(inv.revisedAt.slice(0, 10))}`}</StatusTag>}
              </div>
              {d.canDownload && (
                <Button variant="outline" onClick={print}>
                  Download PDF
                </Button>
              )}
            </div>
            <InvoiceView invoice={inv} />
            {inv.revisedAt && <p className="no-print mt-sm m-0 text-[14px] font-semibold text-ink-soft">This invoice was changed after it was first sent. What you see is the latest version.</p>}

            {(d.canComment || d.comments.length > 0) && (
              <section className="no-print mt-lg rounded-card bg-card p-md shadow-toy-soft" aria-labelledby="inv-ask">
                <h2 id="inv-ask" className="text-[24px]">
                  Ask for a change
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
                {d.canComment && (
                  <>
                    <label htmlFor="inv-ask-text" className="mt-sm block text-[14px] font-bold">
                      Your note
                    </label>
                    <textarea id="inv-ask-text" rows={3} maxLength={600} value={text} onChange={(e) => setText(e.target.value)} className="mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]" />
                    <div className="mt-xs flex flex-wrap items-center gap-sm">
                      <Button onClick={() => send.mutate()} disabled={!text.trim() || send.isPending}>
                        {send.isPending ? 'Sending' : 'Send'}
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
