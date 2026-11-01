import { LEGAL_VERSION, type BusinessInfo } from '@kreators/shared';
import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { tie } from '../lib/text';
import { SiteLayout } from './SiteLayout';

/** The support address that was already on these pages before the owner sets a business email. */
export const FALLBACK_EMAIL = 'brandingbum@gmail.com';

/** "1 November 2026" from the version day, in UTC so every reader sees the same date. */
export function versionDate(version: string = LEGAL_VERSION): string {
  return new Date(`${version}T00:00:00Z`).toLocaleDateString('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' });
}

export function H({ children }: { children: ReactNode }) {
  return <h2 className="mt-lg text-[24px]">{children}</h2>;
}
export function P({ children }: { children: ReactNode }) {
  return <p className="mt-xs m-0 text-pretty text-[16px] font-semibold leading-relaxed text-ink-soft">{children}</p>;
}
export function Strong({ children }: { children: ReactNode }) {
  return <span className="font-extrabold text-ink">{children}</span>;
}
export function A({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="underline underline-offset-4">
      {children}
    </Link>
  );
}
export function Mail({ address }: { address: string }) {
  return <span className="select-all font-extrabold text-ink">{address}</span>;
}

/** A plain list inside a page: one short line each. */
export function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="mt-xs m-0 grid list-disc gap-xs pl-md text-[16px] font-semibold leading-relaxed text-ink-soft">
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ul>
  );
}

/** A table that reads as a table on a laptop and as stacked cards on a phone. */
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
                <span className={j === 0 ? 'font-extrabold text-ink' : ''}>{cell}</span>
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** The page frame every legal page shares: the eyebrow, the title, the short line under it, then the sections. */
export function LegalPage({ title, lede, wide = false, children }: { title: string; lede: ReactNode; wide?: boolean; children: ReactNode }) {
  return (
    <SiteLayout wide={wide}>
      <header className="pt-lg">
        <p className="m-0 type-eyebrow text-ink-mute">kreators.app</p>
        <h1 className="type-hook mt-sm text-[clamp(40px,8vw,64px)]">{tie(title)}</h1>
        <P>{lede}</P>
      </header>
      <section>{children}</section>
    </SiteLayout>
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
