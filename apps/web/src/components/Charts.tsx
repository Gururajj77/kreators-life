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

/** A tiny line, for the tracker rows on the wellbeing screen. */
export function Sparkline({ values, max, color }: { values: (number | null)[]; max: number; color: string }) {
  const w = 72;
  const h = 28;
  const pts = values.map((v, i) => [Math.round((i / Math.max(1, values.length - 1)) * w), v === null ? null : Math.round(h - (Math.min(v, max) / max) * (h - 4) - 2)] as const);
  const have = pts.filter((p): p is readonly [number, number] => p[1] !== null);
  const d = have.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]} ${p[1]}`).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" className="shrink-0">
      <path d={`M0 ${h - 2} L${w} ${h - 2}`} fill="none" stroke="var(--color-line)" strokeWidth="2" strokeLinecap="round" />
      {have.length > 1 && <path d={d} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
      {have.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r="3" fill={color} />
      ))}
    </svg>
  );
}
