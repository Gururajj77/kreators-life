import { AGENCY_HEALTH_NAME, AGENCY_STATUS_NAME, CLIENT_HEALTH_TONE, CLIENT_STATUS_TONE, minutesLabel2, money, parseOnboarding, stageIndex, type AgencyClient as ClientData, type AgencyClientPage, type ClientOnboarding as OnboardingAnswers } from '@kreators/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Clock, ExternalLink, FilePlus, Pencil, ReceiptText } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import { AgencyContracts } from '../components/AgencyContracts';
import { ClientDocs } from '../components/AgencyDocs';
import { LifecycleCard, PortalSecurityCard, RetainerCard } from '../components/AgencyLifecycle';
import { AgencyInvoices } from '../components/AgencyInvoices';
import { AgencyPipeline } from '../components/AgencyPipeline';
import { Button } from '../components/Button';
import { StatTile } from '../components/Charts';
import { ClientLink } from '../components/ClientLink';
import { ClientSheet } from '../components/ClientSheet';
import { Fold } from '../components/Fold';
import { Segmented } from '../components/fx/Segmented';
import { Inert } from '../components/Inert';
import { MoreMenu } from '../components/MoreMenu';
import { BackLink } from '../components/PageHeader';
import { Ring } from '../components/Ring';
import { Screen } from '../components/Screen';
import { Section } from '../components/Section';
import { Sheet } from '../components/Sheet';
import { Busy, Skeleton, SkeletonCard } from '../components/Skeleton';
import { StatusTag } from '../components/StatusTag';
import { Toggle } from '../components/Toggle';
import { api } from '../lib/api';
import { bento } from '../lib/bento';
import { prettyDate, todayLocal } from '../lib/date';
import { useAuthed } from '../lib/queries';
import { useParamState } from '../lib/useParamState';
import { useCopy } from '../lib/clipboard';
import { FIELD } from '../lib/ui';

const COPY = {
  loading: 'Loading this client.',
  gone: 'No client here. It may have been removed.',
  retry: 'Could not load this client. Try again in a moment.',
  timeLede: 'Hours you spent for this client. Billable hours count towards what they pay for.',
  timeFailed: 'That did not save. Check the time and try again.',
  timeEmpty: 'No time logged yet.',
  agreementLede: 'Trial terms, retainers and project agreements for this client.',
  linkLede: 'What your client sees at their link.',
  retainerLede: 'The client picks the months; each month bills itself.',
  retainerLater: 'A retainer can be offered after the pilot month.',
  invoiceFailed: 'Could not make the invoice. Set a retainer or a fee on a published deliverable first.',
};

const SEGMENTS = [
  { value: 'work', label: 'Work' },
  { value: 'money', label: 'Money' },
  { value: 'paper', label: 'Paper' },
  { value: 'link', label: 'Link' },
] as const;
type Segment = (typeof SEGMENTS)[number]['value'];
const isSegment = (v: string): v is Segment => SEGMENTS.some((s) => s.value === v);

/** "90", "1:30", "1h 30m", "1.5h" or "45m" as whole minutes, or null when it is not a time. */
function parseDuration(text: string): number | null {
  const t = text.trim().toLowerCase();
  if (!t) return null;
  const colon = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (colon) return Number(colon[1]) * 60 + Number(colon[2]);
  const parts = /^(?:(\d+(?:\.\d+)?)\s*h(?:ours?|rs?)?)?\s*(?:(\d+)\s*m(?:in(?:ute)?s?)?)?$/.exec(t);
  if (parts && (parts[1] || parts[2])) return Math.round(Number(parts[1] ?? 0) * 60) + Number(parts[2] ?? 0);
  return /^\d+$/.test(t) ? Number(t) : null;
}

/**
 * The dashboard for one client: the header with one fact line and a More menu, one stage card, three numbers, then four segments
 * kept in the URL (`cseg`): Work (the pipeline, channels and time), Money (invoices and, from the pilot on, the retainer), Paper
 * (agreements and documents) and Link (what the client sees at their link).
 */
export function AgencyClient() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const today = todayLocal();
  const q = useAuthed(['agency', 'client', id], () => api.agencyClient(id));
  const [segRaw, setSeg] = useParamState('cseg', 'work');
  const seg: Segment = isSegment(segRaw) ? segRaw : 'work';
  const [editing, setEditing] = useState(false);
  const [timing, setTiming] = useState(false);
  const [newInvoice, setNewInvoice] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [answersOpen, setAnswersOpen] = useState(false);
  const items = useAuthed(['agency', 'items', 'client', id, 'time'], () => api.agencyItems(`client=${id}&size=100`), timing);
  const invalidate = () => qc.invalidateQueries({ queryKey: ['agency'] });

  const [minutesText, setMinutesText] = useState('');
  const [day, setDay] = useState(today);
  const [billable, setBillable] = useState(true);
  const [itemId, setItemId] = useState('');
  const [note, setNote] = useState('');
  const logTime = useMutation({
    mutationFn: () => api.agencyTimeAdd({ clientId: id, itemId: itemId || null, day, minutes: parseDuration(minutesText) ?? 0, billable, note }),
    onSuccess: () => {
      setMinutesText('');
      setNote('');
      setTiming(false);
      invalidate();
    },
  });
  const removeTime = useMutation({ mutationFn: (entry: string) => api.agencyTimeRemove(entry), onSuccess: invalidate });
  const makeInvoice = useMutation({ mutationFn: () => api.agencyInvoiceFromClient(id), onSuccess: (r) => nav(`/agency/invoices/${r.invoice.id}`) });

  const d = q.data;
  if (q.isPending) {
    return (
      <Screen columns={false}>
        <Busy label={COPY.loading} className="pt-lg">
          <Skeleton className="h-[16px] w-[96px]" />
          <Skeleton className="mt-sm h-[36px] w-2/3" />
          <Skeleton className="mt-sm h-[16px] w-1/2" />
          <SkeletonCard lines={3} className="mt-md" />
          <div className="mt-md grid grid-cols-2 gap-sm md:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className={`h-[96px] rounded-card ${bento(i, 3, 2, 3)}`} />
            ))}
          </div>
        </Busy>
      </Screen>
    );
  }
  if (q.isError || !d) {
    return (
      <Screen columns={false}>
        <header className="pt-lg">
          <BackLink to="/agency">Agency</BackLink>
          <p role="alert" className="mt-md m-0 text-[16px] font-bold">
            {q.error && 'status' in q.error && (q.error as { status?: number }).status === 404 ? COPY.gone : COPY.retry}
          </p>
        </header>
      </Screen>
    );
  }

  const c: ClientData = d.client;
  const life = d.lifecycle;
  const cur = d.settings.currency;
  const m = c.month;
  const planned = c.piecesPerMonth;
  const included = c.hoursPerMonth * 60;
  const retainerReady = stageIndex(life.stage) >= stageIndex('pilot') || life.retainer !== null;
  const tiles = [
    {
      label: 'Published this month',
      value: planned > 0 ? `${m.published} of ${planned}` : String(m.published),
      hint: planned > 0 ? 'Against the plan' : 'No monthly plan set',
      ring: planned > 0 ? Math.min(1, m.published / planned) : null,
    },
    {
      label: 'Hours this month',
      value: minutesLabel2(m.minutes),
      hint: `${included > 0 ? `of ${minutesLabel2(included)} included, ` : ''}${minutesLabel2(m.billableMinutes)} billable${included > 0 && m.billableMinutes > included ? ', over the hours' : ''}`,
      ring: null,
    },
    { label: 'For them to look at', value: `${m.inReview} waiting, ${m.overdue} late`, hint: m.overdue > 0 ? 'Late means past their day' : 'In review now', ring: null },
  ];
  const facts = [
    [c.contactName, c.contactEmail].filter(Boolean).join(', '),
    c.channels.join(', '),
    c.retainerCents > 0 ? `${money(c.retainerCents, cur)} a month` : '',
    c.renewalDate ? `renews ${prettyDate(c.renewalDate)}` : '',
  ].filter(Boolean);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    logTime.mutate();
  };
  const minutes = parseDuration(minutesText);
  const field = 'mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]';
  const portalUrl = c.portalToken ? `${window.location.origin}/a/${c.portalToken}` : '';
  const openTime = () => {
    setSeg('work');
    setTiming(true);
  };
  const invoiceMonth = () => {
    setSeg('money');
    makeInvoice.mutate();
  };

  return (
    <Screen columns={false}>
      <header className="pt-lg">
        <BackLink to="/agency">Agency</BackLink>
        <div className="flex items-start justify-between gap-sm">
          <h1 className="min-w-0 text-[30px]">{c.name}</h1>
          <MoreMenu
            label={`More for ${c.name}`}
            items={[
              { key: 'edit', label: 'Edit client', icon: Pencil, onSelect: () => setEditing(true) },
              { key: 'billing', label: 'Billing details', icon: ReceiptText, onSelect: () => setEditing(true) },
              ...(portalUrl ? [{ key: 'link', label: 'Open client link', icon: ExternalLink, onSelect: () => window.open(portalUrl, '_blank', 'noopener') }] : []),
              { key: 'time', label: 'Log time', icon: Clock, onSelect: openTime },
              { key: 'invoice', label: 'Invoice this month', icon: FilePlus, onSelect: invoiceMonth, disabled: makeInvoice.isPending },
            ]}
          />
        </div>
        <div className="mt-xs flex flex-wrap items-center gap-xs">
          <StatusTag tone={CLIENT_STATUS_TONE[c.status]}>{AGENCY_STATUS_NAME[c.status]}</StatusTag>
          <StatusTag tone={CLIENT_HEALTH_TONE[c.health]}>{AGENCY_HEALTH_NAME[c.health]}</StatusTag>
          {c.campaignName && <StatusTag tone="info">{`Army: ${c.campaignName}`}</StatusTag>}
        </div>
        {facts.length > 0 && (
          <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">
            <Inert text={facts.join(' · ')} />
          </p>
        )}
        {c.notes && (
          <Fold className="mt-sm" title="Notes">
            <p className="m-0 whitespace-pre-wrap text-[14px] font-semibold text-ink-soft">
              <Inert text={c.notes} />
            </p>
          </Fold>
        )}
      </header>

      <ClientNotice page={d} portalUrl={portalUrl} onSetPassword={() => setPasswordOpen(true)} onAnswers={() => setAnswersOpen(true)} />

      <div className="mt-md">
        <LifecycleCard client={c} life={life} compact />
      </div>

      {d.onboarding.answers && d.onboarding.done && (
        <Fold className="mt-md" title="What they told you" hint={d.onboarding.at ? `sent ${prettyDate(d.onboarding.at.slice(0, 10))}` : undefined} open={answersOpen} onOpenChange={setAnswersOpen}>
          <TheirAnswers clientId={c.id} answers={d.onboarding.answers} />
        </Fold>
      )}

      <Sheet open={passwordOpen} onClose={() => setPasswordOpen(false)} title={`Password for ${c.name}`}>
        {passwordOpen && <PortalSecurityCard client={c} life={life} />}
        <div className="mt-md pb-xl">
          <Button onClick={() => setPasswordOpen(false)}>Done</Button>
        </div>
      </Sheet>

      <div className="mt-md grid grid-cols-2 gap-sm md:grid-cols-3">
        {tiles.map((t, i) => (
          <StatTile key={t.label} label={t.label} value={t.value} hint={t.hint} className={bento(i, tiles.length, 2, 3)}>
            {t.ring !== null && (
              <span className="mt-xs block">
                <Ring value={t.ring} size={40} stroke={5} color="var(--color-r4)" label={`${m.published} of ${planned} published`} />
              </span>
            )}
          </StatTile>
        ))}
      </div>

      <div className="mt-lg">
        <Segmented label="Show" value={seg} onChange={(v) => setSeg(v)} options={SEGMENTS} />
      </div>

      {seg === 'work' && (
        <>
          <Section id="pipeline-heading" title="Pipeline">
            {/* A phone always opens it as a list (`useView`); a laptop opens the board unless the URL says otherwise. */}
            <AgencyPipeline clientId={id} />
          </Section>

          {d.byChannel.length > 0 && (
            <Fold className="mt-md" title="By channel" hint={String(d.byChannel.length)}>
              <ul className="flex list-none flex-col gap-xs p-0 m-0">
                {d.byChannel.map((ch) => {
                  const total = Math.max(1, ch.published + ch.open);
                  return (
                    <li key={ch.channel} className="rounded-tile bg-card p-sm shadow-toy-soft">
                      <div className="flex items-baseline justify-between gap-sm">
                        <span className="min-w-0 text-[16px] font-bold">{ch.channel}</span>
                        <span className="shrink-0 text-[14px] font-bold text-ink-soft">{`${ch.published} live, ${ch.open} open`}</span>
                      </div>
                      <div className="mt-xs h-[8px] overflow-hidden rounded-pill bg-line" role="img" aria-label={`${ch.published} of ${total} live`}>
                        <div className="h-full rounded-pill" style={{ width: `${Math.round((ch.published / total) * 100)}%`, background: 'var(--color-r4)' }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Fold>
          )}

          <Section
            id="time-heading"
            title="Time"
            lede={COPY.timeLede}
            action={
              <Button size="sm" variant="outline" onClick={() => setTiming(true)}>
                Log time
              </Button>
            }
          >
            <ul className="flex list-none flex-col gap-xs p-0 m-0">
              {d.time.map((t) => (
                <li key={t.id} className="flex items-center gap-sm rounded-tile bg-card p-sm shadow-toy-soft">
                  <div className="min-w-0 flex-1">
                    <p className="m-0 text-[16px] font-bold">
                      {minutesLabel2(t.minutes)}
                      <span className="ml-xs text-[14px] font-semibold text-ink-soft">{prettyDate(t.day)}</span>
                    </p>
                    {(t.itemTitle || t.note) && (
                      <p className="m-0 text-[14px] font-semibold text-ink-soft">
                        <Inert text={[t.itemTitle, t.note].filter(Boolean).join(', ')} />
                      </p>
                    )}
                  </div>
                  <StatusTag tone={t.billable ? 'good' : 'neutral'}>{t.billable ? 'Billable' : 'Not billable'}</StatusTag>
                  <Button variant="ghost" size="sm" onClick={() => removeTime.mutate(t.id)} disabled={removeTime.isPending} aria-label={`Remove ${minutesLabel2(t.minutes)} on ${t.day}`}>
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
            {d.time.length === 0 && <p className="m-0 text-[14px] font-semibold text-ink-soft">{COPY.timeEmpty}</p>}
          </Section>
        </>
      )}

      {seg === 'money' && (
        <>
          <Section
            id="invoices-heading"
            title="Invoices"
            action={
              <div className="flex items-center gap-xs">
                <Button size="sm" onClick={() => makeInvoice.mutate()} disabled={makeInvoice.isPending}>
                  {makeInvoice.isPending ? 'Making' : 'Invoice this month'}
                </Button>
                <MoreMenu label="More for invoices" items={[{ key: 'new', label: 'New invoice', icon: FilePlus, onSelect: () => setNewInvoice(true) }]} />
              </div>
            }
          >
            {makeInvoice.isError && (
              <p role="alert" className="mb-sm m-0 text-[14px] font-bold">
                {COPY.invoiceFailed}
              </p>
            )}
            <AgencyInvoices clientId={id} adding={newInvoice} onAdding={setNewInvoice} />
          </Section>

          <Section id="retainer-heading" title="Retainer" lede={retainerReady ? COPY.retainerLede : undefined}>
            {retainerReady ? <RetainerCard client={c} life={life} currency={cur} /> : <p className="m-0 text-[12px] font-bold text-ink-soft">{COPY.retainerLater}</p>}
          </Section>
        </>
      )}

      {seg === 'paper' && (
        <>
          <Section id="agreements-heading" title="Agreements" lede={COPY.agreementLede}>
            <AgencyContracts clientId={id} />
          </Section>
          <div className="mt-lg">
            <ClientDocs clientId={id} />
          </div>
        </>
      )}

      {seg === 'link' && (
        <Section id="link-heading" title="Client link" lede={COPY.linkLede}>
          <ClientLink client={c} life={life} />
        </Section>
      )}

      <Sheet open={timing} onClose={() => setTiming(false)} title="Log time">
        <form onSubmit={submit}>
          <div className="grid grid-cols-2 gap-sm">
            <label className="block text-[14px] font-bold">
              How long
              <input value={minutesText} onChange={(e) => setMinutesText(e.target.value)} placeholder="1h 30m" inputMode="text" className={field} />
            </label>
            <label className="block text-[14px] font-bold">
              Day
              <input type="date" value={day} max={today} onChange={(e) => setDay(e.target.value)} className={field} />
            </label>
          </div>
          <label className="mt-sm block text-[14px] font-bold">
            Deliverable, if it was for one
            <select value={itemId} onChange={(e) => setItemId(e.target.value)} className={field}>
              <option value="">Not for one deliverable</option>
              {(items.data?.items ?? []).map((it) => (
                <option key={it.id} value={it.id}>
                  {it.title}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-sm block text-[14px] font-bold">
            Note
            <input value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="Optional" className={field} />
          </label>
          <div className="mt-sm">
            <Toggle compact on={billable} onChange={setBillable} label="Billable" hint="Counts towards the hours the client pays for." />
          </div>
          {logTime.isError && (
            <p role="alert" className="mt-sm m-0 text-[14px] font-bold">
              {COPY.timeFailed}
            </p>
          )}
          <div className="mt-md pb-xl">
            <Button type="submit" disabled={logTime.isPending || !minutes || !day}>
              {logTime.isPending ? 'Saving' : 'Log time'}
            </Button>
          </div>
        </form>
      </Sheet>

      <ClientSheet
        open={editing}
        client={c}
        onClose={() => {
          setEditing(false);
          invalidate();
        }}
      />
    </Screen>
  );
}

/**
 * One line at the top of the client page, at most, in this order: the client asked for a new password (with their reason, Set a new
 * password and Dismiss); the client has not finished onboarding (with Copy link); they finished it in the last seven days (See answers).
 */
function ClientNotice({ page, portalUrl, onSetPassword, onAnswers }: { page: AgencyClientPage; portalUrl: string; onSetPassword: () => void; onAnswers: () => void }) {
  const qc = useQueryClient();
  const { copy, said } = useCopy();
  const dismiss = useMutation({ mutationFn: () => api.agencyPasswordRequestClose(page.client.id), onSuccess: () => qc.invalidateQueries({ queryKey: ['agency'] }) });
  const name = page.client.name;
  const ask = page.lifecycle.password.request;
  const box = 'no-print mt-md flex flex-wrap items-center gap-xs rounded-tile p-sm';
  if (ask) {
    return (
      <div role="status" className={box} style={{ background: 'var(--tint-yellow)' }}>
        <p className="m-0 min-w-0 flex-1 basis-[220px] text-[14px] font-bold">
          {`${name} asked for a new password`}
          {ask.reason && (
            <span className="block font-semibold text-ink-soft">
              <Inert text={`“${ask.reason}”`} />
            </span>
          )}
        </p>
        <Button size="sm" onClick={onSetPassword}>
          Set a new password
        </Button>
        <Button size="sm" variant="ghost" onClick={() => dismiss.mutate()} disabled={dismiss.isPending}>
          Dismiss
        </Button>
      </div>
    );
  }
  const ob = page.onboarding;
  if (ob.needed && !ob.done) {
    return (
      <div role="status" className={`${box} bg-card shadow-toy-soft`}>
        <p className="m-0 min-w-0 flex-1 basis-[220px] text-[14px] font-bold">{`Waiting for ${name} to finish onboarding`}</p>
        {portalUrl && (
          <Button size="sm" variant="outline" onClick={() => void copy(portalUrl)}>
            {said ?? 'Copy link'}
          </Button>
        )}
      </div>
    );
  }
  const recent = ob.done && ob.at && Date.now() - Date.parse(ob.at) < 7 * 86_400_000;
  if (recent && ob.at) {
    return (
      <div role="status" className={box} style={{ background: 'var(--tint-green)' }}>
        <p className="m-0 min-w-0 flex-1 basis-[220px] text-[14px] font-bold">{`${name} finished onboarding on ${prettyDate(ob.at.slice(0, 10))}`}</p>
        <Button size="sm" variant="outline" onClick={onAnswers}>
          See answers
        </Button>
      </div>
    );
  }
  return null;
}

const ANSWER_FIELDS: { key: Exclude<keyof OnboardingAnswers, 'brief' | 'references'>; label: string }[] = [
  { key: 'legalName', label: 'Legal name' },
  { key: 'brands', label: 'Brands for this trial' },
  { key: 'addressLine', label: 'Address' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'pin', label: 'PIN code' },
  { key: 'gstin', label: 'GSTIN' },
  { key: 'pan', label: 'PAN' },
  { key: 'pocName', label: 'Point of contact' },
  { key: 'designation', label: 'Their role' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'billingEmail', label: 'Billing email' },
];

/** What the client wrote in the onboarding form, as a short list, with Edit to correct it. The brief's answers live in their agreement. */
function TheirAnswers({ clientId, answers }: { clientId: string; answers: OnboardingAnswers }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<OnboardingAnswers>(answers);
  const save = useMutation({
    mutationFn: () => api.agencyClientUpdate(clientId, { onboarding: parseOnboarding(draft) }),
    onSuccess: () => {
      setEditing(false);
      void qc.invalidateQueries({ queryKey: ['agency'] });
    },
  });
  const rows = ANSWER_FIELDS.filter((f) => answers[f.key].trim());
  return (
    <>
      <dl className="m-0 grid gap-xs sm:grid-cols-2">
        {rows.map((f) => (
          <div key={f.key}>
            <dt className="text-[12px] font-extrabold text-ink-soft">{f.label}</dt>
            <dd className="m-0 break-words text-[14px] font-semibold">
              <Inert text={answers[f.key]} />
            </dd>
          </div>
        ))}
        {answers.references.length > 0 && (
          <div className="sm:col-span-2">
            <dt className="text-[12px] font-extrabold text-ink-soft">Videos they like</dt>
            <dd className="m-0 whitespace-pre-wrap break-words text-[14px] font-semibold">
              <Inert text={answers.references.join('\n')} />
            </dd>
          </div>
        )}
      </dl>
      <div className="mt-sm">
        <Button size="sm" variant="outline" onClick={() => { setDraft(answers); setEditing(true); }}>
          Edit
        </Button>
      </div>
      <Sheet open={editing} onClose={() => setEditing(false)} title="What they told you">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          {ANSWER_FIELDS.map((f) => (
            <label key={f.key} className="mt-sm block text-[14px] font-bold">
              {f.label}
              <input value={draft[f.key]} onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })} className={FIELD} />
            </label>
          ))}
          {save.isError && (
            <p role="alert" className="mt-sm m-0 text-[14px] font-bold">
              That did not save. Try again.
            </p>
          )}
          <div className="mt-md pb-xl">
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? 'Saving' : 'Save'}
            </Button>
          </div>
        </form>
      </Sheet>
    </>
  );
}
