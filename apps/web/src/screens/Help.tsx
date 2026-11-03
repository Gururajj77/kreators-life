import { earningGuide, HELP_FAQ, termGroups, type SupportTicket } from '@kreators/shared';
import { longDate } from '../lib/date';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { Button } from '../components/Button';
import { BackLink } from '../components/PageHeader';
import { Screen } from '../components/Screen';
import { api } from '../lib/api';
import { useAuthed } from '../lib/queries';
import { Fold } from '../components/Fold';
import { FIELD } from '../lib/ui';
import { ErrorLine } from '../components/ErrorLine';



const STATUS_TINT: Record<SupportTicket['status'], string> = { open: 'var(--tint-yellow)', answered: 'var(--tint-green)', closed: 'var(--tint-brown)' };

function Ticket({ t, agent, onChange }: { t: SupportTicket; agent: boolean; onChange: () => void }) {
  const [reply, setReply] = useState('');
  const [status, setStatus] = useState<SupportTicket['status']>('answered');
  const send = useMutation({
    mutationFn: () => api.replyTicket(t.id, { reply, status }),
    onSuccess: () => {
      setReply('');
      onChange();
    },
  });
  return (
    <li className="rounded-tile bg-card p-sm shadow-toy-soft">
      <p className="m-0 flex flex-wrap items-center gap-xs text-[16px] font-bold">
        {t.subject}
        <span className="rounded-pill px-xs text-[12px] font-extrabold leading-[20px]" style={{ background: STATUS_TINT[t.status] }}>
          {t.status}
        </span>
      </p>
      <p className="m-0 text-[14px] font-semibold text-ink-soft">
        {agent ? `${t.userName}, ` : ''}
        {longDate(t.createdAt)}
      </p>
      <p className="mt-xs m-0 whitespace-pre-wrap text-[16px] font-semibold leading-relaxed">{t.body}</p>
      {t.reply && (
        <div className="mt-sm rounded-tile bg-paper p-sm">
          <p className="m-0 text-[12px] font-bold text-ink-soft">{t.repliedByName || 'The team'} replied</p>
          <p className="mt-xs m-0 whitespace-pre-wrap text-[16px] font-semibold leading-relaxed">{t.reply}</p>
        </div>
      )}
      {agent && t.status !== 'closed' && (
        <form
          className="mt-sm flex flex-col gap-sm"
          onSubmit={(e) => {
            e.preventDefault();
            send.mutate();
          }}
        >
          <label className="block">
            <span className="block text-[12px] font-bold">Reply</span>
            <textarea value={reply} onChange={(e) => setReply(e.target.value)} maxLength={4000} rows={3} className={FIELD} />
          </label>
          <div className="flex flex-wrap items-end gap-xs">
            <label className="block">
              <span className="block text-[12px] font-bold">Then mark it</span>
              <select value={status} onChange={(e) => setStatus(e.target.value as SupportTicket['status'])} className={FIELD}>
                <option value="answered">answered</option>
                <option value="closed">closed</option>
                <option value="open">still open</option>
              </select>
            </label>
            <Button type="submit" disabled={send.isPending || (!reply.trim() && status === t.status)}>
              Send
            </Button>
          </div>
          <ErrorLine e={send.isError ? send.error : null} />
        </form>
      )}
    </li>
  );
}

export function Help() {
  const q = useAuthed(['support'], api.support);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sent, setSent] = useState(false);
  const open = useMutation({
    mutationFn: () => api.openTicket({ subject, body }),
    onSuccess: () => {
      setSubject('');
      setBody('');
      setSent(true);
      q.refetch();
    },
  });
  const d = q.data;

  return (
    <Screen>
      <header className="pt-lg">
        <BackLink to="/apps">Apps</BackLink>
        <h1 className="text-[30px]">Help</h1>
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Answers to the usual questions, and a line to the team.</p>
        <p className="mt-xs m-0 text-[12px] font-bold text-ink-soft">In danger? Call your local emergency number. In India, Tele-MANAS is 14416.</p>
        <div className="mt-sm">
          <nav aria-label="On this page" className="scroll-row">
            {[
              ['#earning', 'How you earn'],
              ['#words', 'Words we use'],
              ['#faq', 'Common questions'],
              ['#write', 'Write to the team'],
            ].map(([href, label]) => (
              <a key={href} href={href} className="toy toy-flat inline-flex min-h-[44px] shrink-0 items-center whitespace-nowrap rounded-pill bg-card px-md text-[14px] font-bold">
                {label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <section className="mt-lg" id="earning" aria-labelledby="earning-heading">
        <h2 id="earning-heading" className="text-[24px]">
          How you earn
        </h2>
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Xp is progress, points are to spend, and badges are proof. Showing up is the whole trick.</p>
        {earningGuide().map((g) => (
          <Fold key={g.title} className="mt-sm" title={g.title} hint={String(g.lines.length)}>
          <div className="rounded-card bg-card p-md shadow-toy-soft">
            <ul className="flex list-none flex-col p-0 m-0">
              {g.lines.map((l) => (
                <li key={l.what} className="flex items-baseline justify-between gap-sm border-t border-line py-xs text-[14px]">
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold">{l.what}</span>
                    <span className="block font-semibold text-ink-soft">{l.how}</span>
                  </span>
                  <span className="shrink-0 font-extrabold">{l.pays}</span>
                </li>
              ))}
            </ul>
          </div>
          </Fold>
        ))}
      </section>

      <section className="mt-lg" id="words" aria-labelledby="words-heading">
        <h2 id="words-heading" className="text-[24px]">
          Words we use
        </h2>
        <p className="prose-long mt-xs m-0 text-[14px] font-semibold text-ink-soft">Every word the app made up, in plain ones. The "How it works" section at the bottom of each app shows the ones it leans on.</p>
        <div className="mt-sm">
          <nav aria-label="Word categories" className="scroll-row">
            {termGroups().map((g) => (
              <a key={g.name} href={`#words-${g.name.toLowerCase().replace(/[^a-z]+/g, '-')}`} className="toy toy-flat inline-flex min-h-[44px] shrink-0 items-center whitespace-nowrap rounded-pill bg-card px-md text-[14px] font-bold">
                {g.name}
              </a>
            ))}
          </nav>
        </div>
        {termGroups().map((g) => (
          <div key={g.name} id={`words-${g.name.toLowerCase().replace(/[^a-z]+/g, '-')}`} className="mt-md">
            <h3 className="m-0 text-[16px] font-extrabold">{g.name}</h3>
            <ul className="mt-xs flex list-none flex-col gap-xs p-0 m-0">
              {g.terms.map(([term, meaning]) => (
                <li key={term} className="prose-long rounded-tile bg-card p-sm text-[14px] shadow-toy-soft">
                  <span className="font-bold">{term}</span>
                  <span className="font-semibold text-ink-soft"> {meaning}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section className="mt-lg" id="faq" aria-labelledby="faq-heading">
        <h2 id="faq-heading" className="text-[24px]">
          Common questions
        </h2>
        <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
          {HELP_FAQ.map((f) => (
            <li key={f.q}>
              <Fold title={f.q}>
                <p className="prose-long m-0 px-sm pb-sm text-[16px] font-semibold leading-relaxed text-ink-soft">{f.a}</p>
              </Fold>
            </li>
          ))}
        </ul>
        <p className="mt-sm m-0 text-[14px] font-semibold text-ink-soft">
          Switch parts of the app on or off under{' '}
          <Link to="/you#features" className="underline underline-offset-4">
            Profile, Features
          </Link>
          .
        </p>
      </section>

      <section className="mt-lg" id="write" aria-labelledby="write-heading">
        <h2 id="write-heading" className="text-[24px]">
          Write to the team
        </h2>
        {sent && (
          <p role="status" className="mt-xs m-0 rounded-tile p-sm text-[14px] font-bold" style={{ background: 'var(--tint-green)' }}>
            Got it. A reply lands in your Inbox and below.
          </p>
        )}
        <form
          className="mt-sm flex flex-col gap-md rounded-card bg-card p-md shadow-toy-soft"
          onSubmit={(e) => {
            e.preventDefault();
            if (subject.trim() && body.trim()) open.mutate();
          }}
        >
          <label className="block">
            <span className="block text-[14px] font-bold">Subject</span>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={120} required className={FIELD} />
          </label>
          <label className="block">
            <span className="block text-[14px] font-bold">What happened</span>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000} rows={4} required className={FIELD} />
          </label>
          <ErrorLine e={open.isError ? open.error : null} />
          <Button type="submit" full disabled={open.isPending || !subject.trim() || !body.trim()}>
            Send
          </Button>
        </form>
      </section>

      {d && d.tickets.length > 0 && (
        <section className="mt-lg" aria-labelledby="mine-heading">
          <h2 id="mine-heading" className="text-[24px]">
            Your messages
          </h2>
          <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
            {d.tickets.map((t) => (
              <Ticket key={t.id} t={t} agent={false} onChange={() => q.refetch()} />
            ))}
          </ul>
        </section>
      )}

      {d?.agent && (
        <section className="mt-lg" aria-labelledby="queue-heading">
          <h2 id="queue-heading" className="text-[24px]">
            Open tickets
          </h2>
          {d.queue.length === 0 && <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Nothing waiting. Nice.</p>}
          <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
            {d.queue.map((t) => (
              <Ticket key={t.id} t={t} agent onChange={() => q.refetch()} />
            ))}
          </ul>
        </section>
      )}
    </Screen>
  );
}
