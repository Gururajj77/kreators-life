import { MODULE_BY_KEY } from '@kreators/shared';
import { useMutation } from '@tanstack/react-query';
import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router';
import { api } from '../lib/api';
import { useModule } from '../lib/modules';
import { useRefreshAll } from '../lib/queries';
import { ErrorLine } from './ErrorLine';
import { AppIcon } from './AppIcon';
import { HowTo } from './HowTo';
import { Screen } from './Screen';

/** Shows a module's screen only when it is on for this person. */
export function Gate({ moduleKey, children }: { moduleKey: string; children: ReactNode }) {
  const m = useModule(moduleKey);
  const meta = MODULE_BY_KEY[moduleKey];
  const refresh = useRefreshAll();
  // A note or a link into an app the person hid shows it again right here (2026-11-13, the frictionless pass): the same per-person switch
  // as Apps' Show, and the page then draws the app in place, instead of a trip to Apps and back.
  const show = useMutation({ mutationFn: () => api.setModule(moduleKey, true), onSuccess: () => refresh() });
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
          {m.available ? 'You hid it. Show it again here, or from Apps.' : 'It is not available on your account right now.'}
        </p>
        {m.available && (
          <>
            <button
              type="button"
              onClick={() => show.mutate()}
              disabled={show.isPending}
              className="toy mt-md inline-flex min-h-[40px] md:min-h-[48px] tap-pad cursor-pointer items-center rounded-pill bg-ink px-md font-semibold text-on-ink disabled:opacity-60"
            >
              {show.isPending ? 'Showing…' : `Show ${meta?.name ?? 'it'}`}
            </button>
            <ErrorLine e={show.error} className="mx-auto mt-xs max-w-[420px] text-left" />
            <p className="mt-xs m-0">
              <Link to="/apps" className="inline-flex min-h-[44px] items-center text-subhead font-semibold underline underline-offset-4">
                Open Apps
              </Link>
            </p>
          </>
        )}
      </div>
    </Screen>
  );
}
