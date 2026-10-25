import { levelProgress, RELATIONSHIPS, type Relationship, type RelationshipState } from '@kreators/shared';
import { motion, useReducedMotion } from 'motion/react';
import type { CSSProperties } from 'react';
import { Link } from 'react-router';
import { Avatar } from '../components/Avatar';
import { Ring } from '../components/Ring';
import { Screen } from '../components/Screen';
import { Pyramid } from '../components/Pyramid';
import { XpBar } from '../components/XpBar';
import { useMe } from '../lib/queries';

function Floor({ r, state, delay }: { r: Relationship; state: RelationshipState | undefined; delay: number }) {
  const reduce = useReducedMotion();
  const built = (state?.pillars ?? 0) > 0;
  const lp = levelProgress(state?.xp ?? 0);
  const todo = state?.activeTasks ?? 0;
  const done = state?.doneTasks ?? 0;
  const asked = state?.answered ?? true;
  const line = !asked ? `Not asked yet. Tap to answer ${r.character}'s three questions.` : built ? `Set up. ${todo === 0 ? 'Nothing to do' : `${todo} to do`}, ${done} done.` : 'Not set up yet. Tap to start.';

  return (
    <motion.li
      initial={{ opacity: 0, y: reduce ? 0 : 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: reduce ? 0 : delay, type: 'spring', stiffness: 300, damping: 24 }}
    >
      <Link
        to={asked ? `/realm/${r.key}` : `/vibe-check?floor=${r.key}`}
        className="toy flex items-center gap-sm rounded-tile p-sm"
        style={{ background: r.color, color: r.text, '--toy-color': `var(--deep-${r.key})` } as CSSProperties}
      >
        <Avatar relationship={r.key} size={52} mood={built ? 'happy' : 'sleepy'} stage={state?.stage ?? 1} still decorative className="avatar-hop" />
        <span className="min-w-0 flex-1">
          <span className="block font-display text-[18px] font-extrabold leading-tight">{r.name}</span>
          <span className="block text-[14px] font-bold">{line}</span>
        </span>
        <Ring value={lp.pct} size={48} stroke={5} color={r.text} track="rgba(0,0,0,0.18)" label={`${r.name} level ${lp.level}`}>
          <span className="font-display text-[14px] font-extrabold">{lp.level}</span>
        </Ring>
      </Link>
    </motion.li>
  );
}

export function Tower() {
  const me = useMe();
  if (!me.data) return null;
  const { user, relationships } = me.data;
  const byKey = new Map(relationships.map((r) => [r.key, r]));
  const floors = [...RELATIONSHIPS].sort((a, b) => b.floor - a.floor);
  const builtCount = relationships.filter((r) => r.pillars > 0).length;

  const weakest = [...relationships].sort((a, b) => a.xp - b.xp)[0]?.key ?? 'self';
  return (
    <Screen columns={false}>
      <header className="pt-lg">
        <h1 className="text-[30px]">Your seven areas</h1>
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">
          One area for each relationship in your life. Tap an area to set it up. An area that is set up sends its tasks to Daily.
        </p>
        <div className="mt-md rounded-card bg-card p-md shadow-toy-soft">
          <XpBar xp={user.xp} />
          <p className="mt-sm m-0 text-[14px] font-semibold text-ink-soft">
            {builtCount} of {RELATIONSHIPS.length} areas set up.
          </p>
        </div>
      </header>
      <ol className="mt-md flex list-none flex-col gap-xs p-0 m-0" aria-label="Areas, top to bottom">
        {floors.map((r, i) => (
          <Floor key={r.key} r={r} state={byKey.get(r.key)} delay={(floors.length - 1 - i) * 0.07} />
        ))}
      </ol>
      <section className="mt-lg rounded-card bg-card p-md shadow-toy-soft" aria-labelledby="how-heading">
        <div>
          <div>
            <h2 id="how-heading" className="text-[24px]">
              How an area works
            </h2>
            <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">
              Every area is a pyramid. The base is one thing you will not let break. The tip is one small task for today. Tick the task and the whole pyramid gets stronger. That is the whole game.
            </p>
            <p className="mt-sm m-0 text-[14px] font-semibold text-ink-soft">
              Most apps start with tasks, and tasks fade in a week. This starts at the base, so each task has a reason to exist.
            </p>
          </div>
          <div className="mt-md">
            <Pyramid relationship={weakest} compact />
          </div>
        </div>
      </section>
    </Screen>
  );
}
