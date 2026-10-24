import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import type React from 'react';
import { Link } from 'react-router';
import { MoodFace } from './MoodFace';

/**
 * The kit's chart vocabulary, drawn in SVG with the theme's tokens so every one works in light and dark.
 * Smooth area lines with a soft fill, tall pill bars, gauges, donuts, packed bubbles, a month grid,
 * an emoji row, and the small marks that sit on tracker rows. Colours come in as CSS values, never hex.
 */

type Pt = readonly [number, number];

/**
 * A smooth curve through the points, the way the kit draws heart rate and mood. Monotone cubic
 * (Fritsch and Carlson), so the curve never swings below a run of zeros or above a plateau.
 */
function smooth(pts: Pt[]): string {
  const n = pts.length;
  if (n === 0) return '';
  if (n === 1) return `M${pts[0]![0]} ${pts[0]![1]}`;
  const dx: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i += 1) {
    dx[i] = pts[i + 1]![0] - pts[i]![0];
    m[i] = dx[i] === 0 ? 0 : (pts[i + 1]![1] - pts[i]![1]) / dx[i]!;
  }
  const t: number[] = [];
  t[0] = m[0]!;
  t[n - 1] = m[n - 2]!;
  for (let i = 1; i < n - 1; i += 1) {
    if (m[i - 1]! * m[i]! <= 0) t[i] = 0;
    else {
      const w1 = 2 * dx[i]! + dx[i - 1]!;
      const w2 = dx[i]! + 2 * dx[i - 1]!;
      t[i] = (w1 + w2) / (w1 / m[i - 1]! + w2 / m[i]!);
    }
  }
  let d = `M${pts[0]![0]} ${pts[0]![1]}`;
  for (let i = 0; i < n - 1; i += 1) {
    const h = dx[i]! / 3;
    const c1: Pt = [pts[i]![0] + h, pts[i]![1] + t[i]! * h];
    const c2: Pt = [pts[i + 1]![0] - h, pts[i + 1]![1] - t[i + 1]! * h];
    d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${pts[i + 1]![0]} ${pts[i + 1]![1]}`;
  }
  return d;
}

const polar = (cx: number, cy: number, r: number, deg: number): Pt => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
};

function arc(cx: number, cy: number, r: number, from: number, to: number): string {
  const [sx, sy] = polar(cx, cy, r, from);
  const [ex, ey] = polar(cx, cy, r, to);
  const large = to - from > 180 ? 1 : 0;
  return `M${sx.toFixed(2)} ${sy.toFixed(2)} A${r} ${r} 0 ${large} 1 ${ex.toFixed(2)} ${ey.toFixed(2)}`;
}

/** Seven bars, one per day, the way the kit draws a week. */
export function WeekBars({ values, max, color, labels, label }: { values: (number | null)[]; max: number; color: string; labels: string[]; label: string }) {
  return (
    <div role="img" aria-label={label} className="flex h-[96px] items-end gap-xs">
      {values.map((v, i) => {
        const h = v === null ? 0 : Math.max(6, Math.round((Math.min(v, max) / max) * 72));
        return (
          <div key={i} className="flex flex-1 flex-col items-center justify-end gap-xs">
            <span className="block w-full rounded-pill" style={{ height: h, background: v === null ? 'var(--color-line)' : color }} />
            <span className="text-[12px] font-bold text-ink-soft">{labels[i]}</span>
          </div>
        );
      })}
    </div>
  );
}

/** A small smooth line with a soft fill under it, for tracker rows. Missing days are skipped. */
export function Sparkline({ values, max, color, width = 72, height = 28 }: { values: (number | null)[]; max: number; color: string; width?: number; height?: number }) {
  const id = useId();
  const pts = values.map((v, i) => [Math.round((i / Math.max(1, values.length - 1)) * width), v === null ? null : Math.round(height - (Math.min(v, max) / max) * (height - 6) - 3)] as const);
  const have = pts.filter((p): p is readonly [number, number] => p[1] !== null);
  const line = smooth(have);
  const last = have.at(-1);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" className="shrink-0">
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.35" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {have.length > 1 && <path d={`${line} L${last![0]} ${height} L${have[0]![0]} ${height} Z`} fill={`url(#${id})`} />}
      {have.length > 1 ? <path d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /> : <path d={`M0 ${height - 3} L${width} ${height - 3}`} fill="none" stroke="var(--color-line)" strokeWidth="2" strokeLinecap="round" />}
      {last && <circle cx={last[0]} cy={last[1]} r="3.5" fill={color} />}
    </svg>
  );
}

/** The measured pixel width of a block, so charts draw in real pixels and nothing stretches. */
function useWidth(fallback = 320): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => setW(Math.max(80, Math.round(el.getBoundingClientRect().width) || fallback));
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [fallback]);
  return [ref, w];
}

const clampN = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const PAD = { l: 8, r: 12, t: 12, b: 12 };
/** The plot floor sits this far above the axis, so a run of zeros draws as its own line, not on top of the axis. */
const FLOOR = 4;

/** The frame every line chart sits in: a y axis with three labels, a baseline, dashed gridlines, and x labels under it. Drawn whether or not there is data. */
function Frame({ width, height, min, max, yFormat, labels, shown, onFill, axes, children, empty, measureRef }: { width: number; height: number; min: number; max: number; yFormat: (v: number) => string; labels?: string[]; shown: Set<number>; onFill: boolean; axes: boolean; children: ReactNode; empty: string | null; measureRef: React.RefObject<HTMLDivElement | null> }) {
  const axisColor = onFill ? 'rgba(255,255,255,0.75)' : 'var(--color-ink-mute)';
  const gridColor = onFill ? 'rgba(255,255,255,0.35)' : 'var(--color-line)';
  const span = Math.max(1e-6, max - min);
  const y = (v: number) => PAD.t + (1 - (clampN(v, min, max) - min) / span) * (height - PAD.t - PAD.b - FLOOR);
  const ticks = [max, (max + min) / 2, min];
  return (
    <>
      {axes && (
        <div className="relative shrink-0 text-right text-[12px] font-bold" style={{ height, minWidth: 24 }} aria-hidden="true">
          {ticks.map((t, i) => (
            <span key={i} className={`absolute right-0 block -translate-y-1/2 leading-none whitespace-nowrap ${onFill ? 'text-on-fill opacity-85' : 'text-ink-soft'}`} style={{ top: y(t) }}>
              {yFormat(t)}
            </span>
          ))}
        </div>
      )}
      <div ref={measureRef} className="relative min-w-0 flex-1">
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true" className="block overflow-visible">
          {axes && ticks.slice(0, 2).map((t, i) => <line key={i} x1={PAD.l} x2={width - PAD.r} y1={y(t)} y2={y(t)} stroke={gridColor} strokeWidth="1.5" strokeDasharray="4 6" />)}
          {axes ? (
            <path d={`M${PAD.l} ${PAD.t} V${height - PAD.b} H${width - PAD.r}`} fill="none" stroke={axisColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          ) : (
            <path d={`M${PAD.l} ${height - PAD.b} H${width - PAD.r}`} fill="none" stroke={gridColor} strokeWidth="2" strokeLinecap="round" />
          )}
          {children}
        </svg>
        {empty && (
          <p className={`pointer-events-none absolute inset-x-0 m-0 px-lg text-center text-[14px] font-bold ${onFill ? 'text-on-fill' : 'text-ink-soft'}`} style={{ top: (PAD.t + height - PAD.b) / 2, transform: 'translateY(-50%)' }} aria-hidden="true">
            {empty}
          </p>
        )}
        {labels && (
          <div className="mt-xs flex">
            {labels.map((l, i) => (
              <span key={i} className={`flex-1 text-[12px] font-bold ${onFill ? 'text-on-fill opacity-85' : 'text-ink-soft'} ${i === 0 ? 'text-left' : i === labels.length - 1 ? 'text-right' : 'text-center'}`}>
                {shown.has(i) ? l : ''}
              </span>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

/**
 * The kit's area line: a smooth curve over a soft gradient inside a visible frame (y axis with labels,
 * baseline, gridlines). The latest point is marked. The frame shows even when nothing is logged yet.
 */
export function AreaLine({ values, max, min = 0, color, label, labels, height = 140, thick = 3, onFill = false, axes = true, yFormat = (v) => String(Math.round(v)), empty = 'Nothing logged yet', allLabels = false }: { values: (number | null)[]; max: number; min?: number; color: string; label: string; labels?: string[]; height?: number; thick?: number; onFill?: boolean; axes?: boolean; yFormat?: (v: number) => string; empty?: string; allLabels?: boolean }) {
  const id = useId();
  const [ref, w] = useWidth();
  const span = Math.max(1e-6, max - min);
  const x = (i: number) => PAD.l + (i / Math.max(1, values.length - 1)) * (w - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - (clampN(v, min, max) - min) / span) * (height - PAD.t - PAD.b - FLOOR);
  const have = values.map((v, i) => (v === null ? null : ([x(i), y(v)] as const))).filter((p): p is readonly [number, number] => p !== null);
  const line = smooth(have);
  const last = have.at(-1);
  const shown = new Set(labels ? (allLabels ? labels.map((_, i) => i) : [0, Math.floor((labels.length - 1) / 2), labels.length - 1]) : []);
  return (
    <div role="img" aria-label={label} className="flex gap-xs">
      <Frame measureRef={ref} width={w} height={height} min={min} max={max} yFormat={yFormat} labels={labels} shown={shown} onFill={onFill} axes={axes} empty={have.length === 0 ? empty : null}>
        <defs>
          <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity={onFill ? 0.45 : 0.3} />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {have.length > 1 && <path d={`${line} L${last![0]} ${height - PAD.b} L${have[0]![0]} ${height - PAD.b} Z`} fill={`url(#${id})`} />}
        {have.length > 1 && <path d={line} fill="none" stroke={color} strokeWidth={thick} strokeLinecap="round" strokeLinejoin="round" />}
        {last && <circle cx={last[0]} cy={last[1]} r="5" fill={onFill ? 'white' : 'var(--color-card)'} stroke={color} strokeWidth="3" />}
      </Frame>
    </div>
  );
}

/** Several smooth lines on one frame, each with a soft fill, and a legend above. For money in against money out, or mood, sleep and calm together. */
export function MultiLine({ series, max, min = 0, labels, height = 160, label, yFormat = (v) => String(Math.round(v)), empty = 'Nothing logged yet', allLabels = false }: { series: { values: (number | null)[]; color: string; label: string }[]; max: number; min?: number; labels?: string[]; height?: number; label: string; yFormat?: (v: number) => string; empty?: string; allLabels?: boolean }) {
  const id = useId();
  const [ref, w] = useWidth();
  const n = Math.max(1, ...series.map((s) => s.values.length));
  const span = Math.max(1e-6, max - min);
  const x = (i: number) => PAD.l + (i / Math.max(1, n - 1)) * (w - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - (clampN(v, min, max) - min) / span) * (height - PAD.t - PAD.b - FLOOR);
  const shown = new Set(labels ? (allLabels ? labels.map((_, i) => i) : [0, Math.floor((labels.length - 1) / 2), labels.length - 1]) : []);
  const any = series.some((s) => s.values.some((v) => v !== null));
  return (
    <div role="img" aria-label={label}>
      <ul className="m-0 flex list-none flex-wrap gap-sm p-0 text-[12px] font-bold text-ink-soft">
        {series.map((s) => (
          <li key={s.label} className="flex items-center gap-xs">
            <span className="block h-[4px] w-[16px] rounded-pill" style={{ background: s.color }} aria-hidden="true" />
            {s.label}
          </li>
        ))}
      </ul>
      <div className="mt-xs flex gap-xs">
        <Frame measureRef={ref} width={w} height={height} min={min} max={max} yFormat={yFormat} labels={labels} shown={shown} onFill={false} axes empty={any ? null : empty}>
          <defs>
            {series.map((s, i) => (
              <linearGradient key={i} id={`${id}-${i}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor={s.color} stopOpacity="0.22" />
                <stop offset="1" stopColor={s.color} stopOpacity="0" />
              </linearGradient>
            ))}
          </defs>
          {series.map((s, i) => {
            const have = s.values.map((v, j) => (v === null ? null : ([x(j), y(v)] as const))).filter((p): p is readonly [number, number] => p !== null);
            if (have.length === 0) return null;
            const line = smooth(have);
            const last = have.at(-1)!;
            return (
              <g key={i}>
                {have.length > 1 && <path d={`${line} L${last[0]} ${height - PAD.b} L${have[0]![0]} ${height - PAD.b} Z`} fill={`url(#${id}-${i})`} />}
                {have.length > 1 && <path d={line} fill="none" stroke={s.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}
                <circle cx={last[0]} cy={last[1]} r="4.5" fill="var(--color-card)" stroke={s.color} strokeWidth="3" />
              </g>
            );
          })}
        </Frame>
      </div>
    </div>
  );
}

/**
 * The kit's tall pill bars: every day is a full-height pale track, the value fills it from the bottom.
 * A colour per bar lets a down day read orange against up days in green.
 */
export function PillBars({ values, max, labels, colors, color, label, height = 120, allLabels = false, dots, onFill = false }: { values: (number | null)[]; max: number; labels: string[]; colors?: (string | undefined)[]; color: string; label: string; height?: number; allLabels?: boolean; dots?: (number | boolean)[]; onFill?: boolean }) {
  const shown = new Set(allLabels ? values.map((_, i) => i) : [0, Math.floor((values.length - 1) / 2), values.length - 1]);
  return (
    <div role="img" aria-label={label}>
      <div className="flex items-end gap-xs" style={{ height }}>
        {values.map((v, i) => {
          const fill = v === null ? 0 : Math.max(0.08, Math.min(1, v / Math.max(1e-6, max)));
          const c = colors?.[i] ?? color;
          return (
            <div key={i} className="relative flex h-full flex-1 flex-col justify-end overflow-hidden rounded-pill" style={{ background: onFill ? 'rgba(255,255,255,0.22)' : `color-mix(in oklab, ${c} 18%, var(--color-card))` }}>
              {dots && dots[i] ? <span className="absolute top-xs left-1/2 size-[6px] -translate-x-1/2 rounded-pill" style={{ background: c }} aria-hidden="true" /> : null}
              <span className="block w-full rounded-pill" style={{ height: `${Math.round(fill * 100)}%`, background: v === null ? 'transparent' : c }} />
            </div>
          );
        })}
      </div>
      <div className="mt-xs flex gap-xs">
        {values.map((_, i) => (
          <span key={i} className={`flex-1 text-center text-[12px] font-bold ${onFill ? 'text-on-fill opacity-80' : 'text-ink-soft'}`}>
            {shown.has(i) ? labels[i] : ''}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Any number of thin bars, oldest first. Kept for places that want the simple look. */
export function Bars({ values, labels, color, label, highlight, dots, allLabels = false, colors }: { values: number[]; labels: string[]; color: string; label: string; highlight?: number; dots?: number[]; allLabels?: boolean; colors?: string[] }) {
  const max = Math.max(1, ...values);
  const shown = new Set(allLabels ? values.map((_, i) => i) : [0, Math.floor((values.length - 1) / 2), values.length - 1]);
  return (
    <div role="img" aria-label={label}>
      <div className="flex h-[96px] items-end gap-xs">
        {values.map((v, i) => {
          const h = v === 0 ? 4 : Math.max(8, Math.round((v / max) * 80));
          const dim = highlight !== undefined && i !== highlight;
          return (
            <div key={i} className="flex flex-1 flex-col items-center justify-end gap-xs">
              {dots && dots[i] ? <span className="block size-[8px] rounded-pill" style={{ background: 'var(--color-ink)' }} aria-hidden="true" /> : null}
              <span className="block w-full rounded-pill" style={{ height: h, background: v === 0 ? 'var(--color-line)' : (colors?.[i] ?? color), opacity: dim ? 0.55 : 1 }} />
            </div>
          );
        })}
      </div>
      <div className="mt-xs flex gap-xs">
        {values.map((_, i) => (
          <span key={i} className="flex-1 text-center text-[12px] font-bold text-ink-soft">
            {shown.has(i) ? labels[i] : ''}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Horizontal bars with a label and a value on each row, for the seven floors or the five areas. */
export function HBars({ rows, label }: { rows: { key: string; label: ReactNode; value: number; text: string; color: string; lead?: ReactNode }[]; label: string }) {
  return (
    <ul role="img" aria-label={label} className="flex list-none flex-col gap-xs p-0 m-0">
      {rows.map((r) => (
        <li key={r.key} className="flex items-center gap-sm">
          {r.lead}
          <span className="w-[96px] shrink-0 truncate text-[14px] font-bold">{r.label}</span>
          <span className="h-[12px] min-w-0 flex-1 overflow-hidden rounded-pill bg-line">
            <span className="block h-full rounded-pill" style={{ width: `${Math.round(Math.max(0, Math.min(1, r.value)) * 100)}%`, background: r.color }} />
          </span>
          <span className="w-[64px] shrink-0 text-right text-[12px] font-extrabold text-ink-soft">{r.text}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * The kit's gauge: a three-quarter arc that fills with the value, the number inside.
 * On a coloured fill pass white as the colour and a translucent white track.
 */
export function Gauge({ value, size = 160, stroke = 14, color, track, label, children }: { value: number; size?: number; stroke?: number; color: string; track?: string; label: string; children?: ReactNode }) {
  const v = Math.max(0, Math.min(1, value));
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const from = 225;
  const sweep = 270;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label}>
        <path d={arc(cx, cy, r, from, from + sweep)} fill="none" stroke={track ?? `color-mix(in oklab, ${color} 18%, transparent)`} strokeWidth={stroke} strokeLinecap="round" />
        {v > 0 && <path d={arc(cx, cy, r, from, from + Math.max(2, sweep * v))} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" />}
        {v > 0 && (() => {
          const [px, py] = polar(cx, cy, r, from + Math.max(2, sweep * v));
          return <circle cx={px} cy={py} r={stroke * 0.5 + 2} fill={color} stroke="rgba(0,0,0,0.12)" strokeWidth="1" />;
        })()}
      </svg>
      {children && <div className="absolute inset-0 flex items-center justify-center">{children}</div>}
    </div>
  );
}

/** The kit's donut: segments with small gaps and a label in the middle. */
export function Donut({ segments, size = 160, stroke = 22, label, children, track }: { segments: { value: number; color: string; label: string }[]; size?: number; stroke?: number; label: string; children?: ReactNode; track?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0);
  const gap = segments.filter((s) => s.value > 0).length > 1 ? c * 0.015 : 0;
  let offset = 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track ?? 'var(--color-line)'} strokeWidth={stroke} />
        {total > 0 &&
          segments.map((s, i) => {
            const len = Math.max(0, (s.value / total) * c - gap);
            const el = len > 0 ? <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset} /> : null;
            offset += (s.value / total) * c;
            return el;
          })}
      </svg>
      {children && <div className="absolute inset-0 flex items-center justify-center text-center">{children}</div>}
    </div>
  );
}

/** The legend that goes with a donut: a dot, a name, a value. */
export function Legend({ items }: { items: { color: string; label: string; text: string }[] }) {
  return (
    <ul className="flex list-none flex-col gap-xs p-0 m-0">
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-xs text-[14px] font-bold">
          <span className="block size-[10px] shrink-0 rounded-pill" style={{ background: it.color }} aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate">{it.label}</span>
          <span className="shrink-0 text-ink-soft">{it.text}</span>
        </li>
      ))}
    </ul>
  );
}

/** The kit's bubble chart: the biggest value sits in the middle, the rest pack around it. */
export function Bubbles({ items, size = 260, label, onFill = false }: { items: { label: string; value: number; color: string }[]; size?: number; label: string; onFill?: boolean }) {
  const sorted = [...items].filter((i) => i.value > 0).sort((a, b) => b.value - a.value);
  const vmax = sorted[0]?.value ?? 1;
  const rMax = size * 0.24;
  const placed: { x: number; y: number; r: number; item: (typeof sorted)[number] }[] = [];
  for (const item of sorted) {
    const r = Math.max(18, rMax * Math.sqrt(item.value / vmax));
    if (placed.length === 0) {
      placed.push({ x: 0, y: 0, r, item });
      continue;
    }
    let done = false;
    for (let dist = r + placed[0]!.r; !done && dist < size; dist += 4) {
      for (let a = 0; a < 360 && !done; a += 12) {
        const x = dist * Math.cos((a * Math.PI) / 180);
        const y = dist * Math.sin((a * Math.PI) / 180);
        if (placed.every((p) => Math.hypot(p.x - x, p.y - y) >= p.r + r + 3)) {
          placed.push({ x, y, r, item });
          done = true;
        }
      }
    }
  }
  const minX = Math.min(...placed.map((p) => p.x - p.r), 0);
  const maxX = Math.max(...placed.map((p) => p.x + p.r), 0);
  const minY = Math.min(...placed.map((p) => p.y - p.r), 0);
  const maxY = Math.max(...placed.map((p) => p.y + p.r), 0);
  const scale = Math.min(1, size / Math.max(1, maxX - minX, maxY - minY));
  const ox = size / 2 - ((minX + maxX) / 2) * scale;
  const oy = size / 2 - ((minY + maxY) / 2) * scale;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width="100%" height={size} role="img" aria-label={label} className="block">
      {placed.map((p) => {
        const rr = p.r * scale;
        return (
          <g key={p.item.label} transform={`translate(${(ox + p.x * scale).toFixed(1)} ${(oy + p.y * scale).toFixed(1)})`}>
            <circle r={rr} fill={p.item.color} opacity={onFill ? 0.9 : 1} />
            <text textAnchor="middle" dominantBaseline="central" fontSize={Math.max(11, Math.min(20, rr / 2.2))} fontWeight="800" fill="white" style={{ fontFamily: 'var(--font-display)' }}>
              {p.item.value}
            </text>
            {rr >= 30 && (
              <text y={Math.max(14, rr / 2.2) + 2} textAnchor="middle" dominantBaseline="hanging" fontSize="11" fontWeight="700" fill="white" opacity="0.9">
                {p.item.label}
              </text>
            )}
          </g>
        );
      })}
      {placed.length === 0 && (
        <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central" fontSize="14" fontWeight="700" fill={onFill ? 'white' : 'var(--color-ink-soft)'}>
          nothing named yet
        </text>
      )}
    </svg>
  );
}

/** The kit's month grid: a dot per day, coloured when something was logged. Weeks start on Sunday. */
export function CalendarGrid({ month, marks, label, today, onFill = false }: { month: string; marks: Record<string, { color: string; emoji?: string; mood?: number }>; label: string; today?: string; onFill?: boolean }) {
  const [y, m] = month.split('-').map(Number);
  const first = new Date(y ?? 2026, (m ?? 1) - 1, 1);
  const daysIn = new Date(y ?? 2026, m ?? 1, 0).getDate();
  const lead = first.getDay();
  const cells: (number | null)[] = [...Array.from({ length: lead }, () => null), ...Array.from({ length: daysIn }, (_, i) => i + 1)];
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    <div role="img" aria-label={label}>
      <div className="grid grid-cols-7 gap-xs">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <span key={i} className={`text-center text-[12px] font-extrabold ${onFill ? 'text-on-fill opacity-80' : 'text-ink-soft'}`}>
            {d}
          </span>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <span key={`b${i}`} />;
          const key = `${month}-${pad(day)}`;
          const mark = marks[key];
          const isToday = key === today;
          return (
            <span key={key} className="flex items-center justify-center">
              {mark?.mood ? (
                <span className="flex size-[28px] items-center justify-center rounded-pill" style={{ outline: isToday ? `2px solid ${onFill ? 'white' : 'var(--color-ink)'}` : undefined, outlineOffset: 2 }} title={key}>
                  <MoodFace value={mark.mood} size={28} />
                </span>
              ) : (
                <span
                  className="flex size-[28px] items-center justify-center rounded-pill text-[12px] font-extrabold"
                  style={{
                    background: mark ? mark.color : onFill ? 'rgba(255,255,255,0.18)' : 'var(--color-paper)',
                    color: mark ? 'white' : onFill ? 'white' : 'var(--color-ink-soft)',
                    outline: isToday ? `2px solid ${onFill ? 'white' : 'var(--color-ink)'}` : undefined,
                    outlineOffset: 2,
                  }}
                  title={key}
                >
                  {mark?.emoji ?? day}
                </span>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/** The kit's mood history: a face per day. */
export function EmojiRow({ items, onFill = false, size = 36 }: { items: { label: string; emoji: string | null; color: string | null; mood?: number | null }[]; onFill?: boolean; size?: number }) {
  return (
    <ul className="flex list-none justify-between gap-xs p-0 m-0">
      {items.map((it, i) => (
        <li key={i} className="flex flex-1 flex-col items-center gap-xs">
          {it.mood ? (
            <MoodFace value={it.mood} size={size} label={it.label} />
          ) : (
            <span className="flex items-center justify-center rounded-pill text-[20px]" style={{ width: size, height: size, background: it.color ?? (onFill ? 'rgba(255,255,255,0.18)' : 'var(--color-paper)') }} aria-label={it.emoji ? it.label : 'not logged'}>
              {it.emoji ?? ''}
            </span>
          )}
          <span className={`text-[12px] font-bold ${onFill ? 'text-on-fill opacity-80' : 'text-ink-soft'}`}>{it.label}</span>
        </li>
      ))}
    </ul>
  );
}

/** The kit's chain of pills with arrows between them, for the last few moods. */
export function PillChain({ items }: { items: { text: string; color: string; textColor: string; mood?: number }[] }) {
  return (
    <span className="flex flex-wrap items-center gap-xs">
      {items.map((it, i) => (
        <span key={i} className="flex items-center gap-xs">
          {i > 0 && (
            <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="text-ink-mute">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          )}
          <span className="inline-flex items-center gap-xs rounded-pill pr-xs pl-0 text-[12px] font-extrabold leading-[22px]" style={{ background: it.color, color: it.textColor }}>
            {it.mood ? <MoodFace value={it.mood} size={18} /> : null}
            {it.text}
          </span>
        </span>
      ))}
    </span>
  );
}

/** One number with its name, and a hint on what moved it. Tap to go where it comes from. */
export function StatTile({ label, value, hint, tone, to, children }: { label: string; value: ReactNode; hint?: ReactNode; tone?: string; to?: string; children?: ReactNode }) {
  const inner = (
    <>
      <span className="block text-[12px] font-extrabold uppercase tracking-wide text-ink-soft">{label}</span>
      <span className="mt-xs block font-display text-[28px] font-extrabold leading-none">{value}</span>
      {hint && <span className="mt-xs block text-[12px] font-bold text-ink-soft">{hint}</span>}
      {children}
    </>
  );
  const cls = 'block min-h-[96px] rounded-tile p-sm text-ink';
  const style = { background: tone ?? 'var(--color-card)' };
  return to ? (
    <Link to={to} className={`${cls} toy toy-soft`} style={style}>
      {inner}
    </Link>
  ) : (
    <div className={`${cls} shadow-toy-soft`} style={style}>
      {inner}
    </div>
  );
}

/** Seven dots for seven days: filled when something was logged. */
export function WeekDots({ days, color, label }: { days: boolean[]; color: string; label: string }) {
  return (
    <span role="img" aria-label={label} className="flex items-center gap-xs">
      {days.map((on, i) => (
        <span key={i} className="block size-[10px] rounded-pill" style={{ background: on ? color : 'var(--color-line)' }} />
      ))}
    </span>
  );
}

/** A level out of five as five short segments, like the kit's stress bar. */
export function Segments({ value, max = 5, color, label }: { value: number | null; max?: number; color: string; label: string }) {
  return (
    <span role="img" aria-label={label} className="flex items-center gap-xs">
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className="block h-[8px] w-[12px] rounded-pill" style={{ background: value !== null && i < value ? color : 'var(--color-line)' }} />
      ))}
    </span>
  );
}
