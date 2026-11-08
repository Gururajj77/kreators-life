import type { CSSProperties } from 'react';
import { BOOK_AUTHOR, BUMLING, formatCount, LIVE_CALL_CENTS, MODULE_BY_KEY, money, PAYMENTS_LIVE, PLAN_CURRENCY, planPriceLabel, RELATIONSHIPS, type RelationshipKey } from '@kreators/shared';
import { useQuery } from '@tanstack/react-query';
import { m as motion } from 'motion/react';
import { Link } from 'react-router';
import { Avatar } from '../components/Avatar';
import { Phrases } from '../components/Phrases';
import { FractalGlass } from '../components/fx/FractalGlass';
import { PeekGuides } from './PeekGuides';
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
import { useRise } from './SevenRP';
import { SiteLayout, useAppEntry } from './SiteLayout';
import { ArrowDown, ArrowUpRight, BatteryLow, Check, Hourglass, MessageSquareDashed, Puzzle, ShieldCheck, Sprout, ToggleRight, Tornado, X } from 'lucide-react';
import { AppIcon } from '../components/AppIcon';
import { Icon } from '../components/Icon';
import { CardHead } from '../components/CardHead';
import { Fold } from '../components/Fold';
import { GuideLine } from './GuideLine';
import { PosterPanel } from './PosterPanel';
import { useBookEntry } from './Books';
import { BookShelf } from '../components/BookShelf';
import { SiteArrow, SITE_CHIP, SITE_LINK, SITE_LINK_INLINE, SITE_PRIMARY, SITE_PRIMARY_ON_GLASS, SITE_SECONDARY } from './buttons';
import { SevenKnot } from '../components/fx/SevenKnot';
import { StatusTag } from '../components/StatusTag';
import { fillVar } from '../lib/relFill';
import { evenGrid, evenTile } from '../lib/bento';

/**
 * The landing page tells one story, in the PASTOR order: the problem, what it costs (the villains), the story and the
 * solution (you are the hero, the app is the guide), the change it makes, the offer, and the one thing to do next.
 * The 5 W’s sit in the middle, so nobody has to guess who it is for, what it is, when, where or why. The seven
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
  apps: string[];
}[] = [
  {
    villain: 'grind',
    pillar: 'self',
    poster: ['Keep your energy.', 'So the work lasts.'],
    how: 'A routine built from your real day, with a wake time that moves thirty minutes a week. Sleep, mood and stress feed a daily brief that says when sleep starts to dip. Focus sessions come with breaks, a quiet sound and a rating.',
    apps: ['today', 'life', 'sleep', 'mindful'],
  },
  {
    villain: 'scatter',
    pillar: 'guru',
    poster: ['One place.', 'One login.'],
    how: 'Learning, paid work, brand campaigns, your clients, your shop and your money in one app. Only a few apps are on to start. The setup chat picks up to five more that fit, and you can hide any of them.',
    apps: ['agency', 'school', 'work', 'shop', 'finance'],
  },
  {
    villain: 'silence',
    pillar: 'friendship',
    poster: ['People in your corner.', 'Every week.'],
    how: 'Small circles near you, run clubs, events and a kind community. A life coach if you want one, who sees only what you switch on and never your journal. Card games, so a first meeting never starts with silence.',
    apps: ['circles', 'run', 'party', 'community', 'cards', 'coaching'],
  },
  {
    villain: 'drift',
    pillar: 'divine',
    poster: ['A big goal.', 'One tick today.'],
    how: 'Seven pillars, each a pyramid from a foundation you will not let break down to today’s task. Plan my week spreads your tasks over seven days. Reviews each week and month show what moved. A quiz shows your strengths, so your next steps fit you.',
    apps: ['tower', 'discover', 'reviews', 'journal'],
  },
  {
    villain: 'squeeze',
    pillar: 'servant_leader',
    poster: ['See every way in.', 'And all that comes in.'],
    how: 'Paid gigs and brand campaigns. Win pays for every verified view, once a reviewer checks it. Sell in your own shop: we take 5% of a sale, nothing up front. Agency makes the client invoice, with GST and TDS worked out. All your money sits in one picture.',
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

const BEFORE = ['Up at three, editing again', 'Big goals, no next step', 'Ten apps and no plan', 'Nobody to check in with', 'Money you cannot see coming'];
const AFTER = ['A routine that fits your real day', 'Today’s task moves a big goal', 'One app, only what you use', 'Circles, clubs and a coach who check in', 'All your money in one place'];

// Even rows (lib/bento.ts): the live numbers in one row from the tablet, the free parts two to a row; a phone stacks both, like every bento.
const LIVE_COLS = { base: 1, sm: 4 } as const;
const FREE_COLS = { base: 1, sm: 2 } as const;

const FREE = [
  'The daily game: check in, a small act, a task',
  'Your seven pillars and the strategy session',
  'Every app you switch on, from School to Agency',
  'The assistant’s quick taps, and Help',
];

/** The one line that says what it is and what it costs. Word for word in the hero. */
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

const h2 = 'type-hook mt-xs text-display-2';

/** The seven pillar colours as a row of dots: the hero chip's mark. */
function SevenDots() {
  return (
    <span className="inline-flex gap-[2px]">
      {RELATIONSHIPS.map((r) => (
        <span key={r.key} className="inline-block size-[6px] rounded-pill" style={{ background: fillVar(r) }} />
      ))}
    </span>
  );
}

export function Home() {
  const entry = useAppEntry();
  const rise = useRise();
  const token = useSession((s) => s.token);
  const start = token ? entry : '/start';
  // With a session the header already says Go to app, so the hero's main action opens Daily instead of repeating it.
  const heroStart = token ? '/today' : '/start';
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
  const members = stats.data?.members ?? 0;

  return (
    <SiteLayout>
      {/* The page's own background: one layer behind the whole page, so the hero never reads as a band of its own. */}
      <MorphShapes page />
      {/* The hero (2026-11-05, after the founder's reference, then his changes): no box of its own, it sits on the page's wash. The tag,
          the hook large in metal ink with the knot of seven colours over its end, the daily line under the hook, the pitch and Start free
          at the right, and three bold cards at its foot. On a phone it stacks in the order of the markup. */}
      <section aria-labelledby="hero-heading" data-knot-host="" className="relative isolate pt-lg md:pt-xl lg:-mx-lg">
        {/* One row over the hero: the tag at the left, who it is for at the right, quiet and whole. Where the two do not fit side by side
            (a phone), the line drops under the tag and, if it must wrap, breaks on purpose after "freelancers,". */}
        <div className="flex flex-wrap items-baseline justify-between gap-x-md gap-y-xs">
          <StatusTag tone="calm" mark={<SevenDots />}>
            Seven relationships, one life
          </StatusTag>
          <p className="m-0 text-subhead text-ink-soft">
            <span className="inline-block">For creators, freelancers,</span> <span className="inline-block">founders and students.</span>
          </p>
        </div>
        <div className="hero-body relative mt-lg">
          {/* The display role; from the tablet up the lines are set by hand so they grow going down. */}
          <h1 id="hero-heading" className="hero-title hero-metal type-hook relative z-0 m-0 text-display-1">
            <TextReveal
              parts={[
                { text: 'Grow your' },
                { br: true, className: 'hidden md:inline' },
                { text: 'work' },
                { text: 'without', em: true },
                { br: true, className: 'hidden md:inline' },
                { text: 'losing your life', em: true },
              ]}
            />
          </h1>
          {/* The knot stands over the end of the hook, partly in front of the words, the way an object stands in front of a title. */}
          <SevenKnot className="hero-knot-place z-10 mt-md w-[65%] max-w-[270px] self-center md:mt-0 md:w-auto md:max-w-none" />
          <div className="hero-side relative z-10 mt-lg md:mt-0">
            <p className="type-context m-0 text-callout text-ink-soft">
              Your work is one of seven relationships. kreators.app is a daily game that keeps all seven moving.
            </p>
            {/* The page's one main action. The header already says Go to app, so someone signed in is offered Daily instead. */}
            <div className="mt-md">
              <Magnet>
                <LiquidMetal>
                  <Link to={heroStart} className={`${SITE_PRIMARY} fx-shimmer-intro`}>
                    {token ? 'Open Daily' : 'Start free'}
                  </Link>
                </LiquidMetal>
              </Magnet>
            </div>
          </div>
          <div className="hero-lead relative z-10 mt-lg md:mt-0">
            <div className="flex items-start gap-sm">
              <span className="grid size-[44px] shrink-0 place-items-center rounded-inner bg-r7 text-on-fill" aria-hidden="true">
                <Icon icon={Sprout} size={22} />
              </span>
              <p className="m-0 max-w-[340px] text-callout">{TOUCHSTONE}</p>
            </div>
            <a href="#story" className={`${SITE_LINK} mt-xs text-callout`}>
              <Icon icon={ArrowDown} size={20} />
              See how it works
            </a>
          </div>
        </div>

        {/* Three bold cards at the foot, facts only: the apps (one link to every feature), the guides (and the members, once there are
            any), and what sign-up asks. */}
        <ul className="relative z-10 m-0 mt-xl grid list-none gap-sm p-0 md:grid-cols-3">
          <li className="flex">
            <Link
              to="/features"
              aria-label={`See every feature: ${formatCount(SITE_FEATURES.length)} apps, each one a switch`}
              className="toy group flex w-full flex-col rounded-tile bg-r3 p-md text-on-fill"
            >
              <span className="flex items-start justify-between gap-sm">
                <span className="text-headline">Apps, each one a switch</span>
                <Icon icon={ToggleRight} size={32} className="shrink-0 opacity-80" />
              </span>
              {/* The words stay whole: where the card is narrow they drop under the figure, still at the right. */}
              <span className="mt-auto flex flex-wrap items-end justify-between gap-x-sm pt-sm">
                <span className="type-figure text-figure-hero">{formatCount(SITE_FEATURES.length)}</span>
                <span className="mb-xs ml-auto inline-flex items-center gap-xs whitespace-nowrap text-subhead font-semibold">
                  See every feature
                  <span className="read-arrow inline-flex">
                    <Icon icon={ArrowUpRight} size={18} />
                  </span>
                </span>
              </span>
            </Link>
          </li>
          <li className="night-card flex flex-col items-center justify-center rounded-tile p-md text-center text-on-fill">
            <p className="m-0 text-headline">Seven guides, one for each relationship</p>
            <div className="mt-sm flex justify-center" aria-hidden="true">
              {RELATIONSHIPS.map((r, i) => (
                // Smaller while three cards share a tablet's width, so all seven stay inside the card.
                <span key={r.key} className={`hero-stack-face grid size-[44px] place-items-center rounded-pill md:size-[36px] lg:size-[44px] ${i ? '-ml-sm' : ''}`}>
                  <Avatar relationship={r.key} size={40} mood="happy" decorative still className="block h-auto w-[40px] md:w-[32px] lg:w-[40px]" />
                </span>
              ))}
            </div>
            {members > 0 && <p className="mt-sm m-0 text-subhead text-on-fill/85">{formatCount(members)} members so far</p>}
          </li>
          {/* Green deepened toward the fill shade, as Hero draws a fill: the plain fill's light sheen left white text at 4.4:1 at the top left. */}
          <li className="flex flex-col rounded-tile p-md text-on-fill" style={{ background: 'linear-gradient(150deg, var(--color-r4), color-mix(in oklab, var(--color-r4) 70%, var(--fill-shade)))' }}>
            <p className="m-0 text-headline">No card needed</p>
            <p className="mt-xs m-0 text-subhead"><Phrases text="To keep everyone here 18 or over, we ask your phone and birthday. Nobody else ever sees them." at={/(?<=\.) /} /></p>
            <Icon icon={ShieldCheck} size={32} className="mt-auto self-end pt-xs opacity-80" />
          </li>
        </ul>
      </section>

      {/* P: the problem. Bumling's line leads into it, on the right for balance after the hero (whose words sit on the left), with as much
          room under it as above it from the tablet up, so it reads as the band's lead-in, not an afterthought of the hero. */}
      <section id="problem" className="mt-xl scroll-mt-lg" aria-labelledby="problem-heading">
        <GuideLine host={BUMLING.key} side="right" className="mb-lg md:mb-xl">
          {/* Kept whole up to each full stop and comma, so a narrow blob breaks there on purpose (the rectangle rule). */}
          <span className="inline-block">Hi, I’m Bumling.</span> <span className="inline-block">Tell me what gets in your way,</span>{' '}
          <span className="inline-block">and I’ll show the apps that fit.</span>
        </GuideLine>
        {/* The problem is the heading of the villains under it (the founder, 2026-11-05: not a band of its own in half the screen): the
            eyebrow, the hook and its two lines over the five cards, at the page's width, the lines kept to a reading measure. */}
        <motion.div {...rise}>
          <p className={eyebrow}>The problem</p>
          <h2 id="problem-heading" className={h2}>
            The work grows. <em>The rest of your life slips.</em>
          </h2>
          <p className="type-context type-measure mt-md m-0 text-lede text-ink-soft">
            Creators are told to post more and never stop. Sleep, friends, family, health and faith pay for it.
          </p>
          <p className="mt-sm m-0 text-callout font-medium">It isn’t you. It’s the setup: five villains at once, mostly alone.</p>
        </motion.div>
        {/* Five cells, no hole and no tall empty box (the Grind used to be two rows tall with nothing in its middle): on a laptop three
            across then two across, so the cells in a row are one width and one height and none is a wide box stretched by narrow
            neighbours; on a tablet two columns with the Grind across the top. The words start at the top left, the villain's mark sits in
            the top right corner, and what it costs is lined up at the foot of every card. */}
        {/* A: amplify. The villains, and what they cost when nobody stops them. */}
        <ul id="villains" aria-label="The five villains" className="mt-lg grid list-none gap-sm p-0 m-0 sm:grid-cols-2 lg:grid-cols-6">
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
        <p className="mt-md m-0 text-callout font-medium">Each one has a fix.</p>
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
            {/* Each sentence its own line at every width (the founder, 2026-11-05): the second starts under the first, never after it. */}
            <span className="block">You are the hero.</span> <em className="block">Every hero needs a guide.</em>
          </h2>
          <p className="type-context type-measure mt-md m-0 text-lede text-ink-soft">
            Seven guides walk with you, one for each relationship, and Bumling shows you around.
          </p>
          {/* Three equal cells: the old wide first cell held two lines in a box made for four, so it read as an empty box. */}
          <ol className="mt-lg grid list-none gap-sm p-0 m-0 sm:grid-cols-3">
            {[
              ['A short chat', 'Answer a few questions. It shows the apps that fit, and nothing else.'],
              ['Your pillars', 'A short session maps your seven and builds a pyramid for the ones that need you most.'],
              ['Three boxes a day', 'Check in, do one small act, tick one task. Every tick climbs your pyramid to the reason you started.'],
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

      {/* The 5 W’s (the founder's spelling, 2026-11-05). */}
      <section id="five-ws" className="mt-2xl scroll-mt-lg" aria-labelledby="ws-heading">
        <motion.div {...rise} className="type-measure">
          <p className={eyebrow}>The 5 W’s</p>
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
              {/* Each clause kept whole, so a narrow cell breaks after a comma, colon or full stop on purpose (Text is a rectangle). */}
              <dd className="mt-xs m-0 text-balance text-subhead text-ink-soft">
                <Phrases text={x.text} at={/(?<=[,:.]) /} />
              </dd>
            </SpotlightCard>
          ))}
        </dl>
      </section>

      {/* The problems we tackle: each villain, how the app beats it, and the apps that do it. */}
      <section id="tackle" className="mt-2xl scroll-mt-lg" aria-labelledby="tackle-heading">
        <motion.div {...rise} className="flex flex-wrap items-end justify-between gap-sm">
          <div className="type-measure">
            <p className={eyebrow}>The fix</p>
            <h2 id="tackle-heading" className={h2}>
              How you beat each villain
            </h2>
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
                <PosterPanel pillar={a.pillar} title={a.poster[0]} quiet={a.poster[1]} className={flip ? 'lg:order-2' : ''} />
                <div className="p-xs md:p-sm">
                  <h3 className="m-0 flex items-center gap-xs text-title3 font-medium text-balance">
                    <Icon icon={v.icon} size={24} className="text-ink-soft" />
                    How you beat {v.name}
                  </h3>
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
            By {BOOK_AUTHOR}, the founder of kreators.app.
          </p>
        </motion.div>
        <BookShelf className="mt-md" href={(b) => `/features/books#${b.slug}`} />
        <Link to={bookEntry} className={`${SITE_SECONDARY} mt-md`}>
          Read the course in the app
          <SiteArrow />
        </Link>
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
        </div>
        {/* The live numbers in one row of their own (even rows, lib/bento.ts): however many are over zero, each takes an equal share. */}
        {live.length > 0 && (
        <div className={`bento mt-sm ${evenGrid(live.length, LIVE_COLS)}`}>
          {live.map(([label, value], i) => (
            <SpotlightCard
              index={1}
              key={label}
              className={`rounded-tile bg-card p-sm shadow-toy-soft ${evenTile(i, live.length, LIVE_COLS)}`}
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
        )}
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
          {/* Two by two: four short lines in equal cells, so none sits alone in a box made for three lines (even rows, lib/bento.ts). */}
          <ul className={`bento mt-md list-none p-0 m-0 ${evenGrid(FREE.length, FREE_COLS)}`}>
            {FREE.map((f, i) => (
              <li key={f} className={`flex items-start gap-xs rounded-tile bg-paper p-sm text-headline ${evenTile(i, FREE.length, FREE_COLS)}`}>
                <Icon icon={Check} size={20} className="mt-[2px]" />
                {f}
              </li>
            ))}
          </ul>
          {/* What costs money, as three short facts, then the way to see more. */}
          <p className="type-measure mt-md m-0 text-subhead">Three things cost money:</p>
          <ul className="type-measure mt-xs m-0 grid list-disc gap-xs pl-md text-subhead text-ink-soft">
            <li>
              Typing to the assistant needs a plan from {planPriceLabel('pro')}
              {PAYMENTS_LIVE ? '' : '. Plans are not on sale yet, so nothing is charged'}.
            </li>
            <li>The Shop takes 5% of each sale you make.</li>
            <li>
              An optional live call with a coach costs {money(LIVE_CALL_CENTS, PLAN_CURRENCY)}
              {PAYMENTS_LIVE ? '' : '. It is not on sale yet, so nothing is charged'}.
            </li>
          </ul>
          <p className="type-measure mt-xs m-0 text-balance text-subhead text-ink-soft">
            Hide any app, export your data or delete your account, from the Profile tab.{' '}
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
          <h2 id="faq-heading" className="type-hook text-display-3">
            Fair questions
          </h2>
        </motion.div>
        {/* An odd last question takes both columns, so it is never a lone fold. */}
        <div className="mt-md grid gap-xs md:grid-cols-2 md:[&>*:last-child:nth-child(odd)]:col-span-2">
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
          <div className="relative z-10 mt-md">
            <Magnet>
              <LiquidMetal>
                <Link to={start} className={SITE_PRIMARY_ON_GLASS}>
                  {token ? 'Go to app' : 'Start free'}
                </Link>
              </LiquidMetal>
            </Magnet>
          </div>
          {/* The seven peek up from the card's bottom edge: drawn whole, the card clips their lower half. */}
          <PeekGuides />
        </motion.div>
      </section>
    </SiteLayout>
  );
}
