import type {
  TableBulkRequest,
  TableBulkResponse,
  TableEditRequest,
  TableEditResponse,
  TableMatchingRequest,
  TableMatchingResponse,
  TablePageResponse,
  TablePreviewRequest,
  TablePreviewResponse,
  TablesListResponse,
} from '@kreators/shared/dataTables';
import { ApiError, request } from './api';
import { todayLocal } from './date';
import { useSession } from './store';

/**
 * Whose tables a screen shows (All tables, 2026-11-13): the person's own, a student's that they shared with this coach, or a member's for a
 * super admin. Kept out of lib/api.ts, which is in the first download, since only the lazy table screens read them.
 */
export type TablesSubject = { view: 'owner' } | { view: 'coach'; id: string } | { view: 'admin'; id: string };

const base = (s: TablesSubject): string => (s.view === 'owner' ? '/tables' : `/tables/${s.view}/${encodeURIComponent(s.id)}`);
const withQuery = (path: string, qs: string): string => (qs ? `${path}?${qs}` : path);

/** One key for React Query per subject, so a coach's and an admin's pages never share a cache with the person's own. */
export const subjectKey = (s: TablesSubject): string => (s.view === 'owner' ? 'owner' : `${s.view}:${s.id}`);

/** The CSV of every row that matches, as the server built it. `capped` says it stopped at the most a file holds. */
export interface TableCsv {
  rows: number;
  capped: boolean;
}

/** Hands a file to the browser as a download (a Blob and an anchor; no new origin, nothing left in the page). */
export function saveFile(text: string | Blob, fileName: string): void {
  const blob = typeof text === 'string' ? new Blob([text], { type: 'text/csv;charset=utf-8' }) : text;
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = fileName;
  a.rel = 'noopener';
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(href), 2000);
}

export const tablesApi = {
  list: (s: TablesSubject) => request<TablesListResponse>(base(s)),
  /** One page. The person's own also sends the device's day, so what they may change today (a log of today or yesterday) is the day they see. */
  page: (s: TablesSubject, table: string, qs: string) => request<TablePageResponse>(withQuery(`${base(s)}/${encodeURIComponent(table)}`, s.view === 'owner' ? [qs, `day=${todayLocal()}`].filter(Boolean).join('&') : qs)),
  /** Change one cell through the app's own route (owner only). */
  edit: (table: string, body: TableEditRequest) => request<TableEditResponse>(`/tables/${encodeURIComponent(table)}/edit`, { method: 'POST', body: JSON.stringify(body) }),
  /**
   * Archive, restore or delete forever (on a table the app already archives), or the table's own remove (on a table with `remove`), at most
   * BULK_MAX ids a call, the person's own rows only. What a call did not reach comes back in `left`, to send again.
   */
  bulk: (table: string, body: TableBulkRequest) => request<TableBulkResponse>(`/tables/${encodeURIComponent(table)}/bulk`, { method: 'POST', body: JSON.stringify(body) }),
  /** What a remove of these rows would do: one read, nothing written (the sheet's counts). */
  preview: (table: string, body: TablePreviewRequest) => request<TablePreviewResponse>(`/tables/${encodeURIComponent(table)}/bulk`, { method: 'POST', body: JSON.stringify(body) }),
  /** "Select all N that match": the ids the page's own query finds, BULK_MAX at most, leaving out the rows already sent, and how many match. */
  matching: (table: string, body: TableMatchingRequest) => request<TableMatchingResponse>(`/tables/${encodeURIComponent(table)}/bulk`, { method: 'POST', body: JSON.stringify(body) }),
  /**
   * Every row that matches as a CSV file, up to CSV_MAX_ROWS (the person's own, a coach's view of what a student shares, or a super
   * admin's, which the server writes to the audit log). The session token goes in the header, never in the address.
   */
  csv: async (s: TablesSubject, table: string, qs: string, fileName: string): Promise<TableCsv> => {
    const token = useSession.getState().token;
    const res = await fetch(`/api${withQuery(`${base(s)}/${encodeURIComponent(table)}/csv`, qs)}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (res.status === 401) useSession.getState().setToken(null);
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new ApiError(body.error ?? 'Could not build the file.', res.status, body);
    }
    const rows = Number(res.headers.get('X-Table-Rows') ?? '0');
    const capped = res.headers.get('X-Table-Capped') === '1';
    saveFile(await res.blob(), fileName);
    return { rows: Number.isFinite(rows) ? rows : 0, capped };
  },
};
