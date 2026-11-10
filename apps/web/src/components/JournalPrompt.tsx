import { RELATIONSHIPS } from '@kreators/shared';
import { JOURNAL_PROMPT_CATEGORIES, JOURNAL_PROMPT_COUNT, JOURNAL_PROMPT_CREDIT, JOURNAL_PROMPT_SAFETY, nextPrompt, promptBody, promptById, promptCategory, promptRound, promptTitle, type JournalPromptCategoryKey } from '@kreators/shared/journalPrompts';
import gsap from 'gsap';
import { useEffect, useRef, useState } from 'react';
import { fillVar, ON_FILL } from '../lib/relFill';
import { Button } from './Button';
import { Fold } from './Fold';
import { FilterSelect } from './FilterSelect';

/** Every category first, then each category, in one dropdown. */
const CATEGORY_ITEMS: { key: 'all' | JournalPromptCategoryKey; label: string }[] = [{ key: 'all', label: 'Every category' }, ...JOURNAL_PROMPT_CATEGORIES.map((c) => ({ key: c.key, label: c.name }))];

/**
 * Prompt me: a question to write about, drawn from the journaling ideas in `packages/shared/src/journalPrompts.ts`.
 * Private on purpose. Which prompts were shown, the category chosen and the prompt on screen stay in this browser (localStorage) and never go to the
 * server, to analytics or to the assistant. Plain text only, no links.
 */
const KEY = 'kreators.journalPrompts';
const MAX_HISTORY = 3000;

interface Kept {
  /** Prompt ids shown, oldest first. */
  history: string[];
  category: JournalPromptCategoryKey | 'all';
  /** A number made once on this device, so two devices do not walk the same order. */
  seed: number;
  /** The prompt now on screen. */
  current: string | null;
}

function load(): Kept {
  const fresh: Kept = { history: [], category: 'all', seed: Math.floor(Math.random() * 2_147_483_647), current: null };
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Kept> | null;
    if (!raw || typeof raw !== 'object') return fresh;
    const history = Array.isArray(raw.history) ? raw.history.filter((id): id is string => typeof id === 'string' && promptById(id) !== undefined).slice(-MAX_HISTORY) : [];
    const category = raw.category === 'all' || (typeof raw.category === 'string' && promptCategory(raw.category)) ? raw.category : 'all';
    const seed = typeof raw.seed === 'number' && Number.isInteger(raw.seed) ? raw.seed : fresh.seed;
    const current = typeof raw.current === 'string' && promptById(raw.current) ? raw.current : null;
    return { history, category: category as Kept['category'], seed, current };
  } catch {
    return fresh;
  }
}
function save(k: Kept) {
  try {
    localStorage.setItem(KEY, JSON.stringify(k));
  } catch {
    // A private window or blocked storage: the prompts still work, they are just not remembered.
  }
}

function accentOf(key: string): string {
  const cat = promptCategory(key);
  const r = RELATIONSHIPS.find((x) => x.key === cat?.accent);
  return r ? fillVar(r) : 'var(--color-r5)';
}

export function JournalPrompt({ onWrite }: { onWrite: (start: { title: string; body: string }) => void }) {
  const [kept, setKept] = useState<Kept>(load);
  const cardRef = useRef<HTMLDivElement>(null);
  const shineRef = useRef<HTMLSpanElement>(null);
  const first = useRef(true);
  const prompt = kept.current ? promptById(kept.current) : undefined;
  const round = promptRound(kept.history, kept.category);

  const reduce = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /** Draw the next prompt from a category (or all) and remember it on this device. */
  const draw = (category: Kept['category']) => {
    const next = nextPrompt(kept.history, category, kept.seed);
    const k: Kept = { ...kept, category, history: [...kept.history, next.id].slice(-MAX_HISTORY), current: next.id };
    setKept(k);
    save(k);
    const shine = shineRef.current;
    if (shine && !reduce()) {
      gsap.fromTo(shine, { xPercent: -150, opacity: 1 }, { xPercent: 450, duration: 0.7, ease: 'power2.inOut', onComplete: () => void gsap.set(shine, { opacity: 0 }) });
    }
  };

  // A new prompt rises into place. The first render (a prompt kept from before) just shows.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const el = cardRef.current;
    if (!el) return;
    if (reduce()) gsap.set(el, { opacity: 1, y: 0 });
    else gsap.fromTo(el, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.25, ease: 'power2.out', clearProps: 'transform,opacity' });
  }, [kept.current]);

  const pick = (c: Kept['category']) => {
    if (c === kept.category && prompt) return;
    // Choosing a category shows a prompt from it at once, unless the one on screen already belongs to it.
    if (prompt && (c === 'all' || prompt.category === c)) {
      const k = { ...kept, category: c };
      setKept(k);
      save(k);
      return;
    }
    draw(c);
  };

  const cat = prompt ? promptCategory(prompt.category) : undefined;

  return (
    <section className="mt-lg" aria-labelledby="prompt-heading">
      <h2 id="prompt-heading" className="text-title2">
        Not sure what to write?
      </h2>
      <p className="mt-xs m-0 text-balance text-subhead text-ink-soft">{JOURNAL_PROMPT_COUNT} prompts, each with why it helps and what to expect. Which ones you see stays on this device.</p>

      {/* The category picks one of many, so it is a dropdown at the left of Prompt me: one line from the tablet width, a line each on a phone. */}
      <div className="mt-sm flex flex-col gap-xs md:flex-row md:items-center md:justify-between">
        <div className="md:w-[320px]">
          <FilterSelect label="Category" items={CATEGORY_ITEMS} value={kept.category} onChange={pick} />
        </div>
        <Button variant="outline" className="relative" onClick={() => draw(kept.category)}>
          {/* The shine is clipped by its own box, so the button's 44px hit area (tap-pad) is never clipped with it. */}
          <span aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-pill">
            <span ref={shineRef} className="absolute inset-y-0 left-0 w-1/3 -skew-x-12 bg-linear-to-r from-transparent via-on-ink/30 to-transparent opacity-0" />
          </span>
          Prompt me
        </Button>
      </div>

      {prompt && cat ? (
        <div ref={cardRef} data-pillar={cat.accent} className="mt-sm rounded-card bg-card p-md shadow-toy-soft">
          <div aria-live="polite" aria-atomic="true">
            <div className="flex flex-wrap items-center gap-xs">
              <span className="rounded-pill px-sm py-xs text-caption font-medium" style={{ background: accentOf(prompt.category), color: ON_FILL }}>
                {cat.name}
              </span>
              <span className="text-caption text-ink-soft">
                {cat.tradition}. About {prompt.minutes} minutes
              </span>
            </div>
            <p className="mt-sm m-0 text-balance text-title2">{prompt.text}</p>
            {prompt.steps && (
              <ol className="mt-sm m-0 flex list-decimal flex-col gap-xs pl-md text-callout">
                {prompt.steps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
            )}
          </div>

          <div className="mt-md flex flex-col gap-xs">
            <Fold title="Why this prompt">
              <div className="prose-long rounded-tile bg-paper p-sm">
                <p className="m-0 text-prose">{prompt.why}</p>
                <p className="mt-xs m-0 text-prose text-ink-soft">How to write it: {cat.howTo}</p>
              </div>
            </Fold>
            <Fold title="What to expect">
              <p className="prose-long m-0 rounded-tile bg-paper p-sm text-prose">{prompt.expect}</p>
            </Fold>
          </div>

          <div className="mt-md flex flex-wrap gap-xs">
            <Button onClick={() => onWrite({ title: promptTitle(prompt.text), body: promptBody(prompt.text) })}>Write about this</Button>
            <Button variant="outline" onClick={() => draw(kept.category)}>
              Another prompt
            </Button>
          </div>
          <p className="mt-sm m-0 text-caption text-ink-soft">
            {round.shown} of {round.size} seen{kept.category === 'all' ? '' : ` in ${promptCategory(kept.category)?.name ?? 'this category'}`}. None comes back until you have seen them all.
          </p>
        </div>
      ) : (
        <p className="mt-sm m-0 rounded-tile bg-card p-sm text-balance text-subhead text-ink-soft shadow-toy-soft">Tap Prompt me for a question to write about. Pick a category first if you like.</p>
      )}

      <p className="mt-sm m-0 text-balance text-caption text-ink-soft">{JOURNAL_PROMPT_CREDIT}</p>
      <p className="mt-xs m-0 text-balance text-caption text-ink-soft">{JOURNAL_PROMPT_SAFETY}</p>
    </section>
  );
}
