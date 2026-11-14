import { api } from '../lib/api';
import { TableShareList } from './TableShareList';

/**
 * Tables AI chat can read (2026-11-14, the founder: "give one toggle for ai chat access just next to coach button too and even in profile
 * section"): every table as a switch, each off until the person turns it on, the same yes as Show to AI chat at the top of each table
 * (`users.ai_tables_json`). The assistant and the Companion read an open table through their `read_table` tool, never change it, and their
 * `read_journal` reads the journal and gratitude only while those two are on; the journal, gratitude, the body and mind tables and every
 * table with other people's details only with a model that keeps nothing (`tableReach`).
 */
export function AiTablesShare({ shared, onSaved }: { shared: readonly string[]; onSaved: () => void }) {
  return (
    <TableShareList
      who="ai"
      place="share-ai"
      shared={shared}
      onSaved={onSaved}
      save={(op) => api.aiTables(op)}
      intro="Each table is off until you switch it on. The assistant and the Companion can read the whole of a table you open, never change it. The journal, gratitude, the body and mind tables and any with other people’s details are read only with a model that keeps nothing. Their own tools still read your day. They read your journal and gratitude only when you ask, and only while those two tables are on here."
    />
  );
}
