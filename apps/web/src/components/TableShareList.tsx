import { DATA_TABLES, knownTableKeys, listTables } from '@kreators/shared/dataTables';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from './Button';
import { ErrorLine } from './ErrorLine';
import { Toggle } from './Toggle';

const ALL_KEYS = DATA_TABLES.map((t) => t.key);
const GROUPS = listTables('owner');

/** One save: a single table switched (`{ table, on }`), or the whole list (Share all, Share none). */
export type TableShareOp = { table: string; on: boolean } | { tables: string[] };

/**
 * Every table as a switch, grouped as All tables lists them, each off until the person turns it on: the one list behind Tables your coach can
 * see (one coach, under Your life coach) and Tables AI chat can read (2026-11-14), both on the Profile tab. A switch sends only its own table
 * and on or off, which the server applies to the list as it stands, so it never puts back a table switched elsewhere (a table's own page, a
 * second tab); Share all and Share none send the whole list. Saves go one after another in the order tapped; a refusal puts back what the
 * server last said and shows why. Its own chunk with the registry, downloaded only when a fold opens.
 */
export function TableShareList({ shared, save, onSaved, intro }: { shared: readonly string[]; save: (op: TableShareOp) => Promise<unknown>; onSaved: () => void; intro: ReactNode }) {
  const [on, setOn] = useState<string[]>(() => knownTableKeys(shared));
  const [error, setError] = useState<unknown>(null);
  const busy = useRef(false);
  const ops = useRef<TableShareOp[]>([]);
  // The newest list the server gave, for a refusal to put back (a run keeps the render it started in, whose list may be older).
  const latestShared = useRef(shared);
  latestShared.current = shared;
  const fromServer = knownTableKeys(shared).join(',');
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
      setOn(knownTableKeys(latestShared.current));
    } finally {
      busy.current = false;
      onSaved();
    }
  };
  const send = (op: TableShareOp, next: string[]) => {
    setOn(knownTableKeys(next));
    ops.current.push(op);
    void run();
  };

  return (
    <div>
      <p className="m-0 text-subhead text-ink-soft">{intro}</p>
      <div className="mt-sm flex flex-wrap gap-xs">
        <Button size="sm" variant="outline" disabled={on.length === ALL_KEYS.length} onClick={() => send({ tables: ALL_KEYS }, ALL_KEYS)}>
          Share all
        </Button>
        <Button size="sm" variant="outline" disabled={on.length === 0} onClick={() => send({ tables: [] }, [])}>
          Share none
        </Button>
      </div>
      {GROUPS.map((g) => (
        <fieldset key={g.key} className="mt-sm m-0 min-w-0 border-0 p-0">
          <legend className="text-eyebrow uppercase text-ink-soft">
            {g.name}
            <span className="sr-only">:</span> {g.tables.filter((t) => on.includes(t.key)).length} of {g.tables.length}
          </legend>
          <div className="mt-xs rounded-tile bg-card px-sm shadow-toy-soft">
            {g.tables.map((t) => (
              <Toggle key={t.key} compact on={on.includes(t.key)} onChange={(v) => send({ table: t.key, on: v }, v ? [...on, t.key] : on.filter((k) => k !== t.key))} label={t.name} />
            ))}
          </div>
        </fieldset>
      ))}
      <ErrorLine e={error} className="mt-xs" />
    </div>
  );
}
