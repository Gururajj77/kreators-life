import { AGENCY_STAGES, AGENCY_STAGE_BY_KEY, stageProgress, type AgencyStageKey } from '@kreators/shared';
import gsap from 'gsap';
import { Check } from 'lucide-react';
import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { prefersReducedMotion } from './fx/env';
import { Icon } from './Icon';

/** The fade at an edge that still has stages past it, so a cut-off bar says it scrolls. A mask, so it works on any surface under it. */
const FADE = 32;
function edgeMask(left: boolean, right: boolean): CSSProperties | undefined {
  if (!left && !right) return undefined;
  const m = `linear-gradient(to right, ${left ? 'transparent' : 'black'} 0, black ${left ? FADE : 0}px, black calc(100% - ${right ? FADE : 0}px), ${right ? 'transparent' : 'black'} 100%)`;
  return { maskImage: m, WebkitMaskImage: m };
}

/**
 * Where a client is on the way from a first enquiry to monthly delivery: what is done, where they are now and what is still to come.
 * It is a list (the current stage carries `aria-current="step"`) and every state is also a word, so colour is never the only sign.
 * On a narrow screen it scrolls sideways, centred on the current stage; the stage that was just reached pops in (not under reduced motion).
 */
export function StageBar({ stage, line = true, lineText }: { stage: AgencyStageKey; /** Show the current stage's name and one plain line above the bar. */ line?: boolean; /** The line in the reader's own words (the client's page says it to the client); the stage's own line otherwise. */ lineText?: string }) {
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  const progress = stageProgress(stage);
  const now = AGENCY_STAGE_BY_KEY[stage];
  const [edges, setEdges] = useState({ left: false, right: false });

  // Centre the stage they are in, inside the scroller only (the page does not move), and keep the edge fades true to what is cut off.
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => {
      const left = el.scrollLeft > 2;
      const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
      setEdges((e) => (e.left === left && e.right === right ? e : { left, right }));
    };
    const cur = el.querySelector<HTMLElement>('[aria-current="step"]');
    if (cur) el.scrollLeft = Math.max(0, cur.offsetLeft - el.clientWidth / 2 + cur.clientWidth / 2);
    measure();
    el.addEventListener('scroll', measure, { passive: true });
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    ro?.observe(el);
    return () => {
      el.removeEventListener('scroll', measure);
      ro?.disconnect();
    };
  }, [stage]);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const dot = box.current?.querySelector<HTMLElement>('[data-now]');
    if (dot) gsap.fromTo(dot, { scale: 0.6 }, { scale: 1, duration: 0.5, ease: 'back.out(2.4)' });
  }, [stage]);

  return (
    <section aria-labelledby={`${id}-h`}>
      {line && (
        <div>
          <p className="m-0 type-eyebrow text-ink-mute">{`Step ${progress.index + 1} of ${progress.total}`}</p>
          <h2 id={`${id}-h`} className="mt-xs text-title2">
            {now.name}
          </h2>
          <p className="mt-xs m-0 text-subhead text-ink-soft">{lineText ?? now.line}</p>
        </div>
      )}
      {!line && (
        <h2 id={`${id}-h`} className="sr-only">
          {`Progress: ${now.name}, step ${progress.index + 1} of ${progress.total}`}
        </h2>
      )}
      <div ref={box} className="scroll-row mt-sm" style={edgeMask(edges.left, edges.right)} tabIndex={0} role="group" aria-label={edges.left || edges.right ? 'Stages, scroll sideways for more' : 'Stages'}>
        <ol className="m-0 flex list-none p-0">
          {AGENCY_STAGES.map((s, i) => {
            const done = i < progress.index;
            const cur = i === progress.index;
            const last = i === AGENCY_STAGES.length - 1;
            return (
              <li key={s.key} aria-current={cur ? 'step' : undefined} className="relative flex w-[104px] shrink-0 flex-col items-center px-xs text-center">
                {!last && <span aria-hidden="true" className="absolute left-1/2 top-[17px] h-[3px] w-full rounded-pill" style={{ background: done ? 'var(--color-r4)' : 'var(--color-line)' }} />}
                <span
                  {...(cur ? { 'data-now': '' } : {})}
                  className={`relative z-10 grid size-[36px] place-items-center rounded-pill text-[14px] font-bold ${cur ? 'bg-ink text-on-ink' : done ? 'bg-r4 text-on-fill' : 'border-2 border-line bg-card text-ink-soft'}`}
                >
                  {done ? (
                    <Icon icon={Check} size={16} strokeWidth={3} />
                  ) : (
                    i + 1
                  )}
                </span>
                <span className={`mt-xs block text-caption ${cur ? 'font-semibold text-ink' : 'text-ink-soft'}`}>{s.name}</span>
                {/* A stage still to come has no word here, so it takes no room (only its screen-reader words). */}
                <span className={`${cur || done || i === progress.index + 1 ? 'mt-xs ' : ''}block text-caption text-ink-mute`}>
                  {cur ? 'Now' : done ? 'Done' : i === progress.index + 1 ? 'Next' : ''}
                  <span className="sr-only">{cur ? ', you are here' : done ? ', done' : ', still to come'}</span>
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
