import { RELATIONSHIP_BY_KEY, formatCount, gameRewardKey, type CardGameCard } from '@kreators/shared';
import { useMutation } from '@tanstack/react-query';
import { useState, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Play } from 'lucide-react';
import { Icon } from '../components/Icon';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import { useCelebrate } from '../components/Celebration';
import { FactTag, IconTag } from '../components/FactTag';
import { Hero, HeroBlobs, HeroNumber } from '../components/Hero';
import { LockedButton } from '../components/LockedButton';
import { ConfirmSpend } from '../components/ConfirmSpend';
import { BackLink } from '../components/PageHeader';
import { Screen } from '../components/Screen';
import { Busy, Skeleton } from '../components/Skeleton';
import { StatusTag } from '../components/StatusTag';
import { CountUp } from '../components/fx/CountUp';
import { SpotlightCard } from '../components/fx/SpotlightCard';
import { api } from '../lib/api';
import { useCardGames, useRefreshAll } from '../lib/queries';
import { fillVar } from '../lib/relFill';
import { tie } from '../lib/text';

/** How many decks and cards a game has, in words. */
const countLine = (g: CardGameCard) => `${g.decks.length === 1 ? '1 deck' : `${formatCount(g.decks.length)} decks`}, ${formatCount(g.total)} cards`;

/**
 * The cover of a game, its colour as a gradient: in `tags`, whether it is yours or what it costs at the top left, and its size (decks
 * and cards) at the top right; then its name and line; at the foot its guide at the bottom left and `cta` at the bottom right, when the whole
 * cover is the link.
 */
export function GameCover({ game, tags, cta, className = '' }: { game: CardGameCard; tags?: ReactNode; cta?: ReactNode; className?: string }) {
  const rel = RELATIONSHIP_BY_KEY[game.accent];
  return (
    <div className={`relative flex flex-col overflow-hidden rounded-card p-md text-on-fill ${className}`} style={{ background: `linear-gradient(135deg, ${fillVar(rel)}, color-mix(in oklab, ${fillVar(rel)} 72%, var(--fill-shade)))` } as CSSProperties}>
      <HeroBlobs seed={game.key} />
      <div className="relative flex items-start justify-between gap-xs">
        {tags ? <span className="flex shrink-0 flex-wrap gap-xs">{tags}</span> : <span />}
        <span className="min-w-0 pt-[4px] text-right text-[12px] font-bold opacity-90">{countLine(game)}</span>
      </div>
      <h2 className="relative mt-sm text-balance text-[22px] leading-[1.2]">{tie(game.name)}</h2>
      <p className="relative mt-xs m-0 text-balance text-[14px] font-semibold">{game.tagline}</p>
      <div className="relative mt-auto flex items-end justify-between gap-sm pt-sm">
        <span className="shrink-0" aria-hidden="true">
          <Avatar relationship={game.accent} size={56} decorative />
        </span>
        {cta}
      </div>
    </div>
  );
}

/**
 * One game in a grid (the Games page and the Rewards shelf): a game that is yours is one link, the whole cover, to its table; one that is
 * not keeps its cover with its price on it and an outline Unlock (or the lock) under it, so the grid never holds a solid button.
 */
export function GameTile({ game: g, index, busy, onUnlock }: { game: CardGameCard; index?: number; busy: boolean; onUnlock: (g: CardGameCard) => void }) {
  return (
    <SpotlightCard as="li" index={index} data-pillar={g.accent} className="flex flex-col gap-xs rounded-card">
      {g.unlocked ? (
        // The whole cover opens the game; the Play pill only shows that it does.
        <Link to={`/cards/${g.key}`} aria-label={`Play ${g.name}`} className="toy flex flex-1 rounded-card">
          <GameCover
            game={g}
            className="flex-1"
            tags={<StatusTag tone="good">Yours</StatusTag>}
            cta={
              <span aria-hidden="true" className="game-play inline-flex min-h-[36px] shrink-0 items-center gap-xs rounded-pill bg-card-strong px-md text-[14px] font-semibold text-ink">
                Play
                <Icon icon={Play} size={16} className="game-play-icon" />
              </span>
            }
          />
        </Link>
      ) : (
        <>
          <GameCover
            game={g}
            className="flex-1"
            tags={
              <>
                {!g.unlock.ok && (
                  <IconTag tone="neutral" icon="Lock">
                    Locked
                  </IconTag>
                )}
                <FactTag kind="price">{`${formatCount(g.cost)} points`}</FactTag>
              </>
            }
          />
          {g.unlock.ok ? (
            <Button variant="outline" disabled={busy} aria-label={`Unlock ${g.name} for ${formatCount(g.cost)} points`} onClick={() => onUnlock(g)}>
              Unlock {formatCount(g.cost)} pts
            </Button>
          ) : (
            <LockedButton unlock={g.unlock} />
          )}
        </>
      )}
    </SpotlightCard>
  );
}

export function Cards() {
  const q = useCardGames();
  const refresh = useRefreshAll();
  const celebrate = useCelebrate();
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState<CardGameCard | null>(null);
  const unlock = useMutation({
    mutationFn: (key: string) => api.redeem(gameRewardKey(key)),
    onSuccess: (r) => {
      refresh();
      setError(null);
      celebrate({ title: `Unlocked. ${formatCount(r.points)} points left`, color: 'var(--color-r3)' });
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Could not unlock that.'),
  });
  const data = q.data;
  const mine = data?.games.filter((g) => g.unlocked) ?? [];

  return (
    <Screen>
      {/* The hero rule: this screen has a number about the person (points to spend, games yours), so it opens with the Hero below and a
          plain header like Life, never a cover card as well. */}
      <header className="pt-lg">
        <BackLink to="/apps">Apps</BackLink>
        <h1 className="text-[30px]">Games</h1>
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Unlock a game once with points, then play it for good.</p>
      </header>

      {q.isPending && (
        <Busy label="Dealing the games">
          <Skeleton className="mt-md h-[160px] w-full rounded-card" />
          <div className="mt-sm grid grid-cols-1 gap-sm lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-[188px] w-full rounded-card" />
            ))}
          </div>
        </Busy>
      )}
      {q.isError && (
        <div className="mt-md rounded-card bg-card p-md shadow-toy-soft flex flex-wrap-reverse items-center justify-between gap-sm" role="alert">
          <p className="m-0 font-bold min-w-0 flex-1 basis-[60%]">Could not load the games.</p>
          <Button variant="outline" onClick={() => q.refetch()}>
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
          <Hero color="var(--color-r2)" deep="var(--deep-friendship)" character="friendship" mood={mine.length ? 'excited' : 'happy'} className="mt-md">
            <div className="flex flex-wrap gap-x-lg gap-y-sm">
              <HeroNumber value={<CountUp value={data.points} format={formatCount} />} label="points to spend" />
              <HeroNumber value={mine.length} unit={`of ${data.games.length}`} label="games yours" />
            </div>
          </Hero>
          <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">
            <Link to="/rewards#games" className="inline-flex min-h-[44px] items-center underline underline-offset-4">
              See them in Rewards
            </Link>
          </p>
          <ul className="mt-sm grid list-none grid-cols-1 gap-sm p-0 m-0 lg:grid-cols-3">
            {data.games.map((g, i) => (
              <GameTile key={g.key} game={g} index={i} busy={unlock.isPending} onUnlock={setAsking} />
            ))}
          </ul>
        </>
      )}
      <ConfirmSpend
        open={asking !== null}
        onClose={() => setAsking(null)}
        title={`Unlock ${asking?.name ?? ''}?`}
        body={asking ? `It costs ${formatCount(asking.cost)} points and is yours for good. It cannot be cancelled.` : ''}
        action={`Unlock ${formatCount(asking?.cost ?? 0)} pts`}
        busy={unlock.isPending}
        onConfirm={() => asking && unlock.mutate(asking.key)}
      />
    </Screen>
  );
}
