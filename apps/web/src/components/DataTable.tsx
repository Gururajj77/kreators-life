import type { Page, PageSize } from '@kreators/shared';
import { useMemo, useState, type ReactNode, type SelectHTMLAttributes } from 'react';
import { Button } from './Button';
import { PagerBar } from './Pager';

export type CellValue = string | number | boolean | null | undefined;

/** How a cell is edited in place. The change is sent at once; the row re-renders when the server answers. */
export interface EditSpec<T> {
  kind: 'text' | 'number' | 'select' | 'toggle';
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  step?: number;
  onEdit: (row: T, value: string | number | boolean) => void | Promise<void>;
  disabled?: (row: T) => boolean;
}

export interface Column<T> {
  key: string;
  label: string;
  /** The plain value: it is what sorting, filtering and search read. */
  get: (row: T) => CellValue;
  /** How the cell is drawn when it is not an input. Defaults to the plain value. */
  render?: (row: T) => ReactNode;
  /** A select of every value this column holds, above the table. */
  filter?: boolean;
  edit?: EditSpec<T>;
  align?: 'left' | 'right';
  sortable?: boolean;
  /** Hidden on a phone, shown from a laptop up. */
  wide?: boolean;
  /** Long text that may run onto several lines. Everything else stays on one line and the table scrolls sideways. */
  wrap?: boolean;
}

export interface BulkAction<T> {
  label: string;
  onClick: (rows: T[]) => void | Promise<void>;
  variant?: 'primary' | 'outline' | 'ghost';
}

interface Props<T> {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  /** What the table holds, for the screen reader and the count line. */
  label: string;
  search?: boolean;
  selectable?: boolean;
  bulk?: BulkAction<T>[];
  /** Buttons at the end of each row. */
  actions?: (row: T) => ReactNode;
  pageSize?: number;
  /** Where the server's page is. With it, the table shows the pager bar and never slices rows itself. */
  page?: Page;
  onPage?: (page: number, size: PageSize) => void;
  empty?: string;
  busy?: boolean;
  onRowClick?: (row: T) => void;
  activeKey?: string | null;
}

const text = (v: CellValue) => (v === null || v === undefined ? '' : typeof v === 'boolean' ? (v ? 'yes' : 'no') : String(v));
const field = 'min-h-[44px] w-full min-w-[120px] rounded-tile border-2 border-line bg-paper px-sm text-[14px] font-bold';

function compare(a: CellValue, b: CellValue): number {
  if (a === b) return 0;
  if (a === null || a === undefined || a === '') return 1;
  if (b === null || b === undefined || b === '') return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(b) - Number(a);
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

/** A select sized for a table row or a filter bar. The chevron and its room come from the stylesheet, like every select in the app. */
export function Select({ className = '', selectClass = '', children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { selectClass?: string }) {
  return (
    <span className={`block ${className}`}>
      <select {...rest} className={`min-h-[44px] w-full border-2 border-line pl-sm text-[14px] font-bold ${selectClass}`}>
        {children}
      </select>
    </span>
  );
}

/** A small switch for a cell. Same look as the app's Toggle, without a label of its own. */
function Switch({ on, onChange, disabled, label }: { on: boolean; onChange: (on: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)} className={`relative h-[24px] w-[44px] shrink-0 rounded-pill transition-colors disabled:opacity-50 ${on ? 'bg-r4' : 'bg-line'}`}>
      <span className={`absolute top-[2px] left-[2px] size-[20px] rounded-pill bg-card shadow-toy-soft transition-transform ${on ? 'translate-x-[20px]' : ''}`} aria-hidden="true" />
    </button>
  );
}

/**
 * One table for every admin list: sort by any column, search across all of them, filter a column by
 * its values, tick rows and act on them together, and edit a cell where it sits. Scrolls sideways on
 * a phone instead of squeezing. Nothing here talks to the server; the columns say what each edit does.
 */
export function DataTable<T>({ rows, columns, rowKey, label, search = true, selectable = false, bulk = [], actions, pageSize = 25, page: serverPage, onPage, empty = 'Nothing here.', busy = false, onRowClick, activeKey = null }: Props<T>) {
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);
  const [q, setQ] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [shown, setShown] = useState(pageSize);
  const [draft, setDraft] = useState<Record<string, string>>({});

  const options = useMemo(() => {
    const out: Record<string, string[]> = {};
    for (const c of columns) {
      if (!c.filter) continue;
      out[c.key] = [...new Set(rows.map((r) => text(c.get(r))))].sort((a, b) => a.localeCompare(b));
    }
    return out;
  }, [rows, columns]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = rows.filter((r) => {
      for (const [k, v] of Object.entries(filters)) {
        if (!v) continue;
        const c = columns.find((x) => x.key === k);
        if (c && text(c.get(r)) !== v) return false;
      }
      if (!needle) return true;
      return columns.some((c) => text(c.get(r)).toLowerCase().includes(needle));
    });
    if (sort) {
      const c = columns.find((x) => x.key === sort.key);
      if (c) {
        list = [...list].sort((a, b) => compare(c.get(a), c.get(b)) * (sort.dir === 'asc' ? 1 : -1));
      }
    }
    return list;
  }, [rows, columns, filters, q, sort]);

  const page = serverPage ? visible : visible.slice(0, shown);
  const pickedRows = rows.filter((r) => picked.has(rowKey(r)));
  const allOnPagePicked = page.length > 0 && page.every((r) => picked.has(rowKey(r)));
  const togglePage = () => {
    const next = new Set(picked);
    if (allOnPagePicked) page.forEach((r) => next.delete(rowKey(r)));
    else page.forEach((r) => next.add(rowKey(r)));
    setPicked(next);
  };
  const toggleSort = (c: Column<T>) => {
    if (c.sortable === false) return;
    setSort((s) => (s?.key === c.key ? (s.dir === 'asc' ? { key: c.key, dir: 'desc' } : null) : { key: c.key, dir: 'asc' }));
  };
  const cols = columns.length + (selectable ? 1 : 0) + (actions ? 1 : 0);

  const cell = (c: Column<T>, r: T) => {
    const e = c.edit;
    if (!e) return c.render ? c.render(r) : text(c.get(r));
    const off = busy || Boolean(e.disabled?.(r));
    const id = `${rowKey(r)}:${c.key}`;
    const v = c.get(r);
    if (e.kind === 'toggle') return <Switch on={Boolean(v)} disabled={off} label={`${c.label}`} onChange={(on) => void e.onEdit(r, on)} />;
    if (e.kind === 'select')
      return (
        <Select value={text(v)} disabled={off} aria-label={c.label} onChange={(ev) => void e.onEdit(r, ev.target.value)} className="min-w-[140px]" selectClass="rounded-tile bg-paper">
          {(e.options ?? []).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      );
    const current = draft[id] ?? text(v);
    const commit = () => {
      if (draft[id] === undefined || draft[id] === text(v)) return;
      void e.onEdit(r, e.kind === 'number' ? Number(draft[id]) : draft[id]!);
      setDraft((d) => {
        const next = { ...d };
        delete next[id];
        return next;
      });
    };
    return (
      <input
        type={e.kind === 'number' ? 'number' : 'text'}
        value={current}
        min={e.min}
        max={e.max}
        step={e.step}
        disabled={off}
        aria-label={c.label}
        onChange={(ev) => setDraft((d) => ({ ...d, [id]: ev.target.value }))}
        onBlur={commit}
        onKeyDown={(ev) => {
          if (ev.key === 'Enter') (ev.target as HTMLInputElement).blur();
        }}
        className={field}
      />
    );
  };

  return (
    <div>
      {(search || Object.keys(options).length > 0) && (
        <div className="flex flex-wrap items-center gap-sm">
          {search && <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter this list" aria-label={`Filter ${label}`} autoComplete="off" className="min-h-[44px] min-w-[240px] flex-1 rounded-pill border-2 border-line bg-card px-md text-[14px] font-semibold" />}
          {columns
            .filter((c) => c.filter)
            .map((c) => (
              <label key={c.key} className="flex min-w-[160px] flex-1 items-center gap-xs sm:flex-none">
                <span className="shrink-0 text-[12px] font-extrabold uppercase tracking-wide text-ink-soft">{c.label}</span>
                <Select value={filters[c.key] ?? ''} aria-label={`Filter by ${c.label}`} onChange={(e) => setFilters((f) => ({ ...f, [c.key]: e.target.value }))} className="min-w-[140px] flex-1 sm:flex-none" selectClass="rounded-pill bg-card">
                  <option value="">All</option>
                  {(options[c.key] ?? []).map((o) => (
                    <option key={o} value={o}>
                      {o || '(empty)'}
                    </option>
                  ))}
                </Select>
              </label>
            ))}
          <span className="shrink-0 text-[14px] font-bold text-ink-soft">
            {visible.length} of {rows.length}
          </span>
        </div>
      )}
      {selectable && pickedRows.length > 0 && (
        <div className="mt-sm flex flex-wrap items-center gap-sm rounded-tile bg-paper p-md" role="region" aria-label="Selected rows">
          <span className="text-[14px] font-bold">
            {pickedRows.length} {pickedRows.length === 1 ? 'row' : 'rows'} ticked
          </span>
          {bulk.map((b) => (
            <Button key={b.label} size="sm" variant={b.variant ?? 'outline'} disabled={busy} onClick={() => void b.onClick(pickedRows)}>
              {b.label}
            </Button>
          ))}
          <Button size="sm" variant="ghost" onClick={() => setPicked(new Set())}>
            Clear
          </Button>
        </div>
      )}
      <div className="mt-sm overflow-x-auto rounded-card bg-card shadow-toy-soft">
        <table className="w-full border-collapse text-left" aria-label={label} aria-busy={busy}>
          <thead>
            <tr className="border-b-2 border-line">
              {selectable && (
                <th scope="col" className="w-[56px] px-sm py-sm">
                  <input type="checkbox" checked={allOnPagePicked} onChange={togglePage} aria-label="Tick every row shown" className="size-[20px] accent-ink" />
                </th>
              )}
              {columns.map((c) => {
                const active = sort?.key === c.key;
                return (
                  <th key={c.key} scope="col" aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'} className={`whitespace-nowrap px-md py-sm text-[12px] font-extrabold uppercase tracking-wide text-ink-soft ${c.align === 'right' ? 'text-right' : ''} ${c.wide ? 'hidden md:table-cell' : ''}`}>
                    {c.sortable === false ? (
                      c.label
                    ) : (
                      <button type="button" onClick={() => toggleSort(c)} className={`inline-flex min-h-[32px] items-center gap-xs rounded-pill hover:text-ink ${active ? 'text-ink' : ''}`}>
                        {c.label}
                        <span aria-hidden="true" className="text-[10px]">
                          {active ? (sort.dir === 'asc' ? '▲' : '▼') : '△'}
                        </span>
                      </button>
                    )}
                  </th>
                );
              })}
              {actions && (
                <th scope="col" className="whitespace-nowrap px-md py-sm text-[12px] font-extrabold uppercase tracking-wide text-ink-soft">
                  <span className="sr-only">Actions</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {page.length === 0 && (
              <tr>
                <td colSpan={cols} className="px-md py-lg text-[14px] font-semibold text-ink-soft">
                  {rows.length === 0 ? empty : 'Nothing matches.'}
                </td>
              </tr>
            )}
            {page.map((r) => {
              const k = rowKey(r);
              const isActive = activeKey === k;
              return (
                <tr key={k} onClick={onRowClick ? () => onRowClick(r) : undefined} className={`border-t border-line align-middle ${onRowClick ? 'cursor-pointer hover:bg-paper' : ''} ${isActive ? 'bg-paper' : ''}`}>
                  {selectable && (
                    <td className="px-sm py-sm" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={picked.has(k)}
                        onChange={(e) => {
                          const next = new Set(picked);
                          if (e.target.checked) next.add(k);
                          else next.delete(k);
                          setPicked(next);
                        }}
                        aria-label="Tick this row"
                        className="size-[20px] accent-ink"
                      />
                    </td>
                  )}
                  {columns.map((c) => (
                    <td key={c.key} onClick={c.edit ? (e) => e.stopPropagation() : undefined} className={`px-md py-sm text-[14px] font-semibold leading-snug ${c.wrap ? 'min-w-[120px] max-w-[320px]' : 'whitespace-nowrap'} ${c.align === 'right' ? 'text-right' : ''} ${c.wide ? 'hidden md:table-cell' : ''}`}>
                      {cell(c, r)}
                    </td>
                  ))}
                  {actions && (
                    <td className="whitespace-nowrap px-md py-sm" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-xs">{actions(r)}</div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {serverPage && onPage && <PagerBar page={serverPage} onPage={onPage} label={label} />}
      {!serverPage && visible.length > shown && (
        <div className="mt-sm flex items-center justify-between gap-sm">
          <span className="text-[12px] font-bold text-ink-soft">
            Showing {page.length} of {visible.length}
          </span>
          <Button variant="outline" size="sm" onClick={() => setShown((n) => n + pageSize)}>
            Show more
          </Button>
        </div>
      )}
    </div>
  );
}
