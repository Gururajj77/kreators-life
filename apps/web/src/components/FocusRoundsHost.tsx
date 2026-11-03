// FocusRounds, mounted once at the root (Root in App.tsx) for as long as someone is signed in, outside the app shell and the standalone
// pages, so a running clock, its breaks, its chime and its logging keep going on every page: the app, the two whole-page chats, the vibe
// check, the public site and the card table alike. Signing out unmounts it.
//
// React portals the clock into ONE container that never changes (`home`, made once). Only that container moves: into Mindful's slot
// while Mindful is the screen showing (lib/focusPortal.ts), so it reads as part of that page, and into a hidden parking spot everywhere
// else. Moving a DOM node is invisible to React; changing a portal's container is not (React throws the old tree away and builds a new
// one, which reset the clock on every page change). So the portal's container is fixed and only its place on the page changes.
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useCelebrate } from './Celebration';
import { FocusRounds } from './FocusRounds';
import { api } from '../lib/api';
import { todayLocal } from '../lib/date';
import { useFocusPortal } from '../lib/focusPortal';
import { useFocusSession } from '../lib/focusSession';
import { useRefreshAll } from '../lib/queries';

export function FocusRoundsHost() {
  const target = useFocusPortal((s) => s.target);
  // Off the page, aria-hidden and inert, so nothing parked here can be reached; the clock still ticks.
  const [parking, setParking] = useState<HTMLDivElement | null>(null);
  const [home] = useState(() => document.createElement('div'));
  const qc = useQueryClient();
  const refresh = useRefreshAll();
  const celebrate = useCelebrate();
  const said = useFocusSession((s) => s.said);

  useEffect(() => {
    const place = target ?? parking;
    if (place && home.parentNode !== place) place.appendChild(home);
  }, [target, parking, home]);
  useEffect(() => () => home.remove(), [home]);

  return (
    <>
      <div ref={setParking} aria-hidden="true" inert className="sr-only" />
      {/* The parked panel is hidden from screen readers, so its spoken lines ("Mini break.", "Timer done.") are said from here while
          Mindful is not the screen showing. */}
      <p className="sr-only" role="status" aria-live="polite">
        {target ? '' : said}
      </p>
      {createPortal(
        <FocusRounds
          onRound={(m, nodeId, more) =>
            api
              .logFocus(m, nodeId, todayLocal(), more)
              .then((r) => {
                void qc.invalidateQueries({ queryKey: ['focus'] });
                void qc.invalidateQueries({ queryKey: ['focus-today'] });
                void qc.invalidateQueries({ queryKey: ['focus-recent'] });
                // The round and its mindful minutes are one write; a duplicate (another tab already kept this part) celebrates nothing.
                if (r.logged) {
                  refresh();
                  celebrate({ title: `${m} mindful ${m === 1 ? 'minute' : 'minutes'} logged`, color: '#9BB068' });
                }
                return r.id ?? undefined;
              })
              .catch(() => undefined)
          }
          onLog={(m, kind) =>
            void api.log('mindful', { date: todayLocal(), value: m, extra: { kind } }).then(() => {
              refresh();
              celebrate({ title: `${m} mindful ${m === 1 ? 'minute' : 'minutes'} logged`, color: '#9BB068' });
            })
          }
        />,
        home,
      )}
    </>
  );
}
