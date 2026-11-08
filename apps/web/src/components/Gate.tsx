import { MODULE_BY_KEY } from '@kreators/shared';
import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useModule } from '../lib/modules';
import { AppIcon } from './AppIcon';
import { HowTo } from './HowTo';
import { Screen } from './Screen';

/** Shows a module's screen only when it is on for this person. */
export function Gate({ moduleKey, children }: { moduleKey: string; children: ReactNode }) {
  const m = useModule(moduleKey);
  const meta = MODULE_BY_KEY[moduleKey];
  // Dark mode tints this app's pages with its relationship's hue instead of plain brown.
  useEffect(() => {
    const accent = meta?.accent;
    if (!accent) return;
    document.documentElement.dataset.accent = accent;
    return () => {
      delete document.documentElement.dataset.accent;
    };
  }, [meta?.accent]);
  if (!m) return null;
  if (m.on) return <HowTo moduleKey={moduleKey}>{children}</HowTo>;
  return (
    <Screen>
      <div className="pt-xl text-center">
        <p className="m-0 flex justify-center text-ink-soft">
          <AppIcon name={meta?.icon} size={40} />
        </p>
        <h1 className="mt-sm text-large-title">{meta?.name ?? 'This feature'} {m.available ? 'is hidden' : 'is off'}</h1>
        <p className="mt-sm m-0 text-callout text-ink-soft">
          {m.available ? 'You hid it. Show it again from Apps.' : 'It is not available on your account right now.'}
        </p>
        {m.available && (
          <Link to="/apps" className="toy mt-md inline-flex min-h-[48px] items-center rounded-pill bg-ink px-md font-semibold text-on-ink">
            Open Apps
          </Link>
        )}
      </div>
    </Screen>
  );
}
