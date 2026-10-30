import { IDENTITY_STAGES, LEADERBOARD_POOL, LEADERBOARD_SCOPES, isLeaderboardScope, type LeaderboardBlock, type LeaderboardEntry, type LeaderboardOption, type LeaderboardScope, type LeaderboardSort } from '@kreators/shared';
import { useParamState } from '../lib/useParamState';
import { Link } from 'react-router';
import { Button } from '../components/Button';
import { BackLink } from '../components/PageHeader';
import { Screen } from '../components/Screen';
import { Pager, usePage } from '../components/Pager';
import { StatTile } from '../components/Charts';
import { Section } from '../components/Section';
import { useLeaderboard, useAuthed } from '../lib/queries';
import { api } from '../lib/api';

const SORTS: { key: LeaderboardSort; label: string; stat: (e: LeaderboardEntry) => string }[] = [
  { key: 'xp', label: 'All time', stat: (e) => `${e.xp} xp` },
  { key: 'season', label: 'This month', stat: (e) => `${e.seasonXp} xp` },
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

const SCOPE_NOUN: Record<LeaderboardScope, string> = { all: '', goal: 'goal', pillar: 'pillar', city: 'city', identity: 'tag', level: 'level' };

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`toy min-h-[44px] shrink-0 rounded-pill border-2 px-md text-[14px] font-bold ${on ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}
    >
      {children}
    </button>
  );
}

function BlockCard({ b, onOpen }: { b: LeaderboardBlock; onOpen: () => void }) {
  return (
    <li className="flex flex-col rounded-tile bg-card p-sm shadow-toy-soft">
      <p className="m-0 text-[16px] font-extrabold">
        {b.emoji && <span aria-hidden="true">{b.emoji} </span>}
        {b.label}
      </p>
      <p className="m-0 text-[12px] font-bold text-ink-soft">
        {b.people === 0 ? 'Nobody here yet' : `${b.people}${b.people >= LEADERBOARD_POOL ? '+' : ''} ${b.people === 1 ? 'person' : 'people'}`}
        {b.myRank ? ` · you are #${b.myRank}` : ''}
      </p>
      {b.top.length > 0 && (
        <ol className="mt-xs mb-sm flex list-none flex-col gap-xs p-0 m-0">
          {b.top.map((t) => (
            <li key={t.rank} className="flex items-baseline justify-between gap-xs text-[14px] font-semibold">
              <span className="min-w-0 truncate">
                {t.rank === 1 ? '🥇' : t.rank === 2 ? '🥈' : '🥉'} {t.name}
                {t.isMe ? ' (you)' : ''}
              </span>
              <span className="shrink-0 font-extrabold">{t.xp} xp</span>
            </li>
          ))}
        </ol>
      )}
      <Button variant="outline" size="sm" className="mt-auto" onClick={onOpen}>
        Open this board
      </Button>
    </li>
  );
}

export function Leaderboard() {
  const [byRaw, setBy] = useParamState('by', 'xp');
  const by: LeaderboardSort = SORTS.some((s) => s.key === byRaw) ? (byRaw as LeaderboardSort) : 'xp';
  const [scopeRaw, setScope] = useParamState('scope', 'all');
  const scope: LeaderboardScope = isLeaderboardScope(scopeRaw) ? scopeRaw : 'all';
  const [valueRaw, setValue] = useParamState('value', '');
  const paging = usePage();
  const options = useAuthed(['leaderboard', 'options'], api.leaderboardOptions);
  const blocks = useAuthed(['leaderboard', 'blocks'], api.leaderboardBlocks);
  const choices: LeaderboardOption[] = scope === 'all' ? [] : (options.data?.[scope] ?? []);
  // A board with nobody on it is still listed, but the first pick is one that has people.
  const value = scope === 'all' ? '' : valueRaw || (choices.find((o) => o.count > 0) ?? choices[0])?.value || '';
  const q = useLeaderboard(by, scope, value, paging.query);
  const sort = SORTS.find((s) => s.key === by) ?? SORTS[0]!;
  const pillarBoard = scope === 'pillar';
  const statFor = (e: LeaderboardEntry) => (by === 'xp' && pillarBoard ? `${e.xp} xp here` : sort.stat(e));
  const open = (b: LeaderboardBlock) => {
    setScope(b.scope);
    setValue(b.value);
    paging.reset();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const goalBlocks = (blocks.data?.blocks ?? []).filter((b) => b.scope === 'goal');
  const pillarBlocks = (blocks.data?.blocks ?? []).filter((b) => b.scope === 'pillar');
  const me = q.data?.me ?? null;
  const daysLeft = q.data ? Math.max(0, Math.ceil((new Date(q.data.season.endsAt).getTime() - Date.now()) / 86_400_000)) : null;

  return (
    <Screen>
      <header className="pt-lg">
        <BackLink to="/apps">Apps</BackLink>
        <h1 className="text-[30px]">Leaderboard</h1>
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">
          See where you stand on a board for each goal, pillar, city and more. This month is a season: everyone starts level on the first, and the top three when it ends get the Season top three honor. People appear only after they opt in under Profile. Journal and wellbeing never count.
        </p>
      </header>

      <section className="mt-md" aria-label="Choose a board">
        <p className="m-0 text-[12px] font-extrabold uppercase tracking-wide text-ink-soft">Board</p>
        <div className="scroll-row mt-xs flex gap-xs" role="group" aria-label="Board type">
          {LEADERBOARD_SCOPES.map((s) => (
            <Chip
              key={s.key}
              on={scope === s.key}
              onClick={() => {
                setScope(s.key);
                setValue('');
                paging.reset();
              }}
            >
              {s.label}
            </Chip>
          ))}
        </div>
        {scope !== 'all' && (
          <label className="mt-sm block">
            <span className="block text-[14px] font-bold">Which {SCOPE_NOUN[scope]}</span>
            <select
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                paging.reset();
              }}
              className="mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]"
            >
              {choices.length === 0 && <option value="">{options.isPending ? 'Loading' : 'None yet'}</option>}
              {choices.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.emoji ? `${o.emoji} ` : ''}
                  {o.label} ({o.count})
                </option>
              ))}
            </select>
          </label>
        )}
        <p className="mt-sm m-0 text-[12px] font-bold text-ink-soft">Rank by</p>
        <div className="mt-xs grid grid-cols-2 gap-xs sm:grid-cols-4" role="group" aria-label="Rank by">
          {SORTS.map((s) => (
            <Chip
              key={s.key}
              on={by === s.key}
              onClick={() => {
                setBy(s.key);
                paging.reset();
              }}
            >
              {s.label}
            </Chip>
          ))}
        </div>
      </section>

      {q.isPending && q.fetchStatus !== 'idle' && (
        <p className="mt-md text-[14px] font-bold text-ink-soft" role="status">
          Counting the pillars
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
          <section className="mt-lg" aria-labelledby="lb-now">
            <h2 id="lb-now" className="text-[24px]">
              {q.data.label}
            </h2>
            <div className="mt-sm grid grid-cols-2 gap-xs sm:grid-cols-4">
              <StatTile label="Your spot" value={me ? `#${me.rank}` : '·'} hint={me ? `of ${q.data.people}${q.data.people >= LEADERBOARD_POOL ? '+' : ''}` : q.data.optedIn ? `Not in the top ${LEADERBOARD_POOL} here` : 'You are hidden'} tone="var(--color-card)" />
              <StatTile label={pillarBoard ? 'Your xp here' : 'Your xp'} value={me ? me.xp : '·'} hint={me ? `Level ${me.level}` : undefined} />
              <StatTile label="On this board" value={q.data.people} hint={q.data.people >= LEADERBOARD_POOL ? 'Top of many' : q.data.people === 1 ? 'person' : 'people'} />
              <StatTile label="Season ends" value={daysLeft === null ? '·' : `${daysLeft}d`} hint={q.data.season.label} />
            </div>
            {!q.data.optedIn && (
              <p className="mt-sm m-0 rounded-tile bg-card p-sm text-[14px] font-semibold shadow-toy-soft">
                You are hidden from every board. Turn it on under{' '}
                <Link to="/you" className="underline underline-offset-4">
                  Profile
                </Link>
                .
              </p>
            )}
            {q.data.entries.length === 0 ? (
              <div className="mt-md rounded-card border-2 border-dashed border-line p-md text-center">
                <p className="m-0 font-bold">Nobody on this board yet.</p>
                <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Set up a pillar and tick a task, then opt in. You will be first.</p>
              </div>
            ) : (
              <ol className="mt-md flex list-none flex-col gap-xs p-0 m-0">
                {q.data.entries.map((e) => (
                  <Entry key={e.userId} e={e} stat={statFor(e)} />
                ))}
              </ol>
            )}
            <Pager page={q.data.page} label="people" />
            {by === 'season' && (
              <p className="mt-sm m-0 text-[14px] font-bold text-ink-soft">
                {q.data.season.label}, ends {new Date(q.data.season.endsAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}.
              </p>
            )}
          </section>

          {goalBlocks.some((b) => b.people > 0) && (
            <Section id="lb-goals" title="Boards by goal" lede="What people are working on. Open one to see the whole board.">
              <ul className="grid list-none grid-cols-1 gap-xs p-0 m-0 sm:grid-cols-2">
                {goalBlocks.filter((b) => b.people > 0).map((b) => (
                  <BlockCard key={b.value} b={b} onOpen={() => open(b)} />
                ))}
              </ul>
              {goalBlocks.some((b) => b.people === 0) && <p className="mt-sm m-0 text-[12px] font-bold text-ink-soft">No one yet on: {goalBlocks.filter((b) => b.people === 0).map((b) => b.label).join(', ')}.</p>}
            </Section>
          )}
          {pillarBlocks.some((b) => b.people > 0) && (
            <Section id="lb-pillars" title="Boards by pillar" lede="Ranked by the xp each person earned in that pillar alone.">
              <ul className="grid list-none grid-cols-1 gap-xs p-0 m-0 sm:grid-cols-2">
                {pillarBlocks.filter((b) => b.people > 0).map((b) => (
                  <BlockCard key={b.value} b={b} onOpen={() => open(b)} />
                ))}
              </ul>
            </Section>
          )}
          {q.data.past.length > 0 && (
            <section className="mt-lg" aria-labelledby="seasons-heading">
              <h2 id="seasons-heading" className="text-[24px]">
                Past seasons
              </h2>
              <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
                {q.data.past.map((p) => (
                  <li key={p.season} className="rounded-tile bg-card p-sm shadow-toy-soft">
                    <p className="m-0 text-[14px] font-extrabold">{p.label}</p>
                    <p className="m-0 text-[14px] font-semibold text-ink-soft">
                      {p.top.map((t) => `${t.place === 1 ? '🥇' : t.place === 2 ? '🥈' : '🥉'} ${t.name}${t.isMe ? ' (you)' : ''}, ${t.xp} xp`).join(' · ')}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </Screen>
  );
}
