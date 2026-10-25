import { IDENTITY_STAGES, type LeaderboardEntry, type LeaderboardSort } from '@kreators/shared';
import { useState } from 'react';
import { Link } from 'react-router';
import { Button } from '../components/Button';
import { BackLink } from '../components/PageHeader';
import { Screen } from '../components/Screen';
import { useLeaderboard } from '../lib/queries';

const SORTS: { key: LeaderboardSort; label: string; stat: (e: LeaderboardEntry) => string }[] = [
  { key: 'xp', label: 'Xp', stat: (e) => `${e.xp} xp` },
  { key: 'streak', label: 'Streak', stat: (e) => `${e.streak} ${e.streak === 1 ? 'day' : 'days'}` },
  { key: 'badges', label: 'Badges', stat: (e) => `${e.badgeCount} ${e.badgeCount === 1 ? 'badge' : 'badges'}` },
];

function Entry({ e, stat }: { e: LeaderboardEntry; stat: string }) {
  const stage = IDENTITY_STAGES.find((s) => s.stage === e.stage);
  const medal = e.rank === 1 ? '🥇' : e.rank === 2 ? '🥈' : e.rank === 3 ? '🥉' : null;
  return (
    <li className={`flex items-center gap-sm rounded-tile p-sm shadow-toy-soft ${e.isMe ? 'bg-ink text-on-ink' : 'bg-card'}`}>
      <span
        className="flex size-[36px] shrink-0 items-center justify-center rounded-pill bg-paper text-[14px] font-extrabold text-ink"
        role="img"
        aria-label={`Rank ${e.rank}`}
      >
        {medal ?? e.rank}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-xs">
          <span className="truncate text-[16px] font-bold">
            {e.name}
            {e.isMe ? ' (you)' : ''}
          </span>
          {e.isPro && <span className="shrink-0 rounded-pill bg-r7 px-xs text-[12px] font-extrabold text-white">Pro</span>}
        </span>
        <span className={`block text-[14px] font-semibold ${e.isMe ? 'text-on-ink/80' : 'text-ink-soft'}`}>
          {stage?.name ?? 'Seed'}, level {e.level}
        </span>
      </span>
      <span className="shrink-0 text-[14px] font-extrabold">{stat}</span>
    </li>
  );
}

export function Leaderboard() {
  const [by, setBy] = useState<LeaderboardSort>('xp');
  const q = useLeaderboard(by);
  const sort = SORTS.find((s) => s.key === by) ?? SORTS[0]!;

  return (
    <Screen>
      <header className="pt-lg">
        <BackLink to="/apps">Apps</BackLink>
        <h1 className="text-[30px]">Leaderboard</h1>
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">The top twenty climbers. Badges count both the ones you earn and the ones you are awarded.</p>
      </header>

      <div className="mt-md grid grid-cols-3 gap-xs" role="group" aria-label="Rank by">
        {SORTS.map((s) => (
          <button
            key={s.key}
            type="button"
            aria-pressed={by === s.key}
            onClick={() => setBy(s.key)}
            className={`toy min-h-[44px] rounded-pill border-2 text-[14px] font-bold ${by === s.key ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {q.isPending && (
        <p className="mt-md text-[14px] font-bold text-ink-soft" role="status">
          Counting the areas
        </p>
      )}
      {q.isError && (
        <div className="mt-md rounded-card bg-card p-md shadow-toy-soft" role="alert">
          <p className="m-0 font-bold">Could not load the leaderboard.</p>
          <Button variant="outline" className="mt-sm" onClick={() => q.refetch()}>
            Try again
          </Button>
        </div>
      )}

      {q.data && (
        <>
          {!q.data.optedIn && (
            <p className="mt-md m-0 rounded-tile bg-card p-sm text-[14px] font-semibold shadow-toy-soft">
              You are hidden from the leaderboard. Turn it on under{' '}
              <Link to="/you" className="underline underline-offset-4">
                You
              </Link>
              .
            </p>
          )}
          {q.data.entries.length === 0 ? (
            <div className="mt-md rounded-card border-2 border-dashed border-line p-md text-center">
              <p className="m-0 font-bold">Nobody on the board yet.</p>
              <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Set up an area and tick a task. You will be first.</p>
            </div>
          ) : (
            <ol className="mt-md flex list-none flex-col gap-xs p-0 m-0">
              {q.data.entries.map((e) => (
                <Entry key={e.userId} e={e} stat={sort.stat(e)} />
              ))}
            </ol>
          )}
          {q.data.me && q.data.me.rank > q.data.entries.length && (
            <div className="mt-md">
              <p className="m-0 text-[14px] font-bold text-ink-soft">Your spot</p>
              <ol className="mt-xs list-none p-0 m-0">
                <Entry e={q.data.me} stat={sort.stat(q.data.me)} />
              </ol>
            </div>
          )}
        </>
      )}
    </Screen>
  );
}
