import { rulerClamp, rulerIndex, rulerTicks, rulerValueAt } from '@kreators/shared';
import gsap from 'gsap';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import { prefersReducedMotion } from './fx/env';
import { tick as buzz } from './fx/haptics';
import { tickSound, unlockAudio } from '../lib/audioCore';

/** Where a tick sits: the distance between two ticks in pixels. The CSS reads it from `--rp-gap`, set from this same number. */
const GAP = 14;
export type RulerAccent = 'r1' | 'r2' | 'r3' | 'r4' | 'r5' | 'r6' | 'r7';

interface Props {
  /** The name a screen reader says: "Focus length". */
  label: string;
  /** The chosen number, or null when nothing is chosen yet (the ruler then rests at `defaultValue` with no mark picked). */
  value: number | null;
  onChange: (value: number) => void;
  /** Called once a drag, a jump or a burst of key presses has settled: the place to save, so a drag is one save and not twenty. */
  onCommit?: (value: number) => void;
  min: number;
  max: number;
  step: number;
  /** Put a number above every tick that is a multiple of this (20, 25 and 30 when it is 5). */
  labelEvery?: number;
  /** What Page Up, Page Down and Shift with an arrow move by. The labelled step when there is one, else five ticks. */
  majorStep?: number;
  /** The words above a labelled tick. */
  format?: (value: number) => string;
  /** The words a screen reader says for the value: "25 minutes". */
  valueText?: (value: number) => string;
  /** A relationship colour. Orange by default. */
  accent?: RulerAccent;
  /** `night` is white and the accent on the dark slate card; `paper` is ink and the accent on the page or a sheet. */
  tone?: 'night' | 'paper';
  disabled?: boolean;
  /** No tick sound (a buzz on a phone still follows the person's Vibrate setting). */
  silent?: boolean;
  /** Where an empty ruler (value null) rests. */
  defaultValue?: number;
  className?: string;
}

/**
 * A ruler for choosing a number: tick marks you swipe along or click, with the chosen one in the accent colour under a small marker, the
 * ticks near it taller and brighter, and a label above every few. It is one slider for the keyboard and a screen reader (`role="slider"`,
 * arrows by a step, Shift or Page keys by the labelled step, Home and End), and a drag that snaps to the nearest tick. `touch-action: pan-y`
 * leaves vertical scrolling to the page. A tick is a buzz (the person's Vibrate setting) and a very soft sound (the master sound switch).
 * Under reduced motion the ruler jumps instead of gliding. It only changes how a number is chosen: the caller owns the value and what is saved.
 */
export function RulerPicker({ label, value, onChange, onCommit, min, max, step, labelEvery, majorStep, format = String, valueText, accent = 'r2', tone = 'paper', disabled = false, silent = false, defaultValue, className = '' }: Props) {
  const ticks = useMemo(() => rulerTicks(min, max, step, labelEvery), [min, max, step, labelEvery]);
  const last = ticks.length - 1;
  const top = ticks[last]?.value ?? min;
  const rest = defaultValue ?? ticks[Math.floor(last / 2)]?.value ?? min;
  // A value from outside is held to the ruler (inside min and max, on a tick) before it is drawn, so a stray saved number never sits off the marks.
  const shownValue = value === null ? rest : rulerClamp(value, min, max, step);
  const floatIdx = rulerIndex(shownValue, min, max, step);
  const nearest = Math.round(floatIdx);

  const root = useRef<HTMLDivElement>(null);
  // How many ticks fit either side of the marker. A label further out than that would be cut by the view's edge on a narrow phone, so it
  // is not drawn (the ticks still are, fading out).
  const [reach, setReach] = useState(Number.POSITIVE_INFINITY);
  useLayoutEffect(() => {
    const el = root.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const measure = () => setReach(Math.max(2, Math.floor(el.clientWidth / 2 / GAP) - 2));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const track = useRef<HTMLDivElement>(null);
  const shown = useRef(floatIdx); // where the track is drawn, in ticks (fractional while dragging)
  const drag = useRef<{ x0: number; idx0: number; moved: boolean } | null>(null);
  const live = useRef({ value, onChange, onCommit, min, max, step, last, rest });
  live.current = { value, onChange, onCommit, min, max, step, last, rest };
  const commitTimer = useRef<number | null>(null);
  const lastEmitted = useRef<number | null>(null);

  const xOf = (idx: number) => -(idx + 0.5) * GAP;
  const place = (idx: number, glide: boolean) => {
    const el = track.current;
    if (!el) return;
    shown.current = idx;
    gsap.killTweensOf(el);
    if (glide && !prefersReducedMotion()) gsap.to(el, { x: xOf(idx), duration: 0.28, ease: 'power3.out', overwrite: true });
    else gsap.set(el, { x: xOf(idx) });
  };

  // First paint: the chosen tick under the marker, with no glide.
  useLayoutEffect(() => {
    place(floatIdx, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // A value that changes from outside (a preset, a reset, a saved setting arriving) glides there; a drag moves the track itself.
  useEffect(() => {
    if (drag.current) return;
    if (Math.abs(shown.current - floatIdx) > 0.001) place(floatIdx, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floatIdx]);
  // What the owner holds is the truth again once it has caught up with what was just sent.
  useEffect(() => {
    lastEmitted.current = null;
  }, [value]);
  useEffect(
    () => () => {
      if (track.current) gsap.killTweensOf(track.current);
      if (commitTimer.current) window.clearTimeout(commitTimer.current);
    },
    [],
  );

  const valueOfIdx = (i: number) => rulerValueAt(i * GAP, live.current.min, live.current.max, live.current.step, GAP);
  const feel = () => {
    buzz(6);
    if (!silent) tickSound();
  };
  const emit = (i: number, quiet = false) => {
    const v = valueOfIdx(i);
    if (v === (lastEmitted.current ?? live.current.value)) return;
    if (!quiet) feel();
    lastEmitted.current = v;
    live.current.onChange(v);
  };
  const settle = (v: number) => {
    if (commitTimer.current) window.clearTimeout(commitTimer.current);
    commitTimer.current = null;
    live.current.onCommit?.(v);
  };
  const settleSoon = () => {
    if (commitTimer.current) window.clearTimeout(commitTimer.current);
    commitTimer.current = window.setTimeout(() => {
      commitTimer.current = null;
      const v = lastEmitted.current ?? live.current.value;
      if (v !== null && v !== undefined) live.current.onCommit?.(v);
    }, 350);
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (disabled || (e.pointerType === 'mouse' && e.button !== 0)) return;
    unlockAudio();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // capture is a nicety
    }
    drag.current = { x0: e.clientX, idx0: shown.current, moved: false };
    root.current?.focus({ preventScroll: true });
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x0;
    if (!d.moved && Math.abs(dx) < 4) return;
    d.moved = true;
    const f = Math.min(live.current.last, Math.max(0, d.idx0 - dx / GAP));
    place(f, false);
    emit(Math.round(f));
  };
  const finish = (e: PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // not captured
    }
    if (cancelled) {
      place(rulerIndex(live.current.value ?? live.current.rest, live.current.min, live.current.max, live.current.step), true);
      return;
    }
    if (!d.moved) {
      // A click or tap: jump to the tick under the pointer.
      const box = e.currentTarget.getBoundingClientRect();
      const i = Math.min(live.current.last, Math.max(0, Math.round(shown.current + (e.clientX - (box.left + box.width / 2)) / GAP)));
      place(i, true);
      emit(i);
      settle(valueOfIdx(i));
      return;
    }
    const i = Math.round(shown.current);
    place(i, true);
    emit(i, true);
    settle(valueOfIdx(i));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const k = e.key;
    const big = majorStep ?? labelEvery ?? step * 5;
    const base = live.current.value ?? live.current.rest;
    let next: number | null = null;
    if (k === 'ArrowRight' || k === 'ArrowUp') next = base + (e.shiftKey ? big : step);
    else if (k === 'ArrowLeft' || k === 'ArrowDown') next = base - (e.shiftKey ? big : step);
    else if (k === 'PageUp') next = base + big;
    else if (k === 'PageDown') next = base - big;
    else if (k === 'Home') next = live.current.min;
    else if (k === 'End') next = Number.MAX_SAFE_INTEGER;
    if (next === null) return;
    e.preventDefault();
    const i = rulerIndex(next, live.current.min, live.current.max, live.current.step);
    emit(Math.round(i));
    settleSoon();
  };

  const accentStyle = { '--rp-gap': `${GAP}px` } as CSSProperties;
  const text = valueText ?? format;
  return (
    <div
      ref={root}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      aria-orientation="horizontal"
      aria-valuemin={min}
      aria-valuemax={top}
      aria-valuenow={value ?? undefined}
      aria-valuetext={value === null ? 'Not chosen' : text(value)}
      aria-disabled={disabled || undefined}
      data-accent={accent}
      data-tone={tone}
      data-empty={value === null ? '' : undefined}
      className={`rp ${className}`}
      style={accentStyle}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => finish(e, false)}
      onPointerCancel={(e) => finish(e, true)}
      onKeyDown={onKeyDown}
      onBlur={() => {
        if (commitTimer.current) {
          const v = lastEmitted.current ?? live.current.value;
          if (v !== null && v !== undefined) settle(v);
        }
      }}
    >
      <div className="rp-view" aria-hidden="true">
        <div ref={track} className="rp-track">
          {ticks.map((t, i) => {
            const d = Math.abs(i - nearest);
            const on = value !== null && i === nearest;
            // The chosen tick always names itself; the labelled ticks within two marks of it step aside so no two numbers touch.
            const label = on || (t.major && d <= reach && !(value !== null && !ticks[nearest]?.major && d <= 2));
            return (
              <span key={t.value} className="rp-tick" data-on={on ? '' : undefined} style={{ '--o': Math.max(0.16, 1 - d * 0.1), '--h': `${Math.max(12, 34 - d * 3)}px` } as CSSProperties}>
                <i className="rp-line" />
                {label && <b className="rp-label">{format(t.value)}</b>}
              </span>
            );
          })}
        </div>
      </div>
      <span className="rp-marker" aria-hidden="true" />
    </div>
  );
}
