// The water card's second and third panels (settings, and the person's own reminders), downloaded after the first paint so Daily's and
// Home's first download stays inside its budget; the card mounts them hidden, so what is typed in either is kept as before.
import { MAX_CUSTOM_REMINDERS, REMINDER_TIME, REMINDER_TITLE_MAX, WEEKDAY_NAMES, weekdaysLabel, type CustomReminder } from '@kreators/shared';
import { afterRemove } from '../lib/focusHeading';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useId, useState, type ReactNode } from 'react';
import { api } from '../lib/api';
import { useTapTwice } from '../lib/useTapTwice';
import { Icon } from './Icon';
import { Check } from 'lucide-react';
import { FIELD } from '../lib/ui';
import { ChipSelect } from './ChipSelect';
import { msg, litres, shortDay, withNow, GOALS, GLASSES, useWaterActions } from './Reminders';
import { clockOf } from '../lib/date';

/** The water settings, the card's second panel: the daily goal and the size of a glass. Water sends no notes (2026-11-07), so nothing else is left to set. */
export function WaterSettings() {
  const { q, settle } = useWaterActions();
  const w = q.data?.water;
  if (!w) return null;
  return (
    <>
      {/* Two pickers in the look of the focus panel's, side by side. */}
      <div className="mf-sets" role="group" aria-label="Water settings">
        <ChipSelect label="Daily goal" value={w.goalMl} valueLabel={litres(w.goalMl)} options={withNow(GOALS, w.goalMl, litres)} onChange={(goalMl) => settle.mutate({ goalMl })} />
        <ChipSelect label="A glass" value={w.glassMl} valueLabel={`${w.glassMl} ml`} options={withNow(GLASSES, w.glassMl, (n) => `${n} ml`)} onChange={(glassMl) => settle.mutate({ glassMl })} />
      </div>
      <p className="mf-line">{`That is ${w.goalGlasses} ${w.goalGlasses === 1 ? 'glass' : 'glasses'} of ${w.glassMl} ml a day.`}</p>
      {settle.error && <p role="alert" className="mf-line">{msg(settle.error)}</p>}
    </>
  );
}

/** A tick box drawn by the app over the real checkbox, which stays for screen readers and the keyboard. */
function TickBox() {
  return (
    <span aria-hidden="true" className="flex size-[24px] shrink-0 items-center justify-center rounded-[8px] border-2 border-line text-on-ink peer-checked:border-ink peer-checked:bg-ink peer-checked:[&_svg]:opacity-100 peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[color:var(--deep-self)]">
      <Icon icon={Check} size={16} strokeWidth={3} className="opacity-0" />
    </span>
  );
}

/**
 * A reminder's row (2026-11-12, the founder: the tick box outside the card, on every tick row): the box is its own control at the left, 44
 * by 44 to tap; the card beside it holds the words and is a second label for the same box, so a tap on the words still ticks, adding no
 * keyboard stop; then any `aside` (Remove). The box is named by the title and described by the note.
 */
function ReminderTick({ checked, onChange, disabled = false, label, title, note, struck = false, aside }: { checked: boolean; onChange: (on: boolean) => void; disabled?: boolean; label?: string; title: string; note: ReactNode; struck?: boolean; aside?: ReactNode }) {
  const id = useId();
  return (
    <li className="flex items-center gap-xs">
      <label className="relative flex size-[44px] shrink-0 cursor-pointer items-center justify-center">
        <input
          id={`${id}-box`}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          aria-label={label}
          aria-labelledby={label ? undefined : `${id}-title`}
          aria-describedby={`${id}-note`}
          className="peer sr-only"
        />
        <TickBox />
      </label>
      <label htmlFor={`${id}-box`} className="toy toy-flat flex min-h-[44px] min-w-0 flex-1 cursor-pointer items-center rounded-inner-sm bg-card px-sm py-xs">
        <span className="min-w-0">
          <span id={`${id}-title`} className={`block text-row-title ${struck ? 'text-ink-soft line-through' : ''}`}>
            {title}
          </span>
          <span id={`${id}-note`} className="block text-card-note text-ink-soft">
            {note}
          </span>
        </span>
      </label>
      {aside}
    </li>
  );
}

/**
 * The person's own reminders and the tasks they asked to remember, the card's third panel. `tasks={false}` (Daily, which
 * lists them under To remember) points there instead of listing them.
 */
export function YourReminders({ tasks = true, onLeave }: { tasks?: boolean; /** Leave the card's panel for a link to the page under it. */ onLeave?: () => void }) {
  const { q, day, refresh, touchDaily } = useWaterActions();
  const custom = q.data?.custom ?? [];
  const remembered = q.data?.tasks ?? [];
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('18:00');
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5, 6, 7]);
  const [picking, setPicking] = useState(false);
  const [pickId, setPickId] = useState('');
  const [pickDay, setPickDay] = useState(day);
  const [pickTime, setPickTime] = useState('09:00');
  const open = useQuery({ queryKey: ['reminders', 'pick'], queryFn: () => api.focusTasks(), enabled: picking });
  const pickable = (open.data?.tasks ?? []).filter((t) => !(t.remind && t.dueDate));
  const chosen = pickable.find((t) => t.id === pickId);
  // A task with a day keeps it; one with none gets the day picked here, since the inbox note goes out on a day.
  const remember = useMutation({
    mutationFn: () => api.updateNode(pickId, { remind: true, dueTime: pickTime, ...(chosen?.dueDate ? {} : { doDate: pickDay }) }),
    onSuccess: () => { setPicking(false); setPickId(''); touchDaily(); },
  });
  const forget = useMutation({ mutationFn: (id: string) => api.updateNode(id, { remind: false }), onSuccess: touchDaily });
  const add = useMutation({ mutationFn: () => api.addReminder({ title, time, days }), onSuccess: () => { setTitle(''); setAdding(false); refresh(); } });
  const change = useMutation({ mutationFn: (v: { id: string; r: Partial<CustomReminder> }) => api.changeReminder(v.id, v.r), onSuccess: refresh });
  // Your own reminder is a small personal remove: a second tap (the founder, 2026-11-13), never a popup. Unticking it pauses it instead.
  const ask = useTapTwice<string>();
  const remove = useMutation({ mutationFn: (id: string) => api.removeReminder(id), onSuccess: () => refresh() });
  const failed = add.error ?? change.error ?? remember.error ?? forget.error ?? remove.error;
  return (
    <>
      <h3 className="m-0 text-headline">Your reminders</h3>
      {custom.length === 0 && !adding && <p className="mf-line mt-xs">Stretch, take medicine, call someone. Each lands in your Inbox on time.</p>}
      {custom.length > 0 && (
        <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
          {custom.map((r) => (
            <ReminderTick
              key={r.id}
              checked={r.enabled}
              onChange={(on) => change.mutate({ id: r.id, r: { enabled: on } })}
              title={r.title}
              note={`${clockOf(r.time)} · ${weekdaysLabel(r.days)}`}
              struck={!r.enabled}
              aside={
                <button
                  type="button"
                  className={`mf-mini toy ${ask.isArmed(r.id) ? 'red-armed' : ''}`}
                  disabled={remove.isPending}
                  onClick={() => {
                    remove.reset();
                    ask.tap(r.id, () => remove.mutate(r.id, { onSuccess: afterRemove('Reminder removed.') }));
                  }}
                  aria-label={`${ask.isArmed(r.id) ? 'Tap again to remove' : 'Remove'} ${r.title}. To pause it instead, untick it.`}
                >
                  <span aria-hidden={ask.isArmed(r.id) || undefined}>{ask.isArmed(r.id) ? 'Tap again to remove' : 'Remove'}</span>
<span className="sr-only" aria-live="polite">{ask.isArmed(r.id) ? 'Tap again to remove' : ''}</span>
                </button>
              }
            />
          ))}
        </ul>
      )}
      {adding ? (
        <form
          className="mt-sm flex flex-col gap-sm rounded-inner bg-card p-sm"
          onSubmit={(e) => {
            e.preventDefault();
            if (title.trim()) add.mutate();
          }}
        >
          <label className="block">
            <span className="block text-caption">Remind me to</span>
            <input value={title} maxLength={REMINDER_TITLE_MAX} onChange={(e) => setTitle(e.target.value)} placeholder="Stretch for five minutes" className={FIELD} />
          </label>
          <label className="block">
            <span className="block text-caption">At</span>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={FIELD} />
          </label>
          <div role="group" aria-label="Days" className="grid grid-cols-7 gap-xs">
            {WEEKDAY_NAMES.map((n, i) => {
              const d = i + 1;
              const on = days.includes(d);
              return (
                <button key={n} type="button" aria-pressed={on} onClick={() => setDays((x) => (on ? x.filter((y) => y !== d) : [...x, d].sort()))} className="mf-mini toy min-w-0 px-0 text-caption">
                  {/* Two letters in a narrow card (a phone, the laptop's bubble), three where the card has room: by the card's width, not the screen's. */}
                  <span className="water-wd-short">{n.slice(0, 2)}</span>
                  <span className="water-wd-long">{n}</span>
                </button>
              );
            })}
          </div>
          <div className="flex gap-xs">
            {/* The main Save takes the width, Cancel at its right on the same line (2026-11-06). */}
            <button type="submit" className="mf-mini toy flex-1" disabled={add.isPending || !title.trim() || days.length === 0}>
              Save reminder
            </button>
            <button type="button" className="mf-mini toy" onClick={() => setAdding(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="mf-actions">
          <button type="button" className="mf-mini toy flex-1" onClick={() => setAdding(true)} disabled={custom.length >= MAX_CUSTOM_REMINDERS}>
            + Add a reminder
          </button>
        </div>
      )}

      <h3 className="mt-lg m-0 text-headline">Tasks to remember</h3>
      <p className="mf-line mt-xs">A task you ask to remember sends one note to your Inbox on its day.</p>
      {!tasks ? (
        remembered.some((t) => !t.day) && (
          <p className="mf-line mt-xs">
            <a
              href="#remember-heading"
              onClick={(e) => {
                // Go to the list on the page, after the card has gone back to its first panel.
                e.preventDefault();
                onLeave?.();
                window.setTimeout(() => document.getElementById('remember-heading')?.scrollIntoView({ block: 'start' }), 250);
              }}
              className="inline-flex min-h-[44px] items-center underline underline-offset-4"
            >
              Tasks to remember are under Tasks below
            </a>
          </p>
        )
      ) : (
        remembered.length > 0 && (
          <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
            {remembered.map((t) => (
              <ReminderTick
                key={t.id}
                checked
                onChange={() => forget.mutate(t.id)}
                disabled={forget.isPending}
                label={`Stop reminding me about ${t.title}`}
                title={t.title}
                note={t.day ? `${shortDay(t.day)} · ${clockOf(t.time ?? '09:00')}` : 'No day yet, so no note'}
              />
            ))}
          </ul>
        )
      )}
      {picking ? (
        <form
          className="mt-sm flex flex-col gap-sm rounded-inner bg-card p-sm"
          onSubmit={(e) => {
            e.preventDefault();
            if (chosen && REMINDER_TIME.test(pickTime)) remember.mutate();
          }}
        >
          <label className="block">
            <span className="block text-caption">Task</span>
            <select value={pickId} onChange={(e) => setPickId(e.target.value)} className={FIELD}>
              <option value="">{open.isLoading ? 'Loading' : pickable.length === 0 ? 'No open tasks' : 'Pick a task'}</option>
              {pickable.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
            <span className="mt-xs block text-caption text-ink-soft">It wears the Remember tag on Daily.</span>
          </label>
          {chosen && !chosen.dueDate && (
            <label className="block">
              <span className="block text-caption">On</span>
              <input type="date" value={pickDay} min={day} onChange={(e) => setPickDay(e.target.value)} className={FIELD} />
              <span className="mt-xs block text-caption text-ink-soft">It will show on Daily from that day.</span>
            </label>
          )}
          <label className="block">
            <span className="block text-caption">At</span>
            <input type="time" value={pickTime} onChange={(e) => setPickTime(e.target.value)} className={FIELD} />
            <span className="mt-xs block text-caption text-ink-soft">One note lands in your Inbox at this time.</span>
          </label>
          <div className="flex gap-xs">
            <button type="submit" className="mf-mini toy flex-1" disabled={remember.isPending || !chosen || !REMINDER_TIME.test(pickTime) || (!chosen.dueDate && pickDay < day)}>
              Remind me
            </button>
            <button type="button" className="mf-mini toy" onClick={() => setPicking(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="mf-actions">
          <button type="button" className="mf-mini toy flex-1" onClick={() => { setPickDay(day); setPicking(true); }}>
            + Remind me about a task
          </button>
        </div>
      )}
      {failed && <p role="alert" className="mf-line">{msg(failed)}</p>}
    </>
  );
}
