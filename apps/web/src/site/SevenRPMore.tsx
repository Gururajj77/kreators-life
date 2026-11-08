import { MODULE_GROUP_ORDER, MODULE_GROUPS, type AppModule } from '@kreators/shared';
import { TileGroups } from '../components/TileGroups';
import { AppTile, TILE_COLS } from './SevenRP';

/** "Show all": past ten, the apps read by their groups in the one order, each with its own even rows. Its own chunk, since /7rp is in the first download. */
export function MoreApps({ items }: { items: AppModule[] }) {
  return (
    <TileGroups
      list
      cols={TILE_COLS}
      flat={items}
      groups={MODULE_GROUP_ORDER.map((g) => ({ key: g, name: MODULE_GROUPS[g], tiles: items.filter((m) => m.group === g) }))}
      render={(m, className) => <AppTile key={m.key} m={m} className={className} />}
    />
  );
}
