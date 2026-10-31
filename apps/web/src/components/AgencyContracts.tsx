import { CONTRACT_STATUSES, CONTRACT_STATUS_NAME, CONTRACT_STATUS_TONE, CONTRACT_TEMPLATES, type BoardColumn, type ContractListItem, type ContractStatus } from '@kreators/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { api, ApiError } from '../lib/api';
import { useAuthed } from '../lib/queries';
import { useParamState } from '../lib/useParamState';
import { tie } from '../lib/text';
import { Button } from './Button';
import { KanbanBoard } from './KanbanBoard';
import { Pager, usePage } from './Pager';
import { Sheet } from './Sheet';
import { StatusTag } from './StatusTag';
import { useView, ViewToggle } from './ViewToggle';

const BLURB: Record<ContractStatus, string> = {
  draft: 'Being written.',
  sent: 'Waiting for the client.',
  signed: 'Accepted. A record.',
  void: 'Put away.',
};
const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const TEMPLATE_NAME: Record<string, string> = Object.fromEntries(CONTRACT_TEMPLATES.map((t) => [t.key, t.name]));
const field = 'mt-xs w-full min-h-[48px] rounded-pill border-2 border-line bg-paper px-sm text-[16px]';

/** Where an agreement can go from a board: draft and sent move between themselves and to void. A signed one is a record; only the client signs. */
function canMove(from: string, to: string): boolean {
  if (from === 'signed' || from === 'void') return false;
  return to === 'draft' || to === 'sent' || to === 'void';
}

/** The agreements pipeline: a list or a board, for every client or for one. */
export function AgencyContracts({ clientId }: { clientId?: string }) {
  const qc = useQueryClient();
  const nav = useNavigate();
  const [view, setView] = useView('ag', 'board');
  const [per, setPer] = useState(25);
  const [status, setStatus] = useParamState('agstatus', 'all');
  const pg = usePage('ag');
  const [adding, setAdding] = useState(false);
  const [template, setTemplate] = useState<string>(CONTRACT_TEMPLATES[0]?.key ?? 'trial');
  const [pickClient, setPickClient] = useState('');
  const [note, setNote] = useState('');

  const clientQ = clientId ? `&client=${clientId}` : '';
  const board = useAuthed(['agency', 'contracts', 'board', clientId ?? '', per], () => api.agencyContractBoard(`per=${per}${clientQ}`), view === 'board');
  const listQuery = `page=${pg.page}&size=${pg.size}${status !== 'all' ? `&status=${status}` : ''}${clientQ}`;
  const list = useAuthed(['agency', 'contracts', 'list', clientId ?? '', status, pg.page, pg.size], () => api.agencyContracts(listQuery), view === 'list');
  const clients = useAuthed(['agency', 'clients-pick'], () => api.agency('csize=100'), adding && !clientId);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['agency'] });
  const move = useMutation({
    mutationFn: ({ id, to }: { id: string; to: string }) => api.agencyContractUpdate(id, { status: to as 'draft' | 'sent' | 'void' }),
    onSuccess: () => {
      setNote('');
      void invalidate();
    },
    onError: (e) => setNote(e instanceof ApiError ? e.message : 'That did not move. Try again.'),
  });
  const create = useMutation({
    mutationFn: () => api.agencyContractAdd({ templateKey: template, clientId: clientId ?? (pickClient || null) }),
    onSuccess: (r) => {
      void invalidate();
      setAdding(false);
      nav(`/agency/contracts/${r.id}`);
    },
  });

  const onMove = (item: ContractListItem, from: string, to: string) => {
    if (from === 'signed') return setNote('A signed agreement is a record. Open it and make a revised copy instead.');
    if (to === 'signed') return setNote('Only the client can sign, with the link you send.');
    if (from === 'void') return setNote('A voided agreement stays put. Make a copy to use it again.');
    if (!canMove(from, to)) return;
    move.mutate({ id: item.id, to });
  };

  const columns = (board.data?.columns ?? ([] as BoardColumn<ContractListItem>[])).map((c) => ({ ...c, name: CONTRACT_STATUS_NAME[c.stage as ContractStatus] ?? c.stage, blurb: BLURB[c.stage as ContractStatus] }));
  const counts = new Map((list.data?.counts ?? []).map((c) => [c.status, c.n]));
  const total = [...counts.values()].reduce((a, b) => a + b, 0);

  return (
    <section aria-labelledby="agreements-heading">
      <div className="flex flex-wrap items-center justify-between gap-sm">
        {clientId ? <span /> : (
          <h2 id="agreements-heading" className="text-[24px]">
            Agreements
          </h2>
        )}
        <div className="flex flex-wrap items-center gap-xs">
          <ViewToggle view={view} onChange={setView} label="How to see agreements" />
          <Button size="sm" onClick={() => setAdding(true)}>
            New agreement
          </Button>
        </div>
      </div>
      {!clientId && (
  <p className="mt-xs m-0 text-balance text-[14px] font-semibold text-ink-soft">Start from a template, fill in the blanks, send the client a link. They read it, answer the brief and accept by typing their name.</p>
      )}

      {note && (
        <p role="status" className="mt-sm m-0 rounded-tile p-sm text-[14px] font-bold" style={{ background: 'var(--tint-yellow)' }}>
          {note}
        </p>
      )}

      {view === 'board' ? (
        <div className="mt-sm">
          {board.isPending && <p className="m-0 text-[14px] font-semibold text-ink-soft">Loading…</p>}
          {board.isError && (
            <p role="alert" className="m-0 text-[14px] font-bold">
              Could not load the board. Try again in a moment.
            </p>
          )}
          {board.data && (
            <KanbanBoard<ContractListItem>
              columns={columns}
              onMove={onMove}
              canMoveTo={(_item, from, to) => canMove(from, to)}
              onMore={() => setPer((n) => n + 25)}
              empty="None yet"
              card={(c) => <Card c={c} />}
            />
          )}
        </div>
      ) : (
        <div className="mt-sm">
          <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-xs">
            {(['all', ...CONTRACT_STATUSES] as const).map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={status === s}
                onClick={() => {
                  setStatus(s);
                  pg.reset();
                }}
                className={`toy min-h-[44px] rounded-pill border-2 px-md text-[14px] font-bold ${status === s ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}
              >
                {s === 'all' ? `All ${total}` : `${CONTRACT_STATUS_NAME[s]} ${counts.get(s) ?? 0}`}
              </button>
            ))}
          </div>
          {list.isPending && <p className="mt-sm m-0 text-[14px] font-semibold text-ink-soft">Loading…</p>}
          {list.data && list.data.contracts.length === 0 && <p className="mt-sm m-0 rounded-tile bg-card p-sm text-[14px] font-semibold text-ink-soft shadow-toy-soft">No agreements here yet. Start one from a template.</p>}
          <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
            {list.data?.contracts.map((c) => (
              <li key={c.id}>
                <Link to={`/agency/contracts/${c.id}`} className="toy toy-soft flex flex-wrap items-center justify-between gap-sm rounded-tile bg-card p-sm">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[16px] font-extrabold">{tie(c.title)}</span>
                    <span className="block text-[14px] font-semibold text-ink-soft">
                      {[c.clientName || 'No client yet', TEMPLATE_NAME[c.templateKey] ?? 'Your own', c.signedAt ? `Signed ${day(c.signedAt)}` : c.sentAt ? `Sent ${day(c.sentAt)}` : `Changed ${day(c.updatedAt)}`].join(' · ')}
                    </span>
                  </span>
                  <StatusTag tone={CONTRACT_STATUS_TONE[c.status]}>{CONTRACT_STATUS_NAME[c.status]}</StatusTag>
                </Link>
              </li>
            ))}
          </ul>
          <Pager page={list.data?.page} prefix="ag" label="agreements" />
        </div>
      )}

      <Sheet open={adding} onClose={() => setAdding(false)} title="New agreement">
        <p className="m-0 text-[14px] font-semibold text-ink-soft">Pick a template. Your details and the client's fill in for you, and every part can be changed.</p>
        <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0" role="radiogroup" aria-label="Template">
          {CONTRACT_TEMPLATES.map((t) => (
            <li key={t.key}>
              <button
                type="button"
                role="radio"
                aria-checked={template === t.key}
                onClick={() => setTemplate(t.key)}
                className={`toy w-full rounded-tile border-2 p-sm text-left ${template === t.key ? 'border-ink bg-card-strong' : 'toy-soft border-line bg-card'}`}
              >
                <span className="block text-[16px] font-extrabold">{t.name}</span>
                <span className="block text-[14px] font-semibold text-ink-soft">{t.blurb}</span>
              </button>
            </li>
          ))}
        </ul>
        {!clientId && (
          <label className="mt-sm block text-[14px] font-bold" htmlFor="new-agreement-client">
            For which client
            <select id="new-agreement-client" value={pickClient} onChange={(e) => setPickClient(e.target.value)} className={field}>
              <option value="">No client yet</option>
              {clients.data?.clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {create.isError && (
          <p role="alert" className="mt-sm m-0 text-[14px] font-bold">
            {create.error instanceof ApiError ? create.error.message : 'That did not work. Try again.'}
          </p>
        )}
        <div className="mt-md flex flex-wrap gap-xs">
          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            {create.isPending ? 'Making it' : 'Start this agreement'}
          </Button>
          <Button variant="outline" onClick={() => setAdding(false)}>
            Cancel
          </Button>
        </div>
      </Sheet>
    </section>
  );
}

function Card({ c }: { c: ContractListItem }) {
  return (
    <div>
      <Link to={`/agency/contracts/${c.id}`} className="block text-[16px] font-extrabold underline-offset-4 hover:underline">
        {tie(c.title)}
      </Link>
      <p className="mt-xs m-0 text-[12px] font-bold text-ink-soft">{c.clientName || 'No client yet'}</p>
      <p className="mt-xs m-0 text-[12px] font-semibold text-ink-mute">{TEMPLATE_NAME[c.templateKey] ?? 'Your own'}</p>
      <div className="mt-xs flex flex-wrap items-center gap-xs">
        <StatusTag tone={CONTRACT_STATUS_TONE[c.status]}>{CONTRACT_STATUS_NAME[c.status]}</StatusTag>
        <span className="text-[12px] font-semibold text-ink-soft">{c.signedAt ? `Signed ${day(c.signedAt)}` : c.sentAt ? `Sent ${day(c.sentAt)}` : day(c.updatedAt)}</span>
      </div>
    </div>
  );
}
