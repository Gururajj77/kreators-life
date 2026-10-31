import {
  AGENCY_CLIENT_STATUSES,
  AGENCY_HEALTH_NAME,
  AGENCY_STATUS_NAME,
  CLIENT_HEALTH_TONE,
  CLIENT_STATUS_TONE,
  DELIVERABLE_STAGE_META,
  DELIVERABLE_STAGE_TONE,
  minutesLabel2,
  money,
  pageQuery,
  utilisationPct,
  type AgencyClient,
  type AgencyClientStatus,
  type AgencyDeliverable,
  type AgencyOverview,
} from '@kreators/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { AgencyContracts } from '../components/AgencyContracts';
import { AgencyInvoices } from '../components/AgencyInvoices';
import { AgencyPipeline } from '../components/AgencyPipeline';
import { AgencySettings } from '../components/AgencySettings';
import { Button } from '../components/Button';
import { StatTile } from '../components/Charts';
import { ClientSheet } from '../components/ClientSheet';
import { DeliverableSheet } from '../components/DeliverableSheet';
import { KanbanBoard } from '../components/KanbanBoard';
import { Pager, usePage } from '../components/Pager';
import { PageHeader } from '../components/PageHeader';
import { Screen } from '../components/Screen';
import { Section } from '../components/Section';
import { StatusTag } from '../components/StatusTag';
import { useView, ViewToggle } from '../components/ViewToggle';
import { api } from '../lib/api';
import { bento } from '../lib/bento';
import { prettyDate } from '../lib/date';
import { useAuthed } from '../lib/queries';
import { useParamState } from '../lib/useParamState';

const TABS = [
  ['overview', 'Overview'],
  ['pipeline', 'Pipeline'],
  ['clients', 'Clients'],
  ['invoices', 'Invoices'],
  ['agreements', 'Agreements'],
  ['settings', 'Settings'],
] as const;
type TabKey = (typeof TABS)[number][0];

const COPY = {
  lede: 'Your clients, the content you make for them, the time it takes, and what they owe. For a content agency or a freelance creator.',
  empty: 'Add your first client. Then add the deliverables you make for them and move each one from idea to published.',
  emptyClients: 'No clients here yet.',
  quiet: 'Nothing needs a look today.',
  fail: 'Could not load this. Try again in a moment.',
  boardNote: 'Drag a card to change a client\'s status, or use "Move to".',
} as const;

/** The stage of a "coming up" row and when it is due. */
const comingDay = (d: AgencyDeliverable) => (d.publishDate ? `Goes live ${prettyDate(d.publishDate)}` : d.dueDate ? `Due ${prettyDate(d.dueDate)}` : '');

/** Agency: a content agency's or a freelance creator's clients, deliverables, time, invoices and agreements. */
export function Agency() {
  const [tabRaw, setTab] = useParamState('tab', 'overview');
  const tab = (TABS.find(([k]) => k === tabRaw)?.[0] ?? 'overview') as TabKey;
  const [addClient, setAddClient] = useState(false);
  return (
    <Screen columns={false}>
      <PageHeader back={{ to: '/apps', label: 'Apps' }} title="Agency" lede={COPY.lede} aside={<Button size="sm" onClick={() => setAddClient(true)}>Add client</Button>} />
      <div role="tablist" aria-label="Agency" className="scroll-row mt-md flex gap-xs">
        {TABS.map(([key, name]) => (
          <button
            key={key}
            type="button"
            role="tab"
            id={`agency-tab-${key}`}
            aria-selected={tab === key}
            aria-controls="agency-panel"
            onClick={() => setTab(key)}
            className={`toy min-h-[44px] shrink-0 rounded-pill border-2 px-md text-[14px] font-bold ${tab === key ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}
          >
            {name}
          </button>
        ))}
      </div>
      <div role="tabpanel" id="agency-panel" aria-labelledby={`agency-tab-${tab}`}>
        {tab === 'overview' && <Overview onTab={setTab} onAdd={() => setAddClient(true)} />}
        {tab === 'pipeline' && (
          <Section id="pipeline-heading" title="Pipeline">
            <AgencyPipeline />
          </Section>
        )}
        {tab === 'clients' && <Clients onAdd={() => setAddClient(true)} />}
        {tab === 'invoices' && (
          <Section id="invoices-heading" title="Invoices">
            <AgencyInvoices />
          </Section>
        )}
        {tab === 'agreements' && (
          <Section id="agreements-heading" title="Agreements">
            <AgencyContracts />
          </Section>
        )}
        {tab === 'settings' && (
          <Section id="settings-heading" title="Settings">
            <AgencySettings />
          </Section>
        )}
      </div>
      <ClientSheet open={addClient} client={null} onClose={() => setAddClient(false)} />
    </Screen>
  );
}

function Overview({ onTab, onAdd }: { onTab: (t: TabKey) => void; onAdd: () => void }) {
  const q = useAuthed(['agency', 'overview', ''], () => api.agency(''));
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<AgencyDeliverable | null>(null);
  const d = q.data;
  if (q.isError)
    return (
      <p role="alert" className="mt-md m-0 rounded-tile bg-card p-sm text-[14px] font-bold">
        {COPY.fail}
      </p>
    );
  if (!d) return <p className="mt-md m-0 text-[14px] font-semibold text-ink-soft">Loading…</p>;
  if (d.clients.length === 0 && d.page.page === 1)
    return (
      <div className="mt-md rounded-card bg-card p-md shadow-toy-soft">
        <p className="m-0 text-[16px] font-semibold">{COPY.empty}</p>
        <div className="mt-sm">
          <Button onClick={onAdd}>Add client</Button>
        </div>
      </div>
    );
  const t = d.totals;
  const cur = d.settings.currency;
  const tiles: { label: string; value: string; hint: string; go?: TabKey }[] = [
    { label: 'Active clients', value: String(t.activeClients), hint: 'working with you now', go: 'clients' },
    { label: 'Retainers a month', value: money(t.retainerCents, cur), hint: 'from active clients' },
    { label: 'In review', value: String(t.inReview), hint: 'waiting for a client', go: 'pipeline' },
    { label: 'Late', value: String(t.overdue), hint: 'past their day', go: 'pipeline' },
    { label: 'Published this month', value: `${t.publishedMonth} of ${t.plannedMonth}`, hint: 'against the plan' },
    { label: 'Hours this month', value: minutesLabel2(t.minutesMonth), hint: `${minutesLabel2(t.billableMonth)} billable` },
    { label: 'Utilisation this week', value: `${utilisationPct(t.billableWeek, d.settings.weeklyHours, 7)}%`, hint: `of ${d.settings.weeklyHours} hours` },
    { label: 'Unpaid invoices', value: money(t.unpaidCents, cur), hint: 'sent, not paid yet', go: 'invoices' },
  ];
  return (
    <>
      <Section id="numbers-heading" title="The numbers">
        <div className="grid grid-cols-2 gap-sm md:grid-cols-4">
          {tiles.map((x, i) => (
            <StatTile key={x.label} label={x.label} value={x.value} hint={x.hint} className={bento(i, tiles.length, 2, 4)} onClick={x.go ? () => onTab(x.go as TabKey) : undefined} />
          ))}
        </div>
      </Section>

      <Section id="look-heading" title="Needs a look">
        {d.attention.length === 0 ? (
          <p className="m-0 rounded-tile bg-card p-sm text-[14px] font-semibold text-ink-soft">{COPY.quiet}</p>
        ) : (
          <ul className="flex list-none flex-col gap-xs p-0 m-0">
            {d.attention.map((a, i) => (
              <li key={`${a.clientId}-${i}`}>
                <Link to={`/agency/${a.clientId}`} className="toy toy-soft block rounded-tile bg-card p-sm text-[14px] font-bold">
                  {a.text}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section id="coming-heading" title="Coming up" lede="Due or going live in the next two weeks, soonest first.">
        {d.coming.length === 0 ? (
          <p className="m-0 rounded-tile bg-card p-sm text-[14px] font-semibold text-ink-soft">Nothing is due soon.</p>
        ) : (
          <ul className="flex list-none flex-col gap-xs p-0 m-0">
            {d.coming.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelected(c);
                    setOpen(true);
                  }}
                  className="toy toy-soft block w-full rounded-tile bg-card p-sm text-left"
                >
                  <span className="block text-[16px] font-extrabold leading-snug">{c.title}</span>
                  <span className="mt-xs flex flex-wrap items-center gap-xs">
                    <StatusTag tone={DELIVERABLE_STAGE_TONE[c.stage]}>{DELIVERABLE_STAGE_META[c.stage].name}</StatusTag>
                    {c.overdue && <StatusTag tone="bad">Late</StatusTag>}
                  </span>
                  <span className="mt-xs block text-[12px] font-bold text-ink-soft">
                    {[c.clientName, c.platform, comingDay(c)].filter(Boolean).join(', ')}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <DeliverableSheet open={open} item={selected} clients={d.clients} onClose={() => setOpen(false)} />
    </>
  );
}

/** What one client shows on a card or a row. */
function ClientFacts({ c, cur }: { c: AgencyClient; cur: string }) {
  return (
    <>
      <span className="block text-[16px] font-extrabold leading-snug">{c.name}</span>
      <span className="mt-xs flex flex-wrap items-center gap-xs">
        <StatusTag tone={CLIENT_STATUS_TONE[c.status]}>{AGENCY_STATUS_NAME[c.status]}</StatusTag>
        <StatusTag tone={CLIENT_HEALTH_TONE[c.health]}>{AGENCY_HEALTH_NAME[c.health]}</StatusTag>
      </span>
      <span className="mt-xs block text-[12px] font-bold text-ink-soft">
        {[c.retainerCents > 0 ? `${money(c.retainerCents, cur)} a month` : '', c.piecesPerMonth > 0 ? `${c.month.published} of ${c.piecesPerMonth} published` : c.month.published > 0 ? `${c.month.published} published` : ''].filter(Boolean).join(', ')}
      </span>
      {c.flags.length > 0 && <span className="mt-xs block text-[12px] font-semibold text-ink-soft">{c.flags.join(', ')}</span>}
    </>
  );
}

function Clients({ onAdd }: { onAdd: () => void }) {
  const qc = useQueryClient();
  const nav = useNavigate();
  const [view, setView] = useView('c', 'list');
  const [statusRaw, setStatus] = useParamState('cstatus', '');
  const status = (AGENCY_CLIENT_STATUSES as readonly string[]).includes(statusRaw) ? (statusRaw as AgencyClientStatus) : '';
  const pg = usePage('c');
  const query = view === 'board' ? 'csize=100' : [pageQuery(pg.page, pg.size, 'c'), status ? `status=${status}` : ''].filter(Boolean).join('&');
  const key = ['agency', 'overview', query];
  const q = useAuthed(key, () => api.agency(query));
  const d = q.data;

  const move = useMutation({
    mutationFn: (v: { c: AgencyClient; to: AgencyClientStatus }) => api.agencyClientUpdate(v.c.id, { status: v.to }),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: key });
      const before = qc.getQueryData<AgencyOverview>(key);
      if (before) qc.setQueryData(key, { ...before, clients: before.clients.map((x) => (x.id === v.c.id ? { ...x, status: v.to } : x)) });
      return { before };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.before) qc.setQueryData(key, ctx.before);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['agency'] }),
  });
  const [edit, setEdit] = useState<AgencyClient | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const columns = d
    ? AGENCY_CLIENT_STATUSES.map((s) => {
        const items = d.clients.filter((c) => c.status === s);
        const sum = items.reduce((a, c) => a + c.retainerCents, 0);
        return { stage: s, total: items.length, items, name: AGENCY_STATUS_NAME[s], note: sum > 0 ? `${money(sum, d.settings.currency)} a month` : undefined };
      })
    : [];

  return (
    <Section id="clients-heading" title="Clients" action={<ViewToggle view={view} onChange={setView} label="Clients view" />}>
      {view === 'list' && (
        <div role="group" aria-label="Status" className="scroll-row mb-sm flex gap-xs">
          {(['', ...AGENCY_CLIENT_STATUSES] as const).map((s) => (
            <button
              key={s || 'all'}
              type="button"
              aria-pressed={status === s}
              onClick={() => {
                setStatus(s);
                pg.reset();
              }}
              className={`toy min-h-[44px] shrink-0 rounded-pill border-2 px-md text-[14px] font-bold ${status === s ? 'border-ink bg-ink text-on-ink' : 'toy-soft border-line bg-card'}`}
            >
              {s ? AGENCY_STATUS_NAME[s] : 'All'}
            </button>
          ))}
        </div>
      )}
      {q.isError && (
        <p role="alert" className="m-0 text-[14px] font-bold">
          {COPY.fail}
        </p>
      )}
      {q.isPending && <p className="m-0 text-[14px] font-semibold text-ink-soft">Loading…</p>}
      {d && d.clients.length === 0 && (
        <div className="rounded-card bg-card p-md shadow-toy-soft">
          <p className="m-0 text-[16px] font-semibold">{status ? COPY.emptyClients : COPY.empty}</p>
          {!status && (
            <div className="mt-sm">
              <Button onClick={onAdd}>Add client</Button>
            </div>
          )}
        </div>
      )}
      {d && d.clients.length > 0 && view === 'board' && (
        <>
          <p className="mb-sm mt-0 text-[14px] font-semibold text-ink-soft">{COPY.boardNote}</p>
          <KanbanBoard
            columns={columns}
            onMove={(c, from, to) => {
              if (from !== to) move.mutate({ c, to: to as AgencyClientStatus });
            }}
            card={(c) => (
              <button type="button" onClick={() => nav(`/agency/${c.id}`)} className="block w-full text-left">
                <ClientFacts c={c} cur={d.settings.currency} />
              </button>
            )}
          />
        </>
      )}
      {d && d.clients.length > 0 && view === 'list' && (
        <>
          <ul className="flex list-none flex-col gap-xs p-0 m-0">
            {d.clients.map((c) => (
              <li key={c.id} className="flex items-stretch gap-xs">
                <Link to={`/agency/${c.id}`} className="toy toy-soft block min-w-0 flex-1 rounded-tile bg-card p-sm">
                  <ClientFacts c={c} cur={d.settings.currency} />
                </Link>
                <Button variant="outline" size="sm" aria-label={`Change ${c.name}`} onClick={() => {
                    setEdit(c);
                    setEditOpen(true);
                  }}>
                  Edit
                </Button>
              </li>
            ))}
          </ul>
          <Pager page={d.page} prefix="c" label="clients" />
        </>
      )}
      {move.isError && (
        <p role="alert" className="mt-sm m-0 text-[14px] font-bold">
          That move did not save, so the card went back.
        </p>
      )}
      <ClientSheet open={editOpen} client={edit} onClose={() => setEditOpen(false)} />
    </Section>
  );
}
