import { api } from '../lib/api';
import { TableShareList } from './TableShareList';

/**
 * Tables your coach can see (All tables, 2026-11-13, the founder: "entire tables can be visible to coach", the student switches which):
 * one switch per table for this one coach, each off until the student turns it on (the switch is their yes). The coach only reads a shared
 * table. A switch saves only its own table (`{ table, on }`, 2026-11-14), so it never puts back a table switched off on that table's own page
 * (Show to my coach); Share all and Share none save the list. The route logs it in words, never what a table holds.
 */
export function CoachTablesShare({ linkId, coachName, shared, onSaved }: { linkId: string; coachName: string; shared: readonly string[]; onSaved: () => void }) {
  return (
    <TableShareList
      shared={shared}
      onSaved={onSaved}
      save={(op) => ('table' in op ? api.shareTableWithCoach(linkId, op.table, op.on) : api.shareWithCoach(linkId, { tables: op.tables }))}
      intro={<>Each table is off until you switch it on. {coachName} can only read a table you share, never change it. Switch any off at any time, here or with Show to my coach at the top of the table.</>}
    />
  );
}
