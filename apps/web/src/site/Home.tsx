import { BUMLING, characterTitle, HELP_FAQ, MODULE_BY_KEY, RELATIONSHIPS } from '@kreators/shared';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { Link } from 'react-router';
import { Avatar } from '../components/Avatar';
import { publicApi } from '../lib/api';
import { useSession } from '../lib/store';
import { BRAND_PITCH, FEATURES } from './content';
import { rise, Tower } from './SevenRP';
import { SiteLayout, useAppEntry } from './SiteLayout';

/**
 * The landing page tells one story, in the PASTOR order: the problem, what it costs (the villains), the story and the
 * solution (you are the hero, the app is the guide), the change it makes, the offer, and the one thing to do next.
 * The five Ws sit in the middle, so nobody has to guess who it is for, what it is, when, where or why. The seven
 * relationships live on /7rp and every feature on /features; this page is only about why kreators.app is worth it.
 */

/** The five villains every creator meets. Each one has an answer in the app, below. */
const VILLAINS = [
  { key: 'grind', name: 'The Grind', emoji: '🌀', does: 'Says one more video, one more hour. It takes your sleep first, then your mornings, then your mood.', costs: 'Burnout that shows up in your work too.' },
  { key: 'scatter', name: 'The Scatter', emoji: '🧩', does: 'Ten apps, ten logins, and nothing talks to anything. Courses, gigs, money and notes all live in different places.', costs: 'Hours lost looking, and chances you never see.' },
  { key: 'silence', name: 'The Silence', emoji: '🫥', does: 'You work alone in your room. Nobody checks in, cheers you on or tells you the truth.', costs: 'Doubt grows fast when nobody is around.' },
  { key: 'drift', name: 'The Drift', emoji: '⏳', does: 'Days pass. Goals sit in a note you never open. You feel busy, but nothing moves.', costs: 'A year goes by, and you are in the same place.' },
  { key: 'squeeze', name: 'The Squeeze', emoji: '🪫', does: 'Money comes in bits, late, or not at all. Brands want views; you want rent.', costs: 'Stress that leaks into every relationship you have.' },
] as const;

/** How the app beats each villain: what it does, what you get, and the apps that do it. */
const ANSWERS: { villain: (typeof VILLAINS)[number]['key']; how: string; benefit: string; apps: string[] }[] = [
  { villain: 'grind', how: 'A routine built from your real day, a wake time that moves thirty minutes a week, and trackers for sleep, mood and stress. Your daily brief tells you when sleep starts to dip.', benefit: 'You keep your energy, so your best work lasts.', apps: ['today', 'life', 'sleep', 'mindful'] },
  { villain: 'scatter', how: 'One app for learning, paid work, brand campaigns, your shop and your money. Switch on only what you need; the rest stays out of the way.', benefit: 'One place and one login. Nothing slips past you.', apps: ['school', 'work', 'shop', 'finance'] },
  { villain: 'silence', how: 'Small circles near you, run clubs, events, a kind community, and a life coach if you want one, who sees only what you share.', benefit: 'People in your corner, every week.', apps: ['circles', 'run', 'party', 'community', 'coaching'] },
  { villain: 'drift', how: 'Seven pillars, each a pyramid from a foundation you will not let break down to the task for today. Reviews each week and month show what moved.', benefit: 'A big goal becomes one box you can tick today.', apps: ['tower', 'reviews', 'journal'] },
  { villain: 'squeeze', how: 'Paid gigs, brand campaigns, pay for every verified view, your own shop with fair fees, and all your money in one picture.', benefit: 'More ways to earn, and a clear view of what comes in.', apps: ['army', 'win', 'shop', 'finance'] },
];

const FIVE_WS = [
  { w: 'Who', text: 'Creators, freelancers, students and anyone building something of their own, aged eighteen and up.' },
  { w: 'What', text: 'A daily game for the seven relationships in your life, with the apps a creator needs built in: learn, earn, meet people, sell and stay well.' },
  { w: 'When', text: 'A few minutes a day. Check in, do one small act, tick one task. Then a short look back each week and month.' },
  { w: 'Where', text: 'On your phone or laptop, in the browser. Nothing to install. Add an email and your progress follows you anywhere.' },
  { w: 'Why', text: 'A career built on burnout does not last. When the seven relationships are strong, the work gets better too.' },
];

const BEFORE = ['Up at three in the morning, editing again', 'Goals in a note you never open', 'Ten apps and no plan', 'Nobody to check in with', 'Money you cannot see coming'];
const AFTER = ['A routine that fits your real day', 'Today’s task moves a big goal', 'One app with only what you use', 'Circles, clubs and a coach who check in', 'All your money in and out, in one place'];

const FREE = ['The daily game: check in, a small act, a task', 'Your seven pillars and the strategy session', 'Every app you switch on, from School to the Shop', 'The assistant’s tap flows, and help any time'];

export function Home() {
  const entry = useAppEntry();
  const token = useSession((s) => s.token);
  const start = token ? entry : '/start';
  const stats = useQuery({ queryKey: ['site', 'stats'], queryFn: publicApi.stats });

  return (
    <SiteLayout>
      {/* The hero: who it is for and the promise, in one screen. */}
      <section className="grid gap-lg pt-lg md:grid-cols-2 md:items-center md:pt-xl">
        <div className="@container">
          <p className="m-0 text-[14px] font-extrabold uppercase tracking-wide text-ink-mute">For creators who want a full life, not just a full feed</p>
          {/* Sized from the column width so each line stays whole. */}
          <h1 className="mt-xs text-[clamp(28px,9.5cqw,60px)] leading-[1.05] text-balance">
            Grow your work
            <br />
            without losing your life
          </h1>
          <p className="mt-md m-0 max-w-[520px] text-pretty text-[18px] font-semibold leading-snug text-ink-soft">
            kreators.app is a daily game for the seven relationships in your life, with the tools a creator needs built in. Three small boxes a day keep your work, your health and your people moving together.
          </p>
          <div className="mt-lg flex flex-wrap gap-sm">
            <Link to={start} className="toy inline-flex min-h-[56px] items-center rounded-pill bg-ink px-lg text-[18px] font-bold text-on-ink">
              {token ? 'Go to app' : 'Start free'}
            </Link>
            <a href="#story" className="toy toy-ink inline-flex min-h-[56px] items-center rounded-pill border-2 border-ink bg-card px-lg text-[18px] font-bold">
              See the story
            </a>
          </div>
          <p className="mt-sm m-0 text-[14px] font-semibold text-ink-mute">Free to start: an email and a password, nothing else.</p>
        </div>
        <div className="pt-lg md:pt-0">
          <Tower />
        </div>
      </section>

      {/* P: the problem. */}
      <section id="problem" className="mt-2xl scroll-mt-lg" aria-labelledby="problem-heading">
        <motion.div {...rise} className="max-w-[720px]">
          <p className="m-0 text-[14px] font-extrabold uppercase tracking-wide text-ink-mute">The problem</p>
          <h2 id="problem-heading" className="mt-xs text-[32px] md:text-[40px] text-balance">
            The work grows. The rest of your life slips.
          </h2>
          <p className="mt-sm m-0 text-pretty text-[18px] font-semibold leading-snug text-ink-soft">
            Creators are told to post more, grow faster and never stop. So the channel grows, and the things that hold a life together slip: sleep, friends, family, health, faith. You are not lazy. You are fighting five villains at once, and mostly alone.
          </p>
        </motion.div>
      </section>

      {/* A: amplify. The villains, and what they cost when nobody stops them. */}
      <section id="villains" className="mt-xl scroll-mt-lg" aria-labelledby="villains-heading">
        <motion.div {...rise}>
          <h2 id="villains-heading" className="text-[28px] md:text-[32px] text-balance">
            Meet the villains
          </h2>
          <p className="mt-xs m-0 max-w-[640px] text-pretty text-[16px] font-semibold text-ink-soft">They never come all at once. They creep in, one late night at a time. Left alone, they win.</p>
        </motion.div>
        <ul className="mt-md grid list-none gap-sm p-0 m-0 sm:grid-cols-2 lg:grid-cols-3">
          {VILLAINS.map((v) => (
            <motion.li key={v.key} {...rise} className="rounded-card bg-card p-md shadow-toy-soft">
              <p className="m-0 text-[32px]" aria-hidden="true">
                {v.emoji}
              </p>
              <h3 className="mt-xs m-0 text-[22px] text-balance">{v.name}</h3>
              <p className="mt-xs m-0 text-pretty text-[16px] font-semibold">{v.does}</p>
              <p className="mt-sm m-0 text-pretty text-[14px] font-extrabold text-ink-soft">What it costs: {v.costs}</p>
            </motion.li>
          ))}
        </ul>
      </section>

      {/* S: the story and the solution. You are the hero; the app is the map and the guides. */}
      <section id="story" className="mt-2xl scroll-mt-lg" aria-labelledby="story-heading">
        <motion.div {...rise} className="rounded-card bg-card p-md shadow-toy-soft md:p-lg">
          <p className="m-0 text-[14px] font-extrabold uppercase tracking-wide text-ink-mute">The story</p>
          <h2 id="story-heading" className="mt-xs text-[32px] md:text-[40px] text-balance">
            You are the hero. Every hero needs a guide.
          </h2>
          <p className="mt-sm m-0 max-w-[720px] text-pretty text-[18px] font-semibold leading-snug text-ink-soft">
            In this story the app is not the hero; you are. kreators.app is the map and the guides. Seven characters walk with you, one for each relationship in your life, and Bumling, the app’s own guide, shows you around.
          </p>
          <ul className="mt-md flex list-none flex-wrap gap-xs p-0 m-0" aria-label="Your guides">
            <li className="flex items-center gap-xs rounded-pill bg-paper pr-sm pl-xs">
              <Avatar relationship={BUMLING.key} size={36} decorative />
              <span className="text-[14px] font-bold">{characterTitle(BUMLING.key)}</span>
            </li>
            {RELATIONSHIPS.map((r) => (
              <li key={r.key} className="flex items-center gap-xs rounded-pill bg-paper pr-sm pl-xs">
                <Avatar relationship={r.key} size={36} decorative />
                <span className="text-[14px] font-bold">{characterTitle(r.key)}</span>
              </li>
            ))}
          </ul>
          <ol className="mt-lg grid list-none gap-sm p-0 m-0 md:grid-cols-3">
            {[
              ['1. A short chat', 'Say who you are and what you want. It switches on the apps that fit, and nothing else.'],
              ['2. Your pillars', 'A quick session places your seven relationships and builds a pyramid for the ones that need you most.'],
              ['3. Three boxes a day', 'Check in, do one small act, tick one task. Every tick moves a pillar, and your guides grow with you.'],
            ].map(([t, d]) => (
              <li key={t} className="rounded-tile bg-paper p-md">
                <h3 className="m-0 text-[20px] text-balance">{t}</h3>
                <p className="mt-xs m-0 text-pretty text-[14px] font-semibold text-ink-soft">{d}</p>
              </li>
            ))}
          </ol>
          <Link to="/7rp" className="toy toy-soft mt-md inline-flex min-h-[48px] items-center rounded-pill bg-paper px-md font-bold">
            Meet the seven relationships
          </Link>
        </motion.div>
      </section>

      {/* The five Ws. */}
      <section id="five-ws" className="mt-2xl scroll-mt-lg" aria-labelledby="ws-heading">
        <motion.div {...rise}>
          <h2 id="ws-heading" className="text-[28px] md:text-[32px] text-balance">
            Who, what, when, where and why
          </h2>
        </motion.div>
        <dl className="mt-md grid gap-sm m-0 sm:grid-cols-2 lg:grid-cols-5">
          {FIVE_WS.map((x) => (
            <motion.div key={x.w} {...rise} className="rounded-card bg-card p-md shadow-toy-soft">
              <dt className="font-display text-[24px] font-extrabold">{x.w}</dt>
              <dd className="mt-xs m-0 text-pretty text-[14px] font-semibold text-ink-soft">{x.text}</dd>
            </motion.div>
          ))}
        </dl>
      </section>

      {/* The problems we tackle: each villain, how the app beats it, what you get, and the apps that do it. */}
      <section id="tackle" className="mt-2xl scroll-mt-lg" aria-labelledby="tackle-heading">
        <motion.div {...rise} className="flex flex-wrap items-end justify-between gap-sm">
          <div>
            <h2 id="tackle-heading" className="text-[32px] md:text-[40px] text-balance">
              How you beat each villain
            </h2>
            <p className="mt-xs m-0 max-w-[640px] text-pretty text-[16px] font-semibold text-ink-soft">The problems we tackle, what the app does about each one, and what you get out of it.</p>
          </div>
          <Link to="/features" className="toy toy-ink inline-flex min-h-[48px] items-center rounded-pill border-2 border-ink bg-card px-md font-bold">
            See every feature
          </Link>
        </motion.div>
        <ul className="mt-md flex list-none flex-col gap-sm p-0 m-0">
          {ANSWERS.map((a) => {
            const v = VILLAINS.find((x) => x.key === a.villain)!;
            return (
              <motion.li key={a.villain} {...rise} className="grid gap-sm rounded-card bg-card p-md shadow-toy-soft md:grid-cols-[200px_1fr]">
                <div>
                  <p className="m-0 text-[28px]" aria-hidden="true">
                    {v.emoji}
                  </p>
                  <h3 className="m-0 text-[20px] text-balance">Against {v.name}</h3>
                </div>
                <div>
                  <p className="m-0 text-pretty text-[16px] font-semibold">{a.how}</p>
                  <p className="mt-xs m-0 text-pretty text-[16px] font-extrabold">{a.benefit}</p>
                  <ul className="mt-sm flex list-none flex-wrap gap-xs p-0 m-0">
                    {a.apps
                      .filter((k) => FEATURES[k] && MODULE_BY_KEY[k])
                      .map((k) => (
                        <li key={k}>
                          <Link to={`/features/${k}`} title={FEATURES[k]?.tagline} className="toy toy-soft inline-flex min-h-[40px] items-center gap-xs rounded-pill bg-paper px-sm text-[14px] font-bold">
                            <span aria-hidden="true">{MODULE_BY_KEY[k]?.emoji}</span>
                            {MODULE_BY_KEY[k]?.name}
                          </Link>
                        </li>
                      ))}
                  </ul>
                </div>
              </motion.li>
            );
          })}
        </ul>
      </section>

      {/* T: the change. Before and after, and the real numbers so far. */}
      <section id="change" className="mt-2xl scroll-mt-lg" aria-labelledby="change-heading">
        <motion.div {...rise}>
          <h2 id="change-heading" className="text-[32px] md:text-[40px] text-balance">
            What changes
          </h2>
        </motion.div>
        <div className="mt-md grid gap-sm md:grid-cols-2">
          <motion.div {...rise} className="rounded-card bg-card p-md shadow-toy-soft">
            <h3 className="m-0 text-[20px] text-ink-soft text-balance">Before</h3>
            <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
              {BEFORE.map((b) => (
                <li key={b} className="flex items-start gap-xs text-[16px] font-semibold text-ink-soft">
                  <span aria-hidden="true">✕</span>
                  {b}
                </li>
              ))}
            </ul>
          </motion.div>
          <motion.div {...rise} className="rounded-card bg-r4 p-md text-on-fill">
            <h3 className="m-0 text-[20px] text-on-fill text-balance">After</h3>
            <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
              {AFTER.map((b) => (
                <li key={b} className="flex items-start gap-xs text-[16px] font-bold">
                  <span aria-hidden="true">✓</span>
                  {b}
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
        {stats.data && (
          <ul className="mt-md grid list-none grid-cols-2 gap-xs p-0 m-0 sm:grid-cols-4" aria-label="So far">
            {(
              [
                ['members', stats.data.members],
                ['events coming', stats.data.eventsUpcoming],
                ['opportunities open', stats.data.opportunitiesOpen],
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
        <Link to="/explore" className="toy toy-soft mt-md inline-flex min-h-[48px] items-center rounded-pill bg-card px-md font-bold">
          See what is open right now
        </Link>
      </section>

      {/* O: the offer. What is free, and what brands get. */}
      <section id="offer" className="mt-2xl scroll-mt-lg" aria-labelledby="offer-heading">
        <motion.div {...rise} className="rounded-card bg-card p-md shadow-toy-soft md:p-lg">
          <p className="m-0 text-[14px] font-extrabold uppercase tracking-wide text-ink-mute">The offer</p>
          <h2 id="offer-heading" className="mt-xs text-[32px] md:text-[40px] text-balance">
            Free to start. Free to stay.
          </h2>
          <ul className="mt-md grid list-none gap-xs p-0 m-0 sm:grid-cols-2">
            {FREE.map((f) => (
              <li key={f} className="flex items-start gap-xs rounded-tile bg-paper p-sm text-[16px] font-bold">
                <span aria-hidden="true">✓</span>
                {f}
              </li>
            ))}
          </ul>
          <p className="mt-sm m-0 text-pretty text-[14px] font-semibold text-ink-soft">
            Typing to the assistant, so it does things for you, comes with a plan.{' '}
            <Link to="/pricing" className="font-bold underline underline-offset-4">
              See pricing
            </Link>
            .
          </p>
        </motion.div>
      </section>

      <section id="brands" className="mt-xl scroll-mt-lg" aria-labelledby="brands-heading">
        <motion.div {...rise} className="grid gap-md rounded-card p-md md:grid-cols-[2fr_1fr] md:items-center md:p-lg" style={{ background: 'var(--tint-brown)' }}>
          <div>
            <p className="m-0 text-[14px] font-extrabold uppercase tracking-wide text-ink-mute">{BRAND_PITCH.tagline}</p>
            <h2 id="brands-heading" className="mt-xs text-[28px] md:text-[32px] text-balance">
              Work with creators who show up
            </h2>
            <p className="mt-xs m-0 text-pretty text-[16px] font-semibold text-ink-soft">{BRAND_PITCH.pitch}</p>
            <div className="mt-md flex flex-wrap gap-sm">
              <Link to="/start" className="toy inline-flex min-h-[48px] items-center rounded-pill bg-ink px-md font-bold text-on-ink">
                Create your brand
              </Link>
              <Link to="/features/win" className="toy toy-ink inline-flex min-h-[48px] items-center rounded-pill border-2 border-ink bg-card px-md font-bold">
                How content rewards pay
              </Link>
            </div>
          </div>
          <div className="flex justify-center" aria-hidden="true">
            <Avatar relationship="servant_leader" size={160} mood="excited" />
          </div>
        </motion.div>
      </section>

      <section className="mt-2xl" aria-labelledby="faq-heading">
        <motion.div {...rise}>
          <h2 id="faq-heading" className="text-[28px] md:text-[32px] text-balance">
            Questions people ask
          </h2>
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
              <p className="m-0 px-sm pb-sm text-pretty text-[14px] font-semibold text-ink-soft">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* R: the response. One thing to do next. */}
      <section className="mt-2xl text-center" aria-labelledby="start-heading">
        <motion.div {...rise} className="rounded-card bg-ink p-lg text-on-ink">
          <div className="flex justify-center gap-xs" aria-hidden="true">
            {RELATIONSHIPS.map((r) => (
              <Avatar key={r.key} relationship={r.key} size={36} decorative />
            ))}
          </div>
          <h2 id="start-heading" className="mt-md text-[32px] text-on-ink md:text-[40px] text-balance">
            The villains have had enough time. Your turn.
          </h2>
          <p className="mt-xs m-0 text-pretty text-[16px] font-semibold text-on-ink/80">Three boxes a day. Free to start, nothing to install.</p>
          <Link to={start} className="toy mt-md inline-flex min-h-[56px] items-center rounded-pill bg-card px-lg text-[18px] font-bold text-ink">
            {token ? 'Go to app' : 'Start free'}
          </Link>
        </motion.div>
      </section>
    </SiteLayout>
  );
}
