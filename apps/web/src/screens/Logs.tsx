import { RELATIONSHIP_BY_KEY } from '@kreators/shared';
import { useEffect, useState } from 'react';
import { Button } from '../components/Button';
import { StatTile } from '../components/Charts';
import { Pager, usePage } from '../components/Pager';
import { PageHeader } from '../components/PageHeader';
import { Screen } from '../components/Screen';
import { Toggle } from '../components/Toggle';
import { api } from '../lib/api';
import { useAuthed, useMe } from '../lib/queries';
import { useParamState } from '../lib/useParamState';

const field = 'w-full rounded-tile border-2 border-line bg-card px-sm py-sm text-[16px] font-semibold';
const LEVELS: [string, string][] = [
  ['', 'All'],
  ['error', 'Errors'],
  ['warn', 'Refused'],
  ['info', 'Changes'],
];
const TONE = { error: RELATIONSHIP_BY_KEY.servant_leader.color, warn: RELATIONSHIP_BY_KEY.friendship.color, info: RELATIONSHIP_BY_KEY.self.color } as const;
const WORD = { error: 'Error', warn: 'Refused', info: 'Change' } as const;
const clock = (iso: string) => new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit' });

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
  const d = useAuthed(['logs', params, pg.query], () => api.appLogs(params, pg.query), isAdmin);
  // Live: look again every fifteen seconds while the page is open.
  useEffect(() => {
    if (!live) return;
    const t = window.setInterval(() => void d.refetch(), 15_000);
    return () => window.clearInterval(t);
  }, [live]); // eslint-disable-line react-hooks/exhaustive-deps
  const data = d.data;

  return (
    <Screen howTo={false}>
      <PageHeader back={{ to: '/internal/observability', label: 'Observability' }} eyebrow="Operations" title="Logs" lede="What is happening, where and by whom. Changes, refused requests and errors. Lines are kept for thirty days." />

      {!isAdmin && me.data && (
        <p role="alert" className="mt-md m-0 rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
          Only a super admin reads the logs. The lines name people.
        </p>
      )}
      {isAdmin && d.isPending && (
        <p className="mt-md m-0 text-[14px] font-bold text-ink-soft" role="status">
          Reading the log
        </p>
      )}
      {d.isError && (
        <p role="alert" className="mt-md m-0 rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
          Could not load the logs. Try again in a moment.
        </p>
      )}

      {data && (
        <>
          <div className="mt-md grid grid-cols-3 gap-xs">
            <StatTile label="Errors" value={data.last24h.error} hint="last 24 hours" />
            <StatTile label="Refused" value={data.last24h.warn} hint="last 24 hours" />
            <StatTile label="Changes" value={data.last24h.info} hint="last 24 hours" />
          </div>

          <p className="mt-md m-0 text-[14px] font-semibold text-ink-soft">Newest first. Pick a kind or a person. Tap a name to see only that person. Tap Look now for new lines.</p>
          <div className="scroll-row mt-sm flex gap-xs" role="group" aria-label="Kind of line">
            {LEVELS.map(([k, label]) => (
              <button key={k || 'all'} type="button" aria-pressed={level === k} onClick={() => { setLevel(k); pg.reset(); }} className={`toy min-h-[44px] shrink-0 rounded-pill border-2 px-md text-[14px] font-bold ${level === k ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}>
                {label}
              </button>
            ))}
          </div>
          <div className="mt-sm grid grid-cols-1 gap-xs md:grid-cols-[1fr_220px_220px]">
            <label className="block">
              <span className="sr-only">Search the log by path, message or name</span>
              <input type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder="Search a path, a message or a name" autoComplete="off" className={field} />
            </label>
            <label className="block">
              <span className="sr-only">Person</span>
              <select value={actor} onChange={(e) => { setActor(e.target.value); pg.reset(); }} className={field}>
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
              <select value={area} onChange={(e) => { setArea(e.target.value); pg.reset(); }} className={field}>
                <option value="">Every area</option>
                {data.areas.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-sm flex flex-wrap items-center gap-xs">
            <Toggle compact on={live} onChange={setLive} label="Look again every fifteen seconds" />
            <Button size="sm" variant="outline" onClick={() => void d.refetch()} disabled={d.isFetching}>
              {d.isFetching ? 'Looking' : 'Look now'}
            </Button>
          </div>

          <p className="mt-sm m-0 text-[12px] font-bold text-ink-mute">{data.logs.length} {data.logs.length === 1 ? 'line' : 'lines'} on this page.</p>
          <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
            {data.logs.length === 0 && <li className="text-[14px] font-semibold text-ink-soft">Nothing matches. Try another filter.</li>}
            {data.logs.map((l) => (
              <li key={l.id} className="rounded-tile bg-card p-sm shadow-toy-soft">
                <div className="flex flex-wrap items-center gap-xs">
                  <span className="rounded-pill px-xs text-[12px] font-extrabold text-on-fill" style={{ background: TONE[l.level] }}>
                    {WORD[l.level]}
                  </span>
                  <span className="text-[12px] font-extrabold uppercase tracking-wide text-ink-soft">{l.area}</span>
                  <span className="ml-auto text-[12px] font-bold text-ink-mute">{clock(l.at)}</span>
                </div>
                <p className="mt-xs m-0 break-all font-mono text-[13px] font-bold">
                  {l.method} {l.path || '(no path kept)'}
                  {l.status ? ` · ${l.status}` : ''}
                  {l.ms ? ` · ${l.ms} ms` : ''}
                </p>
                {l.message && <p className="mt-xs m-0 text-[14px] font-semibold">{l.message}</p>}
                <p className="mt-xs m-0 text-[12px] font-semibold text-ink-soft">
                  {l.actorId && l.actorName ? (
                    <>
                      By{' '}
                      <button type="button" onClick={() => { setActor(l.actorId!); pg.reset(); }} className="font-extrabold underline underline-offset-4" aria-label={`Show only the lines by ${l.actorName}`}>
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
