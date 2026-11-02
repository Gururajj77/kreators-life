import { AGENCY_HEALTH_NAME, AGENCY_STATUS_NAME, CLIENT_HEALTH_TONE, CLIENT_STATUS_TONE, minutesLabel2, money, type AgencyClient as ClientData } from '@kreators/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import { AgencyContracts } from '../components/AgencyContracts';
import { ClientDocs } from '../components/AgencyDocs';
import { LifecycleCard, PortalSecurityCard, RetainerCard } from '../components/AgencyLifecycle';
import { StageBar } from '../components/StageBar';
import { AgencyInvoices } from '../components/AgencyInvoices';
import { AgencyPipeline } from '../components/AgencyPipeline';
import { Button } from '../components/Button';
import { StatTile } from '../components/Charts';
import { ClientLink } from '../components/ClientLink';
import { ClientSheet } from '../components/ClientSheet';
import { Inert } from '../components/Inert';
import { BackLink } from '../components/PageHeader';
import { Ring } from '../components/Ring';
import { Screen } from '../components/Screen';
import { Section } from '../components/Section';
import { StatusTag } from '../components/StatusTag';
import { Toggle } from '../components/Toggle';
import { api } from '../lib/api';
import { bento } from '../lib/bento';
import { prettyDate, todayLocal } from '../lib/date';
import { useAuthed } from '../lib/queries';

const COPY = {
  loading: 'Loading this client.',
  gone: 'No client here. It may have been removed.',
  retry: 'Could not load this client. Try again in a moment.',
  timeLede: 'Hours you spent for this client. Billable hours count towards what they pay for.',
  timeFailed: 'That did not save. Check the time and try again.',
  timeEmpty: 'No time logged yet.',
  invoiceLede: 'Drafts, sent and paid. Open one to design it, send it or copy it for next month.',
  agreementLede: 'Trial terms, retainers and project agreements for this client.',
  linkLede: 'One page your client can open to see their work. You choose what shows, and a password keeps it private.',
  lifecycleLede: 'From the first enquiry to monthly delivery. The client sees the same bar at their link.',
  retainerLede: 'After the pilot: the client picks how many months, and each month makes its own invoice and pieces.',
  billingLede: 'What goes under "Billed to" on invoices and in agreements.',
  noBilling: 'No billing details yet. Add them so invoices fill in by themselves.',
  invoiceFailed: 'Could not make the invoice. Set a retainer or a fee on a published deliverable first.',
};

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

/** The dashboard for one client: the numbers, the pipeline, time, invoices, agreements and the link the client can open. */
export function AgencyClient() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const today = todayLocal();
  const q = useAuthed(['agency', 'client', id], () => api.agencyClient(id));
  const items = useAuthed(['agency', 'items', 'client', id, 'time'], () => api.agencyItems(`client=${id}&size=100`));
  const [editing, setEditing] = useState(false);
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
      invalidate();
    },
  });
  const removeTime = useMutation({ mutationFn: (entry: string) => api.agencyTimeRemove(entry), onSuccess: invalidate });
  const makeInvoice = useMutation({ mutationFn: () => api.agencyInvoiceFromClient(id), onSuccess: (r) => nav(`/agency/invoices/${r.invoice.id}`) });

  const d = q.data;
  if (q.isPending) {
    return (
      <Screen columns={false}>
        <p className="pt-lg m-0 text-[16px] font-semibold text-ink-soft">{COPY.loading}</p>
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
  const cur = d.settings.currency;
  const m = c.month;
  const planned = c.piecesPerMonth;
  const included = c.hoursPerMonth * 60;
  const tiles = [
    { label: 'Retainer a month', value: money(c.retainerCents, cur), hint: c.retainerCents === 0 ? 'None set' : undefined },
    {
      label: 'Published this month',
      value: planned > 0 ? `${m.published} of ${planned}` : String(m.published),
      hint: planned > 0 ? 'Against the plan' : 'No monthly plan set',
      ring: planned > 0 ? Math.min(1, m.published / planned) : null,
    },
    { label: 'Hours this month', value: minutesLabel2(m.minutes), hint: included > 0 ? `of ${minutesLabel2(included)} they pay for` : 'No hours set' },
    { label: 'Billable hours', value: minutesLabel2(m.billableMinutes), hint: included > 0 && m.billableMinutes > included ? 'Over the hours' : 'This month' },
    { label: 'Waiting for them', value: String(m.inReview), hint: 'In review' },
    { label: 'Late', value: String(m.overdue), hint: m.overdue > 0 ? 'Past their day' : 'None' },
  ];
  const submit = (e: FormEvent) => {
    e.preventDefault();
    logTime.mutate();
  };
  const minutes = parseDuration(minutesText);
  const field = 'mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]';
  const b = c.billing;

  return (
    <Screen columns={false}>
      <header className="pt-lg">
        <BackLink to="/agency">Agency</BackLink>
        <div className="flex items-start justify-between gap-sm">
          <h1 className="min-w-0 text-[30px]">{c.name}</h1>
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            Edit
          </Button>
        </div>
        <div className="mt-xs flex flex-wrap items-center gap-xs">
          <StatusTag tone={CLIENT_STATUS_TONE[c.status]}>{AGENCY_STATUS_NAME[c.status]}</StatusTag>
          <StatusTag tone={CLIENT_HEALTH_TONE[c.health]}>{AGENCY_HEALTH_NAME[c.health]}</StatusTag>
          {c.campaignName && <StatusTag tone="info">{`Army: ${c.campaignName}`}</StatusTag>}
        </div>
        {(c.contactName || c.contactEmail) && (
          <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">
            <Inert text={[c.contactName, c.contactEmail].filter(Boolean).join(', ')} />
          </p>
        )}
        {c.channels.length > 0 && <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">{`Channels: ${c.channels.join(', ')}`}</p>}
        {c.renewalDate && <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">{`Renews ${prettyDate(c.renewalDate)}`}</p>}
        {c.flags.length > 0 && (
          <ul className="mt-sm m-0 list-none rounded-tile p-sm text-[14px] font-bold" style={{ background: 'var(--tint-yellow)' }}>
            {c.flags.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        )}
      </header>

      <div className="mt-md rounded-card bg-card p-md shadow-toy-soft">
        <StageBar stage={d.lifecycle.stage} />
      </div>

      <div className="mt-md grid grid-cols-2 gap-sm md:grid-cols-3">
        {tiles.map((t, i) => (
          <StatTile key={t.label} label={t.label} value={t.value} hint={t.hint} className={bento(i, tiles.length, 2, 3)}>
            {t.ring !== undefined && t.ring !== null && (
              <span className="mt-xs block">
                <Ring value={t.ring} size={40} stroke={5} color="var(--color-r4)" label={`${m.published} of ${planned} published`} />
              </span>
            )}
          </StatTile>
        ))}
      </div>

      <Section id="lifecycle-heading" title="The way through" lede={COPY.lifecycleLede}>
        <LifecycleCard client={c} life={d.lifecycle} />
      </Section>

      <Section id="link-heading" title="Client link" lede={COPY.linkLede}>
        <div className="flex flex-col gap-sm">
          <PortalSecurityCard client={c} life={d.lifecycle} />
          <ClientLink client={c} />
        </div>
      </Section>

      <Section id="retainer-heading" title="Retainer" lede={COPY.retainerLede}>
        <RetainerCard client={c} life={d.lifecycle} currency={cur} />
      </Section>

      <Section id="pipeline-heading" title="Pipeline">
        <AgencyPipeline clientId={id} />
      </Section>

      {d.byChannel.length > 0 && (
        <Section id="channels-heading" title="By channel" lede="What went live this month and what is still open, on each channel.">
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
        </Section>
      )}

      <Section id="time-heading" title="Time" lede={COPY.timeLede}>
        <form onSubmit={submit} className="rounded-card bg-card p-md shadow-toy-soft">
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
          <div className="mt-sm">
            <Button type="submit" disabled={logTime.isPending || !minutes || !day}>
              {logTime.isPending ? 'Saving' : 'Log time'}
            </Button>
          </div>
        </form>
        <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
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
              <Button variant="outline" size="sm" onClick={() => removeTime.mutate(t.id)} disabled={removeTime.isPending} aria-label={`Remove ${minutesLabel2(t.minutes)} on ${t.day}`}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
        {d.time.length === 0 && <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">{COPY.timeEmpty}</p>}
      </Section>

      <Section
        id="invoices-heading"
        title="Invoices"
        lede={COPY.invoiceLede}
        action={
          <Button size="sm" onClick={() => makeInvoice.mutate()} disabled={makeInvoice.isPending}>
            {makeInvoice.isPending ? 'Making' : 'Invoice this month'}
          </Button>
        }
      >
        {makeInvoice.isError && (
          <p role="alert" className="mb-sm m-0 text-[14px] font-bold">
            {COPY.invoiceFailed}
          </p>
        )}
        <AgencyInvoices clientId={id} />
      </Section>

      <Section id="agreements-heading" title="Agreements" lede={COPY.agreementLede}>
        <AgencyContracts clientId={id} />
      </Section>

      <div className="mt-lg">
        <ClientDocs clientId={id} />
      </div>

      <Section id="billing-heading" title="Billing details and notes" lede={COPY.billingLede} action={<Button variant="outline" size="sm" onClick={() => setEditing(true)}>Edit</Button>}>
        <div className="rounded-card bg-card p-md shadow-toy-soft">
          {b.name || b.line || b.address || b.taxIds.length > 0 || b.phone ? (
            <dl className="m-0 grid grid-cols-1 gap-xs text-[14px] font-semibold text-ink-soft md:grid-cols-2">
              {[
                ['Name', b.name],
                ['Legal name', b.line],
                ['Address', b.address],
                ['Email', b.email],
                ['Phone', b.phone],
                ...b.taxIds.map((t) => [t.label, t.value] as [string, string]),
              ]
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div key={`${k}-${v}`}>
                    <dt className="font-extrabold text-ink">{k}</dt>
                    <dd className="m-0">
                      <Inert text={v ?? ''} />
                    </dd>
                  </div>
                ))}
            </dl>
          ) : (
            <p className="m-0 text-[14px] font-semibold text-ink-soft">{COPY.noBilling}</p>
          )}
          {c.notes && (
            <div className="mt-md">
              <p className="m-0 text-[14px] font-extrabold">Notes</p>
              <p className="mt-xs m-0 whitespace-pre-wrap text-[14px] font-semibold text-ink-soft">
                <Inert text={c.notes} />
              </p>
            </div>
          )}
        </div>
      </Section>

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
