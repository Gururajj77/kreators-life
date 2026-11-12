import { usePillarAccent } from '../lib/usePillarAccent';
import gsap from 'gsap';
import type { CSSProperties } from 'react';
import { BOOK_BY_SLUG, LIFE_AREA_ORDER, LIFE_AREAS, RELATIONSHIPS, type AppModule } from '@kreators/shared';
import { m as motion, useReducedMotion } from 'motion/react';
import { Suspense, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Avatar } from '../components/Avatar';
import { Fold } from '../components/Fold';
import { Segmented } from '../components/fx/Segmented';
import { TextReveal } from '../components/fx/TextReveal';
import '../components/fx/spotlight';
import { useParamState } from '../lib/useParamState';
import { tie } from '../lib/text';
import { featuresForLifeArea, featuresForRelationship } from './content';
import { SiteLayout, useAppEntry } from './SiteLayout';
import { AppIcon } from '../components/AppIcon';
import { Icon } from '../components/Icon';
import { ArrowUpRight } from 'lucide-react';
import { TabRow } from '../components/TabRow';
import { BookCover } from './Books';
import { SITE_PRIMARY_ON_GLASS } from './buttons';
import { FractalGlass } from '../components/fx/FractalGlass';
import { PeekGuides } from './PeekGuides';
import { evenGrid, evenTile } from '../lib/bento';
import { lazyNamed } from '../lib/lazy';
import { useRise } from './useRise';
import { FollowStart } from './FollowStart';
import { usePageMeta } from '../lib/usePageMeta';

/** The seven pillars stacked, each with its character on top: red at the bottom, violet at the top. */
export function Tower() {
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
            transition={{
              delay: 0.1 + i * 0.08,
              type: 'spring',
              stiffness: 260,
              damping: 18,
            }}
          >
            <motion.div
              className="absolute -top-[30px]"
              animate={reduce ? undefined : { y: [0, -6, 0] }}
              transition={{
                duration: 2.4 + i * 0.2,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: i * 0.3,
              }}
            >
              <Avatar relationship={r.key} size={44} decorative />
            </motion.div>
          </motion.div>
        );
      })}
    </div>
  );
}

/** One thing on the left of the explorer, and what its panel says: a pillar, or an area of life. */
interface Choice {
  key: string;
  name: string;
  /** The small word under the name in the list. */
  short: string;
  relationship: (typeof RELATIONSHIPS)[number];
  eyebrow: string;
  headline: string;
  quote?: string;
  line: string;
  features: AppModule[];
  /** True for an area of life, so the count says "area" and not "pillar". */
  isArea?: boolean;
}

/** How many apps show before "Show all". A wall of buttons was the clutter; six fit two calm rows. */
const SHOWN = 6;

export function AppTile({ m, className }: { m: AppModule; className: string }) {
  return (
    <li className={className}>
      {/* The mark at the left, the name, and from the tablet width an arrow at the right end that nudges on hover (a phone tile has no room
          for it beside "Leaderboard"): every tile has the same things in the same places. */}
      <Link to={`/features/${m.key}`} className="group toy toy-soft flex min-h-[56px] items-center gap-xs rounded-inner-sm bg-card-strong px-sm text-subhead font-semibold">
        <AppIcon name={m.icon} size={20} className="text-ink-soft" />
        <span className="min-w-0 flex-1">{m.name}</span>
        <Icon icon={ArrowUpRight} size={16} className="read-arrow hidden shrink-0 text-ink-mute sm:block" />
      </Link>
    </li>
  );
}

// Two across on a phone and beside the tablet's list (three cut "Leaderboard" there), three where the panel has the room, in even rows
// (lib/bento.ts), so "Show all" never leaves a lone tile.
export const TILE_COLS = { base: 2, sm: 3, md: 2, lg: 3 } as const;

function AppGrid({ items }: { items: AppModule[] }) {
  return (
    <ul className={`m-0 grid list-none gap-xs p-0 ${evenGrid(items.length, TILE_COLS)}`}>
      {items.map((m, i) => (
        <AppTile key={m.key} m={m} className={evenTile(i, items.length, TILE_COLS)} />
      ))}
    </ul>
  );
}

const MoreApps = lazyNamed(() => import('./SevenRPMore'), 'MoreApps');

/**
 * One pillar (or area) at a time: a list on the left, a calm panel on the right. The old page stacked all seven in full, each with a wall
 * of app buttons, so the page was long and busy; this keeps one story on screen and the rest a tap away.
 */
function Explorer({ picks, value, onPick, label }: { picks: Choice[]; value: string; onPick: (k: string) => void; label: string }) {
  const current = picks.find((p) => p.key === value) ?? picks[0]!;
  const r = current.relationship;
  usePillarAccent(r.key);
  const panel = useRef<HTMLDivElement>(null);
  const first = useRef(true);
  const reduce = useReducedMotion();
  // A short rise when the choice changes; the first draw and reduced motion just show it.
  useEffect(() => {
    const el = panel.current;
    if (!el) return;
    if (first.current || reduce) {
      first.current = false;
      gsap.set(el, { opacity: 1, y: 0 });
      return;
    }
    gsap.fromTo(el, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power3.out' });
  }, [current.key, reduce]);

  const shown = current.features.slice(0, SHOWN);
  const more = current.features.slice(SHOWN);
  return (
    <div className="grid gap-md md:grid-cols-[260px_1fr] md:items-stretch">
      {/* On a phone: one row of pills, the rest behind More. From the tablet width up: an inset list. */}
      <TabRow
        className="md:hidden"
        label={label}
        items={picks.map((p) => ({
          key: p.key,
          name: p.name,
          pillar: p.relationship.key,
          label: (
            <>
              <span className="h-[12px] w-[12px] rounded-full" style={{ background: p.relationship.color }} aria-hidden="true" />
              {p.name}
            </>
          ),
        }))}
        value={current.key}
        onChange={onPick}
        pillClass={() => 'toy inline-flex min-h-[36px] tap-pad items-center gap-xs rounded-pill bg-card-strong px-sm text-subhead font-medium aria-pressed:bg-ink aria-pressed:text-on-ink'}
      />
      <ul className="m-0 hidden list-none flex-col gap-xs rounded-card bg-card p-xs shadow-toy-soft md:flex" role="group" aria-label={label}>
        {picks.map((p) => {
          const on = p.key === current.key;
          return (
            <li key={p.key} data-pillar={p.relationship.key} className="flex flex-1">
              <button
                type="button"
                aria-pressed={on}
                onClick={() => onPick(p.key)}
                className="flex min-h-[56px] w-full items-center gap-sm rounded-inner-sm px-sm text-left transition-colors hover:bg-paper aria-pressed:bg-paper"
                style={
                  on
                    ? ({
                        boxShadow: `inset 3px 0 0 ${p.relationship.color}`,
                      } as CSSProperties)
                    : undefined
                }
              >
                <Avatar relationship={p.relationship.key} size={32} decorative />
                <span className="min-w-0 flex-1">
                  <span className="block text-card-title">{p.name}</span>
                  <span className="block text-card-note text-ink-mute">{p.short}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div
        ref={panel}
        id="pillar-panel"
        data-pillar={r.key}
        aria-live="polite"
        className="fx-spot wash rounded-card bg-card p-md shadow-toy-soft md:p-lg"
        style={{ '--wash': r.color } as CSSProperties}
      >
        <div className="flex items-center gap-md">
          <Avatar relationship={r.key} size={96} mood="excited" />
          <div className="min-w-0">
            <p className="m-0 type-eyebrow text-ink-mute">{current.eyebrow}</p>
            <h2 className="type-hook mt-xs m-0 text-display-2">{current.headline}</h2>
          </div>
        </div>
        {current.quote && <p className="mt-md m-0 text-balance text-headline">“{current.quote}”</p>}
        <p className="mt-sm m-0 text-balance text-callout text-ink-soft">{current.line}</p>
        {current.features.length > 0 && (
          <div className="mt-md">
            <h3 className="m-0 text-subhead font-semibold" style={{ color: `var(--deep-${r.key})` }}>
              Apps for this {current.isArea ? 'area' : 'pillar'}
            </h3>
            <div className="mt-xs">
              <AppGrid items={shown} />
            </div>
            {more.length > 0 && (
              <Fold className="mt-xs" title={`Show all ${current.features.length} apps`}>
                <Suspense fallback={<AppGrid items={more} />}>
                  <MoreApps items={more} />
                </Suspense>
              </Fold>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * The 7RP page: the seven relationships, each a pillar with its own character and the apps that serve it, and the
 * same seven read as the five areas of life. One story shows at a time; the rest are a tap away.
 */
export function SevenRP() {
  usePageMeta('/7rp');
  const [params, setParams] = useSearchParams();
  const view = params.get('view') === 'five' ? 'five' : 'seven';
  // The view and the pick change in one write: two writes in one tap each start from the same old URL, so the second
  // (dropping the pick) put the old view back and "Five areas of life" never stuck.
  const setView = (v: string) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (v === 'five') next.set('view', 'five');
        else next.delete('view');
        next.delete('pillar');
        return next;
      },
      { replace: true, preventScrollReset: true },
    );
  const [pick, setPick] = useParamState('pillar', RELATIONSHIPS[0]!.key);
  const entry = useAppEntry();
  const rise = useRise();

  const sevenPicks: Choice[] = RELATIONSHIPS.map((r) => ({
    key: r.key,
    name: r.name,
    short: `${featuresForRelationship(r.key).length} apps`,
    relationship: r,
    eyebrow: `${r.character}, ${r.role}`,
    headline: r.name,
    quote: r.greeting,
    line: r.question,
    features: featuresForRelationship(r.key),
  }));
  const fivePicks: Choice[] = LIFE_AREA_ORDER.map((k) => {
    const meta = LIFE_AREAS[k];
    const r = RELATIONSHIPS.find((x) => x.key === meta.relationship)!;
    const features = featuresForLifeArea(k);
    return {
      key: k,
      name: meta.name,
      short: `${features.length} apps`,
      relationship: r,
      eyebrow: 'Area of life',
      headline: meta.name,
      line: meta.blurb,
      features,
      isArea: true,
    };
  });
  const picks = view === 'seven' ? sevenPicks : fivePicks;
  // A choice from the other view, or a word nobody sent, falls back to the first one.
  const value = picks.some((p) => p.key === pick) ? pick : picks[0]!.key;

  return (
    <SiteLayout>
      <section className="grid gap-lg pt-lg md:grid-cols-2 md:items-center md:pt-xl">
        <div>
          <p className="m-0 type-eyebrow text-ink-mute">7RP: the seven relationships</p>
          <h1 className="type-hook mt-sm text-display-1">
            {/* The touchstone, broken after its comma: "Seven relationships" over a short "make a life" left a stub on a phone. */}
            <TextReveal parts={[{ text: 'Seven relationships,' }, { text: 'one life.', em: true }]} />
          </h1>
          <p className="mt-md m-0 max-w-[520px] text-balance text-headline text-ink-soft">
            Each relationship is a pillar with its own guide. Pick one to see the apps that serve it.
          </p>
          <Segmented
            className="mt-md"
            label="View"
            value={view}
            onChange={setView}
            options={[
              { value: 'seven', label: 'Seven relationships' },
              { value: 'five', label: 'Five areas of life' },
            ]}
          />
        </div>
        <div className="pt-lg md:pt-0">
          <Tower />
        </div>
      </section>

      <div className="mt-xl">
        <Explorer picks={picks} value={value} onPick={setPick} label={view === 'seven' ? 'The seven pillars' : 'The five areas of life'} />
      </div>

      {/* Where the seven come from: the founder's book, with its cover, and the way to its page. */}
      {BOOK_BY_SLUG['the-relationship-method'] && (
        <section className="mt-xl" aria-labelledby="seven-book">
          <Link
            to="/features/books#the-relationship-method"
            className="group toy toy-soft flex items-center gap-md rounded-card bg-card p-sm shadow-toy-soft md:p-md"
          >
            <span className="block w-[72px] shrink-0 md:w-[96px]">
              <BookCover book={BOOK_BY_SLUG['the-relationship-method']} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block type-eyebrow text-ink-mute">The book</span>
              <span id="seven-book" className="mt-xs block text-card-title text-balance">
                {/* Its last two words kept together: beside the cover on a phone, "Method" alone was half the line above it. */}
                {tie(BOOK_BY_SLUG['the-relationship-method'].title)}
              </span>
              <span className="mt-xs block text-card-note text-ink-soft text-balance">
                Where the seven relationships come from, by {BOOK_BY_SLUG['the-relationship-method'].author}.
              </span>
            </span>
            {/* The arrow at the bottom right says the card opens the book's page. */}
            <Icon icon={ArrowUpRight} size={20} className="read-arrow shrink-0 self-end text-ink-mute" />
          </Link>
        </section>
      )}

      <section className="mt-2xl">
        {/* Fractal glass (FractalGlass) in wine, the same card as /features in its own colour (the home's is navy, /features' teal):
            deep in both themes, the glow rising from the right through narrow ribs; the words and Start free sit on its dark left. */}
        <motion.div {...rise} className="fx-fglass-host relative overflow-hidden rounded-card p-md pb-0 text-on-fill shadow-toy-soft md:p-lg md:pb-0">
          <FractalGlass hue="wine" />
          <div className="relative z-10">
            <h2 className="type-hook text-display-2">
              {/* On a phone the two lines would shrink going down, so the break comes early and they grow. */}
              Find out <br className="sm:hidden" />
              where <em>yours stand</em>
            </h2>
            <p className="type-measure m-0 mt-sm text-callout text-on-fill">A short chat maps all seven, then builds a plan for the ones that need you most.</p>
            <Link to={entry === '/home' ? '/home' : '/start'} className={`${SITE_PRIMARY_ON_GLASS} mt-md`} data-main-action="">
              {entry === '/home' ? 'Go to app' : 'Start free'}
            </Link>
          </div>
          {/* The seven peek up from the card's foot, as on the home's last card (the founder, 2026-11-06). */}
          <PeekGuides />
        </motion.div>
      </section>
      {/* The page's one main action is at its foot: on a phone it waits at the bottom edge until that place shows. */}
      <FollowStart to={entry === '/home' ? '/home' : '/start'}>{entry === '/home' ? 'Go to app' : 'Start free'}</FollowStart>
    </SiteLayout>
  );
}
