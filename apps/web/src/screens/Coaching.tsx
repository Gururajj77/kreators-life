import { COACH_ABOUT_MAX, COACH_SHARE_META, COACH_SHARE_PARTS, RELATIONSHIP_BY_KEY, type CoachHub, type CoachLink, type CoachRosterRow, type RelationshipKey } from '@kreators/shared';
import { useMutation } from '@tanstack/react-query';
import { Inert } from '../components/Inert';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Button } from '../components/Button';
import { StatTile, WeekDots } from '../components/Charts';
import { CoachFace, MyCoachSection } from '../components/MyCoach';
import { Nudge } from '../components/Nudge';
import { BackLink } from '../components/PageHeader';
import { Hero, HeroNumber } from '../components/Hero';
import { Pager, usePage } from '../components/Pager';
import { Screen } from '../components/Screen';
import { Section } from '../components/Section';
import { Toggle } from '../components/Toggle';
import { api } from '../lib/api';
import { useAuthed, useRefreshAll } from '../lib/queries';
import { shortDate, dateTime } from '../lib/date';
import { FIELD_LINE } from '../lib/ui';
import { StatusTag } from '../components/StatusTag';
import { CardHead } from '../components/CardHead';
import { RowCard } from '../components/RowCard';
import { Reveal } from '../components/fx/Reveal';
import { FactTag } from '../components/FactTag';

const day = shortDate;
const when = dateTime;
const say = (e: unknown) => (e instanceof Error ? e.message : 'That did not work.');

function Problem({ e }: { e: unknown }) {
  if (!e) return null;
  return (
    <p role="alert" className="mt-sm m-0 rounded-tile bg-r1/15 p-sm text-subhead">
      {say(e)}
    </p>
  );
}

/**
 * Coaching: for a life coach, their students, the asks either way and their line in the directory; for everyone,
 * their own coach, the notes their coach left, the directory of coaches, a way to ask to become one, and the
 * change log at the end.
 */
export function Coaching() {
  const sp = usePage('s');
  const ap = usePage('a');
  const op = usePage('o');
  const hubQuery = `${sp.query}&${ap.query}&${op.query}`;
  const hub = useAuthed(['coach-hub', hubQuery], () => api.coachHub(hubQuery));
  const h = hub.data;
  return (
    <Screen>
      <header className="pt-lg">
        <BackLink to="/apps">Apps</BackLink>
        <h1 className="text-large-title">Coaching</h1>
        <p className="mt-xs m-0 text-subhead text-ink-soft">
          {h?.coach
            ? 'Each student picks what you see. Every note and task you add is logged for both of you.'
            : 'A coach the team chose sees only what you share, never your journal. End it any time.'}
        </p>
        <CoachingHero hub={h} />
      </header>
      {h?.coach && <CoachSide hub={h} onChange={() => void hub.refetch()} />}
      <MyCoachSection id="my-coach" title={h?.coach ? 'Your own life coach' : 'Your life coach'} inCoaching />
      <CoachNotes />
      <Directory />
      {h && !h.coach && <BecomeCoach askedAt={h.profile.askedAt} about={h.profile.about} onChange={() => void hub.refetch()} />}
      <ChangeLog />
    </Screen>
  );
}

/**
 * The hero (founder, 2026-11-04: an app opens with what it says about the person). A coach sees their students and how many came in
 * under their contract last week; a student sees their coach and how much of the five parts they share. Sage's mood follows it.
 */
function CoachingHero({ hub }: { hub: CoachHub | undefined }) {
  const mine = useAuthed(['my-coach', 'hero'], () => api.myCoach(''));
  if (!hub) return null;
  if (hub.coach) {
    const red = hub.students.filter((r) => r.redWeek).length;
    const n = hub.counts.students;
    return (
      <Hero color="var(--color-r6)" deep="var(--deep-guru)" className="mt-md" character="guru" mood={n === 0 ? 'sleepy' : red === 0 ? 'excited' : 'happy'}>
        <p className="m-0 text-eyebrow uppercase opacity-90">Your students</p>
        <HeroNumber value={n} label={n === 0 ? 'No students yet. Ask one, or wait for an ask.' : red === 0 ? 'Nobody had a red week.' : `${red} had a red week. Start with them.`} />
      </Hero>
    );
  }
  const active = (mine.data?.links ?? []).filter((l) => l.status === 'active');
  const link = active[0];
  const on = link ? COACH_SHARE_PARTS.filter((k) => link.share[k]).length : 0;
  return (
    <Hero color="var(--color-r6)" deep="var(--deep-guru)" className="mt-md" character="guru" mood={link ? 'happy' : 'sleepy'}>
      <p className="m-0 text-eyebrow uppercase opacity-90">{link ? `Your coach, ${link.coach.name}` : 'Your coach'}</p>
      {link ? (
        <HeroNumber value={on} unit={`of ${COACH_SHARE_PARTS.length}`} label="parts of your progress you share. Change it below." />
      ) : (
        // No number to show yet: the words are the headline, never a lone dash.
        <>
          <p className="mt-xs m-0 text-large-title">No coach yet</p>
          <p className="mt-xs m-0 text-subhead opacity-90">Find one in the directory below.</p>
        </>
      )}
    </Hero>
  );
}

function focusPill(k: RelationshipKey) {
  const rel = RELATIONSHIP_BY_KEY[k];
  return (
    <span key={k} title={rel.name} className="max-w-full truncate rounded-pill px-xs text-caption font-medium leading-[24px]" style={{ background: rel.color, color: rel.text }}>
      {rel.name}
    </span>
  );
}

function RosterRow({ r }: { r: CoachRosterRow }) {
  /** The red week takes the corner; without one, the first focus pillar goes up and the rest stay on their row. */
  const rest = (r.redWeek ? r.focus : r.focus?.slice(1)) ?? [];
  return (
    <li>
      <Link to={`/coaching/students/${r.student.id}`} className="toy toy-soft flex items-start gap-sm rounded-tile bg-card p-sm">
        <CoachFace name={r.student.name} badge={r.student.badge} />
        <span className="min-w-0 flex-1">
          <CardHead tag={r.redWeek ? <StatusTag tone="bad" fit>Below the plan last week</StatusTag> : r.focus?.[0] && focusPill(r.focus[0])}>
            <span className="block truncate text-card-title">{r.student.name}</span>
          </CardHead>
          <span className="block text-card-note text-ink-soft">
            {r.streak !== null ? `Streak ${r.streak}, last check-in ${r.lastCheckin ?? 'never'}. ` : ''}
            Since {day(r.since)}.
          </span>
          {r.week && (
            <span className="mt-xs flex flex-wrap items-center gap-sm">
              <WeekDots days={r.week.map(Boolean)} color="var(--color-r4)" label={`Routine kept ${r.week.filter(Boolean).length} of the last 7 days`} />
              {r.contractDays !== null && <span className="text-caption text-ink-soft">The deal: {r.contractDays} days a week</span>}
            </span>
          )}
          {rest.length > 0 && <span className="mt-xs flex flex-wrap gap-xs">{rest.map(focusPill)}</span>}
          <span className="mt-xs block text-caption text-ink-mute">Sees: {COACH_SHARE_PARTS.filter((k) => r.share[k]).map((k) => COACH_SHARE_META[k].name).join(', ') || 'nothing for now'}</span>
        </span>
      </Link>
    </li>
  );
}

/** One ask, as a row: who, when, and the answer or the take-back. */
function AskRow({ l, who, children }: { l: CoachLink; who: CoachLink['coach']; children: ReactNode }) {
  return (
    <li className="flex flex-wrap items-center gap-sm rounded-tile bg-card p-sm shadow-toy-soft">
      <CoachFace name={who.name} badge={who.badge} />
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{who.name}</span>
        <span className="block text-subhead text-ink-soft">
          {l.askedBy === 'admin' ? 'Suggested by the team' : 'Asked'} on {day(l.createdAt)}.
        </span>
      </span>
      <span className="flex flex-wrap gap-xs">{children}</span>
    </li>
  );
}

function CoachSide({ hub, onChange }: { hub: CoachHub; onChange: () => void }) {
  const refresh = useRefreshAll();
  const [who, setWho] = useState('');
  const [sent, setSent] = useState<string | null>(null);
  const [about, setAbout] = useState(hub.profile.about);
  const after = () => {
    refresh();
    onChange();
  };
  const answer = useMutation({ mutationFn: (v: { id: string; yes: boolean }) => api.answerCoach(v.id, v.yes), onSuccess: after });
  const takeBack = useMutation({ mutationFn: (id: string) => api.endCoach(id), onSuccess: after });
  const ask = useMutation({
    mutationFn: () => api.askStudent(who),
    onSuccess: (r) => {
      setSent(`Asked ${r.link.student.name}. Nothing is shared until they say yes.`);
      setWho('');
      after();
    },
  });
  const save = useMutation({ mutationFn: (body: { about?: string; open?: boolean }) => api.saveCoachProfile(body), onSuccess: after });
  return (
    <>
      <div className="mt-lg grid grid-cols-3 gap-xs">
        <StatTile label="Students" value={hub.counts.students} />
        <StatTile label="Asking you" value={hub.counts.asks} />
        <StatTile label="Asks out" value={hub.counts.sent} />
      </div>

      <Section id="students-heading" title="Your students" lede={hub.counts.students ? 'Tap one to see what they share, leave a note or add a task.' : 'No students yet. Ask someone below, or wait for a student to ask you from the directory.'}>
        <ul className="m-0 flex list-none flex-col gap-xs p-0">
          {hub.students.map((r) => (
            <RosterRow key={r.linkId} r={r} />
          ))}
        </ul>
        <Pager page={hub.studentsPage} prefix="s" label="students" />
      </Section>

      {hub.asks.length > 0 && (
        <Section id="asks-heading" title="Asking to be your student" lede="Say yes and you see what they share. Say no and they can ask again in a month.">
          <ul className="m-0 flex list-none flex-col gap-xs p-0">
            {hub.asks.map((l) => (
              <AskRow key={l.id} l={l} who={l.student}>
                <Button size="sm" disabled={answer.isPending} onClick={() => answer.mutate({ id: l.id, yes: true })}>
                  Say yes
                </Button>
                <Button size="sm" variant="outline" disabled={answer.isPending} onClick={() => answer.mutate({ id: l.id, yes: false })}>
                  Say no
                </Button>
              </AskRow>
            ))}
          </ul>
          <Pager page={hub.asksPage} prefix="a" label="asks" />
          <Problem e={answer.error} />
        </Section>
      )}

      <Section id="ask-heading" title="Ask someone to be your student" lede="By their email, @username or friend code. They say yes or no on their Profile tab, and pick what you see.">
        <form
          className="grid grid-cols-[1fr_auto] gap-xs"
          onSubmit={(e) => {
            e.preventDefault();
            setSent(null);
            if (who.trim()) ask.mutate();
          }}
        >
          <input value={who} onChange={(e) => setWho(e.target.value)} placeholder="Email, @username or friend code" aria-label="Email, @username or friend code" autoCapitalize="none" autoComplete="off" className={FIELD_LINE} />
          <Button type="submit" disabled={ask.isPending || !who.trim()}>
            Ask
          </Button>
        </form>
        {sent && <p className="mt-xs m-0 text-subhead font-semibold">{sent}</p>}
        <Problem e={ask.error} />
      </Section>

      {hub.sent.length > 0 && (
        <Section id="sent-heading" title="Waiting for a yes" lede="Asks you sent, and the team’s on your behalf.">
          <ul className="m-0 flex list-none flex-col gap-xs p-0">
            {hub.sent.map((l) => (
              <AskRow key={l.id} l={l} who={l.student}>
                <Button size="sm" variant="ghost" disabled={takeBack.isPending} onClick={() => takeBack.mutate(l.id)}>
                  Take back
                </Button>
              </AskRow>
            ))}
          </ul>
          <Pager page={hub.sentPage} prefix="o" label="asks out" />
        </Section>
      )}

      <Section id="line-heading" title="Your line in the directory" lede="What you help with, in a sentence or two. Students find you by it.">
        <textarea value={about} onChange={(e) => setAbout(e.target.value)} maxLength={COACH_ABOUT_MAX} rows={3} placeholder="I help creators keep a steady routine and finish what they start." aria-label="What you help with" className={FIELD_LINE} />
        <div className="mt-xs flex flex-wrap items-center gap-xs">
          <Button variant="outline" disabled={save.isPending || about === hub.profile.about} onClick={() => save.mutate({ about })}>
            Save my line
          </Button>
        </div>
        <div className="mt-sm">
          <Toggle on={hub.profile.open} disabled={save.isPending} onChange={(open) => save.mutate({ open })} label="Taking new students" hint="Off keeps you out of the directory. Your students stay." />
        </div>
        <Problem e={save.error} />
      </Section>
    </>
  );
}

/** The notes every coach left, newest first. */
function CoachNotes() {
  const pg = usePage('note');
  const q = useAuthed(['my-coach-notes', pg.query], () => api.myCoach(pg.query));
  const notes = q.data?.notes ?? [];
  if (!q.data || (notes.length === 0 && pg.page === 1)) return null;
  return (
    <Section id="notes-heading" title="Notes from your coach" lede="Every note a coach left you. They land in your inbox too.">
      <ul className="m-0 flex list-none flex-col gap-xs p-0">
        {notes.map((n) => (
          <li key={n.id} className="rounded-tile bg-card p-sm shadow-toy-soft">
            <p className="m-0 whitespace-pre-wrap text-prose"><Inert text={n.body} /></p>
            <p className="mt-xs m-0 text-caption text-ink-soft">
              {n.coachName}, {when(n.createdAt)}
            </p>
          </li>
        ))}
      </ul>
      <Pager page={q.data.notesPage} prefix="note" label="notes" />
    </Section>
  );
}

/** Life coaches taking new students. Asking one is a request; nothing is shared until they say yes. */
function Directory() {
  const pg = usePage('dir');
  const q = useAuthed(['coach-directory', pg.query], () => api.coachDirectory(pg.query));
  const refresh = useRefreshAll();
  const ask = useMutation({
    mutationFn: (coachId: string) => api.askCoach(coachId),
    onSuccess: () => {
      refresh();
      void q.refetch();
    },
  });
  const coaches = q.data?.coaches ?? [];
  return (
    <Section id="directory-heading" title="Find a life coach" lede="Coaches the team chose, taking new students. Ask one; they say yes or no.">
      {q.data && coaches.length === 0 && <p className="m-0 text-subhead text-ink-soft">No coaches are taking new students right now.</p>}
      <ul className="m-0 flex list-none flex-col gap-xs p-0">
        {coaches.map((k, i) => (
          <Reveal as="li" key={k.coach.id} index={i} className="flex">
            {/* The face and the name at the top left, where things stand with this coach in the corner of every row (Taking students,
                Asked or Your coach), the students as a tag at the foot and Ask at the bottom right, so a phone never squeezes the name
                beside the button. */}
            <RowCard
              lead={
                // A hairline ring, so the face's paper circle shows on the card.
                <span className="inline-flex rounded-pill border-2 border-line">
                  <CoachFace name={k.coach.name} badge={k.coach.badge} />
                </span>
              }
              title={k.coach.name}
              sub={k.coach.handle ? `@${k.coach.handle}` : undefined}
              corner={k.mine === 'active' ? <StatusTag tone="good">Your coach</StatusTag> : k.mine === 'pending' ? <StatusTag tone="info">Asked</StatusTag> : <StatusTag tone="neutral">Taking students</StatusTag>}
              facts={<FactTag kind="availability">{`${k.students} ${k.students === 1 ? 'student' : 'students'}`}</FactTag>}
              action={
                k.mine ? undefined : (
                  <Button size="sm" variant="outline" disabled={ask.isPending} onClick={() => ask.mutate(k.coach.id)}>
                    Ask to be coached
                  </Button>
                )
              }
            >
              {k.about && <span className="mt-xs block text-card-note">{k.about}</span>}
            </RowCard>
          </Reveal>
        ))}
      </ul>
      <Pager page={q.data?.page} prefix="dir" label="coaches" />
      <Problem e={ask.error} />
    </Section>
  );
}

/** For someone who coaches people: ask the team to be made a life coach. */
function BecomeCoach({ askedAt, about: saved, onChange }: { askedAt: string | null; about: string; onChange: () => void }) {
  const [about, setAbout] = useState(saved);
  const apply = useMutation({ mutationFn: () => api.askToCoach(about), onSuccess: onChange });
  return (
    <Section id="become-heading" title="Are you a life coach?" lede="The team checks every life coach first. Once you are one, your badge says Life coach and students can find you.">
      {askedAt ? (
        <p className="m-0 rounded-tile bg-card p-sm text-subhead shadow-toy-soft">Your ask has been with the team since {day(askedAt)}. The answer lands in your inbox.</p>
      ) : (
        <>
          <textarea value={about} onChange={(e) => setAbout(e.target.value)} maxLength={COACH_ABOUT_MAX} rows={3} placeholder="Who you coach, and how" aria-label="Who you coach, and how" className={FIELD_LINE} />
          <Button className="mt-xs" variant="outline" disabled={apply.isPending} onClick={() => apply.mutate()}>
            Ask the team
          </Button>
          <Problem e={apply.error} />
        </>
      )}
    </Section>
  );
}

/** Everything that happened between you and a coach, or you and your students, newest first. */
function ChangeLog() {
  const pg = usePage('log');
  const q = useAuthed(['coach-log', pg.query], () => api.myCoachLog(pg.query));
  const log = q.data?.log ?? [];
  return (
    <Section id="log-heading" title="Change log" lede="Every ask, yes, note and task change, with when it happened. The same lines your coach or student sees.">
      {q.data && log.length === 0 && <p className="m-0 text-subhead text-ink-soft">Nothing yet.</p>}
      <ol className="m-0 flex list-none flex-col gap-xs p-0">
        {log.map((e) => (
          <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-xs rounded-tile bg-card p-sm shadow-toy-soft">
            <span className="min-w-0 flex-1 text-subhead">{e.label}</span>
            <time dateTime={e.createdAt} className="shrink-0 text-caption text-ink-soft">
              {when(e.createdAt)}
            </time>
          </li>
        ))}
      </ol>
      <Pager page={q.data?.logPage} prefix="log" label="changes" />
      <Nudge className="mt-xs" text="The log keeps going after a coaching ends, so nobody has to remember who changed what." />
    </Section>
  );
}
