import { formatCount, LOCALE, typedCents } from '@kreators/shared';
import { cellText, editValue, type Cell, type ColumnOption, type DataColumn, type TableRow } from '@kreators/shared/dataTables';
import { ArrowDown, ArrowUp, ArrowUpDown, ArrowUpRight, Pencil } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Link } from 'react-router';
import { clockOf, longDate, stamp } from '../lib/date';
import { FIELD_CELL } from '../lib/ui';
import { showFocused, Switch } from './DataTable';
import { Icon } from './Icon';
import { Inert } from './Inert';

/**
 * The grid of All tables (2026-11-13): DataTable's look (the card that scrolls sideways on a phone, the ticks, the sort buttons, the cell
 * inputs), but every sort, filter, search and page is the server's, so it draws exactly the rows it is given and never reorders them. A
 * cell the owner may change is a quiet button: a tap or Enter opens the right input, Enter or leaving it saves, Escape puts it back. A
 * yes-or-no cell is the switch itself. A cell nobody may change is plain words and never looks like a control.
 */

export interface ServerTableEditor {
  /** May this cell of this row be changed now (the server's `row.edit`). */
  editable: (row: TableRow, col: DataColumn) => boolean;
  /** Saves it; rejects when it did not save (the screen puts the old value back and says why). */
  save: (row: TableRow, col: DataColumn, value: Cell) => Promise<void>;
}

interface Props {
  /** The table's name, for the screen reader. */
  label: string;
  columns: readonly DataColumn[];
  rows: readonly TableRow[];
  /** The person's own choices for the columns that name them (a time block, a project), from the page answer. */
  options: Readonly<Record<string, ColumnOption[]>>;
  /** The subject's own currency, for money in their currency. */
  currency: string;
  sort: { key: string; dir: 'asc' | 'desc' };
  onSort: (key: string) => void;
  /** The ticked rows' ids, or null for a table with no ticks. */
  picked: ReadonlySet<string> | null;
  onPick: (rows: readonly TableRow[], on: boolean) => void;
  editor?: ServerTableEditor;
  busy: boolean;
  empty: ReactNode;
}

const NUMBER = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 2 });
const KM = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 });
/** Long words in a cell are cut here with "Show all" beside them; Copy and the CSV keep every word. */
const CUT_AT = 240;

function plainNumber(n: number): string {
  return Number.isInteger(n) ? formatCount(n) : NUMBER.format(n);
}

/** A number with what it counts, in words a person reads. */
function numberWords(col: DataColumn, n: number): string {
  switch (col.format) {
    case 'minutes':
      return `${plainNumber(n)} min`;
    case 'hours':
      return `${NUMBER.format(n)} h`;
    case 'ml':
      return `${formatCount(Math.round(n))} ml`;
    case 'grams':
      return `${NUMBER.format(n)} g`;
    case 'km':
      return `${KM.format(n / 1000)} km`;
    case 'percent':
      return `${NUMBER.format(n)}%`;
    case 'signed':
      return n > 0 ? `+${plainNumber(n)}` : n < 0 ? `−${plainNumber(-n)}` : '0';
    default:
      return plainNumber(n);
  }
}

/** One cell as words, the way the screen shows it (dates and times in the person's own format and zone through lib/date.ts). */
export function cellWords(col: DataColumn, cells: Readonly<Record<string, Cell>>, ctx: { options: Readonly<Record<string, ColumnOption[]>>; currency: string }): string {
  const v = cells[col.key] ?? null;
  if (col.kind === 'bool') return v === null ? '' : v ? 'Yes' : 'No';
  if (col.kind === 'enum' || col.kind === 'money') return cellText(col, cells, ctx);
  if (v === null || v === '') return '';
  if (col.kind === 'number' && typeof v === 'number') return numberWords(col, v);
  if (typeof v !== 'string') return String(v);
  if (col.kind === 'date') return /^\d{4}-\d{2}-\d{2}$/.test(v) ? longDate(v) : v;
  if (col.kind === 'datetime') return stamp(v) || v;
  if (col.kind === 'time') return clockOf(v);
  if (col.format === 'handle') return `@${v}`;
  return v;
}

/** An in-app address only (a path of this app, never another site), for the inbox's "Opens" cell. */
const appPath = (v: string): boolean => /^\/(?!\/)[^\s\\]*$/.test(v);

function LongWords({ text, inert, id }: { text: string; inert: boolean; id: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > CUT_AT;
  const shown = long && !open ? `${text.slice(0, CUT_AT).trimEnd()}…` : text;
  return (
    <span className="block whitespace-pre-line">
      <span id={id}>{inert ? <Inert text={shown} /> : shown}</span>
      {long && (
        <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)} className="tap-pad ml-xs inline-flex min-h-[36px] items-center rounded-pill text-subhead font-semibold underline underline-offset-4">
          {open ? 'Show less' : 'Show all'}
        </button>
      )}
    </span>
  );
}

/** The cell as drawn (not editing). */
function CellView({ col, row, ctx }: { col: DataColumn; row: TableRow; ctx: { options: Readonly<Record<string, ColumnOption[]>>; currency: string } }) {
  const v = row.cells[col.key] ?? null;
  if (col.format === 'appLink' && typeof v === 'string' && v) {
    return appPath(v) ? (
      <Link to={v} className="tap-pad inline-flex min-h-[36px] items-center gap-xs rounded-pill font-semibold underline underline-offset-4">
        Open
        <Icon icon={ArrowUpRight} size={14} className="read-arrow" />
      </Link>
    ) : null;
  }
  const words = cellWords(col, row.cells, ctx);
  if (!words) return null;
  if (col.kind === 'longtext' || col.kind === 'summary' || col.kind === 'text') return <LongWords text={words} inert={col.format === 'inert'} id={`cell-${row.id}-${col.key}`} />;
  return <>{words}</>;
}

/** Integer cents as the words a money field starts with ("1250.50"), never through a float. */
function centsField(c: number): string {
  const abs = Math.abs(Math.trunc(c));
  return `${c < 0 ? '-' : ''}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

/** The choices a select edit offers: the person's own list or the column's words, with "none" first where a cell may be emptied. */
function choicesOf(col: DataColumn, options: Readonly<Record<string, ColumnOption[]>>): ColumnOption[] {
  const edit = col.edit;
  const all = edit?.choices ? (options[col.key] ?? []) : [...(col.options ?? [])];
  // A state the app moves by itself (a listing sold) is shown in the cell, never offered here.
  const list = edit?.offer ? all.filter((o) => edit.offer!.includes(o.value)) : all;
  return edit?.nullable && edit.clearLabel && !list.some((o) => o.isNull) ? [{ value: '', label: edit.clearLabel, isNull: true }, ...list] : list;
}

/** The value an editing cell starts from. */
function startValue(col: DataColumn, row: TableRow, choices: readonly ColumnOption[]): string {
  const edit = col.edit;
  const v = edit?.current ? (row.cells[edit.current] ?? null) : (row.cells[col.key] ?? null);
  if (edit?.input === 'money') return typeof v === 'number' ? centsField(v) : '';
  if (edit?.input === 'select') return v === null ? (choices.find((o) => o.isNull)?.value ?? '') : String(v);
  return v === null ? '' : String(v);
}

/** What a draft is sent as. Money is read from its digits (typedCents), never through a float. */
function draftValue(col: DataColumn, draft: string): Cell | { error: string } {
  const input = col.edit?.input;
  const t = draft.trim();
  if (input === 'number') return t === '' ? null : Number.isFinite(Number(t)) ? Number(t) : { error: 'Type a number.' };
  if (input === 'money') {
    if (t === '') return null;
    const c = typedCents(t);
    return Number.isFinite(c) ? c : { error: 'Type an amount, like 1,250.50.' };
  }
  if (input === 'date' || input === 'time' || input === 'select') return draft === '' ? null : draft;
  return draft;
}

function EditCell({ col, row, options, onDone, save }: { col: DataColumn; row: TableRow; options: Readonly<Record<string, ColumnOption[]>>; onDone: (focusBack: boolean) => void; save: (value: Cell) => Promise<void> }) {
  const edit = col.edit;
  const choices = choicesOf(col, options);
  const first = startValue(col, row, choices);
  const [draft, setDraft] = useState(first);
  const [error, setError] = useState<string | null>(null);
  const settled = useRef(false);
  const field = useRef<HTMLElement | null>(null);
  const keep = (el: HTMLElement | null) => {
    field.current = el;
  };
  useEffect(() => {
    const el = field.current;
    el?.focus();
    // A word field starts with its words picked, so typing replaces them; a list opens its choices where the browser can (the tap or the
    // Enter that opened it still counts as the person's own action); a date or a time keeps its own way in.
    if ((el instanceof HTMLInputElement && el.type === 'text') || el instanceof HTMLTextAreaElement) el.select();
    if (el instanceof HTMLSelectElement && typeof el.showPicker === 'function') {
      try {
        el.showPicker();
      } catch {
        // Not allowed here: the list opens on the next tap, as any select does.
      }
    }
  }, []);
  if (!edit) return null;
  const errorId = `edit-error-${row.id}-${col.key}`;
  // `back`: the keyboard asked (Enter, Escape, a pick in the list), so focus goes back to the cell; a tap elsewhere keeps its own focus.
  const commit = (raw: string, back = true) => {
    if (settled.current) return;
    if (raw === first) {
      settled.current = true;
      onDone(back);
      return;
    }
    const value = draftValue(col, raw);
    if (value !== null && typeof value === 'object') {
      setError(value.error);
      return;
    }
    const checked = editValue(col, value, edit.choices ? (options[col.key] ?? []) : []);
    if ('error' in checked) {
      setError(checked.error);
      return;
    }
    settled.current = true;
    onDone(back);
    void save(value).catch(() => undefined);
  };
  const cancel = (back = true) => {
    if (settled.current) return;
    settled.current = true;
    onDone(back);
  };
  const keys = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      cancel();
    } else if (e.key === 'Enter' && !(edit.input === 'longtext' && e.shiftKey)) {
      e.preventDefault();
      commit(draft);
    }
  };
  const common = {
    'aria-label': `${col.label}, change it`,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error ? errorId : undefined,
    onKeyDown: keys,
  } as const;
  let input: ReactNode;
  if (edit.input === 'select') {
    input = (
      <select
        ref={keep}
        {...common}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          commit(e.target.value);
        }}
        onBlur={() => cancel(false)}
        className="min-h-[44px] w-full min-w-[160px] rounded-tile border-2 border-line bg-paper pl-sm text-subhead font-medium"
      >
        {/* A state the table does not offer (`offer`: a closed listing, which only goes back to Draft or Published here) still shows as where
            it starts, unpickable, so the select never seems to sit on a choice it is not on, and picking that choice is a real change. */}
        {edit.offer && first !== '' && !choices.some((o) => o.value === first) && (
          <option value={first} disabled>
            {cellText(col, row.cells)}
          </option>
        )}
        <SelectOptions choices={choices} />
      </select>
    );
  } else if (edit.input === 'longtext') {
    input = <textarea ref={keep} {...common} value={draft} rows={3} maxLength={edit.maxLength} onChange={(e) => setDraft(e.target.value)} onBlur={() => commit(draft, false)} className={`${FIELD_CELL} min-w-[220px] py-xs`} />;
  } else {
    const type = edit.input === 'number' ? 'number' : edit.input === 'date' ? 'date' : edit.input === 'time' ? 'time' : 'text';
    input = (
      <input
        ref={keep}
        {...common}
        type={type}
        inputMode={edit.input === 'money' ? 'decimal' : undefined}
        value={draft}
        min={edit.input === 'number' ? edit.min : undefined}
        max={edit.input === 'number' ? edit.max : undefined}
        step={edit.input === 'number' ? edit.step : undefined}
        maxLength={edit.input === 'text' ? edit.maxLength : undefined}
        onChange={(e) => {
          setDraft(e.target.value);
          setError(null);
        }}
        onBlur={() => commit(draft, false)}
        className={FIELD_CELL}
      />
    );
  }
  return (
    <div className="min-w-[160px]">
      {input}
      {error ? (
        <p id={errorId} role="alert" className="mt-xs m-0 max-w-[280px] whitespace-normal text-caption text-r1">
          {error}
        </p>
      ) : (
        edit.note && <p className="mt-xs m-0 max-w-[280px] whitespace-normal text-caption text-ink-soft">{edit.note}</p>
      )}
    </div>
  );
}

/** A select's options, in groups when the choices carry one (projects by pillar). */
function SelectOptions({ choices }: { choices: readonly ColumnOption[] }) {
  const groups: { name: string | undefined; items: ColumnOption[] }[] = [];
  for (const o of choices) {
    const last = groups[groups.length - 1];
    if (last && last.name === o.group) last.items.push(o);
    else groups.push({ name: o.group, items: [o] });
  }
  return (
    <>
      {groups.map((g, i) =>
        g.name ? (
          <optgroup key={`${g.name}-${i}`} label={g.name}>
            {g.items.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </optgroup>
        ) : (
          g.items.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))
        ),
      )}
    </>
  );
}

/** A name for a row, for its tick and its cells' labels: its first column's words. */
function rowName(row: TableRow, columns: readonly DataColumn[], ctx: { options: Readonly<Record<string, ColumnOption[]>>; currency: string }): string {
  for (const col of columns) {
    const w = cellWords(col, row.cells, ctx);
    if (w) return w.length > 60 ? `${w.slice(0, 60)}…` : w;
  }
  return 'this row';
}

export function ServerTable({ label, columns, rows, options, currency, sort, onSort, picked, onPick, editor, busy, empty }: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  const ctx = { options, currency };
  const ticks = picked !== null;
  const allPicked = ticks && rows.length > 0 && rows.every((r) => picked.has(r.id));
  const somePicked = ticks && !allPicked && rows.some((r) => picked.has(r.id));
  const headTick = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (headTick.current) headTick.current.indeterminate = somePicked;
  }, [somePicked]);
  const focusCell = (id: string) =>
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>(`[data-cell="${CSS.escape(id)}"]`);
      el?.focus();
    });
  const canEdit = (row: TableRow, col: DataColumn) => Boolean(editor && col.edit && editor.editable(row, col));
  const anyEditable = (col: DataColumn) => Boolean(editor && col.edit && rows.some((r) => editor.editable(r, col)));
  const colCount = columns.length + (ticks ? 1 : 0);

  const cell = (col: DataColumn, row: TableRow) => {
    const id = `${row.id}:${col.key}`;
    if (!canEdit(row, col) || !editor) return <CellView col={col} row={row} ctx={ctx} />;
    if (col.edit?.input === 'toggle') {
      const on = row.cells[col.key] === true;
      return <Switch on={on} disabled={busy} label={`${col.label}: ${rowName(row, columns, ctx)}`} onChange={(next) => void editor.save(row, col, next).catch(() => undefined)} />;
    }
    if (editing === id)
      return (
        <EditCell
          col={col}
          row={row}
          options={options}
          save={(value) => editor.save(row, col, value)}
          onDone={(back) => {
            setEditing(null);
            if (back) focusCell(id);
          }}
        />
      );
    const words = cellWords(col, row.cells, ctx);
    // Words only inside the button (never the cell's own "Show all", which would be a button in a button); long words are cut here.
    const shown = words.length > CUT_AT ? `${words.slice(0, CUT_AT).trimEnd()}…` : words;
    return (
      <button
        type="button"
        data-cell={id}
        disabled={busy}
        onClick={() => setEditing(id)}
        aria-label={`${col.label}: ${words ? (words.length > 120 ? `${words.slice(0, 120)}…` : words) : 'empty'}. Change it`}
        className="-mx-xs block min-h-[44px] w-[calc(100%+var(--spacing-md))] rounded-tile px-xs text-left hover:bg-paper focus-visible:bg-paper disabled:opacity-60"
      >
        {shown ? <span className="block whitespace-pre-line">{col.format === 'inert' ? <Inert text={shown} /> : shown}</span> : <span className="text-ink-mute">Add</span>}
      </button>
    );
  };

  return (
    <div className="overflow-x-auto rounded-card bg-card shadow-toy-soft" onFocus={showFocused}>
      <table className="w-full border-collapse text-left" aria-label={label} aria-busy={busy}>
        <thead>
          <tr className="border-b-2 border-line">
            {ticks && (
              <th scope="col" className="w-[56px] px-xs py-0">
                {/* The box is small; the label round it is the 44px target. */}
                <label className="inline-flex size-[44px] cursor-pointer items-center justify-center">
                  <input ref={headTick} type="checkbox" checked={allPicked} disabled={rows.length === 0} onChange={() => onPick(rows, !allPicked)} aria-label="Select every row on this page" className="size-[20px] accent-ink" />
                </label>
              </th>
            )}
            {columns.map((col) => {
              const active = sort.key === col.key;
              const mark = anyEditable(col) ? (
                <>
                  <Icon icon={Pencil} size={12} className="opacity-60" />
                  <span className="sr-only">(you can change it)</span>
                </>
              ) : null;
              return (
                <th key={col.key} scope="col" aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : col.sortable ? 'none' : undefined} className="whitespace-nowrap px-md py-sm text-eyebrow uppercase text-ink-soft">
                  {col.sortable ? (
                    // A button resets the letter case, so it carries the eyebrow's capitals itself, like the headers that do not sort.
                    <button type="button" onClick={() => onSort(col.key)} className={`inline-flex min-h-[44px] min-w-[44px] items-center gap-xs rounded-pill uppercase hover:text-ink ${active ? 'text-ink' : ''}`}>
                      {col.label}
                      {mark}
                      <Icon icon={active ? (sort.dir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown} size={12} className={active ? '' : 'opacity-60'} />
                    </button>
                  ) : (
                    <span className="inline-flex min-h-[44px] items-center gap-xs">
                      {col.label}
                      {mark}
                    </span>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={colCount} className="px-md py-lg text-subhead text-ink-soft">
                {empty}
              </td>
            </tr>
          )}
          {rows.map((row) => (
            <tr key={row.id} className={`border-t border-line align-top ${ticks && picked.has(row.id) ? 'bg-paper' : ''}`}>
              {ticks && (
                <td className="px-xs py-sm">
                  <label className="inline-flex size-[44px] cursor-pointer items-center justify-center">
                    <input type="checkbox" checked={picked.has(row.id)} onChange={(e) => onPick([row], e.target.checked)} aria-label={`Select ${rowName(row, columns, ctx)}`} className="size-[20px] accent-ink" />
                  </label>
                </td>
              )}
              {columns.map((col) => {
                const wraps = col.kind === 'text' || col.kind === 'longtext' || col.kind === 'summary';
                return (
                  <td key={col.key} className={`px-md py-sm text-subhead ${wraps ? '' : 'whitespace-nowrap'} ${col.kind === 'number' || col.kind === 'money' ? 'text-right tabular-nums' : ''}`}>
                    {/* A table cell ignores a max width, so the words' own box holds it: long words wrap inside 320px. */}
                    {/* Every cell keeps the 44px of the row's tick and of a cell's change button, so the words of a row share one line. */}
                    <span className={`flex min-h-[44px] flex-col justify-center ${wraps ? 'w-max min-w-[160px] max-w-[320px]' : ''}`}>{cell(col, row)}</span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
