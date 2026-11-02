import { AGENCY_STAGES, AGENCY_STAGE_BY_KEY, stageProgress, type AgencyStageKey } from '@kreators/shared';
import gsap from 'gsap';
import { useEffect, useId, useLayoutEffect, useRef } from 'react';
import { prefersReducedMotion } from './fx/env';

/**
 * Where a client is on the way from a first enquiry to monthly delivery: what is done, where they are now and what is still to come.
 * It is a list (the current stage carries `aria-current="step"`) and every state is also a word, so colour is never the only sign.
 * On a narrow screen it scrolls sideways, centred on the current stage; the stage that was just reached pops in (not under reduced motion).
 */
export function StageBar({ stage, line = true }: { stage: AgencyStageKey; /** Show the current stage's name and one plain line above the bar. */ line?: boolean }) {
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  const progress = stageProgress(stage);
  const now = AGENCY_STAGE_BY_KEY[stage];

  // Centre the stage they are in, inside the scroller only (the page does not move).
  useLayoutEffect(() => {
    const el = box.current;
    const cur = el?.querySelector<HTMLElement>('[aria-current="step"]');
    if (el && cur) el.scrollLeft = Math.max(0, cur.offsetLeft - el.clientWidth / 2 + cur.clientWidth / 2);
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
          <h2 id={`${id}-h`} className="mt-xs text-[24px]">
            {now.name}
          </h2>
          <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">{now.line}</p>
        </div>
      )}
      {!line && (
        <h2 id={`${id}-h`} className="sr-only">
          {`Progress: ${now.name}, step ${progress.index + 1} of ${progress.total}`}
        </h2>
      )}
      <div ref={box} className="scroll-row mt-sm" tabIndex={0} role="group" aria-label="Stages">
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
                  className={`relative z-10 grid size-[36px] place-items-center rounded-pill text-[14px] font-extrabold ${cur ? 'bg-ink text-on-ink' : done ? 'bg-r4 text-on-fill' : 'border-2 border-line bg-card text-ink-soft'}`}
                >
                  {done ? (
                    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12.5l4.5 4.5L19 7.5" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </span>
                <span className={`mt-xs block text-[12px] leading-snug ${cur ? 'font-extrabold text-ink' : 'font-bold text-ink-soft'}`}>{s.name}</span>
                <span className="mt-xs block text-[12px] font-semibold text-ink-mute">
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
