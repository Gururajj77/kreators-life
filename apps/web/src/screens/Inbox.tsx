import { INBOX_TAB_META, isInboxTab, type InboxShow, type InboxTab } from '@kreators/shared';
import { useMutation } from '@tanstack/react-query';
import { Inert } from '../components/Inert';
import { useEffect, useState, type CSSProperties } from 'react';
import { Link } from 'react-router';
import { Button } from '../components/Button';
import { BackLink } from '../components/PageHeader';
import { Screen } from '../components/Screen';
import { Sheet } from '../components/Sheet';
import { api } from '../lib/api';
import { useInbox, useMe, useRefreshAll } from '../lib/queries';
import { Pager, usePage } from '../components/Pager';
import { useParamState } from '../lib/useParamState';

const ICON: Record<string, string> = { reply: '💬', mention: '📣', thread: '🧵', order: '🛍️', lead: '📨', booking: '📅', follow: '🫶', broadcast: '📣', reminder: '⏰', review: '⭐', affiliate: '🤝', moderation: '🛡️', coach: '🎯', team: '🛠️', party: '🎉', circle: '🫧', run: '🏃', season: '🏅' };
const SHOWS: [InboxShow, string][] = [
  ['inbox', 'Inbox'],
  ['unread', 'Unread'],
  ['archived', 'Archived'],
];

export function Inbox() {
  const pg = usePage();
  // The tab and the view live in the URL, so Back returns to them.
  const [tabRaw, setTab] = useParamState('tab', 'all');
  const [showRaw, setShow] = useParamState('show', 'inbox');
  const tab: InboxTab = isInboxTab(tabRaw) ? tabRaw : 'all';
  const show: InboxShow = showRaw === 'unread' || showRaw === 'archived' ? showRaw : 'inbox';
  const q = useInbox(pg.query, tab, show);
  const me = useMe();
  const refresh = useRefreshAll();
  const readAll = useMutation({ mutationFn: () => api.readAll(tab), onSuccess: () => refresh() });
  const readOne = useMutation({ mutationFn: (id: string) => api.readOne(id), onSuccess: () => refresh() });
  const archive = useMutation({ mutationFn: (v: { id: string; archived: boolean }) => api.archiveNote(v.id, v.archived), onSuccess: () => refresh() });
  const archiveRead = useMutation({ mutationFn: () => api.archiveRead(tab), onSuccess: () => refresh() });
  // Deleting for good always asks first: one note (its id) or everything archived in this tab ('all').
  const [toDelete, setToDelete] = useState<string | 'all' | null>(null);
  const remove = useMutation({
    mutationFn: (what: string) => (what === 'all' ? api.deleteArchived(tab) : api.deleteNote(what)),
    onSuccess: () => {
      setToDelete(null);
      refresh();
    },
  });
  const [time, setTime] = useState(me.data?.user.reminderTime ?? '');
  // The profile lands after the first render; take the saved time when it does.
  useEffect(() => {
    if (me.data) setTime(me.data.user.reminderTime ?? '');
  }, [me.data]);
  const saveTime = useMutation({ mutationFn: (t: string | null) => api.updateMe({ reminderTime: t }), onSuccess: () => refresh() });
  const list = q.data?.notifications ?? [];

  return (
    <Screen>
      <header className="pt-lg">
        <BackLink to="/apps">Apps</BackLink>
        <div className="flex items-center justify-between gap-sm">
          <h1 className="text-[30px]">Inbox</h1>
          {list.some((n) => !n.readAt) && (
            <Button variant="ghost" onClick={() => readAll.mutate()} disabled={readAll.isPending}>
              Mark all read
            </Button>
          )}
        </div>
      </header>

      <section className="mt-md rounded-card bg-card p-md shadow-toy-soft" aria-labelledby="rem-heading">
        <h2 id="rem-heading" className="text-[18px]">
          Daily reminder
        </h2>
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">
          {me.data?.user.reminderTime ? `Set for ${me.data.user.reminderTime} in ${me.data.user.timezone}. ` : 'Off. '}A nudge lands here at that time on any day you have not checked in yet.
        </p>
        <div className="mt-sm flex gap-xs">
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Reminder time" className="min-w-0 flex-1 rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]" />
          <Button onClick={() => saveTime.mutate(time || null)} disabled={saveTime.isPending || time === (me.data?.user.reminderTime ?? '')}>
            {saveTime.isPending ? 'Saving' : time ? 'Save' : 'Turn off'}
          </Button>
        </div>
      </section>

      <section className="mt-lg" aria-labelledby="list-heading">
        <h2 id="list-heading" className="text-[18px]">
          What happened
        </h2>
        <div className="mt-sm">
          <div className="scroll-row" role="group" aria-label="Tabs">
            {(q.data?.tabs ?? [{ tab: 'all' as InboxTab, unread: 0 }]).map((t) => (
              <button key={t.tab} type="button" aria-pressed={tab === t.tab} onClick={() => setTab(t.tab)} className={`toy shrink-0 rounded-pill border-2 px-sm py-xs text-[14px] font-bold ${tab === t.tab ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}>
                {INBOX_TAB_META[t.tab].name}
                {t.unread > 0 ? ` (${t.unread})` : ''}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-xs flex flex-wrap items-center gap-xs" role="group" aria-label="Show">
          {SHOWS.map(([k, label]) => (
            <button key={k} type="button" aria-pressed={show === k} onClick={() => setShow(k)} className={`toy rounded-pill border-2 px-sm py-xs text-[12px] font-extrabold ${show === k ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}>
              {label}
            </button>
          ))}
          {show !== 'archived' && list.some((n) => n.readAt) && (
            <Button size="sm" variant="ghost" onClick={() => archiveRead.mutate()} disabled={archiveRead.isPending}>
              Archive the read ones
            </Button>
          )}
          {show === 'archived' && list.length > 0 && (
            <Button size="sm" variant="ghost" onClick={() => setToDelete('all')}>
              Delete all archived
            </Button>
          )}
        </div>
        {list.length === 0 && <p className="mt-sm m-0 text-[14px] font-semibold text-ink-soft">{show === 'archived' ? 'Nothing archived here.' : show === 'unread' ? 'All caught up.' : 'Nothing yet. This is where replies, orders, bookings and team notes land.'}</p>}
        <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
          {list.map((n) => {
            const inner = (
              <>
                <span className="flex size-[40px] shrink-0 items-center justify-center rounded-pill bg-paper text-[18px]" aria-hidden="true">
                  {ICON[n.kind] ?? '🔔'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-[16px] ${n.readAt ? 'font-semibold' : 'font-extrabold'}`}>{n.title}</span>
                  {n.body && <span className="block text-[14px] font-semibold text-ink-soft"><Inert text={n.body} /></span>}
                  <span className="block text-[12px] font-bold text-ink-mute">{new Date(n.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                </span>
                {!n.readAt && <span className="size-[10px] shrink-0 rounded-pill bg-r1" aria-label="Unread" />}
              </>
            );
            const cls = 'toy toy-soft flex w-full items-start gap-sm rounded-tile bg-card p-sm text-left';
            return (
              <li key={n.id} className="flex items-stretch gap-xs">
                <span className="min-w-0 flex-1">
                  {n.link ? (
                    <Link to={n.link} className={cls} onClick={() => !n.readAt && readOne.mutate(n.id)}>
                      {inner}
                    </Link>
                  ) : (
                    <button type="button" className={cls} onClick={() => !n.readAt && readOne.mutate(n.id)}>
                      {inner}
                    </button>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => archive.mutate({ id: n.id, archived: !n.archivedAt })}
                  disabled={archive.isPending}
                  aria-label={n.archivedAt ? `Bring back "${n.title}"` : `Archive "${n.title}"`}
                  title={n.archivedAt ? 'Bring back' : 'Archive'}
                  className="toy toy-soft flex w-[48px] shrink-0 flex-col items-center justify-center gap-xs rounded-tile bg-card text-ink-soft hover:text-ink"
                >
                  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    {n.archivedAt ? <path d="M4 12l5-5M4 12l5 5M4 12h11a5 5 0 0 1 0 10h-2" /> : <><rect x="3" y="4" width="18" height="5" rx="1" /><path d="M5 9v10h14V9M10 13h4" /></>}
                  </svg>
                  {n.archivedAt && <span className="text-[12px] font-extrabold">Restore</span>}
                </button>
                {n.archivedAt && (
                  <button
                    type="button"
                    onClick={() => setToDelete(n.id)}
                    aria-label={`Delete "${n.title}" for good`}
                    title="Delete for good"
                    className="toy toy-soft flex w-[48px] shrink-0 flex-col items-center justify-center gap-xs rounded-tile border-2 border-r1/40 bg-card text-r1 hover:bg-r1/10"
                  >
                    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
                    </svg>
                    <span className="text-[12px] font-extrabold">Delete</span>
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        <Pager page={q.data?.page} label="notifications" />
        <Sheet open={toDelete !== null} onClose={() => setToDelete(null)} title={toDelete === 'all' ? 'Delete everything archived?' : 'Delete this note for good?'}>
          <p className="m-0 text-[14px] font-semibold text-ink-soft">{toDelete === 'all' ? 'Every archived note in this tab is removed and cannot be brought back.' : 'It is removed and cannot be brought back. Restore it instead if you might want it.'}</p>
          <div className="mt-md flex flex-col gap-xs">
            <button
              type="button"
              onClick={() => toDelete && remove.mutate(toDelete)}
              disabled={remove.isPending}
              className="toy inline-flex min-h-[56px] items-center justify-center rounded-pill bg-r1 px-md text-[18px] font-bold text-on-fill disabled:opacity-50"
              style={{ '--toy-color': 'var(--deep-servant_leader)' } as CSSProperties}
            >
              {remove.isPending ? 'Deleting' : 'Yes, delete for good'}
            </button>
            <Button variant="ghost" onClick={() => setToDelete(null)}>
              Keep {toDelete === 'all' ? 'them' : 'it'}
            </Button>
          </div>
        </Sheet>
      </section>
    </Screen>
  );
}
