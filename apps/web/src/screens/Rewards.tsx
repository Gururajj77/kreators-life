import { POINTS, REWARD_BY_KEY, REWARD_GROUPS } from '@kreators/shared';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { Button } from '../components/Button';
import { Nudge } from '../components/Nudge';
import { useCelebrate } from '../components/Celebration';
import { BackLink } from '../components/PageHeader';
import { Screen } from '../components/Screen';
import { api } from '../lib/api';
import { useCardGames, useRefreshAll, useRewards } from '../lib/queries';
import { LockedButton } from '../components/LockedButton';

export function Rewards() {
  const q = useRewards();
  const gamesQ = useCardGames();
  const refresh = useRefreshAll();
  const celebrate = useCelebrate();
  const [error, setError] = useState<string | null>(null);

  const redeem = useMutation({
    mutationFn: (key: string) => api.redeem(key),
    onSuccess: (r) => {
      refresh();
      setError(null);
      celebrate({ title: r.game ? `Unlocked. ${r.points} points left` : `Reserved. ${r.points} points left`, color: '#FACC15' });
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Could not reserve that.'),
  });
  const cancel = useMutation({
    mutationFn: (id: string) => api.cancelRedemption(id),
    onSuccess: () => {
      refresh();
      setError(null);
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Could not cancel that.'),
  });

  const data = q.data;

  return (
    <Screen>
      <header className="pt-lg">
        <BackLink to="/you">You</BackLink>
        <h1 className="text-[30px]">Rewards</h1>
      </header>

      {q.isPending && (
        <p className="mt-md text-[14px] font-bold text-ink-soft" role="status">
          Opening the shop
        </p>
      )}
      {q.isError && (
        <div className="mt-md rounded-card bg-card p-md shadow-toy-soft" role="alert">
          <p className="m-0 font-bold">Could not load rewards.</p>
          <Button variant="outline" className="mt-sm" onClick={() => q.refetch()}>
            Try again
          </Button>
        </div>
      )}

      {data && (
        <>
          <section className="mt-md rounded-card bg-ink p-md text-on-ink shadow-toy" aria-labelledby="balance-heading">
            <h2 id="balance-heading" className="text-[14px] font-bold text-on-ink/70" style={{ fontFamily: 'var(--font-body)' }}>
              Your balance
            </h2>
            <p className="m-0 font-display text-[36px] font-extrabold leading-none">
              {data.points} <span className="text-[18px]">points</span>
            </p>
            <p className="mt-xs m-0 text-[14px] font-semibold text-on-ink/80">
              Check in daily for {POINTS.checkin}. Every {POINTS.streakBonusEvery}th day in a row pays {POINTS.streakBonus} extra.
            </p>
          </section>
          <Nudge className="mt-sm" text={`A check-in is ${POINTS.checkin} points, every ${POINTS.streakBonusEvery}th day in a row ${POINTS.streakBonus} more, a like on your post 1, a new follower 2.`} />
          <p className="mt-md m-0 text-[14px] font-semibold text-ink-soft">
            Gear is a reservation until the first drop ships; cancel any time and the points come straight back. A card game opens in the app at once and is yours for good.
          </p>
          {error && (
            <p role="alert" className="mt-md m-0 rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
              {error}
            </p>
          )}

          <section className="mt-lg" aria-labelledby="catalog-heading">
            <h2 id="catalog-heading" className="text-[24px]">
              Catalog
            </h2>
            {REWARD_GROUPS.map((g) => {
              const list = data.rewards.filter((r) => r.group === g.key);
              if (list.length === 0) return null;
              return (
                <div key={g.key} id={g.key} className="mt-md">
                  <h3 className="text-[18px]">
                    <span aria-hidden="true">{g.emoji} </span>
                    {g.name}
                  </h3>
                  <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">{g.blurb}</p>
                  <ul className={g.key === 'games' ? 'mt-sm grid list-none grid-cols-1 gap-xs p-0 m-0 md:grid-cols-3' : 'mt-sm flex list-none flex-col gap-xs p-0 m-0'}>
                    {list.map((r) => {
                      const can = data.points >= r.cost;
                      const tile = g.key === 'games';
                      return (
                        <li key={r.key} className={tile ? 'flex flex-col items-stretch gap-sm rounded-tile bg-card p-sm shadow-toy-soft' : 'flex items-center gap-sm rounded-tile bg-card p-sm shadow-toy-soft'}>
                          <span className="flex size-[44px] shrink-0 items-center justify-center rounded-pill text-[24px]" style={{ background: r.kind === 'event' ? 'var(--tint-purple)' : 'var(--tint-yellow)' }} aria-hidden="true">
                            {r.emoji}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[16px] font-bold">{r.name}</span>
                            <span className="block text-[14px] font-semibold text-ink-soft">
                              {r.blurb} {can ? '' : `${r.cost - data.points} more points to go.`}
                            </span>
                            {r.link && (
                              <a href={r.link} target="_blank" rel="noreferrer" className="text-[14px] font-bold underline underline-offset-4">
                                Read more
                              </a>
                            )}
                          </span>
                          {r.game && data.games.includes(r.game) ? (
                            <Link to={`/cards/${r.game}`} className={`toy inline-flex min-h-[48px] shrink-0 items-center justify-center rounded-pill bg-ink px-md text-[16px] font-bold text-on-ink ${tile ? 'w-full' : ''}`}>
                              Play
                            </Link>
                          ) : r.game && gamesQ.data?.games.find((x) => x.key === r.game && !x.unlock.ok) ? (
                            <LockedButton unlock={gamesQ.data.games.find((x) => x.key === r.game)!.unlock} full={false} className="shrink-0" />
                          ) : (
                            <Button
                              variant={can ? 'primary' : 'outline'}
                              className={tile ? 'w-full shrink-0' : 'shrink-0'}
                              disabled={!can || redeem.isPending}
                              aria-label={r.game ? `Unlock ${r.name} for ${r.cost} points` : `Reserve ${r.name} for ${r.cost} points`}
                              onClick={() => {
                                if (window.confirm(r.game ? `Unlock ${r.name} for ${r.cost} points? It is yours for good.` : `Reserve ${r.name} for ${r.cost} points?`)) redeem.mutate(r.key);
                              }}
                            >
                              {r.game ? `Unlock ${r.cost} pts` : `${r.cost} pts`}
                            </Button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </section>

          {data.redemptions.length > 0 && (
            <section className="mt-lg" aria-labelledby="mine-heading">
              <h2 id="mine-heading" className="text-[24px]">
                Your reservations
              </h2>
              <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
                {data.redemptions.map((x) => {
                  const r = REWARD_BY_KEY[x.rewardKey];
                  return (
                    <li key={x.id} className="flex items-center gap-sm rounded-tile bg-card p-sm shadow-toy-soft">
                      <span className="min-w-0 flex-1">
                        <span className="block text-[16px] font-bold">{r?.name ?? x.rewardKey}</span>
                        <span className="block text-[14px] font-semibold text-ink-soft">
                          {x.points} points, {r?.kind === 'unlock' ? 'unlocked' : x.status}
                          {x.note ? `. ${x.note}` : ''}
                        </span>
                      </span>
                      {x.status === 'reserved' && (
                        <Button variant="ghost" onClick={() => cancel.mutate(x.id)} disabled={cancel.isPending}>
                          Cancel
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </>
      )}
    </Screen>
  );
}
