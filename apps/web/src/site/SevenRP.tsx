import gsap from 'gsap';
import type { CSSProperties } from 'react';
import { LIFE_AREAS, RELATIONSHIPS, type AppModule, type LifeAreaKey } from '@kreators/shared';
import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Avatar } from '../components/Avatar';
import { Fold } from '../components/Fold';
import { Segmented } from '../components/fx/Segmented';
import { TextReveal } from '../components/fx/TextReveal';
import '../components/fx/spotlight';
import { useParamState } from '../lib/useParamState';
import { featuresForLifeArea, featuresForRelationship } from './content';
import { SiteLayout, useAppEntry } from './SiteLayout';
import { AppIcon } from '../components/AppIcon';

/** A gentle lift into place the first time a section scrolls into view. The content is always visible (opacity
 * never hides it); only the small upward delta animates, so a full-page shot taken before the observer fires never
 * shows a blank band, and `prefers-reduced-motion` drops the lift and renders straight in its resting place. */
export function useRise() {
  const reduce = useReducedMotion();
  return reduce
    ? { initial: { opacity: 1, y: 0 } }
    : {
        initial: { opacity: 1, y: 20 },
        whileInView: { y: 0 },
        viewport: { once: true, margin: '-60px' },
        transition: { duration: 0.5 },
      };
}

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

function AppTile({ m }: { m: AppModule }) {
  return (
    <li>
      <Link to={`/features/${m.key}`} className="toy toy-soft flex min-h-[56px] items-center gap-xs rounded-inner-sm bg-card-strong px-sm text-[14px] font-bold">
        <AppIcon name={m.icon} size={20} className="text-ink-soft" />
        <span className="min-w-0 flex-1">{m.name}</span>
      </Link>
    </li>
  );
}

function AppGrid({ items }: { items: AppModule[] }) {
  return (
    <ul className="m-0 grid list-none grid-cols-2 gap-xs p-0 sm:grid-cols-3">
      {items.map((m) => (
        <AppTile key={m.key} m={m} />
      ))}
    </ul>
  );
}

/**
 * One pillar (or area) at a time: a list on the left, a calm panel on the right. The old page stacked all seven in full, each with a wall
 * of app buttons, so the page was long and busy; this keeps one story on screen and the rest a tap away.
 */
function Explorer({ picks, value, onPick, label }: { picks: Choice[]; value: string; onPick: (k: string) => void; label: string }) {
  const current = picks.find((p) => p.key === value) ?? picks[0]!;
  const r = current.relationship;
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
      {/* On a phone: one row of pills that scrolls sideways. From the tablet width up: an inset list. */}
      <div className="scroll-row md:hidden" role="group" aria-label={label}>
        {picks.map((p) => (
          <button
            key={p.key}
            type="button"
            aria-pressed={p.key === current.key}
            onClick={() => onPick(p.key)}
            className="toy inline-flex min-h-[44px] shrink-0 items-center gap-xs rounded-pill bg-card-strong px-sm text-[14px] font-bold aria-pressed:bg-ink aria-pressed:text-on-ink"
          >
            <span className="h-[12px] w-[12px] rounded-full" style={{ background: p.relationship.color }} aria-hidden="true" />
            {p.name}
          </button>
        ))}
      </div>
      <ul className="m-0 hidden list-none flex-col gap-xs rounded-card bg-card p-xs shadow-toy-soft md:flex" role="group" aria-label={label}>
        {picks.map((p) => {
          const on = p.key === current.key;
          return (
            <li key={p.key} className="flex flex-1">
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
                  <span className="block text-[16px] font-bold leading-tight">{p.name}</span>
                  <span className="block text-[12px] font-semibold text-ink-mute">{p.short}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div
        ref={panel}
        id="pillar-panel"
        aria-live="polite"
        className="fx-spot wash rounded-card bg-card p-md shadow-toy-soft md:p-lg"
        style={{ '--wash': r.color } as CSSProperties}
      >
        <div className="flex items-center gap-md">
          <Avatar relationship={r.key} size={96} mood="excited" />
          <div className="min-w-0">
            <p className="m-0 type-eyebrow text-ink-mute">{current.eyebrow}</p>
            <h2 className="type-hook mt-xs m-0 text-[clamp(28px,5vw,44px)]">{current.headline}</h2>
          </div>
        </div>
        {current.quote && <p className="mt-md m-0 text-balance text-[18px] font-bold leading-snug">“{current.quote}”</p>}
        <p className="mt-sm m-0 text-balance text-[16px] font-semibold text-ink-soft">{current.line}</p>
        {current.features.length > 0 && (
          <div className="mt-md">
            <h3 className="m-0 text-[14px] font-extrabold" style={{ color: `var(--deep-${r.key})` }}>
              {current.features.length} {current.features.length === 1 ? 'app' : 'apps'} for this {current.isArea ? 'area' : 'pillar'}
            </h3>
            <div className="mt-xs">
              <AppGrid items={shown} />
            </div>
            {more.length > 0 && (
              <Fold className="mt-xs" title={`Show all ${current.features.length} apps`}>
                <AppGrid items={more} />
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
    short: `Pillar ${r.floor} of 7`,
    relationship: r,
    eyebrow: `Pillar ${r.floor} of 7, with ${r.character}, ${r.role}`,
    headline: r.name,
    quote: r.greeting,
    line: r.question,
    features: featuresForRelationship(r.key),
  }));
  const fivePicks: Choice[] = (Object.keys(LIFE_AREAS) as LifeAreaKey[]).map((k) => {
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
          <h1 className="type-hook mt-sm text-[clamp(40px,9vw,80px)]">
            <TextReveal parts={[{ text: 'Seven relationships' }, { text: 'make a life', em: true }]} />
          </h1>
          <p className="mt-md m-0 max-w-[520px] text-balance text-[18px] font-semibold leading-snug text-ink-soft">
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

      <section className="mt-2xl text-center">
        <motion.div {...rise} className="rounded-card bg-ink p-lg text-on-ink">
          <h2 className="type-hook text-[clamp(32px,6vw,56px)] text-on-ink [&_em]:text-on-ink/70!">
            Find out where <em>yours stand</em>
          </h2>
          <p className="mt-xs m-0 text-balance text-[16px] font-semibold text-on-ink/80">A short chat places all seven, then builds a pillar for the ones that need you most.</p>
          <Link
            to={entry === '/home' ? '/home' : '/start'}
            className="toy fx-shimmer mt-md inline-flex min-h-[56px] items-center rounded-pill bg-card px-lg text-[18px] font-bold text-ink"
          >
            Start free
          </Link>
        </motion.div>
      </section>
    </SiteLayout>
  );
}
