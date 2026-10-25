import { PERIOD_META, periodFor, type Period, type ReviewSummary } from '@kreators/shared';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { api } from '../lib/api';
import { todayLocal } from '../lib/date';
import { useAuthed } from '../lib/queries';
import { StatTile } from './Charts';
import { MoodFace } from './MoodFace';
import { PeriodFilter } from './PeriodFilter';
import { Section } from './Section';

export type SummaryPart = 'daily' | 'notToDo' | 'wellbeing' | 'journal' | 'finance' | 'shop' | 'school' | 'work' | 'people';

export const money = (cents: number, currency: string) => `${currency} ${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

/** "up 3 on the week before", "same as the month before", or what was missing. */
export function delta(now: number | null, before: number | null, previous: string, digits = 0): string {
  if (now === null) return 'nothing logged';
  if (before === null) return `nothing logged ${previous}`;
  const d = now - before;
  if (Math.abs(d) < (digits ? 0.05 : 0.5)) return `same as ${previous}`;
  const text = digits ? Math.abs(d).toFixed(digits) : String(Math.abs(Math.round(d)));
  return `${d > 0 ? 'up' : 'down'} ${text} on ${previous}`;
}

export function usePeriodSummary(period: Period) {
  return useAuthed(['reviews', 'summary', period.kind, period.start], () => api.reviewSummary(period.kind, period.start));
}

/** The period's numbers as tiles, each next to the period before. Which parts show depends on the dashboard. */
export function SummaryTiles({ summary, parts }: { summary: ReviewSummary; parts: readonly SummaryPart[] }) {
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
        { label: 'Xp earned', value: now.xp.toLocaleString(), hint: delta(now.xp, before.xp, prev), to: '/tower' },
      );
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
        { label: 'Income', value: money(now.incomeCents, currency), hint: delta(now.incomeCents / 100, before.incomeCents / 100, prev), to: '/finance' },
        { label: 'Spent', value: money(now.expenseCents, currency), hint: delta(now.expenseCents / 100, before.expenseCents / 100, prev), to: '/finance' },
        { label: 'Kept', value: money(now.incomeCents - now.expenseCents, currency), hint: delta((now.incomeCents - now.expenseCents) / 100, (before.incomeCents - before.expenseCents) / 100, prev), to: '/finance' },
      );
    }
    if (part === 'shop') {
      tiles.push(
        { label: 'Orders', value: now.orders, hint: delta(now.orders, before.orders, prev), to: '/shop' },
        { label: 'Sales', value: money(now.salesCents, currency), hint: now.salesPoints ? `plus ${now.salesPoints} points · ${delta(now.salesCents / 100, before.salesCents / 100, prev)}` : delta(now.salesCents / 100, before.salesCents / 100, prev), to: '/shop' },
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
  return (
    <div className="grid grid-cols-2 gap-xs md:grid-cols-4">
      {tiles.map((t) => (
        <StatTile key={t.label} label={t.label} value={t.value} hint={t.hint} to={t.to} />
      ))}
    </div>
  );
}

/** The period filter and its numbers, dropped into any dashboard. Which parts show is the dashboard's choice. */
export function PeriodPanel({ id, parts, title = 'By period', span = false }: { id: string; parts: readonly SummaryPart[]; title?: string; span?: boolean }) {
  const today = todayLocal();
  const [period, setPeriod] = useState<Period>(() => periodFor('week', today));
  const q = usePeriodSummary(period);
  return (
    <Section
      id={id}
      title={title}
      lede="The same numbers by week, month, quarter or half year, next to the one before."
      span={span}
      action={
        <Link to="/reviews" className="inline-flex min-h-[44px] items-center gap-xs text-[14px] font-bold text-ink-mute underline-offset-4 hover:text-ink hover:underline">
          Review it
        </Link>
      }
    >
      <PeriodFilter period={period} onChange={setPeriod} today={today} />
      <div className="mt-sm">
        {q.data ? (
          <SummaryTiles summary={q.data} parts={parts} />
        ) : (
          <p className="m-0 text-[14px] font-bold text-ink-soft" role="status">
            {q.isError ? 'Could not load this period.' : 'Adding it up'}
          </p>
        )}
      </div>
    </Section>
  );
}
