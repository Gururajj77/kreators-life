import { minutesLabel, stepsMinutes, type BlockKey, type DayType, type SessionResponse } from '@kreators/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { api } from '../lib/api';
import { useAuthed } from '../lib/queries';
import { chip } from './Chat';
import { CheckRow } from './CheckRow';
import { Icon } from './Icon';
import { Skeleton } from './Skeleton';
import { StatusTag } from './StatusTag';
import { StickyClose, useTallOpen } from './StickyClose';
import { ToggleChevron } from './ToggleMark';
import { Sunrise } from 'lucide-react';
import { clockOf } from '../lib/date';

/** Before noon an open morning is still the thing to do; after it the card speaks of the block you are in. */
const NOON = 12 * 60;
const minutesOf = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};
/** Whether a block holds this minute of the day; lights out runs past midnight. */
const holds = (b: { start: string; end: string }, now: number) => {
  const s = minutesOf(b.start);
  const e = minutesOf(b.end);
  return s <= e ? now >= s && now < e : now >= s || now < e;
};
/** The minute of the day on the device, moved on once a minute, so the card's Next or Now line keeps up while Daily stays open. */
function useMinuteOfDay(): number {
  const read = () => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  };
  const [now, setNow] = useState(read);
  useEffect(() => {
    const t = window.setInterval(() => setNow(read()), 60_000);
    return () => window.clearInterval(t);
  }, []);
  return now;
}
/** The card's own look (2026-11-17, the founder: "the your routine needs to be highlighted in daily"): a sunrise in the family pillar's soft colour. */
const SUN = { background: 'var(--soft-parent_child)', color: 'var(--deep-parent_child)' };
const OUTLINE_LINK = 'toy toy-ink btn-outline inline-flex min-h-[40px] md:min-h-[48px] tap-pad items-center justify-center gap-xs rounded-pill border border-ink/30 bg-card-strong px-md text-headline text-ink';


/**
 * The routine from the strategy session, on Daily: the morning steps as tick rows (the day is done only when every one
 * is ticked), the day's other blocks as tick rows too (2026-11-13, the founder: a tick for each, paying nothing and never
 * moving the day's done), and the week's dots. Without a session, one quiet row.
 * It is one closed fold, "Your routine" with today's morning count beside it (2026-11-14, the founder: "put routine tasks in a toggle on
 * daily and keep it in non open state"), so Daily opens short; `/today#routine` (Emerging's card, Life's and Reviews' Routine tiles, the
 * brief's routine line) lands on it and opens it. Without a session it is the same closed row, "Not set up yet", holding the way to the
 * session, so the row is one height in every state and the loading row below never makes the page jump.
 * Since 2026-11-17 (the founder: "the your routine needs to be highlighted in daily", picking three of the suggestions and the set-up card)
 * it is a card of its own, still closed by default: a sunrise, the title and a state tag (Morning open before noon, Done today once every
 * morning step is ticked, else the count), one line saying what is next (before noon the next morning step; later the block the day is in,
 * or the next one), a bar of the morning's steps, and the week's dots with the deal. The whole card is the toggle, so a tap opens the steps
 * and the blocks under it as before. With no session the card says so and carries Run the strategy session itself, with nothing to open.
 */
export function RoutineSection({ date }: { date: string }) {
  const qc = useQueryClient();
  const key = ['session', date];
  const q = useAuthed(key, () => api.session(date));
  // A tick shows at once and every row stays tappable while it saves (2026-11-12: one shared busy flag locked all the rows, and a tick
  // sent before the last save came back carried the old set and undid it). Each save sends the whole set as it stands, the saves go out
  // one after another so the server ends on the last one, and only the answer to the newest save is written back.
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const latest = useRef(0);
  // The card is the toggle (closed by default, 2026-11-14), with what a Fold does: `/today#routine` lands on it and opens it, its close
  // stays in view while the open routine is taller than the window, and focus goes back to the card when it closes from inside.
  const [open, setOwnOpen] = useState(false);
  const setOpen = (f: (o: boolean) => boolean) => setOwnOpen(f);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const railOn = useTallOpen(root, open);
  const now = useMinuteOfDay();
  const focusInside = useRef(false);
  const wasOpen = useRef(open);
  useLayoutEffect(() => {
    const closed = wasOpen.current && !open;
    wasOpen.current = open;
    if (!closed || !focusInside.current) return;
    const el = document.activeElement;
    if (!el || el === document.body) button.current?.focus();
  }, [open]);
  const mark = useMutation({
    mutationFn: (body: { dayType: DayType; steps: string[]; blocks: BlockKey[]; n: number }) => {
      const send = chain.current.catch(() => undefined).then(() => api.markRoutineDay({ date, dayType: body.dayType, steps: body.steps, blocks: body.blocks }));
      chain.current = send;
      return send;
    },
    onMutate: async (body) => {
      await qc.cancelQueries({ queryKey: key });
      const before = qc.getQueryData<SessionResponse>(key);
      if (before?.routine) {
        const morning = (body.dayType === 'general' ? before.routine.general : before.routine.exceptional).find((b) => b.key === 'morning')?.steps ?? [];
        const done = morning.length > 0 && morning.every((s) => body.steps.includes(s));
        qc.setQueryData<SessionResponse>(key, { ...before, today: { day: date, dayType: body.dayType, steps: body.steps, blocks: body.blocks, done } });
      }
      return { before };
    },
    onSuccess: (res, body) => {
      if (body.n === latest.current) qc.setQueryData(key, res);
    },
    onError: (_e, body, ctx) => {
      if (body.n === latest.current) {
        if (ctx?.before) qc.setQueryData(key, ctx.before);
        void qc.invalidateQueries({ queryKey: ['session'] });
      }
    },
    onSettled: (_r, _e, body) => {
      // Other screens that read the session (the life map, Pillars) catch up once the last save is in.
      if (body.n === latest.current) void qc.invalidateQueries({ queryKey: ['session'], predicate: (x) => x.queryKey[1] !== date });
    },
  });
  const save = (dayType: DayType, steps: string[], blocks: BlockKey[]) => mark.mutate({ dayType, steps, blocks, n: ++latest.current });
  const d = q.data;
  // While /session loads, a row of the closed fold's size keeps the place (every state is that row), so the small act below does not move.
  if (q.isPending) {
    return (
      <div className="mt-lg" aria-hidden="true">
        <Skeleton className="h-[156px] w-full rounded-tile" />
      </div>
    );
  }
  if (!d) return null;
  if (!d.routine) {
    return (
      <section id="routine" className="mt-lg" aria-labelledby="routine-title">
        <div className="rounded-tile bg-card p-sm shadow-toy-soft">
          <div className="flex items-center gap-sm">
            <span className="flex size-[40px] shrink-0 items-center justify-center rounded-pill" style={SUN} aria-hidden="true">
              <Icon icon={Sunrise} size={20} />
            </span>
            <h2 id="routine-title" className="m-0 min-w-0 flex-1 text-card-title">
              Your routine
            </h2>
            <StatusTag tone="neutral">Not set up yet</StatusTag>
          </div>
          <p className="mt-xs m-0 text-card-note text-ink-soft">The strategy session builds it from your real day, in a few minutes, with your map and a contract.</p>
          <Link to="/session" className={`mt-sm w-full ${OUTLINE_LINK}`}>
            Run the strategy session
          </Link>
        </div>
      </section>
    );
  }
  const dayType: DayType = d.today?.dayType ?? 'general';
  const blocks = dayType === 'general' ? d.routine.general : d.routine.exceptional;
  const morning = blocks.find((b) => b.key === 'morning');
  const ticked = new Set(d.today?.steps ?? []);
  const blocksDone = new Set(d.today?.blocks ?? []);
  const toggle = (step: string) => {
    const next = new Set(ticked);
    if (next.has(step)) next.delete(step);
    else next.add(step);
    save(dayType, [...next], [...blocksDone]);
  };
  const toggleBlock = (key: BlockKey) => {
    const next = new Set(blocksDone);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    save(dayType, [...ticked], [...next]);
  };
  const labels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const steps = morning?.steps ?? [];
  const stepsDone = steps.filter((s) => ticked.has(s)).length;
  const done = Boolean(d.today?.done);
  const nextStep = steps.find((s) => !ticked.has(s));
  const current = blocks.find((b) => holds(b, now));
  const upcoming = blocks.filter((b) => minutesOf(b.start) > now).sort((a, b) => minutesOf(a.start) - minutesOf(b.start))[0];
  const nextLine =
    nextStep && (now < NOON || current?.key === 'morning')
      ? `Next: ${nextStep}`
      : current
        ? `Now: ${current.name}, ${clockOf(current.start)} to ${clockOf(current.end)}`
        : upcoming
          ? `Next: ${upcoming.name} at ${clockOf(upcoming.start)}`
          : nextStep
            ? `Next: ${nextStep}`
            : 'All done for today.';
  const tag = done ? <StatusTag tone="good">Done today</StatusTag> : now < NOON ? <StatusTag tone="warm">Morning open</StatusTag> : <StatusTag tone="neutral">{`${stepsDone} of ${steps.length}`}</StatusTag>;
  const weekLine = `${d.week.done} of 7 this week${d.contract ? `, ${d.contract.minDays} is the deal` : ''}`;
  return (
    <section className="mt-lg" aria-label="Your routine">
      <div
        ref={root}
        id="routine"
        data-sticky-close-root=""
        onFocus={() => {
          focusInside.current = true;
        }}
        onBlur={(e) => {
          const to = e.relatedTarget as Node | null;
          if (to && !e.currentTarget.contains(to)) focusInside.current = false;
        }}
      >
        <button
          ref={button}
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          data-land-open=""
          onClick={() => setOpen((o) => !o)}
          className="toy toy-soft block w-full rounded-tile bg-card p-sm text-left shadow-toy-soft aria-expanded:bg-line"
        >
          <span className="flex items-center gap-sm">
            <span className="flex size-[40px] shrink-0 items-center justify-center rounded-pill" style={SUN} aria-hidden="true">
              <Icon icon={Sunrise} size={20} />
            </span>
            <span className="min-w-0 flex-1 text-card-title">
              Your routine
            </span>
            {tag}
            <ToggleChevron open={open} size={16} className="text-ink-soft sticky-close-mark" />
          </span>
          <span className="mt-xs block text-card-note text-ink-soft">{nextLine}</span>
          {steps.length > 0 && (
            <>
              <span className="mt-sm flex gap-xs" aria-hidden="true">
                {steps.map((step) => (
                  <span key={step} className={`h-[8px] flex-1 rounded-pill ${ticked.has(step) ? 'bg-r4' : 'bg-line'}`} />
                ))}
              </span>
              <span className="sr-only">{`${stepsDone} of ${steps.length} morning steps ticked.`}</span>
            </>
          )}
          <span className="mt-sm flex flex-col gap-xs md:flex-row md:items-center md:justify-between">
            <span className="block text-caption text-ink-soft">{weekLine}</span>
            <span className="flex gap-xs" aria-hidden="true">
              {d.week.days.map((v, i) => (
                <span key={i} className={`flex size-[28px] items-center justify-center rounded-pill text-caption2 font-semibold ${v === true ? 'bg-r4 text-on-fill' : v === false ? 'bg-line text-ink-soft' : 'bg-paper text-ink-mute'}`}>
                  {labels[(new Date(`${date}T00:00:00`).getDay() + 6 + i - 6 + 7) % 7]}
                </span>
              ))}
            </span>
          </span>
        </button>
        {railOn && <StickyClose onClose={() => setOpen(() => false)} label="Close Your routine" title="Your routine" opener={() => button.current} />}
        {open && (
        <div id={panelId} className="mt-xs">
        <div className="pt-sm">
          {d.routine.practices.affirmation && <p className="mt-sm m-0 rounded-tile bg-paper p-sm text-subhead font-semibold">“{d.routine.practices.affirmation}”</p>}
          <div className="mt-sm flex gap-xs">
            {(['general', 'exceptional'] as const).map((t) => (
              <button key={t} type="button" className={chip(dayType === t)} onClick={() => save(t, [...ticked], [...blocksDone])} aria-pressed={dayType === t}>
                {t === 'general' ? 'Normal day' : 'Exceptional day'}
              </button>
            ))}
          </div>
          {morning && (
            <div className="mt-sm flex flex-col gap-xs">
              <p className="m-0 text-subhead font-semibold">
                Morning routine, {clockOf(morning.start)} to {clockOf(morning.end)}
                {stepsMinutes(morning) > 0 ? `, ${minutesLabel(stepsMinutes(morning))} of steps` : ''}
                {d.today?.done ? '. Done.' : ''}
              </p>
              {morning.steps.map((step, i) => (
                <CheckRow key={step} checked={ticked.has(step)} onToggle={() => toggle(step)} title={step} subtitle={morning.minutes?.[i] ? minutesLabel(morning.minutes[i]!) : undefined} />
              ))}
            </div>
          )}
          <p id="routine-rest" className="mt-sm m-0 text-subhead font-semibold">
            The rest of your day
          </p>
          <ol className="mt-xs flex list-none flex-col gap-xs p-0 m-0" aria-labelledby="routine-rest">
            {blocks
              .filter((b) => b.key !== 'morning')
              .map((b) => (
                <li key={b.key}>
                  <CheckRow
                    checked={blocksDone.has(b.key)}
                    onToggle={() => toggleBlock(b.key)}
                    title={b.name}
                    subtitle={
                      <>
                        <span className="whitespace-nowrap">
                          {clockOf(b.start)} to {clockOf(b.end)}
                        </span>
                        {b.note ? `. ${b.note}` : ''}
                      </>
                    }
                  />
                </li>
              ))}
          </ol>
        </div>
        </div>
        )}
      </div>
    </section>
  );
}
