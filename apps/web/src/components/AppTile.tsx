import type { AppModule } from '@kreators/shared';
import { useState } from 'react';
import { Link } from 'react-router';
import { tie } from '../lib/text';
import { AppIcon } from './AppIcon';

/**
 * One app on Home's Go to: the whole card a link, its name at the top left in the group's colour fill (`.app-tile`, from the `data-pillar`
 * around it) and a picture of a real object at the bottom right. The picture's file is named after the module (`/app-art/<key>.webp`,
 * scripts/app-art/build.mjs), so there is no list to download; one that fails to load gives way to the app's icon, large, in the same spot.
 */
export function AppTile({ app }: { app: Pick<AppModule, 'key' | 'name' | 'path' | 'icon'> }) {
  const [noPicture, setNoPicture] = useState(false);
  return (
    <Link to={app.path} className="app-tile toy toy-soft rounded-tile">
      <span className="text-headline break-words">{tie(app.name)}</span>
      {noPicture ? (
        <span className="app-tile-art">
          <AppIcon name={app.icon} size={72} />
        </span>
      ) : (
        <img className="app-tile-art" src={`/app-art/${app.key}.webp`} alt="" width={124} height={124} loading="lazy" decoding="async" draggable={false} onError={() => setNoPicture(true)} />
      )}
    </Link>
  );
}
