import gsap from 'gsap';
import { CloseButton } from './CloseButton';
import { MAX_CUSTOM_REMINDERS, REMINDER_TIME, REMINDER_TITLE_MAX, WATER_GLASS_MAX, WATER_GLASS_MIN, WATER_GOAL_MAX, WATER_GOAL_MIN, WEEKDAY_NAMES, weekdaysLabel, type CustomReminder } from '@kreators/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Suspense, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { lazyNamed } from '../lib/lazy';
import { useLocation } from 'react-router';
import { api } from '../lib/api';
import { dayLabel, todayLocal, weekday } from '../lib/date';
import { useSession } from '../lib/store';
import { useDialogFocus } from '../lib/useDialogFocus';
import { Button } from './Button';
import { WaterFill } from './fx/WaterFill';
import { WaterGlass } from './fx/WaterGlass';
import { prefersReducedMotion } from './fx/env';
import { Sheet } from './Sheet';
import { Icon } from './Icon';
import { Check, ChevronLeft, ChevronRight, Droplet, Undo2, X } from 'lucide-react';
import { FIELD } from '../lib/ui';
import { Toggle } from './Toggle';
import { ToggleChevron } from './ToggleMark';
import { ChipSelect } from './ChipSelect';
import { AnimatedIcon } from './AnimatedIcon';
import { useWide } from '../lib/useWide';

export const msg = (e: unknown) => (e instanceof Error ? e.message : 'That did not work. Try again.');
// 2 L, 2.25 L, 10 L: trailing zeros go only after a decimal point (the old one turned 10,000 ml into 1 L).
export const litres = (ml: number) => (ml >= 1000 ? `${Number((ml / 1000).toFixed(2))} L` : `${ml} ml`);

/** "Tue 3 Nov" for a day typed as YYYY-MM-DD. */
export const shortDay = dayLabel;

function useReminders() {
  const token = useSession((s) => s.token);
  const qc = useQueryClient();
  const day = todayLocal();
  const q = useQuery({ queryKey: ['reminders', day], queryFn: () => api.reminders(day), enabled: Boolean(token) });
  const refresh = () => void qc.invalidateQueries({ queryKey: ['reminders'] });
  return { q, day, refresh };
}

/** Whether a task tagged Remember has no day yet: Water and reminders then links to Daily's To remember (`#remember-heading`), so
 * Daily keeps that heading even while its Area filter hides every one of them. Shares the section's own query. */
export function useUndatedRemember(): boolean {
  const { q } = useReminders();
  return (q.data?.tasks ?? []).some((t) => !t.day);
}

function Drop({ size = 20 }: { size?: number }) {
  return (
    <Icon icon={Droplet} size={size} filled />
  );
}

/** A picker's choices, with the value now in effect always among them (a goal typed as 2,150 ml stays pickable). */
export const withNow = (list: number[], now: number, label: (n: number) => string) => [...new Set([...list, now])].sort((a, b) => a - b).map((value) => ({ value, label: label(value) }));
export const GOALS = Array.from({ length: (WATER_GOAL_MAX - WATER_GOAL_MIN) / 250 + 1 }, (_, i) => WATER_GOAL_MIN + i * 250);
export const GLASSES = [100, 150, 200, 250, 300, 350, 400, 500, 750, 1000].filter((n) => n >= WATER_GLASS_MIN && n <= WATER_GLASS_MAX);

/** Every write the water block makes, in one place, so the panel and its two sheets share them. */
export function useWaterActions() {
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
const weekdayOf = (day: string) => weekday(day).slice(0, 2);

/**
 * Today's water in the look of Breathe and focus (2026-11-06, the founder: "make it better like the one used in mindfulness", then "put
 * the glass on left and last seven days on right, below the glass add button for another amount"): one dark panel with the glass that
 * fills on the left, today's count under it and an amount picker under that (the arrows step through the amounts, the middle button
 * adds the one shown, starting at the person's glass; Undo beside it), and the last seven days on the right as bars with their days.
 * Where the panel is narrow (the laptop's bubble) the picker takes the row under both. `summary={false}` (inside the section, whose row
 * already shows the count, a glass and Undo) leaves the count and Undo out. The panel pins the dark theme's colours on itself
 * (`.water-night`), so it reads the same in both themes.
 */
function WaterPanel({ summary = true, undoHere = true }: { summary?: boolean; /** Undo beside the amount picker (a laptop's Home); on a phone and in the bubble it is in the icon row instead. */ undoHere?: boolean }) {
  const { q, drink, undo } = useWaterActions();
  const w = q.data?.water;
  const [picked, setPicked] = useState<number | null>(null);
  const failed = drink.error ?? undo.error;
  if (!w) return null;
  const amounts = amountsFor(w.glassMl);
  const amount = picked !== null && amounts.includes(picked) ? picked : w.glassMl;
  const at = amounts.indexOf(amount);
  const met = w.week.filter((d) => d.ml >= w.goalMl).length;
  const average = Math.round(w.week.reduce((n, d) => n + d.ml, 0) / Math.max(1, w.week.length));
  // Above each day, what was drunk in short: 750, 1.5L.
  const short = (ml: number) => (ml < 1000 ? String(ml) : `${Number((ml / 1000).toFixed(1))}L`);
  return (
    <>
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
        <div className="water-grid-step flex flex-wrap items-center justify-center gap-xs" role="group" aria-label="Add water">
          <button type="button" className="mf-mini toy flex w-[44px] items-center justify-center px-0" onClick={() => setPicked(amounts[Math.max(0, at - 1)]!)} disabled={at <= 0} aria-label="A smaller amount">
            <Icon icon={ChevronLeft} size={18} />
          </button>
          {/* The bubble opens with focus here (data-autofocus), on the one main action, so Enter adds the amount shown. */}
          {/* The water green everywhere, in the section on Home, Daily and Journal too (the founder, 2026-11-06). */}
          <button type="button" data-autofocus="" className="mf-start toy min-w-[112px]" onClick={() => drink.mutate(amount === w.glassMl ? undefined : amount)} disabled={drink.isPending}>
            +{amount} ml
          </button>
          <button type="button" className="mf-mini toy flex w-[44px] items-center justify-center px-0" onClick={() => setPicked(amounts[Math.min(amounts.length - 1, at + 1)]!)} disabled={at >= amounts.length - 1} aria-label="A larger amount">
            <Icon icon={ChevronRight} size={18} />
          </button>
          {summary && undoHere && (
            <button type="button" className="mf-mini toy ml-xs" onClick={() => undo.mutate()} disabled={undo.isPending || w.ml === 0}>
              Undo
            </button>
          )}
        </div>

        {/* The last seven days (the founder, 2026-11-06: "use better indicators"): each day a small glass filled against the goal, what
            was drunk above it, a tick when the goal was met, today ringed; and how many days met it, and the average. */}
        <div className="water-grid-week min-w-0">
          <p className="mf-line m-0">Last seven days</p>
          <ol className="water-days" aria-label={`Water, last seven days: ${w.week.map((d) => `${weekdayOf(d.day)} ${litres(d.ml)}${d.ml >= w.goalMl ? ', goal met' : ''}`).join('; ')}`}>
            {w.week.map((d) => {
              const full = d.ml >= w.goalMl;
              return (
                <li key={d.day} aria-hidden="true" data-today={d.day === w.day ? '' : undefined} data-met={full ? '' : undefined}>
                  <span className="water-day-amount">{d.ml > 0 ? short(d.ml) : '0'}</span>
                  <span className="water-day">
                    <span className="water-day-fill" style={{ transform: `scaleY(${Math.min(1, d.ml / Math.max(1, w.goalMl))})` }} />
                    {full && <Icon icon={Check} size={14} strokeWidth={3} className="water-day-tick" />}
                  </span>
                  <span className="water-day-name">{weekdayOf(d.day)}</span>
                </li>
              );
            })}
          </ol>
          <p className="mf-line">
            <span className="inline-block">Goal met on {met} of 7 days,</span> <span className="inline-block">about {litres(average)} a day.</span>
          </p>
        </div>
      </div>
      {failed && <p role="alert" className="mf-line">{msg(failed)}</p>}
    </>
  );
}

const WaterSettings = lazyNamed(() => import('./ReminderPanels'), 'WaterSettings');
const YourReminders = lazyNamed(() => import('./ReminderPanels'), 'YourReminders');

const WATER_PANES = [
  { key: 'today', name: 'Water' },
  { key: 'reminders', name: 'Reminders' },
  { key: 'settings', name: 'Settings' },
] as const;

/**
 * The water block (2026-11-06, the founder: "put the buttons inside the card on full width, on mobile and all screens just use the
 * buttons as a way to go left, swipe cards with that data, as it's already a container box, instead of opening a popup"): one dark card
 * whose three round icon buttons (Water, Reminders, Settings, centred) switch the card between its panels in place, and a sideways swipe
 * on a touch screen does the same. Nothing opens over the page. Only the open panel is shown, so the card is its height and nothing is
 * ever clipped; it eases in from the side it came from (GSAP, set under reduced motion). The heading sits above the card, and in a popup (the laptop's bubble, the card table's sheet) Close and the round buttons sit in its rail outside the panel (`railIn`); `heading={false}` leaves the heading out (inside the
 * section, whose row already says it). The card pins the dark theme's colours on itself (`.water-night`).
 */
export function WaterBlock({ tasks = true, summary = true, heading = true, onClose, railIn, className = '' }: { tasks?: boolean; summary?: boolean; heading?: boolean; onClose?: () => void; /** In a popup: the rail its Close and the card's round buttons go to, outside the panel (null until the rail is in the page). */ railIn?: HTMLElement | null; className?: string }) {
  const { q, undo } = useWaterActions();
  const w = q.data?.water;
  const id = useId();
  // A note about your own reminders opens Home on `#reminders` (lib/useLandOnHash.ts opens the section), so the card starts on that panel.
  const [pane, setPane] = useState(() => (typeof window !== 'undefined' && window.location.hash === '#reminders' ? WATER_PANES.findIndex((p) => p.key === 'reminders') : 0));
  // On a phone and in the laptop's bubble (it has Close), Undo is the fourth icon in the row (the founder, 2026-11-06); on a laptop's
  // Home it stays beside the amount picker and the section's row.
  const wideScreen = useWide();
  const undoInRow = Boolean(onClose) || !wideScreen;
  // Which way the last move went (1 to the next panel, -1 back), so the panel arriving eases in from that side.
  const dir = useRef(1);
  const panes = useRef<(HTMLDivElement | null)[]>([]);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const first = useRef(true);

  // Only the open panel is in the page (the others are hidden, keeping what was typed in them); it eases in from the side it came
  // from, by transform and opacity, and is placed at once under reduced motion or on the first paint.
  useLayoutEffect(() => {
    const el = panes.current[pane];
    if (!el) return;
    if (first.current || prefersReducedMotion()) {
      first.current = false;
      gsap.set(el, { x: 0, opacity: 1 });
      return;
    }
    gsap.fromTo(el, { x: 24 * dir.current, opacity: 0 }, { x: 0, opacity: 1, duration: 0.35, ease: 'power3.out' });
    return () => {
      gsap.killTweensOf(el);
    };
  }, [pane, Boolean(w)]);

  const go = (i: number) => {
    const next = Math.max(0, Math.min(WATER_PANES.length - 1, i));
    if (next === pane) return;
    dir.current = next > pane ? 1 : -1;
    // In a popup the panel never shrinks as its panes change, so the rail beside it (where this tap landed) stays under the pointer (the founder, 2026-11-07: "they stay sticky").
    const popup = railIn ? panes.current[pane]?.closest<HTMLElement>('.dialog-panel') : null;
    if (popup) popup.style.minHeight = `min(${popup.offsetHeight}px, 90dvh)`;
    setPane(next);
  };
  const leave = () => go(0);

  const railed = railIn !== undefined;
  // Close says what it does by sliding its word out on hover or keyboard focus (the ExpandButton look, slowed like the card's icons). In a popup's
  // rail the words stay folded and its name is the smart tip, outside the panel (2026-11-12).
  const close = onClose && (
    <button type="button" onClick={onClose} aria-label="Close water and reminders" data-tip="Close" className="water-close expand-btn toy toy-soft ml-auto inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-pill border-2 border-line bg-card px-xs text-subhead font-medium text-ink">
      <Icon icon={X} size={20} />
      <span className="expand-btn-words" aria-hidden="true">
        Close
      </span>
    </button>
  );
  // The three buttons at the top right of the card, centred in the bubble (it has Close) and on a phone: each opens its panel in place.
  const tabs = w && (
    <div className="water-tabs" data-center={onClose ? '' : undefined}>
      <div role="tablist" aria-label="Water" className="contents">
        {WATER_PANES.map((p, i) => (
          // Icons only; the name slides out on hover or keyboard focus (the ExpandButton look), and is the tab's name for screen readers. In a
          // popup's rail it does not slide out over the panel: the smart tip names it, outside the panel.
          <button key={p.key} type="button" role="tab" id={`${id}-t${i}`} aria-selected={pane === i} aria-controls={`${id}-p${i}`} aria-label={p.name} data-tip={p.name} onClick={() => go(i)} className="water-tab expand-btn toy">
            {p.key === 'today' ? <Drop size={20} /> : <AnimatedIcon name={p.key === 'settings' ? 'settings' : 'calendar'} size={20} />}
            <span className="expand-btn-words" aria-hidden="true">
              {p.name}
            </span>
          </button>
        ))}
      </div>
      {undoInRow && (
        // Not a tab: it takes back the last glass, in the same look, its word sliding out on hover or keyboard focus.
        <button type="button" aria-label="Undo the last glass" data-tip="Undo the last glass" onClick={() => undo.mutate()} disabled={undo.isPending || w.ml === 0} className="water-tab expand-btn toy disabled:opacity-50">
          <Icon icon={Undo2} size={20} />
          <span className="expand-btn-words" aria-hidden="true">
            Undo
          </span>
        </button>
      )}
    </div>
  );
  return (
    <section className={className} aria-labelledby={heading ? `${id}-h` : undefined} aria-label={heading ? undefined : 'Water and reminders'} data-pillar="lover_partner">
      {railIn &&
        createPortal(
          <>
            {close}
            {tabs}
          </>,
          railIn,
        )}
      {(heading || (onClose && !railed)) && (
        <div className="mb-sm flex items-start justify-between gap-sm">
          {heading && (
            <div className="min-w-0">
              <h2 id={`${id}-h`} className="text-title2">
                Water
              </h2>
              <p className="mt-xs m-0 text-subhead text-ink-soft">{w ? `${w.glasses} of ${w.goalGlasses} glasses today, ${litres(w.ml)} of ${litres(w.goalMl)}.` : 'Loading'}</p>
            </div>
          )}
          {!railed && close}
        </div>
      )}
      <div className="night-card mf-panel water-night rounded-card" data-accent="r4">
        {!w ? (
          <p className="mf-line m-0" role="status">{q.isError ? 'Could not load.' : 'Loading'}</p>
        ) : (
          <>
            {!railed && tabs}
            <div
              className={railed ? undefined : 'mt-md'}
              // A sideways swipe on a touch screen moves one panel (touch events: a pointer can be cancelled when the browser takes the gesture).
              onTouchStart={(e) => {
                // A sheet opened from a row is portalled to the body, but React still bubbles its touches here: only a touch that began
                // inside the card itself may swipe, so a swipe in the confirm sheet never switches the panel behind it.
                if (!(e.currentTarget as Node).contains(e.target as Node)) {
                  swipe.current = null;
                  return;
                }
                const t = e.touches[0];
                swipe.current = t && e.touches.length === 1 ? { x: t.clientX, y: t.clientY } : null;
              }}
              onTouchEnd={(e) => {
                if (!(e.currentTarget as Node).contains(e.target as Node)) {
                  swipe.current = null;
                  return;
                }
                const s0 = swipe.current;
                const t = e.changedTouches[0];
                swipe.current = null;
                if (!s0 || !t) return;
                const dx = t.clientX - s0.x;
                if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(t.clientY - s0.y) * 1.5) go(pane + (dx < 0 ? 1 : -1));
              }}
              onTouchCancel={() => {
                swipe.current = null;
              }}
            >
              {WATER_PANES.map((p, i) => (
                <div
                  key={p.key}
                  ref={(el) => {
                    panes.current[i] = el;
                  }}
                  id={`${id}-p${i}`}
                  role="tabpanel"
                  aria-labelledby={`${id}-t${i}`}
                  hidden={pane !== i}
                  className="water-pane"
                >
                  {p.key === 'today' ? <WaterPanel summary={summary} undoHere={!undoInRow} /> : <Suspense fallback={null}>{p.key === 'settings' ? <WaterSettings /> : <YourReminders tasks={tasks} onLeave={leave} />}</Suspense>}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
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
    // `#water` and `#reminders` land here and open it (Emerging's Add a glass, a reminder note; lib/useLandOnHash.ts), on Home at every width.
    <section id="water" data-land="reminders" className={`span-all mt-md w-full rounded-card bg-card p-md shadow-toy-soft ${always ? '' : 'lg:hidden'}`} aria-label="Water and reminders" data-pillar="lover_partner">
      {/* One wide cell: what it is and where today stands on the left, the tap on the right. On a phone the tap drops under it, full width. */}
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <button type="button" aria-expanded={open} aria-controls="reminders-body" data-land-open="" onClick={() => setOpen((v) => !v)} className="toy toy-flat flex min-h-[44px] min-w-0 flex-1 items-center gap-sm rounded-inner-sm px-xs py-xs text-left">
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
          {/* The water green (the founder, 2026-11-06), the same as the card's + glass; Journal keeps the outline, its New entry is the solid button. */}
          <Button size="md" variant={quiet ? 'outline' : 'color'} color={quiet ? undefined : 'linear-gradient(140deg, var(--color-r4), color-mix(in oklab, var(--color-r4) 72%, var(--fill-shade)))'} deep="var(--deep-lover_partner)" className={`flex-1 sm:flex-none ${quiet ? '' : 'text-on-fill'}`} onClick={() => drink.mutate()} disabled={drink.isPending || !w} aria-label="Add a glass of water">
            + Glass
          </Button>
          {/* On a phone Undo is in the open card's icon row instead (the founder, 2026-11-06); from the tablet up it stays here. The wrapper
              carries the display classes, since Tailwind orders inline-flex after hidden. */}
          <span className="hidden md:block">
            <Button size="md" variant="outline" onClick={() => undo.mutate()} disabled={undo.isPending || !w || w.ml === 0}>
              Undo
            </Button>
          </span>
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
 * On a laptop (from `lg`): a small bubble at the left of Daily and Journal that opens into the same panel. There is no floating button
 * on a phone or a tablet; the section above does that job there.
 */
export function ReminderBubble() {
  const loc = useLocation();
  const here = loc.pathname === '/today' || loc.pathname.startsWith('/journal');
  const [open, setOpen] = useState(false);
  const { q } = useReminders();
  // Focus moves into the panel when it opens, Tab wraps at its ends, Escape closes it, and focus goes back to the Water button.
  const panel = useRef<HTMLDivElement>(null);
  useDialogFocus(panel, open && here, { modal: false, onEscape: () => setOpen(false) });
  const [rail, setRail] = useState<HTMLElement | null>(null);
  useEffect(() => setOpen(false), [loc.pathname]);
  if (!here) return null;
  const w = q.data?.water;
  return (
    // Open, the panel rises over the privacy card (z-45), which waits just above the bubble until it is answered: the person asked for
    // water, so the water comes first; closed, the card is on top again. While a modal sheet asks (a reminder's Remove), the bubble drops
    // to the scrim's level: the sheet's portal comes later in the body, so its scrim dims the bubble and takes its clicks.
    <div className={`fixed bottom-md left-[calc(var(--nav-w)+var(--spacing-md))] hidden lg:block ${open ? 'z-[46]' : 'z-40'} [body:has([role=dialog][aria-modal=true])_&]:z-40`} data-pillar="lover_partner">
      {open && (
        // The water block on a strong card: its heading and round buttons on the card, the dark panel under them.
        // Its Close and the card's round buttons sit in the rail on its right, where a laptop always has room, and stay put as the panel scrolls.
        <div ref={panel} className="dialog-frame relative mb-sm w-[380px]" role="dialog" aria-label="Water and reminders">
          <div ref={setRail} className="dialog-rail" />
          <div className="dialog-panel max-h-[80vh] overflow-y-auto rounded-card border border-line bg-card-strong p-md shadow-toy-soft">
            <WaterBlock onClose={() => setOpen(false)} railIn={rail} />
          </div>
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
  const [rail, setRail] = useState<HTMLElement | null>(null);
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
      <Sheet open={open} onClose={() => setOpen(false)} title="Water and reminders" rail={<div ref={setRail} className="contents" data-pillar="lover_partner" />}>
        <WaterBlock heading={false} railIn={rail} />
      </Sheet>
    </>
  );
}
