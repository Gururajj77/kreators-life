import { Suspense } from 'react';
import { AppCover } from '../components/AppCover';
import { Screen } from '../components/Screen';
import { lazyNamed } from '../lib/lazy';

const AdminConnect = lazyNamed(() => import('../components/AdminConnect'), 'AdminConnect');

/**
 * Connect people for staff (2026-11-10, the founder: "yes to all"): the Admin tab's form and list, inside Manage, through /manage/connect.
 * The server answers which kinds this person's permissions govern (Cohorts: School programs, Shop courses and a cohort's manager; Reviewer:
 * a Club manager; Talent manager: a brand's team; Moderator: friends), and the form and the list show only those.
 */
export function ManageConnect() {
  return (
    <Screen>
      <AppCover back={{ to: '/manage', label: 'Manage' }} title="Connect people" lede="Join people for the jobs you hold. Asks wait for a yes." />
      <Suspense fallback={<p role="status" className="mt-md m-0 text-subhead text-ink-soft">Opening Connect people</p>}>
        <AdminConnect door={null} titled={false} />
      </Suspense>
    </Screen>
  );
}
