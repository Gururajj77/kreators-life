import { BOOKS, cohortAlwaysOpen, LESSON_BODY_MAX, LESSON_TITLE_MAX, type CohortSession, type CourseAssignment, type Enrollment, type LearningItem, type Submission } from '@kreators/shared';
import { LESSON_RESOURCE_KIND_META, LESSON_RESOURCE_KINDS, LESSON_RESOURCE_LABEL_MAX, LESSON_RESOURCE_LINK_MAX, LESSON_RESOURCES_FULL, MAX_LESSON_RESOURCES, lessonResourceLabel, type LessonResource, type LessonResourceKind } from '@kreators/shared/lessonResources';
import { Phrases } from '../components/Phrases';
import type { TagTone } from '@kreators/shared';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Button } from '../components/Button';
import { AppCover } from '../components/AppCover';
import { PageHeader } from '../components/PageHeader';
import { SkeletonList } from '../components/Skeleton';
import { tie } from '../lib/text';
import { Markdown } from '../components/Markdown';
import { Screen } from '../components/Screen';
import { Sheet } from '../components/Sheet';
import { Term } from '../components/Tip';
import { MediaSection, useMediaMenuItem } from '../components/MediaSection';
import { IconButton } from '../components/IconButton';
import { IconTag } from '../components/FactTag';
import { Icon } from '../components/Icon';
import { ArrowDown, ArrowUp, ArrowUpRight, BookOpen, Download, ImagePlus, Link2, Video, type LucideIcon } from 'lucide-react';
import { MediaTile } from '../components/Media';
import { api, errorText } from '../lib/api';
import { useAuthed, useMe } from '../lib/queries';
import { FIELD } from '../lib/ui';
import { Fold } from '../components/Fold';
import { clockTime, dateTime, shortDate } from '../lib/date';
import { focusHeadingAfter } from '../lib/focusHeading';
import { ErrorLine } from '../components/ErrorLine';
import { StatusTag } from '../components/StatusTag';
import { Section } from '../components/Section';
import { CardHead } from '../components/CardHead';
import { FieldLabel } from '../components/Field';
import { ToggleChevron } from '../components/ToggleMark';
import { CohortDiscussion } from '../components/CohortDiscussion';
import { MoreMenu } from '../components/MoreMenu';
import { ConfirmDelete } from '../components/ConfirmDelete';
import { Segmented } from '../components/fx/Segmented';

const fmtDate = shortDate;
/** A cohort's state, an enrolment's state and a payment's state in plain words, never the stored key. */
const COHORT_STATUS: Record<string, string> = { upcoming: 'Starts soon', running: 'Running now', finished: 'Finished', cancelled: 'Cancelled' };
const LEARNER_STATUS: Record<string, [string, TagTone]> = { enrolled: ['Learning', 'info'], completed: ['Completed', 'good'], withdrawn: ['Left', 'neutral'] };
const PAYMENT_WORD: Record<string, string> = { free: 'Free', paid: 'Paid', test: 'Test payment', pending: 'Payment pending' };
const SUBMISSION_WORD: Record<Submission['status'], string> = { submitted: 'Waiting for feedback', changes: 'Changes asked', approved: 'Approved' };
const isLive = (s: CohortSession) => {
  const now = Date.now();
  return now >= new Date(s.startsAt).getTime() - 15 * 60_000 && now <= new Date(s.endsAt).getTime() + 60 * 60_000;
};


/** Progress in words: each count only when there is something to count, and the noun in the right number ("1 assignment"). */
function Progress({ p }: { p: Enrollment['progress'] }) {
  const parts = [
    p.assignmentsTotal > 0 ? `${p.assignmentsApproved} of ${p.assignmentsTotal} ${p.assignmentsTotal === 1 ? 'assignment' : 'assignments'} approved` : '',
    p.sessionsTotal > 0 ? `${p.sessionsAttended} of ${p.sessionsTotal} ${p.sessionsTotal === 1 ? 'session' : 'sessions'} attended` : '',
  ].filter(Boolean);
  return <span className="block text-subhead text-ink-soft">{parts.length ? parts.join(', ') : 'Nothing to count yet. Start with the first lesson.'}</span>;
}

const KIND_TIP: Record<string, string> = {
  lesson: 'Read it here, then try it.',
  video: 'Watch it, then try what it shows.',
  reading: 'A page to read before the next step.',
};

/**
 * A cohort's page. `cohortId` and `back` let a page outside School draw one cohort: the Admin guide at /admin/guide, which is not
 * behind School's switch, so an admin with School off still reaches it.
 */
export function Cohort({ cohortId, back = { to: '/school', label: 'School' } }: { cohortId?: string; back?: { to: string; label: string } } = {}) {
  const params = useParams();
  const id = cohortId ?? params.id ?? '';
  const me = useMe();
  const q = useAuthed(['cohort', id], () => api.cohort(id));
  const [scheduling, setScheduling] = useState(false);
  const [openLesson, setOpenLesson] = useState<string | null>(null);
  const [editingMedia, setEditingMedia] = useState(false);
  const attend = useMutation({ mutationFn: ({ sid, userId }: { sid: string; userId?: string }) => api.attend(sid, userId), onSuccess: () => q.refetch() });
  const complete = useMutation({ mutationFn: (eid: string) => api.completeEnrollment(eid), onSuccess: () => q.refetch() });

  if (q.isError) {
    // Not in this cohort (or it is gone): a plain line and the one way forward, the programs on School, where enrolling shows the
    // price first. The page has no price or seats to show here, so it never enrols blind.
    return (
      <Screen>
        <PageHeader back={back} title="School" />
        <div className="mt-md rounded-tile bg-card p-md shadow-toy-soft">
          {/not found|404/i.test(errorText(q.error, '')) ? (
            <>
              <p className="m-0 text-card-title">We could not find this cohort</p>
              <p className="m-0 text-card-note text-ink-soft">The link may be old, the cohort was closed, or its program is invite only.</p>
            </>
          ) : /forbidden|not in this cohort|403/i.test(errorText(q.error, '')) ? (
            <>
              <p className="m-0 text-card-title">You are not in this cohort yet</p>
              <p className="m-0 text-card-note text-ink-soft">Enrol from its program on School, then come back here.</p>
            </>
          ) : (
            <>
              <p className="m-0 text-card-title">This cohort did not open</p>
              <p className="m-0 text-card-note text-ink-soft">Try again in a moment.</p>
            </>
          )}
          <Link to="/school#programs-heading" className="toy btn-primary mt-md inline-flex min-h-[48px] items-center justify-center gap-xs rounded-pill bg-ink px-md text-headline text-on-ink">
            See the programs
          </Link>
        </div>
      </Screen>
    );
  }
  const d = q.data;
  if (!d)
    return (
      <Screen>
        <SkeletonList count={4} lines={2} label="Loading the program" />
      </Screen>
    );
  const k = d.cohort;
  const canRun = d.manager || d.mentor;
  const myId = me.data?.user.id;
  const firstToHandIn = d.myStatus === 'enrolled' ? d.assignments.find((a) => !d.submissions.some((s) => s.assignmentId === a.id && s.learnerId === myId))?.id : undefined;

  return (
    <Screen>
      {/* The cover card; the gallery's round button sits on the helper's line, at its left (founder, 2026-11-04). */}
      <AppCover
        back={back}
        // The program's name is the title, so two programs' pages never look alike; the cohort's name (its dates group) is the eyebrow.
        eyebrow={
          <>
            {k.name}, <Term word="cohort">cohort</Term>
            {k.managerId && k.managerName && k.managerName !== 'Unassigned' ? ` run by ${k.managerName}` : ''}
          </>
        }
        title={tie(k.programName)}
        lede={`${cohortAlwaysOpen(k.startAt, k.endAt) ? 'Always open' : `${fmtDate(k.startAt)} to ${fmtDate(k.endAt)}`}, ${(COHORT_STATUS[k.status] ?? k.status).toLowerCase()}, ${k.enrolled} learner${k.enrolled === 1 ? '' : 's'}`}
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


      <Section id="lessons-heading" title="Lessons">
        {d.items.length === 0 && <p className="m-0 text-subhead text-ink-soft">Lessons appear here as the program adds them.</p>}
        <ol className="flex list-none flex-col gap-xs p-0 m-0">
          {d.items.map((item, i) => (
            <LessonCard key={item.id} item={item} n={i + 1} last={i === d.items.length - 1} open={openLesson === item.id} onToggle={() => setOpenLesson(openLesson === item.id ? null : item.id)} canEdit={d.manager} onChange={() => q.refetch()} />
          ))}
        </ol>
        {/* Whoever runs the program adds a lesson here, in place, at the end of the list; it can be moved up from its own card. */}
        {d.manager && <AddLesson programId={k.programId} onAdded={() => q.refetch()} />}
      </Section>

      <Section id="assignments-heading" title="Assignments">
        {d.assignments.length === 0 && <p className="m-0 text-subhead text-ink-soft">No assignments yet.</p>}
        <ul className="flex list-none flex-col gap-sm p-0 m-0">
          {d.assignments.map((a) => (
            <li key={a.id}>
              {/* Only the first assignment still to hand in carries the solid button, so the screen keeps one. */}
              <AssignmentCard a={a} cohortId={id} primary={a.id === firstToHandIn} mine={d.submissions.find((s) => s.assignmentId === a.id && s.learnerId === myId) ?? null} all={canRun ? d.submissions.filter((s) => s.assignmentId === a.id && s.learnerId !== myId) : []} canRun={canRun} enrolled={d.myStatus === 'enrolled'} onChange={() => q.refetch()} />
            </li>
          ))}
        </ul>
      </Section>

      <Section
        id="sessions-heading"
        title="Live sessions"
        action={
          d.manager && (
            <Button variant="outline" onClick={() => setScheduling(true)}>
              Schedule
            </Button>
          )
        }
      >
        {d.sessions.length === 0 && <p className="m-0 text-subhead text-ink-soft">No sessions scheduled yet.</p>}
        <ul className="flex list-none flex-col gap-xs p-0 m-0">
          {d.sessions.map((s) => (
            <li key={s.id} className="rounded-tile bg-card p-sm shadow-toy-soft">
              {/* A mark on every session in the same corner: here, live now, coming up or over. */}
              <CardHead
                tag={
                  s.attended ? (
                    <StatusTag fit tone="good">You were here</StatusTag>
                  ) : isLive(s) ? (
                    <StatusTag fit tone="info">Live now</StatusTag>
                  ) : new Date(s.startsAt).getTime() > Date.now() ? (
                    <StatusTag fit tone="info">Coming up</StatusTag>
                  ) : (
                    <StatusTag fit tone="neutral">Over</StatusTag>
                  )
                }
              >
                <p className="m-0 text-balance text-card-title [overflow-wrap:anywhere]">{s.title}</p>
                <p className="m-0 text-card-note text-ink-soft">
                  <span className="whitespace-nowrap">{dateTime(s.startsAt)}</span> to <span className="whitespace-nowrap">{clockTime(s.endsAt)}</span>
                </p>
              </CardHead>
              <div className="mt-sm flex flex-wrap justify-end gap-xs">
                {s.onlineUrl && (
                  <a href={s.onlineUrl} target="_blank" rel="noreferrer" className="toy toy-ink btn-outline inline-flex min-h-[48px] items-center gap-xs rounded-pill border border-ink/30 bg-card-strong px-md text-headline font-semibold text-ink">
                    Join
                    <Icon icon={ArrowUpRight} size={16} />
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
      </Section>

      {/* The cohort's discussion: everyone enrolled (or finished) and whoever runs it; the server decides who is in the room. */}
      {(canRun || d.myStatus === 'enrolled' || d.myStatus === 'completed') && <CohortDiscussion cohortId={id} />}

      {canRun && (
        <Section id="learners-heading" title={`Learners, ${d.enrollments.length}`}>
          {d.enrollments.length === 0 && <p className="m-0 text-subhead text-ink-soft">No one has enrolled yet.</p>}
          <ul className="flex list-none flex-col gap-xs p-0 m-0">
            {d.enrollments.map((e) => {
              const [word, tone] = LEARNER_STATUS[e.status] ?? [e.status, 'neutral' as TagTone];
              return (
                <li key={e.id} className="flex flex-col rounded-tile bg-card p-sm shadow-toy-soft">
                  <CardHead
                    tag={
                      <StatusTag fit tone={tone}>
                        {word}
                      </StatusTag>
                    }
                  >
                    <p className="m-0 text-balance text-card-title [overflow-wrap:anywhere]">{e.learnerName}</p>
                    <p className="m-0 text-card-note text-ink-soft">
                      {e.progress.assignmentsApproved} of {e.progress.assignmentsTotal} assignments approved, {e.progress.sessionsAttended} of {e.progress.sessionsTotal} sessions attended
                    </p>
                  </CardHead>
                  {/* One foot: when they joined and how they paid on the left, the manager's action at the right. */}
                  <div className="mt-auto flex flex-wrap-reverse items-center justify-between gap-sm pt-sm">
                    <span className="text-caption text-ink-soft">
                      <span className="whitespace-nowrap">Joined {fmtDate(e.enrolledAt)},</span> {PAYMENT_WORD[e.paymentStatus] ?? e.paymentStatus}
                    </span>
                    {d.manager && e.status === 'enrolled' && (
                      <Button variant="outline" onClick={() => complete.mutate(e.id)} disabled={complete.isPending}>
                        Mark completed
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="mt-xs">
            <ErrorLine e={complete.error} />
          </div>
        </Section>
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

/** A book lesson's "Chapter 1" never breaks between the word and its number: the two are joined with a no-break space before the
 * markdown is drawn (Markdown.tsx is left alone), so the number never starts a line on a phone. */
const tieChapters = (text: string) => text.replace(/\b(Chapter)\s+(\d+)/gi, '$1\u00a0$2');

/** What a lesson's one way in opens, as its caption. Several share one line. */
const RESOURCE_CAPTION: Record<LessonResourceKind, string> = {
  video: 'Watch it here, then try what it shows.',
  book: 'Read it here, then try it. The book goes deeper.',
  file: 'Read it here, then try it. The resource opens or downloads in full.',
  link: 'Read it here, then try it. The resource opens in a new tab.',
};
const RESOURCES_CAPTION = 'Read it here, then try it. Each one opens on its own.';
const RESOURCE_ICON: Record<LessonResourceKind, LucideIcon> = { video: Video, book: BookOpen, file: Download, link: Link2 };
const WAY_IN = 'toy toy-soft inline-flex min-h-[44px] w-full items-center justify-center gap-xs rounded-pill border border-line bg-card-strong px-md text-center text-subhead font-semibold';

/**
 * One way into a lesson, full width. A file shows its download mark and every other way its arrow; beside others, each also leads with
 * its kind's icon, so a list reads at a glance. The app's own files download from here; a file on another site opens in a new tab, where
 * the browser saves it. A book opens its place on the Book page.
 */
function WayIn({ r, all }: { r: LessonResource; all: readonly LessonResource[] }) {
  const label = lessonResourceLabel(r, all);
  const lead = all.length > 1 && r.kind !== 'file' ? <Icon icon={RESOURCE_ICON[r.kind]} size={16} /> : null;
  if (r.kind === 'file')
    return (
      <a href={r.ref} {...(r.ref.startsWith('/') ? { download: '' } : { target: '_blank', rel: 'noreferrer' })} className={WAY_IN}>
        <Icon icon={Download} size={16} />
        {label}
      </a>
    );
  if (r.kind === 'book')
    return (
      <Link to={`/book#${r.ref}`} className={WAY_IN}>
        {lead}
        {label}
        <Icon icon={ArrowUpRight} size={16} />
      </Link>
    );
  return (
    <a href={r.ref} target="_blank" rel="noreferrer" className={WAY_IN}>
      {lead}
      {label}
      <Icon icon={ArrowUpRight} size={16} />
    </a>
  );
}

/**
 * One lesson: a number, the title in full and its kind as a tag in the top right corner; tapping opens it. Open, it reads like a page:
 * its videos play first, each behind its own gate, the words straight on the card, no box inside a box, then at the foot its ways in
 * (Download resource, Watch video, Open resource, a book, or The book on a book's lesson with none), the first with a round button for
 * pictures at its right, the rest full width under it, and their caption. Whoever runs the cohort adds and changes resources in place,
 * under it (the founder, 2026-11-06: "skill files where needed, other link to a youtube video, or give option, call it download
 * resource"; 2026-11-07: "add ability to select multiple resources like youtube or book or others").
 */
function LessonCard({ item, n, last, open, onToggle, canEdit, onChange }: { item: LearningItem; n: number; last: boolean; open: boolean; onToggle: () => void; canEdit: boolean; onChange: () => void }) {
  const [editing, setEditing] = useState(false);
  const [changing, setChanging] = useState(false);
  const [removing, setRemoving] = useState(false);
  const move = useMutation({ mutationFn: (to: 'up' | 'down') => api.moveSchoolLesson(item.id, to), onSuccess: () => onChange() });
  const remove = useMutation({ mutationFn: () => api.deleteSchoolLesson(item.id), onSuccess: () => onChange() });
  const media = useMediaMenuItem('lesson', item.id, () => setEditing(true));
  const resources = item.resources;
  const videos = resources.filter((r) => r.kind === 'video');
  // A lesson or reading that plays a video says so in its corner too.
  const tag = (videos.length > 0 ? KIND_TAG.video : KIND_TAG[item.contentType]) ?? { icon: 'FileText' as const, word: item.contentType };
  // A lesson from one of the founder's books with no resource of its own: its way in is the book's own page in the app (the founder,
  // 2026-11-06: "the school module is very missing the button").
  const book = resources.length === 0 ? BOOKS.find((b) => b.courseId === item.programId) : undefined;
  const ways: LessonResource[] = book ? [{ id: `book-${book.slug}`, kind: 'book', ref: book.slug, label: LESSON_RESOURCE_KIND_META.book.label }] : resources;
  const caption = ways.length > 1 ? RESOURCES_CAPTION : ways[0] ? RESOURCE_CAPTION[ways[0].kind] : (KIND_TIP[item.contentType] ?? 'A step in this program.');
  return (
    <li className="rounded-tile bg-card shadow-toy-soft">
      <button type="button" aria-expanded={open} onClick={onToggle} className="toy toy-flat flex min-h-[56px] w-full items-start gap-sm rounded-tile p-sm text-left focus-visible:outline-offset-0">
        <span className="flex size-[32px] shrink-0 items-center justify-center rounded-pill bg-paper text-subhead font-medium" aria-hidden="true">
          {n}
        </span>
        <span className="min-w-0 flex-1 pt-[4px] text-headline text-balance">
          <Phrases text={tie(item.moduleTitle)} />
        </span>
        <span className="flex shrink-0 items-center gap-xs pt-[2px]">
          <IconTag tone="calm" icon={tag.icon}>{tag.word}</IconTag>
          <ToggleChevron open={open} size={20} className="text-ink-soft" />
        </span>
      </button>
      {open && (
        <div className="border-t border-line px-sm pt-sm pb-md">
          {videos.map((v, i) => (
            <div key={v.id} className="mt-sm">
              {/* Each video waits behind its own gate; only the first gate's Play is solid, so the lesson keeps one solid button. */}
              <MediaTile quiet={i > 0} item={{ id: v.id, kind: 'video', url: v.ref, caption: v.label || (videos.length > 1 ? `${item.moduleTitle}, video ${i + 1}` : item.moduleTitle) }} />
            </div>
          ))}
          <MediaSection type="lesson" id={item.id} title="Lesson pictures and videos" trigger={null} open={editing} onOpenChange={setEditing} />
          {item.body ? <Markdown text={tieChapters(item.body)} className="prose-long" /> : resources.length === 0 && <p className="mt-sm m-0 text-subhead text-ink-soft">Nothing written here yet.</p>}
          {/* The ways in, at the foot of the open lesson once it is read: each takes the width, and the round button sits at the first one's right. The helper line says
              what the link opens, so it sits centred under it as its caption; several share one line under the last. */}
          {ways.length > 0 ? (
            <div className="mt-md">
              <ul className="m-0 flex list-none flex-col gap-xs p-0">
                {ways.map((r, i) => (
                  <li key={r.id} className="flex items-start justify-end gap-xs">
                    <div className="flex min-w-0 flex-1 flex-col items-center">
                      <WayIn r={r} all={ways} />
                      {ways.length === 1 && <p className="mt-xs m-0 text-center text-caption text-balance text-ink-soft">{caption}</p>}
                    </div>
                    {i === 0 && media && <IconButton icon={ImagePlus} label={media.label} onClick={media.onSelect} opens />}
                  </li>
                ))}
              </ul>
              {ways.length > 1 && <p className="mt-xs m-0 text-center text-caption text-balance text-ink-soft">{caption}</p>}
            </div>
          ) : (
            <div className="mt-md flex items-start justify-between gap-sm">
              <p className="m-0 min-w-0 text-subhead text-ink-soft">{caption}</p>
              {media && <IconButton icon={ImagePlus} label={media.label} onClick={media.onSelect} opens />}
            </div>
          )}
          {canEdit && (
            // The people who run it change the lesson in place, under it: its words, from the menu its place in the program or removing
            // it (which asks first), and under that its resources, across the card's whole width.
            <>
              <div className="mt-sm flex items-start gap-xs">
                <div className="flex min-w-0 flex-1 flex-col">
                  <LessonEditor item={item} open={changing} onOpenChange={setChanging} onSaved={onChange} />
                  <ErrorLine e={move.error} />
                </div>
                <MoreMenu
                  label={`Manage ${item.moduleTitle}`}
                  items={[
                    { key: 'up', label: 'Move up', onSelect: () => move.mutate('up'), disabled: move.isPending || n === 1 },
                    { key: 'down', label: 'Move down', onSelect: () => move.mutate('down'), disabled: move.isPending || last },
                    { key: 'remove', label: 'Remove lesson', destructive: true, onSelect: () => setRemoving(true), disabled: remove.isPending },
                  ]}
                />
                <ConfirmDelete
                  open={removing}
                  title={`Remove ${item.moduleTitle}?`}
                  body="It leaves the program for everyone, with its pictures and videos. Assignments and hand-ins stay."
                  yes="Yes, remove the lesson"
                  keep="Keep it"
                  pending={remove.isPending}
                  failed={remove.isError}
                  error={remove.error ? errorText(remove.error, '') : undefined}
                  onYes={() =>
                    remove.mutate(undefined, {
                      onSuccess: () => {
                        setRemoving(false);
                        // The lesson's card goes with it, so the keyboard's place moves to the list's heading.
                        focusHeadingAfter('lessons-heading');
                      },
                    })
                  }
                  onClose={() => {
                    setRemoving(false);
                    remove.reset();
                  }}
                />
              </div>
              <ResourcesEditor item={item} onSaved={onChange} />
            </>
          )}
        </div>
      )}
    </li>
  );
}

const KIND_OPTIONS = [
  { value: 'lesson', label: 'Lesson' },
  { value: 'video', label: 'Video' },
  { value: 'reading', label: 'Reading' },
] as const satisfies readonly { value: LearningItem['contentType']; label: string }[];
const WORDS_HINT = 'Plain words. ## for a heading, - for a point, **bold**. No links: a link goes in the resource.';
/** A quiet line under every field's label, or under none (the founder, 2026-11-06): the lesson forms carry one on each. */
const TITLE_HINT = 'Shown in the lesson list.';
const KIND_HINT = 'Sets the tag in the lesson’s corner.';
/** A row of a few equal choices spans the full width in equal parts (the founder, 2026-11-06); `grid!` beats the capsule's inline-flex. */
const SEG_FULL = 'grid! w-full grid-flow-col auto-cols-fr [&>button]:px-xs!';

/** A lesson's title, kind and words, changed in place at the lesson's foot (never a popup): the fields, then Save or Cancel. */
function LessonEditor({ item, open, onOpenChange, onSaved }: { item: LearningItem; open: boolean; onOpenChange: (o: boolean) => void; onSaved: () => void }) {
  const [title, setTitle] = useState(item.moduleTitle);
  const [kind, setKind] = useState<LearningItem['contentType']>(item.contentType);
  const [words, setWords] = useState(item.body);
  const save = useMutation({
    mutationFn: () => api.updateSchoolLesson(item.id, { moduleTitle: title.trim(), contentType: kind, body: words }),
    onSuccess: () => {
      onOpenChange(false);
      onSaved();
    },
  });
  const same = title.trim() === item.moduleTitle && kind === item.contentType && words.trim() === item.body;
  return (
    <Fold
      title="Edit this lesson"
      open={open}
      onOpenChange={(o) => {
        // Opening starts from what is saved now; closing drops what was not saved.
        setTitle(item.moduleTitle);
        setKind(item.contentType);
        setWords(item.body);
        save.reset();
        onOpenChange(o);
      }}
    >
      <form
        className="flex flex-col gap-xs"
        onSubmit={(e) => {
          e.preventDefault();
          if (title.trim() && !same) save.mutate();
        }}
      >
        <FieldLabel label="Title" hint={TITLE_HINT}>
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} maxLength={LESSON_TITLE_MAX} required className={FIELD} />
        </FieldLabel>
        <fieldset className="m-0 border-0 p-0">
          <legend className="text-subhead font-semibold">Kind</legend>
          <span className="block text-caption text-ink-soft">{KIND_HINT}</span>
          <Segmented label="Kind" className={`mt-xs ${SEG_FULL}`} value={kind} onChange={setKind} options={KIND_OPTIONS} />
        </fieldset>
        <FieldLabel label="Words" hint={WORDS_HINT}>
          <textarea value={words} onChange={(e) => setWords(e.target.value)} rows={14} maxLength={LESSON_BODY_MAX} className={FIELD} />
        </FieldLabel>
        <ErrorLine e={save.error} />
        {/* Save takes the free width; Cancel sits at its right on the same line. */}
        <div className="flex items-center gap-xs">
          <Button type="submit" variant="outline" className="flex-1" disabled={save.isPending || !title.trim() || same}>
            Save
          </Button>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </form>
    </Fold>
  );
}

/** Add a lesson at the end of the program, in place under the list (a Fold with a plus), for whoever runs it. */
function AddLesson({ programId, onAdded }: { programId: string; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<LearningItem['contentType']>('lesson');
  const [words, setWords] = useState('');
  const [said, setSaid] = useState('');
  const add = useMutation({
    mutationFn: () => api.addLearningItem(programId, { moduleTitle: title.trim(), contentType: kind, body: words }),
    onSuccess: () => {
      setSaid(`Added “${title.trim()}” at the end of the lessons.`);
      setTitle('');
      setWords('');
      setOpen(false);
      onAdded();
    },
  });
  return (
    <>
      <Fold
        className="mt-sm"
        title="Add a lesson"
        adds
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (o) setSaid('');
        }}
      >
        <form
          className="flex flex-col gap-xs"
          onSubmit={(e) => {
            e.preventDefault();
            if (title.trim()) add.mutate();
          }}
        >
          <FieldLabel label="Title" hint={TITLE_HINT}>
            <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} maxLength={LESSON_TITLE_MAX} required className={FIELD} />
          </FieldLabel>
          <fieldset className="m-0 border-0 p-0">
            <legend className="text-subhead font-semibold">Kind</legend>
            <span className="block text-caption text-ink-soft">{KIND_HINT}</span>
            <Segmented label="Kind" className={`mt-xs ${SEG_FULL}`} value={kind} onChange={setKind} options={KIND_OPTIONS} />
          </fieldset>
          <FieldLabel label="Words" hint={WORDS_HINT}>
            <textarea value={words} onChange={(e) => setWords(e.target.value)} rows={8} maxLength={LESSON_BODY_MAX} className={FIELD} />
          </FieldLabel>
          <ErrorLine e={add.error} />
          <Button type="submit" variant="outline" disabled={add.isPending || !title.trim()}>
            Add the lesson
          </Button>
        </form>
      </Fold>
      {said && (
        <p role="status" className="mt-xs m-0 text-footnote text-ink-soft">
          {said}
        </p>
      )}
    </>
  );
}

/** What the link field asks for, by kind. */
const LINK_HINT: Record<Exclude<LessonResourceKind, 'book'>, string> = {
  video: 'It plays in the lesson, like https://youtu.be/abc123.',
  file: 'It opens or downloads. Use https, or a /resources/ file.',
  link: 'It opens in a new tab. Use https, or a /resources/ file.',
};

/** Add or change one resource in place (never a popup): what kind it is, the link or the book that kind needs, its label, then Save or Cancel. */
function ResourceForm({ itemId, resource, programBook, note, onSaved, onCancel }: { itemId: string; resource?: LessonResource; programBook?: string; note?: string; onSaved: (label: string) => void; onCancel: () => void }) {
  const [kind, setKind] = useState<LessonResourceKind>(resource?.kind ?? 'video');
  const [link, setLink] = useState(resource && resource.kind !== 'book' ? resource.ref : '');
  const [bookKey, setBookKey] = useState(resource?.kind === 'book' ? resource.ref : (programBook ?? BOOKS[0]?.slug ?? ''));
  const [label, setLabel] = useState(resource?.label ?? '');
  const ref = kind === 'book' ? bookKey : link.trim();
  const body = { kind, ref, label: label.trim() };
  const save = useMutation({
    mutationFn: () => (resource ? api.changeLessonResource(itemId, resource.id, body) : api.addLessonResource(itemId, body)),
    onSuccess: () => onSaved(lessonResourceLabel({ id: '', ...body })),
  });
  const same = Boolean(resource) && kind === resource?.kind && ref === resource.ref && label.trim() === resource.label;
  return (
    <form
      className="flex flex-col gap-xs"
      onSubmit={(e) => {
        e.preventDefault();
        if (ref && !same && !save.isPending) save.mutate();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onCancel();
        }
      }}
    >
      {note && <p className="m-0 text-caption text-ink-soft">{note}</p>}
      <FieldLabel label="Kind" hint="What people get when they tap it.">
        <select autoFocus value={kind} onChange={(e) => setKind(e.target.value as LessonResourceKind)} className={FIELD}>
          {LESSON_RESOURCE_KINDS.map((k) => (
            <option key={k} value={k}>
              {LESSON_RESOURCE_KIND_META[k].name}
            </option>
          ))}
        </select>
      </FieldLabel>
      {kind === 'book' ? (
        <FieldLabel label="Which book" hint="It opens the book’s place in the app.">
          <select value={bookKey} onChange={(e) => setBookKey(e.target.value)} className={FIELD}>
            {BOOKS.map((b) => (
              <option key={b.slug} value={b.slug}>
                {b.title}
              </option>
            ))}
          </select>
        </FieldLabel>
      ) : (
        <FieldLabel label="Link" hint={LINK_HINT[kind]}>
          <input type="text" inputMode="url" value={link} onChange={(e) => setLink(e.target.value)} maxLength={LESSON_RESOURCE_LINK_MAX} placeholder="https://" className={FIELD} />
        </FieldLabel>
      )}
      <FieldLabel label="Label" hint="Optional. The words on the button.">
        <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={LESSON_RESOURCE_LABEL_MAX} placeholder={lessonResourceLabel({ id: '', kind, ref: bookKey, label: '' })} className={FIELD} />
      </FieldLabel>
      <ErrorLine e={save.error} />
      {/* Save takes the free width; Cancel sits at its right on the same line. */}
      <div className="flex items-center gap-xs">
        <Button type="submit" variant="outline" className="flex-1" disabled={save.isPending || !ref || same}>
          Save
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/** A resource's row in the editor: its words, the arrows that move it, then at its foot Remove (a second tap) and Change (the form, in place). */
function ResourceRow({ itemId, r, all, index, programBook, onSaved, onSay, onRemoved }: { itemId: string; r: LessonResource; all: readonly LessonResource[]; index: number; programBook?: string; onSaved: () => void; onSay: (line: string) => void; onRemoved: (line: string) => void }) {
  const [changing, setChanging] = useState(false);
  const [armed, setArmed] = useState(false);
  const up = useRef<HTMLButtonElement>(null);
  const down = useRef<HTMLButtonElement>(null);
  const changeId = useId();
  // Cancel, Escape or a save hand the keyboard's place back to the button that opened the form.
  const shut = () => {
    setChanging(false);
    document.getElementById(changeId)?.focus();
  };
  const move = useMutation({ mutationFn: (to: 'up' | 'down') => api.moveLessonResource(itemId, r.id, to), onSuccess: () => onSaved() });
  const label = lessonResourceLabel(r, all);
  const remove = useMutation({
    mutationFn: () => api.removeLessonResource(itemId, r.id),
    onSuccess: () => onRemoved(`Removed “${label}”.`),
  });
  useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(false), 4000);
    return () => window.clearTimeout(t);
  }, [armed]);
  // An arrow that reached the end of the list turns off, so the keyboard's place moves to the other arrow.
  const first = index === 0;
  const last = index === all.length - 1;
  useEffect(() => {
    if (first && document.activeElement === up.current) down.current?.focus();
    else if (last && document.activeElement === down.current) up.current?.focus();
  }, [first, last]);
  const arrow = 'toy toy-soft flex size-[44px] shrink-0 items-center justify-center rounded-pill text-ink-soft hover:text-ink disabled:pointer-events-none disabled:opacity-40';
  return (
    <li className="rounded-tile bg-paper p-sm">
      <p className="m-0 text-headline [overflow-wrap:anywhere]">{label}</p>
      <p className="m-0 truncate text-caption text-ink-soft" title={r.ref}>
        {r.kind === 'book' ? LESSON_RESOURCE_KIND_META.book.name : r.ref}
      </p>
      <div className="mt-xs flex flex-wrap items-center justify-between gap-xs">
        <span className="flex gap-xs">
          <button ref={up} type="button" aria-label={`Move ${label} up`} disabled={first} onClick={() => !move.isPending && move.mutate('up')} className={arrow}>
            <Icon icon={ArrowUp} size={18} />
          </button>
          <button ref={down} type="button" aria-label={`Move ${label} down`} disabled={last} onClick={() => !move.isPending && move.mutate('down')} className={arrow}>
            <Icon icon={ArrowDown} size={18} />
          </button>
        </span>
        <span className="ml-auto flex flex-wrap items-center justify-end gap-xs">
          <Button
            size="sm"
            variant="ghost"
            disabled={remove.isPending}
            className={armed ? 'red-armed' : ''}
            aria-label={armed ? `Tap again to remove ${label}` : `Remove ${label}`}
            onClick={() => {
              if (armed) remove.mutate();
              else setArmed(true);
            }}
          >
            <span aria-live="polite">{armed ? 'Tap again to remove' : 'Remove'}</span>
          </Button>
          <Button id={changeId} size="sm" variant="outline" aria-expanded={changing} aria-label={`Change ${label}`} onClick={() => setChanging((c) => !c)}>
            Change
            <ToggleChevron open={changing} size={16} />
          </Button>
        </span>
      </div>
      <ErrorLine e={move.error ?? remove.error} />
      {changing && (
        <div className="mt-sm">
          <ResourceForm
            itemId={itemId}
            resource={r}
            programBook={programBook}
            onSaved={(words) => {
              shut();
              onSay(`Saved “${words}”.`);
              onSaved();
            }}
            onCancel={shut}
          />
        </div>
      )}
    </li>
  );
}

/** A lesson's resources for whoever runs it, in place at the lesson's foot: the rows to change, move and remove, and Add a resource. */
function ResourcesEditor({ item, onSaved }: { item: LearningItem; onSaved: () => void }) {
  const [changing, setChanging] = useState(false);
  const [adding, setAdding] = useState(false);
  const [said, setSaid] = useState('');
  const all = item.resources;
  const programBook = BOOKS.find((b) => b.courseId === item.programId)?.slug;
  // A removed row takes the keyboard's place with it, so once the list has come back it goes to the first fold here.
  const wrap = useRef<HTMLDivElement>(null);
  const refocus = useRef(false);
  useEffect(() => {
    if (!refocus.current) return;
    refocus.current = false;
    wrap.current?.querySelector('button')?.focus();
  }, [all.length]);
  return (
    <div ref={wrap}>
      {all.length > 0 && (
        <Fold className="mt-sm" title={all.length === 1 ? 'Change resource' : 'Change resources'} hint={`${all.length} of ${MAX_LESSON_RESOURCES}`} open={changing} onOpenChange={setChanging}>
          <ul className="m-0 flex list-none flex-col gap-xs p-0">
            {all.map((r, i) => (
              <ResourceRow
                key={r.id}
                itemId={item.id}
                r={r}
                all={all}
                index={i}
                programBook={programBook}
                onSaved={onSaved}
                onSay={setSaid}
                onRemoved={(line) => {
                  refocus.current = true;
                  setSaid(line);
                  onSaved();
                }}
              />
            ))}
          </ul>
        </Fold>
      )}
      {all.length < MAX_LESSON_RESOURCES ? (
        <Fold
          className="mt-sm"
          adds
          title="Add a resource"
          open={adding}
          onOpenChange={(o) => {
            setAdding(o);
            if (o) setSaid('');
          }}
        >
          {/* The form starts fresh each time it opens, since a closed fold holds nothing. */}
          <ResourceForm
            itemId={item.id}
            programBook={programBook}
            note={programBook && all.length === 0 ? 'This lesson shows The book until it has a resource. Add the book too if you want to keep it.' : undefined}
            onSaved={(words) => {
              setAdding(false);
              setSaid(`Added “${words}”.`);
              onSaved();
            }}
            onCancel={() => setAdding(false)}
          />
        </Fold>
      ) : (
        <p className="mt-sm m-0 text-caption text-ink-soft">{LESSON_RESOURCES_FULL}</p>
      )}
      {said && (
        <p role="status" className="mt-xs m-0 text-footnote text-ink-soft">
          {said}
        </p>
      )}
    </div>
  );
}

function AssignmentCard({ a, cohortId, primary = false, mine, all, canRun, enrolled, onChange }: { a: CourseAssignment; cohortId: string; primary?: boolean; mine: Submission | null; all: Submission[]; canRun: boolean; enrolled: boolean; onChange: () => void }) {
  const [url, setUrl] = useState(mine?.url ?? '');
  const [text, setText] = useState(mine?.text ?? '');
  const submit = useMutation({ mutationFn: () => api.submitAssignment(a.id, { cohortId, url: url || undefined, text: text || undefined }), onSuccess: () => onChange() });
  const tone: TagTone = mine?.status === 'approved' ? 'good' : mine?.status === 'changes' ? 'warn' : mine ? 'info' : 'neutral';
  const label = mine ? SUBMISSION_WORD[mine.status] : 'Not handed in';
  const waiting = all.filter((s) => s.status === 'submitted').length;
  // Someone who is both learning in this cohort and running it sees two parts: their own hand-in (their tag in the corner), then
  // a separate "Hand-ins to review" block with its own count, so the two views never mix.
  const learner = !canRun || enrolled || mine !== null;
  const reviewTag =
    waiting > 0 ? (
      <StatusTag fit tone="warn">{`${waiting} to review`}</StatusTag>
    ) : (
      <StatusTag fit tone="neutral">Nothing to review</StatusTag>
    );
  return (
    <div className="rounded-tile bg-card p-sm shadow-toy-soft">
      <CardHead
        tag={
          learner ? (
            <StatusTag fit tone={tone}>
              {label}
            </StatusTag>
          ) : (
            reviewTag
          )
        }
      >
        <p className="m-0 text-balance text-card-title [overflow-wrap:anywhere]">{a.title}</p>
        <p className="m-0 text-card-note text-ink-soft">Due {a.dueDays} days in</p>
      </CardHead>
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
          <FieldLabel label="Link to your work">
            <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" className={FIELD} />
          </FieldLabel>
          <FieldLabel label="Or write it here">
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={5000} className={FIELD} />
          </FieldLabel>
          <Button type="submit" variant={primary && !mine ? 'primary' : 'outline'} disabled={submit.isPending || (!url.trim() && !text.trim())}>
            {mine ? 'Hand in again' : 'Hand in'}
          </Button>
          <ErrorLine e={submit.error} />
        </form>
      )}
      {canRun && learner ? (
        <div className="mt-md border-t border-line pt-sm">
          <CardHead tag={reviewTag}>
            <p className="m-0 text-headline">Hand-ins to review</p>
          </CardHead>
          <Reviews all={all} onChange={onChange} />
        </div>
      ) : (
        canRun && <Reviews all={all} onChange={onChange} />
      )}
    </div>
  );
}

/** Every learner's hand-in for one assignment, for whoever runs the cohort. */
function Reviews({ all, onChange }: { all: Submission[]; onChange: () => void }) {
  if (all.length === 0) return <p className="mt-sm m-0 text-subhead text-ink-soft">No one has handed this in yet.</p>;
  return (
    <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
      {all.map((s) => (
        <li key={s.id}>
          <SubmissionReview s={s} onChange={onChange} />
        </li>
      ))}
    </ul>
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
          {SUBMISSION_WORD[s.status] ?? s.status}, <span className="whitespace-nowrap">{fmtDate(s.submittedAt)}</span>
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
          <FieldLabel label="Feedback" hint="What works and what to change.">
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} maxLength={3000} className={FIELD} />
          </FieldLabel>
          <FieldLabel className="mt-xs" label="Grade" hint="Optional">
            <input value={grade} onChange={(e) => setGrade(e.target.value)} maxLength={20} placeholder="A, 8/10, pass" className={FIELD} />
          </FieldLabel>
          {/* Two equal choices, so neither is solid. */}
          <div className="mt-xs flex gap-xs">
            <Button variant="outline" onClick={() => feedback.mutate('approved')} disabled={feedback.isPending || !comment.trim()}>
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
        <FieldLabel label="Title">
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required className={FIELD} />
        </FieldLabel>
        <div className="grid grid-cols-2 gap-xs">
          <FieldLabel label="Starts">
            <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required className={FIELD} />
          </FieldLabel>
          <FieldLabel label="Minutes">
            <input type="number" min={15} max={600} value={minutes} onChange={(e) => setMinutes(e.target.value)} className={FIELD} />
          </FieldLabel>
        </div>
        <FieldLabel label="Joining link">
          <input type="url" value={onlineUrl} onChange={(e) => setOnlineUrl(e.target.value)} placeholder="https://" className={FIELD} />
        </FieldLabel>
        <ErrorLine e={schedule.error} />
        <Button type="submit" size="lg" full disabled={schedule.isPending || !title.trim() || !startsAt}>
          Schedule
        </Button>
      </form>
    </Sheet>
  );
}

