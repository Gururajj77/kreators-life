import { videoEmbed, type CohortSession, type CourseAssignment, type Enrollment, type LearningItem, type Submission, LOCALE } from '@kreators/shared';
import type { TagTone } from '@kreators/shared';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useParams } from 'react-router';
import { Button } from '../components/Button';
import { AppCover } from '../components/AppCover';
import { BackLink } from '../components/PageHeader';
import { Markdown } from '../components/Markdown';
import { Screen } from '../components/Screen';
import { Sheet } from '../components/Sheet';
import { Term } from '../components/Tip';
import { MediaSection, useMediaMenuItem } from '../components/MediaSection';
import { IconButton } from '../components/IconButton';
import { IconTag } from '../components/FactTag';
import { Icon } from '../components/Icon';
import { ArrowUpRight, ImagePlus } from 'lucide-react';
import { MediaTile } from '../components/Media';
import { api, errorText } from '../lib/api';
import { useAuthed, useMe } from '../lib/queries';
import { FIELD } from '../lib/ui';
import { Fold } from '../components/Fold';
import { shortDate } from '../lib/date';
import { ErrorLine } from '../components/ErrorLine';
import { StatusTag } from '../components/StatusTag';
import { ToggleChevron } from '../components/ToggleMark';

const fmtDate = shortDate;
const fmtWhen = (d: string) => new Date(d).toLocaleString(LOCALE, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const isLive = (s: CohortSession) => {
  const now = Date.now();
  return now >= new Date(s.startsAt).getTime() - 15 * 60_000 && now <= new Date(s.endsAt).getTime() + 60 * 60_000;
};


function Progress({ p }: { p: Enrollment['progress'] }) {
  return (
    <span className="block text-subhead text-ink-soft">
      {p.assignmentsApproved} of {p.assignmentsTotal} assignments approved, {p.sessionsAttended} of {p.sessionsTotal} sessions attended
    </span>
  );
}

const KIND_TIP: Record<string, string> = {
  lesson: 'Read it here, then try it. The full skill file opens in a new tab.',
  video: 'Watch it, then try what it shows.',
  reading: 'A page to read before the next step.',
};

export function Cohort() {
  const { id = '' } = useParams();
  const me = useMe();
  const q = useAuthed(['cohort', id], () => api.cohort(id));
  const [scheduling, setScheduling] = useState(false);
  const [openLesson, setOpenLesson] = useState<string | null>(null);
  const [editingMedia, setEditingMedia] = useState(false);
  const attend = useMutation({ mutationFn: ({ sid, userId }: { sid: string; userId?: string }) => api.attend(sid, userId), onSuccess: () => q.refetch() });
  const complete = useMutation({ mutationFn: (eid: string) => api.completeEnrollment(eid), onSuccess: () => q.refetch() });

  if (q.isError) {
    return (
      <Screen>
        <header className="pt-lg">
          <BackLink to="/school">School</BackLink>
        </header>
        <p className="mt-md font-semibold">{errorText(q.error, 'You are not in this cohort.')}</p>
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
      {/* The cover card; the gallery's round button sits on the helper's line, at its left (founder, 2026-11-04). */}
      <AppCover
        back={{ to: '/school', label: 'School' }}
        eyebrow={
          <>
            {k.programName}, <Term word="cohort">cohort</Term> run by {k.managerName}
          </>
        }
        title={k.name}
        lede={`${fmtDate(k.startAt)} to ${fmtDate(k.endAt)}, ${k.status}, ${k.enrolled} learner${k.enrolled === 1 ? '' : 's'}`}
        actions={<ProgramMediaButton programId={k.programId} onOpen={() => setEditingMedia(true)} />}
      >
        {d.myProgress && (
          <div className="rounded-tile bg-card p-sm shadow-toy-soft">
            <p className="m-0 text-headline">{d.myStatus === 'completed' ? 'Completed. Well done.' : 'Your progress'}</p>
            <Progress p={d.myProgress} />
          </div>
        )}
      </AppCover>

      {/* The program's gallery, under the header; its editor opens from the round button beside the title. */}
      <MediaSection type="program" id={k.programId} trigger={null} open={editingMedia} onOpenChange={setEditingMedia} />


      <section className="mt-lg" aria-labelledby="lessons-heading">
        <h2 id="lessons-heading" className="text-title2">
          Lessons
        </h2>
        {d.items.length === 0 && <p className="mt-sm m-0 text-subhead text-ink-soft">Lessons appear here as the program adds them.</p>}
        <ol className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
          {d.items.map((item, i) => (
            <LessonCard key={item.id} item={item} n={i + 1} open={openLesson === item.id} onToggle={() => setOpenLesson(openLesson === item.id ? null : item.id)} />
          ))}
        </ol>
      </section>

      <section className="mt-lg" aria-labelledby="assignments-heading">
        <h2 id="assignments-heading" className="text-title2">
          Assignments
        </h2>
        {d.assignments.length === 0 && <p className="mt-sm m-0 text-subhead text-ink-soft">No assignments yet.</p>}
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
          <h2 id="sessions-heading" className="text-title2">
            Live sessions
          </h2>
          {d.manager && <Button onClick={() => setScheduling(true)}>Schedule</Button>}
        </div>
        {d.sessions.length === 0 && <p className="mt-sm m-0 text-subhead text-ink-soft">No sessions scheduled yet.</p>}
        <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
          {d.sessions.map((s) => (
            <li key={s.id} className="rounded-tile bg-card p-sm shadow-toy-soft">
              <div className="flex items-start justify-between gap-sm">
                <div className="min-w-0">
                  <p className="m-0 text-balance text-headline [overflow-wrap:anywhere]">{s.title}</p>
                  <p className="m-0 text-subhead text-ink-soft">
                    {fmtWhen(s.startsAt)} to {new Date(s.endsAt).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                {/* A mark on every session in the same corner: here, live now, coming up or over. */}
                {s.attended ? <StatusTag tone="good">You were here</StatusTag> : isLive(s) ? <StatusTag tone="info">Live now</StatusTag> : new Date(s.startsAt).getTime() > Date.now() ? <StatusTag tone="calm">Coming up</StatusTag> : <StatusTag tone="neutral">Over</StatusTag>}
              </div>
              <div className="mt-sm flex flex-wrap justify-end gap-xs">
                {s.onlineUrl && (
                  <a href={s.onlineUrl} target="_blank" rel="noreferrer" className="toy inline-flex min-h-[48px] items-center rounded-pill bg-ink px-md font-semibold text-on-ink">
                    Join
                  </a>
                )}
                {!s.attended && d.myStatus === 'enrolled' && isLive(s) && (
                  <Button variant="outline" onClick={() => attend.mutate({ sid: s.id })} disabled={attend.isPending}>
                    I am here
                  </Button>
                )}
              </div>
              {!s.attended && d.myStatus === 'enrolled' && !isLive(s) && new Date(s.startsAt).getTime() > Date.now() && <p className="mt-xs m-0 text-caption text-ink-soft">Check-in opens fifteen minutes before it starts.</p>}
              {d.manager && s.attendance && (
                <Fold className="mt-sm" title={`Attendance, ${s.attendance.length} of ${d.enrollments.length}`}>
                  <ul className="flex list-none flex-col gap-xs p-0 m-0">
                    {d.enrollments.map((e) => {
                      const here = s.attendance?.some((a) => a.userId === e.learnerId);
                      return (
                        <li key={e.id} className="flex items-center gap-sm rounded-tile bg-paper p-sm">
                          <span className="flex-1 text-subhead font-semibold">{e.learnerName}</span>
                          {here ? (
                            <span className="text-subhead text-ink-soft">Present</span>
                          ) : (
                            <Button variant="ghost" onClick={() => attend.mutate({ sid: s.id, userId: e.learnerId })} disabled={attend.isPending}>
                              Mark present
                            </Button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </Fold>
              )}
            </li>
          ))}
        </ul>
        <div className="mt-xs">
          <ErrorLine e={attend.error} />
        </div>
      </section>

      {canRun && (
        <section className="mt-lg" aria-labelledby="learners-heading">
          <h2 id="learners-heading" className="text-title2">
            Learners, {d.enrollments.length}
          </h2>
          {d.enrollments.length === 0 && <p className="mt-sm m-0 text-subhead text-ink-soft">No one has enrolled yet.</p>}
          <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
            {d.enrollments.map((e) => (
              <li key={e.id} className="rounded-tile bg-card p-sm shadow-toy-soft">
                <div className="flex items-center justify-between gap-sm">
                  <p className="m-0 text-headline">{e.learnerName}</p>
                  <StatusTag tone={e.status === 'completed' ? 'good' : 'warn'}>{e.status}</StatusTag>
                </div>
                <Progress p={e.progress} />
                <p className="m-0 text-caption text-ink-soft">
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
            <ErrorLine e={complete.error} />
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

const KIND_TAG: Record<string, { icon: 'NotebookText' | 'Video' | 'BookOpen' | 'FileText'; word: string }> = {
  lesson: { icon: 'NotebookText', word: 'Lesson' },
  video: { icon: 'Video', word: 'Video' },
  reading: { icon: 'BookOpen', word: 'Reading' },
};

/** The program's own pictures and videos: for whoever may edit them, one round button beside the title opens the editor. */
function ProgramMediaButton({ onOpen, programId }: { onOpen: () => void; programId: string }) {
  const media = useMediaMenuItem('program', programId, onOpen);
  return media ? <IconButton icon={ImagePlus} label={media.label} onClick={media.onSelect} opens /> : null;
}

/**
 * One lesson: a number, the title in full and its kind as a tag in the top right corner; tapping opens it. Open, it reads like a page:
 * the way into the source and a round button for pictures on the first line (the link takes the width on a phone), what this kind of step is under them,
 * the words straight on the card, no box inside a box, then at the foot the source link with its caption and a round button for pictures.
 */
function LessonCard({ item, n, open, onToggle }: { item: LearningItem; n: number; open: boolean; onToggle: () => void }) {
  const [editing, setEditing] = useState(false);
  const media = useMediaMenuItem('lesson', item.id, () => setEditing(true));
  const tag = KIND_TAG[item.contentType] ?? { icon: 'FileText' as const, word: item.contentType };
  const embedded = item.contentType === 'video' && item.contentRef && videoEmbed(item.contentRef);
  const source = item.contentRef && !embedded ? item.contentRef : null;
  return (
    <li className="rounded-tile bg-card shadow-toy-soft">
      <button type="button" aria-expanded={open} onClick={onToggle} className="toy toy-flat flex min-h-[56px] w-full items-start gap-sm rounded-tile p-sm text-left focus-visible:outline-offset-0">
        <span className="flex size-[32px] shrink-0 items-center justify-center rounded-pill bg-paper text-subhead font-medium" aria-hidden="true">
          {n}
        </span>
        <span className="min-w-0 flex-1 pt-[4px] text-headline text-balance">{item.moduleTitle}</span>
        <span className="flex shrink-0 items-center gap-xs pt-[2px]">
          <IconTag tone="calm" icon={tag.icon}>{tag.word}</IconTag>
          <ToggleChevron open={open} size={20} className="text-ink-soft" />
        </span>
      </button>
      {open && (
        <div className="border-t border-line px-sm pt-sm pb-md">
          {embedded && (
            <div className="mt-sm">
              <MediaTile item={{ id: item.id, kind: 'video', url: item.contentRef!, caption: item.moduleTitle }} />
            </div>
          )}
          <MediaSection type="lesson" id={item.id} title="Lesson pictures and videos" trigger={null} open={editing} onOpenChange={setEditing} />
          {item.body ? <Markdown text={item.body} className="prose-long" /> : !item.contentRef && <p className="mt-sm m-0 text-subhead text-ink-soft">Nothing written here yet.</p>}
          {/* The ways in, at the foot of the open lesson once it is read (the source link takes the width on every screen and the round button sits at its right). The
              helper line belongs to the source link (it says what that link opens), so it sits centred under that link as its caption. */}
          {source ? (
            <div className="mt-md flex items-start justify-end gap-xs">
              <div className="flex min-w-0 flex-1 flex-col items-center">
                <a href={source} target="_blank" rel="noreferrer" className="toy toy-soft inline-flex min-h-[44px] w-full items-center justify-center gap-xs rounded-pill border border-line bg-card-strong px-md text-subhead font-semibold">
                  {item.contentType === 'video' ? 'Watch' : source.startsWith('/resources/') ? 'Skill file' : 'Open'}
                  <Icon icon={ArrowUpRight} size={16} />
                </a>
                <p className="mt-xs m-0 text-center text-caption text-balance text-ink-soft">{KIND_TIP[item.contentType] ?? 'A step in this program.'}</p>
              </div>
              {media && <IconButton icon={ImagePlus} label={media.label} onClick={media.onSelect} opens />}
            </div>
          ) : (
            <div className="mt-md flex items-start justify-between gap-sm">
              <p className="m-0 min-w-0 text-subhead text-ink-soft">{KIND_TIP[item.contentType] ?? 'A step in this program.'}</p>
              {media && <IconButton icon={ImagePlus} label={media.label} onClick={media.onSelect} opens />}
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function AssignmentCard({ a, cohortId, mine, all, canRun, enrolled, onChange }: { a: CourseAssignment; cohortId: string; mine: Submission | null; all: Submission[]; canRun: boolean; enrolled: boolean; onChange: () => void }) {
  const [url, setUrl] = useState(mine?.url ?? '');
  const [text, setText] = useState(mine?.text ?? '');
  const submit = useMutation({ mutationFn: () => api.submitAssignment(a.id, { cohortId, url: url || undefined, text: text || undefined }), onSuccess: () => onChange() });
  const tone: TagTone = mine?.status === 'approved' ? 'good' : mine?.status === 'changes' ? 'warm' : mine ? 'warn' : 'neutral';
  const label = mine ? ({ submitted: 'Waiting for feedback', changes: 'Changes asked', approved: 'Approved' } as const)[mine.status] : 'Not handed in';
  const waiting = all.filter((s) => s.status === 'submitted').length;
  return (
    <div className="rounded-tile bg-card p-sm shadow-toy-soft">
      <div className="flex items-start justify-between gap-sm">
        <div className="min-w-0">
          <p className="m-0 text-balance text-headline [overflow-wrap:anywhere]">{a.title}</p>
          <p className="m-0 text-subhead text-ink-soft">Due {a.dueDays} days in</p>
        </div>
        {!canRun && (
          <StatusTag tone={tone}>
            {label}
          </StatusTag>
        )}
        {canRun && (waiting > 0 ? <StatusTag tone="warn">{`${waiting} to review`}</StatusTag> : <StatusTag tone="neutral">Nothing to review</StatusTag>)}
      </div>
      {(a.instructions || a.rubric) && (
        <Fold className="mt-xs" title="Read the brief">
          {a.instructions && <p className="m-0 whitespace-pre-wrap text-subhead">{a.instructions}</p>}
          {a.rubric && (
            <p className="mt-xs m-0 text-subhead text-ink-soft">
              <span className="font-semibold">Judged on:</span> {a.rubric}
            </p>
          )}
        </Fold>
      )}
      {mine && mine.feedback.length > 0 && (
        <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
          {mine.feedback.map((f) => (
            <li key={f.id} className="rounded-tile bg-paper p-sm text-subhead">
              <span className="font-semibold">
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
            <span className="block text-caption">Link to your work</span>
            <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" className={FIELD} />
          </label>
          <label className="block">
            <span className="block text-caption">Or write it here</span>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={5000} className={FIELD} />
          </label>
          <Button type="submit" variant={mine ? 'outline' : 'primary'} disabled={submit.isPending || (!url.trim() && !text.trim())}>
            {mine ? 'Hand in again' : 'Hand in'}
          </Button>
          <ErrorLine e={submit.error} />
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
      {canRun && all.length === 0 && <p className="mt-sm m-0 text-subhead text-ink-soft">No one has handed this in yet.</p>}
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
        <p className="m-0 text-subhead font-semibold">{s.learnerName}</p>
        <span className="text-caption text-ink-soft">
          {s.status}, {fmtDate(s.submittedAt)}
        </span>
      </div>
      {s.url && (
        <a href={s.url} target="_blank" rel="noreferrer" className="block break-all text-subhead underline underline-offset-4">
          {s.url}
        </a>
      )}
      {s.text && <p className="mt-xs m-0 whitespace-pre-wrap text-subhead">{s.text}</p>}
      {s.feedback.length > 0 && (
        <ul className="mt-xs flex list-none flex-col gap-xs p-0 m-0">
          {s.feedback.map((f) => (
            <li key={f.id} className="text-subhead text-ink-soft">
              <span className="font-semibold">
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
            <span className="block text-caption">Feedback</span>
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} maxLength={3000} className={FIELD} />
          </label>
          <label className="mt-xs block">
            <span className="block text-caption">Grade, optional</span>
            <input value={grade} onChange={(e) => setGrade(e.target.value)} maxLength={20} placeholder="A, 8/10, pass" className={FIELD} />
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
            <ErrorLine e={feedback.error} />
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
          <span className="block text-subhead font-semibold">Title</span>
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required className={FIELD} />
        </label>
        <div className="grid grid-cols-2 gap-xs">
          <label className="block">
            <span className="block text-subhead font-semibold">Starts</span>
            <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required className={FIELD} />
          </label>
          <label className="block">
            <span className="block text-subhead font-semibold">Minutes</span>
            <input type="number" min={15} max={600} value={minutes} onChange={(e) => setMinutes(e.target.value)} className={FIELD} />
          </label>
        </div>
        <label className="block">
          <span className="block text-subhead font-semibold">Joining link</span>
          <input type="url" value={onlineUrl} onChange={(e) => setOnlineUrl(e.target.value)} placeholder="https://" className={FIELD} />
        </label>
        <ErrorLine e={schedule.error} />
        <Button type="submit" size="lg" full disabled={schedule.isPending || !title.trim() || !startsAt}>
          Schedule
        </Button>
      </form>
    </Sheet>
  );
}

