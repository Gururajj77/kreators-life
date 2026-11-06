import { MAX_EVENT_MESSAGE, type EventApp, type EventMessage, type EventPerson } from '@kreators/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Inert } from './Inert';
import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { useSession } from '../lib/store';
import { AnonToggle } from './AnonToggle';
import { Button } from './Button';
import { ConfirmDelete } from './ConfirmDelete';
import { Section } from './Section';
import { FIELD } from '../lib/ui';
import { dateTime } from '../lib/date';
import { IconTag } from './FactTag';

const when = dateTime;
const msg = (e: unknown) => (e instanceof Error ? e.message : 'That did not work. Try again.');
const friendWord: Record<EventPerson['friend'], string> = { none: '', sent: 'Request sent', pending: 'Asked you', friends: 'Friends' };

/**
 * What happens around an event once you are in it: the host's photo folder, a conversation for the guests,
 * and the guests who said they would like to meet others. Shown to the host and the guests only.
 */
export function EventPanel({ app, id, talk = true }: { app: EventApp; id: string; /** False where the conversation lives elsewhere (a run's is its discussion in Kreators Run). */ talk?: boolean }) {
  const token = useSession((s) => s.token);
  const qc = useQueryClient();
  const key = ['event-extras', app, id];
  const q = useQuery({ queryKey: key, queryFn: () => api.eventExtras(app, id), enabled: Boolean(token && id), refetchInterval: 10_000, retry: false });
  const refresh = () => void qc.invalidateQueries({ queryKey: key });
  const [text, setText] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [to, setTo] = useState<EventMessage | null>(null);
  const [url, setUrl] = useState('');
  const [note, setNote] = useState('');
  const [dropLine, setDropLine] = useState<EventMessage | null>(null);
  const [dropFolder, setDropFolder] = useState(false);
  const end = useRef<HTMLLIElement | null>(null);
  const d = q.data;
  const count = d?.messages.length ?? 0;
  useEffect(() => {
    if (count > 0) end.current?.scrollIntoView({ block: 'nearest' });
  }, [count]);

  const say = useMutation({ mutationFn: () => api.eventSay(app, id, text, { anonymous, parentId: to?.id ?? null }), onSuccess: () => { setText(''); setTo(null); refresh(); } });
  const unsay = useMutation({ mutationFn: (mid: string) => api.eventUnsay(app, id, mid), onSuccess: () => { setDropLine(null); refresh(); } });
  const share = useMutation({ mutationFn: () => api.eventPhotos(app, id, url, note), onSuccess: () => { setUrl(''); setNote(''); refresh(); } });
  const unshare = useMutation({ mutationFn: () => api.eventPhotosOff(app, id), onSuccess: () => { setDropFolder(false); refresh(); } });
  const listed = useMutation({ mutationFn: (on: boolean) => api.eventListed(app, id, on), onSuccess: refresh });
  const connect = useMutation({ mutationFn: (userId: string) => api.eventConnect(app, id, userId), onSuccess: refresh });
  const err = (m: { isError: boolean; error: unknown }) => (m.isError ? <p role="alert" className="mt-xs m-0 text-subhead">{msg(m.error)}</p> : null);

  if (!d) return null;
  const host = d.role === 'host';
  return (
    <>
      <Section id={`photos-${id}`} title="Photos" lede={host ? 'Share one folder. Everyone on the list is told when it is up.' : undefined}>
        {d.photos ? (
          <div className="rounded-tile bg-card p-sm shadow-toy-soft">
            <a href={d.photos.url} target="_blank" rel="noreferrer noopener" className="toy inline-flex min-h-[48px] items-center rounded-pill bg-ink px-md text-headline text-on-ink">
              Get your photos
            </a>
            {d.photos.note && <p className="mt-xs m-0 text-subhead text-ink-soft">{d.photos.note}</p>}
            <p className="mt-xs m-0 text-caption text-ink-soft">Opens the host's shared folder in a new tab. Only open links you trust.</p>
            {host && (
              <Button variant="outline" size="sm" className="mt-sm" onClick={() => { unshare.reset(); setDropFolder(true); }} disabled={unshare.isPending}>
                Take the folder down
              </Button>
            )}
          </div>
        ) : (
          <p className="m-0 text-subhead text-ink-soft">{host ? 'No folder shared yet.' : d.ended ? 'The host has not shared photos yet. You will get a note when they do.' : 'Photos show up here after the event, if the host shares them.'}</p>
        )}
        {host && (
          <form className="mt-sm rounded-tile bg-card p-sm shadow-toy-soft" onSubmit={(e) => { e.preventDefault(); share.mutate(); }}>
            <label className="block">
              <span className="block text-subhead font-semibold">{d.photos ? 'Change the folder link' : 'Link to the photo folder'}</span>
              <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Google Drive, Google Photos, Dropbox, iCloud, OneDrive or WeTransfer" inputMode="url" autoCapitalize="none" className={FIELD} />
            </label>
            <label className="mt-sm block">
              <span className="block text-subhead font-semibold">A line for guests (optional)</span>
              <input value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="Open until the end of the month" className={FIELD} />
            </label>
            <p className="mt-xs m-0 text-caption text-ink-soft">Set the folder to "anyone with the link can view" so guests can open it.</p>
            <Button type="submit" variant="outline" className="mt-sm" disabled={share.isPending || !url.trim()}>Share the folder</Button>
            {err(share)}
          </form>
        )}
      </Section>

      <Section id={`people-${id}`} title="Meet other guests" lede="Guests who said yes to meeting people. Add one and they get a friend request; chats stay anonymous in Bond.">
        <label className="flex min-h-[44px] items-center gap-sm rounded-tile bg-card p-sm shadow-toy-soft">
          <input type="checkbox" checked={d.iAmListed} onChange={(e) => listed.mutate(e.target.checked)} disabled={listed.isPending} className="size-[22px]" />
          <span className="text-subhead">List me so other guests can connect with me</span>
        </label>
        {err(listed)}
        {d.people.length === 0 ? (
          <p className="mt-sm m-0 text-subhead text-ink-soft">No one else is listed yet. Only people who take friend requests and have not blocked you or been blocked by you show here.</p>
        ) : (
          <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
            {d.people.map((p) => (
              <li key={p.userId} className="flex items-center justify-between gap-sm rounded-tile bg-card p-sm shadow-toy-soft">
                <span className="min-w-0">
                  <span className="block text-balance text-card-title [overflow-wrap:anywhere]">{p.name}</span>
                  {p.handle && <span className="block text-card-note text-ink-soft">@{p.handle}</span>}
                </span>
                {p.friend === 'none' || p.friend === 'pending' ? (
                  <Button variant="outline" size="sm" onClick={() => connect.mutate(p.userId)} disabled={connect.isPending}>
                    {p.friend === 'pending' ? 'Say yes' : 'Connect'}
                  </Button>
                ) : (
                  <span className="shrink-0 text-caption text-ink-soft">{friendWord[p.friend]}</span>
                )}
              </li>
            ))}
          </ul>
        )}
        {err(connect)}
      </Section>

      {talk && (
        <Section id={`talk-${id}`} title="Conversation" lede="Say hello, share a plan, ask where to meet. It is open to this event's guests and host, and stays open for a month after.">
          <ul className="m-0 flex max-h-[360px] list-none flex-col gap-xs overflow-y-auto rounded-tile bg-paper p-sm" aria-live="polite" aria-label="Conversation">
            {d.messages.length === 0 && <li className="text-subhead text-ink-soft">No messages yet. Start it.</li>}
            {d.messages.map((m) => (
              <li key={m.id} style={{ marginLeft: `calc(var(--spacing-md) * ${m.depth})` }} className={`rounded-tile p-sm text-subhead ${m.mine ? 'bg-ink text-on-ink' : 'bg-card'}`}>
                <span className="flex items-baseline justify-between gap-xs">
                  <span className="font-bold">
                    {m.mine ? 'You' : m.name}
                    {m.anonymous && <span className={`ml-xs rounded-pill px-xs text-caption2 leading-[18px] ${m.mine ? 'bg-on-ink/15' : 'bg-line text-ink-soft'}`}>{m.mine ? `Anonymous as ${m.name}` : 'Anonymous'}</span>}
                    {m.host && <IconTag className="ml-xs" tone="warn" icon="Crown">Host</IconTag>}
                  </span>
                  <span className={`text-caption ${m.mine ? 'text-on-ink/70' : 'text-ink-soft'}`}>{when(m.createdAt)}</span>
                </span>
                <span className="block whitespace-pre-wrap"><Inert text={m.body} /></span>
                <button type="button" onClick={() => setTo(m)} className={`mt-xs mr-sm inline-flex min-h-[44px] items-center text-caption underline underline-offset-4 ${m.mine ? 'text-on-ink/80' : 'text-ink-soft'}`}>
                  Reply
                </button>
                {(m.mine || host) && (
                  <button type="button" onClick={() => { unsay.reset(); setDropLine(m); }} className={`mt-xs inline-flex min-h-[44px] items-center text-caption underline underline-offset-4 ${m.mine ? 'text-on-ink/80' : 'text-ink-soft'}`}>
                    Take down
                  </button>
                )}
              </li>
            ))}
            <li ref={end} aria-hidden="true" />
          </ul>
          {to && (
            <p className="mt-sm m-0 flex items-center justify-between gap-xs rounded-tile bg-paper p-xs text-caption text-ink-soft">
              <span className="min-w-0 truncate">Replying to {to.mine ? 'yourself' : to.name}: <Inert text={to.body} /></span>
              <Button variant="ghost" size="sm" onClick={() => setTo(null)}>Cancel</Button>
            </p>
          )}
          <form className="mt-sm flex gap-xs" onSubmit={(e) => { e.preventDefault(); if (text.trim()) say.mutate(); }}>
            <label className="min-w-0 flex-1">
              <span className="sr-only">Your message</span>
              <input value={text} maxLength={MAX_EVENT_MESSAGE} onChange={(e) => setText(e.target.value)} placeholder="Write to the guests" className={FIELD + ' !mt-0'} />
            </label>
            <Button type="submit" variant="outline" disabled={say.isPending || !text.trim()}>Send</Button>
          </form>
          <AnonToggle on={anonymous} onChange={setAnonymous} className="mt-xs" />
          {err(say)}
        </Section>
      )}
      <ConfirmDelete
        open={dropFolder}
        title="Take the folder down?"
        body="Guests can no longer open the photos from here. You can share a folder again any time."
        pending={unshare.isPending}
        failed={unshare.isError}
        onYes={() => unshare.mutate()}
        onClose={() => setDropFolder(false)}
        yes="Yes, take it down"
      />
      <ConfirmDelete
        open={dropLine !== null}
        title="Take this message down?"
        body={dropLine?.mine ? 'Your message is removed for every guest. This cannot be undone.' : 'The message is removed for every guest. This cannot be undone.'}
        pending={unsay.isPending}
        failed={unsay.isError}
        onYes={() => dropLine && unsay.mutate(dropLine.id)}
        onClose={() => setDropLine(null)}
        yes="Yes, take it down"
      />
    </>
  );
}
