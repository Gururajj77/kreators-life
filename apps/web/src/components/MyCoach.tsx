import { BADGE_META, COACH_SHARE_META, COACH_SHARE_PARTS, MAX_COACHES, type CoachLink, type CoachSharePart, LOCALE } from '@kreators/shared';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { api } from '../lib/api';
import { useAuthed, useRefreshAll } from '../lib/queries';
import { Button } from './Button';
import { ConfirmDelete } from './ConfirmDelete';
import { Nudge } from './Nudge';
import { Pager, usePage } from './Pager';
import { RoleBadge } from './RoleBadge';
import { Sheet } from './Sheet';
import { Toggle } from './Toggle';

const day = (iso: string) => new Date(iso).toLocaleDateString(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' });

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
 * The side of the student in coaching, the one block for it: asks to answer, each coach with the five parts they may see
 * as switches, and ending it. On the Profile tab and in Coaching, both reading the same data, so a change in one
 * shows in the other. Its calls live under /me/coach, which no app switch can close.
 */
// `inCoaching`: on the Coaching page itself, whose lede already says this, so the block skips it and points down to the list of coaches.
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
  const share = useMutation({ mutationFn: (v: { id: string; part: CoachSharePart; on: boolean }) => api.shareWithCoach(v.id, { [v.part]: v.on }), onSuccess: done });
  const end = useMutation({
    mutationFn: (linkId: string) => api.endCoach(linkId),
    onSuccess: () => {
      setEnding(null);
      setUnasking(null);
      done();
    },
  });
  const links = (q.data?.links ?? []).filter((l) => l.student.id !== l.coach.id);
  const error = answer.error ?? share.error ?? end.error;
  return (
    <section id={id} className="mt-lg scroll-mt-[64px]" aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`} className="text-title2">
        {title}
      </h2>
      {!inCoaching && (
        <p className="mt-xs m-0 text-subhead text-ink-soft">
          A coach the team chose sees only what you switch on, never your journal. End it any time.
        </p>
      )}
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
              {(l.status === 'active' || mineToAnswer) && (
                <fieldset className="m-0 mt-sm border-0 p-0">
                  <legend className="text-subhead font-semibold">{waiting ? 'What they would see' : 'What they see'}</legend>
                  <div className="mt-xs flex flex-col gap-xs">
                    {COACH_SHARE_PARTS.map((part) => (
                      <Toggle key={part} on={l.share[part]} disabled={share.isPending} onChange={(on) => share.mutate({ id: l.id, part, on })} label={COACH_SHARE_META[part].name} hint={COACH_SHARE_META[part].blurb} />
                    ))}
                  </div>
                </fieldset>
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
                  <Button variant="ghost" disabled={end.isPending} onClick={() => setEnding(l)}>
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
        <div className="mt-md flex flex-col gap-xs">
          <button type="button" disabled={end.isPending} onClick={() => ending && end.mutate(ending.id)} className="toy min-h-[48px] rounded-pill bg-r1 px-md text-headline text-on-fill">
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
