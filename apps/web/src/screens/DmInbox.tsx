import type { DmRequest } from '@kreators/shared';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { api } from '../lib/api';
import { useAuthed } from '../lib/queries';

export function DmInbox() {
  const q = useAuthed(['dm-requests'], api.dmRequests);
  const open = q.data?.requests.filter((r) => r.status === 'open') ?? [];
  const closed = q.data?.requests.filter((r) => r.status !== 'open') ?? [];
  return (
    <Screen>
      <header className="pt-lg">
        <Link to="/shop" className="inline-flex min-h-[44px] items-center gap-xs font-bold text-ink-soft">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 5l-7 7 7 7" />
          </svg>
          Shop
        </Link>
        <h1 className="text-[30px]">Priority DMs</h1>
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Paid questions. Each one has a promised answer date; the buyer sees your reply in their purchases.</p>
      </header>

      <section className="mt-md" aria-labelledby="open-heading">
        <h2 id="open-heading" className="text-[24px]">
          Waiting, {open.length}
        </h2>
        {q.data && open.length === 0 && <p className="mt-sm m-0 text-[14px] font-semibold text-ink-soft">Nothing waiting. Sell a Priority DM product to get questions here.</p>}
        <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
          {open.map((r) => (
            <OpenRequest key={r.id} r={r} onDone={() => void q.refetch()} />
          ))}
        </ul>
      </section>

      {closed.length > 0 && (
        <section className="mt-lg" aria-labelledby="done-heading">
          <h2 id="done-heading" className="text-[24px]">
            Answered
          </h2>
          <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
            {closed.map((r) => (
              <li key={r.id}>
                <details className="rounded-tile bg-card p-sm shadow-toy-soft">
                  <summary className="cursor-pointer text-[16px] font-bold">
                    {r.buyerName}, {r.productTitle}
                    <span className="font-semibold text-ink-soft">
                      {' '}
                      {r.status}
                      {r.answeredAt ? ` ${new Date(r.answeredAt).toLocaleDateString()}` : ''}
                    </span>
                  </summary>
                  <p className="mt-sm m-0 whitespace-pre-wrap text-[14px] font-semibold">{r.question}</p>
                  {r.answer && <p className="mt-sm m-0 whitespace-pre-wrap rounded-tile bg-paper p-sm text-[14px] font-semibold">{r.answer}</p>}
                </details>
              </li>
            ))}
          </ul>
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
      <p className="m-0 text-[16px] font-bold">
        {r.buyerName}, {r.productTitle}
      </p>
      <p className={`m-0 text-[14px] font-bold ${overdue ? 'text-r1' : 'text-ink-soft'}`}>
        {overdue ? 'Overdue, promised by' : 'Answer by'} {new Date(r.dueAt).toLocaleDateString()}. Asked {new Date(r.createdAt).toLocaleDateString()}.
      </p>
      <p className="mt-sm m-0 whitespace-pre-wrap rounded-tile bg-paper p-sm text-[16px] font-semibold">{r.question}</p>
      <form
        className="mt-sm flex flex-col gap-sm"
        onSubmit={(e) => {
          e.preventDefault();
          if (answer.trim()) send.mutate();
        }}
      >
        <label className="block">
          <span className="block text-[14px] font-bold">Your answer</span>
          <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} rows={4} maxLength={4000} className="mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]" />
        </label>
        {send.isError && (
          <p role="alert" className="m-0 rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
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
