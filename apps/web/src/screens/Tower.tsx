import { COURAGE, levelByValue, levelProgress, placementFlags, RELATIONSHIP_BY_KEY, RELATIONSHIPS, type Placement, type Relationship, type RelationshipState } from '@kreators/shared';
import { motion, useReducedMotion } from 'motion/react';
import type { CSSProperties } from 'react';
import { Link } from 'react-router';
import { Avatar } from '../components/Avatar';
import { Ring } from '../components/Ring';
import { Screen } from '../components/Screen';
import { Pyramid } from '../components/Pyramid';
import { XpBar } from '../components/XpBar';
import { ConsciousnessMap } from '../components/LifeMap';
import { LifeMapPanel } from '../components/LifeMapPanel';
import { NotToDoBlock } from '../components/NotToDoList';
import { api } from '../lib/api';
import { todayLocal } from '../lib/date';
import { useAuthed, useMe } from '../lib/queries';

/** One pillar card. With a strategy session behind it, the card carries the pillar's map line: floor to core, the Courage mark, and a focus tag. */
function Floor({ r, state, delay, placement, focus }: { r: Relationship; state: RelationshipState | undefined; delay: number; placement: Placement | null; focus: boolean }) {
  const reduce = useReducedMotion();
  const built = (state?.pillars ?? 0) > 0;
  const lp = levelProgress(state?.xp ?? 0);
  const todo = state?.activeTasks ?? 0;
  const done = state?.doneTasks ?? 0;
  const asked = state?.answered ?? true;
  const line = !asked ? `Not asked yet. Tap to answer ${r.character}'s three questions.` : built ? `Set up. ${todo === 0 ? 'Nothing to do' : `${todo} to do`}, ${done} done.` : 'Not set up yet. Tap to start.';
  const f = placement ? placementFlags(placement) : null;
  const pct = (v: number) => ((v - 20) / (540 - 20)) * 100;

  return (
    <motion.li
      initial={{ opacity: 0, y: reduce ? 0 : 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: reduce ? 0 : delay, type: 'spring', stiffness: 300, damping: 24 }}
    >
      <Link
        to={asked ? `/realm/${r.key}` : `/vibe-check?floor=${r.key}`}
        className="toy block rounded-tile p-sm"
        style={{ background: `linear-gradient(135deg, ${r.color}, color-mix(in oklab, ${r.color} 78%, var(--fill-shade)))`, color: r.text, '--toy-color': `var(--deep-${r.key})` } as CSSProperties}
      >
        <span className="flex items-center gap-sm">
          <Avatar relationship={r.key} size={52} mood={built ? 'happy' : 'sleepy'} stage={state?.stage ?? 1} still decorative className="avatar-hop" />
          <span className="min-w-0 flex-1">
            <span className="block font-display text-[18px] font-extrabold leading-tight">
              {r.name}
              {focus && <span className="ml-xs rounded-pill bg-[rgba(0,0,0,0.18)] px-xs text-[11px] font-extrabold uppercase tracking-wide align-middle">Focus</span>}
            </span>
            <span className="block text-[14px] font-bold">{line}</span>
          </span>
          <Ring value={lp.pct} size={48} stroke={5} color={r.text} track="rgba(0,0,0,0.18)" label={`${r.name} level ${lp.level}`}>
            <span className="font-display text-[14px] font-extrabold">{lp.level}</span>
          </Ring>
        </span>
        {f && (
          <span className="mt-sm block">
            <span className="flex items-center justify-between text-[12px] font-bold">
              <span>On the map</span>
              <span>
                {levelByValue(f.floor)?.name} to {levelByValue(f.core)?.name}
              </span>
            </span>
            <span className="relative mt-xs block h-[6px] rounded-pill bg-[rgba(0,0,0,0.18)]" aria-hidden="true">
              <span className="absolute top-0 h-full w-px bg-current opacity-60" style={{ left: `${pct(COURAGE)}%` }} />
              <span className="absolute top-0 h-full rounded-pill bg-current" style={{ left: `${pct(f.floor)}%`, width: `${Math.max(2, pct(f.core) - pct(f.floor))}%` }} />
            </span>
            {(f.required || f.volatile) && <span className="mt-xs block text-[12px] font-bold">{f.required ? 'The floor is under Courage: a good place to start.' : 'A big drop under stress: check it weekly.'}</span>}
          </span>
        )}
      </Link>
    </motion.li>
  );
}

/** The pillars' own setup: before the strategy session, one card that starts it. After it, the pillar cards carry the map themselves. */
function StartSessionCard() {
  return (
    <Link to="/session" className="toy toy-soft mt-md flex items-center gap-sm rounded-card bg-ink p-md text-on-ink">
      <span className="min-w-0 flex-1">
        <span className="block font-display text-[18px] font-extrabold">Set up your pillars: the strategy session</span>
        <span className="mt-xs block text-[14px] font-semibold text-on-ink/70">A few minutes with all seven characters. Place each relationship on the map, then leave with a routine, a contract and your first pyramids.</span>
      </span>
      <span aria-hidden="true" className="text-[22px]">→</span>
    </Link>
  );
}

export function Tower() {
  const me = useMe();
  const date = todayLocal();
  const sess = useAuthed(['session', date], () => api.session(date));
  if (!me.data) return null;
  const { user, relationships } = me.data;
  const assessment = sess.data?.assessment ?? null;
  const placementOf = (key: Relationship['key']) => assessment?.placements.find((p) => p.relationship === key) ?? null;
  const focus = assessment?.focus ?? [];
  const focusNames = focus.map((k) => RELATIONSHIP_BY_KEY[k].name.toLowerCase());
  const byKey = new Map(relationships.map((r) => [r.key, r]));
  const floors = [...RELATIONSHIPS].sort((a, b) => b.floor - a.floor);
  const builtCount = relationships.filter((r) => r.pillars > 0).length;

  const weakest = [...relationships].sort((a, b) => a.xp - b.xp)[0]?.key ?? 'self';
  return (
    <Screen columns={false}>
      <header className="pt-lg">
        <h1 className="text-[30px]">Your seven pillars</h1>
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">
          One pillar for each relationship in your life. Tap a pillar to set it up. A pillar that is set up sends its tasks to Daily.
        </p>
        <div className="mt-md rounded-card bg-card p-md shadow-toy-soft">
          <XpBar xp={user.xp} />
          <p className="mt-sm m-0 text-[14px] font-semibold text-ink-soft">
            {builtCount} of {RELATIONSHIPS.length} pillars set up.{builtCount < RELATIONSHIPS.length ? ' Setting up all seven earns the All seven badge.' : ' That earned the All seven badge.'}
          </p>
        </div>
        {!sess.isPending && !assessment && <StartSessionCard />}
      </header>
      {assessment && (
        <div className="mt-md flex items-end justify-between gap-sm">
          <p className="m-0 text-[14px] font-semibold text-ink-soft">{focusNames.length ? `Month one: ${focusNames.join(' and ')}. ` : ''}Each card shows where that relationship lives on the map, and where it drops.</p>
          <a href="#life-map" className="shrink-0 text-[14px] font-bold underline underline-offset-4">
            Life map below
          </a>
        </div>
      )}
      <ol className="mt-sm flex list-none flex-col gap-xs p-0 m-0" aria-label="Pillars, top to bottom">
        {floors.map((r, i) => (
          <Floor key={r.key} r={r} state={byKey.get(r.key)} delay={(floors.length - 1 - i) * 0.07} placement={placementOf(r.key)} focus={focus.includes(r.key)} />
        ))}
      </ol>
      {/* The same not-to-do block as on Daily: what you stay away from protects these pillars too. */}
      <NotToDoBlock />
      <LifeMapPanel />
      <section className="mt-lg rounded-card bg-card p-md shadow-toy-soft" aria-labelledby="how-heading">
        <div>
          <div>
            <h2 id="how-heading" className="text-[24px]">
              How a pillar works
            </h2>
            <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">
              Every pillar is a pyramid. The foundation at the top is one thing you will not let break. The point at the bottom is one small task for today. Tick the task and the whole pyramid gets stronger. That is the whole game.
            </p>
            <p className="mt-sm m-0 text-[14px] font-semibold text-ink-soft">
              Most apps start with tasks, and tasks fade in a week. This starts at the foundation, so each task has a reason to exist.
            </p>
          </div>
          <div className="mt-md">
            <Pyramid relationship={weakest} compact />
          </div>
        </div>
      </section>
      {/* The scale the map is drawn on, from the strategy session, under how a pillar works and above How it works. */}
      <section className="mt-lg" aria-label="The scale of consciousness">
        <ConsciousnessMap />
      </section>
    </Screen>
  );
}
