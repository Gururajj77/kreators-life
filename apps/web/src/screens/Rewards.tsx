import { POINTS, REWARD_BY_KEY } from '@kreators/shared';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { Button } from '../components/Button';
import { useCelebrate } from '../components/Celebration';
import { Screen } from '../components/Screen';
import { api } from '../lib/api';
import { useRefreshAll, useRewards } from '../lib/queries';

export function Rewards() {
  const q = useRewards();
  const refresh = useRefreshAll();
  const celebrate = useCelebrate();
  const [error, setError] = useState<string | null>(null);

  const redeem = useMutation({
    mutationFn: (key: string) => api.redeem(key),
    onSuccess: (r) => {
      refresh();
      setError(null);
      celebrate({ title: `Reserved. ${r.points} points left`, color: '#FACC15' });
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
        <Link to="/you" className="inline-flex min-h-[44px] items-center gap-xs font-bold text-ink-soft">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 5l-7 7 7 7" />
          </svg>
          You
        </Link>
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
            <h2 id="balance-heading" className="text-[14px] font-bold text-white/70" style={{ fontFamily: 'var(--font-body)' }}>
              Your balance
            </h2>
            <p className="m-0 font-display text-[36px] font-extrabold leading-none">
              {data.points} <span className="text-[18px]">points</span>
            </p>
            <p className="mt-xs m-0 text-[14px] font-semibold text-white/80">
              Check in daily for {POINTS.checkin}. Every {POINTS.streakBonusEvery}th day in a row pays {POINTS.streakBonus} extra.
            </p>
          </section>
          <p className="mt-md m-0 text-[14px] font-semibold text-ink-soft">
            Rewards are reservations until the first drop ships. Cancel any time and the points come straight back.
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
            <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
              {data.rewards.map((r) => {
                const can = data.points >= r.cost;
                return (
                  <li key={r.key} className="flex items-center gap-sm rounded-tile bg-card p-sm shadow-toy-soft">
                    <span
                      className="flex size-[44px] shrink-0 items-center justify-center rounded-pill text-[24px]"
                      style={{ background: r.kind === 'event' ? 'var(--tint-purple)' : 'var(--tint-yellow)' }}
                      aria-hidden="true"
                    >
                      {r.kind === 'event' ? '🎟️' : '👕'}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[16px] font-bold">{r.name}</span>
                      <span className="block text-[14px] font-semibold text-ink-soft">
                        {r.blurb} {can ? '' : `${r.cost - data.points} more points to go.`}
                      </span>
                    </span>
                    <Button
                      variant={can ? 'primary' : 'outline'}
                      className="shrink-0"
                      disabled={!can || redeem.isPending}
                      aria-label={`Reserve ${r.name} for ${r.cost} points`}
                      onClick={() => {
                        if (window.confirm(`Reserve ${r.name} for ${r.cost} points?`)) redeem.mutate(r.key);
                      }}
                    >
                      {r.cost} pts
                    </Button>
                  </li>
                );
              })}
            </ul>
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
                          {x.points} points, {x.status}
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
