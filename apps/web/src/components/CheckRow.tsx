import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import gsap from 'gsap';
import { Check, Clock, Pencil } from 'lucide-react';
import { Icon } from './Icon';
import { ToggleIcon } from './ToggleMark';
import { CloseButton } from './CloseButton';

/** What tapping a row's words opens, for a row that has something to open (a task's plan or its edit sheet). */
export interface CheckRowOpen {
  onOpen: () => void;
  /** The open control's words before the title: "Plan", "Close the plan for", "Edit". Its name is `${label} ${title}`. */
  label: string;
  /** Set only when it opens a panel in place under the row: the control then carries `aria-expanded` (and `aria-controls`), and the
   *  small edit button's pencil turns into a cross while open. Leave it off when it opens a Sheet, which has its own close. */
  expanded?: boolean;
  /** The id of the panel it opens in place, for `aria-controls`. */
  controls?: string;
  /** Draw the small edit button at the card's top right (default true). */
  edit?: boolean;
  /** While `expanded`, the row draws its close outside the card (`RowClose`, 2026-11-13), so the small edit button keeps its slot unseen
   *  and the card's tags never move. */
  outside?: boolean;
}

interface Props {
  checked: boolean;
  /** Called when the box is ticked or unticked. Not called while locked or busy. */
  onToggle: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Box color when ticked, the hard shadow under it, and the tick's color. */
  color?: string;
  deep?: string;
  text?: string;
  /** The empty box's edge, when `color` is too light to hold 3:1 on glass (orange and yellow take their deep colour). Defaults to `color`. */
  edge?: string;
  busy?: boolean;
  /** When set, tapping the box shows this instead of toggling, for example a wait or a once-a-day rule. */
  lockedMessage?: string | null;
  /** A way past the lock, shown after the locked message once the box was tapped (a task done early: Move it to today). Nothing at rest. */
  lockAction?: ReactNode;
  /** A small pill after the subtitle, like a due date or a countdown. */
  badge?: ReactNode;
  /** Strike the title through when ticked. Right for tasks, wrong for "I checked in". */
  strike?: boolean;
  /** Error or note from the last tap, shown right under the row. */
  hint?: string | null;
  /** Something next to the row that is not part of the card, like a More button or a play link. */
  aside?: ReactNode;
  /** A tag for the row's top right corner on a phone (a task's priority). From the tablet width up it sits at the row's right, after `foot`. */
  corner?: ReactNode;
  /** A task's pillar tag. On a phone the last tag across the row's foot, under the title; from the tablet width up at the row's right, before `corner`. */
  foot?: ReactNode;
  /** A task's time tag, always directly left of `foot` (2026-11-13, the founder: "put the time tag on left of pillar"); the two wrap as one. */
  time?: ReactNode;
  /** The row's other marks (a task's Remember, Habit, For review, time, due): at the row's right with `corner` and `foot` on a laptop; on a phone across the row's foot, each line filled, so the title keeps its width. */
  marks?: ReactNode;
  /** Tapping the words opens this instead of ticking (a task's plan or edit sheet); the box alone ticks. Without it the words tick too. */
  open?: CheckRowOpen;
  large?: boolean;
}

/**
 * The tick box itself, the one look. It only draws: the real checkbox and the row around it are the caller's (CheckRow's box, or the
 * Apps page's Select mode). `edge` is the empty box's border when it differs from `color`.
 * When the box goes from empty to ticked, the tick draws itself in (its stroke runs from start to end); never on the first paint, and
 * under reduced motion it is only set.
 */
export function CheckMark({ checked, color, deep, text, edge, locked = false, busy = false, large = false }: { checked: boolean; color: string; deep: string; text: string; edge?: string; locked?: boolean; busy?: boolean; large?: boolean }) {
  const box = useRef<HTMLSpanElement>(null);
  const was = useRef(checked);
  useEffect(() => {
    const before = was.current;
    was.current = checked;
    if (!checked || before) return;
    const path = box.current?.querySelector('path');
    if (!path) return;
    const len = path.getTotalLength();
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.set(path, { strokeDasharray: 'none', strokeDashoffset: 0 });
      return;
    }
    const tween = gsap.fromTo(path, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: 0.3, ease: 'power2.out', onComplete: () => void gsap.set(path, { strokeDasharray: 'none' }) });
    return () => {
      tween.kill();
    };
  }, [checked]);
  return (
    <span
      ref={box}
      aria-hidden="true"
      className={`check-box flex shrink-0 items-center justify-center rounded-[10px] border-[3px] ${large ? 'size-[40px]' : 'size-[32px]'} ${busy ? 'animate-pulse' : ''}`}
      style={{
        borderColor: locked && !checked ? 'var(--color-ink-mute)' : checked ? color : (edge ?? color),
        background: checked ? color : 'var(--color-card)',
        boxShadow: `0 3px 0 0 ${locked && !checked ? 'var(--color-line)' : deep}`,
      }}
    >
      {checked ? (
        <Icon icon={Check} size={22} strokeWidth={3} color={text} />
      ) : locked ? (
        <Icon icon={Clock} size={18} color="var(--color-ink-soft)" />
      ) : (
        <Icon icon={Check} size={22} strokeWidth={3} color={color} className="check-preview" />
      )}
    </span>
  );
}

/**
 * The one way to record an action anywhere in the app: a checkbox beside a card (2026-11-12, the founder: "why is the checkbox not
 * seperate and out of the clickable task card itself?"). The row is three things side by side, none inside another: the box at the left,
 * the real checkbox named "Tick <title>" with its own focus ring and hover preview, outside the card; then the card (the toy, holding the
 * words and tags), which is one stretched control laid over its words: with `open` a button that opens the row's plan or edit sheet, with
 * a small edit button at the card's top right for a mouse or a finger (the stretched button is the keyboard's stop, so the small one is
 * hidden from the keyboard and screen readers); without it a label for the same checkbox, so the words still tick; then any `aside`.
 * The keyboard meets the box, then the card, then the aside. The corner, foot and marks keep their places inside the card. In a list that
 * filters by its tags (2026-11-13) a task's tags are buttons of their own, raised over the stretched control and siblings of it, never
 * inside it: the keyboard meets the box, the card, then each tag, then the aside.
 */
export function CheckRow({
  checked,
  onToggle,
  title,
  subtitle,
  color = 'var(--color-ink)',
  deep = 'var(--color-shadow)',
  text = 'var(--color-on-ink)',
  edge,
  busy = false,
  lockedMessage = null,
  lockAction = null,
  badge,
  strike = false,
  hint = null,
  aside,
  large = false,
  corner,
  foot,
  marks,
  time,
  open,
}: Props) {
  const id = useId();
  const openRef = useRef<HTMLButtonElement>(null);
  // Where a wide card's other marks go (2026-11-13, the founder): beside the title at the right while they fit there, as always; under the
  // title, left-aligned (wrapping there, each line filled, when they need more), when they would need a second line at the right and the title fits on one line, so the time, the
  // pillar, the priority and the edit button stay level with the title; with a title that wraps anyway, at the right as before.
  const under = useMarksUnder(Boolean(marks));
  // After a tap on a locked box, show the live reason. It updates as a wait
  // counts down and disappears on its own once the row unlocks.
  const [asked, setAsked] = useState(false);
  const locked = Boolean(lockedMessage);
  const note = hint ?? (asked && locked ? lockedMessage : null);
  const noteId = note ? `${id}-note` : undefined;
  // Both stops say the row's state (2026-11-12): the note under the title, then the tags the card holds, in the order a laptop shows
  // them left to right (the other marks, the time, the pillar, then the priority at the top right; 2026-11-13), so moving by Tab reads
  // what the card shows; the box also says its lock before a tap, unless the note already says it.
  const tags = [subtitle ? `${id}-sub` : null, badge ? `${id}-badge` : null, marks ? `${id}-marks` : null, time ? `${id}-time` : null, foot ? `${id}-foot` : null, corner ? `${id}-corner` : null];
  const lockId = locked && note !== lockedMessage ? `${id}-lock` : null;
  const described = [...tags, lockId, noteId].filter(Boolean).join(' ') || undefined;
  const openDescribed = [...tags, noteId].filter(Boolean).join(' ') || undefined;

  const handle = () => {
    if (busy) return;
    if (locked) {
      setAsked(true);
      return;
    }
    setAsked(false);
    onToggle();
  };

  const edit =
    open && open.edit !== false ? (
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        data-row-edit=""
        // No name of its own as a tip (2026-11-12, tried): the only room beside it is its own card or the row above, so a tip there would
        // sit on words; the card it opens is named "Plan <title>" for the keyboard and screen readers, and the pencil is the edit glyph.
        // Never takes focus itself: the stretched control does (so a Sheet hands focus back there, and the keyboard's place is the row).
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          openRef.current?.focus({ preventScroll: true });
          open.onOpen();
        }}
        className={`toy toy-flat tap-pad relative z-[1] -my-[4px] flex size-[32px] shrink-0 cursor-pointer items-center justify-center rounded-pill text-ink-soft hover:text-ink ${open.outside && open.expanded ? 'invisible' : ''}`}
      >
        {open.expanded === undefined ? <Icon icon={Pencil} size={16} strokeWidth={2.6} /> : <ToggleIcon open={open.expanded} icon={Pencil} size={16} strokeWidth={2.6} />}
      </button>
    ) : null;
  const cornerEl = corner ? (
    <span id={`${id}-corner`} className="contents">
      {corner}
    </span>
  ) : null;
  const top = edit ? (
    <span className="flex items-center gap-xs">
      {cornerEl}
      {edit}
    </span>
  ) : (
    cornerEl
  );

  // The other marks at a wide card's right (`line` beside the pair, or `stack` under it); each line fills when they wrap, so a third mark never
  // stands alone under two (a task's block, 2026-11-06), and the block grows to a line of its own under the time and pillar (2026-11-13).
  const marksAtRight = (
    <span ref={under.marks} id={`${id}-marks`} className={`hidden max-w-full @xl:flex @xl:flex-wrap @xl:justify-end @xl:gap-xs @xl:[&>*]:flex-auto @xl:[&>*]:justify-center ${under.mode === 'stack' ? '@xl:basis-full' : '@xl:grow'}`}>
      {marks}
    </span>
  );

  return (
    <div>
      {/* The row is three things side by side, none inside another (2026-11-12, the founder): the box, the card, then any aside. */}
      <div data-opens={open ? '' : undefined} className="check-line flex items-stretch gap-xs">
        {/* The box: its own control outside the card, at its left, 44 by 44 to tap. Its column is the card's least height, so the box sits
            on a one-line card's middle and level with the first line of a taller one; on the small box the hit area's spare room lies
            toward the card and the column gives back the gap, so the box stands 12px off the card and its hit area never reaches it. */}
        <div className={`flex shrink-0 items-center self-start ${large ? 'h-[64px]' : 'h-[56px] -mr-xs'}`}>
          <label className="check-hit relative flex size-[44px] shrink-0 cursor-pointer items-center justify-start">
            <input
              id={`${id}-box`}
              type="checkbox"
              className="sr-only"
              checked={checked}
              onChange={handle}
              aria-labelledby={`${id}-tick ${id}-title`}
              aria-describedby={described}
              aria-busy={busy || undefined}
            />
            <CheckMark checked={checked} color={color} deep={deep} text={text} edge={edge} locked={locked} busy={busy} large={large} />
          </label>
        </div>
        <span id={`${id}-tick`} hidden>
          Tick
        </span>
        {lockId && (
          <span id={lockId} hidden>
            {lockedMessage}
          </span>
        )}
        <div
          // `@container`: where the tags go is read from the card's own width (2026-11-13), so a tablet's column, a narrow laptop, a time
          // block's box or the open sidebar give the tags the phone's place under the title, and only a wide card keeps them at its right.
          ref={under.card}
          className={`check-row @container toy toy-soft relative flex min-w-0 flex-1 cursor-pointer select-none flex-wrap items-center gap-sm rounded-tile bg-card p-sm has-[[data-row-open]:focus-visible]:outline-[3px] has-[[data-row-open]:focus-visible]:outline-offset-2 has-[[data-row-open]:focus-visible]:outline-ink ${large ? 'min-h-[64px]' : 'min-h-[56px]'}`}
        >
          {open ? (
            <>
              <span id={`${id}-open`} hidden>
                {open.label}
              </span>
              <button
                ref={openRef}
                type="button"
                data-row-open=""
                onClick={open.onOpen}
                aria-labelledby={`${id}-open ${id}-title`}
                aria-describedby={openDescribed}
                aria-expanded={open.expanded}
                aria-controls={open.expanded ? open.controls : undefined}
                aria-haspopup={open.expanded === undefined ? 'dialog' : undefined}
                className="absolute inset-0 cursor-pointer rounded-tile focus-visible:outline-none"
              />
            </>
          ) : (
            // The words tick too: a second label for the same box, laid over the card, adding no stop for the keyboard.
            <label htmlFor={`${id}-box`} aria-hidden="true" className="absolute inset-0 cursor-pointer rounded-tile" />
          )}
          <span ref={under.title} className="min-w-0 flex-1">
            <span id={`${id}-title`} className={`block ${subtitle ? 'text-row-title' : 'text-body'} ${checked && strike ? 'text-ink-mute line-through' : ''}`}>
              {title}
            </span>
            {(subtitle || badge) && (
              // The badge sits beside the note, or under it with xs between when the line is full (it touched the note's descenders).
              <span className="flex flex-wrap items-center gap-xs">
                {subtitle && (
                  <span id={`${id}-sub`} className="text-card-note text-ink-soft">
                    {subtitle}
                  </span>
                )}
                {badge && (
                  <span id={`${id}-badge`} className="contents">
                    {badge}
                  </span>
                )}
              </span>
            )}
          </span>
          {(top || foot || time || marks) && (
            // On a wide card (36rem and up) every tag sits at the right, held to 40% so the title keeps at least 60% (2026-11-13, the founder:
            // "wrap the tags on tasks"). Left to right, in the order they are drawn and reached by Tab (review 2026-11-13: the row was drawn
            // reversed, so Tab went from the far right leftwards): the other marks, the time and the pillar as one pair (wrapping inside itself
            // when the 40% is narrower than both), the corner (a task's priority), then the small edit button at the far right. When the marks
            // would wrap there, the pair and the corner keep the first line and the marks take a line of their own under them (`stack`), each
            // line filled. A narrower card keeps only the corner and the edit button here, at its top right.
            <span ref={under.right} className={`${top ? 'flex' : 'hidden @xl:flex'} min-w-0 shrink-0 items-center gap-xs self-start ${under.on ? '' : '@xl:max-w-[40%] @xl:self-center'} @xl:flex-wrap @xl:justify-end`}>
              {marks && under.mode === 'line' && marksAtRight}
              {/* When the time and pillar cannot share the 40% with the priority and the edit button, those two keep the top right and the
                  pair takes the line under them, so the corner stays the corner and Tab still reads top to bottom (review 2026-11-13). */}
              {under.cornerFirst && top}
              {(time || foot) && (
                <span ref={under.pair} className="hidden max-w-full flex-wrap justify-end gap-xs @xl:flex">
                  {time && (
                    <span id={`${id}-time`} className="contents">
                      {time}
                    </span>
                  )}
                  {foot && (
                    <span id={`${id}-foot`} className="contents">
                      {foot}
                    </span>
                  )}
                </span>
              )}
              {!under.cornerFirst && top}
              {marks && under.mode === 'stack' && marksAtRight}
            </span>
          )}
          {under.on && marks && (
            // Under the title (T1, 2026-11-13): a row of the card's whole inner width from the title's left edge, each tag at its own width,
            // left-aligned (review 2026-11-13: held to the title's column and stretched, seven tags took three lines); only when they need more
            // than one line here does each line fill, so none stands alone on the last.
            <span ref={under.marks} id={`${id}-marks`} className={`order-last hidden basis-full flex-wrap justify-start gap-xs @xl:flex ${under.wraps ? 'fill-row-all' : ''}`}>
              {marks}
            </span>
          )}
          {(marks || time || foot) && (
            // A narrower card (a phone, a tablet's column, a narrow laptop): every tag but the corner flows under the title (2026-11-13, the
            // founder), the title keeping the card's whole width and the corner and edit button its top right. The other marks fill each
            // line (`fill-row-all`), so none stands alone; the pillar keeps its own width, never stretched, with the time directly left of
            // it as one pair at the end of the last line (a time with no pillar, on a pillar's own page, is one more mark).
            <span className={`${marks ? 'fill-row-all' : ''} order-last flex basis-full flex-wrap justify-end gap-xs @xl:hidden`}>
              {marks}
              {foot ? (
                <span data-items={time ? 2 : 1} className="flex flex-none flex-wrap justify-end gap-xs">
                  {time}
                  {foot}
                </span>
              ) : (
                time
              )}
            </span>
          )}
        </div>
        {aside}
      </div>
      {note && (
        <p id={`${id}-note`} role="status" className="mt-xs m-0 rounded-tile bg-paper px-sm py-xs text-subhead">
          {note}
          {lockAction && note === lockedMessage && <> {lockAction}</>}
        </p>
      )}
    </div>
  );
}

/** The tags' gap (xs) and the title's gap to them (sm), in px, as drawn. */
const TAG_GAP = 8;
const TITLE_GAP = 12;
/** The share of a wide card the tags at its right may take, so the title keeps at least 60% (`@xl:max-w-[40%]`). */
const RIGHT_SHARE = 0.4;
/** `@xl`, the card width from which its tags sit at its right, in rem. */
const WIDE_REM = 36;

/** An element's width with its contents unstretched (a mark the row stretches to fill its line): its words and icon, plus its own padding
 *  and border. */
function naturalWidth(el: Element): number {
  const range = document.createRange();
  range.selectNodeContents(el);
  const cs = getComputedStyle(el);
  return range.getBoundingClientRect().width + parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) + parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth);
}
/**
 * The items a box lays out in a row (looking through `display: contents` wrappers), and the width they need on one line with their gaps.
 * `stretched`: the box stretches its items (the marks at a wide card's right), so each is read unstretched; else each as drawn.
 */
function rowWidth(box: Element | null, { skip = null, open = null, stretched = false }: { skip?: Element | null; /** A box inside whose items count one by one (the time and pillar pair, which may wrap inside itself). */ open?: Element | null; stretched?: boolean } = {}): number {
  if (!box) return 0;
  const items: Element[] = [];
  const walk = (el: Element) => {
    for (const child of el.children) {
      if (child === skip) continue;
      const d = getComputedStyle(child).display;
      if (d === 'contents' || (child === open && d !== 'none')) walk(child);
      else if (d !== 'none') items.push(child);
    }
  };
  walk(box);
  return items.reduce((w, el) => w + (stretched ? naturalWidth(el) : el.getBoundingClientRect().width), 0) + Math.max(0, items.length - 1) * TAG_GAP;
}
/** A canvas to measure a space in a given font (one for every row). */
let spaceCanvas: CanvasRenderingContext2D | null | undefined;
/** The width of one space in an element's font, in px. */
function spaceWidth(el: Element): number {
  if (spaceCanvas === undefined) spaceCanvas = document.createElement('canvas').getContext('2d');
  if (!spaceCanvas) return 0;
  const cs = getComputedStyle(el);
  spaceCanvas.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  return spaceCanvas.measureText(' ').width + (parseFloat(cs.wordSpacing) || 0);
}
/**
 * A title's width on one line, however it wraps now: the widths of the lines it takes added up, plus the space each soft break swallowed
 * (review 2026-11-13: without it a title a space wider than the room read as fitting, moved the marks under it and still wrapped).
 */
function oneLineWidth(el: Element | null): number {
  if (!el) return 0;
  const range = document.createRange();
  range.selectNodeContents(el);
  const rects = [...range.getClientRects()].filter((r) => r.width > 0);
  const lines = new Set(rects.map((r) => Math.round(r.top))).size;
  return rects.reduce((w, r) => w + r.width, 0) + Math.max(0, lines - 1) * spaceWidth(el);
}

/**
 * Whether a wide card draws its other marks under the title (T1, 2026-11-13). Read from widths that do not change with the choice (each
 * tag's own width unstretched, the title's words on one line, the card's inner width), so it never flips back and forth; read again when the
 * card changes size, on every draw (cheap, a few reads) and once the font is in. A card under `@xl` never does: its tags are under the title
 * already.
 */
function useMarksUnder(hasMarks: boolean) {
  const card = useRef<HTMLDivElement>(null);
  const titleCol = useRef<HTMLSpanElement>(null);
  const right = useRef<HTMLSpanElement>(null);
  const pair = useRef<HTMLSpanElement>(null);
  const marksEl = useRef<HTMLSpanElement>(null);
  // `line`: at the right, all on the title's line; `stack`: at the right, the marks on a line of their own under the time, pillar and corner;
  // `under1`: under the title on one line, left-aligned; `under2`: under the title on more lines, each line filled.
  const [mode, setMode] = useState<'line' | 'stack' | 'under1' | 'under2'>('line');
  // At the right, whether the time and pillar with the priority and edit button overrun the 40% (then the corner is drawn first).
  const [cornerFirst, setCornerFirst] = useState(false);
  const measure = useRef<() => void>(() => undefined);
  measure.current = () => {
    const c = card.current;
    if (!c || !hasMarks) {
      setMode('line');
      return;
    }
    const cs = getComputedStyle(c);
    const inner = c.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    if (inner < WIDE_REM * rem) {
      setMode('line');
      return;
    }
    const title = titleCol.current?.firstElementChild ?? null;
    const sideW = rowWidth(right.current, { skip: marksEl.current, open: pair.current });
    const marksW = rowWidth(marksEl.current, { stretched: true });
    const titleW = oneLineWidth(title);
    const room = inner * RIGHT_SHARE;
    const allAtRight = sideW + (sideW > 0 ? TAG_GAP : 0) + marksW;
    const besideTitle = inner - TITLE_GAP - sideW;
    // Under when the marks would wrap at the right and the title fits one line in the room beside the time, pillar, corner and edit button
    // on one line (a pixel's grace for rounding); that line may then pass the 40% (the 2026-11-13 gate: the time and pillar with P1 and the
    // pencil took about 290px of a 260px share, so the rule never fired on a laptop's Daily). The marks then take a row of the card's whole
    // width under the title, wrapping onto more lines only when that width is not enough. A title that wraps anyway keeps them at the right.
    setCornerFirst(sideW > room + 0.5);
    const wrapsAtRight = marksW > 0 && allAtRight > room + 0.5;
    if (!wrapsAtRight) setMode('line');
    else if (titleW <= besideTitle + 0.5) setMode(marksW > inner + 0.5 ? 'under2' : 'under1');
    else setMode('stack');
  };
  useLayoutEffect(() => {
    measure.current();
  });
  useEffect(() => {
    const c = card.current;
    if (!c) return;
    let w = c.clientWidth;
    const ro = new ResizeObserver(() => {
      // Only the width matters: the card's own height changes with the choice and must not read it again.
      if (c.clientWidth === w) return;
      w = c.clientWidth;
      measure.current();
    });
    ro.observe(c);
    let live = true;
    void document.fonts?.ready.then(() => live && measure.current());
    return () => {
      live = false;
      ro.disconnect();
    };
  }, []);
  return { mode, cornerFirst: cornerFirst && mode !== 'under1' && mode !== 'under2', on: mode === 'under1' || mode === 'under2', wraps: mode === 'under2', card, title: titleCol, right, pair, marks: marksEl };
}

/** The room a row's close needs at its right to stand outside the card: a gap, the 44px button, a gap. */
const OUTSIDE_ROOM = 60;
/** How far past the row a painted box round it may reach and still be its group's box (a time block's box, a fold's card). */
const GROUP_REACH = 40;

/** The right edge of the painted box the row sits in (a time block's `tb-box` and its padding), when one reaches just past the row. */
function groupRight(row: HTMLElement): number {
  const right = row.getBoundingClientRect().right;
  let edge = right;
  let a = row.parentElement;
  for (let depth = 0; a && depth < 6 && a !== document.body; depth += 1, a = a.parentElement) {
    const r = a.getBoundingClientRect().right;
    if (r - right > GROUP_REACH) break;
    if (r <= edge + 0.5) continue;
    const cs = getComputedStyle(a);
    const painted = cs.backgroundImage !== 'none' || !/rgba\([^)]*,\s*0\)|transparent/.test(cs.backgroundColor) || parseFloat(cs.borderRightWidth) > 0;
    if (painted) edge = r;
  }
  return edge;
}

/**
 * The close of a row whose plan is open in place (2026-11-13, the founder: "put the close button outside on scroll in daily tasks"). Drawn
 * inside the row's own element (a task's `li`, which is `relative` and holds the card and the plan under it), right after the card in the
 * page's order, so the keyboard meets it straight after the card's own control and before the plan's fields; it sits in a rail as tall as
 * the two, so the button is sticky: it starts level with the card's first line and stays in view while the plan scrolls by, stopping at
 * the plan's end. Where the page has a margin at the row's right (60px or more past the row, or past the painted box round it such as a
 * time block's, before the window's edge or On this page when it shows) the rail stands in that margin and the button is the 44px round
 * `CloseButton` with its name as a tip; where it has none (a phone, a tablet's column, a narrow laptop) the rail runs down the row's own
 * right edge with the 32px one where the small edit button was, named but with no tip (a tip there would sit on the card's words), and
 * the open plan keeps a lane for it (`.row-lane`, padded only while the row says `data-row-close="in"`), so it never covers a field. A
 * tap or Enter hands focus to the card's control and brings the card back into view when the plan was scrolled past it.
 */
export function RowClose({ onClose, label = 'Close the plan' }: { onClose: () => void; /** Its name, with the task's title ("Close the plan for Call the bank"); its tip says only "Close the plan", so it fits the margin. */ label?: string }) {
  const rail = useRef<HTMLSpanElement>(null);
  const [out, setOut] = useState(false);
  const [shift, setShift] = useState(0);
  useLayoutEffect(() => {
    const row = rail.current?.parentElement;
    if (!row) return;
    const measure = () => {
      const contents = document.querySelector('.page-contents')?.getBoundingClientRect();
      const limit = contents && contents.width > 0 ? contents.left : document.documentElement.clientWidth;
      const right = row.getBoundingClientRect().right;
      const edge = groupRight(row);
      setShift(Math.round(edge - right));
      setOut(limit - edge >= OUTSIDE_ROOM);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(row);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);
  // The row says which way it is drawn, so its plan keeps a lane only when the button runs down its edge.
  useLayoutEffect(() => {
    const row = rail.current?.parentElement;
    if (!row) return;
    row.dataset.rowClose = out ? 'out' : 'in';
    return () => {
      delete row.dataset.rowClose;
    };
  }, [out]);
  return (
    <span ref={rail} data-mode={out ? 'out' : 'in'} className="row-close-rail" style={out && shift > 0 ? ({ '--row-close-shift': `${shift}px` } as CSSProperties) : undefined}>
      <span className="row-close-slot">
        <CloseButton
          data-row-close-btn=""
          label={label}
          small={!out}
          tip={out ? 'Close the plan' : false}
          className="row-close"
          // A mouse or a finger leaves focus where it was; the keyboard's Enter focuses the card's control below, like a tap.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            const row = rail.current?.parentElement;
            const opener = row?.querySelector<HTMLElement>('[data-row-open]');
            opener?.focus({ preventScroll: true });
            onClose();
            // Closed from deep in the plan, the card would be above the window: bring it back under the top bar.
            requestAnimationFrame(() => {
              const card = opener?.closest('.check-line');
              if (!card) return;
              const bar = document.querySelector('.fx-condensed[data-on]')?.getBoundingClientRect().height ?? 0;
              const top = card.getBoundingClientRect().top - bar - 8;
              if (top < 0) window.scrollBy({ top });
            });
          }}
        />
      </span>
    </span>
  );
}
