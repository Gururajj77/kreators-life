import { IDENTITY_STAGES, LEADERBOARD_POOL, LEADERBOARD_SCOPES, isLeaderboardScope, type LeaderboardBlock, type LeaderboardEntry, type LeaderboardOption, type LeaderboardScope, type LeaderboardSort, LOCALE, formatCount } from '@kreators/shared';
import { useSearchParams } from 'react-router';
import { Link } from 'react-router';
import { Button } from '../components/Button';
import { AppCover } from '../components/AppCover';
import { Screen } from '../components/Screen';
import { Pager, usePage } from '../components/Pager';
import { StatTile } from '../components/Charts';
import { Section } from '../components/Section';
import { Fold } from '../components/Fold';
import { useLeaderboard, useAuthed, useMe } from '../lib/queries';
import { bento } from '../lib/bento';
import { api } from '../lib/api';
import { Medal } from 'lucide-react';
import { AppIcon } from '../components/AppIcon';
import { Icon } from '../components/Icon';
import { IconTag } from '../components/FactTag';
import { FilterBar, FilterSelect } from '../components/FilterSelect';

const SORTS: { key: LeaderboardSort; label: string; stat: (e: LeaderboardEntry) => string }[] = [
  { key: 'xp', label: 'All time', stat: (e) => `${formatCount(e.xp)} xp` },
  { key: 'season', label: 'This month', stat: (e) => `${formatCount(e.seasonXp)} xp` },
  { key: 'streak', label: 'Streak', stat: (e) => `${e.streak} ${e.streak === 1 ? 'day' : 'days'}` },
  { key: 'badges', label: 'Badges', stat: (e) => `${e.badgeCount} ${e.badgeCount === 1 ? 'badge' : 'badges'}` },
];

const PLACE_TONE = ['var(--badge-gold-b)', 'var(--badge-silver-b)', 'var(--badge-bronze-b)'] as const;
const PLACE_WORD = ['1st', '2nd', '3rd'] as const;

/** The mark for places one to three: a medal in gold, silver or bronze. Places past three have none. */
function PlaceMark({ place, size = 16 }: { place: number; size?: number }) {
  const tone = PLACE_TONE[place - 1];
  if (!tone) return null;
  return (
    <span style={{ color: tone }} className="inline-flex align-[-3px]">
      <Icon icon={Medal} size={size} />
    </span>
  );
}

/** Places one to three in words, for lines of text where an icon cannot sit. */
const placeWord = (place: number) => PLACE_WORD[place - 1] ?? `#${place}`;

function Entry({ e, stat }: { e: LeaderboardEntry; stat: string }) {
  const stage = IDENTITY_STAGES.find((s) => s.stage === e.stage);
  const medal = e.rank <= 3 ? <PlaceMark place={e.rank} size={20} /> : null;
  return (
    <li className={`flex items-center gap-sm rounded-tile p-sm shadow-toy-soft ${e.isMe ? 'bg-ink text-on-ink' : 'bg-card'}`}>
      <span
        className="flex size-[36px] shrink-0 items-center justify-center rounded-pill bg-paper text-subhead font-medium text-ink"
        role="img"
        aria-label={`Rank ${e.rank}`}
      >
        {medal ?? e.rank}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-xs">
          <span className="truncate text-headline">
            {e.name}
            {e.isMe ? ' (you)' : ''}
          </span>
          {e.isPro && <IconTag tone="deep" icon="Crown">Pro</IconTag>}
        </span>
        <span className={`block text-subhead ${e.isMe ? 'text-on-ink/80' : 'text-ink-soft'}`}>
          {stage?.name ?? 'Seed'}, level {e.level}
        </span>
      </span>
      <span className="shrink-0 text-subhead font-semibold">{stat}</span>
    </li>
  );
}

/** The label of the second dropdown, short enough for the 76px label column on a phone. */
const SCOPE_LABEL: Record<LeaderboardScope, string> = { all: '', goal: 'Goal', pillar: 'Pillar', city: 'City', identity: 'Tag', level: 'Level' };

function BlockCard({ b, onOpen, className = '' }: { b: LeaderboardBlock; onOpen: () => void; className?: string }) {
  return (
    <li className={`flex flex-col rounded-tile bg-card p-sm shadow-toy-soft ${className}`}>
      <p className="m-0 text-card-title">
        {b.icon && <AppIcon name={b.icon} size={16} className="mr-xs inline-block align-[-2px] text-ink-soft" />}
        {b.label}
      </p>
      <p className="m-0 text-card-note text-ink-soft">
        {b.people === 0 ? 'Nobody here yet' : `${b.people}${b.people >= LEADERBOARD_POOL ? '+' : ''} ${b.people === 1 ? 'person' : 'people'}`}
        {b.myRank ? ` · you are #${b.myRank}` : ''}
      </p>
      {b.top.length > 0 && (
        <ol className="mt-xs mb-sm flex list-none flex-col gap-xs p-0 m-0">
          {b.top.map((t) => (
            <li key={t.rank} className="flex items-baseline justify-between gap-xs text-subhead">
              <span className="min-w-0 truncate">
                <PlaceMark place={t.rank} /> {t.name}
                {t.isMe ? ' (you)' : ''}
              </span>
              <span className="shrink-0 font-bold">{formatCount(t.xp)} xp</span>
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
  // One update for everything a click changes. Several separate URL updates in a row each start from the old address, so the last one would undo the others.
  const [params, setParams] = useSearchParams();
  const patch = (changes: Record<string, string>) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries({ page: '', ...changes })) {
          if (v === '' || (k === 'by' && v === 'xp') || (k === 'scope' && v === 'all')) next.delete(k);
          else next.set(k, v);
        }
        return next;
      },
      { replace: true, preventScrollReset: true },
    );
  const byRaw = params.get('by') ?? 'xp';
  const by: LeaderboardSort = SORTS.some((s) => s.key === byRaw) ? (byRaw as LeaderboardSort) : 'xp';
  const scopeRaw = params.get('scope') ?? 'all';
  const scope: LeaderboardScope = isLeaderboardScope(scopeRaw) ? scopeRaw : 'all';
  const valueRaw = params.get('value') ?? '';
  const paging = usePage();
  const options = useAuthed(['leaderboard', 'options'], api.leaderboardOptions);
  const blocks = useAuthed(['leaderboard', 'blocks'], api.leaderboardBlocks);
  const choices: LeaderboardOption[] = scope === 'all' ? [] : (options.data?.[scope] ?? []);
  // A board with nobody on it is still listed, but the first pick is one that has people.
  // The city board opens on the person's own city when it is on the list (Profile already knows it), else the first that has people.
  const myCity = (useMe().data?.user.city ?? '').trim().toLowerCase();
  const own = scope === 'city' && myCity ? choices.find((o) => o.value.toLowerCase() === myCity) : undefined;
  const value = scope === 'all' ? '' : valueRaw || own?.value || (choices.find((o) => o.count > 0) ?? choices[0])?.value || '';
  const q = useLeaderboard(by, scope, value, paging.query);
  const sort = SORTS.find((s) => s.key === by) ?? SORTS[0]!;
  const pillarBoard = scope === 'pillar';
  const statFor = (e: LeaderboardEntry) => (by === 'xp' && pillarBoard ? `${formatCount(e.xp)} xp here` : sort.stat(e));
  const open = (b: LeaderboardBlock) => {
    patch({ scope: b.scope, value: b.value });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const goalBlocks = (blocks.data?.blocks ?? []).filter((b) => b.scope === 'goal');
  const pillarBlocks = (blocks.data?.blocks ?? []).filter((b) => b.scope === 'pillar');
  const me = q.data?.me ?? null;
  const daysLeft = q.data ? Math.max(0, Math.ceil((new Date(q.data.season.endsAt).getTime() - Date.now()) / 86_400_000)) : null;

  return (
    <Screen>
      <AppCover back={{ to: '/apps', label: 'Apps' }} title="Leaderboard" lede="See where you stand by goal, pillar, city and more.">
        <ul className="m-0 flex list-disc flex-col gap-xs pl-md text-caption text-ink-soft">
          <li>Each month is a season, and its top three get the Season top three honor.</li>
          <li>You show only after you opt in under Profile.</li>
          <li>Journal and wellbeing never count.</li>
        </ul>
      </AppCover>

      <section className="mt-md" aria-label="Choose a board">
        {/* Board, which one and rank by each pick one value, so they are dropdowns in one row (one per line on a phone). */}
        <FilterBar label="Board" count={scope === 'all' ? 2 : 3}>
          <FilterSelect label="Board" items={LEADERBOARD_SCOPES} value={scope} onChange={(k) => patch({ scope: k, value: '' })} />
          {scope !== 'all' && (
            <FilterSelect
              label={SCOPE_LABEL[scope]}
              items={choices.length === 0 ? [{ key: '', label: options.isPending ? 'Loading' : 'None yet' }] : choices.map((o) => ({ key: o.value, label: `${o.label} (${o.count})` }))}
              value={value}
              onChange={(v) => patch({ value: v })}
            />
          )}
          <FilterSelect label="Rank by" items={SORTS} value={by} onChange={(k) => patch({ by: k })} />
        </FilterBar>
      </section>

      {q.isPending && q.fetchStatus !== 'idle' && (
        <p className="mt-md text-subhead text-ink-soft" role="status">
          Counting the pillars
        </p>
      )}
      {q.isError && (
        <div className="mt-md flex flex-wrap-reverse items-center justify-between gap-sm rounded-card bg-card p-md shadow-toy-soft" role="alert">
          <p className="m-0 min-w-0 flex-1 basis-[60%] font-semibold">Could not load the leaderboard.</p>
          <Button variant="outline" onClick={() => q.refetch()}>
            Try again
          </Button>
        </div>
      )}

      {q.data && (
        <>
          <section className="mt-lg" aria-labelledby="lb-now">
            <h2 id="lb-now" className="text-title2">
              {q.data.label}
            </h2>
            <div className="mt-sm grid grid-cols-2 gap-xs sm:grid-cols-4">
              <StatTile label="Your spot" value={me ? `#${me.rank}` : '·'} hint={me ? `of ${q.data.people}${q.data.people >= LEADERBOARD_POOL ? '+' : ''}` : q.data.optedIn ? `Not in the top ${LEADERBOARD_POOL} here` : 'You are hidden'} tone="var(--color-card)" />
              <StatTile label={pillarBoard ? 'Your xp here' : 'Your xp'} value={me ? formatCount(me.xp) : '·'} hint={me ? `Level ${me.level}` : undefined} />
              <StatTile label="On this board" value={q.data.people} hint={q.data.people >= LEADERBOARD_POOL ? 'Top of many' : q.data.people === 1 ? 'person' : 'people'} />
              <StatTile label="Season ends" value={daysLeft === null ? '·' : `${daysLeft}d`} hint={q.data.season.label} />
            </div>
            {!q.data.optedIn && (
              <p className="mt-sm m-0 rounded-tile bg-card p-sm text-subhead shadow-toy-soft">
                You are hidden from every board. Turn it on under{' '}
                <Link to="/you" className="underline underline-offset-4">
                  Profile
                </Link>
                .
              </p>
            )}
            {q.data.entries.length === 0 ? (
              <div className="mt-md rounded-card border-2 border-dashed border-line p-md text-center">
                <p className="m-0 font-semibold">Nobody on this board yet.</p>
                <p className="mt-xs m-0 text-subhead text-ink-soft">Set up a pillar and tick a task, then opt in. You will be first.</p>
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
              <p className="mt-sm m-0 text-subhead text-ink-soft">
                {q.data.season.label}, ends {new Date(q.data.season.endsAt).toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' })}.
              </p>
            )}
          </section>

          {goalBlocks.some((b) => b.people > 0) && (
            <Section id="lb-goals" title="Boards by goal" lede="What people are working on. Open one to see the whole board.">
              <ul className="grid list-none grid-cols-1 gap-xs p-0 m-0 md:grid-cols-2">
                {goalBlocks.filter((b) => b.people > 0).map((b, i, arr) => (
                  <BlockCard key={b.value} b={b} onOpen={() => open(b)} className={bento(i, arr.length, 1, 2)} />
                ))}
              </ul>
              {goalBlocks.some((b) => b.people === 0) && (
                <Fold className="mt-sm" title="Boards with no one yet" hint={String(goalBlocks.filter((b) => b.people === 0).length)}>
                  <p className="m-0 text-caption text-ink-soft">{goalBlocks.filter((b) => b.people === 0).map((b) => b.label).join(', ')}.</p>
                </Fold>
              )}
            </Section>
          )}
          {pillarBlocks.some((b) => b.people > 0) && (
            <Section id="lb-pillars" title="Boards by pillar" lede="Ranked by the xp each person earned in that pillar alone.">
              <ul className="grid list-none grid-cols-1 gap-xs p-0 m-0 md:grid-cols-2">
                {pillarBlocks.filter((b) => b.people > 0).map((b, i, arr) => (
                  <BlockCard key={b.value} b={b} onOpen={() => open(b)} className={bento(i, arr.length, 1, 2)} />
                ))}
              </ul>
            </Section>
          )}
          {q.data.past.length > 0 && (
            <section className="mt-lg" aria-labelledby="seasons-heading">
              <h2 id="seasons-heading" className="text-title2">
                Past seasons
              </h2>
              <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
                {q.data.past.map((p) => (
                  <li key={p.season} className="rounded-tile bg-card p-sm shadow-toy-soft">
                    <p className="m-0 text-card-title">{p.label}</p>
                    <p className="m-0 text-card-note text-ink-soft">
                      {p.top.map((t) => `${placeWord(t.place)} ${t.name}${t.isMe ? ' (you)' : ''}, ${formatCount(t.xp)} xp`).join(' · ')}
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
