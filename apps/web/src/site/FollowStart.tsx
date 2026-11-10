import { Suspense, type ReactNode } from 'react';
import { Link } from 'react-router';
import { lazyNamed } from '../lib/lazy';
import { SITE_PRIMARY } from './buttons';

// Its own small chunk, so the landing page's first download does not grow.
const FollowAction = lazyNamed(() => import('../components/FollowAction'), 'FollowAction');

/**
 * A public page's main action kept in reach on a phone (FollowAction: a bar at the bottom edge while none of the page's own copies,
 * marked `data-main-action`, is on screen). The same words and place as the page's own button.
 */
export function FollowStart({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <FollowAction label="Get started">
        <Link to={to} className={`${SITE_PRIMARY} w-full`}>
          {children}
        </Link>
      </FollowAction>
    </Suspense>
  );
}
