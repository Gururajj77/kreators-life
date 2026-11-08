import { formatCount, MODULE_GROUP_ACCENT, MODULE_GROUPS, MODULE_BY_KEY, RELATIONSHIP_BY_KEY, ROLE_META, ROLES, type ObservedUser, type Role } from '@kreators/shared';
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
import { evenGrid, evenTile } from '../lib/bento';
import { useAuthed, useMe } from '../lib/queries';
import { Pager, usePage } from '../components/Pager';
import { BuildMap } from '../components/BuildMap';
import { AppIcon } from '../components/AppIcon';
import { longDate } from '../lib/date';
import { StatusTag } from '../components/StatusTag';
import { FIELD_FILTER } from '../lib/ui';


/**
 * Internal observability, for the team: who is here, which apps they have on, who holds which role,
 * and numbers for the newer apps, and the build map shown as data in the page (it reads lib/buildMap.ts, no longer a page in another tab),
 * so the whole picture lives on one screen. Numbers first, then the people, then the map. The log of what is happening lives on its own
 * page, Logs, for super admins.
 * Staff can look; only an admin changes a role. Journal and wellbeing never appear here.
 */

/** Number tiles two to a row on a phone and three from the tablet, in even rows (lib/bento.ts), so no row is left part full. */
const TILE_COLS = { base: 2, md: 3 } as const;
function TileRows({ tiles }: { tiles: { label: string; value: number; hint: string }[] }) {
  return (
    <div className={`grid gap-xs ${evenGrid(tiles.length, TILE_COLS)}`}>
      {tiles.map((t, i) => (
        <StatTile key={t.label} label={t.label} value={t.value} hint={t.hint} className={evenTile(i, tiles.length, TILE_COLS)} />
      ))}
    </div>
  );
}
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
            label: a.name,
            value: data.totals.users ? a.on / data.totals.users : 0,
            text: `${formatCount(a.on)} ${a.on === 1 ? 'person' : 'people'}`,
            color: rel.color,
          };
        })
    : [];

  return (
    <Screen>
      <PageHeader back={{ to: '/apps', label: 'Apps' }} eyebrow={MODULE_GROUPS.manage} aside={isAdmin ? <Link to="/internal/logs" className="toy toy-soft inline-flex min-h-[44px] items-center rounded-pill border border-line bg-card-strong px-md text-subhead font-semibold">Logs</Link> : undefined} title="Dev Tools" lede="Who is here, which apps they have on, and who holds which role. Only the team sees this. Journals and wellbeing never appear." />

      {d.isPending && (
        <p className="mt-md m-0 text-subhead text-ink-soft" role="status">
          Counting people
        </p>
      )}
      {d.isError && (
        <p role="alert" className="mt-md m-0 rounded-tile bg-r1/15 p-sm text-subhead">
          Could not load this. Refresh the page to try again.
        </p>
      )}

      {data && (
        <>
          <Section id="obs-numbers" title="People in numbers" lede="Every account that is not deleted.">
            <div className="grid grid-cols-2 gap-xs lg:grid-cols-4">
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
                rows={data.additions.games.map((g) => ({ key: g.key, label: g.name, value: data.totals.users ? g.unlocked / data.totals.users : 0, text: `${formatCount(g.unlocked)} ${g.unlocked === 1 ? 'person' : 'people'}`, color: RELATIONSHIP_BY_KEY.friendship.color }))}
                label="People per game"
              />
            </div>
          </Section>

          <Section id="obs-discover" title="Discover" lede="Quizzes taken and what people allowed. Counts only: no answers, no results, no names.">
            <TileRows
              tiles={[
                { label: "Quizzes", value: data.additions.discover.results, hint: `${formatCount(data.additions.discover.people)} ${data.additions.discover.people === 1 ? 'person' : 'people'}` },
                { label: "With EQ", value: data.additions.discover.withEq, hint: "emotional intelligence added" },
                { label: "Assistant on", value: data.additions.discover.assistantOn, hint: "allowed a short summary" },
                { label: "Steps off", value: data.additions.discover.stepsOff, hint: "switched next steps off" },
                { label: "16 types", value: data.additions.discover.addons.type, hint: "people who finished it" },
                { label: "Love languages", value: data.additions.discover.addons.love, hint: "people who finished it" },
                { label: "Human design", value: data.additions.discover.addons.design, hint: "charts worked out" },
                { label: "How the mind works", value: data.additions.discover.addons.mind, hint: `${data.additions.discover.mindOn} switched it on for next steps` },
                { label: "Given by hand", value: data.additions.grants.xp + data.additions.grants.badges + data.additions.grants.points + data.additions.grants.honors, hint: `last 30 days: ${data.additions.grants.xp} xp, ${data.additions.grants.points} points, ${data.additions.grants.badges} badges, ${data.additions.grants.honors} honors` },
              ]}
            />
          </Section>

          <Section id="obs-agency" title="Agency" lede="How much it is used. Counts only: no client names, no amounts, no notes.">
            <TileRows
              tiles={[
                { label: "People", value: data.additions.agency.people, hint: "have a client" },
                { label: "Clients", value: data.additions.agency.clients, hint: `${data.additions.agency.clientLinksOn} with a client link on` },
                { label: "Deliverables", value: data.additions.agency.deliverables, hint: `${data.additions.agency.published} published` },
                { label: "Invoices", value: data.additions.agency.invoices, hint: "made in Agency" },
                { label: "Agreements signed", value: data.additions.agency.agreementsSigned, hint: "accepted by a client" },
                { label: "Business metrics on", value: data.additions.agency.metricsOn, hint: "switched on in Reviews" },
              ]}
            />
          </Section>

          <Section
            id="obs-log"
            title="The log, last 24 hours"
            lede="Changes people made, requests that were refused and errors, from the app's own log."
            action={isAdmin ? (
              <Link to="/internal/logs" className="toy hidden min-h-[48px] items-center justify-center rounded-pill bg-ink px-md text-headline text-on-ink md:inline-flex">
                Open the logs
              </Link>
            ) : undefined}
          >
            {/* On a phone the link sits under the heading at the right, so the title keeps its width. */}
            {isAdmin && (
              <div className="mb-sm flex justify-end md:hidden">
                <Link to="/internal/logs" className="toy inline-flex min-h-[48px] items-center justify-center rounded-pill bg-ink px-md text-headline text-on-ink">
                  Open the logs
                </Link>
              </div>
            )}
            <div className="grid grid-cols-3 gap-xs">
              <StatTile label="Errors" value={data.additions.logs.errors} hint="server and browser" />
              <StatTile label="Refused" value={data.additions.logs.warnings} hint="400s and rate limits" />
              <StatTile label="Changes" value={data.additions.logs.changes} hint="made by people" />
            </div>
            {!isAdmin && <p className="mt-sm m-0 text-subhead text-ink-soft">The lines themselves name people, so only a super admin reads them.</p>}
          </Section>

          <Section id="obs-people" title="People" lede={`${formatCount(data.total)} ${data.total === 1 ? 'account' : 'accounts'}, newest first, with the apps each one has on.${isAdmin ? ' Change a role from the menu on a row.' : ' Only an admin changes roles.'}`}>
            <label className="block">
              <span className="sr-only">Search people by name or page name</span>
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or page name" autoComplete="off" className={FIELD_FILTER} />
            </label>
            <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
              {data.users.map((u) => (
                <li key={u.id} className="rounded-tile bg-card p-sm shadow-toy-soft">
                  <div className="flex items-center gap-sm">
                    <span className="relative shrink-0">
                      <span className="flex size-[48px] items-center justify-center rounded-pill bg-paper text-[18px] font-bold" aria-hidden="true">
                        {u.name.trim().charAt(0).toUpperCase() || '?'}
                      </span>
                      <RoleBadge role={u.role} size={20} className="absolute right-0 bottom-0" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-balance text-card-title [overflow-wrap:anywhere]">{u.name}</span>
                      <span className="block text-card-note text-ink-soft">
                        {u.handle ? `/u/${u.handle} · ` : ''}
                        since {longDate(u.createdAt)}
                        {u.onboarded ? '' : ' · not set up yet'}
                      </span>
                    </span>
                    {isAdmin && u.id !== me.data?.user.id ? (
                      <label className="shrink-0">
                        <span className="sr-only">Role for {u.name}</span>
                        <select value={u.role} onChange={(e) => setAsking({ user: u, role: e.target.value as Role })} className="min-h-[44px] rounded-pill border-2 border-line bg-card px-sm text-subhead font-medium">
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {ROLE_META[r].name}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      <StatusTag tone="calm">{ROLE_META[u.role].name}</StatusTag>
                    )}
                  </div>
                  <p className="fill-row-all mt-xs m-0 flex flex-wrap items-center gap-xs text-caption text-ink-soft">
                    <span className="shrink-0">
                      {u.apps.length} {u.apps.length === 1 ? 'app' : 'apps'} on:
                    </span>
                    {u.apps.map((k) => {
                      const m = MODULE_BY_KEY[k];
                      if (!m) return null;
                      return (
                        <span key={k} className="inline-flex min-h-[24px] items-center gap-xs rounded-pill bg-card-strong px-xs" style={{ color: `var(--deep-${MODULE_GROUP_ACCENT[m.group]})` }}>
                          <AppIcon name={m.icon} size={14} />
                          {m.name}
                        </span>
                      );
                    })}
                  </p>
                </li>
              ))}
            </ul>
            {data.users.length === 0 && <p className="mt-sm m-0 text-subhead text-ink-soft">Nobody matches "{query}".</p>}
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
                <p className="m-0 text-card-title">{ROLE_META[asking.role].name}</p>
                <p className="m-0 text-card-note text-ink-soft">{ROLE_META[asking.role].blurb}</p>
              </div>
            </div>
            <p className="mt-md m-0 text-subhead text-ink-soft">
              {asking.user.name} is {ROLE_META[asking.user.role].name === 'Admin' ? 'an' : 'a'} {ROLE_META[asking.user.role].name.toLowerCase()} now. The change is written to the audit log with your name on it.
            </p>
            {setRole.isError && (
              <p role="alert" className="mt-sm m-0 rounded-tile bg-r1/15 p-sm text-subhead">
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
