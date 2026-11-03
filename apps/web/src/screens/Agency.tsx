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
import { ChevronRight, Settings } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { AgencyContracts, usePaperSegment } from '../components/AgencyContracts';
import { AnimatedIcon } from '../components/AnimatedIcon';
import { AgencyPipeline } from '../components/AgencyPipeline';
import { AgencySettings } from '../components/AgencySettings';
import { Button } from '../components/Button';
import { StatTile } from '../components/Charts';
import { ClientSheet } from '../components/ClientSheet';
import { DeliverableSheet } from '../components/DeliverableSheet';
import { Fold } from '../components/Fold';
import { Segmented } from '../components/fx/Segmented';
import { Icon } from '../components/Icon';
import { KanbanBoard } from '../components/KanbanBoard';
import { Pager, usePage } from '../components/Pager';
import { PageHeader } from '../components/PageHeader';
import { Screen } from '../components/Screen';
import { Section } from '../components/Section';
import { Busy, Skeleton } from '../components/Skeleton';
import { StatusTag } from '../components/StatusTag';
import { FILTER_SELECT } from '../components/AgencyInvoices';
import { useView, useWide, ViewToggle } from '../components/ViewToggle';
import { api } from '../lib/api';
import { bento } from '../lib/bento';
import { prettyDate } from '../lib/date';
import { useAuthed } from '../lib/queries';
import { useParamState } from '../lib/useParamState';

/** The four tabs. Settings is not one of them: it opens from the gear in the header and is still `?tab=settings`. */
const TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'pipeline', label: 'Pipeline' },
  { value: 'clients', label: 'Clients' },
  { value: 'paperwork', label: 'Paperwork' },
] as const;
type TabKey = (typeof TABS)[number]['value'] | 'settings';
/** Old links had a tab for invoices and one for agreements; they now land on Paperwork with that segment chosen. */
const OLD_TABS: Record<string, 'invoices' | 'agreements'> = { invoices: 'invoices', agreements: 'agreements' };
const COMING_FIRST = 5;

const COPY = {
  lede: 'Clients, the content you make for them, time and invoices.',
  empty: 'Add your first client. Then add the deliverables you make for them and move each one from idea to published.',
  emptyClients: 'No clients here yet.',
  quiet: 'Nothing needs a look today.',
  fail: 'Could not load this. Try again in a moment.',
} as const;

/** The stage of a "coming up" row and when it is due. */
const comingDay = (d: AgencyDeliverable) => (d.publishDate ? `Goes live ${prettyDate(d.publishDate)}` : d.dueDate ? `Due ${prettyDate(d.dueDate)}` : '');

/**
 * Agency: a content agency's or a freelance creator's clients, deliverables, time, invoices and agreements. Four tabs, a gear for the
 * settings, and one dark button in the header that does the main thing for the tab you are on.
 */
export function Agency() {
  const [params, setParams] = useSearchParams();
  const tabRaw = params.get('tab') ?? 'overview';
  const tab: TabKey = tabRaw === 'settings' ? 'settings' : (TABS.find((t) => t.value === tabRaw)?.value ?? (OLD_TABS[tabRaw] ? 'paperwork' : 'overview'));
  const [seg] = usePaperSegment();
  const [addClient, setAddClient] = useState(false);
  const [adding, setAdding] = useState(false);
  const clientsQ = useAuthed(['agency', 'clients-all'], () => api.agency('csize=100'), tab === 'pipeline');
  const noClients = clientsQ.isSuccess && (clientsQ.data?.clients.length ?? 0) === 0;

  /** Go to a tab, and on Paperwork to one kind of paper, in one change of the URL (two setters in a row would lose the first). */
  const goTab = (t: TabKey, paper?: 'invoices' | 'agreements' | 'other') => {
    setAdding(false);
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (t === 'overview') next.delete('tab');
        else next.set('tab', t);
        if (paper) next.set('agseg', paper);
        return next;
      },
      { replace: true, preventScrollReset: true },
    );
  };
  // An old ?tab=invoices or ?tab=agreements link: rewrite it once to Paperwork with that segment.
  useEffect(() => {
    const old = OLD_TABS[tabRaw];
    if (old) goTab('paperwork', old);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabRaw]);

  const primary =
    tab === 'overview' || tab === 'clients' ? (
      <Button size="sm" onClick={() => setAddClient(true)}>
        <AnimatedIcon name="userPlus" size={18} />
        Add client
      </Button>
    ) : tab === 'pipeline' ? (
      <Button size="sm" plusToX disabled={noClients} onClick={() => setAdding(true)}>
        Add deliverable
      </Button>
    ) : tab === 'paperwork' && seg === 'invoices' ? (
      <Button size="sm" plusToX onClick={() => setAdding(true)}>
        New invoice
      </Button>
    ) : tab === 'paperwork' && seg === 'agreements' ? (
      <Button size="sm" plusToX onClick={() => setAdding(true)}>
        New agreement
      </Button>
    ) : null;
  // The other documents keep their own New document button inside the list, so the header has none on that segment.

  return (
    <Screen columns={false}>
      <PageHeader
        back={{ to: '/apps', label: 'Apps' }}
        title="Agency"
        lede={COPY.lede}
        aside={
          <div className="flex items-center gap-xs">
            {primary}
            <button
              type="button"
              onClick={() => goTab('settings')}
              aria-label="Agency settings"
              aria-pressed={tab === 'settings'}
              className={`toy toy-soft flex h-[44px] w-[44px] items-center justify-center rounded-pill ${tab === 'settings' ? 'bg-card-strong text-ink' : 'text-ink-soft hover:text-ink'}`}
            >
              <Icon icon={Settings} size={20} />
            </button>
          </div>
        }
      />
      <div className="mt-md">
        <Segmented<TabKey> label="Agency" value={tab} onChange={(t) => goTab(t)} options={TABS} />
      </div>
      <div id="agency-panel">
        {tab === 'overview' && <Overview onTab={goTab} onAdd={() => setAddClient(true)} />}
        {tab === 'pipeline' && (
          <Section id="pipeline-heading" title="Pipeline">
            <AgencyPipeline adding={adding} onAdding={setAdding} />
          </Section>
        )}
        {tab === 'clients' && <Clients onAdd={() => setAddClient(true)} />}
        {tab === 'paperwork' && (
          <Section id="paperwork-heading" title="Paperwork">
            <AgencyContracts adding={adding} onAdding={setAdding} />
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

/** Tile placeholders while the overview loads. */
function TilesLoading() {
  return (
    <Busy label="Loading your agency" className="mt-md grid grid-cols-2 gap-sm md:grid-cols-4">
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-[96px] w-full" />
      ))}
    </Busy>
  );
}

function Overview({ onTab, onAdd }: { onTab: (t: TabKey, paper?: 'invoices' | 'agreements') => void; onAdd: () => void }) {
  const q = useAuthed(['agency', 'overview', ''], () => api.agency(''));
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<AgencyDeliverable | null>(null);
  const [allComing, setAllComing] = useState(false);
  const d = q.data;
  if (q.isError)
    return (
      <p role="alert" className="mt-md m-0 rounded-tile bg-card p-sm text-[14px] font-bold">
        {COPY.fail}
      </p>
    );
  if (!d) return <TilesLoading />;
  if (d.clients.length === 0 && d.page.page === 1)
    return (
      <div className="mt-md rounded-card bg-card p-md shadow-toy-soft">
        <p className="m-0 text-[16px] font-semibold">{COPY.empty}</p>
        <div className="mt-sm">
          <Button plusToX onClick={onAdd}>Add client</Button>
        </div>
      </div>
    );
  const t = d.totals;
  const cur = d.settings.currency;
  type Tile = { label: string; value: string; hint: string; go?: () => void };
  // The four most people need first; the rest wait behind a fold.
  const first: Tile[] = [
    { label: 'Active clients', value: String(t.activeClients), hint: 'working with you now', go: () => onTab('clients') },
    { label: 'Unpaid invoices', value: money(t.unpaidCents, cur), hint: 'sent, not paid yet', go: () => onTab('paperwork', 'invoices') },
    { label: 'In review', value: String(t.inReview), hint: 'waiting for a client', go: () => onTab('pipeline') },
    { label: 'Late', value: String(t.overdue), hint: 'past their day', go: () => onTab('pipeline') },
  ];
  const rest: Tile[] = [
    { label: 'Retainers a month', value: money(t.retainerCents, cur), hint: 'from active clients' },
    { label: 'Published this month', value: `${t.publishedMonth} of ${t.plannedMonth}`, hint: 'against the plan' },
    { label: 'Hours this month', value: minutesLabel2(t.minutesMonth), hint: `${minutesLabel2(t.billableMonth)} billable` },
    { label: 'Utilisation this week', value: `${utilisationPct(t.billableWeek, d.settings.weeklyHours, 7)}%`, hint: `of ${d.settings.weeklyHours} hours` },
  ];
  const tiles = (list: Tile[]) => (
    <div className="grid grid-cols-2 gap-sm md:grid-cols-4">
      {list.map((x, i) => (
        <StatTile key={x.label} label={x.label} value={x.value} hint={x.hint} className={bento(i, list.length, 2, 4)} onClick={x.go} />
      ))}
    </div>
  );
  const coming = allComing ? d.coming : d.coming.slice(0, COMING_FIRST);
  return (
    <>
      <Section id="numbers-heading" title="The numbers">
        {tiles(first)}
        <Fold className="mt-sm" title="Show all numbers" hint={`${rest.length} more`}>
          {tiles(rest)}
        </Fold>
      </Section>

      <Section id="look-heading" title="Needs a look">
        {d.attention.length === 0 ? (
          <p className="m-0 rounded-tile bg-card p-sm text-[14px] font-semibold text-ink-soft">{COPY.quiet}</p>
        ) : (
          <ul className="flex list-none flex-col gap-xs p-0 m-0">
            {d.attention.map((a, i) => (
              <li key={`${a.clientId}-${i}`}>
                <Link to={`/agency/${a.clientId}`} className="toy toy-soft flex min-h-[44px] items-center gap-sm rounded-tile bg-card p-sm text-[14px] font-bold">
                  <span className="min-w-0 flex-1">{a.text}</span>
                  <Icon icon={ChevronRight} size={20} className="text-ink-mute" />
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
          <>
            <ul className="flex list-none flex-col gap-xs p-0 m-0">
              {coming.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(c);
                      setOpen(true);
                    }}
                    className="toy toy-soft flex w-full items-center gap-sm rounded-tile bg-card p-sm text-left"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-[16px] font-extrabold leading-snug">{c.title}</span>
                      <span className="mt-xs flex flex-wrap items-center gap-xs">
                        <StatusTag tone={DELIVERABLE_STAGE_TONE[c.stage]}>{DELIVERABLE_STAGE_META[c.stage].name}</StatusTag>
                        {c.overdue && <StatusTag tone="bad">Late</StatusTag>}
                      </span>
                      <span className="mt-xs block text-[12px] font-bold text-ink-soft">{[c.clientName, c.platform, comingDay(c)].filter(Boolean).join(', ')}</span>
                    </span>
                    <Icon icon={ChevronRight} size={20} className="text-ink-mute" />
                  </button>
                </li>
              ))}
            </ul>
            {d.coming.length > COMING_FIRST && (
              <div className="mt-sm">
                <Button variant="outline" size="sm" onClick={() => setAllComing((v) => !v)} aria-expanded={allComing}>
                  {allComing ? 'Show fewer' : `Show more (${d.coming.length - COMING_FIRST})`}
                </Button>
              </div>
            )}
          </>
        )}
      </Section>
      <DeliverableSheet open={open} item={selected} clients={d.clients} onClose={() => setOpen(false)} />
    </>
  );
}

/** What one client shows on a card or a row. On the board (`compact`) the column already says the status, so it is the name, the health and one line. */
function ClientFacts({ c, cur, compact = false }: { c: AgencyClient; cur: string; compact?: boolean }) {
  const line = [c.retainerCents > 0 ? `${money(c.retainerCents, cur)} a month` : '', c.piecesPerMonth > 0 ? `${c.month.published} of ${c.piecesPerMonth} published` : c.month.published > 0 ? `${c.month.published} published` : ''].filter(Boolean).join(', ');
  if (compact)
    return (
      <>
        <span className="block text-[16px] font-extrabold leading-snug">{c.name}</span>
        <span className="mt-xs flex flex-wrap items-center gap-xs">
          <StatusTag tone={CLIENT_HEALTH_TONE[c.health]}>{AGENCY_HEALTH_NAME[c.health]}</StatusTag>
        </span>
        {line && <span className="mt-xs block text-[12px] font-bold text-ink-soft">{line}</span>}
      </>
    );
  return (
    <>
      <span className="block text-[16px] font-extrabold leading-snug">{c.name}</span>
      <span className="mt-xs flex flex-wrap items-center gap-xs">
        <StatusTag tone={CLIENT_STATUS_TONE[c.status]}>{AGENCY_STATUS_NAME[c.status]}</StatusTag>
        <StatusTag tone={CLIENT_HEALTH_TONE[c.health]}>{AGENCY_HEALTH_NAME[c.health]}</StatusTag>
      </span>
      {line && <span className="mt-xs block text-[12px] font-bold text-ink-soft">{line}</span>}
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
  const wide = useWide();

  const columns = d
    ? AGENCY_CLIENT_STATUSES.map((s) => {
        const items = d.clients.filter((c) => c.status === s);
        const sum = items.reduce((a, c) => a + c.retainerCents, 0);
        return { stage: s, total: items.length, items, name: AGENCY_STATUS_NAME[s], note: sum > 0 ? `${money(sum, d.settings.currency)} a month` : undefined };
      })
    : [];

  return (
    <Section id="clients-heading" title="Clients" action={<ViewToggle view={view} onChange={setView} label="Clients view" />}>
      {view === 'list' &&
        (wide ? (
          <div className="mb-sm">
            <Segmented<AgencyClientStatus | ''>
              label="Status"
              value={status}
              onChange={(v) => {
                setStatus(v);
                pg.reset();
              }}
              options={[{ value: '', label: 'All' }, ...AGENCY_CLIENT_STATUSES.map((st) => ({ value: st, label: AGENCY_STATUS_NAME[st] }))]}
            />
          </div>
        ) : (
          <select
            aria-label="Status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              pg.reset();
            }}
            className={`mb-sm ${FILTER_SELECT}`}
          >
            <option value="">Status: All</option>
            {AGENCY_CLIENT_STATUSES.map((st) => (
              <option key={st} value={st}>
                Status: {AGENCY_STATUS_NAME[st]}
              </option>
            ))}
          </select>
        ))}
      {q.isError && (
        <p role="alert" className="m-0 text-[14px] font-bold">
          {COPY.fail}
        </p>
      )}
      {q.isPending && (
        <Busy label="Loading clients" className="flex flex-col gap-xs">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[72px] w-full" />
          ))}
        </Busy>
      )}
      {d && d.clients.length === 0 && (
        <div className="rounded-card bg-card p-md shadow-toy-soft">
          <p className="m-0 text-[16px] font-semibold">{status ? COPY.emptyClients : COPY.empty}</p>
          {!status && (
            <div className="mt-sm">
              <Button plusToX onClick={onAdd}>Add client</Button>
            </div>
          )}
        </div>
      )}
      {d && d.clients.length > 0 && view === 'board' && (
        <>
          <KanbanBoard
            columns={columns}
            itemLabel={(c) => c.name}
            onMove={(c, from, to) => {
              if (from !== to) move.mutate({ c, to: to as AgencyClientStatus });
            }}
            card={(c) => (
              <button type="button" onClick={() => nav(`/agency/${c.id}`)} className="block w-full text-left">
                <ClientFacts c={c} cur={d.settings.currency} compact />
              </button>
            )}
          />
        </>
      )}
      {d && d.clients.length > 0 && view === 'list' && (
        <>
          <ul className="flex list-none flex-col gap-xs p-0 m-0">
            {d.clients.map((c) => (
              <li key={c.id}>
                <Link to={`/agency/${c.id}`} className="toy toy-soft flex items-center gap-sm rounded-tile bg-card p-sm">
                  <span className="min-w-0 flex-1">
                    <ClientFacts c={c} cur={d.settings.currency} />
                  </span>
                  <Icon icon={ChevronRight} size={20} className="text-ink-mute" />
                </Link>
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
    </Section>
  );
}
