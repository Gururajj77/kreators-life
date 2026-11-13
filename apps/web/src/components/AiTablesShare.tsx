import { api } from '../lib/api';
import { TableShareList } from './TableShareList';

/**
 * Tables AI chat can read (2026-11-14, the founder: "give one toggle for ai chat access just next to coach button too and even in profile
 * section"): every table as a switch, each off until the person turns it on, the same yes as Show to AI chat at the top of each table
 * (`users.ai_tables_json`). The assistant and the Companion read an open table through their `read_table` tool, never change it; the journal,
 * gratitude and the body and mind tables only with a model that keeps nothing.
 */
export function AiTablesShare({ shared, onSaved }: { shared: readonly string[]; onSaved: () => void }) {
  return (
    <TableShareList
      shared={shared}
      onSaved={onSaved}
      save={(op) => api.aiTables(op)}
      intro="Each table is off until you switch it on. The assistant and the Companion can read the whole of a table you open, never change it. The journal, gratitude and the body and mind tables are read only with a model that keeps nothing. Their own tools still read what they always did, like your day, and your journal only when you ask."
    />
  );
}
