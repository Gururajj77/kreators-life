/**
 * The one statement that writes an inbox note (`notifications`). Its kind is an `InboxKind`, so every note lands in one inbox
 * tab (`INBOX_TAB_META` in shared) and a kind with no tab does not compile; `scripts/scan.sh` refuses `INTO notifications`
 * anywhere else in the API. A type import only, so Node still loads this file (and alerts.ts, which uses it) with strip-types.
 */
import type { InboxKind } from '@kreators/shared';

export interface Note {
  /** A fixed id makes a note once a day or once ever (`once`) or one line rewritten in place (`renew`); `add` makes a fresh one when none is given. */
  id?: string;
  userId: string;
  kind: InboxKind;
  title: string;
  body?: string;
  link?: string | null;
  /** When it was written; now unless given. */
  at?: string;
}

/** add: a new row. once: INSERT OR IGNORE on its fixed id. renew: the row with that id rewritten (words, link, time), back to unread and out of the archive. */
export type NoteMode = 'add' | 'once' | 'renew';

const COLUMNS = 'INTO notifications (id, user_id, kind, title, body, link, read_at, created_at) VALUES (?, ?, ?, ?, ?, ?, NULL, ?)';
const SQL: Record<NoteMode, string> = {
  add: `INSERT ${COLUMNS}`,
  once: `INSERT OR IGNORE ${COLUMNS}`,
  renew: `INSERT ${COLUMNS} ON CONFLICT(id) DO UPDATE SET title = excluded.title, body = excluded.body, link = excluded.link, created_at = excluded.created_at, read_at = NULL, archived_at = NULL`,
};

export function noteStmt(db: D1Database, n: Note, mode: NoteMode = 'add'): D1PreparedStatement {
  if (mode !== 'add' && !n.id) throw new Error(`an inbox note written with ${mode} needs its fixed id`);
  return db.prepare(SQL[mode]).bind(n.id ?? crypto.randomUUID(), n.userId, n.kind, n.title, n.body ?? '', n.link ?? null, n.at ?? new Date().toISOString());
}
