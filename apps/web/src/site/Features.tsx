import { BOOK_AUTHOR, BUMLING, inGroupOrder, MODULE_GROUP_ACCENT, MODULE_GROUPS, type ModuleGroup } from '@kreators/shared';
import { Link } from 'react-router';
import { FEATURES, SITE_FEATURES } from './content';
import { FractalGlass } from '../components/fx/FractalGlass';
import { PeekGuides } from './PeekGuides';
import { Reveal } from '../components/fx/Reveal';
import '../components/fx/spotlight';
import { GuideLine } from './GuideLine';
import { SiteLayout, useAppEntry } from './SiteLayout';
import { AppIcon } from '../components/AppIcon';
import { CardHead } from '../components/CardHead';
import { Icon } from '../components/Icon';
import { ArrowUpRight } from 'lucide-react';
import { BookShelf } from '../components/BookShelf';
import { bentoSpans } from '../lib/bento';
import { SITE_LINK_INLINE, SITE_PRIMARY_ON_GLASS } from './buttons';

const SM = ['', '', 'sm:col-span-2'];
const LG = ['', 'lg:col-span-1', 'lg:col-span-2', 'lg:col-span-3', 'lg:col-span-4'];

/**
 * Two columns on a tablet and four on a laptop, the first cards wide until the last row is full (lib/bento.ts), so a group never ends with
 * a hole. A tablet keeps two columns because a card's name shares its first row with the app's mark: in a quarter of a tablet's width
 * "Mindfulness" or "Leaderboard" would not fit beside it.
 */
function span(i: number, n: number): string {
  const a = bentoSpans(n, 2)[i] ?? 1;
  const b = bentoSpans(n, 4)[i] ?? 1;
  return `${SM[a] ?? ''} ${LG[b] ?? ''}`;
}

/** Everything a creator needs, by group: every app, each opening into its own page. */
export function Features() {
  const entry = useAppEntry();
  // The one group order everywhere; the team's own Operations group is not on the public site.
  const groups: ModuleGroup[] = inGroupOrder(['earn', 'wellbeing', 'community', 'creator', 'core']);
  return (
    <SiteLayout>
      {/* One composition: the words as one block on the left (the hook and one line), and from the laptop width Bumling beside it, the
          blob's foot level with the last line of the lede (the founder, 2026-11-05: bottom-aligned, not centred), so the right side carries
          weight and nothing floats on its own. A phone stacks. Less text (the founder, 2026-11-05): the problem and the answer in one line,
          and Bumling's line says the chat switches apps on. */}
      <header className="grid gap-md pt-lg md:pt-xl lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-end lg:gap-lg">
        <div>
          <p className="m-0 type-eyebrow text-ink-mute">Features</p>
          <h1 className="type-hook mt-sm text-display-1">Everything a creator needs, <em>one switch at a time</em></h1>
          {/* Two sentences, each kept whole: where they wrap, the break falls after the full stop. */}
          <p className="type-context type-measure mt-md m-0 text-lede text-ink-soft">
            <span className="inline-block">Courses, gigs and money in one place.</span> <span className="inline-block">Keep only the apps you use.</span>
          </p>
        </div>
        {/* Bumling, the app's own guide, keeps the header from sitting all on the left. */}
        <GuideLine host={BUMLING.key} side="right" mood="excited" size={96} hang className="justify-self-stretch">
          Tell me what you want, and I’ll switch on just those apps.
        </GuideLine>
      </header>
      {groups.map((g) => {
        const list = SITE_FEATURES.filter((m) => m.group === g);
        if (list.length === 0) return null;
        return (
          <section key={g} className="mt-xl" aria-labelledby={`group-${g}`} data-pillar={MODULE_GROUP_ACCENT[g]}>
            <h2 id={`group-${g}`} className="type-hook text-display-3">
              {MODULE_GROUPS[g]}
            </h2>
            <ul className="mt-sm grid list-none gap-sm p-0 m-0 sm:grid-cols-2 lg:grid-cols-4">
              {list.map((m, i) => (
                <Reveal as="li" index={i % 4} key={m.key} className={span(i, list.length)}>
                  {/* The card rule: the name and its line at the top left, the app's mark in the top right corner, and an arrow at the
                      bottom right that nudges on hover, so every card in a row has the same things in the same places. */}
                  <Link to={`/features/${m.key}`} className="group toy toy-soft fx-spot flex h-full flex-col rounded-tile bg-card p-md sm:min-h-[120px]">
                    <CardHead
                      tag={
                        <span className="flex size-[44px] shrink-0 items-center justify-center rounded-pill bg-paper text-ink-soft" aria-hidden="true">
                          <AppIcon name={m.icon} size={24} />
                        </span>
                      }
                    >
                      <span className="block text-card-title">{m.name}</span>
                      <span className="mt-xs block text-balance text-card-note text-ink-soft">{FEATURES[m.key]?.tagline ?? m.blurb}</span>
                    </CardHead>
                    <span className="mt-auto flex justify-end pt-xs text-ink-mute" aria-hidden="true">
                      <Icon icon={ArrowUpRight} size={18} className="read-arrow" />
                    </span>
                  </Link>
                </Reveal>
              ))}
            </ul>
          </section>
        );
      })}
      {/* The founder's books are not an app: they sit after the groups, each opening its place on the Books page. */}
      <section className="mt-xl" aria-labelledby="group-books" data-pillar="guru">
        <h2 id="group-books" className="type-hook text-display-3">
          Books
        </h2>
        <p className="type-measure mt-xs m-0 text-callout text-ink-soft">
          Three books by {BOOK_AUTHOR}. Each one is a course in{' '}
          <Link to="/features/school" className={SITE_LINK_INLINE}>
            School
          </Link>
          .
        </p>
        <BookShelf className="mt-md" href={(b) => `/features/books#${b.slug}`} />
      </section>
      <section className="mt-2xl">
        {/* Fractal glass (FractalGlass) in teal, its own colour (the home's is navy, /7rp's wine): deep in both themes, the glow rising
            from the right through narrow ribs; the words and Start free sit on its dark left. */}
        <div className="fx-fglass-host relative overflow-hidden rounded-card p-md pb-0 text-on-fill shadow-toy-soft md:p-lg md:pb-0">
          <FractalGlass hue="teal" />
          <div className="relative z-10">
            <h2 className="type-hook text-display-2">Switch on only <em>what you need</em></h2>
            <Link to={entry === '/home' ? '/home' : '/start'} className={`${SITE_PRIMARY_ON_GLASS} mt-md`}>
              {entry === '/home' ? 'Go to app' : 'Start free'}
            </Link>
          </div>
          {/* The seven peek up from the card's foot, as on the home's last card (the founder, 2026-11-06). */}
          <PeekGuides />
        </div>
      </section>
    </SiteLayout>
  );
}
