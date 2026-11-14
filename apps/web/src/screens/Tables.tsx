import { listTables, type TableGroupKey, type TableListGroup } from '@kreators/shared/dataTables';
import { formatCount, type IconName } from '@kreators/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ArrowUpRight } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { AppCover } from '../components/AppCover';
import { AppIcon } from '../components/AppIcon';
import { ErrorLine } from '../components/ErrorLine';
import { Icon } from '../components/Icon';
import { Screen } from '../components/Screen';
import { SkeletonList } from '../components/Skeleton';
import { TableGroups } from '../components/TableGroups';
import { useTableCoaches } from '../components/TableSwitches';
import { ApiError } from '../lib/api';
import { useAppsOn } from '../lib/modules';
import { useMe } from '../lib/queries';
import { useSession } from '../lib/store';
import { subjectKey, tablesApi, type TablesSubject } from '../lib/tablesApi';

/**
 * All tables (2026-11-13, the founder): every list of a person's own data, grouped, each one a row that opens it as a table. The same
 * list serves a coach (only the tables a student shared with them) and a super admin (a member's, never the journal, gratitude, a body
 * and mind table or one with other people's details). Since 2026-11-14 ("put them in toggles based on categories in every place they occur")
 * the categories sit inside one accordion per app group, as the Apps page draws its groups (components/TableGroups.tsx), and a table shows only
 * while its app is on for the person whose tables these are. No row counts here: counting reads every row, and the daily read limit is shared
 * by everyone.
 */

/** Each category's mark (lucide names from the shared registry of icons). */
const GROUP_ICON: Record<TableGroupKey, IconName> = {
  daily: 'ListChecks',
  pillars: 'Triangle',
  reviews: 'CalendarRange',
  business: 'TrendingUp',
  body: 'HeartPulse',
  journal: 'NotebookPen',
  coaching: 'Target',
  selfAi: 'Telescope',
  money: 'Wallet',
  purchases: 'Backpack',
  shop: 'ShoppingBag',
  audience: 'Megaphone',
  creatorContent: 'TrendingUp',
  contentFolders: 'FolderCheck',
  publicPage: 'Link',
  store: 'ShoppingCart',
  tools: 'Toolbox',
  pitches: 'Tv',
  rewards: 'Gift',
  learning: 'GraduationCap',
  teaching: 'Presentation',
  work: 'BriefcaseBusiness',
  army: 'Clapperboard',
  win: 'Medal',
  agency: 'FolderKanban',
  agencyPaper: 'FileText',
  people: 'UsersRound',
  community: 'MessagesSquare',
  bond: 'Handshake',
  club: 'IdCard',
  party: 'PartyPopper',
  runs: 'Footprints',
  circles: 'UsersRound',
  account: 'IdCard',
  invites: 'LifeBuoy',
};

/** Where a subject's tables live in the app. */
export function tablesPath(s: TablesSubject): string {
  if (s.view === 'coach') return `/coaching/students/${encodeURIComponent(s.id)}/tables`;
  if (s.view === 'admin') return `/admin/people/${encodeURIComponent(s.id)}/tables`;
  return '/tables';
}

const tablesIn = (cats: readonly TableListGroup[]) => cats.reduce((n, c) => n + c.tables.length, 0);
const tablesWord = (n: number) => `${formatCount(n)} ${n === 1 ? 'table' : 'tables'}`;

/** `own`: the person's own list. Each line speaks to its owner ("Your entries"), so a coach or an admin sees the names only. */
function CategoryList({ group, base, own }: { group: TableListGroup; base: string; own: boolean }) {
  return (
    <ul className="fx-inset m-0 list-none p-0">
      {group.tables.map((t) => (
        <li key={t.key}>
          <Link to={`${base}/${t.key}`} className="fx-row items-center gap-sm text-ink">
            <span className="flex size-[44px] shrink-0 items-center justify-center rounded-pill bg-paper text-ink-soft" aria-hidden="true">
              <AppIcon name={GROUP_ICON[group.key]} size={22} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-headline">{t.name}</span>
              {own && <span className="mt-[2px] block text-footnote text-ink-soft">{t.blurb}</span>}
            </span>
            <Icon icon={ArrowUpRight} size={16} className="read-arrow shrink-0 text-ink-mute" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function TablesList({ subject }: { subject: TablesSubject }) {
  const token = useSession((s) => s.token);
  const own = subject.view === 'owner';
  const on = useAppsOn();
  // The person's own list is the registry itself, cut to the apps they have on: nothing to ask the server for.
  const q = useQuery({
    queryKey: ['tables-list', subjectKey(subject)],
    queryFn: () => tablesApi.list(subject),
    enabled: Boolean(token) && !own,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
  const groups = own ? listTables('owner', [], on) : (q.data?.groups ?? []);
  const name = q.data?.subject.name ?? '';
  const base = tablesPath(subject);
  const notHere = q.error instanceof ApiError && q.error.status === 404;
  const back = subject.view === 'coach' ? { to: `/coaching/students/${encodeURIComponent(subject.id)}`, label: name || 'Your student' } : subject.view === 'admin' ? { to: '/admin?tab=people', label: 'People' } : { to: '/apps', label: 'Apps' };
  const lede =
    subject.view === 'coach'
      ? `${name || 'Your student'} chooses which tables you see. You can only read them.`
      : subject.view === 'admin'
        ? 'Read only. Each table you open is written to the audit log. The journal, gratitude, body and mind tables and any with other people’s details are never shown here.'
        : 'Your lists, one table at a time. Sort, filter, copy or download it.';
  const place = subject.view === 'owner' ? 'own' : `${subject.view}:${subject.id}`;
  return (
    <Screen>
      <AppCover cover="tables" back={back} eyebrow={own ? undefined : name || undefined} title={own ? 'All tables' : 'Their tables'} lede={lede} />
      {!own && q.isPending && <SkeletonList className="mt-lg" count={4} lines={2} label="Loading the tables" />}
      {notHere && (
        <p className="mt-lg m-0 text-body">{subject.view === 'coach' ? 'This person is not your student now.' : 'There is no member by that id, or the account was deleted.'}</p>
      )}
      {q.isError && !notHere && <ErrorLine e={q.error} className="mt-lg" />}
      {subject.view === 'coach' && q.data && groups.length === 0 && (
        <p className="mt-lg m-0 text-body">
          {name || 'Your student'} has not shared a table with you yet. They choose with Show to my coach at the top of each table, or under Your life coach on their Profile tab.
        </p>
      )}
      {groups.length > 0 && (
        <div className="mt-lg">
          <TableGroups groups={groups} place={place} heading={2} count={(cats) => tablesWord(tablesIn(cats))} mood={() => 'happy'}>
            {(cat) => <CategoryList group={cat} base={base} own={own} />}
          </TableGroups>
        </div>
      )}
    </Screen>
  );
}

/** The person's own tables (`/tables`). */
export function Tables() {
  // Reads the person's coaches ahead, so a table's Show to my coach is in its cover from the first paint, never added after it.
  useTableCoaches(true);
  return <TablesList subject={{ view: 'owner' }} />;
}

/** A coach's view of the tables a student shares with them (`/coaching/students/:id/tables`). */
export function CoachTables() {
  const { id = '' } = useParams();
  return <TablesList key={id} subject={{ view: 'coach', id }} />;
}

/** A super admin's view of a member's tables (`/admin/people/:id/tables`), read only. */
export function AdminTables() {
  const { id = '' } = useParams();
  const me = useMe();
  if (!me.data) return null;
  if (me.data.user.role !== 'admin') return <OnlyAdmins />;
  return <TablesList key={id} subject={{ view: 'admin', id }} />;
}

/** What anyone but a super admin sees on a member's tables (the server refuses them too). */
export function OnlyAdmins() {
  return (
    <Screen howTo={false}>
      <AppCover cover="tables" back={{ to: '/home', label: 'Home' }} title="Their tables" lede="Only a super admin can open a member's tables." />
    </Screen>
  );
}
