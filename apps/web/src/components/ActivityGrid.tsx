import {
  activityLevel,
  activityWeeks,
  formatCount,
  LOCALE,
  type ActivityDay,
  type ActivityMetric,
  type ActivityYear,
} from "@kreators/shared";
import gsap from "gsap";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { api } from "../lib/api";
import { longDate, todayLocal } from "../lib/date";
import { useAuthed } from "../lib/queries";
import { useParamState } from "../lib/useParamState";
import { ErrorLine } from "./ErrorLine";
import { Segmented } from "./fx/Segmented";
import { prefersReducedMotion, useSeenOnce } from "./fx/env";
import { Busy, Skeleton } from "./Skeleton";

const METRICS: readonly { value: ActivityMetric; label: string }[] = [
  { value: "xp", label: "Xp" },
  { value: "ticks", label: "Tasks ticked" },
];
const DAY_ROWS = ["Mon", "", "Wed", "", "Fri", "", ""] as const;
const MONTH = new Intl.DateTimeFormat(LOCALE, {
  month: "short",
  timeZone: "UTC",
});
const monthOf = (day: string) => MONTH.format(new Date(`${day}T00:00:00Z`));

/** "120 xp" or "3 tasks ticked", the words the tooltip, the labels and the total share. */
function countWords(n: number, metric: ActivityMetric): string {
  if (metric === "xp") return `${formatCount(n)} xp`;
  return `${formatCount(n)} ${n === 1 ? "task" : "tasks"} ticked`;
}

/**
 * "Your year" on Profile: a GitHub-style year of days (our own build, after wensity's activity grid). Each day is a cell shaded 0 to 4
 * from the busiest day (`activityLevel`), Monday to Sunday down a column and the weeks across, the month names on top, Less to More and
 * the year's total under it. One tooltip glides from cell to cell (GSAP quickTo, transform only). The grid is one control: it takes
 * focus and the arrow keys move by day (up and down) and by week (left and right), Home and End go to the ends. On first view the cells
 * ripple in back from today; reduced motion shows them at once. Owner only: counts, never what the xp was for.
 */
export function ActivityGrid() {
  const day = useMemo(() => todayLocal(), []);
  const q = useAuthed(["activity", day], () => api.activity(day));
  const [metric, setMetric] = useParamState("year", "xp");
  const m: ActivityMetric = metric === "ticks" ? "ticks" : "xp";
  return (
    <section className="act-year mt-lg" aria-labelledby="year-heading">
      <h2 id="year-heading" className="text-[24px]">
        Your year
      </h2>
      <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">
        {m === "xp"
          ? "Xp a day for the last year."
          : "Tasks ticked a day for the last year."}{" "}
        Only you see this.
      </p>
      <div className="mt-sm">
        <Segmented
          label="What the year shows"
          value={m}
          onChange={(v) => setMetric(v)}
          options={METRICS}
        />
      </div>
      {q.isPending ? (
        <Busy label="Loading your year" className="mt-sm">
          <Skeleton className="h-[184px]" />
        </Busy>
      ) : q.isError ? (
        <ErrorLine e={q.error} className="mt-sm" />
      ) : (
        <YearGrid data={q.data} metric={m} />
      )}
    </section>
  );
}

function YearGrid({
  data,
  metric,
}: {
  data: ActivityYear;
  metric: ActivityMetric;
}) {
  const weeks = useMemo(() => activityWeeks(data.days), [data.days]);
  const max = data.max[metric];
  const total = data.totals[metric];
  /** Where each day sits: its column and row, by its index in `data.days`. */
  const where = useMemo(() => {
    const at = new Map<string, { col: number; row: number }>();
    weeks.forEach((col, c) =>
      col.forEach((d, r) => d && at.set(d.day, { col: c, row: r })),
    );
    return data.days.map((d) => at.get(d.day)!);
  }, [weeks, data.days]);
  const indexOf = useMemo(
    () => new Map(data.days.map((d, i) => [d.day, i])),
    [data.days],
  );
  /** A month name over the week that holds its 1st, and over the first week when the next name is far enough away. */
  const months = useMemo(() => {
    const out: { col: number; name: string }[] = [];
    weeks.forEach((col, c) => {
      const first = col.find((d) => d?.day.endsWith("-01"));
      if (first) out.push({ col: c, name: monthOf(first.day) });
    });
    const lead = weeks[0]?.find(Boolean);
    if (lead && (out[0]?.col ?? 99) >= 3 && !lead.day.endsWith("-01"))
      out.unshift({ col: 0, name: monthOf(lead.day) });
    // Three weeks between names, and none in the last two weeks, where a name would run past the grid.
    return out.filter(
      (x, i) =>
        (i === 0 || x.col - out[i - 1]!.col >= 3) && x.col <= weeks.length - 3,
    );
  }, [weeks]);

  const last = data.days.length - 1;
  const [active, setActive] = useState(last);
  const [tipOn, setTipOn] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const moveTip = useRef<{ x: gsap.QuickToFunc; y: gsap.QuickToFunc } | null>(
    null,
  );
  const placed = useRef(false);

  // The newest weeks are the ones that matter: start scrolled to today.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, []);

  // The ripple: on first view every cell grows in from 0.6, nearest today first, under 900 ms in all.
  const seen = useSeenOnce(gridRef);
  const [revealed, setRevealed] = useState(false);
  useLayoutEffect(() => {
    if (!seen || revealed) return;
    const grid = gridRef.current;
    if (!grid || prefersReducedMotion()) {
      setRevealed(true);
      return;
    }
    const cells = grid.querySelectorAll<HTMLElement>(".act-cell");
    const cols = weeks.length;
    const today = where[last];
    const from = today ? today.row * cols + today.col : cells.length - 1;
    const tween = gsap.fromTo(
      cells,
      { opacity: 0, scale: 0.6 },
      {
        opacity: 1,
        scale: 1,
        duration: 0.24,
        ease: "power2.out",
        stagger: { grid: [7, cols], from, amount: 0.6 },
        onComplete: () => setRevealed(true),
      },
    );
    return () => {
      tween.kill();
    };
  }, [seen, revealed, weeks.length, where, last]);

  /** Puts the one tooltip over the active cell: a glide when it is already showing, a jump when it appears or under reduced motion. */
  const placeTip = (glide: boolean) => {
    const card = cardRef.current;
    const tip = tipRef.current;
    const cell = gridRef.current?.querySelector<HTMLElement>(
      `[data-i="${active}"]`,
    );
    if (!card || !tip || !cell) return;
    const c = card.getBoundingClientRect();
    const r = cell.getBoundingClientRect();
    const w = tip.offsetWidth;
    const x = Math.max(
      8,
      Math.min(c.width - w - 8, r.left - c.left + r.width / 2 - w / 2),
    );
    // Above the cell, or under it for the top rows when there is no room above inside the card.
    const above = r.top - c.top - tip.offsetHeight - 8;
    const y = above >= 4 ? above : r.bottom - c.top + 8;
    if (glide && placed.current && !prefersReducedMotion()) {
      if (!moveTip.current)
        moveTip.current = {
          x: gsap.quickTo(tip, "x", { duration: 0.28, ease: "power3.out" }),
          y: gsap.quickTo(tip, "y", { duration: 0.28, ease: "power3.out" }),
        };
      moveTip.current.x(x);
      moveTip.current.y(y);
    } else {
      gsap.killTweensOf(tip);
      moveTip.current = null;
      gsap.set(tip, { x, y });
    }
    placed.current = true;
  };
  useLayoutEffect(() => {
    if (tipOn) placeTip(true);
    else placed.current = false;
  }, [tipOn, active, metric]);
  // A row that scrolls under the tooltip moves it with the cell, without a glide.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !tipOn) return;
    const onScroll = () => placeTip(false);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [tipOn, active]);

  const go = (i: number) => {
    const next = Math.max(0, Math.min(last, i));
    setActive(next);
    setTipOn(true);
    gridRef.current
      ?.querySelector<HTMLElement>(`[data-i="${next}"]`)
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step: Record<string, number> = {
      ArrowUp: -1,
      ArrowDown: 1,
      ArrowLeft: -7,
      ArrowRight: 7,
    };
    if (e.key in step) go(active + step[e.key]!);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(last);
    else if (e.key === "Escape") setTipOn(false);
    else return;
    e.preventDefault();
  };

  const activeDay = data.days[active];
  const label = (d: ActivityDay) =>
    `${longDate(d.day)}, ${countWords(d[metric], metric)}`;
  const cols = weeks.length;

  return (
    <div
      ref={cardRef}
      className="relative mt-sm rounded-card bg-card p-md shadow-toy-soft"
    >
      <div className="flex">
        <div className="act-days" aria-hidden="true">
          {DAY_ROWS.map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>
        <div ref={scrollRef} className="scroll-row act-scroll min-w-0 flex-1">
          <div
            className="act-frame"
            style={{ "--act-cols": cols } as CSSProperties}
          >
            <div className="act-months" aria-hidden="true">
              {months.map((mo) => (
                <span key={mo.col} style={{ gridColumn: `${mo.col + 1}` }}>
                  {mo.name}
                </span>
              ))}
            </div>
            <div
              ref={gridRef}
              role="grid"
              tabIndex={0}
              aria-label={`Your year, ${countWords(total, metric)}. Arrow keys move by day and by week.`}
              aria-activedescendant={`act-${active}`}
              data-reveal={revealed ? undefined : "wait"}
              className="act-grid"
              onKeyDown={onKey}
              onFocus={() => setTipOn(true)}
              onBlur={() => setTipOn(false)}
              onPointerLeave={(e) => {
                if (
                  e.pointerType === "mouse" &&
                  document.activeElement !== gridRef.current
                )
                  setTipOn(false);
              }}
            >
              {Array.from({ length: 7 }, (_, r) => (
                <div role="row" key={r} className="act-row">
                  {weeks.map((col, c) => {
                    const d = col[r];
                    if (!d)
                      return (
                        <div
                          role="gridcell"
                          key={c}
                          className="act-cell act-none"
                        />
                      );
                    const i = indexOf.get(d.day)!;
                    const lv = activityLevel(d[metric], max);
                    return (
                      <div
                        role="gridcell"
                        key={c}
                        id={`act-${i}`}
                        data-i={i}
                        data-lv={lv}
                        data-active={i === active && tipOn ? "" : undefined}
                        aria-selected={i === active}
                        aria-label={label(d)}
                        className="act-cell"
                        onPointerEnter={(e) => {
                          if (e.pointerType !== "mouse") return;
                          setActive(i);
                          setTipOn(true);
                        }}
                        onClick={() => {
                          setActive(i);
                          setTipOn(true);
                        }}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div
        ref={tipRef}
        role="tooltip"
        aria-hidden={!tipOn}
        className="act-tip border border-line shadow-toy-soft"
        data-on={tipOn ? "" : undefined}
      >
        {activeDay
          ? `${longDate(activeDay.day)}: ${countWords(activeDay[metric], metric)}`
          : ""}
      </div>
      <div className="mt-sm flex flex-wrap items-center justify-between gap-sm text-[12px] font-bold text-ink-soft">
        <p className="m-0 text-[14px] text-ink">
          {countWords(total, metric)} in the last year
        </p>
        <p className="m-0 flex items-center gap-xs">
          <span className="sr-only">
            Shades from less to more. The busiest day: {countWords(max, metric)}
            .
          </span>
          <span aria-hidden="true">Less</span>
          {[0, 1, 2, 3, 4].map((lv) => (
            <span
              key={lv}
              aria-hidden="true"
              className="act-cell act-swatch"
              data-lv={lv}
            />
          ))}
          <span aria-hidden="true">More</span>
        </p>
      </div>
    </div>
  );
}
