import { canInvite, FOCUS_OPTIONS, HONORS, IDENTITY_STAGES, identityLine, levelFromXp, passwordProblem, POINTS, RELATIONSHIPS, BADGE_META, badgeRoleOf, type MeResponse, MODULE_GROUP_ORDER, nextBadge, DEFAULT_ZONE } from '@kreators/shared';
import { useMutation } from '@tanstack/react-query';
import { Suspense, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Avatar } from '../components/Avatar';
import { BadgeArt } from '../components/BadgeArt';
import { Busy, Skeleton } from '../components/Skeleton';
import { Button } from '../components/Button';
import { MyCoachSection } from '../components/MyCoach';
import { FriendQr } from '../components/FriendQr';
import { Nudge } from '../components/Nudge';
import { Person } from '../components/Person';
import { RoleBadge } from '../components/RoleBadge';
import { SignOut } from '../components/SignOut';
import { AppCover } from '../components/AppCover';
import { EvolutionReveal } from '../components/EvolutionReveal';
import { AppGroups, useFits } from '../components/AppGroups';
import { useSession } from '../lib/store';
import { useTheme, type ThemeMode } from '../lib/theme';
import { Screen } from '../components/Screen';
import { Sheet } from '../components/Sheet';
import { api } from '../lib/api';
import { FIELD, RED_YES_LG } from '../lib/ui';
import { useMe, useRefreshAll } from '../lib/queries';
import { tie } from '../lib/text';
import { evenGrid, evenTile } from '../lib/bento';
import { lazyNamed } from '../lib/lazy';
import { CalendarLink } from '../components/CalendarLink';
import { PrivacyChoices } from '../components/PrivacyChoices';
import { UserRound, WandSparkles } from 'lucide-react';
import { TagPicker } from '../components/TagPicker';
import { Icon } from '../components/Icon';
import { StatTile } from '../components/Charts';
import { monthYear } from '../lib/date';
import { DatesAndTimes, datePrefsChange } from '../components/DatesAndTimes';

const BadgeGallery = lazyNamed(() => import('../components/BadgeGallery'), 'BadgeGallery');
const ActivityGrid = lazyNamed(() => import('../components/ActivityGrid'), 'ActivityGrid');
/** Friend suggestions the team made (Admin, Connect people), shown only while one is open (`/you#suggested`). */
const TeamSuggestions = lazyNamed(() => import('../components/TeamSuggestions'), 'TeamSuggestions');
/** A brand's ask onto its team (2026-11-10), shown only while one waits (`/you#org-invites`). */
const OrgInvites = lazyNamed(() => import('../components/OrgInvites'), 'OrgInvites');
// Invite people (2026-11-10): only for those who may make invite codes, in its own chunk.
const InvitePeople = lazyNamed(() => import('../components/InvitePeople'), 'InvitePeople');
/** The honors: two to a row on a phone, three from the tablet, in even rows (lib/bento.ts). */
const HONOR_COLS = { base: 2, lg: 3 } as const;

export function You() {
  const me = useMe();
  if (!me.data) return null;
  return <YouView key={me.data.user.id} data={me.data} />;
}


function YouView({ data }: { data: MeResponse }) {
  const { user, relationships, badges, honors, identity, stats } = data;
  const refresh = useRefreshAll();
  const nav = useNavigate();
  const setToken = useSession((s) => s.setToken);
  // The one group order (Contribution, Reflection, Connection, Creation, Essentials, Operations).
  const featureGroups = MODULE_GROUP_ORDER;
  const themeMode = useTheme((s) => s.mode);
  const setThemeMode = useTheme((s) => s.setMode);
  const [deleting, setDeleting] = useState(false);
  const [erasing, setErasing] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwAgain, setPwAgain] = useState('');
  const setPassword = useMutation({
    mutationFn: () => api.setPassword({ current: pwCurrent, password: pwNew }),
    onSuccess: async () => {
      await refresh();
      setPwOpen(false);
      setPwCurrent('');
      setPwNew('');
      setPwAgain('');
    },
  });
  const [confirmText, setConfirmText] = useState('');
  const exportData = useMutation({
    mutationFn: () => api.exportMe(),
    onSuccess: (data) => {
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'kreators-export.json';
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
  });
  const deleteAccount = useMutation({
    mutationFn: () => api.deleteMe(),
    onSuccess: () => {
      setToken(null);
      nav('/', { replace: true });
    },
  });
  const [name, setName] = useState(user.displayName);
  const [type, setType] = useState(user.focus);
  const [optIn, setOptIn] = useState(user.leaderboardOptIn);
  const [timezone, setTimezone] = useState(user.timezone || DEFAULT_ZONE);
  const [dateFormat, setDateFormat] = useState(user.datePrefs.date);
  const [timeFormat, setTimeFormat] = useState(user.datePrefs.time);
  const [saved, setSaved] = useState(false);

  const save = useMutation({
    mutationFn: () => api.updateMe({ displayName: name, focus: type, leaderboardOptIn: optIn, timezone, ...datePrefsChange(user.datePrefs, dateFormat, timeFormat) }),
    onSuccess: () => {
      refresh();
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
    },
  });
  const reset = useMutation({
    mutationFn: () => api.reset(),
    onSuccess: async () => {
      await refresh();
      nav('/onboarding', { replace: true });
    },
  });

  const byKey = new Map(relationships.map((r) => [r.key, r]));
  const floors = [...RELATIONSHIPS].sort((a, b) => b.floor - a.floor);
  // Who you are, from the setup chat, and the apps it says fit: the same match, so Features can say why.
  const setup = { identities: user.identities, goals: user.intake.goals, blockers: user.intake.blockers };
  const whoLine = identityLine(setup);
  const fits = useFits();
  const awarded = new Set(honors);

  return (
    <Screen columns={false}>
      {/* Profile is a main tab, but wears the app cover card too (founder, 2026-11-04): its label and Sign out at the top, the picture,
          the name and the line at the bottom right, over the profile's own cover. */}
      <AppCover
        className="app-cover-start"
        cover="you"
        topStart={<p className="m-0 text-eyebrow uppercase text-ink-mute">Profile</p>}
        topEnd={<SignOut compact />}
        title={user.displayName ? user.displayName : 'You'}
        heading={
          <div className="flex items-center gap-sm">
            {/* The profile picture with the role badge on it: creator, staff or admin. Earned badges live further down. */}
            <span className="relative shrink-0">
              <span className="flex size-[64px] items-center justify-center overflow-hidden rounded-pill bg-card shadow-toy-soft">
                {identity ? <Person stage={identity.stage.stage} size={52} decorative /> : <Avatar relationship="self" size={44} decorative still />}
              </span>
              <RoleBadge role={badgeRoleOf(user)} className="absolute right-0 bottom-0" />
            </span>
            {/* The name in full (it wraps, never cut short); the Pro and role marks follow it and drop under it when there is no room. */}
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-sm gap-y-xs">
              <h1 className="min-w-0 text-balance text-large-title">{user.displayName ? user.displayName : 'You'}</h1>
              {(user.isPro || badgeRoleOf(user) !== 'user') && (
                <span className="flex shrink-0 items-center gap-xs">
                  {user.isPro && <span className="rounded-pill bg-r7 px-sm py-xs text-subhead font-medium text-white">Pro</span>}
                  {badgeRoleOf(user) !== 'user' && <span className="rounded-pill bg-r6 px-sm py-xs text-subhead font-medium text-white">{BADGE_META[badgeRoleOf(user)].name}</span>}
                </span>
              )}
            </div>
          </div>
        }
        lede={
          <>
            {(FOCUS_OPTIONS as readonly string[]).includes(user.focus) && user.focus !== 'Other' ? `Mostly ${user.focus.toLowerCase()}. ` : ''}Level{' '}
            {levelFromXp(user.xp)}, climbing since{' '}
            {monthYear(user.createdAt)}.
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-xs">
          <Link to={user.handle ? `/u/${user.handle}` : `/people/${user.id}`} className="toy toy-soft inline-flex min-h-[40px] md:min-h-[48px] tap-pad items-center gap-xs rounded-pill bg-card px-md text-subhead font-semibold text-ink">
            <Icon icon={UserRound} size={18} />
            See my public page
          </Link>
          <Link to="/profile" className="inline-flex min-h-[40px] md:min-h-[48px] tap-pad items-center px-sm text-subhead text-ink-mute underline-offset-4 hover:text-ink hover:underline">
            Edit page
          </Link>
          <Link to="/plans" className="toy toy-soft inline-flex min-h-[40px] md:min-h-[48px] tap-pad w-full items-center justify-center gap-xs rounded-pill bg-card px-md text-subhead font-semibold text-ink lg:ml-auto lg:w-auto lg:justify-start">
            <Icon icon={WandSparkles} size={18} />
            Plans and credits
          </Link>
        </div>
      </AppCover>

      <section className="mt-lg" aria-labelledby="who-heading">
        {/* The title at the left and the way to match the apps again at its right (a section's link sits at its top right); a narrow phone wraps it under, still at the right. */}
        <div className="flex flex-wrap items-center justify-between gap-xs">
          <h2 id="who-heading" className="min-w-0 text-title2">
            Who you are
          </h2>
          {/* -my-xs: the 48px button reaches 8px above and below the title's row instead of making the row 48px tall, so the line under the
              title sits as close to it as every other section's (it pushed it 11px further down). From the tablet up only: on a phone the
              line runs under the button, so there the button keeps its row and the line stays clear of it. */}
          <Link to="/onboarding?fresh=1" className="toy toy-soft md:-my-xs ml-auto inline-flex min-h-[40px] md:min-h-[48px] tap-pad shrink-0 items-center rounded-pill bg-card px-md text-subhead font-semibold text-ink">
            Match my apps again
          </Link>
        </div>
        <p className="mt-xs m-0 text-subhead text-ink-soft">{whoLine || 'No tags yet. Pick the ones that fit you.'}</p>
        {/* Every tag as a tile to pick, saved as you tap (components/TagPicker.tsx). */}
        <TagPicker identities={user.identities} />
        {/* Two short lines: what tags do, then the privacy promise with the way to read more. */}
        <p className="mt-xs m-0 text-caption text-ink-soft">Tags mark the apps that fit you.</p>
        <Nudge text="They never show on your public page." />
      </section>

      <MyCoachSection />

      <Suspense fallback={null}>
        <TeamSuggestions />
        <OrgInvites />
      </Suspense>

      {/* Invite people: an admin, staff, or someone holding the Inviter permission makes codes here (`/you#invites`). */}
      {canInvite(user) && (
        <Suspense fallback={null}>
          <InvitePeople />
        </Suspense>
      )}

      {/* My QR code: your page and friend code as a picture to show someone in person (components/FriendQr.tsx; `/you#qr`). */}
      <section className="mt-lg" aria-labelledby="qr-heading" id="qr">
        <h2 id="qr-heading" className="text-title2">
          My QR code
        </h2>
        <p className="mt-xs m-0 text-subhead text-ink-soft">Show it to someone you meet. They scan it and can ask to be your friend.</p>
        <div className="mt-sm sm:max-w-[400px]">
          <FriendQr />
        </div>
      </section>

      <section className="mt-lg" aria-labelledby="look-heading">
        <h2 id="look-heading" className="text-title2">
          Appearance
        </h2>
        <p className="mt-xs m-0 text-subhead text-ink-soft">Dark mode keeps the same colors on a deep slate.</p>
        <div className="mt-sm grid grid-cols-3 gap-xs" role="group" aria-label="Theme">
          {(
            [
              ['system', 'Match device'],
              ['light', 'Light'],
              ['dark', 'Dark'],
            ] as [ThemeMode, string][]
          ).map(([m, label]) => (
            <button key={m} type="button" aria-pressed={themeMode === m} onClick={() => setThemeMode(m)} className={`toy min-h-[40px] md:min-h-[48px] tap-pad rounded-pill border-2 text-subhead font-medium ${themeMode === m ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}>
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-lg" aria-labelledby="features-heading" id="features">
        <h2 id="features-heading" className="text-title2">
          Features
        </h2>
        <p className="mt-xs m-0 text-subhead text-ink-soft">Hide the apps you do not use. Nothing is deleted.</p>
        {/* The next line (how each group starts, with Arrange apps) is the second line of this lede, so it follows it closely. */}
        <div className="mt-sm">
          <AppGroups groups={featureGroups} fits={fits} open where="profile" />
        </div>
      </section>

      <CalendarLink />
      <PrivacyChoices />

      <section className="mt-lg" aria-labelledby="account-heading">
        <h2 id="account-heading" className="text-title2">
          Account
        </h2>
        {user.email ? (
          <div className="mt-sm rounded-card bg-card p-md shadow-toy-soft">
            <p className="m-0 text-card-title">{user.email}</p>
            <p className="mt-xs m-0 text-card-note text-ink-soft">
              Your pillars are saved to this account. Sign in on any phone to pick them up.
            </p>
            <div className="mt-sm flex flex-wrap gap-xs">
              <Button variant="outline" onClick={() => setPwOpen(true)}>
                Change password
              </Button>
              <SignOut />
            </div>
          </div>
        ) : (
          <div data-pillar="parent_child" className="mt-sm flex flex-wrap-reverse items-center justify-between gap-sm rounded-card p-md" style={{ background: 'var(--tint-yellow)' }}>
            <div className="min-w-0 flex-1 basis-[60%]">
              <p className="m-0 text-card-title">Only on this device so far.</p>
              <p className="mt-xs m-0 text-card-note">Add an email and password and everything here comes with you to a new phone.</p>
            </div>
            <Link to="/onboarding" className="toy inline-flex min-h-[40px] md:min-h-[48px] tap-pad items-center rounded-pill bg-ink px-md font-semibold text-on-ink">
              Create an account
            </Link>
          </div>
        )}
        <div className="mt-sm rounded-card bg-card p-md shadow-toy-soft">
          <p className="m-0 text-card-title">Your data</p>
          <p className="mt-xs m-0 text-card-note text-ink-soft">Everything we hold about you as one file, or the whole account gone.</p>
          <div className="mt-sm fill-row-all flex flex-wrap gap-xs">
            <Button variant="outline" onClick={() => exportData.mutate()} disabled={exportData.isPending}>
              {exportData.isPending ? 'Preparing' : 'Export my data'}
            </Button>
            <Button variant="ghost" disabled={reset.isPending} onClick={() => setErasing(true)}>
              Erase everything
            </Button>
            <Button variant="ghost" onClick={() => setDeleting(true)}>
              Delete my account
            </Button>
          </div>
          {exportData.isError && (
            <p role="alert" className="mt-xs m-0 rounded-tile bg-r1/15 p-sm text-subhead">
              Could not prepare the export. Try again.
            </p>
          )}
        </div>
        <Sheet open={pwOpen} onClose={() => setPwOpen(false)} title="Change your password">
        <form
          className="flex flex-col gap-sm"
          onSubmit={(e) => {
            e.preventDefault();
            if (pwCurrent && !passwordProblem(pwNew, user.email ?? '') && pwNew === pwAgain) setPassword.mutate();
          }}
        >
          <p className="m-0 text-subhead text-ink-soft">Type the one you have, then the new one twice. Every other device is signed out.</p>
          <label className="block">
            <span className="block text-subhead font-semibold">Current password</span>
            <input type="password" required value={pwCurrent} onChange={(e) => setPwCurrent(e.target.value)} autoComplete="current-password" className={FIELD} />
          </label>
          <label className="block">
            <span className="block text-subhead font-semibold">New password</span>
            <input type="password" required minLength={8} value={pwNew} onChange={(e) => setPwNew(e.target.value)} autoComplete="new-password" className={FIELD} />
          </label>
          <label className="block">
            <span className="block text-subhead font-semibold">Once more</span>
            <input type="password" required minLength={8} value={pwAgain} onChange={(e) => setPwAgain(e.target.value)} autoComplete="new-password" className={FIELD} />
          </label>
          {pwNew && passwordProblem(pwNew, user.email ?? '') && <p className="m-0 text-subhead text-ink-soft">{passwordProblem(pwNew, user.email ?? '')}</p>}
          {pwAgain && pwNew !== pwAgain && <p className="m-0 text-subhead text-ink-soft">The two do not match yet.</p>}
          {setPassword.isError && (
            <p role="alert" className="m-0 rounded-tile bg-r1/15 p-sm text-subhead">
              {setPassword.error instanceof Error ? setPassword.error.message : 'Could not save it.'}
            </p>
          )}
          <Button type="submit" size="lg" full disabled={setPassword.isPending || !pwCurrent || Boolean(passwordProblem(pwNew, user.email ?? '')) || pwNew !== pwAgain}>
            {setPassword.isPending ? 'Saving' : 'Change password'}
          </Button>
        </form>
      </Sheet>
      <Sheet open={deleting} onClose={() => setDeleting(false)} title="Delete your account">
          <p className="m-0 text-subhead font-semibold">This cannot be undone.</p>
          <ul className="mt-xs m-0 flex list-disc flex-col gap-xs pl-md text-subhead text-ink-soft">
            <li>Gone: your name, email, page, bio, pillars, logs, journal, messages and notifications.</li>
            <li>Cancelled: your events, runs and sessions still to come. Whoever was coming is told.</li>
            <li>Archived: anything you have sold. Anything you never sold goes.</li>
            <li>Kept without your name or words: money records, because the books have to, and what others rely on.</li>
          </ul>
          <label className="mt-md block">
            <span className="block text-subhead font-semibold">Type DELETE to confirm</span>
            <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" className={FIELD} />
          </label>
          {deleteAccount.isError && (
            <p role="alert" className="mt-xs m-0 rounded-tile bg-r1/15 p-sm text-subhead">
              {deleteAccount.error instanceof Error ? deleteAccount.error.message : 'Could not delete the account.'}
            </p>
          )}
          <button
            type="button"
            disabled={confirmText !== 'DELETE' || deleteAccount.isPending}
            onClick={() => deleteAccount.mutate()}
            className={`${RED_YES_LG} mt-md w-full`}
          >
            Delete my account
          </button>
        </Sheet>
      <Sheet open={erasing} onClose={() => setErasing(false)} title="Erase everything?">
        <p className="m-0 text-subhead text-ink-soft">Your pillars, xp, streak and badges go, and you start over. There is no undo.</p>
        {reset.isError && (
          <p role="alert" className="mt-xs m-0 rounded-tile bg-r1/15 p-sm text-subhead">
            Could not erase it. Try again.
          </p>
        )}
        <div className="mt-md flex flex-col gap-xs">
          <button
            type="button"
            disabled={reset.isPending}
            onClick={() => reset.mutate()}
            className={RED_YES_LG}
          >
            {reset.isPending ? 'Erasing' : 'Yes, erase everything'}
          </button>
          <Button variant="outline" size="lg" onClick={() => setErasing(false)} disabled={reset.isPending}>
            Keep my progress
          </Button>
        </div>
      </Sheet>
      </section>

      <section className="mt-lg" aria-labelledby="evo-heading">
        <h2 id="evo-heading" className="text-title2">
          Who you are becoming
        </h2>
        <p className="mt-xs m-0 text-subhead text-ink-soft">Xp fills in your next form, and each form also needs time in the app.</p>
        <div className="mt-sm rounded-card bg-card p-md shadow-toy-soft">
          <EvolutionReveal
            now={<Person stage={identity.stage.stage} size={104} decorative />}
            nowName={identity.stage.name}
            next={identity.next ? <Person stage={identity.next.stage} size={104} decorative /> : null}
            nextName={identity.next?.name ?? null}
            charge={identity.charge}
            preparing={identity.preparing}
            readyInDays={identity.readyInDays}
          />
          <p className="mt-sm m-0 text-center text-subhead text-ink-soft">
            {identity.preparing && identity.next
              ? `${identity.next.name} is fully revealed and being prepared. It evolves in ${identity.readyInDays} ${identity.readyInDays === 1 ? 'day' : 'days'}.`
              : identity.next
                ? `${identity.xpToNext} xp until ${identity.next.name} is fully revealed.`
                : 'Final form. Nothing left to reveal.'}
          </p>
          <ol className="mt-md flex list-none flex-col gap-xs p-0 m-0">
            {IDENTITY_STAGES.map((st) => {
              const reached = st.stage <= identity.stage.stage;
              const color = RELATIONSHIPS[st.stage - 1];
              return (
                <li key={st.stage} className={`flex items-center gap-sm text-subhead ${reached ? '' : 'text-ink-soft'}`}>
                  <span
                    className="flex size-[24px] shrink-0 items-center justify-center rounded-pill text-caption font-medium"
                    style={reached ? { background: color?.color, color: color?.text } : { background: 'var(--color-line)', color: 'var(--color-ink-soft)' }}
                    aria-hidden="true"
                  >
                    {st.stage}
                  </span>
                  <span className={`min-w-0 flex-1 ${st.stage === identity.stage.stage ? 'font-semibold' : ''}`}>
                    {st.name}
                    {st.stage === identity.stage.stage && <span className="text-ink-soft"> (now)</span>}
                  </span>
                  <span className="shrink-0 text-caption text-ink-soft">
                    {st.minXp} xp{st.minDays > 0 ? `, ${st.minDays} days` : ''}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      <section className="mt-lg" aria-labelledby="points-heading">
        <h2 id="points-heading" className="text-title2">
          Points
        </h2>
        <div className="mt-sm flex items-center gap-sm rounded-card bg-card p-md shadow-toy-soft">
          <div className="min-w-0 flex-1">
            <p className="m-0 text-large-title type-figure leading-none">{user.points}</p>
            <p className="mt-xs m-0 text-subhead text-ink-soft">
              {POINTS.checkin} per check-in, {POINTS.streakBonus} bonus every {POINTS.streakBonusEvery}th day. Trade them for real things.
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-xs">
            <Link to="/rewards" className="toy toy-ink inline-flex min-h-[40px] md:min-h-[48px] tap-pad items-center justify-center rounded-pill border-2 border-ink bg-card px-md font-semibold text-ink">
              Rewards
            </Link>
            <Link to="/leaderboard" className="toy toy-ink inline-flex min-h-[40px] md:min-h-[48px] tap-pad items-center justify-center rounded-pill border-2 border-ink bg-card px-md font-semibold text-ink">
              Rank
            </Link>
          </div>
        </div>
        <div className="mt-sm grid grid-cols-3 gap-xs">
          <StatTile label="xp" value={user.xp} />
          <StatTile label="best streak" value={user.bestStreak} />
          <StatTile label="tasks done" value={stats.tasksDone} />
        </div>
      </section>

      <Suspense
        fallback={
          <Busy label="Loading your year" className="mt-lg">
            <Skeleton className="h-[300px]" />
          </Busy>
        }
      >
        <ActivityGrid />
      </Suspense>

      <section className="mt-lg" aria-label="Badges and honors">
        <Suspense
          fallback={
            <Busy label="Loading your badges">
              <Skeleton className="h-[176px]" />
            </Busy>
          }
        >
          <BadgeGallery />
        </Suspense>
        {nextBadge(badges) && <Nudge className="mt-sm" text={`Next up: ${nextBadge(badges)!.name}. ${nextBadge(badges)!.how}.`} />}
        <h3 className="mt-md text-headline">Awarded</h3>
        <p className="mt-xs m-0 text-subhead text-ink-soft">Given by the kreators.app team, or unlocked by time in the app. These count on the leaderboard too.</p>
        <ul className={`mt-sm grid list-none gap-sm p-0 m-0 ${evenGrid(HONORS.length, HONOR_COLS)}`}>
          {HONORS.map((h, i) => {
            const on = awarded.has(h.key);
            return (
              // On a phone and a tablet the seal sits over the words, so the words keep the tile's width instead of a column of short lines. Even rows
              // (lib/bento.ts): every row full, its tiles one width, so no tile is left alone.
              <li key={h.key} className={`flex flex-col items-start gap-sm rounded-tile bg-card p-sm shadow-toy-soft lg:flex-row lg:items-center ${evenTile(i, HONORS.length, HONOR_COLS)}`}>
                <BadgeArt name={h.name} icon={h.icon} tier={h.tier} shape="seal" earned={on} size="sm" decorative />
                <span className="min-w-0">
                  <span className="block text-card-title">{h.name}</span>
                  {/* Locked on a line of its own and the how under it, so the narrow tile never ends on a short line. */}
                  <span className="block text-balance text-card-note text-ink-soft">
                    {on ? (
                      h.source === 'time' ? 'Unlocked' : 'Awarded'
                    ) : (
                      <>
                        <span className="block">Locked</span>
                        <span className="block">{tie(h.how)}</span>
                      </>
                    )}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-lg" aria-labelledby="rainbow-heading">
        <h2 id="rainbow-heading" className="text-title2">
          Your vibe check
        </h2>
        <div className="mt-sm rounded-card bg-card p-md shadow-toy-soft">
          <div className="flex justify-between">
            {RELATIONSHIPS.map((r) => (
              <Avatar key={r.key} relationship={r.key} size={36} still stage={byKey.get(r.key)?.stage ?? 1} mood={(byKey.get(r.key)?.pillars ?? 0) > 0 ? 'happy' : 'sleepy'} />
            ))}
          </div>
          <ul className="mt-md flex list-none flex-col gap-xs p-0 m-0">
            {floors.map((r) => {
              const score = byKey.get(r.key)?.score ?? 0;
              return (
                <li key={r.key} className="flex items-center gap-sm text-subhead">
                  <span className="w-[120px] shrink-0 truncate">{r.name}</span>
                  <span className="h-[12px] flex-1 overflow-hidden rounded-pill bg-paper" aria-hidden="true">
                    <span className="block h-full rounded-pill" style={{ width: `${Math.max(4, score)}%`, background: r.color }} />
                  </span>
                  <span className="w-[40px] shrink-0 text-right">{score}%</span>
                </li>
              );
            })}
          </ul>
          <div className="mt-md flex flex-wrap gap-sm">
            <Link to="/session?fresh=1" className="inline-flex min-h-[44px] items-center text-ink-soft underline underline-offset-4">
              Run the strategy session again
            </Link>
            <Link to="/vibe-check" className="inline-flex min-h-[44px] items-center text-ink-soft underline underline-offset-4">
              Retake the vibe check
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-lg" aria-labelledby="profile-heading">
        <h2 id="profile-heading" className="text-title2">
          Profile
        </h2>
        <form
          className="mt-sm flex flex-col gap-md rounded-card bg-card p-md shadow-toy-soft"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <label className="block">
            <span className="block text-subhead font-semibold">Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoComplete="nickname" className={FIELD} />
          </label>
          <fieldset className="m-0 border-0 p-0">
            <legend className="text-subhead">What fills most of your days</legend>
            <div className="fill-row-all mt-xs flex flex-wrap gap-xs">
              {FOCUS_OPTIONS.map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={type === t}
                  onClick={() => setType(t)}
                  className={`min-h-[36px] md:min-h-[44px] tap-pad rounded-pill border-2 px-sm py-0 md:py-xs text-subhead font-medium ${type === t ? 'border-ink bg-ink text-on-ink' : 'border-line bg-card'}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </fieldset>
          <DatesAndTimes timezone={timezone} onZone={setTimezone} dateFormat={dateFormat} onDate={setDateFormat} timeFormat={timeFormat} onTime={setTimeFormat} />
          <label className="flex min-h-[44px] cursor-pointer items-center gap-sm text-body">
            <input type="checkbox" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} className="size-[20px] accent-ink" />
            Show me on the leaderboard
          </label>
          <p className="m-0 text-subhead text-ink-soft">
            Your public page, skills, portfolio and introductions live under{' '}
            <Link to="/profile" className="underline underline-offset-4">
              Public page
            </Link>
            . Daily reminders are set in the{' '}
            <Link to="/inbox" className="underline underline-offset-4">
              Inbox
            </Link>
            .
          </p>
          <Button type="submit" full disabled={save.isPending}>
            {saved ? 'Saved' : 'Save profile'}
          </Button>
        </form>
      </section>

      <section className="mt-lg" aria-labelledby="help-heading">
        <h2 id="help-heading" className="text-title2">
          Help
        </h2>
        <div className="mt-sm flex flex-wrap gap-xs">
          <Button
            variant="outline"
            onClick={() => nav('/today#how-heading')}
          >
            Show how Daily works
          </Button>
        </div>
      </section>
    </Screen>
  );
}
