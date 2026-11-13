import { BADGE_META, COACH_SHARE_META, COACH_SHARE_PARTS, MAX_COACHES, type CoachLink, type CoachSharePart } from '@kreators/shared';
import { useMutation } from '@tanstack/react-query';
import { Suspense, useState } from 'react';
import { Link } from 'react-router';
import { api } from '../lib/api';
import { useAuthed, useRefreshAll } from '../lib/queries';
import { Button } from './Button';
import { ConfirmDelete } from './ConfirmDelete';
import { Fold } from './Fold';
import { Nudge } from './Nudge';
import { Pager, usePage } from './Pager';
import { RoleBadge } from './RoleBadge';
import { Sheet } from './Sheet';
import { SkeletonList } from './Skeleton';
import { Toggle } from './Toggle';
import { longDate } from '../lib/date';
import { lazyNamed } from '../lib/lazy';
import { focusHeadingAfter } from '../lib/focusHeading';
import { RED_YES } from '../lib/ui';

const day = longDate;
// The table switches download only when their fold is opened (the registry of every table is its own chunk).
const CoachTablesShare = lazyNamed(() => import('./CoachTablesShare'), 'CoachTablesShare');

/** A person in a coaching list: the first letter of their name, with their badge on it. */
export function CoachFace({ name, badge, size = 40 }: { name: string; badge: CoachLink['coach']['badge']; size?: number }) {
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center rounded-pill bg-paper font-display font-bold text-ink" style={{ width: size, height: size, fontSize: Math.round(size * 0.45) }} aria-hidden="true">
      {(name.trim()[0] ?? '?').toUpperCase()}
      <RoleBadge role={badge} size={Math.round(size * 0.45)} className="absolute -right-[4px] -bottom-[4px]" />
    </span>
  );
}

/**
 * The side of the student in coaching, the one block for it: asks to answer, each coach with the six parts they may see as switches (in a fold,
 * so a long list never fills the page; open while an ask waits, since that is when they choose), and ending it. On the Profile tab and in
 * Coaching, both reading the same data, so a change in one shows in the other. Its calls live under /me/coach, which no app switch can close.
 */
// `inCoaching`: on the Coaching page itself, inside its own fold, so the block skips its heading and lede and points down to the list of coaches.
export function MyCoachSection({ id = 'coach', title = 'Your life coach', inCoaching = false }: { id?: string; title?: string; inCoaching?: boolean }) {
  const pg = usePage('coach');
  const q = useAuthed(['my-coach', pg.query], () => api.myCoach(pg.query));
  const refresh = useRefreshAll();
  const [ending, setEnding] = useState<CoachLink | null>(null);
  const [unasking, setUnasking] = useState<CoachLink | null>(null);
  const done = () => {
    refresh();
    void q.refetch();
  };
  const answer = useMutation({ mutationFn: (v: { id: string; yes: boolean }) => api.answerCoach(v.id, v.yes), onSuccess: done });
  // Read the link again after a refusal too (a 409 when another save changed the share at the same moment), so the switches show what is kept.
  const share = useMutation({ mutationFn: (v: { id: string; part: CoachSharePart; on: boolean }) => api.shareWithCoach(v.id, { [v.part]: v.on }), onSettled: done });
  const end = useMutation({
    mutationFn: (linkId: string) => api.endCoach(linkId),
    onSuccess: () => {
      setEnding(null);
      setUnasking(null);
      done();
      // The row's buttons go with the link, so the keyboard's place moves to this block's heading.
      focusHeadingAfter(inCoaching ? 'my-coach-heading' : `${id}-heading`);
    },
  });
  const links = (q.data?.links ?? []).filter((l) => l.student.id !== l.coach.id);
  const error = answer.error ?? share.error ?? end.error;
  return (
    <section id={id} className={inCoaching ? '' : 'mt-lg scroll-mt-[64px]'} aria-labelledby={inCoaching ? undefined : `${id}-heading`}>
      {!inCoaching && (
        <>
          <h2 id={`${id}-heading`} className="text-title2">
            {title}
          </h2>
          <p className="mt-xs m-0 text-subhead text-ink-soft">A coach sees only what you switch on, and only reads it. End it any time.</p>
        </>
      )}
      {q.isPending && <SkeletonList className="mt-sm" count={1} lines={2} label="Loading your life coach" />}
      {q.data && links.length === 0 && (
        <p className="mt-sm m-0 text-subhead">
          No life coach yet.{' '}
          <Link to={inCoaching ? '#directory-heading' : '/coaching'} className="font-semibold underline underline-offset-4">
            {inCoaching ? 'Find one below' : 'Find one in Coaching'}
          </Link>
          .
        </p>
      )}
      <ul className="mt-sm flex list-none flex-col gap-sm p-0 m-0">
        {links.map((l) => {
          const waiting = l.status === 'pending';
          const mineToAnswer = waiting && l.askedBy !== 'student';
          return (
            <li key={l.id} className="rounded-card bg-card p-md shadow-toy-soft">
              <div className="flex items-center gap-sm">
                <CoachFace name={l.coach.name} badge={l.coach.badge} />
                <span className="min-w-0 flex-1">
                  <span className="block text-card-title">
                    {l.coach.name}
                    {l.coach.handle ? <span className="text-ink-soft"> @{l.coach.handle}</span> : null}
                  </span>
                  <span className="block text-card-note text-ink-soft">
                    {BADGE_META[l.coach.badge].name}.{' '}
                    {waiting ? (mineToAnswer ? (l.askedBy === 'admin' ? 'The team suggests them as your coach.' : 'They would like to be your coach.') : 'You asked them. Waiting for their yes.') : `Your coach since ${day(l.answeredAt ?? l.createdAt)}.`}
                  </span>
                </span>
              </div>
              {/* The coach asked to see patterns: the same switch, one tap, and it stays their choice. */}
              {l.status === 'active' && !l.share.patterns && l.patternsAskedAt && (
                <div className="mt-sm flex flex-wrap-reverse items-center justify-between gap-sm rounded-tile bg-paper p-sm">
                  <p className="m-0 min-w-[60%] flex-1 text-subhead">{l.coach.name} asked to see your patterns. It is your choice.</p>
                  <Button size="sm" variant="outline" disabled={share.isPending} onClick={() => share.mutate({ id: l.id, part: 'patterns', on: true })}>
                    Turn it on
                  </Button>
                </div>
              )}
              {/* Every link they can still choose on, a waiting one they asked for too: they see each switch before anything is shared. */}
              <Fold title={waiting ? 'What they would see' : 'What they see'} hint={`${COACH_SHARE_PARTS.filter((part) => l.share[part]).length} of ${COACH_SHARE_PARTS.length}`} defaultOpen={waiting} className="mt-sm">
                <fieldset className="m-0 border-0 p-0">
                  <legend className="sr-only">{waiting ? 'What they would see' : 'What they see'}</legend>
                  <div className="flex flex-col gap-xs">
                    {COACH_SHARE_PARTS.map((part) => (
                      <Toggle key={part} on={l.share[part]} disabled={share.isPending} onChange={(on) => share.mutate({ id: l.id, part, on })} label={COACH_SHARE_META[part].name} hint={COACH_SHARE_META[part].blurb} />
                    ))}
                  </div>
                </fieldset>
              </Fold>
              {/* Whole tables of their own data (All tables, 2026-11-13): each off until they switch it on for this one coach, read only. */}
              {(l.status === 'active' || waiting) && (
                <Fold title="Tables your coach can see" hint={`${(l.share.tables ?? []).length} shared`} className="mt-xs">
                  <Suspense fallback={<SkeletonList count={1} lines={2} label="Loading the tables" />}>
                    <CoachTablesShare linkId={l.id} coachName={l.coach.name} shared={l.share.tables ?? []} onSaved={done} />
                  </Suspense>
                </Fold>
              )}
              <div className="mt-sm flex flex-wrap gap-xs">
                {mineToAnswer && (
                  <>
                    <Button disabled={answer.isPending} onClick={() => answer.mutate({ id: l.id, yes: true })}>
                      Say yes
                    </Button>
                    <Button variant="outline" disabled={answer.isPending} onClick={() => answer.mutate({ id: l.id, yes: false })}>
                      Say no
                    </Button>
                  </>
                )}
                {waiting && !mineToAnswer && (
                  <Button variant="ghost" disabled={end.isPending} onClick={() => { end.reset(); setUnasking(l); }}>
                    Take back the ask
                  </Button>
                )}
                {l.status === 'active' && (
                  <Button variant="ghost" disabled={end.isPending} onClick={() => { end.reset(); setEnding(l); }}>
                    End coaching
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <Pager page={q.data?.linksPage} prefix="coach" label="coaches" />
      {error && (
        <p role="alert" className="mt-sm m-0 rounded-tile bg-r1/15 p-sm text-subhead">
          {error instanceof Error ? error.message : 'That did not work. Check your connection and try again.'}
        </p>
      )}
      <Nudge className="mt-xs" text={`Up to ${MAX_COACHES} coaches at once. Every change is logged ${inCoaching ? 'further down this page' : 'under Coaching'}.`} />
      <ConfirmDelete
        open={unasking !== null}
        title={`Take back your ask to ${unasking?.coach.name ?? 'this coach'}?`}
        body="They no longer see it waiting. You can ask again later."
        pending={end.isPending}
        failed={end.isError}
        onYes={() => unasking && end.mutate(unasking.id)}
        onClose={() => setUnasking(null)}
        yes="Yes, take it back"
        keep="Keep the ask"
      />
      <Sheet open={Boolean(ending)} onClose={() => setEnding(null)} title={`End coaching with ${ending?.coach.name ?? 'your coach'}?`}>
        <p className="m-0 text-callout">They stop seeing your progress at once and are told. Their notes and the change log stay with you.</p>
        {/* Said here too: the list's own error line sits under this sheet, out of sight. */}
        {end.isError && (
          <p role="alert" className="mt-sm m-0 text-subhead text-r1">
            That did not work. Try again.
          </p>
        )}
        <div className="mt-md flex flex-col gap-xs">
          <button type="button" disabled={end.isPending} onClick={() => ending && end.mutate(ending.id)} className={RED_YES}>
            Yes, end it
          </button>
          <Button variant="outline" full onClick={() => setEnding(null)}>
            Keep coaching
          </Button>
        </div>
      </Sheet>
    </section>
  );
}
