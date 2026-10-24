import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { api } from '../lib/api';
import { useInbox, useMe, useRefreshAll } from '../lib/queries';

const ICON: Record<string, string> = { reply: '💬', order: '🛍️', lead: '📨', booking: '📅', follow: '🫶', broadcast: '📣', reminder: '⏰', review: '⭐', affiliate: '🤝', moderation: '🛡️' };

export function Inbox() {
  const q = useInbox();
  const me = useMe();
  const refresh = useRefreshAll();
  const readAll = useMutation({ mutationFn: api.readAll, onSuccess: () => refresh() });
  const readOne = useMutation({ mutationFn: (id: string) => api.readOne(id), onSuccess: () => refresh() });
  const [time, setTime] = useState(me.data?.user.reminderTime ?? '');
  const saveTime = useMutation({ mutationFn: (t: string | null) => api.updateMe({ reminderTime: t }), onSuccess: () => refresh() });
  const list = q.data?.notifications ?? [];

  return (
    <Screen>
      <header className="pt-lg">
        <div className="flex items-center justify-between gap-sm">
          <h1 className="text-[30px]">Inbox</h1>
          {list.some((n) => !n.readAt) && (
            <Button variant="ghost" onClick={() => readAll.mutate()} disabled={readAll.isPending}>
              Mark all read
            </Button>
          )}
        </div>
      </header>

      <section className="mt-md rounded-card bg-card p-md shadow-toy-soft" aria-labelledby="rem-heading">
        <h2 id="rem-heading" className="text-[18px]">
          Daily reminder
        </h2>
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">A nudge lands here each day you have not checked in yet.</p>
        <div className="mt-sm flex gap-xs">
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Reminder time" className="min-w-0 flex-1 rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]" />
          <Button onClick={() => saveTime.mutate(time || null)} disabled={saveTime.isPending}>
            {time ? 'Save' : 'Off'}
          </Button>
        </div>
      </section>

      <section className="mt-lg" aria-labelledby="list-heading">
        <h2 id="list-heading" className="text-[18px]">
          What happened
        </h2>
        {list.length === 0 && <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Nothing yet. Replies, orders, bookings and broadcasts show up here.</p>}
        <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
          {list.map((n) => {
            const inner = (
              <>
                <span className="flex size-[40px] shrink-0 items-center justify-center rounded-pill bg-paper text-[18px]" aria-hidden="true">
                  {ICON[n.kind] ?? '🔔'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-[16px] ${n.readAt ? 'font-semibold' : 'font-extrabold'}`}>{n.title}</span>
                  {n.body && <span className="block text-[14px] font-semibold text-ink-soft">{n.body}</span>}
                  <span className="block text-[12px] font-bold text-ink-mute">{new Date(n.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                </span>
                {!n.readAt && <span className="size-[10px] shrink-0 rounded-pill bg-r1" aria-label="Unread" />}
              </>
            );
            const cls = 'toy toy-soft flex w-full items-start gap-sm rounded-tile bg-card p-sm text-left';
            return (
              <li key={n.id}>
                {n.link ? (
                  <Link to={n.link} className={cls} onClick={() => !n.readAt && readOne.mutate(n.id)}>
                    {inner}
                  </Link>
                ) : (
                  <button type="button" className={cls} onClick={() => !n.readAt && readOne.mutate(n.id)}>
                    {inner}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </Screen>
  );
}
