import { TEAM_ROLE_META, type MyTeam } from '@kreators/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { api } from '../lib/api';
import { useModule } from '../lib/modules';
import { useAuthed } from '../lib/queries';
import { Button } from './Button';
import { ErrorLine } from './ErrorLine';

/** The member's own list of teams (GET /me/teams, core): one query key for the switcher, the invites and the inbox. */
export const MY_TEAMS_KEY = ['myTeams'] as const;
export function useMyTeams(enabled = true) {
  return useAuthed(MY_TEAMS_KEY, api.myTeams, enabled);
}

const article = (w: string) => (/^[aeiou]/i.test(w) ? 'an' : 'a');
/** "Acme Studio asked you to join as an editor." */
export function inviteLine(t: MyTeam): string {
  const role = TEAM_ROLE_META[t.role].name.toLowerCase();
  return `${t.agency.name} asked you to join as ${article(role)} ${role}.`;
}

/**
 * Invites waiting for this person's answer, each with Accept (outline) and Decline (quiet), so the screen keeps its one solid button. Accepting
 * also switches their Agency app on, so the team shows up at once, then opens it. `only` limits it to one invite (the inbox line's own).
 * Shows nothing when no invite waits.
 */
export function TeamInvites({ only, compact = false, className = '' }: { only?: string; /** Only the two buttons (the inbox line already says who asked). */ compact?: boolean; className?: string }) {
  const qc = useQueryClient();
  const nav = useNavigate();
  const q = useMyTeams();
  const agency = useModule('agency');
  const [said, setSaid] = useState('');
  const answer = useMutation({
    mutationFn: async (v: { t: MyTeam; yes: boolean }) => {
      await api.myTeamAnswer(v.t.id, v.yes);
      if (v.yes && agency && !agency.on && agency.available) await api.setModule('agency', true);
      return v;
    },
    onSuccess: async (v) => {
      await qc.invalidateQueries();
      if (v.yes) nav(`/agency?team=${v.t.id}`);
      else setSaid(`You said no to ${v.t.agency.name}.`);
    },
  });
  const waiting = (q.data?.teams ?? []).filter((t) => t.status === 'invited' && (!only || t.id === only));
  if (waiting.length === 0) return said ? <p role="status" className={`m-0 text-[14px] font-semibold text-ink-soft ${className}`}>{said}</p> : null;
  return (
    <div className={className}>
      <ul className="flex list-none flex-col gap-xs p-0 m-0" aria-label="Team invites">
        {waiting.map((t) => (
          <li key={t.id} className={compact ? '' : 'rounded-card bg-card p-md shadow-toy-soft'}>
            {!compact && <p className="m-0 text-[16px] font-extrabold">{inviteLine(t)}</p>}
            {!compact && <p className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">{t.role === 'client' ? (t.clientName ? `You would see the work for ${t.clientName}, read only.` : 'You would see your own work, read only.') : TEAM_ROLE_META[t.role].blurb}</p>}
            <div className={`${compact ? '' : 'mt-sm '}flex flex-wrap gap-xs`}>
              <Button variant="outline" size="sm" onClick={() => answer.mutate({ t, yes: true })} disabled={answer.isPending} aria-label={`Accept: ${inviteLine(t)}`}>
                Accept
              </Button>
              <Button variant="ghost" size="sm" onClick={() => answer.mutate({ t, yes: false })} disabled={answer.isPending} aria-label={`Decline: ${inviteLine(t)}`}>
                Decline
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {answer.isError && <ErrorLine e={answer.error} className="mt-xs" />}
      {said && <p role="status" className="mt-xs m-0 text-[14px] font-semibold text-ink-soft">{said}</p>}
    </div>
  );
}
