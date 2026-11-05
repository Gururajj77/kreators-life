import { RELATIONSHIPS, LOCALE } from '@kreators/shared';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router';
import { Avatar } from '../components/Avatar';
import { BackLink } from '../components/PageHeader';
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
        <BackLink to="/">kreators.app</BackLink>
        {q.isPending && <p className="m-0 text-callout text-ink-soft">Checking…</p>}
        {q.isError && (
          <div role="alert" className="mt-md rounded-card bg-card p-md shadow-toy-soft">
            <h1 className="text-large-title">No certificate with that code</h1>
            <p className="mt-xs m-0 text-callout text-ink-soft">Check the code for typos. Certificates are issued by School on kreators.app and by creators’ courses in the Shop.</p>
          </div>
        )}
        {c && (
          <article className="mt-md rounded-card border-4 border-ink bg-card p-lg text-center shadow-toy">
            <div className="flex justify-center gap-xs" aria-hidden="true">
              {RELATIONSHIPS.map((r) => (
                <Avatar key={r.key} relationship={r.key} size={28} decorative still />
              ))}
            </div>
            <p className="mt-md m-0 type-eyebrow text-ink-mute">Certificate of completion</p>
            <h1 className="mt-xs text-display-3">{c.learnerName}</h1>
            <p className="mt-xs m-0 text-headline text-ink-soft">completed</p>
            <p className="mt-xs m-0 text-title2">{c.productTitle}</p>
            <p className="mt-sm m-0 text-callout text-ink-soft">
              taught by {c.ownerName}, issued {new Date(c.issuedAt).toLocaleDateString(LOCALE, { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
            <p className="mt-md m-0 rounded-pill bg-paper px-md py-xs font-mono text-subhead font-medium tracking-widest">{c.code}</p>
            <p className="mt-xs m-0 text-caption text-ink-mute">Verified against kreators.app records at the time of viewing.</p>
          </article>
        )}
      </div>
    </SiteLayout>
  );
}
