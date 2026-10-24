import { RELATIONSHIPS } from '@kreators/shared';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router';
import { Avatar } from '../components/Avatar';
import { publicApi } from '../lib/api';
import { SiteLayout } from './SiteLayout';

/** Anyone with the code can check a certificate is real. */
export function CertificatePage() {
  const { code = '' } = useParams();
  const q = useQuery({ queryKey: ['certificate', code], queryFn: () => publicApi.certificate(code) });
  const c = q.data?.certificate;
  return (
    <SiteLayout wide={false}>
      <div className="pt-lg">
        <Link to="/" className="inline-flex min-h-[44px] items-center gap-xs text-[14px] font-bold text-ink-soft">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 5l-7 7 7 7" />
          </svg>
          Kreators Life
        </Link>
        {q.isPending && <p className="m-0 text-[16px] font-semibold text-ink-soft">Checking…</p>}
        {q.isError && (
          <div role="alert" className="mt-md rounded-card bg-card p-md shadow-toy-soft">
            <h1 className="text-[30px]">No certificate with that code</h1>
            <p className="mt-xs m-0 text-[16px] font-semibold text-ink-soft">Check the code for typos. Certificates are issued by Kreators School and by creators’ courses in the Shop.</p>
          </div>
        )}
        {c && (
          <article className="mt-md rounded-card border-4 border-ink bg-card p-lg text-center shadow-toy">
            <div className="flex justify-center gap-xs" aria-hidden="true">
              {RELATIONSHIPS.map((r) => (
                <Avatar key={r.key} relationship={r.key} size={28} decorative still />
              ))}
            </div>
            <p className="mt-md m-0 text-[14px] font-extrabold uppercase tracking-wide text-ink-mute">Certificate of completion</p>
            <h1 className="mt-xs text-[clamp(28px,5vw,40px)] leading-tight">{c.learnerName}</h1>
            <p className="mt-xs m-0 text-[18px] font-semibold text-ink-soft">completed</p>
            <p className="mt-xs m-0 text-[24px] font-extrabold">{c.productTitle}</p>
            <p className="mt-sm m-0 text-[16px] font-semibold text-ink-soft">
              taught by {c.ownerName}, issued {new Date(c.issuedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
            <p className="mt-md m-0 rounded-pill bg-paper px-md py-xs font-mono text-[14px] font-bold tracking-widest">{c.code}</p>
            <p className="mt-xs m-0 text-[12px] font-semibold text-ink-mute">Verified against Kreators Life records at the time of viewing.</p>
          </article>
        )}
      </div>
    </SiteLayout>
  );
}
