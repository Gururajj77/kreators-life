import { useMutation } from '@tanstack/react-query';
import { longDate, dateTime } from '../lib/date';
import { useState } from 'react';
import { Link } from 'react-router';
import { Button } from '../components/Button';
import { AppCover } from '../components/AppCover';
import { Screen } from '../components/Screen';
import { api } from '../lib/api';
import { useAuthed, useMe } from '../lib/queries';
import { Pager, usePage } from '../components/Pager';
import { FIELD } from '../lib/ui';
import { useCopy } from '../lib/clipboard';

export function StudioAudience() {
  const copier = useCopy();
  const me = useMe();
  const fp = usePage('f');
  const lp = usePage('l');
  const q = useAuthed(['audience', fp.query], () => api.audience(fp.query));
  const leads = useAuthed(['leads', lp.query], () => api.leads(lp.query));
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
  
  return (
    <Screen>
      <AppCover
        back={{ to: '/shop', label: 'Shop' }}
        title="Audience"
        lede={
          <>
            Followers, leads from your page, broadcasts to their inbox, and your affiliate link. To see which post each sale came from, open{' '}
            <Link to="/shop/content" className="underline underline-offset-4">
              Content
            </Link>
            .
          </>
        }
      />

      <section className="mt-md rounded-card bg-card p-md shadow-toy-soft" aria-labelledby="bc-heading">
        <h2 id="bc-heading" className="text-title2">
          Broadcast
        </h2>
        <p className="mt-xs m-0 text-subhead text-ink-soft">Lands in the inbox of everyone who follows you, or everyone who bought from you.</p>
        <form
          className="mt-sm flex flex-col gap-md"
          onSubmit={(e) => {
            e.preventDefault();
            if (title.trim() && body.trim()) send.mutate();
          }}
        >
          <div className="grid grid-cols-2 gap-xs" role="group" aria-label="Audience">
            {(['followers', 'buyers'] as const).map((a) => (
              <button key={a} type="button" aria-pressed={audience === a} onClick={() => setAudience(a)} className={`min-h-[44px] rounded-pill border-2 text-subhead font-medium ${audience === a ? 'border-ink bg-ink text-on-ink' : 'border-line bg-card'}`}>
                {a === 'followers' ? `Followers (${d?.followers.length ?? 0})` : 'Buyers'}
              </button>
            ))}
          </div>
          <label className="block">
            <span className="block text-subhead font-semibold">Title</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} className={FIELD} />
          </label>
          <label className="block">
            <span className="block text-subhead font-semibold">Message</span>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} rows={4} className={FIELD} />
          </label>
          {send.isSuccess && <p className="m-0 text-subhead font-semibold">Sent to {send.data.sent} people.</p>}
          <Button type="submit" full disabled={send.isPending || !title.trim() || !body.trim()}>
            Send broadcast
          </Button>
        </form>
      </section>

      <section data-pillar="parent_child" className="mt-lg rounded-card p-md" style={{ background: 'var(--tint-yellow)' }} aria-labelledby="aff-heading">
        <h2 id="aff-heading" className="text-title2">
          Affiliate link
        </h2>
        <p className="mt-xs m-0 text-subhead">
          Anyone who shares a link with their code earns {Math.round((d?.affiliateShare ?? 0.2) * 100)}% of the points on every sale it brings. Your code is <span className="font-bold">{d?.referralCode ?? '…'}</span>, and {d?.referred ?? 0} {d?.referred === 1 ? 'person has' : 'people have'} joined through it.
        </p>
        {link ? (
          <div className="mt-sm flex flex-wrap-reverse items-center justify-between gap-sm">
            <p className="m-0 min-w-0 flex-1 basis-[60%] break-all rounded-tile bg-card p-sm text-subhead">{link}</p>
            <Button variant="outline" onClick={() => void copier.copy(link)}>
              {copier.said === 'Copied' ? 'Copied' : 'Copy my link'}
            </Button>
          </div>
        ) : (
          <p className="mt-sm m-0 text-subhead">
            Set a page name under{' '}
            <Link to="/profile" className="underline underline-offset-4">
              My page
            </Link>{' '}
            to get a shareable link.
          </p>
        )}
      </section>

      <section className="mt-lg" aria-labelledby="leads-heading">
        <h2 id="leads-heading" className="text-title2">
          Leads
        </h2>
        {leads.data && leads.data.leads.length === 0 && <p className="mt-xs m-0 text-subhead text-ink-soft">The form on your page sends names and emails here.</p>}
        <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
          {leads.data?.leads.map((l) => (
            <li key={l.id} className="rounded-tile bg-card p-sm shadow-toy-soft">
              <p className="m-0 text-headline">
                {l.name} <span className="text-ink-soft">{l.email}</span>
              </p>
              {l.message && <p className="mt-xs m-0 text-subhead">{l.message}</p>}
              <p className="m-0 text-caption text-ink-mute">{dateTime(l.createdAt)}</p>
            </li>
          ))}
        </ul>
        <Pager page={leads.data?.page} prefix="l" label="leads" />
      </section>

      <section className="mt-lg" aria-labelledby="fol-heading">
        <h2 id="fol-heading" className="text-title2">
          Followers
        </h2>
        <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
          {d?.followers.map((f, i) => (
            <li key={i} className="rounded-tile bg-card p-sm text-headline shadow-toy-soft">
              {f.handle ? (
                <Link to={`/u/${f.handle}`} className="underline underline-offset-4">
                  {f.name}
                </Link>
              ) : (
                f.name
              )}
              <span className="text-ink-soft"> since {longDate(f.since)}</span>
            </li>
          ))}
        </ul>
        <Pager page={d?.page} prefix="f" label="followers" />
      </section>

      {d && d.broadcasts.length > 0 && (
        <section className="mt-lg" aria-labelledby="sent-heading">
          <h2 id="sent-heading" className="text-title2">
            Sent
          </h2>
          <ul className="mt-sm flex list-none flex-col gap-xs p-0 m-0">
            {d.broadcasts.map((b) => (
              <li key={b.id} className="rounded-tile bg-card p-sm shadow-toy-soft">
                <p className="m-0 text-headline">{b.title}</p>
                <p className="m-0 text-subhead text-ink-soft">
                  To {b.sent} {b.audience}, {longDate(b.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Screen>
  );
}
