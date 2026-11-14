import { MODULE_GROUP_ACCENT, MODULE_GROUP_BLURB, MODULE_GROUPS, RELATIONSHIP_BY_KEY, type ModuleGroup } from '@kreators/shared';
import gsap from 'gsap';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Avatar } from './Avatar';
import { tick } from './fx/haptics';
import { ToggleChevron } from './ToggleMark';

/**
 * One app group as a big accordion in its pillar's colour: the look of a group on the Apps page and under Profile, Features (AppGroups.tsx,
 * which draws its groups through this), moved here unchanged so All tables draws its groups the same way (2026-11-14, the founder: "put them in
 * toggles based on categories in every place they occur ... in the same ways apps are in toggles"). The header is one button with the group's
 * character, its name, a line under it, a count in a pill and a chevron; whatever sits under the header (`controls`) stays in sight while it is
 * closed; the body slides open and shut with GSAP (set at once under reduced motion), and a group that starts open shows open at once.
 * Open or closed is the caller's: AppGroups keeps it per tab with useKept and holds it while selecting, as do the tables' lists.
 *
 * A group is a named region (`<section>`) by default, as on Apps. Where the same group names come again on one page (Profile draws Features and
 * two share lists of tables), a list passes `region={false}` and each group is a plain labelled group, so a screen reader's landmarks list never
 * holds three regions called "Essentials" (the review, 2026-11-14). `heading` puts the toggle inside a heading of that level (the accordion
 * pattern: the heading holds the button), so a page whose groups are its sections keeps one heading a group (All tables).
 */
export function GroupAccordion({
  group,
  open,
  onToggle,
  count,
  mood,
  blurb = MODULE_GROUP_BLURB[group],
  controls,
  region = true,
  heading,
  children,
}: {
  group: ModuleGroup;
  open: boolean;
  onToggle: () => void;
  /** The words in the pill: "3 of 8 shown", "4 tables", "2 of 9 shared". */
  count: ReactNode;
  /** The character is happy while the group holds something on (an app shown, a table shared), sleepy otherwise. */
  mood: 'happy' | 'sleepy';
  /** The line under the name: the group's own line unless the list says what is inside it. */
  blurb?: ReactNode;
  controls?: ReactNode;
  /** A named region (true, the default) or a plain labelled group (false), for a page that draws the same groups more than once. */
  region?: boolean;
  /** The heading level the toggle sits in, for a page whose groups are its sections; none by default. */
  heading?: 2 | 3;
  children: ReactNode;
}) {
  const body = useRef<HTMLDivElement>(null);
  const id = useId();
  const rel = RELATIONSHIP_BY_KEY[MODULE_GROUP_ACCENT[group]];

  // A group that starts open shows open at once; only a tap slides it.
  const first = useRef(true);
  useEffect(() => {
    const el = body.current;
    if (!el) return;
    // A slide still running would finish after this one and hide the group again.
    gsap.killTweensOf(el);
    if (first.current) {
      first.current = false;
      if (open) {
        el.hidden = false;
        gsap.set(el, { height: 'auto', opacity: 1 });
      }
      return;
    }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (open) {
      el.hidden = false;
      if (reduce) gsap.set(el, { height: 'auto', opacity: 1 });
      else gsap.fromTo(el, { height: 0, opacity: 0 }, { height: 'auto', opacity: 1, duration: 0.32, ease: 'power3.out' });
    } else if (!el.hidden) {
      if (reduce) {
        gsap.set(el, { height: 0, opacity: 0 });
        el.hidden = true;
      } else gsap.to(el, { height: 0, opacity: 0, duration: 0.22, ease: 'power2.in', onComplete: () => void (el.hidden = true) });
    }
  }, [open]);

  const Shell = region ? 'section' : 'div';
  const Heading = heading === 2 ? 'h2' : heading === 3 ? 'h3' : null;
  const toggle = (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={`${id}-b`}
      onClick={() => {
        tick();
        onToggle();
      }}
      className="toy toy-flat flex min-h-[72px] w-full items-center gap-sm rounded-card p-sm text-left"
    >
      <Avatar relationship={rel.key} size={44} decorative still mood={mood} />
      <span className="min-w-0 flex-1">
        <span id={`${id}-h`} className="block text-title3 type-figure">
          {MODULE_GROUPS[group]}
        </span>
        <span className="block text-footnote" style={{ color: `var(--deep-${rel.key})` }}>
          {blurb}
        </span>
      </span>
      <span className="shrink-0 rounded-pill bg-card-strong px-sm text-caption font-medium leading-[26px]" style={{ color: `var(--deep-${rel.key})` }}>
        {count}
      </span>
      <ToggleChevron open={open} size={20} className="text-ink-soft" />
    </button>
  );
  return (
    <Shell
      role={region ? undefined : 'group'}
      aria-labelledby={`${id}-h`}
      data-pillar={rel.key}
      className="rounded-card"
      style={{ background: `var(--soft-${rel.key})` }}
    >
      {Heading ? (
        // The heading takes nothing of its own look (the button's words keep their roles); On this page reads its name from `data-contents`.
        <Heading className="m-0" style={{ font: 'inherit', letterSpacing: 'inherit' }} data-contents={MODULE_GROUPS[group]}>
          {toggle}
        </Heading>
      ) : (
        toggle
      )}
      {controls}
      {/* One small gap under the group's toggle, so its hover tint never touches the list (the founder, 2026-11-06). */}
      <div ref={body} id={`${id}-b`} hidden={!open} className="overflow-hidden">
        <div className="pt-xs">{children}</div>
      </div>
    </Shell>
  );
}
