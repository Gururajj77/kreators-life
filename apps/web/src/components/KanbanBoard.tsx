import type { BoardColumn } from '@kreators/shared';
import { ArrowLeftRight } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Button } from './Button';
import { Icon } from './Icon';
import { Sheet } from './Sheet';
import { StatusTag } from './StatusTag';

interface Props<T extends { id: string }> {
  columns: readonly (BoardColumn<T> & { name: string; note?: ReactNode })[];
  /** One card: keep it to a title, its tags and one line of facts. */
  card: (item: T, column: string) => ReactNode;
  /** The card's name, read out on its Move button ("Move Launch video"). */
  itemLabel: (item: T) => string;
  /** Move a card to another column. When it is missing the cards cannot be moved, only read. */
  onMove?: (item: T, from: string, to: string) => void;
  /** Ask for more cards in a column ("Show more"). */
  onMore?: (column: string) => void;
  /** What the Move menu may offer for a card; defaults to every other column. */
  canMoveTo?: (item: T, from: string, to: string) => boolean;
  empty?: string;
}

/** The fade at the right edge while the board has more columns to the right: a hint that it scrolls. */
const FADE: CSSProperties = {
  maskImage: 'linear-gradient(to right, black calc(100% - 64px), transparent)',
  WebkitMaskImage: 'linear-gradient(to right, black calc(100% - 64px), transparent)',
};

/**
 * A kanban board: a column for each stage with its name and count, cards that can be dragged to another column, and on every card one
 * 44px Move button that opens a sheet of the columns it may go to (for a keyboard or a touch screen). A long column ends in "Show more".
 * The columns sit side by side at a readable width (260px at least) and the board scrolls sideways inside itself on every screen, so
 * the page never does; while there is more to the right, the right edge fades.
 */
export function KanbanBoard<T extends { id: string }>({ columns, card, itemLabel, onMove, onMore, canMoveTo, empty = 'Nothing here' }: Props<T>) {
  const dragging = useRef<{ id: string; from: string } | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [moving, setMoving] = useState<{ item: T; from: string } | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);
  const find = (id: string, col: string) => columns.find((c) => c.stage === col)?.items.find((i) => i.id === id);

  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    setMore(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  }, []);
  useEffect(() => {
    measure();
    const el = scroller.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure, columns]);

  const targets = moving ? columns.filter((c) => c.stage !== moving.from && (!canMoveTo || canMoveTo(moving.item, moving.from, c.stage))) : [];

  return (
    <>
      <div ref={scroller} onScroll={measure} style={more ? FADE : undefined} className="scroll-row flex items-stretch gap-sm">
        {columns.map((col) => (
          <section
            key={col.stage}
            aria-label={`${col.name}, ${col.total}`}
            onDragOver={onMove ? (e) => { e.preventDefault(); setOver(col.stage); } : undefined}
            onDragLeave={() => setOver((o) => (o === col.stage ? null : o))}
            onDrop={
              onMove
                ? (e) => {
                    e.preventDefault();
                    setOver(null);
                    const d = dragging.current;
                    dragging.current = null;
                    const item = d ? find(d.id, d.from) : null;
                    if (d && item && d.from !== col.stage && (!canMoveTo || canMoveTo(item, d.from, col.stage))) onMove(item, d.from, col.stage);
                  }
                : undefined
            }
            className={`w-[260px] min-w-[260px] shrink-0 rounded-card p-sm md:w-[280px] ${over === col.stage ? 'bg-card-strong ring-2 ring-ink/30' : 'bg-card'}`}
          >
            <header className="flex items-baseline justify-between gap-xs">
              <h3 className="m-0 text-[16px] font-extrabold">{col.name}</h3>
              <StatusTag tone="neutral" title={`${col.total} in ${col.name}`}>{String(col.total)}</StatusTag>
            </header>
            {col.note && <p className="m-0 text-[12px] font-bold text-ink-soft">{col.note}</p>}
            <ul className="mt-xs flex list-none flex-col gap-xs p-0 m-0">
              {col.items.map((item) => (
                <li
                  key={item.id}
                  draggable={Boolean(onMove)}
                  onDragStart={() => {
                    dragging.current = { id: item.id, from: col.stage };
                  }}
                  onDragEnd={() => {
                    dragging.current = null;
                    setOver(null);
                  }}
                  className={`flex items-start gap-xs rounded-tile bg-card-strong p-sm shadow-toy-soft ${onMove ? 'cursor-grab active:cursor-grabbing' : ''}`}
                >
                  <div className="min-w-0 flex-1">{card(item, col.stage)}</div>
                  {onMove && (
                    <button
                      type="button"
                      onClick={() => setMoving({ item, from: col.stage })}
                      aria-label={`Move ${itemLabel(item)}`}
                      aria-haspopup="dialog"
                      className="toy toy-soft flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-pill text-ink-soft hover:text-ink"
                    >
                      <Icon icon={ArrowLeftRight} size={18} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {col.items.length === 0 && <p className="mt-xs m-0 rounded-tile border-2 border-dashed border-line p-sm text-center text-[12px] font-bold text-ink-mute">{empty}</p>}
            {onMore && col.total > col.items.length && (
              <div className="mt-xs">
                <Button variant="outline" size="sm" full onClick={() => onMore(col.stage)}>
                  Show more ({col.total - col.items.length})
                </Button>
              </div>
            )}
          </section>
        ))}
      </div>
      {onMove && (
        <Sheet open={moving !== null} onClose={() => setMoving(null)} title={moving ? `Move ${itemLabel(moving.item)}` : 'Move'}>
          {targets.length === 0 ? (
            <p className="m-0 text-[14px] font-semibold text-ink-soft">This one cannot move from here.</p>
          ) : (
            <ul className="fx-inset">
              {targets.map((c) => (
                <li key={c.stage}>
                  <button
                    type="button"
                    className="fx-row text-[16px] font-bold text-ink"
                    onClick={() => {
                      const m = moving;
                      setMoving(null);
                      if (m) onMove(m.item, m.from, c.stage);
                    }}
                  >
                    <span className="min-w-0 flex-1">{c.name}</span>
                    <span className="text-[12px] font-extrabold text-ink-mute">{c.total}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Sheet>
      )}
    </>
  );
}
