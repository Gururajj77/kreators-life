import { LEGAL_VERSION, LOCALE, type BusinessInfo } from '@kreators/shared';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { tie } from '../lib/text';
import { SiteLayout } from './SiteLayout';

/** The support address that was already on these pages before the owner sets a business email. */
export const FALLBACK_EMAIL = 'brandingbum@gmail.com';

/** "3 November 2026" from the version day, in UTC so every reader sees the same date. */
export function versionDate(version: string = LEGAL_VERSION): string {
  return new Date(`${version}T00:00:00Z`).toLocaleDateString(LOCALE, { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Whether the text sits on a reading page (terms, privacy, refunds, copyright, subprocessors, licences). There a paragraph is long reading
 * text: `prose-long` keeps full-width lines (CLAUDE.md, no orphan words) and the density check leaves it alone. Pricing and Contact are
 * not reading pages, so their paragraphs are held to the short-copy rules.
 */
const Reading = createContext(false);
const LONG = 'prose-long';
const READ = (on: boolean) => (on ? LONG : 'text-pretty');

export function H({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h2 id={id} className="mt-lg scroll-mt-lg text-[24px]">
      {children}
    </h2>
  );
}
export function P({ children }: { children: ReactNode }) {
  const reading = useContext(Reading);
  return <p className={`mt-xs m-0 ${READ(reading)} text-[16px] font-semibold leading-relaxed text-ink-soft`}>{children}</p>;
}
export function Strong({ children }: { children: ReactNode }) {
  return <span className="font-extrabold text-ink">{children}</span>;
}
/** A link in the policy text. `hit` gives a link that stands nearly alone on its line (not inside a sentence) a 44px tall
 * tap area through an invisible ::before, so its look at rest is unchanged. */
export function A({ to, children, hit = false }: { to: string; children: ReactNode; hit?: boolean }) {
  return (
    <Link to={to} className={hit ? "relative underline underline-offset-4 before:absolute before:-inset-x-[4px] before:-inset-y-[13px] before:content-['']" : 'underline underline-offset-4'}>
      {children}
    </Link>
  );
}
export function Mail({ address }: { address: string }) {
  return <span className="select-all font-extrabold text-ink">{address}</span>;
}

/** A plain list inside a page: one short line each. */
export function Bullets({ items }: { items: ReactNode[] }) {
  const long = useContext(Reading) ? LONG : '';
  return (
    <ul className={`mt-xs m-0 grid list-disc gap-xs pl-md ${long} text-[16px] font-semibold leading-relaxed text-ink-soft`}>
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ul>
  );
}

/** A table that reads as a table on a laptop and as stacked cards on a phone. */
/** A narrow table cell never ends on one word: a short two-word cell ("Legitimate interests") stays on one line, a longer one ties its last two words. */
const keepTail = (s: string): string => {
  const words = s.trim().split(/\s+/);
  return words.length === 2 && s.length <= 28 ? words.join(' ') : tie(s);
};

export function Grid({ head, rows, label }: { head: string[]; rows: ReactNode[][]; label: string }) {
  return (
    <table aria-label={label} className="mt-sm block w-full border-collapse text-left text-[14px] font-semibold text-ink-soft md:table">
      <thead className="hidden md:table-header-group">
        <tr>
          {head.map((h) => (
            <th key={h} scope="col" className="border-b border-line px-sm py-xs text-[12px] font-bold uppercase tracking-wide text-ink-mute">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="block md:table-row-group">
        {rows.map((cells, i) => (
          <tr key={i} className="mb-sm block rounded-tile bg-card p-sm md:mb-0 md:table-row md:rounded-none md:bg-transparent md:p-0">
            {cells.map((cell, j) => (
              <td key={j} className="block py-xs md:table-cell md:border-b md:border-line md:px-sm md:py-sm md:align-top">
                <span className="block text-[12px] font-bold uppercase tracking-wide text-ink-mute md:hidden">{head[j]}</span>
                <span className={j === 0 ? 'font-extrabold text-ink' : ''}>{typeof cell === 'string' ? keepTail(cell) : cell}</span>
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * The page frame every legal page shares: the eyebrow, the title, a one-line lede, the version in small type, and the one action people
 * come for (write to us, send a notice) before the reading body. `reading` (on unless said) marks the body as a reading page.
 */
export function LegalPage({
  title,
  lede,
  note,
  action,
  wide = false,
  reading = true,
  children,
}: {
  title: string;
  lede: ReactNode;
  /** A small line under the lede, such as the version and its date. */
  note?: ReactNode;
  /** The one action of the page, shown before the reading body. */
  action?: ReactNode;
  wide?: boolean;
  reading?: boolean;
  children: ReactNode;
}) {
  return (
    <SiteLayout wide={wide}>
      <header className="pt-lg">
        <p className="m-0 type-eyebrow text-ink-mute">kreators.app</p>
        <h1 className="type-hook mt-sm text-[clamp(40px,8vw,64px)]">{tie(title)}</h1>
        <p className="mt-xs m-0 text-[16px] font-semibold leading-relaxed text-ink-soft">{lede}</p>
        {note && <p className="mt-xs m-0 text-[14px] font-semibold text-ink-mute">{note}</p>}
        {action && <div className="mt-sm flex flex-wrap gap-sm">{action}</div>}
      </header>
      <Reading.Provider value={reading}>
        <section data-reading={reading ? '' : undefined}>{children}</section>
      </Reading.Provider>
    </SiteLayout>
  );
}

/** The quiet pill a legal page uses for its one action. */
export function ActionLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="toy toy-soft inline-flex min-h-[44px] items-center rounded-pill bg-card px-md text-[14px] font-bold">
      {children}
    </Link>
  );
}

// ---- the business behind kreators.app, set by the owner on the server; nothing is written here ----
let cached: Promise<BusinessInfo | null> | null = null;
function loadBusiness(): Promise<BusinessInfo | null> {
  cached ??= fetch('/api/public/business')
    .then((r) => (r.ok ? (r.json() as Promise<{ business?: BusinessInfo }>) : null))
    .then((b) => b?.business ?? null)
    .catch(() => null);
  return cached;
}
/** The business details, or null while they load or when they cannot be reached. */
export function useBusiness(): { business: BusinessInfo | null; loading: boolean } {
  const [business, setBusiness] = useState<BusinessInfo | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let live = true;
    void loadBusiness().then((b) => {
      if (!live) return;
      setBusiness(b);
      setLoading(false);
    });
    return () => {
      live = false;
    };
  }, []);
  return { business, loading };
}

/** The address people write to: the business email once the owner sets it, the old support address until then. */
export function contactEmail(b: BusinessInfo | null): string {
  return b?.email || FALLBACK_EMAIL;
}

/** One labelled fact, or an honest line when it is not set. `optional` facts are left out when empty. */
export function Fact({ label, value, unset, optional = false }: { label: string; value: string | undefined; unset: string; optional?: boolean }) {
  if (!value && optional) return null;
  return (
    <div className="rounded-tile bg-card p-sm">
      <p className="m-0 type-eyebrow text-ink-mute">{label}</p>
      <p className={`mt-xs m-0 whitespace-pre-line text-[16px] font-semibold ${value ? 'text-ink' : 'text-ink-soft'}`}>{value || unset}</p>
    </div>
  );
}

/** What an empty business field reads, the same on every page. */
export const NOT_SET = 'not set yet';

/** The Grievance Officer for people in India (DPDP Act, IT Rules), from the Worker variables the owner sets; each empty field says so. */
export function Grievance({ business, loading }: { business: BusinessInfo | null; loading: boolean }) {
  const unset = loading ? 'Loading.' : NOT_SET;
  return (
    <div className="mt-sm grid gap-sm md:grid-cols-3">
      <Fact label="Grievance Officer" value={business?.grievanceName} unset={unset} />
      <Fact label="Email" value={business?.grievanceEmail} unset={unset} />
      <Fact label="Phone" value={business?.grievancePhone} unset={unset} />
    </div>
  );
}
