import {
  CONTRACT_STATUS_NAME,
  CONTRACT_STATUS_TONE,
  DELIVERABLE_KIND_NAME,
  DELIVERABLE_STAGE_META,
  DELIVERABLE_STAGE_TONE,
  INVOICE_STATUS_NAME,
  INVOICE_STATUS_TONE,
  minutesLabel2,
  money,
  type PortalView,
} from '@kreators/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { Button } from '../components/Button';
import { Inert } from '../components/Inert';
import { StatusTag } from '../components/StatusTag';
import { ApiError, publicApi } from '../lib/api';
import { prettyDate } from '../lib/date';
import { SiteLayout } from './SiteLayout';

const COPY = {
  loading: 'Loading.',
  gone: 'No page at this link. Ask the person who sent it for a fresh link.',
  waitingLede: 'These are ready for you. Watch each one, then approve it or send it back with a note.',
  waitingViewOnly: 'These are ready for you to look at.',
  comingLede: 'What is being made, and the day it should go live.',
  publishedLede: 'What has gone live.',
  nothingWaiting: 'Nothing is waiting for you right now.',
  sentBack: 'Sent back. They will get your note.',
  approved: 'Approved. Thank you.',
  noted: 'Your note was sent.',
  needNote: 'Say what to change, then send it back.',
};

const dot = (s: string | null) => (s ? prettyDate(s.slice(0, 10)) : '');
/** Only a real https address is ever a link. */
const safe = (u: string) => u.startsWith('https://');

function Card({ children }: { children: React.ReactNode }) {
  return <li className="list-none rounded-tile bg-card p-sm shadow-toy-soft">{children}</li>;
}

function Heading({ id, title, lede }: { id: string; title: string; lede?: string }) {
  return (
    <>
      <h2 id={id} className="text-[24px]">
        {title}
      </h2>
      {lede && <p className="mt-xs m-0 text-balance text-[14px] font-semibold text-ink-soft">{lede}</p>}
    </>
  );
}

/** One deliverable waiting for the client: watch it, read the thread, then approve, send it back or write a note. */
function Waiting({ token, view, item, onDone }: { token: string; view: PortalView; item: PortalView['waiting'][number]; onDone: (line: string) => void }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const can = view.show;
  const act = async (decision: 'approve' | 'changes' | 'comment') => {
    if (decision === 'changes' && !note.trim()) {
      setError(COPY.needNote);
      return;
    }
    setBusy(true);
    setError('');
    try {
      await publicApi.portalDecide(token, item.id, { decision, note: note.trim() || undefined });
      setNote('');
      onDone(decision === 'approve' ? COPY.approved : decision === 'changes' ? COPY.sentBack : COPY.noted);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'That did not go through. Try again.');
    } finally {
      setBusy(false);
    }
  };
  const meta = [DELIVERABLE_KIND_NAME[item.kind], item.platform, item.publishDate ? `goes live ${dot(item.publishDate)}` : ''].filter(Boolean).join(', ');
  return (
    <Card>
      <p className="m-0 text-[16px] font-extrabold">
        <Inert text={item.title} />
      </p>
      <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">{meta}</p>
      {safe(item.link) && (
        <p className="mt-xs m-0">
          <a href={item.link} target="_blank" rel="noopener noreferrer" className="text-[14px] font-bold text-ink underline underline-offset-4">
            Watch it
          </a>
        </p>
      )}
      {item.thread.length > 0 && (
        <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0" aria-label="Notes">
          {item.thread.map((t, i) => (
            <li key={`${t.createdAt}-${i}`} className={`rounded-tile p-sm text-[14px] font-semibold ${t.author === 'client' ? 'bg-paper' : 'bg-card-strong'}`}>
              <span className="block text-[12px] font-extrabold text-ink-soft">{t.author === 'client' ? 'You' : view.agencyName}</span>
              <span className="whitespace-pre-wrap">
                <Inert text={t.body} />
              </span>
            </li>
          ))}
        </ul>
      )}
      {(can.canApprove || can.canComment) && (
        <div className="mt-sm no-print">
          <label className="block text-[14px] font-bold" htmlFor={`note-${item.id}`}>
            {can.canApprove ? 'Your note (needed to send it back)' : 'Your note'}
          </label>
          <textarea
            id={`note-${item.id}`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={500}
            className="mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]"
          />
          <div className="mt-xs flex flex-wrap gap-xs">
            {can.canApprove && (
              <Button size="sm" onClick={() => act('approve')} disabled={busy}>
                Approve
              </Button>
            )}
            {can.canApprove && (
              <Button size="sm" variant="outline" onClick={() => act('changes')} disabled={busy}>
                Send back
              </Button>
            )}
            {can.canComment && (
              <Button size="sm" variant="outline" onClick={() => act('comment')} disabled={busy || !note.trim()}>
                Send note
              </Button>
            )}
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-xs m-0 text-[14px] font-bold">
          {error}
        </p>
      )}
    </Card>
  );
}

/** The client's dashboard at the link their agency or freelancer sent: only the parts that were switched on, and no sign-in. */
export function ClientPortal() {
  const { token = '' } = useParams();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['agency', 'portal', token], queryFn: () => publicApi.portal(token), retry: false });
  const [said, setSaid] = useState('');
  const v = q.data;
  const done = (line: string) => {
    setSaid(line);
    void qc.invalidateQueries({ queryKey: ['agency', 'portal', token] });
  };

  return (
    <SiteLayout wide={false}>
      <div className="pt-lg">
        {q.isPending && <p className="m-0 text-[16px] font-semibold text-ink-soft">{COPY.loading}</p>}
        {q.isError && (
          <div role="alert" className="rounded-card bg-card p-md shadow-toy-soft">
            <h1 className="text-[30px]">No page here</h1>
            <p className="mt-xs m-0 text-[16px] font-semibold text-ink-soft">{COPY.gone}</p>
          </div>
        )}
        {v && (
          <article className="print-doc">
            <header>
              <p className="m-0 type-eyebrow text-ink-mute">Your dashboard</p>
              <h1 className="mt-xs text-[30px]">{`${v.clientName}, content with ${v.agencyName}`}</h1>
              <div className="mt-xs no-print">
                <Button variant="outline" size="sm" onClick={() => window.print()}>
                  Print or save as PDF
                </Button>
              </div>
            </header>
            {said && (
              <p role="status" className="mt-md m-0 rounded-tile p-sm text-[14px] font-bold" style={{ background: 'var(--tint-green)' }}>
                {said}
              </p>
            )}

            {v.show.waiting && (
              <section className="mt-lg" aria-labelledby="waiting-heading">
                <Heading id="waiting-heading" title="Waiting for you" lede={v.show.canApprove ? COPY.waitingLede : COPY.waitingViewOnly} />
                {v.waiting.length === 0 ? (
                  <p className="mt-sm m-0 text-[14px] font-semibold text-ink-soft">{COPY.nothingWaiting}</p>
                ) : (
                  <ul className="mt-sm flex flex-col gap-sm p-0 m-0">
                    {v.waiting.map((w) => (
                      <Waiting key={w.id} token={token} view={v} item={w} onDone={done} />
                    ))}
                  </ul>
                )}
              </section>
            )}

            {v.show.progress && v.month && (
              <section className="mt-lg" aria-labelledby="month-heading">
                <Heading id="month-heading" title="This month so far" />
                <div className="mt-sm rounded-card bg-card p-md shadow-toy-soft">
                  <p className="m-0 font-display text-[28px] font-extrabold leading-none">{v.month.planned > 0 ? `${v.month.published} of ${v.month.planned}` : String(v.month.published)}</p>
                  <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">{v.month.planned > 0 ? 'deliverables live against the plan' : 'deliverables live'}</p>
                  {v.month.planned > 0 && (
                    <div className="mt-sm h-[8px] overflow-hidden rounded-pill bg-line" role="img" aria-label={`${v.month.published} of ${v.month.planned} live`}>
                      <div className="h-full rounded-pill" style={{ width: `${Math.min(100, Math.round((v.month.published / v.month.planned) * 100))}%`, background: 'var(--color-r4)' }} />
                    </div>
                  )}
                </div>
              </section>
            )}

            {v.show.coming && (
              <section className="mt-lg" aria-labelledby="coming-heading">
                <Heading id="coming-heading" title="Coming up" lede={COPY.comingLede} />
                {v.coming.length === 0 ? (
                  <p className="mt-sm m-0 text-[14px] font-semibold text-ink-soft">Nothing is being made right now.</p>
                ) : (
                  <ul className="mt-sm flex flex-col gap-xs p-0 m-0">
                    {v.coming.map((c, i) => (
                      <Card key={`${c.title}-${i}`}>
                        <div className="flex items-start justify-between gap-sm">
                          <div className="min-w-0">
                            <p className="m-0 text-[16px] font-bold">
                              <Inert text={c.title} />
                            </p>
                            <p className="m-0 text-[14px] font-semibold text-ink-soft">{[DELIVERABLE_KIND_NAME[c.kind], c.platform, c.publishDate ? `goes live ${dot(c.publishDate)}` : ''].filter(Boolean).join(', ')}</p>
                          </div>
                          <StatusTag tone={DELIVERABLE_STAGE_TONE[c.stage]}>{DELIVERABLE_STAGE_META[c.stage].name}</StatusTag>
                        </div>
                      </Card>
                    ))}
                  </ul>
                )}
              </section>
            )}

            {v.show.published && (
              <section className="mt-lg" aria-labelledby="published-heading">
                <Heading id="published-heading" title="Published" lede={COPY.publishedLede} />
                {v.published.length === 0 ? (
                  <p className="mt-sm m-0 text-[14px] font-semibold text-ink-soft">Nothing has gone live yet.</p>
                ) : (
                  <ul className="mt-sm flex flex-col gap-xs p-0 m-0">
                    {v.published.map((p, i) => (
                      <Card key={`${p.title}-${i}`}>
                        <p className="m-0 text-[16px] font-bold">
                          <Inert text={p.title} />
                        </p>
                        <p className="m-0 text-[14px] font-semibold text-ink-soft">{[DELIVERABLE_KIND_NAME[p.kind], p.platform, p.publishedAt ? dot(p.publishedAt) : ''].filter(Boolean).join(', ')}</p>
                        {safe(p.link) && (
                          <a href={p.link} target="_blank" rel="noopener noreferrer" className="text-[14px] font-bold text-ink underline underline-offset-4">
                            Open it
                          </a>
                        )}
                      </Card>
                    ))}
                  </ul>
                )}
              </section>
            )}

            {v.show.channels && v.channels.length > 0 && (
              <section className="mt-lg" aria-labelledby="channels-heading">
                <Heading id="channels-heading" title="By channel" />
                <ul className="mt-sm flex flex-col gap-xs p-0 m-0">
                  {v.channels.map((ch) => (
                    <Card key={ch.channel}>
                      <div className="flex items-baseline justify-between gap-sm">
                        <span className="min-w-0 text-[16px] font-bold">{ch.channel}</span>
                        <span className="shrink-0 text-[14px] font-bold text-ink-soft">{`${ch.published} live this month, ${ch.open} open`}</span>
                      </div>
                    </Card>
                  ))}
                </ul>
              </section>
            )}

            {v.show.hours && v.hours && (
              <section className="mt-lg" aria-labelledby="hours-heading">
                <Heading id="hours-heading" title="Hours" />
                <div className="mt-sm rounded-card bg-card p-md shadow-toy-soft">
                  <p className="m-0 font-display text-[28px] font-extrabold leading-none">{minutesLabel2(v.hours.usedMinutes)}</p>
                  <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">{v.hours.includedMinutes > 0 ? `worked this month, of ${minutesLabel2(v.hours.includedMinutes)} included` : 'worked this month'}</p>
                  {v.hours.includedMinutes > 0 && (
                    <div className="mt-sm h-[8px] overflow-hidden rounded-pill bg-line" role="img" aria-label={`${minutesLabel2(v.hours.usedMinutes)} of ${minutesLabel2(v.hours.includedMinutes)}`}>
                      <div className="h-full rounded-pill" style={{ width: `${Math.min(100, Math.round((v.hours.usedMinutes / v.hours.includedMinutes) * 100))}%`, background: 'var(--color-r5)' }} />
                    </div>
                  )}
                </div>
              </section>
            )}

            {v.show.invoices && v.invoices.length > 0 && (
              <section className="mt-lg" aria-labelledby="invoices-heading">
                <Heading id="invoices-heading" title="Invoices" />
                <ul className="mt-sm flex flex-col gap-xs p-0 m-0">
                  {v.invoices.map((inv) => (
                    <Card key={inv.token}>
                      <Link to={`/i/${inv.token}`} className="flex items-center justify-between gap-sm text-ink">
                        <span className="min-w-0">
                          <span className="block text-[16px] font-bold">{inv.number}</span>
                          <span className="block text-[14px] font-semibold text-ink-soft">{`${money(inv.totalCents, inv.currency)}, ${dot(inv.issueDate)}`}</span>
                        </span>
                        <StatusTag tone={INVOICE_STATUS_TONE[inv.status]}>{INVOICE_STATUS_NAME[inv.status]}</StatusTag>
                      </Link>
                    </Card>
                  ))}
                </ul>
              </section>
            )}

            {v.show.contracts && v.contracts.length > 0 && (
              <section className="mt-lg" aria-labelledby="agreements-heading">
                <Heading id="agreements-heading" title="Agreements" />
                <ul className="mt-sm flex flex-col gap-xs p-0 m-0">
                  {v.contracts.map((k) => (
                    <Card key={k.token}>
                      <Link to={`/k/${k.token}`} className="flex items-center justify-between gap-sm text-ink">
                        <span className="min-w-0 text-[16px] font-bold">
                          <Inert text={k.title} />
                        </span>
                        <StatusTag tone={CONTRACT_STATUS_TONE[k.status]}>{CONTRACT_STATUS_NAME[k.status]}</StatusTag>
                      </Link>
                    </Card>
                  ))}
                </ul>
              </section>
            )}
          </article>
        )}
      </div>
    </SiteLayout>
  );
}
