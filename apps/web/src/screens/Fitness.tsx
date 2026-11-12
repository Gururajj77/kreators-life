import { formatCount } from '@kreators/shared';
import { eatSummary, EFFORT_LEVELS, MOVE_KIND_META, MOVE_KINDS, MOVE_WEEK_TARGET, moveLine, type EatLog, type MoveKind, type MoveLog } from '@kreators/shared/fitness';
import { useMutation } from '@tanstack/react-query';
import { ArrowUpRight } from 'lucide-react';
import { Fragment, useState } from 'react';
import { Link } from 'react-router';
import { AnimatedIcon } from '../components/AnimatedIcon';
import { AppIcon } from '../components/AppIcon';
import { AreaLine, CalendarGrid, Donut, Gauge, Legend, PillBars } from '../components/Charts';
import { ConfirmDelete } from '../components/ConfirmDelete';
import { EatForm } from '../components/EatForm';
import { EmergenceSlot } from '../components/EmergenceSlot';
import { Hero, HeroNumber } from '../components/Hero';
import { Icon } from '../components/Icon';
import { MoveForm, nearDays } from '../components/MoveForm';
import { BackLink } from '../components/PageHeader';
import { Pager, usePage } from '../components/Pager';
import { PeriodPanel } from '../components/PeriodPanel';
import { Screen } from '../components/Screen';
import { Section } from '../components/Section';
import { Segmented } from '../components/fx/Segmented';
import { Sheet } from '../components/Sheet';
import { SkeletonList } from '../components/Skeleton';
import { StatusTag } from '../components/StatusTag';
import { SupplementsSection } from '../components/Supplements';
import { api } from '../lib/api';
import { dayLabel, lastDays, shortDay, todayLocal, weekday } from '../lib/date';
import { focusHeadingAfter } from '../lib/focusHeading';
import { useAuthed, useRefreshAll } from '../lib/queries';

/** Each kind's colour on the donut and the rows, from the pillar tokens. */
const KIND_COLOR: Record<MoveKind, string> = {
  run: 'var(--color-r2)',
  walk: 'var(--color-r4)',
  cycle: 'var(--color-r5)',
  swim: 'var(--color-r6)',
  yoga: 'var(--color-r7)',
  gym: 'var(--color-r1)',
  sport: 'var(--color-r3)',
  other: 'var(--color-ink-mute)',
};
const litres = (ml: number) => `${formatCount(ml)} ml`;

/** A movement row's second line: the day, how hard it felt, the note. */
const moveNote = (m: MoveLog) => [dayLabel(m.date), m.effort ? EFFORT_LEVELS[m.effort - 1] : '', m.note].filter(Boolean).join(' · ');

function KindBadge({ kind }: { kind: MoveKind }) {
  return (
    <span className="flex size-[44px] shrink-0 items-center justify-center rounded-pill" style={{ background: `color-mix(in oklab, ${KIND_COLOR[kind]} 18%, transparent)` }} aria-hidden="true">
      <AppIcon name={MOVE_KIND_META[kind].icon} size={22} />
    </span>
  );
}

/**
 * Fitness: movement and a daily eating check-in, private like every tracker, paying nothing. By the hero rule it opens with a plain
 * header and the pillar-coloured hero holding the last seven days' active minutes, then the two log cards, then the charts.
 */
export function Fitness() {
  const refresh = useRefreshAll();
  const today = todayLocal();
  const { yesterday } = nearDays();
  const q = useAuthed(['fitness', today], () => api.fitness(today));
  const [month, setMonth] = useState(today.slice(0, 7));
  const mq = useAuthed(['fitness', 'month', month], () => api.fitnessMonth(month));
  const pg = usePage('m');
  const list = useAuthed(['fitness', 'moves', pg.query], () => api.fitnessMoves(pg.query));
  const water = useAuthed(['reminders', today], () => api.reminders(today));
  const [eatDay, setEatDay] = useState<'today' | 'yesterday'>('today');
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<MoveLog | null>(null);
  const remove = useMutation({
    mutationFn: (id: string) => api.deleteMove(id),
    onSuccess: () => {
      setToDelete(null);
      // The row and its trash button go, so the keyboard's place moves to the list's heading.
      focusHeadingAfter('moves-heading');
      return refresh();
    },
  });

  const d = q.data;
  const week = d?.weekMinutes ?? 0;
  const eatOn = eatDay === 'today' ? today : yesterday;
  const eatNow = d?.eats.find((e) => e.date === eatOn) ?? null;
  // The last check-in before the day shown, for Same as yesterday (the list is newest first).
  const eatBefore = d?.eats.find((e) => e.date < eatOn) ?? null;
  const days30 = lastDays(30);
  const days7 = days30.slice(-7);
  const minutesOn = new Map<string, number>();
  for (const m of d?.moves ?? []) minutesOn.set(m.date, (minutesOn.get(m.date) ?? 0) + m.minutes);
  const anyMove = (d?.moves.length ?? 0) > 0;
  const eatOnDay = new Map((d?.eats ?? []).flatMap((e) => (e.dayScore === null ? [] : [[e.date, e.dayScore] as const])));
  const since30 = days30[0] ?? today;
  // Protein is its own number (2026-11-07): the chart shows only once some day has any.
  const proteinGoal = d?.proteinGoal ?? null;
  const proteinOn = new Map((d?.eats ?? []).flatMap((e) => (e.proteinG === null ? [] : [[e.date, e.proteinG] as const])));
  const lastScoop = d?.eats.find((e) => e.protein?.scoopG)?.protein?.scoopG ?? null;
  const protein7 = days7.map((x) => proteinOn.get(x) ?? null);
  const anyProtein = protein7.some((v) => v !== null);
  const byKind = MOVE_KINDS.map((k) => ({ kind: k, minutes: (d?.moves ?? []).filter((m) => m.kind === k && m.date >= since30).reduce((a, m) => a + m.minutes, 0) })).filter((x) => x.minutes > 0);
  const w = water.data?.water;

  return (
    <Screen>
      <header className="pt-lg">
        <BackLink to="/apps">Apps</BackLink>
        <h1 className="text-large-title">Fitness</h1>
        <p className="mt-xs m-0 text-subhead text-ink-soft">Movement and eating, in a few taps. Only you see it.</p>
      </header>

      {d && (
        <Hero color="var(--color-r5)" deep="var(--deep-self)" className="mt-md" character="self" characterSize={64} mood={week >= MOVE_WEEK_TARGET ? 'excited' : week >= 60 ? 'happy' : week > 0 ? 'neutral' : 'sleepy'}>
          <p className="m-0 text-eyebrow uppercase opacity-90">Active minutes, last 7 days</p>
          <div className="mt-xs flex flex-col items-start gap-sm sm:flex-row sm:items-center sm:justify-between">
            <HeroNumber value={formatCount(week)} unit="min" label={week === 0 ? 'Nothing logged this week yet' : week >= MOVE_WEEK_TARGET ? 'Full marks for the week' : `${MOVE_WEEK_TARGET - week} more for full marks`} />
            <Gauge value={week / MOVE_WEEK_TARGET} size={112} stroke={14} color="var(--color-on-fill)" track="rgba(255,255,255,0.3)" label={`${week} of ${MOVE_WEEK_TARGET} minutes`}>
              <span className="text-caption font-semibold">of {MOVE_WEEK_TARGET}</span>
            </Gauge>
          </div>
        </Hero>
      )}
      {q.isPending && <SkeletonList className="mt-md" count={1} lines={3} label="Loading your week" />}

      <section data-pillar="self" className="mt-md rounded-card p-md" style={{ background: 'var(--tint-sky)' }} aria-labelledby="move-heading">
        <h2 id="move-heading" className="text-title2">
          Log movement
        </h2>
        <div className="mt-md">
          <MoveForm kinds={MOVE_KINDS} saveLabel="Save movement" onSave={(body) => api.logMove(body)} onDone={() => void refresh()} />
        </div>
      </section>

      <section data-pillar="lover_partner" className="mt-md rounded-card p-md" style={{ background: 'var(--tint-green)' }} aria-labelledby="eat-heading">
        <h2 id="eat-heading" className="text-title2">
          How you ate
        </h2>
        <Segmented className="mt-md" label="Which day" value={eatDay} onChange={setEatDay} options={[{ value: 'today', label: 'Today' }, { value: 'yesterday', label: 'Yesterday' }]} />
        <div className="mt-md">{d ? <EatForm day={eatOn} existing={eatNow} previous={eatBefore} proteinGoal={proteinGoal} lastScoop={lastScoop} onSaved={() => void refresh()} /> : <SkeletonList count={1} lines={3} label="Loading" />}</div>
        <p className="mt-md m-0 flex flex-wrap items-center justify-between gap-xs text-subhead">
          <span className="min-w-0">{w ? `Water today: ${litres(w.ml)} of ${litres(w.goalMl)}.` : 'Water today: loading.'}</span>
          <Link to="/home" className="inline-flex min-h-[44px] items-center gap-xs font-semibold underline-offset-4 hover:underline">
            Water on Home
            <Icon icon={ArrowUpRight} size={16} className="read-arrow" />
          </Link>
        </p>
      </section>

      <SupplementsSection />

      <Section id="week-heading" title="Last 7 days" lede="Active minutes each day, ending today.">
        <div className="rounded-card bg-card p-md shadow-toy-soft">
          <PillBars allLabels values={days7.map((x) => minutesOn.get(x) ?? (anyMove ? 0 : null))} max={Math.max(60, ...days7.map((x) => minutesOn.get(x) ?? 0))} color="var(--color-r5)" labels={days7.map((x) => weekday(x).slice(0, 2))} label="Active minutes by day, last 7 days" />
        </div>
      </Section>

      {anyProtein && (
        <Section id="protein-heading" title="Protein, last 7 days" lede={proteinGoal === null ? 'Grams each day, ending today.' : `Grams each day, ending today. Your goal is ${proteinGoal} g.`}>
          <div className="rounded-card bg-card p-md shadow-toy-soft">
            <PillBars allLabels values={protein7} max={Math.max(proteinGoal ?? 0, ...protein7.map((v) => v ?? 0))} color="var(--color-r4)" labels={days7.map((x) => weekday(x).slice(0, 2))} label={`Protein in grams by day, last 7 days: ${protein7.map((v) => v ?? 'none').join(', ')}`} />
          </div>
        </Section>
      )}

      <Section id="thirty-heading" title="Last 30 days" lede="Active minutes, and how you ate.">
        <div className="grid gap-sm">
          <div className="rounded-card bg-card p-md shadow-toy-soft">
            <h3 className="m-0 text-headline">Active minutes</h3>
            <div className="mt-sm">
              <AreaLine values={days30.map((x) => (anyMove ? (minutesOn.get(x) ?? 0) : null))} max={Math.max(60, ...days30.map((x) => minutesOn.get(x) ?? 0))} color="var(--color-r5)" labels={days30.map(shortDay)} height={140} label="Active minutes a day over the last thirty days" empty="No movement logged yet" />
            </div>
          </div>
          <div className="rounded-card bg-card p-md shadow-toy-soft">
            <h3 className="m-0 text-headline">Eating score</h3>
            <div className="mt-sm">
              <AreaLine values={days30.map((x) => eatOnDay.get(x) ?? null)} max={100} color="var(--color-r4)" labels={days30.map(shortDay)} height={140} label="Eating score, from 0 to 100, over the last thirty days" empty="No eating check-ins yet" />
            </div>
            <p className="mt-xs m-0 text-caption text-ink-soft">From fruit and veg, packaged food and meals without a screen. It needs your fruit and veg, even 0. Protein stays out.<span className="hidden sm:inline"> What you leave out does not count. Tasty never lowers it, and a fasting day is left out.</span></p>
          </div>
        </div>
      </Section>

      <Section id="kinds-heading" title="What you did" lede="Minutes by kind, last 30 days.">
        <div className="rounded-card bg-card p-md shadow-toy-soft">
          {byKind.length === 0 ? (
            <p className="m-0 text-subhead text-ink-soft">Log a run, a walk or a workout and it shows here.</p>
          ) : (
            <div className="flex flex-col items-center gap-md sm:flex-row">
              <Donut segments={byKind.map((x) => ({ value: x.minutes, color: KIND_COLOR[x.kind], label: MOVE_KIND_META[x.kind].name }))} size={148} stroke={20} label="Minutes by kind over thirty days">
                <span className="text-caption font-semibold">{formatCount(byKind.reduce((a, x) => a + x.minutes, 0))} min</span>
              </Donut>
              <div className="w-full min-w-0 flex-1 sm:max-w-[360px]">
                <Legend items={byKind.map((x) => ({ color: KIND_COLOR[x.kind], label: MOVE_KIND_META[x.kind].name, text: `${formatCount(x.minutes)} min` }))} />
              </div>
            </div>
          )}
        </div>
      </Section>

      <Section id="month-heading" title="Your month" lede="Tap a day to see, change or remove what you logged.">
        <div className="rounded-card bg-card p-md shadow-toy-soft">
          <CalendarGrid
            month={month}
            today={today}
            maxDate={today}
            selected={openDay}
            onMonth={setMonth}
            onPick={setOpenDay}
            marks={Object.fromEntries([...(mq.data?.eats ?? []).map((e) => [e.date, { color: 'var(--color-r4)' }] as const), ...(mq.data?.moves ?? []).map((m) => [m.date, { color: 'var(--color-r5)' }] as const)])}
            label="Fitness calendar. Blue days have movement, green days only an eating check-in. Tap a day to open it."
          />
          <p className="mt-sm m-0 text-caption text-ink-soft">
            <span className="mr-xs inline-block size-[10px] rounded-pill bg-r5" aria-hidden="true" />
            Movement
            <span className="ml-sm mr-xs inline-block size-[10px] rounded-pill bg-r4" aria-hidden="true" />
            Eating only
          </p>
        </div>
      </Section>

      <PeriodPanel id="fitness-period" parts={['fitness']} />
      {/* Emerging (2026-11-07): moving as a good habit, when you move, and how you ate beside how you felt. */}
      <EmergenceSlot app="fitness" max={2} />

      <Section id="moves-heading" title="Your movement" lede="Newest first. Tap one to open its day.">
        {list.isPending && <SkeletonList count={3} lines={1} label="Loading your movement" />}
        {list.data && list.data.moves.length === 0 && <p className="m-0 text-subhead text-ink-soft">Nothing logged yet. Today is a good day to start.</p>}
        <ul className="flex list-none flex-col gap-xs p-0 m-0">
          {list.data?.moves.map((m) => (
            <li key={m.id} className="flex items-center gap-sm rounded-tile bg-card p-sm shadow-toy-soft">
              <button type="button" onClick={() => (setMonth(m.date.slice(0, 7)), setOpenDay(m.date))} className="toy toy-flat flex min-h-[44px] min-w-0 flex-1 items-center gap-sm rounded-inner-sm text-left">
                <KindBadge kind={m.kind} />
                <span className="min-w-0 flex-1">
                  <span className="block text-card-title">{moveLine(m)}</span>
                  <span className="block truncate text-card-note text-ink-soft">{moveNote(m)}</span>
                </span>
                {m.source === 'club' && <StatusTag tone="calm">Club run</StatusTag>}
              </button>
              <button type="button" onClick={() => setToDelete(m)} aria-label={`Remove ${moveLine(m)} on ${dayLabel(m.date)}`} data-tip="Remove" className="toy toy-flat flex size-[44px] shrink-0 items-center justify-center rounded-pill text-ink-soft hover:text-r1">
                <AnimatedIcon name="trash" size={20} />
              </button>
            </li>
          ))}
        </ul>
        <Pager page={list.data?.page} prefix="m" label="movement" />
      </Section>

      <ConfirmDelete
        open={toDelete !== null}
        title="Remove this movement?"
        body={toDelete ? `${moveLine(toDelete)} on ${dayLabel(toDelete.date)}. It comes off your charts and Life. ${toDelete.source === 'club' ? 'The club run itself stays in Kreators Run.' : 'This cannot be undone.'}` : ''}
        pending={remove.isPending}
        failed={remove.isError}
        yes="Yes, remove it"
        onYes={() => toDelete && remove.mutate(toDelete.id)}
        onClose={() => {
          setToDelete(null);
          remove.reset();
        }}
      />
      <DaySheet date={openDay} loading={mq.isPending} moves={(mq.data?.moves ?? []).filter((m) => m.date === openDay)} eat={(mq.data?.eats ?? []).find((e) => e.date === openDay) ?? null} proteinGoal={proteinGoal} near={openDay === today || openDay === yesterday} onClose={() => setOpenDay(null)} onChanged={() => void refresh()} />
    </Screen>
  );
}

/** One day of the calendar: its movement and its eating, each changed in place (today and yesterday) or removed after asking. */
function DaySheet({ date, loading, moves, eat, proteinGoal, near, onClose, onChanged }: { date: string | null; /** A row of an older month opens its day while that month is still on its way. */ loading: boolean; moves: MoveLog[]; eat: EatLog | null; proteinGoal: number | null; near: boolean; onClose: () => void; onChanged: () => void }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [eatOpen, setEatOpen] = useState(false);
  const [gone, setGone] = useState<{ kind: 'move' | 'eat'; id: string; label: string } | null>(null);
  const remove = useMutation({
    mutationFn: (g: { kind: 'move' | 'eat'; id: string }) => (g.kind === 'move' ? api.deleteMove(g.id) : api.deleteEat(g.id)),
    onSuccess: () => (setGone(null), onChanged()),
  });
  const close = () => (setEditing(null), setEatOpen(false), onClose());
  // A save folds the form the focused button sits in, so focus goes back to the Change that opened it, still inside this sheet.
  const backTo = (id: string) => requestAnimationFrame(() => document.getElementById(id)?.focus({ preventScroll: true }));
  return (
    <Sheet open={date !== null} onClose={close} title={date ? dayLabel(date) : ''}>
      <div className="grid gap-md pb-xl">
        {loading && <SkeletonList count={1} lines={2} label="Loading this day" />}
        {!loading && moves.length === 0 && !eat && <p className="m-0 text-subhead text-ink-soft">Nothing logged on this day.{near ? ' Use the cards on the page to add it.' : ''}</p>}
        {moves.length > 0 && (
          <ul className="flex list-none flex-col gap-xs p-0 m-0" aria-label="Movement">
            {moves.map((m) => (
              <li key={m.id} className="rounded-tile bg-card p-sm shadow-toy-soft">
                <div className="flex items-center gap-sm">
                  <KindBadge kind={m.kind} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-card-title">{moveLine(m)}</span>
                    <span className="block text-card-note text-ink-soft">{[m.effort ? EFFORT_LEVELS[m.effort - 1] : '', m.source === 'club' ? 'Club run' : '', m.note].filter(Boolean).join(' · ') || 'Logged by you'}</span>
                  </span>
                  {near && m.source === 'self' && (
                    <button type="button" id={`move-change-${m.id}`} aria-expanded={editing === m.id} onClick={() => setEditing(editing === m.id ? null : m.id)} className="toy toy-flat inline-flex min-h-[44px] items-center rounded-pill px-sm text-subhead font-semibold">
                      {editing === m.id ? 'Close' : 'Change'}
                    </button>
                  )}
                  <button type="button" onClick={() => setGone({ kind: 'move', id: m.id, label: moveLine(m) })} aria-label={`Remove ${moveLine(m)}`} data-tip="Remove" className="toy toy-flat flex size-[44px] shrink-0 items-center justify-center rounded-pill text-ink-soft hover:text-r1">
                    <AnimatedIcon name="trash" size={20} />
                  </button>
                </div>
                {editing === m.id && (
                  <div className="mt-md">
                    <MoveForm
                      kinds={MOVE_KINDS}
                      initial={m}
                      saveLabel="Save the change"
                      onSave={(body) => api.editMove(m.id, body)}
                      onDone={() => {
                        setEditing(null);
                        onChanged();
                        backTo(`move-change-${m.id}`);
                      }}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {eat && (
          <div className="rounded-tile bg-card p-sm shadow-toy-soft">
            <div className="flex items-center gap-sm">
              <span className="min-w-0 flex-1">
                <span className="block text-card-title">{eat.fasting ? 'A fasting day' : eat.dayScore === null ? 'Eating check-in' : `Eating score ${eat.dayScore}`}</span>
                <span className="block text-card-note text-ink-soft">
                  {/* Each fact kept whole, so a phone never parts "protein" from its grams. */}
                  {[...eatSummary(eat, eat.legacy).filter((p, i) => !(eat.fasting && i === 0)), ...(eat.note ? [eat.note] : [])].map((p, i, all) => (
                    <Fragment key={i}>
                      <span className="inline-block">{i < all.length - 1 ? `${p} ·` : p}</span>{' '}
                    </Fragment>
                  ))}
                </span>
              </span>
              {near && (
                <button type="button" id="eat-change" aria-expanded={eatOpen} onClick={() => setEatOpen((v) => !v)} className="toy toy-flat inline-flex min-h-[44px] items-center rounded-pill px-sm text-subhead font-semibold">
                  {eatOpen ? 'Close' : 'Change'}
                </button>
              )}
              <button type="button" onClick={() => setGone({ kind: 'eat', id: eat.id, label: 'the eating check-in' })} aria-label="Remove this day’s eating check-in" data-tip="Remove" className="toy toy-flat flex size-[44px] shrink-0 items-center justify-center rounded-pill text-ink-soft hover:text-r1">
                <AnimatedIcon name="trash" size={20} />
              </button>
            </div>
            {eatOpen && date && (
              <div className="mt-md">
                <EatForm
                  day={date}
                  existing={eat}
                  proteinGoal={proteinGoal}
                  lastScoop={eat.protein?.scoopG ?? null}
                  onGoalSaved={onChanged}
                  onSaved={() => {
                    setEatOpen(false);
                    onChanged();
                    backTo('eat-change');
                  }}
                />
              </div>
            )}
          </div>
        )}
        {!near && (moves.length > 0 || eat) && <p className="m-0 text-caption text-ink-soft">Only today and yesterday can change. Older days can still be removed.</p>}
      </div>
      <ConfirmDelete
        open={gone !== null}
        title="Remove this?"
        body={gone ? `${gone.label} on ${date ? dayLabel(date) : 'this day'}. It comes off your charts and Life. This cannot be undone.` : ''}
        pending={remove.isPending}
        failed={remove.isError}
        yes="Yes, remove it"
        onYes={() => gone && remove.mutate(gone)}
        onClose={() => {
          setGone(null);
          remove.reset();
        }}
      />
    </Sheet>
  );
}
