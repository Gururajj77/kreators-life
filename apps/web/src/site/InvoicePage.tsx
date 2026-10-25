import { money } from '@kreators/shared';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router';
import { publicApi } from '../lib/api';
import { SiteLayout } from './SiteLayout';

/** The client's view of an invoice, from the link the creator sent. */
export function InvoicePage() {
  const { token = '' } = useParams();
  const q = useQuery({ queryKey: ['invoice', token], queryFn: () => publicApi.invoice(token) });
  const inv = q.data?.invoice;
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
        {inv && (
          <article className="rounded-card bg-card p-md shadow-toy md:p-lg">
            <div className="flex flex-wrap items-start justify-between gap-sm">
              <div>
                <p className="m-0 text-[14px] font-extrabold uppercase tracking-wide text-ink-mute">Invoice</p>
                <h1 className="mt-xs text-[30px]">{inv.number}</h1>
                <p className="m-0 text-[16px] font-semibold text-ink-soft">
                  from{' '}
                  {inv.ownerHandle ? (
                    <Link to={`/u/${inv.ownerHandle}`} className="font-bold text-ink underline-offset-4 hover:underline">
                      {inv.ownerName}
                    </Link>
                  ) : (
                    <span className="font-bold text-ink">{inv.ownerName}</span>
                  )}
                </p>
              </div>
              <span className={`rounded-pill px-sm text-[14px] font-extrabold leading-[32px] ${inv.status === 'paid' ? 'bg-r4 text-ink-fixed' : inv.status === 'void' ? 'bg-line text-ink' : 'bg-r3 text-ink-fixed'}`}>{inv.status === 'sent' ? 'awaiting payment' : inv.status}</span>
            </div>
            <dl className="mt-md grid grid-cols-2 gap-xs text-[14px] font-semibold text-ink-soft">
              <div>
                <dt className="font-extrabold text-ink">Billed to</dt>
                <dd className="m-0">
                  {inv.clientName}
                  {inv.clientEmail ? <br /> : null}
                  {inv.clientEmail}
                </dd>
              </div>
              <div>
                <dt className="font-extrabold text-ink">Dates</dt>
                <dd className="m-0">
                  Issued {new Date(`${inv.issueDate}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                  {inv.dueDate ? <br /> : null}
                  {inv.dueDate ? `Due ${new Date(`${inv.dueDate}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
                </dd>
              </div>
            </dl>
            <table className="mt-md w-full border-collapse text-[14px] font-semibold">
              <thead>
                <tr className="text-left text-[12px] font-extrabold uppercase tracking-wide text-ink-mute">
                  <th className="py-xs">Item</th>
                  <th className="py-xs text-right">Qty</th>
                  <th className="py-xs text-right">Unit</th>
                  <th className="py-xs text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {inv.items.map((it, i) => (
                  <tr key={i} className="border-t border-line">
                    <td className="py-xs">{it.description}</td>
                    <td className="py-xs text-right">{it.quantity}</td>
                    <td className="py-xs text-right">{money(it.unitCents, inv.currency)}</td>
                    <td className="py-xs text-right font-extrabold">{money(it.quantity * it.unitCents, inv.currency)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-ink">
                  <td className="py-xs text-[16px] font-extrabold" colSpan={3}>
                    Total
                  </td>
                  <td className="py-xs text-right text-[18px] font-extrabold">{money(inv.totalCents, inv.currency)}</td>
                </tr>
              </tfoot>
            </table>
            {inv.note && <p className="mt-md m-0 whitespace-pre-wrap rounded-tile bg-paper p-sm text-[14px] font-semibold text-ink-soft">{inv.note}</p>}
            <p className="mt-md m-0 text-[12px] font-semibold text-ink-mute">Sent with kreators.app. Payment details are in the note above or in the message that came with this link.</p>
          </article>
        )}
      </div>
    </SiteLayout>
  );
}
