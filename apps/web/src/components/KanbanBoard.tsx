import type { BoardColumn } from '@kreators/shared';
import { useRef, useState, type ReactNode } from 'react';
import { tie } from '../lib/text';
import { Button } from './Button';

interface Props<T extends { id: string }> {
  columns: readonly (BoardColumn<T> & { name: string; blurb?: string; note?: ReactNode })[];
  /** One card. */
  card: (item: T, column: string) => ReactNode;
  /** Move a card to another column. When it is missing the cards cannot be moved, only read. */
  onMove?: (item: T, from: string, to: string) => void;
  /** Ask for more cards in a column ("Show more"). */
  onMore?: (column: string) => void;
  /** What the "Move to" menu may offer for a card; defaults to every other column. */
  canMoveTo?: (item: T, from: string, to: string) => boolean;
  empty?: string;
}

/**
 * A kanban board: a column for each stage with its count, cards that can be dragged to another column or moved from a "Move to"
 * menu (for a keyboard or a touch screen), and a "Show more" at the foot of a long column. A laptop shows the columns side by side
 * and scrolls them sideways inside the board; a phone stacks them. The board itself never makes the page scroll sideways.
 */
export function KanbanBoard<T extends { id: string }>({ columns, card, onMove, onMore, canMoveTo, empty = 'Nothing here' }: Props<T>) {
  const dragging = useRef<{ id: string; from: string } | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const find = (id: string, col: string) => columns.find((c) => c.stage === col)?.items.find((i) => i.id === id);
  return (
    <div className="scroll-row md:grid md:auto-cols-[minmax(240px,1fr)] md:grid-flow-col md:items-start md:gap-sm md:overflow-x-auto md:pb-xs">
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
          className={`mb-sm min-w-0 rounded-card p-sm md:mb-0 ${over === col.stage ? 'bg-card-strong ring-2 ring-ink/30' : 'bg-card'}`}
        >
          <header className="flex items-baseline justify-between gap-xs">
            <h3 className="m-0 text-[16px] font-extrabold">{col.name}</h3>
            <span className="rounded-pill bg-line px-sm text-[12px] font-extrabold leading-[24px] text-ink-soft">{col.total}</span>
          </header>
          {col.note && <p className="m-0 text-[12px] font-bold text-ink-soft">{col.note}</p>}
          {col.blurb && <p className="m-0 text-[12px] font-semibold text-ink-mute">{tie(col.blurb)}</p>}
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
                className={`rounded-tile bg-card-strong p-sm shadow-toy-soft ${onMove ? 'cursor-grab active:cursor-grabbing' : ''}`}
              >
                {card(item, col.stage)}
                {onMove && (
                  <label className="mt-xs block text-[12px] font-bold text-ink-soft">
                    Move to
                    <select
                      value=""
                      onChange={(e) => {
                        if (e.target.value) onMove(item, col.stage, e.target.value);
                      }}
                      aria-label={`Move to another column`}
                      className="mt-xs block min-h-[40px] w-full rounded-pill border-2 border-line bg-card px-sm text-[14px] font-bold text-ink"
                    >
                      <option value="">Choose a column</option>
                      {columns
                        .filter((c) => c.stage !== col.stage && (!canMoveTo || canMoveTo(item, col.stage, c.stage)))
                        .map((c) => (
                          <option key={c.stage} value={c.stage}>
                            {c.name}
                          </option>
                        ))}
                    </select>
                  </label>
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
  );
}
