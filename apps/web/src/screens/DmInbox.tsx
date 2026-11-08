import type { DmRequest } from '@kreators/shared';
import { longDate } from '../lib/date';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '../components/Button';
import { AppCover } from '../components/AppCover';
import { Screen } from '../components/Screen';
import { api } from '../lib/api';
import { useAuthed } from '../lib/queries';
import { Fold } from '../components/Fold';
import { Pager, TEN_A_PAGE, usePage } from '../components/Pager';

export function DmInbox() {
  // Waiting questions come whole; the answered ones a page at a time (prefix `an`, ten by default).
  const ap = usePage('an', TEN_A_PAGE);
  const q = useAuthed(['dm-requests', ap.query], () => api.dmRequests(ap.query));
  const open = q.data?.requests.filter((r) => r.status === 'open') ?? [];
  const closed = q.data?.requests.filter((r) => r.status !== 'open') ?? [];
  return (
    <Screen>
      <AppCover back={{ to: '/shop', label: 'Shop' }} title="Priority DMs" lede="Paid questions. Each one has a promised answer date; the buyer sees your reply in their purchases." />

      <section className="mt-md" aria-labelledby="open-heading">
        <h2 id="open-heading" className="text-title2">
          Waiting, {open.length}
        </h2>
        {q.data && open.length === 0 && <p className="mt-sm m-0 text-subhead text-ink-soft">Nothing waiting. Sell a Priority DM product to get questions here.</p>}
        <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
          {open.map((r) => (
            <OpenRequest key={r.id} r={r} onDone={() => void q.refetch()} />
          ))}
        </ul>
      </section>

      {(closed.length > 0 || (q.data?.answeredPage.page ?? 1) > 1) && (
        <section className="mt-lg" aria-labelledby="done-heading">
          <h2 id="done-heading" className="text-title2">
            Answered
          </h2>
          <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
            {closed.map((r) => (
              <li key={r.id}>
                <Fold title={`${r.buyerName}, ${r.productTitle}`} hint={`${r.status}${r.answeredAt ? ` ${longDate(r.answeredAt)}` : ''}`}>
                  <p className="mt-sm m-0 whitespace-pre-wrap text-subhead">{r.question}</p>
                  {r.answer && <p className="mt-sm m-0 whitespace-pre-wrap rounded-tile bg-paper p-sm text-subhead">{r.answer}</p>}
                </Fold>
              </li>
            ))}
          </ul>
          <Pager page={q.data?.answeredPage} prefix="an" label="answered questions" only={TEN_A_PAGE} />
        </section>
      )}
    </Screen>
  );
}

function OpenRequest({ r, onDone }: { r: DmRequest; onDone: () => void }) {
  const [answer, setAnswer] = useState('');
  const send = useMutation({ mutationFn: () => api.answerDm(r.id, answer), onSuccess: onDone });
  const overdue = new Date(r.dueAt).getTime() < Date.now();
  return (
    <li className="rounded-tile bg-card p-sm shadow-toy-soft">
      <p className="m-0 text-card-title">
        {r.buyerName}, {r.productTitle}
      </p>
      <p className={`m-0 text-card-note ${overdue ? 'text-r1' : 'text-ink-soft'}`}>
        {overdue ? 'Overdue, promised by' : 'Answer by'} {longDate(r.dueAt)}. Asked {longDate(r.createdAt)}.
      </p>
      <p className="mt-sm m-0 whitespace-pre-wrap rounded-tile bg-paper p-sm text-prose">{r.question}</p>
      <form
        className="mt-sm flex flex-col gap-sm"
        onSubmit={(e) => {
          e.preventDefault();
          if (answer.trim()) send.mutate();
        }}
      >
        <label className="block">
          <span className="block text-subhead font-semibold">Your answer</span>
          <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} rows={4} maxLength={4000} className="mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-body" />
        </label>
        {send.isError && (
          <p role="alert" className="m-0 rounded-tile bg-r1/15 p-sm text-subhead">
            {send.error instanceof Error ? send.error.message : 'Could not send.'}
          </p>
        )}
        <Button type="submit" full disabled={send.isPending || !answer.trim()}>
          Send answer
        </Button>
      </form>
    </li>
  );
}
