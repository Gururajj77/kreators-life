import { formatCount, MODULE_BY_KEY, type ConsentChoices } from '@kreators/shared';
import {
  aiPrivateOnly,
  andList,
  BULK_MAX,
  columnFor,
  csvMaxRows,
  DATA_TABLE_GROUPS,
  dataTableByKey,
  isRealDay,
  noEditWhyOf,
  noRemoveWhyOf,
  parseTableQuery,
  previewLine,
  removeCount,
  removeDoneLine,
  removeVerbOf,
  removeWords,
  rowsWord,
  SEARCH_MAX,
  TABLE_DEFAULT_SIZE,
  tableAllowed,
  tableColumn,
  tableEditable,
  tableQueryString,
  tableReach,
  TABLE_SWITCHES,
  tableAppsOn,
  toCsv,
  toTsv,
  verbWith,
  visibleColumns,
  type Cell,
  type ColumnOption,
  type DataColumn,
  type DataTable,
  type TableBulkAction,
  type TableEditResponse,
  type TablePageResponse,
  type TablePreviewResponse,
  type TableQuery,
  type TableRow,
} from '@kreators/shared/dataTables';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronsLeft, ChevronsRight, Download } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { AppCover } from '../components/AppCover';
import { Button } from '../components/Button';
import { TableSwitches, useAiChatOn, useTableCoaches } from '../components/TableSwitches';
import { ConfirmDelete, DELETE_BTN_SM } from '../components/ConfirmDelete';
import { ErrorLine } from '../components/ErrorLine';
import { FilterBar, FilterSelect } from '../components/FilterSelect';
import { Fold } from '../components/Fold';
import { IconButton } from '../components/IconButton';
import { ALL_SIZES, PagerBar } from '../components/Pager';
import { Screen } from '../components/Screen';
import { ServerTable, type ServerTableEditor } from '../components/ServerTable';
import { Skeleton } from '../components/Skeleton';
import { Segmented } from '../components/fx/Segmented';
import { ApiError } from '../lib/api';
import { useCopy } from '../lib/clipboard';
import { focusHeadingAfter } from '../lib/focusHeading';
import { sayStatus } from '../lib/sayStatus';
import { useTapTwice } from '../lib/useTapTwice';
import { useConsent } from '../lib/consent';
import { todayLocal } from '../lib/date';
import { useAppsOn, useModules } from '../lib/modules';
import { useMe } from '../lib/queries';
import { useSession } from '../lib/store';
import { saveFile, subjectKey, tablesApi, type TablesSubject } from '../lib/tablesApi';
import { useDebounced } from '../lib/useDebounced';
import { writeParams } from '../lib/useParamState';
import { OnlyAdmins, tablesPath } from './Tables';

/**
 * One table of All tables (2026-11-13): the person's own (`/tables/:table`), a student's that they shared with this coach, or a member's for
 * a super admin, both read only. Sort, filters, search, the page and its size and the view live in the address (useParamState's
 * writeParams, so Back and a reload keep them, and a change of sort, filter, search or view goes back to page 1). One D1 round trip a page:
 * the rows, and the count only on the first load and after a filter or search change.
 */

const VIEW_OPTIONS = [
  { value: 'active' as const, label: 'Active' },
  { value: 'archived' as const, label: 'Archived' },
];

const DONE_WORD: Record<Exclude<TableBulkAction, 'remove'>, string> = { archive: 'archived', restore: 'restored', delete: 'deleted forever' };

/** What the bar asks about before it acts: Delete forever, or the table's own remove with the preview's counts. `of` is how many it is the first of. */
type Ask = { action: 'delete'; ids: string[]; of: number } | { action: 'remove'; ids: string[]; of: number; preview: TablePreviewResponse };

/** A greyed button's reason, said with the button's word unless it already starts with it ("Edit one row at a time."). */
const reasonFor = (word: string, why: string) => (why.toLowerCase().startsWith(word.toLowerCase()) ? why : `${word}: ${why}`);

/** The table's title in the cover, made a place the keyboard can land (after a remove, the row and the button it was on may be gone). */
function landOnTitle() {
  const h = document.querySelector<HTMLElement>('header[data-cover] h1');
  if (!h) return;
  if (!h.id) h.id = 'table-title';
  focusHeadingAfter(h.id);
}

const plural = (n: number, one: string, many = `${one}s`) => `${formatCount(n)} ${n === 1 ? one : many}`;

/** A range filter's day, kept as typed and sent once it is a real day (or emptied), so typing a year one digit at a time asks once. */
function RangeDay({ label, value, onChange }: { label: string; value: string; onChange: (v: string | null) => void }) {
  const [typed, setTyped] = useState(value);
  const settled = useDebounced(typed, 600);
  const sent = useRef(value);
  useEffect(() => {
    if (value !== sent.current) {
      sent.current = value;
      setTyped(value);
    }
  }, [value]);
  useEffect(() => {
    if (settled === sent.current || (settled !== '' && !isRealDay(settled))) return;
    sent.current = settled;
    onChange(settled || null);
    // onChange is a fresh closure each render; only the settled day matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settled]);
  return (
    <label className="block min-w-0">
      <span className="block text-caption text-ink-soft">{label}</span>
      <input type="date" value={typed} onChange={(e) => setTyped(e.target.value)} className="mt-xs min-h-[44px] w-full rounded-pill border-2 border-line bg-card px-sm text-subhead" />
    </label>
  );
}

/** The cells a change shows at once, before the server answers (the server's row replaces them). */
function optimisticCells(col: DataColumn, value: Cell, options: Readonly<Record<string, ColumnOption[]>>): Record<string, Cell> {
  const edit = col.edit;
  if (!edit || edit.input !== 'select') return { [col.key]: value };
  const list = edit.choices ? (options[col.key] ?? []) : (col.options ?? []);
  const opt = list.find((o) => o.value === value);
  const empty = value === null || Boolean(opt?.isNull);
  if (edit.current) return { [edit.current]: empty ? null : value, [col.key]: empty ? null : col.kind === 'enum' ? value : (opt?.label ?? null) };
  return { [col.key]: empty ? null : value };
}

function withRow(page: TablePageResponse, id: string, change: (r: TableRow) => TableRow): TablePageResponse {
  return { ...page, rows: page.rows.map((r) => (r.id === id ? change(r) : r)) };
}

/** The page after the server answered an edit: the row as it is now, under its new id when the route replaced it, or gone from this view. */
function applyEdit(page: TablePageResponse, id: string, res: TableEditResponse): TablePageResponse {
  if (!res.row || res.gone) return { ...page, rows: page.rows.filter((r) => r.id !== id), total: page.total === undefined ? undefined : Math.max(0, page.total - 1) };
  const was = page.rows.find((r) => r.id === id);
  const now: TableRow = { ...res.row, edit: res.row.edit ?? was?.edit };
  return { ...page, rows: page.rows.map((r) => (r.id === id ? now : r)) };
}

/** What a filter offers: yes or no, the person's own list, or the column's words. */
function filterItems(col: DataColumn, options: Readonly<Record<string, ColumnOption[]>>): { key: string; label: string }[] {
  const any = { key: '', label: 'Any' };
  if (col.kind === 'bool') return [any, { key: 'yes', label: 'Yes' }, { key: 'no', label: 'No' }];
  const list = col.dynamic && !col.options ? (options[col.key] ?? []) : (col.options ?? []);
  return [any, ...list.map((o) => ({ key: o.value, label: o.label }))];
}

/** Without the page, the size and the sort: what decides how many rows match. */
function countKeyOf(table: DataTable, query: TableQuery): string {
  return tableQueryString(table, { ...query, page: 1, size: TABLE_DEFAULT_SIZE, sort: table.defaultSort.key, dir: table.defaultSort.dir, count: false });
}

function Grid({ table, subject }: { table: DataTable; subject: TablesSubject }) {
  const view = subject.view;
  // The owner's coaches and AI chat, for the cover's switches; a coach's or an admin's view never asks.
  const coaches = useTableCoaches(view === 'owner');
  const aiOn = useAiChatOn();
  const token = useSession((s) => s.token);
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const query = useMemo(() => parseTableQuery(table, params, view), [table, params, view]);
  const sk = subjectKey(subject);
  const qs = tableQueryString(table, { ...query, count: false });
  const countKey = countKeyOf(table, query);
  const pageKey = useMemo(() => ['table-page', sk, table.key, qs] as const, [sk, table.key, qs]);
  // How many rows match each filter and search, as the server last counted them: paging and sorting never ask again.
  const totals = useRef(new Map<string, number>());
  const pageQ = useQuery({
    queryKey: pageKey,
    queryFn: async () => {
      const known = totals.current.get(countKey);
      const res = await tablesApi.page(subject, table.key, tableQueryString(table, { ...query, count: known === undefined }));
      if (res.total !== undefined) totals.current.set(countKey, res.total);
      return res.total === undefined && known !== undefined ? { ...res, total: known } : res;
    },
    enabled: Boolean(token),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
  const data = pageQ.data && pageQ.data.table === table.key ? pageQ.data : undefined;
  const waiting = pageQ.isPlaceholderData && pageQ.isFetching;
  const options = data?.options ?? {};
  const currency = data?.subject.currency ?? 'INR';
  const columns = useMemo(() => {
    const keys = data ? data.columns : visibleColumns(table, view).map((c) => c.key);
    return keys.map((k) => tableColumn(table, k)).filter((c): c is DataColumn => Boolean(c) && !c?.hidden);
  }, [data, table, view]);

  /** Every change of what is shown, in one write; anything but a page turn goes back to page 1. */
  const write = (changes: Record<string, string | null>, toFirst = true) => writeParams(setParams, toFirst ? { page: null, ...changes } : changes);

  // The search box: as typed, sent 300 ms after the last key, and set again from the address when Back changes it.
  const [typed, setTyped] = useState(query.q);
  const debounced = useDebounced(typed, 300);
  const sentQ = useRef(query.q);
  useEffect(() => {
    if (query.q !== sentQ.current) {
      sentQ.current = query.q;
      setTyped(query.q);
    }
  }, [query.q]);
  useEffect(() => {
    const v = debounced.replace(/\s+/g, ' ').trim().slice(0, SEARCH_MAX);
    if (v === sentQ.current) return;
    sentQ.current = v;
    write({ q: v || null });
    // `write` is a fresh closure each render; only the settled words matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  // A page past the end (its last rows archived, or a filter changed under it) steps back to the last page there is.
  useEffect(() => {
    if (!data?.page.empty || query.page <= 1) return;
    const last = data.total !== undefined ? Math.max(1, Math.ceil(data.total / query.size)) : 1;
    write({ page: last > 1 && last < query.page ? String(last) : null }, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // Ticks: kept across pages (Copy and the CSV take the rows themselves), cleared when the view changes.
  const [picked, setPicked] = useState<Map<string, TableRow>>(() => new Map());
  useEffect(() => setPicked(new Map()), [query.view]);
  // Select all (2026-11-14): every row the search and filters find, not only the ticked page, acted on a hundred at a time. `tried` holds the
  // rows earlier rounds sent, so the next round takes the next hundred; `more` is how many still match after a round, and which action it was.
  const [allMatch, setAllMatch] = useState(false);
  const tried = useRef<string[]>([]);
  const [more, setMore] = useState<{ n: number; action: TableBulkAction } | null>(null);
  const leaveAll = () => {
    setAllMatch(false);
    setMore(null);
    tried.current = [];
  };
  // A new search, filter or view is another set of rows: Select all starts again.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => leaveAll(), [countKey]);
  const pick = (rows: readonly TableRow[], on: boolean) => {
    leaveAll();
    setPicked((cur) => {
      const next = new Map(cur);
      for (const r of rows) {
        if (on) next.set(r.id, r);
        else next.delete(r.id);
      }
      return next;
    });
  };
  const clearPicks = () => {
    leaveAll();
    setPicked(new Map());
  };

  // The status line is said once: a remove says it through the app's one live region (and moves the keyboard to the title), so the line on
  // screen is then quiet; everything else says it through the line itself.
  const [statusLine, setStatusLine] = useState<{ words: string; said: boolean } | null>(null);
  const setStatus = (words: string | null) => setStatusLine(words ? { words, said: false } : null);
  const sayAloud = (words: string) => {
    setStatusLine({ words, said: true });
    sayStatus(words);
  };
  const [editError, setEditError] = useState<unknown>(null);
  const { copy, said } = useCopy();
  const ctx = { options, currency };
  const fileName = `${table.key}-${todayLocal()}.csv`;

  /** Everything else the app shows is read again when next opened; this table's other pages too, without asking now. */
  const markStale = () => {
    void qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== 'insights' && q.queryKey[0] !== 'table-page' });
    void qc.invalidateQueries({ queryKey: ['table-page', sk, table.key], refetchType: 'none' });
  };

  // Saves of one row go one after another, each sent under the id the one before left it with (a day's log gets a new id each save), so two
  // quick changes to one row never race; a failed save puts back only the cells it changed, never another save's work.
  const rowSaves = useRef(new Map<string, Promise<unknown>>());
  const movedTo = useRef(new Map<string, string>());
  /** A row's id now, after any saves that gave it a new one (a day's log): the form under it follows it. */
  const latestId = (id: string): string => {
    let at = id;
    for (let i = 0; i < 20; i++) {
      const next = movedTo.current.get(at);
      if (!next || next === at) break;
      at = next;
    }
    return at;
  };
  // The one row whose form is open under it (the bar's Edit), by the id it opened on. It closes when the ticks no longer name only that row.
  const [formFor, setFormFor] = useState<string | null>(null);
  useEffect(() => {
    if (formFor && (allMatch || picked.size !== 1 || !picked.has(latestId(formFor)))) setFormFor(null);
    // latestId reads a ref; the ticks and the row it opened on are what matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked, allMatch, formFor]);
  // And when what is shown changes (a page, its size, the sort, a filter, the search or the view; the review of 2026-11-14), or its row is not
  // on the page drawn: the ticks stay, Edit says it is closed, and a form never comes back by itself to take the keyboard when its row does.
  const shownQs = useRef(qs);
  useEffect(() => {
    if (shownQs.current === qs) return;
    shownQs.current = qs;
    setFormFor(null);
  }, [qs]);
  useEffect(() => {
    if (formFor && data && !waiting && !data.rows.some((r) => r.id === latestId(formFor))) setFormFor(null);
    // latestId reads a ref; the page drawn and the row it opened on are what matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, waiting, formFor]);
  /** The form closed: Saved (said, and the keyboard back on Edit), Cancel (back on Edit), or its row left the list (the save said it). */
  const closeForm = (how: 'saved' | 'cancel' | 'left') => {
    setFormFor(null);
    if (how === 'left') return;
    if (how === 'saved') sayStatus('Saved.');
    requestAnimationFrame(() => document.getElementById('table-edit')?.focus());
  };
  const editor: ServerTableEditor | undefined =
    view === 'owner' && query.view !== 'archived' && tableEditable(table)
      ? {
          editable: (row, col) => Boolean(row.edit?.includes(col.key)),
          save: (row, col, value, opts) => {
            setEditError(null);
            setStatus(null);
            const optimistic = optimisticCells(col, value, options);
            const shown = qc.getQueryData<TablePageResponse>(pageKey);
            const was = shown?.rows.find((r) => r.id === row.id);
            if (shown) qc.setQueryData<TablePageResponse>(pageKey, withRow(shown, row.id, (r) => ({ ...r, cells: { ...r.cells, ...optimistic } })));
            const ahead = rowSaves.current.get(row.id);
            const run = (async () => {
              if (ahead) await ahead.catch(() => undefined);
              const id = movedTo.current.get(row.id) ?? row.id;
              try {
                const res = await tablesApi.edit(table.key, { id, column: col.key, value, today: todayLocal() });
                if (res.replacedBy) movedTo.current.set(row.id, res.replacedBy);
                // The control the keyboard is on now: when it goes with the row (its cell, or the form under it), its place moves to the title.
                const at = document.activeElement;
                qc.setQueryData<TablePageResponse>(pageKey, (cur) => (cur ? applyEdit(cur, id, res) : cur));
                const left = !res.row || Boolean(res.gone);
                if (left) {
                  const had = totals.current.get(countKey);
                  if (had !== undefined) totals.current.set(countKey, Math.max(0, had - 1));
                  // One line, said once (the form says nothing more, `closeForm('left')`), and the keyboard's place on the table's title once the
                  // row, its form and the bar (the row was the one ticked) have gone (the review of 2026-11-14).
                  sayAloud('Saved. That row left this list.');
                  requestAnimationFrame(() =>
                    requestAnimationFrame(() => {
                      const now = document.activeElement;
                      if (!at || !at.isConnected || !now || now === document.body) landOnTitle();
                    }),
                  );
                }
                // A ticked row keeps what it holds now (Copy and the CSV take the rows themselves), under its new id when the route replaced it.
                setPicked((cur) => {
                  if (!cur.has(id)) return cur;
                  const next = new Map(cur);
                  next.delete(id);
                  if (res.row && !res.gone) next.set(res.row.id, res.row);
                  return next;
                });
                if (res.consent) useConsent.getState().keep(res.consent as ConsentChoices);
                markStale();
                return { left };
              } catch (e) {
                // Only the cells this save changed go back; a row the route replaced meanwhile is not found and stays as it is.
                if (was)
                  qc.setQueryData<TablePageResponse>(pageKey, (cur) =>
                    cur ? withRow(cur, id, (r) => ({ ...r, cells: { ...r.cells, ...Object.fromEntries(Object.keys(optimistic).map((k) => [k, was.cells[k] ?? null])) } })) : cur,
                  );
                // Gone, or changed somewhere else: read the page again, so the row is the one the server has and the next change can land.
                if (e instanceof ApiError && (e.status === 404 || e.status === 409)) {
                  if (e.status === 404) totals.current.delete(countKey);
                  void qc.invalidateQueries({ queryKey: pageKey });
                }
                if (!opts?.quiet) setEditError(e);
                throw e;
              }
            })();
            rowSaves.current.set(row.id, run);
            const done = () => {
              if (rowSaves.current.get(row.id) === run) rowSaves.current.delete(row.id);
            };
            run.then(done, done);
            return run;
          },
        }
      : undefined;

  // Archive, Restore and Delete forever (only on a table the app already archives), and the table's own remove: at most BULK_MAX ids a call,
  // and again with what the server did not reach in one go (its round trips are shared by everyone on the free plan).
  const [ask, setAsk] = useState<Ask | null>(null);
  // What the rounds so far did, kept outside the call: a later round that fails (offline, a limit) still un-ticks and reads again what the
  // earlier ones archived or deleted, and the error stays on screen.
  const doneSoFar = useRef<string[]>([]);

  /** After a round of Select all: the rows it sent are not taken again, and what still matches waits for "Do the next 100". */
  const afterRound = (action: TableBulkAction, ids: readonly string[], left: readonly string[], of: number) => {
    if (!allMatch) return;
    const sent = ids.filter((id) => !left.includes(id));
    tried.current = [...tried.current, ...sent];
    const rest = of - sent.length;
    if (rest > 0) setMore({ n: rest, action });
    else leaveAll();
  };
  /** Un-ticks the rows a round acted on (done or left as they were), keeping the ones it did not reach, which a second try sends again. */
  const untick = (ids: readonly string[]) =>
    setPicked((cur) => {
      if (!ids.length) return cur;
      const next = new Map(cur);
      for (const id of ids) next.delete(id);
      return next;
    });
  const readAgain = () => {
    totals.current.clear();
    void qc.invalidateQueries({ queryKey: ['table-page', sk, table.key] });
    markStale();
  };

  const bulk = useMutation({
    mutationFn: async ({ action, ids, of }: { action: Exclude<TableBulkAction, 'remove'>; ids: string[]; of: number }) => {
      doneSoFar.current = [];
      let queue = [...ids];
      const done: string[] = [];
      const skipped: { id: string; why: string }[] = [];
      for (let round = 0; queue.length > 0 && round < 20; round++) {
        const batch = queue.slice(0, BULK_MAX);
        const r = await tablesApi.bulk(table.key, { action, ids: batch, today: todayLocal() });
        done.push(...r.done);
        doneSoFar.current.push(...r.done);
        skipped.push(...r.skipped);
        if (r.done.length === 0 && r.skipped.length === 0) break;
        queue = [...r.left, ...queue.slice(BULK_MAX)];
      }
      return { action, ids, of, done, skipped, left: queue };
    },
    onSuccess: ({ action, ids, of, done, skipped, left }) => {
      setAsk(null);
      const whys = new Map<string, number>();
      for (const s of skipped) whys.set(s.why, (whys.get(s.why) ?? 0) + 1);
      const parts = [done.length ? `${plural(done.length, 'row')} ${DONE_WORD[action]}.` : 'Nothing changed.'];
      for (const [why, n] of whys) parts.push(`${plural(n, 'row')} left as ${n === 1 ? 'it was' : 'they were'}: ${why}`);
      if (left.length) parts.push(`${plural(left.length, 'row')} not reached. Try again.`);
      sayAloud(parts.join(' '));
      afterRound(action, ids, left, of);
      // As the remove below: the rows and the bar's Archive, Restore or Delete forever may be gone, so the keyboard's place moves to the title.
      landOnTitle();
    },
    onSettled: () => {
      untick(doneSoFar.current);
      readAgain();
    },
  });

  // The table's own remove (2026-11-14): each row through its app's own route, as the person; what a limit stopped waits, ticked, for another try.
  const remove = useMutation({
    mutationFn: async ({ ids, of, asked }: { ids: string[]; of: number; asked?: 'twice' }) => {
      doneSoFar.current = [];
      let queue = [...ids];
      const done: string[] = [];
      const skipped: { id: string; why: string }[] = [];
      const didAs = new Map<string, number>();
      let stopped: string | undefined;
      // A call reaches three or four rows (each is the app's own route, its session, gate and reads), so a hundred take some thirty calls.
      for (let round = 0; queue.length > 0 && round < 60; round++) {
        const r = await tablesApi.bulk(table.key, { action: 'remove', ids: queue.slice(0, BULK_MAX), today: todayLocal(), ...(asked ? { asked } : {}) });
        done.push(...r.done);
        doneSoFar.current.push(...r.done, ...r.skipped.map((x) => x.id));
        skipped.push(...r.skipped);
        for (const d of r.didAs ?? []) didAs.set(d.did, (didAs.get(d.did) ?? 0) + d.n);
        queue = [...r.left, ...queue.slice(BULK_MAX)];
        if (r.stopped) {
          stopped = r.stopped;
          break;
        }
        if (r.done.length === 0 && r.skipped.length === 0) break;
      }
      return { ids, of, done, skipped, didAs, left: queue, stopped };
    },
    onSuccess: ({ ids, of, done, skipped, didAs, left, stopped }) => {
      setAsk(null);
      const whys = new Map<string, number>();
      for (const x of skipped) whys.set(x.why, (whys.get(x.why) ?? 0) + 1);
      const parts = didAs.size ? [...didAs].map(([did, n]) => removeDoneLine(table, did, n)) : [done.length ? `${removeCount(table, done.length)} done.` : 'Nothing changed.'];
      for (const [why, n] of whys) parts.push(`${removeCount(table, n)} left as ${n === 1 ? 'it was' : 'they were'}: ${why}`);
      if (left.length) parts.push(`${removeCount(table, left.length)} not reached. ${stopped ?? 'Try again.'}`);
      sayAloud(parts.join(' '));
      afterRound('remove', ids, left, of);
      // The row and the button the keyboard was on may be gone: its place moves to the table's title, and the page reads again.
      landOnTitle();
    },
    onSettled: () => {
      untick(doneSoFar.current);
      readAgain();
    },
  });

  /**
   * The rows an action takes: the ticked ones (a remove's first BULK_MAX, which the preview counts), or with Select all the next hundred the
   * search and filters find; then for a remove the preview of what each would get, which the sheet says before anything changes.
   */
  const prepare = useMutation({
    mutationFn: async (action: TableBulkAction) => {
      let ids: string[];
      let of: number;
      if (allMatch) {
        const m = await tablesApi.matching(table.key, { action: 'matching', query: tableQueryString(table, query, { page: false, count: false }), not: tried.current, today: todayLocal() });
        ids = m.ids;
        of = m.total;
      } else {
        const all = [...picked.keys()];
        ids = action === 'remove' ? all.slice(0, BULK_MAX) : all;
        of = all.length;
      }
      if (ids.length === 0) return null;
      const preview = action === 'remove' ? await tablesApi.preview(table.key, { action: 'preview', ids, today: todayLocal() }) : null;
      return { action, ids, of, preview };
    },
    onSuccess: (r) => {
      if (!r) {
        leaveAll();
        setStatus('Nothing left that matches.');
        return;
      }
      if (r.action === 'remove' && r.preview) {
        if (r.preview.act.every((a) => a.n === 0)) {
          setStatus(previewLine(r.preview));
          // With Select all, a hundred that all stay are passed over, so "Do the next 100" reaches the rows after them.
          afterRound('remove', r.ids, [], r.of);
          return;
        }
        setAsk({ action: 'remove', ids: r.ids, of: r.of, preview: r.preview });
      } else if (r.action === 'delete') setAsk({ action: 'delete', ids: r.ids, of: r.of });
      else if (r.action === 'archive' || r.action === 'restore') bulk.mutate({ action: r.action, ids: r.ids, of: r.of });
    },
  });
  const start = (action: TableBulkAction) => {
    bulk.reset();
    remove.reset();
    setStatus(null);
    prepare.mutate(action);
  };

  const downloadAll = useMutation({
    mutationFn: () => tablesApi.csv(subject, table.key, tableQueryString(table, query, { page: false, count: false }), fileName),
    onSuccess: (r) => setStatus(r.capped ? `The file holds the first ${formatCount(csvMaxRows(table, view))} rows. Narrow the filters or the search to get the rest.` : `Downloaded ${plural(r.rows, 'row')}.`),
  });

  const pickCols = table.columns.filter((c) => c.filter === 'pick' && columnFor(c, view));
  const rangeCols = table.columns.filter((c) => c.filter === 'range' && columnFor(c, view));
  const filtersOn = Object.keys(query.filters).length + Object.keys(query.ranges).length;
  const searchable = table.columns.some((c) => c.searchable && columnFor(c, view));
  const clearFilters = () => {
    const changes: Record<string, string | null> = {};
    for (const c of pickCols) changes[`f_${c.key}`] = null;
    for (const c of rangeCols) {
      changes[`f_${c.key}_from`] = null;
      changes[`f_${c.key}_to`] = null;
    }
    write(changes);
  };
  const onSort = (key: string) => {
    const col = tableColumn(table, key);
    const dir: 'asc' | 'desc' = query.sort === key ? (query.dir === 'asc' ? 'desc' : 'asc') : key === table.defaultSort.key ? table.defaultSort.dir : col && (col.kind === 'date' || col.kind === 'datetime') ? 'desc' : 'asc';
    const plain = key === table.defaultSort.key && dir === table.defaultSort.dir;
    write({ sort: plain ? null : key, dir: plain ? null : dir });
  };

  const pickedRows = [...picked.values()];
  const total = data?.total;
  const pages = total === undefined || !data ? undefined : Math.max(1, Math.ceil(total / data.page.size));
  const toPage = (p: number, s: number) => write({ page: p === 1 ? null : String(p), size: s === TABLE_DEFAULT_SIZE ? null : String(s) }, false);
  const archived = query.view === 'archived';
  const name = data?.subject.name ?? '';
  const group = DATA_TABLE_GROUPS.find((g) => g.key === table.group)?.name ?? '';
  const reach = tableReach(table);
  const back = { to: tablesPath(subject), label: view === 'owner' ? 'All tables' : 'Their tables' };
  const notHere = pageQ.error instanceof ApiError && pageQ.error.status === 404;
  // The selection bar's Edit and remove (2026-11-14): the owner's own, in the Active view only; a coach's and an admin's ticks copy and download.
  const acts = view === 'owner' && !archived;
  const spec = table.remove;
  const verb = removeVerbOf(table);
  const verbIt = verbWith(verb, 'it');
  const readNote =
    view === 'coach'
      ? `Read only. ${name || 'Your student'} shares this table with you and can switch it off.`
      : view === 'admin'
        ? 'Read only. Opening or downloading this table is written to the audit log.'
        : archived
          ? 'These are archived. Restore them, or delete them forever.'
          : tableEditable(table)
            ? spec
              ? `Tap a cell under a pencil to change it, or tick a row to edit it or ${verbIt}. It saves the same way it does anywhere else in the app.`
              : 'Tap a cell under a pencil to change it. It saves the same way it does anywhere else in the app.'
            : spec
              ? `Tick a row to ${verbIt}. It goes the same way it does anywhere else in the app.`
              : (table.readOnlyWhy ?? 'Read only.');
  // Edit opens one row's form under it: exactly one ticked row, on this page, with a cell it may change now. Otherwise it is greyed with why.
  const singleId = !allMatch && picked.size === 1 ? ([...picked.keys()][0] ?? null) : null;
  const singleRow = singleId ? data?.rows.find((r) => r.id === singleId) : undefined;
  const editWhy = !acts
    ? null
    : (noEditWhyOf(table) ??
      (allMatch || picked.size > 1
        ? 'Edit one row at a time.'
        : !singleRow
          ? 'Go to the page that row is on to edit it.'
          : !singleRow.edit?.length
            ? (singleRow.noEdit ?? 'This row cannot be changed now.')
            : null));
  const formRow = formFor ? latestId(formFor) : null;
  // The remove: greyed on a table with none, and when every ticked row says why it stays (the page's own answer for each, read with it).
  const pickedNow = pickedRows.map((r) => data?.rows.find((x) => x.id === r.id) ?? r);
  const staying = pickedNow.map((r) => (r.remove && 'why' in r.remove ? r.remove.why : null));
  const removeWhy = !acts ? null : (noRemoveWhyOf(table) ?? (!allMatch && staying.length > 0 && staying.every((w) => w !== null) ? staying[0] : null));
  // One row of a small personal thing asks twice on the bar's own button; anything else asks once in the sheet, with the preview's counts.
  const twice = useTapTwice<string>();
  // A 'twice' table's row may ask in the sheet instead (`sheetWhen`: a post someone answered), as its own app asks.
  const singleNow = singleId ? (singleRow ?? picked.get(singleId)) : undefined;
  const sheetNow = Boolean(singleNow?.remove && 'did' in singleNow.remove && singleNow.remove.sheet);
  const asksTwice = Boolean(spec && spec.ask === 'twice' && singleId && !allMatch && !sheetNow);
  const armed = asksTwice && singleId !== null && twice.isArmed(singleId);
  // The second tap's words for that one row (the review of 2026-11-14): its name where its app names it ("Tap again to delete Deep work"), and
  // what goes with it, shown under the bar and said with the ask, as each app's own second tap says it.
  const oneWords = removeWords(table, 1, 1, singleNow);
  const busyActs = bulk.isPending || remove.isPending || prepare.isPending;
  // While only the preview is read, a button that opens the sheet stays enabled (its click is guarded by `busyActs`): disabling it then took
  // the keyboard's place to the page's body, and the sheet had nothing to hand focus back to when it closed (the review of 2026-11-14).
  const running = bulk.isPending || remove.isPending;
  const onRemove = () => {
    if (removeWhy || !spec || busyActs) return;
    if (asksTwice && singleId)
      twice.tap(singleId, () => {
        bulk.reset();
        remove.reset();
        setStatus(null);
        remove.mutate({ ids: [singleId], of: 1, asked: 'twice' });
      });
    else start('remove');
  };
  const words = ask?.action === 'remove' ? removeWords(table, ask.ids.length, ask.of) : null;
  const askCount = ask ? (ask.of > ask.ids.length ? `the first ${formatCount(ask.ids.length)} of ${formatCount(ask.of)}` : rowsWord(ask.ids.length)) : '';
  // Select all and Clear selection take away the button that was pressed (the review of 2026-11-14): what changed is said, and the keyboard's place moves
  // to something that stays, the bar it acted on (Tab then goes on to its buttons) or, once the bar goes, the table's title.
  const selectAllMatching = () => {
    setAllMatch(true);
    const n = total ?? 0;
    sayStatus(`All ${plural(n, 'row')} that match ${n === 1 ? 'is' : 'are'} selected.${n > BULK_MAX ? ` Actions take ${formatCount(BULK_MAX)} at a time.` : ''}`);
    focusHeadingAfter('table-picked');
  };
  const clearAll = () => {
    clearPicks();
    sayStatus('No rows are selected now.');
    landOnTitle();
  };
  // While Select all is on, every row drawn is in it (the review of 2026-11-14), but those a finished round already sent (done, or left as they
  // were), which the next round never takes. A tick changed then ends Select all: the page as drawn becomes plain ticks, with that change.
  const sentAlready = new Set(tried.current);
  const shownPicks = allMatch && data ? new Set(data.rows.filter((r) => !sentAlready.has(r.id)).map((r) => r.id)) : new Set(picked.keys());
  const onPick = (rows: readonly TableRow[], on: boolean) => {
    if (!allMatch) return pick(rows, on);
    const next = new Map<string, TableRow>();
    for (const r of data?.rows ?? []) if (!sentAlready.has(r.id)) next.set(r.id, r);
    for (const r of rows) {
      if (on) next.set(r.id, r);
      else next.delete(r.id);
    }
    leaveAll();
    setPicked(next);
    const n = next.size;
    sayStatus(n > 0 ? `Select all is off. ${plural(n, 'row')} on this page ${n === 1 ? 'stays' : 'stay'} ticked.` : 'Select all is off. No rows are selected now.');
  };
  // "Select all N that match": once the header's tick took the whole page and more rows match than are ticked.
  const canSelectAll = view === 'owner' && !allMatch && Boolean(data) && total !== undefined && (data?.rows.length ?? 0) > 0 && (data?.rows.every((r) => picked.has(r.id)) ?? false) && total > picked.size;
  const moreItems =
    total !== undefined && total > 0
      ? [{ key: 'all', label: `Download all ${plural(total, 'row')}`, icon: Download, disabled: downloadAll.isPending, onSelect: () => downloadAll.mutate() }]
      : [];

  return (
    <Screen howTo={false}>
      {/* The table's line speaks to its owner ("Every task you made"); a coach or an admin reads the read-only line under the controls instead. */}
      {/* The owner's Show to my coach and Show to AI chat sit in the cover's action slot: left of the line on a laptop, under it on a phone (app.css). */}
      <AppCover
        cover="tables"
        back={back}
        eyebrow={view === 'owner' ? group : name || undefined}
        title={table.name}
        lede={view === 'owner' ? table.blurb : undefined}
        actions={view === 'owner' && ((coaches.length > 0 && reach.coach) || aiOn) ? <TableSwitches table={table.key} coaches={coaches} ai={aiOn} privateOnly={aiPrivateOnly(table)} others={!reach.coach} /> : undefined}
      />

      {notHere ? (
        <p className="mt-lg m-0 text-body">{view === 'coach' ? 'This table is not shared with you now.' : view === 'admin' ? 'This table is not shown for this member.' : 'There is no table here.'}</p>
      ) : (
        // The first block under the cover keeps the cover's room and no margin of its own (whichever block that is on this table).
        <div className="mt-lg *:first:mt-0">
          {((table.archive && view === 'owner') || searchable || moreItems.length > 0) && (
            <div className="mt-sm flex flex-wrap items-center justify-between gap-sm">
              {table.archive && view === 'owner' && <Segmented label="Which rows" value={archived ? 'archived' : 'active'} onChange={(v) => write({ view: v === 'archived' ? 'archived' : null })} options={VIEW_OPTIONS} />}
              {(searchable || moreItems.length > 0) && (
                <div className="flex min-w-[min(100%,20rem)] flex-1 items-center justify-end gap-xs">
                  {searchable && (
                    <input
                      type="search"
                      value={typed}
                      maxLength={SEARCH_MAX}
                      onChange={(e) => setTyped(e.target.value)}
                      placeholder="Search"
                      aria-label={`Search ${table.name}`}
                      autoComplete="off"
                      className="min-h-[44px] min-w-0 flex-1 rounded-pill border-2 border-line bg-card px-md text-subhead"
                    />
                  )}
                  {/* The one action past the search (MoreMenu draws one item as this same round button; this one downloads, so it opens no dialog). */}
                  {moreItems.map((it) => (
                    <IconButton key={it.key} icon={it.icon} label={it.label} disabled={it.disabled} onClick={it.onSelect} />
                  ))}
                </div>
              )}
            </div>
          )}

          {(pickCols.length > 0 || rangeCols.length > 0) && (
            <Fold title="Filters" hint={filtersOn ? `${filtersOn} on` : undefined} defaultOpen={filtersOn > 0} className="mt-sm">
              {pickCols.length > 0 && (
                <FilterBar count={pickCols.length} label={`Filter ${table.name}`}>
                  {pickCols.map((c) => (
                    <FilterSelect key={c.key} label={c.label} value={query.filters[c.key] ?? ''} items={filterItems(c, options)} onChange={(v) => write({ [`f_${c.key}`]: v || null })} />
                  ))}
                </FilterBar>
              )}
              {rangeCols.length > 0 && (
                <div className={`grid gap-sm md:grid-cols-2 ${pickCols.length > 0 ? 'mt-sm' : ''}`}>
                  {rangeCols.map((c) => (
                    <fieldset key={c.key} className="m-0 min-w-0 border-0 p-0">
                      <legend className="text-subhead text-ink-soft">{c.label}</legend>
                      <div className="mt-xs grid grid-cols-2 gap-xs">
                        <RangeDay label="From" value={query.ranges[c.key]?.from ?? ''} onChange={(v) => write({ [`f_${c.key}_from`]: v })} />
                        <RangeDay label="To" value={query.ranges[c.key]?.to ?? ''} onChange={(v) => write({ [`f_${c.key}_to`]: v })} />
                      </div>
                    </fieldset>
                  ))}
                </div>
              )}
              {filtersOn > 0 && (
                <div className="mt-sm flex justify-end">
                  <Button variant="outline" size="sm" onClick={clearFilters}>
                    Clear filters
                  </Button>
                </div>
              )}
            </Fold>
          )}

          <p className="mt-sm m-0 text-subhead text-ink-soft" aria-live="polite">
            {total === undefined ? '' : `${plural(total, 'row')}${filtersOn || query.q ? ' match' : ''}. `}
            {readNote}
          </p>

          {(pickedRows.length > 0 || allMatch) && (
            <div id="table-picked" tabIndex={-1} className="mt-sm rounded-tile bg-paper p-sm" role="region" aria-label="Selected rows">
              <div className="fill-row-all flex flex-wrap items-center gap-sm">
                <span className="text-subhead font-semibold">
                  {allMatch ? (more ? `${formatCount(more.n)} more match` : `All ${formatCount(total ?? 0)} that match`) : `${formatCount(pickedRows.length)} selected`}
                </span>
                {/* With Select all the rows are not all on this page: Copy takes what is ticked here, so it waits, and the CSV is the server's. */}
                {!allMatch && (
                  <Button size="sm" variant="outline" onClick={() => void copy(toTsv(columns, pickedRows, ctx))}>
                    Copy
                  </Button>
                )}
                <Button size="sm" variant="outline" disabled={allMatch && downloadAll.isPending} onClick={() => (allMatch ? downloadAll.mutate() : saveFile(toCsv(columns, pickedRows, ctx), fileName))}>
                  Download CSV
                </Button>
                {table.archive && view === 'owner' && !archived && (
                  <Button size="sm" variant="outline" disabled={busyActs} onClick={() => start('archive')}>
                    Archive
                  </Button>
                )}
                {acts && (
                  <Button
                    id="table-edit"
                    size="sm"
                    variant="outline"
                    aria-expanded={formFor !== null}
                    aria-disabled={editWhy ? true : undefined}
                    aria-describedby={editWhy ? 'table-edit-why' : undefined}
                    disabled={busyActs}
                    onClick={() => {
                      if (editWhy || !singleId) return;
                      setFormFor((cur) => (cur ? null : singleId));
                    }}
                    className="aria-disabled:pointer-events-none aria-disabled:opacity-50"
                  >
                    Edit
                  </Button>
                )}
                {acts && (
                  <button
                    type="button"
                    id="table-remove"
                    aria-disabled={removeWhy ? true : undefined}
                    aria-describedby={removeWhy ? 'table-remove-why' : undefined}
                    disabled={running}
                    onClick={onRemove}
                    className={`${DELETE_BTN_SM} ${armed ? 'red-armed' : ''} aria-disabled:pointer-events-none aria-disabled:opacity-50`}
                  >
                    {/* The words shown, and apart from them a live line that holds the ask only while it asks (the second tap's pattern). */}
                    <span aria-hidden={armed || undefined}>{armed ? oneWords.ask : verb}</span>
                    <span className="sr-only" aria-live="polite">
                      {armed ? [`${oneWords.ask}.`, oneWords.warn].filter(Boolean).join(' ') : ''}
                    </span>
                  </button>
                )}
                {table.archive && view === 'owner' && archived && (
                  <>
                    <Button size="sm" variant="outline" disabled={busyActs} onClick={() => start('restore')}>
                      Restore
                    </Button>
                    <button
                      type="button"
                      disabled={running}
                      onClick={() => {
                        if (!busyActs) start('delete');
                      }}
                      className={DELETE_BTN_SM}
                    >
                      Delete forever
                    </button>
                  </>
                )}
                {canSelectAll && (
                  <Button size="sm" variant="ghost" onClick={selectAllMatching}>
                    Select all {formatCount(total ?? 0)} that match
                  </Button>
                )}
                {/* Drawn while the sheet it opened asks too (the sheet covers it), so the sheet can hand focus back to it. */}
                {more && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={running}
                    onClick={() => {
                      if (!busyActs) start(more.action);
                    }}
                  >
                    Do the next {formatCount(Math.min(BULK_MAX, more.n))}
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={clearAll}>
                  Clear selection
                </Button>
              </div>
              {/* Why a greyed button waits, in words beside it (never only its colour), and read with it. While a second tap asks, what goes with
                  the row, shown here and said with the ask inside the button (so it is not read twice). */}
              {(editWhy || removeWhy || (armed && oneWords.warn)) && (
                <div className="mt-xs grid gap-xs">
                  {armed && oneWords.warn && (
                    <p className="m-0 text-caption text-ink-soft" aria-hidden="true">
                      {oneWords.warn}
                    </p>
                  )}
                  {editWhy && (
                    <p id="table-edit-why" className="m-0 text-caption text-ink-soft">
                      {reasonFor('Edit', editWhy)}
                    </p>
                  )}
                  {removeWhy && (
                    <p id="table-remove-why" className="m-0 text-caption text-ink-soft">
                      {reasonFor(verb, removeWhy)}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
          {said && (
            <p role="status" className="mt-xs m-0 text-subhead text-ink-soft">
              {said}
            </p>
          )}
          {statusLine && (
            <p role={statusLine.said ? undefined : 'status'} className="mt-xs m-0 text-subhead">
              {statusLine.words}
            </p>
          )}
          <ErrorLine e={editError} className="mt-xs" />
          <ErrorLine e={bulk.error ?? remove.error ?? prepare.error ?? downloadAll.error} className="mt-xs" />
          {pageQ.isError && data && <ErrorLine e={pageQ.error} className="mt-xs" />}

          <div className="mt-sm">
            {data ? (
              <ServerTable
                label={table.name}
                columns={columns}
                rows={data.rows}
                options={options}
                currency={currency}
                sort={{ key: query.sort, dir: query.dir }}
                onSort={onSort}
                picked={shownPicks}
                onPick={onPick}
                editor={editor}
                form={formRow && editor ? { rowId: formRow, key: formFor ?? formRow, onDone: closeForm, opener: () => document.getElementById('table-edit') } : null}
                busy={waiting || busyActs}
                empty={filtersOn || query.q ? 'No rows match. Clear the filters or the search to see every row.' : archived ? 'Nothing archived.' : 'Nothing here yet.'}
              />
            ) : pageQ.isError ? (
              <ErrorLine e={pageQ.error} />
            ) : (
              <Skeleton className="h-[320px] rounded-card" />
            )}
          </div>
          <PagerBar
            always
            page={data?.page}
            total={total}
            only={ALL_SIZES}
            label={table.name}
            onPage={toPage}
            // The first and last page from the width a phone's line can hold them (`hidden` with the display class only in the variant). Drawn
            // here, not in the pager, so the lists in the first download carry none of it.
            before={
              pages !== undefined &&
              data && (
                <span className="hidden sm:inline-flex">
                  <IconButton icon={ChevronsLeft} label="First page" tip="tl" disabled={data.page.page <= 1} onClick={() => toPage(1, data.page.size)} />
                </span>
              )
            }
            after={
              pages !== undefined &&
              data && (
                <span className="hidden sm:inline-flex">
                  <IconButton icon={ChevronsRight} label="Last page" disabled={!data.page.more || data.page.page >= pages} onClick={() => toPage(pages, data.page.size)} />
                </span>
              )
            }
          />
        </div>
      )}

      <ConfirmDelete
        open={ask !== null}
        title={ask?.action === 'remove' && words ? words.title : `Delete ${askCount} forever?`}
        body={ask?.action === 'remove' && words ? [previewLine(ask.preview), words.warn].filter(Boolean).join(' ') : 'They leave the archive and cannot come back.'}
        yes={ask?.action === 'remove' && words ? words.yes : ask?.ids.length === 1 ? 'Yes, delete it forever' : 'Yes, delete them forever'}
        keep={ask?.action === 'remove' && words ? words.keep : ask?.ids.length === 1 ? 'Keep it' : 'Keep them'}
        pending={bulk.isPending || remove.isPending}
        failed={bulk.isError || remove.isError}
        error={(remove.error ?? bulk.error) instanceof Error ? (remove.error ?? bulk.error)?.message : undefined}
        onYes={() => {
          if (!ask) return;
          if (ask.action === 'remove') remove.mutate({ ids: ask.ids, of: ask.of });
          else bulk.mutate({ action: 'delete', ids: ask.ids, of: ask.of });
        }}
        onClose={() => setAsk(null)}
      />
    </Screen>
  );
}

function NoTable({ subject }: { subject: TablesSubject }) {
  return (
    <Screen howTo={false}>
      <AppCover cover="tables" back={{ to: tablesPath(subject), label: subject.view === 'owner' ? 'All tables' : 'Their tables' }} title="No such table" lede="This table is not here. Pick one from the list." />
    </Screen>
  );
}

/**
 * The person's own table whose app is hidden or off for them (the server answers 404 too): which app to show, and the way to Apps. When none
 * of its apps is available on their account (the team switched it off, a rollout, a role), Apps cannot show it, so the page says so in the
 * module gate's own words and offers no way to Apps (the review, 2026-11-14).
 */
function AppOff({ table, apps }: { table: DataTable; apps: readonly string[] }) {
  const { modules } = useModules();
  const needs = table.needs ?? [];
  // Its app is on and only the setting inside it is off (Business metrics in Reviews): the switch, and the way to it.
  if (table.needsSwitch && tableAppsOn({ ...table, needsSwitch: undefined }, apps)) {
    const sw = TABLE_SWITCHES[table.needsSwitch];
    return (
      <Screen howTo={false}>
        <AppCover cover="tables" back={{ to: '/tables', label: 'All tables' }} title={table.name} lede={`Turn on ${sw.name} in ${sw.where} to open this table.`} />
        <p className="mt-lg m-0">
          <Link to={sw.path} className="inline-flex min-h-[44px] items-center text-subhead font-semibold underline underline-offset-4">
            Open {sw.where}
          </Link>
        </p>
      </Screen>
    );
  }
  const name = (k: string) => MODULE_BY_KEY[k]?.name ?? k;
  const showable = needs.filter((k) => modules.some((m) => m.key === k && m.available));
  const orList = (xs: string[]) => (xs.length <= 1 ? (xs[0] ?? 'its app') : `${xs.slice(0, -1).join(', ')} or ${xs.at(-1)}`);
  const lede = showable.length > 0 ? `Show ${orList(showable.map(name))} in Apps to open this table.` : `${andList(needs.map(name)) || 'Its app'} ${needs.length > 1 ? 'are' : 'is'} not available on your account.`;
  return (
    <Screen howTo={false}>
      <AppCover cover="tables" back={{ to: '/tables', label: 'All tables' }} title={table.name} lede={lede} />
      {showable.length > 0 && (
        <p className="mt-lg m-0">
          <Link to="/apps" className="inline-flex min-h-[44px] items-center text-subhead font-semibold underline underline-offset-4">
            Open Apps
          </Link>
        </p>
      )}
    </Screen>
  );
}

function TablePage({ subject, tableKey }: { subject: TablesSubject; tableKey: string }) {
  const table = dataTableByKey[tableKey];
  const apps = useAppsOn();
  const { ready } = useModules();
  // A coach's or an admin's screen cannot know the other person's apps; the server answers 404 there, which the page says plainly.
  if (!table || !tableAllowed(table, subject.view === 'coach' ? 'owner' : subject.view, [], null)) return <NoTable subject={subject} />;
  if (subject.view === 'owner' && ready && !tableAllowed(table, 'owner', [], apps)) return <AppOff table={table} apps={apps} />;
  // Keyed by whose table and which one, so moving between tables starts fresh (no rows of one under the columns of another).
  return <Grid key={`${subjectKey(subject)}:${table.key}`} table={table} subject={subject} />;
}

/** One of the person's own tables (`/tables/:table`). */
export function TableView() {
  const { table = '' } = useParams();
  return <TablePage subject={{ view: 'owner' }} tableKey={table} />;
}

/** One table a student shared with this coach (`/coaching/students/:id/tables/:table`), read only. The server checks the share every time. */
export function CoachTableView() {
  const { id = '', table = '' } = useParams();
  return <TablePage subject={{ view: 'coach', id }} tableKey={table} />;
}

/** One of a member's tables for a super admin (`/admin/people/:id/tables/:table`), read only and written to the audit log. */
export function AdminTableView() {
  const { id = '', table = '' } = useParams();
  const me = useMe();
  if (!me.data) return null;
  if (me.data.user.role !== 'admin') return <OnlyAdmins />;
  return <TablePage subject={{ view: 'admin', id }} tableKey={table} />;
}
