import { HOW_TO, MODULE_BY_KEY, TERMS } from '@kreators/shared';
import gsap from 'gsap';
import { createContext, useContext, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router';

const Key = createContext<string | null>(null);

/** Tells the screens inside which app they belong to, so `Screen` can end with that app's how-it-works. */
export function HowTo({ moduleKey, children }: { moduleKey: string; children: ReactNode }) {
  return <Key.Provider value={moduleKey}>{children}</Key.Provider>;
}

function Chevron({ open, className = '' }: { open: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''} ${className}`} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

/** Content that has just been opened slides in. Reduced motion lands it in place. */
function Reveal({ children }: { children: ReactNode }) {
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
  return <div ref={ref}>{children}</div>;
}

/** One of the smaller toggles inside the card: a flat row that tints on hover and darkens while open. */
function Fold({ id, title, hint, open, onToggle, children }: { id: string; title: string; hint: string; open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <div>
      <h3 className="m-0 text-[16px]">
        <button type="button" aria-expanded={open} aria-controls={id} onClick={onToggle} className="toy toy-flat flex min-h-[44px] w-full items-center justify-between gap-sm rounded-tile bg-paper px-sm text-left aria-expanded:bg-line">
          <span className="min-w-0">
            <span className="text-[16px] font-bold">{title}</span>
            <span className="ml-xs text-[14px] font-semibold text-ink-soft">{hint}</span>
          </span>
          <Chevron open={open} />
        </button>
      </h3>
      {open && (
        <Reveal>
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
 * tap it again and everything folds away. Detail pages inside an app (one event, one club, one
 * product) leave it to the main screen.
 */
export function HowItWorks() {
  const key = useContext(Key);
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [steps, setSteps] = useState(true);
  const [words, setWords] = useState(true);
  const how = key ? HOW_TO[key] : undefined;
  const meta = key ? MODULE_BY_KEY[key] : undefined;
  if (!how || !meta || pathname !== meta.path) return null;
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
    <section className="span-all mt-lg" aria-labelledby="how-heading">
      <h2 id="how-heading" className="m-0">
        <button
          type="button"
          aria-expanded={open}
          aria-controls="how-panel"
          onClick={toggleAll}
          className="toy toy-soft flex w-full items-center justify-between gap-sm rounded-card bg-card p-md text-left text-ink hover:bg-paper aria-expanded:bg-paper"
        >
          <span className="min-w-0">
            <span className="block font-display text-[24px] font-extrabold leading-tight">How it works</span>
            <span className="mt-xs block text-[14px] font-semibold text-ink-soft">{open ? `${count} for ${meta.name}. Tap to fold them away.` : `${count} for ${meta.name}. Tap to open them.`}</span>
          </span>
          <span className="flex size-[36px] shrink-0 items-center justify-center rounded-pill bg-ink text-on-ink" aria-hidden="true">
            <Chevron open={open} />
          </span>
        </button>
      </h2>
      {open && (
        <Reveal>
          <div id="how-panel" className="mt-sm flex flex-col gap-sm rounded-card bg-card p-md shadow-toy-soft">
            <Fold id="how-steps" title="The steps" hint={`${how.steps.length}`} open={steps} onToggle={() => setSteps((v) => !v)}>
              <ol className="m-0 flex list-none flex-col gap-xs p-0">
                {how.steps.map((t, i) => (
                  <li key={t} className="flex gap-sm rounded-tile bg-paper p-sm">
                    <span className="flex size-[28px] shrink-0 items-center justify-center rounded-pill bg-ink text-[14px] font-extrabold text-on-ink" aria-hidden="true">
                      {i + 1}
                    </span>
                    <span className="text-[14px] font-semibold">{t}</span>
                  </li>
                ))}
              </ol>
            </Fold>
            {how.terms.length > 0 && (
              <Fold id="how-words" title="Words we use" hint={`${how.terms.length}`} open={words} onToggle={() => setWords((v) => !v)}>
                <dl className="m-0 flex flex-col gap-xs">
                  {how.terms.map((t) => (
                    <div key={t} className="m-0 rounded-tile bg-paper p-sm text-[14px]">
                      <dt className="inline font-bold">{t}</dt>
                      <dd className="ml-xs inline font-semibold text-ink-soft">{TERMS[t]}</dd>
                    </div>
                  ))}
                </dl>
              </Fold>
            )}
            <p className="m-0 text-[12px] font-bold text-ink-soft">
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
