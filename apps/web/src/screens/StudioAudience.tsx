import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { Button } from '../components/Button';
import { BackLink } from '../components/PageHeader';
import { Screen } from '../components/Screen';
import { api } from '../lib/api';
import { useAuthed, useMe } from '../lib/queries';

export function StudioAudience() {
  const me = useMe();
  const q = useAuthed(['audience'], api.audience);
  const leads = useAuthed(['leads'], api.leads);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<'followers' | 'buyers'>('followers');
  const send = useMutation({
    mutationFn: () => api.broadcast({ title, body, audience }),
    onSuccess: () => {
      setTitle('');
      setBody('');
      q.refetch();
    },
  });
  const d = q.data;
  const handle = me.data?.user.handle;
  const link = handle && d?.referralCode ? `${window.location.origin}/u/${handle}?ref=${d.referralCode}` : null;
  const field = 'mt-xs w-full rounded-tile border-2 border-line bg-paper px-sm py-sm text-[16px]';

  return (
    <Screen>
      <header className="pt-lg">
        <BackLink to="/shop">Shop</BackLink>
        <h1 className="text-[30px]">Audience</h1>
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">
          Followers, leads from your page, broadcasts to their inbox, and your affiliate link. To see which post each sale came from, open{' '}
          <Link to="/shop/content" className="underline underline-offset-4">
            Content
          </Link>
          .
        </p>
      </header>

      <section className="mt-md rounded-card bg-card p-md shadow-toy-soft" aria-labelledby="bc-heading">
        <h2 id="bc-heading" className="text-[24px]">
          Broadcast
        </h2>
        <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">Lands in the inbox of everyone who follows you, or everyone who bought from you.</p>
        <form
          className="mt-sm flex flex-col gap-md"
          onSubmit={(e) => {
            e.preventDefault();
            if (title.trim() && body.trim()) send.mutate();
          }}
        >
          <div className="grid grid-cols-2 gap-xs" role="group" aria-label="Audience">
            {(['followers', 'buyers'] as const).map((a) => (
              <button key={a} type="button" aria-pressed={audience === a} onClick={() => setAudience(a)} className={`min-h-[44px] rounded-pill border-2 text-[14px] font-bold ${audience === a ? 'border-ink bg-ink text-on-ink' : 'border-line bg-card'}`}>
                {a === 'followers' ? `Followers (${d?.followers.length ?? 0})` : 'Buyers'}
              </button>
            ))}
          </div>
          <label className="block">
            <span className="block text-[14px] font-bold">Title</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} className={field} />
          </label>
          <label className="block">
            <span className="block text-[14px] font-bold">Message</span>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} rows={4} className={field} />
          </label>
          {send.isSuccess && <p className="m-0 text-[14px] font-bold">Sent to {send.data.sent} people.</p>}
          <Button type="submit" full disabled={send.isPending || !title.trim() || !body.trim()}>
            Send broadcast
          </Button>
        </form>
      </section>

      <section className="mt-lg rounded-card p-md" style={{ background: 'var(--tint-yellow)' }} aria-labelledby="aff-heading">
        <h2 id="aff-heading" className="text-[24px]">
          Affiliate link
        </h2>
        <p className="mt-xs m-0 text-[14px] font-semibold">
          Anyone who shares a link with their code earns {Math.round((d?.affiliateShare ?? 0.2) * 100)}% of the points on every sale it brings. Your code is <span className="font-extrabold">{d?.referralCode ?? '…'}</span>, and {d?.referred ?? 0} {d?.referred === 1 ? 'person has' : 'people have'} joined through it.
        </p>
        {link ? (
          <>
            <p className="mt-sm m-0 break-all rounded-tile bg-card p-sm text-[14px] font-semibold">{link}</p>
            <Button variant="outline" className="mt-sm" onClick={() => navigator.clipboard?.writeText(link)}>
              Copy my link
            </Button>
          </>
        ) : (
          <p className="mt-sm m-0 text-[14px] font-bold">
            Set a page name under{' '}
            <Link to="/profile" className="underline underline-offset-4">
              My page
            </Link>{' '}
            to get a shareable link.
          </p>
        )}
      </section>

      <section className="mt-lg" aria-labelledby="leads-heading">
        <h2 id="leads-heading" className="text-[24px]">
          Leads
        </h2>
        {leads.data && leads.data.leads.length === 0 && <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">The form on your page sends names and emails here.</p>}
        <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
          {leads.data?.leads.map((l) => (
            <li key={l.id} className="rounded-tile bg-card p-sm shadow-toy-soft">
              <p className="m-0 text-[16px] font-bold">
                {l.name} <span className="font-semibold text-ink-soft">{l.email}</span>
              </p>
              {l.message && <p className="mt-xs m-0 text-[14px] font-semibold">{l.message}</p>}
              <p className="m-0 text-[12px] font-bold text-ink-mute">{new Date(l.createdAt).toLocaleString()}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-lg" aria-labelledby="fol-heading">
        <h2 id="fol-heading" className="text-[24px]">
          Followers
        </h2>
        <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
          {d?.followers.map((f, i) => (
            <li key={i} className="rounded-tile bg-card p-sm text-[16px] font-bold shadow-toy-soft">
              {f.handle ? (
                <Link to={`/u/${f.handle}`} className="underline underline-offset-4">
                  {f.name}
                </Link>
              ) : (
                f.name
              )}
              <span className="font-semibold text-ink-soft"> since {new Date(f.since).toLocaleDateString()}</span>
            </li>
          ))}
        </ul>
      </section>

      {d && d.broadcasts.length > 0 && (
        <section className="mt-lg" aria-labelledby="sent-heading">
          <h2 id="sent-heading" className="text-[24px]">
            Sent
          </h2>
          <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
            {d.broadcasts.map((b) => (
              <li key={b.id} className="rounded-tile bg-card p-sm shadow-toy-soft">
                <p className="m-0 text-[16px] font-bold">{b.title}</p>
                <p className="m-0 text-[14px] font-semibold text-ink-soft">
                  To {b.sent} {b.audience}, {new Date(b.createdAt).toLocaleDateString()}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Screen>
  );
}
