import { BADGES, FOCUS_OPTIONS, HONORS, IDENTITY_BY_KEY, IDENTITY_STAGES, identityLabel, identityLine, levelFromXp, matchSetup, passwordProblem, MODULE_GROUP_ACCENT, MODULE_GROUP_BLURB, MODULE_GROUPS, POINTS, RELATIONSHIP_BY_KEY, RELATIONSHIPS, BADGE_META, badgeRoleOf, setupSwitchable, type MeResponse, type ModuleGroup , nextBadge } from '@kreators/shared';
import { useMutation } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import { MyCoachSection } from '../components/MyCoach';
import { Nudge } from '../components/Nudge';
import { Person } from '../components/Person';
import { RoleBadge } from '../components/RoleBadge';
import { SignOut } from '../components/SignOut';
import { EvolutionReveal } from '../components/EvolutionReveal';
import { useGuide } from '../components/Guide';
import { Toggle } from '../components/Toggle';
import { useModules } from '../lib/modules';
import { useSession } from '../lib/store';
import { useTheme, type ThemeMode } from '../lib/theme';
import { Screen } from '../components/Screen';
import { Sheet } from '../components/Sheet';
import { api } from '../lib/api';
import { todayLocal } from '../lib/date';
import { useMe, useRefreshAll } from '../lib/queries';


export function You() {
  const me = useMe();
  if (!me.data) return null;
  return <YouView key={me.data.user.id} data={me.data} />;
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-tile bg-card p-sm shadow-toy-soft">
      <p className="m-0 font-display text-[24px] font-extrabold leading-none">{value}</p>
      <p className="mt-xs m-0 text-[12px] font-bold text-ink-soft">{label}</p>
    </div>
  );
}

function YouView({ data }: { data: MeResponse }) {
  const { user, relationships, badges, honors, identity, stats } = data;
  const refresh = useRefreshAll();
  const nav = useNavigate();
  const guide = useGuide();
  const setToken = useSession((s) => s.setToken);
  const { modules } = useModules();
  const themeMode = useTheme((s) => s.mode);
  const setThemeMode = useTheme((s) => s.setMode);
  const toggle = useMutation({ mutationFn: ({ key, on }: { key: string; on: boolean }) => api.setModule(key, on), onSuccess: () => refresh() });
  const [deleting, setDeleting] = useState(false);
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
  const [saved, setSaved] = useState(false);

  const save = useMutation({
    mutationFn: () => api.updateMe({ displayName: name, focus: type, leaderboardOptIn: optIn }),
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
  const fits = useMemo(() => {
    if (setup.identities.length === 0 && setup.goals.length === 0) return new Map<string, string>();
    const m = matchSetup(setup, modules.filter((x) => setupSwitchable(x) && x.available).map((x) => x.key));
    return new Map([...m.apps, ...m.more].map((a) => [a.key, a.why]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.identities.join('|'), user.intake.goals.join('|'), user.intake.blockers.join('|'), modules]);
  const earned = new Set(badges);
  const awarded = new Set(honors);

  return (
    <Screen columns={false}>
      <header className="pt-lg">
        <div className="flex items-center justify-between gap-sm">
          <p className="m-0 text-[14px] font-extrabold uppercase tracking-wide text-ink-mute">Profile</p>
          <SignOut compact />
        </div>
        <div className="flex items-center gap-sm">
          {/* The profile picture with the role badge on it: creator, staff or admin. Earned badges live further down. */}
          <span className="relative shrink-0">
            <span className="flex size-[64px] items-center justify-center overflow-hidden rounded-pill bg-card shadow-toy-soft">
              {identity ? <Person stage={identity.stage.stage} size={52} decorative /> : <Avatar relationship="self" size={44} decorative still />}
            </span>
            <RoleBadge role={badgeRoleOf(user)} className="absolute right-0 bottom-0" />
          </span>
          <h1 className="min-w-0 truncate text-[30px]">{user.displayName ? user.displayName : 'You'}</h1>
          {user.isPro && <span className="shrink-0 rounded-pill bg-r7 px-sm py-xs text-[14px] font-extrabold text-white">Pro</span>}
          {badgeRoleOf(user) !== 'user' && <span className="shrink-0 rounded-pill bg-r6 px-sm py-xs text-[14px] font-extrabold text-white">{BADGE_META[badgeRoleOf(user)].name}</span>}
        </div>
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">
          {(FOCUS_OPTIONS as readonly string[]).includes(user.focus) && user.focus !== 'Other' ? `Mostly ${user.focus.toLowerCase()}. ` : ''}Level{' '}
          {levelFromXp(user.xp)}, climbing since{' '}
          {new Date(user.createdAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}.
        </p>
        <div className="mt-sm flex flex-wrap items-center gap-xs">
          <Link to={user.handle ? `/u/${user.handle}` : `/people/${user.id}`} className="toy toy-soft inline-flex min-h-[48px] items-center gap-xs rounded-pill bg-card px-md text-[14px] font-bold text-ink">
            <span aria-hidden="true">👤</span>
            See my public page
          </Link>
          <Link to="/profile" className="inline-flex min-h-[48px] items-center px-sm text-[14px] font-bold text-ink-mute underline-offset-4 hover:text-ink hover:underline">
            Edit page
          </Link>
          <Link to="/plans" className="toy toy-soft ml-auto inline-flex min-h-[48px] items-center gap-xs rounded-pill bg-card px-md text-[14px] font-bold text-ink">
            <span aria-hidden="true">🪄</span>
            Plans and credits
          </Link>
        </div>
      </header>

      <section className="mt-lg" aria-labelledby="who-heading">
        <h2 id="who-heading" className="text-[24px]">
          Who you are
        </h2>
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">{whoLine || 'No tags yet. A short chat sets them, and switches on the apps that fit.'}</p>
        {user.identities.length > 0 && (
          <ul className="mt-sm flex list-none flex-wrap gap-xs p-0 m-0" aria-label="Your tags">
            {user.identities.map((k) => (
              <li key={k} className="rounded-pill bg-card px-sm py-xs text-[14px] font-bold shadow-toy-soft">
                {IDENTITY_BY_KEY[k]?.emoji ?? '🏷️'} {identityLabel(k)}
              </li>
            ))}
          </ul>
        )}
        <Link to="/onboarding?fresh=1" className="toy toy-soft mt-sm inline-flex min-h-[48px] items-center rounded-pill bg-card px-md text-[14px] font-bold text-ink">
          {user.identities.length ? 'Change my tags and apps' : 'Set my tags and apps'}
        </Link>
        <Nudge className="mt-xs" text="Tags pick your apps and fill in your skills and interests. They never show on your public page." />
      </section>

      <MyCoachSection />

      <section className="mt-lg" aria-labelledby="look-heading">
        <h2 id="look-heading" className="text-[24px]">
          Appearance
        </h2>
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Dark mode keeps the same colors and turns them inside out: cream becomes deep brown, pale tints become deep tints.</p>
        <div className="mt-sm grid grid-cols-3 gap-xs" role="group" aria-label="Theme">
          {(
            [
              ['system', 'Match device'],
              ['light', 'Light'],
              ['dark', 'Dark'],
            ] as [ThemeMode, string][]
          ).map(([m, label]) => (
            <button key={m} type="button" aria-pressed={themeMode === m} onClick={() => setThemeMode(m)} className={`toy min-h-[48px] rounded-pill border-2 text-[14px] font-bold ${themeMode === m ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}>
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-lg" aria-labelledby="features-heading" id="features">
        <h2 id="features-heading" className="text-[24px]">
          Features
        </h2>
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">This is the one place an app can be switched off. Off means it goes grey on the Apps screen; nothing is deleted.</p>
        {(['earn', 'creator', 'community', 'wellbeing', 'core', 'manage', 'internal'] as ModuleGroup[]).map((g) => {
          const list = modules.filter((m) => m.group === g && m.available && !m.locked);
          if (list.length === 0) return null;
          const rel = RELATIONSHIP_BY_KEY[MODULE_GROUP_ACCENT[g]];
          const on = list.filter((m) => m.on).length;
          return (
            <div key={g} className="mt-md rounded-card p-sm" style={{ background: `var(--soft-${rel.key})` }}>
              <div className="flex items-center gap-sm">
                <Avatar relationship={rel.key} size={36} decorative still mood={on > 0 ? 'happy' : 'sleepy'} />
                <div className="min-w-0 flex-1">
                  <h3 className="text-[16px]">{MODULE_GROUPS[g]}</h3>
                  <p className="m-0 text-[12px] font-bold" style={{ color: `var(--deep-${rel.key})` }}>
                    {MODULE_GROUP_BLURB[g]}
                  </p>
                </div>
                <span className="shrink-0 rounded-pill bg-card px-xs text-[12px] font-extrabold leading-[24px]" style={{ color: `var(--deep-${rel.key})` }}>
                  {on} of {list.length} on
                </span>
              </div>
              <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
                {list.map((m) => (
                  <li key={m.key}>
                    <Toggle
                      on={m.on}
                      onChange={(on) => toggle.mutate({ key: m.key, on })}
                      label={
                        fits.has(m.key) ? (
                          <>
                            {m.emoji} {m.name}{' '}
                            <span className="ml-xs rounded-pill px-xs align-middle text-[11px] font-extrabold uppercase tracking-wide" style={{ background: `var(--soft-${rel.key})`, color: `var(--deep-${rel.key})` }}>
                              Fits you
                            </span>
                          </>
                        ) : (
                          `${m.emoji} ${m.name}`
                        )
                      }
                      hint={
                        fits.has(m.key) ? (
                          <>
                            {m.blurb}
                            <span className="mt-xs block text-[12px] font-bold">{fits.get(m.key)}</span>
                          </>
                        ) : (
                          m.blurb
                        )
                      }
                      disabled={toggle.isPending}
                      color={rel.color}
                    />
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </section>

      <section className="mt-lg" aria-labelledby="account-heading">
        <h2 id="account-heading" className="text-[24px]">
          Account
        </h2>
        {user.email ? (
          <div className="mt-sm rounded-card bg-card p-md shadow-toy-soft">
            <p className="m-0 text-[16px] font-bold">{user.email}</p>
            <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">
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
          <div className="mt-sm rounded-card p-md" style={{ background: 'var(--tint-yellow)' }}>
            <p className="m-0 text-[16px] font-bold">Only on this device so far.</p>
            <p className="mt-xs m-0 text-[14px] font-semibold">Add an email and password and everything here comes with you to a new phone.</p>
            <Link to="/onboarding" className="toy mt-sm inline-flex min-h-[48px] items-center rounded-pill bg-ink px-md font-bold text-on-ink">
              Create an account
            </Link>
          </div>
        )}
        <div className="mt-sm rounded-card bg-card p-md shadow-toy-soft">
          <p className="m-0 text-[16px] font-bold">Your data</p>
          <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Everything we hold about you as one file, or the whole account gone.</p>
          <div className="mt-sm flex flex-wrap gap-xs">
            <Button variant="outline" onClick={() => exportData.mutate()} disabled={exportData.isPending}>
              {exportData.isPending ? 'Preparing' : 'Export my data'}
            </Button>
            <Button variant="ghost" onClick={() => setDeleting(true)}>
              Delete my account
            </Button>
          </div>
          {exportData.isError && (
            <p role="alert" className="mt-xs m-0 rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
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
          <p className="m-0 text-[14px] font-semibold text-ink-soft">Type the one you have, then the new one twice. Every other device is signed out.</p>
          <label className="block">
            <span className="block text-[14px] font-bold">Current password</span>
            <input type="password" required value={pwCurrent} onChange={(e) => setPwCurrent(e.target.value)} autoComplete="current-password" className="mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]" />
          </label>
          <label className="block">
            <span className="block text-[14px] font-bold">New password</span>
            <input type="password" required minLength={8} value={pwNew} onChange={(e) => setPwNew(e.target.value)} autoComplete="new-password" className="mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]" />
          </label>
          <label className="block">
            <span className="block text-[14px] font-bold">Once more</span>
            <input type="password" required minLength={8} value={pwAgain} onChange={(e) => setPwAgain(e.target.value)} autoComplete="new-password" className="mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]" />
          </label>
          {pwNew && passwordProblem(pwNew, user.email ?? '') && <p className="m-0 text-[14px] font-bold text-ink-soft">{passwordProblem(pwNew, user.email ?? '')}</p>}
          {pwAgain && pwNew !== pwAgain && <p className="m-0 text-[14px] font-bold text-ink-soft">The two do not match yet.</p>}
          {setPassword.isError && (
            <p role="alert" className="m-0 rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
              {setPassword.error instanceof Error ? setPassword.error.message : 'Could not save it.'}
            </p>
          )}
          <Button type="submit" size="lg" full disabled={setPassword.isPending || !pwCurrent || Boolean(passwordProblem(pwNew, user.email ?? '')) || pwNew !== pwAgain}>
            {setPassword.isPending ? 'Saving' : 'Change password'}
          </Button>
        </form>
      </Sheet>
      <Sheet open={deleting} onClose={() => setDeleting(false)} title="Delete your account">
          <p className="m-0 text-[14px] font-semibold text-ink-soft">This removes your name, email, page, bio, pillars, logs, journal, messages and notifications, and archives anything you sell. Money records stay, anonymised, because the books have to. It cannot be undone.</p>
          <label className="mt-md block">
            <span className="block text-[14px] font-bold">Type DELETE to confirm</span>
            <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" className="mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]" />
          </label>
          {deleteAccount.isError && (
            <p role="alert" className="mt-xs m-0 rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
              {deleteAccount.error instanceof Error ? deleteAccount.error.message : 'Could not delete the account.'}
            </p>
          )}
          <Button className="mt-md" full disabled={confirmText !== 'DELETE' || deleteAccount.isPending} onClick={() => deleteAccount.mutate()}>
            Delete everything
          </Button>
        </Sheet>
      </section>

      <section className="mt-lg" aria-labelledby="evo-heading">
        <h2 id="evo-heading" className="text-[24px]">
          Who you are becoming
        </h2>
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Xp fills in your next form from the feet up. Each form also needs time in the app before it is ready.</p>
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
          <p className="mt-sm m-0 text-center text-[14px] font-semibold text-ink-soft">
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
                <li key={st.stage} className={`flex items-center gap-sm text-[14px] ${reached ? '' : 'text-ink-soft'}`}>
                  <span
                    className="flex size-[24px] shrink-0 items-center justify-center rounded-pill text-[12px] font-extrabold"
                    style={reached ? { background: color?.color, color: color?.text } : { background: 'var(--color-line)', color: 'var(--color-ink-soft)' }}
                    aria-hidden="true"
                  >
                    {st.stage}
                  </span>
                  <span className="min-w-0 flex-1 font-bold">
                    {st.name}
                    {st.stage === identity.stage.stage && <span className="font-semibold text-ink-soft"> (now)</span>}
                  </span>
                  <span className="shrink-0 text-[12px] font-bold text-ink-soft">
                    {st.minXp} xp{st.minDays > 0 ? `, ${st.minDays} days` : ''}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      <section className="mt-lg" aria-labelledby="points-heading">
        <h2 id="points-heading" className="text-[24px]">
          Points
        </h2>
        <div className="mt-sm flex items-center gap-sm rounded-card bg-card p-md shadow-toy-soft">
          <div className="min-w-0 flex-1">
            <p className="m-0 font-display text-[30px] font-extrabold leading-none">{user.points}</p>
            <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">
              {POINTS.checkin} per check-in, {POINTS.streakBonus} bonus every {POINTS.streakBonusEvery}th day. Trade them for real things.
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-xs">
            <Link to="/rewards" className="toy inline-flex min-h-[48px] items-center justify-center rounded-pill bg-ink px-md font-bold text-on-ink">
              Rewards
            </Link>
            <Link to="/leaderboard" className="toy toy-ink inline-flex min-h-[48px] items-center justify-center rounded-pill border-2 border-ink bg-card px-md font-bold text-ink">
              Rank
            </Link>
          </div>
        </div>
        <div className="mt-sm grid grid-cols-3 gap-xs">
          <Stat label="xp" value={user.xp} />
          <Stat label="best streak" value={user.bestStreak} />
          <Stat label="tasks done" value={stats.tasksDone} />
        </div>
      </section>

      <section className="mt-lg" aria-labelledby="badges-heading">
        <h2 id="badges-heading" className="text-[24px]">
          Badges
        </h2>
        {nextBadge(badges) && <Nudge className="mt-xs" text={`Next up: ${nextBadge(badges)!.name}. ${nextBadge(badges)!.how}.`} />}
        <h3 className="mt-sm text-[16px]">Earned</h3>
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Yours the moment you do the thing.</p>
        <ul className="mt-sm grid list-none grid-cols-2 gap-xs p-0 m-0">
          {BADGES.map((b) => {
            const on = earned.has(b.key);
            return (
              <li key={b.key} className={`rounded-tile bg-card p-sm shadow-toy-soft ${on ? '' : 'opacity-50'}`}>
                <p className="m-0 text-[24px]" aria-hidden="true">
                  {b.emoji}
                </p>
                <p className="mt-xs m-0 text-[14px] font-extrabold">{b.name}</p>
                <p className="m-0 text-[12px] font-semibold text-ink-soft">{on ? 'Earned' : b.how}</p>
              </li>
            );
          })}
        </ul>
        <h3 className="mt-md text-[16px]">Awarded</h3>
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Given by the kreators.app team, or unlocked by time in the app. These count on the leaderboard too.</p>
        <ul className="mt-sm grid list-none grid-cols-2 gap-xs p-0 m-0">
          {HONORS.map((h) => {
            const on = awarded.has(h.key);
            return (
              <li key={h.key} className={`rounded-tile bg-card p-sm shadow-toy-soft ${on ? '' : 'opacity-50'}`}>
                <p className="m-0 text-[24px]" aria-hidden="true">
                  {h.emoji}
                </p>
                <p className="mt-xs m-0 text-[14px] font-extrabold">{h.name}</p>
                <p className="m-0 text-[12px] font-semibold text-ink-soft">{on ? (h.source === 'time' ? 'Unlocked' : 'Awarded') : h.how}</p>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-lg" aria-labelledby="rainbow-heading">
        <h2 id="rainbow-heading" className="text-[24px]">
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
                <li key={r.key} className="flex items-center gap-sm text-[14px] font-bold">
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
            <Link to="/session?fresh=1" className="inline-flex min-h-[44px] items-center font-bold text-ink-soft underline underline-offset-4">
              Run the strategy session again
            </Link>
            <Link to="/vibe-check" className="inline-flex min-h-[44px] items-center font-bold text-ink-soft underline underline-offset-4">
              Retake the vibe check
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-lg" aria-labelledby="profile-heading">
        <h2 id="profile-heading" className="text-[24px]">
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
            <span className="block text-[14px] font-bold">Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoComplete="nickname" className="mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]" />
          </label>
          <fieldset className="m-0 border-0 p-0">
            <legend className="text-[14px] font-bold">What fills most of your days</legend>
            <div className="mt-xs flex flex-wrap gap-xs">
              {FOCUS_OPTIONS.map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={type === t}
                  onClick={() => setType(t)}
                  className={`rounded-pill border-2 px-sm py-xs text-[14px] font-bold ${type === t ? 'border-ink bg-ink text-on-ink' : 'border-line bg-card'}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="flex items-center gap-sm text-[14px] font-bold">
            <input type="checkbox" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} className="size-[20px] accent-ink" />
            Show me on the leaderboard
          </label>
          <p className="m-0 text-[14px] font-semibold text-ink-soft">
            Your public page, skills, portfolio and introductions live under{' '}
            <Link to="/profile" className="underline underline-offset-4">
              Profile
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
        <h2 id="help-heading" className="text-[24px]">
          Help
        </h2>
        <div className="mt-sm flex flex-wrap gap-xs">
          <Button
            variant="outline"
            onClick={() => {
              guide.reset();
              nav('/home');
            }}
          >
            Show how it works again
          </Button>
          <Button
            variant="ghost"
            disabled={reset.isPending}
            onClick={() => {
              if (window.confirm('Erase your pillars, xp, streak and badges on this device and start over? There is no undo.')) reset.mutate();
            }}
          >
            Erase everything
          </Button>
        </div>
      </section>
    </Screen>
  );
}
