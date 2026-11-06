import { joinBodyBlocks, money, parseBodyBlocks, typedCents, type BodyBlock, type BodySegment } from '@kreators/shared';
import { GripVertical } from 'lucide-react';
import { createElement, Fragment, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Icon } from './Icon';
import { MoreMenu, type MoreMenuItem } from './MoreMenu';

/**
 * Editing paper in place: the page that prints is the editor. Every heading, paragraph, list item, table cell and blank on an agreement,
 * a document, an invoice or a house template is a plain-text editable region. Words go in and out only as text (`textContent` and
 * `innerText`), never as HTML: paste and drop are plain text, nothing is ever set with innerHTML, and what is stored is the same small
 * markdown the page already reads. Chrome, Safari and Firefox 136 and up take `contenteditable="plaintext-only"`; elsewhere a plain
 * `contenteditable` stands in, with paste and drop turned into text by hand.
 */

let plainOnly: boolean | null = null;
function supportsPlainOnly(): boolean {
  if (plainOnly !== null) return plainOnly;
  try {
    const d = document.createElement('div');
    d.contentEditable = 'plaintext-only';
    plainOnly = d.contentEditable === 'plaintext-only';
  } catch {
    plainOnly = false;
  }
  return plainOnly;
}

/** Puts plain text where the caret is, as a text node: the fallback for paste and drop where plaintext-only is missing. */
function insertPlain(text: string) {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;
  const range = sel.getRangeAt(0);
  range.deleteContents();
  const node = document.createTextNode(text);
  range.insertNode(node);
  range.setStartAfter(node);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
}

/** Where the caret is inside an element, counted in characters. */
function caretOffset(el: HTMLElement): number {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return el.textContent?.length ?? 0;
  const range = sel.getRangeAt(0);
  const pre = range.cloneRange();
  pre.selectNodeContents(el);
  pre.setEnd(range.endContainer, range.endOffset);
  return pre.toString().length;
}

/** Puts the caret at the end (or the start) of an editable element. */
export function focusAt(el: HTMLElement | null | undefined, where: 'end' | 'start' = 'end') {
  if (!el) return;
  el.focus();
  const sel = window.getSelection();
  if (!sel) return;
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(where === 'start');
  sel.removeAllRanges();
  sel.addRange(range);
}

/** The next or previous editable region on the same sheet, for the arrow keys. */
function neighbour(el: HTMLElement, by: -1 | 1): HTMLElement | null {
  const root = el.closest('.legal-doc') ?? document.body;
  const all = [...root.querySelectorAll<HTMLElement>('[data-paper-edit]')];
  const i = all.indexOf(el);
  return all[i + by] ?? null;
}

const clean = (t: string, multiline: boolean): string => {
  const s = t.replace(/ /g, ' ').replace(/\r\n?/g, '\n');
  // An empty region reads back as one line break in some browsers: that is nothing, not a space.
  return multiline ? s.replace(/\n$/, '') : s.replace(/\n+$/, '').replace(/\n/g, ' ');
};

export type EditableTag = 'span' | 'p' | 'h1' | 'h2' | 'h3' | 'li' | 'td' | 'th' | 'strong' | 'div';

export interface EditableTextProps {
  value: string;
  onChange: (v: string) => void;
  /** What the region is, for a screen reader: "Heading of section 4", "Package fee, 5 Video Package". */
  label: string;
  as?: EditableTag;
  /** Line breaks are kept (Shift+Enter, or Enter when there is no `onEnter`). */
  multiline?: boolean;
  placeholder?: string;
  readOnly?: boolean;
  /** Enter: the words before and after the caret. The region keeps the first part; the caller makes a new block of the second. */
  onEnter?: (before: string, after: string) => void;
  /** Backspace in an empty region. */
  onBackspaceEmpty?: () => void;
  inputMode?: 'text' | 'numeric' | 'decimal' | 'email' | 'tel';
  className?: string;
  /** Shown instead of the value while the region is not being typed in (a fee shows as "₹12,000"; typing it is digits). */
  display?: string;
  onFocus?: () => void;
  onBlur?: () => void;
}

/** One plain-text editable region on the paper. */
export function EditableText({ value, onChange, label, as = 'span', multiline = false, placeholder, readOnly = false, onEnter, onBackspaceEmpty, inputMode, className = '', display, onFocus, onBlur }: EditableTextProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [focused, setFocused] = useState(false);
  const shown = !focused && display !== undefined ? display : value;
  // The words are set only from outside and only while the region is not being typed in, so the caret never jumps.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (document.activeElement === el && focused) return;
    if (el.textContent !== shown) el.textContent = shown;
  }, [shown, focused]);
  const keyDown = (e: KeyboardEvent<HTMLElement>) => {
    const el = ref.current;
    if (!el) return;
    if (e.key === 'Enter' && !(multiline && e.shiftKey) && (onEnter || !multiline)) {
      e.preventDefault();
      if (!onEnter) return;
      const text = clean(el.innerText, multiline);
      const at = Math.min(caretOffset(el), text.length);
      const before = text.slice(0, at);
      el.textContent = before;
      onChange(before);
      onEnter(before, text.slice(at));
      return;
    }
    if (e.key === 'Backspace' && onBackspaceEmpty && !clean(el.innerText, multiline).trim()) {
      e.preventDefault();
      onBackspaceEmpty();
      return;
    }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      const text = el.textContent ?? '';
      const at = caretOffset(el);
      const up = e.key === 'ArrowUp';
      if ((up && (at === 0 || !text.slice(0, at).includes('\n'))) || (!up && (at >= text.length || !text.slice(at).includes('\n')))) {
        const to = neighbour(el, up ? -1 : 1);
        if (to) {
          e.preventDefault();
          focusAt(to, up ? 'end' : 'start');
        }
      }
    }
  };
  if (readOnly) return createElement(as, { className, 'data-var-text': '' }, shown || placeholder || '');
  return createElement(as, {
    ref,
    contentEditable: supportsPlainOnly() ? 'plaintext-only' : 'true',
    suppressContentEditableWarning: true,
    role: 'textbox',
    tabIndex: 0,
    spellCheck: true,
    'aria-label': label,
    'aria-multiline': multiline ? 'true' : 'false',
    'data-paper-edit': '',
    'data-placeholder': placeholder ?? '',
    'data-empty': value ? undefined : '',
    inputMode,
    className: `paper-edit ${className}`.trim(),
    onInput: () => {
      const el = ref.current;
      if (el) onChange(clean(el.innerText, multiline));
    },
    onKeyDown: keyDown,
    onPaste: (e: React.ClipboardEvent<HTMLElement>) => {
      e.preventDefault();
      const text = clean(e.clipboardData.getData('text/plain'), multiline);
      insertPlain(text);
      const el = ref.current;
      if (el) onChange(clean(el.innerText, multiline));
    },
    onDrop: (e: React.DragEvent<HTMLElement>) => e.preventDefault(),
    onFocus: () => {
      setFocused(true);
      const el = ref.current;
      if (el && display !== undefined && el.textContent !== value) el.textContent = value;
      onFocus?.();
    },
    onBlur: () => {
      setFocused(false);
      onBlur?.();
    },
  });
}

/** A blank on the paper ({{client}}): edits the document's variable, wherever the blank appears. Dotted underline on the screen only. */
export function VarField({ name, value, onChange, label, placeholder }: { name: string; value: string; onChange: (v: string) => void; label: string; placeholder?: string }) {
  return (
    <span className="paper-var" data-var={name}>
      <EditableText value={value} onChange={onChange} label={label} placeholder={placeholder ?? label} />
    </span>
  );
}

/** A fee typed in whole rupees (or any currency's units), kept in cents and read with `typedCents`; it shows as money when not typed in. */
export function MoneyCell({ cents, onChange, label, currency, as = 'td', className = '', suffix = '' }: { cents: number; onChange: (cents: number) => void; label: string; currency: string; as?: EditableTag; className?: string; suffix?: string }) {
  const [txt, setTxt] = useState(cents ? String(cents / 100) : '');
  useEffect(() => {
    const cur = typedCents(txt || '0');
    if (!Number.isFinite(cur) || cur !== cents) setTxt(cents ? String(cents / 100) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cents]);
  return (
    <EditableText
      as={as}
      className={className}
      label={label}
      inputMode="decimal"
      value={txt}
      display={cents > 0 ? `${money(cents, currency)}${suffix}` : '—'}
      onChange={(v) => {
        const digits = v.replace(/[^0-9.]/g, '');
        setTxt(digits);
        const n = typedCents(digits || '0');
        if (Number.isFinite(n) && n >= 0) onChange(n);
      }}
    />
  );
}

/** A whole number typed in place (how many videos). */
export function NumberCell({ value, onChange, label, as = 'td', className = '', max = 10000, prefix = '' }: { value: number; onChange: (n: number) => void; label: string; as?: EditableTag; className?: string; max?: number; prefix?: string }) {
  return (
    <EditableText
      as={as}
      className={className}
      label={label}
      inputMode="numeric"
      value={value ? String(value) : ''}
      display={prefix ? `${prefix}${value}` : undefined}
      onChange={(v) => onChange(Math.max(0, Math.min(max, Math.round(Number(v.replace(/[^0-9]/g, ''))) || 0)))}
    />
  );
}

/**
 * A long press (half a second) on a touch screen: how a phone opens a section's handle, since it has no hover. Once it has fired, the
 * lift that ends the press is swallowed (its touchend, the mouse events and click a browser makes from it, and the long-press menu), so
 * the menu that just opened is not closed by the same finger landing on its backdrop.
 */
export function useLongPress(run: () => void) {
  const timer = useRef<number | null>(null);
  const fired = useRef(false);
  const from = useRef({ x: 0, y: 0 });
  const stop = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  };
  return {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      stop();
      fired.current = false;
      from.current = { x: e.clientX, y: e.clientY };
      timer.current = window.setTimeout(() => {
        timer.current = null;
        fired.current = true;
        run();
      }, 500);
    },
    onPointerUp: stop,
    onPointerCancel: stop,
    // A finger is never quite still: only a move of more than 8px (a scroll starting) cancels the press.
    onPointerMove: (e: React.PointerEvent) => {
      if (Math.hypot(e.clientX - from.current.x, e.clientY - from.current.y) > 8) stop();
    },
    onTouchEnd: (e: React.TouchEvent) => {
      if (!fired.current) return;
      fired.current = false;
      if (e.cancelable) e.preventDefault();
    },
    onContextMenu: (e: React.MouseEvent) => {
      if (timer.current !== null || fired.current) e.preventDefault();
    },
  };
}

/**
 * A section's handle: a small grip in the left margin, shown on hover or when the section has focus (with a mouse), opened by a long press
 * on the heading on a phone. Its menu moves the section, switches "Print this section", adds a section below and deletes it (asked twice).
 */
export function SectionHandle({ items, label, open, onOpenChange }: { items: MoreMenuItem[]; label: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <MoreMenu
      items={items}
      label={label}
      title={label}
      open={open}
      onOpenChange={onOpenChange}
      trigger={(show) => (
        <button type="button" className="paper-handle no-print" aria-label={label} aria-haspopup="dialog" onClick={show}>
          <Icon icon={GripVertical} size={18} />
        </button>
      )}
    />
  );
}

// ---- a section's words as blocks, edited in place

export interface BlockVars {
  values: Record<string, string>;
  set: (key: string, value: string) => void;
  /** The label a blank reads as ("Client", "Your brand name"). */
  labelOf: (key: string) => string;
  /** Words worked out from the paper itself (the 6.1 example from the price table): shown as they are, never a blank to type in. */
  derived?: Record<string, string>;
}

const TAG: Record<BodyBlock['kind'], EditableTag> = { p: 'p', li: 'span', h3: 'h3', strong: 'p' };
const CLASS: Record<BodyBlock['kind'], string> = { p: 'legal-clause', li: '', h3: 'legal-h3', strong: 'legal-clause legal-strong' };

/** One segment inside a mixed block: words, a bold label, or a blank. */
function SegmentEdit({ seg, onChange, vars, label, onEnter, last }: { seg: BodySegment; onChange: (s: BodySegment) => void; vars: BlockVars; label: string; onEnter?: () => void; last: boolean }) {
  if (typeof seg === 'string') return <EditableText value={seg} multiline onChange={(v) => onChange(v)} label={label} onEnter={last && onEnter ? () => onEnter() : undefined} />;
  if ('bold' in seg) return <EditableText as="strong" value={seg.bold} onChange={(v) => onChange({ bold: v })} label={`${label}, in bold`} />;
  if (vars.derived && seg.var in vars.derived) return <span>{vars.derived[seg.var]}</span>;
  const value = vars.values[seg.var] ?? '';
  const field = <VarField name={seg.var} value={value} onChange={(v) => vars.set(seg.var, v)} label={vars.labelOf(seg.var)} placeholder={seg.fallback !== undefined && !value ? undefined : vars.labelOf(seg.var)} />;
  // An either blank: with a value it reads "<value> owns"; without one, the fallback words show, and the blank stays there to fill.
  if (seg.when !== undefined) {
    const [a = '', b = ''] = seg.when.split('$');
    return value ? (
      <>
        {a}
        {field}
        {b}
      </>
    ) : (
      <>
        <span className="paper-fallback" title={`${vars.labelOf(seg.var)} is empty, so the paper reads this`}>
          {seg.fallback}
        </span>
        <span className="paper-var-empty no-print">{field}</span>
      </>
    );
  }
  if (seg.fallback !== undefined && !value)
    return (
      <>
        {seg.fallback && <span className="paper-fallback">{seg.fallback}</span>}
        <span className="paper-var-empty no-print">{field}</span>
      </>
    );
  return field;
}

/**
 * The words of a section, edited where they print. A block that is only words is one region (Enter splits it, Backspace in an empty one
 * joins it to the one before); a block with blanks or bold labels is a row of regions. `###` lines are subheads, `- ` lines bullets.
 */
export function BlocksEditor({ body, onChange, vars, label }: { body: string; onChange: (body: string) => void; vars: BlockVars; label: string }) {
  const blocks = parseBodyBlocks(body);
  const host = useRef<HTMLDivElement | null>(null);
  const focusNext = useRef<{ index: number; where: 'start' | 'end' } | null>(null);
  useLayoutEffect(() => {
    const want = focusNext.current;
    if (!want || !host.current) return;
    focusNext.current = null;
    const el = host.current.querySelector<HTMLElement>(`[data-block="${want.index}"] [data-paper-edit], [data-block="${want.index}"][data-paper-edit]`);
    focusAt(el, want.where);
  });
  const write = (next: BodyBlock[]) => onChange(joinBodyBlocks(next));
  const setBlock = (i: number, b: BodyBlock) => write(blocks.map((x, j) => (j === i ? b : x)));
  const insertAfter = (i: number, b: BodyBlock) => {
    const next = [...blocks];
    next.splice(i + 1, 0, b);
    focusNext.current = { index: i + 1, where: 'start' };
    write(next);
  };
  const remove = (i: number) => {
    if (blocks.length <= 1) return;
    focusNext.current = { index: Math.max(0, i - 1), where: 'end' };
    write(blocks.filter((_, j) => j !== i));
  };
  const pure = (b: BodyBlock) => b.segments.every((s) => typeof s === 'string');
  const textOf = (b: BodyBlock) => b.segments.map((s) => (typeof s === 'string' ? s : '')).join('');
  const nextKind = (k: BodyBlock['kind']): BodyBlock['kind'] => (k === 'li' ? 'li' : 'p');

  const one = (b: BodyBlock, i: number): ReactNode => {
    const name = `${label}, ${b.kind === 'li' ? 'bullet' : b.kind === 'h3' ? 'subhead' : 'paragraph'} ${i + 1}`;
    if (pure(b)) {
      return (
        <EditableText
          as={b.kind === 'li' ? 'span' : TAG[b.kind]}
          className={CLASS[b.kind]}
          value={textOf(b)}
          multiline={b.kind === 'p'}
          label={name}
          placeholder={b.kind === 'h3' ? 'Subhead' : 'Type here'}
          onChange={(v) => setBlock(i, { ...b, segments: v ? [v] : [] })}
          onEnter={(_before, after) => insertAfter(i, { kind: nextKind(b.kind), segments: after ? [after] : [], sep: '' })}
          onBackspaceEmpty={() => remove(i)}
        />
      );
    }
    const segs = b.segments.map((s, k) => (
      <SegmentEdit
        key={k}
        seg={s}
        vars={vars}
        label={name}
        last={k === b.segments.length - 1}
        onEnter={() => insertAfter(i, { kind: nextKind(b.kind), segments: [], sep: '' })}
        onChange={(ns) => setBlock(i, { ...b, segments: b.segments.map((x, j) => (j === k ? ns : x)) })}
      />
    ));
    return b.kind === 'li' ? <span>{segs}</span> : createElement(TAG[b.kind], { className: `${CLASS[b.kind]} paper-mixed` }, segs);
  };

  // Bullets that follow each other share one list, as on the page that prints.
  const out: ReactNode[] = [];
  for (let i = 0; i < blocks.length; i += 1) {
    const b = blocks[i]!;
    if (b.kind === 'li') {
      const run: number[] = [];
      while (i < blocks.length && blocks[i]!.kind === 'li') run.push(i++);
      i -= 1;
      out.push(
        <ul key={`u${run[0]}`} className="legal-list">
          {run.map((j) => (
            <li key={j} data-block={j}>
              <span aria-hidden="true" className="legal-bullet">
                •
              </span>
              {one(blocks[j]!, j)}
            </li>
          ))}
        </ul>,
      );
      continue;
    }
    out.push(
      <div key={i} data-block={i} data-tight={b.sep === '\n' ? '' : undefined} className="paper-block">
        {one(b, i)}
      </div>,
    );
  }
  if (!blocks.length)
    out.push(
      <div key="empty" data-block={0} className="paper-block">
        <EditableText as="p" className="legal-clause" value="" multiline label={`${label}, paragraph 1`} placeholder="Type here" onChange={(v) => onChange(v)} />
      </div>,
    );
  return (
    <div ref={host} className="paper-blocks">
      {out.map((n, i) => (
        <Fragment key={i}>{n}</Fragment>
      ))}
    </div>
  );
}
