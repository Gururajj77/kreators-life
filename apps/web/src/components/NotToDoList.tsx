import { MAX_NOT_TO_DO, NOT_TO_DO_TITLE_MAX, RELATIONSHIP_BY_KEY, RELATIONSHIPS, type NotToDo, type NotToDoStatus, type RelationshipKey } from '@kreators/shared';
import { useState, type FormEvent } from 'react';
import { api } from '../lib/api';
import type { useActionQueue } from '../lib/useActionQueue';
import { Button } from './Button';
import { useCelebrate } from './Celebration';
import { WeekDots } from './Charts';
import { CheckRow } from './CheckRow';
import { Sheet } from './Sheet';

type Queue = ReturnType<typeof useActionQueue>;

interface Props {
  items: NotToDo[];
  date: string;
  queue: Queue;
}

const field = 'mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]';

/**
 * The not-to-do list under Tasks on Daily: things you stay away from, each with its own streak.
 * Tick the box when you kept it today. The three-dot button offers "I slipped" and "Remove".
 */
export function NotToDoList({ items, date, queue }: Props) {
  const celebrate = useCelebrate();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [area, setArea] = useState<RelationshipKey | ''>('');
  const [menu, setMenu] = useState<NotToDo | null>(null);
  const full = items.length >= MAX_NOT_TO_DO;
  const keptToday = items.filter((i) => i.today === 'kept').length;

  const mark = (item: NotToDo, status: NotToDoStatus | null) =>
    queue.run(`ntd-${item.id}`, async () => {
      const r = await api.notToDoDay(item.id, date, date, status);
      if (status === 'kept' && r.awarded > 0) {
        const rel = RELATIONSHIP_BY_KEY[item.relationship ?? 'self'];
        celebrate({ title: r.item.streak === 1 ? 'Kept. Day one.' : `Kept. ${r.item.streak} days in a row`, totalXp: r.awarded, color: rel.color });
      }
    });
  const add = (e: FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    queue.run('ntd-add', async () => {
      await api.notToDoAdd(t, area || null);
      setTitle('');
      setArea('');
      setAdding(false);
    });
  };
  const slipped = (item: NotToDo) => {
    setMenu(null);
    mark(item, 'slipped');
  };
  const remove = (item: NotToDo) => {
    setMenu(null);
    queue.run(`ntd-${item.id}`, () => api.notToDoRemove(item.id));
  };

  return (
    <section className="mt-lg" aria-labelledby="ntd-heading">
      <div className="flex items-baseline justify-between gap-sm">
        <h2 id="ntd-heading" className="text-[18px]">
          Not to do
        </h2>
        {items.length > 0 && (
          <span className="text-[14px] font-bold text-ink-soft">
            {keptToday} of {items.length} kept today
          </span>
        )}
      </div>
      <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Things you are staying away from. Tick each one you kept today. Every day in a row grows its streak; a slip or a missed day starts it over.</p>

      {items.length > 0 && (
        <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
          {items.map((item) => {
            const rel = item.relationship ? RELATIONSHIP_BY_KEY[item.relationship] : null;
            const color = rel?.color ?? 'var(--color-ink)';
            const kept = item.week.filter((d) => d === 'kept').length;
            const subtitle =
              item.today === 'slipped' ? 'Slipped today. Fresh start tomorrow.' : item.streak === 0 ? 'No streak yet. Today can be day one.' : `${item.streak} ${item.streak === 1 ? 'day' : 'days'} in a row · best ${item.bestStreak}`;
            return (
              <li key={item.id}>
                <CheckRow
                  checked={item.today === 'kept'}
                  onToggle={() => mark(item, item.today === 'kept' ? null : 'kept')}
                  title={item.title}
                  subtitle={subtitle}
                  color={color}
                  deep={rel ? `var(--deep-${rel.key})` : 'var(--color-shadow)'}
                  text={rel?.text ?? 'var(--color-on-ink)'}
                  busy={queue.isPending(`ntd-${item.id}`)}
                  hint={queue.hint(`ntd-${item.id}`)}
                  badge={<WeekDots days={item.week.map((d) => d === 'kept')} color={color} label={`Last seven days, ${kept} kept`} />}
                  aside={
                    <button
                      type="button"
                      onClick={() => setMenu(item)}
                      aria-label={`More for "${item.title}"`}
                      className="toy toy-soft flex w-[48px] shrink-0 items-center justify-center rounded-tile bg-card text-ink-soft hover:text-ink"
                    >
                      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="currentColor">
                        <circle cx="6" cy="12" r="2" />
                        <circle cx="12" cy="12" r="2" />
                        <circle cx="18" cy="12" r="2" />
                      </svg>
                    </button>
                  }
                />
              </li>
            );
          })}
        </ul>
      )}

      {items.length === 0 && !adding && (
        <div className="mt-sm rounded-card border-2 border-dashed border-line p-md">
          <p className="m-0 text-[14px] font-semibold text-ink-soft">Late scrolling, the snooze button, sugar after dinner. Name one thing to stay away from and keep a streak for it.</p>
        </div>
      )}

      {adding ? (
        <form onSubmit={add} className="mt-sm rounded-card bg-card p-md shadow-toy-soft">
          <label className="block text-[14px] font-bold" htmlFor="ntd-title">
            Not to do
          </label>
          <input id="ntd-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={NOT_TO_DO_TITLE_MAX} placeholder="No phone in bed" autoFocus className={field} />
          <label className="mt-sm block text-[14px] font-bold" htmlFor="ntd-area">
            Pillar
          </label>
          <select id="ntd-area" value={area} onChange={(e) => setArea(e.target.value as RelationshipKey | '')} className={field}>
            <option value="">Any pillar</option>
            {RELATIONSHIPS.map((r) => (
              <option key={r.key} value={r.key}>
                {r.name}
              </option>
            ))}
          </select>
          {queue.hint('ntd-add') && (
            <p role="alert" className="mt-sm m-0 text-[14px] font-bold">
              {queue.hint('ntd-add')}
            </p>
          )}
          <div className="mt-md flex gap-xs">
            <Button type="submit" disabled={!title.trim() || queue.isPending('ntd-add')}>
              Add
            </Button>
            <Button variant="outline" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <div className="mt-sm">
          {full ? (
            <p className="m-0 text-[14px] font-semibold text-ink-soft">{MAX_NOT_TO_DO} is plenty. Remove one to add another.</p>
          ) : (
            <Button variant="outline" onClick={() => setAdding(true)}>
              Add one
            </Button>
          )}
        </div>
      )}

      <Sheet open={menu !== null} onClose={() => setMenu(null)} title={menu?.title ?? ''}>
        {menu && (
          <div className="flex flex-col gap-sm pb-xl">
            <p className="m-0 text-[14px] font-semibold text-ink-soft">
              {menu.streak > 0 ? `${menu.streak} ${menu.streak === 1 ? 'day' : 'days'} in a row, best ${menu.bestStreak}.` : `Best run so far: ${menu.bestStreak} ${menu.bestStreak === 1 ? 'day' : 'days'}.`}
            </p>
            <Button variant="outline" onClick={() => slipped(menu)} disabled={menu.today === 'slipped'}>
              I slipped today
            </Button>
            <Button variant="outline" onClick={() => remove(menu)}>
              Remove from the list
            </Button>
          </div>
        )}
      </Sheet>
    </section>
  );
}
