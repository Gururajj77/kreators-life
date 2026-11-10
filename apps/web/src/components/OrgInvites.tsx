import type { OrgInvite } from '@kreators/shared/connect';
import { useRef, useState } from 'react';
import { connectApi } from '../lib/connectApi';
import { focusHeadingAfter } from '../lib/focusHeading';
import { useAuthed, useRefreshAll } from '../lib/queries';
import { Button } from './Button';
import { ErrorLine } from './ErrorLine';

/**
 * A brand's ask onto its team (2026-11-10, the founder: an ask they answer, not an add), on the Profile tab beside the team's friend
 * suggestions, in the same look (`/you#org-invites`). Yes puts them on the brand's team in Army; no takes the ask away and nobody is told
 * who said no. Shown only while one waits; its calls live under /me/org-invites, which no app switch closes.
 */
export function OrgInvites() {
  const q = useAuthed(['org-invites'], () => connectApi.orgInvites());
  const refresh = useRefreshAll();
  const [busy, setBusy] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [said, setSaid] = useState('');
  // A second tap that lands before the buttons show they are busy (a double tap) answers nothing: the first answer is the one.
  const answering = useRef(false);
  const list = q.data?.invites ?? [];
  if (!list.length && !said) return null;
  const answer = async (o: OrgInvite, yes: boolean) => {
    if (answering.current) return;
    answering.current = true;
    setBusy(o.orgId);
    setError(null);
    try {
      await connectApi.answerOrg(o.orgId, yes);
      setSaid(yes ? `You are on ${o.name}’s team. Its campaigns are in Army.` : 'Closed. Nobody is told who said no.');
      await q.refetch();
      refresh();
      // The Yes and No go once answered, so the keyboard moves to the heading; the line under the list says what happened.
      focusHeadingAfter('org-invites-heading');
    } catch (e) {
      setError(e);
    } finally {
      answering.current = false;
      setBusy('');
    }
  };
  return (
    <section className="mt-lg" aria-labelledby="org-invites-heading" id="org-invites">
      <h2 id="org-invites-heading" className="text-title2">
        Asked to join a brand
      </h2>
      <p className="mt-xs m-0 text-subhead text-ink-soft">You join its team only if you say yes.</p>
      <ul className="mt-sm m-0 grid list-none gap-xs p-0">
        {list.map((o) => (
          <li key={o.orgId} className="flex flex-wrap items-center justify-between gap-sm rounded-tile bg-card p-sm shadow-toy-soft">
            <span className="min-w-0 flex-[1_1_14rem]">
              <span className="block text-headline [overflow-wrap:anywhere]">{o.name}</span>
              <span className="block text-subhead text-ink-soft">Its team works on campaigns in Army.</span>
            </span>
            <span className="ml-auto flex gap-xs">
              <Button size="sm" variant="outline" disabled={busy === o.orgId} onClick={() => void answer(o, true)}>
                Yes
              </Button>
              <Button size="sm" variant="ghost" disabled={busy === o.orgId} onClick={() => void answer(o, false)}>
                No, thanks
              </Button>
            </span>
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
