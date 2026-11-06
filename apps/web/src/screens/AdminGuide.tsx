import { ADMIN_GUIDE_COHORT } from '@kreators/shared';
import { Link } from 'react-router';
import { PageHeader } from '../components/PageHeader';
import { Screen } from '../components/Screen';
import { SkeletonList } from '../components/Skeleton';
import { useMe } from '../lib/queries';
import { Cohort } from './Cohort';

/**
 * The Admin guide at /admin/guide: the private School cohort, drawn here so School's switch never stands in an admin's way (the
 * server's module gate lets an admin reach this one cohort too). Anyone else gets a plain line, never the lessons.
 */
export function AdminGuide() {
  const me = useMe();
  if (!me.data)
    return (
      <Screen>
        <SkeletonList count={4} lines={2} label="Loading the guide" />
      </Screen>
    );
  if (me.data.user.role !== 'admin')
    return (
      <Screen>
        <PageHeader back={{ to: '/home', label: 'Home' }} title="Admin guide" />
        <div className="mt-md rounded-tile bg-card p-md shadow-toy-soft">
          <p className="m-0 text-card-title">This guide is for admins</p>
          <p className="m-0 text-card-note text-ink-soft">Sign in with an admin account to read it.</p>
          <Link to="/home" className="toy btn-primary mt-md inline-flex min-h-[48px] items-center justify-center gap-xs rounded-pill bg-ink px-md text-headline text-on-ink">
            Go to Home
          </Link>
        </div>
      </Screen>
    );
  return <Cohort cohortId={ADMIN_GUIDE_COHORT} back={{ to: '/admin', label: 'Admin' }} />;
}
