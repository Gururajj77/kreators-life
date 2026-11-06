import { formatCount, money as sharedMoney, PERIOD_META, periodFor, type Period, type ReviewSummary } from '@kreators/shared';
import { useState, type ReactNode } from 'react';
import { api } from '../lib/api';
import { todayLocal } from '../lib/date';
import { useAuthed } from '../lib/queries';
import { StatTile } from './Charts';
import { MoodFace } from './MoodFace';
import { PeriodFilter } from './PeriodFilter';
import { bento } from '../lib/bento';
import { tbClass, tbStyle } from '../lib/blockColor';
import { Section, SeeAll } from './Section';

export type SummaryPart = 'daily' | 'kinds' | 'notToDo' | 'wellbeing' | 'journal' | 'finance' | 'shop' | 'school' | 'work' | 'people';

/** A whole-unit amount for a tile (no cents), unlike shared `money()`, which keeps them. To the nearest whole rupee (or dollar), with its symbol and the person's grouping: "₹12,500". Integer maths only. */
export const moneyRounded = (cents: number, currency: string) => sharedMoney(Math.round(cents / 100) * 100, currency);

/** @deprecated The old name, kept only until ListingSheet (owned by another stream) imports `moneyRounded`; prefer shared `money()`. */
export const money = moneyRounded;

/** "up 3 on the week before", "same as the month before", or what was missing. */
export function delta(now: number | null, before: number | null, previous: string, digits = 0): string {
  if (now === null) return 'nothing logged';
  if (before === null) return `nothing logged ${previous}`;
  const d = now - before;
  if (Math.abs(d) < (digits ? 0.05 : 0.5)) return `same as ${previous}`;
  const text = digits ? Math.abs(d).toFixed(digits) : formatCount(Math.abs(d));
  return `${d > 0 ? 'up' : 'down'} ${text} on ${previous}`;
}

/** The same for money, from whole cents: "up ₹12,54,500 on the week before". */
export function moneyDelta(nowCents: number, beforeCents: number, previous: string, currency: string): string {
  const d = Math.round(nowCents / 100) - Math.round(beforeCents / 100);
  if (d === 0) return `same as ${previous}`;
  return `${d > 0 ? 'up' : 'down'} ${moneyRounded(Math.abs(d) * 100, currency)} on ${previous}`;
}

export function usePeriodSummary(period: Period) {
  return useAuthed(['reviews', 'summary', period.kind, period.start], () => api.reviewSummary(period.kind, period.start));
}

/** The period's numbers as tiles, each next to the period before. Which parts show depends on the dashboard. */
export function SummaryTiles({ summary, parts, keep }: { summary: ReviewSummary; parts: readonly SummaryPart[]; /** Which tiles stay, by the page they open (Home drops the tiles of apps that are off). */ keep?: (to: string | undefined) => boolean }) {
  const { now, before, currency } = summary;
  const prev = PERIOD_META[summary.period.kind].previous;
  const tiles: { label: string; value: ReactNode; hint: string; to?: string }[] = [];
  const face = (v: number | null, text: string) =>
    v === null ? (
      '–'
    ) : (
      <span className="flex items-center gap-xs">
        <MoodFace value={Math.round(v)} size={28} />
        {text}
      </span>
    );
  for (const part of parts) {
    if (part === 'daily') {
      tiles.push(
        { label: 'Check-ins', value: `${now.checkins} of ${now.days}`, hint: delta(now.checkins, before.checkins, prev), to: '/today' },
        { label: 'Tasks done', value: now.tasksDone, hint: delta(now.tasksDone, before.tasksDone, prev), to: '/today' },
        { label: 'Small acts', value: now.smallActs, hint: delta(now.smallActs, before.smallActs, prev), to: '/today' },
        { label: 'Xp earned', value: formatCount(now.xp), hint: delta(now.xp, before.xp, prev), to: '/tower' },
      );
    }
    if (part === 'kinds') {
      // Kinds of day (2026-11-06): the period's days so far with a kind (set for the date or given by the week; the default has none),
      // the kind used most beside it. A review saved before then has no count, so it shows a dash. The count runs only to today, so a
      // period still going says "so far" beside the whole period before it (no other tile counts days, so none says it).
      const n = now.kindDays;
      const top = now.kinds?.[0];
      const day = todayLocal();
      const soFar = summary.period.start <= day && day <= summary.period.end;
      tiles.push({
        label: 'Kinds of day',
        value:
          n === undefined ? (
            '–'
          ) : (
            <span className={`flex items-center gap-xs ${top ? tbClass(top.color) : ''}`} style={top ? tbStyle(top.color) : undefined}>
              {top && <span className="tb-dot" aria-hidden="true" />}
              {`${formatCount(n)} ${n === 1 ? 'day' : 'days'}`}
            </span>
          ),
        hint: n === undefined ? 'not counted then' : `${soFar ? 'so far · ' : ''}${top ? `${top.name} most · ` : ''}${delta(n, before.kindDays ?? null, prev)}`,
        to: '/time-blocks',
      });
    }
    if (part === 'notToDo') {
      tiles.push({ label: 'Kept days', value: now.notToDoKept, hint: `${now.notToDoSlipped} ${now.notToDoSlipped === 1 ? 'slip' : 'slips'} · ${delta(now.notToDoKept, before.notToDoKept, prev)}`, to: '/today' });
    }
    if (part === 'wellbeing') {
      tiles.push(
        { label: 'Mood', value: face(now.moodAvg, now.moodAvg === null ? '' : now.moodAvg.toFixed(1)), hint: delta(now.moodAvg, before.moodAvg, prev, 1), to: '/mood' },
        { label: 'Sleep', value: now.sleepAvg === null ? '–' : `${now.sleepAvg.toFixed(1)} h`, hint: delta(now.sleepAvg, before.sleepAvg, prev, 1), to: '/sleep' },
        { label: 'Stress', value: now.stressAvg === null ? '–' : `${now.stressAvg.toFixed(1)} of 5`, hint: delta(now.stressAvg, before.stressAvg, prev, 1), to: '/stress' },
        { label: 'Mindful', value: `${now.mindfulMin} min`, hint: delta(now.mindfulMin, before.mindfulMin, prev), to: '/mindful' },
      );
    }
    if (part === 'journal') {
      tiles.push({ label: 'Journal', value: `${now.journalEntries} ${now.journalEntries === 1 ? 'entry' : 'entries'}`, hint: delta(now.journalEntries, before.journalEntries, prev), to: '/journal' });
    }
    if (part === 'finance') {
      tiles.push(
        { label: 'Income', value: moneyRounded(now.incomeCents, currency), hint: moneyDelta(now.incomeCents, before.incomeCents, prev, currency), to: '/finance' },
        { label: 'Spent', value: moneyRounded(now.expenseCents, currency), hint: moneyDelta(now.expenseCents, before.expenseCents, prev, currency), to: '/finance' },
        { label: 'Kept', value: moneyRounded(now.incomeCents - now.expenseCents, currency), hint: moneyDelta(now.incomeCents - now.expenseCents, before.incomeCents - before.expenseCents, prev, currency), to: '/finance' },
      );
    }
    if (part === 'shop') {
      tiles.push(
        { label: 'Orders', value: now.orders, hint: delta(now.orders, before.orders, prev), to: '/shop' },
        { label: 'Sales', value: moneyRounded(now.salesCents, currency), hint: now.salesPoints ? `plus ${formatCount(now.salesPoints)} points · ${moneyDelta(now.salesCents, before.salesCents, prev, currency)}` : moneyDelta(now.salesCents, before.salesCents, prev, currency), to: '/shop' },
      );
    }
    if (part === 'school') {
      tiles.push(
        { label: 'Lessons done', value: now.lessonsDone, hint: delta(now.lessonsDone, before.lessonsDone, prev), to: '/school' },
        { label: 'Programs finished', value: now.programsDone, hint: delta(now.programsDone, before.programsDone, prev), to: '/school' },
      );
    }
    if (part === 'work') {
      tiles.push(
        { label: 'Applications', value: now.applications, hint: delta(now.applications, before.applications, prev), to: '/work' },
        { label: 'Decisions', value: now.decisions, hint: delta(now.decisions, before.decisions, prev), to: '/work' },
      );
    }
    if (part === 'people') {
      tiles.push(
        { label: 'Events', value: now.events, hint: delta(now.events, before.events, prev), to: '/party' },
        { label: 'Posts', value: now.posts, hint: delta(now.posts, before.posts, prev), to: '/community' },
        { label: 'Circles', value: now.circles, hint: delta(now.circles, before.circles, prev), to: '/circles' },
        { label: 'Runs', value: now.runs, hint: delta(now.runs, before.runs, prev), to: '/run' },
      );
    }
  }
  const shown = keep ? tiles.filter((t) => keep(t.to)) : tiles;
  return (
    <div className="grid grid-cols-2 gap-xs md:grid-cols-4">
      {shown.map((t, i) => (
        <StatTile key={t.label} label={t.label} value={t.value} hint={t.hint} to={t.to} className={bento(i, shown.length, 2, 4)} />
      ))}
    </div>
  );
}

/** The period filter and its numbers, dropped into any dashboard. Which parts show is the dashboard's choice. */
export function PeriodPanel({ id, parts, title = 'By period', span = false, keep }: { id: string; parts: readonly SummaryPart[]; title?: string; span?: boolean; /** Which tiles and links stay, by the page they open (Home drops those of apps that are off). */ keep?: (to: string | undefined) => boolean }) {
  const today = todayLocal();
  const [period, setPeriod] = useState<Period>(() => periodFor('week', today));
  const q = usePeriodSummary(period);
  return (
    <Section
      id={id}
      title={title}
      lede="The same numbers by week, month, quarter or half year, next to the one before."
      span={span}
      action={!keep || keep('/reviews') ? <SeeAll to="/reviews">Review it</SeeAll> : undefined}
    >
      <PeriodFilter period={period} onChange={setPeriod} today={today} />
      <div className="mt-sm">
        {q.data ? (
          <SummaryTiles summary={q.data} parts={parts} keep={keep} />
        ) : (
          <p className="m-0 text-subhead text-ink-soft" role="status">
            {q.isError ? 'Could not load this period. Try another one.' : 'Adding up your numbers'}
          </p>
        )}
      </div>
    </Section>
  );
}
