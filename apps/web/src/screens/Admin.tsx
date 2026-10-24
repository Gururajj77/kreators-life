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
  type AdminRedemption,
  type AdminUser,
  type AuditLog,
  type FlagOverride,
  type Listing,
  type ListingType,
  type ModuleAccess,
  type ModuleGroup,
  type ModuleSetting,
  type Permission,
  type Role,
} from '@kreators/shared';
import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { Sheet } from '../components/Sheet';
import { Toggle } from '../components/Toggle';
import { adminApi } from '../lib/api';
import { useMe } from '../lib/queries';

const ADMIN_HONORS = HONORS.filter((h) => h.source === 'admin' && h.key !== 'pro');
const KEY_STORE = 'kreators.adminKey';
const PERMISSION_NAMES: Record<Permission, string> = { talent: 'Talent', cohorts: 'Cohorts', events: 'Events', finance: 'Finance', moderation: 'Moderation', support: 'Support', review: 'Review', mentor: 'Mentor' };
type Tab = 'people' | 'flags' | 'listings' | 'redemptions' | 'audit';

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
  const [listingType, setListingType] = useState<ListingType | ''>('');
  const [creating, setCreating] = useState<ListingType | null>(null);
  const [form, setForm] = useState<Record<string, string | boolean>>({});
  // redemptions, audit
  const [redemptions, setRedemptions] = useState<AdminRedemption[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);

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
      const [u, r, f, l, a] = await Promise.all([adminApi.users(key, q), adminApi.redemptions(key, 'reserved'), adminApi.flags(key), adminApi.listings(key, listingType || undefined), adminApi.audit(key)]);
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
    setSelected(u);
    setUsers((list) => list.map((x) => (x.id === u.id ? u : x)));
  };
  const refreshFlags = async () => {
    const f = await adminApi.flags(key);
    setSettings(f.settings);
    setOverrides(f.overrides);
  };
  const refreshListings = async (type = listingType) => {
    const l = await adminApi.listings(key, type || undefined);
    setListings(l.listings);
  };
  const refreshAudit = async () => setLogs((await adminApi.audit(key)).logs);

  const tabs: [Tab, string][] = [
    ['people', 'People'],
    ['flags', 'Flags'],
    ['listings', 'Listings'],
    ['redemptions', `Redemptions${redemptions.length ? ` (${redemptions.length})` : ''}`],
    ['audit', 'Audit'],
  ];

  return (
    <Screen tabs={false}>
      <header className="pt-lg">
        <Link to="/apps" className="inline-flex min-h-[44px] items-center gap-xs font-bold text-ink-soft">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 5l-7 7 7 7" />
          </svg>
          Apps
        </Link>
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
          <nav className="mt-md flex gap-xs overflow-x-auto pb-xs scrollbar-none" aria-label="Admin sections">
            {tabs.map(([k, label]) => (
              <button key={k} type="button" aria-pressed={tab === k} onClick={() => setTab(k)} className={`toy shrink-0 rounded-pill border-2 px-sm py-xs text-[14px] font-bold ${tab === k ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}>
                {label}
              </button>
            ))}
          </nav>

          {tab === 'people' && (
            <section className="mt-md" aria-labelledby="people-heading">
              <h2 id="people-heading" className="text-[24px]">
                People
              </h2>
              <form
                className="mt-sm flex gap-xs"
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(async () => setUsers((await adminApi.users(key, q)).users));
                }}
              >
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, email, page or id" aria-label="Search people" className="min-w-0 flex-1 rounded-pill border-2 border-line bg-card px-md py-sm text-[16px]" />
                <Button type="submit" variant="outline" disabled={busy}>
                  Search
                </Button>
              </form>
              <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
                {users.map((u) => (
                  <li key={u.id}>
                    <button type="button" onClick={() => setSelected(u)} aria-pressed={selected?.id === u.id} className={`toy toy-soft flex w-full items-center gap-sm rounded-tile bg-card p-sm text-left ${selected?.id === u.id ? 'outline outline-2 outline-ink' : ''}`}>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[16px] font-bold">
                          {u.displayName || 'Anonymous climber'}
                          {u.handle ? <span className="font-semibold text-ink-soft"> @{u.handle}</span> : ''}
                        </span>
                        <span className="block text-[14px] font-semibold text-ink-soft">
                          {ROLE_META[u.role].name}
                          {u.permissions.length ? `, ${u.permissions.map((p) => PERMISSION_NAMES[p]).join(', ')}` : ''}, {u.xp} xp, {u.points} pts{u.isPro ? ', Pro' : ''}
                          {u.email ? `, ${u.email}` : ''}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>

              {selected && (
                <div className="mt-md rounded-card bg-card p-md shadow-toy-soft">
                  <h3 className="text-[22px]">{selected.displayName || 'Anonymous climber'}</h3>
                  <p className="mt-xs m-0 text-[12px] font-bold text-ink-mute">{selected.id}</p>

                  <p className="mt-md m-0 text-[14px] font-bold">Role</p>
                  <div className="mt-xs flex flex-wrap gap-xs" role="group" aria-label="Role">
                    {ROLES.map((r) => (
                      <button key={r} type="button" aria-pressed={selected.role === r} disabled={busy} onClick={() => run(async () => applyUser((await adminApi.setRole(key, selected.id, r as Role)).user))} className={`toy rounded-pill border-2 px-sm py-xs text-[14px] font-bold ${selected.role === r ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}>
                        {ROLE_META[r as Role].name}
                      </button>
                    ))}
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

                  <div className="mt-md">
                    <Toggle on={selected.isPro} onChange={(on) => run(async () => applyUser((await adminApi.setPro(key, selected.id, on)).user))} label="Pro" hint="Grants the Pro honor and badge." disabled={busy} />
                  </div>

                  <p className="mt-md m-0 text-[14px] font-bold">Honors</p>
                  <div className="mt-xs flex flex-wrap gap-xs">
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
                    <ul className="mt-xs grid list-none grid-cols-2 gap-xs p-0 m-0">
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
              <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Off hides a module for everyone. Rollout shows it to a steady percentage of people. Overrides force it on or off for one person, one role or one brand, and can expire.</p>
              {(['core', 'earn', 'community', 'wellbeing', 'creator', 'manage'] as ModuleGroup[]).map((g) => {
                const list = settings.filter((s) => MODULE_BY_KEY[s.key]?.group === g);
                if (!list.length) return null;
                return (
                  <div key={g} className="mt-md">
                    <h3 className="text-[18px]">{MODULE_GROUPS[g]}</h3>
                    <ul className="mt-xs flex list-none flex-col gap-xs p-0 m-0">
                      {list.map((s) => {
                        const m = MODULE_BY_KEY[s.key];
                        const ovs = overrides.filter((o) => o.flagKey === s.key);
                        return (
                          <li key={s.key} className="rounded-tile bg-card p-sm shadow-toy-soft">
                            <Toggle on={s.enabled} onChange={(on) => run(async () => { await adminApi.setModuleSetting(key, s.key, { enabled: on }); await refreshFlags(); })} label={`${m?.emoji ?? ''} ${m?.name ?? s.key}`} hint={m?.blurb} disabled={busy} />
                            <div className="mt-xs grid grid-cols-2 gap-xs">
                              <label className="block">
                                <span className="block text-[12px] font-bold text-ink-soft">Minimum role</span>
                                <select value={s.minRole} disabled={busy} onChange={(e) => run(async () => { await adminApi.setModuleSetting(key, s.key, { minRole: e.target.value as Role }); await refreshFlags(); })} className="mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-xs text-[14px] font-bold">
                                  {ROLES.map((r) => (
                                    <option key={r} value={r}>
                                      {ROLE_META[r as Role].name}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="block">
                                <span className="block text-[12px] font-bold text-ink-soft">Rollout {s.rollout}%</span>
                                <input type="range" min={0} max={100} step={5} value={s.rollout} disabled={busy} onChange={(e) => setSettings((all) => all.map((x) => (x.key === s.key ? { ...x, rollout: Number(e.target.value) } : x)))} onMouseUp={() => run(async () => { await adminApi.setModuleSetting(key, s.key, { rollout: s.rollout }); await refreshFlags(); })} onTouchEnd={() => run(async () => { await adminApi.setModuleSetting(key, s.key, { rollout: s.rollout }); await refreshFlags(); })} className="mt-xs w-full accent-ink" />
                              </label>
                            </div>
                            {ovs.length > 0 && (
                              <ul className="mt-xs flex list-none flex-col gap-xs p-0 m-0">
                                {ovs.map((o) => (
                                  <li key={o.id} className="flex items-center gap-xs rounded-tile bg-paper px-sm py-xs text-[12px] font-bold">
                                    <span className="min-w-0 flex-1">
                                      {o.enabled ? 'On' : 'Off'} for {o.subjectType} {o.subjectId}
                                      {o.expiresAt ? `, until ${new Date(o.expiresAt).toLocaleDateString()}` : ''}
                                      {o.reason ? `: ${o.reason}` : ''}
                                    </span>
                                    <button type="button" disabled={busy} onClick={() => run(async () => { await adminApi.removeOverride(key, o.id); await refreshFlags(); })} className="toy toy-soft min-h-[32px] rounded-pill bg-card px-xs" aria-label="Remove override">
                                      ×
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            )}
                            <Button variant="ghost" className="mt-xs" onClick={() => { setOverrideFor(s.key); setOvSubjectId(''); setOvReason(''); setOvDays(''); }}>
                              Add an override
                            </Button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
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
              <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">What the public site shows on Explore and on each feature page. Create here, then publish or feature. Brands make their own campaigns public from Army.</p>
              <div className="mt-sm flex flex-wrap gap-xs" role="group" aria-label="Type">
                <button type="button" aria-pressed={!listingType} onClick={() => { setListingType(''); void run(() => refreshListings('')); }} className={`toy min-h-[40px] rounded-pill border-2 px-sm text-[14px] font-bold ${!listingType ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}>
                  All
                </button>
                {LISTING_TYPES.map((t) => (
                  <button key={t} type="button" aria-pressed={listingType === t} onClick={() => { setListingType(t); void run(() => refreshListings(t)); }} className={`toy min-h-[40px] rounded-pill border-2 px-sm text-[14px] font-bold ${listingType === t ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}>
                    {LISTING_TYPE_META[t].emoji} {LISTING_TYPE_META[t].plural}
                  </button>
                ))}
              </div>
              <div className="mt-sm flex flex-wrap gap-xs">
                {LISTING_TYPES.filter((t) => t !== 'campaign').map((t) => (
                  <Button key={t} variant="outline" onClick={() => { setCreating(t); setForm({}); }}>
                    New {LISTING_TYPE_META[t].name.toLowerCase()}
                  </Button>
                ))}
              </div>
              <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
                {listings.length === 0 && <li className="text-[14px] font-semibold text-ink-soft">Nothing yet. Create the first listing above.</li>}
                {listings.map((l) => (
                  <li key={`${l.type}-${l.id}`} className="rounded-tile bg-card p-sm shadow-toy-soft">
                    <p className="m-0 text-[12px] font-extrabold uppercase tracking-wide text-ink-mute">
                      {LISTING_TYPE_META[l.type].name}
                      {l.featured && <span className="ml-xs rounded-pill bg-r3 px-xs text-[11px] leading-[18px] text-ink-fixed">Featured</span>}
                      <span className={`ml-xs rounded-pill px-xs text-[11px] leading-[18px] ${l.live ? 'bg-r4 text-ink-fixed' : 'bg-line text-ink'}`}>{l.live ? 'Live' : 'Hidden'}</span>
                    </p>
                    <p className="m-0 text-[16px] font-bold">{l.title}</p>
                    <p className="m-0 text-[14px] font-semibold text-ink-soft">
                      {l.by}
                      {l.facts.length ? `, ${l.facts.join(', ')}` : ''}
                    </p>
                    <div className="mt-xs flex flex-wrap gap-xs">
                      <Button variant="outline" disabled={busy} onClick={() => run(async () => { await adminApi.setListing(key, l.type, l.id, { live: !l.live }); await refreshListings(); })}>
                        {l.live ? 'Hide' : 'Publish'}
                      </Button>
                      {l.type !== 'tool' && l.type !== 'campaign' && l.type !== 'circle' && (
                        <Button variant="ghost" disabled={busy} onClick={() => run(async () => { await adminApi.setListing(key, l.type, l.id, { featured: !l.featured }); await refreshListings(); })}>
                          {l.featured ? 'Unfeature' : 'Feature'}
                        </Button>
                      )}
                      <Link to={l.path} className="inline-flex min-h-[48px] items-center text-[14px] font-bold text-ink-soft underline-offset-4 hover:underline">
                        Open in app
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
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
              {redemptions.length === 0 && <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Nothing waiting.</p>}
              <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
                {redemptions.map((r) => (
                  <li key={r.id} className="rounded-tile bg-card p-sm shadow-toy-soft">
                    <p className="m-0 text-[16px] font-bold">
                      {r.userName}: {REWARD_BY_KEY[r.rewardKey]?.name ?? r.rewardKey}
                    </p>
                    <p className="m-0 text-[14px] font-semibold text-ink-soft">
                      {r.points} points, {new Date(r.createdAt).toLocaleDateString()}
                    </p>
                    <div className="mt-xs flex gap-xs">
                      <Button disabled={busy} onClick={() => run(async () => { await adminApi.setRedemption(key, r.id, 'fulfilled'); setRedemptions((all) => all.filter((x) => x.id !== r.id)); })}>
                        Fulfilled
                      </Button>
                      <Button variant="outline" disabled={busy} onClick={() => run(async () => { await adminApi.setRedemption(key, r.id, 'cancelled'); setRedemptions((all) => all.filter((x) => x.id !== r.id)); })}>
                        Cancel and refund
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {tab === 'audit' && (
            <section className="mt-md" aria-labelledby="audit-heading">
              <div className="flex items-center justify-between gap-sm">
                <h2 id="audit-heading" className="text-[24px]">
                  Audit log
                </h2>
                <Button variant="outline" disabled={busy} onClick={() => run(refreshAudit)}>
                  Refresh
                </Button>
              </div>
              <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Who changed what, with the before and after. The last two hundred entries.</p>
              <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
                {logs.map((l) => (
                  <li key={l.id} className="rounded-tile bg-card p-sm shadow-toy-soft">
                    <p className="m-0 text-[14px] font-bold">
                      {l.actorName} <span className="text-ink-soft">{l.action}</span> {l.resourceType}
                      {l.resourceId ? <span className="text-ink-mute"> {l.resourceId.slice(0, 8)}</span> : ''}
                    </p>
                    <p className="m-0 break-words text-[12px] font-semibold text-ink-soft">
                      {l.before ? `${l.before} → ` : ''}
                      {l.after}
                    </p>
                    <p className="m-0 text-[12px] font-semibold text-ink-mute">{new Date(l.createdAt).toLocaleString()}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </Screen>
  );
}
