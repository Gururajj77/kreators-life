import { coachSectionsFor, coachSectionState, type CoachSectionState } from '@kreators/shared/coachReport';
import type { CoachPrefs } from '@kreators/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { useLocation } from 'react-router';
import { api } from '../lib/api';
import { evenGrid, evenTile } from '../lib/bento';
import { useAuthed } from '../lib/queries';
import { Fold } from './Fold';
import { Toggle } from './Toggle';

const KEY = ['coach-prefs'] as const;
const SAVE_AFTER_MS = 500;
/** One switch to a row on a phone, two from the tablet, in even rows. */
const TOGGLE_COLS = { base: 1, md: 2 } as const;

export interface CoachSections {
  state: (key: string) => CoachSectionState;
  set: (key: string, next: CoachSectionState) => void;
  readSharing: boolean;
  /** A new coach read how sharing works. */
  markRead: () => void;
}

/**
 * Which sections a person shows on their Coaching pages (2026-11-07, the founder: "give toggles to each section in coaching as it can easily get
 * overwhelming"): open, closed or hidden, saved on the account, the same for every student. A tap changes the page at once; the save goes
 * half a second after the last one, and still goes when the page is left.
 */
export function useCoachSections(isCoach = true): CoachSections {
  const qc = useQueryClient();
  const q = useAuthed(KEY, () => api.coachPrefs());
  const saved = q.data?.sections;
  const timer = useRef<number | null>(null);
  const flush = useCallback(() => {
    if (timer.current === null) return;
    window.clearTimeout(timer.current);
    timer.current = null;
    const now = qc.getQueryData<CoachPrefs>(KEY);
    if (now) void api.saveCoachPrefs({ sections: now.sections }).catch(() => void qc.invalidateQueries({ queryKey: KEY }));
  }, [qc]);
  useEffect(() => flush, [flush]);
  const state = useCallback((key: string) => coachSectionState(saved, key, isCoach), [saved, isCoach]);
  const set = useCallback(
    (key: string, next: CoachSectionState) => {
      qc.setQueryData<CoachPrefs>(KEY, (old) => ({ readSharing: old?.readSharing ?? false, sections: { ...(old?.sections ?? {}), [key]: next } }));
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(flush, SAVE_AFTER_MS);
    },
    [qc, flush],
  );
  const markRead = useCallback(() => {
    if (qc.getQueryData<CoachPrefs>(KEY)?.readSharing) return;
    qc.setQueryData<CoachPrefs>(KEY, (old) => ({ sections: old?.sections ?? {}, readSharing: true }));
    void api.saveCoachPrefs({ readSharing: true }).catch(() => void qc.invalidateQueries({ queryKey: KEY }));
  }, [qc]);
  return { state, set, readSharing: q.data?.readSharing ?? false, markRead };
}

/** One switch per section: what shows on this page. Tucked in a fold, so the switches are never one more wall. */
export function ShowOnThisPage({ page, isCoach, sections, className = 'mt-md' }: { page: 'student' | 'hub'; isCoach: boolean; sections: CoachSections; className?: string }) {
  const list = coachSectionsFor(page, isCoach);
  const shown = list.filter((s) => sections.state(s.key) !== 'hidden').length;
  return (
    <Fold title="Show on this page" hint={`${shown} of ${list.length}`} className={className}>
      <ul className={`m-0 grid list-none gap-xs p-0 ${evenGrid(list.length, TOGGLE_COLS)}`}>
        {list.map((s, i) => (
          <li key={s.key} className={evenTile(i, list.length, TOGGLE_COLS)}>
            <Toggle on={sections.state(s.key) !== 'hidden'} onChange={(on) => sections.set(s.key, on ? (s.line ? 'open' : s.open ? 'open' : 'closed') : 'hidden')} label={s.name} />
          </li>
        ))}
      </ul>
    </Fold>
  );
}

/**
 * One section of a Coaching page as a fold: its open state is the saved choice, and a hidden one draws nothing, unless a link's hash names it (an
 * inbox note landing here always finds its section). What the section says about itself and its action sit under the title, words left and
 * action right.
 */
export function CoachFold({ sections, k, id, title, hint, lede, action, children }: { sections: CoachSections; k: string; id: string; title: ReactNode; hint?: ReactNode; lede?: ReactNode; action?: ReactNode; children: ReactNode }) {
  const { hash } = useLocation();
  const state = sections.state(k);
  if (state === 'hidden' && hash !== `#${id}`) return null;
  return (
    <section className="mt-sm" aria-labelledby={`${id}-name`}>
      <Fold id={id} title={<span id={`${id}-name`}>{title}</span>} hint={hint} open={state === 'open'} onOpenChange={(open) => sections.set(k, open ? 'open' : 'closed')}>
        {(lede || action) && (
          <div className="mb-sm flex flex-wrap-reverse items-start justify-between gap-sm">
            {lede ? <p className="m-0 min-w-[60%] flex-1 text-balance text-subhead text-ink-soft">{lede}</p> : <span />}
            {action && <div className="shrink-0">{action}</div>}
          </div>
        )}
        {children}
      </Fold>
    </section>
  );
}
