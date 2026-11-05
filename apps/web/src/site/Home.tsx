import type { CSSProperties } from 'react';
import { BOOK_AUTHOR, BUMLING, formatCount, MODULE_BY_KEY, PAYMENTS_LIVE, planPriceLabel, RELATIONSHIPS, type RelationshipKey } from '@kreators/shared';
import { useQuery } from '@tanstack/react-query';
import { HeroBlobs } from '../components/Hero';
import { m as motion } from 'motion/react';
import { Link } from 'react-router';
import { Avatar } from '../components/Avatar';
import { FractalGlass } from '../components/fx/FractalGlass';
import { LiquidMetal } from '../components/fx/LiquidMetal';
import { MorphShapes } from '../components/fx/MorphShapes';
import { BorderBeam } from '../components/fx/BorderBeam';
import { CountUp } from '../components/fx/CountUp';
import { Magnet } from '../components/fx/Magnet';
import { SpotlightCard } from '../components/fx/SpotlightCard';
import { TextReveal } from '../components/fx/TextReveal';
import { publicApi } from '../lib/api';
import { useSession } from '../lib/store';
import { BRAND_PITCH, FEATURES, SITE_FAQ, SITE_FEATURES } from './content';
import { Tower, useRise } from './SevenRP';
import { SiteLayout, useAppEntry } from './SiteLayout';
import { ArrowDown, BatteryLow, Check, Hourglass, MessageSquareDashed, Puzzle, Tornado, X } from 'lucide-react';
import { AppIcon } from '../components/AppIcon';
import { Icon } from '../components/Icon';
import { CardHead } from '../components/CardHead';
import { Fold } from '../components/Fold';
import { GuideLine } from './GuideLine';
import { PosterPanel } from './PosterPanel';
import { useBookEntry } from './Books';
import { BookShelf } from '../components/BookShelf';
import { SiteArrow, SITE_CHIP, SITE_LINK, SITE_LINK_INLINE, SITE_PRIMARY, SITE_PRIMARY_ON_GLASS, SITE_SECONDARY } from './buttons';

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
    does: 'One more video, one more hour. It takes your sleep first.',
    costs: 'Tired work, and less of it.',
  },
  {
    key: 'scatter',
    name: 'The Scatter',
    icon: Puzzle,
    does: 'Ten apps, ten logins, and nothing talks to anything.',
    costs: 'Hours lost looking, and chances missed.',
  },
  {
    key: 'silence',
    name: 'The Silence',
    icon: MessageSquareDashed,
    does: 'You work alone. Nobody checks in or tells you the truth.',
    costs: 'Doubt grows fast.',
  },
  {
    key: 'drift',
    name: 'The Drift',
    icon: Hourglass,
    does: 'Goals sit in a note you never open, and nothing moves.',
    costs: 'A year goes by in the same place.',
  },
  {
    key: 'squeeze',
    name: 'The Squeeze',
    icon: BatteryLow,
    does: 'Money comes late, or not at all. Brands want views; you want rent.',
    costs: 'Stress that leaks into everything.',
  },
] as const;

/** A few app buttons under the answers say what the app is in plainer words (2026-11-04); the app keeps its own name everywhere else. */
const APP_CHIP_LABEL: Partial<Record<string, string>> = { run: 'Run club' };

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
    how: 'A routine built from your real day, with a wake time that moves thirty minutes a week. Sleep, mood and stress feed a daily brief that says when sleep starts to dip. Focus sessions come with breaks, a quiet sound and a rating.',
    benefit: 'You keep your energy, so your best work lasts.',
    apps: ['today', 'life', 'sleep', 'mindful'],
  },
  {
    villain: 'scatter',
    pillar: 'guru',
    poster: ['One place.', 'One login.'],
    how: 'Learning, paid work, brand campaigns, your clients, your shop and your money in one app. Only a few apps are on to start. The setup chat picks up to five more that fit, and you can switch any off.',
    benefit: 'One place and one login, so nothing slips past you.',
    apps: ['agency', 'school', 'work', 'shop', 'finance'],
  },
  {
    villain: 'silence',
    pillar: 'friendship',
    poster: ['People in your corner.', 'Every week.'],
    how: 'Small circles near you, run clubs, events and a kind community. A life coach if you want one, who sees only what you switch on and never your journal. Card games, so a first meeting never starts with silence.',
    benefit: 'People in your corner, every week.',
    apps: ['circles', 'run', 'party', 'community', 'cards', 'coaching'],
  },
  {
    villain: 'drift',
    pillar: 'divine',
    poster: ['A big goal.', 'One tick today.'],
    how: 'Seven pillars, each a pyramid from a foundation you will not let break down to today’s task. A task can only be ticked from its do date. Plan my week spreads your tasks over seven days. Reviews each week and month show what moved. A quiz shows your strengths, so your next steps fit you.',
    benefit: 'A big goal becomes one box you can tick today.',
    apps: ['tower', 'discover', 'reviews', 'journal'],
  },
  {
    villain: 'squeeze',
    pillar: 'servant_leader',
    poster: ['See every way in.', 'And all that comes in.'],
    how: 'Paid gigs and brand campaigns. Win pays for every verified view, once a reviewer checks it. Your own shop takes 5% of a sale and nothing up front. Agency makes the client invoice, with GST and TDS worked out. All your money sits in one picture.',
    benefit: 'You see every way in, and everything that comes in.',
    apps: ['army', 'agency', 'shop', 'win', 'finance'],
  },
];

const FIVE_WS = [
  {
    w: 'Who',
    text: 'Anyone 18 or over building something of their own: creators, freelancers, small agencies and students.',
  },
  {
    w: 'What',
    text: 'A daily game for the seven relationships, with a creator’s apps built in.',
  },
  {
    w: 'When',
    text: 'A few minutes a day, and a short look back each week and month.',
  },
  {
    w: 'Where',
    text: 'On your phone or laptop, in the browser. Nothing to install.',
  },
  {
    w: 'Why',
    text: 'Let one relationship slide and the others feel it. Keep all seven moving and the work gets better too.',
  },
];

const BEFORE = ['Up at three, editing again', 'Goals in a note you never open', 'Ten apps and no plan', 'Nobody to check in with', 'Money you cannot see coming'];
const AFTER = ['A routine that fits your real day', 'Today’s task moves a big goal', 'One app, only what you use', 'Circles, clubs and a coach who check in', 'All your money in one place'];

const FREE = [
  'The daily game: check in, a small act, a task',
  'Your seven pillars and the strategy session',
  'Every app you switch on, from School to Agency',
  'The assistant’s tap flows, and Help',
];

/** The one line that says what it is and what it costs. Word for word in the hero, the offer and the last button. */
export const TOUCHSTONE = 'One small act a day, for all seven. Free to start, free to stay.';

const eyebrow = 'm-0 type-eyebrow text-ink-mute';

/** The rule behind a fix, one short sentence a line, each with a tick in the pillar's colour. */
function HowLines({ lines, pillar }: { lines: string[]; pillar: RelationshipKey }) {
  return (
    <ul className="m-0 flex list-none flex-col gap-xs p-0">
      {lines.map((l) => (
        <li key={l} className="flex items-start gap-xs text-callout">
          <Icon icon={Check} size={20} className="mt-[2px]" color={`var(--deep-${pillar})`} />
          <span className="min-w-0">{l}</span>
        </li>
      ))}
    </ul>
  );
}

function BrandMore() {
  return (
    <ul className="m-0 grid list-disc gap-xs pl-md text-callout text-ink-soft">
      {BRAND_PITCH.more.map((t) => (
        <li key={t}>{t}</li>
      ))}
    </ul>
  );
}
const h2 = 'type-hook mt-xs text-display-2';

export function Home() {
  const entry = useAppEntry();
  const rise = useRise();
  const token = useSession((s) => s.token);
  const start = token ? entry : '/start';
  const bookEntry = useBookEntry();
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
      {/* The page's own background: one layer behind the whole page, so the hero never reads as a band of its own. */}
      <MorphShapes page />
      {/* The hero, read like a poster: the hook from across the room, the context closer, the details at arm's length. */}
      <section className="relative isolate grid gap-lg pt-lg md:grid-cols-2 md:items-center md:pt-xl">
        <HeroBlobs tone="ink" kind="blossom" />
        <div className="@container">
          <p className={eyebrow}>For creators, freelancers, agencies and students, 18 and up</p>
          {/* Sized from the column width so each line stays whole. */}
          <h1 className="type-hook mt-sm text-display-1">
            <TextReveal parts={[{ text: 'Grow your work' }, { text: 'without losing your life', em: true }]} />
          </h1>
          {/* One line's worth on a phone; a laptop has room for the why. Same meaning both ways. */}
          <p className="type-context mt-md m-0 max-w-[520px] text-lede text-ink-soft">
            Your work is one of seven relationships.<span className="hidden md:inline"> When it eats the other six, the work suffers too.</span> kreators.app is a daily game
            that keeps all seven moving<span className="hidden md:inline">, with the tools a creator needs built in</span>.
          </p>
          <div className="mt-lg flex flex-wrap items-center gap-md">
            <Magnet>
              <LiquidMetal>
                <Link to={start} className={`${SITE_PRIMARY} fx-shimmer-intro`}>
                  {token ? 'Go to app' : 'Start free'}
                </Link>
              </LiquidMetal>
            </Magnet>
            <a href="#story" className={`${SITE_LINK} text-callout`}>
              {/* A plain arrow: the animated mouse showed as an empty outline at rest. */}
              <Icon icon={ArrowDown} size={20} />
              See how it works
            </a>
          </div>
          <p className="mt-md m-0 text-subhead font-medium">{TOUCHSTONE}</p>
          <p className="mt-xs m-0 max-w-[520px] text-subhead text-ink-mute">
            No card. We ask your phone and birthday so everyone here is 18 or over. Nobody else ever sees them.
          </p>
          {/* The app list was a drifting band of pills here (the founder: "cluttered from the start"); one quiet line in the link look instead. */}
          <p className="mt-xs m-0 max-w-[520px] text-subhead text-ink-mute">
            {formatCount(SITE_FEATURES.length)} apps, each one a switch.{' '}
            <Link to="/features" className={`${SITE_LINK_INLINE} text-ink`}>
              See every feature
            </Link>
          </p>
        </div>
        <div className="pt-lg md:pt-0">
          <Tower />
        </div>
      </section>

      <GuideLine host={BUMLING.key} className="mt-xl">
        Hi, I’m Bumling. Tell me what gets in your way, and I’ll switch on the apps that fit.
      </GuideLine>

      {/* P: the problem. */}
      <section id="problem" className="mt-2xl scroll-mt-lg" aria-labelledby="problem-heading">
        <motion.div {...rise} className="type-measure">
          <p className={eyebrow}>The problem</p>
          <h2 id="problem-heading" className={h2}>
            The work grows. <em>The rest of your life slips.</em>
          </h2>
          <p className="type-context mt-md m-0 text-lede text-ink-soft">
            Creators are told to post more and never stop. So the channel grows, and the rest slips: sleep, friends, family, health, faith.
          </p>
          <p className="mt-sm m-0 text-callout font-medium">It isn’t you. It’s the setup: five villains at once, mostly alone.</p>
        </motion.div>
      </section>

      {/* A: amplify. The villains, and what they cost when nobody stops them. */}
      <section id="villains" className="mt-2xl scroll-mt-lg" aria-labelledby="villains-heading">
        <motion.div {...rise} className="type-measure">
          <h2 id="villains-heading" className="type-hook text-display-3">
            Meet the five villains
          </h2>
          <p className="type-context mt-sm m-0 text-lede text-ink-soft">
            They creep in one late night at a time.
          </p>
        </motion.div>
        {/* Five cells, no hole and no tall empty box (the Grind used to be two rows tall with nothing in its middle): on a laptop three
            across then two across, so the cells in a row are one width and one height and none is a wide box stretched by narrow
            neighbours; on a tablet two columns with the Grind across the top. The words start at the top left, the villain's mark sits in
            the top right corner, and what it costs is lined up at the foot of every card. */}
        <ul className="mt-md grid list-none gap-sm p-0 m-0 sm:grid-cols-2 lg:grid-cols-6">
          {VILLAINS.map((v, i) => (
            <SpotlightCard as="li" index={i} key={v.key} className={`flex min-w-0 flex-col rounded-card bg-card p-md shadow-toy-soft ${['sm:col-span-2 lg:col-span-2 bento-feature', 'lg:col-span-2', 'lg:col-span-2', 'lg:col-span-3', 'lg:col-span-3'][i]}`}>
              <CardHead
                tag={
                  <span className="flex size-[44px] shrink-0 items-center justify-center rounded-pill bg-paper text-ink-soft" aria-hidden="true">
                    <Icon icon={v.icon} size={24} />
                  </span>
                }
              >
                <h3 className="m-0 text-title2 font-medium text-balance">{v.name}</h3>
              </CardHead>
              <p className="mt-xs m-0 text-balance text-callout">{v.does}</p>
              <p className="mt-auto m-0 pt-sm text-balance text-subhead text-ink-soft">Costs: {v.costs}</p>
            </SpotlightCard>
          ))}
        </ul>
        <p className="mt-md m-0 text-callout font-medium">Each one has a fix. The setup chat asks which you face.</p>
      </section>

      {/* S: the story and the solution. You are the hero; the app is the map and the guides. */}
      <section id="story" className="mt-2xl scroll-mt-lg" aria-labelledby="story-heading">
        <GuideLine host={BUMLING.key} mood="excited" className="mb-md">
          You do the work. I hold the map.
        </GuideLine>
        {/* The story is told as a story, in short paragraphs, so the density check reads it as a reading block (data-reading). */}
        <motion.div {...rise} data-reading className="rounded-card bg-card p-md shadow-toy-soft md:p-lg">
          <p className={eyebrow}>The story</p>
          <h2 id="story-heading" className={h2}>
            You are the hero. <em>Every hero needs a guide.</em>
          </h2>
          <p className="type-context type-measure mt-md m-0 text-lede text-ink-soft">
            You are the hero; kreators.app is the map. Seven guides walk with you, one for each relationship, and Bumling shows you around.
          </p>
          <p className="type-measure mt-lg m-0 text-callout">
            Picture a Monday. You check in, do one small act and tick one task. That tick climbs the pyramid to its foundation: the reason you started.
          </p>
          {/* Three equal cells: the old wide first cell held two lines in a box made for four, so it read as an empty box. */}
          <ol className="mt-lg grid list-none gap-sm p-0 m-0 sm:grid-cols-3">
            {[
              ['A short chat', 'Answer a few questions. It switches on the apps that fit, and nothing else.'],
              ['Your pillars', 'A short session maps your seven and builds a pyramid for the ones that need you most.'],
              ['Three boxes a day', 'Check in, do one small act, tick one task. Every tick climbs a pillar.'],
            ].map(([t, d], i) => (
              <SpotlightCard as="li" index={i} key={t} className="rounded-tile bg-paper p-md">
                <p className="m-0 text-title1 type-figure leading-none text-ink-mute" aria-hidden="true">
                  0{i + 1}
                </p>
                <h3 className="mt-sm m-0 text-title3 font-medium text-balance">{t}</h3>
                <p className="mt-xs m-0 text-balance text-subhead text-ink-soft">{d}</p>
              </SpotlightCard>
            ))}
          </ol>
          <Link to="/7rp" className={`${SITE_SECONDARY} mt-md`}>
            Meet the seven relationships
            <SiteArrow />
          </Link>
        </motion.div>
      </section>

      {/* The five Ws. */}
      <section id="five-ws" className="mt-2xl scroll-mt-lg" aria-labelledby="ws-heading">
        <motion.div {...rise} className="type-measure">
          <p className={eyebrow}>The five Ws</p>
          <h2 id="ws-heading" className="type-hook mt-xs text-display-3">
            Who it’s for, and why
          </h2>
        </motion.div>
        {/* Two columns on a tablet (Who across the top); on a laptop three across then two across, so the cells in a row are one width
            and one height (a wide Who beside narrow What and When was a half-empty box). */}
        <dl className="mt-md grid gap-sm m-0 sm:grid-cols-2 lg:grid-cols-6">
          {FIVE_WS.map((x, i) => (
            <SpotlightCard
              index={i}
              key={x.w}
              className={`min-w-0 rounded-card bg-card p-md shadow-toy-soft ${['sm:col-span-2 lg:col-span-2 bento-feature', 'lg:col-span-2', 'lg:col-span-2', 'lg:col-span-3', 'lg:col-span-3'][i]}`}
            >
              <dt className="type-hook text-display-3">{x.w}</dt>
              <dd className="mt-xs m-0 text-balance text-subhead text-ink-soft">{x.text}</dd>
            </SpotlightCard>
          ))}
        </dl>
        <p className="type-measure mt-md m-0 text-callout text-ink-soft">
          For you if you want your work and your life to move together.
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
            <p className="type-context mt-sm m-0 text-lede text-ink-soft">What the app does about each one, and what you get.</p>
          </div>
        </motion.div>
        <ul className="mt-md flex list-none flex-col gap-lg p-0 m-0">
          {ANSWERS.map((a, ai) => {
            const v = VILLAINS.find((x) => x.key === a.villain)!;
            // The rule behind the fix, one short sentence a line, each with a tick.
            const lines = a.how.split(/(?<=\.)\s+/).filter(Boolean);
            const flip = ai % 2 === 1;
            const apps = a.apps.filter((k) => FEATURES[k] && MODULE_BY_KEY[k]);
            return (
              <motion.li {...rise} key={a.villain} data-pillar={a.pillar} className="grid gap-md rounded-card bg-card p-sm shadow-toy-soft md:p-md lg:grid-cols-2 lg:items-stretch">
                {/* Side by side only from the laptop width: on a tablet the list beside it made the poster a tall, empty colour field. */}
                <PosterPanel pillar={a.pillar} title={a.poster[0]} quiet={a.poster[1]} className={flip ? 'lg:order-2' : ''}>
                  Against {v.name}
                </PosterPanel>
                <div className="p-xs md:p-sm">
                  <h3 className="m-0 flex items-center gap-xs text-title3 font-medium text-balance">
                    <Icon icon={v.icon} size={24} className="text-ink-soft" />
                    How you beat {v.name}
                  </h3>
                  {/* The poster beside it already says this in two short lines; a phone shows the poster only, a laptop both. */}
                  <p className="hidden md:block mt-sm m-0 text-balance text-headline">{a.benefit}</p>
                  {/* The rules behind the fix: under a fold on a phone, so the card reads as the promise and the apps; open from md up. */}
                  <Fold title="How it works" className="mt-sm md:hidden">
                    <HowLines lines={lines} pillar={a.pillar} />
                  </Fold>
                  <div className="hidden md:block mt-sm">
                    <HowLines lines={lines} pillar={a.pillar} />
                  </div>
                  {/* A bento, not a wrapping row, so no app is ever left alone on a line. Four go two by two; six three by three; five put the
                      first two (the ones that matter most) wide on the first row and three under them from the tablet width, and on a phone the first
                      takes the row and the rest pair up. */}
                  <ul className={`mt-sm grid list-none grid-cols-2 gap-xs p-0 m-0 ${apps.length === 4 ? '' : apps.length === 5 ? 'sm:grid-cols-6' : 'sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3'}`} aria-label="The apps that do it">
                    {apps.map((k, i) => (
                      <li key={k} className={apps.length === 5 ? (i === 0 ? 'col-span-2 sm:col-span-3' : i === 1 ? 'sm:col-span-3' : 'sm:col-span-2') : i === apps.length - 1 && apps.length % 2 === 1 ? 'col-span-2 sm:col-span-1' : ''}>
                        <Link
                          to={`/features/${k}`}
                          title={FEATURES[k]?.tagline}
                          className={`${SITE_CHIP} w-full`}
                        >
                          <AppIcon name={MODULE_BY_KEY[k]?.icon} size={16} />
                          {APP_CHIP_LABEL[k] ?? MODULE_BY_KEY[k]?.name}
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

      {/* Still the solution: the founder's three books, the courses made from them, and where to read more. */}
      <section id="books" className="mt-2xl scroll-mt-lg" aria-labelledby="books-heading">
        <motion.div {...rise} className="type-measure">
          <p className={eyebrow}>The books</p>
          <h2 id="books-heading" className={h2}>
            Three books, <em>three courses</em>
          </h2>
          <p className="type-context mt-sm m-0 text-lede text-ink-soft">
            By {BOOK_AUTHOR}, who builds kreators.app. Each one is a course in School.
          </p>
        </motion.div>
        <BookShelf className="mt-md" href={(b) => `/features/books#${b.slug}`} />
        <div className="mt-md flex flex-wrap items-center gap-sm">
          <Link to={bookEntry} className={SITE_SECONDARY}>
            Read the course in the app
            <SiteArrow />
          </Link>
          <Link to="/features/books" className={`${SITE_LINK} text-callout`}>
            About the books
          </Link>
        </div>
      </section>

      {/* T: the change. Before and after, and the real numbers so far. */}
      <section id="change" className="mt-2xl scroll-mt-lg" aria-labelledby="change-heading">
        <motion.div {...rise} className="type-measure">
          <p className={eyebrow}>The change</p>
          <h2 id="change-heading" className={h2}>
            What changes
          </h2>
          <p className="type-context mt-sm m-0 text-lede text-ink-soft">
            Today, a tick. On Sunday, your first week review. Each month, a look back<span className="hidden md:inline"> with the numbers next to the month before</span>.
          </p>
        </motion.div>
        <div className="bento mt-md">
          <motion.div {...rise} className="bento-w2 rounded-card bg-card p-md shadow-toy-soft">
            <h3 className="m-0 text-title3 font-medium text-ink-soft text-balance">Before</h3>
            <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
              {BEFORE.map((b) => (
                <li key={b} className="flex items-start gap-xs text-callout text-ink-soft">
                  <Icon icon={X} size={20} className="mt-[2px]" />
                  {b}
                </li>
              ))}
            </ul>
          </motion.div>
          <motion.div {...rise} className="bento-w2 rounded-card bg-r4 p-md text-on-fill">
            <h3 className="m-0 text-title3 font-medium text-on-fill text-balance">After</h3>
            <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
              {AFTER.map((b) => (
                <li key={b} className="flex items-start gap-xs text-headline">
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
              <p className="m-0 text-title1 type-figure leading-none">
                <CountUp value={value} format={(n) => formatCount(n)} />
              </p>
              <p className="mt-xs m-0 text-caption text-ink-soft">
                {label} <span className="sr-only">live from the app</span>
              </p>
            </SpotlightCard>
          ))}
        </div>
        <Link to="/explore" className={`${SITE_SECONDARY} mt-md`}>
          See what is open right now
          <SiteArrow />
        </Link>
      </section>

      {/* O: the offer. Value, then the price, then the paid parts, then the way out. */}
      <section id="offer" className="mt-2xl scroll-mt-lg" aria-labelledby="offer-heading">
        <GuideLine host="parent_child" side="right" mood="excited" className="mb-md">
          No card, no catch.
        </GuideLine>
        <motion.div {...rise} className="relative rounded-card bg-card p-md shadow-toy-soft md:p-lg">
          <BorderBeam />
          <p className={eyebrow}>The offer</p>
          <h2 id="offer-heading" className={h2}>
            Free to start. <em>Free to stay.</em>
          </h2>
          {/* Two by two: four short lines in equal cells, so none sits alone in a box made for three lines. */}
          <ul className="bento mt-md list-none p-0 m-0">
            {FREE.map((f, i) => (
              <li key={f} className="bento-w2 flex items-start gap-xs rounded-tile bg-paper p-sm text-headline">
                <Icon icon={Check} size={20} className="mt-[2px]" />
                {f}
              </li>
            ))}
          </ul>
          {/* What costs money, as two short facts, then the way to see more. */}
          <p className="type-measure mt-md m-0 text-subhead">Two things cost money, and we say so up front:</p>
          <ul className="type-measure mt-xs m-0 grid list-disc gap-xs pl-md text-subhead text-ink-soft">
            <li>
              Typing to the assistant needs a plan from {planPriceLabel('pro')}
              {PAYMENTS_LIVE ? '' : '. Plans are not on sale yet, so nothing is charged'}.
            </li>
            <li>The Shop takes 5% of each sale you make.</li>
          </ul>
          <p className="type-measure mt-xs m-0 text-balance text-subhead text-ink-soft">
            Switch any app off, export or delete everything, from the Profile tab.{' '}
            <Link to="/pricing" className={SITE_LINK_INLINE}>
              See pricing
            </Link>
          </p>
        </motion.div>
      </section>

      <section id="brands" className="mt-2xl scroll-mt-lg" aria-labelledby="brands-heading">
        <motion.div
          {...rise}
          data-pillar="servant_leader"
          className="wash grid gap-md rounded-card bg-card p-md shadow-toy-soft md:grid-cols-[2fr_1fr] md:items-center md:p-lg"
          style={{ '--wash': 'var(--color-r5)' } as CSSProperties}
        >
          <div>
            <p className={eyebrow}>{BRAND_PITCH.tagline}</p>
            <h2 id="brands-heading" className="type-hook mt-xs text-display-3">
              Pay for views that are checked, <em>not claimed</em>
            </h2>
            <p className="mt-sm m-0 text-balance text-callout text-ink-soft">{BRAND_PITCH.pitch}</p>
            {/* The rest waits under a fold on a phone and is open from md up. */}
            <Fold title="More for brands" className="mt-sm md:hidden">
              <BrandMore />
            </Fold>
            <div className="hidden md:block mt-sm">
              <BrandMore />
            </div>
            <div className="fill-row-all mt-md flex flex-wrap gap-sm">
              <Link to="/features/win" className={SITE_SECONDARY}>
                How content rewards pay
                <SiteArrow />
              </Link>
              <Link to="/features/agency" className={SITE_SECONDARY}>
                Run client work
                <SiteArrow />
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
          <h2 id="faq-heading" className="type-hook mt-xs text-display-3">
            Questions people ask
          </h2>
        </motion.div>
        <div className="mt-md grid gap-xs md:grid-cols-2">
          {SITE_FAQ.map((f) => (
            <Fold key={f.q} title={f.q}>
              <p className="prose-long m-0 px-sm pb-sm text-prose text-ink-soft">{f.a}</p>
            </Fold>
          ))}
        </div>
      </section>

      {/* R: the response. One thing to do next. */}
      <section className="mt-2xl" aria-labelledby="start-heading">
        <motion.div {...rise} className="fx-fglass-host relative overflow-hidden rounded-card p-md pb-0 text-on-fill md:p-lg md:pb-0">
          <FractalGlass />
          <h2 id="start-heading" className="relative z-10 type-hook text-display-2">
            The villains have had enough time. <em>Your turn.</em>
          </h2>
          <p className="relative z-10 type-context mt-sm m-0 text-lede text-on-fill/85">{TOUCHSTONE}</p>
          <div className="relative z-10 mt-md">
            <Magnet>
              <LiquidMetal>
                <Link to={start} className={SITE_PRIMARY_ON_GLASS}>
                  {token ? 'Go to app' : 'Start free'}
                </Link>
              </LiquidMetal>
            </Magnet>
          </div>
          <p className="relative z-10 mt-sm m-0 text-caption text-on-fill/80">
            Not for you? Delete your account, and everything in it, from the Profile tab.
          </p>
          {/* The seven peek up from the card's bottom edge: drawn whole, the card clips their lower half. */}
          <div className="peek-row relative z-10 mt-lg flex justify-center gap-xs sm:gap-md" aria-hidden="true">
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
