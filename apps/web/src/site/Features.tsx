import { BOOK_AUTHOR, BOOKS, BUMLING, inGroupOrder, MODULE_GROUP_ACCENT, MODULE_GROUPS, type ModuleGroup } from '@kreators/shared';
import { Link } from 'react-router';
import { FEATURES, SITE_FEATURES } from './content';
import { FractalGlass } from '../components/fx/FractalGlass';
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
      <header className="pt-lg md:pt-xl">
        <p className="m-0 type-eyebrow text-ink-mute">Features</p>
        <h1 className="type-hook mt-sm text-display-1">Everything a creator needs, <em>one switch at a time</em></h1>
        {/* The problem and the fix in four short lines, one sentence each (copy brief: a lead in four short paragraphs). */}
        <div className="type-measure mt-md grid gap-xs text-lede text-ink-soft">
          <p className="type-context m-0">Courses in one app, gigs in another, money in a sheet.</p>
          <p className="type-context m-0">It adds up to ten logins and no plan.</p>
          <p className="type-context m-0">Here every app is a switch in one place, so you keep only what you use.</p>
        </div>
        <div className="mt-md grid gap-md lg:grid-cols-[3fr_2fr] lg:items-center">
          <p className="type-measure m-0 text-callout text-ink-soft">A short chat switches on the ones that fit you. Tap any app to see how it works.</p>
          {/* Bumling, the app's own guide, keeps the header from sitting all on the left. */}
          <GuideLine host={BUMLING.key} side="right" mood="excited" size={96}>
            Tell me what you want, and I’ll switch on just those apps.
          </GuideLine>
        </div>
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
                      <span className="block text-headline">{m.name}</span>
                      <span className="mt-xs block text-balance text-subhead text-ink-soft">{FEATURES[m.key]?.tagline ?? m.blurb}</span>
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
        {/* Fractal glass (FractalGlass): deep navy in both themes, the glow rising from the right through narrow ribs; the words and Start free sit on its dark left. */}
        <div className="fx-fglass-host relative overflow-hidden rounded-card p-lg pb-xl text-on-fill shadow-toy-soft">
          <FractalGlass />
          <div className="relative z-10">
            <h2 className="type-hook text-display-2">Switch on only <em>what you need</em></h2>
            <p className="type-context mt-sm m-0 text-lede text-on-fill/85">Answer a few questions and we switch on the apps that fit you. Change them any time, free.</p>
            <Link to={entry === '/home' ? '/home' : '/start'} className={`${SITE_PRIMARY_ON_GLASS} mt-md`}>
              {entry === '/home' ? 'Go to app' : 'Start free'}
            </Link>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
