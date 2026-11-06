import { contractAsText, docDateTime, type ContractAnswer } from '@kreators/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { Button } from '../components/Button';
import { ContractView, paperDate } from '../components/ContractView';
import { DocActions, JumpToBar } from '../components/DocActions';
import { Busy, Skeleton, SkeletonCard } from '../components/Skeleton';
import type { SheetStamp } from '../components/PrintSheet';
import { Inert } from '../components/Inert';
import { CopyTextButton, LinkTrouble } from '../components/PortalLock';
import { ApiError, publicApi } from '../lib/api';
import { fileTitle, useAutoPrint } from '../lib/printDoc';
import { SiteLayout } from './SiteLayout';
import { FIELD } from '../lib/ui';

const COPY = {
  idle: 'Your answers save as you type.',
  saving: 'Saving',
  saved: 'Saved',
  failed: 'Not saved yet. We will try again.',
  kept: 'Not saved. Your answers stay on this page and are sent when you sign.',
  typed: 'Typing your name is your acceptance of this agreement. It is typed acceptance, not a certified e-signature.',
  agree: ['I have read this agreement,', 'and I agree to it.'],
};

/**
 * Answers typed but not saved when the link locked again (the password changed, or its twelve hours ran out). The lock screen takes the
 * page's place, so they wait here, in this tab's memory only, and come back and save once the link is open again.
 */
const unsaved = new Map<string, Record<string, ContractAnswer>>();
/** How long to wait before the next try after a failed save: 5 s, then twice as long each time, never more than a minute. */
const retryMs = (tries: number) => Math.min(60_000, 5_000 * 2 ** tries);

/** The client's agreement: read it, answer the brief, ask for a change, and accept by typing a name. */
export function ContractPublic() {
  const { token = '' } = useParams();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['contract', token], queryFn: () => publicApi.contract(token), retry: false });
  const d = q.data;
  const [answers, setAnswers] = useState<Record<string, ContractAnswer>>({});
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [agree, setAgree] = useState(false);
  const [ask, setAsk] = useState('');
  const [sent, setSent] = useState(false);
  // Once it is signed the answers on the page are the ones that were kept. Before that, the brief the client already answered in the
  // onboarding form comes in filled, and so do their name and role, so accepting is a check and a tick, not typing it all again.
  useEffect(() => {
    if (!d) return;
    if (d.status === 'signed') setAnswers(d.answers);
    else if (d.status === 'sent' && Object.keys(d.answers ?? {}).length > 0) setAnswers((m) => (Object.keys(m).length ? m : d.answers));
  }, [d]);
  useEffect(() => {
    if (d?.status !== 'sent') return;
    setName((n) => n || (d.doc.vars.pocName || d.doc.vars.clientContact || '').trim());
    setTitle((t) => t || (d.doc.vars.clientTitle ?? '').trim());
  }, [d]);
  useAutoPrint(Boolean(d), fileTitle('Agreement', d?.doc.vars.client, d?.doc.title));

  // The brief's answers save as they are typed: 800 ms after the last change, and at once when a field is left, so nothing is lost if the
  // client goes before signing. A failed save is tried again a little later; once the agreement is signed (409) the page reloads.
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'failed' | 'kept'>('idle');
  const latest = useRef<Record<string, ContractAnswer> | null>(null);
  const timer = useRef<number | null>(null);
  const saving = useRef(false);
  const tries = useRef(0);
  const stopTimer = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  };
  const saveAnswers = async () => {
    stopTimer();
    const next = latest.current;
    if (!next || saving.current) return;
    latest.current = null;
    saving.current = true;
    setSaveState('saving');
    try {
      await publicApi.contractAnswers(token, next);
      saving.current = false;
      tries.current = 0;
      if (latest.current) void saveAnswers();
      else setSaveState('saved');
    } catch (e) {
      saving.current = false;
      const waiting = latest.current ?? next;
      if (e instanceof ApiError && (e.status === 409 || e.status === 404)) {
        setSaveState('idle');
        void q.refetch();
        return;
      }
      // The link locked again: keep what was typed, and ask the gate to show the lock screen. Once it is open again the answers come
      // back and save (the effect below).
      if (e instanceof ApiError && e.status === 401 && e.data.error === 'locked') {
        latest.current = null;
        unsaved.set(token, waiting);
        setSaveState('idle');
        void qc.invalidateQueries({ queryKey: ['portal-lock', 'contracts', token] });
        return;
      }
      // Refused for a reason a retry cannot change: stop trying, and say plainly that signing still sends them.
      if (e instanceof ApiError && e.status >= 400 && e.status < 500 && e.status !== 408 && e.status !== 429) {
        latest.current = waiting;
        setSaveState('kept');
        return;
      }
      // Offline, busy or too many tries: keep what was not saved (unless something newer is waiting) and try again, waiting longer each time.
      latest.current = waiting;
      setSaveState('failed');
      timer.current = window.setTimeout(() => void saveAnswers(), retryMs(tries.current));
      tries.current += 1;
    }
  };
  const answer = (id: string, a: ContractAnswer) => {
    setAnswers((m) => {
      const next = { ...m, [id]: a };
      latest.current = next;
      return next;
    });
    // A change waiting for its save is not "Saved" yet.
    setSaveState('saving');
    stopTimer();
    timer.current = window.setTimeout(() => void saveAnswers(), 800);
  };
  const saveNow = () => {
    if (latest.current) void saveAnswers();
  };
  useEffect(() => () => stopTimer(), []);
  // Answers that waited through the lock screen come back over the saved ones and are sent again.
  useEffect(() => {
    if (d?.status !== 'sent') return;
    const back = unsaved.get(token);
    if (!back) return;
    unsaved.delete(token);
    setAnswers(back);
    latest.current = back;
    void saveAnswers();
  }, [d, token]);
  // A tab put away or closed sends what is waiting.
  useEffect(() => {
    const away = () => {
      if (document.visibilityState === 'hidden') saveNow();
    };
    document.addEventListener('visibilitychange', away);
    return () => document.removeEventListener('visibilitychange', away);
  });

  const accept = useMutation({
    mutationFn: () => {
      // Signing sends the answers itself, so a save still waiting is not needed.
      stopTimer();
      latest.current = null;
      return publicApi.contractAccept(token, { name: name.trim(), title: title.trim(), agree, answers });
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['contract', token] }),
  });
  const comment = useMutation({
    mutationFn: () => publicApi.contractComment(token, ask.trim()),
    onSuccess: () => {
      setAsk('');
      setSent(true);
      void qc.invalidateQueries({ queryKey: ['contract', token] });
    },
  });
  const stamp: SheetStamp | null = d?.status === 'signed' ? 'signed' : d?.revisedAt ? 'revised' : null;

  return (
    <SiteLayout wide={false} minimal>
      <div className="pt-lg">
        {q.isPending && (
          <Busy label="Loading the agreement" className="grid gap-md">
            <Skeleton className="h-[48px] w-1/2" />
            <SkeletonCard lines={10} />
          </Busy>
        )}
        {q.isError && <LinkTrouble error={q.error} what="agreement" onRetry={() => void q.refetch()} />}
        {d && (
          <>
            <div className="no-print mb-md flex flex-wrap items-center justify-between gap-sm">
              <p className="m-0 text-subhead text-ink-soft">
                From <strong className="text-ink">{d.ownerName}</strong>
                {d.revisedAt ? ` · Revised ${paperDate(d.revisedAt)}` : ''}
              </p>
              <span className="flex flex-wrap items-center gap-sm">
                <DocActions fileName={fileTitle('Agreement', d.doc.vars.client, d.doc.title)} />
                <CopyTextButton text={() => contractAsText(d.doc, { reference: d.ref, date: d.sentAt ?? undefined, answers, acceptance: d.acceptance })} />
              </span>
            </div>

            <div onBlur={d.status === 'sent' ? saveNow : undefined}>
            <ContractView
              doc={d.doc}
              answers={answers}
              onAnswer={d.status === 'sent' ? answer : undefined}
              briefNote={
                d.status === 'sent' ? (
                  <p role="status" className="brief-save no-print m-0 text-caption text-ink-mute" data-state={saveState}>
                    {COPY[saveState]}
                  </p>
                ) : undefined
              }
              acceptance={d.acceptance}
              reference={d.ref}
              date={d.sentAt ?? undefined}
              stamp={stamp}
              signLine={d.status === 'sent' && name.trim() ? { name: name.trim(), title: title.trim() } : null}
            />
            </div>

            {d.status === 'signed' && d.acceptance && (
              <p role="status" className="mt-md m-0 rounded-tile p-sm text-headline" style={{ background: 'var(--tint-green)' }}>
                Accepted electronically by {d.acceptance.name}
                {d.acceptance.title ? `, ${d.acceptance.title}` : ''} on {docDateTime(d.acceptance.at)}. Typed acceptance, not a certified e-signature.
              </p>
            )}

            {d.status === 'sent' && (
              <form
                className="no-print mt-lg rounded-card bg-card p-md shadow-toy"
                aria-labelledby="accept-heading"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (name.trim() && agree) accept.mutate();
                }}
              >
                <h2 id="accept-heading" className="text-title2">
                  Accept this agreement
                </h2>
                <p className="mt-xs m-0 text-balance text-subhead text-ink-soft">Answer the brief above first if it has one. {COPY.typed}</p>
                <label className="mt-sm block text-subhead font-semibold" htmlFor="k-name">
                  Your full name
                </label>
                <input id="k-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="name" className={FIELD} />
                <label className="mt-sm block text-subhead font-semibold" htmlFor="k-title">
                  Your title
                </label>
                <input id="k-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} autoComplete="organization-title" className={FIELD} />
                <label className="mt-sm flex min-h-[44px] cursor-pointer items-center gap-xs text-headline">
                  <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="size-[20px] shrink-0 accent-[var(--color-ink)]" />
                  {/* In a span of its own, so the label's words are a block the rectangle rule reaches; kept whole up to the comma. */}
                  <span>
                    <span className="inline-block">{COPY.agree[0]}</span> <span className="inline-block">{COPY.agree[1]}</span>
                  </span>
                </label>
                {accept.isError && (
                  <p role="alert" className="mt-sm m-0 text-subhead">
                    {accept.error instanceof ApiError ? accept.error.message : 'That did not work. Try again.'}
                  </p>
                )}
                <div className="mt-sm">
                  <Button type="submit" full disabled={!name.trim() || !agree || accept.isPending}>
                    {accept.isPending ? 'Accepting' : 'Accept'}
                  </Button>
                </div>
              </form>
            )}

            {d.status === 'sent' && <JumpToBar targetId="accept-heading" label={(d.doc.sections ?? []).some((x) => x.kind === 'brief') ? 'Answer and sign' : 'Sign this agreement'} />}

            {d.doc.show.comments && (
              <section className="no-print mt-lg" aria-labelledby="ask-heading">
                <h2 id="ask-heading" className="text-title2">
                  Ask for a change
                </h2>
                <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
                  {d.comments.map((m) => (
                    <li key={m.id} className={`rounded-tile p-sm shadow-toy-soft ${m.author === 'client' ? 'bg-card-strong' : 'bg-card'}`}>
                      <p className="m-0 text-eyebrow uppercase text-ink-soft">
                        {m.author === 'client' ? 'You' : d.ownerName} · {paperDate(m.createdAt)}
                      </p>
                      <p className="mt-xs m-0 whitespace-pre-wrap text-prose">
                        <Inert text={m.body} />
                      </p>
                    </li>
                  ))}
                </ul>
                <form
                  className="mt-sm"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (ask.trim()) comment.mutate();
                  }}
                >
                  <label className="block text-subhead font-semibold" htmlFor="k-ask">
                    What would you like changed?
                  </label>
                  <textarea id="k-ask" value={ask} onChange={(e) => { setAsk(e.target.value); setSent(false); }} rows={3} maxLength={600} className={FIELD} />
                  {comment.isError && (
                    <p role="alert" className="mt-xs m-0 text-subhead">
                      {comment.error instanceof ApiError ? comment.error.message : 'That did not send. Try again.'}
                    </p>
                  )}
                  {sent && <p role="status" className="mt-xs m-0 text-subhead font-semibold">Sent. They have been told.</p>}
                  <div className="mt-xs">
                    <Button type="submit" size="sm" variant="outline" full disabled={comment.isPending || !ask.trim()}>
                      {comment.isPending ? 'Sending' : 'Send'}
                    </Button>
                  </div>
                </form>
              </section>
            )}
            <p className="no-print mt-md m-0 text-caption text-ink-mute">Made with kreators.app</p>
          </>
        )}
      </div>
    </SiteLayout>
  );
}
