import { MOODS, PERIOD_KINDS, PERIOD_META, periodFor, periodLabel, RELATIONSHIP_BY_KEY, RELATIONSHIPS, REVIEW_ANSWER_MAX, REVIEW_HIGHLIGHT_MAX, REVIEW_NAME_MAX, type Period, type PeriodKind, type ReviewTemplate } from '@kreators/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '../components/Button';
import { AreaLine, Donut, Legend } from '../components/Charts';
import { Hero } from '../components/Hero';
import { MoodFace } from '../components/MoodFace';
import { BackLink } from '../components/PageHeader';
import { PeriodFilter } from '../components/PeriodFilter';
import { SummaryTiles, type SummaryPart } from '../components/PeriodPanel';
import { Screen } from '../components/Screen';
import { Sheet } from '../components/Sheet';
import { api } from '../lib/api';
import { prettyDate, todayLocal } from '../lib/date';
import { useAuthed } from '../lib/queries';

const PARTS: readonly SummaryPart[] = ['daily', 'notToDo', 'wellbeing', 'journal', 'finance', 'shop', 'school', 'work', 'people'];
const field = 'mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]';

/** Weekly, monthly, quarterly and mid-year reviews: the numbers from every app for the period, and what you make of them. */
export function Reviews() {
  const today = todayLocal();
  const [period, setPeriod] = useState<Period>(() => periodFor('week', today));
  const qc = useQueryClient();
  const q = useAuthed(['reviews', period.kind, period.start], () => api.reviews(period.kind, period.start));
  const d = q.data;
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
  const save = useMutation({
    mutationFn: () => api.saveReview({ kind: period.kind, date: period.start, templateId: template && !template.builtIn ? template.id : null, answers, rating, highlight }),
    onSuccess: invalidate,
  });
  const remove = useMutation({ mutationFn: (id: string) => api.deleteReview(id), onSuccess: invalidate });
  const [editing, setEditing] = useState<ReviewTemplate | 'new' | null>(null);

  const s = d?.summary;
  const meta = PERIOD_META[period.kind];
  const ratingMeta = rating ? MOODS.find((m) => m.value === rating) : null;
  const areaSegments = s ? RELATIONSHIPS.filter((r) => (s.xpByArea[r.key] ?? 0) > 0).map((r) => ({ value: s.xpByArea[r.key] ?? 0, color: r.color, label: r.name })) : [];
  const labels = s ? s.series.map((p, i, all) => (period.kind === 'week' ? new Date(`${p.date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short' }) : i === 0 || i === all.length - 1 || i % Math.ceil(all.length / 6) === 0 ? String(Number(p.date.slice(8, 10))) : '')) : [];

  return (
    <Screen columns={false}>
      <header className="pt-lg">
        <BackLink to="/apps">Apps</BackLink>
        <h1 className="text-[30px]">Reviews</h1>
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Pick a week, a month, a quarter or half a year. The numbers come from every app you use. The words are yours. Only you see this.</p>
        <div className="mt-md">
          <PeriodFilter period={period} onChange={setPeriod} today={today} />
        </div>
        {s && (
          <Hero color="var(--color-r5)" deep="var(--deep-self)" className="mt-md" character="self" mood={rating ? (rating >= 4 ? 'excited' : rating >= 3 ? 'happy' : 'sleepy') : 'happy'}>
            <p className="m-0 text-[12px] font-extrabold uppercase tracking-wide opacity-90">{meta.name}</p>
            <p className="mt-xs m-0 font-display text-[28px] font-extrabold leading-tight">{periodLabel(period)}</p>
            <p className="mt-xs m-0 text-[14px] font-semibold opacity-90">
              {d?.review ? `Written ${prettyDate(d.review.updatedAt.slice(0, 10))}${ratingMeta ? `, felt ${ratingMeta.name.toLowerCase()}` : ''}.` : meta.blurb}
            </p>
            <div className="mt-sm flex flex-wrap gap-md">
              {[
                ['Xp', s.now.xp.toLocaleString()],
                ['Tasks', String(s.now.tasksDone)],
                ['Check-ins', `${s.now.checkins} of ${s.now.days}`],
              ].map(([k, v]) => (
                <span key={k} className="min-w-0">
                  <span className="block font-display text-[24px] font-extrabold leading-none">{v}</span>
                  <span className="block text-[12px] font-bold opacity-90">{k}</span>
                </span>
              ))}
            </div>
          </Hero>
        )}
      </header>

      {q.isError && (
        <p role="alert" className="mt-md m-0 rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
          Could not load this period. Try again in a moment.
        </p>
      )}

      {s && (
        <>
          <section className="mt-lg" aria-labelledby="numbers-heading">
            <h2 id="numbers-heading" className="text-[24px]">
              The numbers
            </h2>
            <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Each one next to {meta.previous}. Tap a tile to go where it comes from.</p>
            <div className="mt-sm">
              <SummaryTiles summary={s} parts={PARTS} />
            </div>
          </section>

          <section className="mt-lg" aria-labelledby="trend-heading">
            <h2 id="trend-heading" className="text-[24px]">
              Day by day
            </h2>
            <div className="mt-sm rounded-card bg-card p-md shadow-toy-soft">
              <AreaLine values={s.series.map((p) => p.xp)} max={Math.max(40, ...s.series.map((p) => p.xp))} color="var(--color-r5)" labels={labels} height={140} label={`Xp per day, ${periodLabel(period)}`} empty="No xp in this period yet." />
            </div>
            {areaSegments.length > 0 && (
              <div className="mt-sm flex items-center gap-md rounded-card bg-card p-md shadow-toy-soft">
                <Donut segments={areaSegments} size={120} stroke={18} label="Xp by area">
                  <span className="font-display text-[20px] font-extrabold">{s.now.xp}</span>
                </Donut>
                <div className="min-w-0 flex-1">
                  <Legend items={areaSegments.map((a) => ({ color: a.color, label: a.label, text: `${a.value} xp` }))} />
                </div>
              </div>
            )}
          </section>

          <section className="mt-lg" aria-labelledby="review-heading">
            <h2 id="review-heading" className="text-[24px]">
              Your review
            </h2>
            <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">{d?.review ? 'Saved with the numbers as they were. Change anything and save again.' : 'A few questions. Short answers are fine.'}</p>
            <form
              className="mt-sm rounded-card bg-card p-md shadow-toy-soft"
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                save.mutate();
              }}
            >
              {d && d.templates.length > 1 && (
                <>
                  <label className="block text-[14px] font-bold" htmlFor="review-template">
                    Questions from
                  </label>
                  <select id="review-template" value={template?.id ?? ''} onChange={(e) => setTemplateId(e.target.value)} className={field}>
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
                    <label className="block text-[16px] font-bold" htmlFor={`answer-${i}`}>
                      {p}
                    </label>
                    <textarea
                      id={`answer-${i}`}
                      value={answers[i] ?? ''}
                      onChange={(e) => setAnswers((a) => prompts.map((_, j) => (j === i ? e.target.value : (a[j] ?? ''))))}
                      rows={3}
                      maxLength={REVIEW_ANSWER_MAX}
                      className={field}
                    />
                  </li>
                ))}
              </ol>
              <p className="mt-md m-0 text-[14px] font-bold">How did it go?</p>
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
              <label className="mt-md block text-[14px] font-bold" htmlFor="review-highlight">
                The one thing to remember
              </label>
              <input id="review-highlight" value={highlight} onChange={(e) => setHighlight(e.target.value)} maxLength={REVIEW_HIGHLIGHT_MAX} placeholder="One line" className={field} />
              {save.isError && (
                <p role="alert" className="mt-sm m-0 text-[14px] font-bold">
                  That did not save. Try again.
                </p>
              )}
              <div className="mt-md flex flex-wrap gap-xs">
                <Button type="submit" disabled={save.isPending}>
                  {save.isPending ? 'Saving' : d?.review ? 'Save changes' : 'Save this review'}
                </Button>
                {d?.review && (
                  <Button variant="outline" onClick={() => remove.mutate(d.review!.id)} disabled={remove.isPending}>
                    Remove
                  </Button>
                )}
              </div>
            </form>
          </section>

          <section className="mt-lg" aria-labelledby="templates-heading">
            <div className="flex items-baseline justify-between gap-sm">
              <h2 id="templates-heading" className="text-[24px]">
                Templates
              </h2>
              <Button variant="outline" size="sm" onClick={() => setEditing('new')}>
                New template
              </Button>
            </div>
            <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">The questions a {meta.short.toLowerCase()} review asks. The built-in one stays; add your own for a cadence and it comes back every time.</p>
            <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
              {d?.templates.map((t) => (
                <li key={t.id} className="flex items-center gap-sm rounded-tile bg-card p-sm shadow-toy-soft">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[16px] font-bold">{t.name}</span>
                    <span className="block text-[14px] font-semibold text-ink-soft">
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

          {d && d.recent.length > 0 && (
            <section className="mt-lg" aria-labelledby="past-heading">
              <h2 id="past-heading" className="text-[24px]">
                Past reviews
              </h2>
              <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
                {d.recent.map((r) => {
                  const m = r.rating ? MOODS.find((x) => x.value === r.rating) : null;
                  return (
                    <li key={r.id}>
                      <button type="button" onClick={() => setPeriod({ kind: r.kind, start: r.start, end: r.end })} className="toy toy-soft flex w-full items-center gap-sm rounded-tile bg-card p-sm text-left text-ink">
                        {m ? <MoodFace value={m.value} size={36} /> : <span className="flex size-[36px] items-center justify-center rounded-pill bg-paper text-[14px] font-extrabold text-ink-soft">·</span>}
                        <span className="min-w-0 flex-1">
                          <span className="block text-[16px] font-bold">{periodLabel({ kind: r.kind, start: r.start, end: r.end })}</span>
                          <span className="block truncate text-[14px] font-semibold text-ink-soft">{r.highlight || PERIOD_META[r.kind].name}</span>
                        </span>
                        <span className="shrink-0 rounded-pill bg-paper px-xs text-[12px] font-extrabold leading-[24px] text-ink-soft">{PERIOD_META[r.kind].short}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
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
  const remove = useMutation({
    mutationFn: () => api.reviewTemplateRemove(existing!.id),
    onSuccess: () => {
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
        <label className="block text-[14px] font-bold" htmlFor="tpl-name">
          Name
        </label>
        <input id="tpl-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={REVIEW_NAME_MAX} placeholder="Money month" className={field} />
        {!existing && (
          <>
            <label className="mt-sm block text-[14px] font-bold" htmlFor="tpl-kind">
              Comes back every
            </label>
            <select id="tpl-kind" value={cadence} onChange={(e) => setCadence(e.target.value as PeriodKind)} className={field}>
              {PERIOD_KINDS.map((k) => (
                <option key={k} value={k}>
                  {PERIOD_META[k].short.toLowerCase()}
                </option>
              ))}
            </select>
          </>
        )}
        <label className="mt-sm block text-[14px] font-bold" htmlFor="tpl-prompts">
          Questions, one per line
        </label>
        <textarea id="tpl-prompts" value={text} onChange={(e) => setText(e.target.value)} rows={6} placeholder={'What did you earn?\nWhat did you waste?'} className={field} />
        {(save.isError || remove.isError) && (
          <p role="alert" className="m-0 text-[14px] font-bold">
            That did not save. Try again.
          </p>
        )}
        <div className="mt-md flex flex-wrap gap-xs">
          <Button type="submit" disabled={!name.trim() || prompts.length === 0 || save.isPending}>
            {existing ? 'Save changes' : 'Add template'}
          </Button>
          {existing && (
            <Button variant="outline" onClick={() => remove.mutate()} disabled={remove.isPending}>
              Remove
            </Button>
          )}
        </div>
      </form>
    </Sheet>
  );
}
