import { COACH_ABOUT_MAX, COACH_SHARE_META, COACH_SHARE_PARTS, RELATIONSHIP_BY_KEY, type CoachHub, type CoachLink, type CoachLookup, type CoachRosterRow, type RelationshipKey } from '@kreators/shared';
import { useMutation } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { Inert } from '../components/Inert';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Button } from '../components/Button';
import { ConfirmDelete } from '../components/ConfirmDelete';
import { StatTile, WeekDots } from '../components/Charts';
import { CoachFold, ShowOnThisPage, useCoachSections, type CoachSections } from '../components/CoachSections';
import { ErrorLine } from '../components/ErrorLine';
import { Fold } from '../components/Fold';
import { Icon } from '../components/Icon';
import { MoreMenu } from '../components/MoreMenu';
import { CoachFace, MyCoachSection } from '../components/MyCoach';
import { Nudge } from '../components/Nudge';
import { BackLink } from '../components/PageHeader';
import { Hero, HeroNumber } from '../components/Hero';
import { Pager, usePage } from '../components/Pager';
import { Screen } from '../components/Screen';
import { Section } from '../components/Section';
import { STICKY_CLOSE_LANE, StickyClose, useTallOpen } from '../components/StickyClose';
import { SkeletonList } from '../components/Skeleton';
import { Toggle } from '../components/Toggle';
import { api } from '../lib/api';
import { evenGrid, evenTile } from '../lib/bento';
import { useCopy } from '../lib/clipboard';
import { useAuthed, useRefreshAll } from '../lib/queries';
import { shortDate, dateTime } from '../lib/date';
import { FIELD_LINE } from '../lib/ui';
import { useDebounced } from '../lib/useDebounced';
import { StatusTag } from '../components/StatusTag';
import { CardHead } from '../components/CardHead';
import { RowCard } from '../components/RowCard';
import { Reveal } from '../components/fx/Reveal';
import { FactTag } from '../components/FactTag';

const day = shortDate;
const when = dateTime;
/** The three numbers: one even row at every width. */
const COUNT_COLS = { base: 3 } as const;

/**
 * Coaching: for a life coach, the box to add a student first, then their students, the asks either way and their line in the directory; for everyone,
 * their own coach, the notes their coach left, the directory of coaches, a way to ask to become one, and the change log. Each section
 * folds, and "Show on this page" hides any of them (2026-11-07, saved on the account).
 */
export function Coaching() {
  const sp = usePage('s');
  const ap = usePage('a');
  const op = usePage('o');
  const hubQuery = `${sp.query}&${ap.query}&${op.query}`;
  const hub = useAuthed(['coach-hub', hubQuery], () => api.coachHub(hubQuery));
  const h = hub.data;
  const isCoach = Boolean(h?.coach);
  const sections = useCoachSections(isCoach);
  return (
    <Screen>
      <header className="pt-lg">
        <BackLink to="/apps">Apps</BackLink>
        <h1 className="text-large-title">Coaching</h1>
        <p className="mt-xs m-0 text-subhead text-ink-soft">
          {h?.coach
            ? 'Each student picks what you see. Every note and task you add is logged for both of you.'
            : 'A coach sees only what you switch on. End it any time.'}
        </p>
        <CoachingHero hub={h} />
      </header>
      {hub.isPending && <SkeletonList className="mt-md" count={3} lines={2} label="Loading Coaching" />}
      {h?.coach && <CoachSide hub={h} sections={sections} onChange={() => void hub.refetch()} />}
      {h && !h.coach && <ShowOnThisPage page="hub" isCoach={false} sections={sections} className="mt-md" />}
      {h && (
        <>
          {!h.coach && h.profile.askedAt && <BecomeCoach askedAt={h.profile.askedAt} about={h.profile.about} sections={sections} onChange={() => void hub.refetch()} />}
          <CoachFold sections={sections} k="hubMine" id="my-coach-heading" title={h.coach ? 'Your own life coach' : 'Your life coach'}>
            <MyCoachSection id="my-coach" inCoaching />
          </CoachFold>
          <CoachNotes sections={sections} />
          <Directory sections={sections} />
          {!h.coach && !h.profile.askedAt && <BecomeCoach askedAt={null} about={h.profile.about} sections={sections} onChange={() => void hub.refetch()} />}
          <ChangeLog sections={sections} />
        </>
      )}
    </Screen>
  );
}

/**
 * The hero (founder, 2026-11-04: an app opens with what it says about the person). A coach sees their students and how many came in
 * under their contract last week; a student sees their coach and how much of the six parts they share. Sage's mood follows it.
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
        <HeroNumber value={n} label={n === 0 ? 'No students yet. Add your first below.' : red === 0 ? 'Nobody had a red week.' : `${red} had a red week. Start with them.`} />
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

function RosterRow({ r, sections }: { r: CoachRosterRow; sections: CoachSections }) {
  const show = (k: string) => sections.state(k) !== 'hidden';
  const focus = show('rosterFocus') ? r.focus : null;
  /** The red week takes the corner; without one, the first focus pillar goes up and the rest stay on their row. */
  const rest = (r.redWeek ? focus : focus?.slice(1)) ?? [];
  return (
    <li>
      <Link to={`/coaching/students/${r.student.id}`} className="toy toy-soft flex items-start gap-sm rounded-tile bg-card p-sm">
        <CoachFace name={r.student.name} badge={r.student.badge} />
        <span className="min-w-0 flex-1">
          <CardHead tag={r.redWeek ? <StatusTag tone="bad" fit>Below the plan last week</StatusTag> : focus?.[0] && focusPill(focus[0])}>
            <span className="block truncate text-card-title">{r.student.name}</span>
          </CardHead>
          <span className="block text-card-note text-ink-soft">
            {show('rosterStreak') && r.streak !== null ? `Streak ${r.streak}, last check-in ${r.lastCheckin ? day(r.lastCheckin) : 'never'}. ` : ''}
            Since {day(r.since)}.
          </span>
          {show('rosterRoutine') && r.week && (
            <span className="mt-xs flex flex-wrap items-center gap-sm">
              <WeekDots days={r.week.map(Boolean)} color="var(--color-r4)" label={`Routine kept ${r.week.filter(Boolean).length} of the last 7 days`} />
              {r.contractDays !== null && <span className="text-caption text-ink-soft">The contract: {r.contractDays} days a week</span>}
            </span>
          )}
          {rest.length > 0 && <span className="mt-xs flex flex-wrap gap-xs">{rest.map(focusPill)}</span>}
          {show('rosterSees') && <span className="mt-xs block text-caption text-ink-mute">Sees: {COACH_SHARE_PARTS.filter((k) => r.share[k]).map((k) => COACH_SHARE_META[k].name).join(', ') || 'nothing for now'}</span>}
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

const isEmailish = (who: string) => who.includes('@') && !who.startsWith('@');

/** What the box read, in one quiet line, and a small preview on an exact match. An email is looked up only once it is sent. */
function ReadLine({ who, lookup, pending }: { who: string; lookup: CoachLookup | undefined; pending: boolean }) {
  if (!who) return <p className="mt-xs m-0 text-caption text-ink-soft">@username or friend code shows who it is. An email works too.</p>;
  if (isEmailish(who)) return <p className="mt-xs m-0 text-caption text-ink-soft">Reading this as an email. We check it when you send.</p>;
  if (!lookup || pending) return <p className="mt-xs m-0 text-caption text-ink-soft">Looking</p>;
  if (!lookup.person) return <p className="mt-xs m-0 text-caption text-ink-soft">No match for that @username or friend code.</p>;
  const p = lookup.person;
  return (
    <div className="mt-xs flex items-center gap-sm rounded-tile bg-paper p-xs">
      {p.avatarUrl ? <img src={p.avatarUrl} alt="" width={40} height={40} loading="lazy" className="size-[40px] shrink-0 rounded-pill object-cover" /> : <CoachFace name={p.name} badge={p.badge} />}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-subhead font-semibold">{p.name}</span>
        <span className="block truncate text-caption text-ink-soft">
          {p.handle ? `@${p.handle}. ` : ''}Reading this as a {lookup.read === 'code' ? 'friend code' : 'username'}.
        </span>
      </span>
    </div>
  );
}

/** The coach's invite link: Copy link, a QR code in a fold, and renewing or closing it, each asked first. */
function InvitePanel({ token, open, onOpenChange, onChange }: { token: string | null; open: boolean; onOpenChange: (o: boolean) => void; onChange: () => void }) {
  const url = token ? `${window.location.origin}/coach/join/${token}` : '';
  const { copy, said } = useCopy();
  const [asking, setAsking] = useState<'fresh' | 'off' | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const act = useMutation({
    mutationFn: (action: 'on' | 'fresh' | 'off') => api.coachInvite(action),
    onSuccess: () => {
      setAsking(null);
      setQr(null);
      onChange();
    },
  });
  useEffect(() => {
    if (!qrOpen || qr || !url) return;
    let gone = false;
    void import('qrcode')
      .then((QRCode) => QRCode.toDataURL(url, { margin: 1, width: 160 }))
      .then((d) => {
        if (!gone) setQr(d);
      })
      .catch(() => setQrError('Could not draw the code.'));
    return () => {
      gone = true;
    };
  }, [qrOpen, qr, url]);
  return (
    <Fold title="Your invite link" hint={token ? 'On' : 'Off'} open={open} onOpenChange={onOpenChange} className="mt-sm">
      <div className="rounded-tile bg-card p-sm shadow-toy-soft">
        {token ? (
          <>
            <p className="m-0 break-all text-subhead">{url}</p>
            <p className="mt-xs m-0 text-caption text-ink-soft">Anyone with it sees your name and line, then picks what you see. Nothing is shared until they say yes.</p>
            <div className="mt-sm flex items-center gap-xs">
              {/* Clipboard blocked: the link is on screen to select by hand, and `said` says so. */}
              <Button variant="outline" className="flex-1" onClick={() => void copy(url)}>
                {said === 'Copied' ? 'Copied' : 'Copy link'}
              </Button>
              <MoreMenu
                label="More about your invite link"
                items={[
                  { key: 'fresh', label: 'Make a new link', onSelect: () => setAsking('fresh') },
                  { key: 'off', label: 'Close the link', destructive: true, onSelect: () => setAsking('off') },
                ]}
              />
            </div>
            {said && said !== 'Copied' && (
              <p role="status" className="mt-xs m-0 text-caption text-ink-soft">
                {said}
              </p>
            )}
            <Fold title="QR code" open={qrOpen} onOpenChange={setQrOpen} className="mt-sm">
              <div className="flex flex-col items-center gap-sm rounded-tile bg-paper p-sm">
                {qr ? <img src={qr} width={160} height={160} alt={`QR code for ${url}`} className="rounded-tile bg-white p-xs" /> : qrError ? <p className="m-0 text-subhead">{qrError}</p> : <p role="status" className="m-0 text-subhead text-ink-soft">Drawing the code</p>}
                <p className="m-0 text-caption text-ink-soft">Put it on a slide or a poster. A scan opens the same card.</p>
              </div>
            </Fold>
          </>
        ) : (
          <div className="flex flex-wrap-reverse items-center justify-between gap-sm">
            <p className="m-0 min-w-[60%] flex-1 text-subhead text-ink-soft">One link for anyone you coach. They open it, pick what you see and say yes.</p>
            <Button size="sm" variant="outline" disabled={act.isPending} onClick={() => act.mutate('on')}>
              Make my link
            </Button>
          </div>
        )}
        <ErrorLine e={act.error} className="mt-sm" />
      </div>
      <ConfirmDelete
        open={asking !== null}
        title={asking === 'off' ? 'Close your invite link?' : 'Make a new invite link?'}
        body={asking === 'off' ? 'The link stops working and says it was closed. Your students stay.' : 'The old link stops working and says it was closed. Your students stay.'}
        pending={act.isPending}
        failed={act.isError}
        onYes={() => asking && act.mutate(asking)}
        onClose={() => {
          setAsking(null);
          act.reset();
        }}
        yes={asking === 'off' ? 'Yes, close it' : 'Yes, make a new one'}
        keep="Keep this one"
      />
    </Fold>
  );
}

/** One box first on the page: an email, an @username or a friend code. The invite link sits under it. */
function AddStudent({ hub, onChange, boxRef }: { hub: CoachHub; onChange: () => void; boxRef: React.RefObject<HTMLInputElement | null> }) {
  const [who, setWho] = useState('');
  const [sent, setSent] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const typed = who.trim();
  const settled = useDebounced(typed, 300);
  const email = isEmailish(typed);
  const lookup = useAuthed(['coach-lookup', settled], () => api.coachLookup(settled), Boolean(settled) && !isEmailish(settled));
  const live = settled === typed ? lookup.data : undefined;
  const ask = useMutation({
    mutationFn: () => api.askStudent(typed),
    onSuccess: (r) => {
      if (r.link) setSent(`Asked ${r.link.student.name}. Nothing is shared until they say yes.`);
      else if (r.invited?.sent) setSent(`Sent to ${r.invited.to}. Nothing is shared until they say yes.`);
      else {
        setSent('Email is not set up here yet. Copy your invite link below and send it yourself.');
        setInviteOpen(true);
      }
      setWho('');
      onChange();
    },
  });
  const canSend = Boolean(typed) && (email || Boolean(live?.person) || lookup.isError);
  return (
    <Section id="ask-heading" title="Add a student">
      <form
        className="grid grid-cols-[1fr_auto] gap-xs"
        onSubmit={(e) => {
          e.preventDefault();
          setSent(null);
          if (canSend) ask.mutate();
        }}
      >
        <input
          ref={boxRef}
          value={who}
          onChange={(e) => {
            setWho(e.target.value);
            setSent(null);
            ask.reset();
          }}
          placeholder="@username, friend code or email"
          aria-label="@username, friend code or email"
          autoCapitalize="none"
          autoComplete="off"
          spellCheck={false}
          className={FIELD_LINE}
        />
        <Button type="submit" disabled={ask.isPending || !canSend}>
          Send
        </Button>
      </form>
      <div aria-live="polite">
        <ReadLine who={typed} lookup={live} pending={settled !== typed || lookup.isFetching} />
        {sent && <p className="mt-xs m-0 text-subhead font-semibold">{sent}</p>}
      </div>
      <ErrorLine e={ask.error} className="mt-xs" />
      <InvitePanel token={hub.invite} open={inviteOpen} onOpenChange={setInviteOpen} onChange={onChange} />
    </Section>
  );
}

function StepRow({ done, title, action }: { done: boolean; title: string; action?: ReactNode }) {
  return (
    <li className="flex flex-wrap items-center gap-sm rounded-tile bg-card p-sm shadow-toy-soft">
      <span className={`flex size-[24px] shrink-0 items-center justify-center rounded-pill ${done ? 'bg-r4 text-on-fill' : 'border-2 border-line'}`} aria-hidden="true">
        {done && <Icon icon={Check} size={14} />}
      </span>
      <span className={`min-w-0 flex-1 text-subhead font-semibold ${done ? 'text-ink-soft line-through' : ''}`}>
        {title}
        <span className="sr-only">{done ? ', done' : ', not done yet'}</span>
      </span>
      {action}
    </li>
  );
}

/** A new coach's first steps: each ticks itself by doing it, pays nothing, and the list folds away when they are done. */
function FirstSteps({ steps, sections, onLine, onBox }: { steps: NonNullable<CoachHub['steps']>; sections: CoachSections; onLine: () => void; onBox: () => void }) {
  const [readOpen, setReadOpen] = useState(false);
  // Open and taller than the window has, "how sharing works" keeps its close in view beside it (StickyClose, 2026-11-14). The root
  // holds the steps and what Read it opened, so the rail starts level with Read it and runs down to the reading's end.
  const readRoot = useRef<HTMLDivElement>(null);
  const readToggle = useRef<HTMLButtonElement>(null);
  const railOn = useTallOpen(readRoot, readOpen);
  const sharing = steps.sharing || sections.readSharing;
  if (steps.line && steps.invited && sharing && !readOpen) return null;
  return (
    <Section id="steps-heading" title="First steps" lede="Each one ticks itself when you do it.">
      <div ref={readRoot} data-sticky-close-root="">
        {/* While the sticky close runs down the steps' edge they keep a lane for it, so it never sits on a step's button. */}
        <ul className={`m-0 flex list-none flex-col gap-xs p-0 ${STICKY_CLOSE_LANE}`}>
          <StepRow
            done={steps.line}
            title="Fill your directory card"
            action={
              !steps.line && (
                <Button size="sm" variant="outline" onClick={onLine}>
                  Write it
                </Button>
              )
            }
          />
          <StepRow
            done={steps.invited}
            title="Invite your first student"
            action={
              !steps.invited && (
                <Button size="sm" variant="outline" onClick={onBox}>
                  Add one
                </Button>
              )
            }
          />
          <StepRow
            done={sharing}
            title="Read how sharing works"
            action={
              <Button
                ref={readToggle}
                size="sm"
                variant="outline"
                expanded={readOpen}
                aria-controls="coach-sharing-read"
                onClick={() => {
                  setReadOpen((o) => !o);
                  sections.markRead();
                }}
              >
                {readOpen ? 'Close' : 'Read it'}
              </Button>
            }
          />
        </ul>
        {railOn && <StickyClose onClose={() => setReadOpen(false)} label="Close how sharing works" opener={() => readToggle.current} />}
        {readOpen && (
          <div className={`mt-xs ${STICKY_CLOSE_LANE}`}>
            <div id="coach-sharing-read" className="rounded-tile bg-card p-sm shadow-toy-soft">
              <p className="m-0 text-subhead">Each student has six switches of their own. You see only what is on, read fresh every time, and it stops at once when they switch it off.</p>
              <ul className="mt-xs m-0 flex list-none flex-col gap-xs p-0 text-subhead text-ink-soft">
                {COACH_SHARE_PARTS.map((k) => (
                  <li key={k}>
                    <span className="font-semibold text-ink">{COACH_SHARE_META[k].name}.</span> {COACH_SHARE_META[k].blurb}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </Section>
  );
}

function CoachSide({ hub, sections, onChange }: { hub: CoachHub; sections: CoachSections; onChange: () => void }) {
  const refresh = useRefreshAll();
  // A deliberate one-time seed: the line the coach is typing, from what is saved. A later read never writes over it.
  const [about, setAbout] = useState(hub.profile.about);
  const [unasking, setUnasking] = useState<CoachLink | null>(null);
  const box = useRef<HTMLInputElement>(null);
  const lineBox = useRef<HTMLTextAreaElement>(null);
  const after = () => {
    refresh();
    onChange();
  };
  const answer = useMutation({ mutationFn: (v: { id: string; yes: boolean }) => api.answerCoach(v.id, v.yes), onSuccess: after });
  const takeBack = useMutation({ mutationFn: (id: string) => api.endCoach(id), onSuccess: () => { setUnasking(null); after(); } });
  const save = useMutation({ mutationFn: (body: { about?: string; open?: boolean }) => api.saveCoachProfile(body), onSuccess: after });
  const counts = [
    { label: 'Students', value: hub.counts.students },
    { label: 'Asking you', value: hub.counts.asks },
    { label: 'Asks out', value: hub.counts.sent },
  ];
  return (
    <>
      <AddStudent hub={hub} onChange={after} boxRef={box} />
      {hub.steps && (
        <FirstSteps
          steps={hub.steps}
          sections={sections}
          onBox={() => box.current?.focus()}
          onLine={() => {
            sections.set('hubLine', 'open');
            requestAnimationFrame(() => {
              lineBox.current?.scrollIntoView({ block: 'center' });
              lineBox.current?.focus();
            });
          }}
        />
      )}
      <div className={`mt-lg grid gap-xs ${evenGrid(counts.length, COUNT_COLS)}`}>
        {counts.map((c, i) => (
          <StatTile key={c.label} label={c.label} value={c.value} className={evenTile(i, counts.length, COUNT_COLS)} />
        ))}
      </div>
      <ShowOnThisPage page="hub" isCoach sections={sections} />

      <CoachFold sections={sections} k="hubStudents" id="students-heading" title="Your students" hint={String(hub.counts.students)} lede={hub.counts.students ? 'Tap one to see their report, leave a note or add a task.' : 'No students yet. Add one above, or wait for a student to ask you from the directory.'}>
        <ul className="m-0 flex list-none flex-col gap-xs p-0">
          {hub.students.map((r) => (
            <RosterRow key={r.linkId} r={r} sections={sections} />
          ))}
        </ul>
        <Pager page={hub.studentsPage} prefix="s" label="students" />
      </CoachFold>

      {hub.asks.length > 0 && (
        <CoachFold sections={sections} k="hubAsks" id="asks-heading" title="Asking to be your student" hint={String(hub.counts.asks)} lede="Say yes and you see what they share. Say no and they can ask again in a month.">
          <ul className="m-0 flex list-none flex-col gap-xs p-0">
            {hub.asks.map((l) => (
              <AskRow key={l.id} l={l} who={l.student}>
                <Button size="sm" variant="outline" disabled={answer.isPending} onClick={() => answer.mutate({ id: l.id, yes: true })}>
                  Say yes
                </Button>
                <Button size="sm" variant="outline" disabled={answer.isPending} onClick={() => answer.mutate({ id: l.id, yes: false })}>
                  Say no
                </Button>
              </AskRow>
            ))}
          </ul>
          <Pager page={hub.asksPage} prefix="a" label="asks" />
          <ErrorLine e={answer.error} className="mt-sm" />
        </CoachFold>
      )}

      {hub.sent.length > 0 && (
        <CoachFold sections={sections} k="hubSent" id="sent-heading" title="Waiting for a yes" hint={String(hub.counts.sent)} lede="Asks you sent, and the team’s on your behalf.">
          <ul className="m-0 flex list-none flex-col gap-xs p-0">
            {hub.sent.map((l) => (
              <AskRow key={l.id} l={l} who={l.student}>
                <Button size="sm" variant="ghost" disabled={takeBack.isPending} onClick={() => { takeBack.reset(); setUnasking(l); }}>
                  Take back
                </Button>
              </AskRow>
            ))}
          </ul>
          <Pager page={hub.sentPage} prefix="o" label="asks out" />
        </CoachFold>
      )}
      <ConfirmDelete
        open={unasking !== null}
        title={`Take back your ask to ${unasking?.student.name ?? 'this person'}?`}
        body="They no longer see it waiting. You can ask again later."
        pending={takeBack.isPending}
        failed={takeBack.isError}
        onYes={() => unasking && takeBack.mutate(unasking.id)}
        onClose={() => setUnasking(null)}
        yes="Yes, take it back"
        keep="Keep the ask"
      />

      <CoachFold sections={sections} k="hubLine" id="line-heading" title="Your line in the directory" lede="What you help with, in a sentence or two. Students find you by it.">
        <textarea ref={lineBox} value={about} onChange={(e) => setAbout(e.target.value)} maxLength={COACH_ABOUT_MAX} rows={3} placeholder="I help creators keep a steady routine and finish what they start." aria-label="What you help with" className={FIELD_LINE} />
        <div className="mt-xs flex flex-wrap items-center gap-xs">
          <Button full variant="outline" disabled={save.isPending || about === hub.profile.about} onClick={() => save.mutate({ about })}>
            Save my line
          </Button>
        </div>
        <div className="mt-sm">
          <Toggle on={hub.profile.open} disabled={save.isPending} onChange={(open) => save.mutate({ open })} label="Taking new students" hint="Off keeps you out of the directory. Your students stay." />
        </div>
        <ErrorLine e={save.error} className="mt-sm" />
      </CoachFold>
    </>
  );
}

/** The notes every coach left, newest first. */
function CoachNotes({ sections }: { sections: CoachSections }) {
  const pg = usePage('note');
  const q = useAuthed(['my-coach-notes', pg.query], () => api.myCoach(pg.query));
  const notes = q.data?.notes ?? [];
  if (!q.data || (notes.length === 0 && pg.page === 1)) return null;
  return (
    <CoachFold sections={sections} k="hubNotes" id="notes-heading" title="Notes from your coach" hint={String(notes.length)} lede="Every note a coach left you. They land in your inbox too.">
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
    </CoachFold>
  );
}

/** Life coaches taking new students. Asking one is a request; nothing is shared until they say yes. */
function Directory({ sections }: { sections: CoachSections }) {
  const pg = usePage('dir');
  const open = sections.state('hubDirectory') === 'open';
  const q = useAuthed(['coach-directory', pg.query], () => api.coachDirectory(pg.query), open);
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
    <CoachFold sections={sections} k="hubDirectory" id="directory-heading" title="Find a life coach" lede="Coaches the team chose, taking new students. Ask one; they say yes or no.">
      {q.isPending && <SkeletonList count={2} lines={2} label="Loading the coaches" />}
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
      <ErrorLine e={ask.error} className="mt-sm" />
    </CoachFold>
  );
}

/** For someone who coaches people: ask the team to be made a life coach. While it waits, one clear line says where it stands, never folded away. */
function BecomeCoach({ askedAt, about: saved, sections, onChange }: { askedAt: string | null; about: string; sections: CoachSections; onChange: () => void }) {
  // A deliberate one-time seed, like the coach's own line.
  const [about, setAbout] = useState(saved);
  const apply = useMutation({ mutationFn: () => api.askToCoach(about), onSuccess: onChange });
  if (askedAt)
    return (
      <p role="status" className="mt-sm m-0 rounded-tile bg-card p-sm text-subhead shadow-toy-soft">
        Asked. The team will look at it. You asked on {day(askedAt)}, and the answer lands in your inbox.
      </p>
    );
  return (
    <CoachFold sections={sections} k="hubBecome" id="become-heading" title="Are you a life coach?" lede="The team checks every life coach first. Once you are one, your badge says Life coach and students can find you.">
      <textarea value={about} onChange={(e) => setAbout(e.target.value)} maxLength={COACH_ABOUT_MAX} rows={3} placeholder="Who you coach, and how" aria-label="Who you coach, and how" className={FIELD_LINE} />
      <Button full className="mt-xs" variant="outline" disabled={apply.isPending} onClick={() => apply.mutate()}>
        Ask the team
      </Button>
      <ErrorLine e={apply.error} className="mt-sm" />
    </CoachFold>
  );
}

/** Everything that happened between you and a coach, or you and your students, newest first. */
function ChangeLog({ sections }: { sections: CoachSections }) {
  const pg = usePage('log');
  const open = sections.state('hubLog') === 'open';
  const q = useAuthed(['coach-log', pg.query], () => api.myCoachLog(pg.query), open);
  const log = q.data?.log ?? [];
  return (
    <CoachFold sections={sections} k="hubLog" id="log-heading" title="Change log" lede="Every ask, yes, note and task change, with when it happened. The same lines your coach or student sees.">
      {q.isPending && <SkeletonList count={2} lines={1} label="Loading the change log" />}
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
    </CoachFold>
  );
}
