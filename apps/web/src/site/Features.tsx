import { BOOK_AUTHOR, BOOKS, BUMLING, inGroupOrder, MODULE_GROUP_ACCENT, MODULE_GROUPS, type ModuleGroup } from '@kreators/shared';
import { Link } from 'react-router';
import { FEATURES, SITE_FEATURES } from './content';
import { GradientStripes } from '../components/fx/GradientStripes';
import { Reveal } from '../components/fx/Reveal';
import '../components/fx/spotlight';
import { GuideLine } from './GuideLine';
import { SiteLayout, useAppEntry } from './SiteLayout';
import { AppIcon } from '../components/AppIcon';
import { BookShelf } from '../components/BookShelf';
import { SITE_LINK_INLINE, SITE_PRIMARY } from './buttons';

/** The first card is wide; the last one stretches to close the row, so a group never ends with a hole in its grid. */
function span(i: number, n: number): string {
  if (n < 2) return '';
  if (i === 0) return 'bento-w2';
  if (i === n - 1) {
    const r = (n + 1) % 4;
    return r === 0 ? '' : ['', 'bento-w4', 'bento-w3', 'bento-w2'][r] ?? '';
  }
  return '';
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
        <h1 className="type-hook mt-sm text-[clamp(40px,9vw,80px)]">Everything a creator needs, <em>one switch at a time</em></h1>
        {/* The problem and the fix in four short lines, one sentence each (copy brief: a lead in four short paragraphs). */}
        <div className="type-measure mt-md grid gap-xs text-[18px] text-ink-soft md:text-[20px]">
          <p className="type-context m-0">Courses in one app, gigs in another, money in a sheet.</p>
          <p className="type-context m-0">It adds up to ten logins and no plan.</p>
          <p className="type-context m-0">Here every app is a switch in one place, so you keep only what you use.</p>
        </div>
        <div className="mt-md grid gap-md md:grid-cols-[3fr_2fr] md:items-center">
          <p className="type-measure m-0 text-[16px] font-semibold text-ink-soft">A short chat switches on the ones that fit you. Tap any app to see how it works.</p>
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
            <h2 id={`group-${g}`} className="type-hook text-[clamp(28px,5vw,40px)]">
              {MODULE_GROUPS[g]}
            </h2>
            <ul className="bento mt-sm list-none p-0 m-0">
              {list.map((m, i) => (
                <Reveal as="li" index={i % 4} key={m.key} className={span(i, list.length)}>
                  <Link to={`/features/${m.key}`} className="toy toy-soft fx-spot flex h-full min-h-[120px] flex-col rounded-tile bg-card p-md">
                    <span className="flex text-ink-soft">
                      <AppIcon name={m.icon} size={28} />
                    </span>
                    <span className="mt-xs block text-[18px] font-extrabold leading-tight tracking-tight">{m.name}</span>
                    <span className="block text-balance text-[14px] font-semibold leading-snug text-ink-soft">{FEATURES[m.key]?.tagline ?? m.blurb}</span>
                  </Link>
                </Reveal>
              ))}
            </ul>
          </section>
        );
      })}
      {/* The founder's books are not an app: they sit after the groups, each opening its place on the Books page. */}
      <section className="mt-xl" aria-labelledby="group-books" data-pillar="guru">
        <h2 id="group-books" className="type-hook text-[clamp(28px,5vw,40px)]">
          Books
        </h2>
        <p className="type-measure mt-xs m-0 text-[16px] font-semibold text-ink-soft">
          Three books by {BOOK_AUTHOR}. Each one is a course in{' '}
          <Link to="/features/school" className={SITE_LINK_INLINE}>
            School
          </Link>
          .
        </p>
        <BookShelf className="mt-md" href={(b) => `/features/books#${b.slug}`} />
      </section>
      <section className="mt-2xl">
        {/* The card colour in both themes (bg-ink turns cream in dark mode, which made this a glaring white block on the dark page). */}
        {/* Light sliced into stripes rises from the foot of the card (GradientStripes); the words and Start free sit above it. */}
        <div className="relative overflow-hidden rounded-card border-2 border-line bg-card-strong p-lg pb-xl text-ink shadow-toy-soft">
          <GradientStripes tone="card" />
          <div className="relative z-10">
            <h2 className="type-hook text-[clamp(32px,6vw,56px)]">Switch on only <em>what you need</em></h2>
            <p className="type-context mt-sm m-0 text-[18px] text-ink-soft">Answer a few questions and we switch on the apps that fit you. Change them any time, free.</p>
            <Link to={entry === '/home' ? '/home' : '/start'} className={`${SITE_PRIMARY} mt-md`}>
              {entry === '/home' ? 'Go to app' : 'Start free'}
            </Link>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
