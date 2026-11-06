import { type ModuleGroup } from '@kreators/shared';
import { useId, useState } from 'react';
import { EyeOff } from 'lucide-react';
import { AppGroups, HiddenAppsPanel, useFits, useHiddenApps } from '../components/AppGroups';
import { ToggleIcon } from '../components/ToggleMark';
import { CondensedTitle } from '../components/fx/CondensedTitle';
import { Screen } from '../components/Screen';
import { SearchBox } from '../components/SearchBox';
import { useGroupOrder, useModules } from '../lib/modules';
import { useMe } from '../lib/queries';

const ORDER: ModuleGroup[] = ['earn', 'creator', 'community', 'wellbeing', 'core', 'manage'];

/**
 * Every app, grouped, each group one big accordion in its pillar's colour (components/AppGroups.tsx); Contribution and
 * Essentials start open unless the person picked otherwise under Profile, Features, and the apps follow their own order there. Opening a group
 * lists the apps shown, each with Hide, and the hidden ones in a Hidden apps fold at its end, each with Unhide. The same groups sit under
 * Profile, Features. Beside the count, a round button opens every hidden app in one inline panel (the founder, 2026-11-06), so one is
 * brought back without opening its group; it shows only while an app is hidden (or the panel is open). Rank and rewards are part of the game, not apps.
 */
export function Apps() {
  const me = useMe();
  const { modules } = useModules();
  const groupOrder = useGroupOrder(ORDER);
  const on = modules.filter((m) => !m.locked && m.available && m.on).length;
  const hidden = useHiddenApps(groupOrder).reduce((n, x) => n + x.list.length, 0);
  const [showHidden, setShowHidden] = useState(false);
  const fits = useFits();
  const panel = useId();
  const label = showHidden ? 'Close hidden apps' : `Hidden apps (${hidden})`;

  return (
    <Screen>
      <header className="pt-lg">
        <CondensedTitle title="Apps">
          <h1 className="type-large">Apps</h1>
        </CondensedTitle>
        {/* The count at the left and the hidden-apps button at its right, on one line. The button's 44px reaches past the line above and
            below (`-my-sm`), so the count keeps its place under the title whether the button shows or not. */}
        <div className="mt-xs flex items-center justify-between gap-sm">
          <p className="m-0 min-w-0 text-subhead text-ink-soft">
            {on} shown{hidden > 0 ? `, ${hidden} hidden` : ''}. Open a group to see its apps, or hide one.
          </p>
          {(hidden > 0 || showHidden) && (
            <button type="button" className="mf-round toy -my-sm shrink-0" data-at="br" data-tip={label} aria-label={label} title={label} aria-expanded={showHidden} aria-controls={panel} onClick={() => setShowHidden((v) => !v)}>
              <ToggleIcon open={showHidden} icon={EyeOff} />
            </button>
          )}
        </div>
        {showHidden && (
          <div className="mt-sm">
            <HiddenAppsPanel groups={groupOrder} id={panel} fits={fits} />
          </div>
        )}
        {/* A gap past the round button's reach when it shows, so it never crowds the search. */}
        <div className={hidden > 0 && !showHidden ? 'mt-lg' : 'mt-md'}>
          <SearchBox placeholder="Search tasks, journals, library, products, people" />
        </div>
      </header>

      <div className="span-all mt-lg">
        <AppGroups groups={groupOrder} unread={me.data?.unread ?? 0} where="apps" />
      </div>

      <p className="span-all mt-lg m-0 rounded-tile bg-paper p-sm text-center text-subhead text-ink-soft">Rank and rewards are part of the game and live under Profile.</p>
    </Screen>
  );
}
