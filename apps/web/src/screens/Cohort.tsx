import type { CohortSession, CourseAssignment, Enrollment, Submission } from '@kreators/shared';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useParams } from 'react-router';
import { Button } from '../components/Button';
import { BackLink } from '../components/PageHeader';
import { Markdown } from '../components/Markdown';
import { Screen } from '../components/Screen';
import { Sheet } from '../components/Sheet';
import { api } from '../lib/api';
import { useAuthed, useMe } from '../lib/queries';

const field = 'mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]';
const fmtDate = (d: string) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const fmtWhen = (d: string) => new Date(d).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const errText = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);
const isLive = (s: CohortSession) => {
  const now = Date.now();
  return now >= new Date(s.startsAt).getTime() - 15 * 60_000 && now <= new Date(s.endsAt).getTime() + 60 * 60_000;
};

function Err({ error, fallback = 'That did not work.' }: { error: unknown; fallback?: string }) {
  if (!error) return null;
  return (
    <p role="alert" className="m-0 rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
      {errText(error, fallback)}
    </p>
  );
}

function Progress({ p }: { p: Enrollment['progress'] }) {
  return (
    <span className="block text-[14px] font-semibold text-ink-soft">
      {p.assignmentsApproved} of {p.assignmentsTotal} assignments approved, {p.sessionsAttended} of {p.sessionsTotal} sessions attended
    </span>
  );
}

export function Cohort() {
  const { id = '' } = useParams();
  const me = useMe();
  const q = useAuthed(['cohort', id], () => api.cohort(id));
  const [scheduling, setScheduling] = useState(false);
  const [openLesson, setOpenLesson] = useState<string | null>(null);
  const attend = useMutation({ mutationFn: ({ sid, userId }: { sid: string; userId?: string }) => api.attend(sid, userId), onSuccess: () => q.refetch() });
  const complete = useMutation({ mutationFn: (eid: string) => api.completeEnrollment(eid), onSuccess: () => q.refetch() });

  if (q.isError) {
    return (
      <Screen>
        <header className="pt-lg">
          <Back />
        </header>
        <p className="mt-md font-bold">{errText(q.error, 'You are not in this cohort.')}</p>
      </Screen>
    );
  }
  const d = q.data;
  if (!d) return null;
  const k = d.cohort;
  const canRun = d.manager || d.mentor;
  const myId = me.data?.user.id;

  return (
    <Screen>
      <header className="pt-lg">
        <Back />
        <p className="m-0 text-[14px] font-bold text-ink-soft">
          {k.programName}, run by {k.managerName}
        </p>
        <h1 className="text-[30px]">{k.name}</h1>
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">
          {fmtDate(k.startAt)} to {fmtDate(k.endAt)}, {k.status}, {k.enrolled} learner{k.enrolled === 1 ? '' : 's'}
        </p>
        {d.myProgress && (
          <div className="mt-sm rounded-tile bg-card p-sm shadow-toy-soft">
            <p className="m-0 text-[16px] font-bold">{d.myStatus === 'completed' ? 'Completed. Well done.' : 'Your progress'}</p>
            <Progress p={d.myProgress} />
          </div>
        )}
      </header>

      <section className="mt-lg" aria-labelledby="lessons-heading">
        <h2 id="lessons-heading" className="text-[24px]">
          Lessons
        </h2>
        {d.items.length === 0 && <p className="mt-sm m-0 text-[14px] font-semibold text-ink-soft">Lessons appear here as the program adds them.</p>}
        <ol className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
          {d.items.map((item, i) => {
            const open = openLesson === item.id;
            return (
              <li key={item.id} className="rounded-tile bg-card p-sm shadow-toy-soft">
                <button type="button" aria-expanded={open} onClick={() => setOpenLesson(open ? null : item.id)} className="toy toy-flat flex min-h-[44px] w-full items-center justify-between gap-sm rounded-tile text-left">
                  <span className="min-w-0">
                    <span className="block truncate text-[16px] font-bold">
                      {i + 1}. {item.moduleTitle}
                    </span>
                    <span className="block text-[14px] font-semibold text-ink-soft">{item.contentType}</span>
                  </span>
                  <span className="text-[14px] font-bold text-ink-soft">{open ? 'Hide' : 'Open'}</span>
                </button>
                {open && (
                  <div className="mt-sm">
                    {item.contentRef && (
                      <a href={item.contentRef} target="_blank" rel="noreferrer" className="toy inline-flex min-h-[48px] items-center rounded-pill bg-ink px-md font-bold text-on-ink">
                        {item.contentType === 'video' ? 'Watch' : item.contentRef.startsWith('/resources/') ? 'Open the full skill file' : 'Open'}
                      </a>
                    )}
                    {item.body ? <Markdown text={item.body} className="mt-sm rounded-tile bg-paper p-sm" /> : !item.contentRef && <p className="mt-sm m-0 text-[14px] font-semibold text-ink-soft">Nothing written here yet.</p>}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </section>

      <section className="mt-lg" aria-labelledby="assignments-heading">
        <h2 id="assignments-heading" className="text-[24px]">
          Assignments
        </h2>
        {d.assignments.length === 0 && <p className="mt-sm m-0 text-[14px] font-semibold text-ink-soft">No assignments yet.</p>}
        <ul className="mt-sm flex list-none flex-col gap-sm p-0 m-0">
          {d.assignments.map((a) => (
            <li key={a.id}>
              <AssignmentCard a={a} cohortId={id} mine={d.submissions.find((s) => s.assignmentId === a.id && s.learnerId === myId) ?? null} all={canRun ? d.submissions.filter((s) => s.assignmentId === a.id) : []} canRun={canRun} enrolled={d.myStatus === 'enrolled'} onChange={() => q.refetch()} />
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-lg" aria-labelledby="sessions-heading">
        <div className="flex items-center justify-between gap-sm">
          <h2 id="sessions-heading" className="text-[24px]">
            Live sessions
          </h2>
          {d.manager && <Button onClick={() => setScheduling(true)}>Schedule</Button>}
        </div>
        {d.sessions.length === 0 && <p className="mt-sm m-0 text-[14px] font-semibold text-ink-soft">No sessions scheduled yet.</p>}
        <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
          {d.sessions.map((s) => (
            <li key={s.id} className="rounded-tile bg-card p-sm shadow-toy-soft">
              <div className="flex items-start justify-between gap-sm">
                <div className="min-w-0">
                  <p className="m-0 truncate text-[16px] font-bold">{s.title}</p>
                  <p className="m-0 text-[14px] font-semibold text-ink-soft">
                    {fmtWhen(s.startsAt)} to {new Date(s.endsAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                {s.attended && <span className="shrink-0 rounded-pill bg-r4 px-xs text-[12px] font-extrabold leading-[20px] text-on-fill">You were here</span>}
              </div>
              <div className="mt-sm flex flex-wrap gap-xs">
                {s.onlineUrl && (
                  <a href={s.onlineUrl} target="_blank" rel="noreferrer" className="toy inline-flex min-h-[48px] items-center rounded-pill bg-ink px-md font-bold text-on-ink">
                    Join
                  </a>
                )}
                {!s.attended && d.myStatus === 'enrolled' && isLive(s) && (
                  <Button variant="outline" onClick={() => attend.mutate({ sid: s.id })} disabled={attend.isPending}>
                    I am here
                  </Button>
                )}
              </div>
              {!s.attended && d.myStatus === 'enrolled' && !isLive(s) && new Date(s.startsAt).getTime() > Date.now() && <p className="mt-xs m-0 text-[12px] font-bold text-ink-soft">Check-in opens fifteen minutes before it starts.</p>}
              {d.manager && s.attendance && (
                <details className="mt-sm">
                  <summary className="min-h-[44px] cursor-pointer text-[14px] font-bold leading-[44px]">
                    Attendance, {s.attendance.length} of {d.enrollments.length}
                  </summary>
                  <ul className="flex list-none flex-col gap-xs p-0 m-0">
                    {d.enrollments.map((e) => {
                      const here = s.attendance?.some((a) => a.userId === e.learnerId);
                      return (
                        <li key={e.id} className="flex items-center gap-sm rounded-tile bg-paper p-sm">
                          <span className="flex-1 text-[14px] font-bold">{e.learnerName}</span>
                          {here ? (
                            <span className="text-[14px] font-bold text-ink-soft">Present</span>
                          ) : (
                            <Button variant="ghost" onClick={() => attend.mutate({ sid: s.id, userId: e.learnerId })} disabled={attend.isPending}>
                              Mark present
                            </Button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </details>
              )}
            </li>
          ))}
        </ul>
        <div className="mt-xs">
          <Err error={attend.error} />
        </div>
      </section>

      {canRun && (
        <section className="mt-lg" aria-labelledby="learners-heading">
          <h2 id="learners-heading" className="text-[24px]">
            Learners, {d.enrollments.length}
          </h2>
          {d.enrollments.length === 0 && <p className="mt-sm m-0 text-[14px] font-semibold text-ink-soft">No one has enrolled yet.</p>}
          <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
            {d.enrollments.map((e) => (
              <li key={e.id} className="rounded-tile bg-card p-sm shadow-toy-soft">
                <div className="flex items-center justify-between gap-sm">
                  <p className="m-0 text-[16px] font-bold">{e.learnerName}</p>
                  <span className="shrink-0 rounded-pill px-xs text-[12px] font-extrabold leading-[20px]" style={{ background: e.status === 'completed' ? 'var(--tint-green)' : 'var(--tint-yellow)' }}>
                    {e.status}
                  </span>
                </div>
                <Progress p={e.progress} />
                <p className="m-0 text-[12px] font-bold text-ink-soft">
                  Joined {fmtDate(e.enrolledAt)}, {e.paymentStatus}
                </p>
                {d.manager && e.status === 'enrolled' && (
                  <Button variant="outline" className="mt-sm" onClick={() => complete.mutate(e.id)} disabled={complete.isPending}>
                    Mark completed
                  </Button>
                )}
              </li>
            ))}
          </ul>
          <div className="mt-xs">
            <Err error={complete.error} />
          </div>
        </section>
      )}

      <ScheduleSheet
        cohortId={id}
        open={scheduling}
        onClose={() => setScheduling(false)}
        onDone={() => {
          setScheduling(false);
          q.refetch();
        }}
      />
    </Screen>
  );
}

function AssignmentCard({ a, cohortId, mine, all, canRun, enrolled, onChange }: { a: CourseAssignment; cohortId: string; mine: Submission | null; all: Submission[]; canRun: boolean; enrolled: boolean; onChange: () => void }) {
  const [url, setUrl] = useState(mine?.url ?? '');
  const [text, setText] = useState(mine?.text ?? '');
  const submit = useMutation({ mutationFn: () => api.submitAssignment(a.id, { cohortId, url: url || undefined, text: text || undefined }), onSuccess: () => onChange() });
  const tint = mine?.status === 'approved' ? 'var(--tint-green)' : mine?.status === 'changes' ? 'var(--tint-orange)' : mine ? 'var(--tint-yellow)' : 'var(--tint-brown)';
  const label = mine ? ({ submitted: 'Waiting for feedback', changes: 'Changes asked', approved: 'Approved' } as const)[mine.status] : 'Not handed in';
  const waiting = all.filter((s) => s.status === 'submitted').length;
  return (
    <div className="rounded-tile bg-card p-sm shadow-toy-soft">
      <div className="flex items-start justify-between gap-sm">
        <div className="min-w-0">
          <p className="m-0 truncate text-[16px] font-bold">{a.title}</p>
          <p className="m-0 text-[14px] font-semibold text-ink-soft">Due {a.dueDays} days in</p>
        </div>
        {!canRun && (
          <span className="shrink-0 rounded-pill px-xs text-[12px] font-extrabold leading-[20px]" style={{ background: tint }}>
            {label}
          </span>
        )}
        {canRun && waiting > 0 && <span className="shrink-0 rounded-pill bg-r3 px-xs text-[12px] font-extrabold leading-[20px] text-ink-fixed">{waiting} to review</span>}
      </div>
      {a.instructions && <p className="mt-xs m-0 whitespace-pre-wrap text-[14px] font-semibold">{a.instructions}</p>}
      {a.rubric && (
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">
          <span className="font-bold">Judged on:</span> {a.rubric}
        </p>
      )}
      {mine && mine.feedback.length > 0 && (
        <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
          {mine.feedback.map((f) => (
            <li key={f.id} className="rounded-tile bg-paper p-sm text-[14px] font-semibold">
              <span className="font-bold">
                {f.reviewerName}
                {f.grade ? `, ${f.grade}` : ''}:
              </span>{' '}
              {f.comment}
            </li>
          ))}
        </ul>
      )}
      {enrolled && mine?.status !== 'approved' && (
        <form
          className="mt-sm flex flex-col gap-xs"
          onSubmit={(e) => {
            e.preventDefault();
            if (url.trim() || text.trim()) submit.mutate();
          }}
        >
          <label className="block">
            <span className="block text-[12px] font-bold">Link to your work</span>
            <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" className={field} />
          </label>
          <label className="block">
            <span className="block text-[12px] font-bold">Or write it here</span>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={5000} className={field} />
          </label>
          <Button type="submit" variant={mine ? 'outline' : 'primary'} disabled={submit.isPending || (!url.trim() && !text.trim())}>
            {mine ? 'Hand in again' : 'Hand in'}
          </Button>
          <Err error={submit.error} fallback="Could not hand it in." />
        </form>
      )}
      {canRun && all.length > 0 && (
        <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
          {all.map((s) => (
            <li key={s.id}>
              <SubmissionReview s={s} onChange={onChange} />
            </li>
          ))}
        </ul>
      )}
      {canRun && all.length === 0 && <p className="mt-sm m-0 text-[14px] font-semibold text-ink-soft">No one has handed this in yet.</p>}
    </div>
  );
}

function SubmissionReview({ s, onChange }: { s: Submission; onChange: () => void }) {
  const [comment, setComment] = useState('');
  const [grade, setGrade] = useState('');
  const feedback = useMutation({
    mutationFn: (status: 'approved' | 'changes') => api.giveFeedback(s.id, { comment, status, grade: grade || undefined }),
    onSuccess: () => {
      setComment('');
      onChange();
    },
  });
  return (
    <div className="rounded-tile bg-paper p-sm">
      <div className="flex items-center justify-between gap-sm">
        <p className="m-0 text-[14px] font-bold">{s.learnerName}</p>
        <span className="text-[12px] font-extrabold text-ink-soft">
          {s.status}, {fmtDate(s.submittedAt)}
        </span>
      </div>
      {s.url && (
        <a href={s.url} target="_blank" rel="noreferrer" className="block break-all text-[14px] font-semibold underline underline-offset-4">
          {s.url}
        </a>
      )}
      {s.text && <p className="mt-xs m-0 whitespace-pre-wrap text-[14px] font-semibold">{s.text}</p>}
      {s.feedback.length > 0 && (
        <ul className="mt-xs flex list-none flex-col gap-xs p-0 m-0">
          {s.feedback.map((f) => (
            <li key={f.id} className="text-[14px] font-semibold text-ink-soft">
              <span className="font-bold">
                {f.reviewerName}
                {f.grade ? `, ${f.grade}` : ''}:
              </span>{' '}
              {f.comment}
            </li>
          ))}
        </ul>
      )}
      {s.status !== 'approved' && (
        <div className="mt-sm">
          <label className="block">
            <span className="block text-[12px] font-bold">Feedback</span>
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} maxLength={3000} className={field} />
          </label>
          <label className="mt-xs block">
            <span className="block text-[12px] font-bold">Grade, optional</span>
            <input value={grade} onChange={(e) => setGrade(e.target.value)} maxLength={20} placeholder="A, 8/10, pass" className={field} />
          </label>
          <div className="mt-xs flex gap-xs">
            <Button onClick={() => feedback.mutate('approved')} disabled={feedback.isPending || !comment.trim()}>
              Approve
            </Button>
            <Button variant="outline" onClick={() => feedback.mutate('changes')} disabled={feedback.isPending || !comment.trim()}>
              Ask for changes
            </Button>
          </div>
          <div className="mt-xs">
            <Err error={feedback.error} />
          </div>
        </div>
      )}
    </div>
  );
}

function ScheduleSheet({ cohortId, open, onClose, onDone }: { cohortId: string; open: boolean; onClose: () => void; onDone: () => void }) {
  const [title, setTitle] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [minutes, setMinutes] = useState('60');
  const [onlineUrl, setOnlineUrl] = useState('');
  const schedule = useMutation({
    mutationFn: () => api.scheduleSession(cohortId, { title, startsAt: new Date(startsAt).toISOString(), minutes: Number(minutes) || 60, onlineUrl: onlineUrl || undefined }),
    onSuccess: () => {
      setTitle('');
      setStartsAt('');
      onDone();
    },
  });
  return (
    <Sheet open={open} onClose={onClose} title="Schedule a session">
      <form
        className="flex flex-col gap-md"
        onSubmit={(e) => {
          e.preventDefault();
          if (title.trim() && startsAt) schedule.mutate();
        }}
      >
        <label className="block">
          <span className="block text-[14px] font-bold">Title</span>
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required className={field} />
        </label>
        <div className="grid grid-cols-2 gap-xs">
          <label className="block">
            <span className="block text-[14px] font-bold">Starts</span>
            <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required className={field} />
          </label>
          <label className="block">
            <span className="block text-[14px] font-bold">Minutes</span>
            <input type="number" min={15} max={600} value={minutes} onChange={(e) => setMinutes(e.target.value)} className={field} />
          </label>
        </div>
        <label className="block">
          <span className="block text-[14px] font-bold">Joining link</span>
          <input type="url" value={onlineUrl} onChange={(e) => setOnlineUrl(e.target.value)} placeholder="https://" className={field} />
        </label>
        <Err error={schedule.error} fallback="Could not schedule it." />
        <Button type="submit" size="lg" full disabled={schedule.isPending || !title.trim() || !startsAt}>
          Schedule
        </Button>
      </form>
    </Sheet>
  );
}

function Back() {
  return (
    <BackLink to="/school">School</BackLink>
  );
}
