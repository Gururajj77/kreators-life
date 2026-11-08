import { money, type TodayAgency, type TodayEvent, LOCALE } from '@kreators/shared';
import { ArrowUpRight, Footprints, PartyPopper, UsersRound, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router';
import { Icon } from './Icon';
import { StatusTag } from './StatusTag';
import { clockTime } from '../lib/date';

/** A short day for a row ("4 Nov"), from a YYYY-MM-DD day, read as that calendar day and never shifted by a zone. */
const shortDay = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString(LOCALE, { day: 'numeric', month: 'short', timeZone: 'UTC' });

const ROW = 'toy toy-soft flex min-h-[44px] w-full items-center gap-sm rounded-tile bg-card px-sm py-xs text-left text-ink';

/** One row on Daily that opens the thing it names. */
function Row({ to, title, meta, tag }: { to: string; title: string; meta: string; tag?: React.ReactNode }) {
  return (
    <li>
      <Link to={to} className={ROW}>
        <span className="min-w-0 flex-1">
          <span className="block text-subhead font-semibold">{title}</span>
          <span className="block text-caption text-ink-soft">{meta}</span>
        </span>
        {tag}
        <Icon icon={ArrowUpRight} size={16} className="shrink-0 text-ink-mute" />
      </Link>
    </li>
  );
}

/**
 * Agency on Daily, under Tasks: what waits on the person today across their clients. Pieces due today or late, the changes clients asked
 * for, retainers a client chose, invoices due or past due. Each row opens the client (or the invoice). Nothing shows when nothing waits.
 */
export function AgencyToday({ agency }: { agency: TodayAgency }) {
  const { due, dueTotal, changeAsks, changeClientId, retainerToConfirm, invoicesDue } = agency;
  const total = dueTotal + changeAsks + retainerToConfirm.length + invoicesDue.length;
  if (total === 0) return null;
  return (
    <section className="mt-lg" aria-labelledby="agency-today-heading">
      <div className="flex items-center justify-between gap-sm">
        <h2 id="agency-today-heading" className="text-title2">
          Agency today
        </h2>
        <Link to="/agency" className="flex min-h-[44px] shrink-0 items-center text-subhead text-ink-soft underline underline-offset-4 hover:text-ink">
          Open Agency
        </Link>
      </div>
      <p className="mt-xs m-0 text-subhead text-ink-soft">What your clients are waiting on. Tap a row to open it.</p>
      <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
        {changeAsks > 0 && (
          <Row
            to={changeClientId ? `/agency/${changeClientId}` : '/agency'}
            title={changeAsks === 1 ? 'A client asked for a change' : `Clients asked for ${changeAsks} changes`}
            meta="Make the change, then send the piece back for review."
            tag={<StatusTag tone="warn">Change asked</StatusTag>}
          />
        )}
        {retainerToConfirm.map((r) => (
          <Row key={r.id} to={`/agency/${r.clientId}`} title={`${r.client} chose a retainer`} meta={r.months ? `${r.months} ${r.months === 1 ? 'month' : 'months'}. Confirm it to start.` : 'Confirm it to start.'} tag={<StatusTag tone="info">To confirm</StatusTag>} />
        ))}
        {due.map((p) => (
          <Row key={p.id} to={`/agency/${p.clientId}`} title={p.title} meta={`${p.client}, due ${p.late ? shortDay(p.due) : 'today'}`} tag={<StatusTag tone={p.late ? 'bad' : 'warn'}>{p.late ? 'Late' : 'Due today'}</StatusTag>} />
        ))}
        {invoicesDue.map((i) => (
          <Row
            key={i.id}
            to={`/agency/invoices/${i.id}`}
            title={`Invoice ${i.number}, ${i.client}`}
            meta={`${money(i.cents, i.currency)}, due ${i.late ? shortDay(i.due) : 'today'}`}
            tag={<StatusTag tone={i.late ? 'bad' : 'warn'}>{i.late ? 'Past due' : 'Due today'}</StatusTag>}
          />
        ))}
      </ul>
      {dueTotal > due.length && (
        <p className="mt-xs m-0 text-subhead text-ink-soft">
          Showing {due.length} of {dueTotal} pieces due. Agency lists the rest.
        </p>
      )}
    </section>
  );
}

const EVENT_ICON: Record<TodayEvent['kind'], LucideIcon> = { event: PartyPopper, run: Footprints, circle: UsersRound };
const EVENT_KIND: Record<TodayEvent['kind'], string> = { event: 'Party event', run: 'Run', circle: 'Circle table' };

/** The events, runs and circle tables the person signed up for that start today, each one tap from its page. */
export function TodayEvents({ events }: { events: TodayEvent[] }) {
  if (events.length === 0) return null;
  return (
    <section className="mt-lg" aria-labelledby="events-today-heading">
      <h2 id="events-today-heading" className="text-title2">
        Today&rsquo;s events
      </h2>
      <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
        {events.map((e) => (
          <li key={`${e.kind}-${e.path}-${e.at}`}>
            <Link to={e.path} className={ROW}>
              <span className="flex size-[32px] shrink-0 items-center justify-center rounded-pill bg-paper text-ink-soft">
                <Icon icon={EVENT_ICON[e.kind]} size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-subhead font-semibold">{e.title}</span>
                <span className="block text-caption text-ink-soft">
                  {EVENT_KIND[e.kind]}, {clockTime(e.at)}
                </span>
              </span>
              <Icon icon={ArrowUpRight} size={16} className="shrink-0 text-ink-mute" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
