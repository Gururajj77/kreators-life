import { PRODUCT_KIND_META } from '@kreators/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { Button } from '../components/Button';
import { BackLink } from '../components/PageHeader';
import { Screen } from '../components/Screen';
import { api } from '../lib/api';
import { captureRef, useSession } from '../lib/store';

export function Public() {
  const { handle = '' } = useParams();
  const location = useLocation();
  captureRef(location.search);
  const token = useSession((s) => s.token);
  const q = useQuery({ queryKey: ['public', handle, token], queryFn: () => api.publicPage(handle) });
  const follow = useMutation({ mutationFn: () => api.follow(handle), onSuccess: () => q.refetch() });
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const lead = useMutation({ mutationFn: () => api.lead(handle, { name, email, message }) });
  const d = q.data;

  return (
    <Screen tabs={false}>
      <header className="pt-lg">
        <BackLink to={token ? '/apps' : '/'}>Kreators Life</BackLink>
      </header>
      {q.isError && (
        <div className="mt-md rounded-card bg-card p-md text-center shadow-toy-soft">
          <p className="m-0 text-[18px] font-extrabold">No page with that name.</p>
        </div>
      )}
      {d && (
        <>
          <section className="mt-md rounded-card bg-ink p-md text-on-ink">
            {d.avatarUrl ? (
              <img src={d.avatarUrl} alt="" width={64} height={64} className="size-[64px] rounded-pill object-cover" />
            ) : (
              <span className="flex size-[64px] items-center justify-center rounded-pill bg-r2 font-display text-[30px] font-extrabold text-on-fill" aria-hidden="true">
                {d.name.slice(0, 1).toUpperCase()}
              </span>
            )}
            <div className="mt-sm flex items-center gap-xs">
              <h1 className="text-[30px]">{d.name}</h1>
              {d.isPro && <span className="rounded-pill bg-r7 px-sm py-xs text-[12px] font-extrabold text-white">Pro</span>}
            </div>
            <p className="m-0 text-[14px] font-bold text-white/70">
              @{d.handle}, {d.followers} {d.followers === 1 ? 'follower' : 'followers'}
            </p>
            {d.bio && <p className="mt-sm m-0 text-[16px] font-semibold leading-relaxed">{d.bio}</p>}
            {(d.socials.instagram || d.socials.youtube || d.socials.x || d.socials.website) && (
              <ul className="mt-sm flex list-none flex-wrap gap-xs p-0 m-0" aria-label="Links">
                {(
                  [
                    ['instagram', 'Instagram'],
                    ['youtube', 'YouTube'],
                    ['x', 'X'],
                    ['website', 'Website'],
                  ] as [keyof typeof d.socials, string][]
                )
                  .filter(([k]) => d.socials[k])
                  .map(([k, label]) => (
                    <li key={k}>
                      <a href={d.socials[k]} target="_blank" rel="noreferrer" className="toy inline-flex min-h-[40px] items-center rounded-pill bg-card px-sm text-[14px] font-bold text-ink">
                        {label}
                      </a>
                    </li>
                  ))}
              </ul>
            )}
            {token ? (
              <Button variant={d.following ? 'outline' : 'primary'} className={`mt-md ${d.following ? '' : 'bg-r2 text-on-fill'}`} onClick={() => follow.mutate()} disabled={follow.isPending}>
                {d.following ? 'Following' : 'Follow'}
              </Button>
            ) : (
              <Link to="/" className="toy mt-md inline-flex min-h-[48px] items-center rounded-pill bg-r2 px-md font-bold text-on-fill">
                Join to follow
              </Link>
            )}
          </section>

          {d.products.length > 0 && (
            <section className="mt-lg" aria-labelledby="shop-heading">
              <h2 id="shop-heading" className="text-[24px]">
                From {d.name}
              </h2>
              <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
                {d.products.map((p) => {
                  const meta = PRODUCT_KIND_META[p.kind];
                  const inner = (
                    <>
                      <span className="flex size-[48px] shrink-0 items-center justify-center rounded-pill bg-paper text-[24px]" aria-hidden="true">
                        {p.cover || meta.emoji}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[16px] font-bold leading-snug">{p.title}</span>
                        <span className="block text-[14px] font-semibold text-ink-soft">
                          {meta.name}
                          {p.kind === 'event' && p.startsAt ? `, ${new Date(p.startsAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}` : ''}
                          {p.rating ? `, rated ${p.rating}` : ''}
                        </span>
                      </span>
                      <span className="shrink-0 rounded-pill bg-ink px-sm py-xs text-[14px] font-extrabold text-on-ink">{p.kind === 'link' ? 'Open' : p.pricePoints === 0 && p.priceCents === 0 ? 'Free' : `${p.pricePoints} pts`}</span>
                    </>
                  );
                  const cls = 'toy toy-soft flex items-center gap-sm rounded-tile bg-card p-sm';
                  return (
                    <li key={p.id}>
                      {p.kind === 'link' && p.url ? (
                        <a href={p.url} target="_blank" rel="noreferrer" className={cls} onClick={() => void api.click(handle, p.id)}>
                          {inner}
                        </a>
                      ) : (
                        <Link to={`/p/${p.id}`} className={cls} onClick={() => void api.click(handle, p.id)}>
                          {inner}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {d.testimonials.length > 0 && (
            <section className="mt-lg" aria-labelledby="say-heading">
              <h2 id="say-heading" className="text-[24px]">
                What people say
              </h2>
              <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
                {d.testimonials.map((t) => (
                  <li key={t.id} className="rounded-tile bg-card p-sm shadow-toy-soft">
                    <p className="m-0 text-[14px] font-bold">
                      {'★'.repeat(t.rating)} {t.authorName}, {t.productTitle}
                    </p>
                    <p className="mt-xs m-0 text-[16px] font-semibold">{t.body}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="mt-lg rounded-card bg-card p-md shadow-toy-soft" aria-labelledby="lead-heading">
            <h2 id="lead-heading" className="text-[24px]">
              Say hello
            </h2>
            {lead.isSuccess ? (
              <p className="mt-xs m-0 text-[16px] font-bold">Sent. {d.name} will see it in their inbox.</p>
            ) : (
              <form
                className="mt-sm flex flex-col gap-md"
                onSubmit={(e) => {
                  e.preventDefault();
                  lead.mutate();
                }}
              >
                <label className="block">
                  <span className="block text-[14px] font-bold">Name</span>
                  <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} className="mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]" />
                </label>
                <label className="block">
                  <span className="block text-[14px] font-bold">Email</span>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]" />
                </label>
                <label className="block">
                  <span className="block text-[14px] font-bold">Message</span>
                  <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} maxLength={1000} className="mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]" />
                </label>
                {lead.isError && (
                  <p role="alert" className="m-0 rounded-tile bg-r1/15 p-sm text-[14px] font-bold">
                    {lead.error instanceof Error ? lead.error.message : 'Could not send.'}
                  </p>
                )}
                <Button type="submit" full disabled={lead.isPending}>
                  Send
                </Button>
              </form>
            )}
          </section>
        </>
      )}
    </Screen>
  );
}
