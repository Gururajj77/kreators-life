import {
  CONTRACT_STATUS_NAME,
  CONTRACT_STATUS_TONE,
  DELIVERABLE_KIND_NAME,
  DELIVERABLE_STAGE_META,
  DELIVERABLE_STAGE_TONE,
  INVOICE_STATUS_NAME,
  INVOICE_STATUS_TONE,
  NOTE_KIND_NAME,
  changesLabel,
  changesLeft,
  minutesLabel2,
  money,
  type DeliverableStage,
  type PortalView,
} from '@kreators/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Button } from '../components/Button';
import { Inert } from '../components/Inert';
import { PortalLock } from '../components/PortalLock';
import { StageBar } from '../components/StageBar';
import { StatusTag } from '../components/StatusTag';
import { ApiError, publicApi } from '../lib/api';
import { prettyDate } from '../lib/date';
import { fileTitle, printAs } from '../lib/printDoc';
import { forgetPortalSessions } from '../lib/portalSession';
import { SiteLayout } from './SiteLayout';

const COPY = {
  loading: 'Loading.',
  gone: 'No page at this link. Ask the person who sent it for a fresh link.',
  waitingLede: 'These are ready for you. Watch each one, then approve it or ask for a change.',
  waitingViewOnly: 'These are ready for you to look at.',
  comingLede: 'What is being made, and the day it should go live.',
  publishedLede: 'What has gone live.',
  nothingWaiting: 'Nothing is waiting for you right now.',
  changeAsked: 'Sent. It is back in making, and they have your note.',
  paidAsked: 'Sent. They will come back to you about it.',
  approved: 'Approved. Thank you.',
  noted: 'Your note was sent.',
  needNote: 'Say what to change first.',
  noneLeft: 'You have used all the changes included in this piece. A further change is paid for separately.',
  failed: 'That did not go through. Try again.',
};

const dot = (s: string | null) => (s ? prettyDate(s.slice(0, 10)) : '');
/** Only a real https address is ever a link. */
const safe = (u: string) => u.startsWith('https://');

function Card({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <li id={id} className="list-none rounded-tile bg-card p-sm shadow-toy-soft">
      {children}
    </li>
  );
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

const area = 'mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]';

/**
 * What a client can do with one piece: approve it, ask for a change (which spends one of the changes included in it and sends it back to
 * making), ask for a paid change when none are left, or leave a comment. What the owner switched off is not offered.
 */
function PieceActions({ token, view, id, stage, changes, onDone }: { token: string; view: PortalView; id: string; stage: DeliverableStage; changes: { used: number; allowed: number }; onDone: (line: string) => void }) {
  const can = view.show;
  const [mode, setMode] = useState<null | 'change' | 'paid' | 'comment'>(null);
  const [note, setNote] = useState('');
  const [where, setWhere] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const left = changesLeft(changes.used, changes.allowed);
  const canChange = can.canApprove && (stage === 'review' || stage === 'approved');
  const canPaid = can.canApprove && changes.used >= changes.allowed && stage !== 'idea';

  const send = async (decision: 'approve' | 'changes' | 'paid_change' | 'comment') => {
    if (decision !== 'approve' && !note.trim()) {
      setError(decision === 'comment' ? 'Write something first.' : COPY.needNote);
      return;
    }
    setBusy(true);
    setError('');
    try {
      await publicApi.portalDecide(token, id, { decision, note: note.trim() || undefined, where: where.trim() || undefined });
      setNote('');
      setWhere('');
      setMode(null);
      onDone(decision === 'approve' ? COPY.approved : decision === 'changes' ? COPY.changeAsked : decision === 'paid_change' ? COPY.paidAsked : COPY.noted);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : COPY.failed);
    } finally {
      setBusy(false);
    }
  };

  if (!can.canApprove && !can.canComment) return null;
  return (
    <div className="mt-sm no-print">
      {stage !== 'published' && <p className="m-0 text-[12px] font-bold text-ink-soft">{changesLabel(changes.used, changes.allowed)}</p>}
      <div className="mt-xs flex flex-wrap gap-xs">
        {can.canApprove && stage === 'review' && (
          <Button size="sm" onClick={() => send('approve')} disabled={busy}>
            Approve
          </Button>
        )}
        {canChange && left > 0 && (
          <Button size="sm" variant="outline" onClick={() => setMode(mode === 'change' ? null : 'change')} aria-expanded={mode === 'change'} disabled={busy}>
            Ask for a change
          </Button>
        )}
        {canChange && left === 0 && (
          <Button size="sm" variant="outline" onClick={() => setMode(mode === 'paid' ? null : 'paid')} aria-expanded={mode === 'paid'} disabled={busy}>
            Ask for a paid change
          </Button>
        )}
        {!canChange && canPaid && (
          <Button size="sm" variant="outline" onClick={() => setMode(mode === 'paid' ? null : 'paid')} aria-expanded={mode === 'paid'} disabled={busy}>
            Ask for a paid change
          </Button>
        )}
        {can.canComment && (
          <Button size="sm" variant="outline" onClick={() => setMode(mode === 'comment' ? null : 'comment')} aria-expanded={mode === 'comment'} disabled={busy}>
            Leave a comment
          </Button>
        )}
      </div>
      {mode !== null && (
        <div className="mt-sm">
          {mode === 'paid' && <p className="m-0 text-[14px] font-semibold text-ink-soft">{COPY.noneLeft}</p>}
          {(mode === 'change' || mode === 'paid') && (
            <>
              <label className="mt-xs block text-[14px] font-bold" htmlFor={`where-${id}`}>
                Where, if it helps (a time in the video, a line, a slide)
              </label>
              <input id={`where-${id}`} value={where} onChange={(e) => setWhere(e.target.value)} maxLength={60} placeholder="0:42" className={area} />
            </>
          )}
          <label className="mt-xs block text-[14px] font-bold" htmlFor={`note-${id}`}>
            {mode === 'comment' ? 'Your comment' : 'What should change?'}
          </label>
          <textarea id={`note-${id}`} value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={500} className={area} />
          <div className="mt-xs">
            <Button size="sm" onClick={() => send(mode === 'change' ? 'changes' : mode === 'paid' ? 'paid_change' : 'comment')} disabled={busy || !note.trim()}>
              {mode === 'comment' ? 'Send the comment' : mode === 'paid' ? 'Send the request' : 'Send the change'}
            </Button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-xs m-0 text-[14px] font-bold">
          {error}
        </p>
      )}
    </div>
  );
}

/** A thing waiting on the client: a title, one line and where to do it. */
function WaitingOn({ item }: { item: PortalView['waitingOn'][number] }) {
  const inner = (
    <>
      <span className="block text-[16px] font-extrabold">{item.title}</span>
      <span className="block text-[14px] font-semibold text-ink-soft">{item.line}</span>
    </>
  );
  const cls = 'block rounded-tile bg-card p-sm shadow-toy-soft text-ink';
  if (!item.href) return <li className={`list-none ${cls}`}>{inner}</li>;
  if (item.href.startsWith('https://'))
    return (
      <li className="list-none">
        <a href={item.href} target="_blank" rel="noopener noreferrer" className={`toy toy-soft ${cls}`}>
          {inner}
          <span className="mt-xs block text-[14px] font-bold underline underline-offset-4">Open the link</span>
        </a>
      </li>
    );
  if (item.href.startsWith('#'))
    return (
      <li className="list-none">
        <a href={item.href} className={`toy toy-soft ${cls}`}>
          {inner}
        </a>
      </li>
    );
  return (
    <li className="list-none">
      <Link to={item.href} className={`toy toy-soft ${cls}`}>
        {inner}
      </Link>
    </li>
  );
}

/** The retainer: pick a length from the offer, or read the one that is running. */
function Retainer({ token, view, onDone }: { token: string; view: PortalView; onDone: (line: string) => void }) {
  const r = view.retainer;
  const [months, setMonths] = useState<number | null>(r?.chosenMonths ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!r) return null;
  const choose = async () => {
    if (!months) return;
    setBusy(true);
    setError('');
    try {
      await publicApi.portalRetainer(token, months);
      onDone(`You chose ${months} months. They will confirm it.`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : COPY.failed);
    } finally {
      setBusy(false);
    }
  };
  const open = r.status !== 'active';
  return (
    <section className="mt-lg" aria-labelledby="retainer-heading">
      <Heading
        id="retainer-heading"
        title={r.status === 'active' ? 'Your retainer' : 'Choose how many months'}
        lede={r.status === 'active' ? 'Pieces and an invoice come every month.' : r.status === 'chosen' ? 'You can change your mind until they confirm.' : 'Pick the length of the retainer. A longer one can cost less each month.'}
      />
      <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0" role={open ? 'radiogroup' : undefined} aria-label={open ? 'Retainer length' : undefined}>
        {r.options.map((o) => {
          const picked = open ? months === o.months : true;
          const body = (
            <>
              <span className="block text-[16px] font-extrabold">{`${o.months} ${o.months === 1 ? 'month' : 'months'}`}</span>
              <span className="block text-[14px] font-semibold text-ink-soft">
                {`${money(o.monthlyCents, r.currency)} a month, ${money(o.totalCents, r.currency)} in all${o.discountBps > 0 ? `, ${o.discountBps % 100 === 0 ? o.discountBps / 100 : (o.discountBps / 100).toFixed(2)}% off` : ''}`}
              </span>
            </>
          );
          return open ? (
            <li key={o.months} className="list-none">
              <button type="button" role="radio" aria-checked={picked} onClick={() => setMonths(o.months)} className={`toy block w-full rounded-tile border-2 p-sm text-left ${picked ? 'border-ink bg-card-strong' : 'toy-soft border-line bg-card'}`}>
                {body}
                {picked && <span className="mt-xs block text-[12px] font-extrabold">Your pick</span>}
              </button>
            </li>
          ) : (
            <Card key={o.months}>{body}</Card>
          );
        })}
      </ul>
      <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">
        {`${r.piecesPerMonth} ${r.piecesPerMonth === 1 ? 'piece' : 'pieces'} a month, and ${r.revisionsPerPiece} ${r.revisionsPerPiece === 1 ? 'change' : 'changes'} included in each.`}
        {r.status === 'active' && r.startDay ? ` Started ${dot(r.startDay)}.` : ''}
      </p>
      {open && (
        <div className="mt-sm no-print">
          <Button onClick={choose} disabled={busy || !months || (r.status === 'chosen' && months === r.chosenMonths)}>
            {busy ? 'Sending' : r.status === 'chosen' ? 'Change my pick' : months ? `Choose ${months} months` : 'Pick a length'}
          </Button>
          {r.status === 'chosen' && months === r.chosenMonths && <span role="status" className="ml-xs text-[14px] font-bold">{`You chose ${r.chosenMonths} months. Waiting for them to confirm.`}</span>}
          {error && (
            <p role="alert" className="mt-xs m-0 text-[14px] font-bold">
              {error}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

/** The client's dashboard at the link their agency or freelancer sent: the stage bar, what is waiting, and the parts that were switched on. A password may stand in front. */
export function ClientPortal() {
  const { token = '' } = useParams();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['agency', 'portal', token], queryFn: () => publicApi.portal(token), retry: false });
  const [said, setSaid] = useState('');
  const v = q.data;
  const locked = q.error instanceof ApiError && q.error.status === 401 && q.error.data.error === 'locked';
  // A kept unlock for this link the server no longer accepts (twelve hours, or the password changed) is dropped, so it is not sent again.
  // Other clients' links keep theirs.
  useEffect(() => {
    if (locked) forgetPortalSessions(`agency:${token}`);
  }, [locked, token]);
  const done = (line: string) => {
    setSaid(line);
    void qc.invalidateQueries({ queryKey: ['agency', 'portal', token] });
  };

  if (locked) {
    return (
      <SiteLayout wide={false}>
        <PortalLock clientName={String((q.error as ApiError).data.clientName ?? '')} link={`agency:${token}`} unlock={(pw) => publicApi.portalUnlock(token, pw)} onOpen={() => void qc.invalidateQueries({ queryKey: ['agency', 'portal', token] })} />
      </SiteLayout>
    );
  }

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
                <Button variant="outline" size="sm" onClick={() => printAs(fileTitle('Dashboard', v.clientName))}>
                  Print or save as PDF
                </Button>
              </div>
            </header>
            {said && (
              <p role="status" className="mt-md m-0 rounded-tile p-sm text-[14px] font-bold" style={{ background: 'var(--tint-green)' }}>
                {said}
              </p>
            )}

            <div className="mt-md rounded-card bg-card p-md shadow-toy-soft">
              <StageBar stage={v.stage} />
            </div>

            {v.waitingOn.length > 0 && (
              <section className="mt-lg" aria-labelledby="waiting-on-heading">
                <Heading id="waiting-on-heading" title="Waiting on you" lede="What to do next, in order." />
                <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
                  {v.waitingOn.map((w) => (
                    <WaitingOn key={w.key} item={w} />
                  ))}
                </ul>
              </section>
            )}

            {v.strategy && (
              <section className="mt-lg" aria-labelledby="strategy-heading">
                <Heading id="strategy-heading" title="Strategy session" />
                <div className="mt-sm rounded-card bg-card p-md shadow-toy-soft">
                  <p className="m-0 font-display text-[22px] font-extrabold leading-tight">{v.strategy.day ? dot(v.strategy.day) : 'A day will be shared here'}</p>
                  {v.strategy.link && safe(v.strategy.link) && (
                    <p className="mt-xs m-0">
                      <a href={v.strategy.link} target="_blank" rel="noopener noreferrer" className="text-[14px] font-bold text-ink underline underline-offset-4">
                        Join the call
                      </a>
                    </p>
                  )}
                  <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Bring your brand guide and three to five videos that show the feel you want.</p>
                </div>
              </section>
            )}

            {v.trial && (
              <section className="mt-lg" aria-labelledby="trial-heading">
                <Heading id="trial-heading" title="The trial video" lede={v.trial.due ? `Due ${dot(v.trial.due)}. These are the rules it is made under.` : 'These are the rules it is made under.'} />
                <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
                  {v.trial.rules.map((r) => (
                    <Card key={r.key}>
                      <p className="m-0 text-[14px] font-semibold">{r.text}</p>
                      <p className="mt-xs m-0 text-[12px] font-bold text-ink-soft">{r.source}</p>
                    </Card>
                  ))}
                </ul>
              </section>
            )}

            {v.pilot && (
              <section className="mt-lg" aria-labelledby="pilot-heading">
                <Heading id="pilot-heading" title="Pilot month" />
                <div className="mt-sm rounded-card bg-card p-md shadow-toy-soft">
                  <p className="m-0 text-[16px] font-bold">{[v.pilot.start ? `Starts ${dot(v.pilot.start)}` : '', v.pilot.end ? `ends ${dot(v.pilot.end)}` : ''].filter(Boolean).join(', ')}</p>
                </div>
              </section>
            )}

            <Retainer token={token} view={v} onDone={done} />

            {v.show.waiting && (
              <section className="mt-lg" aria-labelledby="waiting-heading">
                <Heading id="waiting-heading" title="Waiting for you" lede={v.show.canApprove ? COPY.waitingLede : COPY.waitingViewOnly} />
                {v.waiting.length === 0 ? (
                  <p className="mt-sm m-0 text-[14px] font-semibold text-ink-soft">{COPY.nothingWaiting}</p>
                ) : (
                  <ul className="mt-sm flex flex-col gap-sm p-0 m-0">
                    {v.waiting.map((w) => {
                      const meta = [DELIVERABLE_KIND_NAME[w.kind], w.platform, w.publishDate ? `goes live ${dot(w.publishDate)}` : ''].filter(Boolean).join(', ');
                      return (
                        <Card key={w.id}>
                          <p className="m-0 text-[16px] font-extrabold">
                            <Inert text={w.title} />
                          </p>
                          <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">{meta}</p>
                          {safe(w.link) && (
                            <p className="mt-xs m-0">
                              <a href={w.link} target="_blank" rel="noopener noreferrer" className="text-[14px] font-bold text-ink underline underline-offset-4">
                                Watch it
                              </a>
                            </p>
                          )}
                          {w.thread.length > 0 && (
                            <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0" aria-label="Notes">
                              {w.thread.map((t, i) => (
                                <li key={`${t.createdAt}-${i}`} className={`rounded-tile p-sm text-[14px] font-semibold ${t.author === 'client' ? 'bg-paper' : 'bg-card-strong'}`}>
                                  <span className="block text-[12px] font-extrabold text-ink-soft">{`${t.author === 'client' ? 'You' : v.agencyName}${t.kind === 'change' || t.kind === 'paid_change' ? `, ${NOTE_KIND_NAME[t.kind].toLowerCase()}` : ''}`}</span>
                                  <span className="whitespace-pre-wrap">
                                    <Inert text={t.body} />
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                          <PieceActions token={token} view={v} id={w.id} stage="review" changes={w.changes} onDone={done} />
                        </Card>
                      );
                    })}
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
                    {v.coming.map((c) => (
                      <Card key={c.id}>
                        <div className="flex items-start justify-between gap-sm">
                          <div className="min-w-0">
                            <p className="m-0 text-[16px] font-bold">
                              <Inert text={c.title} />
                            </p>
                            <p className="m-0 text-[14px] font-semibold text-ink-soft">{[DELIVERABLE_KIND_NAME[c.kind], c.platform, c.publishDate ? `goes live ${dot(c.publishDate)}` : ''].filter(Boolean).join(', ')}</p>
                          </div>
                          <StatusTag tone={DELIVERABLE_STAGE_TONE[c.stage]}>{DELIVERABLE_STAGE_META[c.stage].name}</StatusTag>
                        </div>
                        <PieceActions token={token} view={v} id={c.id} stage={c.stage} changes={c.changes} onDone={done} />
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
                    {v.published.map((p) => (
                      <Card key={p.id}>
                        <p className="m-0 text-[16px] font-bold">
                          <Inert text={p.title} />
                        </p>
                        <p className="m-0 text-[14px] font-semibold text-ink-soft">{[DELIVERABLE_KIND_NAME[p.kind], p.platform, p.publishedAt ? dot(p.publishedAt) : ''].filter(Boolean).join(', ')}</p>
                        {safe(p.link) && (
                          <a href={p.link} target="_blank" rel="noopener noreferrer" className="text-[14px] font-bold text-ink underline underline-offset-4">
                            Open it
                          </a>
                        )}
                        <PieceActions token={token} view={v} id={p.id} stage="published" changes={{ used: 0, allowed: 0 }} onDone={done} />
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
