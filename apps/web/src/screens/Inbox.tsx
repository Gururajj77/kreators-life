import { INBOX_TAB_META, isInboxTab, type InboxShow, type InboxTab, LOCALE } from '@kreators/shared';
import { useMutation } from '@tanstack/react-query';
import { Inert } from '../components/Inert';
import { useEffect, useState, type CSSProperties } from 'react';
import { Link } from 'react-router';
import { Button } from '../components/Button';
import { AppCover } from '../components/AppCover';
import { Screen } from '../components/Screen';
import { SkeletonList } from '../components/Skeleton';
import { Sheet } from '../components/Sheet';
import { TabRow } from '../components/TabRow';
import type { LucideIcon } from 'lucide-react';
import { AlarmClock, ArchiveRestore, AtSign, Bell, BriefcaseBusiness, CalendarCheck, Footprints, Handshake, Mail, Medal, Megaphone, MessageCircle, MessagesSquare, PartyPopper, ReceiptText, ShieldAlert, ShoppingBag, Star, Target, UserPlus, UsersRound, Wrench } from 'lucide-react';
import { AnimatedIcon } from '../components/AnimatedIcon';
import { Icon } from '../components/Icon';
import { api } from '../lib/api';
import { useInbox, useMe, useRefreshAll } from '../lib/queries';
import { Pager, usePage } from '../components/Pager';
import { useParamState } from '../lib/useParamState';
import { TeamInvites } from '../components/TeamInvites';

/** The icon for each kind of note; a kind this list does not know gets the bell. */
const ICON: Record<string, LucideIcon> = { reply: MessageCircle, mention: AtSign, thread: MessagesSquare, order: ShoppingBag, lead: Mail, booking: CalendarCheck, follow: UserPlus, broadcast: Megaphone, reminder: AlarmClock, review: Star, affiliate: Handshake, moderation: ShieldAlert, coach: Target, team: Wrench, party: PartyPopper, circle: UsersRound, run: Footprints, season: Medal, agency: BriefcaseBusiness, invoice: ReceiptText };
const iconFor = (kind: string): LucideIcon => (Object.hasOwn(ICON, kind) ? ICON[kind]! : Bell);
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
      <AppCover
        back={{ to: '/apps', label: 'Apps' }}
        title="Inbox"
        actions={
          list.some((n) => !n.readAt) ? (
            <Button variant="ghost" onClick={() => readAll.mutate()} disabled={readAll.isPending}>
              Mark all read
            </Button>
          ) : undefined
        }
      />

      <section className="mt-md rounded-card bg-card p-md shadow-toy-soft" aria-labelledby="rem-heading">
        <h2 id="rem-heading" className="text-title3">
          Daily reminder
        </h2>
        <p className="mt-xs m-0 text-subhead text-ink-soft">
          {me.data?.user.reminderTime ? `Set for ${me.data.user.reminderTime} in ${me.data.user.timezone}. A nudge lands here at that time on any day you have not checked in yet.` : 'Off. Pick a time, and a nudge lands here then on any day you have not checked in yet.'}
        </p>
        <div className="mt-sm flex gap-xs">
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Reminder time" className="min-w-0 flex-1 rounded-tile border-2 border-line bg-paper px-sm py-sm text-body" />
          <Button onClick={() => saveTime.mutate(time || null)} disabled={saveTime.isPending || time === (me.data?.user.reminderTime ?? '')}>
            {saveTime.isPending ? 'Saving' : !time && me.data?.user.reminderTime ? 'Turn off' : 'Save'}
          </Button>
        </div>
      </section>

      <section className="mt-lg" aria-labelledby="list-heading">
        <h2 id="list-heading" className="text-title2">
          What happened
        </h2>
        <TabRow
          className="mt-sm"
          label="Tabs"
          items={(q.data?.tabs ?? [{ tab: 'all' as InboxTab, unread: 0 }]).map((t) => ({ key: t.tab, label: `${INBOX_TAB_META[t.tab].name}${t.unread > 0 ? ` (${t.unread})` : ''}` }))}
          value={tab}
          onChange={setTab}
        />
        <div className="mt-xs flex flex-wrap items-center gap-xs" role="group" aria-label="Show">
          {SHOWS.map(([k, label]) => (
            <button key={k} type="button" aria-pressed={show === k} onClick={() => setShow(k)} className={`toy min-h-[44px] rounded-pill border-2 px-sm py-xs text-subhead font-medium ${show === k ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}>
              {label}
            </button>
          ))}
          {show !== 'archived' && list.some((n) => n.readAt) && (
            <Button size="sm" variant="ghost" onClick={() => archiveRead.mutate()} disabled={archiveRead.isPending}>
              <AnimatedIcon name={archiveRead.isPending ? 'loading' : 'archive'} size={16} />
              Archive the read ones
            </Button>
          )}
          {show === 'archived' && list.length > 0 && (
            <Button size="sm" variant="ghost" onClick={() => setToDelete('all')}>
              Delete all archived
            </Button>
          )}
        </div>
        {q.isPending && <SkeletonList className="mt-sm" count={4} lines={2} label="Loading your inbox" />}
        {!q.isPending && list.length === 0 && <p className="mt-sm m-0 text-subhead text-ink-soft">{show === 'archived' ? 'Nothing archived here.' : show === 'unread' ? 'All caught up.' : tab === 'agency' ? 'Nothing from your clients yet. Approvals, change asks, months made and invoices due land here.' : 'Nothing yet. This is where replies, orders, bookings and team notes land.'}</p>}
        <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
          {list.map((n) => {
            const inner = (
              <>
                <span className="flex size-[40px] shrink-0 items-center justify-center rounded-pill bg-paper text-ink-soft">
                  <Icon icon={iconFor(n.kind)} size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block ${n.readAt ? 'text-row-title' : 'text-card-title pr-xs'}`}>{n.title}</span>
                  {n.body && <span className="block text-card-note text-ink-soft"><Inert text={n.body} /></span>}
                  <span className="block text-caption text-ink-mute">{new Date(n.createdAt).toLocaleString(LOCALE, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                </span>
                {/* In the corner, out of the flow, so the words keep the row's width on a phone. */}
                {!n.readAt && <span className="absolute top-xs right-xs size-[10px] rounded-pill bg-r1" aria-label="Unread" />}
              </>
            );
            const cls = 'toy toy-soft relative flex w-full items-start gap-sm rounded-tile bg-card p-sm text-left';
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
                  {/* An Agency team invite is answered right here, so it works even while Agency is off for them. */}
                  {/^team-(?!access-)/.test(n.id) && <TeamInvites only={n.id.slice(5)} compact className="mt-xs" />}
                </span>
                <button
                  type="button"
                  onClick={() => archive.mutate({ id: n.id, archived: !n.archivedAt })}
                  disabled={archive.isPending}
                  aria-label={n.archivedAt ? `Bring back "${n.title}"` : `Archive "${n.title}"`}
                  title={n.archivedAt ? 'Bring back' : 'Archive'}
                  className="toy toy-soft flex w-[48px] shrink-0 flex-col items-center justify-center gap-xs rounded-tile bg-card text-ink-soft hover:text-ink"
                >
                  {n.archivedAt ? <Icon icon={ArchiveRestore} size={20} /> : <AnimatedIcon name="archive" size={20} />}
                  {n.archivedAt && <span className="text-caption font-semibold">Restore</span>}
                </button>
                {n.archivedAt && (
                  <button
                    type="button"
                    onClick={() => setToDelete(n.id)}
                    aria-label={`Delete "${n.title}" for good`}
                    title="Delete for good"
                    className="toy toy-soft flex w-[48px] shrink-0 flex-col items-center justify-center gap-xs rounded-tile border-2 border-r1/40 bg-card text-r1 hover:bg-r1/10"
                  >
                    <AnimatedIcon name="trash" size={20} />
                    <span className="text-caption font-semibold">Delete</span>
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        <Pager page={q.data?.page} label="notifications" />
        <Sheet open={toDelete !== null} onClose={() => setToDelete(null)} title={toDelete === 'all' ? 'Delete everything archived?' : 'Delete this note for good?'}>
          <p className="m-0 text-subhead text-ink-soft">{toDelete === 'all' ? 'Every archived note in this tab is removed and cannot be brought back.' : 'It is removed and cannot be brought back. Restore it instead if you might want it.'}</p>
          <div className="mt-md flex flex-col gap-xs">
            <button
              type="button"
              onClick={() => toDelete && remove.mutate(toDelete)}
              disabled={remove.isPending}
              className="toy inline-flex min-h-[56px] items-center justify-center rounded-pill bg-r1 px-md text-headline text-on-fill disabled:opacity-50"
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
