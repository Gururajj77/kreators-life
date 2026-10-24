import { MODULE_BY_KEY } from '@kreators/shared';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useModule } from '../lib/modules';
import { Screen } from './Screen';

/** Shows a module's screen only when it is on for this person. */
export function Gate({ moduleKey, children }: { moduleKey: string; children: ReactNode }) {
  const m = useModule(moduleKey);
  const meta = MODULE_BY_KEY[moduleKey];
  if (!m) return null;
  if (m.on) return <>{children}</>;
  return (
    <Screen>
      <div className="pt-xl text-center">
        <p className="m-0 text-[36px]" aria-hidden="true">
          {meta?.emoji}
        </p>
        <h1 className="mt-sm text-[30px]">{meta?.name ?? 'This feature'} is off</h1>
        <p className="mt-sm m-0 text-[16px] font-semibold text-ink-soft">
          {m.available ? 'You switched it off. Turn it back on under You, Features.' : 'It is not available on your account right now.'}
        </p>
        {m.available && (
          <Link to="/you#features" className="toy mt-md inline-flex min-h-[48px] items-center rounded-pill bg-ink px-md font-bold text-on-ink">
            Open features
          </Link>
        )}
      </div>
    </Screen>
  );
}
