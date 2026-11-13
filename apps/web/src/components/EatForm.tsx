import {
  EAT_FRUIT_MAX,
  EAT_FULLNESS,
  EAT_MOMENT_META,
  EAT_MOMENTS,
  EAT_PACKAGED,
  EAT_VEG_MAX,
  fruitVegLine,
  mealLabel,
  type EatInput,
  type EatLog,
  type EatMeal,
  type EatMoment,
} from '@kreators/shared/fitness';
import { addDays } from '@kreators/shared';
import { useMutation } from '@tanstack/react-query';
import { Minus, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { dayLabel, todayLocal } from '../lib/date';
import { FIELD } from '../lib/ui';
import { AppIcon } from './AppIcon';
import { Button } from './Button';
import { ErrorLine } from './ErrorLine';
import { FieldLabel } from './Field';
import { Fold } from './Fold';
import { EatProtein } from './EatProtein';
import { Icon } from './Icon';

const pill = (on: boolean) => `toy min-h-[44px] min-w-0 rounded-tile border-2 px-sm text-caption ${on ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`;
const EMPTY: EatInput = { meals: [], protein: null, fasting: false, fruit: null, veg: null, packaged: null, fullness: null, screenFree: null, note: '' };
const isEmpty = (e: EatInput) => !e.fasting && e.meals.length === 0 && !e.fruit && !e.veg && e.packaged === null && e.protein === null;
const from = (l: EatLog | null, note = true): EatInput => (l ? { meals: l.meals, protein: l.protein, fasting: l.fasting, fruit: l.fruit, veg: l.veg, packaged: l.packaged, fullness: l.fullness, screenFree: l.screenFree, note: note ? l.note : '' } : EMPTY);

/**
 * A count with a minus and a plus, the one stepper of the check-in. Until it is touched it says "Not said", and the score leaves it out (2026-11-07):
 * a person who brings it back to 0 has said 0, and one more minus takes that back.
 */
function Stepper({ label, value, max, unit, onChange }: { label: string; value: number | null; max: number; unit: [string, string]; onChange: (v: number | null) => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-sm">
      <p className="m-0 min-w-0 flex-1 basis-[50%] text-subhead font-semibold">{label}</p>
      <div className="flex items-center gap-xs" role="group" aria-label={label}>
        <button type="button" onClick={() => onChange(value === 0 ? null : Math.max(0, (value ?? 0) - 1))} disabled={value === null} aria-label={value === 0 ? `${label}: back to not said` : `${label}: one fewer`} className="toy toy-soft mf-round flex size-[44px] items-center justify-center rounded-pill disabled:opacity-50">
          <Icon icon={Minus} size={18} />
        </button>
        <output aria-live="polite" className="min-w-[96px] text-center text-headline type-figure">
          {value === null ? 'Not said' : `${value} ${value === 1 ? unit[0] : unit[1]}`}
        </output>
        <button type="button" onClick={() => onChange(Math.min(max, (value ?? 0) + 1))} disabled={(value ?? 0) >= max} aria-label={`${label}: one more`} className="toy toy-soft mf-round flex size-[44px] items-center justify-center rounded-pill disabled:opacity-50">
          <Icon icon={Plus} size={18} />
        </button>
      </div>
    </div>
  );
}

/** One single choice of three, or none: tapping the picked one again clears it. */
function OneOf({ label, hint, options, value, onChange }: { label: string; hint?: string; options: readonly string[]; value: 0 | 1 | 2 | null; onChange: (v: 0 | 1 | 2 | null) => void }) {
  return (
    <div>
      <p className="m-0 text-subhead font-semibold">{label}</p>
      <div className="mt-xs grid grid-cols-3 gap-xs" role="group" aria-label={label}>
        {options.map((name, i) => (
          <button key={name} type="button" aria-pressed={value === i} onClick={() => onChange(value === i ? null : (i as 0 | 1 | 2))} className={pill(value === i)}>
            {name}
          </button>
        ))}
      </div>
      {hint && <p className="mt-xs m-0 text-caption text-ink-soft">{hint}</p>}
    </div>
  );
}

/**
 * The day's eating check-in, one a day and about thirty seconds (2026-11-07): which meals, each one Good fuel, Tasty or both, fruit and
 * vegetables, protein by the serving behind one row (`EatProtein`, its own number and no part of the score), and in More how much was packaged, fried or sweet, how
 * full you felt, meals without a screen and a note (private unless its table is shared with a life coach). Fasting today clears the meals and is cleared by them; a fasting day has no score. Never a grade, never calories.
 * It fills from the day's check-in (and again when the day changes); with none, "Same as yesterday" copies the last one for you to check.
 */
export function EatForm({ day, existing, previous = null, solid = false, proteinGoal = null, lastScoop = null, onSaved, onGoalSaved = onSaved }: { day: string; existing: EatLog | null; previous?: EatLog | null; solid?: boolean; proteinGoal?: number | null; lastScoop?: number | null; onSaved: () => void; /** The goal saves apart from the day, so it must not fold what the day's Save folds. */ onGoalSaved?: () => void }) {
  const [e, setE] = useState<EatInput>(() => from(existing));
  const [said, setSaid] = useState('');
  // Protein's row starts folded on every day; Same as yesterday opens it when it brought protein, so what it brought is there to check.
  const [proteinOpen, setProteinOpen] = useState(false);
  // The row this form read, sent with a save: another tab or the phone may have saved the day since, and a day's protein adds up over hours.
  const [rowId, setRowId] = useState(existing?.id ?? null);
  const seed = `${day}:${existing?.id ?? ''}`;
  const seeded = useRef({ day, existing });
  // A deliberate seed: the form takes the day's check-in again when the day changes or a save comes back as a new row.
  useEffect(() => {
    // Another tab or the phone saved this day while this form held words not yet saved: the page read it again on its own (a refocus), so those words go, and the line says so.
    const last = seeded.current;
    seeded.current = { day, existing };
    if (last.day === day && existing && existing.id !== rowId && JSON.stringify(e) !== JSON.stringify(from(last.existing))) setSaid('Changed somewhere else. Reloaded.');
    setE(from(existing));
    setRowId(existing?.id ?? null);
  }, [seed]); // eslint-disable-line react-hooks/exhaustive-deps
  // Apart from the seed: a save answers with a new row id, and its "Saved" line must outlive that. Only another day clears it.
  useEffect(() => {
    setSaid('');
    setProteinOpen(false);
  }, [day]);
  const set = (patch: Partial<EatInput>) => setE((x) => ({ ...x, ...patch }));
  const save = useMutation({
    mutationFn: () => api.saveEat({ ...e, date: day, ifId: rowId }),
    onError: (err) => {
      if (!(err instanceof ApiError && err.status === 409)) return;
      // Saved somewhere else since this form read it: read the day again and let the form fill from it, as the paper pages do.
      setSaid('Changed somewhere else. Reloaded.');
      onGoalSaved();
    },
    onSuccess: (r) => {
      setRowId(r.eat.id);
      // Someone who only added protein is not asked for anything else: the score is another thing.
      const onlyProtein = e.meals.length === 0 && e.fruit === null && e.veg === null && e.packaged === null;
      const noScore = r.eat.dayScore === null && !r.eat.fasting && !onlyProtein;
      setSaid(!noScore ? 'Saved. Saving again replaces this day.' : e.fruit === null && e.veg === null ? 'Saved. Say your fruit and vegetables, even 0, and this day gets a score.' : 'Saved. Tick a meal and this day gets a score.');
      onSaved();
    },
  });
  // A refusal goes as soon as the form changes, so it never sits under a form that is fine now.
  useEffect(() => {
    if (save.isError) save.reset();
  }, [e]); // eslint-disable-line react-hooks/exhaustive-deps
  const conflict = save.error instanceof ApiError && save.error.status === 409;
  const ticked = new Set(e.meals.map((m) => m.moment));
  const toggleMoment = (moment: EatMoment) =>
    setE((x) => {
      const meals = ticked.has(moment) ? x.meals.filter((m) => m.moment !== moment) : [...x.meals, { moment, fuel: false, tasty: false }].sort((a, b) => EAT_MOMENTS.indexOf(a.moment) - EAT_MOMENTS.indexOf(b.moment));
      // With no meal ticked there is nothing to be eaten without a screen, so it goes back to not said, never to a said 0.
      return { ...x, meals, fasting: false, screenFree: x.screenFree === null || meals.length === 0 ? null : Math.min(x.screenFree, meals.length) };
    });
  const flip = (moment: EatMoment, key: 'fuel' | 'tasty') => setE((x) => ({ ...x, meals: x.meals.map((m) => (m.moment === moment ? { ...m, [key]: !m[key] } : m)) }));
  const meals: EatMeal[] = e.meals;
  // Yesterday means the calendar's yesterday, whichever day the form is on: on Yesterday's form the last one is "Mon, 2 Nov", never "yesterday".
  const lastWasYesterday = previous?.date === addDays(todayLocal(), -1);
  // The words follow the day the form is on: Yesterday picked reads yesterday, and a day further back reads that day.
  const dayWord = day === todayLocal() ? 'today' : day === addDays(todayLocal(), -1) ? 'yesterday' : 'that day';
  const lastWord = previous ? (lastWasYesterday ? 'yesterday' : `on ${dayLabel(previous.date)}`) : '';
  return (
    <form
      className="grid gap-md"
      onSubmit={(ev) => {
        ev.preventDefault();
        if (isEmpty(e)) {
          setSaid(`Tick a meal, add some protein, or tick Fasting ${dayWord}, first.`);
          return;
        }
        save.mutate();
      }}
    >
      {existing?.legacy && <p className="m-0 text-caption text-ink-soft">This day was saved before meals were asked. Tick them to update it.</p>}
      {!existing && previous && (
        <div className="flex flex-wrap-reverse items-center justify-between gap-xs">
          <p className="m-0 min-w-0 flex-1 basis-[60%] text-caption text-ink-soft">Ate much as you did {lastWord}?</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setE(from(previous, false));
              if (previous?.protein) setProteinOpen(true);
              setSaid(`Copied from ${lastWord.replace(/^on /, '')}. Check it, then save.`);
            }}
          >
            {lastWasYesterday ? 'Same as yesterday' : 'Same as last time'}
          </Button>
        </div>
      )}

      <div>
        <p className="m-0 text-subhead font-semibold">Meals {dayWord}</p>
        <div className="fill-row-all mt-xs flex flex-wrap gap-xs" role="group" aria-label={`Meals ${dayWord}`}>
          {EAT_MOMENTS.map((m) => (
            <button key={m} type="button" aria-pressed={ticked.has(m)} onClick={() => toggleMoment(m)} className={`${pill(ticked.has(m))} inline-flex items-center justify-center gap-xs`}>
              <AppIcon name={EAT_MOMENT_META[m].icon} size={14} />
              {EAT_MOMENT_META[m].name}
            </button>
          ))}
          <button type="button" aria-pressed={e.fasting} onClick={() => set(e.fasting ? { fasting: false } : { fasting: true, meals: [], screenFree: null })} className={`${pill(e.fasting)} inline-flex items-center justify-center gap-xs`}>
            <AppIcon name="Hourglass" size={14} />
            Fasting {dayWord}
          </button>
        </div>
        {e.fasting && <p className="mt-xs m-0 text-caption text-ink-soft">A fasting day gets no score, so it never counts as a poor day.</p>}
      </div>

      {meals.length > 0 && (
        <div className="grid gap-sm">
          {meals.map((m) => (
            <div key={m.moment}>
              <p className="m-0 text-subhead">
                <span className="font-semibold">{EAT_MOMENT_META[m.moment].name}</span>
                <span className="text-ink-soft"> · {mealLabel(m)}</span>
              </p>
              <div className="mt-xs grid grid-cols-2 gap-xs" role="group" aria-label={`${EAT_MOMENT_META[m.moment].name}: how it was`}>
                {(
                  [
                    ['fuel', 'Good fuel'],
                    ['tasty', 'Tasty'],
                  ] as const
                ).map(([k, name]) => (
                  <button key={k} type="button" aria-pressed={m[k]} onClick={() => flip(m.moment, k)} className={pill(m[k])}>
                    {name}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-sm">
        <Stepper label="Fruit" value={e.fruit} max={EAT_FRUIT_MAX} unit={['serving', 'servings']} onChange={(fruit) => set({ fruit })} />
        <Stepper label="Vegetables and greens" value={e.veg} max={EAT_VEG_MAX} unit={['serving', 'servings']} onChange={(veg) => set({ veg })} />
        <p className="m-0 text-caption text-ink-soft">
          <span className="inline-block">{fruitVegLine(e.fruit, e.veg)}</span> <span className="inline-block">Aim for half your plate.</span> <span className="inline-block">A serving is about a fistful or a katori.</span>
        </p>
      </div>

      <EatProtein value={e.protein} goal={proteinGoal} lastScoop={lastScoop} dayWord={dayWord} open={proteinOpen} onOpenChange={setProteinOpen} onChange={(protein) => set({ protein })} onGoalSaved={onGoalSaved} />

      <Fold title="More" hint="Optional">
        <div className="grid gap-md pt-sm">
          <OneOf label="Packaged, fried or sweet" hint="Sweet chai, cold drinks and packaged juice count." options={EAT_PACKAGED} value={e.packaged} onChange={(packaged) => set({ packaged })} />
          <OneOf label="After meals I mostly felt" options={EAT_FULLNESS} value={e.fullness} onChange={(fullness) => set({ fullness })} />
          {meals.length > 0 && (
            <Stepper label="Meals without a screen" value={e.screenFree} max={meals.length} unit={['meal', 'meals']} onChange={(screenFree) => set({ screenFree })} />
          )}
          <FieldLabel label="A note" hint="Optional. Private unless you share its table with a life coach.">
            <input value={e.note} onChange={(ev) => set({ note: ev.target.value })} maxLength={500} className={FIELD} />
          </FieldLabel>
        </div>
      </Fold>

      {!conflict && <ErrorLine e={save.error} />}
      <Button type="submit" full size="lg" variant={solid ? 'primary' : 'outline'} disabled={save.isPending}>
        {save.isPending ? 'Saving' : existing ? 'Update this day' : 'Save this day'}
      </Button>
      <p role="status" className="m-0 text-center text-caption text-ink-soft empty:hidden">
        {said}
      </p>
    </form>
  );
}
