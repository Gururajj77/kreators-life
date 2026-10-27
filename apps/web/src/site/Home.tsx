import { HELP_FAQ, MODULE_GROUPS, RELATIONSHIPS, type ModuleGroup, type Relationship, type RelationshipKey , LIFE_AREAS, RELATIONSHIP_BY_KEY, type LifeAreaKey} from '@kreators/shared';
import { useQuery } from '@tanstack/react-query';
import { motion, useInView, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Avatar } from '../components/Avatar';
import { Person } from '../components/Person';
import { publicApi } from '../lib/api';
import { BRAND_PITCH, FEATURES, featuresForLifeArea, featuresForRelationship, SITE_FEATURES } from './content';
import { ListingCard } from './ListingCard';
import { ScrollTroupe } from './ScrollTroupe';
import { useSession } from '../lib/store';
import { SiteLayout, useAppEntry } from './SiteLayout';

/** Tells the troupe which relationship is on screen. Null means none, so everyone walks as equals. */
function Zone({ value, onActive, children, className = '', id }: { value: RelationshipKey | null; onActive: (k: RelationshipKey | null) => void; children: ReactNode; className?: string; id?: string }) {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { margin: '-45% 0px -45% 0px' });
  useEffect(() => {
    if (inView) onActive(value);
  }, [inView, value, onActive]);
  return (
    <section ref={ref} id={id} className={className}>
      {children}
    </section>
  );
}

const rise = { initial: { opacity: 0, y: 24 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: '-60px' }, transition: { duration: 0.5 } };

function Tower() {
  const reduce = useReducedMotion();
  const floors = [...RELATIONSHIPS].sort((a, b) => b.floor - a.floor);
  return (
    <div className="relative mx-auto flex w-full max-w-[360px] flex-col items-center gap-[6px]" aria-hidden="true">
      {floors.map((r, i) => {
        const width = 46 + (7 - r.floor) * 8;
        return (
          <motion.div
            key={r.key}
            className="relative flex h-[44px] items-center justify-center rounded-pill"
            style={{ width: `${width}%`, background: r.color }}
            initial={reduce ? false : { opacity: 0, scale: 0.6, y: -30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.08, type: 'spring', stiffness: 260, damping: 18 }}
          >
            <motion.div className="absolute -top-[30px]" animate={reduce ? undefined : { y: [0, -6, 0] }} transition={{ duration: 2.4 + i * 0.2, repeat: Infinity, ease: 'easeInOut', delay: i * 0.3 }}>
              <Avatar relationship={r.key} size={44} decorative />
            </motion.div>
          </motion.div>
        );
      })}
    </div>
  );
}

function FloorSection({ r, onActive }: { r: Relationship; onActive: (k: RelationshipKey | null) => void }) {
  const features = featuresForRelationship(r.key);
  const dark = r.text === '#FFFFFF';
  return (
    <Zone value={r.key} onActive={onActive} className="scroll-mt-xl">
      <motion.div {...rise} className="grid gap-md rounded-card p-md md:grid-cols-[1fr_2fr] md:items-center md:gap-lg md:p-lg" style={{ background: `var(--soft-${r.key})` }}>
        <div className="flex flex-col items-center gap-sm">
          <motion.div whileInView={{ rotate: [0, -6, 6, 0] }} viewport={{ margin: '-30%' }} transition={{ duration: 0.9 }}>
            <Avatar relationship={r.key} size={160} mood="excited" />
          </motion.div>
          <div className="h-[16px] w-[200px] rounded-pill" style={{ background: r.color }} aria-hidden="true" />
          <p className="m-0 text-[14px] font-extrabold" style={{ color: `var(--deep-${r.key})` }}>
            Floor {r.floor} of 7
          </p>
        </div>
        <div>
          <h3 className="m-0 text-[32px] leading-tight md:text-[40px]">{r.name}</h3>
          <p className="mt-xs m-0 text-[18px] font-bold leading-snug">“{r.greeting}”</p>
          <p className="mt-xs m-0 text-[16px] font-semibold text-ink-soft">
            The question {r.character} keeps asking: <span className="text-ink">{r.question}</span>
          </p>
          {features.length > 0 && (
            <ul className="mt-md flex list-none flex-wrap gap-xs p-0 m-0">
              {features.map((m) => (
                <li key={m.key}>
                  <Link to={`/features/${m.key}`} className={`toy inline-flex min-h-[40px] items-center gap-xs rounded-pill px-sm text-[14px] font-bold ${dark ? 'text-white' : 'text-ink-fixed'}`} style={{ background: r.color, ['--toy-color' as string]: r.deep }}>
                    <span aria-hidden="true">{m.emoji}</span>
                    {m.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </motion.div>
    </Zone>
  );
}

/** One of the five areas of life, with the apps that serve it, in its relationship's colour. */
function LifeAreaSection({ k }: { k: LifeAreaKey }) {
  const meta = LIFE_AREAS[k];
  const r = RELATIONSHIP_BY_KEY[meta.relationship];
  const features = featuresForLifeArea(k);
  const dark = r.text === '#FFFFFF';
  return (
    <motion.div {...rise} className="grid gap-md rounded-card p-md md:grid-cols-[1fr_2fr] md:items-center md:gap-lg md:p-lg" style={{ background: `var(--soft-${r.key})` }}>
      <div className="flex flex-col items-center gap-sm">
        <Avatar relationship={r.key} size={120} mood="happy" />
        <p className="m-0 text-[36px]" aria-hidden="true">
          {meta.emoji}
        </p>
      </div>
      <div>
        <h3 className="m-0 text-[32px] leading-tight md:text-[40px]">{meta.name}</h3>
        <p className="mt-xs m-0 text-[16px] font-semibold text-ink-soft">{meta.blurb}</p>
        <ul className="mt-md flex list-none flex-wrap gap-xs p-0 m-0">
          {features.map((m) => (
            <li key={m.key}>
              <Link to={`/features/${m.key}`} className={`toy inline-flex min-h-[40px] items-center gap-xs rounded-pill px-sm text-[14px] font-bold ${dark ? 'text-white' : 'text-ink-fixed'}`} style={{ background: r.color, ['--toy-color' as string]: r.deep }}>
                <span aria-hidden="true">{m.emoji}</span>
                {m.name}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </motion.div>
  );
}

const DAILY = [
  { label: 'Check in', hint: '+10 points', color: 'var(--color-r4)', text: 'var(--color-ink-fixed)' },
  { label: 'Pip’s small act: text a friend you have not seen this month', hint: 'Friendship', color: 'var(--color-r2)', text: 'var(--color-ink-fixed)' },
  { label: 'Draft the first minute of the video', hint: 'ready in 7 min', color: 'var(--color-r1)', text: '#fff' },
];

export function Home() {
  const [active, setActive] = useState<RelationshipKey | null>(null);
  const [view, setView] = useState<'seven' | 'five'>('seven');
  const entry = useAppEntry();
  const token = useSession((s) => s.token);
  const stats = useQuery({ queryKey: ['site', 'stats'], queryFn: publicApi.stats });
  const featured = useQuery({ queryKey: ['site', 'featured'], queryFn: () => publicApi.explore({ featured: true, limit: 6 }) });
  const latest = useQuery({ queryKey: ['site', 'latest'], queryFn: () => publicApi.explore({ limit: 6 }) });
  const live = (featured.data?.listings.length ? featured.data.listings : latest.data?.listings) ?? [];
  const groups: ModuleGroup[] = ['earn', 'community', 'wellbeing', 'creator'];

  return (
    <SiteLayout>
      <ScrollTroupe active={active} />

      <Zone value={null} onActive={setActive} className="grid gap-lg pt-lg md:grid-cols-2 md:items-center md:pt-xl">
        <div className="@container">
          <p className="m-0 text-[14px] font-extrabold uppercase tracking-wide text-ink-mute">The one stop for creators</p>
          {/* Sized from the column width so each line stays whole: the longer line is 11.1em wide in Urbanist 900. */}
          <h1 className="mt-xs text-[clamp(24px,8.7cqw,60px)] leading-[1.05]">
            Better Creator life with
            <br />
            The Seven Relationships
          </h1>
          <p className="mt-md m-0 max-w-[520px] text-[18px] font-semibold leading-snug text-ink-soft">
            A daily game that keeps the seven relationships of your life in balance, with everything a creator needs stacked on top: learning, paid work, brand campaigns, content rewards, events, run clubs, a shop, a store for gear, reviews by week and month, and tools for staying well.
          </p>
          <div className="mt-lg flex flex-wrap gap-sm">
            <Link to={token ? entry : '/signup'} className="toy inline-flex min-h-[56px] items-center rounded-pill bg-ink px-lg text-[18px] font-bold text-on-ink">
              {token ? 'Go to app' : 'Start free'}
            </Link>
            <Link to="/explore" className="toy toy-ink inline-flex min-h-[56px] items-center rounded-pill border-2 border-ink bg-card px-lg text-[18px] font-bold">
              Explore what is open
            </Link>
          </div>
          <p className="mt-sm m-0 text-[14px] font-semibold text-ink-mute">Free to start: an email and a password, nothing else. Already have an account? Go to app signs you in.</p>
        </div>
        <div className="pt-lg md:pt-0">
          <Tower />
        </div>
      </Zone>

      <Zone value={null} onActive={setActive} id="how" className="mt-2xl">
        <motion.div {...rise}>
          <h2 className="text-[32px] md:text-[40px]">How it works</h2>
          <p className="mt-xs m-0 max-w-[640px] text-[16px] font-semibold text-ink-soft">Nothing to fill in. Answer a few questions, we build your pillars, and you tick a few boxes a day.</p>
        </motion.div>
        <div className="mt-md grid gap-sm md:grid-cols-3">
          <motion.div {...rise} className="rounded-card bg-card p-md shadow-toy-soft">
            <p className="m-0 text-[14px] font-extrabold text-ink-mute">1. Vibe check</p>
            <h3 className="mt-xs m-0 text-[22px]">Questions that branch</h3>
            <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Each answer picks the next question. Three minutes, and we know which pillars need you most.</p>
            <div className="mt-md flex flex-col gap-xs" aria-hidden="true">
              {['Who did you serve this week?', 'Mostly people I lead', 'A few close friends'].map((t, i) => (
                <span key={t} className={`rounded-pill px-sm text-[14px] font-bold leading-[40px] ${i === 0 ? 'bg-ink text-on-ink' : 'bg-paper text-ink-soft'}`}>
                  {t}
                </span>
              ))}
            </div>
          </motion.div>
          <motion.div {...rise} className="rounded-card bg-card p-md shadow-toy-soft">
            <p className="m-0 text-[14px] font-extrabold text-ink-mute">2. Your pillars</p>
            <h3 className="mt-xs m-0 text-[22px]">A pyramid in every pillar</h3>
            <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Foundation, guiding principle, value goal, goal outcome, project, task. Tick a task and the whole pyramid brightens.</p>
            <ol className="mt-md m-0 flex list-none flex-col gap-[6px] p-0" aria-hidden="true">
              {['Foundation', 'Guiding principle', 'Value goal', 'Goal outcome', 'Project', 'Task'].map((k, i) => (
                <li key={k} className="rounded-pill text-[12px] font-extrabold leading-[26px]" style={{ background: RELATIONSHIPS[i]?.color ?? '#ccc', color: RELATIONSHIPS[i]?.text, width: `${100 - i * 10}%`, paddingLeft: 12 }}>
                  {k}
                </li>
              ))}
            </ol>
          </motion.div>
          <motion.div {...rise} className="rounded-card bg-card p-md shadow-toy-soft">
            <p className="m-0 text-[14px] font-extrabold text-ink-mute">3. The daily three</p>
            <h3 className="mt-xs m-0 text-[22px]">Boxes, not forms</h3>
            <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Every action is a checkbox row. Waits and limits stop anyone farming points.</p>
            <ul className="mt-md flex list-none flex-col gap-xs p-0 m-0" aria-hidden="true">
              {DAILY.map((d, i) => (
                <li key={d.label} className="flex items-center gap-sm rounded-tile bg-paper p-xs">
                  <span className={`flex size-[28px] shrink-0 items-center justify-center rounded-[8px] border-2 border-ink ${i === 0 ? 'bg-ink text-on-ink' : 'bg-card'}`}>{i === 0 ? '✓' : ''}</span>
                  <span className="min-w-0 flex-1 text-[14px] font-bold leading-tight">{d.label}</span>
                  <span className="shrink-0 rounded-pill px-xs text-[11px] font-extrabold leading-[20px]" style={{ background: d.color, color: d.text }}>
                    {d.hint}
                  </span>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
        <div className="mt-md flex flex-col items-start gap-md rounded-card bg-card p-md shadow-toy-soft sm:flex-row sm:items-center">
          <div className="flex shrink-0 items-end gap-xs" aria-hidden="true">
            {[1, 2, 3, 4, 5].map((s) => (
              <Person key={s} stage={s} size={40 + s * 8} decorative />
            ))}
          </div>
          <p className="m-0 text-[16px] font-semibold text-ink-soft">
            <span className="font-extrabold text-ink">You evolve too.</span> Your figure fills from the feet up as you climb, and each new form unlocks on a schedule nobody can rush.
          </p>
        </div>
      </Zone>

      <div id="floors" className="mt-2xl scroll-mt-lg">
        <motion.div {...rise}>
          <h2 className="text-[32px] md:text-[40px]">{view === 'seven' ? 'Seven areas' : 'Five areas of life'}</h2>
          <p className="mt-xs m-0 max-w-[640px] text-[16px] font-semibold text-ink-soft">
            {view === 'seven' ? 'Red at the bottom, violet at the top. Each pillar has its own character, and each part of the app serves at least one pillar.' : 'Physical, financial, emotional, mental and spiritual: the same seven relationships, read the way a life is usually read. Each one lists the apps that serve it.'}
          </p>
          <div role="group" aria-label="View" className="mt-sm flex flex-wrap gap-xs">
            {(['seven', 'five'] as const).map((v) => (
              <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} className={`toy min-h-[44px] rounded-pill border-2 px-md text-[14px] font-bold ${view === v ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card text-ink'}`}>
                {v === 'seven' ? 'Seven relationships' : 'Five areas of life'}
              </button>
            ))}
          </div>
        </motion.div>
        <div className="mt-md flex flex-col gap-md">
          {view === 'seven'
            ? RELATIONSHIPS.map((r) => <FloorSection key={r.key} r={r} onActive={setActive} />)
            : (Object.keys(LIFE_AREAS) as LifeAreaKey[]).map((k) => <LifeAreaSection key={k} k={k} />)}
        </div>
      </div>

      <Zone value={null} onActive={setActive} id="features" className="mt-2xl scroll-mt-lg">
        <motion.div {...rise}>
          <h2 className="text-[32px] md:text-[40px]">Everything a creator needs</h2>
          <p className="mt-xs m-0 max-w-[640px] text-[16px] font-semibold text-ink-soft">Every feature is a switch. Keep what you use, hide the rest. Each one opens into the app once you sign in.</p>
        </motion.div>
        {groups.map((g) => {
          const list = SITE_FEATURES.filter((m) => m.group === g);
          if (list.length === 0) return null;
          return (
            <div key={g} className="mt-lg">
              <h3 className="text-[22px]">{MODULE_GROUPS[g]}</h3>
              <ul className="mt-sm grid list-none gap-xs p-0 m-0 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((m) => (
                  <motion.li key={m.key} {...rise}>
                    <Link to={`/features/${m.key}`} className="toy toy-soft flex min-h-[120px] flex-col rounded-tile bg-card p-md">
                      <span className="text-[28px]" aria-hidden="true">
                        {m.emoji}
                      </span>
                      <span className="mt-xs block text-[18px] font-extrabold leading-tight">{m.name}</span>
                      <span className="block text-[14px] font-semibold leading-snug text-ink-soft">{FEATURES[m.key]?.tagline ?? m.blurb}</span>
                    </Link>
                  </motion.li>
                ))}
              </ul>
            </div>
          );
        })}
      </Zone>

      <Zone value={null} onActive={setActive} id="live" className="mt-2xl scroll-mt-lg">
        <motion.div {...rise} className="flex flex-wrap items-end justify-between gap-sm">
          <div>
            <h2 className="text-[32px] md:text-[40px]">Open right now</h2>
            <p className="mt-xs m-0 max-w-[640px] text-[16px] font-semibold text-ink-soft">Rewards, opportunities, events, programs and tools, straight from the team and the brands we work with.</p>
          </div>
          <Link to="/explore" className="toy toy-ink inline-flex min-h-[48px] items-center rounded-pill border-2 border-ink bg-card px-md font-bold">
            Search everything
          </Link>
        </motion.div>
        {stats.data && (
          <ul className="mt-md grid list-none grid-cols-2 gap-xs p-0 m-0 sm:grid-cols-3 lg:grid-cols-6" aria-label="Numbers">
            {(
              [
                ['members', stats.data.members],
                ['rewards open', stats.data.rewardsOpen],
                ['opportunities', stats.data.opportunitiesOpen],
                ['events coming', stats.data.eventsUpcoming],
                ['programs', stats.data.programs],
                ['points paid out', stats.data.pointsPaid],
              ] as [string, number][]
            ).map(([label, value]) => (
              <li key={label} className="rounded-tile bg-card p-sm shadow-toy-soft">
                <p className="m-0 font-display text-[28px] font-extrabold leading-none">{value.toLocaleString()}</p>
                <p className="mt-xs m-0 text-[12px] font-bold text-ink-soft">{label}</p>
              </li>
            ))}
          </ul>
        )}
        {live.length > 0 ? (
          <ul className="mt-md grid list-none gap-sm p-0 m-0 md:grid-cols-2 lg:grid-cols-3">
            {live.map((l) => (
              <ListingCard key={`${l.type}-${l.id}`} listing={l} />
            ))}
          </ul>
        ) : (
          <p className="mt-md m-0 rounded-tile bg-card p-md text-[16px] font-semibold text-ink-soft shadow-toy-soft">Listings appear here as soon as the team or a brand publishes one. Sign in and switch the modules on to be the first to see them.</p>
        )}
      </Zone>

      <Zone value="servant_leader" onActive={setActive} id="brands" className="mt-2xl scroll-mt-lg">
        <motion.div {...rise} className="grid gap-md rounded-card p-md md:grid-cols-[2fr_1fr] md:items-center md:p-lg" style={{ background: 'var(--tint-brown)' }}>
          <div>
            <p className="m-0 text-[14px] font-extrabold uppercase tracking-wide text-ink-mute">{BRAND_PITCH.tagline}</p>
            <h2 className="mt-xs text-[32px] md:text-[40px]">Run campaigns and content rewards with real creators</h2>
            <p className="mt-xs m-0 text-[16px] font-semibold text-ink-soft">{BRAND_PITCH.pitch}</p>
            <ol className="mt-md m-0 grid gap-xs p-0 pl-md text-[16px] font-semibold">
              {BRAND_PITCH.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
            <div className="mt-md flex flex-wrap gap-sm">
              <Link to="/signup?next=%2Farmy" className="toy inline-flex min-h-[48px] items-center rounded-pill bg-ink px-md font-bold text-on-ink">
                Create your brand
              </Link>
              <Link to="/features/win" className="toy toy-ink inline-flex min-h-[48px] items-center rounded-pill border-2 border-ink bg-card px-md font-bold">
                How content rewards pay
              </Link>
            </div>
          </div>
          <div className="flex justify-center" aria-hidden="true">
            <Avatar relationship="servant_leader" size={180} mood="excited" />
          </div>
        </motion.div>
      </Zone>

      <Zone value={null} onActive={setActive} className="mt-2xl">
        <motion.div {...rise}>
          <h2 className="text-[32px] md:text-[40px]">Questions people ask</h2>
        </motion.div>
        <div className="mt-md grid gap-xs md:grid-cols-2">
          {HELP_FAQ.map((f) => (
            <details key={f.q} className="rounded-tile bg-card shadow-toy-soft">
              <summary className="flex min-h-[56px] items-center gap-sm rounded-tile p-sm text-[16px] font-extrabold">
                <span className="min-w-0 flex-1">{f.q}</span>
                <span className="flex size-[32px] shrink-0 items-center justify-center rounded-pill bg-paper" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="20" height="20" className="chev transition-transform" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </span>
              </summary>
              <p className="m-0 px-sm pb-sm text-[14px] font-semibold text-ink-soft">{f.a}</p>
            </details>
          ))}
        </div>
      </Zone>

      <Zone value={null} onActive={setActive} className="mt-2xl text-center">
        <motion.div {...rise} className="rounded-card bg-ink p-lg text-on-ink">
          <div className="flex justify-center gap-xs" aria-hidden="true">
            {RELATIONSHIPS.map((r) => (
              <Avatar key={r.key} relationship={r.key} size={36} decorative />
            ))}
          </div>
          <h2 className="mt-md text-[32px] text-on-ink md:text-[40px]">Three boxes a day. Start today.</h2>
          <p className="mt-xs m-0 text-[16px] font-semibold opacity-80">Free to play. Nothing to install. Add an email when you want your progress to follow you.</p>
          <Link to={entry} className="toy mt-md inline-flex min-h-[56px] items-center rounded-pill bg-card px-lg text-[18px] font-bold text-ink">
            Start the vibe check
          </Link>
        </motion.div>
      </Zone>
    </SiteLayout>
  );
}
