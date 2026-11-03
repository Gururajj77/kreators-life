import type { CSSProperties } from 'react';
import { BUMLING, characterTitle, MODULE_BY_KEY, PAYMENTS_LIVE, PLAN_DAYS, PLANS, RELATIONSHIPS, type RelationshipKey } from '@kreators/shared';
import { useQuery } from '@tanstack/react-query';
import { HeroBlobs } from '../components/Hero';
import { motion } from 'motion/react';
import { Link } from 'react-router';
import { Avatar } from '../components/Avatar';
import { BackgroundPaths } from '../components/fx/BackgroundPaths';
import { BorderBeam } from '../components/fx/BorderBeam';
import { CountUp } from '../components/fx/CountUp';
import { Magnet } from '../components/fx/Magnet';
import { Marquee } from '../components/fx/Marquee';
import { SpotlightCard } from '../components/fx/SpotlightCard';
import { TextReveal } from '../components/fx/TextReveal';
import { publicApi } from '../lib/api';
import { useSession } from '../lib/store';
import { BRAND_PITCH, FEATURES, SITE_FAQ, SITE_FEATURES } from './content';
import { Tower, useRise } from './SevenRP';
import { SiteLayout, useAppEntry } from './SiteLayout';
import { BatteryLow, Check, Hourglass, MessageSquareDashed, Puzzle, Tornado, X } from 'lucide-react';
import { AnimatedIcon } from '../components/AnimatedIcon';
import { AppIcon } from '../components/AppIcon';
import { Icon } from '../components/Icon';
import { Fold } from '../components/Fold';
import { GuideLine } from './GuideLine';
import { PosterPanel } from './PosterPanel';

/**
 * The landing page tells one story, in the PASTOR order: the problem, what it costs (the villains), the story and the
 * solution (you are the hero, the app is the guide), the change it makes, the offer, and the one thing to do next.
 * The five Ws sit in the middle, so nobody has to guess who it is for, what it is, when, where or why. The seven
 * relationships live on /7rp and every feature on /features; this page is only about why kreators.app is worth it.
 */

/** The five villains every creator meets. Each one has an answer in the app, below. */
const VILLAINS = [
  {
    key: 'grind',
    name: 'The Grind',
    icon: Tornado,
    does: 'Says one more video, one more hour. It takes your sleep first, then your mornings, then your mood.',
    costs: 'Tired work, and less of it.',
  },
  {
    key: 'scatter',
    name: 'The Scatter',
    icon: Puzzle,
    does: 'Ten apps, ten logins, and nothing talks to anything. Courses, gigs, money and notes all live in different places.',
    costs: 'Hours lost looking, and chances you never see.',
  },
  {
    key: 'silence',
    name: 'The Silence',
    icon: MessageSquareDashed,
    does: 'You work alone in your room. Nobody checks in, cheers you on or tells you the truth.',
    costs: 'Doubt grows fast when nobody is around.',
  },
  {
    key: 'drift',
    name: 'The Drift',
    icon: Hourglass,
    does: 'Days pass. Goals sit in a note you never open. You feel busy, but nothing moves.',
    costs: 'A year goes by, and you are in the same place.',
  },
  {
    key: 'squeeze',
    name: 'The Squeeze',
    icon: BatteryLow,
    does: 'Money comes in bits, late, or not at all. Brands want views; you want rent.',
    costs: 'Stress that leaks into the rest of your life.',
  },
] as const;

/** How the app beats each villain: what it does (a rule the code keeps), what you get, and the apps that do it. */
const ANSWERS: {
  villain: (typeof VILLAINS)[number]['key'];
  pillar: RelationshipKey;
  poster: [string, string];
  how: string;
  benefit: string;
  apps: string[];
}[] = [
  {
    villain: 'grind',
    pillar: 'self',
    poster: ['Keep your energy.', 'So the work lasts.'],
    how: 'A routine built from your real day, with a wake time that moves thirty minutes a week. Trackers for sleep, mood and stress feed a daily brief that tells you when sleep starts to dip. Focus sessions come with breaks and a quiet sound, and you rate how focused you were.',
    benefit: 'You keep your energy, so your best work lasts.',
    apps: ['today', 'life', 'sleep', 'mindful'],
  },
  {
    villain: 'scatter',
    pillar: 'guru',
    poster: ['One place.', 'One login.'],
    how: 'Learning, paid work, brand campaigns, your clients, your shop and your money in one app. Only a few apps are on to start, the setup chat picks up to five more that fit, and you can switch any of them off.',
    benefit: 'One place and one login, so nothing slips past you.',
    apps: ['school', 'work', 'agency', 'shop', 'finance'],
  },
  {
    villain: 'silence',
    pillar: 'friendship',
    poster: ['People in your corner.', 'Every week.'],
    how: 'Small circles near you, run clubs, events and a kind community. A life coach too, if you want one, who sees only what you switch on and never your journal. And card games to play with the people you are with, so a first meeting never starts with silence.',
    benefit: 'People in your corner, every week.',
    apps: ['circles', 'run', 'party', 'community', 'cards', 'coaching'],
  },
  {
    villain: 'drift',
    pillar: 'divine',
    poster: ['A big goal.', 'One tick today.'],
    how: 'Seven pillars, each a pyramid from a foundation you will not let break down to the task for today. A task can only be ticked from its do date, and it can carry a priority, a deadline and subtasks, or repeat as a habit. Plan my week spreads your tasks over seven days and shows how strong the plan is. Reviews each week and month show what moved, and you can plan the next one on a calendar and get a reminder. A quiz shows your strengths, and your next steps on Home start to fit you.',
    benefit: 'A big goal becomes one box you can tick today.',
    apps: ['tower', 'discover', 'reviews', 'journal'],
  },
  {
    villain: 'squeeze',
    pillar: 'servant_leader',
    poster: ['See every way in.', 'And all that comes in.'],
    how: 'Paid gigs and brand campaigns. Win pays for every verified view, once a reviewer checks it. Your own shop takes 5% of a sale and nothing up front. For client work, Agency designs the invoice, works out GST and TDS, and keeps the agreement and the approvals with it. All your money sits in one picture.',
    benefit: 'You see every way in, and everything that comes in.',
    apps: ['army', 'win', 'agency', 'shop', 'finance'],
  },
];

const FIVE_WS = [
  {
    w: 'Who',
    text: 'Anyone 18 or over building something of their own: creators, freelancers, small agencies and students. The creator apps are there if you want them.',
  },
  {
    w: 'What',
    text: 'A daily game for the seven relationships in your life, with the apps a creator needs built in: learn, earn, run client work, meet people, sell and stay well.',
  },
  {
    w: 'When',
    text: 'A few minutes a day. Check in, do one small act, tick one task. Then a short look back each week and month.',
  },
  {
    w: 'Where',
    text: 'On your phone or laptop, in the browser. Nothing to install, and you can add it to your home screen. Add an email and your progress follows you.',
  },
  {
    w: 'Why',
    text: 'A career built on burnout does not last. When the seven relationships are strong, the work gets better too.',
  },
];

const BEFORE = ['Up at three in the morning, editing again', 'Goals in a note you never open', 'Ten apps and no plan', 'Nobody to check in with', 'Money you cannot see coming'];
const AFTER = [
  'A routine that fits your real day',
  'Today’s task moves a big goal',
  'One app with only what you use',
  'Circles, clubs and a coach who check in',
  'All your money in and out, in one place',
];

const FREE = [
  'The daily game: check in, a small act, a task',
  'Your seven pillars and the strategy session',
  'Every app you switch on, from School to Agency and the Shop',
  'The assistant’s tap flows, and help any time',
];

/** The one line that says what it is and what it costs. Word for word in the hero, the offer and the last button. */
export const TOUCHSTONE = 'One small act a day, for all seven. Free to start, free to stay.';

const eyebrow = 'm-0 type-eyebrow text-ink-mute';
const h2 = 'type-hook mt-xs text-[clamp(32px,7vw,56px)]';

export function Home() {
  const entry = useAppEntry();
  const rise = useRise();
  const token = useSession((s) => s.token);
  const start = token ? entry : '/start';
  const stats = useQuery({
    queryKey: ['site', 'stats'],
    queryFn: publicApi.stats,
  });
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
      <section className="relative isolate grid gap-lg pt-lg md:grid-cols-2 md:items-center md:pt-xl">
        <BackgroundPaths />
        <HeroBlobs tone="ink" kind="blossom" />
        <div className="@container">
          <p className={eyebrow}>For creators, freelancers, small agencies and students, 18 and up</p>
          {/* Sized from the column width so each line stays whole. */}
          <h1 className="type-hook mt-sm text-[clamp(40px,13cqw,84px)]">
            <TextReveal parts={[{ text: 'Grow your work' }, { text: 'without losing your life', em: true }]} />
          </h1>
          <p className="type-context mt-md m-0 max-w-[520px] text-[20px] text-ink-soft">
            Your work is one of seven relationships. When it eats the other six, the work suffers too. kreators.app is a daily game that keeps all seven moving, with the tools a
            creator needs built in.
          </p>
          <div className="mt-lg flex flex-wrap items-center gap-md">
            <Magnet>
              <Link to={start} className="toy fx-shimmer fx-shimmer-intro inline-flex min-h-[56px] items-center rounded-pill bg-ink px-lg text-[18px] font-bold text-on-ink">
                {token ? 'Go to app' : 'Start free'}
              </Link>
            </Magnet>
            <a href="#story" className="inline-flex min-h-[48px] items-center gap-xs text-[16px] font-bold underline underline-offset-4 hover:text-ink-soft">
              <AnimatedIcon name="scrollDown" size={24} />
              See how it works
            </a>
          </div>
          <p className="mt-md m-0 text-[14px] font-bold">{TOUCHSTONE}</p>
          <p className="mt-xs m-0 max-w-[520px] text-[14px] font-semibold text-ink-mute">
            No card. Sign-up asks for a name, an email, a phone number and your birthday, so everyone here is 18 or over. The phone and birthday are never shown to anyone.
          </p>
        </div>
        <div className="pt-lg md:pt-0">
          <Tower />
        </div>
      </section>

      {/* Every app, drifting past: real names from the feature list, each opening its own page. */}
      <div className="mt-xl">
        <Marquee label="Every app inside kreators.app" duration={Math.max(60, SITE_FEATURES.length * 3)}>
          {SITE_FEATURES.map((m) => (
            <li key={m.key}>
              <Link
                to={`/features/${m.key}`}
                title={FEATURES[m.key]?.tagline}
                className="inline-flex min-h-[44px] items-center gap-xs whitespace-nowrap rounded-pill border border-line bg-card-strong px-sm text-[14px] font-bold text-ink-soft transition-colors hover:text-ink"
              >
                <AppIcon name={m.icon} size={16} />
                {m.name}
              </Link>
            </li>
          ))}
        </Marquee>
      </div>

      <GuideLine host={BUMLING.key} className="mt-xl">
        Hi, I’m Bumling. Tell me what gets in your way, and I’ll switch on only the apps that fit.
      </GuideLine>

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
        <GuideLine host="self" mood="sleepy" className="mt-lg">
          Be honest with me. When did you last sleep before midnight?
        </GuideLine>
      </section>

      {/* A: amplify. The villains, and what they cost when nobody stops them. */}
      <section id="villains" className="mt-xl scroll-mt-lg" aria-labelledby="villains-heading">
        <motion.div {...rise} className="type-measure">
          <h2 id="villains-heading" className="type-hook text-[clamp(28px,5vw,40px)]">
            Meet the five villains
          </h2>
          <p className="type-context mt-sm m-0 text-[16px] text-ink-soft">
            They never arrive all at once. They creep in, one late night at a time. Which of these sounds like your week?
          </p>
        </motion.div>
        <GuideLine host="servant_leader" side="right" mood="neutral" className="mt-md">
          Five villains creep into a creator’s week. Which ones do you know?
        </GuideLine>
        <ul className="bento mt-md list-none p-0 m-0">
          {VILLAINS.map((v, i) => (
            <SpotlightCard as="li" index={i} key={v.key} className={`rounded-card bg-card p-md shadow-toy-soft ${i === 0 ? 'bento-w2 bento-h2 bento-feature flex flex-col' : ''}`}>
              <p className="m-0 flex text-ink-soft">
                <Icon icon={v.icon} size={32} />
              </p>
              <h3 className="mt-sm m-0 text-[22px] text-balance">{v.name}</h3>
              <p className="mt-xs m-0 text-balance text-[16px] font-semibold">{v.does}</p>
              <p className="mt-sm m-0 text-balance text-[14px] font-extrabold text-ink-soft">What it costs: {v.costs}</p>
              {/* The feature cell is two rows tall: its villain's mark fills the room at the foot, faint. */}
              {i === 0 && (
                <p className="mt-auto m-0 flex justify-end pt-md text-ink-mute opacity-40" aria-hidden="true">
                  <Icon icon={v.icon} size={160} strokeWidth={1.25} />
                </p>
              )}
            </SpotlightCard>
          ))}
        </ul>
        <p className="mt-md m-0 text-[16px] font-bold">Here is the good news: each one has a fix, and the setup chat asks which ones you face.</p>
      </section>

      {/* S: the story and the solution. You are the hero; the app is the map and the guides. */}
      <section id="story" className="mt-2xl scroll-mt-lg" aria-labelledby="story-heading">
        <GuideLine host={BUMLING.key} mood="excited" className="mb-md">
          You do the work. I hold the map, and seven guides walk with you, one for each relationship.
        </GuideLine>
        <motion.div {...rise} className="rounded-card bg-card p-md shadow-toy-soft md:p-lg">
          <p className={eyebrow}>The story</p>
          <h2 id="story-heading" className={h2}>
            You are the hero. <em>Every hero needs a guide.</em>
          </h2>
          <p className="type-context type-measure mt-md m-0 text-[18px] text-ink-soft">
            kreators.app is not the hero; you are. It is the map, and the guides walk with you: seven characters, one for each relationship in your life, and Bumling, the app’s own
            guide, who shows you around.
          </p>
          <ul className="mt-md grid list-none grid-cols-1 gap-xs p-0 m-0 sm:grid-cols-2 lg:grid-cols-4" aria-label="Your guides">
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
            Picture a Monday. You open the Daily tab, check in, and do one small act for the pillar that needs you most. Then you tick one task. Each pillar is a pyramid standing
            on its point, so the tick lands on the task and climbs through the project and the goals up to the foundation, the reason you started.
          </p>
          <ol className="bento mt-lg list-none p-0 m-0">
            {[
              ['A short chat', 'Answer a few questions. It switches on the apps that fit, and nothing else.'],
              ['Your pillars', 'A short session places your seven relationships on a map and builds a pyramid for the ones that need you most.'],
              ['Three boxes a day', 'Check in, do one small act, tick one task. Every tick climbs a pillar, and your guides grow with you.'],
            ].map(([t, d], i) => (
              <SpotlightCard as="li" index={i} key={t} className={`rounded-tile bg-paper p-md ${i === 0 ? 'bento-w2' : ''}`}>
                <p className="m-0 type-figure text-[28px] text-ink-mute" aria-hidden="true">
                  0{i + 1}
                </p>
                <h3 className="mt-sm m-0 text-[20px] text-balance">{t}</h3>
                <p className="mt-xs m-0 text-balance text-[14px] font-semibold text-ink-soft">{d}</p>
              </SpotlightCard>
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
        <GuideLine host="guru" side="right" className="mt-md">
          Good questions deserve plain answers. Here are five of them.
        </GuideLine>
        <dl className="bento mt-md m-0">
          {FIVE_WS.map((x, i) => (
            <SpotlightCard
              index={i}
              key={x.w}
              className={`rounded-card bg-card p-md shadow-toy-soft ${i === 0 || i === 3 || i === 4 ? 'bento-w2' : ''} ${i === 0 ? 'bento-feature' : ''}`}
            >
              <dt className="type-hook text-[28px]">{x.w}</dt>
              <dd className="mt-xs m-0 text-balance text-[14px] font-semibold text-ink-soft">{x.text}</dd>
            </SpotlightCard>
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
        <ul className="mt-md flex list-none flex-col gap-lg p-0 m-0">
          {ANSWERS.map((a, ai) => {
            const v = VILLAINS.find((x) => x.key === a.villain)!;
            // The rule behind the fix, one short sentence a line, each with a tick.
            const lines = a.how.split(/(?<=\.)\s+/).filter(Boolean);
            const flip = ai % 2 === 1;
            const apps = a.apps.filter((k) => FEATURES[k] && MODULE_BY_KEY[k]);
            return (
              <motion.li {...rise} key={a.villain} className="grid gap-md rounded-card bg-card p-sm shadow-toy-soft md:grid-cols-2 md:items-stretch md:p-md">
                <PosterPanel pillar={a.pillar} title={a.poster[0]} quiet={a.poster[1]} className={flip ? 'md:order-2' : ''}>
                  Against {v.name}
                </PosterPanel>
                <div className="p-xs md:p-sm">
                  <h3 className="m-0 flex items-center gap-xs text-[20px] text-balance">
                    <Icon icon={v.icon} size={24} className="text-ink-soft" />
                    How you beat {v.name}
                  </h3>
                  <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
                    {lines.map((l) => (
                      <li key={l} className="flex items-start gap-xs text-[16px] font-semibold">
                        <Icon icon={Check} size={20} className="mt-[2px]" color={`var(--deep-${a.pillar})`} />
                        <span className="min-w-0">{l}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-sm m-0 text-balance text-[16px] font-extrabold">{a.benefit}</p>
                  {/* A grid, not a wrapping row, so no app is ever left alone on the last line: an odd last one takes the row on a phone. */}
                  <ul className={`mt-sm grid list-none grid-cols-2 gap-xs p-0 m-0 ${apps.length === 4 ? '' : 'sm:grid-cols-3'}`} aria-label="The apps that do it">
                    {apps.map((k, i) => (
                      <li key={k} className={i === apps.length - 1 && apps.length % 2 === 1 ? 'col-span-2 sm:col-span-1' : ''}>
                        <Link
                          to={`/features/${k}`}
                          title={FEATURES[k]?.tagline}
                          className="toy toy-soft flex min-h-[44px] w-full items-center gap-xs rounded-pill bg-paper px-sm text-[14px] font-bold"
                        >
                          <AppIcon name={MODULE_BY_KEY[k]?.icon} size={16} />
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
          <p className="type-context mt-sm m-0 text-[16px] text-ink-soft">
            Today, a tick. On Sunday, your first week review, planned on a calendar with a reminder. Each month and each quarter, a look back with the numbers next to the period
            before.
          </p>
        </motion.div>
        <GuideLine host="lover_partner" className="mt-md">
          Small ticks add up. Look back after a week, and you will see what moved.
        </GuideLine>
        <div className="bento mt-md">
          <motion.div {...rise} className="bento-w2 rounded-card bg-card p-md shadow-toy-soft">
            <h3 className="m-0 text-[20px] text-ink-soft text-balance">Before</h3>
            <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
              {BEFORE.map((b) => (
                <li key={b} className="flex items-start gap-xs text-[16px] font-semibold text-ink-soft">
                  <Icon icon={X} size={20} className="mt-[2px]" />
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
                  <Icon icon={Check} size={20} className="mt-[2px]" />
                  {b}
                </li>
              ))}
            </ul>
          </motion.div>
          {live.map(([label, value]) => (
            <SpotlightCard
              index={1}
              key={label}
              className={`rounded-tile bg-card p-sm shadow-toy-soft ${live.length < 4 && live[live.length - 1]?.[0] === label ? (['', 'bento-w4', 'bento-w3', 'bento-w2'][live.length] ?? '') : ''}`}
            >
              <p className="m-0 type-figure text-[28px]">
                <CountUp value={value} format={(n) => n.toLocaleString()} />
              </p>
              <p className="mt-xs m-0 text-[12px] font-bold text-ink-soft">
                {label} <span className="sr-only">live from the app</span>
              </p>
            </SpotlightCard>
          ))}
        </div>
        <Link to="/explore" className="toy toy-soft mt-md inline-flex min-h-[48px] items-center rounded-pill bg-card px-md font-bold">
          See what is open right now
        </Link>
      </section>

      {/* O: the offer. Value, then the price, then the paid parts, then the way out. */}
      <section id="offer" className="mt-2xl scroll-mt-lg" aria-labelledby="offer-heading">
        <GuideLine host="parent_child" side="right" mood="excited" className="mb-md">
          No card, no catch. The daily game is free, and it stays free.
        </GuideLine>
        <motion.div {...rise} className="relative rounded-card bg-card p-md shadow-toy-soft md:p-lg">
          <BorderBeam />
          <p className={eyebrow}>The offer</p>
          <h2 id="offer-heading" className={h2}>
            Free to start. <em>Free to stay.</em>
          </h2>
          <p className="type-context mt-sm m-0 text-[18px] text-ink-soft">{TOUCHSTONE}</p>
          <ul className="bento mt-md list-none p-0 m-0">
            {FREE.map((f, i) => (
              <li key={f} className={`flex items-start gap-xs rounded-tile bg-paper p-sm text-[16px] font-bold ${i === 0 ? 'bento-w2' : i === 3 ? 'bento-w4' : ''}`}>
                <Icon icon={Check} size={20} className="mt-[2px]" />
                {f}
              </li>
            ))}
          </ul>
          <p className="type-measure mt-md m-0 text-balance text-[14px] font-semibold text-ink-soft">
            Two things cost money, and we say so up front. Typing to the assistant, so it does things for you, needs a plan from US$
            {PLANS.pro.priceCents / 100} for {PLAN_DAYS} days
            {PAYMENTS_LIVE ? '' : '; plans are not on sale yet, so nothing is charged'}. The Shop takes 5% of each sale you make.{' '}
            <Link to="/pricing" className="font-bold underline underline-offset-4">
              See pricing
            </Link>
          </p>
          <p className="type-measure mt-xs m-0 text-balance text-[14px] font-semibold text-ink-soft">
            You can always switch any app off, export your data, erase your progress or delete your account, from the Profile tab.
          </p>
        </motion.div>
      </section>

      <section id="brands" className="mt-xl scroll-mt-lg" aria-labelledby="brands-heading">
        <motion.div
          {...rise}
          className="wash grid gap-md rounded-card bg-card p-md shadow-toy-soft md:grid-cols-[2fr_1fr] md:items-center md:p-lg"
          style={{ '--wash': 'var(--color-r5)' } as CSSProperties}
        >
          <div>
            <p className={eyebrow}>{BRAND_PITCH.tagline}</p>
            <h2 id="brands-heading" className="type-hook mt-xs text-[clamp(28px,5vw,40px)]">
              Pay for views that are checked, <em>not claimed</em>
            </h2>
            <p className="mt-sm m-0 text-balance text-[16px] font-semibold text-ink-soft">{BRAND_PITCH.pitch}</p>
            <div className="mt-md flex flex-wrap gap-sm">
              <Link to="/start" className="toy inline-flex min-h-[48px] items-center rounded-pill bg-ink px-md font-bold text-on-ink">
                Post a brief
              </Link>
              <Link to="/features/win" className="toy toy-ink inline-flex min-h-[48px] items-center rounded-pill border-2 border-ink bg-card px-md font-bold">
                How content rewards pay
              </Link>
              <Link to="/features/agency" className="toy toy-ink inline-flex min-h-[48px] items-center rounded-pill border-2 border-ink bg-card px-md font-bold">
                Run client work
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
        <GuideLine host="friendship" className="mt-md">
          Not sure yet? That is fair. Here is what people ask first.
        </GuideLine>
        <div className="mt-md grid gap-xs md:grid-cols-2">
          {SITE_FAQ.map((f) => (
            <Fold key={f.q} title={f.q}>
              <p className="prose-long m-0 px-sm pb-sm text-[14px] font-semibold text-ink-soft">{f.a}</p>
            </Fold>
          ))}
        </div>
      </section>

      {/* R: the response. One thing to do next. */}
      <section className="mt-2xl" aria-labelledby="start-heading">
        <motion.div {...rise} className="relative overflow-hidden rounded-card bg-ink p-md pb-0 text-on-ink md:p-lg md:pb-0">
          <BorderBeam />
          <h2 id="start-heading" className="type-hook text-[clamp(32px,7vw,64px)] text-on-ink">
            The villains have had enough time. <em>Your turn.</em>
          </h2>
          <p className="type-context mt-sm m-0 text-[18px] text-on-ink/80">{TOUCHSTONE}</p>
          <div className="mt-md">
            <Magnet>
              <Link to={start} className="toy fx-shimmer inline-flex min-h-[56px] items-center rounded-pill bg-card px-lg text-[18px] font-bold text-ink">
                {token ? 'Go to app' : 'Start free'}
              </Link>
            </Magnet>
          </div>
          <ol className="mt-md flex list-none flex-col gap-xs p-0 m-0 text-[14px] font-semibold text-on-ink/80 sm:flex-row sm:gap-md">
            <li>1. Answer a few questions.</li>
            <li>2. We switch on the apps that fit.</li>
            <li>3. Tick your first box today.</li>
          </ol>
          <p className="mt-sm m-0 text-[12px] font-semibold text-on-ink/70">
            If it is not for you, delete your account from the Profile tab. Your journal, your pyramids and your personal details go with it.
          </p>
          {/* The seven peek up from the card's bottom edge: drawn whole, the card clips their lower half. */}
          <div className="peek-row mt-lg flex justify-center gap-xs sm:gap-md" aria-hidden="true">
            {RELATIONSHIPS.map((r, i) => (
              // Each takes a seventh of the row up to 72px, so all seven fit a phone and none is cut at the side.
              <div key={r.key} className="peek-guide w-[12%] max-w-[72px]" style={{ '--peek-delay': `${i * 0.12}s` } as CSSProperties}>
                <Avatar relationship={r.key} size={72} mood={i % 2 ? 'happy' : 'excited'} decorative className="block h-auto w-full" />
              </div>
            ))}
          </div>
        </motion.div>
      </section>
    </SiteLayout>
  );
}
