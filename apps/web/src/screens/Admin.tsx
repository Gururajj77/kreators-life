import { CloseButton } from '../components/CloseButton';
import { DEFAULT_PAGE_SIZE, formatCount, pageQuery, type Page, type PageSize, money } from '@kreators/shared';
import { MAX_CREDIT_GRANT, PAID_PLANS, PLAN_DAYS, planName, type PlanKey, type TagTone } from '@kreators/shared';
import { ATTENDEE_XP_MAX, codeProblem, normalizeCode, type AdminAttendeeCode } from '@kreators/shared';
import { MAX_COACHES, type AdminCoachAsk, type AdminCoachLink } from '@kreators/shared';
import {
  BADGES,
  EVENT_TYPES,
  HONORS,
  HONOR_BY_KEY,
  LISTING_TYPE_META,
  LISTING_TYPES,
  MODULE_BY_KEY,
  MODULE_GROUPS,
  MODULES,
  OPPORTUNITY_TYPES,
  PERMISSIONS,
  REWARD_BY_KEY,
  ROLE_META,
  ROLES,
  TOOL_CATEGORIES,
  type AdminFunnel,
  type AdminKyc,
  type AdminOrder,
  type AdminRedemption,
  type AdminUser,
  type AuditLog,
  type OrderEvent,
  type OutboxEmail,
  type WebhookEvent,
  type FlagOverride,
  type Listing,
  type ListingType,
  type ModuleAccess,
  type ModuleSetting,
  type Permission,
  type Role,
} from '@kreators/shared';
import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Button } from '../components/Button';
import { DataTable, Select } from '../components/DataTable';
import { AppCover } from '../components/AppCover';
import { Screen } from '../components/Screen';
import { Sheet } from '../components/Sheet';
import { AdminDiscounts } from '../components/AdminDiscounts';
import { AdminHouseTemplates } from '../components/AdminHouseTemplates';
import { TabRow } from '../components/TabRow';
import { Toggle } from '../components/Toggle';
import { AppIcon } from '../components/AppIcon';
import { AnimatedIcon } from '../components/AnimatedIcon';
import { Icon } from '../components/Icon';
import { X } from 'lucide-react';
import { adminApi } from '../lib/api';
import { useMe } from '../lib/queries';
import { useParamState } from '../lib/useParamState';
import { FIELD } from '../lib/ui';
import { dateTime, longDate } from '../lib/date';
import { StatusTag } from '../components/StatusTag';
import { Fold } from '../components/Fold';

const ADMIN_HONORS = HONORS.filter((h) => h.source === 'admin' && h.key !== 'pro');
const KEY_STORE = 'kreators.adminKey';
const PERMISSION_NAMES: Record<Permission, string> = { talent: 'Talent', cohorts: 'Cohorts', events: 'Events', finance: 'Finance', moderation: 'Moderation', support: 'Support', review: 'Review', mentor: 'Mentor', coach: 'Life coach' };
const TAB_KEYS = ['people', 'flags', 'listings', 'coaches', 'codes', 'discounts', 'agencyhouse', 'orders', 'webhooks', 'kyc', 'ops', 'redemptions', 'audit'] as const;
type Tab = (typeof TAB_KEYS)[number];
/** The tab in the address (an inbox note about a coach ask opens Life coaches), else People. */
const asTab = (t: string): Tab => ((TAB_KEYS as readonly string[]).includes(t) ? (t as Tab) : 'people');
const LINK_STATUS_NAMES: Record<AdminCoachLink['status'], string> = { pending: 'Waiting', active: 'Active', declined: 'Said no', ended: 'Ended' };
const ASKED_BY_NAMES: Record<AdminCoachLink['askedBy'], string> = { coach: 'Coach asked', student: 'Student asked', admin: 'The team' };
const APP_NAMES: Record<AdminAttendeeCode['app'], string> = { party: 'Party', run: 'Run', circles: 'Circles' };
const ORDER_STATUSES = ['', 'pending', 'paid', 'test', 'failed', 'refunded', 'expired'] as const;
const statusTone = (s: string) => (s === 'paid' || s === 'test' ? 'bg-r4 text-on-fill' : s === 'pending' ? 'bg-r3 text-ink-fixed' : s === 'refunded' || s === 'failed' ? 'bg-r1 text-white' : 'bg-paper text-ink-soft');
const ROLE_OPTIONS = ROLES.map((r) => ({ value: ROLE_META[r].name, label: ROLE_META[r].name }));
const roleByName = (name: string): Role => ROLES.find((r) => ROLE_META[r].name === name) ?? 'user';
// Plans, by name in the table: No plan, Pro, Pro Max, Ultra. Until payments are live only an admin starts one.
const PLAN_KEYS: PlanKey[] = ['none', ...PAID_PLANS];
const PLAN_OPTIONS = PLAN_KEYS.map((k) => ({ value: planName(k), label: planName(k) }));
const planByName = (name: string): PlanKey => PLAN_KEYS.find((k) => planName(k) === name) ?? 'none';
const creditsOf = (u: AdminUser) => u.planCredits + u.extraCredits;
const when = (iso: string | null | undefined) => (iso ? dateTime(iso) : '');
const day = (iso: string | null | undefined) => (iso ? longDate(iso) : '');

function readKey(): string {
  try {
    return sessionStorage.getItem(KEY_STORE) ?? '';
  } catch {
    return '';
  }
}

const Label = ({ children, text }: { children: ReactNode; text: string }) => (
  <label className="block">
    <span className="block text-subhead">{text}</span>
    {children}
  </label>
);
/** A state in an admin table, in the one tag vocabulary: the old fill classes say which tone (green good, red bad, yellow waiting). */
const pillTone = (classes: string): TagTone => (classes.includes('bg-r4') ? 'good' : classes.includes('bg-r1') ? 'bad' : classes.includes('bg-r3') ? 'warn' : classes.includes('bg-r6') || classes.includes('bg-r5') ? 'info' : 'neutral');
const Pill = ({ children, tone = 'bg-paper text-ink-soft' }: { children: ReactNode; tone?: string }) => <StatusTag tone={pillTone(tone)}>{children}</StatusTag>;

/**
 * The admin console. Every list is a table: sort by any column, search, filter by a column’s values,
 * tick rows and act on them together, and change a cell where it sits. Each change is written to the
 * audit log on the server.
 */
export function Admin() {
  const me = useMe();
  const sessionAdmin = me.data?.user.role === 'admin';
  const [key, setKey] = useState(readKey);
  // The tab lives in the address, so Back, a reload and a shared link land on it.
  const [tabParam, setTabParam] = useParamState('tab', 'people');
  const tab = asTab(tabParam);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  // Every table is served a page at a time. `asks` is what we asked for, `pages` what came back.
  type Ask = { page: number; size: PageSize };
  const FIRST: Ask = { page: 1, size: DEFAULT_PAGE_SIZE };
  const [asks, setAsks] = useState<Record<string, Ask>>({});
  const [pages, setPages] = useState<Record<string, Page>>({});
  const pq = (name: string, ask?: Ask) => {
    const a = ask ?? asks[name] ?? FIRST;
    return pageQuery(a.page, a.size);
  };
  const gotPage = (name: string, page: Page) => setPages((p) => ({ ...p, [name]: page }));
  const turn = (name: string, fetch: (ask: Ask) => Promise<void>) => (page: number, size: PageSize) => {
    const ask = { page, size };
    setAsks((a) => ({ ...a, [name]: ask }));
    void run(() => fetch(ask));
  };

  // people
  const [q, setQ] = useState('');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [selected, setSelected] = useState<AdminUser | null>(null);
  // The account the delete sheet is asking about; null when it is closed.
  const [deleting, setDeleting] = useState<AdminUser | null>(null);
  const [honor, setHonor] = useState(ADMIN_HONORS[0]?.key ?? 'founder');
  const [note, setNote] = useState('');
  const [amount, setAmount] = useState('100');
  const [xpAmount, setXpAmount] = useState('100');
  const [badgeKey, setBadgeKey] = useState(BADGES[0]?.key ?? 'first_task');
  const [plan, setPlan] = useState<PlanKey>('pro');
  const [planDays, setPlanDays] = useState(String(PLAN_DAYS));
  const [grant, setGrant] = useState('1000');
  const [grantNote, setGrantNote] = useState('');
  const [preview, setPreview] = useState<{ name: string; access: Record<string, ModuleAccess> } | null>(null);
  // life coaches: asks to become one, every coach, every link
  const [coachAsks, setCoachAsks] = useState<AdminCoachAsk[] | null>(null);
  const [coaches, setCoaches] = useState<{ id: string; name: string; handle: string | null; email: string | null; students: number }[]>([]);
  const [coachLinks, setCoachLinks] = useState<AdminCoachLink[]>([]);
  const [linkStatus, setLinkStatus] = useState('');
  const [linkCoach, setLinkCoach] = useState('');
  const [linkStudent, setLinkStudent] = useState('');
  const [linkMode, setLinkMode] = useState<'ask' | 'link'>('ask');
  const [linked, setLinked] = useState<string | null>(null);
  // attendee codes: every event with guests, across Party, Run and Circles
  const [codes, setCodes] = useState<AdminAttendeeCode[] | null>(null);
  const [codeApp, setCodeApp] = useState('');
  const [codeQ, setCodeQ] = useState('');
  // flags
  const [settings, setSettings] = useState<ModuleSetting[]>([]);
  const [overrides, setOverrides] = useState<FlagOverride[]>([]);
  const [overrideCounts, setOverrideCounts] = useState<Record<string, number>>({});
  const [overrideFor, setOverrideFor] = useState<string | null>(null);
  const [ovSubjectType, setOvSubjectType] = useState<FlagOverride['subjectType']>('user');
  const [ovSubjectId, setOvSubjectId] = useState('');
  const [ovEnabled, setOvEnabled] = useState(true);
  const [ovDays, setOvDays] = useState('');
  const [ovReason, setOvReason] = useState('');
  // listings
  const [listings, setListings] = useState<Listing[]>([]);
  const [creating, setCreating] = useState<ListingType | null>(null);
  const [form, setForm] = useState<Record<string, string | boolean>>({});
  // redemptions, audit
  const [redemptions, setRedemptions] = useState<AdminRedemption[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  // orders
  const [orderQ, setOrderQ] = useState('');
  const [orderStatus, setOrderStatus] = useState('');
  const [orders, setOrders] = useState<AdminOrder[] | null>(null);
  const [orderDetail, setOrderDetail] = useState<{ order: AdminOrder; timeline: OrderEvent[]; webhooks: WebhookEvent[] } | null>(null);
  const [refundReason, setRefundReason] = useState('');
  const [refundError, setRefundError] = useState<string | null>(null);
  // webhooks
  const [hooks, setHooks] = useState<WebhookEvent[] | null>(null);
  const [replayOutcome, setReplayOutcome] = useState<Record<string, string>>({});
  // kyc
  const [kycStatus, setKycStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [kycList, setKycList] = useState<AdminKyc[] | null>(null);
  const [kycNote, setKycNote] = useState<Record<string, string>>({});
  // ops
  const [funnels, setFunnels] = useState<AdminFunnel[] | null>(null);
  const [outbox, setOutbox] = useState<OutboxEmail[] | null>(null);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not work. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const load = () =>
    run(async () => {
      try {
        sessionStorage.setItem(KEY_STORE, key);
      } catch {
        // Private mode: the key just will not be remembered.
      }
      const [u, r, f, l, a] = await Promise.all([adminApi.users(key, q, pq('users')), adminApi.redemptions(key, 'reserved', pq('redemptions')), adminApi.flags(key, pq('overrides')), adminApi.listings(key, undefined, '', pq('listings')), adminApi.audit(key, pq('audit'))]);
      setUsers(u.users);
      gotPage('users', u.page);
      setRedemptions(r.redemptions);
      gotPage('redemptions', r.page);
      setSettings(f.settings);
      setOverrides(f.overrides);
      setOverrideCounts(f.overrideCounts);
      gotPage('overrides', f.page);
      setListings(l.listings);
      gotPage('listings', l.page);
      setLogs(a.logs);
      gotPage('audit', a.page);
      setLoaded(true);
    });

  useEffect(() => {
    if (sessionAdmin && !loaded && !busy) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionAdmin]);
  // Each tab fetches on first open (by a tap, Back or a link), once the rest is in, so the first load stays quick.
  useEffect(() => {
    if (!loaded) return;
    if (tab === 'orders' && orders === null) void searchOrders();
    if (tab === 'webhooks' && hooks === null) void loadHooks();
    if (tab === 'kyc' && kycList === null) void loadKyc();
    if (tab === 'ops' && funnels === null) void loadOps();
    if (tab === 'codes' && codes === null) void loadCodes();
    if (tab === 'coaches' && coachAsks === null) void loadCoaches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, tab]);

  const applyUser = (u: AdminUser) => {
    setSelected((s) => (s?.id === u.id ? u : s));
    setUsers((list) => list.map((x) => (x.id === u.id ? u : x)));
  };
  const refreshFlags = async (ask?: Ask) => {
    const f = await adminApi.flags(key, pq('overrides', ask));
    setSettings(f.settings);
    setOverrides(f.overrides);
    setOverrideCounts(f.overrideCounts);
    gotPage('overrides', f.page);
  };
  const refreshListings = async (ask?: Ask) => {
    const l = await adminApi.listings(key, undefined, '', pq('listings', ask));
    setListings(l.listings);
    gotPage('listings', l.page);
  };
  const refreshAudit = async (ask?: Ask) => {
    const a = await adminApi.audit(key, pq('audit', ask));
    setLogs(a.logs);
    gotPage('audit', a.page);
  };
  const refreshUsers = async (ask?: Ask) => {
    const u = await adminApi.users(key, q, pq('users', ask));
    setUsers(u.users);
    gotPage('users', u.page);
  };
  const refreshRedemptions = async (ask?: Ask) => {
    const r = await adminApi.redemptions(key, 'reserved', pq('redemptions', ask));
    setRedemptions(r.redemptions);
    gotPage('redemptions', r.page);
  };
  const searchOrders = (q = orderQ, status = orderStatus, ask?: Ask) =>
    run(async () => {
      const o = await adminApi.orders(key, q, status, pq('orders', ask));
      setOrders(o.orders);
      gotPage('orders', o.page);
    });
  const openOrder = (id: string) =>
    run(async () => {
      setRefundError(null);
      setOrderDetail(await adminApi.order(key, id));
    });
  const loadHooks = (ask?: Ask) =>
    run(async () => {
      const h = await adminApi.webhooks(key, pq('webhooks', ask));
      setHooks(h.webhooks);
      gotPage('webhooks', h.page);
    });
  const loadKyc = (status = kycStatus, ask?: Ask) =>
    run(async () => {
      const k = await adminApi.kycQueue(key, status, pq('kyc', ask));
      setKycList(k.kyc);
      gotPage('kyc', k.page);
    });
  const loadCoaches = (status = linkStatus) =>
    run(async () => {
      const [a, k, l] = await Promise.all([adminApi.coachAsks(key, pq('coachAsks')), adminApi.coaches(key, pq('coaches')), adminApi.coachLinks(key, status, pq('coachLinks'))]);
      setCoachAsks(a.asks);
      gotPage('coachAsks', a.page);
      setCoaches(k.coaches);
      gotPage('coaches', k.page);
      setCoachLinks(l.links);
      gotPage('coachLinks', l.page);
    });
  const reloadCoachPart = (part: 'coachAsks' | 'coaches' | 'coachLinks') => (ask: Ask) =>
    part === 'coachAsks'
      ? adminApi.coachAsks(key, pq(part, ask)).then((a) => (setCoachAsks(a.asks), gotPage(part, a.page)))
      : part === 'coaches'
        ? adminApi.coaches(key, pq(part, ask)).then((k) => (setCoaches(k.coaches), gotPage(part, k.page)))
        : adminApi.coachLinks(key, linkStatus, pq(part, ask)).then((l) => (setCoachLinks(l.links), gotPage(part, l.page)));
  /** Saying yes to an ask is giving the Life coach permission, through the one permissions route. */
  const makeCoach = async (userId: string, on: boolean) => {
    const target = users.find((u) => u.id === userId) ?? (await adminApi.users(key, userId, pageQuery(1, DEFAULT_PAGE_SIZE))).users.find((u) => u.id === userId);
    if (!target) throw new Error('That person is not on the server any more.');
    const next = on ? [...new Set([...target.permissions, 'coach' as Permission])] : target.permissions.filter((p) => p !== 'coach');
    applyUser((await adminApi.setPermissions(key, userId, next)).user);
  };
  const loadCodes = (app = codeApp, ask?: Ask) =>
    run(async () => {
      const r = await adminApi.attendeeCodes(key, app, codeQ, pq('codes', ask));
      setCodes(r.codes);
      gotPage('codes', r.page);
    });
  /** One event’s xp or code, by the hosts’ own rules; the row comes back as the server sees it. */
  const setCode = (row: AdminAttendeeCode, change: { xp?: number; code?: string; fresh?: boolean }) =>
    run(async () => {
      const r = await adminApi.setAttendeeCode(key, row.app, row.thingId, change);
      if (r.code) setCodes((all) => (all ?? []).map((x) => (x.app === row.app && x.thingId === row.thingId ? r.code! : x)));
    });
  const loadOps = (ask?: Ask) =>
    run(async () => {
      const [f, o] = await Promise.all([adminApi.funnels(key), adminApi.outbox(key, pq('outbox', ask))]);
      setFunnels(f.funnels);
      setOutbox(o.outbox);
      gotPage('outbox', o.page);
    });
  // The effect above fetches what the new tab needs.
  const openTab = (k: Tab) => setTabParam(k);
  /** The same change on every ticked row, one after the other, then one refresh. */
  const each = async <T,>(rows: T[], fn: (row: T) => Promise<void>) => {
    for (const r of rows) await fn(r);
  };

  // Most used first: the row shows what fits and puts the rest behind More.
  const tabs: [Tab, string][] = [
    ['people', 'People'],
    ['listings', 'Listings'],
    ['redemptions', `Redemptions${redemptions.length ? ` (${redemptions.length})` : ''}`],
    ['orders', 'Orders'],
    ['kyc', 'KYC'],
    ['coaches', 'Life coaches'],
    ['flags', 'Flags'],
    ['discounts', 'Discount codes'],
    ['codes', 'Attendee codes'],
    ['agencyhouse', 'Agency templates'],
    ['audit', 'Audit'],
    ['webhooks', 'Webhooks'],
    ['ops', 'Ops'],
  ];

  return (
    <Screen tabs={false} wide>
      <AppCover
        back={{ to: '/apps', label: 'Apps' }}
        title="Admin"
        lede={sessionAdmin ? 'You are signed in as an admin, so no key is needed.' : 'Paste the admin key, or sign in with an admin account. Every change here is written to the audit log.'}
      />

      {!sessionAdmin && (
        <form
          className="mt-md flex gap-xs"
          onSubmit={(e) => {
            e.preventDefault();
            void load();
          }}
        >
          <input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="Admin key" aria-label="Admin key" autoComplete="off" className="min-w-0 flex-1 rounded-pill border-2 border-line bg-card px-md py-sm text-body" />
          <Button type="submit" disabled={busy || !key}>
            {loaded ? 'Reload' : 'Open'}
          </Button>
        </form>
      )}
      {error && (
        <p role="alert" className="mt-sm m-0 rounded-tile bg-r1/15 p-sm text-subhead">
          {error}
        </p>
      )}

      {loaded && (
        <>
          <TabRow className="mt-md" label="Admin sections" items={tabs.map(([key, label]) => ({ key, label }))} value={tab} onChange={openTab} />

          {tab === 'people' && (
            <section className="mt-md" aria-labelledby="people-heading">
              <h2 id="people-heading" className="text-title2">
                People
              </h2>
              <p className="mt-xs m-0 text-subhead text-ink-soft">Search the server, then sort, filter and edit the rows here.</p>
              <Fold title="How this table works" className="mt-xs">
                <ul className="m-0 flex list-disc flex-col gap-xs pl-md text-subhead text-ink-soft">
                  <li>Role and plan change in the row.</li>
                  <li>Tick rows to change several at once.</li>
                  <li>Tap a row for honors, points, credits and what that person sees.</li>
                </ul>
              </Fold>
              <form
                className="mt-sm flex gap-xs"
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(() => refreshUsers({ page: 1, size: asks.users?.size ?? DEFAULT_PAGE_SIZE }));
                }}
              >
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, email, page or id" aria-label="Search people on the server" className="min-w-0 flex-1 rounded-pill border-2 border-line bg-card px-md py-sm text-body" />
                <Button type="submit" variant="outline" disabled={busy}>
                  Search
                </Button>
              </form>
              <div className="mt-sm">
                <DataTable<AdminUser>
                  rows={users}
                  page={pages.users}
                  onPage={turn('users', refreshUsers)}
                  rowKey={(u) => u.id}
                  label="People"
                  selectable
                  busy={busy}
                  activeKey={selected?.id ?? null}
                  onRowClick={(u) => setSelected(u)}
                  empty="Nobody matches. Try another name or email in the search box above."
                  columns={[
                    {
                      key: 'name',
                      label: 'Name',
                      get: (u) => u.displayName || 'Anonymous climber',
                      render: (u) => (
                        <>
                          <span className="block font-semibold">{u.displayName || 'Anonymous climber'}</span>
                          {u.handle && <span className="block text-caption text-ink-soft">@{u.handle}</span>}
                        </>
                      ),
                    },
                    { key: 'email', label: 'Email', get: (u) => u.email ?? '', wide: true },
                    { key: 'role', label: 'Role', get: (u) => ROLE_META[u.role].name, filter: true, edit: { kind: 'select', options: ROLE_OPTIONS, onEdit: (u, v) => run(async () => applyUser((await adminApi.setRole(key, u.id, roleByName(String(v)))).user)) } },
                    { key: 'coach', label: 'Life coach', get: (u) => (u.permissions.includes('coach') ? 'Yes' : u.coachAskedAt ? 'Asked' : 'No'), filter: true },
                    { key: 'plan', label: 'Plan', get: (u) => planName(u.plan), filter: true, edit: { kind: 'select', options: PLAN_OPTIONS, onEdit: (u, v) => run(async () => applyUser((await adminApi.setPlan(key, u.id, planByName(String(v)), PLAN_DAYS)).user)) } },
                    { key: 'credits', label: 'Credits', get: (u) => creditsOf(u), render: (u) => formatCount(creditsOf(u)), align: 'right' },
                    { key: 'perms', label: 'Permissions', get: (u) => (u.role === 'admin' ? 'all' : u.permissions.map((p) => PERMISSION_NAMES[p]).join(', ')), wide: true, wrap: true },
                    { key: 'xp', label: 'XP', get: (u) => u.xp, render: (u) => formatCount(u.xp), align: 'right' },
                    { key: 'points', label: 'Points', get: (u) => u.points, render: (u) => formatCount(u.points), align: 'right' },
                    { key: 'honors', label: 'Honors', get: (u) => u.honors.map((h) => HONOR_BY_KEY[h]?.name ?? h).join(', '), render: (u) => <span role="img" aria-label={u.honors.map((h) => HONOR_BY_KEY[h]?.name ?? h).join(', ')} className="inline-flex gap-xs">{u.honors.map((h) => <AppIcon key={h} name={HONOR_BY_KEY[h]?.icon} size={16} />)}</span>, wide: true },
                    { key: 'joined', label: 'Joined', get: (u) => u.createdAt.slice(0, 10), render: (u) => day(u.createdAt), wide: true },
                    {
                      key: 'delete',
                      label: 'Delete',
                      get: () => '',
                      sortable: false,
                      align: 'right',
                      render: (u) => (
                        <button
                          type="button"
                          disabled={busy || u.role === 'admin'}
                          title={u.role === 'admin' ? 'An admin cannot be deleted here. Change the role first.' : `Delete ${u.displayName || 'this account'}`}
                          aria-label={`Delete ${u.displayName || 'this account'}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleting(u);
                          }}
                          className="toy flex size-[44px] items-center justify-center rounded-pill text-ink-soft hover:text-r1 disabled:opacity-30"
                        >
                          <AnimatedIcon name="trash" size={20} />
                        </button>
                      ),
                    },
                  ]}
                  bulk={[
                    { label: 'Make creator', onClick: (rows) => run(() => each(rows, async (u) => applyUser((await adminApi.setRole(key, u.id, 'user')).user))) },
                    { label: 'Make staff', onClick: (rows) => run(() => each(rows, async (u) => applyUser((await adminApi.setRole(key, u.id, 'sub_admin')).user))) },
                    { label: 'Make admin', onClick: (rows) => run(() => each(rows, async (u) => applyUser((await adminApi.setRole(key, u.id, 'admin')).user))) },
                    { label: 'Make life coach', onClick: (rows) => run(() => each(rows, (u) => makeCoach(u.id, true))) },
                    { label: 'Start Pro', onClick: (rows) => run(() => each(rows, async (u) => applyUser((await adminApi.setPlan(key, u.id, 'pro', PLAN_DAYS)).user))) },
                    { label: 'End plan', variant: 'ghost', onClick: (rows) => run(() => each(rows, async (u) => applyUser((await adminApi.setPlan(key, u.id, 'none', PLAN_DAYS)).user))) },
                  ]}
                />
              </div>

              <Sheet open={deleting !== null} onClose={() => setDeleting(null)} title={`Delete ${deleting?.displayName || 'this account'}?`}>
                <p className="m-0 text-subhead text-ink-soft">Their details and what they made go. Money records stay, without their name. This cannot be undone.</p>
                <div className="mt-md flex flex-col gap-xs">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      const u = deleting;
                      if (!u) return;
                      setDeleting(null);
                      void run(async () => {
                        await adminApi.deleteUser(key, u.id);
                        if (selected?.id === u.id) setSelected(null);
                        await refreshUsers(asks.users);
                      });
                    }}
                    className="toy inline-flex min-h-[56px] items-center justify-center gap-xs rounded-pill bg-r1 px-md text-headline text-on-fill disabled:opacity-50"
                  >
                    Yes, delete
                  </button>
                  <Button variant="outline" size="lg" onClick={() => setDeleting(null)}>
                    Keep this account
                  </Button>
                </div>
              </Sheet>

              {selected && (
                <div className="mt-md rounded-card bg-card p-md shadow-toy-soft">
                  <div className="flex items-start justify-between gap-sm">
                    <div className="min-w-0">
                      <h3 className="text-title2">{selected.displayName || 'Anonymous climber'}</h3>
                      <p className="mt-xs m-0 text-caption text-ink-mute">{selected.id}</p>
                    </div>
                    <CloseButton onClick={() => setSelected(null)} label="Close this person" />
                  </div>

                  <p className="mt-md m-0 text-subhead font-semibold">Permissions</p>
                  <p className="m-0 text-caption text-ink-soft">A permission is a job someone is trusted with. Admins hold all of them but Life coach. A creator can hold Mentor, Life coach and Moderation (a guide in Community); the rest need the Staff role.</p>
                  <div className="mt-xs flex flex-wrap gap-xs" role="group" aria-label="Permissions">
                    {PERMISSIONS.map((p) => {
                      const on = selected.permissions.includes(p);
                      return (
                        <button
                          key={p}
                          type="button"
                          aria-pressed={on}
                          disabled={busy || (selected.role === 'admin' && p !== 'coach')}
                          onClick={() => run(async () => applyUser((await adminApi.setPermissions(key, selected.id, on ? selected.permissions.filter((x) => x !== p) : [...selected.permissions, p])).user))}
                          className={`toy min-h-[44px] rounded-pill border-2 px-sm py-xs text-subhead font-medium ${on || (selected.role === 'admin' && p !== 'coach') ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}
                        >
                          {PERMISSION_NAMES[p]}
                        </button>
                      );
                    })}
                  </div>

                  <p className="mt-md m-0 text-subhead font-semibold">Honors</p>
                  <div className="mt-xs flex flex-wrap gap-xs">
                    {selected.honors.length === 0 && <span className="text-subhead text-ink-soft">None yet.</span>}
                    {selected.honors.map((h) => (
                      <button key={h} type="button" disabled={busy} onClick={() => run(async () => applyUser((await adminApi.revokeHonor(key, selected.id, h)).user))} className="toy toy-soft inline-flex min-h-[44px] items-center gap-xs rounded-pill bg-paper px-sm text-subhead font-medium" aria-label={`Remove ${HONOR_BY_KEY[h]?.name ?? h}`}>
                        <AppIcon name={HONOR_BY_KEY[h]?.icon} size={16} />
                        {HONOR_BY_KEY[h]?.name ?? h}
                        <Icon icon={X} size={14} />
                      </button>
                    ))}
                  </div>
                  <div className="mt-xs grid grid-cols-[1fr_auto] gap-xs">
                    <select value={honor} onChange={(e) => setHonor(e.target.value)} aria-label="Honor" className="rounded-tile border-2 border-line bg-paper px-sm py-sm text-body">
                      {ADMIN_HONORS.map((h) => (
                        <option key={h.key} value={h.key}>
                          {h.name}
                        </option>
                      ))}
                    </select>
                    <Button variant="outline" disabled={busy} onClick={() => run(async () => applyUser((await adminApi.grantHonor(key, selected.id, honor, note)).user))}>
                      Grant
                    </Button>
                  </div>
                  <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" aria-label="Note" className={FIELD} />

                  <p className="mt-md m-0 text-subhead font-semibold">Points</p>
                  <div className="mt-xs grid grid-cols-[1fr_auto] gap-xs">
                    <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Amount" className="rounded-tile border-2 border-line bg-paper px-sm py-sm text-body" />
                    <Button variant="outline" disabled={busy || !Number(amount)} onClick={() => run(async () => applyUser((await adminApi.addPoints(key, selected.id, Number(amount), note)).user))}>
                      Add
                    </Button>
                  </div>

                  <p className="mt-md m-0 text-subhead font-semibold">XP</p>
                  <p className="m-0 text-caption text-ink-soft">Moves their level and the leaderboard. A minus takes some away, down to zero. The note and your name are kept in the audit log.</p>
                  <div className="mt-xs grid grid-cols-[1fr_auto] gap-xs">
                    <input type="number" value={xpAmount} onChange={(e) => setXpAmount(e.target.value)} aria-label="XP amount" className="rounded-tile border-2 border-line bg-paper px-sm py-sm text-body" />
                    <Button variant="outline" disabled={busy || !Number(xpAmount)} onClick={() => run(async () => applyUser((await adminApi.addXp(key, selected.id, Number(xpAmount), note)).user))}>
                      Add
                    </Button>
                  </div>

                  <p className="mt-md m-0 text-subhead font-semibold">Badges given by hand</p>
                  <p className="m-0 text-caption text-ink-soft">They count for unlocks, the profile and the leaderboard. A badge the person earned is never taken away here.</p>
                  <div className="mt-xs flex flex-wrap gap-xs">
                    {selected.grantedBadges.length === 0 && <span className="text-subhead text-ink-soft">None given.</span>}
                    {selected.grantedBadges.map((b) => (
                      <button key={b} type="button" disabled={busy} onClick={() => run(async () => applyUser((await adminApi.revokeBadge(key, selected.id, b)).user))} className="toy toy-soft inline-flex min-h-[44px] items-center gap-xs rounded-pill bg-paper px-sm text-subhead font-medium" aria-label={`Remove ${BADGES.find((x) => x.key === b)?.name ?? b}`}>
                        <AppIcon name={BADGES.find((x) => x.key === b)?.icon} size={16} />
                        {BADGES.find((x) => x.key === b)?.name ?? b}
                        <Icon icon={X} size={14} />
                      </button>
                    ))}
                  </div>
                  <div className="mt-xs grid grid-cols-[1fr_auto] gap-xs">
                    <select value={badgeKey} onChange={(e) => setBadgeKey(e.target.value)} aria-label="Badge" className="rounded-tile border-2 border-line bg-paper px-sm py-sm text-body">
                      {BADGES.map((b) => (
                        <option key={b.key} value={b.key}>
                          {b.name} ({b.family})
                        </option>
                      ))}
                    </select>
                    <Button variant="outline" disabled={busy || selected.grantedBadges.includes(badgeKey)} onClick={() => run(async () => applyUser((await adminApi.grantBadge(key, selected.id, badgeKey, note)).user))}>
                      Give
                    </Button>
                  </div>

                  <p className="mt-md m-0 text-subhead font-semibold">Plan and credits</p>
                  <p className="m-0 text-caption text-ink-soft">
                    {planName(selected.plan)}
                    {selected.planUntil ? ` until ${selected.planUntil.slice(0, 10)}` : ''}. {formatCount(selected.planCredits)} plan credits, {formatCount(selected.extraCredits)} extra. Payments are not live, so plans start here. A new plan grants its credits fresh; extra credits stay until used.
                  </p>
                  <div className="mt-xs grid grid-cols-[1fr_auto_auto] gap-xs">
                    <select value={plan} onChange={(e) => setPlan(e.target.value as PlanKey)} aria-label="Plan" className="rounded-tile border-2 border-line bg-paper px-sm py-sm text-body">
                      {PLAN_KEYS.map((k) => (
                        <option key={k} value={k}>
                          {planName(k)}
                        </option>
                      ))}
                    </select>
                    <input type="number" min={1} max={366} value={planDays} onChange={(e) => setPlanDays(e.target.value)} aria-label="Days" className="w-[96px] rounded-tile border-2 border-line bg-paper px-sm py-sm text-body" />
                    <Button variant="outline" disabled={busy || (plan !== 'none' && !(Number(planDays) >= 1))} onClick={() => run(async () => applyUser((await adminApi.setPlan(key, selected.id, plan, Number(planDays) || PLAN_DAYS)).user))}>
                      {plan === 'none' ? 'End plan' : 'Start'}
                    </Button>
                  </div>
                  <div className="mt-xs grid grid-cols-[1fr_auto] gap-xs">
                    <input type="number" min={1} max={MAX_CREDIT_GRANT} value={grant} onChange={(e) => setGrant(e.target.value)} aria-label="Credits to add" className="rounded-tile border-2 border-line bg-paper px-sm py-sm text-body" />
                    <Button variant="outline" disabled={busy || !(Number.isInteger(Number(grant)) && Number(grant) >= 1 && Number(grant) <= MAX_CREDIT_GRANT)} onClick={() => run(async () => applyUser((await adminApi.addCredits(key, selected.id, Number(grant), grantNote)).user))}>
                      Add credits
                    </Button>
                  </div>
                  <input value={grantNote} onChange={(e) => setGrantNote(e.target.value)} placeholder="Why, for the history (optional)" aria-label="Why the credits" className={FIELD} />

                  <Button variant="ghost" className="mt-md" disabled={busy} onClick={() => run(async () => { await refreshFlags(); setPreview(await adminApi.previewAccess(key, selected.id)); })}>
                    What does this person see?
                  </Button>
                  {preview && (
                    <>
                      <p className="mt-sm m-0 text-caption text-ink-soft">Tick to allow, untick to block. Struck through means not allowed, and locked apps cannot be blocked. Reset returns an app to the usual rules.</p>
                      <ul className="mt-xs grid list-none grid-cols-1 gap-xs p-0 m-0 sm:grid-cols-2 md:grid-cols-3">
                        {MODULES.map((m) => {
                          const a = preview.access[m.key];
                          const allowed = Boolean(a?.available);
                          const mine = overrides.filter((o) => o.flagKey === m.key && o.subjectType === 'user' && o.subjectId === selected.id);
                          const setAccess = (allow: boolean) =>
                            run(async () => {
                              for (const o of mine) await adminApi.removeOverride(key, o.id);
                              await adminApi.addOverride(key, m.key, { subjectType: 'user', subjectId: selected.id, enabled: allow, reason: 'Set from People' });
                              await refreshFlags();
                              setPreview(await adminApi.previewAccess(key, selected.id));
                            });
                          const reset = () =>
                            run(async () => {
                              for (const o of mine) await adminApi.removeOverride(key, o.id);
                              await refreshFlags();
                              setPreview(await adminApi.previewAccess(key, selected.id));
                            });
                          return (
                            <li key={m.key} className={`flex items-center gap-xs rounded-inner-sm px-xs py-xs ${allowed ? 'bg-paper' : 'bg-line'}`}>
                              <label className="toy toy-flat flex min-h-[44px] min-w-0 flex-1 cursor-pointer items-center gap-xs rounded-inner-sm px-xs">
                                <input type="checkbox" checked={allowed} disabled={busy || Boolean(m.locked)} onChange={(e) => void setAccess(e.target.checked)} className="size-[20px] shrink-0" aria-label={`Allow ${m.name}`} />
                                <span className="min-w-0">
                                  <span className={`block truncate text-subhead font-semibold ${allowed ? '' : 'text-ink-soft line-through'}`}>
                                    <span className="inline-flex items-center gap-xs align-middle">
                                      <AppIcon name={m.icon} size={16} />
                                      {m.name}
                                    </span>
                                  </span>
                                  {a && !a.available && <span className="block text-caption2 text-ink-soft no-underline">{a.reason === 'override' ? 'Blocked for this person' : a.reason === 'role' ? 'Needs a higher role' : a.reason === 'rollout' ? 'Not rolled out to them yet' : 'Switched off for everyone'}</span>}
                                  {a?.available && mine.length > 0 && <span className="block text-caption2 text-ink-soft">Allowed for this person</span>}
                                </span>
                              </label>
                              {mine.length > 0 && (
                                <button type="button" onClick={() => void reset()} disabled={busy} className="inline-flex min-h-[44px] shrink-0 items-center rounded-pill px-xs text-caption font-medium text-ink-soft underline underline-offset-4">
                                  Reset
                                </button>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </>
                  )}
                </div>
              )}
            </section>
          )}

          {tab === 'flags' && (
            <section className="mt-md" aria-labelledby="flags-heading">
              <h2 id="flags-heading" className="text-title2">
                Feature flags
              </h2>
              <p className="mt-xs m-0 text-subhead text-ink-soft">Switch an app for everyone, a share of people, or one person. Edit any cell in place.</p>
              <Fold title="What each switch does" className="mt-xs">
                <ul className="m-0 flex list-disc flex-col gap-xs pl-md text-subhead text-ink-soft">
                  <li>Off hides a module for everyone.</li>
                  <li>Rollout shows it to a steady percentage of people.</li>
                  <li>Overrides force it on or off for one person, one role or one brand, and can expire.</li>
                </ul>
              </Fold>
              <div className="mt-sm">
                <DataTable<ModuleSetting>
                  rows={settings}
                  rowKey={(s) => s.key}
                  label="Feature flags"
                  busy={busy}
                  columns={[
                    { key: 'module', label: 'Module', get: (s) => MODULE_BY_KEY[s.key]?.name ?? s.key, render: (s) => <span className="inline-flex items-center gap-xs font-semibold"><AppIcon name={MODULE_BY_KEY[s.key]?.icon} size={16} />{MODULE_BY_KEY[s.key]?.name ?? s.key}</span> },
                    { key: 'group', label: 'Group', get: (s) => MODULE_GROUPS[MODULE_BY_KEY[s.key]?.group ?? 'core'], filter: true, wide: true },
                    { key: 'enabled', label: 'On', get: (s) => s.enabled, filter: true, edit: { kind: 'toggle', onEdit: (s, v) => run(async () => { await adminApi.setModuleSetting(key, s.key, { enabled: Boolean(v) }); await refreshFlags(); }) } },
                    { key: 'minRole', label: 'Minimum role', get: (s) => ROLE_META[s.minRole].name, filter: true, edit: { kind: 'select', options: ROLE_OPTIONS, onEdit: (s, v) => run(async () => { await adminApi.setModuleSetting(key, s.key, { minRole: roleByName(String(v)) }); await refreshFlags(); }) } },
                    { key: 'rollout', label: 'Rollout %', get: (s) => s.rollout, align: 'right', edit: { kind: 'number', min: 0, max: 100, step: 5, onEdit: (s, v) => run(async () => { await adminApi.setModuleSetting(key, s.key, { rollout: Math.max(0, Math.min(100, Number(v))) }); await refreshFlags(); }) } },
                    { key: 'overrides', label: 'Overrides', get: (s) => overrideCounts[s.key] ?? 0, align: 'right' },
                  ]}
                  actions={(s) => (
                    <Button variant="outline" size="sm" onClick={() => { setOverrideFor(s.key); setOvSubjectId(''); setOvReason(''); setOvDays(''); }}>
                      Add override
                    </Button>
                  )}
                />
              </div>
              <h3 className="mt-md text-headline">Overrides</h3>
              <div className="mt-xs">
                <DataTable<FlagOverride>
                  rows={overrides}
                  rowKey={(o) => o.id}
                  label="Overrides"
                  busy={busy}
                  selectable
                  empty="No overrides. Add one from the table above."
                  columns={[
                    { key: 'module', label: 'Module', get: (o) => MODULE_BY_KEY[o.flagKey]?.name ?? o.flagKey, filter: true },
                    { key: 'for', label: 'For', get: (o) => o.subjectType, filter: true },
                    { key: 'id', label: 'Id', get: (o) => o.subjectId },
                    { key: 'state', label: 'Forced', get: (o) => (o.enabled ? 'on' : 'off'), filter: true, render: (o) => <Pill tone={o.enabled ? 'bg-r4 text-on-fill' : 'bg-r1 text-white'}>{o.enabled ? 'on' : 'off'}</Pill> },
                    { key: 'expires', label: 'Expires', get: (o) => o.expiresAt ?? '', render: (o) => (o.expiresAt ? day(o.expiresAt) : 'never'), wide: true },
                    { key: 'reason', label: 'Reason', get: (o) => o.reason, wide: true, wrap: true },
                  ]}
                  actions={(o) => (
                    <Button variant="ghost" size="sm" disabled={busy} onClick={() => run(async () => { await adminApi.removeOverride(key, o.id); await refreshFlags(asks.overrides); })}>
                      Remove
                    </Button>
                  )}
                  bulk={[{ label: 'Remove', variant: 'ghost', onClick: (rows) => run(async () => { await each(rows, (o) => adminApi.removeOverride(key, o.id).then(() => undefined)); await refreshFlags(asks.overrides); }) }]}
                  page={pages.overrides}
                  onPage={turn('overrides', refreshFlags)}
                />
              </div>
              <Sheet open={overrideFor !== null} onClose={() => setOverrideFor(null)} title={`Override: ${MODULE_BY_KEY[overrideFor ?? '']?.name ?? ''}`}>
                <form
                  className="flex flex-col gap-md"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!overrideFor) return;
                    void run(async () => {
                      await adminApi.addOverride(key, overrideFor, { subjectType: ovSubjectType, subjectId: ovSubjectId.trim(), enabled: ovEnabled, expiresAt: ovDays ? new Date(Date.now() + Number(ovDays) * 86_400_000).toISOString() : null, reason: ovReason });
                      await refreshFlags();
                      setOverrideFor(null);
                    });
                  }}
                >
                  <Label text="For">
                    <select value={ovSubjectType} onChange={(e) => setOvSubjectType(e.target.value as FlagOverride['subjectType'])} className={FIELD}>
                      <option value="user">One person (user id)</option>
                      <option value="role">A role (user, sub_admin, admin)</option>
                      <option value="organization">A brand (organization id)</option>
                    </select>
                  </Label>
                  <Label text="Id">
                    <input value={ovSubjectId} onChange={(e) => setOvSubjectId(e.target.value)} required className={FIELD} />
                  </Label>
                  <Toggle on={ovEnabled} onChange={setOvEnabled} label={ovEnabled ? 'Force on' : 'Force off'} />
                  <Label text="Expires in days (blank for never)">
                    <input type="number" min={1} value={ovDays} onChange={(e) => setOvDays(e.target.value)} className={FIELD} />
                  </Label>
                  <Label text="Reason">
                    <input value={ovReason} onChange={(e) => setOvReason(e.target.value)} className={FIELD} />
                  </Label>
                  <Button type="submit" full disabled={busy || !ovSubjectId.trim()}>
                    Save override
                  </Button>
                </form>
              </Sheet>
            </section>
          )}

          {tab === 'listings' && (
            <section className="mt-md" aria-labelledby="listings-heading">
              <h2 id="listings-heading" className="text-title2">
                Listings
              </h2>
              <p className="mt-xs m-0 text-subhead text-ink-soft">What the public site shows on Explore and each feature page.</p>
              <Fold title="How listing works" className="mt-xs">
                <ul className="m-0 flex list-disc flex-col gap-xs pl-md text-subhead text-ink-soft">
                  <li>Create here, then publish or feature in the row.</li>
                  <li>Tick several to do it at once.</li>
                  <li>Brands make their own campaigns public from Army.</li>
                </ul>
              </Fold>
              <div className="fill-row mt-sm flex flex-wrap gap-xs">
                {LISTING_TYPES.filter((t) => t !== 'campaign').map((t) => (
                  <Button key={t} variant="outline" size="sm" onClick={() => { setCreating(t); setForm({}); }}>
                    New {LISTING_TYPE_META[t].name.toLowerCase()}
                  </Button>
                ))}
              </div>
              <div className="mt-sm">
                <DataTable<Listing>
                  rows={listings}
                  page={pages.listings}
                  onPage={turn('listings', refreshListings)}
                  rowKey={(l) => `${l.type}-${l.id}`}
                  label="Listings"
                  selectable
                  busy={busy}
                  empty="Nothing yet. Create the first listing above."
                  columns={[
                    { key: 'type', label: 'Type', get: (l) => LISTING_TYPE_META[l.type].name, filter: true, render: (l) => <span className="inline-flex items-center gap-xs"><AppIcon name={LISTING_TYPE_META[l.type].icon} size={16} /> {LISTING_TYPE_META[l.type].name}</span> },
                    { key: 'title', label: 'Title', get: (l) => l.title, wrap: true, render: (l) => <span className="font-semibold">{l.title}</span> },
                    { key: 'by', label: 'By', get: (l) => l.by, filter: true, wide: true },
                    { key: 'facts', label: 'Facts', get: (l) => l.facts.map((f) => f.text).join(', '), wide: true, wrap: true },
                    { key: 'live', label: 'Live', get: (l) => l.live, filter: true, edit: { kind: 'toggle', onEdit: (l, v) => run(async () => { await adminApi.setListing(key, l.type, l.id, { live: Boolean(v) }); await refreshListings(); }) } },
                    { key: 'featured', label: 'Featured', get: (l) => l.featured, filter: true, edit: { kind: 'toggle', disabled: (l) => l.type === 'tool' || l.type === 'campaign' || l.type === 'circle', onEdit: (l, v) => run(async () => { await adminApi.setListing(key, l.type, l.id, { featured: Boolean(v) }); await refreshListings(); }) } },
                    { key: 'created', label: 'Created', get: (l) => l.createdAt.slice(0, 10), render: (l) => day(l.createdAt), wide: true },
                  ]}
                  actions={(l) => (
                    <Link to={l.path} className="inline-flex min-h-[44px] items-center text-subhead text-ink-soft underline-offset-4 hover:underline">
                      Open
                    </Link>
                  )}
                  bulk={[
                    { label: 'Publish', onClick: (rows) => run(async () => { await each(rows, (l) => adminApi.setListing(key, l.type, l.id, { live: true }).then(() => undefined)); await refreshListings(); }) },
                    { label: 'Hide', onClick: (rows) => run(async () => { await each(rows, (l) => adminApi.setListing(key, l.type, l.id, { live: false }).then(() => undefined)); await refreshListings(); }) },
                    { label: 'Feature', onClick: (rows) => run(async () => { await each(rows.filter((l) => l.type !== 'tool' && l.type !== 'campaign' && l.type !== 'circle'), (l) => adminApi.setListing(key, l.type, l.id, { featured: true }).then(() => undefined)); await refreshListings(); }) },
                    { label: 'Unfeature', variant: 'ghost', onClick: (rows) => run(async () => { await each(rows.filter((l) => l.type !== 'tool' && l.type !== 'campaign' && l.type !== 'circle'), (l) => adminApi.setListing(key, l.type, l.id, { featured: false }).then(() => undefined)); await refreshListings(); }) },
                  ]}
                />
              </div>
              <Sheet open={creating !== null} onClose={() => setCreating(null)} title={creating ? `New ${LISTING_TYPE_META[creating].name.toLowerCase()}` : ''}>
                {creating && (
                  <form
                    className="flex flex-col gap-md"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void run(async () => {
                        const body: Record<string, unknown> = { type: creating, publish: form.publish !== false, featured: form.featured === true };
                        for (const [k, v] of Object.entries(form)) {
                          if (k === 'publish' || k === 'featured') continue;
                          if (k === 'skillsRequired') body[k] = String(v).split(',').map((x) => x.trim()).filter(Boolean);
                          else if (['budgetPoints', 'ratePerThousand', 'maxPayoutPoints', 'minViews', 'compensationMin', 'compensationMax', 'capacity', 'pricePoints', 'priceCents', 'minutes', 'groupSize'].includes(k)) body[k] = v === '' ? null : Number(v);
                          else body[k] = v;
                        }
                        await adminApi.createListing(key, body as Record<string, unknown> & { type: ListingType; title: string });
                        await refreshListings();
                        setCreating(null);
                      });
                    }}
                  >
                    <Label text="Title">
                      <input required value={String(form.title ?? '')} onChange={(e) => setForm({ ...form, title: e.target.value })} className={FIELD} />
                    </Label>
                    {creating === 'reward' && (
                      <>
                        <Label text="Brand name">
                          <input value={String(form.brandName ?? '')} onChange={(e) => setForm({ ...form, brandName: e.target.value })} className={FIELD} />
                        </Label>
                        <Label text="Brief">
                          <textarea rows={4} value={String(form.brief ?? '')} onChange={(e) => setForm({ ...form, brief: e.target.value })} className={FIELD} />
                        </Label>
                        <div className="grid grid-cols-2 gap-xs">
                          <Label text="Deliverable">
                            <input value={String(form.deliverable ?? 'Short video')} onChange={(e) => setForm({ ...form, deliverable: e.target.value })} className={FIELD} />
                          </Label>
                          <Label text="Platform (blank for any)">
                            <input value={String(form.platform ?? '')} onChange={(e) => setForm({ ...form, platform: e.target.value })} placeholder="instagram, youtube" className={FIELD} />
                          </Label>
                          <Label text="Pool (points)">
                            <input type="number" min={0} value={String(form.budgetPoints ?? '')} onChange={(e) => setForm({ ...form, budgetPoints: e.target.value })} className={FIELD} />
                          </Label>
                          <Label text="Points per 1k views">
                            <input type="number" min={0} value={String(form.ratePerThousand ?? '')} onChange={(e) => setForm({ ...form, ratePerThousand: e.target.value })} className={FIELD} />
                          </Label>
                          <Label text="Cap per creator (0 = none)">
                            <input type="number" min={0} value={String(form.maxPayoutPoints ?? '')} onChange={(e) => setForm({ ...form, maxPayoutPoints: e.target.value })} className={FIELD} />
                          </Label>
                          <Label text="Minimum views">
                            <input type="number" min={0} value={String(form.minViews ?? '1000')} onChange={(e) => setForm({ ...form, minViews: e.target.value })} className={FIELD} />
                          </Label>
                        </div>
                        <Label text="Closes on">
                          <input type="datetime-local" value={String(form.endsAtLocal ?? '')} onChange={(e) => setForm({ ...form, endsAtLocal: e.target.value, endsAt: e.target.value ? new Date(e.target.value).toISOString() : '' })} className={FIELD} />
                        </Label>
                        <Label text="Who can take part">
                          <input value={String(form.eligibility ?? '')} onChange={(e) => setForm({ ...form, eligibility: e.target.value })} className={FIELD} />
                        </Label>
                      </>
                    )}
                    {creating === 'opportunity' && (
                      <>
                        <Label text="Description">
                          <textarea rows={4} value={String(form.description ?? '')} onChange={(e) => setForm({ ...form, description: e.target.value })} className={FIELD} />
                        </Label>
                        <div className="grid grid-cols-2 gap-xs">
                          <Label text="Type">
                            <select value={String(form.opportunityType ?? 'gig')} onChange={(e) => setForm({ ...form, opportunityType: e.target.value })} className={FIELD}>
                              {OPPORTUNITY_TYPES.map((t) => (
                                <option key={t} value={t}>
                                  {t.replace('_', ' ')}
                                </option>
                              ))}
                            </select>
                          </Label>
                          <Label text="Where">
                            <select value={String(form.locationMode ?? 'remote')} onChange={(e) => setForm({ ...form, locationMode: e.target.value })} className={FIELD}>
                              <option value="remote">Remote</option>
                              <option value="on_site">On site</option>
                              <option value="hybrid">Hybrid</option>
                            </select>
                          </Label>
                          <Label text="Pay from">
                            <input type="number" min={0} value={String(form.compensationMin ?? '')} onChange={(e) => setForm({ ...form, compensationMin: e.target.value })} className={FIELD} />
                          </Label>
                          <Label text="Pay to">
                            <input type="number" min={0} value={String(form.compensationMax ?? '')} onChange={(e) => setForm({ ...form, compensationMax: e.target.value })} className={FIELD} />
                          </Label>
                        </div>
                        <Label text="Skills (comma separated)">
                          <input value={String(form.skillsRequired ?? '')} onChange={(e) => setForm({ ...form, skillsRequired: e.target.value })} className={FIELD} />
                        </Label>
                        <Label text="Apply by">
                          <input type="date" value={String(form.deadline ?? '')} onChange={(e) => setForm({ ...form, deadline: e.target.value })} className={FIELD} />
                        </Label>
                        <Label text="Place (if on site)">
                          <input value={String(form.locationText ?? '')} onChange={(e) => setForm({ ...form, locationText: e.target.value })} className={FIELD} />
                        </Label>
                      </>
                    )}
                    {creating === 'event' && (
                      <>
                        <Label text="Description">
                          <textarea rows={3} value={String(form.description ?? '')} onChange={(e) => setForm({ ...form, description: e.target.value })} className={FIELD} />
                        </Label>
                        <div className="grid grid-cols-2 gap-xs">
                          <Label text="Type">
                            <select value={String(form.eventType ?? 'meetup')} onChange={(e) => setForm({ ...form, eventType: e.target.value })} className={FIELD}>
                              {EVENT_TYPES.map((t) => (
                                <option key={t} value={t}>
                                  {t}
                                </option>
                              ))}
                            </select>
                          </Label>
                          <Label text="Length (minutes)">
                            <input type="number" min={15} value={String(form.minutes ?? '120')} onChange={(e) => setForm({ ...form, minutes: e.target.value })} className={FIELD} />
                          </Label>
                          <Label text="Seats (blank for unlimited)">
                            <input type="number" min={1} value={String(form.capacity ?? '')} onChange={(e) => setForm({ ...form, capacity: e.target.value })} className={FIELD} />
                          </Label>
                          <Label text="Ticket (points)">
                            <input type="number" min={0} value={String(form.pricePoints ?? '0')} onChange={(e) => setForm({ ...form, pricePoints: e.target.value })} className={FIELD} />
                          </Label>
                        </div>
                        <Label text="Starts">
                          <input type="datetime-local" required value={String(form.startsAtLocal ?? '')} onChange={(e) => setForm({ ...form, startsAtLocal: e.target.value, startsAt: e.target.value ? new Date(e.target.value).toISOString() : '' })} className={FIELD} />
                        </Label>
                        <Label text="Venue">
                          <input value={String(form.venue ?? '')} onChange={(e) => setForm({ ...form, venue: e.target.value })} className={FIELD} />
                        </Label>
                        <Label text="Online link">
                          <input value={String(form.onlineUrl ?? '')} onChange={(e) => setForm({ ...form, onlineUrl: e.target.value })} className={FIELD} />
                        </Label>
                      </>
                    )}
                    {creating === 'program' && (
                      <>
                        <Label text="Description">
                          <textarea rows={3} value={String(form.description ?? '')} onChange={(e) => setForm({ ...form, description: e.target.value })} className={FIELD} />
                        </Label>
                        <div className="grid grid-cols-2 gap-xs">
                          <Label text="Price (points)">
                            <input type="number" min={0} value={String(form.pricePoints ?? '0')} onChange={(e) => setForm({ ...form, pricePoints: e.target.value })} className={FIELD} />
                          </Label>
                          <Label text="Delivery">
                            <select value={String(form.deliveryMode ?? 'online')} onChange={(e) => setForm({ ...form, deliveryMode: e.target.value })} className={FIELD}>
                              <option value="online">Online</option>
                              <option value="in_person">In person</option>
                              <option value="hybrid">Hybrid</option>
                            </select>
                          </Label>
                        </div>
                        <Label text="Outcomes">
                          <textarea rows={2} value={String(form.outcomes ?? '')} onChange={(e) => setForm({ ...form, outcomes: e.target.value })} className={FIELD} />
                        </Label>
                        <Label text="Prerequisites">
                          <input value={String(form.prerequisites ?? '')} onChange={(e) => setForm({ ...form, prerequisites: e.target.value })} className={FIELD} />
                        </Label>
                      </>
                    )}
                    {creating === 'circle' && (
                      <>
                        <div className="grid grid-cols-2 gap-xs">
                          <Label text="City">
                            <input required value={String(form.city ?? '')} onChange={(e) => setForm({ ...form, city: e.target.value })} className={FIELD} />
                          </Label>
                          <Label text="Area (optional)">
                            <input value={String(form.area ?? '')} onChange={(e) => setForm({ ...form, area: e.target.value })} className={FIELD} />
                          </Label>
                          <Label text="Starts">
                            <input type="datetime-local" required value={String(form.startsAtLocal ?? '')} onChange={(e) => setForm({ ...form, startsAtLocal: e.target.value, startsAt: e.target.value ? new Date(e.target.value).toISOString() : '' })} className={FIELD} />
                          </Label>
                          <Label text="People per table">
                            <input type="number" min={3} max={8} value={String(form.groupSize ?? '5')} onChange={(e) => setForm({ ...form, groupSize: e.target.value })} className={FIELD} />
                          </Label>
                        </div>
                        <Label text="Venue hint">
                          <input value={String(form.venueHint ?? '')} onChange={(e) => setForm({ ...form, venueHint: e.target.value })} placeholder="A cafe near the metro; the table picks the exact one" className={FIELD} />
                        </Label>
                        <Toggle on={form.repeat === 'weekly'} onChange={(on) => setForm({ ...form, repeat: on ? 'weekly' : 'none' })} label="Every week at this time. The next one opens on its own once tables are set." />
                      </>
                    )}
                    {creating === 'tool' && (
                      <>
                        <Label text="Link">
                          <input type="url" required value={String(form.url ?? '')} onChange={(e) => setForm({ ...form, url: e.target.value })} className={FIELD} />
                        </Label>
                        <Label text="Category">
                          <select value={String(form.category ?? 'Editing')} onChange={(e) => setForm({ ...form, category: e.target.value })} className={FIELD}>
                            {TOOL_CATEGORIES.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                        </Label>
                        <Label text="Description">
                          <input value={String(form.description ?? '')} onChange={(e) => setForm({ ...form, description: e.target.value })} className={FIELD} />
                        </Label>
                        <Toggle on={form.affiliate === true} onChange={(on) => setForm({ ...form, affiliate: on })} label="Partner link" hint="We may earn when people sign up through it." />
                      </>
                    )}
                    <Toggle on={form.publish !== false} onChange={(on) => setForm({ ...form, publish: on })} label="Publish now" hint="Off saves it hidden; publish later from the list." />
                    {creating !== 'tool' && creating !== 'circle' && <Toggle on={form.featured === true} onChange={(on) => setForm({ ...form, featured: on })} label="Feature on the home page" />}
                    <Button type="submit" full disabled={busy}>
                      Create
                    </Button>
                  </form>
                )}
              </Sheet>
            </section>
          )}

          {tab === 'redemptions' && (
            <section className="mt-md" aria-labelledby="redemptions-heading">
              <h2 id="redemptions-heading" className="text-title2">
                Reserved rewards
              </h2>
              <p className="mt-xs m-0 text-subhead text-ink-soft">Points are held until you mark a reward fulfilled or cancel it, which gives the points back.</p>
              <div className="mt-sm">
                <DataTable<AdminRedemption>
                  rows={redemptions}
                  page={pages.redemptions}
                  onPage={turn('redemptions', refreshRedemptions)}
                  rowKey={(r) => r.id}
                  label="Reserved rewards"
                  selectable
                  busy={busy}
                  empty="Nothing is waiting for you."
                  columns={[
                    { key: 'person', label: 'Person', get: (r) => r.userName, render: (r) => <span className="font-semibold">{r.userName}</span> },
                    { key: 'reward', label: 'Reward', get: (r) => REWARD_BY_KEY[r.rewardKey]?.name ?? r.rewardKey, filter: true },
                    { key: 'points', label: 'Points', get: (r) => r.points, align: 'right' },
                    { key: 'reserved', label: 'Reserved', get: (r) => r.createdAt, render: (r) => when(r.createdAt) },
                  ]}
                  actions={(r) => (
                    <>
                      <Button size="sm" disabled={busy} onClick={() => run(async () => { await adminApi.setRedemption(key, r.id, 'fulfilled'); setRedemptions((all) => all.filter((x) => x.id !== r.id)); })}>
                        Fulfilled
                      </Button>
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => run(async () => { await adminApi.setRedemption(key, r.id, 'cancelled'); setRedemptions((all) => all.filter((x) => x.id !== r.id)); })}>
                        Cancel and refund
                      </Button>
                    </>
                  )}
                  bulk={[
                    { label: 'Mark fulfilled', onClick: (rows) => run(async () => { await each(rows, (r) => adminApi.setRedemption(key, r.id, 'fulfilled').then(() => undefined)); setRedemptions((all) => all.filter((x) => !rows.some((r) => r.id === x.id))); }) },
                    { label: 'Cancel and refund', variant: 'ghost', onClick: (rows) => run(async () => { await each(rows, (r) => adminApi.setRedemption(key, r.id, 'cancelled').then(() => undefined)); setRedemptions((all) => all.filter((x) => !rows.some((r) => r.id === x.id))); }) },
                  ]}
                />
              </div>
            </section>
          )}

          {tab === 'orders' && (
            <section className="mt-md" aria-labelledby="orders-heading">
              <h2 id="orders-heading" className="text-title2">
                Orders
              </h2>
              <p className="mt-xs m-0 text-subhead text-ink-soft">Search by order, provider id, buyer, page or product. Tap a row for its timeline and a refund.</p>
              <form
                className="mt-sm flex flex-wrap gap-xs"
                onSubmit={(e) => {
                  e.preventDefault();
                  void searchOrders();
                }}
              >
                <input value={orderQ} onChange={(e) => setOrderQ(e.target.value)} placeholder="Order, payment, buyer, page" aria-label="Search orders on the server" className="min-w-0 flex-1 rounded-pill border-2 border-line bg-card px-md py-sm text-body" />
                <Select value={orderStatus} onChange={(e) => { setOrderStatus(e.target.value); void searchOrders(orderQ, e.target.value); }} aria-label="Status on the server" className="min-w-[160px]" selectClass="rounded-pill bg-card">
                  {ORDER_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s || 'all statuses'}
                    </option>
                  ))}
                </Select>
                <Button type="submit" variant="outline" disabled={busy}>
                  Search
                </Button>
              </form>
              <div className="mt-sm">
                <DataTable<AdminOrder>
                  rows={orders ?? []}
                  page={pages.orders}
                  onPage={(page, size) => { setAsks((a) => ({ ...a, orders: { page, size } })); void searchOrders(orderQ, orderStatus, { page, size }); }}
                  rowKey={(o) => o.id}
                  label="Orders"
                  busy={busy}
                  activeKey={orderDetail?.order.id ?? null}
                  onRowClick={(o) => void openOrder(o.id)}
                  empty="No orders match."
                  columns={[
                    { key: 'product', label: 'Product', get: (o) => o.productTitle, wrap: true, render: (o) => <><span className="block font-semibold">{o.productTitle}</span><span className="block text-caption text-ink-mute">#{o.id.slice(0, 8)}</span></> },
                    { key: 'buyer', label: 'Buyer', get: (o) => `${o.buyerName} ${o.buyerEmail ?? ''}`.trim(), render: (o) => <><span className="block">{o.buyerName}</span>{o.buyerEmail && <span className="block text-caption text-ink-soft">{o.buyerEmail}</span>}</> },
                    { key: 'from', label: 'From', get: (o) => (o.ownerHandle ? `@${o.ownerHandle}` : o.ownerName), filter: true, wide: true },
                    { key: 'amount', label: 'Amount', get: (o) => (o.points > 0 ? o.points : o.cents), align: 'right', render: (o) => (o.points > 0 ? `${formatCount(o.points)} pts` : money(o.cents, o.currency)) },
                    { key: 'provider', label: 'Provider', get: (o) => o.provider, filter: true, wide: true },
                    { key: 'status', label: 'Status', get: (o) => o.status, filter: true, render: (o) => <Pill tone={statusTone(o.status)}>{o.status}</Pill> },
                    { key: 'created', label: 'Created', get: (o) => o.createdAt, render: (o) => when(o.createdAt) },
                  ]}
                />
              </div>
              {orderDetail && (
                <div className="mt-md rounded-card bg-card p-md shadow-toy-soft">
                  <div className="flex items-start justify-between gap-sm">
                    <h3 className="text-title2">
                      {orderDetail.order.productTitle} <span className="text-subhead text-ink-mute">#{orderDetail.order.id.slice(0, 8)}</span>
                    </h3>
                    <CloseButton onClick={() => setOrderDetail(null)} label="Close this order" />
                  </div>
                  <p className="mt-xs m-0 text-subhead text-ink-soft">
                    <Pill tone={statusTone(orderDetail.order.status)}>{orderDetail.order.status}</Pill> {orderDetail.order.provider}
                    {orderDetail.order.providerOrderId ? `, ${orderDetail.order.providerOrderId}` : ''}
                    {orderDetail.order.paidAt ? `, paid ${dateTime(orderDetail.order.paidAt)}` : ''}
                  </p>
                  <p className="mt-md m-0 text-subhead font-semibold">Timeline</p>
                  {orderDetail.timeline.length === 0 && <p className="m-0 text-subhead text-ink-soft">Nothing logged for this order yet.</p>}
                  <ul className="mt-xs flex list-none flex-col gap-xs p-0 m-0">
                    {orderDetail.timeline.map((t) => (
                      <li key={t.id} className="rounded-tile bg-paper px-sm py-xs text-caption">
                        <span>{t.type}</span>
                        {t.data ? <span className="block break-words text-ink-soft">{t.data}</span> : null}
                        <span className="block text-ink-mute">{dateTime(t.createdAt)}</span>
                      </li>
                    ))}
                  </ul>
                  {orderDetail.webhooks.length > 0 && (
                    <>
                      <p className="mt-md m-0 text-subhead font-semibold">Provider webhooks</p>
                      <ul className="mt-xs flex list-none flex-col gap-xs p-0 m-0">
                        {orderDetail.webhooks.map((h) => (
                          <li key={h.id} className="rounded-tile bg-paper px-sm py-xs text-caption">
                            {h.type}
                            <span className="block text-ink-soft">{h.processedAt ? `processed ${dateTime(h.processedAt)}` : 'not processed yet'}</span>
                            {h.error && <span className="block text-r1">{h.error}</span>}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  {orderDetail.order.status !== 'refunded' && (
                    <div className="mt-md">
                      <Label text="Refund reason">
                        <input value={refundReason} onChange={(e) => setRefundReason(e.target.value)} className={FIELD} />
                      </Label>
                      {refundError && (
                        <p role="alert" className="mt-xs m-0 rounded-tile bg-r1/15 p-sm text-subhead">
                          {refundError}
                        </p>
                      )}
                      <Button
                        variant="outline"
                        className="mt-xs"
                        disabled={busy}
                        onClick={() =>
                          run(async () => {
                            setRefundError(null);
                            try {
                              await adminApi.refundOrder(key, orderDetail.order.id, refundReason);
                              setOrderDetail(await adminApi.order(key, orderDetail.order.id));
                              setOrders((list) => (list ?? []).map((x) => (x.id === orderDetail.order.id ? { ...x, status: 'refunded' } : x)));
                            } catch (e) {
                              setRefundError(e instanceof Error ? e.message : 'The refund was refused.');
                            }
                          })
                        }
                      >
                        Refund in full
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {tab === 'webhooks' && (
            <section className="mt-md" aria-labelledby="hooks-heading">
              <div className="flex items-center justify-between gap-sm">
                <h2 id="hooks-heading" className="text-title2">
                  Webhooks
                </h2>
                <Button variant="outline" size="sm" disabled={busy} onClick={() => loadHooks()}>
                  Refresh
                </Button>
              </div>
              <p className="mt-xs m-0 text-subhead text-ink-soft">Every signed event from Meta and the payment provider, stored before it is processed. Replay runs one again.</p>
              <div className="mt-sm">
                <DataTable<WebhookEvent>
                  rows={hooks ?? []}
                  page={pages.webhooks}
                  onPage={(page, size) => { setAsks((a) => ({ ...a, webhooks: { page, size } })); void loadHooks({ page, size }); }}
                  rowKey={(h) => h.id}
                  label="Webhooks"
                  busy={busy}
                  empty="Nothing has come in yet. New items show up here."
                  columns={[
                    { key: 'provider', label: 'Provider', get: (h) => h.provider, filter: true },
                    { key: 'type', label: 'Event', get: (h) => h.type, filter: true },
                    { key: 'received', label: 'Received', get: (h) => h.receivedAt, render: (h) => when(h.receivedAt) },
                    { key: 'processed', label: 'Processed', get: (h) => (h.processedAt ? 'yes' : 'no'), filter: true, render: (h) => (h.processedAt ? when(h.processedAt) : <Pill tone="bg-r3 text-ink-fixed">not yet</Pill>) },
                    { key: 'error', label: 'Error', get: (h) => h.error ?? '', render: (h) => (h.error ? <span className="text-r1">{h.error}</span> : ''), wide: true, wrap: true },
                  ]}
                  actions={(h) => (
                    <>
                      <Button variant="outline" size="sm" disabled={busy} onClick={() => run(async () => { const r = await adminApi.replayWebhook(key, h.id); setReplayOutcome((m) => ({ ...m, [h.id]: r.outcome })); })}>
                        Replay
                      </Button>
                      {replayOutcome[h.id] && <span className="text-caption text-ink-soft">{replayOutcome[h.id]}</span>}
                    </>
                  )}
                />
              </div>
            </section>
          )}

          {tab === 'kyc' && (
            <section className="mt-md" aria-labelledby="kyc-heading">
              <h2 id="kyc-heading" className="text-title2">
                Payout details
              </h2>
              <p className="mt-xs m-0 text-subhead text-ink-soft">Only the last digits are stored here. Approve once the bank account and PAN match the legal name. Type a note in the row before deciding, if the person should hear why.</p>
              <div className="mt-sm flex flex-wrap gap-xs" role="group" aria-label="Status">
                {(['pending', 'approved', 'rejected'] as const).map((s) => (
                  <button key={s} type="button" aria-pressed={kycStatus === s} onClick={() => { setKycStatus(s); void loadKyc(s); }} className={`toy inline-flex min-h-[44px] items-center rounded-pill border-2 px-sm text-subhead font-medium ${kycStatus === s ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}>
                    {s}
                  </button>
                ))}
              </div>
              <div className="mt-sm">
                <DataTable<AdminKyc>
                  rows={kycList ?? []}
                  page={pages.kyc}
                  onPage={(page, size) => { setAsks((a) => ({ ...a, kyc: { page, size } })); void loadKyc(kycStatus, { page, size }); }}
                  rowKey={(k) => k.userId}
                  label="Payout details"
                  busy={busy}
                  empty={`Nothing ${kycStatus} right now.`}
                  columns={[
                    { key: 'person', label: 'Person', get: (k) => `${k.userName} ${k.email ?? ''}`.trim(), render: (k) => <><span className="block font-semibold">{k.userName}</span><span className="block text-caption text-ink-soft">{k.email ?? 'no email'}</span></> },
                    { key: 'legal', label: 'Legal name', get: (k) => k.legalName },
                    { key: 'pan', label: 'PAN', get: (k) => `…${k.panLast4}`, wide: true },
                    { key: 'account', label: 'Account', get: (k) => `…${k.bankLast4} ${k.ifsc}`, wide: true },
                    { key: 'address', label: 'Address', get: (k) => k.address, wide: true, wrap: true },
                    { key: 'submitted', label: 'Submitted', get: (k) => k.submittedAt ?? '', render: (k) => when(k.submittedAt) },
                    ...(kycStatus === 'pending'
                      ? [{ key: 'note', label: 'Note to them', get: (k: AdminKyc) => kycNote[k.userId] ?? '', edit: { kind: 'text' as const, onEdit: (k: AdminKyc, v: string | number | boolean) => setKycNote((m) => ({ ...m, [k.userId]: String(v) })) } }]
                      : [{ key: 'decided', label: 'Decided', get: (k: AdminKyc) => `${when(k.decidedAt)}${k.note ? `, ${k.note}` : ''}` }]),
                  ]}
                  actions={(k) =>
                    k.status === 'pending' ? (
                      <>
                        <Button size="sm" disabled={busy} onClick={() => run(async () => { await adminApi.decideKyc(key, k.userId, { status: 'approved', note: kycNote[k.userId] ?? '' }); await loadKyc(); })}>
                          Approve
                        </Button>
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => run(async () => { await adminApi.decideKyc(key, k.userId, { status: 'rejected', note: kycNote[k.userId] ?? '' }); await loadKyc(); })}>
                          Reject
                        </Button>
                      </>
                    ) : null
                  }
                />
              </div>
            </section>
          )}

          {tab === 'ops' && (
            <section className="mt-md" aria-labelledby="ops-heading">
              <div className="flex items-center justify-between gap-sm">
                <h2 id="ops-heading" className="text-title2">
                  Funnels
                </h2>
                <Button variant="outline" size="sm" disabled={busy} onClick={() => loadOps()}>
                  Refresh
                </Button>
              </div>
              <p className="mt-xs m-0 text-subhead text-ink-soft">Counted from our own tables, nothing leaves the server. Each bar is the share of the step before it.</p>
              <ul className="mt-sm grid list-none grid-cols-1 gap-xs p-0 m-0 md:grid-cols-2">
                {funnels?.map((f) => {
                  const top = Math.max(1, f.steps[0]?.count ?? 0);
                  return (
                    <li key={f.name} className="rounded-tile bg-card p-sm shadow-toy-soft">
                      <p className="m-0 text-headline">{f.name}</p>
                      <ol className="mt-xs m-0 flex list-none flex-col gap-xs p-0">
                        {f.steps.map((s, i) => {
                          const prev = i > 0 ? (f.steps[i - 1]?.count ?? 0) : null;
                          const drop = prev ? Math.round(100 - (s.count / Math.max(1, prev)) * 100) : null;
                          return (
                            <li key={s.label} className="text-caption">
                              <div className="flex items-baseline justify-between gap-sm">
                                <span>{s.label}</span>
                                <span className="text-ink-soft">
                                  {s.count}
                                  {drop !== null && drop > 0 ? `, ${drop}% drop` : ''}
                                </span>
                              </div>
                              <div className="mt-xs h-[10px] overflow-hidden rounded-pill bg-line" aria-hidden="true">
                                <div className="h-full rounded-pill bg-r6" style={{ width: `${Math.max(2, Math.round((s.count / top) * 100))}%` }} />
                              </div>
                            </li>
                          );
                        })}
                      </ol>
                    </li>
                  );
                })}
              </ul>

              <h2 className="mt-lg text-title2">Email outbox</h2>
              <p className="mt-xs m-0 text-subhead text-ink-soft">Every message the app wanted to send. Skipped means no RESEND_API_KEY is set on the server, so nothing went out.</p>
              <div className="mt-sm">
                <DataTable<OutboxEmail>
                  rows={outbox ?? []}
                  page={pages.outbox}
                  onPage={(page, size) => { setAsks((a) => ({ ...a, outbox: { page, size } })); void loadOps({ page, size }); }}
                  rowKey={(m) => m.id}
                  label="Email outbox"
                  busy={busy}
                  empty="Nothing is queued."
                  columns={[
                    { key: 'to', label: 'To', get: (m) => m.to },
                    { key: 'subject', label: 'Subject', get: (m) => m.subject, wrap: true, render: (m) => <span className="font-semibold">{m.subject}</span> },
                    { key: 'status', label: 'Status', get: (m) => m.status, filter: true, render: (m) => <Pill tone={m.status === 'sent' ? 'bg-r4 text-on-fill' : m.status === 'failed' ? 'bg-r1 text-white' : 'bg-paper text-ink-soft'}>{m.status}</Pill> },
                    { key: 'created', label: 'Created', get: (m) => m.createdAt, render: (m) => when(m.createdAt) },
                    { key: 'error', label: 'Error', get: (m) => m.error, wide: true, wrap: true },
                  ]}
                />
              </div>
            </section>
          )}

          {tab === 'coaches' && (
            <section className="mt-md" aria-labelledby="coaches-heading">
              <h2 id="coaches-heading" className="text-title2">
                Life coaches
              </h2>
              <p className="mt-xs m-0 text-subhead text-ink-soft">A life coach works only with students who said yes, and never sees the journal.</p>
              <ul className="mt-xs m-0 flex list-disc flex-col gap-xs pl-md text-subhead text-ink-soft">
                <li>A student has up to {MAX_COACHES} coaches.</li>
                <li>Giving or taking the badge is the Life coach permission.</li>
                <li>Every change is audited, and the person is told.</li>
              </ul>

              <h3 className="mt-md text-headline">Asked to be a life coach</h3>
              <div className="mt-sm">
                <DataTable<AdminCoachAsk>
                  rows={coachAsks ?? []}
                  page={pages.coachAsks}
                  onPage={turn('coachAsks', reloadCoachPart('coachAsks'))}
                  rowKey={(r) => r.userId}
                  label="Asked to be a life coach"
                  selectable
                  busy={busy}
                  empty="Nobody is waiting."
                  columns={[
                    { key: 'name', label: 'Name', get: (r) => r.name, render: (r) => (<><span className="block font-semibold">{r.name}</span>{r.handle && <span className="block text-caption text-ink-soft">@{r.handle}</span>}</>) },
                    { key: 'email', label: 'Email', get: (r) => r.email ?? '', wide: true },
                    { key: 'about', label: 'Their coaching', get: (r) => r.about, wrap: true },
                    { key: 'asked', label: 'Asked', get: (r) => r.askedAt, render: (r) => day(r.askedAt) },
                  ]}
                  bulk={[
                    { label: 'Make life coach', onClick: (rows) => run(() => each(rows, (r) => makeCoach(r.userId, true)).then(() => loadCoaches())) },
                    { label: 'Say no', variant: 'ghost', onClick: (rows) => run(() => each(rows, (r) => adminApi.declineCoachAsk(key, r.userId).then(() => undefined)).then(() => loadCoaches())) },
                  ]}
                />
              </div>

              <h3 className="mt-md text-headline">Life coaches</h3>
              <div className="mt-sm">
                <DataTable<(typeof coaches)[number]>
                  rows={coaches}
                  page={pages.coaches}
                  onPage={turn('coaches', reloadCoachPart('coaches'))}
                  rowKey={(r) => r.id}
                  label="Life coaches"
                  selectable
                  busy={busy}
                  empty="No life coaches yet. Make one from an ask above, or from People."
                  columns={[
                    { key: 'name', label: 'Name', get: (r) => r.name, render: (r) => (<><span className="block font-semibold">{r.name}</span>{r.handle && <span className="block text-caption text-ink-soft">@{r.handle}</span>}</>) },
                    { key: 'email', label: 'Email', get: (r) => r.email ?? '', wide: true },
                    { key: 'students', label: 'Students', get: (r) => r.students, align: 'right' },
                  ]}
                  bulk={[{ label: 'Take the badge', variant: 'ghost', onClick: (rows) => run(() => each(rows, (r) => makeCoach(r.id, false)).then(() => loadCoaches())) }]}
                />
              </div>

              <h3 className="mt-md text-headline">Link a coach and a student</h3>
              <p className="mt-xs m-0 text-subhead text-ink-soft">Ask, and the student answers on their Profile tab. Link now only if they already agreed.</p>
              <form
                className="mt-sm grid gap-xs md:grid-cols-[1fr_1fr_auto_auto]"
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(async () => {
                    setLinked(null);
                    const r = await adminApi.linkCoach(key, { coachId: linkCoach, student: linkStudent, mode: linkMode });
                    setLinked(r.link ? `${r.link.status === 'active' ? 'Linked' : 'Asked'}: ${r.link.coachName} and ${r.link.studentName}.` : null);
                    setLinkStudent('');
                    await loadCoaches();
                  });
                }}
              >
                <Select value={linkCoach} onChange={(e) => setLinkCoach(e.target.value)} aria-label="Life coach" selectClass="rounded-pill bg-card">
                  <option value="">Pick a life coach</option>
                  {coaches.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.name}
                      {k.handle ? ` (@${k.handle})` : ''}
                    </option>
                  ))}
                </Select>
                <input value={linkStudent} onChange={(e) => setLinkStudent(e.target.value)} placeholder="Student's email or @handle" aria-label="Student's email or handle" className="min-w-0 rounded-pill border-2 border-line bg-card px-md py-sm text-body" />
                <Select value={linkMode} onChange={(e) => setLinkMode(e.target.value === 'link' ? 'link' : 'ask')} aria-label="How" selectClass="rounded-pill bg-card">
                  <option value="ask">Ask the student</option>
                  <option value="link">Link now</option>
                </Select>
                <Button type="submit" disabled={busy || !linkCoach || !linkStudent.trim()}>
                  {linkMode === 'link' ? 'Link them' : 'Send the ask'}
                </Button>
              </form>
              {linked && <p className="mt-xs m-0 text-subhead font-semibold">{linked}</p>}

              <h3 className="mt-md text-headline">Every link</h3>
              <div className="mt-sm flex flex-wrap gap-xs">
                <Select
                  value={linkStatus}
                  onChange={(e) => {
                    setLinkStatus(e.target.value);
                    void run(() => adminApi.coachLinks(key, e.target.value, pageQuery(1, asks.coachLinks?.size ?? DEFAULT_PAGE_SIZE)).then((l) => (setCoachLinks(l.links), gotPage('coachLinks', l.page))));
                  }}
                  aria-label="Status"
                  selectClass="rounded-pill bg-card"
                >
                  <option value="">Every status</option>
                  {(Object.keys(LINK_STATUS_NAMES) as AdminCoachLink['status'][]).map((k) => (
                    <option key={k} value={k}>
                      {LINK_STATUS_NAMES[k]}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="mt-sm">
                <DataTable<AdminCoachLink>
                  rows={coachLinks}
                  page={pages.coachLinks}
                  onPage={turn('coachLinks', reloadCoachPart('coachLinks'))}
                  rowKey={(r) => r.id}
                  label="Coaching links"
                  selectable
                  busy={busy}
                  empty="No links yet. Add one above."
                  columns={[
                    { key: 'coach', label: 'Life coach', get: (r) => r.coachName },
                    { key: 'student', label: 'Student', get: (r) => r.studentName },
                    { key: 'status', label: 'Status', get: (r) => LINK_STATUS_NAMES[r.status], filter: true },
                    { key: 'askedBy', label: 'Started by', get: (r) => ASKED_BY_NAMES[r.askedBy], filter: true, wide: true },
                    { key: 'since', label: 'Since', get: (r) => r.createdAt, render: (r) => day(r.createdAt) },
                    { key: 'ended', label: 'Ended', get: (r) => r.endedAt ?? '', render: (r) => day(r.endedAt), wide: true },
                  ]}
                  bulk={[{ label: 'End', variant: 'ghost', onClick: (rows) => run(() => each(rows.filter((r) => r.status === 'pending' || r.status === 'active'), (r) => adminApi.endCoachLink(key, r.id).then(() => undefined)).then(() => loadCoaches())) }]}
                />
              </div>
            </section>
          )}

          {tab === 'codes' && (
            <section className="mt-md" aria-labelledby="codes-heading">
              <h2 id="codes-heading" className="text-title2">
                Attendee codes
              </h2>
              <p className="mt-xs m-0 text-subhead text-ink-soft">Every Party, Run and Circles event with guests, from a week ago on, soonest first.</p>
              <ul className="mt-xs m-0 flex list-disc flex-col gap-xs pl-md text-subhead text-ink-soft">
                <li>Set its xp (up to {ATTENDEE_XP_MAX}) until the code opens, thirty minutes before the start.</li>
                <li>Only its own guests can use the code, once each.</li>
                <li>The host hears about your change, and it is audited.</li>
              </ul>
              <form
                className="mt-sm flex flex-wrap gap-xs"
                onSubmit={(e) => {
                  e.preventDefault();
                  void loadCodes(codeApp, { page: 1, size: asks.codes?.size ?? DEFAULT_PAGE_SIZE });
                }}
              >
                <select
                  value={codeApp}
                  onChange={(e) => {
                    setCodeApp(e.target.value);
                    void loadCodes(e.target.value, { page: 1, size: asks.codes?.size ?? DEFAULT_PAGE_SIZE });
                  }}
                  aria-label="App"
                  className="rounded-pill border-2 border-line bg-card px-md py-sm text-body"
                >
                  <option value="">All apps</option>
                  <option value="party">Party</option>
                  <option value="run">Run</option>
                  <option value="circles">Circles</option>
                </select>
                <input value={codeQ} onChange={(e) => setCodeQ(e.target.value)} placeholder="Event title" aria-label="Search events by title" className="min-w-0 flex-1 rounded-pill border-2 border-line bg-card px-md py-sm text-body" />
                <Button type="submit" variant="outline" disabled={busy}>
                  Search
                </Button>
              </form>
              <div className="mt-sm">
                <DataTable<AdminAttendeeCode>
                  rows={codes ?? []}
                  page={pages.codes}
                  onPage={turn('codes', (ask) => loadCodes(codeApp, ask))}
                  rowKey={(r) => `${r.app}:${r.thingId}`}
                  label="Attendee codes"
                  selectable
                  busy={busy}
                  empty={codes === null ? 'Loading' : 'No events with guests from a week ago on.'}
                  columns={[
                    { key: 'app', label: 'App', get: (r) => APP_NAMES[r.app], filter: true },
                    {
                      key: 'title',
                      label: 'Event',
                      get: (r) => r.title,
                      render: (r) => (
                        <>
                          <span className="block font-semibold">{r.title}</span>
                          <span className="block text-caption text-ink-soft">Host: {r.hostName}</span>
                        </>
                      ),
                    },
                    { key: 'starts', label: 'Starts', get: (r) => r.startsAt, render: (r) => when(r.startsAt) },
                    { key: 'status', label: 'Status', get: (r) => r.status, filter: true },
                    {
                      key: 'xp',
                      label: 'Xp each',
                      get: (r) => r.xp ?? 0,
                      align: 'right',
                      edit: {
                        kind: 'number',
                        min: 1,
                        max: ATTENDEE_XP_MAX,
                        step: 5,
                        disabled: (r) => r.locked || r.status === 'cancelled',
                        onEdit: (r, v) => setCode(r, { xp: Math.max(1, Math.min(ATTENDEE_XP_MAX, Math.round(Number(v)))) }),
                      },
                    },
                    {
                      key: 'code',
                      label: 'Code',
                      get: (r) => r.code ?? '',
                      edit: {
                        kind: 'text',
                        disabled: (r) => r.status === 'cancelled' || (!r.code && r.locked),
                        onEdit: (r, v) => {
                          const problem = codeProblem(String(v));
                          if (problem) {
                            setError(problem);
                            return;
                          }
                          return setCode(r, { code: normalizeCode(String(v)) });
                        },
                      },
                    },
                    { key: 'claims', label: 'Claimed', get: (r) => r.claims, align: 'right', render: (r) => `${r.claims} of ${r.guests}` },
                  ]}
                  bulk={[
                    // Only events that already have a code get a new one: a code with xp is made through the xp cell, on purpose.
                    { label: 'New random codes', onClick: (rows) => run(() => each(rows.filter((r) => r.status !== 'cancelled' && r.code), (r) => adminApi.setAttendeeCode(key, r.app, r.thingId, { fresh: true }).then(() => undefined)).then(() => loadCodes())) },
                  ]}
                />
              </div>
            </section>
          )}

          {tab === 'discounts' && <AdminDiscounts adminKey={key} />}
          {tab === 'agencyhouse' && <AdminHouseTemplates adminKey={key} />}

          {tab === 'audit' && (
            <section className="mt-md" aria-labelledby="audit-heading">
              <div className="flex items-center justify-between gap-sm">
                <h2 id="audit-heading" className="text-title2">
                  Audit log
                </h2>
                <Button variant="outline" size="sm" disabled={busy} onClick={() => run(refreshAudit)}>
                  Refresh
                </Button>
              </div>
              <p className="mt-xs m-0 text-subhead text-ink-soft">Who changed what, with the before and after. The last two hundred entries.</p>
              <div className="mt-sm">
                <DataTable<AuditLog>
                  rows={logs}
                  page={pages.audit}
                  onPage={turn('audit', refreshAudit)}
                  rowKey={(l) => l.id}
                  label="Audit log"
                  busy={busy}
                  pageSize={50}
                  columns={[
                    { key: 'when', label: 'When', get: (l) => l.createdAt, render: (l) => when(l.createdAt) },
                    { key: 'actor', label: 'Actor', get: (l) => l.actorName, filter: true },
                    { key: 'action', label: 'Action', get: (l) => l.action, filter: true, render: (l) => <span className="font-semibold">{l.action}</span> },
                    { key: 'resource', label: 'Resource', get: (l) => `${l.resourceType} ${l.resourceId?.slice(0, 8) ?? ''}`.trim(), filter: false },
                    // Data, not prose: one line in the mono face that scrolls inside its cell, so a JSON tail never wraps onto a line alone.
                    { key: 'before', label: 'Before', get: (l) => l.before, wide: true, wrap: true, render: (l) => <code className="block max-w-[320px] overflow-x-auto whitespace-nowrap font-mono text-caption">{l.before}</code> },
                    { key: 'after', label: 'After', get: (l) => l.after, wrap: true, render: (l) => <code className="block max-w-[320px] overflow-x-auto whitespace-nowrap font-mono text-caption">{l.after}</code> },
                  ]}
                />
              </div>
            </section>
          )}
        </>
      )}
    </Screen>
  );
}
