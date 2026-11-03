import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useSession } from '../lib/store';
import { Button } from './Button';
import { Fold } from './Fold';
import { Toggle } from './Toggle';
import { copyPlain } from '../lib/clipboard';

/** The words on this card, in short plain sentences. */
const COPY = {
  lede: 'See your tasks in Google, Apple or Outlook Calendar. One private link does it.',
  switch: 'Show my tasks in my calendar',
  switchHint: 'Off until you switch it on.',
  inside: 'Each open task that has a day shows up. You see its title, its pillar and its priority, and the time when it has one.',
  never: 'Your notes, your journal, your mood and anything from a tracker are never in it.',
  oneWay: 'It shows your tasks in your calendar. It does not change your tasks from your calendar.',
  updates: 'Your calendar app checks the link by itself, about once an hour.',
  secret: 'Anyone with this link can see those titles. Do not share it.',
  fresh: 'Make a fresh link',
  freshAsk: 'Tap again to make a fresh link. The old one stops at once.',
  google: 'Google Calendar: open Other calendars, then From URL, and paste the link.',
  apple: 'Apple Calendar: choose File, then New Calendar Subscription, and paste the link.',
  outlook: 'Outlook: choose Add calendar, then Subscribe from web, and paste the link.',
  failed: 'That did not save. Try again.',
} as const;

/** The private calendar link on Profile: one secret address a calendar app can subscribe to. */
export function CalendarLink() {
  const qc = useQueryClient();
  const token = useSession((s) => s.token);
  const q = useQuery({ queryKey: ['me', 'calendar'], queryFn: api.calendarLink, enabled: Boolean(token) });
  const [copied, setCopied] = useState(false);
  const [sure, setSure] = useState(false);
  const save = useMutation({
    mutationFn: (body: { on?: boolean; fresh?: boolean }) => api.calendarSwitch(body),
    onSuccess: (res) => qc.setQueryData(['me', 'calendar'], res),
  });
  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(t);
  }, [copied]);
  useEffect(() => {
    if (!sure) return;
    const t = window.setTimeout(() => setSure(false), 5000);
    return () => window.clearTimeout(t);
  }, [sure]);

  const on = q.data?.enabled === true;
  const url = on && q.data?.token ? `${window.location.origin}/api/public/calendar/${q.data.token}.ics` : '';
  const copy = () => {
    void copyPlain(url).then((ok) => ok && setCopied(true));
  };

  return (
    <section className="mt-lg" aria-labelledby="calendar-heading">
      <h2 id="calendar-heading" className="text-[24px]">
        Calendar
      </h2>
      <p className="mt-xs m-0 text-balance text-[14px] font-semibold text-ink-soft">{COPY.lede}</p>
      <div className="mt-sm rounded-card bg-card p-md shadow-toy-soft">
        <Toggle on={on} onChange={(v) => save.mutate({ on: v })} label={COPY.switch} hint={COPY.switchHint} disabled={q.isPending || save.isPending} />
        {(save.isError || q.isError) && (
          <p role="alert" className="mt-sm m-0 text-[14px] font-bold">
            {COPY.failed}
          </p>
        )}
        {on && url && (
          <div className="mt-sm">
            <label className="block text-[14px] font-bold" htmlFor="calendar-url">
              Your private link
            </label>
            <input id="calendar-url" readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-[14px]" />
            <div className="mt-xs flex flex-wrap items-center gap-xs">
              <Button size="sm" onClick={copy}>
                {copied ? 'Copied' : 'Copy link'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={save.isPending}
                onClick={() => {
                  if (!sure) return setSure(true);
                  setSure(false);
                  save.mutate({ on: true, fresh: true });
                }}
              >
                {sure ? 'Yes, make a fresh link' : COPY.fresh}
              </Button>
            </div>
            {sure && (
              <p role="status" className="mt-xs m-0 text-[12px] font-bold text-ink-soft">
                {COPY.freshAsk}
              </p>
            )}
            <p className="mt-sm m-0 text-[12px] font-bold text-ink-soft">{COPY.secret}</p>
            <Fold className="mt-sm" title="How to add it">
              <ul className="m-0 flex list-none flex-col gap-xs p-sm text-[14px] font-semibold text-ink-soft">
                <li>{COPY.google}</li>
                <li>{COPY.apple}</li>
                <li>{COPY.outlook}</li>
              </ul>
            </Fold>
          </div>
        )}
        <div className="mt-sm flex flex-col gap-xs text-[14px] font-semibold text-ink-soft">
          <p className="m-0">{COPY.inside}</p>
          <p className="m-0">{COPY.never}</p>
          <p className="m-0">{COPY.oneWay}</p>
          <p className="m-0">{COPY.updates}</p>
        </div>
      </div>
    </section>
  );
}
