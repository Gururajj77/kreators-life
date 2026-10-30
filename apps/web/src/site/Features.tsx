import { MODULE_GROUPS, type ModuleGroup } from '@kreators/shared';
import { motion } from 'motion/react';
import { Link } from 'react-router';
import { FEATURES, SITE_FEATURES } from './content';
import { rise } from './SevenRP';
import { SiteLayout, useAppEntry } from './SiteLayout';

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
  const groups: ModuleGroup[] = ['core', 'earn', 'community', 'wellbeing', 'creator'];
  return (
    <SiteLayout>
      <header className="pt-lg md:pt-xl">
        <p className="m-0 type-eyebrow text-ink-mute">Features</p>
        <h1 className="type-hook mt-sm text-[clamp(40px,9vw,80px)]">Everything a creator needs, <em>one switch at a time</em></h1>
        <p className="type-context type-measure mt-md m-0 text-[20px] text-ink-soft">Courses in one app, gigs in another, money in a sheet. It adds up to ten logins and no plan. Here every app is a switch inside one place: keep what you use, and the rest stays out of the way.</p>
        <p className="type-measure mt-sm m-0 text-[16px] font-semibold text-ink-soft">A short chat at the start switches on the ones that fit you. Tap any app below to see how it works.</p>
      </header>
      {groups.map((g) => {
        const list = SITE_FEATURES.filter((m) => m.group === g);
        if (list.length === 0) return null;
        return (
          <section key={g} className="mt-xl" aria-labelledby={`group-${g}`}>
            <h2 id={`group-${g}`} className="type-hook text-[clamp(28px,5vw,40px)]">
              {MODULE_GROUPS[g]}
            </h2>
            <ul className="bento mt-sm list-none p-0 m-0">
              {list.map((m, i) => (
                <motion.li key={m.key} {...rise} className={span(i, list.length)}>
                  <Link to={`/features/${m.key}`} className="toy toy-soft flex h-full min-h-[120px] flex-col rounded-tile bg-card p-md">
                    <span className="text-[28px]" aria-hidden="true">
                      {m.emoji}
                    </span>
                    <span className="mt-xs block text-[18px] font-extrabold leading-tight tracking-tight">{m.name}</span>
                    <span className="block text-pretty text-[14px] font-semibold leading-snug text-ink-soft">{FEATURES[m.key]?.tagline ?? m.blurb}</span>
                  </Link>
                </motion.li>
              ))}
            </ul>
          </section>
        );
      })}
      <section className="mt-2xl">
        <div className="rounded-card bg-ink p-lg text-on-ink">
          <h2 className="type-hook text-[clamp(32px,6vw,56px)] text-on-ink">Switch on only <em>what you need</em></h2>
          <p className="type-context mt-sm m-0 text-[18px] text-on-ink/80">Answer three questions and we switch on the apps that fit you. Change them any time, free.</p>
          <Link to={entry === '/home' ? '/home' : '/start'} className="toy mt-md inline-flex min-h-[56px] items-center rounded-pill bg-card px-lg text-[18px] font-bold text-ink">
            Start free
          </Link>
        </div>
      </section>
    </SiteLayout>
  );
}
