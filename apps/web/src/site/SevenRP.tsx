import type { CSSProperties } from 'react';
import { LIFE_AREAS, RELATIONSHIP_BY_KEY, RELATIONSHIPS, type LifeAreaKey, type Relationship, type RelationshipKey } from '@kreators/shared';
import { motion, useInView, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Avatar } from '../components/Avatar';
import { useParamState } from '../lib/useParamState';
import { featuresForLifeArea, featuresForRelationship } from './content';
import { ScrollTroupe } from './ScrollTroupe';
import { SiteLayout, useAppEntry } from './SiteLayout';

/** Tells the troupe which relationship is on screen. Null means none, so everyone walks as equals. */
function Zone({ value, onActive, children, className = '', id }: { value: RelationshipKey | null; onActive: (k: RelationshipKey | null) => void; children: ReactNode; className?: string; id?: string }) {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { margin: '-45% 0px -45% 0px' });
  useEffect(() => {
    if (inView) onActive(value);
  }, [inView, value, onActive]);
  return (
    <section ref={ref} id={id} className={className}>
      {children}
    </section>
  );
}

export const rise = { initial: { opacity: 0, y: 24 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: '-60px' }, transition: { duration: 0.5 } };

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
            transition={{ delay: 0.1 + i * 0.08, type: 'spring', stiffness: 260, damping: 18 }}
          >
            <motion.div className="absolute -top-[30px]" animate={reduce ? undefined : { y: [0, -6, 0] }} transition={{ duration: 2.4 + i * 0.2, repeat: Infinity, ease: 'easeInOut', delay: i * 0.3 }}>
              <Avatar relationship={r.key} size={44} decorative />
            </motion.div>
          </motion.div>
        );
      })}
    </div>
  );
}

function FloorSection({ r, onActive }: { r: Relationship; onActive: (k: RelationshipKey | null) => void }) {
  const features = featuresForRelationship(r.key);
  const dark = r.text === '#FFFFFF';
  return (
    <Zone value={r.key} onActive={onActive} id={r.key} className="scroll-mt-xl">
      <motion.div {...rise} className="wash grid gap-md rounded-card bg-card p-md shadow-toy-soft md:grid-cols-[1fr_2fr] md:items-center md:gap-lg md:p-lg" style={{ '--wash': r.color } as CSSProperties}>
        <div className="flex flex-col items-center gap-sm">
          <motion.div whileInView={{ rotate: [0, -6, 6, 0] }} viewport={{ margin: '-30%' }} transition={{ duration: 0.9 }}>
            <Avatar relationship={r.key} size={160} mood="excited" />
          </motion.div>
          <div className="h-[16px] w-[200px] rounded-pill" style={{ background: r.color }} aria-hidden="true" />
          <p className="m-0 text-[14px] font-extrabold" style={{ color: `var(--deep-${r.key})` }}>
            Pillar {r.floor} of 7
          </p>
        </div>
        <div>
          <h2 className="type-hook m-0 text-[clamp(32px,6vw,48px)]">{r.name}</h2>
          <p className="mt-xs m-0 text-pretty text-[18px] font-bold leading-snug">“{r.greeting}”</p>
          <p className="mt-xs m-0 text-pretty text-[16px] font-semibold text-ink-soft">
            The question {r.character}, your {r.role}, keeps asking: <span className="text-ink">{r.question}</span>
          </p>
          {features.length > 0 && (
            <ul className="mt-md flex list-none flex-wrap gap-xs p-0 m-0">
              {features.map((m) => (
                <li key={m.key}>
                  <Link to={`/features/${m.key}`} className={`toy inline-flex min-h-[40px] items-center gap-xs rounded-pill px-sm text-[14px] font-bold ${dark ? 'text-white' : 'text-ink-fixed'}`} style={{ background: r.color, ['--toy-color' as string]: r.deep }}>
                    <span aria-hidden="true">{m.emoji}</span>
                    {m.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </motion.div>
    </Zone>
  );
}

/** One of the five areas of life, with the apps that serve it, in its relationship's colour. */
function LifeAreaSection({ k }: { k: LifeAreaKey }) {
  const meta = LIFE_AREAS[k];
  const r = RELATIONSHIP_BY_KEY[meta.relationship];
  const features = featuresForLifeArea(k);
  const dark = r.text === '#FFFFFF';
  return (
    <motion.div {...rise} id={k} className="wash grid scroll-mt-xl gap-md rounded-card bg-card p-md shadow-toy-soft md:grid-cols-[1fr_2fr] md:items-center md:gap-lg md:p-lg" style={{ '--wash': r.color } as CSSProperties}>
      <div className="flex flex-col items-center gap-sm">
        <Avatar relationship={r.key} size={120} mood="happy" />
        <p className="m-0 text-[36px]" aria-hidden="true">
          {meta.emoji}
        </p>
      </div>
      <div>
        <h2 className="type-hook m-0 text-[clamp(32px,6vw,48px)]">{meta.name}</h2>
        <p className="mt-xs m-0 text-pretty text-[16px] font-semibold text-ink-soft">{meta.blurb}</p>
        <ul className="mt-md flex list-none flex-wrap gap-xs p-0 m-0">
          {features.map((m) => (
            <li key={m.key}>
              <Link to={`/features/${m.key}`} className={`toy inline-flex min-h-[40px] items-center gap-xs rounded-pill px-sm text-[14px] font-bold ${dark ? 'text-white' : 'text-ink-fixed'}`} style={{ background: r.color, ['--toy-color' as string]: r.deep }}>
                <span aria-hidden="true">{m.emoji}</span>
                {m.name}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </motion.div>
  );
}

/**
 * The 7RP page: the seven relationships, each a pillar with its own character and the apps that serve it, and the
 * same seven read as the five areas of life. The troupe walks along and the character on screen steps forward.
 */
export function SevenRP() {
  const [active, setActive] = useState<RelationshipKey | null>(null);
  const [viewRaw, setView] = useParamState('view', 'seven');
  const view = viewRaw === 'five' ? 'five' : 'seven';
  const entry = useAppEntry();
  return (
    <SiteLayout>
      <ScrollTroupe active={active} />
      <Zone value={null} onActive={setActive} className="grid gap-lg pt-lg md:grid-cols-2 md:items-center md:pt-xl">
        <div>
          <p className="m-0 type-eyebrow text-ink-mute">7RP: the seven relationships</p>
          <h1 className="type-hook mt-sm text-[clamp(40px,9vw,80px)]">Seven relationships <em>make a life</em></h1>
          <p className="mt-md m-0 max-w-[520px] text-pretty text-[18px] font-semibold leading-snug text-ink-soft">
            Work and money, friends, family, a partner, yourself, your teachers and your faith. In kreators.app each one is a pillar with its own guide, and every app serves at least one of them.
          </p>
          <div role="group" aria-label="View" className="mt-md flex flex-wrap gap-xs">
            {(['seven', 'five'] as const).map((v) => (
              <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} className={`toy min-h-[44px] rounded-pill border-2 px-md text-[14px] font-bold ${view === v ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card text-ink'}`}>
                {v === 'seven' ? 'Seven relationships' : 'Five areas of life'}
              </button>
            ))}
          </div>
        </div>
        <div className="pt-lg md:pt-0">
          <Tower />
        </div>
      </Zone>

      <div className="mt-xl">
        <p className="m-0 max-w-[640px] text-pretty text-[16px] font-semibold text-ink-soft">
          {view === 'seven' ? 'Red at the bottom, violet at the top. Each pillar has its own character, and each part of the app serves at least one pillar.' : 'Physical, financial, emotional, mental and spiritual: the same seven relationships, read the way a life is usually read. Each one lists the apps that serve it.'}
        </p>
        <div className="mt-md flex flex-col gap-md">
          {view === 'seven' ? RELATIONSHIPS.map((r) => <FloorSection key={r.key} r={r} onActive={setActive} />) : (Object.keys(LIFE_AREAS) as LifeAreaKey[]).map((k) => <LifeAreaSection key={k} k={k} />)}
        </div>
      </div>

      <Zone value={null} onActive={setActive} className="mt-2xl text-center">
        <motion.div {...rise} className="rounded-card bg-ink p-lg text-on-ink">
          <h2 className="type-hook text-[clamp(32px,6vw,56px)] text-on-ink">Find out where <em>yours stand</em></h2>
          <p className="mt-xs m-0 text-pretty text-[16px] font-semibold text-on-ink/80">A short chat places all seven, then builds a pillar for the ones that need you most.</p>
          <Link to={entry === '/home' ? '/home' : '/start'} className="toy mt-md inline-flex min-h-[56px] items-center rounded-pill bg-card px-lg text-[18px] font-bold text-ink">
            Start free
          </Link>
        </motion.div>
      </Zone>
    </SiteLayout>
  );
}
