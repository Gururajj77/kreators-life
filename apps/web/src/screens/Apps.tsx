import { type ModuleGroup } from '@kreators/shared';
import { AppGroups } from '../components/AppGroups';
import { CondensedTitle } from '../components/fx/CondensedTitle';
import { Screen } from '../components/Screen';
import { SearchBox } from '../components/SearchBox';
import { useGroupOrder, useModules } from '../lib/modules';
import { useMe } from '../lib/queries';

const ORDER: ModuleGroup[] = ['earn', 'creator', 'community', 'wellbeing', 'core', 'manage'];

/**
 * Every app, grouped, each group one big accordion in its pillar's colour (components/AppGroups.tsx); Contribution and
 * Essentials start open unless the person picked otherwise under Profile, Features, and the apps follow their own order there. Opening a group
 * lists its apps: the name opens an app that is on, and the switch beside it turns it on or off right here. The same groups sit under
 * Profile, Features. Rank and rewards are part of the game, not apps.
 */
export function Apps() {
  const me = useMe();
  const { modules } = useModules();
  const groupOrder = useGroupOrder(ORDER);
  const on = modules.filter((m) => !m.locked && m.available && m.on).length;

  return (
    <Screen>
      <header className="pt-lg">
        <CondensedTitle title="Apps">
          <h1 className="type-large">Apps</h1>
        </CondensedTitle>
        <p className="mt-xs m-0 text-subhead text-ink-soft">{on} on. Open a group to see its apps and switch them.</p>
        <div className="mt-md">
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
