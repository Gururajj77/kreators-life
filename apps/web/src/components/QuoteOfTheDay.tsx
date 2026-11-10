import { lineByKey, lineForDay, nextLine, type LineOfDay } from '@kreators/shared';
import { RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useWide } from '../lib/useWide';
import { IconButton } from './IconButton';

// What this device has been shown, kept on the device only (like the journal prompts): the keys seen in this round, the seed of the
// round's order, and the line showing now with its day, so a reload keeps it and a new day starts on the day's own line.
const STORE = 'kreators.lines';
interface Kept {
  seen: string[];
  seed: number;
  day: string;
  current: string | null;
}
function read(): Kept | null {
  try {
    const raw = localStorage.getItem(STORE);
    const k = raw ? (JSON.parse(raw) as Partial<Kept>) : null;
    return k && Array.isArray(k.seen) && typeof k.seed === 'number' ? { seen: k.seen.filter((x) => typeof x === 'string'), seed: k.seed, day: String(k.day ?? ''), current: typeof k.current === 'string' ? k.current : null } : null;
  } catch {
    return null;
  }
}
function write(k: Kept) {
  try {
    localStorage.setItem(STORE, JSON.stringify(k));
  } catch {
    // Private mode or full storage: the card still works for this visit.
  }
}

/**
 * The line of the day, drawn like a tooltip: the same pale card as every tip, with a small point at the top that aims at the section above it
 * (Water and reminders). One line a day from a philosopher, with their name, or from the app, with none, the same for everyone on the same day,
 * and none comes back until every line has been shown. "Another line" (the founder, 2026-11-06) shows a new one on demand, taking turns
 * between a tip and a quote, never one this device has already been shown until the whole pool has been (`nextLine` in shared).
 * On a laptop the quote is always one row (the founder: "never make the quote more than one line on desktop"): it does not wrap, the
 * card measures its own width against a hidden copy of the text, and a line too long for it gives way to the next that fits (so the same
 * day can show another line on a phone, where a long one may wrap).
 */
export function QuoteOfTheDay({ date }: { date: string }) {
  const day = lineForDay(date);
  const [kept, setKept] = useState<Kept>(() => {
    const k = read();
    const base: Kept = k ?? { seen: [], seed: Math.floor(Math.random() * 1_000_000), day: date, current: null };
    // A new day opens on the day's own line, and that line counts as seen.
    const fresh = base.day === date ? base : { ...base, day: date, current: null };
    return fresh.seen.includes(day.key) ? fresh : { ...fresh, seen: [...fresh.seen, day.key] };
  });
  const wide = useWide();
  const quote = useRef<HTMLQuoteElement>(null);
  const probe = useRef<HTMLSpanElement>(null);
  const [room, setRoom] = useState(0);
  const [fontTick, setFontTick] = useState(0);
  // The width the quote has, kept as it changes (a resize, the sidebar folding), and measured again once the font is in.
  useLayoutEffect(() => {
    const el = quote.current;
    if (!el) return;
    const read = () => setRoom(Math.floor(el.clientWidth));
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    let live = true;
    void document.fonts?.ready.then(() => live && setFontTick((n) => n + 1));
    return () => {
      live = false;
    };
  }, []);
  // Whether a line fits the quote's row: always on a phone, and until the width is known.
  const fits = useCallback(
    (l: LineOfDay) => {
      const el = probe.current;
      if (!wide || !room || !el) return true;
      el.textContent = l.tip ? l.text : `“${l.text}”`;
      const width = el.offsetWidth;
      // Emptied again, so a long line measured last never makes a narrow page scroll sideways (768, 2026-11-09).
      el.textContent = '';
      return width <= room - 2;
    },
    // fontTick: measured again when the font arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [wide, room, fontTick],
  );
  const shown: LineOfDay = useMemo(() => {
    const own: LineOfDay = (kept.current && lineByKey(kept.current)) || { ...day, tip: false };
    if (fits(own)) return own;
    // Too long for the row: a line that fits, chosen from the same history (shown only, never kept).
    const seed = [...date].reduce((n, c) => (n * 31 + c.charCodeAt(0)) % 1_000_003, 7);
    return nextLine(kept.seen, kept.seed + seed, own.key, fits).line;
  }, [kept, day, date, fits]);
  const another = () => {
    const { line, fresh } = nextLine(kept.seen, kept.seed, shown.key, fits);
    const next: Kept = fresh ? { seen: [line.key], seed: kept.seed + 1, day: date, current: line.key } : { ...kept, seen: [...kept.seen, line.key], current: line.key };
    write(next);
    setKept(next);
  };
  const label = shown.key === day.key ? 'Line of the day' : shown.tip ? 'A tip' : 'A line to think about';
  return (
    <aside className="span-all relative mt-md" aria-label="Line of the day">
      <span className="tip-card absolute -top-[6px] left-lg block size-[12px] rotate-45 border-t border-l border-line" aria-hidden="true" />
      <figure className="tip-card relative m-0 rounded-tile border border-line p-sm shadow-toy-soft">
        <div className="flex items-start justify-between gap-sm">
          <figcaption className="m-0 text-eyebrow uppercase text-ink-soft">{label}</figcaption>
          <IconButton icon={RefreshCw} label="Another line" tip="tr" onClick={another} />
        </div>
        {/* 8px under the 44px round button, since a long line runs on under it (it sat 3.5px under it). */}
        <blockquote ref={quote} className="m-0 mt-xs" aria-live="polite">
          {/* A hidden copy the width is measured on, set like the quote itself. */}
          <span ref={probe} aria-hidden="true" className="pointer-events-none invisible absolute left-0 top-0 whitespace-nowrap text-callout" />
          {/* From the tablet up the row never wraps (md: width and height, like useWide); the clip is only a last resort. */}
          <p className="m-0 text-balance text-callout md:overflow-hidden md:text-ellipsis md:whitespace-nowrap">{shown.tip ? shown.text : `“${shown.text}”`}</p>
          {shown.by && <footer className="mt-xs text-subhead text-ink-soft">{shown.by}</footer>}
        </blockquote>
      </figure>
    </aside>
  );
}
