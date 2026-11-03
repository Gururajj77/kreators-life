// FocusRounds, mounted once by Shell for as long as someone is signed in, the same way Assistant and ReminderBubble are. It never
// unmounts on a route change, so a running clock, its breaks, its chime and its logging keep going exactly as they do today, on every
// page, not only Mindful's own: nothing about the clock itself changes, only where its component instance lives. When Mindful is the
// screen showing, its own slot (lib/focusPortal.ts) portals this panel into Mindful's normal layout, so it reads as part of that page;
// everywhere else it portals into a parked, hidden spot of its own, so nothing is drawn but the clock keeps ticking.
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useCelebrate } from './Celebration';
import { FocusRounds } from './FocusRounds';
import { api } from '../lib/api';
import { todayLocal } from '../lib/date';
import { useFocusPortal } from '../lib/focusPortal';
import { useRefreshAll } from '../lib/queries';

export function FocusRoundsHost() {
  const target = useFocusPortal((s) => s.target);
  // A place to live when Mindful is not the screen showing: off the page, but still in the DOM, so this component is never unmounted
  // and never stops ticking. A state, not a plain ref, so the first render (before the node exists) waits one tick rather than
  // portaling into nothing. aria-hidden and inert, since nothing in it can ever be reached this way.
  const [parking, setParking] = useState<HTMLDivElement | null>(null);
  const qc = useQueryClient();
  const refresh = useRefreshAll();
  const celebrate = useCelebrate();
  const container = target ?? parking;

  const rounds = (
    <FocusRounds
      onRound={(m, nodeId) =>
        api
          .logFocus(m, nodeId, todayLocal())
          .then((r) => {
            void qc.invalidateQueries({ queryKey: ['focus'] });
            return r.id;
          })
          .catch(() => undefined)
      }
      onLog={(m, kind) =>
        void api.log('mindful', { date: todayLocal(), value: m, extra: { kind } }).then(() => {
          refresh();
          celebrate({ title: `${m} mindful ${m === 1 ? 'minute' : 'minutes'} logged`, color: '#9BB068' });
        })
      }
    />
  );
  return (
    <>
      <div ref={setParking} aria-hidden="true" inert className="sr-only" />
      {container && createPortal(rounds, container)}
    </>
  );
}
