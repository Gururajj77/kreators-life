import { PROPOSAL_STAGES, type Proposal, type ProposalStage } from '@kreators/shared';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '../components/Button';
import { BackLink } from '../components/PageHeader';
import { Screen } from '../components/Screen';
import { Sheet } from '../components/Sheet';
import { api } from '../lib/api';
import { useAuthed } from '../lib/queries';
import { Pager, usePage } from '../components/Pager';
import { Icon } from '../components/Icon';
import { ChevronDown } from 'lucide-react';
import { FIELD } from '../lib/ui';
import { ErrorLine } from '../components/ErrorLine';


const COPY = {
  tv: {
    title: 'TV',
    heading: 'Pitch a series',
    blurb: 'Pitch a show. The team reads it, asks questions, and if it is a yes you make it together.',
    action: 'Pitch a series',
    sheet: 'Your pitch',
    pitchLabel: 'The pitch: premise, format, episodes, why you',
    budgetLabel: 'Budget you need per episode',
  },
  fund: {
    title: 'Fund',
    heading: 'Apply for backing',
    blurb: 'A grant or backing for a project. Say what you will make, what it costs, and what changes if it works.',
    action: 'Apply for backing',
    sheet: 'Your application',
    pitchLabel: 'The project: what, for whom, timeline, what success looks like',
    budgetLabel: 'Amount you are asking for',
  },
} as const;

const STAGE_LABEL: Record<ProposalStage, string> = {
  submitted: 'Submitted',
  review: 'In review',
  diligence: 'Checking details',
  approved: 'Approved',
  rejected: 'Not this time',
  in_progress: 'In progress',
  released: 'Released',
};
const STAGE_TINT: Record<ProposalStage, string> = {
  submitted: 'var(--tint-yellow)',
  review: 'var(--tint-yellow)',
  diligence: 'var(--tint-orange)',
  approved: 'var(--tint-green)',
  rejected: 'var(--tint-red)',
  in_progress: 'var(--tint-purple)',
  released: 'var(--tint-green)',
};


function StagePill({ stage }: { stage: ProposalStage }) {
  return (
    <span className="rounded-pill px-xs text-[12px] font-extrabold leading-[20px]" style={{ background: STAGE_TINT[stage] }}>
      {STAGE_LABEL[stage]}
    </span>
  );
}

function ProposalCard({ p, reviewer, onChange }: { p: Proposal; reviewer: boolean; onChange: () => void }) {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<ProposalStage>(p.stage);
  const [note, setNote] = useState('');
  const move = useMutation({
    mutationFn: () => api.moveProposal(p.id, { stage, note }),
    onSuccess: () => {
      setNote('');
      onChange();
    },
  });
  return (
    <li className="rounded-tile bg-card p-sm shadow-toy-soft">
      <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="toy-flat flex w-full items-center gap-sm text-left">
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-xs text-[16px] font-bold">
            {p.title}
            <StagePill stage={p.stage} />
          </span>
          <span className="block text-[14px] font-semibold text-ink-soft">
            {reviewer ? `${p.userName}, ` : ''}
            {p.budgetAmount > 0 ? `${p.currency} ${p.budgetAmount.toLocaleString()}, ` : ''}
            updated {new Date(p.updatedAt).toLocaleDateString()}
          </span>
        </span>
        <Icon icon={ChevronDown} size={20} strokeWidth={3} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="mt-sm">
          <p className="m-0 whitespace-pre-wrap text-[16px] font-semibold leading-relaxed">{p.pitch}</p>
          {p.log.length > 0 && (
            <ol className="mt-sm flex list-none flex-col gap-xs border-l-2 border-line p-0 pl-sm m-0">
              {p.log.map((l, i) => (
                <li key={`${l.createdAt}-${i}`} className="text-[14px] font-semibold text-ink-soft">
                  <span className="font-bold text-ink">{l.toStage ? STAGE_LABEL[l.toStage as ProposalStage] ?? l.toStage : ''}</span> by {l.actorName}, {new Date(l.createdAt).toLocaleDateString()}
                  {l.note ? `. ${l.note}` : ''}
                </li>
              ))}
            </ol>
          )}
          {reviewer && (
            <form
              className="mt-sm flex flex-col gap-sm rounded-tile bg-paper p-sm"
              onSubmit={(e) => {
                e.preventDefault();
                move.mutate();
              }}
            >
              <label className="block">
                <span className="block text-[12px] font-bold">Move to</span>
                <select value={stage} onChange={(e) => setStage(e.target.value as ProposalStage)} className={FIELD}>
                  {PROPOSAL_STAGES.map((s) => (
                    <option key={s} value={s}>
                      {STAGE_LABEL[s]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="block text-[12px] font-bold">Note to them</span>
                <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} className={FIELD} />
              </label>
              <ErrorLine e={move.isError ? move.error : null} />
              <Button type="submit" disabled={move.isPending || stage === p.stage}>
                Record decision
              </Button>
            </form>
          )}
        </div>
      )}
    </li>
  );
}

export function Proposals({ kind }: { kind: 'tv' | 'fund' }) {
  const copy = COPY[kind];
  const pg = usePage();
  const q = useAuthed(['proposals', kind, pg.query], () => api.proposals(kind, pg.query));
  const [writing, setWriting] = useState(false);
  const d = q.data;
  const mine = d?.proposals ?? [];

  return (
    <Screen>
      <header className="pt-lg">
        <BackLink to="/apps">Apps</BackLink>
        <h1 className="text-[30px]">{copy.title}</h1>
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">{copy.blurb}</p>
        <Button className="mt-md" onClick={() => setWriting(true)}>
          {copy.action}
        </Button>
      </header>

      {q.isError && (
        <div className="mt-md rounded-card bg-card p-md shadow-toy-soft" role="alert">
          <p className="m-0 font-bold">Could not load proposals.</p>
          <Button variant="outline" className="mt-sm" onClick={() => q.refetch()}>
            Try again
          </Button>
        </div>
      )}

      {d && (
        <section className="mt-lg" aria-labelledby="list-heading">
          <h2 id="list-heading" className="text-[24px]">
            {d.reviewer ? 'All proposals' : 'Yours'}
          </h2>
          {mine.length === 0 && <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">{d.reviewer ? 'Nothing submitted yet.' : `Nothing yet. ${copy.action.toLowerCase()} when you are ready.`}</p>}
          <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
            {mine.map((p) => (
              <ProposalCard key={p.id} p={p} reviewer={d.reviewer} onChange={() => q.refetch()} />
            ))}
          </ul>
          <Pager page={d.page} label="proposals" />
        </section>
      )}

      <ProposeSheet kind={kind} open={writing} onClose={() => setWriting(false)} onDone={() => q.refetch()} />
    </Screen>
  );
}

function ProposeSheet({ kind, open, onClose, onDone }: { kind: 'tv' | 'fund'; open: boolean; onClose: () => void; onDone: () => void }) {
  const copy = COPY[kind];
  const [title, setTitle] = useState('');
  const [pitch, setPitch] = useState('');
  const [budgetAmount, setBudget] = useState('');
  const [currency, setCurrency] = useState('INR');
  const propose = useMutation({
    mutationFn: () => api.propose({ kind, title, pitch, budgetAmount: Number(budgetAmount) || 0, currency }),
    onSuccess: () => {
      setTitle('');
      setPitch('');
      setBudget('');
      onDone();
      onClose();
    },
  });
  return (
    <Sheet open={open} onClose={onClose} title={copy.sheet}>
      <form
        className="flex flex-col gap-md"
        onSubmit={(e) => {
          e.preventDefault();
          if (title.trim() && pitch.trim()) propose.mutate();
        }}
      >
        <label className="block">
          <span className="block text-[14px] font-bold">Title</span>
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required className={FIELD} />
        </label>
        <label className="block">
          <span className="block text-[14px] font-bold">{copy.pitchLabel}</span>
          <textarea value={pitch} onChange={(e) => setPitch(e.target.value)} maxLength={8000} rows={8} required className={FIELD} />
        </label>
        <div className="grid grid-cols-2 gap-xs">
          <label className="block">
            <span className="block text-[14px] font-bold">{copy.budgetLabel}</span>
            <input type="number" min={0} value={budgetAmount} onChange={(e) => setBudget(e.target.value)} className={FIELD} />
          </label>
          <label className="block">
            <span className="block text-[14px] font-bold">Currency</span>
            <input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} className={FIELD} />
          </label>
        </div>
        <p className="m-0 text-[12px] font-bold text-ink-soft">Every stage change comes with a note from the person who made it. You will hear in your Inbox.</p>
        <ErrorLine e={propose.isError ? propose.error : null} />
        <Button type="submit" size="lg" full disabled={propose.isPending || !title.trim() || !pitch.trim()}>
          Submit
        </Button>
      </form>
    </Sheet>
  );
}
