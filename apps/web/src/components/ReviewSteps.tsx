import { MOODS, REVIEW_ANSWER_MAX, REVIEW_HIGHLIGHT_MAX } from '@kreators/shared';
import { Check } from 'lucide-react';
import { useEffect, useRef, type FormEvent, type ReactNode } from 'react';
import { Button } from './Button';
import { Icon } from './Icon';
import { MoodFace } from './MoodFace';
import { FIELD } from '../lib/ui';

/** A step of the review: a question by its number ("1", "2" …), then the rating and the one line, then Save. */
export type ReviewStep = string;
export const RATE_STEP = 'rate';
export const SAVE_STEP = 'save';

/** The steps for so many questions, in order. */
export const reviewSteps = (count: number): ReviewStep[] => [...Array.from({ length: count }, (_, i) => String(i + 1)), RATE_STEP, SAVE_STEP];
/** A step the address names, kept inside the steps there are (a template with fewer questions lands on its last one). */
export function stepIn(step: string, count: number): ReviewStep {
  if (step === RATE_STEP || step === SAVE_STEP || count === 0) return step === SAVE_STEP ? SAVE_STEP : count === 0 ? RATE_STEP : step;
  const n = Math.floor(Number(step));
  return Number.isFinite(n) && n >= 1 ? String(Math.min(n, Math.max(1, count))) : '1';
}

/** The pill look of a row of tabs (TabRow's own), so a step reads like every other tab at rest. */
const pill = (on: boolean) => `toy flex min-h-[44px] w-full min-w-[44px] items-center justify-center gap-xs rounded-pill border-2 px-sm py-xs text-subhead font-medium ${on ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card text-ink'}`;

/**
 * "Your review" one step at a time (2026-11-07, the founder: "a tab that shifts through screens and the questions"): a row of numbered
 * tabs (one per question, then Rate it and Save, a tick on each answered one; the row fills its lines, so no tab is left alone), the one
 * step under it, and Back and Next. Every answer lives with the screen, so moving between steps keeps what was typed, and the form still
 * saves everything at once. The step is the screen's, kept in the address, so a reload or Back keeps it. A tab, Back or Next moves focus to
 * the step's field; "Add to my answer" changes the step without taking focus.
 */
export function ReviewSteps({
  prompts,
  why,
  answers,
  onAnswer,
  rating,
  onRating,
  highlight,
  onHighlight,
  step: rawStep,
  onStep,
  head,
  saved,
  saving,
  failed,
  onSave,
  onRemove,
  removing,
}: {
  prompts: string[];
  /** The short line under a question naming its method (built-in questions only). */
  why: (i: number) => string | undefined;
  answers: string[];
  onAnswer: (i: number, value: string) => void;
  rating: number | null;
  onRating: (v: number | null) => void;
  highlight: string;
  onHighlight: (v: string) => void;
  step: string;
  onStep: (s: ReviewStep) => void;
  /** What sits above the steps (the Questions from picker, when there is more than one template). */
  head?: ReactNode;
  saved: boolean;
  saving: boolean;
  failed: boolean;
  onSave: () => void;
  onRemove?: () => void;
  removing?: boolean;
}) {
  const steps = reviewSteps(prompts.length);
  const step = stepIn(rawStep, prompts.length);
  const at = steps.indexOf(step);
  const answered = (i: number) => (answers[i] ?? '').trim().length > 0;
  const count = prompts.filter((_, i) => answered(i)).length;
  // Focus follows a step picked from the row, Back or Next (never a step changed from elsewhere, such as Add to my answer).
  const focusNext = useRef(false);
  useEffect(() => {
    if (!focusNext.current) return;
    focusNext.current = false;
    const id = step === RATE_STEP ? 'review-rate-1' : step === SAVE_STEP ? 'review-save' : `answer-${Number(step) - 1}`;
    const el = document.getElementById(id) ?? document.querySelector<HTMLElement>('#review-rate button');
    el?.focus({ preventScroll: true });
    el?.scrollIntoView({ block: 'nearest', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }, [step]);
  const go = (s: ReviewStep) => {
    focusNext.current = true;
    onStep(s);
  };
  const label = (s: ReviewStep) => {
    if (s === RATE_STEP) return { text: 'Rate it', name: `Rate it${rating ? ', rated' : ''}`, done: rating !== null || highlight.trim().length > 0 };
    if (s === SAVE_STEP) return { text: 'Save', name: 'Save', done: false };
    const i = Number(s) - 1;
    return { text: s, name: `Question ${s} of ${prompts.length}${answered(i) ? ', answered' : ''}`, done: answered(i) };
  };

  return (
    <form
      className="mt-sm rounded-card bg-card p-md shadow-toy-soft"
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        onSave();
      }}
    >
      {head}
      <nav aria-label="Steps of your review" className={head ? 'mt-sm' : ''}>
        <ol className="fill-row-all m-0 flex list-none flex-wrap gap-xs p-0">
          {steps.map((s) => {
            const l = label(s);
            const on = s === step;
            return (
              <li key={s} className="flex">
                <button type="button" aria-current={on ? 'step' : undefined} aria-label={l.name} onClick={() => go(s)} className={pill(on)}>
                  <span className="type-figure">{l.text}</span>
                  {l.done && <Icon icon={Check} size={14} strokeWidth={3} />}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="mt-md" id="review-step">
        {step === RATE_STEP ? (
          <div>
            <p className="m-0 text-headline">How did it go?</p>
            {/* Plain toggles, since a second tap clears the rating (a radio cannot, and asks for arrow keys it would not have). */}
            <div id="review-rate" role="group" aria-label="How did it go" className="mt-xs flex gap-xs">
              {MOODS.map((m, i) => (
                <button
                  key={m.value}
                  id={i === 0 ? 'review-rate-1' : undefined}
                  type="button"
                  aria-pressed={rating === m.value}
                  aria-label={m.name}
                  onClick={() => onRating(rating === m.value ? null : m.value)}
                  className={`toy flex size-[48px] items-center justify-center rounded-pill border-2 ${rating === m.value ? 'border-ink bg-ink' : 'toy-soft border-line bg-card'}`}
                >
                  <MoodFace value={m.value} size={32} />
                </button>
              ))}
            </div>
            <label className="mt-md block text-subhead font-semibold" htmlFor="review-highlight">
              The one thing to remember
            </label>
            <input id="review-highlight" value={highlight} onChange={(e) => onHighlight(e.target.value)} maxLength={REVIEW_HIGHLIGHT_MAX} placeholder="One line" className={FIELD} />
          </div>
        ) : step === SAVE_STEP ? (
          <div>
            <p className="m-0 text-headline">{`You answered ${count} of ${prompts.length}.`}</p>
            <p className="mt-xs m-0 text-subhead text-ink-soft">{count < prompts.length ? 'An empty one saves as empty. Tap its number to go back.' : 'Every answer saves at once, with the numbers as they are now.'}</p>
            {failed && (
              <p role="alert" className="mt-sm m-0 text-subhead">
                That did not save. Try again.
              </p>
            )}
            {/* The main Save takes the width and Remove sits at its right on the same line (2026-11-06, the founder's form rule). */}
            <div className="mt-md flex gap-xs">
              <Button id="review-save" type="submit" disabled={saving} className="min-w-0 flex-1">
                {saving ? 'Saving' : saved ? 'Save changes' : 'Save this review'}
              </Button>
              {onRemove && (
                <Button variant="outline" onClick={onRemove} disabled={removing}>
                  Remove
                </Button>
              )}
            </div>
          </div>
        ) : (
          (() => {
            const i = Number(step) - 1;
            const w = why(i);
            return (
              <div>
                <p className="m-0 text-caption text-ink-soft">{`Question ${step} of ${prompts.length}`}</p>
                <label className="mt-xs block text-headline" htmlFor={`answer-${i}`}>
                  {prompts[i]}
                </label>
                {w && <p className="mt-xs m-0 text-footnote text-ink-soft">{w}</p>}
                <textarea id={`answer-${i}`} value={answers[i] ?? ''} onChange={(e) => onAnswer(i, e.target.value)} rows={5} maxLength={REVIEW_ANSWER_MAX} className={FIELD} />
              </div>
            );
          })()
        )}
      </div>

      {/* Back at the left and Next at the right; on the Save step there is no Next, its own button saves. */}
      <div className="mt-md flex items-center justify-between gap-xs">
        <Button variant="outline" disabled={at <= 0} onClick={() => go(steps[at - 1]!)}>
          Back
        </Button>
        {step !== SAVE_STEP && (
          <Button variant="outline" onClick={() => go(steps[at + 1]!)}>
            {step === RATE_STEP ? 'Next: save' : 'Next'}
          </Button>
        )}
      </div>
    </form>
  );
}
