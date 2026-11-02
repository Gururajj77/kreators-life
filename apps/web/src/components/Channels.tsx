import {
  canMute,
  CHANNEL_POLL_MS,
  communityRankOf,
  isNearBottom,
  MAX_CHANNEL_MEMBERS,
  MAX_CHANNEL_MESSAGE,
  MAX_CHANNEL_NAME,
  MAX_CHANNEL_TOPIC,
  mergeChannelLines,
  unreadLabel,
  type Channel,
  type ChannelLine,
  type ChannelScope,
} from '@kreators/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import gsap from 'gsap';
import { useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ApiError, api } from '../lib/api';
import { useAuthed, useMe } from '../lib/queries';
import { useSession } from '../lib/store';
import { useParamState } from '../lib/useParamState';
import { AnonToggle } from './AnonToggle';
import { Button } from './Button';
import { ChatComposer } from './Chat';
import { Inert } from './Inert';
import { Pager, usePage } from './Pager';
import { Sheet } from './Sheet';
import { SkeletonList } from './Skeleton';

const field = 'mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]';
const when = (iso: string) => new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const msg = (e: unknown) => (e instanceof Error ? e.message : 'That did not work. Try again.');
const RANK_WORD = { member: '', guide: 'Guide', staff: 'Staff', admin: 'Admin' } as const;

function Err({ e }: { e: unknown }) {
  if (!e) return null;
  return (
    <p role="alert" className="mt-xs m-0 rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
      {msg(e)}
    </p>
  );
}

/** The count of channels with something new, for a tab label. Asked once a minute while the tab is showing. */
export function useChannelsUnread(scope: ChannelScope): number {
  const token = useSession((s) => s.token);
  const q = useQuery({ queryKey: ['channels-unread', scope], queryFn: () => api.channelsUnread(scope), enabled: Boolean(token), refetchInterval: 60_000, retry: false });
  return q.data?.unread ?? 0;
}

/** The small number on a tab or a row. The words are for screen readers; the dot is for everyone else. */
function Dot({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <span className="ml-xs inline-flex min-w-[24px] items-center justify-center rounded-pill bg-r1 px-xs text-[12px] font-extrabold leading-[20px] text-on-fill">
      {unreadLabel(n)}
      <span className="sr-only"> unread</span>
    </span>
  );
}

/** Feed and Channels, as two buttons under Community's header. The choice lives in the URL. */
export function ChannelTabs() {
  const [tab, setTab] = useParamState('tab', 'feed');
  const unread = useChannelsUnread('community');
  return (
    <div className="mt-md">
      <div className="scroll-row" role="group" aria-label="Community sections">
        {(
          [
            ['feed', 'Feed'],
            ['channels', 'Channels'],
          ] as const
        ).map(([k, label]) => (
          <button key={k} type="button" aria-pressed={tab === k} onClick={() => setTab(k)} className={`toy shrink-0 rounded-pill border-2 px-sm py-xs text-[14px] font-bold ${tab === k ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}>
            {label}
            {k === 'channels' && tab !== k && <Dot n={unread} />}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Channels for one app: the list, and the one that is open (kept in the URL as `channel`, so Back and a notice's link both land on it).
 * Community channels are public rooms guides open. Bond channels are private rooms a member opens for friends.
 */
export function ChannelsPanel({ scope }: { scope: ChannelScope }) {
  const [open, setOpen] = useParamState('channel', '');
  if (open) return <ChannelView scope={scope} id={open} onBack={() => setOpen('')} />;
  return <ChannelList scope={scope} onOpen={setOpen} />;
}

function ChannelList({ scope, onOpen }: { scope: ChannelScope; onOpen: (id: string) => void }) {
  const pg = usePage('ch');
  const me = useMe();
  const [closed, setClosed] = useState(false);
  const qc = useQueryClient();
  const q = useAuthed(['channels', scope, pg.query, closed], () => api.channels(scope, pg.query, closed));
  const [making, setMaking] = useState(false);
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['channels', scope] });
    void qc.invalidateQueries({ queryKey: ['channels-unread', scope] });
  };
  const join = useMutation({ mutationFn: (id: string) => api.joinChannel(scope, id), onSuccess: (_r, id) => { refresh(); onOpen(id); } });
  const decline = useMutation({ mutationFn: (id: string) => api.leaveChannel(scope, id), onSuccess: refresh });
  const list = q.data?.channels ?? [];
  const isGuide = Boolean(me.data && me.data.user.role !== 'user' && scope === 'community');
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-sm">
        {scope === 'community' ? <p className="m-0 min-w-0 flex-1 text-[14px] font-semibold text-ink-soft">Rooms for one topic each. Join one to write in it. You can write under your name or a made-up one.</p> : <p className="m-0 min-w-0 flex-1 text-[14px] font-semibold text-ink-soft">Private rooms for you and your friends, up to {MAX_CHANNEL_MEMBERS} people. Names show here, unlike in chats.</p>}
        {q.data?.canCreate && <Button onClick={() => setMaking(true)}>New channel</Button>}
      </div>
      {isGuide && (
        <label className="mt-sm flex items-center gap-xs text-[14px] font-bold text-ink-soft">
          <input type="checkbox" checked={closed} onChange={(e) => setClosed(e.target.checked)} className="size-[18px] accent-ink" />
          Show closed channels
        </label>
      )}
      {q.isError && <Err e={q.error} />}
      {q.isPending && <SkeletonList className="mt-md" count={3} lines={2} label="Loading channels" />}
      {q.data && list.length === 0 && (
        <div className="mt-md rounded-card border-2 border-dashed border-line p-md">
          <p className="m-0 text-[14px] font-semibold text-ink-soft">
            {scope === 'community' ? (q.data.canCreate ? 'No channels yet. Open the first one for a topic.' : 'No channels yet. Guides open them, and they will show up here.') : 'No channels yet. Make one and ask your friends in.'}
          </p>
        </div>
      )}
      <ul className="mt-md flex list-none flex-col gap-xs p-0 m-0">
        {list.map((c) => (
          <li key={c.id} className="rounded-tile bg-card p-sm shadow-toy-soft">
            <div className="flex items-center gap-sm">
              <button type="button" onClick={() => onOpen(c.id)} className="toy toy-soft min-w-0 flex-1 rounded-tile bg-paper p-sm text-left text-ink">
                <span className="flex items-center gap-xs">
                  <span className="truncate text-[16px] font-bold"># {c.name}</span>
                  <Dot n={c.unread} />
                  {c.archived && <span className="rounded-pill bg-line px-xs text-[11px] font-extrabold leading-[18px] text-ink-soft">Closed</span>}
                </span>
                {c.topic && <span className="block text-[14px] font-semibold text-ink-soft">{c.topic}</span>}
                <span className="block text-[12px] font-bold text-ink-soft">
                  {c.members} {c.members === 1 ? 'person' : 'people'}
                  {c.lastLineAt ? `, last line ${when(c.lastLineAt)}` : ', no lines yet'}
                  {c.joined ? ', you are in' : ''}
                </span>
              </button>
              {c.invited && (
                <span className="flex shrink-0 flex-col gap-xs">
                  <Button size="sm" disabled={join.isPending} onClick={() => join.mutate(c.id)}>
                    Say yes
                  </Button>
                  <Button size="sm" variant="outline" disabled={decline.isPending} onClick={() => decline.mutate(c.id)}>
                    No thanks
                  </Button>
                </span>
              )}
              {!c.invited && !c.joined && scope === 'community' && !c.archived && (
                <Button size="sm" variant="outline" className="shrink-0" disabled={join.isPending} onClick={() => join.mutate(c.id)}>
                  Join
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
      <Err e={join.isError ? join.error : decline.isError ? decline.error : null} />
      <Pager page={q.data?.page} prefix="ch" label="channels" />
      <NewChannelSheet scope={scope} open={making} onClose={() => setMaking(false)} onMade={(id) => { refresh(); onOpen(id); }} />
    </div>
  );
}

function NewChannelSheet({ scope, open, onClose, onMade }: { scope: ChannelScope; open: boolean; onClose: () => void; onMade: (id: string) => void }) {
  const [name, setName] = useState('');
  const [topic, setTopic] = useState('');
  const make = useMutation({
    mutationFn: () => api.createChannel(scope, { name, topic }),
    onSuccess: (r) => {
      setName('');
      setTopic('');
      onClose();
      if (r.channel) onMade(r.channel.id);
    },
  });
  return (
    <Sheet open={open} onClose={onClose} title="New channel">
      <form
        className="flex flex-col gap-md"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) make.mutate();
        }}
      >
        <label className="block">
          <span className="block text-[14px] font-bold">Name</span>
          <input autoFocus value={name} maxLength={MAX_CHANNEL_NAME} onChange={(e) => setName(e.target.value)} placeholder={scope === 'community' ? 'Morning pages' : 'Weekend plans'} className={field} />
        </label>
        <label className="block">
          <span className="block text-[14px] font-bold">What it is for (optional)</span>
          <input value={topic} maxLength={MAX_CHANNEL_TOPIC} onChange={(e) => setTopic(e.target.value)} placeholder="One line so people know what to say here" className={field} />
        </label>
        <p className="m-0 text-[12px] font-bold text-ink-soft">{scope === 'community' ? 'Anyone in Community can join and read. A guide can close it later.' : `Only people you ask in can see it. You can ask up to ${MAX_CHANNEL_MEMBERS - 1} friends.`}</p>
        <Err e={make.isError ? make.error : null} />
        <Button type="submit" size="lg" full disabled={make.isPending || !name.trim()}>
          Make the channel
        </Button>
      </form>
    </Sheet>
  );
}

/**
 * The lines of one channel. The screen holds what it has fetched and, while its tab is showing, asks every few seconds for lines after the
 * last one (and for the ones in view that were taken down). It scrolls to a new line only when the reader was already at the bottom.
 */
function useChannelLines(scope: ChannelScope, id: string, read: boolean) {
  const [lines, setLines] = useState<ChannelLine[]>([]);
  const [earlier, setEarlier] = useState(false);
  const [status, setStatus] = useState<'loading' | 'ready' | 'gone'>('loading');
  const held = useRef<ChannelLine[]>([]);
  const readRef = useRef(read);
  readRef.current = read;
  const busy = useRef(false);
  const fresh = useRef<Set<number>>(new Set());
  const apply = useCallback((next: ChannelLine[]) => {
    held.current = next;
    setLines(next);
  }, []);

  const pull = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      for (let i = 0; i < 5; i += 1) {
        const cur = held.current;
        const last = cur.at(-1)?.seq;
        const r = await api.channelLines(scope, id, { after: last, from: cur[0]?.seq, read: readRef.current });
        if (last === undefined) {
          apply(r.lines);
          setEarlier(r.more);
          setStatus('ready');
          break;
        }
        const gone = new Set(r.gone);
        for (const l of r.lines) if (!cur.some((x) => x.seq === l.seq)) fresh.current.add(l.seq);
        apply(mergeChannelLines(cur.filter((l) => !gone.has(l.seq)), r.lines));
        if (!r.more) break;
      }
    } catch (e) {
      if (e instanceof ApiError && (e.status === 404 || e.status === 403)) setStatus('gone');
    } finally {
      busy.current = false;
    }
  }, [scope, id, apply]);

  useEffect(() => {
    held.current = [];
    setLines([]);
    setStatus('loading');
    setEarlier(false);
    void pull();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void pull();
    }, CHANNEL_POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void pull();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [pull]);

  const loadEarlier = useCallback(async () => {
    const first = held.current[0]?.seq;
    if (!first) return;
    const r = await api.channelLines(scope, id, { before: first });
    apply(mergeChannelLines(r.lines, held.current));
    setEarlier(r.more);
  }, [scope, id, apply]);

  return { lines, earlier, status, pull, loadEarlier, fresh };
}

function ChannelView({ scope, id, onBack }: { scope: ChannelScope; id: string; onBack: () => void }) {
  const me = useMe();
  const qc = useQueryClient();
  const meta = useAuthed(['channel', scope, id], () => api.channel(scope, id));
  const ch = meta.data?.channel;
  const members = meta.data?.members ?? [];
  const joined = ch?.joined ?? false;
  const { lines, earlier, status, pull, loadEarlier, fresh } = useChannelLines(scope, id, joined);
  const reduce = useReducedMotion();
  const box = useRef<HTMLOListElement>(null);
  const stick = useRef(true);
  const anchor = useRef<number | null>(null);
  const lastSeen = useRef(0);
  const [unseen, setUnseen] = useState(0);
  const [reply, setReply] = useState<ChannelLine | null>(null);
  const [anonymous, setAnonymous] = useState(false);
  const [editing, setEditing] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [loadingEarlier, setLoadingEarlier] = useState(false);

  const refreshMeta = () => {
    void qc.invalidateQueries({ queryKey: ['channel', scope, id] });
    void qc.invalidateQueries({ queryKey: ['channels', scope] });
    void qc.invalidateQueries({ queryKey: ['channels-unread', scope] });
  };
  const join = useMutation({ mutationFn: () => api.joinChannel(scope, id), onSuccess: refreshMeta });
  const leave = useMutation({ mutationFn: () => api.leaveChannel(scope, id), onSuccess: () => { refreshMeta(); if (scope === 'bond') onBack(); } });
  const close = useMutation({ mutationFn: (archived: boolean) => api.closeChannel(scope, id, archived), onSuccess: (_r, archived) => { refreshMeta(); if (archived && scope === 'bond') onBack(); } });
  const say = useMutation({
    mutationFn: (text: string) => api.channelSay(scope, id, text, { anonymous: scope === 'community' && anonymous, replyTo: reply?.id ?? null }),
    onMutate: () => setFailed(null),
    onSuccess: () => {
      setReply(null);
      stick.current = true;
      void pull();
    },
    onError: (_e, text) => setFailed(text),
  });
  const unsay = useMutation({ mutationFn: (mid: string) => api.channelUnsay(scope, id, mid), onSuccess: () => void pull() });
  const report = useMutation({ mutationFn: (mid: string) => api.channelReport(scope, id, mid) });
  const block = useMutation({ mutationFn: (mid: string) => api.channelBlockAuthor(scope, id, mid), onSuccess: () => void pull() });
  const mute = useMutation({ mutationFn: (userId: string) => api.mute(userId), onSuccess: () => void pull() });
  const removeMember = useMutation({ mutationFn: (userId: string) => api.removeFromChannel(id, userId), onSuccess: refreshMeta });

  const myRank = me.data ? communityRankOf({ role: me.data.user.role, permissions: me.data.user.permissions }) : 'member';
  const canManage = ch?.canManage ?? false;

  // New lines scroll into view only when the reader was already at the bottom (or wrote the line); otherwise a button says how many came.
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    if (anchor.current !== null) {
      el.scrollTop += el.scrollHeight - anchor.current;
      anchor.current = null;
      return;
    }
    const last = lines.at(-1);
    if (!last || last.seq === lastSeen.current) return;
    const first = lastSeen.current === 0;
    const prev = lastSeen.current;
    lastSeen.current = last.seq;
    if (first || stick.current || last.mine) {
      el.scrollTop = el.scrollHeight;
      setUnseen(0);
    } else {
      setUnseen((n) => n + lines.filter((l) => l.seq > prev && !l.mine).length);
    }
  }, [lines]);
  useEffect(() => {
    lastSeen.current = 0;
    stick.current = true;
    setUnseen(0);
    setReply(null);
  }, [id]);
  // Lines that arrived by a poll ease in. Under reduced motion they just appear.
  useEffect(() => {
    const els = box.current?.querySelectorAll('[data-fresh]');
    if (els && els.length > 0) {
      if (reduce) gsap.set(els, { opacity: 1, y: 0 });
      else gsap.fromTo(els, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.25, ease: 'power2.out' });
    }
    fresh.current.clear();
  }, [lines, reduce, fresh]);

  const toBottom = () => {
    const el = box.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    stick.current = true;
    setUnseen(0);
  };

  if (meta.isError || status === 'gone')
    return (
      <div>
        <Button variant="outline" size="sm" onClick={onBack}>
          All channels
        </Button>
        <p className="mt-md m-0 font-bold">That channel is not available to you. It may have closed, or you may have been taken out.</p>
      </div>
    );

  const showJoin = ch && !ch.joined && scope === 'community' && !ch.archived;
  const writable = ch?.joined && !ch.archived;
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-sm">
        <Button variant="outline" size="sm" onClick={onBack}>
          All channels
        </Button>
        <span className="flex flex-wrap items-center gap-xs">
          {ch?.joined && !(scope === 'bond' && ch.owner) && (
            <Button variant="outline" size="sm" disabled={leave.isPending} onClick={() => window.confirm(`Leave ${ch.name}?`) && leave.mutate()}>
              Leave
            </Button>
          )}
          {canManage && (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              Edit
            </Button>
          )}
          {scope === 'bond' && ch?.owner && !ch.archived && (
            <Button size="sm" onClick={() => setInviting(true)}>
              Ask friends
            </Button>
          )}
          {canManage && ch && (
            <Button variant="ghost" size="sm" disabled={close.isPending} onClick={() => (ch.archived ? close.mutate(false) : window.confirm(`Close ${ch.name}? Nobody can write in it after that.`) && close.mutate(true))}>
              {ch.archived ? 'Open again' : 'Close channel'}
            </Button>
          )}
        </span>
      </div>
      {ch ? (
        <header className="mt-sm">
          <h3 className="text-[24px]"># {ch.name}</h3>
          {ch.topic && <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">{ch.topic}</p>}
          <p className="mt-xs m-0 text-[12px] font-bold text-ink-soft">
            {ch.members} {ch.members === 1 ? 'person' : 'people'}
            {ch.archived ? ', closed' : ''}
          </p>
        </header>
      ) : (
        <SkeletonList className="mt-sm" count={1} lines={2} label="Loading channel" />
      )}
      {scope === 'bond' && members.length > 0 && (
        <ul className="mt-sm flex list-none flex-wrap gap-xs p-0 m-0" aria-label="People in this channel">
          {members.map((m) => (
            <li key={m.userId} className="flex items-center gap-xs rounded-pill bg-card py-xs pl-sm pr-xs text-[14px] font-bold shadow-toy-soft">
              {m.name}
              {m.owner && <span className="text-[11px] font-extrabold text-ink-soft">owner</span>}
              {ch?.owner && !m.owner && (
                <button type="button" aria-label={`Take ${m.name} out`} disabled={removeMember.isPending} onClick={() => window.confirm(`Take ${m.name} out of ${ch.name}?`) && removeMember.mutate(m.userId)} className="toy toy-soft flex size-[32px] items-center justify-center rounded-pill bg-paper text-[14px]">
                  <span aria-hidden="true">✕</span>
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {ch?.invited && (
        <div className="mt-sm rounded-tile p-sm" style={{ background: 'var(--tint-yellow)' }}>
          <p className="m-0 text-[16px] font-bold">You were asked into this channel.</p>
          <div className="mt-xs flex gap-xs">
            <Button disabled={join.isPending} onClick={() => join.mutate()}>
              Say yes
            </Button>
            <Button variant="outline" disabled={leave.isPending} onClick={() => leave.mutate()}>
              No thanks
            </Button>
          </div>
        </div>
      )}

      {!ch?.invited && (
        <>
          <div className="relative mt-md">
            {earlier && (
              <div className="mb-xs flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={loadingEarlier}
                  onClick={async () => {
                    setLoadingEarlier(true);
                    anchor.current = box.current?.scrollHeight ?? null;
                    try {
                      await loadEarlier();
                    } finally {
                      setLoadingEarlier(false);
                    }
                  }}
                >
                  {loadingEarlier ? 'Loading' : 'Load earlier lines'}
                </Button>
              </div>
            )}
            <ol
              ref={box}
              role="log"
              aria-live="polite"
              aria-relevant="additions"
              aria-label={`Lines in ${ch?.name ?? 'this channel'}`}
              tabIndex={0}
              onScroll={(e) => {
                stick.current = isNearBottom(e.currentTarget);
                if (stick.current) setUnseen(0);
              }}
              className="m-0 flex max-h-[480px] min-h-[240px] list-none flex-col gap-xs overflow-y-auto rounded-card bg-paper p-sm"
            >
              {status === 'loading' && (
                <li>
                  <SkeletonList count={3} lines={1} label="Loading lines" />
                </li>
              )}
              {status === 'ready' && lines.length === 0 && <li className="text-[14px] font-semibold text-ink-soft">Nothing here yet. Say the first thing.</li>}
              {lines.map((l) => (
                <li key={l.id} data-fresh={fresh.current.has(l.seq) ? '' : undefined} className={`rounded-tile p-sm text-[14px] ${l.mine ? 'bg-ink text-on-ink' : 'bg-card shadow-toy-soft'}`}>
                  {l.replyTo && (
                    <span className={`mb-xs block truncate rounded-inner-sm px-xs text-[12px] font-bold ${l.mine ? 'bg-on-ink/15' : 'bg-paper text-ink-soft'}`}>
                      {l.replyTo.name}: <Inert text={l.replyTo.body} />
                    </span>
                  )}
                  <span className="flex flex-wrap items-baseline justify-between gap-xs">
                    <span className="font-extrabold">
                      {l.mine ? 'You' : l.name}
                      {l.anonymous && <span className={`ml-xs rounded-pill px-xs text-[11px] leading-[18px] ${l.mine ? 'bg-on-ink/15' : 'bg-line text-ink-soft'}`}>{l.mine ? `Anonymous as ${l.name}` : 'Anonymous'}</span>}
                      {l.rank && RANK_WORD[l.rank] && <span className="ml-xs rounded-pill bg-r3 px-xs text-[11px] leading-[18px] text-ink-fixed">{RANK_WORD[l.rank]}</span>}
                    </span>
                    <span className={`text-[12px] font-bold ${l.mine ? 'text-on-ink/70' : 'text-ink-soft'}`}>{when(l.createdAt)}</span>
                  </span>
                  <span className="block whitespace-pre-wrap font-semibold">
                    <Inert text={l.body} />
                  </span>
                  <LineActions
                    line={l}
                    canWrite={Boolean(writable)}
                    canTakeDown={l.mine || canManage}
                    canMuteIt={scope === 'community' && !l.mine && Boolean(l.userId) && l.rank !== null && canMute(myRank, l.rank)}
                    onReply={() => setReply(l)}
                    onTakeDown={() => unsay.mutate(l.id)}
                    onReport={() => window.confirm('Tell the team about this line?') && report.mutate(l.id)}
                    onBlock={() => window.confirm(`Block ${l.name}? You will not see each other's lines, and any friendship ends. You can undo it under Bond.`) && block.mutate(l.id)}
                    onMute={() => window.confirm(`Mute ${l.name} in Community? They can still read but cannot write.`) && mute.mutate(l.userId)}
                  />
                </li>
              ))}
            </ol>
            {unseen > 0 && (
              <div className="pointer-events-none absolute inset-x-0 bottom-xs flex justify-center">
                <Button size="sm" className="pointer-events-auto" onClick={toBottom}>
                  {unseen} new {unseen === 1 ? 'line' : 'lines'}
                </Button>
              </div>
            )}
          </div>
          <Err e={unsay.isError ? unsay.error : report.isError ? report.error : block.isError ? block.error : mute.isError ? mute.error : null} />
          {report.isSuccess && (
            <p role="status" className="mt-xs m-0 text-[14px] font-bold text-ink-soft">
              Thanks. The team has it.
            </p>
          )}

          {showJoin && (
            <div className="mt-sm rounded-tile bg-card p-sm shadow-toy-soft">
              <p className="m-0 text-[14px] font-semibold text-ink-soft">You can read this channel. Join it to write, and to see a dot when there is something new.</p>
              <Button className="mt-xs" disabled={join.isPending} onClick={() => join.mutate()}>
                Join {ch?.name}
              </Button>
              <Err e={join.isError ? join.error : null} />
            </div>
          )}
          {ch?.archived && <p className="mt-sm m-0 text-[14px] font-bold text-ink-soft">This channel is closed. You can still read it.</p>}
          {writable && (
            <div className="mt-sm">
              {reply && (
                <p className="mb-xs m-0 flex items-center justify-between gap-xs rounded-tile bg-paper p-xs text-[12px] font-bold text-ink-soft">
                  <span className="min-w-0 truncate">
                    Replying to {reply.mine ? 'yourself' : reply.name}: <Inert text={reply.body} />
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => setReply(null)}>
                    Cancel
                  </Button>
                </p>
              )}
              {scope === 'community' && <AnonToggle on={anonymous} onChange={setAnonymous} className="mb-xs" />}
              <ChatComposer placeholder={`Write in ${ch?.name ?? 'the channel'}`} maxLength={MAX_CHANNEL_MESSAGE} disabled={say.isPending} onSend={(t) => say.mutate(t)} />
              {failed && (
                <div role="alert" className="mt-xs rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
                  <p className="m-0">That line did not send: {msg(say.error)}</p>
                  <p className="mt-xs m-0 break-words font-semibold text-ink-soft">{failed}</p>
                  <Button size="sm" className="mt-xs" disabled={say.isPending} onClick={() => say.mutate(failed)}>
                    Try again
                  </Button>
                </div>
              )}
            </div>
          )}
        </>
      )}
      <Err e={join.isError && !showJoin ? join.error : leave.isError ? leave.error : close.isError ? close.error : removeMember.isError ? removeMember.error : null} />
      {ch && <EditChannelSheet scope={scope} channel={ch} open={editing} onClose={() => setEditing(false)} onSaved={refreshMeta} />}
      {ch && scope === 'bond' && <InviteSheet channel={ch} open={inviting} onClose={() => setInviting(false)} onAsked={refreshMeta} seats={members.length} />}
    </div>
  );
}

/** Under a line: Reply, Take down, and a More that holds Report, Block and Mute so the row stays calm. */
function LineActions({
  line,
  canWrite,
  canTakeDown,
  canMuteIt,
  onReply,
  onTakeDown,
  onReport,
  onBlock,
  onMute,
}: {
  line: ChannelLine;
  canWrite: boolean;
  canTakeDown: boolean;
  canMuteIt: boolean;
  onReply: () => void;
  onTakeDown: () => void;
  onReport: () => void;
  onBlock: () => void;
  onMute: () => void;
}) {
  const [more, setMore] = useState(false);
  const tone = line.mine ? 'text-on-ink/80' : 'text-ink-soft';
  const btn = `min-h-[32px] text-[12px] font-bold underline underline-offset-4 ${tone}`;
  return (
    <span className="mt-xs flex flex-wrap items-center gap-sm">
      {canWrite && (
        <button type="button" onClick={onReply} className={btn}>
          Reply
        </button>
      )}
      {canTakeDown && (
        <button type="button" onClick={onTakeDown} className={btn}>
          Take down
        </button>
      )}
      {!line.mine && (
        <button type="button" aria-expanded={more} onClick={() => setMore((m) => !m)} className={btn}>
          More
        </button>
      )}
      {more && !line.mine && (
        <>
          <button type="button" onClick={onReport} className={btn}>
            Report
          </button>
          <button type="button" onClick={onBlock} className={btn}>
            Block
          </button>
          {canMuteIt && (
            <button type="button" onClick={onMute} className={btn}>
              Mute
            </button>
          )}
        </>
      )}
    </span>
  );
}

function EditChannelSheet({ scope, channel, open, onClose, onSaved }: { scope: ChannelScope; channel: Channel; open: boolean; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(channel.name);
  const [topic, setTopic] = useState(channel.topic);
  useEffect(() => {
    if (open) {
      setName(channel.name);
      setTopic(channel.topic);
    }
  }, [open, channel.name, channel.topic]);
  const save = useMutation({ mutationFn: () => api.changeChannel(scope, channel.id, { name, topic }), onSuccess: () => { onSaved(); onClose(); } });
  return (
    <Sheet open={open} onClose={onClose} title="Edit channel">
      <form
        className="flex flex-col gap-md"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) save.mutate();
        }}
      >
        <label className="block">
          <span className="block text-[14px] font-bold">Name</span>
          <input value={name} maxLength={MAX_CHANNEL_NAME} onChange={(e) => setName(e.target.value)} className={field} />
        </label>
        <label className="block">
          <span className="block text-[14px] font-bold">What it is for</span>
          <input value={topic} maxLength={MAX_CHANNEL_TOPIC} onChange={(e) => setTopic(e.target.value)} className={field} />
        </label>
        <Err e={save.isError ? save.error : null} />
        <Button type="submit" size="lg" full disabled={save.isPending || !name.trim()}>
          Save
        </Button>
      </form>
    </Sheet>
  );
}

/** Friends to ask into a private channel. Each is asked once and says yes or no under Bond. */
function InviteSheet({ channel, open, onClose, onAsked, seats }: { channel: Channel; open: boolean; onClose: () => void; onAsked: () => void; seats: number }) {
  const fr = useAuthed(['bond-friends'], api.friends, open);
  const [asked, setAsked] = useState<Set<string>>(new Set());
  const ask = useMutation({
    mutationFn: (userId: string) => api.inviteToChannel(channel.id, userId),
    onSuccess: (_r, userId) => {
      setAsked((s) => new Set(s).add(userId));
      onAsked();
    },
  });
  const friends = (fr.data?.friends ?? []).filter((f) => f.status === 'friends');
  return (
    <Sheet open={open} onClose={onClose} title={`Ask friends into ${channel.name}`}>
      <p className="m-0 text-[14px] font-semibold text-ink-soft">
        Up to {MAX_CHANNEL_MEMBERS} people, counting the ones you ask. Right now {seats} {seats === 1 ? 'is' : 'are'} in. Only friends can be asked, and they see your name.
      </p>
      {fr.isPending && <SkeletonList className="mt-md" count={2} lines={1} label="Loading friends" />}
      {fr.data && friends.length === 0 && <p className="mt-md m-0 text-[14px] font-semibold text-ink-soft">No friends to ask yet. Add some under Bond first.</p>}
      <ul className="mt-md flex list-none flex-col gap-xs p-0 m-0">
        {friends.map((f) => (
          <li key={f.userId} className="flex items-center justify-between gap-sm rounded-tile bg-paper p-sm">
            <span className="min-w-0 truncate text-[16px] font-bold">
              {f.name}
              {f.handle ? <span className="font-semibold text-ink-soft"> @{f.handle}</span> : ''}
            </span>
            <Button size="sm" variant="outline" disabled={ask.isPending || asked.has(f.userId)} onClick={() => ask.mutate(f.userId)}>
              {asked.has(f.userId) ? 'Asked' : 'Ask'}
            </Button>
          </li>
        ))}
      </ul>
      <div className="mt-sm">
        <Err e={ask.isError ? ask.error : null} />
      </div>
    </Sheet>
  );
}
