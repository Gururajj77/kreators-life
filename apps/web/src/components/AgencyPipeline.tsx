import { AGENCY_CHANNELS, DELIVERABLE_KIND_NAME, DELIVERABLE_STAGES, DELIVERABLE_STAGE_META, DELIVERABLE_STAGE_TONE, pageQuery, type AgencyDeliverable, type BoardColumn, type DeliverableStage } from '@kreators/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../lib/api';
import { useAuthed } from '../lib/queries';
import { useParamState } from '../lib/useParamState';
import { tie } from '../lib/text';
import { shortDay } from '../lib/date';
import { Busy, Skeleton } from './Skeleton';
import { FILTER_SELECT } from './AgencyInvoices';
import { Button } from './Button';
import { DeliverableSheet } from './DeliverableSheet';
import { KanbanBoard } from './KanbanBoard';
import { Pager, usePage } from './Pager';
import { StatusTag } from './StatusTag';
import { useView, ViewToggle } from './ViewToggle';

const COPY = {
  noClients: 'Add a client first. A deliverable always belongs to one.',
  emptyList: 'No deliverables match this.',
  emptyAll: 'No deliverables yet. Add the first one.',
  boardFail: 'Could not load the board. Try again in a moment.',
} as const;

const select = FILTER_SELECT;
const ARMY_TONE: Record<string, 'neutral' | 'info' | 'good' | 'warn'> = { open: 'neutral', submitted: 'info', approved: 'good', changes: 'warn' };
const ARMY_NAME: Record<string, string> = { open: 'Army: open', submitted: 'Army: sent', approved: 'Army: approved', changes: 'Army: changes' };

const dayLine = (i: AgencyDeliverable) => (i.publishDate ? `Goes live ${shortDay(i.publishDate)}` : i.dueDate ? `Due ${shortDay(i.dueDate)}` : '');

/** What a deliverable shows on a card or a row: its name and the small facts under it. On the board (`compact`) that is one line. */
function Facts({ item, showClient, showStage, compact = false }: { item: AgencyDeliverable; showClient: boolean; showStage: boolean; compact?: boolean }) {
  const day = dayLine(item);
  if (compact)
    return (
      <>
        <span className="block text-[16px] font-extrabold leading-snug">{item.title}</span>
        {(item.overdue || (item.armyDeliverableId && item.army)) && (
          <span className="mt-xs flex flex-wrap items-center gap-xs">
            {item.overdue && <StatusTag tone="bad">Late</StatusTag>}
            {item.armyDeliverableId && item.army && <StatusTag tone={ARMY_TONE[item.army.status] ?? 'neutral'}>{ARMY_NAME[item.army.status] ?? 'Army'}</StatusTag>}
          </span>
        )}
        <span className="mt-xs block text-[12px] font-bold text-ink-soft">{tie([showClient ? item.clientName : DELIVERABLE_KIND_NAME[item.kind], day].filter(Boolean).join(', '))}</span>
      </>
    );
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

/** Placeholder rows while a list or a board loads. */
function Loading() {
  return (
    <Busy label="Loading deliverables" className="flex flex-col gap-xs">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-[64px] w-full" />
      ))}
    </Busy>
  );
}

/**
 * The deliverables pipeline for every client, or for one: filters, a list or a board, and the detail sheet.
 * On the Agency screen the header holds the one Add deliverable button, so it passes `adding` and `onAdding` and this draws no button of
 * its own; on a client's page it draws its own. `defaultView` is where it starts when the URL does not say (a phone always starts on the list).
 */
export function AgencyPipeline({ clientId, defaultView = 'board', adding, onAdding }: { clientId?: string; defaultView?: 'list' | 'board'; adding?: boolean; onAdding?: (open: boolean) => void }) {
  const qc = useQueryClient();
  const [view, setView] = useView('p', defaultView);
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
  // When the Agency header owns the Add deliverable button, its tap opens a blank sheet here.
  const outside = Boolean(onAdding && adding);
  const all = [...(boardQ.data?.columns.flatMap((c) => c.items) ?? []), ...(listQ.data?.items ?? [])];
  const current = outside ? null : selected ? (all.find((i) => i.id === selected.id) ?? selected) : null;
  const closeSheet = () => {
    setOpen(false);
    onAdding?.(false);
  };

  const columns = (boardQ.data?.columns ?? []).map((c) => ({ ...c, name: DELIVERABLE_STAGE_META[c.stage as DeliverableStage].name }));
  const counts = listQ.data?.counts;
  const total = counts ? Object.values(counts).reduce((a, n) => a + n, 0) : 0;
  const noClients = clientsQ.isSuccess && clients.length === 0;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-sm">
        <ViewToggle view={view} onChange={setView} label="Deliverables view" />
        {!onAdding && (
          <Button size="sm" plusToX disabled={noClients} onClick={() => openItem(null)}>
            Add deliverable
          </Button>
        )}
      </div>
      {noClients && <p className="mt-xs m-0 text-[14px] font-bold">{COPY.noClients}</p>}
      <div className="fill-row mt-sm flex flex-wrap gap-xs">
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
        {view === 'list' && (
          <select
            aria-label="Stage"
            value={stage}
            onChange={(e) => {
              setStageRaw(e.target.value);
              pg.reset();
            }}
            className={select}
          >
            <option value="">Stage: All{counts ? ` (${total})` : ''}</option>
            {DELIVERABLE_STAGES.map((s) => (
              <option key={s} value={s}>
                Stage: {DELIVERABLE_STAGE_META[s].name}
                {counts ? ` (${counts[s]})` : ''}
              </option>
            ))}
          </select>
        )}
      </div>

      {view === 'board' ? (
        <div className="mt-sm">
          {boardQ.isError && (
            <p role="alert" className="m-0 text-[14px] font-bold">
              {COPY.boardFail}
            </p>
          )}
          {boardQ.isPending && <Loading />}
          {boardQ.data && (
            <KanbanBoard
              columns={columns}
              empty="Nothing here"
              itemLabel={(item) => item.title}
              onMove={(item, from, to) => {
                if (from !== to) move.mutate({ item, to: to as DeliverableStage });
              }}
              onMore={() => setPer((p) => p + 25)}
              card={(item) => (
                <button type="button" onClick={() => openItem(item)} className="block w-full text-left">
                  <Facts item={item} showClient={!clientId} showStage={false} compact />
                </button>
              )}
            />
          )}
        </div>
      ) : (
        <div className="mt-sm">
          {listQ.isPending && <Loading />}
          {listQ.isError && (
            <p role="alert" className="m-0 text-[14px] font-bold">
              {COPY.boardFail}
            </p>
          )}
          <ul className="flex list-none flex-col gap-xs p-0 m-0">
            {listQ.data?.items.map((item) => (
              <li key={item.id}>
                <button type="button" onClick={() => openItem(item)} className="toy toy-soft block w-full rounded-tile bg-card p-sm text-left">
                  <Facts item={item} showClient={!clientId} showStage />
                </button>
              </li>
            ))}
          </ul>
          {listQ.data && listQ.data.items.length === 0 && <p className="m-0 rounded-tile bg-card p-sm text-[14px] font-semibold text-ink-soft">{total === 0 ? COPY.emptyAll : COPY.emptyList}</p>}
          <Pager page={listQ.data?.page} prefix="p" label="deliverables" />
        </div>
      )}

      {move.isError && (
        <p role="alert" className="mt-sm m-0 text-[14px] font-bold">
          That move did not save, so the card went back.
        </p>
      )}
      <DeliverableSheet open={open || outside} item={current} clientId={clientId ?? (clientRaw || undefined)} clients={clients} onClose={closeSheet} />
    </div>
  );
}
