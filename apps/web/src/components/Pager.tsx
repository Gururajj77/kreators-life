import { DEFAULT_PAGE_SIZE, formatCount, PAGE_SIZES, pageQuery, type Page, type PageSize } from '@kreators/shared';
import { useEffect, useRef, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { useParamState, writeParams } from '../lib/useParamState';
import { Button } from './Button';

/** A list with its own page sizes and default (done tasks: 10, 25 or 50, ten by default). Without one: 10, 25 or 50, 25 by default. */
export interface PageSizes {
  sizes: readonly PageSize[];
  fallback: PageSize;
}
/** What a page offers (2026-11-07, the founder: pages of 10, 25 and 50). The server still takes 100 for a picker that reads every row, and the host's guest list offers it through `only`. */
const LIST_SIZES: PageSizes = { sizes: [10, 25, 50], fallback: DEFAULT_PAGE_SIZE };
/** A list paged from 2026-11-07 on: 10, 25 or 50, ten by default, like the done tasks. */
export const TEN_A_PAGE: PageSizes = { sizes: [10, 25, 50], fallback: 10 };
/** The host's guest list at the door: 100 a page unless a size is asked for. */
export const DOOR_SIZES: PageSizes = { sizes: PAGE_SIZES, fallback: 100 };
const sizeIn = (v: unknown, only: PageSizes = LIST_SIZES): PageSize => (only.sizes.includes(Number(v) as PageSize) ? (Number(v) as PageSize) : only.fallback);

/** Every size a list can take (10, 25, 50 or 100, 10 by default: `TABLE_DEFAULT_SIZE` in dataTables.ts, the founder, 2026-11-14): All
 * tables (2026-11-13), whose bar always shows. A literal, since importing the registry here would load it with every paged list. */
export const ALL_SIZES: PageSizes = { sizes: PAGE_SIZES, fallback: 10 };

/**
 * The bar under a paged list: how many rows a page holds (10, 25 or 50; the guest list also 100) and the way to the
 * page before or after. It hides itself on a short list that fits one page at the default size, unless `always` (All tables keeps it
 * in sight, 2026-11-13). With `total` (the rows that match, from the server) it reads "Page 2 of 7". `before` and `after` sit either side of
 * Previous and Next (All tables' first and last page, drawn by its own lazy screen so this bar, in the first download, carries none of it).
 */
export function PagerBar({
  page,
  onPage,
  label = 'rows',
  only,
  always = false,
  total,
  before,
  after,
}: {
  page: Page | undefined;
  onPage: (page: number, size: PageSize) => void;
  label?: string;
  only?: PageSizes;
  always?: boolean;
  total?: number;
  before?: ReactNode;
  after?: ReactNode;
}) {
  if (!page) return null;
  if (!always && page.page === 1 && !page.more && page.size === (only?.fallback ?? DEFAULT_PAGE_SIZE)) return null;
  const pages = total === undefined ? undefined : Math.max(1, Math.ceil(total / page.size));
  return (
    <div className="mt-sm flex flex-wrap items-center justify-between gap-sm" role="navigation" aria-label={`Pages of ${label}`}>
      <label className="flex items-center gap-xs">
        <span className="text-eyebrow uppercase text-ink-soft">Rows</span>
        <select value={page.size} onChange={(e) => onPage(1, sizeIn(e.target.value, only))} aria-label="Rows per page" className="min-h-[44px] rounded-pill border-2 border-line bg-card pl-sm text-subhead font-medium">
          {(only ?? LIST_SIZES).sizes.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      {/* With `always` (All tables) the way between pages keeps to the right when a phone's line wraps it under the rows. */}
      <div className={`flex items-center gap-xs ${always ? 'ml-auto' : ''}`}>
        {before}
        <Button variant="outline" size="sm" disabled={page.page <= 1} onClick={() => onPage(page.page - 1, page.size)}>
          Previous
        </Button>
        <span className="whitespace-nowrap text-subhead text-ink-soft">
          Page {formatCount(page.page)}
          {pages !== undefined && ` of ${formatCount(Math.max(pages, page.page))}`}
        </span>
        <Button variant="outline" size="sm" disabled={!page.more} onClick={() => onPage(page.page + 1, page.size)}>
          Next
        </Button>
        {after}
      </div>
    </div>
  );
}

/** The page a screen is on, kept in the URL so Back returns to it. `prefix` tells two lists on one screen apart. */
export function usePage(prefix = '', only?: PageSizes): { page: number; size: PageSize; query: string; reset: () => void } {
  const [p, setP] = useParamState(`${prefix}page`, '1');
  const [s] = useParamState(`${prefix}size`, String(only?.fallback ?? DEFAULT_PAGE_SIZE));
  const page = Math.max(1, Math.floor(Number(p)) || 1);
  const size = sizeIn(s, only);
  return { page, size, query: pageQuery(page, size, prefix), reset: () => setP('1') };
}

/** The pager bar bound to the URL. Pair it with `usePage` of the same prefix. */
export function Pager({ page, prefix = '', label, only }: { page: Page | undefined; prefix?: string; label?: string; only?: PageSizes }) {
  const [, setParams] = useSearchParams();
  // A page that came back empty (its last row archived, restored or deleted, or a filter changed under it) steps back: one page when this
  // page had rows a moment ago, else to the first, so the person never sits on an empty list with only Previous.
  const full = useRef(0);
  useEffect(() => {
    if (!page) return;
    if (!page.empty) full.current = page.page;
    else if (page.page > 1) writeParams(setParams, { [`${prefix}page`]: full.current === page.page && page.page > 2 ? String(page.page - 1) : null });
  }, [page, prefix, setParams]);
  return (
    <PagerBar
      page={page}
      label={label}
      only={only}
      // One update for both, composed with any other write in the same tick (a filter that also resets the page).
      onPage={(p, s) => writeParams(setParams, { [`${prefix}page`]: p === 1 ? null : String(p), [`${prefix}size`]: s === (only?.fallback ?? DEFAULT_PAGE_SIZE) ? null : String(s) })}
    />
  );
}
