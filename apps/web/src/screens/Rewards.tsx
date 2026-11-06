import { CARD_GAME_BY_KEY, RELATIONSHIP_BY_KEY, formatCount, POINTS, REWARD_BY_KEY, REWARD_GROUPS } from '@kreators/shared';
import { useMutation } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Button } from '../components/Button';
import { useWide } from '../lib/useWide';
import { Nudge } from '../components/Nudge';
import { useCelebrate } from '../components/Celebration';
import { BackLink } from '../components/PageHeader';
import { Screen } from '../components/Screen';
import { api } from '../lib/api';
import { tie } from '../lib/text';
import { useCardGames, useRefreshAll, useRewards } from '../lib/queries';
import { LockedButton } from '../components/LockedButton';
import { ConfirmSpend } from '../components/ConfirmSpend';
import { ConfirmDelete } from '../components/ConfirmDelete';
import { AppIcon } from '../components/AppIcon';
import { RollNumber } from '../components/fx/RollNumber';
import { SkeletonList } from '../components/Skeleton';
import { GameTile } from './Cards';
import { Pager, usePage } from '../components/Pager';
import { fillVar } from '../lib/relFill';

export function Rewards() {
  // Reservations come a page at a time (prefix `r`), like every other list.
  const rp = usePage('r');
  const q = useRewards(rp.query);
  const wide = useWide();
  const gamesQ = useCardGames();
  const refresh = useRefreshAll();
  const celebrate = useCelebrate();
  const [error, setError] = useState<string | null>(null);
  // The reward waiting on the confirm sheet: a game unlocks for good, gear is a reservation until a drop ships.
  const [asking, setAsking] = useState<{ key: string; name: string; cost: number; game: boolean } | null>(null);

  const redeem = useMutation({
    mutationFn: (key: string) => api.redeem(key),
    onSuccess: (r) => {
      refresh();
      setError(null);
      celebrate({ title: r.game ? `Unlocked. ${formatCount(r.points)} points left` : `Reserved. ${formatCount(r.points)} points left`, color: 'var(--color-r3)' });
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Could not reserve that.'),
  });
  const [askingCancel, setAskingCancel] = useState<{ id: string; name: string; points: number } | null>(null);
  const cancel = useMutation({
    mutationFn: (id: string) => api.cancelRedemption(id),
    onSuccess: () => {
      setAskingCancel(null);
      refresh();
      setError(null);
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Could not cancel that.'),
  });

  const data = q.data;
  const gameByKey = useMemo(() => new Map((gamesQ.data?.games ?? []).map((g) => [g.key, g])), [gamesQ.data]);

  return (
    <Screen>
      <header className="pt-lg">
        <BackLink to="/you">Profile</BackLink>
        <h1 className="text-large-title">Rewards</h1>
      </header>

      {q.isPending && <SkeletonList className="mt-md" count={4} lines={2} label="Opening the shop" />}
      {q.isError && (
        <div className="mt-md rounded-card bg-card p-md shadow-toy-soft flex flex-wrap-reverse items-center justify-between gap-sm" role="alert">
          <p className="m-0 font-semibold min-w-0 flex-1 basis-[60%]">Could not load rewards.</p>
          <Button variant="outline" onClick={() => q.refetch()}>
            Try again
          </Button>
        </div>
      )}

      {data && (
        <>
          <section className="mt-md rounded-card bg-ink p-md text-on-ink shadow-toy" aria-labelledby="balance-heading">
            <h2 id="balance-heading" className="text-subhead text-on-ink/70">
              Your balance
            </h2>
            <p className="m-0 text-large-title type-figure leading-none">
              <RollNumber value={data.points} /> <span className="text-headline">points</span>
            </p>
            <p className="mt-xs m-0 text-subhead text-on-ink/80">
              Check in daily for {POINTS.checkin}. Every {POINTS.streakBonusEvery}th day in a row pays {POINTS.streakBonus} extra.
            </p>
          </section>
          <Nudge className="mt-sm" text="A like on your post pays 1 point, and a new follower 2." />
          <p className="mt-md m-0 text-subhead text-ink-soft">
            Gear is a reservation until the first drop ships, and cancelling gives the points back. A card game opens at once, for good.
          </p>
          {error && (
            <p role="alert" className="mt-md m-0 rounded-tile bg-r1/15 p-sm text-subhead">
              {error}
            </p>
          )}

          {/* What this person already reserved or unlocked comes before the catalogue, so it is not thousands of pixels down on a phone. */}
          {(data.redemptions.length > 0 || rp.page > 1) && (
            <section className="mt-lg" aria-labelledby="mine-heading">
              <h2 id="mine-heading" className="text-title2">
                Your reservations
              </h2>
              <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
                {data.redemptions.map((x) => {
                  const r = REWARD_BY_KEY[x.rewardKey];
                  return (
                    <li key={x.id} className="flex items-center gap-sm rounded-tile bg-card p-sm shadow-toy-soft">
                      <span className="min-w-0 flex-1">
                        <span className="block text-balance text-card-title">{tie(r?.name ?? x.rewardKey)}</span>
                        <span className="block text-card-note text-ink-soft">
                          {formatCount(x.points)} points, {r?.kind === 'unlock' ? 'unlocked' : x.status}
                          {/* A game's row already says unlocked; its stored note is the same word, so it is not said twice. */}
                          {x.note && r?.kind !== 'unlock' ? `. ${x.note}` : ''}
                        </span>
                      </span>
                      {x.status === 'reserved' && (
                        <Button variant="ghost" onClick={() => setAskingCancel({ id: x.id, name: r?.name ?? x.rewardKey, points: x.points })} disabled={cancel.isPending}>
                          Cancel
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
              <Pager page={data.redemptionsPage} prefix="r" label="reservations" />
            </section>
          )}

          <section className="mt-lg" aria-labelledby="catalog-heading">
            <h2 id="catalog-heading" className="text-title2">
              Catalog
            </h2>
            {REWARD_GROUPS.map((g) => {
              const list = data.rewards.filter((r) => r.group === g.key);
              if (list.length === 0) return null;
              return (
                <div key={g.key} id={g.key} className="mt-md">
                  <h3 className="text-headline">
                    <span className="inline-flex items-center gap-xs">
                      <AppIcon name={g.icon} size={20} />
                      {g.name}
                    </span>
                  </h3>
                  <p className="mt-xs m-0 text-subhead text-ink-soft">{g.blurb}</p>
                  <ul className={g.key === 'games' ? 'mt-sm grid list-none grid-cols-1 gap-sm p-0 m-0 lg:grid-cols-3' : 'mt-sm flex list-none flex-col gap-xs p-0 m-0'}>
                    {list.map((r) => {
                      const can = data.points >= r.cost;
                      const tile = g.key === 'games';
                      const card = r.game ? gameByKey.get(r.game) : undefined;
                      // A game on this shelf is drawn as the Games page draws it: its cover, then Play, Unlock or the lock under it.
                      if (tile && card) {
                        // `card.unlocked` is the server's answer (a super admin plays every game), not only what was redeemed.
                        return <GameTile key={r.key} game={card} busy={redeem.isPending} onUnlock={(x) => setAsking({ key: r.key, name: x.name, cost: x.cost, game: true })} />;
                      }
                      return (
                        <li key={r.key} data-pillar={r.game ? CARD_GAME_BY_KEY[r.game]?.accent : r.kind === 'event' ? 'divine' : 'parent_child'} className={tile ? 'flex flex-col items-stretch gap-sm rounded-tile bg-card p-sm shadow-toy-soft' : 'flex flex-wrap items-center gap-sm rounded-tile bg-card p-sm shadow-toy-soft sm:flex-nowrap'}>
                          <span className="flex size-[44px] shrink-0 items-center justify-center rounded-pill text-[24px]" style={{ background: r.game && CARD_GAME_BY_KEY[r.game] ? `color-mix(in oklab, ${fillVar(RELATIONSHIP_BY_KEY[CARD_GAME_BY_KEY[r.game]!.accent])} 22%, transparent)` : r.kind === 'event' ? 'var(--tint-purple)' : 'var(--tint-yellow)' }} aria-hidden="true">
                            {r.emoji}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-balance text-card-title">{tie(r.name)}</span>
                            {/* On a phone the name, the price and what is still to go are enough; the line about the item shows from the `md` width up (`useWide`). */}
                            <span className="block text-card-note text-ink-soft">
                              {wide && `${r.blurb} `}
                              {can ? '' : `${formatCount(r.cost - data.points)} more points to go.`}
                            </span>
                            {r.link && (
                              <a href={r.link} target="_blank" rel="noreferrer" className="text-subhead font-semibold underline underline-offset-4">
                                Read more
                              </a>
                            )}
                          </span>
                          {r.game && data.games.includes(r.game) ? (
                            <Link to={`/cards/${r.game}`} className={`toy inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-pill bg-card-strong px-md text-subhead text-ink ${tile ? 'w-full' : ''}`}>
                              Play
                            </Link>
                          ) : r.game && gamesQ.data?.games.find((x) => x.key === r.game && !x.unlock.ok) ? (
                            <LockedButton unlock={gamesQ.data.games.find((x) => x.key === r.game)!.unlock} full={false} className="shrink-0" />
                          ) : (
                            // Outline on every row: the one solid action is the confirm sheet's own button.
                            <Button
                              variant="outline"
                              className={tile ? 'w-full shrink-0' : 'w-full shrink-0 sm:w-auto'}
                              disabled={!can || redeem.isPending}
                              aria-label={r.game ? `Unlock ${r.name} for ${formatCount(r.cost)} points` : `Reserve ${r.name} for ${formatCount(r.cost)} points`}
                              onClick={() => setAsking({ key: r.key, name: r.name, cost: r.cost, game: Boolean(r.game) })}
                            >
                              {r.game ? `Unlock ${formatCount(r.cost)} pts` : `Reserve ${formatCount(r.cost)} pts`}
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
        </>
      )}
      <ConfirmSpend
        open={asking !== null}
        onClose={() => setAsking(null)}
        title={asking?.game ? `Unlock ${asking.name}?` : `Reserve ${asking?.name ?? ''}?`}
        body={asking ? (asking.game ? `It costs ${formatCount(asking.cost)} points and is yours for good. It cannot be cancelled.` : `It costs ${formatCount(asking.cost)} points. It stays a reservation until the next drop ships, and you can cancel it until then.`) : ''}
        action={asking?.game ? `Unlock ${formatCount(asking.cost)} pts` : `Reserve ${formatCount(asking?.cost ?? 0)} pts`}
        busy={redeem.isPending}
        onConfirm={() => asking && redeem.mutate(asking.key)}
      />
      <ConfirmDelete
        open={askingCancel !== null}
        title={`Cancel ${askingCancel?.name ?? 'this reservation'}?`}
        body={`Your ${formatCount(askingCancel?.points ?? 0)} points come back and the reservation is gone. To have it again you reserve it again, if it is still there.`}
        yes="Yes, cancel it"
        keep="Keep it"
        pending={cancel.isPending}
        failed={cancel.isError}
        onYes={() => askingCancel && cancel.mutate(askingCancel.id)}
        onClose={() => setAskingCancel(null)}
      />
    </Screen>
  );
}
