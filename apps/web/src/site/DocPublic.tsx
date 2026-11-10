import { AGENCY_DOC_KIND_META, contractAsText, docDateTime, type ContractAnswer } from '@kreators/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
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
  typed: 'Typing your name is your approval of this document. It is typed approval, not a certified e-signature.',
  agree: ['I have read this document,', 'and I approve it.'],
};

/** The client's document: read it, answer any questions in it, ask for a change, and approve it by typing a name. */
export function DocPublic() {
  const { token = '' } = useParams();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['agency-doc', token], queryFn: () => publicApi.agencyDoc(token), retry: false });
  const d = q.data;
  useAutoPrint(Boolean(d), fileTitle(d ? AGENCY_DOC_KIND_META[d.kind].name : 'Document', d?.doc.vars.client, d?.doc.title));
  const [answers, setAnswers] = useState<Record<string, ContractAnswer>>({});
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [agree, setAgree] = useState(false);
  const [ask, setAsk] = useState('');
  const [sent, setSent] = useState(false);
  // Once it is signed the answers on the page are the ones that were kept; until then they are the client's own, typed here.
  useEffect(() => {
    if (d?.status === 'approved') setAnswers(d.answers);
  }, [d?.status, d?.answers]);

  const accept = useMutation({
    mutationFn: () => publicApi.agencyDocApprove(token, { name: name.trim(), title: title.trim(), agree, answers }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['agency-doc', token] }),
  });
  const comment = useMutation({
    mutationFn: () => publicApi.agencyDocComment(token, ask.trim()),
    onSuccess: () => {
      setAsk('');
      setSent(true);
      void qc.invalidateQueries({ queryKey: ['agency-doc', token] });
    },
  });
  const stamp: SheetStamp | null = d?.status === 'approved' ? 'approved' : d?.status === 'revised' ? 'revised' : null;

  return (
    <SiteLayout wide={false} minimal>
      <div className="pt-lg">
        {q.isPending && (
          <Busy label="Loading the document" className="grid gap-md">
            <Skeleton className="h-[48px] w-1/2" />
            <SkeletonCard lines={10} />
          </Busy>
        )}
        {q.isError && <LinkTrouble error={q.error} what="document" onRetry={() => void q.refetch()} />}
        {d && (
          <>
            <div className="no-print mb-md flex flex-wrap items-center justify-between gap-sm">
              <p className="m-0 text-subhead text-ink-soft">
                From <strong className="text-ink">{d.ownerName}</strong>
                {d.revisedAt ? ` · Revised ${paperDate(d.revisedAt)}` : ''}
              </p>
              <span className="flex flex-wrap items-center gap-sm">
                <DocActions fileName={fileTitle(AGENCY_DOC_KIND_META[d.kind].name, d.doc.vars.client, d.doc.title)} />
                <CopyTextButton text={() => contractAsText(d.doc, { reference: d.ref, date: d.sentAt ?? undefined, answers, acceptance: d.acceptance })} />
              </span>
            </div>

            <ContractView
              kind="document"
              doc={d.doc}
              answers={answers}
              onAnswer={d.status !== 'approved' ? (id, a) => setAnswers((m) => ({ ...m, [id]: a })) : undefined}
              acceptance={d.acceptance}
              reference={d.ref}
              date={d.sentAt ?? undefined}
              stamp={stamp}
              signLine={d.status !== 'approved' && name.trim() ? { name: name.trim(), title: title.trim() } : null}
            />

            {d.status === 'approved' && d.acceptance && (
              <p role="status" className="mt-md m-0 rounded-tile p-sm text-headline" style={{ background: 'var(--tint-green)' }}>
                Approved electronically by {d.acceptance.name}
                {d.acceptance.title ? `, ${d.acceptance.title}` : ''} on {docDateTime(d.acceptance.at)}. Typed approval, not a certified e-signature.
              </p>
            )}

            {d.status !== 'approved' && (
              <form
                className="no-print mt-lg rounded-card bg-card p-md shadow-toy"
                aria-labelledby="approve-heading"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (name.trim() && agree) accept.mutate();
                }}
              >
                <h2 id="approve-heading" className="text-title2">
                  Approve this document
                </h2>
                <p className="mt-xs m-0 text-balance text-subhead text-ink-soft">Answer the questions above first if it has any. {COPY.typed}</p>
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
                  <Button low type="submit" full disabled={!name.trim() || !agree || accept.isPending}>
                    {accept.isPending ? 'Approving' : 'Approve'}
                  </Button>
                </div>
              </form>
            )}

            {d.status !== 'approved' && <JumpToBar targetId="approve-heading" label={(d.doc.sections ?? []).some((x) => x.kind === 'brief') ? 'Answer and approve' : 'Approve this document'} />}

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
                    <Button low type="submit" size="sm" variant="outline" full disabled={comment.isPending || !ask.trim()}>
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
