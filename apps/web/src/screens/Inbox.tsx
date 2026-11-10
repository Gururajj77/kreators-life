import { INBOX_TAB_META, isInboxKind, isInboxTab, type InboxKind, type InboxShow, type InboxTab, type Notification } from '@kreators/shared';
import { useMutation } from '@tanstack/react-query';
import { Inert } from '../components/Inert';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Button } from '../components/Button';
import { AppCover } from '../components/AppCover';
import { Screen } from '../components/Screen';
import { SkeletonList } from '../components/Skeleton';
import { Sheet } from '../components/Sheet';
import { TabRow } from '../components/TabRow';
import type { LucideIcon } from 'lucide-react';
import { AlarmClock, Archive, ArchiveRestore, AtSign, Award, Bell, Briefcase, BriefcaseBusiness, Building2, CalendarCheck, CalendarDays, Clapperboard, Crown, Footprints, Gift, GraduationCap, HandCoins, Handshake, HeartHandshake, LifeBuoy, Mail, MailOpen, Mails, Medal, Megaphone, MessageCircle, MessageSquareText, MessagesSquare, PartyPopper, ReceiptText, ShieldAlert, ShieldCheck, ShoppingBag, Star, Tag, Target, Trash2, Trophy, Tv, Undo2, UserPlus, UsersRound, Wrench } from 'lucide-react';
import { AnimatedIcon } from '../components/AnimatedIcon';
import { Icon } from '../components/Icon';
import { ExpandButton } from '../components/ExpandButton';
import { api } from '../lib/api';
import { clockOf, stamp, zoneName } from '../lib/date';
import { focusHeadingAfter } from '../lib/focusHeading';
import { useInbox, useMe, useRefreshAll } from '../lib/queries';
import { Pager, usePage } from '../components/Pager';
import { useParamState } from '../lib/useParamState';
import { TeamInvites } from '../components/TeamInvites';
import { ErrorLine } from '../components/ErrorLine';
import { FIELD_LINE, RED_YES_LG } from '../lib/ui';

/** The icon for each kind of note (every `InboxKind` has one, the type insists); a row of a kind this list does not know gets the bell. */
const ICON: Record<InboxKind, LucideIcon> = {
  reply: MessageCircle, mention: AtSign, dm: MessageSquareText, support: LifeBuoy, moderation: ShieldAlert,
  thread: MessagesSquare, follow: UserPlus, broadcast: Megaphone, sequence: Mails, season: Medal,
  reminder: AlarmClock,
  party: PartyPopper, circle: UsersRound, run: Footprints, event: CalendarDays,
  bond: HeartHandshake,
  work: Briefcase, campaign: Clapperboard, org: Building2, collab: Gift, win: Trophy, club: Crown, tv: Tv, fund: HandCoins,
  order: ShoppingBag, booking: CalendarCheck, refund: Undo2, lead: Mail, affiliate: Handshake, review: Star, certificate: Award, store: Tag, kyc: ShieldCheck, invoice: ReceiptText,
  school: GraduationCap, invite: MailOpen, coach: Target,
  agency: BriefcaseBusiness,
  team: Wrench,
};
const iconFor = (kind: string): LucideIcon => (isInboxKind(kind) ? ICON[kind] : Bell);
/** What lands in each tab, said when it is empty (here, not in shared, so the shared chunk stays under its budget). */
const EMPTY: Record<InboxTab, string> = {
  all: 'Nothing yet. Replies, reminders, events, orders and the rest land here.',
  replies: 'Nothing yet. Replies to you, @mentions, answers from the team and from creators land here.',
  following: 'Nothing yet. New followers, posts you follow and notes from creators land here.',
  reminders: 'Nothing yet. Your own reminders, Remember tasks, focus and reviews land here.',
  events: 'Nothing yet. Seats, changes and reminders for events, circles and runs land here.',
  friends: 'Nothing yet. Friend requests, introductions and private channels land here.',
  work: 'Nothing yet. Applications, campaigns, brand collabs, reward payouts, Club and pitches land here.',
  shop: 'Nothing yet. Orders, bookings, refunds, offers and invoices due land here.',
  learning: 'Nothing yet. Programs, hand-ins, course invites and your life coach land here.',
  agency: 'Nothing from your clients yet. Approvals, change asks, months made and invoices due land here.',
  team: 'Nothing for the team yet. Alerts, coach asks and notices land here.',
};
/**
 * A note opens the page where its thing is and lands on its section (the server's links; lib/useLandOnHash.ts lands on the hash). Notes
 * written before 2026-11-07 keep the link they were stored with, so these open in the new place: matched on the old link and the note's
 * id pattern, kind or words, so a link written since passes through untouched. scripts/check-note-links.mjs checks that each `to` lands.
 */
const MOVED: { from: string; when: (n: Notification) => boolean; to: string | null }[] = [
  // Your own reminders were sent to Daily, where a laptop has only the small bubble: they live in Home's Water and reminders card.
  { from: '/today', when: (n) => n.kind === 'reminder' && n.body === 'Your own reminder.', to: '/home#reminders' },
  { from: '/today', when: (n) => n.id.startsWith('supp-'), to: '/today#supplements' },
  { from: '/finance', when: (n) => n.kind === 'invoice', to: '/finance#owed-heading' },
  { from: '/shop/customers', when: (n) => n.kind === 'kyc', to: '/shop/customers#kyc-heading' },
  { from: '/help', when: (n) => n.kind === 'support', to: '/help#mine-heading' },
  { from: '/library', when: (n) => n.kind === 'dm', to: '/library#dm-heading' },
  { from: '/library', when: (n) => n.kind === 'booking', to: '/library#bk-heading' },
  { from: '/club', when: (n) => n.kind === 'club', to: '/club#mine-heading' },
  { from: '/win', when: (n) => n.kind === 'win', to: '/win#mine-heading' },
  { from: '/bond', when: (n) => /introduc/i.test(n.title) || /^(Reach them at|Find them at|Say hello in the community)/.test(n.body), to: '/bond#bond-intros' },
  { from: '/bond', when: (n) => n.kind === 'bond', to: '/bond#bond-friends' },
  { from: '/coaching', when: (n) => n.title.startsWith('A note from'), to: '/coaching#notes-heading' },
  { from: '/coaching', when: (n) => n.title.endsWith('asked you to be their life coach'), to: '/coaching#asks-heading' },
  { from: '/shop/audience', when: (n) => n.kind === 'lead', to: '/shop/audience#leads-heading' },
  { from: '/shop/audience', when: (n) => n.kind === 'affiliate', to: '/shop/audience#aff-heading' },
  { from: '/shop/audience', when: (n) => n.kind === 'follow', to: '/shop/audience#fol-heading' },
  // A copyright notice has no page in the app; it went to Admin's People list.
  { from: '/admin', when: (n) => /^Copyright (counter-)?notice$/.test(n.title), to: null },
];
const noteLink = (n: Notification): string | null => {
  const moved = MOVED.find((m) => m.from === n.link && m.when(n));
  return moved ? moved.to : n.link;
};
/** The pill's word for a tab whose whole name is long; the All sheet and the empty lines keep the whole name. */
const SHORT: Partial<Record<InboxTab, string>> = { replies: 'Replies', shop: 'Shop', learning: 'School' };
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
  const asked: InboxTab = isInboxTab(tabRaw) ? tabRaw : 'all';
  const show: InboxShow = showRaw === 'unread' || showRaw === 'archived' ? showRaw : 'inbox';
  const q = useInbox(pg.query, asked, show);
  // The tab the server answered for: a tab not offered (Team for a member, Agency with no Agency notes and Agency off) is served as
  // Everything, so the row marks Everything and every action below acts on what is on screen.
  const tab: InboxTab = q.data?.tab ?? asked;
  const me = useMe();
  const refresh = useRefreshAll();
  // The note just archived, offered back for about ten seconds or until the next action ("Archived. Undo").
  const [undo, setUndo] = useState<{ id: string; unread: boolean } | null>(null);
  const undoBtn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!undo) return;
    // The archived row and its button go, so the keyboard's place moves to Undo, on the line that says what happened.
    undoBtn.current?.focus({ preventScroll: true });
    const t = window.setTimeout(() => setUndo(null), 10_000);
    return () => window.clearTimeout(t);
  }, [undo]);
  const readAll = useMutation({ mutationFn: () => api.readAll(tab), onMutate: () => setUndo(null), onSuccess: () => refresh() });
  const readOne = useMutation({ mutationFn: (id: string) => api.readOne(id), onMutate: () => setUndo(null), onSuccess: () => refresh() });
  const archive = useMutation({
    mutationFn: (v: { id: string; archived: boolean; unread: boolean }) => api.archiveNote(v.id, v.archived),
    onMutate: () => setUndo(null),
    onSuccess: (_r, v) => {
      if (v.archived) setUndo({ id: v.id, unread: v.unread });
      else focusHeadingAfter('list-heading'); // Restore: the row leaves the Archived list with its button.
      refresh();
    },
  });
  const unarchive = useMutation({
    mutationFn: (v: { id: string; unread: boolean }) => api.archiveNote(v.id, false, v.unread),
    // The line and its Undo stay until the restore lands, so a failed one can be tried again.
    onSuccess: () => {
      setUndo(null);
      focusHeadingAfter('list-heading');
      refresh();
    },
  });
  const archiveRead = useMutation({ mutationFn: () => api.archiveRead(tab), onMutate: () => setUndo(null), onSuccess: () => refresh() });
  // Deleting for good always asks first: one note (its id) or everything archived in this tab ('all').
  const [toDelete, setToDelete] = useState<string | 'all' | null>(null);
  const remove = useMutation({
    mutationFn: (what: string) => (what === 'all' ? api.deleteArchived(tab) : api.deleteNote(what)),
    onMutate: () => setUndo(null),
    onSuccess: () => {
      setToDelete(null);
      focusHeadingAfter('list-heading');
      refresh();
    },
  });
  const [time, setTime] = useState(me.data?.user.reminderTime ?? '');
  // The profile lands after the first render; take the saved time when it does, and never over a time being typed when a tap elsewhere reads the account again.
  const savedTime = me.data ? (me.data.user.reminderTime ?? '') : null;
  useEffect(() => {
    if (savedTime !== null) setTime(savedTime);
  }, [savedTime]);
  const saveTime = useMutation({ mutationFn: (t: string | null) => api.updateMe({ reminderTime: t }), onSuccess: () => refresh() });
  const list = q.data?.notifications ?? [];
  // Mark all read follows the tab's own unread count, not only what is on this page.
  const tabUnread = q.data?.tabs.find((t) => t.tab === tab)?.unread ?? 0;

  return (
    <Screen>
      <AppCover
        back={{ to: '/apps', label: 'Apps' }}
        title="Inbox"
        lede="Notes from your apps and from people, sorted by kind."
        actions={
          // Outline, since the reminder's Save below is the screen's one solid button.
          tabUnread > 0 || list.some((n) => !n.readAt) ? (
            <Button variant="outline" onClick={() => readAll.mutate()} disabled={readAll.isPending}>
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
          {me.data?.user.reminderTime ? `Set for ${clockOf(me.data.user.reminderTime)} in ${zoneName(me.data.user.timezone)}. A nudge lands here at that time on any day you have not checked in yet.` : 'Off. Pick a time, and a nudge lands here then on any day you have not checked in yet.'}
        </p>
        <div className="mt-sm flex gap-xs">
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Reminder time" className={`${FIELD_LINE} min-w-0 flex-1`} />
          <Button onClick={() => saveTime.mutate(time || null)} disabled={saveTime.isPending || time === (me.data?.user.reminderTime ?? '')}>
            {saveTime.isPending ? 'Saving' : !time && me.data?.user.reminderTime ? 'Turn off' : 'Save'}
          </Button>
        </div>
      </section>

      <section className="mt-lg" aria-labelledby="list-heading">
        <h2 id="list-heading" className="text-title2">
          What happened
        </h2>
        {/* One line (the founder, 2026-11-07): the view (Inbox, Unread, Archived) at the left with its one action as an ExpandButton
            right after it (its line animation plays and its words slide out to the right on hover or keyboard focus), and the kinds (Everything, Replies and mentions, Following: three at most) at the right of the same line, then All. In a
            row under 34rem (a phone) the views and the icon take the first line and the kinds the next, at full width. Beside the views the kinds keep their own width (`natural`),
            never stretched to fill the line, so they read as tabs. */}
        <div className="@container mt-sm flex flex-wrap items-center gap-x-md gap-y-xs">
          <div className="flex basis-full items-center gap-xs @min-[34rem]:basis-auto @min-[34rem]:shrink-0">
            <div className="grid min-w-0 flex-1 grid-cols-3 gap-xs @min-[34rem]:flex @min-[34rem]:flex-none" role="group" aria-label="Show">
              {SHOWS.map(([k, label]) => (
                <button key={k} type="button" aria-pressed={show === k} onClick={() => {
                  setUndo(null);
                  setShow(k);
                  pg.reset();
                }} className={`toy min-h-[36px] md:min-h-[44px] tap-pad min-w-0 rounded-pill border-2 px-sm py-0 md:py-xs text-subhead @max-[19rem]:px-xs font-medium ${show === k ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}>
                  {label}
                </button>
              ))}
            </div>
            {/* The action keeps a 44px slot in the row and its words slide out over the kinds beside it on a solid card, so pointing at it
                never pushes the kinds about. */}
            {((show !== 'archived' && list.some((n) => n.readAt)) || (show === 'archived' && list.length > 0)) && (
              <span className="relative block size-[44px] shrink-0">
                <span className="absolute top-0 left-0 z-10 [&>.expand-btn:focus-visible]:bg-card-strong [&>.expand-btn:hover]:bg-card-strong">
                  {show !== 'archived' ? (
                    <ExpandButton icon={Archive} anim={archiveRead.isPending ? 'loading' : 'archive'} label="Archive read items" disabled={archiveRead.isPending} onClick={() => archiveRead.mutate()} />
                  ) : (
                    <ExpandButton icon={Trash2} anim="trash" label="Delete all archived" onClick={() => {
                      setUndo(null);
                      setToDelete('all');
                    }} />
                  )}
                </span>
              </span>
            )}
          </div>
          <TabRow
            className="basis-full @min-[34rem]:basis-0 @min-[34rem]:flex-1"
            align="end"
            natural
            max={3}
            label="Tabs"
            items={(q.data?.tabs ?? [{ tab: 'all' as InboxTab, unread: 0 }]).map((t) => {
              const count = t.unread > 0 ? ` (${t.unread})` : '';
              // The row's pill says the short name (Replies, Shop, School), so a picked one still leaves room for Everything; the All
              // list gives every tab its whole name.
              return { key: t.tab, label: `${SHORT[t.tab] ?? INBOX_TAB_META[t.tab].name}${count}`, name: `${INBOX_TAB_META[t.tab].name}${count}` };
            })}
            value={tab}
            onChange={(k) => {
              setUndo(null);
              setTab(k);
              pg.reset();
            }}
          />
        </div>
        {/* One quiet line after archiving a note, with the way back; always in the tree so a reader hears it. */}
        <div role="status" className={undo ? 'mt-xs flex flex-wrap items-center gap-xs text-subhead text-ink-soft' : 'sr-only'}>
          {undo && (
            <>
              <span>Archived.</span>
              <button ref={undoBtn} type="button" className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center font-semibold text-ink underline underline-offset-4" onClick={() => unarchive.mutate(undo)} disabled={unarchive.isPending}>
                Undo
              </button>
              {unarchive.variables?.id === undo.id && <ErrorLine e={unarchive.error} className="w-full" />}
            </>
          )}
        </div>
        {q.isPending && <SkeletonList className="mt-sm" count={4} lines={2} label="Loading your inbox" />}
        {!q.isPending && list.length === 0 && <p className="mt-sm m-0 text-subhead text-ink-soft">{show === 'archived' ? 'Nothing archived here.' : show === 'unread' ? 'All caught up.' : EMPTY[tab]}</p>}
        <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
          {list.map((n) => {
            const inner = (
              <>
                <span className="flex size-[40px] shrink-0 items-center justify-center rounded-pill bg-paper text-ink-soft">
                  <Icon icon={iconFor(n.kind)} size={18} />
                </span>
                <span className="min-w-0 flex-1 self-stretch">
                  <span className={`block ${n.readAt ? 'text-row-title' : 'text-card-title pr-xs'}`}>{n.title}</span>
                  {/* The card's foot (the founder, 2026-11-07): on a phone the date and time on a line of their own under the helper, at the
                      left; from md at the bottom right, level with the helper's line while they fit side by side, else on a line of their own
                      under it, so the helper keeps the card's whole width. */}
                  <span className="flex flex-col items-start md:flex-row md:flex-wrap md:items-baseline-last md:justify-end md:gap-x-sm">
                    {n.body && <span className="block min-w-0 flex-[1_1_auto] text-card-note text-ink-soft"><Inert text={n.body} /></span>}
                    <time dateTime={n.createdAt} className="block whitespace-nowrap text-caption text-ink-mute">{stamp(n.createdAt)}</time>
                  </span>
                </span>
                {/* In the corner, out of the flow, so the words keep the row's width on a phone. */}
                {!n.readAt && (
                  <span className="absolute top-xs right-xs size-[10px] rounded-pill bg-r1">
                    <span className="sr-only">Unread</span>
                  </span>
                )}
              </>
            );
            // On a phone the note's icon sits above its words, so the words keep the card's whole width; from md it sits at their left.
            const cls = 'toy toy-soft relative flex w-full flex-col items-start gap-xs rounded-tile bg-card p-sm text-left md:flex-row md:gap-sm';
            const to = noteLink(n);
            return (
              <li key={n.id} className="flex items-stretch gap-xs">
                <span className="min-w-0 flex-1">
                  {to ? (
                    <Link to={to} className={cls} onClick={() => !n.readAt && readOne.mutate(n.id)}>
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
                  onClick={() => archive.mutate({ id: n.id, archived: !n.archivedAt, unread: !n.readAt })}
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
                    onClick={() => {
                      setUndo(null);
                      setToDelete(n.id);
                    }}
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
        <Sheet
          open={toDelete !== null}
          onClose={() => {
            setToDelete(null);
            remove.reset();
          }}
          title={toDelete === 'all' ? 'Delete everything archived?' : 'Delete this note for good?'}
        >
          <p className="m-0 text-subhead text-ink-soft">{toDelete === 'all' ? 'Every archived note in this tab is removed and cannot be brought back.' : 'It is removed and cannot be brought back. Restore it instead if you might want it.'}</p>
          <ErrorLine e={remove.error} className="mt-sm" />
          <div className="mt-md flex flex-col gap-xs">
            <button
              type="button"
              onClick={() => toDelete && remove.mutate(toDelete)}
              disabled={remove.isPending}
              className={RED_YES_LG}
            >
              {remove.isPending ? 'Deleting' : 'Yes, delete for good'}
            </button>
            <Button
              variant="outline"
              onClick={() => {
                setToDelete(null);
                remove.reset();
              }}
            >
              Keep {toDelete === 'all' ? 'them' : 'it'}
            </Button>
          </div>
        </Sheet>
      </section>
    </Screen>
  );
}
