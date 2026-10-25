import { ROLE_META, type Permission } from '@kreators/shared';
import { useState } from 'react';
import { Link } from 'react-router';
import { BackLink } from '../components/PageHeader';
import { Screen } from '../components/Screen';
import { api } from '../lib/api';
import { useAuthed, useMe } from '../lib/queries';

const PERMISSION_META: Record<Permission, { name: string; blurb: string; to: string; emoji: string; queue?: (q: Queues) => number }> = {
  talent: { name: 'Talent', blurb: 'Campaign briefs, shortlists, assignments', to: '/army', emoji: '🎬', queue: (q) => q.campaigns },
  cohorts: { name: 'Cohorts', blurb: 'Programs, cohorts, completion', to: '/school', emoji: '🎓', queue: (q) => q.assignments },
  events: { name: 'Events', blurb: 'Parties, workshops, camps, days, run collabs', to: '/party', emoji: '🎉' },
  finance: { name: 'Finance', blurb: 'Payouts for verified content rewards', to: '/win', emoji: '💸', queue: (q) => q.bountyQueue },
  moderation: { name: 'Moderation', blurb: 'Hide or restore community posts', to: '/community', emoji: '🛡️' },
  support: { name: 'Support', blurb: 'Answer tickets from Help', to: '/help', emoji: '🛟', queue: (q) => q.tickets },
  review: { name: 'Review', blurb: 'Club, rewards, tools, TV and Fund proposals', to: '/club', emoji: '🔎', queue: (q) => q.clubApplied + q.proposals },
  mentor: { name: 'Mentor', blurb: 'Feedback on learners’ assignments', to: '/school', emoji: '🧑‍🏫', queue: (q) => q.assignments },
};
type Queues = { campaigns: number; applications: number; tickets: number; clubApplied: number; bountyQueue: number; proposals: number; assignments: number };

export function Manage() {
  const me = useMe();
  const overview = useAuthed(['manage-overview'], api.manageOverview);
  const [q, setQ] = useState('');
  const members = useAuthed(['members', q], () => api.members(q));
  const o = overview.data;
  const role = me.data?.user.role ?? 'user';
  return (
    <Screen>
      <header className="pt-lg">
        <BackLink to="/apps">Apps</BackLink>
        <h1 className="text-[30px]">Manage</h1>
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">
          You are {role === 'admin' ? 'an' : 'a'} {ROLE_META[role].name.toLowerCase()}. {ROLE_META[role].blurb}
        </p>
      </header>

      {o && (
        <section className="mt-md" aria-labelledby="queues-heading">
          <h2 id="queues-heading" className="text-[24px]">
            Your queues
          </h2>
          {o.permissions.length === 0 && role !== 'admin' && <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">No staff permissions yet. An admin grants them under Admin, People.</p>}
          <ul className="mt-sm grid list-none grid-cols-2 gap-xs p-0 m-0">
            {(role === 'admin' ? (Object.keys(PERMISSION_META) as Permission[]) : o.permissions).map((p) => {
              const m = PERMISSION_META[p];
              const n = m.queue ? m.queue(o.queues) : 0;
              return (
                <li key={p}>
                  <Link to={m.to} className="toy toy-soft relative flex min-h-[112px] flex-col justify-end rounded-tile bg-card p-sm">
                    <span className="text-[22px]" aria-hidden="true">
                      {m.emoji}
                    </span>
                    <span className="mt-xs block text-[16px] font-bold leading-tight">{m.name}</span>
                    <span className="block text-[14px] font-semibold leading-snug text-ink-soft">{m.blurb}</span>
                    {n > 0 && <span className="absolute top-sm right-sm rounded-pill bg-r1 px-xs text-[12px] font-extrabold leading-[20px] text-white">{n}</span>}
                  </Link>
                </li>
              );
            })}
            <li>
              <Link to="/knowledge" className="toy toy-soft flex min-h-[112px] flex-col justify-end rounded-tile bg-card p-sm">
                <span className="text-[22px]" aria-hidden="true">
                  📚
                </span>
                <span className="mt-xs block text-[16px] font-bold leading-tight">Knowledge</span>
                <span className="block text-[14px] font-semibold leading-snug text-ink-soft">Write and publish articles</span>
              </Link>
            </li>
            {role === 'admin' && (
              <li>
                <Link to="/admin" className="toy toy-soft flex min-h-[112px] flex-col justify-end rounded-tile bg-card p-sm">
                  <span className="text-[22px]" aria-hidden="true">
                    🔑
                  </span>
                  <span className="mt-xs block text-[16px] font-bold leading-tight">Admin</span>
                  <span className="block text-[14px] font-semibold leading-snug text-ink-soft">People, flags, listings, audit</span>
                </Link>
              </li>
            )}
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
              <p className="m-0 font-display text-[24px] font-extrabold leading-none">{value}</p>
              <p className="mt-xs m-0 text-[12px] font-bold text-ink-soft">{label}</p>
            </div>
          ))}
        </section>
      )}

      <section className="mt-lg" aria-labelledby="members-heading">
        <h2 id="members-heading" className="text-[24px]">
          Members
        </h2>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, page or email" aria-label="Search members" className="mt-sm w-full rounded-pill border-2 border-line bg-card px-md py-sm text-[16px]" />
        <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
          {members.data?.members.map((m) => (
            <li key={m.id} className="rounded-tile bg-card p-sm shadow-toy-soft">
              <p className="m-0 text-[16px] font-bold">
                {m.name}
                {m.handle ? <span className="font-semibold text-ink-soft"> @{m.handle}</span> : ''}
                {m.role !== 'user' && <span className="ml-xs rounded-pill bg-r6 px-xs text-[11px] font-extrabold leading-[18px] text-white">{ROLE_META[m.role].name}</span>}
              </p>
              <p className="m-0 text-[14px] font-semibold text-ink-soft">
                {m.xp} xp, streak {m.streak}, joined {new Date(m.createdAt).toLocaleDateString()}
                {m.lastCheckin ? `, last check-in ${m.lastCheckin}` : ', never checked in'}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </Screen>
  );
}
