import {
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
import { BackLink } from '../components/PageHeader';
import { Screen } from '../components/Screen';
import { Sheet } from '../components/Sheet';
import { Toggle } from '../components/Toggle';
import { adminApi } from '../lib/api';
import { useMe } from '../lib/queries';

const ADMIN_HONORS = HONORS.filter((h) => h.source === 'admin' && h.key !== 'pro');
const KEY_STORE = 'kreators.adminKey';
const PERMISSION_NAMES: Record<Permission, string> = { talent: 'Talent', cohorts: 'Cohorts', events: 'Events', finance: 'Finance', moderation: 'Moderation', support: 'Support', review: 'Review', mentor: 'Mentor' };
type Tab = 'people' | 'flags' | 'listings' | 'orders' | 'webhooks' | 'kyc' | 'ops' | 'redemptions' | 'audit';
const ORDER_STATUSES = ['', 'pending', 'paid', 'test', 'failed', 'refunded', 'expired'] as const;
const statusTone = (s: string) => (s === 'paid' || s === 'test' ? 'bg-r4 text-on-fill' : s === 'pending' ? 'bg-r3 text-ink-fixed' : s === 'refunded' || s === 'failed' ? 'bg-r1 text-white' : 'bg-paper text-ink-soft');
const ROLE_OPTIONS = ROLES.map((r) => ({ value: ROLE_META[r].name, label: ROLE_META[r].name }));
const roleByName = (name: string): Role => ROLES.find((r) => ROLE_META[r].name === name) ?? 'user';
const when = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '');
const day = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '');

function readKey(): string {
  try {
    return sessionStorage.getItem(KEY_STORE) ?? '';
  } catch {
    return '';
  }
}

const field = 'mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]';
const Label = ({ children, text }: { children: ReactNode; text: string }) => (
  <label className="block">
    <span className="block text-[14px] font-bold">{text}</span>
    {children}
  </label>
);
const Pill = ({ children, tone = 'bg-paper text-ink-soft' }: { children: ReactNode; tone?: string }) => <span className={`inline-flex rounded-pill px-xs text-[12px] font-extrabold leading-[20px] ${tone}`}>{children}</span>;

/**
 * The admin console. Every list is a table: sort by any column, search, filter by a column's values,
 * tick rows and act on them together, and change a cell where it sits. Each change is written to the
 * audit log on the server.
 */
export function Admin() {
  const me = useMe();
  const sessionAdmin = me.data?.user.role === 'admin';
  const [key, setKey] = useState(readKey);
  const [tab, setTab] = useState<Tab>('people');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // people
  const [q, setQ] = useState('');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [honor, setHonor] = useState(ADMIN_HONORS[0]?.key ?? 'founder');
  const [note, setNote] = useState('');
  const [amount, setAmount] = useState('100');
  const [preview, setPreview] = useState<{ name: string; access: Record<string, ModuleAccess> } | null>(null);
  // flags
  const [settings, setSettings] = useState<ModuleSetting[]>([]);
  const [overrides, setOverrides] = useState<FlagOverride[]>([]);
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
      setError(e instanceof Error ? e.message : 'Something failed.');
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
      const [u, r, f, l, a] = await Promise.all([adminApi.users(key, q), adminApi.redemptions(key, 'reserved'), adminApi.flags(key), adminApi.listings(key), adminApi.audit(key)]);
      setUsers(u.users);
      setRedemptions(r.redemptions);
      setSettings(f.settings);
      setOverrides(f.overrides);
      setListings(l.listings);
      setLogs(a.logs);
      setLoaded(true);
    });

  useEffect(() => {
    if (sessionAdmin && !loaded && !busy) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionAdmin]);

  const applyUser = (u: AdminUser) => {
    setSelected((s) => (s?.id === u.id ? u : s));
    setUsers((list) => list.map((x) => (x.id === u.id ? u : x)));
  };
  const refreshFlags = async () => {
    const f = await adminApi.flags(key);
    setSettings(f.settings);
    setOverrides(f.overrides);
  };
  const refreshListings = async () => {
    const l = await adminApi.listings(key);
    setListings(l.listings);
  };
  const refreshAudit = async () => setLogs((await adminApi.audit(key)).logs);
  const searchOrders = (q = orderQ, status = orderStatus) =>
    run(async () => {
      setOrders((await adminApi.orders(key, q, status)).orders);
    });
  const openOrder = (id: string) =>
    run(async () => {
      setRefundError(null);
      setOrderDetail(await adminApi.order(key, id));
    });
  const loadHooks = () => run(async () => setHooks((await adminApi.webhooks(key)).webhooks));
  const loadKyc = (status = kycStatus) => run(async () => setKycList((await adminApi.kycQueue(key, status)).kyc));
  const loadOps = () =>
    run(async () => {
      const [f, o] = await Promise.all([adminApi.funnels(key), adminApi.outbox(key)]);
      setFunnels(f.funnels);
      setOutbox(o.outbox);
    });
  // Each new tab fetches on first open, so the first load stays as quick as it was.
  const openTab = (k: Tab) => {
    setTab(k);
    if (k === 'orders' && orders === null) void searchOrders();
    if (k === 'webhooks' && hooks === null) void loadHooks();
    if (k === 'kyc' && kycList === null) void loadKyc();
    if (k === 'ops' && funnels === null) void loadOps();
  };
  /** The same change on every ticked row, one after the other, then one refresh. */
  const each = async <T,>(rows: T[], fn: (row: T) => Promise<void>) => {
    for (const r of rows) await fn(r);
  };

  const tabs: [Tab, string][] = [
    ['people', 'People'],
    ['flags', 'Flags'],
    ['listings', 'Listings'],
    ['orders', 'Orders'],
    ['webhooks', 'Webhooks'],
    ['kyc', 'KYC'],
    ['ops', 'Ops'],
    ['redemptions', `Redemptions${redemptions.length ? ` (${redemptions.length})` : ''}`],
    ['audit', 'Audit'],
  ];

  return (
    <Screen tabs={false} wide>
      <header className="pt-lg">
        <BackLink to="/apps">Apps</BackLink>
        <h1 className="text-[30px]">Admin</h1>
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">
          {sessionAdmin ? 'You are signed in as an admin, so no key is needed.' : 'Paste the admin key, or sign in with an admin account. Every change here is written to the audit log.'}
        </p>
      </header>

      {!sessionAdmin && (
        <form
          className="mt-md flex gap-xs"
          onSubmit={(e) => {
            e.preventDefault();
            void load();
          }}
        >
          <input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="Admin key" aria-label="Admin key" autoComplete="off" className="min-w-0 flex-1 rounded-pill border-2 border-line bg-card px-md py-sm text-[16px]" />
          <Button type="submit" disabled={busy || !key}>
            {loaded ? 'Reload' : 'Open'}
          </Button>
        </form>
      )}
      {error && (
        <p role="alert" className="mt-sm m-0 rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
          {error}
        </p>
      )}

      {loaded && (
        <>
          <div className="mt-md">
          <nav className="scroll-row md:flex-wrap md:overflow-visible" aria-label="Admin sections">
            {tabs.map(([k, label]) => (
              <button key={k} type="button" aria-pressed={tab === k} onClick={() => openTab(k)} className={`toy shrink-0 rounded-pill border-2 px-sm py-xs text-[14px] font-bold ${tab === k ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}>
                {label}
              </button>
            ))}
          </nav>
          </div>

          {tab === 'people' && (
            <section className="mt-md" aria-labelledby="people-heading">
              <h2 id="people-heading" className="text-[24px]">
                People
              </h2>
              <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Search the whole list on the server, then sort, filter and edit the rows here. Role and Pro change in the row; tick rows to change several at once. Tap a row for honors, points and what that person sees.</p>
              <form
                className="mt-sm flex gap-xs"
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(async () => setUsers((await adminApi.users(key, q)).users));
                }}
              >
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, email, page or id" aria-label="Search people on the server" className="min-w-0 flex-1 rounded-pill border-2 border-line bg-card px-md py-sm text-[16px]" />
                <Button type="submit" variant="outline" disabled={busy}>
                  Search
                </Button>
              </form>
              <div className="mt-sm">
                <DataTable<AdminUser>
                  rows={users}
                  rowKey={(u) => u.id}
                  label="People"
                  selectable
                  busy={busy}
                  activeKey={selected?.id ?? null}
                  onRowClick={(u) => setSelected(u)}
                  empty="Nobody matches on the server. Search above."
                  columns={[
                    {
                      key: 'name',
                      label: 'Name',
                      get: (u) => u.displayName || 'Anonymous climber',
                      render: (u) => (
                        <>
                          <span className="block font-bold">{u.displayName || 'Anonymous climber'}</span>
                          {u.handle && <span className="block text-[12px] font-bold text-ink-soft">@{u.handle}</span>}
                        </>
                      ),
                    },
                    { key: 'email', label: 'Email', get: (u) => u.email ?? '', wide: true },
                    { key: 'role', label: 'Role', get: (u) => ROLE_META[u.role].name, filter: true, edit: { kind: 'select', options: ROLE_OPTIONS, onEdit: (u, v) => run(async () => applyUser((await adminApi.setRole(key, u.id, roleByName(String(v)))).user)) } },
                    { key: 'pro', label: 'Pro', get: (u) => u.isPro, filter: true, edit: { kind: 'toggle', onEdit: (u, v) => run(async () => applyUser((await adminApi.setPro(key, u.id, Boolean(v))).user)) } },
                    { key: 'perms', label: 'Permissions', get: (u) => (u.role === 'admin' ? 'all' : u.permissions.map((p) => PERMISSION_NAMES[p]).join(', ')), wide: true, wrap: true },
                    { key: 'xp', label: 'XP', get: (u) => u.xp, align: 'right' },
                    { key: 'points', label: 'Points', get: (u) => u.points, align: 'right' },
                    { key: 'honors', label: 'Honors', get: (u) => u.honors.map((h) => HONOR_BY_KEY[h]?.name ?? h).join(', '), render: (u) => <span aria-label={u.honors.map((h) => HONOR_BY_KEY[h]?.name ?? h).join(', ')}>{u.honors.map((h) => HONOR_BY_KEY[h]?.emoji ?? '').join(' ')}</span>, wide: true },
                    { key: 'joined', label: 'Joined', get: (u) => u.createdAt.slice(0, 10), render: (u) => day(u.createdAt), wide: true },
                  ]}
                  bulk={[
                    { label: 'Make creator', onClick: (rows) => run(() => each(rows, async (u) => applyUser((await adminApi.setRole(key, u.id, 'user')).user))) },
                    { label: 'Make staff', onClick: (rows) => run(() => each(rows, async (u) => applyUser((await adminApi.setRole(key, u.id, 'sub_admin')).user))) },
                    { label: 'Make admin', onClick: (rows) => run(() => each(rows, async (u) => applyUser((await adminApi.setRole(key, u.id, 'admin')).user))) },
                    { label: 'Pro on', onClick: (rows) => run(() => each(rows, async (u) => applyUser((await adminApi.setPro(key, u.id, true)).user))) },
                    { label: 'Pro off', variant: 'ghost', onClick: (rows) => run(() => each(rows, async (u) => applyUser((await adminApi.setPro(key, u.id, false)).user))) },
                  ]}
                />
              </div>

              {selected && (
                <div className="mt-md rounded-card bg-card p-md shadow-toy-soft">
                  <div className="flex items-start justify-between gap-sm">
                    <div className="min-w-0">
                      <h3 className="text-[22px]">{selected.displayName || 'Anonymous climber'}</h3>
                      <p className="mt-xs m-0 text-[12px] font-bold text-ink-mute">{selected.id}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
                      Close
                    </Button>
                  </div>

                  <p className="mt-md m-0 text-[14px] font-bold">Permissions</p>
                  <p className="m-0 text-[12px] font-semibold text-ink-soft">A permission is a job someone is trusted with. Admins hold all of them.</p>
                  <div className="mt-xs flex flex-wrap gap-xs" role="group" aria-label="Permissions">
                    {PERMISSIONS.map((p) => {
                      const on = selected.permissions.includes(p);
                      return (
                        <button
                          key={p}
                          type="button"
                          aria-pressed={on}
                          disabled={busy || selected.role === 'admin'}
                          onClick={() => run(async () => applyUser((await adminApi.setPermissions(key, selected.id, on ? selected.permissions.filter((x) => x !== p) : [...selected.permissions, p])).user))}
                          className={`toy rounded-pill border-2 px-sm py-xs text-[14px] font-bold ${on || selected.role === 'admin' ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}
                        >
                          {PERMISSION_NAMES[p]}
                        </button>
                      );
                    })}
                  </div>

                  <p className="mt-md m-0 text-[14px] font-bold">Honors</p>
                  <div className="mt-xs flex flex-wrap gap-xs">
                    {selected.honors.length === 0 && <span className="text-[14px] font-semibold text-ink-soft">None yet.</span>}
                    {selected.honors.map((h) => (
                      <button key={h} type="button" disabled={busy} onClick={() => run(async () => applyUser((await adminApi.revokeHonor(key, selected.id, h)).user))} className="toy toy-soft rounded-pill bg-paper px-sm py-xs text-[14px] font-bold" aria-label={`Remove ${HONOR_BY_KEY[h]?.name ?? h}`}>
                        {HONOR_BY_KEY[h]?.emoji} {HONOR_BY_KEY[h]?.name ?? h} ×
                      </button>
                    ))}
                  </div>
                  <div className="mt-xs grid grid-cols-[1fr_auto] gap-xs">
                    <select value={honor} onChange={(e) => setHonor(e.target.value)} aria-label="Honor" className="rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]">
                      {ADMIN_HONORS.map((h) => (
                        <option key={h.key} value={h.key}>
                          {h.emoji} {h.name}
                        </option>
                      ))}
                    </select>
                    <Button variant="outline" disabled={busy} onClick={() => run(async () => applyUser((await adminApi.grantHonor(key, selected.id, honor, note)).user))}>
                      Grant
                    </Button>
                  </div>
                  <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" aria-label="Note" className={field} />

                  <p className="mt-md m-0 text-[14px] font-bold">Points</p>
                  <div className="mt-xs grid grid-cols-[1fr_auto] gap-xs">
                    <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Amount" className="rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]" />
                    <Button variant="outline" disabled={busy || !Number(amount)} onClick={() => run(async () => applyUser((await adminApi.addPoints(key, selected.id, Number(amount), note)).user))}>
                      Add
                    </Button>
                  </div>

                  <Button variant="ghost" className="mt-md" disabled={busy} onClick={() => run(async () => setPreview(await adminApi.previewAccess(key, selected.id)))}>
                    What does this person see?
                  </Button>
                  {preview && (
                    <ul className="mt-xs grid list-none grid-cols-2 gap-xs p-0 m-0 md:grid-cols-4">
                      {MODULES.map((m) => {
                        const a = preview.access[m.key];
                        return (
                          <li key={m.key} className={`rounded-tile px-sm py-xs text-[12px] font-bold ${a?.on ? 'bg-paper' : 'bg-line text-ink-soft line-through'}`}>
                            {m.emoji} {m.name}
                            {a && !a.available && <span className="block text-[11px] font-semibold no-underline">{a.reason}</span>}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
            </section>
          )}

          {tab === 'flags' && (
            <section className="mt-md" aria-labelledby="flags-heading">
              <h2 id="flags-heading" className="text-[24px]">
                Feature flags
              </h2>
              <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Off hides a module for everyone. Rollout shows it to a steady percentage of people. Overrides force it on or off for one person, one role or one brand, and can expire. Change any cell in place.</p>
              <div className="mt-sm">
                <DataTable<ModuleSetting>
                  rows={settings}
                  rowKey={(s) => s.key}
                  label="Feature flags"
                  busy={busy}
                  columns={[
                    { key: 'module', label: 'Module', get: (s) => MODULE_BY_KEY[s.key]?.name ?? s.key, render: (s) => <span className="font-bold">{MODULE_BY_KEY[s.key]?.emoji} {MODULE_BY_KEY[s.key]?.name ?? s.key}</span> },
                    { key: 'group', label: 'Group', get: (s) => MODULE_GROUPS[MODULE_BY_KEY[s.key]?.group ?? 'core'], filter: true, wide: true },
                    { key: 'enabled', label: 'On', get: (s) => s.enabled, filter: true, edit: { kind: 'toggle', onEdit: (s, v) => run(async () => { await adminApi.setModuleSetting(key, s.key, { enabled: Boolean(v) }); await refreshFlags(); }) } },
                    { key: 'minRole', label: 'Minimum role', get: (s) => ROLE_META[s.minRole].name, filter: true, edit: { kind: 'select', options: ROLE_OPTIONS, onEdit: (s, v) => run(async () => { await adminApi.setModuleSetting(key, s.key, { minRole: roleByName(String(v)) }); await refreshFlags(); }) } },
                    { key: 'rollout', label: 'Rollout %', get: (s) => s.rollout, align: 'right', edit: { kind: 'number', min: 0, max: 100, step: 5, onEdit: (s, v) => run(async () => { await adminApi.setModuleSetting(key, s.key, { rollout: Math.max(0, Math.min(100, Number(v))) }); await refreshFlags(); }) } },
                    { key: 'overrides', label: 'Overrides', get: (s) => overrides.filter((o) => o.flagKey === s.key).length, align: 'right' },
                  ]}
                  actions={(s) => (
                    <Button variant="outline" size="sm" onClick={() => { setOverrideFor(s.key); setOvSubjectId(''); setOvReason(''); setOvDays(''); }}>
                      Add override
                    </Button>
                  )}
                />
              </div>
              <h3 className="mt-md text-[18px]">Overrides</h3>
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
                    <Button variant="ghost" size="sm" disabled={busy} onClick={() => run(async () => { await adminApi.removeOverride(key, o.id); await refreshFlags(); })}>
                      Remove
                    </Button>
                  )}
                  bulk={[{ label: 'Remove', variant: 'ghost', onClick: (rows) => run(async () => { await each(rows, (o) => adminApi.removeOverride(key, o.id).then(() => undefined)); await refreshFlags(); }) }]}
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
                    <select value={ovSubjectType} onChange={(e) => setOvSubjectType(e.target.value as FlagOverride['subjectType'])} className={field}>
                      <option value="user">One person (user id)</option>
                      <option value="role">A role (user, sub_admin, admin)</option>
                      <option value="organization">A brand (organization id)</option>
                    </select>
                  </Label>
                  <Label text="Id">
                    <input value={ovSubjectId} onChange={(e) => setOvSubjectId(e.target.value)} required className={field} />
                  </Label>
                  <Toggle on={ovEnabled} onChange={setOvEnabled} label={ovEnabled ? 'Force on' : 'Force off'} />
                  <Label text="Expires in days (blank for never)">
                    <input type="number" min={1} value={ovDays} onChange={(e) => setOvDays(e.target.value)} className={field} />
                  </Label>
                  <Label text="Reason">
                    <input value={ovReason} onChange={(e) => setOvReason(e.target.value)} className={field} />
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
              <h2 id="listings-heading" className="text-[24px]">
                Listings
              </h2>
              <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">What the public site shows on Explore and on each feature page. Create here, then publish or feature in the row, or tick several and do it at once. Brands make their own campaigns public from Army.</p>
              <div className="mt-sm flex flex-wrap gap-xs">
                {LISTING_TYPES.filter((t) => t !== 'campaign').map((t) => (
                  <Button key={t} variant="outline" size="sm" onClick={() => { setCreating(t); setForm({}); }}>
                    New {LISTING_TYPE_META[t].name.toLowerCase()}
                  </Button>
                ))}
              </div>
              <div className="mt-sm">
                <DataTable<Listing>
                  rows={listings}
                  rowKey={(l) => `${l.type}-${l.id}`}
                  label="Listings"
                  selectable
                  busy={busy}
                  empty="Nothing yet. Create the first listing above."
                  columns={[
                    { key: 'type', label: 'Type', get: (l) => LISTING_TYPE_META[l.type].name, filter: true, render: (l) => <span>{LISTING_TYPE_META[l.type].emoji} {LISTING_TYPE_META[l.type].name}</span> },
                    { key: 'title', label: 'Title', get: (l) => l.title, wrap: true, render: (l) => <span className="font-bold">{l.title}</span> },
                    { key: 'by', label: 'By', get: (l) => l.by, filter: true, wide: true },
                    { key: 'facts', label: 'Facts', get: (l) => l.facts.join(', '), wide: true, wrap: true },
                    { key: 'live', label: 'Live', get: (l) => l.live, filter: true, edit: { kind: 'toggle', onEdit: (l, v) => run(async () => { await adminApi.setListing(key, l.type, l.id, { live: Boolean(v) }); await refreshListings(); }) } },
                    { key: 'featured', label: 'Featured', get: (l) => l.featured, filter: true, edit: { kind: 'toggle', disabled: (l) => l.type === 'tool' || l.type === 'campaign' || l.type === 'circle', onEdit: (l, v) => run(async () => { await adminApi.setListing(key, l.type, l.id, { featured: Boolean(v) }); await refreshListings(); }) } },
                    { key: 'created', label: 'Created', get: (l) => l.createdAt.slice(0, 10), render: (l) => day(l.createdAt), wide: true },
                  ]}
                  actions={(l) => (
                    <Link to={l.path} className="inline-flex min-h-[40px] items-center text-[14px] font-bold text-ink-soft underline-offset-4 hover:underline">
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
                      <input required value={String(form.title ?? '')} onChange={(e) => setForm({ ...form, title: e.target.value })} className={field} />
                    </Label>
                    {creating === 'reward' && (
                      <>
                        <Label text="Brand name">
                          <input value={String(form.brandName ?? '')} onChange={(e) => setForm({ ...form, brandName: e.target.value })} className={field} />
                        </Label>
                        <Label text="Brief">
                          <textarea rows={4} value={String(form.brief ?? '')} onChange={(e) => setForm({ ...form, brief: e.target.value })} className={field} />
                        </Label>
                        <div className="grid grid-cols-2 gap-xs">
                          <Label text="Deliverable">
                            <input value={String(form.deliverable ?? 'Short video')} onChange={(e) => setForm({ ...form, deliverable: e.target.value })} className={field} />
                          </Label>
                          <Label text="Platform (blank for any)">
                            <input value={String(form.platform ?? '')} onChange={(e) => setForm({ ...form, platform: e.target.value })} placeholder="instagram, youtube" className={field} />
                          </Label>
                          <Label text="Pool (points)">
                            <input type="number" min={0} value={String(form.budgetPoints ?? '')} onChange={(e) => setForm({ ...form, budgetPoints: e.target.value })} className={field} />
                          </Label>
                          <Label text="Points per 1k views">
                            <input type="number" min={0} value={String(form.ratePerThousand ?? '')} onChange={(e) => setForm({ ...form, ratePerThousand: e.target.value })} className={field} />
                          </Label>
                          <Label text="Cap per creator (0 = none)">
                            <input type="number" min={0} value={String(form.maxPayoutPoints ?? '')} onChange={(e) => setForm({ ...form, maxPayoutPoints: e.target.value })} className={field} />
                          </Label>
                          <Label text="Minimum views">
                            <input type="number" min={0} value={String(form.minViews ?? '1000')} onChange={(e) => setForm({ ...form, minViews: e.target.value })} className={field} />
                          </Label>
                        </div>
                        <Label text="Closes on">
                          <input type="datetime-local" value={String(form.endsAtLocal ?? '')} onChange={(e) => setForm({ ...form, endsAtLocal: e.target.value, endsAt: e.target.value ? new Date(e.target.value).toISOString() : '' })} className={field} />
                        </Label>
                        <Label text="Who can take part">
                          <input value={String(form.eligibility ?? '')} onChange={(e) => setForm({ ...form, eligibility: e.target.value })} className={field} />
                        </Label>
                      </>
                    )}
                    {creating === 'opportunity' && (
                      <>
                        <Label text="Description">
                          <textarea rows={4} value={String(form.description ?? '')} onChange={(e) => setForm({ ...form, description: e.target.value })} className={field} />
                        </Label>
                        <div className="grid grid-cols-2 gap-xs">
                          <Label text="Type">
                            <select value={String(form.opportunityType ?? 'gig')} onChange={(e) => setForm({ ...form, opportunityType: e.target.value })} className={field}>
                              {OPPORTUNITY_TYPES.map((t) => (
                                <option key={t} value={t}>
                                  {t.replace('_', ' ')}
                                </option>
                              ))}
                            </select>
                          </Label>
                          <Label text="Where">
                            <select value={String(form.locationMode ?? 'remote')} onChange={(e) => setForm({ ...form, locationMode: e.target.value })} className={field}>
                              <option value="remote">Remote</option>
                              <option value="on_site">On site</option>
                              <option value="hybrid">Hybrid</option>
                            </select>
                          </Label>
                          <Label text="Pay from">
                            <input type="number" min={0} value={String(form.compensationMin ?? '')} onChange={(e) => setForm({ ...form, compensationMin: e.target.value })} className={field} />
                          </Label>
                          <Label text="Pay to">
                            <input type="number" min={0} value={String(form.compensationMax ?? '')} onChange={(e) => setForm({ ...form, compensationMax: e.target.value })} className={field} />
                          </Label>
                        </div>
                        <Label text="Skills (comma separated)">
                          <input value={String(form.skillsRequired ?? '')} onChange={(e) => setForm({ ...form, skillsRequired: e.target.value })} className={field} />
                        </Label>
                        <Label text="Apply by">
                          <input type="date" value={String(form.deadline ?? '')} onChange={(e) => setForm({ ...form, deadline: e.target.value })} className={field} />
                        </Label>
                        <Label text="Place (if on site)">
                          <input value={String(form.locationText ?? '')} onChange={(e) => setForm({ ...form, locationText: e.target.value })} className={field} />
                        </Label>
                      </>
                    )}
                    {creating === 'event' && (
                      <>
                        <Label text="Description">
                          <textarea rows={3} value={String(form.description ?? '')} onChange={(e) => setForm({ ...form, description: e.target.value })} className={field} />
                        </Label>
                        <div className="grid grid-cols-2 gap-xs">
                          <Label text="Type">
                            <select value={String(form.eventType ?? 'meetup')} onChange={(e) => setForm({ ...form, eventType: e.target.value })} className={field}>
                              {EVENT_TYPES.map((t) => (
                                <option key={t} value={t}>
                                  {t}
                                </option>
                              ))}
                            </select>
                          </Label>
                          <Label text="Length (minutes)">
                            <input type="number" min={15} value={String(form.minutes ?? '120')} onChange={(e) => setForm({ ...form, minutes: e.target.value })} className={field} />
                          </Label>
                          <Label text="Seats (blank for unlimited)">
                            <input type="number" min={1} value={String(form.capacity ?? '')} onChange={(e) => setForm({ ...form, capacity: e.target.value })} className={field} />
                          </Label>
                          <Label text="Ticket (points)">
                            <input type="number" min={0} value={String(form.pricePoints ?? '0')} onChange={(e) => setForm({ ...form, pricePoints: e.target.value })} className={field} />
                          </Label>
                        </div>
                        <Label text="Starts">
                          <input type="datetime-local" required value={String(form.startsAtLocal ?? '')} onChange={(e) => setForm({ ...form, startsAtLocal: e.target.value, startsAt: e.target.value ? new Date(e.target.value).toISOString() : '' })} className={field} />
                        </Label>
                        <Label text="Venue">
                          <input value={String(form.venue ?? '')} onChange={(e) => setForm({ ...form, venue: e.target.value })} className={field} />
                        </Label>
                        <Label text="Online link">
                          <input value={String(form.onlineUrl ?? '')} onChange={(e) => setForm({ ...form, onlineUrl: e.target.value })} className={field} />
                        </Label>
                      </>
                    )}
                    {creating === 'program' && (
                      <>
                        <Label text="Description">
                          <textarea rows={3} value={String(form.description ?? '')} onChange={(e) => setForm({ ...form, description: e.target.value })} className={field} />
                        </Label>
                        <div className="grid grid-cols-2 gap-xs">
                          <Label text="Price (points)">
                            <input type="number" min={0} value={String(form.pricePoints ?? '0')} onChange={(e) => setForm({ ...form, pricePoints: e.target.value })} className={field} />
                          </Label>
                          <Label text="Delivery">
                            <select value={String(form.deliveryMode ?? 'online')} onChange={(e) => setForm({ ...form, deliveryMode: e.target.value })} className={field}>
                              <option value="online">Online</option>
                              <option value="in_person">In person</option>
                              <option value="hybrid">Hybrid</option>
                            </select>
                          </Label>
                        </div>
                        <Label text="Outcomes">
                          <textarea rows={2} value={String(form.outcomes ?? '')} onChange={(e) => setForm({ ...form, outcomes: e.target.value })} className={field} />
                        </Label>
                        <Label text="Prerequisites">
                          <input value={String(form.prerequisites ?? '')} onChange={(e) => setForm({ ...form, prerequisites: e.target.value })} className={field} />
                        </Label>
                      </>
                    )}
                    {creating === 'circle' && (
                      <>
                        <div className="grid grid-cols-2 gap-xs">
                          <Label text="City">
                            <input required value={String(form.city ?? '')} onChange={(e) => setForm({ ...form, city: e.target.value })} className={field} />
                          </Label>
                          <Label text="Area (optional)">
                            <input value={String(form.area ?? '')} onChange={(e) => setForm({ ...form, area: e.target.value })} className={field} />
                          </Label>
                          <Label text="Starts">
                            <input type="datetime-local" required value={String(form.startsAtLocal ?? '')} onChange={(e) => setForm({ ...form, startsAtLocal: e.target.value, startsAt: e.target.value ? new Date(e.target.value).toISOString() : '' })} className={field} />
                          </Label>
                          <Label text="People per table">
                            <input type="number" min={3} max={8} value={String(form.groupSize ?? '5')} onChange={(e) => setForm({ ...form, groupSize: e.target.value })} className={field} />
                          </Label>
                        </div>
                        <Label text="Venue hint">
                          <input value={String(form.venueHint ?? '')} onChange={(e) => setForm({ ...form, venueHint: e.target.value })} placeholder="A cafe near the metro; the table picks the exact one" className={field} />
                        </Label>
                        <Toggle on={form.repeat === 'weekly'} onChange={(on) => setForm({ ...form, repeat: on ? 'weekly' : 'none' })} label="Every week at this time. The next one opens on its own once tables are set." />
                      </>
                    )}
                    {creating === 'tool' && (
                      <>
                        <Label text="Link">
                          <input type="url" required value={String(form.url ?? '')} onChange={(e) => setForm({ ...form, url: e.target.value })} className={field} />
                        </Label>
                        <Label text="Category">
                          <select value={String(form.category ?? 'Editing')} onChange={(e) => setForm({ ...form, category: e.target.value })} className={field}>
                            {TOOL_CATEGORIES.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                        </Label>
                        <Label text="Description">
                          <input value={String(form.description ?? '')} onChange={(e) => setForm({ ...form, description: e.target.value })} className={field} />
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
              <h2 id="redemptions-heading" className="text-[24px]">
                Reserved rewards
              </h2>
              <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Points are held until you mark a reward fulfilled or cancel it, which gives the points back.</p>
              <div className="mt-sm">
                <DataTable<AdminRedemption>
                  rows={redemptions}
                  rowKey={(r) => r.id}
                  label="Reserved rewards"
                  selectable
                  busy={busy}
                  empty="Nothing waiting."
                  columns={[
                    { key: 'person', label: 'Person', get: (r) => r.userName, render: (r) => <span className="font-bold">{r.userName}</span> },
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
              <h2 id="orders-heading" className="text-[24px]">
                Orders
              </h2>
              <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Search the server by order id, provider id, buyer name or email, page name or product. Sort and filter the results below; tap a row for its timeline and a refund.</p>
              <form
                className="mt-sm flex flex-wrap gap-xs"
                onSubmit={(e) => {
                  e.preventDefault();
                  void searchOrders();
                }}
              >
                <input value={orderQ} onChange={(e) => setOrderQ(e.target.value)} placeholder="Order, payment, buyer, page" aria-label="Search orders on the server" className="min-w-0 flex-1 rounded-pill border-2 border-line bg-card px-md py-sm text-[16px]" />
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
                  rowKey={(o) => o.id}
                  label="Orders"
                  busy={busy}
                  activeKey={orderDetail?.order.id ?? null}
                  onRowClick={(o) => void openOrder(o.id)}
                  empty="No orders match."
                  columns={[
                    { key: 'product', label: 'Product', get: (o) => o.productTitle, wrap: true, render: (o) => <><span className="block font-bold">{o.productTitle}</span><span className="block text-[12px] font-bold text-ink-mute">#{o.id.slice(0, 8)}</span></> },
                    { key: 'buyer', label: 'Buyer', get: (o) => `${o.buyerName} ${o.buyerEmail ?? ''}`.trim(), render: (o) => <><span className="block">{o.buyerName}</span>{o.buyerEmail && <span className="block text-[12px] font-bold text-ink-soft">{o.buyerEmail}</span>}</> },
                    { key: 'from', label: 'From', get: (o) => (o.ownerHandle ? `@${o.ownerHandle}` : o.ownerName), filter: true, wide: true },
                    { key: 'amount', label: 'Amount', get: (o) => (o.points > 0 ? o.points : o.cents / 100), align: 'right', render: (o) => (o.points > 0 ? `${o.points} pts` : `${(o.cents / 100).toFixed(2)} ${o.currency}`) },
                    { key: 'provider', label: 'Provider', get: (o) => o.provider, filter: true, wide: true },
                    { key: 'status', label: 'Status', get: (o) => o.status, filter: true, render: (o) => <Pill tone={statusTone(o.status)}>{o.status}</Pill> },
                    { key: 'created', label: 'Created', get: (o) => o.createdAt, render: (o) => when(o.createdAt) },
                  ]}
                />
              </div>
              {orderDetail && (
                <div className="mt-md rounded-card bg-card p-md shadow-toy-soft">
                  <div className="flex items-start justify-between gap-sm">
                    <h3 className="text-[22px]">
                      {orderDetail.order.productTitle} <span className="text-[14px] font-bold text-ink-mute">#{orderDetail.order.id.slice(0, 8)}</span>
                    </h3>
                    <Button variant="ghost" size="sm" onClick={() => setOrderDetail(null)}>
                      Close
                    </Button>
                  </div>
                  <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">
                    <Pill tone={statusTone(orderDetail.order.status)}>{orderDetail.order.status}</Pill> {orderDetail.order.provider}
                    {orderDetail.order.providerOrderId ? `, ${orderDetail.order.providerOrderId}` : ''}
                    {orderDetail.order.paidAt ? `, paid ${new Date(orderDetail.order.paidAt).toLocaleString()}` : ''}
                  </p>
                  <p className="mt-md m-0 text-[14px] font-bold">Timeline</p>
                  {orderDetail.timeline.length === 0 && <p className="m-0 text-[14px] font-semibold text-ink-soft">Nothing logged for this order yet.</p>}
                  <ul className="mt-xs flex list-none flex-col gap-xs p-0 m-0">
                    {orderDetail.timeline.map((t) => (
                      <li key={t.id} className="rounded-tile bg-paper px-sm py-xs text-[12px] font-bold">
                        <span>{t.type}</span>
                        {t.data ? <span className="block break-words font-semibold text-ink-soft">{t.data}</span> : null}
                        <span className="block font-semibold text-ink-mute">{new Date(t.createdAt).toLocaleString()}</span>
                      </li>
                    ))}
                  </ul>
                  {orderDetail.webhooks.length > 0 && (
                    <>
                      <p className="mt-md m-0 text-[14px] font-bold">Provider webhooks</p>
                      <ul className="mt-xs flex list-none flex-col gap-xs p-0 m-0">
                        {orderDetail.webhooks.map((h) => (
                          <li key={h.id} className="rounded-tile bg-paper px-sm py-xs text-[12px] font-bold">
                            {h.type}
                            <span className="block font-semibold text-ink-soft">{h.processedAt ? `processed ${new Date(h.processedAt).toLocaleString()}` : 'not processed yet'}</span>
                            {h.error && <span className="block font-semibold text-r1">{h.error}</span>}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  {orderDetail.order.status !== 'refunded' && (
                    <div className="mt-md">
                      <Label text="Refund reason">
                        <input value={refundReason} onChange={(e) => setRefundReason(e.target.value)} className={field} />
                      </Label>
                      {refundError && (
                        <p role="alert" className="mt-xs m-0 rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
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
                <h2 id="hooks-heading" className="text-[24px]">
                  Webhooks
                </h2>
                <Button variant="outline" size="sm" disabled={busy} onClick={() => loadHooks()}>
                  Refresh
                </Button>
              </div>
              <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Every signed event from Meta and the payment provider, stored before it is processed. Replay runs one again.</p>
              <div className="mt-sm">
                <DataTable<WebhookEvent>
                  rows={hooks ?? []}
                  rowKey={(h) => h.id}
                  label="Webhooks"
                  busy={busy}
                  empty="Nothing has come in yet."
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
                      {replayOutcome[h.id] && <span className="text-[12px] font-bold text-ink-soft">{replayOutcome[h.id]}</span>}
                    </>
                  )}
                />
              </div>
            </section>
          )}

          {tab === 'kyc' && (
            <section className="mt-md" aria-labelledby="kyc-heading">
              <h2 id="kyc-heading" className="text-[24px]">
                Payout details
              </h2>
              <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Only the last digits are stored here. Approve once the bank account and PAN match the legal name. Type a note in the row before deciding, if the person should hear why.</p>
              <div className="mt-sm flex flex-wrap gap-xs" role="group" aria-label="Status">
                {(['pending', 'approved', 'rejected'] as const).map((s) => (
                  <button key={s} type="button" aria-pressed={kycStatus === s} onClick={() => { setKycStatus(s); void loadKyc(s); }} className={`toy min-h-[40px] rounded-pill border-2 px-sm text-[14px] font-bold ${kycStatus === s ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}>
                    {s}
                  </button>
                ))}
              </div>
              <div className="mt-sm">
                <DataTable<AdminKyc>
                  rows={kycList ?? []}
                  rowKey={(k) => k.userId}
                  label="Payout details"
                  busy={busy}
                  empty={`Nothing ${kycStatus} right now.`}
                  columns={[
                    { key: 'person', label: 'Person', get: (k) => `${k.userName} ${k.email ?? ''}`.trim(), render: (k) => <><span className="block font-bold">{k.userName}</span><span className="block text-[12px] font-bold text-ink-soft">{k.email ?? 'no email'}</span></> },
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
                <h2 id="ops-heading" className="text-[24px]">
                  Funnels
                </h2>
                <Button variant="outline" size="sm" disabled={busy} onClick={() => loadOps()}>
                  Refresh
                </Button>
              </div>
              <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Counted from our own tables, nothing leaves the server. Each bar is the share of the step before it.</p>
              <ul className="mt-sm grid list-none grid-cols-1 gap-xs p-0 m-0 md:grid-cols-2">
                {funnels?.map((f) => {
                  const top = Math.max(1, f.steps[0]?.count ?? 0);
                  return (
                    <li key={f.name} className="rounded-tile bg-card p-sm shadow-toy-soft">
                      <p className="m-0 text-[16px] font-bold">{f.name}</p>
                      <ol className="mt-xs m-0 flex list-none flex-col gap-xs p-0">
                        {f.steps.map((s, i) => {
                          const prev = i > 0 ? (f.steps[i - 1]?.count ?? 0) : null;
                          const drop = prev ? Math.round(100 - (s.count / Math.max(1, prev)) * 100) : null;
                          return (
                            <li key={s.label} className="text-[12px] font-bold">
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

              <h2 className="mt-lg text-[24px]">Email outbox</h2>
              <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Every message the app wanted to send. Skipped means no RESEND_API_KEY is set on the server, so nothing went out.</p>
              <div className="mt-sm">
                <DataTable<OutboxEmail>
                  rows={outbox ?? []}
                  rowKey={(m) => m.id}
                  label="Email outbox"
                  busy={busy}
                  empty="Nothing queued yet."
                  columns={[
                    { key: 'to', label: 'To', get: (m) => m.to },
                    { key: 'subject', label: 'Subject', get: (m) => m.subject, wrap: true, render: (m) => <span className="font-bold">{m.subject}</span> },
                    { key: 'status', label: 'Status', get: (m) => m.status, filter: true, render: (m) => <Pill tone={m.status === 'sent' ? 'bg-r4 text-on-fill' : m.status === 'failed' ? 'bg-r1 text-white' : 'bg-paper text-ink-soft'}>{m.status}</Pill> },
                    { key: 'created', label: 'Created', get: (m) => m.createdAt, render: (m) => when(m.createdAt) },
                    { key: 'error', label: 'Error', get: (m) => m.error, wide: true, wrap: true },
                  ]}
                />
              </div>
            </section>
          )}

          {tab === 'audit' && (
            <section className="mt-md" aria-labelledby="audit-heading">
              <div className="flex items-center justify-between gap-sm">
                <h2 id="audit-heading" className="text-[24px]">
                  Audit log
                </h2>
                <Button variant="outline" size="sm" disabled={busy} onClick={() => run(refreshAudit)}>
                  Refresh
                </Button>
              </div>
              <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Who changed what, with the before and after. The last two hundred entries.</p>
              <div className="mt-sm">
                <DataTable<AuditLog>
                  rows={logs}
                  rowKey={(l) => l.id}
                  label="Audit log"
                  busy={busy}
                  pageSize={50}
                  columns={[
                    { key: 'when', label: 'When', get: (l) => l.createdAt, render: (l) => when(l.createdAt) },
                    { key: 'actor', label: 'Actor', get: (l) => l.actorName, filter: true },
                    { key: 'action', label: 'Action', get: (l) => l.action, filter: true, render: (l) => <span className="font-bold">{l.action}</span> },
                    { key: 'resource', label: 'Resource', get: (l) => `${l.resourceType} ${l.resourceId?.slice(0, 8) ?? ''}`.trim(), filter: false },
                    { key: 'before', label: 'Before', get: (l) => l.before, wide: true, wrap: true },
                    { key: 'after', label: 'After', get: (l) => l.after, wrap: true },
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
