import { BADGE_FAMILIES, PRODUCT_KIND_META, productHasOwnCover, BADGES, HONORS, RELATIONSHIPS, formatCount } from '@kreators/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Inert } from '../components/Inert';
import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { AppIcon } from '../components/AppIcon';
import { Avatar } from '../components/Avatar';
import { BadgeMedal } from '../components/BadgeArt';
import { Button } from '../components/Button';
import { TrustBadge } from '../components/TrustBadge';
import { LinkBlocks } from '../components/LinkBlocks';
import { BackLink } from '../components/PageHeader';
import { AppCover } from '../components/AppCover';
import { SeeAll } from '../components/Section';
import { Skeleton } from '../components/Skeleton';
import { StatTile } from '../components/Charts';
import { Icon } from '../components/Icon';
import { Reveal } from '../components/fx/Reveal';
import { PenLine } from 'lucide-react';
import { Screen } from '../components/Screen';
import { api } from '../lib/api';
import { captureRef, useSession } from '../lib/store';
import { Stars } from '../components/Stars';
import { TileGroups } from '../components/TileGroups';
import { IconTag } from '../components/FactTag';
import { CardHead } from '../components/CardHead';
import '../components/fx/spotlight';
import { useMe } from '../lib/queries';
import { useSeedOnce } from '../lib/useSeed';
import { FIELD } from '../lib/ui';
import { SITE_SECONDARY } from '../site/buttons';
import { dateTime, monthYear, shortDate } from '../lib/date';

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

/** Badges and honors: two to a row on a phone, three from the tablet, in even rows (lib/bento.ts). */
const MEDAL_COLS = { base: 2, md: 3 } as const;

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
  // A signed-in visitor's own name and email are filled in from their profile (they can change them); a visitor with no account types them.
  const viewer = useMe().data?.user;
  const [name, setName] = useState(viewer?.displayName ?? '');
  const [email, setEmail] = useState(viewer?.email ?? '');
  useSeedOnce(viewer, (u) => {
    setName((n) => n || u.displayName);
    setEmail((e) => e || (u.email ?? ''));
  });
  const [message, setMessage] = useState('');
  const lead = useMutation({ mutationFn: () => api.lead(handle, { name, email, message }) });
  const d = q.data;

  const signedIn = Boolean(token);
  // What the viewer can do with this person, the way the owner's switches allow (the server already blanked what is off).
  const friendLine =
    !d || d.mine || d.isPrivate || !signedIn
      ? ''
      : d.friend === 'sent'
        ? 'Friend request sent.'
        : d.friend === 'friends'
          ? 'You are friends.'
          : d.friend === 'none' && !d.allowFriendRequests
            ? 'Not taking friend requests.'
            : '';
  const friendAction =
    !d || d.mine || d.isPrivate || !signedIn ? null : d.friend === 'none' && d.allowFriendRequests ? (
      <Button variant="outline" disabled={befriend.isPending} onClick={() => befriend.mutate()}>
        Add friend
      </Button>
    ) : d.friend === 'pending' ? (
      <Button variant="outline" disabled={accept.isPending} onClick={() => accept.mutate()}>
        Accept request
      </Button>
    ) : d.friend === 'friends' && d.allowChats ? (
      <Button variant="outline" disabled={chat.isPending} onClick={() => chat.mutate()}>
        Chat anonymously
      </Button>
    ) : null;
  const socialKeys = d ? (Object.keys(SOCIAL_LABEL) as SocialKey[]).filter((k) => d.socials[k]) : [];
  const hasSocials = socialKeys.length > 0;
  // Badges and honors in one grid, two to a row on a phone and three from the tablet, in even rows (lib/bento.ts).
  const medals = d ? [...d.badges.map((k) => BADGES.find((b) => b.key === k)).filter((b) => b !== undefined), ...d.honors.map((k) => HONORS.find((h) => h.key === k)).filter((h) => h !== undefined)] : [];

  return (
    <Screen tabs={false}>
      {q.isPending && (
        <div className="mt-lg" aria-busy="true">
          <Skeleton className="h-[200px] rounded-card" />
          <Skeleton className="mt-sm h-[56px] rounded-tile" />
          <Skeleton className="mt-xs h-[56px] rounded-tile" />
        </div>
      )}
      {q.isError && (
        <>
          <header className="pt-lg">
            <BackLink to={signedIn ? '/apps' : '/'}>kreators.app</BackLink>
          </header>
          <div className="mt-md rounded-card bg-card p-md text-center shadow-toy-soft">
            <p className="m-0 text-headline">No page with that name.</p>
          </div>
        </>
      )}
      {d && (
        <>
          {/* The person's cover (the AppCover look, founder 2026-11-04): the way back at the top left, the trust ring and Pro at the top
              right, then their picture, name and @handle at the bottom right with their line under it, and the follow and friend
              actions on that line's left. */}
          <AppCover
            cover="profile"
            back={{ to: signedIn ? '/apps' : '/', label: 'kreators.app' }}
            topEnd={
              !d.isPrivate || d.isPro ? (
                <div className="flex items-center gap-xs">
                  {d.isPro && <IconTag tone="deep" icon="Crown">Pro</IconTag>}
                  {!d.isPrivate && <TrustBadge trust={d.trust} size="sm" />}
                </div>
              ) : undefined
            }
            title={d.name}
            heading={
              <div className="flex items-center justify-end gap-sm">
                {d.avatarUrl ? (
                  <img src={d.avatarUrl} alt={`${d.name}, profile picture`} width={72} height={72} fetchPriority="high" decoding="async" className="size-[72px] shrink-0 rounded-pill bg-paper object-cover shadow-toy-soft" onError={(e) => (e.currentTarget.style.display = 'none')} />
                ) : (
                  <span className="flex size-[72px] shrink-0 items-center justify-center rounded-pill bg-card-strong font-display text-[30px] font-bold text-ink shadow-toy-soft" aria-hidden="true">
                    {d.name.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0 text-right">
                  <h1 className="type-large break-words">{d.name}</h1>
                  {!d.isPrivate && (
                    <p className="m-0 mt-xs text-subhead text-ink-soft">
                      {d.handle ? `@${d.handle} · ` : ''}
                      {formatCount(d.followers)} {d.followers === 1 ? 'follower' : 'followers'}
                    </p>
                  )}
                </div>
              </div>
            }
            lede={
              d.isPrivate ? (
                <p className="m-0">This page is private. {d.name.replace(/ /g, '\u00a0')} has switched it off.</p>
              ) : d.bio || friendLine ? (
                <>
                  {d.bio && <p className="m-0 text-callout text-ink">{d.bio}</p>}
                  {friendLine && <p className="m-0 mt-xs">{friendLine}</p>}
                </>
              ) : undefined
            }
            actions={
              d.isPrivate ? undefined : d.mine ? (
                <Link to="/profile" className="toy btn-outline inline-flex min-h-[48px] items-center gap-xs rounded-pill border border-ink/30 bg-card-strong px-md text-callout text-ink">
                  <Icon icon={PenLine} size={18} />
                  Edit my page
                </Link>
              ) : signedIn ? (
                <>
                  <Button variant={d.following ? 'outline' : 'primary'} onClick={() => follow.mutate()} disabled={follow.isPending} aria-pressed={d.following}>
                    {d.following ? 'Following' : 'Follow'}
                  </Button>
                  {friendAction}
                </>
              ) : (
                <Link to="/" className="toy btn-primary inline-flex min-h-[48px] items-center rounded-pill bg-ink px-md text-callout text-on-ink">
                  Join to follow
                </Link>
              )
            }
          >
            {(befriend.isError || chat.isError || accept.isError || follow.isError || d.mine || hasSocials) && (
              <>
            {(befriend.isError || chat.isError || accept.isError || follow.isError) && (
              <p role="alert" className="m-0 text-subhead text-ink-soft">
                That did not work. Try again.
              </p>
            )}
            {d.mine && (
              <p className="m-0 text-caption text-ink-soft">
                This is how others see you. Change what shows under{' '}
                <Link to="/profile" className="underline underline-offset-4">
                  Public page
                </Link>
                .
              </p>
            )}
            {hasSocials && (
              // One even row, however many there are (never a lone pill on a line of its own): icon over word on a phone, side by side from md.
              <ul className="mt-xs grid list-none gap-xs p-0 m-0" style={{ gridTemplateColumns: `repeat(${socialKeys.length}, minmax(0, 1fr))` }} aria-label="Find them elsewhere">
                {socialKeys.map((k) => (
                    <li key={k} className="flex">
                      <a href={d.socials[k]} target="_blank" rel="noreferrer" aria-label={`${SOCIAL_LABEL[k]}, opens in a new tab`} className="toy toy-soft flex min-h-[56px] w-full flex-col items-center justify-center gap-xs rounded-tile bg-card px-xs py-xs text-caption text-ink md:min-h-[48px] md:flex-row md:rounded-pill md:text-subhead">
                        <SocialIcon k={k} />
                        {SOCIAL_LABEL[k]}
                      </a>
                    </li>
                  ))}
              </ul>
            )}
              </>
            )}
          </AppCover>

          <LinkBlocks blocks={d.links} onOpen={(id) => d.handle && void api.click(d.handle, `block:${id}`)} />

          {d.products.length > 0 && (
            <Reveal as="section" className="mt-lg" aria-labelledby="shop-heading">
              <h2 id="shop-heading" className="text-title2">
                From {d.name}
              </h2>
              <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
                {d.products.map((p) => {
                  const meta = PRODUCT_KIND_META[p.kind];
                  const inner = (
                    <>
                      <span className="flex size-[48px] shrink-0 items-center justify-center rounded-inner bg-paper text-[24px]" aria-hidden="true">
                        {productHasOwnCover(p.kind, p.cover) ? p.cover : <AppIcon name={meta.icon} size={24} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-card-title">{p.title}</span>
                        <span className="block text-card-note text-ink-soft">
                          {meta.name}
                          {p.kind === 'event' && p.startsAt ? `, ${dateTime(p.startsAt)}` : ''}
                          {p.rating ? `, rated ${p.rating}` : ''}
                        </span>
                      </span>
                      <span className="shrink-0 rounded-pill bg-paper px-sm py-xs text-subhead font-medium text-ink">{p.kind === 'link' ? 'Open' : p.pricePoints === 0 && p.priceCents === 0 ? 'Free' : `${formatCount(p.pricePoints)} pts`}</span>
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
            </Reveal>
          )}

          {d.activity && (
            <Reveal as="section" className="mt-lg" aria-labelledby="activity-heading">
              <h2 id="activity-heading" className="text-title2">
                Activity
              </h2>
              <ul className="mt-sm grid list-none grid-cols-3 gap-xs p-0 m-0">
                {[
                  ['Level', formatCount(d.activity.level), ''],
                  ['Streak', formatCount(d.activity.streak), d.activity.streak === 1 ? 'day' : 'days'],
                  ['Pillars', `${d.activity.areasSetUp} of 7`, ''],
                ].map(([k = '', v = '', hint = '']) => (
                  <li key={k}>
                    <StatTile label={k} value={v} hint={hint || undefined} className="h-full" />
                  </li>
                ))}
              </ul>
              <p className="mt-sm m-0 text-caption text-ink-soft">Member since {monthYear(d.activity.memberSince)}.</p>
            </Reveal>
          )}
          {(d.badges.length > 0 || d.honors.length > 0) && (
            <Reveal as="section" className="mt-lg" aria-labelledby="badges-heading">
              <h2 id="badges-heading" className="text-title2">
                Badges
              </h2>
              <p className="mt-xs m-0 text-subhead text-ink-soft">Earned here, or given by the kreators.app team.</p>
              {/* Even rows in each part: every row full and its tiles one width, so a grid never ends in a lone tile or a hole. Past ten, by family (TileGroups).
                  The name and how it is earned at the top left, the medal in the top right corner (the card rules, 2026-11-05). */}
              <TileGroups
                className="mt-sm"
                list
                cols={MEDAL_COLS}
                flat={medals}
                groups={[
                  ...BADGE_FAMILIES.map((f) => ({ key: f, name: f, tiles: medals.filter((b) => 'family' in b && b.family === f) })),
                  { key: 'awarded', name: 'Awarded', tiles: medals.filter((b) => !('family' in b)) },
                ]}
                render={(b, className) => (
                  <li key={b.key} className={`fx-spot rounded-tile bg-card p-sm shadow-toy-soft ${className}`}>
                    <CardHead tag={<BadgeMedal k={b.key} size="sm" decorative />}>
                      <p className="m-0 text-balance text-card-title">{b.name}</p>
                      <p className="m-0 text-card-note text-ink-soft">{b.how}</p>
                    </CardHead>
                  </li>
                )}
              />
            </Reveal>
          )}
          {d.posts.length > 0 && (
            <Reveal as="section" className="mt-lg" aria-labelledby="posts-heading">
              <div className="flex items-start justify-between gap-sm">
                <h2 id="posts-heading" className="text-title2">
                  Posts
                </h2>
                {signedIn && (
                  <div className="flex h-[1.2em] shrink-0 items-center text-[24px] leading-none">
                    <SeeAll to="/community">Community</SeeAll>
                  </div>
                )}
              </div>
              <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
                {d.posts.map((p) => (
                  <li key={p.id} className="rounded-tile bg-card p-sm shadow-toy-soft">
                    <p className="m-0 text-caption text-ink-soft">
                      {p.category}, {shortDate(p.createdAt)}
                    </p>
                    <p className="mt-xs m-0 whitespace-pre-wrap text-prose"><Inert text={p.body} /></p>
                    <p className="mt-xs m-0 text-caption text-ink-soft">
                      {formatCount(p.likes)} {p.likes === 1 ? 'like' : 'likes'}, {formatCount(p.replies)} {p.replies === 1 ? 'reply' : 'replies'}
                    </p>
                  </li>
                ))}
              </ul>
            </Reveal>
          )}

          {d.testimonials.length > 0 && (
            <Reveal as="section" className="mt-lg" aria-labelledby="say-heading">
              <h2 id="say-heading" className="text-title2">
                What people say
              </h2>
              <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
                {d.testimonials.map((t) => (
                  <li key={t.id} className="rounded-tile bg-card p-sm shadow-toy-soft">
                    <p className="m-0 text-subhead font-semibold">
                      <Stars n={t.rating} /> {t.authorName}, {t.productTitle}
                    </p>
                    <p className="mt-xs m-0 text-callout">{t.body}</p>
                  </li>
                ))}
              </ul>
            </Reveal>
          )}

          {!d.isPrivate && !d.mine && (
            <Reveal as="section" className="mt-lg rounded-card bg-card p-md shadow-toy-soft" aria-labelledby="lead-heading">
              <h2 id="lead-heading" className="text-title2">
                Say hello
              </h2>
              {lead.isSuccess ? (
                <p className="mt-xs m-0 text-headline">Sent. {d.name} will see it in their inbox.</p>
              ) : (
                <form
                  className="mt-sm flex flex-col gap-md"
                  onSubmit={(e) => {
                    e.preventDefault();
                    lead.mutate();
                  }}
                >
                  <label className="block">
                    <span className="block text-subhead font-semibold">Name</span>
                    <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} autoComplete="name" className={FIELD} />
                  </label>
                  <label className="block">
                    <span className="block text-subhead font-semibold">Email</span>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" className={FIELD} />
                  </label>
                  <label className="block">
                    <span className="block text-subhead font-semibold">Message</span>
                    <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} maxLength={1000} className={FIELD} />
                  </label>
                  {lead.isError && (
                    <p role="alert" className="m-0 rounded-tile bg-r1/15 p-sm text-subhead">
                      {lead.error instanceof Error ? lead.error.message : 'Could not send.'}
                    </p>
                  )}
                  <Button type="submit" variant="outline" full disabled={lead.isPending}>
                    Send
                  </Button>
                </form>
              )}
            </Reveal>
          )}
        </>
      )}
      {/* Every page carries the way in. Tap it and you land on the site, where you can start your own. */}
      <footer className="mt-xl flex flex-col items-center gap-xs text-center">
        <Link to="/" className={SITE_SECONDARY}>
          <span className="flex items-end gap-xs" aria-hidden="true">
            {RELATIONSHIPS.slice(0, 3).map((r, i) => (
              <Avatar key={r.key} relationship={r.key} size={16 + i * 4} decorative still />
            ))}
          </span>
          Made with kreators.app
        </Link>
        <p className="m-0 text-caption text-ink-soft">One page for everything you make. Start yours free.</p>
      </footer>
    </Screen>
  );
}
