import { PageHeader } from '../components/PageHeader';
import { formatCount, isRealDay, KIND_META, MOODS, PERIOD_KINDS, PERIOD_META, periodFor, periodLabel, reviewPeriodNow, RELATIONSHIP_BY_KEY, RELATIONSHIPS, REVIEW_ANSWER_MAX, type PaceStatus, type Period, type PeriodKind, type ReviewFlagged, type NodeKind, type ReviewLayer, type ReviewLayerItem, type ReviewLayerKind, type ReviewListItem, type ReviewsResponse, type Page, type TagTone } from '@kreators/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { BusinessMetrics } from '../components/BusinessMetrics';
import { Button } from '../components/Button';
import { AreaLine, Donut, Legend } from '../components/Charts';
import { Inert } from '../components/Inert';
import { MoodFace } from '../components/MoodFace';
import { PeriodFilter } from '../components/PeriodFilter';
import { ReviewCalendar } from '../components/ReviewCalendar';
import { ReviewSteps, stepIn } from '../components/ReviewSteps';
import { ReviewTemplates } from '../components/ReviewTemplates';
import { StatusTag } from '../components/StatusTag';
import type { SummaryPart } from '../components/PeriodPanel';
import { SummaryTiles } from '../components/SummaryTiles';
import { Screen } from '../components/Screen';
import { Section, SeeAll } from '../components/Section';
import { Pager, usePage } from '../components/Pager';
import { ConfirmDelete } from '../components/ConfirmDelete';
import { Fold } from '../components/Fold';
import { api } from '../lib/api';
import { prettyDate, todayLocal, inZone, weekday } from '../lib/date';
import { focusHeading } from '../lib/focusHeading';
import { useAuthed, useMe } from '../lib/queries';
import { useKept } from '../lib/kept';
import { keepForApps, useModules } from '../lib/modules';
import { useParamState, writeParams } from '../lib/useParamState';
import { FIELD } from '../lib/ui';
import { FactTag } from '../components/FactTag';
import { EmergenceSlot, KindsSlot } from '../components/EmergenceSlot';

/**
 * The numbers' parts, in reading order: the day and its tasks, the trackers, money, the rest. A tile that belongs to an app shows only while that app is on (`keepForApps`, the
 * founder, 2026-11-07), so a category left with nothing goes. The fuller parts (2026-11-07) show only when the server sent them and the period or the one before holds
 * something; supplements reach this screen only.
 */
const PARTS: readonly SummaryPart[] = ['daily', 'tasksMore', 'kinds', 'notToDo', 'wellbeing', 'water', 'focus', 'fitness', 'supplements', 'journal', 'finance', 'moneyMore', 'shop', 'school', 'work', 'people'];

/** A project's pace as a tag, in the pillar page's tones. */
const PACE_TONE: Record<PaceStatus, TagTone> = { on: 'good', slipping: 'warn', behind: 'bad', none: 'neutral' };
/** What each review's walk of the layer is for, in one line (2026-11-07, reviews by layer). */
const LAYER_LEDE: Record<PeriodKind, string> = {
  day: 'Pillar by pillar: what you ticked, and what is still open.',
  week: 'Pillar by pillar, with the tasks you ticked and each project’s pace.',
  month: 'Pillar by pillar, with the tasks ticked under each one.',
  quarter: 'Pillar by pillar. How often did you feel each one?',
  half: 'Pillar by pillar: the lines you live by.',
  year: 'Pillar by pillar: what must stay standing.',
};
/** The layer under each one, counted on its row (projects under a goal outcome, and so on). */
const BELOW: Record<ReviewLayerKind, NodeKind | null> = { pillar: 'principle', principle: 'value_goal', value_goal: 'outcome', outcome: 'project', project: null, task: null };
/** The line "Add to my answer" puts under the first question, which always walks the layer. A day's task says whether it was done. */
const layerLine = (it: ReviewLayerItem, kind: ReviewLayerKind) => `${RELATIONSHIP_BY_KEY[it.relationship]?.name ?? 'Pillar'}: ${it.title}${kind === 'task' ? (it.status === 'done' ? ' (done)' : ' (still open)') : ''}`;
const isKind = (v: string | null): v is PeriodKind => Boolean(v) && (PERIOD_KINDS as readonly string[]).includes(v!);

/** Daily, weekly, monthly, quarterly, half-year and yearly reviews: the numbers from every app for the period, one layer of your pyramids, and what you make of them. */
export function Reviews() {
  const today = todayLocal();
  const keepTile = keepForApps(useModules().modules);
  // The period lives in the address (2026-11-07), so a reload, Back or a reminder's link (`?kind=&date=`) keeps it; a change replaces the
  // entry and keeps the page where it is (writeParams), and starts the review again at its first question.
  const [params, setParams] = useSearchParams();
  const kindQ = params.get('kind');
  const dateQ = params.get('date');
  // A kind with no day (Emerging's "Write this month's review"), a day that is not on the calendar or a period still to come opens that
  // kind as picking it would, never the week; only an address with no kind at all opens the week.
  const period = useMemo<Period>(() => {
    if (!isKind(kindQ)) return periodFor('week', today);
    const asked = isRealDay(dateQ) ? periodFor(kindQ, dateQ) : null;
    return asked && asked.start <= today ? asked : reviewPeriodNow(kindQ, today);
  }, [kindQ, dateQ, today]);
  const setPeriod = (p: Period) => writeParams(setParams, { kind: p.kind, date: p.start, step: null });
  const [step, setStep] = useParamState('step', '1');
  const qc = useQueryClient();
  // Past reviews come a page at a time (prefix 'r'), the daily ones apart (prefix 'rd'). api.reviews only takes a day, so the pages ride
  // on its query string.
  const rp = usePage('r');
  const rdp = usePage('rd');
  const q = useAuthed(['reviews', period.kind, period.start, rp.query, rdp.query], () => api.reviews(period.kind, `${period.start}&${rp.query}&${rdp.query}`));
  const d = q.data as (ReviewsResponse & { recentPage?: Page; recentDaysPage?: Page }) | undefined;
  const invalidate = () => qc.invalidateQueries({ queryKey: ['reviews'] });

  // The form follows the saved review for this period, or starts from the built-in template.
  const [templateId, setTemplateId] = useState(`builtin:${period.kind}`);
  const [answers, setAnswers] = useState<string[]>([]);
  const [rating, setRating] = useState<number | null>(null);
  const [highlight, setHighlight] = useState('');
  // A review not saved yet is kept for the tab per period (2026-11-13, the frictionless pass), so switching the period or leaving the page
  // never loses the answers; it opens on them again while no review is saved for that period, and saving clears it. Never sent anywhere.
  const me = useMe();
  type Draft = { templateId: string; answers: string[]; rating: number | null; highlight: string };
  const [draft, setDraft] = useKept<Draft | null>(`review-draft:${me.data?.user.id ?? 'none'}`, `${period.kind}:${period.start}`, null);
  const keep = (next: Partial<Draft>) => {
    if (!d || d.review) return;
    const v = { templateId, answers, rating, highlight, ...next };
    setDraft(v.answers.some((a) => a.trim()) || v.rating !== null || v.highlight.trim() ? v : null);
  };
  const reviewStamp = d?.review ? `${d.review.id}:${d.review.updatedAt}` : 'none';
  useEffect(() => {
    if (!d) return;
    if (d.review) {
      setTemplateId(d.review.templateId ?? `builtin:${d.review.kind}`);
      setAnswers(d.review.answers);
      setRating(d.review.rating);
      setHighlight(d.review.highlight);
    } else {
      setTemplateId(draft?.templateId ?? `builtin:${period.kind}`);
      setAnswers(draft?.answers ?? []);
      setRating(draft?.rating ?? null);
      setHighlight(draft?.highlight ?? '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewStamp, period.kind, period.start, Boolean(d)]);

  const template = d?.templates.find((t) => t.id === templateId) ?? d?.templates[0] ?? null;
  // A saved review keeps its own prompts even after its template changed or went.
  const prompts = d?.review && d.review.templateId === (template?.builtIn ? null : template?.id) ? d.review.prompts : (template?.prompts ?? []);
  // The line naming a built-in question's method, found by its words, so a review saved with older wording simply shows none.
  const whyOf = (i: number) => {
    const at = template?.prompts.indexOf(prompts[i] ?? '') ?? -1;
    return at >= 0 ? template?.why?.[at] : undefined;
  };
  // The review's own name: the built-in template's for this period (a half's part, worked out on the server), else the kind's.
  const reviewName = d?.templates.find((t) => t.builtIn)?.name ?? PERIOD_META[period.kind].name;
  // A task brought to this review. A saved review keeps the list it was saved with; one saved before this existed shows the live list.
  const flagged: ReviewFlagged[] = d?.review?.snapshot?.flagged ?? d?.summary.flagged ?? [];
  // The layer this review walks, by pillar. A saved review keeps the items it was saved with; one saved before this existed shows the live ones.
  const layer: ReviewLayer | undefined = d?.review?.snapshot?.layer ?? d?.summary.layer;
  const addTo = (at: number, line: string) => {
    const next = prompts.map((_, j) => (j === at ? [answers[j] ?? '', line].filter(Boolean).join('\n').slice(0, REVIEW_ANSWER_MAX) : (answers[j] ?? '')));
    setAnswers(next);
    keep({ answers: next });
    // The review moves to that question's step, without taking focus from the list the person is working through.
    setStep(String(at + 1));
  };
  const bringItem = (it: ReviewLayerItem) => {
    if (prompts.length === 0 || !layer) return;
    addTo(0, layerLine(it, layer.kind));
  };
  const lineFor = (f: ReviewFlagged) => `${f.status === 'done' ? 'Done' : 'Still open'}: ${f.title}`;
  const slotFor = (f: ReviewFlagged) => Math.min(f.status === 'done' ? 0 : 1, Math.max(0, prompts.length - 1));
  const bring = (f: ReviewFlagged) => {
    if (prompts.length === 0) return;
    addTo(slotFor(f), lineFor(f));
  };
  const openReview = (p: Period) => {
    setPeriod(p);
    // Once the period has drawn. The calendar's day panel that opened it has gone, so the keyboard's place goes with the page.
    window.setTimeout(() => {
      document.getElementById('review-heading')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
      focusHeading('review-heading', { preventScroll: true });
    }, 400);
  };
  const save = useMutation({
    mutationFn: () => api.saveReview({ kind: period.kind, date: period.start, templateId: template && !template.builtIn ? template.id : null, answers, rating, highlight }),
    onSuccess: () => {
      setDraft(null);
      return invalidate();
    },
  });
  // Removing a review asks in a sheet: its snapshot of the numbers cannot be rebuilt (review 2026-11-13).
  const [askingRemove, setAskingRemove] = useState<string | null>(null);
  const remove = useMutation({
    mutationFn: (id: string) => api.deleteReview(id),
    onSuccess: () => {
      setAskingRemove(null);
      invalidate();
    },
  });

  const s = d?.summary;
  const meta = PERIOD_META[period.kind];
  const oneDay = period.kind === 'day';
  const areaSegments = s ? RELATIONSHIPS.filter((r) => (s.xpByArea[r.key] ?? 0) > 0).map((r) => ({ value: s.xpByArea[r.key] ?? 0, color: r.color, label: r.name })) : [];
  // A week by weekday, a month by date, and longer periods by the month on its first day (every other month for a year).
  const monthLabel = (date: string) => inZone(date, { month: 'short' });
  const labels = s
    ? s.series.map((p, i, all) =>
        period.kind === 'week'
          ? weekday(p.date)
          : period.kind === 'month'
            ? i === 0 || i === all.length - 1 || i % Math.ceil(all.length / 6) === 0
              ? String(Number(p.date.slice(8, 10)))
              : ''
            : p.date.endsWith('-01') && (period.kind !== 'year' || Number(p.date.slice(5, 7)) % 2 === 1)
              ? monthLabel(p.date)
              : '',
      )
    : [];
  const current = period.start <= today && today <= period.end;
  const layerCount = layer ? layer.pillars.reduce((n, g) => n + g.total, 0) : 0;
  const emptyPillars = layer ? layer.pillars.filter((g) => g.total === 0).map((g) => RELATIONSHIP_BY_KEY[g.relationship]?.name ?? g.relationship) : [];
  // An API that does not know this period answers with another (an older server still running): say so, never show the wrong one quietly.
  const mismatch = Boolean(d && (d.period.kind !== period.kind || d.period.start !== period.start));
  const pastRow = (r: ReviewListItem) => {
    const m = r.rating ? MOODS.find((x) => x.value === r.rating) : null;
    return (
      <li key={r.id}>
        <button type="button" onClick={() => openReview({ kind: r.kind, start: r.start, end: r.end })} className="toy toy-soft flex w-full items-center gap-sm rounded-tile bg-card p-sm text-left text-ink">
          {m ? <MoodFace value={m.value} size={36} /> : <span className="flex size-[36px] items-center justify-center rounded-pill bg-paper text-subhead font-medium text-ink-soft">·</span>}
          <span className="min-w-0 flex-1">
            <span className="block text-card-title">{periodLabel({ kind: r.kind, start: r.start, end: r.end })}</span>
            <span className="block truncate text-card-note text-ink-soft">{r.highlight || PERIOD_META[r.kind].name}</span>
          </span>
          <FactTag kind="when">{PERIOD_META[r.kind].short}</FactTag>
        </button>
      </li>
    );
  };
  const days = d?.recentDays ?? [];

  return (
    <Screen columns={false}>
      {/* The app cover (2026-11-06, the founder: "the hero cover with back button, title and helper text in a card/cover like the other
          pages"): Reviews wears the cover, so by the hero rule no coloured Hero; the period's numbers are under The numbers. */}
      <PageHeader back={{ to: '/apps', label: 'Apps' }} title="Reviews" lede="Look back on a day, a week, a month, a quarter, half a year or a year: your numbers, and one layer of your pyramids. Only you see this." />
      <div className="mt-md">
        <PeriodFilter period={period} onChange={setPeriod} today={today} kinds={PERIOD_KINDS} pick={reviewPeriodNow} />
      </div>

      {q.isError && (
        <p role="alert" className="mt-md m-0 rounded-tile bg-r1/15 p-sm text-subhead">
          Could not load this period. Try again in a moment.
        </p>
      )}
      {mismatch && (
        <p role="alert" className="mt-md m-0 rounded-tile bg-r1/15 p-sm text-subhead">
          {`This ${meta.short.toLowerCase()} did not load, so the numbers below are for ${d ? periodLabel(d.period) : 'another period'}. Reload the page. If it stays, the app needs an update.`}
        </p>
      )}

      <ReviewCalendar today={today} onOpenPeriod={openReview} />

      {s && (
        <>
          {/* "See what's emerging" at the top right like every other section's link, and the patterns themselves (your kinds of day, then
              Emerging) right under the numbers when one is ready (the founder, 2026-11-06). */}
          <Section id="numbers-heading" title="The numbers" lede={
            // One block per sentence, so the narrow column beside the link never leaves a stub line.
            <>
              <span className="block">{`Each one next to ${meta.previous}.`}</span>
              <span className="block">Tap a tile to go where it comes from.</span>
            </>
          } action={<SeeAll to={`/insights?kind=${period.kind}&date=${period.start}`}>See what&apos;s emerging</SeeAll>}>
            <SummaryTiles summary={s} parts={PARTS} keep={keepTile} />
          </Section>
          <KindsSlot />
          <EmergenceSlot app="reviews" max={2} exclude={['daytype-done']} />

          {/* Business metrics keep the week to the year: a day is too short for a business number. */}
          {!oneDay && <BusinessMetrics kind={period.kind} date={period.start} />}

          {oneDay ? (
            areaSegments.length > 0 && (
              <section className="mt-lg" aria-labelledby="trend-heading">
                <h2 id="trend-heading" className="text-title2">
                  Xp by pillar
                </h2>
                <div className="mt-sm flex items-center gap-md rounded-card bg-card p-md shadow-toy-soft">
                  <Donut segments={areaSegments} size={120} stroke={18} label="Xp by pillar">
                    <span className="text-title3 type-figure">{formatCount(s.now.xp)}</span>
                  </Donut>
                  <div className="min-w-0 max-w-[360px] flex-1">
                    <Legend items={areaSegments.map((a) => ({ color: a.color, label: a.label, text: `${formatCount(a.value)} xp` }))} />
                  </div>
                </div>
              </section>
            )
          ) : (
            <section className="mt-lg" aria-labelledby="trend-heading">
              <h2 id="trend-heading" className="text-title2">
                Day by day
              </h2>
              <div className="mt-sm rounded-card bg-card p-md shadow-toy-soft">
                <AreaLine values={s.series.map((p) => p.xp)} max={Math.max(40, ...s.series.map((p) => p.xp))} color="var(--color-r5)" labels={labels} allLabels={period.kind !== 'week'} height={140} label={`Xp per day, ${periodLabel(period)}`} empty="No xp in this period yet." />
              </div>
              {areaSegments.length > 0 && (
                <div className="mt-sm flex items-center gap-md rounded-card bg-card p-md shadow-toy-soft">
                  <Donut segments={areaSegments} size={120} stroke={18} label="Xp by pillar">
                    <span className="text-title3 type-figure">{formatCount(s.now.xp)}</span>
                  </Donut>
                  <div className="min-w-0 max-w-[360px] flex-1">
                    <Legend items={areaSegments.map((a) => ({ color: a.color, label: a.label, text: `${formatCount(a.value)} xp` }))} />
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Reviews by layer (2026-11-07): the layer of your own pyramids this review walks, pillar by pillar (the seven pillars are the
              core), right above the questions; "Add to my answer" puts its line under the first question, which walks this layer, and
              moves the review to that question. A day walks its tasks: ticked, open and late. */}
          {layer && (
            <Section
              id="layer-heading"
              title={
                // Two parts kept whole, broken after the comma on purpose where a phone cannot fit both ("Your goal outcomes, / this month").
                <>
                  <span className="inline-block">{`Your ${KIND_META[layer.kind].plural.toLowerCase()},`}</span>{' '}
                  <span className="inline-block">{oneDay ? (current ? 'today' : 'that day') : `${current ? 'this' : 'that'} ${meta.short.toLowerCase()}`}</span>
                </>
              }
              lede={LAYER_LEDE[period.kind]}
              action={layer.kind === 'task' ? <SeeAll to="/today">Daily</SeeAll> : <SeeAll to="/tower">Pillars</SeeAll>}
            >
              {layerCount === 0 ? (
                <p className="m-0 rounded-tile bg-card p-sm text-subhead text-ink-soft shadow-toy-soft">
                  {layer.kind === 'task' ? 'No tasks on this day. Plan some on Daily and they show up here.' : `No ${KIND_META[layer.kind].plural.toLowerCase()} yet. Add them on your pillars and they show up here.`}
                </p>
              ) : (
                <div className="flex flex-col gap-md">
                  {layer.pillars
                    .filter((g) => g.items.length > 0)
                    .map((g) => {
                      const rel = RELATIONSHIP_BY_KEY[g.relationship];
                      return (
                        <div key={g.relationship} data-pillar={g.relationship}>
                          <div className="flex items-center justify-between gap-sm">
                            <h3 className="m-0 flex min-w-0 items-center gap-xs text-headline">
                              <span aria-hidden="true" className="size-[12px] shrink-0 rounded-pill" style={{ background: rel?.color }} />
                              {rel?.name ?? g.relationship}
                            </h3>
                            {g.total > g.items.length && <SeeAll to={layer.kind === 'task' ? '/today' : `/realm/${g.relationship}`}>{`${g.total - g.items.length} more`}</SeeAll>}
                          </div>
                          <ul className="mt-xs flex list-none flex-col gap-xs p-0 m-0">
                            {g.items.map((it) => {
                              const added = Boolean(prompts.length) && (answers[0] ?? '').includes(layerLine(it, layer.kind));
                              const below = BELOW[layer.kind];
                              const belowKind = below ? KIND_META[below] : null;
                              return (
                                <li key={it.id} className="flex flex-wrap-reverse items-center justify-between gap-sm rounded-tile bg-card p-sm shadow-toy-soft">
                                  <span className="min-w-0 flex-1 basis-[60%]">
                                    <span className="block text-headline">
                                      <Inert text={it.title} />
                                    </span>
                                    {it.under && (
                                      <span className="block text-caption text-ink-soft">
                                        Holds up: <Inert text={it.under} />
                                      </span>
                                    )}
                                    <span className="mt-xs flex flex-wrap items-center gap-xs text-caption text-ink-soft">
                                      {layer.kind === 'task' ? (
                                        <StatusTag tone={it.status === 'done' ? 'good' : it.late ? 'warn' : 'neutral'}>{it.status === 'done' ? 'Done' : it.late ? 'Late' : 'Open'}</StatusTag>
                                      ) : (
                                        <>
                                          {it.status === 'done' ? <StatusTag tone="good">Cleared</StatusTag> : it.pace ? <StatusTag tone={PACE_TONE[it.pace.status]}>{it.pace.label}</StatusTag> : null}
                                          <span>
                                            {belowKind && (
                                              <>
                                                <span className="inline-block">{`${it.below} ${(it.below === 1 ? belowKind.label : belowKind.plural).toLowerCase()},`}</span>{' '}
                                              </>
                                            )}
                                            <span className="inline-block">{`${it.done} ${it.done === 1 ? 'task' : 'tasks'} ticked,`}</span> <span className="inline-block">{`${it.open} open`}</span>
                                          </span>
                                        </>
                                      )}
                                    </span>
                                  </span>
                                  <Button variant="outline" size="sm" className="ml-auto" disabled={added || prompts.length === 0} onClick={() => bringItem(it)}>
                                    {added ? 'Added' : 'Add to my answer'}
                                  </Button>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      );
                    })}
                  {emptyPillars.length > 0 && <p className="m-0 text-caption text-ink-soft">{`Nothing yet under ${emptyPillars.length === 1 ? emptyPillars[0] : `${emptyPillars.slice(0, -1).join(', ')} and ${emptyPillars[emptyPillars.length - 1]}`}.`}</p>}
                </div>
              )}
            </Section>
          )}

          {flagged.length > 0 && (
            <section className="mt-lg" aria-labelledby="brought-heading">
              <h2 id="brought-heading" className="text-title2">
                Tasks you brought
              </h2>
              <p className="mt-xs m-0 text-balance text-subhead text-ink-soft">Tick &quot;Bring it to my review&quot; on a task in Daily and it shows up here.</p>
              <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
                {flagged.map((f) => {
                  const added = Boolean(prompts.length) && (answers[slotFor(f)] ?? '').includes(lineFor(f));
                  return (
                    <li key={f.id} data-pillar={f.relationship} className="flex flex-wrap-reverse items-center justify-between gap-sm rounded-tile bg-card p-sm shadow-toy-soft">
                      {/* The title keeps 60% of the row; on a narrow phone the action wraps above it (the founder's row rule). */}
                      <span className="flex min-w-0 flex-1 basis-[60%] items-center gap-sm">
                        <span aria-hidden="true" className="size-[12px] shrink-0 rounded-pill" style={{ background: RELATIONSHIP_BY_KEY[f.relationship]?.color }} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-headline">
                            <Inert text={f.title} />
                          </span>
                          <span className="mt-xs flex flex-wrap items-center gap-xs text-caption text-ink-soft">
                            <StatusTag tone={f.status === 'done' ? 'good' : 'warn'}>{f.status === 'done' ? 'Done' : 'Open'}</StatusTag>
                            {f.day ? prettyDate(f.day) : 'No day yet'}
                          </span>
                        </span>
                      </span>
                      <Button variant="outline" size="sm" className="ml-auto" disabled={added || prompts.length === 0} onClick={() => bring(f)}>
                        {added ? 'Added' : 'Add to my answer'}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* "Your review" says the period's own review name and steps through its questions one at a time (2026-11-07, the founder). */}
          <section className="mt-lg" aria-labelledby="review-heading">
            <h2 id="review-heading" className="text-title2">
              {`Your ${reviewName.toLowerCase()}`}
            </h2>
            <p className="mt-xs m-0 text-balance text-subhead text-ink-soft">{d?.review ? 'Saved with the numbers as they were. Change anything and save again.' : `${periodLabel(period)}: a few questions, one at a time. Short answers are fine.`}</p>
            <ReviewSteps
              prompts={prompts}
              why={whyOf}
              answers={answers}
              onAnswer={(i, v) => {
                const next = prompts.map((_, j) => (j === i ? v : (answers[j] ?? '')));
                setAnswers(next);
                keep({ answers: next });
              }}
              rating={rating}
              onRating={(v) => {
                setRating(v);
                keep({ rating: v });
              }}
              highlight={highlight}
              onHighlight={(v) => {
                setHighlight(v);
                keep({ highlight: v });
              }}
              step={stepIn(step, prompts.length)}
              onStep={setStep}
              head={
                d && d.templates.length > 1 ? (
                  <>
                    <label className="block text-subhead font-semibold" htmlFor="review-template">
                      Questions from
                    </label>
                    <select
                      id="review-template"
                      value={template?.id ?? ''}
                      onChange={(e) => {
                        setTemplateId(e.target.value);
                        keep({ templateId: e.target.value });
                        setStep('1');
                      }}
                      className={FIELD}
                    >
                      {d.templates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </>
                ) : undefined
              }
              saved={Boolean(d?.review)}
              saving={save.isPending}
              failed={save.isError}
              onSave={() => save.mutate()}
              onRemove={d?.review ? () => (remove.reset(), setAskingRemove(d.review!.id)) : undefined}
              removing={remove.isPending}
            />
            <ConfirmDelete
              open={askingRemove !== null}
              title="Delete this review?"
              body={`Your answers for ${periodLabel(period)} are gone for good. This cannot be undone.`}
              pending={remove.isPending}
              failed={remove.isError}
              onYes={() => askingRemove && remove.mutate(askingRemove)}
              onClose={() => setAskingRemove(null)}
            />
          </section>

          <ReviewTemplates kind={period.kind} />

          {d && (d.recent.length > 0 || (d.recentPage?.page ?? 1) > 1 || days.length > 0 || (d.recentDaysPage?.page ?? 1) > 1) && (
            <section className="mt-lg" aria-labelledby="past-heading">
              <h2 id="past-heading" className="text-title2">
                Past reviews
              </h2>
              {(d.recent.length > 0 || (d.recentPage?.page ?? 1) > 1) && (
                <>
                  <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">{d.recent.map(pastRow)}</ul>
                  <Pager page={d.recentPage} prefix="r" label="past reviews" />
                </>
              )}
              {/* Daily reviews fold away on their own (2026-11-07), so a year of days never buries the weeks and months. */}
              {(days.length > 0 || (d.recentDaysPage?.page ?? 1) > 1) && (
                <Fold className="mt-sm" title="Daily reviews" hint={`${days.length}${d.recentDaysPage?.more ? '+' : ''}`} defaultOpen={(d.recentDaysPage?.page ?? 1) > 1}>
                  <ul className="flex list-none flex-col gap-xs p-0 m-0">{days.map(pastRow)}</ul>
                  <Pager page={d.recentDaysPage} prefix="rd" label="daily reviews" />
                </Fold>
              )}
            </section>
          )}
        </>
      )}
    </Screen>
  );
}
