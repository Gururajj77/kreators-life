import { PageHeader } from '../components/PageHeader';
import { MOODS, PERIOD_KINDS, PERIOD_META, periodFor, periodLabel, RELATIONSHIP_BY_KEY, RELATIONSHIPS, REVIEW_ANSWER_MAX, REVIEW_HIGHLIGHT_MAX, REVIEW_NAME_MAX, type Period, type PeriodKind, type ReviewFlagged, type ReviewTemplate, type ReviewsResponse, type Page, LOCALE } from '@kreators/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import { BusinessMetrics } from '../components/BusinessMetrics';
import { Button } from '../components/Button';
import { AreaLine, Donut, Legend } from '../components/Charts';
import { Inert } from '../components/Inert';
import { MoodFace } from '../components/MoodFace';
import { PeriodFilter } from '../components/PeriodFilter';
import { ReviewCalendar } from '../components/ReviewCalendar';
import { StatusTag } from '../components/StatusTag';
import { SummaryTiles, type SummaryPart } from '../components/PeriodPanel';
import { Screen } from '../components/Screen';
import { Section, SeeAll } from '../components/Section';
import { Pager, usePage } from '../components/Pager';
import { Sheet } from '../components/Sheet';
import { ConfirmDelete } from '../components/ConfirmDelete';
import { api } from '../lib/api';
import { prettyDate, todayLocal } from '../lib/date';
import { useAuthed } from '../lib/queries';
import { FIELD } from '../lib/ui';
import { FactTag } from '../components/FactTag';
import { EmergenceSlot, KindsSlot } from '../components/EmergenceSlot';

const PARTS: readonly SummaryPart[] = ['daily', 'kinds', 'notToDo', 'wellbeing', 'journal', 'finance', 'shop', 'school', 'work', 'people'];

/** Weekly, monthly, quarterly and mid-year reviews: the numbers from every app for the period, and what you make of them. */
export function Reviews() {
  const today = todayLocal();
  // A reminder opens a period by its kind and first day in the address; after that the period lives here.
  const [params] = useSearchParams();
  const [period, setPeriod] = useState<Period>(() => {
    const kind = params.get('kind');
    const date = params.get('date');
    return kind && (PERIOD_KINDS as readonly string[]).includes(kind) && date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? periodFor(kind as PeriodKind, date) : periodFor('week', today);
  });
  const qc = useQueryClient();
  // Past reviews come a page at a time (prefix 'r'). api.reviews only takes a day, so the page rides on its query string
  // until it takes the page itself (lib/api.ts belongs to another stream).
  const rp = usePage('r');
  const q = useAuthed(['reviews', period.kind, period.start, rp.query], () => api.reviews(period.kind, `${period.start}&${rp.query}`));
  const d = q.data as (ReviewsResponse & { recentPage?: Page }) | undefined;
  const invalidate = () => qc.invalidateQueries({ queryKey: ['reviews'] });

  // The form follows the saved review for this period, or starts from the built-in template.
  const [templateId, setTemplateId] = useState(`builtin:${period.kind}`);
  const [answers, setAnswers] = useState<string[]>([]);
  const [rating, setRating] = useState<number | null>(null);
  const [highlight, setHighlight] = useState('');
  const reviewStamp = d?.review ? `${d.review.id}:${d.review.updatedAt}` : 'none';
  useEffect(() => {
    if (!d) return;
    if (d.review) {
      setTemplateId(d.review.templateId ?? `builtin:${d.review.kind}`);
      setAnswers(d.review.answers);
      setRating(d.review.rating);
      setHighlight(d.review.highlight);
    } else {
      setTemplateId(`builtin:${period.kind}`);
      setAnswers([]);
      setRating(null);
      setHighlight('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewStamp, period.kind, period.start, Boolean(d)]);

  const template = d?.templates.find((t) => t.id === templateId) ?? d?.templates[0] ?? null;
  // A saved review keeps its own prompts even after its template changed or went.
  const prompts = d?.review && d.review.templateId === (template?.builtIn ? null : template?.id) ? d.review.prompts : (template?.prompts ?? []);
  // A task brought to this review. A saved review keeps the list it was saved with; one saved before this existed shows the live list.
  const flagged: ReviewFlagged[] = d?.review?.snapshot?.flagged ?? d?.summary.flagged ?? [];
  const lineFor = (f: ReviewFlagged) => `${f.status === 'done' ? 'Done' : 'Still open'}: ${f.title}`;
  const slotFor = (f: ReviewFlagged) => Math.min(f.status === 'done' ? 0 : 1, Math.max(0, prompts.length - 1));
  const bring = (f: ReviewFlagged) => {
    if (prompts.length === 0) return;
    const at = slotFor(f);
    const line = lineFor(f);
    setAnswers((a) => prompts.map((_, j) => (j === at ? [a[j] ?? '', line].filter(Boolean).join('\n').slice(0, REVIEW_ANSWER_MAX) : (a[j] ?? ''))));
  };
  const openReview = (p: Period) => {
    setPeriod(p);
    window.setTimeout(() => document.getElementById('review-heading')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 400);
  };
  const save = useMutation({
    mutationFn: () => api.saveReview({ kind: period.kind, date: period.start, templateId: template && !template.builtIn ? template.id : null, answers, rating, highlight }),
    onSuccess: invalidate,
  });
  const [askingRemove, setAskingRemove] = useState<string | null>(null);
  const remove = useMutation({
    mutationFn: (id: string) => api.deleteReview(id),
    onSuccess: () => {
      setAskingRemove(null);
      invalidate();
    },
  });
  const [editing, setEditing] = useState<ReviewTemplate | 'new' | null>(null);

  const s = d?.summary;
  const meta = PERIOD_META[period.kind];
  const areaSegments = s ? RELATIONSHIPS.filter((r) => (s.xpByArea[r.key] ?? 0) > 0).map((r) => ({ value: s.xpByArea[r.key] ?? 0, color: r.color, label: r.name })) : [];
  const labels = s ? s.series.map((p, i, all) => (period.kind === 'week' ? new Date(`${p.date}T00:00:00`).toLocaleDateString(LOCALE, { weekday: 'short' }) : i === 0 || i === all.length - 1 || i % Math.ceil(all.length / 6) === 0 ? String(Number(p.date.slice(8, 10))) : '')) : [];

  return (
    <Screen columns={false}>
      {/* The app cover (2026-11-06, the founder: "the hero cover with back button, title and helper text in a card/cover like the other
          pages"): Reviews wears the cover, so by the hero rule no coloured Hero; the period's numbers are under The numbers. */}
      <PageHeader back={{ to: '/apps', label: 'Apps' }} title="Reviews" lede="Look back on a week, a month, a quarter or half a year, with numbers from every app you use. Only you see this." />
      <div className="mt-md">
        <PeriodFilter period={period} onChange={setPeriod} today={today} />
      </div>

      {q.isError && (
        <p role="alert" className="mt-md m-0 rounded-tile bg-r1/15 p-sm text-subhead">
          Could not load this period. Try again in a moment.
        </p>
      )}

      <ReviewCalendar today={today} onOpenPeriod={openReview} />

      {s && (
        <>
          {/* "See what's emerging" at the top right like every other section's link, and the patterns themselves (your kinds of day, then
              Emerging) right under the numbers when one is ready (the founder, 2026-11-06). */}
          <Section id="numbers-heading" title="The numbers" lede={`Each one next to ${meta.previous}. Tap a tile to go where it comes from.`} action={<SeeAll to="/insights">See what&apos;s emerging</SeeAll>}>
            <SummaryTiles summary={s} parts={PARTS} />
          </Section>
          <KindsSlot />
          <EmergenceSlot app="reviews" max={2} exclude={['daytype-done']} />

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
                    <li key={f.id} data-pillar={f.relationship} className="flex items-center gap-sm rounded-tile bg-card p-sm shadow-toy-soft">
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
                      <Button variant="outline" size="sm" disabled={added || prompts.length === 0} onClick={() => bring(f)}>
                        {added ? 'Added' : 'Add to my answer'}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <BusinessMetrics kind={period.kind} date={period.start} />

          <section className="mt-lg" aria-labelledby="trend-heading">
            <h2 id="trend-heading" className="text-title2">
              Day by day
            </h2>
            <div className="mt-sm rounded-card bg-card p-md shadow-toy-soft">
              <AreaLine values={s.series.map((p) => p.xp)} max={Math.max(40, ...s.series.map((p) => p.xp))} color="var(--color-r5)" labels={labels} height={140} label={`Xp per day, ${periodLabel(period)}`} empty="No xp in this period yet." />
            </div>
            {areaSegments.length > 0 && (
              <div className="mt-sm flex items-center gap-md rounded-card bg-card p-md shadow-toy-soft">
                <Donut segments={areaSegments} size={120} stroke={18} label="Xp by pillar">
                  <span className="text-title3 type-figure">{s.now.xp}</span>
                </Donut>
                <div className="min-w-0 flex-1">
                  <Legend items={areaSegments.map((a) => ({ color: a.color, label: a.label, text: `${a.value} xp` }))} />
                </div>
              </div>
            )}
          </section>

          <section className="mt-lg" aria-labelledby="review-heading">
            <h2 id="review-heading" className="text-title2">
              Your review
            </h2>
            <p className="mt-xs m-0 text-subhead text-ink-soft">{d?.review ? 'Saved with the numbers as they were. Change anything and save again.' : 'A few questions. Short answers are fine.'}</p>
            <form
              className="mt-sm rounded-card bg-card p-md shadow-toy-soft"
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                save.mutate();
              }}
            >
              {d && d.templates.length > 1 && (
                <>
                  <label className="block text-subhead font-semibold" htmlFor="review-template">
                    Questions from
                  </label>
                  <select id="review-template" value={template?.id ?? ''} onChange={(e) => setTemplateId(e.target.value)} className={FIELD}>
                    {d.templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </>
              )}
              <ol className="mt-sm flex list-none flex-col gap-sm p-0 m-0">
                {prompts.map((p, i) => (
                  <li key={`${template?.id ?? 'r'}-${i}`}>
                    <label className="block text-headline" htmlFor={`answer-${i}`}>
                      {p}
                    </label>
                    <textarea
                      id={`answer-${i}`}
                      value={answers[i] ?? ''}
                      onChange={(e) => setAnswers((a) => prompts.map((_, j) => (j === i ? e.target.value : (a[j] ?? ''))))}
                      rows={3}
                      maxLength={REVIEW_ANSWER_MAX}
                      className={FIELD}
                    />
                  </li>
                ))}
              </ol>
              <p className="mt-md m-0 text-subhead font-semibold">How did it go?</p>
              <div role="radiogroup" aria-label="How did it go" className="mt-xs flex gap-xs">
                {MOODS.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    role="radio"
                    aria-checked={rating === m.value}
                    aria-label={m.name}
                    onClick={() => setRating(rating === m.value ? null : m.value)}
                    className={`toy flex size-[48px] items-center justify-center rounded-pill border-2 ${rating === m.value ? 'border-ink bg-ink' : 'toy-soft border-line bg-card'}`}
                  >
                    <MoodFace value={m.value} size={32} />
                  </button>
                ))}
              </div>
              <label className="mt-md block text-subhead font-semibold" htmlFor="review-highlight">
                The one thing to remember
              </label>
              <input id="review-highlight" value={highlight} onChange={(e) => setHighlight(e.target.value)} maxLength={REVIEW_HIGHLIGHT_MAX} placeholder="One line" className={FIELD} />
              {save.isError && (
                <p role="alert" className="mt-sm m-0 text-subhead">
                  That did not save. Try again.
                </p>
              )}
              {/* The main Save takes the width and Remove sits at its right on the same line (2026-11-06, the founder's form rule). */}
              <div className="mt-md flex gap-xs">
                <Button type="submit" disabled={save.isPending} className="min-w-0 flex-1">
                  {save.isPending ? 'Saving' : d?.review ? 'Save changes' : 'Save this review'}
                </Button>
                {d?.review && (
                  <Button variant="outline" onClick={() => setAskingRemove(d.review!.id)} disabled={remove.isPending}>
                    Remove
                  </Button>
                )}
              </div>
            </form>
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

          <section className="mt-lg" aria-labelledby="templates-heading">
            <div className="flex items-baseline justify-between gap-sm">
              <h2 id="templates-heading" className="text-title2">
                Templates
              </h2>
              <Button variant="outline" size="sm" plusToX onClick={() => setEditing('new')}>
                New template
              </Button>
            </div>
            <p className="mt-xs m-0 text-subhead text-ink-soft">The questions a {meta.short.toLowerCase()} review asks. The built-in one stays; add your own for a cadence and it comes back every time.</p>
            <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
              {d?.templates.map((t) => (
                <li key={t.id} className="flex items-center gap-sm rounded-tile bg-card p-sm shadow-toy-soft">
                  <span className="min-w-0 flex-1">
                    <span className="block text-card-title">{t.name}</span>
                    <span className="block text-card-note text-ink-soft">
                      {t.prompts.length} {t.prompts.length === 1 ? 'question' : 'questions'}
                      {t.builtIn ? ' · built in' : ''}
                    </span>
                  </span>
                  {!t.builtIn && (
                    <Button variant="outline" size="sm" onClick={() => setEditing(t)}>
                      Edit
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </section>

          {d && (d.recent.length > 0 || (d.recentPage?.page ?? 1) > 1) && (
            <section className="mt-lg" aria-labelledby="past-heading">
              <h2 id="past-heading" className="text-title2">
                Past reviews
              </h2>
              <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
                {d.recent.map((r) => {
                  const m = r.rating ? MOODS.find((x) => x.value === r.rating) : null;
                  return (
                    <li key={r.id}>
                      <button type="button" onClick={() => setPeriod({ kind: r.kind, start: r.start, end: r.end })} className="toy toy-soft flex w-full items-center gap-sm rounded-tile bg-card p-sm text-left text-ink">
                        {m ? <MoodFace value={m.value} size={36} /> : <span className="flex size-[36px] items-center justify-center rounded-pill bg-paper text-subhead font-medium text-ink-soft">·</span>}
                        <span className="min-w-0 flex-1">
                          <span className="block text-card-title">{periodLabel({ kind: r.kind, start: r.start, end: r.end })}</span>
                          <span className="block truncate text-card-note text-ink-soft">{r.highlight || PERIOD_META[r.kind].name}</span>
                        </span>
                        <FactTag kind="when">{PERIOD_META[r.kind].short}</FactTag>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <Pager page={d.recentPage} prefix="r" label="past reviews" />
            </section>
          )}
        </>
      )}

      <TemplateEditor editing={editing} kind={period.kind} onClose={() => setEditing(null)} onSaved={invalidate} />
    </Screen>
  );
}

function TemplateEditor({ editing, kind, onClose, onSaved }: { editing: ReviewTemplate | 'new' | null; kind: PeriodKind; onClose: () => void; onSaved: () => void }) {
  const open = editing !== null;
  const existing = editing && editing !== 'new' ? editing : null;
  const [name, setName] = useState('');
  const [cadence, setCadence] = useState<PeriodKind>(kind);
  const [text, setText] = useState('');
  useEffect(() => {
    if (!open) return;
    setName(existing?.name ?? '');
    setCadence(existing?.kind ?? kind);
    setText(existing?.prompts.join('\n') ?? '');
  }, [open, existing, kind]);
  const prompts = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const save = useMutation({
    mutationFn: () => (existing ? api.reviewTemplateUpdate(existing.id, { name: name.trim(), prompts }) : api.reviewTemplateAdd({ kind: cadence, name: name.trim(), prompts })),
    onSuccess: () => {
      onSaved();
      onClose();
    },
  });
  const [asking, setAsking] = useState(false);
  const remove = useMutation({
    mutationFn: () => api.reviewTemplateRemove(existing!.id),
    onSuccess: () => {
      setAsking(false);
      onSaved();
      onClose();
    },
  });
  return (
    <Sheet open={open} onClose={onClose} title={existing ? 'Edit template' : 'New template'}>
      <form
        className="flex flex-col gap-sm pb-xl"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <label className="block text-subhead font-semibold" htmlFor="tpl-name">
          Name
        </label>
        <input id="tpl-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={REVIEW_NAME_MAX} placeholder="Money month" className={FIELD} />
        {!existing && (
          <>
            <label className="mt-sm block text-subhead font-semibold" htmlFor="tpl-kind">
              Comes back every
            </label>
            <select id="tpl-kind" value={cadence} onChange={(e) => setCadence(e.target.value as PeriodKind)} className={FIELD}>
              {PERIOD_KINDS.map((k) => (
                <option key={k} value={k}>
                  {PERIOD_META[k].short.toLowerCase()}
                </option>
              ))}
            </select>
          </>
        )}
        <label className="mt-sm block text-subhead font-semibold" htmlFor="tpl-prompts">
          Questions, one per line
        </label>
        <textarea id="tpl-prompts" value={text} onChange={(e) => setText(e.target.value)} rows={6} placeholder={'What did you earn?\nWhat did you waste?'} className={FIELD} />
        {(save.isError || remove.isError) && (
          <p role="alert" className="m-0 text-subhead">
            That did not save. Try again.
          </p>
        )}
        <div className="mt-md flex gap-xs">
          <Button type="submit" disabled={!name.trim() || prompts.length === 0 || save.isPending} className="min-w-0 flex-1">
            {existing ? 'Save changes' : 'Add template'}
          </Button>
          {existing && (
            <Button variant="outline" onClick={() => setAsking(true)} disabled={remove.isPending}>
              Remove
            </Button>
          )}
        </div>
      </form>
      <ConfirmDelete
        open={asking}
        title="Remove this template?"
        body={`“${existing?.name ?? ''}” and its questions are gone. Reviews already saved keep their questions.`}
        yes="Yes, remove it"
        pending={remove.isPending}
        failed={remove.isError}
        onYes={() => remove.mutate()}
        onClose={() => setAsking(false)}
      />
    </Sheet>
  );
}
