import { COACH_REPORT_KINDS } from '@kreators/shared/coachReport';
import { COACH_NOTE_MAX, COACH_SHARE_META, COACH_SHARE_PARTS, formatCount, KIND_META, PENALTIES, periodFor, periodLabel, RELATIONSHIP_BY_KEY, RELATIONSHIPS, SCORE_LABEL, SCORECARD, weightWord, type CoachReview, type CoachShare, type CoachSharePart, type CoachStudentView, type Period, type PeriodKind } from '@kreators/shared';
import { useMutation } from '@tanstack/react-query';
import gsap from 'gsap';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { Button } from '../components/Button';
import { WeekDots } from '../components/Charts';
import { CoachFold, ShowOnThisPage, useCoachSections } from '../components/CoachSections';
import { CoachPatterns } from '../components/CoachPatterns';
import { ReportCharts, ReportNumbers, ReportPillars } from '../components/CoachReportParts';
import { TaskLine } from '../components/CoachTaskLine';
import { CoachTaskSheet, type CoachEditing } from '../components/CoachTaskSheet';
import { ConfirmDelete } from '../components/ConfirmDelete';
import { ErrorLine } from '../components/ErrorLine';
import { Fold } from '../components/Fold';
import { Hero, HeroNumber } from '../components/Hero';
import { Inert } from '../components/Inert';
import { PlacementChart, ScoreRow } from '../components/LifeMap';
import { BackLink } from '../components/PageHeader';
import { Pager, usePage } from '../components/Pager';
import { PeriodFilter } from '../components/PeriodFilter';
import { Screen } from '../components/Screen';
import { Skeleton, SkeletonList } from '../components/Skeleton';
import { StatusTag } from '../components/StatusTag';
import { TabRow } from '../components/TabRow';
import { api } from '../lib/api';
import { clockOf, dateTime, longDate, shortDay } from '../lib/date';
import { useAuthed } from '../lib/queries';
import { FIELD } from '../lib/ui';
import { useParamState } from '../lib/useParamState';

const when = dateTime;
const LAYERS_WORD: Record<string, string> = { task: 'Their tasks', project: 'Their projects', outcome: 'Their goal outcomes', value_goal: 'Their value goals', principle: 'Their guiding principles', pillar: 'Their foundations' };
/** Which fold each shared part opens, from the row of parts. */
const PART_FOLD: Record<CoachSharePart, { key: string; id: string }> = {
  daily: { key: 'day', id: 'day-heading' },
  pillars: { key: 'pillars', id: 'pillars-heading' },
  routine: { key: 'routine', id: 'routine-heading' },
  lifeMap: { key: 'map', id: 'map-heading' },
  reflection: { key: 'reviews', id: 'reviews-heading' },
  patterns: { key: 'patterns', id: 'patterns-heading' },
};

/** Scrolls a part's section to just under the stuck bar. Reduced motion jumps instead of sliding. */
function jumpTo(id: string) {
  const heading = document.getElementById(id);
  const bar = document.getElementById('share-bar');
  if (!heading) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const stuckAt = bar ? parseFloat(getComputedStyle(bar).top) || 0 : 0;
  const top = heading.getBoundingClientRect().top + window.scrollY - stuckAt - (bar?.offsetHeight ?? 0) - 16;
  window.scrollTo({ top, behavior: reduce ? 'auto' : 'smooth' });
}

/**
 * The parts a student shares, as a row that sticks to the top of the screen. Flat while it sits in the page; once it sticks, a frosted backdrop and a
 * hairline fade in. On a phone the strip reaches up behind the logo and the corner buttons, and the chips sit under them. A tap opens that
 * part's section and goes there; a part they do not share is struck through and cannot be picked.
 */
function ShareBar({ share, onPick }: { share: CoachShare; onPick: (part: CoachSharePart) => void }) {
  const sentinel = useRef<HTMLDivElement>(null);
  const backdrop = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setStuck(Boolean(e && !e.isIntersecting && e.boundingClientRect.top < 0)));
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (!backdrop.current) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      gsap.set(backdrop.current, { opacity: stuck ? 1 : 0 });
      return;
    }
    const tween = gsap.to(backdrop.current, { opacity: stuck ? 1 : 0, duration: 0.25, ease: 'power2.out' });
    return () => {
      tween.kill();
    };
  }, [stuck]);
  return (
    <>
      <div ref={sentinel} aria-hidden="true" />
      <div id="share-bar" className="sticky top-0 z-20 -mx-md md:-mx-lg">
        <div ref={backdrop} aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 -top-[calc(64px+env(safe-area-inset-top))] border-b border-line bg-paper/85 opacity-0 backdrop-blur-md md:top-0" />
        <nav aria-label="What they share" className="relative px-md py-sm md:px-lg">
          <TabRow
            label="What they share"
            items={COACH_SHARE_PARTS.map((k) => ({ key: k, label: COACH_SHARE_META[k].name, disabled: !share[k], title: share[k] ? undefined : 'They do not share this' }))}
            onChange={(k) => onPick(k)}
            pillClass={(_on, off) => (off ? 'inline-flex min-h-[44px] items-center rounded-pill bg-line px-sm text-caption font-medium text-ink-soft line-through' : 'toy toy-soft inline-flex min-h-[44px] items-center rounded-pill bg-card px-sm text-caption font-medium text-ink')}
          />
        </nav>
      </div>
    </>
  );
}

/** A number about the person for the hero: their streak, else wellbeing, else how much they share. Sage's mood follows it. */
function heroOf(d: CoachStudentView): { eyebrow: string; value: number; unit?: string; label: string; mood: 'excited' | 'happy' | 'sleepy' } {
  if (d.daily) return { eyebrow: 'Streak', value: d.daily.streak, unit: d.daily.streak === 1 ? 'day' : 'days', label: `Best ${formatCount(d.daily.bestStreak)}. ${d.daily.checkedIn ? 'Checked in today.' : 'Not checked in today.'}`, mood: d.daily.streak >= 7 ? 'excited' : d.daily.streak > 0 ? 'happy' : 'sleepy' };
  if (d.reflection) return { eyebrow: 'Wellbeing', value: d.reflection.wellbeing.score, unit: 'of 100', label: d.reflection.wellbeing.label, mood: d.reflection.wellbeing.score >= 60 ? 'happy' : 'sleepy' };
  const on = COACH_SHARE_PARTS.filter((k) => d.link.share[k]).length;
  return { eyebrow: 'They share', value: on, unit: `of ${COACH_SHARE_PARTS.length}`, label: 'parts of their progress with you.', mood: on > 0 ? 'happy' : 'sleepy' };
}

/** One saved review: its own name and period, the answers, and the layer it walks only while Pillars is shared too. Never the snapshot. */
function ReviewFold({ r }: { r: CoachReview }) {
  return (
    <li>
      <Fold title={r.name} hint={`${periodLabel({ kind: r.kind, start: r.start, end: r.end })}${r.rating ? `, ${r.rating} of 5` : ''}`}>
        <div className="rounded-tile bg-card p-sm shadow-toy-soft">
          <dl className="m-0 grid gap-xs text-subhead">
            {r.prompts.map((p, i) =>
              r.answers[i] ? (
                <div key={i}>
                  <dt className="text-ink-soft">{p}</dt>
                  <dd className="m-0 whitespace-pre-wrap"><Inert text={r.answers[i]} /></dd>
                </div>
              ) : null,
            )}
          </dl>
          {!r.answers.some(Boolean) && <p className="m-0 text-subhead text-ink-soft">No answers written.</p>}
          {r.layer && r.layer.pillars.some((x) => x.items.length > 0) && (
            <div className="mt-sm">
              <h4 className="m-0 text-subhead font-semibold">{LAYERS_WORD[r.layer.kind] ?? 'The layer'}</h4>
              <ul className="mt-xs m-0 flex list-none flex-col gap-xs p-0 text-subhead">
                {r.layer.pillars.flatMap((x) =>
                  x.items.map((it) => (
                    <li key={it.id} className="flex flex-wrap items-center justify-between gap-xs">
                      <span className="min-w-[60%] flex-1">
                        {it.title} <span className="text-ink-soft">({RELATIONSHIP_BY_KEY[x.relationship].name})</span>
                      </span>
                      {it.pace && <StatusTag tone={it.pace.status === 'on' ? 'good' : it.pace.status === 'behind' ? 'bad' : it.pace.status === 'slipping' ? 'warn' : 'neutral'}>{it.pace.label}</StatusTag>}
                    </li>
                  )),
                )}
              </ul>
            </div>
          )}
        </div>
      </Fold>
    </li>
  );
}

function RoutinePart({ routine }: { routine: NonNullable<CoachStudentView['routine']> }) {
  const contract = routine.contract;
  return (
    <>
      <WeekDots days={routine.week.days.map(Boolean)} color="var(--color-r4)" label={`Routine kept ${routine.week.done} of the last 7 days`} />
      {contract ? (
        <ul className="mt-sm m-0 flex list-none flex-col gap-xs p-0 text-subhead">
          <li>At least {contract.minDays} days a week. These seven days: {routine.week.done}.</li>
          <li>Check-in at {clockOf(contract.checkinTime)}.</li>
          <li>A short week: {PENALTIES.find((p) => p.key === contract.penalty)?.name.toLowerCase() ?? 'the streak breaks'}.</li>
          <li>Weekly review on {longDate(contract.nextWeekly)}, monthly review on {longDate(contract.nextMonthly)}.</li>
        </ul>
      ) : (
        <p className="mt-sm m-0 text-subhead text-ink-soft">No contract signed yet.</p>
      )}
      {routine.general.length > 0 && (
        <ol className="mt-sm m-0 flex list-none flex-col gap-xs p-0">
          {routine.general.map((b) => (
            <li key={b.key} className="rounded-tile bg-card p-sm shadow-toy-soft">
              <p className="m-0 text-card-title">{b.name}</p>
              <p className="m-0 text-card-note text-ink-soft">
                {clockOf(b.start)} to {clockOf(b.end)}
                {b.steps.length > 0 ? `. ${b.steps.join(', ')}` : ''}
              </p>
            </li>
          ))}
        </ol>
      )}
      {routine.today && <p className="mt-sm m-0 text-subhead font-semibold">Today’s morning: {routine.today.done ? 'done' : `${routine.today.steps.length} steps ticked so far`}.</p>}
    </>
  );
}

function MapPart({ map }: { map: NonNullable<CoachStudentView['lifeMap']> }) {
  return (
    <>
      <PlacementChart placements={map.placements} focus={map.focus} />
      <h3 className="mt-md text-headline">Scores</h3>
      <ul className="mt-xs m-0 flex list-none flex-col gap-xs p-0">
        {[...SCORECARD.health, ...SCORECARD.wealth].map((k) => (
          <ScoreRow key={k} label={SCORE_LABEL[k]} value={map.scores[k]} color="var(--deep-self)" />
        ))}
        {RELATIONSHIPS.map((r) => (
          <ScoreRow key={r.key} label={r.name} value={map.scores[r.key]} color={r.color} />
        ))}
      </ul>
      {(map.fears.length > 0 || map.insecurities.length > 0) && (
        <>
          <h3 className="mt-md text-headline">What gets in the way</h3>
          <ul className="mt-xs m-0 flex list-none flex-col gap-xs p-0">
            {map.fears.map((f) => (
              <li key={`f-${f.text}`} className="rounded-tile bg-card p-sm text-subhead font-semibold shadow-toy-soft">
                {f.text} <span className="text-ink-soft">({RELATIONSHIP_BY_KEY[f.relationship].name}; {f.drives === 'yes' ? 'drives decisions' : f.drives === 'sometimes' ? 'sometimes drives them' : 'does not drive them'})</span>
              </li>
            ))}
            {map.insecurities.map((it, i) => (
              <li key={`i-${i}`} className="rounded-tile bg-card p-sm text-subhead font-semibold shadow-toy-soft">
                {it.text} <span className="text-ink-soft">({RELATIONSHIP_BY_KEY[it.relationship].name}; weighs {weightWord(it.weight).toLowerCase()})</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

const isReportKind = (v: string): v is PeriodKind => (COACH_REPORT_KINDS as readonly string[]).includes(v);

/**
 * One student, as their life coach sees them (2026-11-07): a plain header and a hero holding a number about them, the period in the address, then the
 * report in sections that each fold, and that the coach can hide. Each part only while the student shares it, read fresh on every request; what
 * they do not share never left the server. The change log is the same lines they see.
 */
export function CoachStudent() {
  const { id = '' } = useParams();
  const rev = usePage('rev');
  const revd = usePage('revd');
  const ct = usePage('ct');
  const notePg = usePage('note');
  const logPg = usePage('log');
  const query = `${rev.query}&${revd.query}&${ct.query}&${notePg.query}&${logPg.query}`;
  const q = useAuthed(['coach-student', id, query], () => api.coachStudent(id, query));
  const sections = useCoachSections(true);
  const [kindRaw, setKind] = useParamState('period', 'week');
  const [dateRaw, setDate] = useParamState('date', '');
  const [editing, setEditing] = useState<CoachEditing | null>(null);
  const [note, setNote] = useState('');
  const noteBox = useRef<HTMLTextAreaElement>(null);
  const [unnoting, setUnnoting] = useState<string | null>(null);
  const [ending, setEnding] = useState(false);
  const write = useMutation({
    mutationFn: () => api.coachNote(id, note),
    onSuccess: () => {
      setNote('');
      void q.refetch();
    },
  });
  const takeBack = useMutation({
    mutationFn: (noteId: string) => api.removeCoachNote(id, noteId),
    onSuccess: () => {
      setUnnoting(null);
      void q.refetch();
    },
  });
  const end = useMutation({
    mutationFn: (linkId: string) => api.endCoach(linkId),
    onSuccess: () => {
      setEnding(false);
      void q.refetch();
    },
  });
  const d = q.data;
  const today = d?.date ?? '';
  const kind: PeriodKind = isReportKind(kindRaw) ? kindRaw : 'week';
  const period: Period | null = today ? periodFor(kind, /^\d{4}-\d{2}-\d{2}$/.test(dateRaw) && dateRaw <= today ? dateRaw : today) : null;
  // A heavy read on the server, so only while something on the page draws it.
  const wantReport = ['numbers', 'charts', 'pillars'].some((k) => sections.state(k) === 'open');
  const report = useAuthed(['coach-report', id, period?.kind, period?.start], () => api.coachReport(id, kind, period?.start ?? today), Boolean(period) && wantReport);
  const pickPeriod = (p: Period) => {
    setKind(p.kind);
    setDate(p.start === periodFor(p.kind, today).start ? '' : p.start);
  };
  // Opening a prefilled note: the words land in the box, the coach edits them, and nothing is sent until they say so.
  const prefillNote = useCallback(
    (text: string) => {
      setNote(text);
      sections.set('notes', 'open');
      requestAnimationFrame(() => {
        noteBox.current?.scrollIntoView({ block: 'center' });
        noteBox.current?.focus();
      });
    },
    [sections],
  );
  const reload = () => {
    void q.refetch();
    void report.refetch();
  };
  if (q.isError)
    return (
      <Screen>
        <header className="pt-lg">
          <BackLink to="/coaching">Coaching</BackLink>
          <h1 className="text-large-title">Not your student</h1>
          <p className="mt-xs m-0 text-subhead text-ink-soft">{q.error instanceof Error ? q.error.message : 'That did not work.'}</p>
        </header>
      </Screen>
    );
  if (!d || !period)
    return (
      <Screen howTo={false}>
        <header className="pt-lg">
          <BackLink to="/coaching">Coaching</BackLink>
        </header>
        <SkeletonList className="mt-md" count={3} lines={2} label="Loading this student" />
      </Screen>
    );
  const s = d.link.student;
  const share = d.link.share;
  const nodes = d.pillars?.nodes ?? [];
  const projects = nodes.filter((n) => n.kind === 'project' && n.status === 'active');
  const hero = heroOf(d);
  const hidden = COACH_SHARE_PARTS.filter((k) => !share[k]);
  return (
    <Screen>
      <header className="pt-lg">
        <BackLink to="/coaching">Coaching</BackLink>
        <h1 className="text-large-title">{s.name}</h1>
        <p className="mt-xs m-0 text-subhead text-ink-soft">
          {s.handle ? `@${s.handle}. ` : ''}Your student since {longDate(d.link.answeredAt ?? d.link.createdAt)}. They pick what you see. Never their journal.
        </p>
        <Hero color="var(--color-r6)" deep="var(--deep-guru)" className="mt-md" character="guru" mood={hero.mood}>
          <p className="m-0 text-eyebrow uppercase opacity-90">{hero.eyebrow}</p>
          <HeroNumber value={hero.value} unit={hero.unit} label={hero.label} />
        </Hero>
      </header>

      <ShareBar
        share={share}
        onPick={(part) => {
          const f = PART_FOLD[part];
          sections.set(f.key, 'open');
          requestAnimationFrame(() => {
            jumpTo(f.id);
            // The keyboard's place goes with the page, to the section's own toggle, so Tab carries on into what it opened.
            document.getElementById(f.id)?.querySelector('button')?.focus({ preventScroll: true });
          });
        }}
      />

      <ShowOnThisPage page="student" isCoach sections={sections} className="mt-xs" />

      <div className="mt-md">
        <PeriodFilter period={period} onChange={pickPeriod} today={today} kinds={COACH_REPORT_KINDS} />
      </div>

      <CoachFold sections={sections} k="numbers" id="numbers-heading" title="Report numbers" hint={periodLabel(period)}>
        {report.data ? <ReportNumbers report={report.data} /> : report.isError ? <ErrorLine e={report.error} /> : <Skeleton className="h-[200px] rounded-tile" />}
      </CoachFold>

      <CoachFold sections={sections} k="charts" id="charts-heading" title="Charts" lede="The period you picked, and the trackers over thirty days.">
        {report.data ? <ReportCharts report={report.data} view={d} /> : report.isError ? <ErrorLine e={report.error} /> : <Skeleton className="h-[240px] rounded-tile" />}
      </CoachFold>

      <CoachFold sections={sections} k="patterns" id="patterns-heading" title="Patterns and suggestions" lede="Plain rules, from what they share, kept nowhere. Edit anything before you send it.">
        <CoachPatterns studentId={id} name={s.name} enabled={sections.state('patterns') === 'open'} onNote={prefillNote} onTask={(t) => setEditing({ mode: 'add', parentId: t.projectId ?? '', title: t.title, habit: t.habit })} />
      </CoachFold>

      <CoachFold sections={sections} k="notes" id="notes-heading" title="Notes" hint={d.notes.length ? formatCount(d.notes.length) : undefined} lede="They read every note, here and in their inbox.">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (note.trim()) write.mutate();
          }}
        >
          <textarea ref={noteBox} value={note} onChange={(e) => setNote(e.target.value)} maxLength={COACH_NOTE_MAX} rows={3} placeholder="What you noticed, and one next step" aria-label="A note for your student" className={FIELD} />
          <Button type="submit" className="mt-xs" disabled={write.isPending || !note.trim()}>
            Leave the note
          </Button>
        </form>
        <ErrorLine e={write.error} className="mt-sm" />
        <ol className="mt-sm m-0 flex list-none flex-col gap-xs p-0">
          {d.notes.map((n) => (
            <li key={n.id} className="rounded-tile bg-card p-sm shadow-toy-soft">
              <p className="m-0 whitespace-pre-wrap text-prose"><Inert text={n.body} /></p>
              <div className="mt-xs flex flex-wrap items-center justify-between gap-xs">
                <span className="text-caption text-ink-soft">{when(n.createdAt)}</span>
                {n.mine && (
                  <Button size="sm" variant="ghost" disabled={takeBack.isPending} onClick={() => { takeBack.reset(); setUnnoting(n.id); }}>
                    Take back
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ol>
        <Pager page={d.notesPage} prefix="note" label="notes" />
        <ConfirmDelete open={unnoting !== null} title="Take this note back?" body="It is removed from their notes. This cannot be undone." pending={takeBack.isPending} failed={takeBack.isError} onYes={() => unnoting && takeBack.mutate(unnoting)} onClose={() => setUnnoting(null)} yes="Yes, take it back" />
      </CoachFold>

      {d.pillars && (
        <CoachFold
          sections={sections}
          k="pillars"
          id="pillars-heading"
          title="Pillars and pace"
          lede="Each pyramid top down: foundation first, projects last."
          action={
            projects.length > 0 ? (
              <Button size="sm" variant="outline" plusToX onClick={() => setEditing({ mode: 'add', parentId: '' })}>
                Add a task
              </Button>
            ) : undefined
          }
        >
          {report.data?.pillars ? <ReportPillars rows={report.data.pillars} nodes={nodes} onAdd={(parentId) => setEditing({ mode: 'add', parentId })} onEdit={(task) => setEditing({ mode: 'edit', task })} /> : report.isError ? <ErrorLine e={report.error} /> : <Skeleton className="h-[200px] rounded-tile" />}
        </CoachFold>
      )}

      {d.coachTasks && (
        <CoachFold sections={sections} k="tasks" id="tasks-heading" title="Tasks you added" hint={d.coachTasks.tasks.length ? formatCount(d.coachTasks.tasks.length) : undefined} lede="Newest first, with how each stands. Only they tick a task.">
          {d.coachTasks.tasks.length === 0 && <p className="m-0 text-subhead text-ink-soft">No tasks from you yet.</p>}
          <ol className="m-0 flex list-none flex-col gap-xs p-0">
            {d.coachTasks.tasks.map((t) => (
              <TaskLine key={t.id} t={t} today={d.date} onEdit={share.pillars ? () => setEditing({ mode: 'edit', task: t }) : undefined} />
            ))}
          </ol>
          <Pager page={d.coachTasks.page} prefix="ct" label="tasks" />
        </CoachFold>
      )}

      {d.daily && (
        <CoachFold sections={sections} k="day" id="day-heading" title="The day" hint={shortDay(d.date)} lede="Their own today, as it stands.">
          <p className="m-0 text-subhead font-semibold">Small act: {d.daily.smallAct.done ? `done${d.daily.smallAct.relationship ? `, for ${RELATIONSHIP_BY_KEY[d.daily.smallAct.relationship].name}` : ''}` : 'not yet'}.</p>
          <h3 className="mt-md text-headline">Due by today</h3>
          {d.daily.tasks.length === 0 && <p className="m-0 text-subhead text-ink-soft">Nothing due.</p>}
          <ul className="mt-xs m-0 flex list-none flex-col gap-xs p-0">
            {d.daily.tasks.map((t) => (
              <TaskLine key={t.id} t={t} today={d.date} onEdit={share.pillars ? () => setEditing({ mode: 'edit', task: t }) : undefined} />
            ))}
          </ul>
          {d.daily.done.length > 0 && (
            <>
              <h3 className="mt-md text-headline">Done today</h3>
              <ul className="mt-xs m-0 flex list-none flex-col gap-xs p-0">
                {d.daily.done.map((t) => (
                  <TaskLine key={t.id} t={t} />
                ))}
              </ul>
            </>
          )}
          {d.daily.notToDo.length > 0 && (
            <>
              <h3 className="mt-md text-headline">Not to do</h3>
              <ul className="mt-xs m-0 flex list-none flex-col gap-xs p-0">
                {d.daily.notToDo.map((n) => (
                  <li key={n.id} className="flex flex-wrap items-center gap-sm rounded-tile bg-card p-sm shadow-toy-soft">
                    <span className="min-w-0 flex-1 text-subhead font-semibold">{n.title}</span>
                    <WeekDots days={n.week.map((w) => w === 'kept')} color="var(--color-r4)" label={`Kept ${n.week.filter((w) => w === 'kept').length} of the last 7 days`} />
                    <span className="text-caption text-ink-soft">{n.streak} in a row</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </CoachFold>
      )}

      {d.routine && (
        <CoachFold sections={sections} k="routine" id="routine-heading" title="Routine and contract" hint={`${d.routine.week.done} of 7`} lede="The routine from their strategy session, and the plan they signed.">
          <RoutinePart routine={d.routine} />
        </CoachFold>
      )}

      {d.reflection && (
        <CoachFold sections={sections} k="reviews" id="reviews-heading" title="Saved reviews" lede="Their answers, newest first. Never the numbers saved with them.">
          {d.reflection.reviews.length === 0 && d.reflection.dayReviews.length === 0 && <p className="m-0 text-subhead text-ink-soft">No reviews saved yet.</p>}
          <ol className="m-0 flex list-none flex-col gap-xs p-0">
            {d.reflection.reviews.map((r) => (
              <ReviewFold key={r.id} r={r} />
            ))}
          </ol>
          <Pager page={d.reflection.reviewsPage} prefix="rev" label="reviews" />
          {(d.reflection.dayReviews.length > 0 || revd.page > 1) && (
            <Fold title="Daily reviews" hint={formatCount(d.reflection.dayReviews.length)} className="mt-sm">
              <ol className="m-0 flex list-none flex-col gap-xs p-0">
                {d.reflection.dayReviews.map((r) => (
                  <ReviewFold key={r.id} r={r} />
                ))}
              </ol>
              <Pager page={d.reflection.dayReviewsPage} prefix="revd" label="daily reviews" />
            </Fold>
          )}
        </CoachFold>
      )}

      {share.lifeMap && (
        <CoachFold sections={sections} k="map" id="map-heading" title="Life map answers" lede={d.lifeMap ? `From their strategy session on ${longDate(d.lifeMap.createdAt)}.` : undefined}>
          {d.lifeMap ? <MapPart map={d.lifeMap} /> : <p className="m-0 text-subhead text-ink-soft">No life map yet. It fills in once they finish their strategy session.</p>}
        </CoachFold>
      )}

      <CoachFold sections={sections} k="log" id="log-heading" title="Change log" lede="Every ask, yes, note and task change between you two. They see the same lines.">
        {d.log.length === 0 && <p className="m-0 text-subhead text-ink-soft">Nothing yet.</p>}
        <ol className="m-0 flex list-none flex-col gap-xs p-0">
          {d.log.map((e) => (
            <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-xs rounded-tile bg-card p-sm shadow-toy-soft">
              <span className="min-w-0 flex-1 text-subhead">{e.label}</span>
              <time dateTime={e.createdAt} className="shrink-0 text-caption text-ink-soft">
                {when(e.createdAt)}
              </time>
            </li>
          ))}
        </ol>
        <Pager page={d.logPage} prefix="log" label="changes" />
      </CoachFold>

      {hidden.length > 0 && <p className="mt-sm m-0 text-caption text-ink-soft">Not shared with you: {hidden.map((k) => COACH_SHARE_META[k].name).join(', ')}.</p>}

      <div className="mt-md flex justify-end">
        <Button
          variant="ghost"
          disabled={end.isPending}
          onClick={() => {
            end.reset();
            setEnding(true);
          }}
        >
          End coaching
        </Button>
      </div>
      <ConfirmDelete open={ending} title={`End coaching with ${s.name}?`} body="You stop seeing their progress at once, and they are told. The notes and the change log stay." pending={end.isPending} failed={end.isError} onYes={() => end.mutate(d.link.id)} onClose={() => setEnding(false)} yes="Yes, end it" keep="Keep coaching" />

      {/* Keyed by what it opens with: the form's fields are a deliberate one-time seed from that task or suggestion, so each opening starts fresh. */}
      <CoachTaskSheet key={editing ? (editing.mode === 'edit' ? editing.task.id : `add-${editing.parentId}-${editing.title ?? ''}`) : 'none'} studentId={id} editing={editing} projects={projects} onClose={() => setEditing(null)} onDone={reload} />
    </Screen>
  );
}

