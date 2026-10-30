import type { CSSProperties } from 'react';
import { BUMLING, characterTitle, MODULE_BY_KEY, PAYMENTS_LIVE, PLAN_DAYS, PLANS, RELATIONSHIPS } from '@kreators/shared';
import { useQuery } from '@tanstack/react-query';
import { HeroBlobs } from '../components/Hero';
import { motion } from 'motion/react';
import { Link } from 'react-router';
import { Avatar } from '../components/Avatar';
import { publicApi } from '../lib/api';
import { useSession } from '../lib/store';
import { BRAND_PITCH, FEATURES, SITE_FAQ } from './content';
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
  { key: 'grind', name: 'The Grind', emoji: '🌀', does: 'Says one more video, one more hour. It takes your sleep first, then your mornings, then your mood.', costs: 'Tired work, and less of it.' },
  { key: 'scatter', name: 'The Scatter', emoji: '🧩', does: 'Ten apps, ten logins, and nothing talks to anything. Courses, gigs, money and notes all live in different places.', costs: 'Hours lost looking, and chances you never see.' },
  { key: 'silence', name: 'The Silence', emoji: '🫥', does: 'You work alone in your room. Nobody checks in, cheers you on or tells you the truth.', costs: 'Doubt grows fast when nobody is around.' },
  { key: 'drift', name: 'The Drift', emoji: '⏳', does: 'Days pass. Goals sit in a note you never open. You feel busy, but nothing moves.', costs: 'A year goes by, and you are in the same place.' },
  { key: 'squeeze', name: 'The Squeeze', emoji: '🪫', does: 'Money comes in bits, late, or not at all. Brands want views; you want rent.', costs: 'Stress that leaks into the rest of your life.' },
] as const;

/** How the app beats each villain: what it does (a rule the code keeps), what you get, and the apps that do it. */
const ANSWERS: { villain: (typeof VILLAINS)[number]['key']; how: string; benefit: string; apps: string[] }[] = [
  { villain: 'grind', how: 'A routine built from your real day, with a wake time that moves thirty minutes a week. Trackers for sleep, mood and stress feed a daily brief that tells you when sleep starts to dip.', benefit: 'You keep your energy, so your best work lasts.', apps: ['today', 'life', 'sleep', 'mindful'] },
  { villain: 'scatter', how: 'Learning, paid work, brand campaigns, your shop and your money in one app. Only a few apps are on to start, the setup chat picks up to five more that fit, and you can switch any of them off.', benefit: 'One place and one login, so nothing slips past you.', apps: ['school', 'work', 'shop', 'finance'] },
  { villain: 'silence', how: 'Small circles near you, run clubs, events and a kind community. A life coach too, if you want one, who sees only what you switch on and never your journal.', benefit: 'People in your corner, every week.', apps: ['circles', 'run', 'party', 'community', 'coaching'] },
  { villain: 'drift', how: 'Seven pillars, each a pyramid from a foundation you will not let break down to the task for today. A task with a date can only be ticked on its day. Reviews each week and month show what moved.', benefit: 'A big goal becomes one box you can tick today.', apps: ['tower', 'reviews', 'journal'] },
  { villain: 'squeeze', how: 'Paid gigs and brand campaigns. Win pays for every verified view, once a reviewer checks it. Your own shop takes 5% of a sale and nothing up front, and all your money sits in one picture.', benefit: 'You see every way in, and everything that comes in.', apps: ['army', 'win', 'shop', 'finance'] },
];

const FIVE_WS = [
  { w: 'Who', text: 'Anyone 18 or over building something of their own: creators, freelancers, students. The creator apps are there if you want them.' },
  { w: 'What', text: 'A daily game for the seven relationships in your life, with the apps a creator needs built in: learn, earn, meet people, sell and stay well.' },
  { w: 'When', text: 'A few minutes a day. Check in, do one small act, tick one task. Then a short look back each week and month.' },
  { w: 'Where', text: 'On your phone or laptop, in the browser. Nothing to install, and you can add it to your home screen. Add an email and your progress follows you.' },
  { w: 'Why', text: 'A career built on burnout does not last. When the seven relationships are strong, the work gets better too.' },
];

const BEFORE = ['Up at three in the morning, editing again', 'Goals in a note you never open', 'Ten apps and no plan', 'Nobody to check in with', 'Money you cannot see coming'];
const AFTER = ['A routine that fits your real day', 'Today’s task moves a big goal', 'One app with only what you use', 'Circles, clubs and a coach who check in', 'All your money in and out, in one place'];

const FREE = ['The daily game: check in, a small act, a task', 'Your seven pillars and the strategy session', 'Every app you switch on, from School to the Shop', 'The assistant’s tap flows, and help any time'];

/** The one line that says what it is and what it costs. Word for word in the hero, the offer and the last button. */
export const TOUCHSTONE = 'One small act a day, for all seven. Free to start, free to stay.';

const eyebrow = 'm-0 type-eyebrow text-ink-mute';
const h2 = 'type-hook mt-xs text-[clamp(32px,7vw,56px)]';

export function Home() {
  const entry = useAppEntry();
  const token = useSession((s) => s.token);
  const start = token ? entry : '/start';
  const stats = useQuery({ queryKey: ['site', 'stats'], queryFn: publicApi.stats });
  const live = stats.data
    ? (
        [
          ['members', stats.data.members],
          ['events coming', stats.data.eventsUpcoming],
          ['opportunities open', stats.data.opportunitiesOpen],
          ['points paid out', stats.data.pointsPaid],
        ] as [string, number][]
      ).filter(([, value]) => value > 0)
    : [];

  return (
    <SiteLayout>
      {/* The hero, read like a poster: the hook from across the room, the context closer, the details at arm's length. */}
      <section className="relative grid gap-lg pt-lg md:grid-cols-2 md:items-center md:pt-xl">
        <HeroBlobs tone="ink" kind="blossom" />
        <div className="@container">
          <p className={eyebrow}>For creators, freelancers and students, 18 and up</p>
          {/* Sized from the column width so each line stays whole. */}
          <h1 className="type-hook mt-sm text-[clamp(40px,13cqw,84px)]">
            Grow your work <em>without losing your life</em>
          </h1>
          <p className="type-context mt-md m-0 max-w-[520px] text-[20px] text-ink-soft">
            Your work is one of seven relationships. When it eats the other six, the work suffers too. kreators.app is a daily game that keeps all seven moving, with the tools a creator needs built in.
          </p>
          <div className="mt-lg flex flex-wrap items-center gap-md">
            <Link to={start} className="toy inline-flex min-h-[56px] items-center rounded-pill bg-ink px-lg text-[18px] font-bold text-on-ink">
              {token ? 'Go to app' : 'Start free'}
            </Link>
            <a href="#story" className="inline-flex min-h-[48px] items-center text-[16px] font-bold underline underline-offset-4 hover:text-ink-soft">
              See how it works
            </a>
          </div>
          <p className="mt-md m-0 text-[14px] font-bold">{TOUCHSTONE}</p>
          <p className="mt-xs m-0 max-w-[520px] text-[14px] font-semibold text-ink-mute">No card. Sign-up asks for a name, an email, a phone number and your birthday, so everyone here is 18 or over. The phone and birthday are never shown to anyone.</p>
        </div>
        <div className="pt-lg md:pt-0">
          <Tower />
        </div>
      </section>

      {/* P: the problem. */}
      <section id="problem" className="mt-2xl scroll-mt-lg" aria-labelledby="problem-heading">
        <motion.div {...rise} className="type-measure">
          <p className={eyebrow}>The problem</p>
          <h2 id="problem-heading" className={h2}>
            The work grows. <em>The rest of your life slips.</em>
          </h2>
          <p className="type-context mt-md m-0 text-[18px] text-ink-soft">
            Creators are told to post more, grow faster and never stop. So the channel grows, and the things that hold a life together slip: sleep, friends, family, health, faith.
          </p>
          <p className="mt-sm m-0 text-[18px] font-bold">It isn’t you. It’s the setup. You are fighting five villains at once, and mostly alone.</p>
        </motion.div>
      </section>

      {/* A: amplify. The villains, and what they cost when nobody stops them. */}
      <section id="villains" className="mt-xl scroll-mt-lg" aria-labelledby="villains-heading">
        <motion.div {...rise} className="type-measure">
          <h2 id="villains-heading" className="type-hook text-[clamp(28px,5vw,40px)]">
            Meet the five villains
          </h2>
          <p className="type-context mt-sm m-0 text-[16px] text-ink-soft">They never arrive all at once. They creep in, one late night at a time. Which of these sounds like your week?</p>
        </motion.div>
        <ul className="bento mt-md list-none p-0 m-0">
          {VILLAINS.map((v, i) => (
            <motion.li key={v.key} {...rise} className={`rounded-card bg-card p-md shadow-toy-soft ${i === 0 ? 'bento-w2 bento-h2 bento-feature' : ''}`}>
              <p className="m-0 text-[32px] leading-none" aria-hidden="true">
                {v.emoji}
              </p>
              <h3 className="mt-sm m-0 text-[22px] text-balance">{v.name}</h3>
              <p className="mt-xs m-0 text-pretty text-[16px] font-semibold">{v.does}</p>
              <p className="mt-sm m-0 text-pretty text-[14px] font-extrabold text-ink-soft">What it costs: {v.costs}</p>
            </motion.li>
          ))}
        </ul>
        <p className="mt-md m-0 text-[16px] font-bold">Here is the good news: each one has a fix, and the setup chat asks which ones you face.</p>
      </section>

      {/* S: the story and the solution. You are the hero; the app is the map and the guides. */}
      <section id="story" className="mt-2xl scroll-mt-lg" aria-labelledby="story-heading">
        <motion.div {...rise} className="rounded-card bg-card p-md shadow-toy-soft md:p-lg">
          <p className={eyebrow}>The story</p>
          <h2 id="story-heading" className={h2}>
            You are the hero. <em>Every hero needs a guide.</em>
          </h2>
          <p className="type-context type-measure mt-md m-0 text-[18px] text-ink-soft">
            kreators.app is not the hero; you are. It is the map, and the guides walk with you: seven characters, one for each relationship in your life, and Bumling, the app’s own guide, who shows you around.
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
          <p className="type-measure mt-lg m-0 text-[16px] font-semibold">
            Picture a Monday. You open the Daily tab, check in, and do one small act for the pillar that needs you most. Then you tick one task. Each pillar is a pyramid standing on its point, so the tick lands on the task and climbs through the project and the goals up to the foundation, the reason you started.
          </p>
          <ol className="bento mt-lg list-none p-0 m-0">
            {[
              ['A short chat', 'Answer three questions, four if you make things. It switches on the apps that fit, and nothing else.'],
              ['Your pillars', 'A short session places your seven relationships on a map and builds a pyramid for the ones that need you most.'],
              ['Three boxes a day', 'Check in, do one small act, tick one task. Every tick climbs a pillar, and your guides grow with you.'],
            ].map(([t, d], i) => (
              <li key={t} className={`rounded-tile bg-paper p-md ${i === 0 ? 'bento-w2' : ''}`}>
                <p className="m-0 type-figure text-[28px] text-ink-mute" aria-hidden="true">
                  0{i + 1}
                </p>
                <h3 className="mt-sm m-0 text-[20px] text-balance">{t}</h3>
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
        <motion.div {...rise} className="type-measure">
          <p className={eyebrow}>The five Ws</p>
          <h2 id="ws-heading" className="type-hook mt-xs text-[clamp(28px,5vw,40px)]">
            Who it’s for, and why
          </h2>
        </motion.div>
        <dl className="bento mt-md m-0">
          {FIVE_WS.map((x, i) => (
            <motion.div key={x.w} {...rise} className={`rounded-card bg-card p-md shadow-toy-soft ${i === 0 || i === 3 || i === 4 ? 'bento-w2' : ''} ${i === 0 ? 'bento-feature' : ''}`}>
              <dt className="type-hook text-[28px]">{x.w}</dt>
              <dd className="mt-xs m-0 text-pretty text-[14px] font-semibold text-ink-soft">{x.text}</dd>
            </motion.div>
          ))}
        </dl>
        <p className="type-measure mt-md m-0 text-[16px] font-semibold text-ink-soft">
          It is not for you if you want a plain calendar or a to-do list. It is for you if you want your work and the rest of your life to move together.
        </p>
      </section>

      {/* The problems we tackle: each villain, how the app beats it, what you get, and the apps that do it. */}
      <section id="tackle" className="mt-2xl scroll-mt-lg" aria-labelledby="tackle-heading">
        <motion.div {...rise} className="flex flex-wrap items-end justify-between gap-sm">
          <div className="type-measure">
            <p className={eyebrow}>The fix</p>
            <h2 id="tackle-heading" className={h2}>
              How you beat each villain
            </h2>
            <p className="type-context mt-sm m-0 text-[16px] text-ink-soft">What the app does about each one, the rule behind it, and what you get out of it.</p>
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
                  <p className="m-0 text-[28px] leading-none" aria-hidden="true">
                    {v.emoji}
                  </p>
                  <h3 className="mt-xs m-0 text-[20px] text-balance">Against {v.name}</h3>
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
        <motion.div {...rise} className="type-measure">
          <p className={eyebrow}>The change</p>
          <h2 id="change-heading" className={h2}>
            What changes
          </h2>
          <p className="type-context mt-sm m-0 text-[16px] text-ink-soft">Today, a tick. On Sunday, your first week review. Each month and each quarter, a look back with the numbers next to the period before.</p>
        </motion.div>
        <div className="bento mt-md">
          <motion.div {...rise} className="bento-w2 rounded-card bg-card p-md shadow-toy-soft">
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
          <motion.div {...rise} className="bento-w2 rounded-card bg-r4 p-md text-on-fill">
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
          {live.map(([label, value]) => (
            <motion.div key={label} {...rise} className={`rounded-tile bg-card p-sm shadow-toy-soft ${live.length < 4 && live[live.length - 1]?.[0] === label ? ['', 'bento-w4', 'bento-w3', 'bento-w2'][live.length] ?? '' : ''}`}>
              <p className="m-0 type-figure text-[28px]">{value.toLocaleString()}</p>
              <p className="mt-xs m-0 text-[12px] font-bold text-ink-soft">{label} <span className="sr-only">live from the app</span></p>
            </motion.div>
          ))}
        </div>
        <Link to="/explore" className="toy toy-soft mt-md inline-flex min-h-[48px] items-center rounded-pill bg-card px-md font-bold">
          See what is open right now
        </Link>
      </section>

      {/* O: the offer. Value, then the price, then the paid parts, then the way out. */}
      <section id="offer" className="mt-2xl scroll-mt-lg" aria-labelledby="offer-heading">
        <motion.div {...rise} className="rounded-card bg-card p-md shadow-toy-soft md:p-lg">
          <p className={eyebrow}>The offer</p>
          <h2 id="offer-heading" className={h2}>
            Free to start. <em>Free to stay.</em>
          </h2>
          <p className="type-context mt-sm m-0 text-[18px] text-ink-soft">{TOUCHSTONE}</p>
          <ul className="bento mt-md list-none p-0 m-0">
            {FREE.map((f, i) => (
              <li key={f} className={`flex items-start gap-xs rounded-tile bg-paper p-sm text-[16px] font-bold ${i === 0 ? 'bento-w2' : i === 3 ? 'bento-w4' : ''}`}>
                <span aria-hidden="true">✓</span>
                {f}
              </li>
            ))}
          </ul>
          <p className="type-measure mt-md m-0 text-pretty text-[14px] font-semibold text-ink-soft">
            Two things cost money, and we say so up front. Typing to the assistant, so it does things for you, needs a plan from US${PLANS.pro.priceCents / 100} for {PLAN_DAYS} days{PAYMENTS_LIVE ? '' : '; plans are not on sale yet, so nothing is charged'}. The Shop takes 5% of each sale you make.{' '}
            <Link to="/pricing" className="font-bold underline underline-offset-4">
              See pricing
            </Link>
          </p>
          <p className="type-measure mt-xs m-0 text-pretty text-[14px] font-semibold text-ink-soft">You can always switch any app off, export your data, erase your progress or delete your account, from the Profile tab.</p>
        </motion.div>
      </section>

      <section id="brands" className="mt-xl scroll-mt-lg" aria-labelledby="brands-heading">
        <motion.div {...rise} className="wash grid gap-md rounded-card bg-card p-md shadow-toy-soft md:grid-cols-[2fr_1fr] md:items-center md:p-lg" style={{ '--wash': 'var(--color-r5)' } as CSSProperties}>
          <div>
            <p className={eyebrow}>{BRAND_PITCH.tagline}</p>
            <h2 id="brands-heading" className="type-hook mt-xs text-[clamp(28px,5vw,40px)]">
              Pay for views that are checked, <em>not claimed</em>
            </h2>
            <p className="mt-sm m-0 text-pretty text-[16px] font-semibold text-ink-soft">{BRAND_PITCH.pitch}</p>
            <div className="mt-md flex flex-wrap gap-sm">
              <Link to="/start" className="toy inline-flex min-h-[48px] items-center rounded-pill bg-ink px-md font-bold text-on-ink">
                Post a brief
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
          <p className={eyebrow}>Fair questions</p>
          <h2 id="faq-heading" className="type-hook mt-xs text-[clamp(28px,5vw,40px)]">
            Questions people ask
          </h2>
        </motion.div>
        <div className="mt-md grid gap-xs md:grid-cols-2">
          {SITE_FAQ.map((f) => (
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
      <section className="mt-2xl" aria-labelledby="start-heading">
        <motion.div {...rise} className="rounded-card bg-ink p-md text-on-ink md:p-lg">
          <div className="flex flex-wrap gap-xs" aria-hidden="true">
            {RELATIONSHIPS.map((r) => (
              <Avatar key={r.key} relationship={r.key} size={36} decorative />
            ))}
          </div>
          <h2 id="start-heading" className="type-hook mt-md text-[clamp(32px,7vw,64px)] text-on-ink">
            The villains have had enough time. <em>Your turn.</em>
          </h2>
          <p className="type-context mt-sm m-0 text-[18px] text-on-ink/80">{TOUCHSTONE}</p>
          <Link to={start} className="toy mt-md inline-flex min-h-[56px] items-center rounded-pill bg-card px-lg text-[18px] font-bold text-ink">
            {token ? 'Go to app' : 'Start free'}
          </Link>
          <ol className="mt-md flex list-none flex-col gap-xs p-0 m-0 text-[14px] font-semibold text-on-ink/80 sm:flex-row sm:gap-md">
            <li>1. Answer three questions.</li>
            <li>2. We switch on the apps that fit.</li>
            <li>3. Tick your first box today.</li>
          </ol>
          <p className="mt-sm m-0 text-[12px] font-semibold text-on-ink/70">If it is not for you, delete your account from the Profile tab. Your journal, your pyramids and your personal details go with it.</p>
        </motion.div>
      </section>
    </SiteLayout>
  );
}
