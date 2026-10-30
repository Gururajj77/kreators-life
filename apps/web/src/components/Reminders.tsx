import { MAX_CUSTOM_REMINDERS, REMINDER_TITLE_MAX, WATER_EVERY_CHOICES, WEEKDAY_NAMES, weekdaysLabel, type CustomReminder, type WaterState } from '@kreators/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import { api } from '../lib/api';
import { todayLocal } from '../lib/date';
import { useSession } from '../lib/store';
import { Button } from './Button';

const field = 'mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]';
const msg = (e: unknown) => (e instanceof Error ? e.message : 'That did not work. Try again.');
const litres = (ml: number) => (ml >= 1000 ? `${(ml / 1000).toFixed(ml % 1000 === 0 ? 0 : 2).replace(/0$/, '')} L` : `${ml} ml`);

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
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.5c3.2 4.1 6 7.2 6 10.5a6 6 0 0 1-12 0C6 9.700 8.800 6.600 12 2.500z" />
    </svg>
  );
}

function Bar({ w }: { w: WaterState }) {
  const pct = Math.min(1, w.ml / w.goalMl);
  return (
    <div>
      <div className="h-[12px] rounded-pill bg-line" role="progressbar" aria-valuemin={0} aria-valuemax={w.goalMl} aria-valuenow={w.ml} aria-label="Water today">
        <div className="h-full rounded-pill bg-r4" style={{ width: `${pct * 100}%`, transition: 'width 240ms ease' }} />
      </div>
      <p className="mt-xs m-0 text-[14px] font-bold">
        {w.glasses} of {w.goalGlasses} glasses · {litres(w.ml)} of {litres(w.goalMl)}
        {w.ml >= w.goalMl && ' · goal met'}
      </p>
    </div>
  );
}

/** Water, the person's own reminders and the settings for both. The same on a laptop's bubble and a phone's section. */
export function RemindersPanel({ bento = false }: { bento?: boolean }) {
  const { q, day, refresh } = useReminders();
  const w = q.data?.water;
  const custom = q.data?.custom ?? [];
  const [showSet, setShowSet] = useState(false);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('18:00');
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5, 6, 7]);
  const [ml, setMl] = useState('');
  const drink = useMutation({ mutationFn: (amount?: number) => api.drinkWater(day, amount), onSuccess: () => { setMl(''); refresh(); } });
  const undo = useMutation({ mutationFn: () => api.undoWater(day), onSuccess: refresh });
  const settle = useMutation({ mutationFn: (s: Parameters<typeof api.waterSettings>[1]) => api.waterSettings(day, s), onSuccess: refresh });
  const add = useMutation({ mutationFn: () => api.addReminder({ title, time, days }), onSuccess: () => { setTitle(''); setAdding(false); refresh(); } });
  const change = useMutation({ mutationFn: (v: { id: string; r: Partial<CustomReminder> }) => api.changeReminder(v.id, v.r), onSuccess: refresh });
  const remove = useMutation({ mutationFn: (id: string) => api.removeReminder(id), onSuccess: refresh });
  const failed = drink.error ?? undo.error ?? settle.error ?? add.error ?? change.error ?? remove.error;
  if (!w) return <p className="m-0 text-[14px] font-bold text-ink-soft" role="status">{q.isError ? 'Could not load.' : 'Loading'}</p>;
  const max = Math.max(w.goalMl, ...w.week.map((d) => d.ml));

  // As a bento (the wide card): two cells side by side, each a rounded tile whose curve is the card's, less the padding between them.
  const cell = bento ? 'rounded-inner bg-paper p-sm' : '';
  return (
    <div className={bento ? 'grid gap-sm md:grid-cols-2' : 'flex flex-col gap-md'}>
      <section aria-label="Water" className={cell}>
        <h3 className="m-0 flex items-center gap-xs text-[16px] font-extrabold">
          <span className="text-r4"><Drop /></span> Water
        </h3>
        {!bento && (
          <>
        <div className="mt-xs">
              <Bar w={w} />
            </div>
            <div className="mt-sm flex flex-wrap items-center gap-xs">
              <Button size="sm" onClick={() => drink.mutate(undefined)} disabled={drink.isPending}>
                + 1 glass ({w.glassMl} ml)
              </Button>
              <Button size="sm" variant="outline" onClick={() => undo.mutate()} disabled={undo.isPending || w.ml === 0}>
                Undo
              </Button>
            </div>
          </>
        )}
        <form
          className="mt-xs flex items-center gap-xs"
          onSubmit={(e) => {
            e.preventDefault();
            const n = Number(ml);
            if (n > 0) drink.mutate(n);
          }}
        >
          <label className="min-w-0 flex-1">
            <span className="sr-only">Another amount in ml</span>
            <input value={ml} onChange={(e) => setMl(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="Another amount, in ml" className={`${field} !mt-0 !py-xs`} />
          </label>
          <Button size="sm" variant="outline" type="submit" disabled={drink.isPending || !ml}>
            Add
          </Button>
        </form>
        <div className="mt-sm flex h-[40px] items-end gap-xs" role="img" aria-label={`Water, last seven days: ${w.week.map((d) => litres(d.ml)).join(', ')}`}>
          {w.week.map((d) => (
            <span key={d.day} className="flex-1 rounded-pill bg-r4/60" style={{ height: `${Math.max(6, (d.ml / max) * 100)}%`, opacity: d.day === w.day ? 1 : 0.55 }} />
          ))}
        </div>
        <label className="toy toy-flat mt-sm flex min-h-[44px] cursor-pointer items-center gap-sm rounded-tile p-xs">
          <input type="checkbox" checked={w.on} onChange={(e) => settle.mutate({ on: e.target.checked })} disabled={settle.isPending} className="size-[22px] shrink-0" />
          <span className="min-w-0 text-[14px] font-bold">
            Remind me to drink
            <span className="block text-[12px] font-bold text-ink-soft">
              Every {w.everyMin >= 60 ? `${w.everyMin / 60} h` : `${w.everyMin} min`} from {w.from} to {w.to}, until the goal is met. Notices land in your Inbox.
            </span>
          </span>
        </label>
        <button type="button" aria-expanded={showSet} onClick={() => setShowSet((v) => !v)} className="mt-xs min-h-[36px] text-[12px] font-bold text-ink-soft underline underline-offset-4">
          {showSet ? 'Hide water settings' : 'Water settings'}
        </button>
        {showSet && (
          <div className="mt-xs grid grid-cols-2 gap-xs">
            {([['Daily goal (ml)', 'goalMl', w.goalMl], ['A glass (ml)', 'glassMl', w.glassMl]] as const).map(([label, key, v]) => (
              <label key={key} className="block">
                <span className="block text-[12px] font-bold">{label}</span>
                <input defaultValue={v} inputMode="numeric" onBlur={(e) => Number(e.target.value) !== v && settle.mutate({ [key]: Number(e.target.value) })} className={field} />
              </label>
            ))}
            <label className="block">
              <span className="block text-[12px] font-bold">How often</span>
              <select value={w.everyMin} onChange={(e) => settle.mutate({ everyMin: Number(e.target.value) })} className={field}>
                {WATER_EVERY_CHOICES.map((m) => (
                  <option key={m} value={m}>
                    {m >= 60 ? `${m / 60} ${m === 60 ? 'hour' : 'hours'}` : `${m} min`}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-xs">
              <label className="block">
                <span className="block text-[12px] font-bold">From</span>
                <input type="time" defaultValue={w.from} onBlur={(e) => e.target.value && e.target.value !== w.from && settle.mutate({ from: e.target.value })} className={field} />
              </label>
              <label className="block">
                <span className="block text-[12px] font-bold">To</span>
                <input type="time" defaultValue={w.to} onBlur={(e) => e.target.value && e.target.value !== w.to && settle.mutate({ to: e.target.value })} className={field} />
              </label>
            </div>
          </div>
        )}
      </section>

      <section aria-label="Your reminders" className={cell}>
        <h3 className="m-0 text-[16px] font-extrabold">Your reminders</h3>
        {custom.length === 0 && !adding && <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Add your own: stretch, take medicine, call someone. Each one lands in your Inbox at its time.</p>}
        <ul className="mt-xs flex list-none flex-col gap-xs p-0 m-0">
          {custom.map((r) => (
            <li key={r.id} className="flex items-center gap-xs rounded-inner-sm bg-paper p-xs">
              <label className="toy toy-flat flex min-h-[44px] min-w-0 flex-1 cursor-pointer items-center gap-sm rounded-tile px-xs">
                <input type="checkbox" checked={r.enabled} onChange={(e) => change.mutate({ id: r.id, r: { enabled: e.target.checked } })} className="size-[22px] shrink-0" />
                <span className="min-w-0">
                  <span className={`block truncate text-[14px] font-bold ${r.enabled ? '' : 'text-ink-soft line-through'}`}>{r.title}</span>
                  <span className="block text-[12px] font-bold text-ink-soft">
                    {r.time} · {weekdaysLabel(r.days)}
                  </span>
                </span>
              </label>
              <Button variant="ghost" size="sm" onClick={() => remove.mutate(r.id)} disabled={remove.isPending} aria-label={`Remove ${r.title}`}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
        {adding ? (
          <form
            className="mt-xs flex flex-col gap-xs rounded-inner bg-paper p-sm"
            onSubmit={(e) => {
              e.preventDefault();
              if (title.trim()) add.mutate();
            }}
          >
            <label className="block">
              <span className="block text-[12px] font-bold">Remind me to</span>
              <input value={title} maxLength={REMINDER_TITLE_MAX} onChange={(e) => setTitle(e.target.value)} placeholder="Stretch for five minutes" className={field} />
            </label>
            <label className="block">
              <span className="block text-[12px] font-bold">At</span>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={field} />
            </label>
            <div role="group" aria-label="Days" className="flex flex-wrap gap-xs">
              {WEEKDAY_NAMES.map((n, i) => {
                const d = i + 1;
                const on = days.includes(d);
                return (
                  <button key={n} type="button" aria-pressed={on} onClick={() => setDays((x) => (on ? x.filter((y) => y !== d) : [...x, d].sort()))} className={`min-h-[40px] rounded-pill border-2 px-sm text-[12px] font-bold ${on ? 'border-ink bg-ink text-on-ink' : 'border-line bg-card'}`}>
                    {n}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-xs">
              <Button size="sm" type="submit" disabled={add.isPending || !title.trim() || days.length === 0}>
                Save reminder
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <Button size="sm" variant="outline" className="mt-xs" onClick={() => setAdding(true)} disabled={custom.length >= MAX_CUSTOM_REMINDERS}>
            Add a reminder
          </Button>
        )}
      </section>
      {failed && <p role="alert" className={`m-0 text-[14px] font-bold ${bento ? 'md:col-span-2' : ''}`}>{msg(failed)}</p>}
    </div>
  );
}

/**
 * On a phone: a section inside Daily and Journal, never a floating button. Water comes first, so its tap sits in
 * the collapsed row; the rest opens under it.
 */
export function RemindersSection({ always = false }: { always?: boolean }) {
  const { q, day, refresh } = useReminders();
  const [open, setOpen] = useState(false);
  const w = q.data?.water;
  const drink = useMutation({ mutationFn: () => api.drinkWater(day), onSuccess: refresh });
  const undo = useMutation({ mutationFn: () => api.undoWater(day), onSuccess: refresh });
  const pct = w ? Math.min(1, w.ml / w.goalMl) : 0;
  return (
    <section className={`span-all mt-md w-full rounded-card bg-card p-md shadow-toy-soft ${always ? '' : 'md:hidden'}`} aria-label="Water and reminders">
      {/* One wide cell: what it is and where today stands on the left, the tap on the right. On a phone the tap drops under it, full width. */}
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <button type="button" aria-expanded={open} aria-controls="reminders-body" onClick={() => setOpen((v) => !v)} className="toy toy-flat flex min-h-[44px] min-w-0 flex-1 items-center gap-sm rounded-inner-sm px-xs py-xs text-left">
          <span className="flex size-[44px] shrink-0 items-center justify-center rounded-inner-sm bg-r4/20 text-r4">
            <Drop size={24} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[16px] font-extrabold">Water and reminders</span>
            <span className="block text-[14px] font-bold text-ink-soft">{w ? `${w.glasses} of ${w.goalGlasses} glasses today · ${litres(w.ml)} of ${litres(w.goalMl)}` : 'Loading'}</span>
          </span>
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${open ? 'rotate-180' : ''}`}>
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        <div className="flex gap-xs sm:shrink-0">
          <Button size="md" className="flex-1 sm:flex-none" onClick={() => drink.mutate()} disabled={drink.isPending || !w} aria-label="Add a glass of water">
            + Glass
          </Button>
          <Button size="md" variant="outline" onClick={() => undo.mutate()} disabled={undo.isPending || !w || w.ml === 0}>
            Undo
          </Button>
        </div>
      </div>
      <div className="mt-sm h-[12px] rounded-pill bg-line" role="progressbar" aria-valuemin={0} aria-valuemax={w?.goalMl ?? 1} aria-valuenow={w?.ml ?? 0} aria-label="Water today">
        <div className="h-full rounded-pill bg-r4" style={{ width: `${pct * 100}%`, transition: 'width 240ms ease' }} />
      </div>
      {open && (
        <div id="reminders-body" className="mt-sm">
          <RemindersPanel bento />
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
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  useEffect(() => setOpen(false), [loc.pathname]);
  if (!here) return null;
  const w = q.data?.water;
  return (
    <div className="fixed bottom-md left-[calc(240px+var(--spacing-md))] z-40 hidden md:block">
      {open && (
        <div className="mb-sm max-h-[70vh] w-[340px] overflow-y-auto rounded-card border border-line bg-card p-md shadow-toy-soft" role="dialog" aria-label="Water and reminders">
          <div className="mb-sm flex items-center justify-between">
            <h2 className="m-0 text-[18px]">Water and reminders</h2>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)} aria-label="Close water and reminders">
              Close
            </Button>
          </div>
          <RemindersPanel />
        </div>
      )}
      <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} aria-label={w ? `Water and reminders, ${w.glasses} of ${w.goalGlasses} glasses` : 'Water and reminders'} className="toy toy-soft flex min-h-[48px] items-center gap-xs rounded-pill border-2 border-line bg-card-strong px-md text-[16px] font-extrabold">
        <span className="text-r4"><Drop size={22} /></span>
        Water {w ? `${w.glasses}/${w.goalGlasses}` : ''}
      </button>
    </div>
  );
}
