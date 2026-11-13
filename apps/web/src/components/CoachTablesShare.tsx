import { DATA_TABLES, knownTableKeys, listTables } from '@kreators/shared/dataTables';
import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { Button } from './Button';
import { ErrorLine } from './ErrorLine';
import { Toggle } from './Toggle';

const ALL_KEYS = DATA_TABLES.map((t) => t.key);
const GROUPS = listTables('owner');

/**
 * Tables your coach can see (All tables, 2026-11-13, the founder: "entire tables can be visible to coach", the student switches which):
 * one switch per table, grouped as All tables lists them, each off until the student turns it on (the switch is their yes, for this one
 * coach). The coach only reads a shared table. Every change saves the whole list through the share route, one save at a time, so two quick
 * taps never land out of order; the route logs it in words, never what a table holds. Its own chunk: the registry downloads only when the
 * fold is opened.
 */
export function CoachTablesShare({ linkId, coachName, shared, onSaved }: { linkId: string; coachName: string; shared: readonly string[]; onSaved: () => void }) {
  const [on, setOn] = useState<string[]>(() => knownTableKeys(shared));
  const [error, setError] = useState<unknown>(null);
  const busy = useRef(false);
  const queued = useRef<string[] | null>(null);
  const fromServer = knownTableKeys(shared).join(',');
  // What the server says, once nothing of ours is still on its way.
  useEffect(() => {
    if (!busy.current) setOn(fromServer ? fromServer.split(',') : []);
  }, [fromServer]);

  const send = async (tables: string[]) => {
    if (busy.current) {
      queued.current = tables;
      return;
    }
    busy.current = true;
    let next: string[] | null = tables;
    try {
      while (next) {
        queued.current = null;
        await api.shareWithCoach(linkId, { tables: next });
        next = queued.current;
      }
      setError(null);
    } catch (e) {
      setError(e);
      setOn(knownTableKeys(shared));
    } finally {
      busy.current = false;
      onSaved();
    }
  };
  const set = (keys: string[]) => {
    const ordered = knownTableKeys(keys);
    setOn(ordered);
    void send(ordered);
  };

  return (
    <div>
      <p className="m-0 text-subhead text-ink-soft">
        Each table is off until you switch it on. {coachName} can only read a table you share, never change it. Switch any off at any time.
      </p>
      <div className="mt-sm flex flex-wrap gap-xs">
        <Button size="sm" variant="outline" disabled={on.length === ALL_KEYS.length} onClick={() => set(ALL_KEYS)}>
          Share all
        </Button>
        <Button size="sm" variant="outline" disabled={on.length === 0} onClick={() => set([])}>
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
              <Toggle key={t.key} compact on={on.includes(t.key)} onChange={(v) => set(v ? [...on, t.key] : on.filter((k) => k !== t.key))} label={t.name} />
            ))}
          </div>
        </fieldset>
      ))}
      <ErrorLine e={error} className="mt-xs" />
    </div>
  );
}
