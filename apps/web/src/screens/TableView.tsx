import { formatCount, type ConsentChoices } from '@kreators/shared';
import {
  aiPrivateOnly,
  BULK_MAX,
  columnFor,
  csvMaxRows,
  DATA_TABLE_GROUPS,
  dataTableByKey,
  isRealDay,
  parseTableQuery,
  SEARCH_MAX,
  TABLE_DEFAULT_SIZE,
  tableAllowed,
  tableColumn,
  tableEditable,
  tableQueryString,
  toCsv,
  toTsv,
  visibleColumns,
  type Cell,
  type ColumnOption,
  type DataColumn,
  type DataTable,
  type TableBulkAction,
  type TableEditResponse,
  type TablePageResponse,
  type TableQuery,
  type TableRow,
} from '@kreators/shared/dataTables';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronsLeft, ChevronsRight, Download } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { AppCover } from '../components/AppCover';
import { Button } from '../components/Button';
import { TableSwitches, useAiChatOn, useTableCoaches } from '../components/TableSwitches';
import { ConfirmDelete, DELETE_BTN } from '../components/ConfirmDelete';
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
import { useConsent } from '../lib/consent';
import { todayLocal } from '../lib/date';
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

const DONE_WORD: Record<TableBulkAction, string> = { archive: 'archived', restore: 'restored', delete: 'deleted forever' };

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
  const pick = (rows: readonly TableRow[], on: boolean) =>
    setPicked((cur) => {
      const next = new Map(cur);
      for (const r of rows) {
        if (on) next.set(r.id, r);
        else next.delete(r.id);
      }
      return next;
    });

  const [status, setStatus] = useState<string | null>(null);
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
  const editor: ServerTableEditor | undefined =
    view === 'owner' && query.view !== 'archived' && tableEditable(table)
      ? {
          editable: (row, col) => Boolean(row.edit?.includes(col.key)),
          save: (row, col, value) => {
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
                qc.setQueryData<TablePageResponse>(pageKey, (cur) => (cur ? applyEdit(cur, id, res) : cur));
                if (!res.row || res.gone) {
                  const had = totals.current.get(countKey);
                  if (had !== undefined) totals.current.set(countKey, Math.max(0, had - 1));
                  setStatus('Saved. That row left this list.');
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
                setEditError(e);
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

  // Archive, Restore and Delete forever (only on a table the app already archives): at most BULK_MAX ids a call, and again with what the
  // server did not reach in one go (its round trips are shared by everyone on the free plan).
  const [asking, setAsking] = useState(false);
  // What the rounds so far did, kept outside the call: a later round that fails (offline, a limit) still un-ticks and reads again what the
  // earlier ones archived or deleted, and the error stays on screen.
  const doneSoFar = useRef<string[]>([]);
  const bulk = useMutation({
    mutationFn: async (action: TableBulkAction) => {
      doneSoFar.current = [];
      let queue = [...picked.keys()];
      const done: string[] = [];
      const skipped: { id: string; why: string }[] = [];
      for (let round = 0; queue.length > 0 && round < 20; round++) {
        const ids = queue.slice(0, BULK_MAX);
        const r = await tablesApi.bulk(table.key, { action, ids, today: todayLocal() });
        done.push(...r.done);
        doneSoFar.current.push(...r.done);
        skipped.push(...r.skipped);
        if (r.done.length === 0 && r.skipped.length === 0) break;
        queue = [...r.left, ...queue.slice(BULK_MAX)];
      }
      return { action, done, skipped, left: queue };
    },
    onSuccess: ({ action, done, skipped, left }) => {
      setAsking(false);
      const whys = new Map<string, number>();
      for (const s of skipped) whys.set(s.why, (whys.get(s.why) ?? 0) + 1);
      const parts = [done.length ? `${plural(done.length, 'row')} ${DONE_WORD[action]}.` : 'Nothing changed.'];
      for (const [why, n] of whys) parts.push(`${plural(n, 'row')} left as ${n === 1 ? 'it was' : 'they were'}: ${why}`);
      if (left.length) parts.push(`${plural(left.length, 'row')} not reached. Try again.`);
      setStatus(parts.join(' '));
    },
    onSettled: () => {
      const done = doneSoFar.current;
      if (done.length)
        setPicked((cur) => {
          const next = new Map(cur);
          for (const id of done) next.delete(id);
          return next;
        });
      totals.current.clear();
      void qc.invalidateQueries({ queryKey: ['table-page', sk, table.key] });
      markStale();
    },
  });

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
  const back = { to: tablesPath(subject), label: view === 'owner' ? 'All tables' : 'Their tables' };
  const notHere = pageQ.error instanceof ApiError && pageQ.error.status === 404;
  const readNote =
    view === 'coach'
      ? `Read only. ${name || 'Your student'} shares this table with you and can switch it off.`
      : view === 'admin'
        ? 'Read only. Opening or downloading this table is written to the audit log.'
        : archived
          ? 'These are archived. Restore them, or delete them forever.'
          : tableEditable(table)
            ? 'Tap a cell under a pencil to change it. It saves the same way it does anywhere else in the app.'
            : (table.readOnlyWhy ?? 'Read only.');
  const moreItems =
    total !== undefined && total > 0
      ? [{ key: 'all', label: `Download all ${plural(total, 'row')}`, icon: Download, disabled: downloadAll.isPending, onSelect: () => downloadAll.mutate() }]
      : [];

  return (
    <Screen howTo={false}>
      {/* The table's line speaks to its owner ("Every task you made"); a coach or an admin reads the read-only line under the controls instead. */}
      {/* The owner's Show to my coach and Show to AI chat sit in the cover's action slot: left of the line on a laptop, under it on a phone (app.css). */}
      <AppCover cover="tables" back={back} eyebrow={view === 'owner' ? group : name || undefined} title={table.name} lede={view === 'owner' ? table.blurb : undefined} actions={view === 'owner' && (coaches.length > 0 || aiOn) ? <TableSwitches table={table.key} coaches={coaches} ai={aiOn} privateOnly={aiPrivateOnly(table)} /> : undefined} />

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

          {pickedRows.length > 0 && (
            <div className="fill-row-all mt-sm flex flex-wrap items-center gap-sm rounded-tile bg-paper p-sm" role="region" aria-label="Selected rows">
              <span className="text-subhead font-semibold">{formatCount(pickedRows.length)} selected</span>
              <Button size="sm" variant="outline" onClick={() => void copy(toTsv(columns, pickedRows, ctx))}>
                Copy
              </Button>
              <Button size="sm" variant="outline" onClick={() => saveFile(toCsv(columns, pickedRows, ctx), fileName)}>
                Download CSV
              </Button>
              {table.archive && view === 'owner' && !archived && (
                <Button size="sm" variant="outline" disabled={bulk.isPending} onClick={() => bulk.mutate('archive')}>
                  Archive
                </Button>
              )}
              {table.archive && view === 'owner' && archived && (
                <>
                  <Button size="sm" variant="outline" disabled={bulk.isPending} onClick={() => bulk.mutate('restore')}>
                    Restore
                  </Button>
                  <button
                    type="button"
                    disabled={bulk.isPending}
                    onClick={() => {
                      bulk.reset();
                      setAsking(true);
                    }}
                    className={DELETE_BTN}
                  >
                    Delete forever
                  </button>
                </>
              )}
              <Button size="sm" variant="ghost" onClick={() => setPicked(new Map())}>
                Clear
              </Button>
            </div>
          )}
          {said && (
            <p role="status" className="mt-xs m-0 text-subhead text-ink-soft">
              {said}
            </p>
          )}
          {status && (
            <p role="status" className="mt-xs m-0 text-subhead">
              {status}
            </p>
          )}
          <ErrorLine e={editError} className="mt-xs" />
          <ErrorLine e={bulk.error ?? downloadAll.error} className="mt-xs" />
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
                picked={new Set(picked.keys())}
                onPick={pick}
                editor={editor}
                busy={waiting || bulk.isPending}
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
        open={asking}
        title={`Delete ${plural(picked.size, 'row')} forever?`}
        body="They leave the archive and cannot come back."
        yes={picked.size === 1 ? 'Yes, delete it forever' : 'Yes, delete them forever'}
        keep={picked.size === 1 ? 'Keep it' : 'Keep them'}
        pending={bulk.isPending}
        failed={bulk.isError}
        error={bulk.error instanceof Error ? bulk.error.message : undefined}
        onYes={() => bulk.mutate('delete')}
        onClose={() => setAsking(false)}
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

function TablePage({ subject, tableKey }: { subject: TablesSubject; tableKey: string }) {
  const table = dataTableByKey[tableKey];
  if (!table || !tableAllowed(table, subject.view === 'coach' ? 'owner' : subject.view)) return <NoTable subject={subject} />;
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
