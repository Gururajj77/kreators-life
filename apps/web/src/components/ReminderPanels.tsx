// The water card's second and third panels (settings, and the person's own reminders), downloaded after the first paint so Daily's and
// Home's first download stays inside its budget; the card mounts them hidden, so what is typed in either is kept as before.
import { MAX_CUSTOM_REMINDERS, REMINDER_TIME, REMINDER_TITLE_MAX, WATER_EVERY_CHOICES, WEEKDAY_NAMES, weekdaysLabel, type CustomReminder } from '@kreators/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../lib/api';
import { ConfirmDelete } from './ConfirmDelete';
import { Icon } from './Icon';
import { Check } from 'lucide-react';
import { FIELD } from '../lib/ui';
import { Toggle } from './Toggle';
import { ChipSelect } from './ChipSelect';
import { msg, litres, shortDay, hhmm, minutesOf, withNow, GOALS, GLASSES, HOURS, everyLabel, useWaterActions } from './Reminders';

/** The water settings, the card's second panel: the reminder switch and five pickers (goal, glass, how often, from and to). */
export function WaterSettings() {
  const { q, settle } = useWaterActions();
  const w = q.data?.water;
  if (!w) return null;
  const every = everyLabel(w);
  return (
    <>
      <Toggle
        compact
        on={w.on}
        onChange={(on) => settle.mutate({ on })}
        disabled={settle.isPending}
        label={
          <>
            <span className="block text-row-title text-ink">Remind me to drink</span>
            <span className="block text-card-note text-ink-soft">Until the goal is met. Notes land in your Inbox.</span>
          </>
        }
      />
      {/* Five pickers in the look of the focus panel's: two to a row, How often across its own. */}
      <div className="mf-sets" role="group" aria-label="Water settings">
        <ChipSelect label="Daily goal" value={w.goalMl} valueLabel={litres(w.goalMl)} options={withNow(GOALS, w.goalMl, litres)} onChange={(goalMl) => settle.mutate({ goalMl })} />
        <ChipSelect label="A glass" value={w.glassMl} valueLabel={`${w.glassMl} ml`} options={withNow(GLASSES, w.glassMl, (n) => `${n} ml`)} onChange={(glassMl) => settle.mutate({ glassMl })} />
        <ChipSelect label="How often" value={w.everyMin} valueLabel={`Every ${every}`} options={WATER_EVERY_CHOICES.map((m) => ({ value: m, label: `Every ${m / 60} hours` }))} onChange={(everyMin) => settle.mutate({ everyMin })} />
        <ChipSelect label="From" value={minutesOf(w.from)} valueLabel={w.from} options={withNow(HOURS, minutesOf(w.from), hhmm)} onChange={(m) => settle.mutate({ from: hhmm(m) })} />
        <ChipSelect label="To" value={minutesOf(w.to)} valueLabel={w.to} options={withNow(HOURS, minutesOf(w.to), hhmm)} onChange={(m) => settle.mutate({ to: hhmm(m) })} />
      </div>
      <p className="mf-line">{w.on ? `A note every ${every}, ${w.from} to ${w.to}, until you reach ${litres(w.goalMl)}.` : 'Reminders are off. Your goal still shows on the panel.'}</p>
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
  // Removing asks first (every removal does): the reminder the sheet is about, null while it is shut.
  const [gone, setGone] = useState<CustomReminder | null>(null);
  const remove = useMutation({ mutationFn: (id: string) => api.removeReminder(id), onSuccess: () => { setGone(null); refresh(); } });
  const failed = add.error ?? change.error ?? remember.error ?? forget.error;
  return (
    <>
      <h3 className="m-0 text-headline">Your reminders</h3>
      {custom.length === 0 && !adding && <p className="mf-line mt-xs">Stretch, take medicine, call someone. Each lands in your Inbox on time.</p>}
      {custom.length > 0 && (
        <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
          {custom.map((r) => (
            <li key={r.id} className="flex items-center gap-xs rounded-inner-sm bg-card p-xs">
              <label className="toy toy-flat flex min-h-[44px] min-w-0 flex-1 cursor-pointer items-center gap-sm rounded-tile px-xs">
                <input type="checkbox" checked={r.enabled} onChange={(e) => change.mutate({ id: r.id, r: { enabled: e.target.checked } })} className="peer sr-only" />
                <TickBox />
                <span className="min-w-0">
                  <span className={`block text-row-title ${r.enabled ? '' : 'text-ink-soft line-through'}`}>{r.title}</span>
                  <span className="block text-card-note text-ink-soft">
                    {r.time} · {weekdaysLabel(r.days)}
                  </span>
                </span>
              </label>
              <button type="button" className="mf-mini toy" onClick={() => { remove.reset(); setGone(r); }} aria-label={`Remove ${r.title}`}>
                Remove
              </button>
            </li>
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
              <li key={t.id} className="rounded-inner-sm bg-card p-xs">
                <label className="toy toy-flat flex min-h-[44px] cursor-pointer items-center gap-sm rounded-tile px-xs">
                  <input type="checkbox" checked onChange={() => forget.mutate(t.id)} disabled={forget.isPending} aria-label={`Stop reminding me about ${t.title}`} className="peer sr-only" />
                  <TickBox />
                  <span className="min-w-0">
                    <span className="block text-row-title">{t.title}</span>
                    <span className="block text-card-note text-ink-soft">{t.day ? `${shortDay(t.day)} · ${t.time ?? '09:00'}` : 'No day yet, so no note'}</span>
                  </span>
                </label>
              </li>
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
      {/* The sheet portals to the page's top, so it is never framed by the bubble or the water card it is opened from. */}
      <ConfirmDelete
        open={gone !== null}
        title="Remove this reminder?"
        body={gone ? `“${gone.title}” will stop landing in your Inbox, for good. To pause it instead, untick it in the list.` : ''}
        pending={remove.isPending}
        failed={remove.isError}
        error={remove.error ? msg(remove.error) : undefined}
        onYes={() => gone && remove.mutate(gone.id)}
        onClose={() => setGone(null)}
        yes="Yes, remove it"
      />
    </>
  );
}
