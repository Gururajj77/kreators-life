import { TERMS } from '@kreators/shared';
import { HOW_TO } from '@kreators/shared/help';
import gsap from 'gsap';
import { useLayoutEffect, useRef, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { Link } from 'react-router';
import { STICKY_CLOSE_LANE, StickyClose, useTallOpen } from './StickyClose';
import { ToggleChevron } from './ToggleMark';

/**
 * The drawn half of "How it works" (`HowItWorks` in HowTo.tsx owns the place, the path check and the open state).
 * It is a chunk of its own with the steps it reads (`HOW_TO`, `@kreators/shared/help`), fetched the first time a screen
 * shows the section, so that long text never sits in the shared chunk or the first download (2026-11-07).
 */
export interface PanelProps {
  howKey: string;
  name: string;
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
  steps: boolean;
  setSteps: Dispatch<SetStateAction<boolean>>;
  words: boolean;
  setWords: Dispatch<SetStateAction<boolean>>;
}

function Chevron({ open, className = '' }: { open: boolean; className?: string }) {
  return (
    <ToggleChevron open={open} size={20} className={className} />
  );
}

/** Content that has just been opened slides in. Reduced motion lands it in place. */
function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.set(el, { opacity: 1, y: 0 });
      return;
    }
    const tween = gsap.fromTo(el, { opacity: 0, y: -8 }, { opacity: 1, y: 0, duration: 0.22, ease: 'power2.out', clearProps: 'transform' });
    return () => {
      tween.kill();
    };
  }, []);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

/**
 * One of the smaller toggles inside the card: a flat row that tints on hover and darkens while open. Open and taller than the room the
 * window has (an app's "Words we use" runs to thousands of pixels on a phone), it keeps its own close in view too (`StickyClose`), lined up
 * with the card's in one column, a step under it: its chevron keeps its slot unseen, and Escape inside it folds only it.
 */
function Fold({ id, title, hint, closeLabel, open, onToggle, onClose, children }: { id: string; title: string; hint: string; closeLabel: string; open: boolean; onToggle: () => void; onClose: () => void; children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const railOn = useTallOpen(root, open);
  return (
    <div ref={root} data-sticky-close-root="">
      <h3 className="m-0 text-headline">
        <button ref={button} type="button" aria-expanded={open} aria-controls={id} onClick={onToggle} className="toy toy-flat flex min-h-[44px] w-full items-center justify-between gap-sm rounded-tile bg-paper px-sm text-left aria-expanded:bg-line">
          <span className="min-w-0">
            <span className="text-headline">{title}</span>
            <span className="ml-xs text-subhead text-ink-soft">{hint}</span>
          </span>
          <Chevron open={open} className={railOn ? 'invisible' : ''} />
        </button>
      </h3>
      {railOn && <StickyClose onClose={onClose} label={closeLabel} opener={() => button.current} />}
      {open && (
        <Reveal className={STICKY_CLOSE_LANE}>
          <div id={id} className="mt-xs">
            {children}
          </div>
        </Reveal>
      )}
    </div>
  );
}

/**
 * "How it works" at the bottom of an app's main screen: one card that is a button. Tap it and the
 * steps from HOW_TO and the words the app leans on open together, each as its own smaller toggle;
 * tap it again and everything folds away. Open and taller than the room the window has, its close stays
 * in view beside it (`StickyClose`, 2026-11-14, the founder: "the close buttons that need one to scroll
 * back top need the close button to be sticky outside the toggle tab"): the card's round chevron keeps its
 * slot unseen, the panel under it keeps its full width and a lane inside it while the close runs down the
 * section's edge (app.css, "A card keeps its full width"), and Escape closes it.
 */
export function HowItWorksPanel({ howKey, name, open, setOpen, steps, setSteps, words, setWords }: PanelProps) {
  const how = HOW_TO[howKey];
  const root = useRef<HTMLElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const railOn = useTallOpen(root, open && Boolean(how));
  if (!how) return null;
  const toggleAll = () => {
    if (open) {
      setOpen(false);
      return;
    }
    setSteps(true);
    setWords(true);
    setOpen(true);
  };
  const count = `${how.steps.length} steps${how.terms.length > 0 ? ` and ${how.terms.length} ${how.terms.length === 1 ? 'word' : 'words'}` : ''}`;
  return (
    <section ref={root} data-sticky-close-root="" className="span-all mt-lg" aria-labelledby="how-heading">
      <h2 id="how-heading" className="m-0" data-contents="How it works">
        <button
          ref={toggle}
          type="button"
          aria-expanded={open}
          aria-controls="how-panel"
          onClick={toggleAll}
          className="toy toy-soft flex w-full items-center justify-between gap-sm rounded-card bg-card p-md text-left text-ink hover:bg-paper aria-expanded:bg-paper"
        >
          <span className="min-w-0">
            <span className="block text-title3">How it works</span>
            {/* Two sentences kept whole, so a line that must break does so at the full stop (the rectangle rule). */}
            <span className="mt-xs block text-subhead text-ink-soft">
              <span className="inline-block">{`${count} for ${name}.`}</span> <span className="inline-block">{open ? 'Tap to fold them away.' : 'Tap to open them.'}</span>
            </span>
          </span>
          {/* While the sticky close shows, the round chevron keeps its slot unseen, as a task card's edit button does. */}
          <span className={`flex size-[36px] shrink-0 items-center justify-center rounded-pill bg-ink text-on-ink ${railOn ? 'invisible' : ''}`} aria-hidden="true">
            <Chevron open={open} />
          </span>
        </button>
      </h2>
      {railOn && <StickyClose onClose={() => setOpen(false)} label="Close How it works" opener={() => toggle.current} />}
      {open && (
        <Reveal className={STICKY_CLOSE_LANE}>
          <div id="how-panel" className="mt-sm flex flex-col gap-sm rounded-card bg-card p-md shadow-toy-soft">
            <Fold id="how-steps" title="The steps" hint={`${how.steps.length}`} closeLabel="Close the steps" open={steps} onToggle={() => setSteps((v) => !v)} onClose={() => setSteps(false)}>
              <ol className="m-0 flex list-none flex-col gap-xs p-0">
                {how.steps.map((t, i) => (
                  <li key={t} className="flex gap-sm rounded-tile bg-paper p-sm">
                    <span className="flex size-[28px] shrink-0 items-center justify-center rounded-pill bg-ink text-subhead font-medium text-on-ink" aria-hidden="true">
                      {i + 1}
                    </span>
                    <span className="text-subhead">{t}</span>
                  </li>
                ))}
              </ol>
            </Fold>
            {how.terms.length > 0 && (
              <Fold id="how-words" title="Words we use" hint={`${how.terms.length}`} closeLabel="Close the words we use" open={words} onToggle={() => setWords((v) => !v)} onClose={() => setWords(false)}>
                <dl className="m-0 flex flex-col gap-xs">
                  {how.terms.map((t) => (
                    <div key={t} className="m-0 rounded-tile bg-paper p-sm text-subhead">
                      <dt className="inline font-semibold">{t}</dt>
                      <dd className="ml-xs inline text-ink-soft">{TERMS[t]}</dd>
                    </div>
                  ))}
                </dl>
              </Fold>
            )}
            <p className="m-0 text-caption text-ink-soft">
              <Link to="/help#words" className="underline underline-offset-4 hover:text-ink">
                Every word we use
              </Link>
              {' · '}
              <Link to="/help#earning" className="underline underline-offset-4 hover:text-ink">
                How you earn
              </Link>
            </p>
          </div>
        </Reveal>
      )}
    </section>
  );
}
