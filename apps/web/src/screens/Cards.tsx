import { RELATIONSHIP_BY_KEY, gameRewardKey, type CardGameCard } from '@kreators/shared';
import { useMutation } from '@tanstack/react-query';
import { useState, type CSSProperties } from 'react';
import { Link } from 'react-router';
import { Button } from '../components/Button';
import { useCelebrate } from '../components/Celebration';
import { HeroBlobs } from '../components/Hero';
import { LockedButton } from '../components/LockedButton';
import { BackLink } from '../components/PageHeader';
import { Screen } from '../components/Screen';
import { api } from '../lib/api';
import { useCardGames, useRefreshAll } from '../lib/queries';

/** The cover of a game: its colour as a gradient, its emoji, its name, and what it takes to play. */
export function GameCover({ game, className = '' }: { game: CardGameCard; className?: string }) {
  const rel = RELATIONSHIP_BY_KEY[game.accent];
  return (
    <div className={`relative overflow-hidden rounded-card p-md text-on-fill ${className}`} style={{ background: `linear-gradient(135deg, ${rel.color}, color-mix(in oklab, ${rel.color} 72%, var(--fill-shade)))` } as CSSProperties}>
      <HeroBlobs seed={game.key} />
      <span className="relative block text-[40px] leading-none" aria-hidden="true">
        {game.emoji}
      </span>
      <h2 className="relative mt-sm text-[22px] leading-[1.2]">{game.name}</h2>
      <p className="relative mt-xs m-0 text-[14px] font-semibold">{game.tagline}</p>
      <p className="relative mt-xs m-0 text-[12px] font-bold opacity-90">
        {game.decks.length === 1 ? '1 deck' : `${game.decks.length} decks`}, {game.total} cards
      </p>
    </div>
  );
}

export function Cards() {
  const q = useCardGames();
  const refresh = useRefreshAll();
  const celebrate = useCelebrate();
  const [error, setError] = useState<string | null>(null);
  const unlock = useMutation({
    mutationFn: (key: string) => api.redeem(gameRewardKey(key)),
    onSuccess: (r) => {
      refresh();
      setError(null);
      celebrate({ title: `Unlocked. ${r.points} points left`, color: '#FACC15' });
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Could not unlock that.'),
  });
  const data = q.data;
  const mine = data?.games.filter((g) => g.unlocked) ?? [];

  return (
    <Screen>
      <header className="pt-lg">
        <BackLink to="/apps">Apps</BackLink>
        <h1 className="text-[30px]">Games</h1>
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Unlock a game once with points, then play it for good. Shuffle, draw and flip the cards on a table, and drag them around. Nothing is posted to you.</p>
      </header>

      {q.isPending && (
        <p className="mt-md text-[14px] font-bold text-ink-soft" role="status">
          Dealing the games
        </p>
      )}
      {q.isError && (
        <div className="mt-md rounded-card bg-card p-md shadow-toy-soft" role="alert">
          <p className="m-0 font-bold">Could not load the games.</p>
          <Button variant="outline" className="mt-sm" onClick={() => q.refetch()}>
            Try again
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-md m-0 rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
          {error}
        </p>
      )}

      {data && (
        <>
          <p className="mt-md m-0 text-[14px] font-bold text-ink-soft">
            You have {data.points} points and {mine.length} of {data.games.length} games. <Link to="/rewards#games" className="underline underline-offset-4">See them in Rewards</Link>
          </p>
          <ul className="mt-sm grid list-none grid-cols-1 gap-sm p-0 m-0 md:grid-cols-3">
            {data.games.map((g) => {
              const can = data.points >= g.cost;
              return (
                <li key={g.key} className="flex flex-col gap-xs">
                  <GameCover game={g} className="flex-1" />
                  {g.unlocked ? (
                    <Link to={`/cards/${g.key}`} aria-label={`Play ${g.name}`} className="toy inline-flex min-h-[48px] items-center justify-center rounded-pill bg-ink px-md text-[16px] font-bold text-on-ink">
                      Play
                    </Link>
                  ) : g.unlock.ok ? (
                    <Button
                      disabled={unlock.isPending}
                      aria-label={`Unlock ${g.name} for ${g.cost} points`}
                      onClick={() => {
                        if (window.confirm(`Unlock ${g.name} for ${g.cost} points? It is yours for good.`)) unlock.mutate(g.key);
                      }}
                    >
                      Unlock for {g.cost} pts
                    </Button>
                  ) : (
                    <LockedButton unlock={g.unlock} />
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Screen>
  );
}
