import { MODULE_GROUP_ACCENT, MODULE_GROUPS, MODULE_BY_KEY, RELATIONSHIP_BY_KEY, ROLE_META, ROLES, type ObservedUser, type Role } from '@kreators/shared';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '../components/Button';
import { HBars, StatTile } from '../components/Charts';
import { PageHeader } from '../components/PageHeader';
import { RoleBadge } from '../components/RoleBadge';
import { Screen } from '../components/Screen';
import { Section } from '../components/Section';
import { Sheet } from '../components/Sheet';
import { api } from '../lib/api';
import { useAuthed, useMe } from '../lib/queries';
import buildMap from '../../../../docs/build-map.html?raw';

const field = 'w-full rounded-tile border-2 border-line bg-card px-sm py-sm text-[16px] font-semibold';
const since = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * Internal observability, for the team: who is here, which apps they have on, who holds which role,
 * and the build map, so the whole picture lives on one screen. Numbers first, then the people, then the map.
 * Staff can look; only an admin changes a role. Journal and wellbeing never appear here.
 */
export function Observability() {
  const me = useMe();
  const isAdmin = me.data?.user.role === 'admin';
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [offset, setOffset] = useState(0);
  const [asking, setAsking] = useState<{ user: ObservedUser; role: Role } | null>(null);
  useEffect(() => {
    const t = window.setTimeout(() => {
      setQuery(q.trim());
      setOffset(0);
    }, 250);
    return () => window.clearTimeout(t);
  }, [q]);
  const d = useAuthed(['observability', query, offset], () => api.observability(query, offset));
  const setRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: Role }) => api.setRole(id, role),
    onSuccess: async () => {
      await d.refetch();
      setAsking(null);
    },
  });
  // The build map opens in its own tab from the same text, so there is one copy of the truth.
  const mapUrl = useMemo(() => URL.createObjectURL(new Blob([buildMap], { type: 'text/html' })), []);
  useEffect(() => () => URL.revokeObjectURL(mapUrl), [mapUrl]);
  const data = d.data;
  const appRows = data
    ? [...data.apps]
        .sort((a, b) => b.on - a.on)
        .map((a) => {
          const rel = RELATIONSHIP_BY_KEY[MODULE_GROUP_ACCENT[a.group]];
          return {
            key: a.key,
            label: `${a.emoji} ${a.name}`,
            value: data.totals.users ? a.on / data.totals.users : 0,
            text: `${a.on} ${a.on === 1 ? 'person' : 'people'}`,
            color: rel.color,
          };
        })
    : [];

  return (
    <Screen>
      <PageHeader back={{ to: '/apps', label: 'Apps' }} eyebrow={MODULE_GROUPS.internal} title="Observability" lede="Who is here, which apps they have on, and who holds which role. Only the team sees this. Journals and wellbeing never appear." />

      {d.isPending && (
        <p className="mt-md m-0 text-[14px] font-bold text-ink-soft" role="status">
          Counting people
        </p>
      )}
      {d.isError && (
        <p role="alert" className="mt-md m-0 rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
          Could not load this. Try again.
        </p>
      )}

      {data && (
        <>
          <Section id="obs-numbers" title="People in numbers" lede="Every account that is not deleted.">
            <div className="grid grid-cols-2 gap-xs md:grid-cols-4">
              <StatTile label="People" value={data.totals.users} hint={`${data.totals.newThisWeek} new this week`} />
              <StatTile label="Set up" value={data.totals.onboarded} hint="finished the vibe check" />
              <StatTile label="Staff" value={data.totals.staff} hint={ROLE_META.sub_admin.blurb} />
              <StatTile label="Admins" value={data.totals.admins} hint={ROLE_META.admin.blurb} />
            </div>
          </Section>

          <Section id="obs-apps" title="People per app" lede="How many have each app on. Essentials are always on, so they sit at the top.">
            <div className="rounded-card bg-card p-md shadow-toy-soft">
              <HBars rows={appRows} label="People per app" />
            </div>
          </Section>

          <Section id="obs-people" title="People" lede={`${data.total} ${data.total === 1 ? 'account' : 'accounts'}, newest first, with the apps each one has on.${isAdmin ? ' Change a role from the menu on a row.' : ' Only an admin changes roles.'}`}>
            <label className="block">
              <span className="sr-only">Search people by name or page name</span>
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or page name" autoComplete="off" className={field} />
            </label>
            <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
              {data.users.map((u) => (
                <li key={u.id} className="rounded-tile bg-card p-sm shadow-toy-soft">
                  <div className="flex items-center gap-sm">
                    <span className="relative shrink-0">
                      <span className="flex size-[48px] items-center justify-center rounded-pill bg-paper text-[18px] font-extrabold" aria-hidden="true">
                        {u.name.trim().charAt(0).toUpperCase() || '?'}
                      </span>
                      <RoleBadge role={u.role} size={20} className="absolute right-0 bottom-0" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[16px] font-bold">{u.name}</span>
                      <span className="block text-[12px] font-bold text-ink-soft">
                        {u.handle ? `/u/${u.handle} · ` : ''}
                        since {since(u.createdAt)}
                        {u.onboarded ? '' : ' · not set up yet'}
                      </span>
                    </span>
                    {isAdmin && u.id !== me.data?.user.id ? (
                      <label className="shrink-0">
                        <span className="sr-only">Role for {u.name}</span>
                        <select value={u.role} onChange={(e) => setAsking({ user: u, role: e.target.value as Role })} className="min-h-[40px] rounded-pill border-2 border-line bg-card px-sm text-[14px] font-bold">
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {ROLE_META[r].name}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      <span className="shrink-0 rounded-pill bg-paper px-sm text-[12px] font-extrabold leading-[28px] text-ink-soft">{ROLE_META[u.role].name}</span>
                    )}
                  </div>
                  <p className="mt-xs m-0 flex flex-wrap items-center gap-xs text-[12px] font-bold text-ink-soft">
                    <span className="shrink-0">
                      {u.apps.length} {u.apps.length === 1 ? 'app' : 'apps'} on:
                    </span>
                    {u.apps.map((k) => {
                      const m = MODULE_BY_KEY[k];
                      if (!m) return null;
                      return (
                        <span key={k} className="inline-flex min-h-[24px] items-center gap-xs rounded-pill bg-paper px-xs" style={{ color: `var(--deep-${MODULE_GROUP_ACCENT[m.group]})` }}>
                          <span aria-hidden="true">{m.emoji}</span>
                          {m.name}
                        </span>
                      );
                    })}
                  </p>
                </li>
              ))}
            </ul>
            {data.users.length === 0 && <p className="mt-sm m-0 text-[14px] font-semibold text-ink-soft">Nobody matches "{query}".</p>}
            {(offset > 0 || offset + data.limit < data.total) && (
              <div className="mt-sm flex items-center justify-between gap-xs">
                <Button variant="outline" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - data.limit))}>
                  Newer
                </Button>
                <span className="text-[12px] font-bold text-ink-soft">
                  {offset + 1} to {Math.min(data.total, offset + data.limit)} of {data.total}
                </span>
                <Button variant="outline" disabled={offset + data.limit >= data.total} onClick={() => setOffset(offset + data.limit)}>
                  Older
                </Button>
              </div>
            )}
          </Section>

          <Section
            id="obs-map"
            title="Build map"
            lede="The living map of what is built, from docs/build-map.html. The same file, so it is tracked here."
            action={
              <a href={mapUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-[44px] items-center text-[14px] font-bold text-ink-mute underline-offset-4 hover:text-ink hover:underline">
                Open in a new tab
              </a>
            }
          >
            <iframe srcDoc={buildMap} title="Build map" sandbox="allow-scripts allow-same-origin" className="w-full rounded-card border-2 border-line bg-card" style={{ height: '75vh' }} />
          </Section>
        </>
      )}

      <Sheet open={Boolean(asking)} onClose={() => setAsking(null)} title={asking ? `Make ${asking.user.name} ${ROLE_META[asking.role].name === 'Admin' ? 'an' : 'a'} ${ROLE_META[asking.role].name.toLowerCase()}?` : 'Change role'}>
        {asking && (
          <div>
            <div className="flex items-center gap-sm">
              <RoleBadge role={asking.role} size={40} />
              <div className="min-w-0">
                <p className="m-0 text-[16px] font-bold">{ROLE_META[asking.role].name}</p>
                <p className="m-0 text-[14px] font-semibold text-ink-soft">{ROLE_META[asking.role].blurb}</p>
              </div>
            </div>
            <p className="mt-md m-0 text-[14px] font-semibold text-ink-soft">
              {asking.user.name} is {ROLE_META[asking.user.role].name === 'Admin' ? 'an' : 'a'} {ROLE_META[asking.user.role].name.toLowerCase()} now. The change is written to the audit log with your name on it.
            </p>
            {setRole.isError && (
              <p role="alert" className="mt-sm m-0 rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
                {setRole.error instanceof Error ? setRole.error.message : 'Could not change the role.'}
              </p>
            )}
            <div className="mt-md flex gap-xs">
              <Button size="lg" className="flex-1" disabled={setRole.isPending} onClick={() => setRole.mutate({ id: asking.user.id, role: asking.role })}>
                {setRole.isPending ? 'Changing' : `Make ${ROLE_META[asking.role].name.toLowerCase()}`}
              </Button>
              <Button variant="outline" size="lg" onClick={() => setAsking(null)} disabled={setRole.isPending}>
                Not now
              </Button>
            </div>
          </div>
        )}
      </Sheet>
    </Screen>
  );
}
