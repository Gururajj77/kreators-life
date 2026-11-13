import { MAX_NOT_TO_DO, NOT_TO_DO_TITLE_MAX, RELATIONSHIP_BY_KEY, RELATIONSHIPS, shiftDay, WAIT, type NotToDo, type NotToDoStatus, type RelationshipKey } from '@kreators/shared';
import { afterRemove } from '../lib/focusHeading';
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { api, ApiError } from '../lib/api';
import { pillarTick } from '../lib/relFill';
import { useRefreshAll, useRefreshInsights, useToday } from '../lib/queries';
import { useActionQueue } from '../lib/useActionQueue';
import { Button } from './Button';
import { Fold } from './Fold';
import { useCelebrate } from './Celebration';
import { WeekDots } from './Charts';
import { CheckRow } from './CheckRow';
import { DELETE_BTN } from './ConfirmDelete';
import { ToggleChevron, ToggleIcon } from './ToggleMark';
import { Ellipsis } from 'lucide-react';
import { FIELD } from '../lib/ui';
import { useTapTwice } from '../lib/useTapTwice';

type Queue = ReturnType<typeof useActionQueue>;

interface Props {
  items: NotToDo[];
  date: string;
  queue: Queue;
}


/**
 * The not-to-do block, the same one on Daily (under Tasks) and on Pillars (under the seven pillars). It reads
 * the same data as Daily, so a tick in one place shows in the other.
 */
export function NotToDoBlock() {
  const { date, data } = useToday();
  const queue = useActionQueue(useRefreshAll());
  if (!data) return null;
  return <NotToDoList items={data.notToDo} date={date} queue={queue} />;
}

/**
 * The not-to-do list: things you stay away from, each with its own streak. Tick the box when you kept it
 * today. The three-dot button opens the row in place (2026-11-06, no sheet): the streak line, "I slipped" and "Remove", and
 * Remove asks first in a sheet with a red yes.
 */
export function NotToDoList({ items, date, queue }: Props) {
  const celebrate = useCelebrate();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [area, setArea] = useState<RelationshipKey | ''>('');
  const [openId, setOpenId] = useState<string | null>(null);
  // Adding or removing an item changes what a Bad habit card offers (Add to not to do), so Emerging is read again at once.
  const refreshInsights = useRefreshInsights();
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
      void refreshInsights();
      setTitle('');
      setArea('');
      setAdding(false);
    });
  };
  const slipped = (item: NotToDo) => {
    setOpenId(null);
    // The panel that held focus folds away, so focus goes back to the row's three-dot button.
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-ntd-toggle="${item.id}"]`)?.focus());
    mark(item, 'slipped');
  };
  // Removing is a second tap in the item's own panel (the founder, 2026-11-13: a small personal item, never a popup); the panel stays
  // open with the reason when it fails. An item already gone (removed in another tab or by the assistant, a 404) counts as removed.
  const remove = (item: NotToDo) =>
    queue.run(`ntd-${item.id}`, async () => {
      try {
        await api.notToDoRemove(item.id);
      } catch (e) {
        if (!(e instanceof ApiError && e.status === 404)) throw e;
      }
      void refreshInsights();
      setOpenId(null);
    });

  return (
    <section className="mt-lg" aria-labelledby="ntd-heading">
      <div className="flex items-baseline justify-between gap-sm">
        <h2 id="ntd-heading" className="text-title2">
          Not to do
        </h2>
        {items.length > 0 && (
          <span className="text-subhead text-ink-soft">
            {keptToday} of {items.length} kept today
          </span>
        )}
      </div>
      <p className="mt-xs m-0 text-subhead text-ink-soft">Things you are staying away from. Tick each one you kept today. Every day in a row grows its streak; a slip or a missed day starts it over.</p>

      {items.length > 0 && (
        <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
          {items.map((item) => {
            const rel = item.relationship ? RELATIONSHIP_BY_KEY[item.relationship] : null;
            const color = rel?.color ?? 'var(--color-ink)';
            const kept = item.week.filter((d) => d === 'kept').length;
            const open = openId === item.id;
            const subtitle =
              item.today === 'slipped' ? 'Slipped today. Fresh start tomorrow.' : item.streak === 0 ? 'No streak yet. Today can be day one.' : `${item.streak} ${item.streak === 1 ? 'day' : 'days'} in a row · best ${item.bestStreak}`;
            return (
              <li key={item.id} data-pillar={rel?.key}>
                <CheckRow
                  checked={item.today === 'kept'}
                  onToggle={() => mark(item, item.today === 'kept' ? null : 'kept')}
                  title={item.title}
                  subtitle={subtitle}
                  {...(rel ? pillarTick(rel) : { color, deep: 'var(--color-shadow)', text: 'var(--color-on-ink)' })}
                  busy={queue.isPending(`ntd-${item.id}`)}
                  hint={queue.hint(`ntd-${item.id}`)}
                  badge={<WeekDots days={item.week.map((d) => d === 'kept')} color={color} label={`Last seven days, ${kept} kept`} />}
                  aside={
                    <button
                      type="button"
                      onClick={() => setOpenId(open ? null : item.id)}
                      aria-expanded={open}
                      aria-controls={`ntd-more-${item.id}`}
                      aria-label={open ? `Close more for "${item.title}"` : `More for "${item.title}"`}
                      data-ntd-toggle={item.id}
                      className="toy toy-soft flex w-[48px] shrink-0 items-center justify-center rounded-tile bg-card text-ink-soft hover:text-ink"
                    >
                      <ToggleIcon open={open} icon={Ellipsis} size={20} />
                    </button>
                  }
                />
                {open && <NotToDoMore item={item} busy={queue.isPending(`ntd-${item.id}`)} onSlipped={() => slipped(item)} onRemove={() => remove(item)} onClose={() => setOpenId(null)} />}
              </li>
            );
          })}
        </ul>
      )}

      <YesterdayMarks items={items} date={date} queue={queue} />

      {items.length === 0 && !adding && (
        <div className="mt-sm rounded-card border-2 border-dashed border-line p-md">
          <p className="m-0 text-subhead text-ink-soft">Late scrolling, the snooze button, sugar after dinner. Name one thing to stay away from and keep a streak for it.</p>
        </div>
      )}

      {/* "Add one" is a fold with the plus that turns into a cross, the same as Daily's "Add a task" (the founder, 2026-11-06). */}
      {full ? (
        <p className="mt-sm m-0 text-subhead text-ink-soft">{MAX_NOT_TO_DO} is plenty. Remove one to add another.</p>
      ) : (
        <Fold className="mt-sm" title="Add one" adds open={adding} onOpenChange={setAdding}>
      <form onSubmit={add} className="px-sm pb-sm">
              <label className="block text-subhead font-semibold" htmlFor="ntd-title">
                Not to do
              </label>
              <input id="ntd-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={NOT_TO_DO_TITLE_MAX} placeholder="No phone in bed" autoFocus className={FIELD} />
              <label className="mt-sm block text-subhead font-semibold" htmlFor="ntd-area">
                Pillar
              </label>
              <select id="ntd-area" value={area} onChange={(e) => setArea(e.target.value as RelationshipKey | '')} className={FIELD}>
                <option value="">Any pillar</option>
                {RELATIONSHIPS.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.name}
                  </option>
                ))}
              </select>
              {queue.hint('ntd-add') && (
                <p role="alert" className="mt-sm m-0 text-subhead">
                  {queue.hint('ntd-add')}
                </p>
              )}
              <div className="mt-md">
                <Button type="submit" disabled={!title.trim() || queue.isPending('ntd-add')}>
                  Add
                </Button>
              </div>
            </form>
        </Fold>
      )}

    </section>
  );
}

/**
 * The row opened in place: its streak line, "I slipped today" and "Remove from the list" under the row it belongs to. Focus moves
 * in when it opens and Escape folds it again, back to the three-dot button.
 */
function NotToDoMore({ item, busy, onSlipped, onRemove, onClose }: { item: NotToDo; busy: boolean; onSlipped: () => void; onRemove: () => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const ask = useTapTwice();
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('button:not([disabled])')?.focus();
  }, []);
  const close = () => {
    onClose();
    document.querySelector<HTMLElement>(`[data-ntd-toggle="${item.id}"]`)?.focus();
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Escape') return;
    e.stopPropagation();
    close();
  };
  return (
    <div ref={ref} id={`ntd-more-${item.id}`} role="group" aria-label={`More for "${item.title}"`} onKeyDown={onKeyDown} className="mt-xs flex flex-col gap-sm rounded-tile bg-card p-sm shadow-toy-soft">
      <p className="m-0 text-subhead text-ink-soft">
        {item.streak > 0 ? `${item.streak} ${item.streak === 1 ? 'day' : 'days'} in a row, best ${item.bestStreak}.` : `Best run so far: ${item.bestStreak} ${item.bestStreak === 1 ? 'day' : 'days'}.`}
      </p>
      <div className="flex flex-wrap gap-xs">
        <Button variant="outline" onClick={onSlipped} disabled={item.today === 'slipped' || busy}>
          I slipped today
        </Button>
        <button type="button" onClick={() => ask.tap(true, () => { const said = afterRemove('Removed from the list.'); onRemove(); said(); })} disabled={busy} className={`${DELETE_BTN} ${ask.isArmed(true) ? 'red-armed' : ''}`}>
          <span aria-hidden={ask.isArmed(true) || undefined}>{ask.isArmed(true) ? 'Tap again to remove' : 'Remove from the list'}</span>
<span className="sr-only" aria-live="polite">{ask.isArmed(true) ? 'Tap again to remove' : ''}</span>
        </button>
      </div>
      <p className="m-0 text-caption text-ink-soft">Removing it ends its streak. The xp you earned stays.</p>
    </div>
  );
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** The device's own calendar day of a stored UTC instant, so an item made today is never asked about yesterday. */
function localDayOf(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/**
 * Yesterday can still be marked (the server takes today or yesterday), and an unmarked yesterday ends a streak. So when
 * an item that existed yesterday has nothing for it, one quiet line says how many; it opens in place with Kept and Slipped
 * for each, marked for yesterday and counted as of the person's today. Only yesterday, never earlier.
 */
function YesterdayMarks({ items, date, queue }: { items: NotToDo[]; date: string; queue: Queue }) {
  const [open, setOpen] = useState(false);
  const yesterday = shiftDay(date, -1);
  const unmarked = items.filter((i) => i.week[5] === null && localDayOf(i.createdAt) !== '' && localDayOf(i.createdAt) <= yesterday);
  // The server takes a day only within WAIT.dateWindowDays of its UTC date (`dateNearToday`); a device far
  // behind UTC late in its evening can be two days back on its yesterday, so the line hides then.
  const utcDay = new Date().toISOString().slice(0, 10);
  const near = Math.abs(Date.parse(`${yesterday}T00:00:00Z`) - Date.parse(`${utcDay}T00:00:00Z`)) <= WAIT.dateWindowDays * 86_400_000;
  if (!near || unmarked.length === 0) return null;
  const mark = (item: NotToDo, status: NotToDoStatus) => queue.run(`ntd-y-${item.id}`, () => api.notToDoDay(item.id, yesterday, date, status));
  return (
    <div className="mt-xs">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="ntd-yesterday"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex min-h-[44px] items-center gap-xs text-caption text-ink-soft hover:text-ink"
      >
        Yesterday: {unmarked.length} not marked
        <ToggleChevron open={open} size={14} />
      </button>
      {open && (
        <ul id="ntd-yesterday" aria-label="Mark yesterday" className="m-0 flex list-none flex-col gap-sm rounded-tile bg-card p-sm shadow-toy-soft">
          {unmarked.map((item) => {
            const busy = queue.isPending(`ntd-y-${item.id}`);
            const hint = queue.hint(`ntd-y-${item.id}`);
            return (
              <li key={item.id}>
                <div className="flex flex-wrap-reverse items-center justify-between gap-xs">
                  <span className="min-w-[60%] flex-1 text-subhead">{item.title}</span>
                  <span className="flex shrink-0 gap-xs">
                    <Button variant="outline" size="sm" disabled={busy} onClick={() => mark(item, 'kept')} aria-label={`Kept "${item.title}" yesterday`}>
                      Kept
                    </Button>
                    <Button variant="outline" size="sm" disabled={busy} onClick={() => mark(item, 'slipped')} aria-label={`Slipped on "${item.title}" yesterday`}>
                      Slipped
                    </Button>
                  </span>
                </div>
                {hint && (
                  <p role="alert" className="mt-xs m-0 text-subhead text-r1">
                    {hint}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
