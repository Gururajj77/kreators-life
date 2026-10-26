import { DEFAULT_PAGE_SIZE, PAGE_SIZES, pageQuery, pageSizeOf, type Page, type PageSize } from '@kreators/shared';
import { useParamState } from '../lib/useParamState';
import { Button } from './Button';

/**
 * The bar under a paged list: how many rows a page holds (10, 25, 50 or 100) and the way to the
 * page before or after. It hides itself on a short list that fits one page at the default size.
 */
export function PagerBar({ page, onPage, label = 'rows' }: { page: Page | undefined; onPage: (page: number, size: PageSize) => void; label?: string }) {
  if (!page) return null;
  if (page.page === 1 && !page.more && page.size === DEFAULT_PAGE_SIZE) return null;
  return (
    <div className="mt-sm flex flex-wrap items-center justify-between gap-sm" role="navigation" aria-label={`Pages of ${label}`}>
      <label className="flex items-center gap-xs">
        <span className="text-[12px] font-extrabold uppercase tracking-wide text-ink-soft">Rows</span>
        <select value={page.size} onChange={(e) => onPage(1, pageSizeOf(e.target.value))} aria-label="Rows per page" className="min-h-[44px] rounded-pill border-2 border-line bg-card pl-sm text-[14px] font-bold">
          {PAGE_SIZES.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <div className="flex items-center gap-xs">
        <Button variant="outline" size="sm" disabled={page.page <= 1} onClick={() => onPage(page.page - 1, page.size)}>
          Previous
        </Button>
        <span className="text-[14px] font-bold text-ink-soft">Page {page.page}</span>
        <Button variant="outline" size="sm" disabled={!page.more} onClick={() => onPage(page.page + 1, page.size)}>
          Next
        </Button>
      </div>
    </div>
  );
}

/** The page a screen is on, kept in the URL so Back returns to it. `prefix` tells two lists on one screen apart. */
export function usePage(prefix = ''): { page: number; size: PageSize; query: string; reset: () => void } {
  const [p, setP] = useParamState(`${prefix}page`, '1');
  const [s] = useParamState(`${prefix}size`, String(DEFAULT_PAGE_SIZE));
  const page = Math.max(1, Math.floor(Number(p)) || 1);
  const size = pageSizeOf(s);
  return { page, size, query: pageQuery(page, size, prefix), reset: () => setP('1') };
}

/** The pager bar bound to the URL. Pair it with `usePage` of the same prefix. */
export function Pager({ page, prefix = '', label }: { page: Page | undefined; prefix?: string; label?: string }) {
  const [, setP] = useParamState(`${prefix}page`, '1');
  const [, setS] = useParamState(`${prefix}size`, String(DEFAULT_PAGE_SIZE));
  return (
    <PagerBar
      page={page}
      label={label}
      onPage={(p, s) => {
        setS(String(s));
        setP(String(p));
      }}
    />
  );
}
