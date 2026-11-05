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
import { ArrowUpRight, ChevronRight, Settings } from 'lucide-react';
import { Suspense, useEffect, useLayoutEffect, useState } from 'react';
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
import { TabRow } from '../components/TabRow';
import { TeamInvites, useMyTeams, MY_TEAMS_KEY } from '../components/TeamInvites';
import { Icon } from '../components/Icon';
import { KanbanBoard } from '../components/KanbanBoard';
import { Pager, usePage } from '../components/Pager';
import { PageHeader } from '../components/PageHeader';
import { Screen } from '../components/Screen';
import { Section } from '../components/Section';
import { Busy, Skeleton } from '../components/Skeleton';
import { StatusTag } from '../components/StatusTag';
import { FILTER_SELECT } from '../components/AgencyInvoices';
import { useView, ViewToggle } from '../components/ViewToggle';
import { useWide } from '../lib/useWide';
import { api } from '../lib/api';
import { bento } from '../lib/bento';
import { prettyDate } from '../lib/date';
import { useAuthed } from '../lib/queries';
import { useParamState } from '../lib/useParamState';
import { lazyNamed } from '../lib/lazy';
import { AgencyCanContext, agencyCanFor, setAgencyTeam, useAgencyTeam, useAgencyCan } from '../lib/agencyWorkspace';
import { TEAM_ROLE_META, type MyTeam, type TeamTab } from '@kreators/shared';
import { ToggleChevron } from '../components/ToggleMark';

const AgencyTeam = lazyNamed(() => import('../components/AgencyTeam'), 'AgencyTeam');
const ClientMemberView = lazyNamed(() => import('../components/AgencyTeam'), 'ClientMemberView');

/** The five tabs. Settings is not one of them: it opens from the gear in the header and is still `?tab=settings`. Team is the owner's only. */
const TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'pipeline', label: 'Pipeline' },
  { value: 'clients', label: 'Clients' },
  { value: 'paperwork', label: 'Paperwork' },
  { value: 'team', label: 'Team' },
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
  const qc = useQueryClient();
  // Whose Agency this is: the person's own, or a team they joined (`?team=<row id>`, kept in the address so a reload or a link keeps it).
  const teamParam = params.get('team') ?? '';
  const teamsQ = useMyTeams();
  const teams = teamsQ.data?.teams ?? [];
  const { team: workingOn, gone } = useAgencyTeam();
  const row: MyTeam | null = teamParam ? (teams.find((t) => t.id === teamParam) ?? null) : null;
  const member = row && row.status === 'active' && row.id !== gone ? row : null;
  // The header goes on only for a staff role; a client member reads their own view from /me/teams instead.
  const wanted = member && member.role !== 'client' ? member.id : null;
  const deciding = Boolean(teamParam) && teamsQ.isPending;
  const lost = Boolean(teamParam) && teamsQ.isSuccess && !row;
  useLayoutEffect(() => {
    if (deciding || workingOn === wanted) return;
    // Another Agency's answers must never show under this one: drop them all before the switch.
    qc.removeQueries({ queryKey: ['agency'] });
    setAgencyTeam(wanted);
  }, [deciding, wanted, workingOn, qc]);
  // The server said this team is gone (removed or left): look again, so the switcher and the page follow.
  useEffect(() => {
    if (gone) void qc.invalidateQueries({ queryKey: MY_TEAMS_KEY });
  }, [gone, qc]);
  const access = member && member.role !== 'client' ? member.access : null;
  const can = agencyCanFor(access);
  const tabs = TABS.filter((t) => (access ? t.value !== 'team' && access[t.value as TeamTab] !== 'off' : true));
  const tabRaw = params.get('tab') ?? (access ? (tabs[0]?.value ?? 'overview') : 'overview');
  const tab: TabKey =
    tabRaw === 'settings' && !access ? 'settings' : (tabs.find((t) => t.value === tabRaw)?.value ?? (OLD_TABS[tabRaw] && tabs.some((t) => t.value === 'paperwork') ? 'paperwork' : (tabs[0]?.value ?? 'overview')));
  const [seg] = usePaperSegment();
  const [addClient, setAddClient] = useState(false);
  const [adding, setAdding] = useState(false);
  const [inviting, setInviting] = useState(false);
  const ready = !deciding && workingOn === wanted;
  const clientsQ = useAuthed(['agency', 'clients-all'], () => api.agency('csize=100'), ready && tab === 'pipeline' && !(member?.role === 'client'));
  const noClients = clientsQ.isSuccess && (clientsQ.data?.clients.length ?? 0) === 0;
  const active = teams.filter((t) => t.status === 'active');

  /** Switch whose Agency this is. The tab goes back to the first one, since another Agency may not open the same tabs. */
  const pickTeam = (id: string) => {
    setAdding(false);
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const k of ['team', 'tab', 'agseg']) next.delete(k);
        if (id) next.set('team', id);
        return next;
      },
      { replace: true, preventScrollReset: true },
    );
  };

  /** Go to a tab, and on Paperwork to one kind of paper, in one change of the URL (two setters in a row would lose the first). */
  const goTab = (t: TabKey, paper?: 'invoices' | 'agreements' | 'other') => {
    setAdding(false);
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (t === 'overview' && !access) next.delete('tab');
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

  const primary = access ? (
    // A team member gets the one main thing only where they may do it, and never Add client.
    tab === 'pipeline' && can.can('pipeline', 'edit') ? (
      <Button size="sm" plusToX disabled={noClients} onClick={() => setAdding(true)}>
        Add deliverable
      </Button>
    ) : tab === 'paperwork' && seg !== 'other' && can.can('paperwork', 'edit') ? (
      <Button size="sm" plusToX onClick={() => setAdding(true)}>
        {seg === 'invoices' ? 'New invoice' : 'New agreement'}
      </Button>
    ) : null
  ) : member?.role === 'client' ? null : tab === 'team' ? (
    <Button size="sm" plusToX expanded={inviting} onClick={() => setInviting(true)}>
      Invite member
    </Button>
  ) : tab === 'overview' || tab === 'clients' ? (
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

  const clientRow = member?.role === 'client' ? member : null;
  const title = member ? member.agency.name : 'Agency';
  const lede = clientRow ? `Your work with ${member!.agency.name}, read only.` : member ? `You work here as ${aWord(TEAM_ROLE_META[member.role].name)}.` : COPY.lede;

  return (
    <Screen columns={false}>
      <PageHeader
        back={{ to: '/apps', label: 'Apps' }}
        title={title}
        lede={lede}
        aside={
          <div className="flex items-center gap-xs">
            {primary}
            {!member && (
              <button
                type="button"
                onClick={() => goTab('settings')}
                aria-label="Agency settings"
                aria-pressed={tab === 'settings'}
                className={`toy toy-soft flex h-[44px] w-[44px] items-center justify-center rounded-pill ${tab === 'settings' ? 'bg-card-strong text-ink' : 'text-ink-soft hover:text-ink'}`}
              >
                <Icon icon={Settings} size={20} />
              </button>
            )}
          </div>
        }
      />
      {active.length > 0 && (
        <div className="mt-md">
          <label className="flex flex-wrap items-center gap-xs">
            <span className="text-subhead font-semibold">Agency</span>
            <select value={member ? member.id : ''} onChange={(e) => pickTeam(e.target.value)} className={`min-w-0 flex-1 sm:flex-none ${FILTER_SELECT}`} aria-label="Whose Agency">
              <option value="">Mine</option>
              {active.map((t) => (
                <option key={t.id} value={t.id}>
                  {`${t.agency.name}, ${TEAM_ROLE_META[t.role].name.toLowerCase()}`}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      {(lost || (row && row.id === gone)) && (
        <p role="status" className="mt-md m-0 rounded-tile bg-card p-sm text-subhead">
          You are no longer on that team. This is your own Agency.
        </p>
      )}
      {!member && <TeamInvites className="mt-md" />}
      {clientRow ? (
        <Suspense fallback={<TilesLoading />}>
          <ClientMemberView teamId={clientRow.id} agencyName={clientRow.agency.name} />
        </Suspense>
      ) : !ready ? (
        <TilesLoading />
      ) : (
        <AgencyCanContext.Provider value={can}>
          <div className="mt-md">
            <TabRow<TabKey> label="Agency" value={tab} onChange={(t) => goTab(t)} items={tabs.map((t) => ({ key: t.value, label: t.label, name: t.label }))} />
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
            {tab === 'team' && !access && (
              <Suspense fallback={<TilesLoading />}>
                <AgencyTeam inviting={inviting} onInviting={setInviting} />
              </Suspense>
            )}
            {tab === 'settings' && !access && (
              <Section id="settings-heading" title="Settings">
                <AgencySettings />
              </Section>
            )}
          </div>
          {!access && <ClientSheet open={addClient} client={null} onClose={() => setAddClient(false)} />}
        </AgencyCanContext.Provider>
      )}
    </Screen>
  );
}

/** "an editor", "a videographer". */
const aWord = (w: string) => `${/^[aeiou]/i.test(w) ? 'an' : 'a'} ${w.toLowerCase()}`;

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
  const { access, can } = useAgencyCan();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<AgencyDeliverable | null>(null);
  const [allComing, setAllComing] = useState(false);
  const d = q.data;
  if (q.isError)
    return (
      <p role="alert" className="mt-md m-0 rounded-tile bg-card p-sm text-subhead">
        {COPY.fail}
      </p>
    );
  if (!d) return <TilesLoading />;
  if (d.clients.length === 0 && d.page.page === 1)
    return (
      <div className="mt-md rounded-card bg-card p-md shadow-toy-soft">
        <p className="m-0 text-callout">{access ? COPY.emptyClients : COPY.empty}</p>
        {!access && (
          <div className="mt-sm">
            <Button variant="outline" plusToX onClick={onAdd}>Add client</Button>
          </div>
        )}
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
  // A team member sees no money they may not open: the retainers never, unpaid invoices only with paperwork. Tiles for a tab that is
  // off for them do not lead there.
  if (access) {
    for (const list of [first, rest]) {
      for (let i = list.length - 1; i >= 0; i -= 1) {
        const x = list[i]!;
        if (x.label === 'Retainers a month' || (x.label === 'Unpaid invoices' && !can('paperwork', 'view'))) list.splice(i, 1);
        else if ((x.label === 'Active clients' && !can('clients', 'view')) || ((x.label === 'In review' || x.label === 'Late') && !can('pipeline', 'view'))) list[i] = { ...x, go: undefined };
      }
    }
  }
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
          <p className="m-0 rounded-tile bg-card p-sm text-subhead text-ink-soft">{COPY.quiet}</p>
        ) : (
          <ul className="flex list-none flex-col gap-xs p-0 m-0">
            {d.attention.map((a, i) => (
              <li key={`${a.clientId}-${i}`}>
                <Link to={`/agency/${a.clientId}`} className="toy toy-soft flex min-h-[44px] items-center gap-sm rounded-tile bg-card p-sm text-subhead">
                  <span className="min-w-0 flex-1">{a.text}</span>
                  <Icon icon={ArrowUpRight} size={20} className="text-ink-mute" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section id="coming-heading" title="Coming up" lede="Due or going live in the next two weeks, soonest first.">
        {d.coming.length === 0 ? (
          <p className="m-0 rounded-tile bg-card p-sm text-subhead text-ink-soft">Nothing is due soon.</p>
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
                      <span className="block text-headline">{c.title}</span>
                      <span className="mt-xs flex flex-wrap items-center gap-xs">
                        <StatusTag tone={DELIVERABLE_STAGE_TONE[c.stage]}>{DELIVERABLE_STAGE_META[c.stage].name}</StatusTag>
                        {c.overdue && <StatusTag tone="bad">Late</StatusTag>}
                      </span>
                      <span className="mt-xs block text-caption text-ink-soft">{[c.clientName, c.platform, comingDay(c)].filter(Boolean).join(', ')}</span>
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
                  <ToggleChevron open={allComing} />
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
        <span className="block text-headline">{c.name}</span>
        <span className="mt-xs flex flex-wrap items-center gap-xs">
          <StatusTag tone={CLIENT_HEALTH_TONE[c.health]}>{AGENCY_HEALTH_NAME[c.health]}</StatusTag>
        </span>
        {line && <span className="mt-xs block text-caption text-ink-soft">{line}</span>}
      </>
    );
  return (
    <>
      <span className="block text-headline">{c.name}</span>
      <span className="mt-xs flex flex-wrap items-center gap-xs">
        <StatusTag tone={CLIENT_STATUS_TONE[c.status]}>{AGENCY_STATUS_NAME[c.status]}</StatusTag>
        <StatusTag tone={CLIENT_HEALTH_TONE[c.health]}>{AGENCY_HEALTH_NAME[c.health]}</StatusTag>
      </span>
      {line && <span className="mt-xs block text-caption text-ink-soft">{line}</span>}
      {c.flags.length > 0 && <span className="mt-xs block text-caption text-ink-soft">{c.flags.join(', ')}</span>}
    </>
  );
}

function Clients({ onAdd }: { onAdd: () => void }) {
  const qc = useQueryClient();
  const { access, can } = useAgencyCan();
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
        <p role="alert" className="m-0 text-subhead">
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
          <p className="m-0 text-callout">{status ? COPY.emptyClients : COPY.empty}</p>
          {!status && !access && (
            <div className="mt-sm">
              <Button variant="outline" plusToX onClick={onAdd}>Add client</Button>
            </div>
          )}
        </div>
      )}
      {d && d.clients.length > 0 && view === 'board' && (
        <>
          <KanbanBoard
            columns={columns}
            itemLabel={(c) => c.name}
            onMove={
              can('clients', 'edit')
                ? (c, from, to) => {
                    if (from !== to) move.mutate({ c, to: to as AgencyClientStatus });
                  }
                : undefined
            }
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
                  <Icon icon={ArrowUpRight} size={20} className="text-ink-mute" />
                </Link>
              </li>
            ))}
          </ul>
          <Pager page={d.page} prefix="c" label="clients" />
        </>
      )}
      {move.isError && (
        <p role="alert" className="mt-sm m-0 text-subhead">
          That move did not save, so the card went back.
        </p>
      )}
    </Section>
  );
}
