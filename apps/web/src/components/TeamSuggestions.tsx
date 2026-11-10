import type { TeamSuggestion } from '@kreators/shared/connect';
import { useState } from 'react';
import { connectApi } from '../lib/connectApi';
import { focusHeadingAfter } from '../lib/focusHeading';
import { useAuthed, useRefreshAll } from '../lib/queries';
import { Button } from './Button';
import { ErrorLine } from './ErrorLine';

/** A picture, or the first letter on the paper fill. */
function Face({ s }: { s: TeamSuggestion }) {
  const [broken, setBroken] = useState(false);
  const url = s.other.avatarUrl;
  if (url && (url.startsWith('https://') || url.startsWith('/api/public/media/')) && !broken)
    return <img src={url} alt="" width={44} height={44} loading="lazy" decoding="async" onError={() => setBroken(true)} className="size-[44px] shrink-0 rounded-pill bg-paper object-cover" />;
  return (
    <span aria-hidden="true" className="flex size-[44px] shrink-0 items-center justify-center rounded-pill bg-paper text-headline text-ink-soft">
      {(s.other.name.trim()[0] ?? '?').toUpperCase()}
    </span>
  );
}

/**
 * Friend suggestions the team made in Admin, Connect people (2026-11-09), on the Profile tab (`/you#suggested`). Each person says yes or
 * no for themselves: the first yes sends an ordinary friend request, the second makes them friends, and a no closes it for both without
 * telling the other who said it. Shown only while one is open; its calls live under /me/suggestions, which no app switch closes.
 */
export function TeamSuggestions() {
  const q = useAuthed(['team-suggestions'], () => connectApi.mine());
  const refresh = useRefreshAll();
  const [busy, setBusy] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [said, setSaid] = useState('');
  const list = q.data?.suggestions ?? [];
  if (!list.length && !said) return null;
  const answer = async (s: TeamSuggestion, yes: boolean) => {
    setBusy(s.id);
    setError(null);
    try {
      const r = await connectApi.answer(s.id, yes);
      setSaid(r.status === 'friends' ? `You and ${s.other.name} are friends now.` : yes ? `Asked. ${s.other.name} gets a friend request from you.` : 'Closed. Nobody is told who said no.');
      await q.refetch();
      refresh();
      // The Yes and No go once answered, so the keyboard moves to the heading; the line under the list says what happened.
      focusHeadingAfter('suggested-heading');
    } catch (e) {
      setError(e);
    } finally {
      setBusy('');
    }
  };
  return (
    <section className="mt-lg" aria-labelledby="suggested-heading" id="suggested">
      <h2 id="suggested-heading" className="text-title2">
        Suggested by the team
      </h2>
      <p className="mt-xs m-0 text-subhead text-ink-soft">You become friends only if you both say yes.</p>
      <ul className="mt-sm m-0 grid list-none gap-xs p-0">
        {list.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center justify-between gap-sm rounded-tile bg-card p-sm shadow-toy-soft">
            <span className="flex min-w-0 flex-[1_1_14rem] items-center gap-sm">
              <Face s={s} />
              <span className="min-w-0">
                <span className="block text-headline">{s.other.name}</span>
                <span className="block text-subhead text-ink-soft">{s.said === true ? 'You said yes. Waiting for them.' : s.other.handle ? `@${s.other.handle}` : 'The team thinks you would get on.'}</span>
              </span>
            </span>
            {s.said === null && (
              <span className="ml-auto flex gap-xs">
                <Button size="sm" variant="outline" disabled={busy === s.id} onClick={() => void answer(s, true)}>
                  Yes
                </Button>
                <Button size="sm" variant="ghost" disabled={busy === s.id} onClick={() => void answer(s, false)}>
                  No, thanks
                </Button>
              </span>
            )}
          </li>
        ))}
      </ul>
      <ErrorLine e={error} className="mt-xs" />
      {said && (
        <p role="status" className="mt-xs m-0 text-subhead font-semibold">
          {said}
        </p>
      )}
    </section>
  );
}
