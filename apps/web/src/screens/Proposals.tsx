import { PROPOSAL_STAGES, type Proposal, type ProposalStage, money, typedCents } from '@kreators/shared';
import { longDate } from '../lib/date';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '../components/Button';
import { AppCover } from '../components/AppCover';
import { Screen } from '../components/Screen';
import { Sheet } from '../components/Sheet';
import { api } from '../lib/api';
import { useAuthed, useMe } from '../lib/queries';
import { Pager, usePage } from '../components/Pager';
import { Pencil, Undo2 } from 'lucide-react';
import { MoreMenu } from '../components/MoreMenu';
import type { CSSProperties } from 'react';
import { FIELD } from '../lib/ui';
import { ErrorLine } from '../components/ErrorLine';
import { ToggleChevron } from '../components/ToggleMark';

/** A budget as typed ("1,50,000", "₹ 2500.50"), read from its digits with `typedCents` and kept in whole units the way the column stores it; anything unreadable is 0. */
const budgetUnits = (typed: string): number => {
  const cents = typedCents(typed);
  return Number.isFinite(cents) && cents > 0 ? Math.round(cents / 100) : 0;
};

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
    <span className="rounded-pill px-xs text-caption font-medium leading-[20px]" style={{ background: STAGE_TINT[stage] }}>
      {STAGE_LABEL[stage]}
    </span>
  );
}

function ProposalCard({ p, reviewer, mine, onChange, onEdit, onWithdraw }: { p: Proposal; reviewer: boolean; mine: boolean; onChange: () => void; onEdit: (p: Proposal) => void; onWithdraw: (p: Proposal) => void }) {
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
      {/* The title at the top left and the stage in the same top right place on every pitch, never wrapping under a long title. */}
      <div className="flex items-start gap-xs">
      <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="toy-flat flex min-h-[44px] min-w-0 flex-1 items-start gap-sm text-left">
        <span className="min-w-0 flex-1">
          <span className="block text-balance text-card-title">{p.title}</span>
          {/* Each part kept whole, so a narrow card breaks at a comma and never leaves "2026" short under it. */}
          <span className="block text-card-note text-ink-soft">
            {reviewer && <span className="inline-block">{p.userName},</span>}{reviewer && ' '}
            {p.budgetAmount > 0 && <span className="inline-block">{money(Math.round(p.budgetAmount * 100), p.currency)},</span>}{p.budgetAmount > 0 && ' '}
            <span className="inline-block">updated {longDate(p.updatedAt)}</span>
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-xs">
          <StagePill stage={p.stage} />
          <ToggleChevron open={open} size={20} strokeWidth={3} />
        </span>
      </button>
      {mine && p.stage === 'submitted' && (
        <MoreMenu
          label={`More for ${p.title}`}
          title={p.title}
          items={[
            { key: 'edit', label: 'Edit', icon: Pencil, onSelect: () => onEdit(p) },
            { key: 'withdraw', label: 'Withdraw', icon: Undo2, destructive: true, onSelect: () => onWithdraw(p) },
          ]}
        />
      )}
      </div>
      {open && (
        <div className="mt-sm">
          <p className="m-0 whitespace-pre-wrap text-prose">{p.pitch}</p>
          {p.log.length > 0 && (
            <ol className="mt-sm flex list-none flex-col gap-xs border-l-2 border-line p-0 pl-sm m-0">
              {p.log.map((l, i) => (
                <li key={`${l.createdAt}-${i}`} className="text-subhead text-ink-soft">
                  <span className="font-semibold text-ink">{l.toStage ? STAGE_LABEL[l.toStage as ProposalStage] ?? l.toStage : ''}</span> by {l.actorName}, {longDate(l.createdAt)}
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
                <span className="block text-caption">Move to</span>
                <select value={stage} onChange={(e) => setStage(e.target.value as ProposalStage)} className={FIELD}>
                  {PROPOSAL_STAGES.map((s) => (
                    <option key={s} value={s}>
                      {STAGE_LABEL[s]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="block text-caption">Note to them</span>
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
  const me = useMe();
  const myId = me.data?.user.id ?? '';
  const [writing, setWriting] = useState(false);
  // Item-driven sheets: the pitch being edited or withdrawn, or none.
  const [editing, setEditing] = useState<Proposal | null>(null);
  const [withdrawing, setWithdrawing] = useState<Proposal | null>(null);
  const d = q.data;
  const mine = d?.proposals ?? [];

  return (
    <Screen>
      <AppCover
        back={{ to: '/apps', label: 'Apps' }}
        title={copy.title}
        lede={copy.blurb}
        actions={
          /* A reviewer's one solid button is Record decision on the card they open, so the pitch button is an outline for them. */
          <Button variant={d?.reviewer ? 'outline' : undefined} onClick={() => setWriting(true)}>
            {copy.action}
          </Button>
        }
      />

      {q.isError && (
        <div className="mt-md rounded-card bg-card p-md shadow-toy-soft flex flex-wrap-reverse items-center justify-between gap-sm" role="alert">
          <p className="m-0 font-semibold min-w-0 flex-1 basis-[60%]">Could not load proposals.</p>
          <Button variant="outline" onClick={() => q.refetch()}>
            Try again
          </Button>
        </div>
      )}

      {d && (
        <section className="mt-lg" aria-labelledby="list-heading">
          <h2 id="list-heading" className="text-title2">
            {d.reviewer ? 'All proposals' : 'Yours'}
          </h2>
          {mine.length === 0 && <p className="mt-xs m-0 text-subhead text-ink-soft">{d.reviewer ? 'Nothing submitted yet.' : `Nothing yet. ${copy.action.toLowerCase()} when you are ready.`}</p>}
          <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
            {mine.map((p) => (
              <ProposalCard key={p.id} p={p} reviewer={d.reviewer} mine={p.userId === myId} onChange={() => q.refetch()} onEdit={setEditing} onWithdraw={setWithdrawing} />
            ))}
          </ul>
          <Pager page={d.page} label="proposals" />
        </section>
      )}

      <ProposeSheet kind={kind} open={writing} onClose={() => setWriting(false)} onDone={() => q.refetch()} />
      {editing && <EditSheet key={editing.id} p={editing} onClose={() => setEditing(null)} onDone={() => q.refetch()} />}
      <WithdrawSheet p={withdrawing} onClose={() => setWithdrawing(null)} onDone={() => q.refetch()} />
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
    mutationFn: () => api.propose({ kind, title, pitch, budgetAmount: budgetUnits(budgetAmount), currency }),
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
          <span className="block text-subhead font-semibold">Title</span>
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required className={FIELD} />
        </label>
        <label className="block">
          <span className="block text-subhead">{copy.pitchLabel}</span>
          <textarea value={pitch} onChange={(e) => setPitch(e.target.value)} maxLength={8000} rows={8} required className={FIELD} />
        </label>
        <div className="grid grid-cols-2 gap-xs">
          <label className="block">
            <span className="block text-subhead">{copy.budgetLabel}</span>
            <input inputMode="decimal" value={budgetAmount} onChange={(e) => setBudget(e.target.value)} maxLength={20} className={FIELD} />
          </label>
          <label className="block">
            <span className="block text-subhead font-semibold">Currency</span>
            <input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} className={FIELD} />
          </label>
        </div>
        <p className="m-0 text-caption text-ink-soft">Every stage change comes with a note from the person who made it. You will hear in your Inbox.</p>
        <ErrorLine e={propose.isError ? propose.error : null} />
        <Button type="submit" size="lg" full disabled={propose.isPending || !title.trim() || !pitch.trim()}>
          Submit
        </Button>
      </form>
    </Sheet>
  );
}

/** Changes the author's own pitch while it is still Submitted. Mounted per pitch (keyed), so the fields start from it once. */
function EditSheet({ p, onClose, onDone }: { p: Proposal; onClose: () => void; onDone: () => void }) {
  const copy = COPY[p.kind];
  const [title, setTitle] = useState(p.title);
  const [pitch, setPitch] = useState(p.pitch);
  const [budgetAmount, setBudget] = useState(p.budgetAmount > 0 ? String(p.budgetAmount) : '');
  const save = useMutation({
    mutationFn: () => api.editProposal(p.id, { title, pitch, budgetAmount: budgetUnits(budgetAmount) }),
    onSuccess: () => {
      onDone();
      onClose();
    },
  });
  return (
    <Sheet open onClose={onClose} title={`Edit ${copy.sheet.toLowerCase()}`}>
      <form
        className="flex flex-col gap-md"
        onSubmit={(e) => {
          e.preventDefault();
          if (title.trim() && pitch.trim()) save.mutate();
        }}
      >
        <label className="block">
          <span className="block text-subhead font-semibold">Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required className={FIELD} />
        </label>
        <label className="block">
          <span className="block text-subhead">{copy.pitchLabel}</span>
          <textarea value={pitch} onChange={(e) => setPitch(e.target.value)} maxLength={8000} rows={8} required className={FIELD} />
        </label>
        <label className="block">
          <span className="block text-subhead font-semibold">
            {copy.budgetLabel} ({p.currency})
          </span>
          <input inputMode="decimal" value={budgetAmount} onChange={(e) => setBudget(e.target.value)} maxLength={20} className={FIELD} />
        </label>
        <p className="m-0 text-caption text-ink-soft">You can change it until the team starts reading it.</p>
        <ErrorLine e={save.isError ? save.error : null} />
        <Button type="submit" size="lg" full disabled={save.isPending || !title.trim() || !pitch.trim()}>
          {save.isPending ? 'Saving' : 'Save changes'}
        </Button>
      </form>
    </Sheet>
  );
}

/** Asks once more before the author takes back a pitch that is still Submitted. */
function WithdrawSheet({ p, onClose, onDone }: { p: Proposal | null; onClose: () => void; onDone: () => void }) {
  const withdraw = useMutation({
    mutationFn: (id: string) => api.withdrawProposal(id),
    onSuccess: () => {
      onDone();
      close();
    },
  });
  // A refusal shown for one pitch must not greet the next one opened.
  const close = () => {
    withdraw.reset();
    onClose();
  };
  return (
    <Sheet open={p !== null} onClose={close} title="Withdraw it?">
      {p && (
        <div className="flex flex-col gap-sm">
          <p className="m-0 text-callout">
            &ldquo;{p.title}&rdquo; goes away for good. The team will not see it.
          </p>
          <ErrorLine e={withdraw.isError ? withdraw.error : null} />
          <button
            type="button"
            onClick={() => withdraw.mutate(p.id)}
            disabled={withdraw.isPending}
            className="toy inline-flex min-h-[56px] items-center justify-center gap-xs rounded-pill bg-r1 px-md text-headline text-on-fill disabled:opacity-50"
            style={{ '--toy-color': 'var(--deep-servant_leader)' } as CSSProperties}
          >
            {withdraw.isPending ? 'Withdrawing' : 'Yes, withdraw it'}
          </button>
          <Button variant="outline" size="lg" onClick={close} disabled={withdraw.isPending}>
            Keep it
          </Button>
        </div>
      )}
    </Sheet>
  );
}
