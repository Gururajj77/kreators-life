import { AGENCY_CHANNELS, DELIVERABLE_KIND_NAME, DELIVERABLE_STAGES, DELIVERABLE_STAGE_META, DELIVERABLE_STAGE_TONE, pageQuery, type AgencyDeliverable, type BoardColumn, type DeliverableStage } from '@kreators/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../lib/api';
import { useAuthed } from '../lib/queries';
import { useParamState } from '../lib/useParamState';
import { tie } from '../lib/text';
import { Button } from './Button';
import { DeliverableSheet } from './DeliverableSheet';
import { KanbanBoard } from './KanbanBoard';
import { Pager, usePage } from './Pager';
import { StatusTag } from './StatusTag';
import { useView, ViewToggle } from './ViewToggle';

const COPY = {
  lede: 'Every deliverable moves from idea to published. Drag a card, or use "Move to".',
  noClients: 'Add a client first. A deliverable always belongs to one.',
  emptyList: 'No deliverables match this.',
  emptyAll: 'No deliverables yet. Add the first one.',
  boardFail: 'Could not load the board. Try again in a moment.',
} as const;

const select = 'min-h-[44px] rounded-pill border-2 border-line bg-card px-sm text-[14px] font-bold text-ink';
const ARMY_TONE: Record<string, 'neutral' | 'info' | 'good' | 'warn'> = { open: 'neutral', submitted: 'info', approved: 'good', changes: 'warn' };
const ARMY_NAME: Record<string, string> = { open: 'Army: open', submitted: 'Army: sent', approved: 'Army: approved', changes: 'Army: changes' };

const shortDay = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const dayLine = (i: AgencyDeliverable) => (i.publishDate ? `Goes live ${shortDay(i.publishDate)}` : i.dueDate ? `Due ${shortDay(i.dueDate)}` : '');

/** What a deliverable shows on a card or a row: its name and the small facts under it. */
function Facts({ item, showClient, showStage }: { item: AgencyDeliverable; showClient: boolean; showStage: boolean }) {
  const day = dayLine(item);
  return (
    <>
      <span className="block text-[16px] font-extrabold leading-snug">{item.title}</span>
      <span className="mt-xs flex flex-wrap items-center gap-xs">
        {showStage && <StatusTag tone={DELIVERABLE_STAGE_TONE[item.stage]}>{DELIVERABLE_STAGE_META[item.stage].name}</StatusTag>}
        {item.overdue && <StatusTag tone="bad">Late</StatusTag>}
        {item.armyDeliverableId && item.army && <StatusTag tone={ARMY_TONE[item.army.status] ?? 'neutral'}>{ARMY_NAME[item.army.status] ?? 'Army'}</StatusTag>}
      </span>
      <span className="mt-xs block text-[12px] font-bold text-ink-soft">
        {tie(
          `${DELIVERABLE_KIND_NAME[item.kind]}${item.platform && item.platform.toLowerCase() !== DELIVERABLE_KIND_NAME[item.kind].toLowerCase() ? `, ${item.platform}` : ''}${showClient ? `, ${item.clientName}` : ''}`,
        )}
      </span>
      {(day || item.revisions > 0 || item.noteCount > 0) && (
        <span className="mt-xs block text-[12px] font-semibold text-ink-soft">
          {tie([day, item.revisions > 0 ? `Sent back ${item.revisions} ${item.revisions === 1 ? 'time' : 'times'}` : '', item.noteCount > 0 ? `${item.noteCount} ${item.noteCount === 1 ? 'note' : 'notes'}` : ''].filter(Boolean).join(', '))}
        </span>
      )}
    </>
  );
}

/** The deliverables pipeline for every client, or for one: filters, a list or a board, and the detail sheet. */
export function AgencyPipeline({ clientId }: { clientId?: string }) {
  const qc = useQueryClient();
  const [view, setView] = useView('p', 'board');
  const [clientRaw, setClientRaw] = useParamState('pclient', '');
  const [channel, setChannel] = useParamState('pchannel', '');
  const [stageRaw, setStageRaw] = useParamState('pstage', '');
  const stage = (DELIVERABLE_STAGES as readonly string[]).includes(stageRaw) ? (stageRaw as DeliverableStage) : '';
  const client = clientId ?? clientRaw;
  const pg = usePage('p');
  const [per, setPer] = useState(25);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<AgencyDeliverable | null>(null);

  const clientsQ = useAuthed(['agency', 'clients-all'], () => api.agency('csize=100'));
  const clients = clientsQ.data?.clients ?? [];
  const channels = Array.from(new Set([...clients.flatMap((c) => (client && c.id !== client ? [] : c.channels)), ...AGENCY_CHANNELS]));

  const filterQuery = [client ? `client=${client}` : '', channel ? `channel=${encodeURIComponent(channel)}` : ''].filter(Boolean).join('&');
  const boardQ = useAuthed(['agency', 'board', client, channel, per], () => api.agencyBoard([filterQuery, `per=${per}`].filter(Boolean).join('&')), view === 'board');
  const listQ = useAuthed(['agency', 'items', client, channel, stage, pg.page, pg.size], () => api.agencyItems([pageQuery(pg.page, pg.size), filterQuery, stage ? `stage=${stage}` : ''].filter(Boolean).join('&')), view === 'list');

  const move = useMutation({
    mutationFn: (v: { item: AgencyDeliverable; to: DeliverableStage }) => api.agencyItemUpdate(v.item.id, { title: v.item.title, stage: v.to }),
    // The card jumps at once; if the server says no it jumps back.
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: ['agency', 'board'] });
      const before = qc.getQueriesData<{ columns: BoardColumn<AgencyDeliverable>[] }>({ queryKey: ['agency', 'board'] });
      for (const [key, data] of before) {
        if (!data) continue;
        qc.setQueryData(key, {
          columns: data.columns.map((c) => {
            if (c.stage === v.item.stage) return { ...c, total: Math.max(0, c.total - 1), items: c.items.filter((i) => i.id !== v.item.id) };
            if (c.stage === v.to) return { ...c, total: c.total + 1, items: [{ ...v.item, stage: v.to }, ...c.items] };
            return c;
          }),
        });
      }
      return { before };
    },
    onError: (_e, _v, ctx) => {
      for (const [key, data] of ctx?.before ?? []) qc.setQueryData(key, data);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['agency'] }),
  });

  const openItem = (item: AgencyDeliverable | null) => {
    setSelected(item);
    setOpen(true);
  };
  const all = [...(boardQ.data?.columns.flatMap((c) => c.items) ?? []), ...(listQ.data?.items ?? [])];
  const current = selected ? (all.find((i) => i.id === selected.id) ?? selected) : null;

  const columns = (boardQ.data?.columns ?? []).map((c) => ({ ...c, name: DELIVERABLE_STAGE_META[c.stage as DeliverableStage].name, blurb: DELIVERABLE_STAGE_META[c.stage as DeliverableStage].blurb }));
  const counts = listQ.data?.counts;
  const total = counts ? Object.values(counts).reduce((a, n) => a + n, 0) : 0;
  const noClients = clientsQ.isSuccess && clients.length === 0;

  return (
    <div>
      <p className="m-0 text-[14px] font-semibold text-ink-soft">{COPY.lede}</p>
      <div className="mt-sm flex flex-wrap items-center justify-between gap-sm">
        <ViewToggle view={view} onChange={setView} label="Deliverables view" />
        <Button size="sm" disabled={noClients} onClick={() => openItem(null)}>
          Add deliverable
        </Button>
      </div>
      {noClients && <p className="mt-xs m-0 text-[14px] font-bold">{COPY.noClients}</p>}
      <div className="mt-sm flex flex-wrap gap-xs">
        {!clientId && (
          <select
            aria-label="Client"
            value={clientRaw}
            onChange={(e) => {
              setClientRaw(e.target.value);
              pg.reset();
            }}
            className={select}
          >
            <option value="">All clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
        <select
          aria-label="Channel"
          value={channel}
          onChange={(e) => {
            setChannel(e.target.value);
            pg.reset();
          }}
          className={select}
        >
          <option value="">All channels</option>
          {channels.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {view === 'board' ? (
        <div className="mt-sm">
          {boardQ.isError && (
            <p role="alert" className="m-0 text-[14px] font-bold">
              {COPY.boardFail}
            </p>
          )}
          {boardQ.isPending && <p className="m-0 text-[14px] font-semibold text-ink-soft">Loading…</p>}
          {boardQ.data && (
            <KanbanBoard
              columns={columns}
              empty="Nothing here"
              onMove={(item, from, to) => {
                if (from !== to) move.mutate({ item, to: to as DeliverableStage });
              }}
              onMore={() => setPer((p) => p + 25)}
              card={(item) => (
                <button type="button" onClick={() => openItem(item)} className="block w-full text-left">
                  <Facts item={item} showClient={!clientId} showStage={false} />
                </button>
              )}
            />
          )}
        </div>
      ) : (
        <div className="mt-sm">
          <div role="group" aria-label="Stage" className="scroll-row flex gap-xs">
            <button
              type="button"
              aria-pressed={stage === ''}
              onClick={() => {
                setStageRaw('');
                pg.reset();
              }}
              className={`toy min-h-[44px] shrink-0 rounded-pill border-2 px-md text-[14px] font-bold ${stage === '' ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}
            >
              All{counts ? ` ${total}` : ''}
            </button>
            {DELIVERABLE_STAGES.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={stage === s}
                onClick={() => {
                  setStageRaw(s);
                  pg.reset();
                }}
                className={`toy min-h-[44px] shrink-0 rounded-pill border-2 px-md text-[14px] font-bold ${stage === s ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}
              >
                {DELIVERABLE_STAGE_META[s].name}
                {counts ? ` ${counts[s]}` : ''}
              </button>
            ))}
          </div>
          {listQ.isPending && <p className="mt-sm m-0 text-[14px] font-semibold text-ink-soft">Loading…</p>}
          {listQ.isError && (
            <p role="alert" className="mt-sm m-0 text-[14px] font-bold">
              {COPY.boardFail}
            </p>
          )}
          <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
            {listQ.data?.items.map((item) => (
              <li key={item.id}>
                <button type="button" onClick={() => openItem(item)} className="toy toy-soft block w-full rounded-tile bg-card p-sm text-left">
                  <Facts item={item} showClient={!clientId} showStage />
                </button>
              </li>
            ))}
          </ul>
          {listQ.data && listQ.data.items.length === 0 && <p className="mt-sm m-0 rounded-tile bg-card p-sm text-[14px] font-semibold text-ink-soft">{total === 0 ? COPY.emptyAll : COPY.emptyList}</p>}
          <Pager page={listQ.data?.page} prefix="p" label="deliverables" />
        </div>
      )}

      {move.isError && (
        <p role="alert" className="mt-sm m-0 text-[14px] font-bold">
          That move did not save, so the card went back.
        </p>
      )}
      <DeliverableSheet open={open} item={current} clientId={clientId ?? (clientRaw || undefined)} clients={clients} onClose={() => setOpen(false)} />
    </div>
  );
}
