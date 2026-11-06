import type { BondChat, Friend, Introduction } from '@kreators/shared';
import { useMutation } from '@tanstack/react-query';
import { MessageCircle, UsersRound } from 'lucide-react';
import { Icon } from '../components/Icon';
import { Inert } from '../components/Inert';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import { ConfirmDelete } from '../components/ConfirmDelete';
import { BackLink } from '../components/PageHeader';
import { AppCover } from '../components/AppCover';
import { Screen } from '../components/Screen';
import { Section, SeeAll } from '../components/Section';
import { Sheet } from '../components/Sheet';
import { Toggle } from '../components/Toggle';
import { ChannelsPanel, NewChannelButton } from '../components/Channels';
import { Pager, usePage } from '../components/Pager';
import { api } from '../lib/api';
import { useAuthed, useMe, useRefreshAll } from '../lib/queries';
import { FIELD } from '../lib/ui';
import { ErrorLine } from '../components/ErrorLine';
import { useCopy } from '../lib/clipboard';
import { dateTime, longDate } from '../lib/date';
import { AnimatedIcon } from '../components/AnimatedIcon';
import { StatusTag } from '../components/StatusTag';



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
  const inPage = usePage('in');
  const q = useAuthed(['bond', inPage.query], () => api.bond(inPage.query));
  const frPage = usePage('fr');
  const fr = useAuthed(['bond-friends', frPage.query], () => api.friends(frPage.query));
  const chPage = usePage('ch');
  const ch = useAuthed(['bond-chats', chPage.query], () => api.chats(chPage.query));
  const blPage = usePage('bl');
  const refresh = useRefreshAll();
  const [asking, setAsking] = useState<Person | null>(null);
  const [blocking, setBlocking] = useState<Person | null>(null);
  // A friend to remove or a sent request to cancel, and a block to lift: each asks first in a sheet.
  const [dropping, setDropping] = useState<{ userId: string; name: string; sent: boolean } | null>(null);
  const [unblocking, setUnblocking] = useState<Person | null>(null);
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
  const [codeIn, setCodeIn] = useState('');
  const { copy, said } = useCopy();
  const addByCode = useMutation({
    mutationFn: () => api.addFriendByCode(codeIn),
    onSuccess: () => {
      setCodeIn('');
      fr.refetch();
    },
  });
  const blocked = useAuthed(['bond-blocks', blPage.query], () => api.blocks(blPage.query));
  const unblock = useMutation({ mutationFn: (id: string) => api.unblock(id), onSuccess: () => { setUnblocking(null); void blocked.refetch(); fr.refetch(); } });
  const unfriend = useMutation({ mutationFn: (userId: string) => api.unfriend(userId), onSuccess: () => { setDropping(null); fr.refetch(); } });
  const openChat = useMutation({ mutationFn: (userId: string) => api.openChat({ userId }), onSuccess: (r) => nav(`/bond/chats/${r.chat.id}`) });
  const d = q.data;
  const myId = me.data?.user.id ?? '';
  const optedIn = d?.optedIn ?? me.data?.user.openToIntros ?? false;
  const incoming = (d?.intros ?? []).filter((i) => i.recipientId === myId && i.status === 'proposed');
  const rest = (d?.intros ?? []).filter((i) => !(i.recipientId === myId && i.status === 'proposed'));
  const other = (i: Introduction): Person => (i.requesterId === myId ? { userId: i.recipientId, name: i.recipientName } : { userId: i.requesterId, name: i.requesterName });
  const open = fr.data?.open ?? [];
  const pending = open.filter((f) => f.status === 'pending');
  const sent = open.filter((f) => f.status === 'sent');
  const friends = fr.data?.friends ?? [];
  const chats = ch.data?.chats ?? [];

  return (
    <Screen>
      <AppCover back={{ to: '/apps', label: 'Apps' }} title="Bond" lede="Friends, anonymous chats, and introductions to people you met, only when both of you want them." />

      <Section id="bond-chats" title="Chats" lede="Every chat runs under two aliases. Nobody's name moves through it.">
        {chats.length === 0 ? (
          <div className="rounded-card border-2 border-dashed border-line p-md">
            <p className="m-0 text-subhead text-ink-soft">No chats yet. Start one from a friend below, from someone at your circle table, or from a person's page.</p>
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
        <Pager page={ch.data?.page} prefix="ch" label="chats" />
        <ErrorLine e={openChat.isError ? openChat.error : null} />
      </Section>

      <Section
        id="bond-channels"
        title="Channels"
        lede="Private rooms for you and friends you ask in. Unlike chats, names show here."
        action={<NewChannelButton scope="bond" className="hidden md:block" />}
      >
        {/* On a phone the button sits under the heading at the right, so the title and its line keep their width. */}
        <NewChannelButton scope="bond" className="mb-sm flex justify-end md:hidden" />
        <ChannelsPanel scope="bond" create={false} />
      </Section>

      {(blocked.data?.blocked.length ?? 0) > 0 && (
        <Section id="bond-blocked" title="People you blocked" lede="Neither of you sees the other’s posts or friend asks. Lift a block any time.">
          <ul className="flex list-none flex-col gap-xs p-0 m-0">
            {blocked.data?.blocked.map((b) => (
              <li key={b.key} className="flex items-center justify-between gap-sm rounded-tile bg-card p-sm shadow-toy-soft">
                <span className="min-w-0 text-balance text-headline [overflow-wrap:anywhere]">{b.name}{b.handle ? ` (@${b.handle})` : b.anonymous ? ' (anonymous)' : ''}</span>
                <Button variant="outline" size="sm" onClick={() => { unblock.reset(); setUnblocking({ userId: b.key, name: b.name }); }} disabled={unblock.isPending}>
                  Unblock
                </Button>
              </li>
            ))}
          </ul>
          <Pager page={blocked.data?.page} prefix="bl" label="people you blocked" />
        </Section>
      )}

      <Section id="bond-friends" title="Friends" lede="Add people with their friend code or from their page. A chat with a friend is anonymous too." action={<SeeAll to="/community">Community</SeeAll>}>
        <div className="mb-sm grid gap-sm rounded-tile bg-card p-sm shadow-toy-soft sm:grid-cols-2">
          <div>
            <p className="m-0 text-subhead font-semibold">Your friend code</p>
            <div className="mt-xs flex items-center gap-xs">
              <span className="rounded-tile bg-paper px-sm py-xs font-mono text-title3 type-figure tracking-widest">{me.data?.user.friendCode ?? '…'}</span>
              <Button
                variant="outline"
                onClick={() => {
                  const code = me.data?.user.friendCode;
                  if (code) void copy(code);
                }}
              >
                {said === 'Copied' ? 'Copied' : 'Copy'}
              </Button>
            </div>
            {said && said !== 'Copied' && <p role="status" className="mt-xs m-0 text-caption text-ink-soft">{said}</p>}
            <p className="mt-xs m-0 text-caption text-ink-soft">Share it with someone you know. They type it here and you get a request. Your username is @{me.data?.user.handle ?? '…'}.</p>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (codeIn.trim()) addByCode.mutate();
            }}
          >
            <label className="block">
              <span className="block text-subhead font-semibold">Add a friend by code</span>
              <input value={codeIn} onChange={(e) => setCodeIn(e.target.value.toUpperCase())} maxLength={12} autoCapitalize="characters" autoComplete="off" placeholder="Their code" className={FIELD} />
            </label>
            <div className="mt-xs">
              <Button type="submit" disabled={addByCode.isPending || !codeIn.trim()}>
                <AnimatedIcon name="userPlus" size={18} interaction="hover-replay" playWhen={addByCode.isSuccess} />
                Send request
              </Button>
            </div>
            {addByCode.isSuccess && <p className="mt-xs m-0 text-caption text-ink-soft">{addByCode.data.status === 'friends' ? 'You are friends now.' : 'Request sent. They will see it under Bond.'}</p>}
            <ErrorLine e={addByCode.isError ? addByCode.error : null} />
          </form>
        </div>
        {pending.length > 0 && (
          <ul className="mb-sm flex list-none flex-col gap-xs p-0 m-0" aria-label="Friend requests">
            {pending.map((f) => (
              <li key={f.requestId} data-pillar="parent_child" className="rounded-tile p-sm" style={{ background: 'var(--tint-yellow)' }}>
                <p className="m-0 text-balance text-headline">{f.name} would like to be friends</p>
                {/* The answer sits at the card's bottom right, like every card's main action. */}
                <div className="mt-xs flex flex-wrap justify-end gap-xs">
                  <Button variant="outline" onClick={() => answerFriend.mutate({ id: f.requestId, status: 'accepted' })} disabled={answerFriend.isPending}>
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
        {sent.length === 0 && friends.length === 0 ? (
          <p className="m-0 text-subhead text-ink-soft">No friends yet. Open someone's page from the community feed and tap Add friend. Chats stay anonymous.</p>
        ) : (
          <ul className="flex list-none flex-col gap-xs p-0 m-0">
            {[...sent, ...friends].map((f) => (
              <li key={f.requestId} className="flex items-center gap-sm rounded-tile bg-card p-sm shadow-toy-soft">
                <Link to={f.handle ? `/u/${f.handle}` : `/people/${f.userId}`} className="min-w-0 flex-1">
                  <span className="block text-card-title">
                    {f.name}
                    {f.handle ? <span className="text-ink-soft"> @{f.handle}</span> : ''}
                  </span>
                  <span className="block text-card-note text-ink-soft">{f.status === 'sent' ? 'Request sent, waiting' : 'Friends'}</span>
                </Link>
                {f.status === 'friends' && (
                  <Button variant="outline" className="shrink-0" onClick={() => openChat.mutate(f.userId)} disabled={openChat.isPending}>
                    Chat
                  </Button>
                )}
                <Button variant="ghost" className="shrink-0" onClick={() => { unfriend.reset(); setDropping({ userId: f.userId, name: f.name, sent: f.status === 'sent' }); }} disabled={unfriend.isPending}>
                  {f.status === 'sent' ? 'Cancel' : 'Remove'}
                </Button>
              </li>
            ))}
          </ul>
        )}
        <Pager page={fr.data?.page} prefix="fr" label="friends" />
      </Section>

      <Section id="bond-intros" title="Introductions" lede="For people you met at events. Your details only move after the other person says yes.">
        <Toggle on={optedIn} onChange={(on) => optIn.mutate(on)} disabled={optIn.isPending} label="Open to introductions" hint="Switch this on to see who else from your events is open to meeting." />
        <ErrorLine e={optIn.isError ? optIn.error : null} />
        {q.isError && (
          <div className="mt-md rounded-card bg-card p-md shadow-toy-soft flex flex-wrap-reverse items-center justify-between gap-sm" role="alert">
            <p className="m-0 font-semibold min-w-0 flex-1 basis-[60%]">Could not load introductions.</p>
            <Button variant="outline" onClick={() => q.refetch()}>
              Try again
            </Button>
          </div>
        )}
        {incoming.length > 0 && (
          <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0" aria-label="Would like to meet you">
            {incoming.map((i) => (
              <li key={i.id} className="rounded-tile bg-card p-sm shadow-toy-soft">
                <p className="m-0 text-card-title">{i.requesterName} would like to meet you</p>
                {i.context && <p className="m-0 text-card-note text-ink-soft">{i.context}</p>}
                <div className="mt-sm flex flex-wrap justify-end gap-xs">
                  <Button variant="outline" onClick={() => answer.mutate({ id: i.id, status: 'accepted' })} disabled={answer.isPending}>
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
            {d.suggestions.length === 0 && <li className="text-subhead text-ink-soft">Nobody yet. RSVP to an event in Party and tick "happy to be introduced".</li>}
            {d.suggestions.map((s) => (
              <li key={s.userId} className="flex flex-wrap items-center gap-sm rounded-tile bg-card p-sm shadow-toy-soft">
                <span className="min-w-0 flex-1">
                  <span className="block text-card-title">
                    {s.name}
                    {s.handle ? <span className="text-ink-soft"> @{s.handle}</span> : ''}
                  </span>
                  <span className="block text-card-note text-ink-soft">
                    {s.context}
                    {s.skills.length > 0 ? `. ${s.skills.join(', ')}` : ''}
                  </span>
                </span>
                <Button className="shrink-0" variant="outline" onClick={() => openChat.mutate(s.userId)} disabled={openChat.isPending}>
                  Chat
                </Button>
                <Button variant="outline" className="shrink-0" onClick={() => setAsking({ userId: s.userId, name: s.name })}>
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
                    <span className="block text-card-title">
                      {p.name}{' '}
                      <StatusTag tone={i.status === 'accepted' ? 'good' : i.status === 'declined' ? 'bad' : 'warn'}>{i.status === 'proposed' ? 'waiting' : i.status}</StatusTag>
                    </span>
                    <span className="block text-card-note text-ink-soft">
                      {outgoing ? 'You asked' : 'They asked'} on {longDate(i.createdAt)}
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
        <Pager page={d?.introPage} prefix="in" label="introductions" />
      </Section>

      <AskSheet person={asking} onClose={() => setAsking(null)} onDone={() => q.refetch()} />
      <BlockSheet person={blocking} onClose={() => setBlocking(null)} onDone={() => q.refetch()} />
      <ConfirmDelete
        open={dropping !== null}
        title={dropping?.sent ? `Cancel your request to ${dropping.name}?` : `Remove ${dropping?.name ?? 'this friend'} as a friend?`}
        body={dropping?.sent ? 'They no longer see it. You can send another one later.' : 'You stop being friends. You can send a new request later.'}
        pending={unfriend.isPending}
        failed={unfriend.isError}
        onYes={() => dropping && unfriend.mutate(dropping.userId)}
        onClose={() => setDropping(null)}
        yes={dropping?.sent ? 'Yes, cancel it' : 'Yes, remove them'}
        keep={dropping?.sent ? 'Keep the request' : 'Keep them'}
      />
      <ConfirmDelete
        open={unblocking !== null}
        title={`Unblock ${unblocking?.name ?? 'them'}?`}
        body="You can see each other's posts and friend asks again. You can block them again any time."
        pending={unblock.isPending}
        failed={unblock.isError}
        onYes={() => unblocking && unblock.mutate(unblocking.userId)}
        onClose={() => setUnblocking(null)}
        yes="Yes, unblock"
        keep="Keep the block"
      />
    </Screen>
  );
}

function ChatRow({ c }: { c: BondChat }) {
  return (
    <Link to={`/bond/chats/${c.id}`} className="toy toy-soft flex items-center gap-sm rounded-tile bg-card p-sm text-ink">
      <span className="flex size-[44px] shrink-0 items-center justify-center rounded-pill bg-paper text-[20px]" aria-hidden="true">
        <Icon icon={c.source === 'circle' ? UsersRound : MessageCircle} size={20} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-card-title">{c.theirAlias}</span>
        <span className="block truncate text-card-note text-ink-soft">{c.lastBody || 'No messages yet. Say hello.'}</span>
      </span>
      <span className="shrink-0 text-caption text-ink-soft">{c.lastMessageAt ? dateTime(c.lastMessageAt) : ''}</span>
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
    // Polled, and only while the tab is in view, so a chat left open in the background asks nothing.
    const t = window.setInterval(() => {
      if (document.visibilityState === 'visible') void q.refetch();
    }, 8000);
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
        <p className="mt-md font-semibold">That chat is not yours.</p>
      </Screen>
    );
  if (!d) return null;

  return (
    <Screen columns={false}>
      <AppCover
        back={{ to: '/bond', label: 'Bond' }}
        title={d.chat.theirAlias}
        lede={
          <>
            You are <span className="font-bold text-ink">{d.chat.myAlias}</span> here. Both of you stay an alias, for good.
          </>
        }
        actions={<Avatar relationship="friendship" size={44} decorative />}
      />
      <div className="mt-md flex max-h-[480px] flex-col gap-xs overflow-y-auto rounded-card bg-paper p-sm">
        {d.messages.length === 0 && <p className="m-0 text-subhead text-ink-soft">Nobody has said anything yet. Say hello.</p>}
        {d.messages.map((m) => (
          <div key={m.id} className={`max-w-[85%] rounded-card p-sm text-subhead ${m.mine ? 'self-end rounded-br-[8px] bg-ink text-on-ink' : 'self-start rounded-bl-[8px] bg-card shadow-toy-soft'}`}>
            {!m.mine && <span className="block text-caption text-ink-mute">{m.alias}</span>}
            <Inert text={m.body} />
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
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder={`Say something as ${d.chat.myAlias}`} aria-label="Message" className="min-w-0 flex-1 rounded-pill border-2 border-line bg-card px-md py-sm text-body" />
        <Button type="submit" disabled={say.isPending || !text.trim()}>
          Send
        </Button>
      </form>
      <ErrorLine e={say.isError ? say.error : null} />
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
          <span className="block text-subhead">Why you would like to meet</span>
          <textarea autoFocus value={context} onChange={(e) => setContext(e.target.value)} maxLength={500} rows={3} placeholder="Where you met and what you could do together." className={FIELD} />
        </label>
        <p className="m-0 text-caption text-ink-soft">They see your name and this note. Nothing else moves until they say yes.</p>
        <ErrorLine e={ask.isError ? ask.error : null} />
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
        <p className="m-0 text-subhead text-ink-soft">They cannot ask for introductions to you or show in your suggestions. They are not told.</p>
        <label className="block">
          <span className="block text-subhead font-semibold">Reason, for the team only</span>
          <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} className={FIELD} />
        </label>
        <ErrorLine e={block.isError ? block.error : null} />
        <Button type="submit" full disabled={block.isPending}>
          Block
        </Button>
      </form>
    </Sheet>
  );
}

export type { Friend };
