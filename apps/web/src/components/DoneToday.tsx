import { DONE_PAGE_SIZE, DONE_PAGE_SIZES, type Node } from '@kreators/shared';
import { AnimatePresence } from 'motion/react';
import { Link } from 'react-router';
import { api } from '../lib/api';
import { clockTime } from '../lib/date';
import { keys, useAuthed } from '../lib/queries';
import type { useActionQueue } from '../lib/useActionQueue';
import { Fold } from './Fold';
import { Pager, usePage } from './Pager';
import { SkeletonList } from './Skeleton';
import { TaskRow } from './TaskRow';

/** Done tasks are paged: 10, 25 or 50, ten by default (prefix `d`). */
const DONE_PAGES = { sizes: DONE_PAGE_SIZES, fallback: DONE_PAGE_SIZE };

/**
 * Done today, in a closed toggle with its count, ten to a page by default (2026-11-07, the founder: "this can pile up with time"; the toggle
 * 2026-11-08): GET /today carries the first page, so the
 * usual case costs nothing more; another page or size reads GET /today/done. The count is the day's true count.
 */
export function DoneToday({ date, first, total, queue, onUntick, keep, area = '', tags = '', open = '' }: { date: string; first: Node[]; total: number; queue: ReturnType<typeof useActionQueue>; onUntick: (id: string) => void; keep: (t: Node) => boolean; /** Daily's Area filter, the tags tapped (2026-11-13) and the Unfinished business view ('any'): while one is on, the server cuts the list and its count the same way. */ area?: string; tags?: string; open?: string }) {
  const pg = usePage('d', DONE_PAGES);
  const own = pg.page !== 1 || pg.size !== DONE_PAGE_SIZE || Boolean(area) || Boolean(tags) || Boolean(open);
  const q = useAuthed([...keys.today(date), 'done', pg.query, area, tags, open], () => api.todayDone(date, pg.query, area, open, tags), own);
  const rows = (own ? (q.data?.tasks ?? []) : first).filter(keep);
  const page = own ? q.data?.page : { page: 1, size: DONE_PAGE_SIZE, more: total > first.length };
  if (own ? pg.page === 1 && q.data?.total === 0 : total === 0) return null;
  // Folded away until asked for (the founder, 2026-11-08: "i wanted them to be in a toggle and paginated"), its count beside its name. An
  // address that already names a page or a size of this list opens it, so Back and a shared link land on the page they show.
  return (
    <Fold id="done-heading" className="mt-md" title="Done today" hint={String(own ? (q.data?.total ?? total) : total)} defaultOpen={pg.page !== 1 || pg.size !== DONE_PAGE_SIZE}>
      {own && q.isPending ? (
        <SkeletonList className="mt-xs" count={2} lines={1} label="Loading done tasks" />
      ) : (
        <ul className="mt-xs flex list-none flex-col gap-xs p-0 m-0">
          <AnimatePresence initial={false}>
            {rows.map((t) => (
              <TaskRow key={t.id} task={t} today={date} subtitle={t.completedAt ? `Done at ${clockTime(t.completedAt)}` : undefined} busy={queue.isPending(t.id)} hint={queue.hint(t.id)} onToggle={() => onUntick(t.id)} />
            ))}
          </AnimatePresence>
        </ul>
      )}
      <Pager page={page as Parameters<typeof Pager>[0]['page']} prefix="d" label="done tasks" only={DONE_PAGES} />
      <p className="mt-xs m-0 text-caption text-ink-soft">
        Tap one to untick it; that takes back its xp. Earlier days are on each pillar in{' '}
        <Link to="/tower" className="underline underline-offset-4 hover:text-ink">
          Pillars
        </Link>
        .
      </p>
    </Fold>
  );
}

