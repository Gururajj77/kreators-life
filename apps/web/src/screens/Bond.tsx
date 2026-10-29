import type { BondChat, Friend, Introduction } from '@kreators/shared';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import { BackLink } from '../components/PageHeader';
import { Screen } from '../components/Screen';
import { Section, SeeAll } from '../components/Section';
import { Sheet } from '../components/Sheet';
import { Toggle } from '../components/Toggle';
import { api } from '../lib/api';
import { useAuthed, useMe, useRefreshAll } from '../lib/queries';

const field = 'mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]';
const when = (iso: string) => new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

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

/**
 * Bond: friends, anonymous chats, and introductions. A chat always runs under two aliases, whether it
 * started from a friend, from someone you met at an event, or from a circle table. Names never move through it.
 */
export function Bond() {
  const me = useMe();
  const nav = useNavigate();
  const q = useAuthed(['bond'], api.bond);
  const fr = useAuthed(['bond-friends'], api.friends);
  const ch = useAuthed(['bond-chats'], api.chats);
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
  const answerFriend = useMutation({ mutationFn: ({ id, status }: { id: string; status: 'accepted' | 'declined' }) => api.answerFriend(id, status), onSuccess: () => fr.refetch() });
  const unfriend = useMutation({ mutationFn: (userId: string) => api.unfriend(userId), onSuccess: () => fr.refetch() });
  const openChat = useMutation({ mutationFn: (userId: string) => api.openChat({ userId }), onSuccess: (r) => nav(`/bond/chats/${r.chat.id}`) });
  const d = q.data;
  const myId = me.data?.user.id ?? '';
  const optedIn = d?.optedIn ?? me.data?.user.openToIntros ?? false;
  const incoming = (d?.intros ?? []).filter((i) => i.recipientId === myId && i.status === 'proposed');
  const rest = (d?.intros ?? []).filter((i) => !(i.recipientId === myId && i.status === 'proposed'));
  const other = (i: Introduction): Person => (i.requesterId === myId ? { userId: i.recipientId, name: i.recipientName } : { userId: i.requesterId, name: i.requesterName });
  const friends = fr.data?.friends ?? [];
  const pending = friends.filter((f) => f.status === 'pending');
  const chats = ch.data?.chats ?? [];

  return (
    <Screen>
      <header className="pt-lg">
        <BackLink to="/apps">Apps</BackLink>
        <h1 className="text-[30px]">Bond</h1>
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Friends, anonymous chats, and introductions to people you met, only when both of you want them.</p>
      </header>

      <Section id="bond-chats" title="Chats" lede="Every chat runs under two aliases. Nobody's name moves through it.">
        {chats.length === 0 ? (
          <div className="rounded-card border-2 border-dashed border-line p-md">
            <p className="m-0 text-[14px] font-semibold text-ink-soft">No chats yet. Start one from a friend below, from someone at your circle table, or from a person's page.</p>
          </div>
        ) : (
          <ul className="flex list-none flex-col gap-xs p-0 m-0">
            {chats.map((c) => (
              <li key={c.id}>
                <ChatRow c={c} />
              </li>
            ))}
          </ul>
        )}
        <Err e={openChat.isError ? openChat.error : null} />
      </Section>

      <Section id="bond-friends" title="Friends" lede="Add people from their page. A chat with a friend is anonymous too." action={<SeeAll to="/community">Community</SeeAll>}>
        {pending.length > 0 && (
          <ul className="mb-sm flex list-none flex-col gap-xs p-0 m-0" aria-label="Friend requests">
            {pending.map((f) => (
              <li key={f.requestId} className="rounded-tile p-sm" style={{ background: 'var(--tint-yellow)' }}>
                <p className="m-0 text-[16px] font-bold">{f.name} would like to be friends</p>
                <div className="mt-xs flex flex-wrap gap-xs">
                  <Button onClick={() => answerFriend.mutate({ id: f.requestId, status: 'accepted' })} disabled={answerFriend.isPending}>
                    Yes
                  </Button>
                  <Button variant="outline" onClick={() => answerFriend.mutate({ id: f.requestId, status: 'declined' })} disabled={answerFriend.isPending}>
                    No thanks
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {friends.filter((f) => f.status !== 'pending').length === 0 ? (
          <p className="m-0 text-[14px] font-semibold text-ink-soft">No friends yet. Open someone's page from the community feed and tap Add friend. Chats stay anonymous.</p>
        ) : (
          <ul className="flex list-none flex-col gap-xs p-0 m-0">
            {friends
              .filter((f) => f.status !== 'pending')
              .map((f) => (
                <li key={f.requestId} className="flex items-center gap-sm rounded-tile bg-card p-sm shadow-toy-soft">
                  <Link to={f.handle ? `/u/${f.handle}` : `/people/${f.userId}`} className="min-w-0 flex-1">
                    <span className="block text-[16px] font-bold">
                      {f.name}
                      {f.handle ? <span className="font-semibold text-ink-soft"> @{f.handle}</span> : ''}
                    </span>
                    <span className="block text-[14px] font-semibold text-ink-soft">{f.status === 'sent' ? 'Request sent, waiting' : 'Friends'}</span>
                  </Link>
                  {f.status === 'friends' && (
                    <Button className="shrink-0" onClick={() => openChat.mutate(f.userId)} disabled={openChat.isPending}>
                      Chat
                    </Button>
                  )}
                  <Button variant="ghost" className="shrink-0" onClick={() => unfriend.mutate(f.userId)} disabled={unfriend.isPending}>
                    {f.status === 'sent' ? 'Cancel' : 'Remove'}
                  </Button>
                </li>
              ))}
          </ul>
        )}
      </Section>

      <Section id="bond-intros" title="Introductions" lede="For people you met at events. Your details only move after the other person says yes.">
        <Toggle on={optedIn} onChange={(on) => optIn.mutate(on)} disabled={optIn.isPending} label="Open to introductions" hint="Switch this on to see who else from your events is open to meeting." />
        <Err e={optIn.isError ? optIn.error : null} />
        {q.isError && (
          <div className="mt-md rounded-card bg-card p-md shadow-toy-soft" role="alert">
            <p className="m-0 font-bold">Could not load introductions.</p>
            <Button variant="outline" className="mt-sm" onClick={() => q.refetch()}>
              Try again
            </Button>
          </div>
        )}
        {incoming.length > 0 && (
          <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0" aria-label="Would like to meet you">
            {incoming.map((i) => (
              <li key={i.id} className="rounded-tile bg-card p-sm shadow-toy-soft">
                <p className="m-0 text-[16px] font-bold">{i.requesterName} would like to meet you</p>
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
        )}
        {d && optedIn && (
          <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0" aria-label="People you met">
            {d.suggestions.length === 0 && <li className="text-[14px] font-semibold text-ink-soft">Nobody yet. RSVP to an event in Party and tick "happy to be introduced".</li>}
            {d.suggestions.map((s) => (
              <li key={s.userId} className="flex flex-wrap items-center gap-sm rounded-tile bg-card p-sm shadow-toy-soft">
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
                <Button className="shrink-0" variant="outline" onClick={() => openChat.mutate(s.userId)} disabled={openChat.isPending}>
                  Chat
                </Button>
                <Button className="shrink-0" onClick={() => setAsking({ userId: s.userId, name: s.name })}>
                  Introduce
                </Button>
                <Button variant="ghost" className="shrink-0" aria-label={`Block ${s.name}`} onClick={() => setBlocking({ userId: s.userId, name: s.name })}>
                  Block
                </Button>
              </li>
            ))}
          </ul>
        )}
        {rest.length > 0 && (
          <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0" aria-label="Your introductions">
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
        )}
      </Section>

      <AskSheet person={asking} onClose={() => setAsking(null)} onDone={() => q.refetch()} />
      <BlockSheet person={blocking} onClose={() => setBlocking(null)} onDone={() => q.refetch()} />
    </Screen>
  );
}

function ChatRow({ c }: { c: BondChat }) {
  return (
    <Link to={`/bond/chats/${c.id}`} className="toy toy-soft flex items-center gap-sm rounded-tile bg-card p-sm text-ink">
      <span className="flex size-[44px] shrink-0 items-center justify-center rounded-pill bg-paper text-[20px]" aria-hidden="true">
        {c.source === 'circle' ? '🫧' : '💬'}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] font-bold">{c.theirAlias}</span>
        <span className="block truncate text-[14px] font-semibold text-ink-soft">{c.lastBody || 'No messages yet. Say hello.'}</span>
      </span>
      <span className="shrink-0 text-[12px] font-bold text-ink-soft">{c.lastMessageAt ? when(c.lastMessageAt) : ''}</span>
    </Link>
  );
}

/** One anonymous chat. You are your alias here; they are theirs. */
export function BondChatScreen() {
  const { id = '' } = useParams();
  const q = useAuthed(['bond-chat', id], () => api.chat(id));
  const [text, setText] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const say = useMutation({
    mutationFn: () => api.chatSay(id, text),
    onSuccess: () => {
      setText('');
      void q.refetch();
    },
  });
  useEffect(() => {
    const t = window.setInterval(() => void q.refetch(), 8000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [q.data?.messages.length]);
  const d = q.data;

  if (q.isError)
    return (
      <Screen columns={false}>
        <header className="pt-lg">
          <BackLink to="/bond">Bond</BackLink>
        </header>
        <p className="mt-md font-bold">That chat is not yours.</p>
      </Screen>
    );
  if (!d) return null;

  return (
    <Screen columns={false}>
      <header className="pt-lg">
        <BackLink to="/bond">Bond</BackLink>
        <div className="mt-sm flex items-center gap-sm">
          <Avatar relationship="friendship" size={44} decorative />
          <div className="min-w-0">
            <h1 className="text-[30px]">{d.chat.theirAlias}</h1>
            <p className="m-0 text-[14px] font-semibold text-ink-soft">
              You are <span className="font-extrabold text-ink">{d.chat.myAlias}</span> here. Both of you stay an alias, for good.
            </p>
          </div>
        </div>
      </header>
      <div className="mt-md flex max-h-[480px] flex-col gap-xs overflow-y-auto rounded-card bg-paper p-sm">
        {d.messages.length === 0 && <p className="m-0 text-[14px] font-semibold text-ink-soft">Nobody has said anything yet. Say hello.</p>}
        {d.messages.map((m) => (
          <div key={m.id} className={`max-w-[85%] rounded-card p-sm text-[14px] font-semibold leading-snug ${m.mine ? 'self-end rounded-br-[8px] bg-ink text-on-ink' : 'self-start rounded-bl-[8px] bg-card shadow-toy-soft'}`}>
            {!m.mine && <span className="block text-[12px] font-extrabold text-ink-mute">{m.alias}</span>}
            {m.body}
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <form
        className="mt-xs flex gap-xs"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) say.mutate();
        }}
      >
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder={`Say something as ${d.chat.myAlias}`} aria-label="Message" className="min-w-0 flex-1 rounded-pill border-2 border-line bg-card px-md py-sm text-[16px]" />
        <Button type="submit" disabled={say.isPending || !text.trim()}>
          Send
        </Button>
      </form>
      <Err e={say.isError ? say.error : null} />
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

export type { Friend };
