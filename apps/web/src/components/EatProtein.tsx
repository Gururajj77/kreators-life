import { parseProteinGoal, PROTEIN_ABOUT, PROTEIN_CAUTION, PROTEIN_FOOD_BY_KEY, PROTEIN_FOODS, PROTEIN_GOAL_MAX, PROTEIN_GOAL_MIN, PROTEIN_GUIDE, PROTEIN_KG_MAX, PROTEIN_KG_MIN, PROTEIN_SCOOP_MAX, PROTEIN_SERVINGS_MAX, PROTEIN_WEIGHT_NOTE, proteinGoalsFor, proteinGrams, proteinLine, typedKilos, type ProteinAdded, type ProteinFood, type ProteinFoodKey } from '@kreators/shared/fitness';
import { useMutation } from '@tanstack/react-query';
import { Minus, Plus } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { api } from '../lib/api';
import { evenGrid, evenTile } from '../lib/bento';
import { FIELD } from '../lib/ui';
import { Button } from './Button';
import { ErrorLine } from './ErrorLine';
import { FieldLabel } from './Field';
import { Fold } from './Fold';
import { Icon } from './Icon';

const COLS = { base: 2, sm: 3 } as const;
const COMMON = PROTEIN_FOODS.filter((f) => f.common);
const OTHERS = PROTEIN_FOODS.filter((f) => !f.common);
const digits = (raw: string, n: number) => raw.replace(/\D/g, '').slice(0, n);
/** A full field keeps its own Enter: it must not save the day's card around it, and the weight field must never send anything. */
const holdEnter = (e: KeyboardEvent<HTMLElement>) => {
  if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') e.preventDefault();
};

function FoodChip({ food, n, count, i, onAdd }: { food: ProteinFood; n: number; count: number; i: number; onAdd: () => void }) {
  const grams = `about ${food.grams} g`;
  return (
    <button type="button" aria-pressed={n > 0} aria-label={`Add ${food.name}, ${food.serving}, ${grams}${n > 0 ? `. ${n} so far` : ''}`} onClick={onAdd} data-food={food.key} className={`toy flex min-h-[44px] min-w-0 flex-col justify-start rounded-tile border-2 px-sm py-xs text-left ${n > 0 ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'} ${evenTile(i, count, COLS)}`}>
      <span className="flex items-center justify-between gap-xs">
        <span className="min-w-0 text-footnote font-semibold">{food.name}</span>
        {n > 0 ? <span className="shrink-0 text-footnote font-semibold type-figure">{n}</span> : <Icon icon={Plus} size={14} className="shrink-0 opacity-70" />}
      </span>
      <span className="block text-caption opacity-80">
        <span className="inline-block">{food.serving},</span> <span className="inline-block">{grams}</span>
      </span>
    </button>
  );
}

/** A food on the day's list: the serving, minus and plus. A minus at one takes it off. */
function AddedRow({ food, n, onStep }: { food: ProteinFood; n: number; onStep: (next: number) => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-xs">
      <p className="m-0 min-w-0 flex-1 basis-[50%] text-subhead">
        <span className="font-semibold">{food.name}</span>
        <span className="block text-caption text-ink-soft">{food.serving}</span>
      </p>
      <div className="flex items-center gap-xs" role="group" aria-label={food.name}>
        <button type="button" onClick={() => onStep(n - 1)} aria-label={n === 1 ? `Take ${food.name} off` : `${food.name}: one fewer`} className="toy toy-soft mf-round flex size-[44px] items-center justify-center rounded-pill">
          <Icon icon={Minus} size={18} />
        </button>
        <output aria-live="polite" className="min-w-[32px] text-center text-headline type-figure">
          {n}
        </output>
        <button type="button" onClick={() => onStep(n + 1)} disabled={n >= PROTEIN_SERVINGS_MAX} aria-label={`${food.name}: one more`} className="toy toy-soft mf-round flex size-[44px] items-center justify-center rounded-pill disabled:opacity-50">
          <Icon icon={Plus} size={18} />
        </button>
      </div>
    </div>
  );
}

/**
 * Setting the goal, in place. The weight lives only in this component's state: it is no part of any request, it has no name for a browser to remember and it
 * goes when the fold closes or the goal is saved. The two buttons only fill the goal field, so the person takes it or changes it, and only the goal is sent.
 */
function GoalForm({ goal, onSaved }: { goal: number | null; onSaved: () => void }) {
  const [kg, setKg] = useState('');
  const [text, setText] = useState(goal === null ? '' : String(goal));
  const [said, setSaid] = useState('');
  useEffect(() => setText(goal === null ? '' : String(goal)), [goal]);
  const tenths = typedKilos(kg);
  const picks = typeof tenths === 'number' ? proteinGoalsFor(tenths) : null;
  const typed = parseProteinGoal(text);
  const save = useMutation({
    mutationFn: (g: number | null) => api.setProteinGoal(g),
    onSuccess: (r) => {
      setKg('');
      setSaid(r.goal === null ? 'No goal now.' : `Saved. Your goal is ${r.goal} g a day.`);
      onSaved();
    },
  });
  const submit = () => {
    if (typeof typed === 'string') {
      setSaid(typed);
      return;
    }
    save.mutate(typed);
  };
  return (
    <div className="grid gap-sm pt-sm" onKeyDown={holdEnter}>
      <p className="m-0 text-caption text-ink-soft">{PROTEIN_GUIDE}</p>
      <FieldLabel label="What you weigh, in kg" hint="Optional">
        <input value={kg} onChange={(e) => setKg(e.target.value.slice(0, 5))} inputMode="decimal" autoComplete="off" data-1p-ignore className={FIELD} />
      </FieldLabel>
      <p className="m-0 text-caption text-ink-soft">{PROTEIN_WEIGHT_NOTE}</p>
      {tenths === 'bad' && (
        <p className="m-0 text-caption text-ink-soft">
          Type a weight from {PROTEIN_KG_MIN} to {PROTEIN_KG_MAX} kg.
        </p>
      )}
      {picks && (
        <div className="grid gap-xs sm:grid-cols-2">
          {(
            [
              [picks.usual, 'The usual guidance'],
              [picks.cereal, 'If most meals are rice or roti'],
            ] as const
          ).map(([g, why]) => (
            <div key={why}>
              <Button variant="outline" size="sm" full onClick={() => (setText(String(g)), setSaid(''))}>
                Use {g} g
              </Button>
              <p className="mt-xs m-0 text-center text-caption text-ink-soft">{why}</p>
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-end gap-xs">
        <div className="min-w-0 flex-1 basis-[60%]">
          <FieldLabel label="My daily goal, in grams" hint={`${PROTEIN_GOAL_MIN} to ${PROTEIN_GOAL_MAX}. Leave it empty for none.`}>
            <input value={text} onChange={(e) => (setText(digits(e.target.value, 3)), setSaid(''))} inputMode="numeric" autoComplete="off" className={FIELD} />
          </FieldLabel>
        </div>
        <Button variant="outline" onClick={submit} disabled={save.isPending}>
          {save.isPending ? 'Saving' : 'Save goal'}
        </Button>
      </div>
      <ErrorLine e={save.error} />
      <p role="status" className="m-0 text-caption text-ink-soft empty:hidden">
        {said}
      </p>
    </div>
  );
}

/**
 * Protein inside the eating card (2026-11-07, the founder): added up by what you ate, in everyday servings, never weighed. One closed row holds it all and keeps the day's
 * total readable, "Protein 42 g today", or a quiet Optional with nothing added, so the card stays short on a phone. A tap on it opens the foods, the list and the goal: a tap
 * adds one serving, the common foods come first and the rest wait in their own fold, with grams typed from a label. The bar is plain, with no fail in it.
 */
export function EatProtein({ value, goal, lastScoop, dayWord, open, onOpenChange, onChange, onGoalSaved }: { value: ProteinAdded | null; goal: number | null; /** The grams your scoop said last time, so a label is typed once. */ lastScoop: number | null; dayWord: string; /** The card holds the row's state, so Same as yesterday can open it. */ open: boolean; onOpenChange: (open: boolean) => void; onChange: (p: ProteinAdded | null) => void; onGoalSaved: () => void }) {
  const foods = value?.foods ?? [];
  const countOf = (k: ProteinFoodKey) => foods.find((f) => f.food === k)?.n ?? 0;
  const put = (next: Partial<ProteinAdded>) => {
    const p: ProteinAdded = { foods, scoopG: value?.scoopG ?? null, typedG: value?.typedG ?? null, ...next };
    onChange(p.foods.length === 0 && p.typedG === null ? null : p);
  };
  const setCount = (food: ProteinFoodKey, n: number) => {
    const others = foods.filter((f) => f.food !== food);
    const list = n > 0 ? [...others, { food, n: Math.min(PROTEIN_SERVINGS_MAX, n) }] : others;
    // In the list's own order, so a day reads the same however it was tapped.
    put({ foods: PROTEIN_FOODS.flatMap((f) => list.filter((x) => x.food === f.key)), ...(food === 'scoop' ? { scoopG: n > 0 ? (value?.scoopG ?? lastScoop) : null } : {}) });
  };
  // A row that goes takes its minus with it, so the keyboard lands on the food's own chip, or on More foods when that fold was closed by hand, never lost at the top of the page.
  // Looked up inside this card: a day's sheet on Fitness draws a second card, and focus must not land behind it.
  const body = useRef<HTMLDivElement>(null);
  const stepRow = (food: ProteinFoodKey, n: number) => {
    setCount(food, n);
    if (n === 0) requestAnimationFrame(() => (body.current?.querySelector<HTMLElement>(`[data-food="${food}"]`) ?? body.current?.querySelector<HTMLElement>('[data-more-foods] > div > button'))?.focus());
  };
  // Held here so Same as yesterday, which fills the form after it has opened, can show what it brought from the fold.
  const inFold = value?.typedG != null || OTHERS.some((f) => countOf(f.key) > 0);
  const [moreOpen, setMoreOpen] = useState(inFold);
  useEffect(() => {
    if (inFold) setMoreOpen(true);
  }, [inFold]);
  const grams = proteinGrams(value);
  const scoopOn = countOf('scoop') > 0;
  const typedText = value?.typedG === null || value?.typedG === undefined ? '' : String(value.typedG);
  return (
    <Fold title="Protein" hint={<span aria-live="polite" className="type-figure">{grams > 0 ? proteinLine(grams, goal, dayWord) : 'Optional'}</span>} open={open} onOpenChange={onOpenChange}>
      <div ref={body} className="grid gap-sm pt-xs" onKeyDown={holdEnter}>
        {grams > 0 && goal !== null && (
          <span className="block h-[8px] overflow-hidden rounded-pill bg-line" aria-hidden="true">
            <span className="block h-full rounded-pill bg-r4" style={{ width: `${Math.min(100, Math.round((grams / goal) * 100))}%` }} />
          </span>
        )}
        <div className={`grid gap-xs ${evenGrid(COMMON.length, COLS)}`} role="group" aria-label="Add a food">
          {COMMON.map((f, i) => (
            <FoodChip key={f.key} food={f} n={countOf(f.key)} count={COMMON.length} i={i} onAdd={() => setCount(f.key, countOf(f.key) + 1)} />
          ))}
        </div>
        <div data-more-foods="">
          <Fold title="More foods" hint="Or from a label" open={moreOpen} onOpenChange={setMoreOpen}>
            <div className="grid gap-sm pt-xs">
              <div className={`grid gap-xs ${evenGrid(OTHERS.length, COLS)}`} role="group" aria-label="Add another food">
                {OTHERS.map((f, i) => (
                  <FoodChip key={f.key} food={f.key === 'scoop' && value?.scoopG ? { ...f, grams: value.scoopG } : f} n={countOf(f.key)} count={OTHERS.length} i={i} onAdd={() => setCount(f.key, countOf(f.key) + 1)} />
                ))}
              </div>
              <FieldLabel label="Grams from a label" hint="Optional">
                <input value={typedText} onChange={(e) => put({ typedG: Number(digits(e.target.value, 3)) || null })} inputMode="numeric" autoComplete="off" className={FIELD} />
              </FieldLabel>
            </div>
          </Fold>
        </div>
        {foods.length > 0 && (
          <div className="grid gap-xs">
            {foods.map((f) => {
              const food = PROTEIN_FOOD_BY_KEY[f.food];
              return food ? <AddedRow key={f.food} food={food} n={f.n} onStep={(n) => stepRow(f.food, n)} /> : null;
            })}
          </div>
        )}
        {scoopOn && (
          <FieldLabel label="Grams in your scoop" hint={`Labels differ. Empty counts ${PROTEIN_FOOD_BY_KEY.scoop?.grams ?? 0} g.`}>
            <input value={value?.scoopG ?? ''} onChange={(e) => put({ scoopG: Math.min(PROTEIN_SCOOP_MAX, Number(digits(e.target.value, 3))) || null })} inputMode="numeric" autoComplete="off" className={FIELD} />
          </FieldLabel>
        )}
        <p className="m-0 text-caption text-ink-soft">{PROTEIN_ABOUT}</p>
        <Fold title="Daily goal" hint={goal === null ? 'Optional' : `${goal} g`}>
          <GoalForm goal={goal} onSaved={onGoalSaved} />
        </Fold>
        <p className="m-0 text-caption text-ink-soft">{PROTEIN_CAUTION}</p>
      </div>
    </Fold>
  );
}
