import {
  AGENCY_DOC_KIND_META,
  AGENCY_DOC_STATUS_NAME,
  AGENCY_DOC_STATUS_TONE,
  AGENCY_STAGE_BY_KEY,
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
  nextStage,
  type AgencyStageKey,
  type DeliverableStage,
  type PortalRetainer,
  type PortalView,
  type TagTone,
} from '@kreators/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Button } from '../components/Button';
import { Inert } from '../components/Inert';
import { AgencyMark, LinkTrouble, PasswordAsk, PortalLock } from '../components/PortalLock';
import { ClientOnboarding } from '../components/ClientOnboarding';
import { StageBar } from '../components/StageBar';
import { Busy, Skeleton, SkeletonCard } from '../components/Skeleton';
import { StatusTag } from '../components/StatusTag';
import { ApiError, publicApi, teamLinkApi } from '../lib/api';
import { prettyDate } from '../lib/date';
import { fileTitle, printAs } from '../lib/printDoc';
import { forgetPortalSessions, forgetTeamLinkSessions, hadPortalSession, hadTeamLinkSession, keepTeamLinkSession } from '../lib/portalSession';
import { SiteLayout } from './SiteLayout';
import { FIELD } from '../lib/ui';
import { ToggleChevron } from '../components/ToggleMark';
import { tie } from '../lib/text';

const COPY = {
  loading: 'Loading.',
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
  docsEmpty: 'Nothing here yet. Agreements, invoices and other papers show up here once they are sent to you.',
};

/**
 * What each stage means for the client, in their words: what is going on, what they do, what the other side does, and what shows up
 * here next. Nothing in it is the owner's checklist, a fee or a note; `{a}` is the business's name.
 */
const STAGE_COPY: Record<AgencyStageKey, { now: string; you: string; we: string; next: string }> = {
  enquiry: { now: 'Your agreement is being made.', you: 'Nothing yet.', we: '{a} is writing the trial and pilot agreement for you.', next: 'It shows up here to read and sign as soon as it is sent.' },
  agreement_sent: { now: 'Your agreement is ready to read.', you: 'Read it, answer the brief if it has one, then sign by typing your name.', we: '{a} answers any question you leave on it.', next: 'Once you sign, a day is set for the strategy session.' },
  agreement_signed: { now: 'You both signed. Thank you.', you: 'Get your brand guide ready, with three to five videos that show the feel you want.', we: '{a} is picking a day for the strategy session.', next: 'The day and the call link show up here.' },
  strategy: { now: 'Time for the strategy session.', you: 'Join the call with your brand guide and the videos you like.', we: '{a} runs the call and writes down what you agree on.', next: 'After the call, your trial video is made.' },
  trial: { now: 'Your trial video is being made.', you: 'When it is ready, watch it and send one set of feedback.', we: '{a} makes it under the trial rules below.', next: 'It shows up here for you to review on the day it is due.' },
  pilot: { now: 'Your pilot month is on.', you: 'Pay the pilot invoice, then review each piece as it comes in.', we: '{a} starts once the invoice is paid, then makes and sends the batch.', next: 'Each piece shows up here when it is ready for you.' },
  retainer_offer: { now: 'Time to choose how long to stay.', you: 'Pick a length below. A longer one can cost less each month.', we: '{a} confirms your pick and sets the start day.', next: 'Once it is confirmed, each month brings its pieces and its invoice.' },
  retainer: { now: 'Your retainer has started.', you: 'Pay each month and review each piece.', we: '{a} makes the month and sends its invoice.', next: 'This month\'s pieces show up here as they are ready.' },
  delivery: { now: 'Your monthly work is under way.', you: 'Review each piece, ask for a change if you need one, and pay on time.', we: '{a} makes the pieces, answers your changes and sends the invoice.', next: 'New pieces show up here when they are ready for you.' },
};
/** The stages whose next line is about pieces showing up for review. */
const PIECE_STAGES: ReadonlySet<AgencyStageKey> = new Set<AgencyStageKey>(['trial', 'pilot', 'retainer', 'delivery']);
const fill = (line: string, agency: string) => line.replace('{a}', agency || 'Your team');

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
      <h2 id={id} className="text-title2">
        {title}
      </h2>
      {lede && <p className="mt-xs m-0 text-balance text-subhead text-ink-soft">{lede}</p>}
    </>
  );
}


/** An outline-button look for a real link (a link is an `<a>`, never a button inside one), 44px tall like every target. */
const linkButton = 'toy toy-ink inline-flex min-h-[44px] items-center justify-center gap-xs rounded-pill border border-ink/30 bg-card-strong px-sm text-subhead leading-none text-ink hover:border-ink';

/**
 * What a client can do with one piece. A piece waiting on them (`waiting`) has one main action, Approve, with "Ask for a change"
 * beside it (which spends one of the changes included and sends it back to making), or a paid change when none are left, and the
 * changes-used line. Any other piece only takes a comment, except an approved one, which keeps a quiet "Ask for a change". A comment is always a quiet text button. What the owner switched off is not offered.
 */
type Decision = 'approve' | 'changes' | 'paid_change' | 'comment';
/** What a page lets the person at the link do, and how a tap reaches the server: the client link's call, or the team link's. */
interface PieceDoors {
  can: { canApprove: boolean; canComment: boolean };
  decide: (id: string, body: { decision: Decision; note?: string; where?: string }) => Promise<unknown>;
  /** The client link offers a paid change once the included ones are used; the team link never does (that is about money). */
  paidChange: boolean;
  /** Said when no change is left and a paid change is not offered here. */
  noneLeft?: string;
}

function PieceActions({ doors, id, stage, changes, waiting = false, onDone }: { doors: PieceDoors; id: string; stage: DeliverableStage; changes: { used: number; allowed: number }; waiting?: boolean; onDone: (line: string) => void }) {
  const can = doors.can;
  const [mode, setMode] = useState<null | 'change' | 'paid' | 'comment'>(null);
  const [note, setNote] = useState('');
  const [where, setWhere] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const left = changesLeft(changes.used, changes.allowed);
  // A piece already approved can still be sent back (the agreements allow it), so under Coming up it keeps a quiet "Ask for a change".
  const canChange = can.canApprove && (waiting ? stage === 'review' || stage === 'approved' : stage === 'approved');
  const quiet = waiting ? 'outline' : 'ghost';

  const [sentLine, setSentLine] = useState('');
  const send = async (decision: Decision) => {
    if (decision !== 'approve' && !note.trim()) {
      setError(decision === 'comment' ? 'Write something first.' : COPY.needNote);
      return;
    }
    const line = decision === 'approve' ? COPY.approved : decision === 'changes' ? COPY.changeAsked : decision === 'paid_change' ? COPY.paidAsked : COPY.noted;
    const kept = { note, where, mode };
    // Said at once, right where the tap was; taken back if the server says no.
    setSentLine(line);
    setNote('');
    setWhere('');
    setMode(null);
    setBusy(true);
    setError('');
    try {
      await doors.decide(id, { decision, note: kept.note.trim() || undefined, where: kept.where.trim() || undefined });
      onDone(line);
    } catch (e) {
      setSentLine('');
      setNote(kept.note);
      setWhere(kept.where);
      setMode(kept.mode);
      setError(e instanceof ApiError ? e.message : COPY.failed);
    } finally {
      setBusy(false);
    }
  };

  if (!(waiting && can.canApprove) && !canChange && !can.canComment) return null;
  return (
    <div className="mt-sm no-print">
      {canChange && (waiting || mode === 'change' || mode === 'paid') && <p className="m-0 text-subhead font-semibold text-ink-soft">{left > 0 ? changesLabel(changes.used, changes.allowed) : doors.paidChange ? COPY.noneLeft : (doors.noneLeft ?? COPY.noneLeft)}</p>}
      <div className="fill-row mt-xs flex flex-wrap items-center gap-xs">
        {waiting && can.canApprove && stage === 'review' && (
          <Button size="sm" onClick={() => send('approve')} disabled={busy}>
            Approve
          </Button>
        )}
        {canChange && left > 0 && (
          <Button size="sm" variant={quiet} onClick={() => setMode(mode === 'change' ? null : 'change')} aria-expanded={mode === 'change'} disabled={busy}>
            Ask for a change
            <ToggleChevron open={mode === 'change'} size={14} />
          </Button>
        )}
        {canChange && left === 0 && doors.paidChange && (
          <Button size="sm" variant={quiet} onClick={() => setMode(mode === 'paid' ? null : 'paid')} aria-expanded={mode === 'paid'} disabled={busy}>
            Ask for a paid change
            <ToggleChevron open={mode === 'paid'} size={14} />
          </Button>
        )}
        {can.canComment && (
          <Button size="sm" variant="ghost" onClick={() => setMode(mode === 'comment' ? null : 'comment')} aria-expanded={mode === 'comment'} disabled={busy}>
            Comment
            <ToggleChevron open={mode === 'comment'} size={14} />
          </Button>
        )}
      </div>
      {mode !== null && (
        <div className="mt-sm">
          {(mode === 'change' || mode === 'paid') && (
            <>
              <label className="mt-xs block text-subhead font-semibold" htmlFor={`where-${id}`}>
                Where, if it helps (a time in the video, a line, a slide)
              </label>
              <input id={`where-${id}`} value={where} onChange={(e) => setWhere(e.target.value)} maxLength={60} placeholder="0:42" className={FIELD} />
            </>
          )}
          <label className="mt-xs block text-subhead font-semibold" htmlFor={`note-${id}`}>
            {mode === 'comment' ? 'Your comment' : 'What should change?'}
          </label>
          <textarea id={`note-${id}`} value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={500} className={FIELD} />
          <div className="mt-xs">
            <Button size="sm" onClick={() => send(mode === 'change' ? 'changes' : mode === 'paid' ? 'paid_change' : 'comment')} disabled={busy || !note.trim()}>
              {mode === 'comment' ? 'Send the comment' : mode === 'paid' ? 'Send the request' : 'Send the change'}
            </Button>
          </div>
        </div>
      )}
      {sentLine && (
        <p role="status" className="mt-xs m-0 text-subhead">
          {sentLine}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-xs m-0 text-subhead">
          {error}
        </p>
      )}
    </div>
  );
}

/** The one action a to-do line asks for, in a few words that say what happens. */
function actionFor(key: string, href: string): string {
  // Before the `trial-` prefix below, which it would otherwise match.
  if (key === 'trial-rules') return 'Read the trial rules';
  if (key.startsWith('sign-')) return 'Read and sign';
  if (key.startsWith('pay-')) return 'Open the invoice';
  if (key.startsWith('trial-')) return 'Watch the trial video';
  if (key === 'strategy') return 'Join the call';
  if (key === 'retainer') return 'Choose a length';
  if (key === 'review') return 'Review the pieces';
  return href.startsWith('https://') ? 'Open the link' : 'Open';
}

/** Which to-do comes first when there are several: what the work waits on first. */
const ORDER = ['sign-', 'pay-', 'retainer', 'trial-', 'review', 'strategy'];
const rank = (key: string) => {
  const n = ORDER.findIndex((p) => key === p || key.startsWith(p));
  return n < 0 ? ORDER.length : n;
};

/** A real link in the look of a button: an outside address opens in a new tab, `#` stays on the page, the rest is a route here. */
function ActionLink({ href, className, children }: { href: string; className: string; children: React.ReactNode }) {
  if (href.startsWith('https://'))
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
      </a>
    );
  if (href.startsWith('#'))
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  return (
    <Link to={href} className={className}>
      {children}
    </Link>
  );
}

const primaryLink = 'toy inline-flex min-h-[48px] items-center justify-center gap-xs rounded-pill bg-ink px-md text-callout text-on-ink';

/**
 * "Your next step": the one thing to do now as the one solid button, with the other to-dos quieter under it. With nothing waiting it
 * says what is going on at this stage and what shows up next, so the card is never empty.
 */
function NextStep({ view, todo }: { view: PortalView; todo: PortalView['waitingOn'] }) {
  const words = STAGE_COPY[view.stage];
  // The stage's own ask goes first when it is waiting: the length while a retainer is offered, the signature while an agreement is out.
  const lead = view.stage === 'retainer_offer' ? 'retainer' : view.stage === 'agreement_sent' ? 'sign-' : view.stage === 'trial' ? 'trial-' : '';
  const score = (key: string) => (lead && (key === lead || key.startsWith(lead)) ? -1 : rank(key));
  const sorted = [...todo].sort((a, b) => score(a.key) - score(b.key));
  // During the trial with no video in yet, the trial rules are the thing to read.
  if (sorted.length === 0 && view.trial) sorted.push({ key: 'trial-rules', title: 'Read the trial rules', line: 'The rules the trial video is made under.', href: '#trial-heading' });
  const first = sorted.find((w) => w.href) ?? sorted[0] ?? null;
  const rest = sorted.filter((w) => w !== first);
  return (
    <section className="mt-md rounded-card bg-card p-md shadow-toy-soft" aria-labelledby="next-heading" data-next-step>
      <h2 id="next-heading" className="text-title2">
        Your next step
      </h2>
      {first ? (
        <>
          <p className="mt-xs m-0 text-card-title">
            <Inert text={tie(first.title)} />
          </p>
          <p className="mt-xs m-0 text-card-note text-ink-soft">{first.line}</p>
          {first.href && (
            <div className="mt-sm no-print">
              <ActionLink href={first.href} className={primaryLink}>
                {actionFor(first.key, first.href)}
              </ActionLink>
            </div>
          )}
        </>
      ) : (
        <>
          <p className="mt-xs m-0 text-card-title">{COPY.nothingWaiting}</p>
          <p className="mt-xs m-0 text-card-note text-ink-soft">{fill(words.next, view.agencyName)}</p>
        </>
      )}
      {rest.length > 0 && (
        <>
          <h3 className="mt-md text-headline">Also waiting on you</h3>
          <ul className="mt-xs flex list-none flex-col gap-xs p-0 m-0">
            {rest.map((w) => (
              // The words keep at least 60% of the row; when the button does not fit beside them it drops to the bottom right
              // (it used to squeeze "One piece to review" into a narrow column on a phone).
              <li key={w.key} className="flex flex-wrap items-center justify-end gap-sm rounded-inner bg-paper p-sm">
                <span className="min-w-[60%] flex-1">
                  <span className="block text-card-title">
                    <Inert text={tie(w.title)} />
                  </span>
                  <span className="block text-card-note text-ink-soft">{w.line}</span>
                </span>
                {w.href && (
                  <span className="no-print shrink-0">
                    <ActionLink href={w.href} className={linkButton}>
                      {actionFor(w.key, w.href)}
                    </ActionLink>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

/** What this stage means, in three short lines: what you do, what they do, what comes next. */
function StageWords({ view }: { view: PortalView }) {
  const w = STAGE_COPY[view.stage];
  const after = nextStage(view.stage);
  const rows: [string, string][] = [
    ['You', w.you],
    [view.agencyName || 'Your team', fill(w.we, view.agencyName)],
    [after ? `Next: ${AGENCY_STAGE_BY_KEY[after].name}` : 'Next', fill(w.next, view.agencyName)],
  ];
  return (
    <dl className="mt-sm grid gap-xs m-0 sm:grid-cols-3">
      {rows.map(([k, v]) => (
        <div key={k} className="rounded-tile bg-card p-sm shadow-toy-soft">
          <dt className="text-caption font-semibold text-ink-soft">{k}</dt>
          <dd className="m-0 text-subhead">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

const pct = (bps: number) => `${bps % 100 === 0 ? bps / 100 : (bps / 100).toFixed(2)}%`;

/** The retainer: each length as a card to pick (a real radio under it), one Choose button, and a plain confirmation after. */
function Retainer({ token, view, onDone }: { token: string; view: PortalView; onDone: (line: string) => void }) {
  const r = view.retainer;
  const [months, setMonths] = useState<number | null>(r?.chosenMonths ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [changing, setChanging] = useState(false);
  if (!r) return null;
  const agency = view.agencyName || 'They';
  const choose = async () => {
    if (!months) return;
    setBusy(true);
    setError('');
    try {
      await publicApi.portalRetainer(token, months);
      setChanging(false);
      onDone(`You chose ${months} ${months === 1 ? 'month' : 'months'}. ${agency} will confirm it.`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : COPY.failed);
    } finally {
      setBusy(false);
    }
  };
  const picking = r.status === 'offered' || (r.status === 'chosen' && changing);
  const chosen = r.options.find((o) => o.months === r.chosenMonths) ?? null;
  const lengthWord = (n: number) => `${n} ${n === 1 ? 'month' : 'months'}`;
  const details = (o: PortalRetainer['options'][number]) => (
    <>
      <span className="block text-title2">{lengthWord(o.months)}</span>
      <span className="mt-xs block text-headline">{`${money(o.monthlyCents, r.currency)} a month`}</span>
      <span className="block text-subhead text-ink-soft">{o.discountBps > 0 ? `${pct(o.discountBps)} off the monthly fee` : 'No discount'}</span>
      <span className="block text-subhead text-ink-soft">{`${money(o.totalCents, r.currency)} in all`}</span>
    </>
  );
  return (
    <section className="mt-lg" aria-labelledby="retainer-heading">
      <Heading
        id="retainer-heading"
        title={r.status === 'active' ? 'Your retainer' : r.status === 'chosen' && !changing ? 'You chose your retainer' : 'Choose how many months'}
        lede={r.status === 'active' ? 'Pieces and an invoice come every month.' : r.status === 'chosen' && !changing ? `${agency} will confirm it and set the start day. You can change your pick until then.` : 'Pick the length of the retainer. A longer one can cost less each month.'}
      />
      {picking ? (
        <fieldset className="mt-sm m-0 min-w-0 border-0 p-0">
          <legend className="sr-only">Retainer length</legend>
          <div className={`grid gap-sm ${r.options.length === 3 ? 'sm:grid-cols-3' : r.options.length > 1 ? 'sm:grid-cols-2' : ''}`}>
            {r.options.map((o) => {
              const picked = months === o.months;
              return (
                <label key={o.months} className={`toy block cursor-pointer rounded-tile border-2 p-sm has-[input:focus-visible]:outline-[3px] has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-ink ${picked ? 'border-ink bg-card-strong' : 'toy-soft border-line bg-card'}`}>
                  <input type="radio" name="retainer-length" value={o.months} checked={picked} onChange={() => setMonths(o.months)} className="sr-only" />
                  {details(o)}
                  <span className={`mt-xs block text-caption font-semibold ${picked ? '' : 'invisible'}`} aria-hidden={!picked}>
                    Your pick
                  </span>
                </label>
              );
            })}
          </div>
          <div className="mt-sm no-print flex flex-wrap items-center gap-sm">
            <Button onClick={choose} disabled={busy || !months}>
              {busy ? 'Sending' : months ? `Choose ${lengthWord(months)}` : 'Pick a length first'}
            </Button>
            {changing && (
              <Button variant="ghost" onClick={() => setChanging(false)}>
                Keep my pick
              </Button>
            )}
          </div>
        </fieldset>
      ) : (
        <div className="mt-sm rounded-card bg-card p-md shadow-toy-soft" role={r.status === 'chosen' ? 'status' : undefined}>
          {chosen ? details(chosen) : <span className="block text-headline">{r.chosenMonths ? lengthWord(r.chosenMonths) : ''}</span>}
          {r.status === 'chosen' && (
            <>
              <p className="mt-sm m-0 text-headline">{`You chose ${r.chosenMonths ? lengthWord(r.chosenMonths) : 'a length'}. ${agency} will confirm it.`}</p>
              {r.options.length > 1 && (
                <div className="mt-sm no-print">
                  <Button variant="outline" size="sm" onClick={() => { setMonths(r.chosenMonths); setChanging(true); }}>
                    Change my pick
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      )}
      <p className="mt-xs m-0 text-subhead text-ink-soft">
        {`${r.piecesPerMonth} ${r.piecesPerMonth === 1 ? 'piece' : 'pieces'} a month, and ${r.revisionsPerPiece} ${r.revisionsPerPiece === 1 ? 'change' : 'changes'} included in each.`}
        {r.status === 'active' && r.startDay ? ` Started ${dot(r.startDay)}.` : ''}
      </p>
      {error && (
        <p role="alert" className="mt-xs m-0 text-subhead">
          {error}
        </p>
      )}
    </section>
  );
}

/** The pieces a client page shows: the client link's and the team link's alike. */
type PiecesView = Pick<PortalView, 'agencyName' | 'clientName' | 'waiting' | 'coming' | 'published' | 'month' | 'channels'> & {
  show: Pick<PortalView['show'], 'waiting' | 'coming' | 'published' | 'progress' | 'channels'>;
};

/**
 * The work, in the order the client page has always shown it: pieces to review, this month so far, coming up, published and by channel.
 * The client link and the team link both draw it, each with its own doors (`PieceDoors`). `team` names the client in the thread, since
 * the reader at the team link is someone on their team.
 */
function PieceSections({ view: v, doors, nothingWaiting, onDone, team = false }: { view: PiecesView; doors: PieceDoors; nothingWaiting: string; onDone: (line: string) => void; team?: boolean }) {
  return (
    <>
      {v.show.waiting && (
        <section className="mt-lg" aria-labelledby="waiting-heading">
          <Heading id="waiting-heading" title="Pieces to review" lede={v.waiting.length > 0 ? (doors.can.canApprove ? COPY.waitingLede : COPY.waitingViewOnly) : undefined} />
          {v.waiting.length === 0 ? (
            <p className="mt-sm m-0 text-subhead text-ink-soft">
              {nothingWaiting}
            </p>
          ) : (
            <ul className="mt-sm flex flex-col gap-sm p-0 m-0">
              {v.waiting.map((w) => {
                const meta = [DELIVERABLE_KIND_NAME[w.kind], w.platform, w.publishDate ? `goes live ${dot(w.publishDate)}` : ''].filter(Boolean).join(', ');
                return (
                  <Card key={w.id}>
                    <div className="flex items-start justify-between gap-sm">
                      <p className="m-0 min-w-0 text-card-title">
                        <Inert text={tie(w.title)} />
                      </p>
                      <StatusTag tone={DELIVERABLE_STAGE_TONE.review}>{DELIVERABLE_STAGE_META.review.name}</StatusTag>
                    </div>
                    <p className="mt-xs m-0 text-card-note text-ink-soft">{meta}</p>
                    {safe(w.link) && (
                      <p className="mt-sm m-0 no-print">
                        <a href={w.link} target="_blank" rel="noopener noreferrer" className={linkButton}>
                          Watch it
                        </a>
                      </p>
                    )}
                    {w.thread.length > 0 && (
                      <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0" aria-label="Notes">
                        {w.thread.map((t, i) => (
                          <li key={`${t.createdAt}-${i}`} className={`rounded-tile p-sm text-subhead ${t.author === 'client' ? 'bg-paper' : 'bg-card-strong'}`}>
                            <span className="block text-caption font-semibold text-ink-soft">{`${t.author === 'client' ? (t.team ? 'Your team' : team ? v.clientName : 'You') : v.agencyName}${t.kind === 'change' || t.kind === 'paid_change' ? `, ${NOTE_KIND_NAME[t.kind].toLowerCase()}` : ''}`}</span>
                            <span className="whitespace-pre-wrap">
                              <Inert text={t.body} />
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <PieceActions doors={doors} id={w.id} stage="review" changes={w.changes} waiting onDone={onDone} />
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
            <p className="m-0 text-title1 type-figure leading-none">{v.month.planned > 0 ? `${v.month.published} of ${v.month.planned}` : String(v.month.published)}</p>
            <p className="mt-xs m-0 text-subhead text-ink-soft">{v.month.planned > 0 ? 'deliverables live against the plan' : 'deliverables live'}</p>
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
            <p className="mt-sm m-0 text-subhead text-ink-soft">Nothing is being made right now. New pieces show up here once work on them starts.</p>
          ) : (
            <ul className="mt-sm flex flex-col gap-xs p-0 m-0">
              {v.coming.map((c) => (
                <Card key={c.id}>
                  <div className="flex items-start justify-between gap-sm">
                    <div className="min-w-0">
                      <p className="m-0 text-card-title">
                        <Inert text={c.title} />
                      </p>
                      <p className="m-0 text-card-note text-ink-soft">{[DELIVERABLE_KIND_NAME[c.kind], c.platform, c.publishDate ? `goes live ${dot(c.publishDate)}` : ''].filter(Boolean).join(', ')}</p>
                    </div>
                    <StatusTag tone={DELIVERABLE_STAGE_TONE[c.stage]}>{DELIVERABLE_STAGE_META[c.stage].name}</StatusTag>
                  </div>
                  <PieceActions doors={doors} id={c.id} stage={c.stage} changes={c.changes} onDone={onDone} />
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
            <p className="mt-sm m-0 text-subhead text-ink-soft">Nothing has gone live yet. Each piece shows up here on the day it goes live.</p>
          ) : (
            <ul className="mt-sm flex flex-col gap-xs p-0 m-0">
              {v.published.map((p) => (
                <Card key={p.id}>
                  <p className="m-0 text-card-title">
                    <Inert text={p.title} />
                  </p>
                  <p className="m-0 text-card-note text-ink-soft">{[DELIVERABLE_KIND_NAME[p.kind], p.platform, p.publishedAt ? dot(p.publishedAt) : ''].filter(Boolean).join(', ')}</p>
                  {safe(p.link) && (
                    <p className="mt-sm m-0 no-print">
                      <a href={p.link} target="_blank" rel="noopener noreferrer" className={linkButton}>
                        Open it
                      </a>
                    </p>
                  )}
                  <PieceActions doors={doors} id={p.id} stage="published" changes={{ used: 0, allowed: 0 }} onDone={onDone} />
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
                  <span className="min-w-0 text-headline">{ch.channel}</span>
                  <span className="shrink-0 text-subhead font-semibold text-ink-soft">{`${ch.published} live this month, ${ch.open} open`}</span>
                </div>
              </Card>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

/** One row in the documents list: what it is, its status as a tag, and a chevron to open it. */
type DocRow = { key: string; href: string; title: string; line: string; tone: TagTone; status: string };
function docRows(v: PortalView): DocRow[] {
  const rows: DocRow[] = [];
  if (v.show.contracts) for (const k of v.contracts) rows.push({ key: `k-${k.token}`, href: `/k/${k.token}`, title: k.title, line: 'Agreement', tone: k.status === 'sent' ? 'warn' : CONTRACT_STATUS_TONE[k.status], status: k.status === 'sent' ? 'To sign' : CONTRACT_STATUS_NAME[k.status] });
  if (v.show.invoices)
    for (const inv of v.invoices) rows.push({ key: `i-${inv.token}`, href: `/i/${inv.token}`, title: `Invoice ${inv.number}`, line: `${money(inv.totalCents, inv.currency)}, ${dot(inv.issueDate)}`, tone: inv.overdue ? 'bad' : inv.status === 'sent' ? 'warn' : INVOICE_STATUS_TONE[inv.status], status: inv.overdue ? 'Overdue' : inv.status === 'sent' ? 'To pay' : INVOICE_STATUS_NAME[inv.status] });
  if (v.show.docs) for (const d of v.docs) rows.push({ key: `d-${d.token}`, href: `/d/${d.token}`, title: d.title, line: AGENCY_DOC_KIND_META[d.kind].name, tone: d.status === 'sent' ? 'info' : AGENCY_DOC_STATUS_TONE[d.status], status: d.status === 'sent' ? 'To read' : AGENCY_DOC_STATUS_NAME[d.status] });
  return rows;
}

/** The client's dashboard at the link their agency or freelancer sent: the stage bar, what is waiting, and the parts that were switched on. A password may stand in front. */
export function ClientPortal() {
  const { token = '' } = useParams();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['agency', 'portal', token], queryFn: () => publicApi.portal(token), retry: false });
  const [said, setSaid] = useState('');
  const [ended, setEnded] = useState(false);
  const v = q.data;
  const locked = q.error instanceof ApiError && q.error.status === 401 && q.error.data.error === 'locked';
  const link = `agency:${token}`;
  // A kept unlock for this link the server no longer accepts (twelve hours, or the password changed) is dropped, so it is not sent again.
  // Other clients' links keep theirs. The lock screen then says why it came back.
  useEffect(() => {
    if (!locked) return;
    if (hadPortalSession(link)) setEnded(true);
    forgetPortalSessions(link);
  }, [locked, link]);
  // When the pieces are shown, the lines that only point at them are kept for the next-step card and left out of the pieces list.
  const todoLines = (v?.waitingOn ?? []).map((w) => (w.href === '#waiting-heading' && !v?.show.waiting ? { ...w, href: null } : w));
  const done = (line: string) => {
    setSaid(line);
    void qc.invalidateQueries({ queryKey: ['agency', 'portal', token] });
  };

  if (locked) {
    const data = (q.error as ApiError).data;
    return (
      <SiteLayout wide={false} minimal>
        <PortalLock
          clientName={String(data.clientName ?? '')}
          agencyName={String(data.agencyName ?? '')}
          agencyLogo={String(data.agencyLogo ?? '')}
          ended={ended}
          link={link}
          ask={{ kind: 'agency', token }}
          unlock={(pw) => publicApi.portalUnlock(token, pw)}
          onOpen={() => {
            setEnded(false);
            void qc.invalidateQueries({ queryKey: ['agency', 'portal', token] });
          }}
        />
      </SiteLayout>
    );
  }

  // Before the onboarding form is sent the server sends only who it is from and the form, so nothing of the dashboard is read.
  const onboarding = Boolean(v?.onboarding?.needed && !v.onboarding.done);
  const dash = v && !onboarding ? v : undefined;
  const docs = dash ? docRows(dash) : [];
  const showDocs = Boolean(dash && (dash.show.contracts || dash.show.invoices || dash.show.docs));
  const words = dash ? STAGE_COPY[dash.stage] : null;

  return (
    <SiteLayout wide={false} minimal>
      <div className="pt-lg">
        {q.isPending && (
          <Busy label="Loading your page" className="grid gap-md">
            <Skeleton className="h-[56px] w-1/2" />
            <SkeletonCard lines={4} />
            <SkeletonCard lines={3} />
          </Busy>
        )}
        {q.isError && <LinkTrouble error={q.error} onRetry={() => void q.refetch()} />}
        {v && onboarding && (
          <>
            <header>
              <AgencyMark name={v.agencyName} logo={v.agencyLogo} />
              <h1 className="mt-md text-large-title">{`Hello, ${v.clientName}`}</h1>
              <p className="mt-xs m-0 text-callout text-ink-soft">A short form first. Then your page opens.</p>
            </header>
            <ClientOnboarding token={token} agencyName={v.agencyName} clientName={v.clientName} onDone={() => void qc.invalidateQueries({ queryKey: ['agency', 'portal', token] })} />
            <PasswordAsk kind="agency" token={token} agencyName={v.agencyName} />
          </>
        )}
        {v && dash && words && (
          <article className="print-doc">
            <header>
              <AgencyMark name={v.agencyName} logo={v.agencyLogo} />
              <h1 className="mt-md text-[30px]">{`Hello, ${v.clientName}`}</h1>
              <p className="mt-xs m-0 text-callout text-ink-soft">Where your work stands, and what to do next.</p>
            </header>
            {said && (
              <p role="status" className="mt-md m-0 rounded-tile p-sm text-subhead font-semibold" style={{ background: 'var(--tint-green)' }}>
                {said}
              </p>
            )}

            <div className="mt-md rounded-card bg-card p-md shadow-toy-soft">
              <StageBar stage={v.stage} lineText={words.now} />
            </div>

            <NextStep view={v} todo={todoLines} />

            <section className="mt-lg" aria-labelledby="stage-words-heading">
              <Heading id="stage-words-heading" title="At this step" />
              <StageWords view={v} />
            </section>

            {v.strategy && (v.stage === 'agreement_signed' || v.stage === 'strategy') && (
              <section className="mt-lg" aria-labelledby="strategy-heading">
                <Heading id="strategy-heading" title="Strategy session" />
                <div className="mt-sm rounded-card bg-card p-md shadow-toy-soft">
                  <p className="m-0 font-display text-[22px] font-extrabold leading-tight">{v.strategy.day ? dot(v.strategy.day) : 'A day will be shared here'}</p>
                  {v.strategy.link && safe(v.strategy.link) && (
                    <p className="mt-sm m-0 no-print">
                      <a href={v.strategy.link} target="_blank" rel="noopener noreferrer" className={linkButton}>
                        Join the call
                      </a>
                    </p>
                  )}
                  <p className="mt-xs m-0 text-subhead text-ink-soft">Bring your brand guide and three to five videos that show the feel you want.</p>
                </div>
              </section>
            )}

            {v.trial && (
              <section className="mt-lg" aria-labelledby="trial-heading">
                <Heading id="trial-heading" title="The trial video" lede={v.trial.due ? `Due ${dot(v.trial.due)}. These are the rules it is made under.` : 'These are the rules it is made under.'} />
                <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
                  {v.trial.rules.map((r) => (
                    <Card key={r.key}>
                      <p className="m-0 text-subhead font-semibold">{r.text}</p>
                      <p className="mt-xs m-0 text-caption text-ink-soft">{r.source}</p>
                    </Card>
                  ))}
                </ul>
              </section>
            )}

            {v.pilot && (
              <section className="mt-lg" aria-labelledby="pilot-heading">
                <Heading id="pilot-heading" title="Pilot month" />
                <div className="mt-sm rounded-card bg-card p-md shadow-toy-soft">
                  <p className="m-0 text-headline">{[v.pilot.start ? `Starts ${dot(v.pilot.start)}` : '', v.pilot.end ? `ends ${dot(v.pilot.end)}` : ''].filter(Boolean).join(', ')}</p>
                </div>
              </section>
            )}

            <Retainer token={token} view={v} onDone={done} />

            <PieceSections
              view={v}
              doors={{ can: v.show, decide: (id, body) => publicApi.portalDecide(token, id, body), paidChange: true }}
              nothingWaiting={PIECE_STAGES.has(v.stage) ? `${COPY.nothingWaiting} ${fill(words.next, v.agencyName)}` : COPY.nothingWaiting}
              onDone={done}
            />

            {v.show.hours && v.hours && (
              <section className="mt-lg" aria-labelledby="hours-heading">
                <Heading id="hours-heading" title="Hours" />
                <div className="mt-sm rounded-card bg-card p-md shadow-toy-soft">
                  <p className="m-0 font-display text-[28px] font-extrabold leading-none">{minutesLabel2(v.hours.usedMinutes)}</p>
                  <p className="mt-xs m-0 text-subhead text-ink-soft">{v.hours.includedMinutes > 0 ? `worked this month, of ${minutesLabel2(v.hours.includedMinutes)} included` : 'worked this month'}</p>
                  {v.hours.includedMinutes > 0 && (
                    <div className="mt-sm h-[8px] overflow-hidden rounded-pill bg-line" role="img" aria-label={`${minutesLabel2(v.hours.usedMinutes)} of ${minutesLabel2(v.hours.includedMinutes)}`}>
                      <div className="h-full rounded-pill" style={{ width: `${Math.min(100, Math.round((v.hours.usedMinutes / v.hours.includedMinutes) * 100))}%`, background: 'var(--color-r5)' }} />
                    </div>
                  )}
                </div>
              </section>
            )}

            {showDocs && (
              <section className="mt-lg" aria-labelledby="docs-heading">
                <Heading id="docs-heading" title="Your documents" />
                {docs.length === 0 ? (
                  <p className="mt-sm m-0 text-subhead text-ink-soft">{COPY.docsEmpty}</p>
                ) : (
                  <ul className="mt-sm flex flex-col gap-xs p-0 m-0">
                    {docs.map((d) => (
                      <Card key={d.key}>
                        <div className="flex flex-wrap items-center justify-between gap-sm">
                          <Link to={d.href} className="flex min-h-[44px] min-w-0 flex-[1_1_220px] items-center gap-xs text-ink">
                            <span className="min-w-0">
                              <span className={`block ${d.line !== d.title ? 'text-card-title' : 'text-headline'}`}>
                                <Inert text={tie(d.title)} />
                              </span>
                              {d.line !== d.title && <span className="block text-card-note text-ink-soft">{d.line}</span>}
                            </span>
                          </Link>
                          <span className="flex shrink-0 items-center gap-xs">
                            <StatusTag tone={d.tone}>{d.status}</StatusTag>
                            <Link to={`${d.href}?print=1`} className={`${linkButton} no-print`} aria-label={`Download ${d.title}`}>
                              Download
                            </Link>
                          </span>
                        </div>
                      </Card>
                    ))}
                  </ul>
                )}
              </section>
            )}

            <div className="mt-xl no-print flex flex-wrap items-center gap-sm">
              <Button variant="outline" size="sm" onClick={() => printAs(fileTitle('Dashboard', v.clientName))}>
                Print or save as PDF
              </Button>
              {v.agencyEmail && (
                <a href={`mailto:${v.agencyEmail}`} className={linkButton}>
                  {`Email ${v.agencyName || 'them'}`}
                </a>
              )}
            </div>
            <PasswordAsk kind="agency" token={token} agencyName={v.agencyName} />
          </article>
        )}
      </div>
    </SiteLayout>
  );
}

/**
 * The team link (`/t/:token`, 2026-11-04): the client page for the client's own team, a junior who sees the work and none of the paper.
 * The server sends only the work (`TeamLinkView` has no paper field), its unlock is its own (kept and sent apart from the client link's),
 * and approvals, when the owner allows them, are recorded as from the client's team.
 */
export function TeamPortal() {
  const { token = '' } = useParams();
  const qc = useQueryClient();
  const key = ['agency', 'team-link', token];
  const q = useQuery({ queryKey: key, queryFn: () => teamLinkApi.page(token), retry: false });
  const [said, setSaid] = useState('');
  const [ended, setEnded] = useState(false);
  const v = q.data;
  const locked = q.error instanceof ApiError && q.error.status === 401 && q.error.data.error === 'locked';
  const link = `team:${token}`;
  useEffect(() => {
    if (!locked) return;
    if (hadTeamLinkSession(link)) setEnded(true);
    forgetTeamLinkSessions(link);
  }, [locked, link]);
  const done = (line: string) => {
    setSaid(line);
    void qc.invalidateQueries({ queryKey: key });
  };

  if (locked) {
    const data = (q.error as ApiError).data;
    return (
      <SiteLayout wide={false} minimal>
        <PortalLock
          clientName={`${String(data.clientName ?? '')} team`.trim()}
          agencyName={String(data.agencyName ?? '')}
          agencyLogo={String(data.agencyLogo ?? '')}
          ended={ended}
          link={link}
          keep={keepTeamLinkSession}
          ask={{ kind: 'team', token }}
          unlock={(pw) => teamLinkApi.unlock(token, pw)}
          onOpen={() => {
            setEnded(false);
            void qc.invalidateQueries({ queryKey: key });
          }}
        />
      </SiteLayout>
    );
  }

  const anything = v ? v.show.waiting || v.show.coming || v.show.published || v.show.progress || v.show.channels : false;
  return (
    <SiteLayout wide={false} minimal>
      <div className="pt-lg">
        {q.isPending && (
          <Busy label="Loading the team page" className="grid gap-md">
            <Skeleton className="h-[56px] w-1/2" />
            <SkeletonCard lines={4} />
          </Busy>
        )}
        {q.isError && <LinkTrouble error={q.error} onRetry={() => void q.refetch()} />}
        {v && (
          <article className="print-doc" data-team-view>
            <header>
              <AgencyMark name={v.agencyName} logo={v.agencyLogo} />
              <h1 className="mt-md text-[30px]">{`Hello, ${v.clientName} team`}</h1>
              <p className="mt-xs m-0 text-callout text-ink-soft">Where the work stands.</p>
              <p className="mt-sm m-0 rounded-tile bg-paper p-sm text-subhead">Team view: paperwork and payments are not shown here.</p>
              {v.show.canApprove && <p className="mt-xs m-0 text-subhead text-ink-soft">{`What you approve or send back is recorded as from ${v.clientName}'s team.`}</p>}
            </header>
            {said && (
              <p role="status" className="mt-md m-0 rounded-tile p-sm text-subhead font-semibold" style={{ background: 'var(--tint-green)' }}>
                {said}
              </p>
            )}
            {anything ? (
              <PieceSections
                view={v}
                team
                doors={{ can: v.show, decide: (id, body) => teamLinkApi.decide(token, id, { ...body, decision: body.decision === 'paid_change' ? 'changes' : body.decision }), paidChange: false, noneLeft: `No changes are left on this piece. Ask ${v.clientName} about a further one.` }}
                nothingWaiting={COPY.nothingWaiting}
                onDone={done}
              />
            ) : (
              <p className="mt-lg m-0 text-callout text-ink-soft">Nothing is shared on this link yet.</p>
            )}
            <div className="mt-xl no-print flex flex-wrap items-center gap-sm">
              <Button variant="outline" size="sm" onClick={() => printAs(fileTitle('Team view', v.clientName))}>
                Print or save as PDF
              </Button>
              {v.agencyEmail && (
                <a href={`mailto:${v.agencyEmail}`} className={linkButton}>
                  {`Email ${v.agencyName || 'them'}`}
                </a>
              )}
            </div>
            <PasswordAsk kind="team" token={token} agencyName={v.agencyName} />
          </article>
        )}
      </div>
    </SiteLayout>
  );
}
