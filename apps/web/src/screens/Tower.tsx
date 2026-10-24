import { levelProgress, RELATIONSHIPS, type Relationship, type RelationshipState } from '@kreators/shared';
import { motion, useReducedMotion } from 'motion/react';
import type { CSSProperties } from 'react';
import { Link } from 'react-router';
import { Avatar } from '../components/Avatar';
import { Ring } from '../components/Ring';
import { Screen } from '../components/Screen';
import { XpBar } from '../components/XpBar';
import { useMe } from '../lib/queries';

function Floor({ r, state, delay }: { r: Relationship; state: RelationshipState | undefined; delay: number }) {
  const reduce = useReducedMotion();
  const built = (state?.pillars ?? 0) > 0;
  const lp = levelProgress(state?.xp ?? 0);
  const todo = state?.activeTasks ?? 0;
  const done = state?.doneTasks ?? 0;
  const line = built ? `Built. ${todo === 0 ? 'Nothing to do' : `${todo} to do`}, ${done} done.` : 'Not built. Tap to build.';

  return (
    <motion.li
      initial={{ opacity: 0, y: reduce ? 0 : 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: reduce ? 0 : delay, type: 'spring', stiffness: 300, damping: 24 }}
    >
      <Link
        to={`/realm/${r.key}`}
        className="toy flex items-center gap-sm rounded-tile p-sm"
        style={{ background: r.color, color: r.text, '--toy-color': r.deep } as CSSProperties}
      >
        <Avatar relationship={r.key} size={52} mood={built ? 'happy' : 'sleepy'} stage={state?.stage ?? 1} still decorative className="avatar-hop" />
        <span className="min-w-0 flex-1">
          <span className="block font-display text-[18px] font-extrabold leading-tight">{r.name}</span>
          <span className="block text-[13px] font-bold">{line}</span>
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

  return (
    <Screen>
      <header className="pt-lg">
        <h1 className="text-[32px]">Tower</h1>
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">
          Seven floors, one per relationship. Tap a floor to build it. Built floors send their tasks to Today.
        </p>
        <div className="mt-md rounded-card bg-card p-md shadow-toy-soft">
          <XpBar xp={user.xp} />
          <p className="mt-sm m-0 text-[13px] font-semibold text-ink-soft">
            {builtCount} of {RELATIONSHIPS.length} floors built.
          </p>
        </div>
      </header>
      <ol className="mt-md flex list-none flex-col gap-xs p-0 m-0" aria-label="Floors, top to bottom">
        {floors.map((r, i) => (
          <Floor key={r.key} r={r} state={byKey.get(r.key)} delay={(floors.length - 1 - i) * 0.07} />
        ))}
      </ol>
    </Screen>
  );
}
