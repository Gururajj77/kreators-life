import { MODULE_GROUP_ACCENT, MODULE_GROUPS, MODULE_BY_KEY, RELATIONSHIP_BY_KEY, ROLE_META, ROLES, type ObservedUser, type Role } from '@kreators/shared';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Button } from '../components/Button';
import { HBars, StatTile } from '../components/Charts';
import { PageHeader } from '../components/PageHeader';
import { RoleBadge } from '../components/RoleBadge';
import { Screen } from '../components/Screen';
import { Section } from '../components/Section';
import { Sheet } from '../components/Sheet';
import { api } from '../lib/api';
import { useAuthed, useMe } from '../lib/queries';
import { Pager, usePage } from '../components/Pager';
import { BuildMap } from '../components/BuildMap';

const field = 'w-full rounded-tile border-2 border-line bg-card px-sm py-sm text-[16px] font-semibold';
const since = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * Internal observability, for the team: who is here, which apps they have on, who holds which role,
 * and numbers for the newer apps, and the build map shown as data in the page (it reads lib/buildMap.ts, no longer a page in another tab),
 * so the whole picture lives on one screen. Numbers first, then the people, then the map. The log of what is happening lives on its own
 * page, Logs, for super admins.
 * Staff can look; only an admin changes a role. Journal and wellbeing never appear here.
 */
export function Observability() {
  const me = useMe();
  const isAdmin = me.data?.user.role === 'admin';
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const pg = usePage();
  const [asking, setAsking] = useState<{ user: ObservedUser; role: Role } | null>(null);
  useEffect(() => {
    const t = window.setTimeout(() => {
      setQuery(q.trim());
      pg.reset();
    }, 250);
    return () => window.clearTimeout(t);
  }, [q]);
  const d = useAuthed(['observability', query, pg.query], () => api.observability(query, pg.query));
  const setRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: Role }) => api.setRole(id, role),
    onSuccess: async () => {
      await d.refetch();
      setAsking(null);
    },
  });
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
      <PageHeader back={{ to: '/apps', label: 'Apps' }} eyebrow={MODULE_GROUPS.manage} aside={isAdmin ? <Link to="/internal/logs" className="toy toy-soft inline-flex min-h-[44px] items-center rounded-pill border border-line bg-card-strong px-md text-[14px] font-bold">Logs</Link> : undefined} title="Observability" lede="Who is here, which apps they have on, and who holds which role. Only the team sees this. Journals and wellbeing never appear." />

      {d.isPending && (
        <p className="mt-md m-0 text-[14px] font-bold text-ink-soft" role="status">
          Counting people
        </p>
      )}
      {d.isError && (
        <p role="alert" className="mt-md m-0 rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
          Could not load this. Refresh the page to try again.
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

          <Section id="obs-games" title="Games" lede="How many people unlocked each game. Counts only, never who played what.">
            <div className="rounded-card bg-card p-md shadow-toy-soft">
              <HBars
                rows={data.additions.games.map((g) => ({ key: g.key, label: `${g.emoji} ${g.name}`, value: data.totals.users ? g.unlocked / data.totals.users : 0, text: `${g.unlocked} ${g.unlocked === 1 ? 'person' : 'people'}`, color: RELATIONSHIP_BY_KEY.friendship.color }))}
                label="People per game"
              />
            </div>
          </Section>

          <Section id="obs-discover" title="Discover" lede="Quizzes taken and what people allowed. Counts only: no answers, no results, no names.">
            <div className="grid grid-cols-2 gap-xs md:grid-cols-5">
              <StatTile label="Quizzes" value={data.additions.discover.results} hint={`${data.additions.discover.people} ${data.additions.discover.people === 1 ? 'person' : 'people'}`} />
              <StatTile label="With EQ" value={data.additions.discover.withEq} hint="emotional intelligence added" />
              <StatTile label="Assistant on" value={data.additions.discover.assistantOn} hint="allowed a short summary" />
              <StatTile label="Steps off" value={data.additions.discover.stepsOff} hint="switched next steps off" />
              <StatTile label="Given by hand" value={data.additions.grants.xp + data.additions.grants.badges + data.additions.grants.points + data.additions.grants.honors} hint={`last 30 days: ${data.additions.grants.xp} xp, ${data.additions.grants.points} points, ${data.additions.grants.badges} badges, ${data.additions.grants.honors} honors`} />
            </div>
          </Section>

          <Section id="obs-log" title="The log, last 24 hours" lede="Changes people made, requests that were refused and errors, from the app's own log.">
            <div className="grid grid-cols-3 gap-xs">
              <StatTile label="Errors" value={data.additions.logs.errors} hint="server and browser" />
              <StatTile label="Refused" value={data.additions.logs.warnings} hint="400s and rate limits" />
              <StatTile label="Changes" value={data.additions.logs.changes} hint="things people changed" />
            </div>
            {isAdmin ? (
              <Link to="/internal/logs" className="toy mt-sm inline-flex min-h-[48px] items-center justify-center rounded-pill bg-ink px-md text-[16px] font-bold text-on-ink">
                Open the logs
              </Link>
            ) : (
              <p className="mt-sm m-0 text-[14px] font-semibold text-ink-soft">The lines themselves name people, so only a super admin reads them.</p>
            )}
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
            <Pager page={data.page} label="accounts" />
          </Section>
        </>
      )}

      <BuildMap />

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
                {setRole.error instanceof Error ? setRole.error.message : 'Could not change the role. Try again.'}
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
