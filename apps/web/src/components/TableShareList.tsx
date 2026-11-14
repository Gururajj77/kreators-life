import { aiPrivateOnly, coachTableKeys, DATA_TABLE_KEYS, dataTableByKey, knownTableKeys, listTables, type TableListGroup } from '@kreators/shared/dataTables';
import { formatCount } from '@kreators/shared';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAppsOn } from '../lib/modules';
import { Button } from './Button';
import { ErrorLine } from './ErrorLine';
import { TableGroups } from './TableGroups';
import { Toggle } from './Toggle';

/** One save: a single table switched (`{ table, on }`), or the whole list (Share all, Share none). */
export type TableShareOp = { table: string; on: boolean } | { tables: string[] };

/**
 * Every table the person may share as a switch, each off until they turn it on: the one list behind Tables your coach can see (one coach, under
 * Your life coach) and Tables AI chat can read (2026-11-14), both on the Profile tab. Drawn as All tables draws its list (2026-11-14, the founder:
 * "put them in toggles based on categories in every place they occur"): one accordion per app group with "2 of 9 shared" in its pill, each
 * category's switches under its eyebrow (TableGroups). Only tables whose app is on for the person are listed; the coach's list never holds a table
 * with other people's details (`tableReach`), and AI chat's says under each table that only a model that keeps nothing reads it.
 *
 * A switch sends only its own table and on or off, which the server applies to the list as it stands, so it never puts back a table switched
 * elsewhere (a table's own page, a second tab); Share all sends what is on now with every listed table added, and Share none sends nothing. The
 * server answers only the tables shown now and keeps a table whose app is hidden as it was, for when the app comes back (`keepHiddenTables`), so
 * the counts here, the fold's "N shared" and the coach's own count are one number. Saves go one after another in the order tapped; a refusal
 * puts back what the server last said and shows why. Its own chunk with the registry, downloaded only when a fold opens.
 */
export function TableShareList({
  who,
  place,
  shared,
  save,
  onSaved,
  intro,
}: {
  /** A coach's list leaves out every table with other people's details; AI chat's says which a model that keeps nothing reads. */
  who: 'coach' | 'ai';
  /** Which list this is, so its open groups are remembered apart: `share-coach:<link>`, 'share-ai'. */
  place: string;
  shared: readonly string[];
  save: (op: TableShareOp) => Promise<unknown>;
  onSaved: () => void;
  intro: ReactNode;
}) {
  const apps = useAppsOn();
  const clean = who === 'coach' ? coachTableKeys : knownTableKeys;
  // The tables this person may share here now: a coach's, the ones a coach may ever be shown; both, only those whose app is on.
  const groups = useMemo(() => (who === 'coach' ? listTables('coach', DATA_TABLE_KEYS, apps) : listTables('owner', [], apps)), [who, apps]);
  const listed = useMemo(() => groups.flatMap((g) => g.tables.map((t) => t.key)), [groups]);
  const [on, setOn] = useState<string[]>(() => clean(shared));
  const [error, setError] = useState<unknown>(null);
  const busy = useRef(false);
  const ops = useRef<TableShareOp[]>([]);
  // The newest list the server gave, for a refusal to put back (a run keeps the render it started in, whose list may be older).
  const latestShared = useRef(shared);
  latestShared.current = shared;
  const fromServer = clean(shared).join(',');
  // What the server says, once nothing of ours is still on its way.
  useEffect(() => {
    if (!busy.current) setOn(fromServer ? fromServer.split(',') : []);
  }, [fromServer]);

  const run = async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      while (ops.current.length) await save(ops.current.shift()!);
      setError(null);
    } catch (e) {
      ops.current = [];
      setError(e);
      setOn(clean(latestShared.current));
    } finally {
      busy.current = false;
      onSaved();
    }
  };
  const send = (op: TableShareOp, next: string[]) => {
    setOn(clean(next));
    ops.current.push(op);
    void run();
  };
  const all = clean([...on, ...listed]);
  const sharedIn = (cats: readonly TableListGroup[]) => cats.reduce((n, c) => n + c.tables.filter((t) => on.includes(t.key)).length, 0);
  const tablesIn = (cats: readonly TableListGroup[]) => cats.reduce((n, c) => n + c.tables.length, 0);

  return (
    <div>
      <p className="m-0 text-subhead text-ink-soft">{intro}</p>
      <div className="mt-sm flex flex-wrap gap-xs">
        <Button size="sm" variant="outline" disabled={listed.every((k) => on.includes(k))} onClick={() => send({ tables: all }, all)}>
          Share all
        </Button>
        <Button size="sm" variant="outline" disabled={!listed.some((k) => on.includes(k))} onClick={() => send({ tables: [] }, [])}>
          Share none
        </Button>
      </div>
      <div className="mt-sm">
        <TableGroups
          groups={groups}
          place={place}
          count={(cats) => `${formatCount(sharedIn(cats))} of ${formatCount(tablesIn(cats))} shared`}
          mood={(cats) => (sharedIn(cats) > 0 ? 'happy' : 'sleepy')}
          note={(cat) => `${formatCount(cat.tables.filter((t) => on.includes(t.key)).length)} of ${formatCount(cat.tables.length)}`}
        >
          {(cat) => (
            <div className="rounded-tile bg-card px-sm shadow-toy-soft">
              {cat.tables.map((t) => {
                const table = dataTableByKey[t.key];
                return (
                  <Toggle
                    key={t.key}
                    compact
                    on={on.includes(t.key)}
                    onChange={(v) => send({ table: t.key, on: v }, v ? [...on, t.key] : on.filter((k) => k !== t.key))}
                    label={t.name}
                    hint={who === 'ai' && table && aiPrivateOnly(table) ? 'Only a model that keeps nothing reads it.' : undefined}
                  />
                );
              })}
            </div>
          )}
        </TableGroups>
      </div>
      <ErrorLine e={error} className="mt-xs" />
    </div>
  );
}
