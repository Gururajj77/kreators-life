import { earningGuide, formatCount, HELP_FAQ, termGroups, type SupportTicket } from '@kreators/shared';
import { longDate } from '../lib/date';
import { useMutation } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Button } from '../components/Button';
import { AppCover } from '../components/AppCover';
import { Screen } from '../components/Screen';
import { api } from '../lib/api';
import { useAuthed } from '../lib/queries';
import { Fold } from '../components/Fold';
import { FIELD } from '../lib/ui';
import { ErrorLine } from '../components/ErrorLine';
import { CardHead } from '../components/CardHead';
import { Pager, usePage } from '../components/Pager';
import { TabRow } from '../components/TabRow';



const slug = (name: string) => name.toLowerCase().replace(/[^a-z]+/g, '-');
/** The jump pills at the top of Help and over its words: as many as fit, the rest behind More, never cut at the edge. */
const JUMP_PILL = () => 'toy toy-flat inline-flex min-h-[44px] items-center rounded-pill bg-card px-md text-subhead font-medium';
const PAGE_PARTS = [
  { key: 'earning', label: 'How you earn' },
  { key: 'words', label: 'Words we use' },
  { key: 'faq', label: 'Common questions' },
  { key: 'write', label: 'Write to the team' },
] as const;
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
      <CardHead
        tag={
          <span title={t.status} className="max-w-full truncate rounded-pill px-xs text-caption font-medium leading-[20px]" style={{ background: STATUS_TINT[t.status] }}>
            {t.status}
          </span>
        }
      >
        <p className="m-0 text-card-title">{t.subject}</p>
      </CardHead>
      <p className="text-card-note text-ink-soft">
        {agent ? `${t.userName}, ` : ''}
        {longDate(t.createdAt)}
      </p>
      <p className="mt-xs m-0 whitespace-pre-wrap text-prose">{t.body}</p>
      {t.reply && (
        <div className="mt-sm rounded-tile bg-paper p-sm">
          <p className="m-0 text-caption text-ink-soft">{t.repliedByName || 'The team'} replied</p>
          <p className="mt-xs m-0 whitespace-pre-wrap text-prose">{t.reply}</p>
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
            <span className="block text-caption">Reply</span>
            <textarea value={reply} onChange={(e) => setReply(e.target.value)} maxLength={4000} rows={3} className={FIELD} />
          </label>
          {/* The select grows to fill the row, Send reply at its right (fields in a row fill it). */}
          <div className="flex flex-wrap items-end gap-xs">
            <label className="block min-w-0 flex-[1_1_160px]">
              <span className="block text-caption">Then mark it</span>
              <select value={status} onChange={(e) => setStatus(e.target.value as SupportTicket['status'])} className={FIELD}>
                <option value="answered">answered</option>
                <option value="closed">closed</option>
                <option value="open">still open</option>
              </select>
            </label>
            {/* An outline on every ticket in the queue: the page's one solid button is the form's Send to the team. */}
            <Button type="submit" variant="outline" disabled={send.isPending || (!reply.trim() && status === t.status)}>
              Send reply
            </Button>
          </div>
          <ErrorLine e={send.isError ? send.error : null} />
        </form>
      )}
    </li>
  );
}

export function Help() {
  // Both lists a page at a time: `t` for the person's own messages, `q` for the queue the support staff answer.
  const tp = usePage('t');
  const qp = usePage('q');
  const pq = `${tp.query}&${qp.query}`;
  const q = useAuthed(['support', pq], () => api.support(pq));
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
  const groups = useMemo(() => termGroups(), []);
  const groupItems = useMemo(() => groups.map((g) => ({ key: g.name, label: g.name })), [groups]);
  const [wordsOpen, setWordsOpen] = useState<Set<string>>(() => new Set());

  return (
    <Screen>
      <AppCover
        back={{ to: '/apps', label: 'Apps' }}
        title="Help"
        lede={
          <>
            <p className="m-0">Answers to the usual questions, and a line to the team.</p>
            <p className="mt-xs m-0 text-caption">In danger? Call your local emergency number or go to the nearest hospital. In India, Tele-MANAS is 14416.</p>
          </>
        }
      >
        <nav aria-label="On this page">
          <TabRow label="On this page" items={PAGE_PARTS} href={(k) => `#${k}`} pillClass={JUMP_PILL} />
        </nav>
      </AppCover>

      <section className="mt-lg" id="earning" aria-labelledby="earning-heading">
        <h2 id="earning-heading" className="text-title2">
          How you earn
        </h2>
        <p className="mt-xs m-0 text-subhead text-ink-soft">Xp is progress, points are to spend, and badges are proof. Showing up is the whole trick.</p>
        {earningGuide().map((g) => (
          <Fold key={g.title} className="mt-sm" title={g.title} hint={String(g.lines.length)}>
          <div className="rounded-card bg-card p-md shadow-toy-soft">
            <ul className="flex list-none flex-col p-0 m-0">
              {g.lines.map((l) => (
                <li key={l.what} className="flex items-baseline justify-between gap-sm border-t border-line py-xs text-subhead">
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{l.what}</span>
                    <span className="block text-ink-soft">{l.how}</span>
                  </span>
                  <span className="shrink-0 font-bold">{l.pays}</span>
                </li>
              ))}
            </ul>
          </div>
          </Fold>
        ))}
      </section>

      <section className="mt-lg" id="words" aria-labelledby="words-heading">
        <h2 id="words-heading" className="text-title2">
          Words we use
        </h2>
        <p className="prose-long mt-xs m-0 text-prose text-ink-soft">Every word the app made up, in plain ones. The "How it works" section at the bottom of each app shows the ones it leans on.</p>
        <div className="mt-sm">
          <nav aria-label="Word categories">
            <TabRow
              label="Word categories"
              items={groupItems}
              href={(name) => `#words-${slug(name)}`}
              onChange={(name) => setWordsOpen((o) => new Set(o).add(name))}
              pillClass={JUMP_PILL}
            />
          </nav>
        </div>
        {/* Every word stays listed, folded by group so the form to write to the team is not under a wall of cards. A pill above opens its group. */}
        <div className="mt-sm flex flex-col gap-xs">
          {groups.map((g) => (
            <div key={g.name} id={`words-${slug(g.name)}`}>
              <Fold
                title={g.name}
                hint={formatCount(g.terms.length)}
                open={wordsOpen.has(g.name)}
                onOpenChange={(on) =>
                  setWordsOpen((o) => {
                    const next = new Set(o);
                    if (on) next.add(g.name);
                    else next.delete(g.name);
                    return next;
                  })
                }
              >
                <ul className="flex list-none flex-col gap-xs p-0 m-0">
                  {g.terms.map(([term, meaning]) => (
                    <li key={term} className="prose-long rounded-tile bg-card p-sm text-prose shadow-toy-soft">
                      <span className="font-semibold">{term}</span>
                      <span className="text-ink-soft"> {meaning}</span>
                    </li>
                  ))}
                </ul>
              </Fold>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-lg" id="faq" aria-labelledby="faq-heading">
        <h2 id="faq-heading" className="text-title2">
          Common questions
        </h2>
        <ul data-reading className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
          {HELP_FAQ.map((f) => (
            <li key={f.q}>
              <Fold title={f.q}>
                <p className="prose-long m-0 px-sm pb-sm text-prose text-ink-soft">{f.a}</p>
              </Fold>
            </li>
          ))}
        </ul>
        <p className="mt-sm m-0 text-subhead text-ink-soft">
          Hide or unhide apps under{' '}
          <Link to="/you#features" className="underline underline-offset-4">
            Profile, Features
          </Link>
          .
        </p>
        <p className="mt-xs m-0 text-subhead text-ink-soft">
          Patterns in what you already log, by week, month or more, are on{' '}
          <Link to="/insights" className="underline underline-offset-4">
            Emerging
          </Link>
          . Only you see them, unless you share them with a life coach.
        </p>
        <p className="mt-xs m-0 text-subhead text-ink-soft">
          Shape each day with blocks and day templates on{' '}
          <Link to="/time-blocks" className="underline underline-offset-4">
            Time blocks
          </Link>
          .
        </p>
        <p className="mt-xs m-0 text-subhead text-ink-soft">On a laptop, the small dashes at the top right of a page list its sections. Point at them to read the names, and click one to go there.</p>
      </section>

      <section className="mt-lg" id="write" aria-labelledby="write-heading">
        <h2 id="write-heading" className="text-title2">
          Write to the team
        </h2>
        {sent && (
          <p role="status" className="mt-xs m-0 rounded-tile p-sm text-subhead" style={{ background: 'var(--tint-green)' }}>
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
            <span className="block text-subhead font-semibold">Subject</span>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={120} required className={FIELD} />
          </label>
          <label className="block">
            <span className="block text-subhead font-semibold">What happened</span>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000} rows={4} required className={FIELD} />
          </label>
          <ErrorLine e={open.isError ? open.error : null} />
          <Button type="submit" full disabled={open.isPending || !subject.trim() || !body.trim()}>
            Send
          </Button>
        </form>
      </section>

      {d && (d.tickets.length > 0 || tp.page > 1) && (
        <section className="mt-lg" aria-labelledby="mine-heading">
          <h2 id="mine-heading" className="text-title2">
            Your messages
          </h2>
          <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
            {d.tickets.map((t) => (
              <Ticket key={t.id} t={t} agent={false} onChange={() => q.refetch()} />
            ))}
          </ul>
          <Pager page={d.page} prefix="t" label="your messages" />
        </section>
      )}

      {d?.agent && (
        <section className="mt-lg" aria-labelledby="queue-heading">
          <h2 id="queue-heading" className="text-title2">
            Open tickets
          </h2>
          {d.queue.length === 0 && <p className="mt-xs m-0 text-subhead text-ink-soft">Nothing waiting. Nice.</p>}
          <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
            {d.queue.map((t) => (
              <Ticket key={t.id} t={t} agent onChange={() => q.refetch()} />
            ))}
          </ul>
          <Pager page={d.queuePage} prefix="q" label="open tickets" />
        </section>
      )}
    </Screen>
  );
}
