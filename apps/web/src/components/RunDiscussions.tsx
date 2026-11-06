import { CHANNEL_POLL_MS, isNearBottom, LOCALE, MAX_CHANNEL_MESSAGE, mergeChannelLines, type RunTalk, type RunTalkLine } from '@kreators/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import gsap from 'gsap';
import { useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ApiError, api, errorText } from '../lib/api';
import { dateTime, eventTime } from '../lib/date';
import { useAuthed } from '../lib/queries';
import { useSession } from '../lib/store';
import { useParamState } from '../lib/useParamState';
import { AnonToggle } from './AnonToggle';
import { Button } from './Button';
import { AskSheet, Dot, LineActions, type Ask } from './Channels';
import { ChatComposer } from './Chat';
import { ErrorLine } from './ErrorLine';
import { IconTag } from './FactTag';
import { Inert } from './Inert';
import { Pager, usePage } from './Pager';
import { SkeletonList } from './Skeleton';
import { StatusTag } from './StatusTag';

const when = dateTime;

/** How many run discussions have lines this person has not read, for the tab's dot. Asked once a minute. */
export function useRunTalksUnread(): number {
  const token = useSession((s) => s.token);
  const q = useQuery({ queryKey: ['run-talks-unread'], queryFn: api.runTalksUnread, enabled: Boolean(token), refetchInterval: 60_000, retry: false });
  return q.data?.unread ?? 0;
}

/**
 * Kreators Run's Discussions: one per run the person is part of (they host it, were in the club by the time it ended, or logged it),
 * drawn like a channel. The open one lives in the URL as `run`, so Back and a notice's link both land on it.
 */
export function RunDiscussions() {
  const [open, setOpen] = useParamState('run', '');
  if (open) return <TalkView runId={open} onBack={() => setOpen('')} />;
  return <TalkList onOpen={setOpen} />;
}

function talkWhen(t: RunTalk): string {
  if (!t.open) return 'closed for new lines';
  return `open until ${new Date(t.closesAt).toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' })}`;
}

function TalkList({ onOpen }: { onOpen: (id: string) => void }) {
  const pg = usePage('rt');
  const q = useAuthed(['run-talks', pg.query], () => api.runTalks(pg.query));
  const list = q.data?.talks ?? [];
  return (
    <div className="mt-md">
      <p className="m-0 text-subhead text-ink-soft">One for each run you are part of, with only its runners and host.</p>
      {q.isError && <ErrorLine e={q.error} className="mt-xs" />}
      {q.isPending && <SkeletonList className="mt-md" count={3} lines={2} label="Loading discussions" />}
      {q.data && list.length === 0 && (
        <div className="mt-md rounded-card border-2 border-dashed border-line p-md">
          <p className="m-0 text-subhead text-ink-soft">No discussions yet. Join a club, and each of its runs opens one here.</p>
        </div>
      )}
      <ul className="mt-md flex list-none flex-col gap-xs p-0 m-0">
        {list.map((t) => (
          <li key={t.runId}>
            <button type="button" onClick={() => onOpen(t.runId)} className="toy toy-soft block w-full rounded-tile bg-card p-sm text-left text-ink">
              <span className="flex items-start justify-between gap-xs">
                <span className="min-w-0 text-card-title">
                  {t.title}
                  <Dot n={t.unread} />
                </span>
                {!t.open && <StatusTag tone="neutral" fit>Closed</StatusTag>}
              </span>
              <span className="block text-card-note text-ink-soft">
                {t.clubName}, {eventTime(t.startsAt)}
              </span>
              <span className="block text-caption text-ink-soft">
                {t.people} {t.people === 1 ? 'person' : 'people'}
                {t.lastLineAt ? `, last line ${when(t.lastLineAt)}` : ', no lines yet'}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <Pager page={q.data?.page} prefix="rt" label="discussions" />
    </div>
  );
}

/** The lines of one run's discussion: held on the screen and, while the tab shows, asked for every few seconds after the last one. */
function useTalkLines(runId: string) {
  const [lines, setLines] = useState<RunTalkLine[]>([]);
  const [earlier, setEarlier] = useState(false);
  const [status, setStatus] = useState<'loading' | 'ready' | 'gone'>('loading');
  const held = useRef<RunTalkLine[]>([]);
  const busy = useRef(false);
  const stopped = useRef(false);
  const fresh = useRef<Set<number>>(new Set());
  const apply = useCallback((next: RunTalkLine[]) => {
    held.current = next;
    setLines(next);
  }, []);

  const pull = useCallback(async () => {
    if (busy.current || stopped.current) return;
    busy.current = true;
    try {
      for (let i = 0; i < 5; i += 1) {
        const cur = held.current;
        const last = cur.at(-1)?.seq;
        const r = await api.runTalkLines(runId, { after: last, from: cur[0]?.seq, read: true });
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
      if (e instanceof ApiError && (e.status === 404 || e.status === 403)) {
        stopped.current = true;
        setStatus('gone');
      }
    } finally {
      busy.current = false;
    }
  }, [runId, apply]);

  useEffect(() => {
    held.current = [];
    stopped.current = false;
    setLines([]);
    setStatus('loading');
    setEarlier(false);
    void pull();
    const timer = window.setInterval(() => {
      if (stopped.current) window.clearInterval(timer);
      else if (document.visibilityState === 'visible') void pull();
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
    const r = await api.runTalkLines(runId, { before: first });
    apply(mergeChannelLines(r.lines, held.current));
    setEarlier(r.more);
  }, [runId, apply]);

  return { lines, earlier, status, pull, loadEarlier, fresh };
}

function TalkView({ runId, onBack }: { runId: string; onBack: () => void }) {
  const qc = useQueryClient();
  const meta = useAuthed(['run-talk', runId], () => api.runTalk(runId));
  const t = meta.data?.talk;
  const { lines, earlier, status, pull, loadEarlier, fresh } = useTalkLines(runId);
  const reduce = useReducedMotion();
  const box = useRef<HTMLOListElement>(null);
  const stick = useRef(true);
  const anchor = useRef<number | null>(null);
  const lastSeen = useRef(0);
  const [unseen, setUnseen] = useState(0);
  const [reply, setReply] = useState<RunTalkLine | null>(null);
  const [ask, setAsk] = useState<Ask | null>(null);
  const [anonymous, setAnonymous] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [loadingEarlier, setLoadingEarlier] = useState(false);

  // Reading the lines marks them read on the server: the list and the tab's dot follow.
  useEffect(() => {
    if (status === 'ready') {
      void qc.invalidateQueries({ queryKey: ['run-talks'] });
      void qc.invalidateQueries({ queryKey: ['run-talks-unread'] });
    }
  }, [status, lines.length, qc]);

  const say = useMutation({
    mutationFn: (text: string) => api.runTalkSay(runId, text, { anonymous, replyTo: reply?.id ?? null }),
    onMutate: () => setFailed(null),
    onSuccess: () => {
      setReply(null);
      stick.current = true;
      void pull();
    },
    onError: (_e, text) => setFailed(text),
  });
  const unsay = useMutation({ mutationFn: (mid: string) => api.runTalkUnsay(runId, mid), onSuccess: () => void pull() });
  const report = useMutation({ mutationFn: (mid: string) => api.runTalkReport(runId, mid) });
  const block = useMutation({ mutationFn: (mid: string) => api.runTalkBlockAuthor(runId, mid), onSuccess: () => void pull() });

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
  }, [runId]);
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
      <div className="mt-md">
        <Button variant="outline" size="sm" onClick={onBack}>
          All discussions
        </Button>
        <p className="mt-md m-0 font-semibold">That discussion is not open to you. Only a run's runners and its host are in it.</p>
      </div>
    );

  const writable = Boolean(t?.open);
  return (
    <div className="mt-md">
      <Button variant="outline" size="sm" onClick={onBack}>
        All discussions
      </Button>
      {t ? (
        <header className="mt-sm">
          <h2 className="text-title2">{t.title}</h2>
          <p className="mt-xs m-0 text-subhead text-ink-soft">
            {t.clubName}, {eventTime(t.startsAt)}
          </p>
          <p className="mt-xs m-0 text-caption text-ink-soft">
            {t.people} {t.people === 1 ? 'person' : 'people'}, {talkWhen(t)}
          </p>
        </header>
      ) : (
        <SkeletonList className="mt-sm" count={1} lines={2} label="Loading discussion" />
      )}

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
          aria-label={`Lines about ${t?.title ?? 'this run'}`}
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
          {status === 'ready' && lines.length === 0 && <li className="text-subhead text-ink-soft">Nothing here yet. Say hello, or ask where to meet.</li>}
          {lines.map((l) => (
            <li key={l.id} data-fresh={fresh.current.has(l.seq) ? '' : undefined} className={`rounded-tile p-sm text-subhead ${l.mine ? 'bg-ink text-on-ink' : 'bg-card shadow-toy-soft'}`}>
              {l.replyTo && (
                <span className={`mb-xs block truncate rounded-inner-sm px-xs text-caption ${l.mine ? 'bg-on-ink/15' : 'bg-paper text-ink-soft'}`}>
                  {l.replyTo.name}: <Inert text={l.replyTo.body} />
                </span>
              )}
              <span className="flex flex-wrap items-baseline justify-between gap-xs">
                <span className="font-bold">
                  {l.mine ? 'You' : l.name}
                  {l.anonymous && <span className={`ml-xs rounded-pill px-xs text-caption2 leading-[18px] ${l.mine ? 'bg-on-ink/15' : 'bg-line text-ink-soft'}`}>{l.mine ? `Anonymous as ${l.name}` : 'Anonymous'}</span>}
                  {l.host && <IconTag className="ml-xs" tone="warn" icon="Crown">Host</IconTag>}
                </span>
                <span className={`text-caption ${l.mine ? 'text-on-ink/70' : 'text-ink-soft'}`}>{when(l.createdAt)}</span>
              </span>
              <span className="block whitespace-pre-wrap">
                <Inert text={l.body} />
              </span>
              <LineActions
                line={l}
                canWrite={writable}
                canTakeDown={l.mine || Boolean(t?.host)}
                canMuteIt={false}
                onReply={() => setReply(l)}
                onTakeDown={() => setAsk({ title: 'Take this line down?', body: l.mine ? 'Your line is removed for everyone in the discussion. This cannot be undone.' : 'The line is removed for everyone in the discussion. This cannot be undone.', action: 'Yes, take it down', run: () => unsay.mutate(l.id) })}
                onReport={() => setAsk({ title: 'Tell the team about this line?', body: 'The team reads the line and decides what to do. The writer is not told who sent it.', action: 'Yes, tell the team', run: () => report.mutate(l.id) })}
                onBlock={() => setAsk({ title: `Block ${l.name}?`, body: "You will not see each other's lines, and any friendship ends. You can undo it under Bond.", action: 'Yes, block', run: () => block.mutate(l.id) })}
                onMute={() => undefined}
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
      <ErrorLine e={unsay.isError ? unsay.error : report.isError ? report.error : block.isError ? block.error : null} className="mt-xs" />
      {report.isSuccess && (
        <p role="status" className="mt-xs m-0 text-subhead text-ink-soft">
          Thanks. The team has it.
        </p>
      )}
      {t && !writable && <p className="mt-sm m-0 text-subhead text-ink-soft">This discussion is closed. You can still read it.</p>}
      {writable && (
        <div className="mt-sm">
          {reply && (
            <p className="mb-xs m-0 flex items-center justify-between gap-xs rounded-tile bg-paper p-xs text-caption text-ink-soft">
              <span className="min-w-0 truncate">
                Replying to {reply.mine ? 'yourself' : reply.name}: <Inert text={reply.body} />
              </span>
              <Button variant="ghost" size="sm" onClick={() => setReply(null)}>
                Cancel
              </Button>
            </p>
          )}
          <AnonToggle on={anonymous} onChange={setAnonymous} className="mb-xs" />
          <ChatComposer placeholder="Write to the runners" maxLength={MAX_CHANNEL_MESSAGE} disabled={say.isPending} onSend={(text) => say.mutate(text)} />
          {failed && (
            <div role="alert" className="mt-xs rounded-tile bg-r1/15 p-sm text-subhead">
              <p className="m-0">That line did not send: {errorText(say.error, 'That did not work. Try again.')}</p>
              <p className="mt-xs m-0 break-words text-ink-soft">{failed}</p>
              <Button size="sm" variant="outline" className="mt-xs" disabled={say.isPending} onClick={() => say.mutate(failed)}>
                Try again
              </Button>
            </div>
          )}
        </div>
      )}
      <AskSheet ask={ask} onClose={() => setAsk(null)} />
    </div>
  );
}
