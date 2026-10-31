import { PRODUCT_KIND_META, BADGES, HONORS, RELATIONSHIPS } from '@kreators/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Inert } from '../components/Inert';
import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import { TrustBadge } from '../components/TrustBadge';
import { LinkBlocks } from '../components/LinkBlocks';
import { BackLink } from '../components/PageHeader';
import { Screen } from '../components/Screen';
import { api } from '../lib/api';
import { captureRef, useSession } from '../lib/store';

const SOCIAL_LABEL = { instagram: 'Instagram', youtube: 'YouTube', x: 'X', website: 'Website' } as const;
type SocialKey = keyof typeof SOCIAL_LABEL;

/** A plain line icon for each place someone can be found. Drawn here, no brand assets. */
function SocialIcon({ k }: { k: SocialKey }) {
  const common = { viewBox: '0 0 24 24', width: 20, height: 20, fill: 'none', stroke: 'currentColor', strokeWidth: 2.4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  if (k === 'instagram')
    return (
      <svg {...common}>
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.3" cy="6.7" r="1.1" fill="currentColor" stroke="none" />
      </svg>
    );
  if (k === 'youtube')
    return (
      <svg {...common}>
        <rect x="2.5" y="5" width="19" height="14" rx="4" />
        <path d="M10 9l5 3-5 3z" fill="currentColor" stroke="none" />
      </svg>
    );
  if (k === 'x')
    return (
      <svg {...common}>
        <path d="M5 4l14 16M19 4L5 20" />
      </svg>
    );
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" />
    </svg>
  );
}

export function Public() {
  const { handle = '', id = '' } = useParams();
  const location = useLocation();
  const nav = useNavigate();
  captureRef(location.search);
  const token = useSession((s) => s.token);
  const q = useQuery({ queryKey: ['public', handle, id, token], queryFn: () => (id ? api.personPage(id) : api.publicPage(handle)) });
  const follow = useMutation({ mutationFn: () => api.follow(q.data?.handle || handle), onSuccess: () => q.refetch() });
  const befriend = useMutation({ mutationFn: () => api.addFriend(q.data?.id ?? ''), onSuccess: () => q.refetch() });
  const accept = useMutation({ mutationFn: () => api.answerFriend(q.data?.friendRequestId ?? '', 'accepted'), onSuccess: () => q.refetch() });
  const chat = useMutation({ mutationFn: () => api.openChat({ userId: q.data?.id ?? '' }), onSuccess: (r) => nav(`/bond/chats/${r.chat.id}`) });
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const lead = useMutation({ mutationFn: () => api.lead(handle, { name, email, message }) });
  const d = q.data;

  return (
    <Screen tabs={false}>
      <header className="pt-lg">
        <BackLink to={token ? '/apps' : '/'}>kreators.app</BackLink>
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
              <img src={d.avatarUrl} alt="" width={64} height={64} className="size-[64px] rounded-pill bg-paper object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />
            ) : (
              <span className="flex size-[64px] items-center justify-center rounded-pill bg-r2 font-display text-[30px] font-extrabold text-on-fill" aria-hidden="true">
                {d.name.slice(0, 1).toUpperCase()}
              </span>
            )}
            <div className="mt-sm flex items-center gap-xs">
              <h1 className="text-[30px]">{d.name}</h1>
              {d.isPro && <span className="rounded-pill bg-r7 px-sm py-xs text-[12px] font-extrabold text-white">Pro</span>}
            </div>
            <p className="m-0 text-[14px] font-bold text-on-ink/70">
              {d.handle ? `@${d.handle}, ` : ''}
              {d.followers} {d.followers === 1 ? 'follower' : 'followers'}
            </p>
            {!d.isPrivate && (
              <div className="mt-sm">
                <TrustBadge trust={d.trust} onInk />
              </div>
            )}
            {d.isPrivate && <p className="mt-sm m-0 rounded-tile bg-on-ink/15 p-sm text-[14px] font-bold">This page is private. {d.name} has switched it off.</p>}
            {d.mine && (
              <p className="mt-sm m-0 text-[12px] font-bold text-on-ink/80">
                This is how others see you. Change what shows under{' '}
                <Link to="/profile" className="underline underline-offset-4">
                  Public page
                </Link>
                .
              </p>
            )}
            {token && !d.mine && !d.isPrivate && (
              <div className="mt-sm flex flex-wrap gap-xs" aria-label="Friends">
                {d.friend === 'none' && d.allowFriendRequests && (
                  <Button variant="light" disabled={befriend.isPending} onClick={() => befriend.mutate()}>
                    Add friend
                  </Button>
                )}
                {d.friend === 'sent' && <span className="inline-flex min-h-[48px] items-center rounded-pill bg-on-ink/15 px-md text-[14px] font-bold">Friend request sent</span>}
                {d.friend === 'pending' && (
                  <Button variant="light" disabled={accept.isPending} onClick={() => accept.mutate()}>
                    Accept friend request
                  </Button>
                )}
                {d.friend === 'friends' && (
                  <>
                    <span className="inline-flex min-h-[48px] items-center rounded-pill bg-on-ink/15 px-md text-[14px] font-bold">Friends</span>
                    {d.allowChats && (
                      <Button variant="light" disabled={chat.isPending} onClick={() => chat.mutate()}>
                        Chat anonymously
                      </Button>
                    )}
                  </>
                )}
                {d.friend === 'none' && !d.allowFriendRequests && <span className="inline-flex min-h-[48px] items-center text-[14px] font-bold text-on-ink/80">Not taking friend requests.</span>}
                {(befriend.isError || chat.isError) && <span className="text-[12px] font-bold text-on-ink/80">That did not work. Try again.</span>}
              </div>
            )}
            {d.bio && <p className="mt-sm m-0 text-[16px] font-semibold leading-relaxed">{d.bio}</p>}
            {(d.socials.instagram || d.socials.youtube || d.socials.x || d.socials.website) && (
              <ul className="mt-sm flex list-none flex-wrap gap-xs p-0 m-0" aria-label="Find them elsewhere">
                {(Object.keys(SOCIAL_LABEL) as SocialKey[])
                  .filter((k) => d.socials[k])
                  .map((k) => (
                    <li key={k}>
                      <a href={d.socials[k]} target="_blank" rel="noreferrer" aria-label={`${SOCIAL_LABEL[k]}, opens in a new tab`} className="toy inline-flex min-h-[44px] items-center gap-xs rounded-pill bg-card px-sm text-[14px] font-bold text-ink">
                        <SocialIcon k={k} />
                        {SOCIAL_LABEL[k]}
                      </a>
                    </li>
                  ))}
              </ul>
            )}
            {!d.isPrivate && token ? (
              <Button variant={d.following ? 'outline' : 'primary'} className={`mt-md ${d.following ? '' : 'bg-r2 text-on-fill'}`} onClick={() => follow.mutate()} disabled={follow.isPending}>
                {d.following ? 'Following' : 'Follow'}
              </Button>
            ) : !d.isPrivate ? (
              <Link to="/" className="toy mt-md inline-flex min-h-[48px] items-center rounded-pill bg-r2 px-md font-bold text-on-fill">
                Join to follow
              </Link>
            ) : null}
          </section>

          <LinkBlocks blocks={d.links} onOpen={(id) => d.handle && void api.click(d.handle, `block:${id}`)} />
          {d.activity && (
            <section className="mt-md rounded-card bg-card p-md shadow-toy-soft" aria-labelledby="activity-heading">
              <h2 id="activity-heading" className="text-[24px]">
                Activity
              </h2>
              <ul className="mt-sm grid list-none grid-cols-3 gap-xs p-0 m-0">
                {[
                  ['Level', String(d.activity.level)],
                  ['Streak', `${d.activity.streak} ${d.activity.streak === 1 ? 'day' : 'days'}`],
                  ['Pillars', `${d.activity.areasSetUp} of 7`],
                ].map(([k, v]) => (
                  <li key={k} className="rounded-tile bg-paper p-sm">
                    <span className="block text-[12px] font-extrabold uppercase tracking-wide text-ink-soft">{k}</span>
                    <span className="mt-xs block font-display text-[24px] font-extrabold leading-none">{v}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-sm m-0 text-[12px] font-bold text-ink-soft">Member since {new Date(d.activity.memberSince).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}.</p>
            </section>
          )}
          {(d.badges.length > 0 || d.honors.length > 0) && (
            <section className="mt-md rounded-card bg-card p-md shadow-toy-soft" aria-labelledby="badges-heading">
              <h2 id="badges-heading" className="text-[24px]">
                Badges
              </h2>
              <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Earned by doing the thing, or awarded by the kreators.app team.</p>
              <ul className="mt-sm grid list-none grid-cols-2 gap-xs p-0 m-0 md:grid-cols-3">
                {[...d.badges.map((k) => BADGES.find((b) => b.key === k)).filter((b) => b !== undefined), ...d.honors.map((k) => HONORS.find((h) => h.key === k)).filter((h) => h !== undefined)].map((b) => (
                  <li key={b.key} className="rounded-tile bg-paper p-sm">
                    <p className="m-0 text-[24px]" aria-hidden="true">
                      {b.emoji}
                    </p>
                    <p className="mt-xs m-0 text-[14px] font-extrabold">{b.name}</p>
                    <p className="m-0 text-[12px] font-semibold text-ink-soft">{b.how}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {d.posts.length > 0 && (
            <section className="mt-md" aria-labelledby="posts-heading">
              <h2 id="posts-heading" className="text-[24px]">
                Posts
              </h2>
              <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
                {d.posts.map((p) => (
                  <li key={p.id} className="rounded-tile bg-card p-sm shadow-toy-soft">
                    <p className="m-0 text-[12px] font-bold text-ink-soft">
                      {p.category}, {new Date(p.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </p>
                    <p className="mt-xs m-0 whitespace-pre-wrap text-[16px] font-semibold leading-relaxed"><Inert text={p.body} /></p>
                    <p className="mt-xs m-0 text-[12px] font-bold text-ink-soft">
                      {p.likes} {p.likes === 1 ? 'like' : 'likes'}, {p.replies} {p.replies === 1 ? 'reply' : 'replies'}
                    </p>
                  </li>
                ))}
              </ul>
              {token && (
                <Link to="/community" className="mt-sm inline-flex min-h-[44px] items-center text-[14px] font-bold text-ink-mute underline-offset-4 hover:underline">
                  Open the community feed
                </Link>
              )}
            </section>
          )}
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

          {!d.isPrivate && (
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
          )}
        </>
      )}
      {/* Every page carries the way in. Tap it and you land on the site, where you can start your own. */}
      <footer className="mt-xl flex flex-col items-center gap-xs text-center">
        <Link to="/" className="toy toy-soft inline-flex min-h-[48px] items-center gap-sm rounded-pill bg-card px-md text-[14px] font-bold text-ink">
          <span className="flex items-end gap-xs" aria-hidden="true">
            {RELATIONSHIPS.slice(0, 3).map((r, i) => (
              <Avatar key={r.key} relationship={r.key} size={16 + i * 4} decorative still />
            ))}
          </span>
          Made with kreators.app
        </Link>
        <p className="m-0 text-[12px] font-semibold text-ink-soft">One page for everything you make. Start yours free.</p>
      </footer>
    </Screen>
  );
}
