import { MODULE_GROUPS, type ModuleGroup } from '@kreators/shared';
import { motion } from 'motion/react';
import { Link } from 'react-router';
import { FEATURES, SITE_FEATURES } from './content';
import { rise } from './SevenRP';
import { SiteLayout, useAppEntry } from './SiteLayout';

/** Everything a creator needs, by group: every app, each opening into its own page. */
export function Features() {
  const entry = useAppEntry();
  const groups: ModuleGroup[] = ['core', 'earn', 'community', 'wellbeing', 'creator'];
  return (
    <SiteLayout>
      <header className="pt-lg md:pt-xl">
        <p className="m-0 text-[14px] font-extrabold uppercase tracking-wide text-ink-mute">Features</p>
        <h1 className="mt-xs text-[clamp(32px,6vw,56px)] leading-[1.05] text-balance">Everything a creator needs</h1>
        <p className="mt-md m-0 max-w-[640px] text-pretty text-[18px] font-semibold leading-snug text-ink-soft">Every feature is a switch. Keep what you use, hide the rest. Each one opens into the app once you sign in.</p>
      </header>
      {groups.map((g) => {
        const list = SITE_FEATURES.filter((m) => m.group === g);
        if (list.length === 0) return null;
        return (
          <section key={g} className="mt-xl" aria-labelledby={`group-${g}`}>
            <h2 id={`group-${g}`} className="text-[28px] text-balance">
              {MODULE_GROUPS[g]}
            </h2>
            <ul className="mt-sm grid list-none gap-xs p-0 m-0 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((m) => (
                <motion.li key={m.key} {...rise}>
                  <Link to={`/features/${m.key}`} className="toy toy-soft flex min-h-[120px] flex-col rounded-tile bg-card p-md">
                    <span className="text-[28px]" aria-hidden="true">
                      {m.emoji}
                    </span>
                    <span className="mt-xs block text-[18px] font-extrabold leading-tight">{m.name}</span>
                    <span className="block text-pretty text-[14px] font-semibold leading-snug text-ink-soft">{FEATURES[m.key]?.tagline ?? m.blurb}</span>
                  </Link>
                </motion.li>
              ))}
            </ul>
          </section>
        );
      })}
      <section className="mt-2xl text-center">
        <div className="rounded-card bg-ink p-lg text-on-ink">
          <h2 className="text-[32px] text-on-ink text-balance">Switch on only what you need</h2>
          <p className="mt-xs m-0 text-pretty text-[16px] font-semibold text-on-ink/80">A short chat at the start picks the apps that fit you. Change them any time.</p>
          <Link to={entry === '/home' ? '/home' : '/start'} className="toy mt-md inline-flex min-h-[56px] items-center rounded-pill bg-card px-lg text-[18px] font-bold text-ink">
            Start free
          </Link>
        </div>
      </section>
    </SiteLayout>
  );
}
