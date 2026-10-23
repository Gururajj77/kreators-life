import { BADGES, HONORS, IDENTITY_STAGES, levelFromXp, POINTS, RELATIONSHIPS, type MeResponse } from '@kreators/shared';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import { Creator } from '../components/Creator';
import { EvolutionReveal } from '../components/EvolutionReveal';
import { useGuide } from '../components/Guide';
import { Screen } from '../components/Screen';
import { api } from '../lib/api';
import { useMe, useRefreshAll } from '../lib/queries';

const CREATOR_TYPES = ['YouTube', 'TikTok', 'Instagram', 'Podcast', 'Newsletter', 'Streaming', 'Other'];

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
  const [name, setName] = useState(user.displayName);
  const [type, setType] = useState(user.creatorType);
  const [optIn, setOptIn] = useState(user.leaderboardOptIn);
  const [saved, setSaved] = useState(false);

  const save = useMutation({
    mutationFn: () => api.updateMe({ displayName: name, creatorType: type, leaderboardOptIn: optIn }),
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
      nav('/vibe-check', { replace: true });
    },
  });

  const byKey = new Map(relationships.map((r) => [r.key, r]));
  const floors = [...RELATIONSHIPS].sort((a, b) => b.floor - a.floor);
  const earned = new Set(badges);
  const awarded = new Set(honors);

  return (
    <Screen>
      <header className="pt-lg">
        <div className="flex items-center gap-sm">
          <h1 className="min-w-0 truncate text-[32px]">{user.displayName ? user.displayName : 'You'}</h1>
          {user.isPro && <span className="shrink-0 rounded-pill bg-r7 px-sm py-xs text-[13px] font-extrabold text-white">Pro</span>}
        </div>
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">
          {user.creatorType ? `${user.creatorType} creator, ` : ''}level {levelFromXp(user.xp)}, climbing since{' '}
          {new Date(user.createdAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}.
        </p>
      </header>

      <section className="mt-lg" aria-labelledby="evo-heading">
        <h2 id="evo-heading" className="text-[22px]">
          Who you are becoming
        </h2>
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Xp fills in your next form from the feet up. Each form also needs time on the tower before it is ready.</p>
        <div className="mt-sm rounded-card bg-card p-md shadow-toy-soft">
          <EvolutionReveal
            now={<Creator stage={identity.stage.stage} size={104} decorative />}
            nowName={identity.stage.name}
            next={identity.next ? <Creator stage={identity.next.stage} size={104} decorative /> : null}
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
                    style={reached ? { background: color?.color, color: color?.text } : { background: '#EFE4DA', color: '#6B5F78' }}
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
        <h2 id="points-heading" className="text-[22px]">
          Points
        </h2>
        <div className="mt-sm flex items-center gap-sm rounded-card bg-card p-md shadow-toy-soft">
          <div className="min-w-0 flex-1">
            <p className="m-0 font-display text-[32px] font-extrabold leading-none">{user.points}</p>
            <p className="mt-xs m-0 text-[13px] font-semibold text-ink-soft">
              {POINTS.checkin} per check-in, {POINTS.streakBonus} bonus every {POINTS.streakBonusEvery}th day. Trade them for real things.
            </p>
          </div>
          <Link to="/rewards" className="toy inline-flex min-h-[48px] shrink-0 items-center rounded-pill bg-ink px-md font-bold text-white shadow-[0_4px_0_0_#15101f]">
            Rewards
          </Link>
        </div>
        <div className="mt-sm grid grid-cols-3 gap-xs">
          <Stat label="xp" value={user.xp} />
          <Stat label="best streak" value={user.bestStreak} />
          <Stat label="tasks done" value={stats.tasksDone} />
        </div>
      </section>

      <section className="mt-lg" aria-labelledby="badges-heading">
        <h2 id="badges-heading" className="text-[22px]">
          Badges
        </h2>
        <h3 className="mt-sm text-[16px]">Earned</h3>
        <p className="mt-xs m-0 text-[13px] font-semibold text-ink-soft">Yours the moment you do the thing.</p>
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
        <p className="mt-xs m-0 text-[13px] font-semibold text-ink-soft">Given by the Kreators team, or unlocked by time on the tower. These count on the leaderboard too.</p>
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
        <h2 id="rainbow-heading" className="text-[22px]">
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
          <Link to="/vibe-check" className="mt-md inline-flex min-h-[44px] items-center font-bold text-ink-soft underline underline-offset-4">
            Retake the vibe check
          </Link>
        </div>
      </section>

      <section className="mt-lg" aria-labelledby="profile-heading">
        <h2 id="profile-heading" className="text-[22px]">
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
            <legend className="text-[14px] font-bold">Where you create</legend>
            <div className="mt-xs flex flex-wrap gap-xs">
              {CREATOR_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={type === t}
                  onClick={() => setType(t)}
                  className={`rounded-pill border-2 px-sm py-xs text-[14px] font-bold ${type === t ? 'border-ink bg-ink text-white' : 'border-line bg-card'}`}
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
          <Button type="submit" full disabled={save.isPending}>
            {saved ? 'Saved' : 'Save profile'}
          </Button>
        </form>
      </section>

      <section className="mt-lg" aria-labelledby="help-heading">
        <h2 id="help-heading" className="text-[22px]">
          Help
        </h2>
        <div className="mt-sm flex flex-wrap gap-xs">
          <Button
            variant="outline"
            onClick={() => {
              guide.reset();
              nav('/today');
            }}
          >
            Show how it works again
          </Button>
          <Button
            variant="ghost"
            disabled={reset.isPending}
            onClick={() => {
              if (window.confirm('Erase your tower, xp, streak and badges on this device and start over? There is no undo.')) reset.mutate();
            }}
          >
            Erase everything
          </Button>
        </div>
      </section>
    </Screen>
  );
}
