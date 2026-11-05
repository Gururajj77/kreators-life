import { CloseButton } from './CloseButton';
import { LOCALE, MAX_CUSTOM_REMINDERS, REMINDER_TIME, REMINDER_TITLE_MAX, WATER_EVERY_CHOICES, WATER_GLASS_MAX, WATER_GLASS_MIN, WATER_GOAL_MAX, WATER_GOAL_MIN, WEEKDAY_NAMES, weekdaysLabel, type CustomReminder } from '@kreators/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import { api } from '../lib/api';
import { dayLabel, todayLocal } from '../lib/date';
import { useSession } from '../lib/store';
import { useDialogFocus } from '../lib/useDialogFocus';
import { Button } from './Button';
import { WaterFill } from './fx/WaterFill';
import { WaterGlass } from './fx/WaterGlass';
import { Sheet } from './Sheet';
import { Icon } from './Icon';
import { Check, ChevronLeft, ChevronRight, Droplet, X } from 'lucide-react';
import { FIELD } from '../lib/ui';
import { Toggle } from './Toggle';
import { ToggleChevron } from './ToggleMark';
import { ChipSelect } from './ChipSelect';
import { RoundButton } from './RoundButton';
import { AnimatedIcon } from './AnimatedIcon';

const msg = (e: unknown) => (e instanceof Error ? e.message : 'That did not work. Try again.');
// 2 L, 2.25 L, 10 L: trailing zeros go only after a decimal point (the old one turned 10,000 ml into 1 L).
const litres = (ml: number) => (ml >= 1000 ? `${Number((ml / 1000).toFixed(2))} L` : `${ml} ml`);

/** "Tue 3 Nov" for a day typed as YYYY-MM-DD. */
const shortDay = dayLabel;

function useReminders() {
  const token = useSession((s) => s.token);
  const qc = useQueryClient();
  const day = todayLocal();
  const q = useQuery({ queryKey: ['reminders', day], queryFn: () => api.reminders(day), enabled: Boolean(token) });
  const refresh = () => void qc.invalidateQueries({ queryKey: ['reminders'] });
  return { q, day, refresh };
}

function Drop({ size = 20 }: { size?: number }) {
  return (
    <Icon icon={Droplet} size={size} filled />
  );
}

const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const minutesOf = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};
/** A picker's choices, with the value now in effect always among them (a goal typed as 2,150 ml stays pickable). */
const withNow = (list: number[], now: number, label: (n: number) => string) => [...new Set([...list, now])].sort((a, b) => a - b).map((value) => ({ value, label: label(value) }));
const GOALS = Array.from({ length: (WATER_GOAL_MAX - WATER_GOAL_MIN) / 250 + 1 }, (_, i) => WATER_GOAL_MIN + i * 250);
const GLASSES = [100, 150, 200, 250, 300, 350, 400, 500, 750, 1000].filter((n) => n >= WATER_GLASS_MIN && n <= WATER_GLASS_MAX);
const HOURS = Array.from({ length: 19 }, (_, i) => (5 + i) * 60);
const everyLabel = (w: { everyMin: number }) => (w.everyMin >= 60 ? `${w.everyMin / 60} h` : `${w.everyMin} min`);

/** Every write the water block makes, in one place, so the panel and its two sheets share them. */
function useWaterActions() {
  const { q, day, refresh } = useReminders();
  const qc = useQueryClient();
  const touchDaily = () => {
    refresh();
    void qc.invalidateQueries({ queryKey: ['today'] });
    void qc.invalidateQueries({ queryKey: ['nodes'] });
  };
  const drink = useMutation({ mutationFn: (amount?: number) => api.drinkWater(day, amount), onSuccess: refresh });
  const undo = useMutation({ mutationFn: () => api.undoWater(day), onSuccess: refresh });
  const settle = useMutation({ mutationFn: (s: Parameters<typeof api.waterSettings>[1]) => api.waterSettings(day, s), onSuccess: refresh });
  return { q, day, refresh, touchDaily, drink, undo, settle };
}

/** The amounts the picker under the glass steps through, with the person's own glass among them. */
const AMOUNTS = [100, 150, 200, 250, 300, 330, 400, 500, 750, 1000];
const amountsFor = (glassMl: number) => [...new Set([...AMOUNTS, glassMl])].filter((n) => n >= WATER_GLASS_MIN && n <= WATER_GLASS_MAX).sort((x, y) => x - y);
/** "Mo", "Tu" for a day typed as YYYY-MM-DD, read at noon so no zone moves it to the day before. */
const weekdayOf = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString(LOCALE, { weekday: 'short' }).slice(0, 2);

/**
 * Today's water in the look of Breathe and focus (2026-11-06, the founder: "make it better like the one used in mindfulness", then "put
 * the glass on left and last seven days on right, below the glass add button for another amount"): one dark panel with the glass that
 * fills on the left, today's count under it and an amount picker under that (the arrows step through the amounts, the middle button
 * adds the one shown, starting at the person's glass; Undo beside it), and the last seven days on the right as bars with their days.
 * Where the panel is narrow (the laptop's bubble) the picker takes the row under both. `summary={false}` (inside the section, whose row
 * already shows the count, a glass and Undo) leaves the count and Undo out. The panel pins the dark theme's colours on itself
 * (`.water-night`), so it reads the same in both themes.
 */
function WaterPanel({ summary = true }: { summary?: boolean }) {
  const { q, drink, undo } = useWaterActions();
  const w = q.data?.water;
  const [picked, setPicked] = useState<number | null>(null);
  const failed = drink.error ?? undo.error;
  if (!w)
    return (
      <div className="night-card mf-panel water-night rounded-card" data-accent="r4">
        <p className="mf-line m-0" role="status">{q.isError ? 'Could not load.' : 'Loading'}</p>
      </div>
    );
  const max = Math.max(w.goalMl, ...w.week.map((d) => d.ml));
  const amounts = amountsFor(w.glassMl);
  const amount = picked !== null && amounts.includes(picked) ? picked : w.glassMl;
  const at = amounts.indexOf(amount);
  return (
    <div className="night-card mf-panel water-night rounded-card" data-accent="r4" data-pillar="lover_partner">
      <div className="water-grid">
        <div className="water-grid-glass flex flex-col items-center">
          <WaterGlass value={w.ml} max={w.goalMl} size={150} />
          {summary && (
            <p className="mt-sm m-0 text-center" aria-label={`${w.glasses} of ${w.goalGlasses} glasses today, ${litres(w.ml)} of ${litres(w.goalMl)}`}>
              <span className="mf-time inline">{litres(w.ml)}</span>
              <span className="mf-line mt-xs block">
                {w.glasses} of {w.goalGlasses} glasses{w.ml >= w.goalMl ? ', goal met' : ''}
              </span>
            </p>
          )}
        </div>

        {/* The amount picker: step through the amounts with the arrows, add the one shown with the middle button. */}
        <div className="water-grid-step flex items-center justify-center gap-xs" role="group" aria-label="Add water">
          <button type="button" className="mf-mini toy flex w-[44px] items-center justify-center px-0" onClick={() => setPicked(amounts[Math.max(0, at - 1)]!)} disabled={at <= 0} aria-label="A smaller amount">
            <Icon icon={ChevronLeft} size={18} />
          </button>
          {/* The bubble opens with focus here (data-autofocus), on the one main action, so Enter adds the amount shown. */}
          {/* Inside the section its row's + Glass is the screen's solid button, so here the amount is an outline pill. */}
          <button type="button" data-autofocus="" className={`${summary ? 'mf-start' : 'mf-mini'} toy min-w-[112px]`} onClick={() => drink.mutate(amount === w.glassMl ? undefined : amount)} disabled={drink.isPending}>
            +{amount} ml
          </button>
          <button type="button" className="mf-mini toy flex w-[44px] items-center justify-center px-0" onClick={() => setPicked(amounts[Math.min(amounts.length - 1, at + 1)]!)} disabled={at >= amounts.length - 1} aria-label="A larger amount">
            <Icon icon={ChevronRight} size={18} />
          </button>
          {summary && (
            <button type="button" className="mf-mini toy ml-xs" onClick={() => undo.mutate()} disabled={undo.isPending || w.ml === 0}>
              Undo
            </button>
          )}
        </div>

        {/* The last seven days, each bar its day, today the brightest. */}
        <div className="water-grid-week min-w-0">
          <p className="mf-line m-0">Last seven days</p>
          <div className="mt-sm flex h-[140px] items-end gap-xs" role="img" aria-label={`Water, last seven days: ${w.week.map((d) => `${weekdayOf(d.day)} ${litres(d.ml)}`).join(', ')}`}>
            {w.week.map((d) => (
              <span key={d.day} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-xs">
                <span className="w-full rounded-pill" style={{ height: `${Math.max(6, (d.ml / max) * 100)}%`, background: 'var(--mf-a-text)', opacity: d.day === w.day ? 1 : 0.4 }} />
                <span className="text-caption2 text-[color:var(--mf-dim)]" aria-hidden="true">{weekdayOf(d.day)}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
      {failed && <p role="alert" className="mf-line">{msg(failed)}</p>}
    </div>
  );
}

/** The water settings, in a sheet from the gear: the reminder switch and five pickers (goal, glass, how often, from and to). */
function WaterSettings() {
  const { q, settle } = useWaterActions();
  const w = q.data?.water;
  if (!w) return <p className="m-0 text-subhead text-ink-soft" role="status">{q.isError ? 'Could not load.' : 'Loading'}</p>;
  const every = everyLabel(w);
  return (
    <div className="night-card mf-panel water-night rounded-card" data-accent="r4">
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
    </div>
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
 * The person's own reminders and the tasks they asked to remember, in a sheet from the reminders button. `tasks={false}` (Daily, which
 * lists them under To remember) points there instead of listing them.
 */
function YourReminders({ tasks = true, onLeave }: { tasks?: boolean; /** Close the sheet, so a link to the page under it can be seen. */ onLeave?: () => void }) {
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
  const remove = useMutation({ mutationFn: (id: string) => api.removeReminder(id), onSuccess: refresh });
  const failed = add.error ?? change.error ?? remove.error ?? remember.error ?? forget.error;
  return (
    <div className="night-card mf-panel water-night rounded-card" data-accent="r4">
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
              <button type="button" className="mf-mini toy" onClick={() => remove.mutate(r.id)} disabled={remove.isPending} aria-label={`Remove ${r.title}`}>
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
                  {/* Two letters on a phone, three from sm up (the display class only in the variant, for Tailwind 4's order). */}
                  <span className="sm:hidden">{n.slice(0, 2)}</span>
                  <span className="hidden sm:inline">{n}</span>
                </button>
              );
            })}
          </div>
          <div className="flex gap-xs">
            <button type="submit" className="mf-mini toy" disabled={add.isPending || !title.trim() || days.length === 0}>
              Save reminder
            </button>
            <button type="button" className="mf-mini toy" onClick={() => setAdding(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="mf-actions">
          <button type="button" className="mf-mini toy" onClick={() => setAdding(true)} disabled={custom.length >= MAX_CUSTOM_REMINDERS}>
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
                // The sheet covers the page: close it first, then go to the list once it is gone.
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
          </label>
          <div className="flex gap-xs">
            <button type="submit" className="mf-mini toy" disabled={remember.isPending || !chosen || !REMINDER_TIME.test(pickTime) || (!chosen.dueDate && pickDay < day)}>
              Remind me
            </button>
            <button type="button" className="mf-mini toy" onClick={() => setPicking(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="mf-actions">
          <button type="button" className="mf-mini toy" onClick={() => { setPickDay(day); setPicking(true); }}>
            + Remind me about a task
          </button>
        </div>
      )}
      {failed && <p role="alert" className="mf-line">{msg(failed)}</p>}
    </div>
  );
}

/**
 * The water block, laid out like Mindfulness's Breathe and focus: the heading and today's line on the left, round glass buttons at the
 * right (the reminder switch, settings, your reminders, and Close in the laptop's bubble), the dark panel under them, and settings and
 * reminders each in a sheet. On Home before the daily brief, in the laptop's bubble on Daily and Journal, in the card table's sheet, and
 * (without its heading and summary) inside the phone's section. `heading={false}` keeps only the round buttons, at the right.
 */
export function WaterBlock({ tasks = true, summary = true, heading = true, onClose, className = '' }: { tasks?: boolean; summary?: boolean; heading?: boolean; onClose?: () => void; className?: string }) {
  const { q, settle } = useWaterActions();
  const w = q.data?.water;
  const [sheet, setSheet] = useState<'settings' | 'reminders' | null>(null);
  return (
    <section className={className} aria-labelledby={heading ? 'water-heading' : undefined} aria-label={heading ? undefined : 'Water and reminders'} data-pillar="lover_partner">
      <div className="flex flex-wrap items-end justify-between gap-sm">
        {heading && (
          <div className="min-w-0 flex-[1_1_180px]">
            <h2 id="water-heading" className="text-title2">
              Water
            </h2>
            <p className="mt-xs m-0 text-subhead text-ink-soft">{w ? `${w.glasses} of ${w.goalGlasses} glasses today, ${litres(w.ml)} of ${litres(w.goalMl)}.` : 'Loading'}</p>
          </div>
        )}
        <div className="mf-rounds ml-auto" role="group" aria-label="Water tools">
          {w && (
            <RoundButton at="bc" label={w.on ? 'Water reminders are on. Turn them off' : 'Water reminders are off. Turn them on'} pressed={w.on} onClick={() => !settle.isPending && settle.mutate({ on: !w.on })}>
              <AnimatedIcon name="notification" size={20} active={!w.on} />
            </RoundButton>
          )}
          <RoundButton at="bc" label="Water settings" opens onClick={() => setSheet('settings')}>
            <AnimatedIcon name="settings" size={20} />
          </RoundButton>
          <RoundButton at="tr" label="Reminders and tasks" opens onClick={() => setSheet('reminders')}>
            <AnimatedIcon name="calendar" size={20} />
          </RoundButton>
          {onClose && (
            <RoundButton at="tr" label="Close water and reminders" onClick={onClose}>
              <Icon icon={X} size={20} />
            </RoundButton>
          )}
        </div>
      </div>
      {settle.error && (
        <p role="alert" className="mt-xs m-0 text-subhead">
          {msg(settle.error)}
        </p>
      )}
      <div className="mt-sm">
        <WaterPanel summary={summary} />
      </div>
      <Sheet open={sheet === 'settings'} onClose={() => setSheet(null)} title="Water settings">
        <WaterSettings />
      </Sheet>
      <Sheet open={sheet === 'reminders'} onClose={() => setSheet(null)} title="Reminders and tasks">
        <YourReminders tasks={tasks} onLeave={() => setSheet(null)} />
      </Sheet>
    </section>
  );
}

/**
 * On a phone: a section inside Daily and Journal, never a floating button. Water comes first, so its tap sits in
 * the collapsed row; the rest opens under it.
 */
export function RemindersSection({ always = false, tasks = true, quiet = false }: { always?: boolean; tasks?: boolean; /** The screen already has its one solid button (Journal's New entry), so "+ Glass" takes the outline look. */ quiet?: boolean }) {
  const { q, day, refresh } = useReminders();
  const [open, setOpen] = useState(false);
  const w = q.data?.water;
  const drink = useMutation({ mutationFn: () => api.drinkWater(day), onSuccess: refresh });
  const undo = useMutation({ mutationFn: () => api.undoWater(day), onSuccess: refresh });
  return (
    <section className={`span-all mt-md w-full rounded-card bg-card p-md shadow-toy-soft ${always ? '' : 'md:hidden'}`} aria-label="Water and reminders" data-pillar="lover_partner">
      {/* One wide cell: what it is and where today stands on the left, the tap on the right. On a phone the tap drops under it, full width. */}
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <button type="button" aria-expanded={open} aria-controls="reminders-body" onClick={() => setOpen((v) => !v)} className="toy toy-flat flex min-h-[44px] min-w-0 flex-1 items-center gap-sm rounded-inner-sm px-xs py-xs text-left">
          <span className="flex size-[44px] shrink-0 items-center justify-center rounded-inner-sm bg-r4/20 text-r4">
            <Drop size={24} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-card-title">Water and reminders</span>
            <span className="block text-card-note text-ink-soft">{w ? `${w.glasses} of ${w.goalGlasses} glasses today · ${litres(w.ml)} of ${litres(w.goalMl)}` : 'Loading'}</span>
          </span>
          <ToggleChevron open={open} size={16} strokeWidth={3} />
        </button>
        <div className="flex gap-xs sm:shrink-0">
          <Button size="md" variant={quiet ? 'outline' : undefined} className="flex-1 sm:flex-none" onClick={() => drink.mutate()} disabled={drink.isPending || !w} aria-label="Add a glass of water">
            + Glass
          </Button>
          <Button size="md" variant="outline" onClick={() => undo.mutate()} disabled={undo.isPending || !w || w.ml === 0}>
            Undo
          </Button>
        </div>
      </div>
      <WaterFill className="mt-sm" value={w?.ml} max={w?.goalMl} />
      {open && (
        <div id="reminders-body" className="mt-sm">
          <WaterBlock heading={false} summary={false} tasks={tasks} />
        </div>
      )}
    </section>
  );
}

/**
 * On a laptop: a small bubble at the left of Daily and Journal that opens into the same panel. There is no floating button
 * on a phone; the section above does that job there.
 */
export function ReminderBubble() {
  const loc = useLocation();
  const here = loc.pathname === '/today' || loc.pathname.startsWith('/journal');
  const [open, setOpen] = useState(false);
  const { q } = useReminders();
  // Focus moves into the panel when it opens, Tab wraps at its ends, Escape closes it, and focus goes back to the Water button.
  const panel = useRef<HTMLDivElement>(null);
  useDialogFocus(panel, open && here, { modal: false, onEscape: () => setOpen(false) });
  useEffect(() => setOpen(false), [loc.pathname]);
  if (!here) return null;
  const w = q.data?.water;
  return (
    <div className="fixed bottom-md left-[calc(var(--nav-w)+var(--spacing-md))] z-40 hidden md:block" data-pillar="lover_partner">
      {open && (
        // The water block on a strong card: its heading and round buttons on the card, the dark panel under them.
        <div ref={panel} className="mb-sm max-h-[80vh] w-[380px] overflow-y-auto rounded-card border border-line bg-card-strong p-md shadow-toy-soft" role="dialog" aria-label="Water and reminders">
          <WaterBlock onClose={() => setOpen(false)} />
        </div>
      )}
      <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} aria-label={w ? `Water and reminders, ${w.glasses} of ${w.goalGlasses} glasses` : 'Water and reminders'} className="toy toy-soft flex min-h-[48px] items-center gap-xs rounded-pill border-2 border-line bg-card-strong px-md text-headline">
        <span className="text-r4"><Drop size={22} /></span>
        Water {w ? `${w.glasses}/${w.goalGlasses}` : ''}
      </button>
    </div>
  );
}

/**
 * A small button for a screen with no room for the bubble, such as the card table in focus mode: the water so far today, and
 * the same panel as the bubble (a glass, the goal, the reminders) in a sheet. Laptop and up only; a phone has the section in the screen.
 */
export function WaterButton() {
  const [open, setOpen] = useState(false);
  const { q } = useReminders();
  const w = q.data?.water;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        data-pillar="lover_partner"
        aria-label={w ? `Water and reminders, ${w.glasses} of ${w.goalGlasses} glasses` : 'Water and reminders'}
        className="toy toy-soft hidden min-h-[44px] items-center gap-xs rounded-pill border border-line bg-card-strong px-sm text-subhead font-medium text-ink md:flex"
      >
        <span className="text-r4">
          <Drop size={20} />
        </span>
        Water {w ? `${w.glasses}/${w.goalGlasses}` : ''}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Water and reminders">
        <WaterBlock heading={false} />
      </Sheet>
    </>
  );
}
