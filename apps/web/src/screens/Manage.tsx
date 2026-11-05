import { formatCount, MODULE_BY_KEY, PERMISSION_META, ROLE_META, type Permission } from '@kreators/shared';
import { longDate, shortDay } from '../lib/date';
import { AppIcon } from '../components/AppIcon';
import { useState } from 'react';
import { AppCover } from '../components/AppCover';
import { Screen } from '../components/Screen';
import { api } from '../lib/api';
import { useAuthed, useMe } from '../lib/queries';
import { useDebounced } from '../lib/useDebounced';
import { Pager, usePage } from '../components/Pager';
import { tie } from '../lib/text';
import { StatusTag } from '../components/StatusTag';
import { RowCard } from '../components/RowCard';
import { Reveal } from '../components/fx/Reveal';
import { CountUp } from '../components/fx/CountUp';
import { FactTag, IconTag } from '../components/FactTag';

/** Each permission's queue tile: where it opens and what is waiting. Its icon is the permission's own, from `PERMISSION_META` in shared. */
const PERMISSION_TILES: Record<Permission, { name: string; blurb: string; to: string; queue?: (q: Queues) => number }> = {
  talent: { name: 'Talent', blurb: 'Campaign briefs, shortlists, assignments', to: '/army', queue: (q) => q.campaigns },
  cohorts: { name: 'Cohorts', blurb: 'Programs, cohorts, completion', to: '/school', queue: (q) => q.assignments },
  events: { name: 'Events', blurb: 'Parties, workshops, camps, days, run collabs', to: '/party' },
  finance: { name: 'Finance', blurb: 'Payouts for verified content rewards', to: '/win', queue: (q) => q.bountyQueue },
  moderation: { name: 'Moderation', blurb: 'Hide or restore community posts', to: '/community' },
  support: { name: 'Support', blurb: 'Answer tickets from Help', to: '/help', queue: (q) => q.tickets },
  review: { name: 'Review', blurb: 'Club, rewards, tools, TV and Fund proposals', to: '/club', queue: (q) => q.clubApplied + q.proposals },
  mentor: { name: 'Mentor', blurb: 'Feedback on learners’ assignments', to: '/school', queue: (q) => q.assignments },
  coach: { name: 'Life coach', blurb: 'Your students, their asks, notes and tasks', to: '/coaching', queue: (q) => q.coachAsks },
};
type Queues = { campaigns: number; applications: number; tickets: number; clubApplied: number; bountyQueue: number; proposals: number; assignments: number; coachAsks: number };

export function Manage() {
  const me = useMe();
  const overview = useAuthed(['manage-overview'], api.manageOverview);
  const [q, setQ] = useState('');
  const pg = usePage();
  // The box updates at once; the server is asked once typing pauses.
  const asked = useDebounced(q.trim(), 300);
  const members = useAuthed(['members', asked, pg.query], () => api.members(asked, pg.query));
  const o = overview.data;
  const role = me.data?.user.role ?? 'user';
  return (
    <Screen>
      <AppCover
        back={{ to: '/apps', label: 'Apps' }}
        title="Manage"
        lede={
          <>
            You are {role === 'admin' ? 'an' : 'a'} {ROLE_META[role].name.toLowerCase()}. {ROLE_META[role].blurb}
          </>
        }
      />

      {o && (
        <section className="mt-md" aria-labelledby="queues-heading">
          <h2 id="queues-heading" className="text-title2">
            Your queues
          </h2>
          {o.permissions.length === 0 && role !== 'admin' && <p className="mt-xs m-0 text-subhead text-ink-soft">No staff permissions yet. An admin grants them under Admin, People.</p>}
          {/* A queue tile is placed like every card (2026-11-05): the name and its line at the top left, the permission's icon on a neutral
              tile at the top right, what is waiting at the foot of every tile (a neutral word when nothing is, or when the area keeps no
              queue) and an arrow at the bottom right. One to a row on a phone, so no line is squeezed; two from the small tablet up. */}
          <ul className="mt-sm grid list-none grid-cols-1 gap-xs p-0 m-0 sm:grid-cols-2">
            {[
              // An admin holds every permission but Life coach, which the server lists only when given.
              ...(role === 'admin' ? (Object.keys(PERMISSION_TILES) as Permission[]).filter((p) => p !== 'coach' || o.permissions.includes('coach')) : o.permissions).map((p) => {
                const m = PERMISSION_TILES[p];
                return { key: p, name: m.name, blurb: m.blurb, to: m.to, icon: PERMISSION_META[p].icon, waiting: m.queue ? m.queue(o.queues) : null };
              }),
              { key: 'knowledge', name: 'Knowledge', blurb: 'Write and publish articles', to: '/knowledge', icon: MODULE_BY_KEY.knowledge?.icon, waiting: null },
              ...(role === 'admin' ? [{ key: 'admin', name: 'Admin', blurb: 'People, flags, listings, audit', to: '/admin', icon: MODULE_BY_KEY.admin?.icon, waiting: null }] : []),
            ].map((t, i) => (
              <Reveal as="li" key={t.key} index={i} className="flex">
                <RowCard
                  to={t.to}
                  title={t.name}
                  sub={tie(t.blurb)}
                  corner={
                    <span className="flex size-[44px] items-center justify-center rounded-inner bg-paper text-ink-soft" aria-hidden="true">
                      <AppIcon name={t.icon} size={22} />
                    </span>
                  }
                  facts={
                    t.waiting === null ? (
                      <StatusTag tone="neutral">No queue</StatusTag>
                    ) : t.waiting > 0 ? (
                      <StatusTag tone="bad">{`${formatCount(t.waiting)} waiting`}</StatusTag>
                    ) : (
                      <StatusTag tone="good">Nothing waiting</StatusTag>
                    )
                  }
                />
              </Reveal>
            ))}
          </ul>
        </section>
      )}

      {o && (
        <section className="mt-lg grid grid-cols-3 gap-xs" aria-label="Numbers">
          {[
            ['members', o.members],
            ['new this week', o.newThisWeek],
            ['active today', o.activeToday],
            ['open applications', o.queues.applications],
            ['posts this week', o.postsThisWeek],
            ['hidden posts', o.hiddenPosts],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-tile bg-card p-sm shadow-toy-soft">
              <p className="m-0 text-title2 type-figure leading-none">
                <CountUp value={Number(value)} format={formatCount} className="tabular-nums" />
              </p>
              <p className="mt-xs m-0 text-caption text-ink-soft">{label}</p>
            </div>
          ))}
        </section>
      )}

      <section className="mt-lg" aria-labelledby="members-heading">
        <h2 id="members-heading" className="text-title2">
          Members
        </h2>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, page or email" aria-label="Search members" className="mt-sm w-full rounded-pill border-2 border-line bg-card px-md py-sm text-body" />
        <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
          {members.data?.members.map((m) => (
            <li key={m.id} className="flex">
              {/* The name at the top left, the role in the corner of every row (Creator too), the numbers as tags at the foot. */}
              <RowCard
                title={
                  <span className="[overflow-wrap:anywhere]">
                    {m.name}
                    {m.handle ? <span className="text-ink-soft"> @{m.handle}</span> : ''}
                  </span>
                }
                corner={<StatusTag tone={m.role === 'user' ? 'neutral' : 'calm'} fit>{ROLE_META[m.role].name}</StatusTag>}
                facts={[
                  <IconTag key="xp" tone="calm" icon="Zap">{`${formatCount(m.xp)} xp`}</IconTag>,
                  <IconTag key="streak" tone="warm" icon="Flame">{`Streak ${m.streak}`}</IconTag>,
                  <FactTag key="joined" kind="when">{`Joined ${longDate(m.createdAt)}`}</FactTag>,
                  <FactTag key="last" kind="status">{m.lastCheckin ? `Last check-in ${shortDay(m.lastCheckin)}` : 'Never checked in'}</FactTag>,
                ]}
              />
            </li>
          ))}
        </ul>
        <Pager page={members.data?.page} label="members" />
      </section>
    </Screen>
  );
}
