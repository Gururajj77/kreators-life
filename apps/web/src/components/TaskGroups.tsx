import { LIFE_AREAS, slotRangeLabel, spanLabel, type TaskGroup } from '@kreators/shared';
import { tbClass, tbStyle } from '../lib/blockColor';
import gsap from 'gsap';
import { useId, useLayoutEffect, useRef, type ReactNode } from 'react';
import { useKept } from '../lib/kept';
import { useMe } from '../lib/queries';
import { AppIcon } from './AppIcon';
import { Button } from './Button';
import { tick } from './fx/haptics';
import { ToggleChevron } from './ToggleMark';

/**
 * Daily's grouped view (docs/time-blocks.md): the tasks in coloured boxes, one per time block of the day (in clock order) or one per area
 * of life (in LIFE_AREA_ORDER), drawn like the app groups on Profile: a box in its own soft colour whose header is one button that opens
 * and folds it. Inside each box the tasks keep the order `groupTasks` gave them, so the priority comes first. Which boxes are open is kept
 * for the tab and the person (lib/kept.ts); every box starts open.
 */
export function TaskGroups<T extends { id: string }>({ groups, renderTask, more = false, by }: { groups: TaskGroup<T>[]; renderTask: (t: T) => ReactNode; /** More tasks wait past the ones sent (`tasksMore`). */ more?: boolean; by: 'block' | 'area' }) {
  const me = useMe();
  const [shut, setShut] = useKept<Record<string, boolean>>(`taskgroups:${me.data?.user.id ?? 'anon'}`, by, {});
  const openAll = () => setShut({});
  const foldAll = () => setShut(Object.fromEntries(groups.map((g) => [g.key, true])));
  const anyOpen = groups.some((g) => !shut[g.key]);
  const anyShut = groups.some((g) => shut[g.key]);
  if (groups.length === 0) return null;
  return (
    <div className="mt-sm">
      <div className="flex flex-wrap-reverse items-center justify-between gap-sm">
        <p className="m-0 min-w-0 text-subhead text-ink-soft">{groups.length === 1 ? '1 group' : `${groups.length} groups`}</p>
        <div className="flex shrink-0 gap-xs">
          <Button variant="outline" size="sm" disabled={!anyShut} onClick={openAll}>
            Open all
          </Button>
          <Button variant="outline" size="sm" disabled={!anyOpen} onClick={foldAll}>
            Fold all
          </Button>
        </div>
      </div>
      <div className="mt-xs flex flex-col gap-xs">
        {groups.map((g) => (
          <Box key={g.key} g={g} open={!shut[g.key]} onToggle={() => setShut((s) => ({ ...s, [g.key]: !s[g.key] }))} renderTask={renderTask} by={by} />
        ))}
      </div>
      {more && <p className="mt-xs m-0 text-caption text-ink-soft">Showing the first 60.</p>}
    </div>
  );
}

/** "3 tasks · 1 h 30 of 3 h": the count, and for a block of the day the minutes planned in it against its length. */
function countLine(g: TaskGroup<unknown>): string {
  const n = g.tasks.length === 1 ? '1 task' : `${g.tasks.length} tasks`;
  if (g.kind !== 'block' || !g.inDay || g.minutes === 0 || g.tasks.length === 0) return n;
  return `${n} · ${spanLabel(g.plannedMin)} of ${spanLabel(g.minutes)}`;
}

function Box<T extends { id: string }>({ g, open, onToggle, renderTask, by }: { g: TaskGroup<T>; open: boolean; onToggle: () => void; renderTask: (t: T) => ReactNode; by: 'block' | 'area' }) {
  const body = useRef<HTMLDivElement>(null);
  const id = useId();
  const area = g.area ? LIFE_AREAS[g.area] : null;
  // An area box wears its area's pillar colour, like the app groups; a block box its own swatch (the "Time blocks" block in app.css).
  const areaBox = g.kind === 'area' && area;
  const over = g.kind === 'block' && g.inDay && g.minutes > 0 && g.plannedMin > g.minutes;

  // A box that starts open shows open at once; only a tap slides it. The effect alone owns `hidden` (never the JSX), so a fold plays its
  // close before the body is hidden; a layout effect, so a box that starts closed is hidden before the first paint.
  const first = useRef(true);
  useLayoutEffect(() => {
    const el = body.current;
    if (!el) return;
    if (first.current) {
      first.current = false;
      el.hidden = !open;
      if (open) gsap.set(el, { height: 'auto', opacity: 1 });
      return;
    }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let tween: gsap.core.Tween | null = null;
    if (open) {
      el.hidden = false;
      if (reduce) gsap.set(el, { height: 'auto', opacity: 1 });
      else tween = gsap.fromTo(el, { height: 0, opacity: 0 }, { height: 'auto', opacity: 1, duration: 0.32, ease: 'power3.out' });
    } else if (!el.hidden) {
      if (reduce) {
        gsap.set(el, { height: 0, opacity: 0 });
        el.hidden = true;
      } else tween = gsap.to(el, { height: 0, opacity: 0, duration: 0.22, ease: 'power2.in', onComplete: () => void (el.hidden = true) });
    }
    return () => {
      tween?.kill();
      if (!open) el.hidden = true;
    };
  }, [open]);

  const note = g.kind === 'block' ? [g.ranges.map((r) => slotRangeLabel(r)).join(', '), g.inDay ? '' : 'Not in today’s plan'].filter(Boolean).join('. ') : area ? area.blurb : by === 'block' ? 'Tasks with no block yet.' : 'Tasks with no area of life yet.';
  return (
    <section
      aria-labelledby={`${id}-h`}
      data-pillar={areaBox ? area.relationship : undefined}
      className={`rounded-card ${g.kind === 'block' && g.color ? `tb-box ${tbClass(g.color)}` : g.kind === 'none' ? 'bg-card' : ''}`}
      style={areaBox ? { background: `var(--soft-${area.relationship})` } : g.kind === 'block' ? tbStyle(g.color) : undefined}
    >
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
        {areaBox ? (
          <span className="flex size-[44px] shrink-0 items-center justify-center rounded-pill bg-card-strong" style={{ color: `var(--deep-${area.relationship})` }} aria-hidden="true">
            <AppIcon name={area.icon} size={22} />
          </span>
        ) : (
          <span className="flex size-[44px] shrink-0 items-center justify-center" aria-hidden="true">
            <span className={g.color ? `tb-dot ${tbClass(g.color)}` : 'tb-dot'} style={tbStyle(g.color)} />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span id={`${id}-h`} className="block text-title3">
            {g.name}
          </span>
          <span className="block text-footnote text-ink-soft">{note}</span>
        </span>
        <span className={`shrink-0 rounded-pill bg-card-strong px-sm text-caption font-medium leading-[26px] ${over ? 'text-ink' : 'text-ink-soft'}`}>{over ? `${countLine(g)}, over` : countLine(g)}</span>
        <ToggleChevron open={open} size={20} className="text-ink-soft" />
      </button>
      <div ref={body} id={`${id}-b`} className="overflow-hidden">
        {g.tasks.length === 0 ? (
          <p className="m-0 px-md pb-md text-subhead text-ink-soft">Nothing here yet.</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-xs px-sm pb-sm">{g.tasks.map((t) => renderTask(t))}</ul>
        )}
      </div>
    </section>
  );
}
