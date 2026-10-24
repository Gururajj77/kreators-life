import type { Introduction } from '@kreators/shared';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { Sheet } from '../components/Sheet';
import { Toggle } from '../components/Toggle';
import { api } from '../lib/api';
import { useAuthed, useMe, useRefreshAll } from '../lib/queries';

const field = 'mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]';

function Err({ e }: { e: unknown }) {
  if (!e) return null;
  return (
    <p role="alert" className="m-0 rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
      {e instanceof Error ? e.message : 'That did not work.'}
    </p>
  );
}

interface Person {
  userId: string;
  name: string;
}

export function Bond() {
  const me = useMe();
  const q = useAuthed(['bond'], api.bond);
  const refresh = useRefreshAll();
  const [asking, setAsking] = useState<Person | null>(null);
  const [blocking, setBlocking] = useState<Person | null>(null);
  const optIn = useMutation({
    mutationFn: (on: boolean) => api.updateMe({ openToIntros: on }),
    onSuccess: () => {
      refresh();
      q.refetch();
    },
  });
  const answer = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'accepted' | 'declined' }) => api.answerIntro(id, status),
    onSuccess: () => {
      refresh();
      q.refetch();
    },
  });
  const d = q.data;
  const myId = me.data?.user.id ?? '';
  const optedIn = d?.optedIn ?? me.data?.user.openToIntros ?? false;
  const incoming = (d?.intros ?? []).filter((i) => i.recipientId === myId && i.status === 'proposed');
  const rest = (d?.intros ?? []).filter((i) => !(i.recipientId === myId && i.status === 'proposed'));
  const other = (i: Introduction): Person => (i.requesterId === myId ? { userId: i.recipientId, name: i.recipientName } : { userId: i.requesterId, name: i.requesterName });

  return (
    <Screen>
      <header className="pt-lg">
        <h1 className="text-[30px]">Bond</h1>
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Introductions to people you met at events, only when both of you want them.</p>
      </header>

      <section className="mt-md" aria-label="Introductions switch">
        <Toggle on={optedIn} onChange={(on) => optIn.mutate(on)} disabled={optIn.isPending} label="Open to introductions" hint="Your details only move after the other person says yes." />
        <Err e={optIn.isError ? optIn.error : null} />
      </section>

      {q.isError && (
        <div className="mt-md rounded-card bg-card p-md shadow-toy-soft" role="alert">
          <p className="m-0 font-bold">Could not load introductions.</p>
          <Button variant="outline" className="mt-sm" onClick={() => q.refetch()}>
            Try again
          </Button>
        </div>
      )}

      {d && (
        <>
          {incoming.length > 0 && (
            <section className="mt-lg" aria-labelledby="incoming-heading">
              <h2 id="incoming-heading" className="text-[24px]">
                Would like to meet you
              </h2>
              <Err e={answer.isError ? answer.error : null} />
              <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
                {incoming.map((i) => (
                  <li key={i.id} className="rounded-tile bg-card p-sm shadow-toy-soft">
                    <p className="m-0 text-[16px] font-bold">{i.requesterName}</p>
                    {i.context && <p className="m-0 text-[14px] font-semibold text-ink-soft">{i.context}</p>}
                    <div className="mt-sm flex flex-wrap gap-xs">
                      <Button onClick={() => answer.mutate({ id: i.id, status: 'accepted' })} disabled={answer.isPending}>
                        Yes, introduce us
                      </Button>
                      <Button variant="outline" onClick={() => answer.mutate({ id: i.id, status: 'declined' })} disabled={answer.isPending}>
                        No thanks
                      </Button>
                      <Button variant="ghost" onClick={() => setBlocking({ userId: i.requesterId, name: i.requesterName })}>
                        Block
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="mt-lg" aria-labelledby="suggest-heading">
            <h2 id="suggest-heading" className="text-[24px]">
              People you met
            </h2>
            {!optedIn && <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Switch introductions on to see who else from your events is open to meeting.</p>}
            {optedIn && d.suggestions.length === 0 && <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Nobody yet. RSVP to an event in Party and tick "happy to be introduced".</p>}
            <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
              {d.suggestions.map((s) => (
                <li key={s.userId} className="flex items-center gap-sm rounded-tile bg-card p-sm shadow-toy-soft">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[16px] font-bold">
                      {s.name}
                      {s.handle ? <span className="font-semibold text-ink-soft"> @{s.handle}</span> : ''}
                    </span>
                    <span className="block text-[14px] font-semibold text-ink-soft">
                      {s.context}
                      {s.skills.length > 0 ? `. ${s.skills.join(', ')}` : ''}
                    </span>
                  </span>
                  <Button className="shrink-0" onClick={() => setAsking({ userId: s.userId, name: s.name })}>
                    Introduce
                  </Button>
                  <Button variant="ghost" className="shrink-0" aria-label={`Block ${s.name}`} onClick={() => setBlocking({ userId: s.userId, name: s.name })}>
                    Block
                  </Button>
                </li>
              ))}
            </ul>
          </section>

          {rest.length > 0 && (
            <section className="mt-lg" aria-labelledby="intros-heading">
              <h2 id="intros-heading" className="text-[24px]">
                Your introductions
              </h2>
              <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
                {rest.map((i) => {
                  const p = other(i);
                  const outgoing = i.requesterId === myId;
                  return (
                    <li key={i.id} className="flex items-center gap-sm rounded-tile bg-card p-sm shadow-toy-soft">
                      <span className="min-w-0 flex-1">
                        <span className="block text-[16px] font-bold">
                          {p.name}{' '}
                          <span className="rounded-pill px-xs text-[12px] font-extrabold leading-[20px]" style={{ background: i.status === 'accepted' ? 'var(--tint-green)' : i.status === 'declined' ? 'var(--tint-red)' : 'var(--tint-yellow)' }}>
                            {i.status === 'proposed' ? 'waiting' : i.status}
                          </span>
                        </span>
                        <span className="block text-[14px] font-semibold text-ink-soft">
                          {outgoing ? 'You asked' : 'They asked'} on {new Date(i.createdAt).toLocaleDateString()}
                          {i.status === 'accepted' ? '. Contact details are in your Inbox.' : ''}
                        </span>
                      </span>
                      <Button variant="ghost" className="shrink-0" aria-label={`Block ${p.name}`} onClick={() => setBlocking(p)}>
                        Block
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </>
      )}

      <AskSheet person={asking} onClose={() => setAsking(null)} onDone={() => q.refetch()} />
      <BlockSheet person={blocking} onClose={() => setBlocking(null)} onDone={() => q.refetch()} />
    </Screen>
  );
}

function AskSheet({ person, onClose, onDone }: { person: Person | null; onClose: () => void; onDone: () => void }) {
  const [context, setContext] = useState('');
  const ask = useMutation({
    mutationFn: () => api.proposeIntro(person?.userId ?? '', context),
    onSuccess: () => {
      setContext('');
      onDone();
      onClose();
    },
  });
  return (
    <Sheet open={Boolean(person)} onClose={onClose} title={person ? `Ask to meet ${person.name}` : 'Ask for an introduction'}>
      <form
        className="flex flex-col gap-md"
        onSubmit={(e) => {
          e.preventDefault();
          ask.mutate();
        }}
      >
        <label className="block">
          <span className="block text-[14px] font-bold">Why you would like to meet</span>
          <textarea autoFocus value={context} onChange={(e) => setContext(e.target.value)} maxLength={500} rows={3} placeholder="Where you met and what you could do together." className={field} />
        </label>
        <p className="m-0 text-[12px] font-bold text-ink-soft">They see your name and this note. Nothing else moves until they say yes.</p>
        <Err e={ask.isError ? ask.error : null} />
        <Button type="submit" size="lg" full disabled={ask.isPending}>
          Send the request
        </Button>
      </form>
    </Sheet>
  );
}

function BlockSheet({ person, onClose, onDone }: { person: Person | null; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState('');
  const block = useMutation({
    mutationFn: () => api.block(person?.userId ?? '', reason),
    onSuccess: () => {
      setReason('');
      onDone();
      onClose();
    },
  });
  return (
    <Sheet open={Boolean(person)} onClose={onClose} title={person ? `Block ${person.name}` : 'Block'}>
      <form
        className="flex flex-col gap-md"
        onSubmit={(e) => {
          e.preventDefault();
          block.mutate();
        }}
      >
        <p className="m-0 text-[14px] font-semibold text-ink-soft">They will not be able to ask for introductions to you, and they drop out of your suggestions. They are not told.</p>
        <label className="block">
          <span className="block text-[14px] font-bold">Reason, for the team only</span>
          <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} className={field} />
        </label>
        <Err e={block.isError ? block.error : null} />
        <Button type="submit" full disabled={block.isPending}>
          Block
        </Button>
      </form>
    </Sheet>
  );
}
