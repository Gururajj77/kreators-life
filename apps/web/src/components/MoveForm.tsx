import { EFFORT_LEVELS, kmText, metresTyped, MOVE_KIND_META, moveLine, typedMetres, type MoveKind, type MoveLog } from '@kreators/shared/fitness';
import { useMutation } from '@tanstack/react-query';
import { useId, useState } from 'react';
import type { MoveBody } from '../lib/api';
import { lastDays } from '../lib/date';
import { FIELD } from '../lib/ui';
import { AppIcon } from './AppIcon';
import { Button } from './Button';
import { ErrorLine } from './ErrorLine';
import { FieldLabel } from './Field';
import { Segmented } from './fx/Segmented';
import { RulerPicker } from './RulerPicker';
import { StickyAction } from './StickyAction';

/** Today and yesterday on the device: the only two days a movement log or an eating check-in can be for. */
export function nearDays(): { today: string; yesterday: string } {
  const [yesterday, today] = lastDays(2) as [string, string];
  return { today, yesterday };
}

const pill = (on: boolean) => `toy min-h-[48px] min-w-0 rounded-tile border-2 px-xs text-caption ${on ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`;

/**
 * The one movement form: Fitness's "Log movement" card, its day sheet's change, and Kreators Run's "Log a run or walk" (with `kinds`
 * run and walk). What it is, the minutes on a ruler, the distance for a kind that has one, how hard it felt and a note only the person
 * sees; today or yesterday. It saves through `onSave`, so each caller keeps its own route (one action, two callers on the server).
 */
export function MoveForm({ kinds, onSave, initial, solid = true, saveLabel = 'Save', onDone }: { kinds: readonly MoveKind[]; onSave: (body: MoveBody) => Promise<unknown>; /** A log being changed: its day stays, so there is no day to pick. */ initial?: MoveLog; solid?: boolean; saveLabel?: string; onDone?: (body: MoveBody) => void }) {
  const uid = useId();
  const { today, yesterday } = nearDays();
  const [day, setDay] = useState<'today' | 'yesterday'>('today');
  // A deliberate one-time seed from the log being changed: the form is drawn fresh each time its row opens it.
  const [kind, setKind] = useState<MoveKind>(initial?.kind ?? kinds[0] ?? 'walk');
  const [minutes, setMinutes] = useState(initial?.minutes ?? 30);
  // Every metre stored, so changing only the effort never moves the distance.
  const [km, setKm] = useState(initial?.metres ? metresTyped(initial.metres) : '');
  const [effort, setEffort] = useState<number | null>(initial?.effort ?? null);
  const [note, setNote] = useState(initial?.note ?? '');
  const [said, setSaid] = useState('');
  const hasDistance = MOVE_KIND_META[kind].distance;
  const metres = hasDistance ? typedMetres(km) : null;
  const save = useMutation({
    mutationFn: async () => {
      const body: MoveBody = { date: initial ? initial.date : day === 'today' ? today : yesterday, kind, minutes, metres: metres === 'bad' ? null : metres, effort, note };
      await onSave(body);
      return body;
    },
    onSuccess: (body) => {
      setSaid(`Saved: ${moveLine(body)}${initial ? '' : body.date === today ? ' today' : ' yesterday'}.`);
      if (!initial) {
        setNote('');
        setKm('');
        setEffort(null);
      }
      onDone?.(body);
    },
  });
  const saveButton = (
    <Button type="submit" full size="lg" variant={solid ? 'primary' : 'outline'} disabled={save.isPending || metres === 'bad'}>
      {save.isPending ? 'Saving' : saveLabel}
    </Button>
  );
  return (
    <form
      className="grid gap-md"
      onSubmit={(e) => {
        e.preventDefault();
        if (metres !== 'bad') save.mutate();
      }}
    >
      {!initial && (
        <div>
          <Segmented label="Which day" value={day} onChange={setDay} options={[{ value: 'today', label: 'Today' }, { value: 'yesterday', label: 'Yesterday' }]} />
        </div>
      )}
      {kinds.length > 1 && (
        <div className={`grid gap-xs ${kinds.length > 4 ? 'grid-cols-4' : kinds.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`} role="group" aria-label="What you did">
          {kinds.map((k) => (
            <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={`${pill(kind === k)} flex min-h-[64px] flex-col items-center justify-center gap-xs`}>
              <AppIcon name={MOVE_KIND_META[k].icon} size={22} />
              {MOVE_KIND_META[k].name}
            </button>
          ))}
        </div>
      )}
      <div>
        <p className="m-0 text-center text-figure-lg type-figure leading-none">
          {minutes}
          <span className="text-title3"> min</span>
        </p>
        <RulerPicker className="mt-sm" label="Minutes" tone="paper" accent="r5" min={5} max={360} step={5} labelEvery={30} majorStep={15} value={minutes} onChange={setMinutes} valueText={(v) => `${v} minutes`} />
      </div>
      {hasDistance && (
        <FieldLabel label="Distance in km" hint="Optional">
          <input id={`${uid}-km`} inputMode="decimal" autoComplete="off" value={km} onChange={(e) => setKm(e.target.value)} aria-invalid={metres === 'bad'} aria-describedby={metres === 'bad' ? `${uid}-km-bad` : undefined} className={FIELD} />
          {metres === 'bad' && (
            <span id={`${uid}-km-bad`} className="mt-xs block text-caption text-r1">
              Type kilometres, like 5 or 5.2, up to 300.
            </span>
          )}
          {typeof metres === 'number' && <span className="mt-xs block text-caption text-ink-soft">{kmText(metres)}</span>}
        </FieldLabel>
      )}
      <div>
        <p className="m-0 text-subhead font-semibold">
          How hard it felt <span className="font-normal text-ink-soft">(optional)</span>
        </p>
        <div className="mt-xs grid grid-cols-5 gap-xs" role="group" aria-label="How hard it felt">
          {EFFORT_LEVELS.map((name, i) => (
            <button key={name} type="button" aria-pressed={effort === i + 1} onClick={() => setEffort(effort === i + 1 ? null : i + 1)} className={pill(effort === i + 1)}>
              {name}
            </button>
          ))}
        </div>
      </div>
      <FieldLabel label="A note" hint="Optional. Private unless you share its table with a life coach or AI chat.">
        <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} className={FIELD} />
      </FieldLabel>
      <ErrorLine e={save.error} />
      {/* The one main action (solid) stays in reach on a phone while the form runs past the screen (StickyAction). */}
      {solid ? <StickyAction>{saveButton}</StickyAction> : saveButton}
      <p role="status" className="m-0 text-center text-caption text-ink-soft empty:hidden">
        {said}
      </p>
    </form>
  );
}
