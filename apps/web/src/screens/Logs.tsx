import { formatCount, RELATIONSHIP_BY_KEY } from '@kreators/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Button } from '../components/Button';
import { StatTile } from '../components/Charts';
import { Pager, usePage } from '../components/Pager';
import { PageHeader } from '../components/PageHeader';
import { Screen } from '../components/Screen';
import { Toggle } from '../components/Toggle';
import { api } from '../lib/api';
import { useMe } from '../lib/queries';
import { useSession } from '../lib/store';
import { useParamState } from '../lib/useParamState';
import { FIELD_FILTER } from '../lib/ui';
import { ErrorLine } from '../components/ErrorLine';
import { clockSeconds, shortDate } from '../lib/date';

const LEVELS: [string, string][] = [
  ['', 'Every line'],
  ['error', 'Errors'],
  ['warn', 'Refused'],
  ['info', 'Changes'],
];
const LEVEL_ITEMS = LEVELS.map(([key, label]) => ({ key, label }));
const TONE = { error: RELATIONSHIP_BY_KEY.servant_leader.color, warn: RELATIONSHIP_BY_KEY.friendship.color, info: RELATIONSHIP_BY_KEY.self.color } as const;
const WORD = { error: 'Error', warn: 'Refused', info: 'Change' } as const;
const clock = (iso: string) => `${shortDate(iso)}, ${clockSeconds(iso)}`;

/**
 * The app's own log, as data: what happened, where, by whom and how it went, newest first. For super admins, because it names people.
 * Never a request body, and nothing from the journal, wellbeing, Companion, Discover or the assistant but a bare server-error line.
 */
export function Logs() {
  const me = useMe();
  const isAdmin = me.data?.user.role === 'admin';
  const pg = usePage();
  const [level, setLevel] = useParamState('level', '');
  const [area, setArea] = useParamState('area', '');
  const [actor, setActor] = useParamState('actor', '');
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [live, setLive] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => {
      setQ(text.trim());
      pg.reset();
    }, 250);
    return () => window.clearTimeout(t);
  }, [text]); // eslint-disable-line react-hooks/exhaustive-deps
  const params = new URLSearchParams({ ...(level ? { level } : {}), ...(area ? { area } : {}), ...(actor ? { actor } : {}), ...(q ? { q } : {}) }).toString();
  const token = useSession((s) => s.token);
  // Keep the lines on screen while a new answer loads (2026-11-09). Before, the whole block left, so a field lost the keyboard and a new
  // page went to the top.
  const d = useQuery({ queryKey: ['logs', params, pg.query], queryFn: () => api.appLogs(params, pg.query), enabled: Boolean(token) && isAdmin, placeholderData: keepPreviousData });
  // Live: look again every fifteen seconds while the page is open.
  useEffect(() => {
    if (!live) return;
    const t = window.setInterval(() => void d.refetch(), 15_000);
    return () => window.clearInterval(t);
  }, [live]); // eslint-disable-line react-hooks/exhaustive-deps
  const data = d.data;

  return (
    <Screen howTo={false}>
      <PageHeader back={{ to: '/internal/observability', label: 'Dev Tools' }} eyebrow="Operations" title="Logs" lede="What is happening, where and by whom. Changes, refused requests and errors. Lines are kept for thirty days." />

      {!isAdmin && me.data && (
        <ErrorLine e="Only a super admin reads the logs. The lines name people." className="mt-md" />
      )}
      {isAdmin && d.isPending && (
        <p className="mt-md m-0 text-subhead text-ink-soft" role="status">
          Reading the log
        </p>
      )}
      {d.isError && (
        <ErrorLine e="Could not load the logs. Try again in a moment." className="mt-md" />
      )}

      {data && (
        <>
          <div className="mt-md grid grid-cols-3 gap-xs">
            <StatTile label="Errors" value={formatCount(data.last24h.error)} hint="last 24 hours, tap to see them" onClick={() => { setLevel(level === 'error' ? '' : 'error'); pg.reset(); }} pressed={level === 'error'} />
            <StatTile label="Refused" value={formatCount(data.last24h.warn)} hint="last 24 hours, tap to see them" onClick={() => { setLevel(level === 'warn' ? '' : 'warn'); pg.reset(); }} pressed={level === 'warn'} />
            <StatTile label="Changes" value={formatCount(data.last24h.info)} hint="last 24 hours, tap to see them" onClick={() => { setLevel(level === 'info' ? '' : 'info'); pg.reset(); }} pressed={level === 'info'} />
          </div>

          <p className="mt-md m-0 text-subhead text-ink-soft">Newest first. Pick a kind or a person. Tap a name to see only that person. Tap Look now for new lines.</p>
          <div className="mt-sm grid grid-cols-1 gap-xs md:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
            <label className="block">
              <span className="sr-only">Search the log by path, message or name</span>
              <input type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder="Search a path, message or name" autoComplete="off" className={FIELD_FILTER} />
            </label>
            <label className="block">
              <span className="sr-only">Kind of line</span>
              <select
                value={level}
                onChange={(e) => {
                  setLevel(e.target.value);
                  pg.reset();
                }}
                className={FIELD_FILTER}
              >
                {LEVEL_ITEMS.map((l) => (
                  <option key={l.key} value={l.key}>
                    {l.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="sr-only">Person</span>
              <select value={actor} onChange={(e) => { setActor(e.target.value); pg.reset(); }} className={FIELD_FILTER}>
                <option value="">Everyone</option>
                {data.actors.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.count})
                  </option>
                ))}
                {actor && !data.actors.some((a) => a.id === actor) && <option value={actor}>This person</option>}
              </select>
            </label>
            <label className="block">
              <span className="sr-only">Area</span>
              <select value={area} onChange={(e) => { setArea(e.target.value); pg.reset(); }} className={FIELD_FILTER}>
                <option value="">Every area</option>
                {data.areas.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {/* The switch at the left and the Look now that belongs with it at the right, on one line (P3). */}
          <div className="mt-sm flex flex-wrap items-end justify-between gap-xs">
            <div className="min-w-0 flex-[1_1_220px]">
              <Toggle compact on={live} onChange={setLive} label="Look again every fifteen seconds" />
            </div>
            <Button size="sm" variant="outline" className="ml-auto" onClick={() => void d.refetch()} disabled={d.isFetching}>
              {d.isFetching ? 'Looking' : 'Look now'}
            </Button>
          </div>

          <p className="mt-sm m-0 text-caption text-ink-mute">{data.logs.length} {data.logs.length === 1 ? 'line' : 'lines'} on this page.</p>
          <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
            {data.logs.length === 0 && <li className="text-subhead text-ink-soft">Nothing matches. Try another filter.</li>}
            {data.logs.map((l) => (
              <li key={l.id} className="rounded-tile bg-card p-sm shadow-toy-soft">
                <div className="flex flex-wrap items-center gap-xs">
                  <span className="rounded-pill px-xs text-caption font-medium text-on-fill" style={{ background: TONE[l.level] }}>
                    {WORD[l.level]}
                  </span>
                  <span className="text-eyebrow uppercase text-ink-soft">{l.area}</span>
                  <span className="ml-auto text-caption text-ink-mute">{clock(l.at)}</span>
                </div>
                <p className="mt-xs m-0 break-all font-mono text-footnote font-semibold">
                  {l.method} {l.path || '(no path kept)'}
                  {l.status ? ` · ${l.status}` : ''}
                  {l.ms ? ` · ${l.ms} ms` : ''}
                </p>
                {l.message && <p className="mt-xs m-0 text-subhead">{l.message}</p>}
                <p className="mt-xs m-0 text-caption text-ink-soft">
                  {l.actorId && l.actorName ? (
                    <>
                      By{' '}
                      <button type="button" onClick={() => { setActor(l.actorId!); pg.reset(); }} className="relative font-bold underline underline-offset-4 before:absolute before:-inset-x-xs before:-inset-y-[15px] before:min-w-[44px] before:content-['']" aria-label={`Show only the lines by ${l.actorName}`}>
                        {l.actorName}
                      </button>
                    </>
                  ) : l.actorName ? (
                    `By ${l.actorName}`
                  ) : l.area === 'cron' ? (
                    'By the schedule'
                  ) : l.area === 'client' ? (
                    'From a browser, no name'
                  ) : (
                    'No person'
                  )}
                </p>
              </li>
            ))}
          </ul>
          <Pager page={data.page} label="lines" />
        </>
      )}
    </Screen>
  );
}
