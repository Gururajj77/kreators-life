import { RELATIONSHIPS } from '@kreators/shared';
import type { ReactNode } from 'react';
import { createBrowserRouter, Navigate, Outlet, RouterProvider, useLocation } from 'react-router';
import { Avatar } from './components/Avatar';
import { Button } from './components/Button';
import { ThemeToggle } from './components/ThemeToggle';
import { Gate } from './components/Gate';
import { TabBar } from './components/TabBar';
import { useMe } from './lib/queries';
import { useApplyTheme } from './lib/theme';
import { useSession } from './lib/store';
import { Admin } from './screens/Admin';
import { Apps } from './screens/Apps';
import { Army, Campaign } from './screens/Army';
import { Auth } from './screens/Auth';
import { Automations } from './screens/Automations';
import { Bond } from './screens/Bond';
import { CircleGroup, Circles } from './screens/Circles';
import { Club } from './screens/Club';
import { Cohort } from './screens/Cohort';
import { Community } from './screens/Community';
import { Companion } from './screens/Companion';
import { Content } from './screens/Content';
import { Customers } from './screens/Customers';
import { Finance } from './screens/Finance';
import { DmInbox } from './screens/DmInbox';
import { EventPage, Party } from './screens/Party';
import { Help } from './screens/Help';
import { Home as Dashboard } from './screens/Home';
import { Inbox } from './screens/Inbox';
import { Journal } from './screens/Journal';
import { Leaderboard } from './screens/Leaderboard';
import { Library } from './screens/Library';
import { Life } from './screens/Life';
import { Manage } from './screens/Manage';
import { Mindful } from './screens/Mindful';
import { Mood } from './screens/Mood';
import { Opportunity, Work } from './screens/Work';
import { ProductPage } from './screens/ProductPage';
import { Profile } from './screens/Profile';
import { Proposals } from './screens/Proposals';
import { Public } from './screens/Public';
import { Realm } from './screens/Realm';
import { Resources } from './screens/Resources';
import { Rewards } from './screens/Rewards';
import { School } from './screens/School';
import { Search } from './screens/Search';
import { Sessions } from './screens/Sessions';
import { Sleep } from './screens/Sleep';
import { Stress } from './screens/Stress';
import { Studio } from './screens/Studio';
import { StudioAudience } from './screens/StudioAudience';
import { StudioProduct } from './screens/StudioProduct';
import { Today } from './screens/Today';
import { Tools } from './screens/Tools';
import { Tower } from './screens/Tower';
import { VibeCheck } from './screens/VibeCheck';
import { Welcome } from './screens/Welcome';
import { Wellbeing } from './screens/Wellbeing';
import { Reward, Win } from './screens/Win';
import { You } from './screens/You';
import { CertificatePage } from './site/CertificatePage';
import { InvoicePage } from './site/InvoicePage';
import { Policy } from './site/Policy';
import { Explore } from './site/Explore';
import { Feature } from './site/Feature';
import { Home } from './site/Home';

function Loading() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-md px-md" role="status">
      <div className="flex gap-xs">
        {RELATIONSHIPS.map((r) => (
          <Avatar key={r.key} relationship={r.key} size={36} />
        ))}
      </div>
      <p className="m-0 text-[14px] font-bold text-ink-soft">Stacking your tower</p>
    </div>
  );
}

/** Sends people without a session to sign in, and brings them back here afterwards. */
function toSignIn(pathname: string, search: string) {
  const next = `${pathname}${search}`;
  return `/signin?next=${encodeURIComponent(next)}`;
}

function RequireSession() {
  const token = useSession((s) => s.token);
  const loc = useLocation();
  if (!token) return <Navigate to={toSignIn(loc.pathname, loc.search)} replace />;
  return <Outlet />;
}

function Shell() {
  const token = useSession((s) => s.token);
  const me = useMe();
  const loc = useLocation();
  if (!token) return <Navigate to={toSignIn(loc.pathname, loc.search)} replace />;
  if (me.isPending) return <Loading />;
  if (me.isError) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col items-center justify-center gap-md px-md text-center" role="alert">
        <Avatar relationship="self" size={72} mood="sleepy" />
        <p className="m-0 text-[18px] font-extrabold">Could not reach the tower.</p>
        <p className="m-0 text-[14px] font-semibold text-ink-soft">Check your connection, then try again.</p>
        <Button onClick={() => me.refetch()}>Try again</Button>
      </div>
    );
  }
  if (!me.data.user.onboardedAt) return <Navigate to="/vibe-check" replace />;
  return (
    <>
      <Outlet />
      <TabBar />
    </>
  );
}

const gated = (key: string, el: ReactNode) => <Gate moduleKey={key}>{el}</Gate>;

/** Pages outside the app shell and the public site still get the theme switch. */
function Standalone() {
  return (
    <>
      <ThemeToggle floating />
      <Outlet />
    </>
  );
}

const router = createBrowserRouter([
  // The public site: no account needed.
  { path: '/', element: <Home /> },
  { path: '/explore', element: <Explore /> },
  { path: '/features/:key', element: <Feature /> },
  { path: '/c/:code', element: <CertificatePage /> },
  { path: '/i/:token', element: <InvoicePage /> },
  { path: '/terms', element: <Policy kind="terms" /> },
  { path: '/privacy', element: <Policy kind="privacy" /> },
  { path: '/refunds', element: <Policy kind="refunds" /> },
  { path: '/contact', element: <Policy kind="contact" /> },
  { path: '/pricing', element: <Policy kind="pricing" /> },
  {
    element: <Standalone />,
    children: [
      { path: '/start', element: <Welcome /> },
      { path: '/signin', element: <Auth mode="signin" /> },
      { path: '/signup', element: <Auth mode="signup" /> },
      { path: '/u/:handle', element: <Public /> },
      { path: '/p/:id', element: <ProductPage /> },
      { path: '/admin', element: <Admin /> },
      {
        element: <RequireSession />,
        children: [{ path: '/vibe-check', element: <VibeCheck /> }],
      },
    ],
  },
  // The app: everything behind a session.
  {
    element: <Shell />,
    children: [
      { path: '/home', element: <Dashboard /> },
      { path: '/today', element: <Today /> },
      { path: '/tower', element: <Tower /> },
      { path: '/realm/:key', element: <Realm /> },
      { path: '/apps', element: <Apps /> },
      { path: '/you', element: <You /> },
      { path: '/search', element: <Search /> },
      { path: '/profile', element: gated('profile', <Profile />) },
      { path: '/help', element: gated('help', <Help />) },
      { path: '/inbox', element: gated('notifications', <Inbox />) },
      { path: '/leaderboard', element: gated('leaderboard', <Leaderboard />) },
      { path: '/rewards', element: gated('rewards', <Rewards />) },
      // learn and earn
      { path: '/school', element: gated('school', <School />) },
      { path: '/school/:id', element: gated('school', <Cohort />) },
      { path: '/work', element: gated('work', <Work />) },
      { path: '/work/:id', element: gated('work', <Opportunity />) },
      { path: '/army', element: gated('army', <Army />) },
      { path: '/army/:id', element: gated('army', <Campaign />) },
      { path: '/win', element: gated('win', <Win />) },
      { path: '/win/:id', element: gated('win', <Reward />) },
      // people
      { path: '/party', element: gated('party', <Party />) },
      { path: '/party/:id', element: gated('party', <EventPage />) },
      { path: '/community', element: gated('community', <Community />) },
      { path: '/club', element: gated('club', <Club />) },
      { path: '/bond', element: gated('bond', <Bond />) },
      { path: '/circles', element: gated('circles', <Circles />) },
      { path: '/circles/:id', element: gated('circles', <CircleGroup />) },
      // wellbeing
      { path: '/life', element: gated('life', <Life />) },
      { path: '/wellbeing', element: gated('wellbeing', <Wellbeing />) },
      { path: '/mood', element: gated('mood', <Mood />) },
      { path: '/sleep', element: gated('sleep', <Sleep />) },
      { path: '/stress', element: gated('stress', <Stress />) },
      { path: '/mindful', element: gated('mindful', <Mindful />) },
      { path: '/journal', element: gated('journal', <Journal />) },
      { path: '/companion', element: gated('companion', <Companion />) },
      // creator
      { path: '/knowledge', element: gated('knowledge', <Resources />) },
      { path: '/knowledge/:id', element: gated('knowledge', <Resources />) },
      { path: '/tools', element: gated('tools', <Tools />) },
      { path: '/tv', element: gated('tv', <Proposals kind="tv" />) },
      { path: '/fund', element: gated('fund', <Proposals kind="fund" />) },
      { path: '/sessions', element: gated('library', <Sessions />) },
      { path: '/library', element: gated('library', <Library />) },
      { path: '/library/:id', element: gated('library', <Library />) },
      { path: '/shop', element: gated('shop', <Studio />) },
      { path: '/shop/products/:id', element: gated('shop', <StudioProduct />) },
      { path: '/shop/page', element: gated('profile', <Studio tab="page" />) },
      { path: '/shop/bookings', element: gated('shop', <Studio tab="bookings" />) },
      { path: '/shop/testimonials', element: gated('shop', <Studio tab="reviews" />) },
      { path: '/shop/audience', element: gated('audience', <StudioAudience />) },
      { path: '/shop/content', element: gated('content', <Content />) },
      { path: '/shop/automations', element: gated('automations', <Automations />) },
      { path: '/shop/customers', element: gated('shop', <Customers />) },
      { path: '/shop/dm', element: gated('shop', <DmInbox />) },
      { path: '/finance', element: gated('finance', <Finance />) },
      // team
      { path: '/manage', element: gated('manage', <Manage />) },
    ],
  },
  // Old addresses keep working.
  { path: '/resources', element: <Navigate to="/knowledge" replace /> },
  { path: '/resources/:id', element: <OldPath from="/resources" to="/knowledge" /> },
  { path: '/studio', element: <Navigate to="/shop" replace /> },
  { path: '/studio/*', element: <OldPath from="/studio" to="/shop" /> },
  { path: '*', element: <Navigate to="/" replace /> },
]);

function OldPath({ from, to }: { from: string; to: string }) {
  const loc = useLocation();
  return <Navigate to={`${to}${loc.pathname.slice(from.length)}${loc.search}`} replace />;
}

export function App() {
  useApplyTheme();
  return <RouterProvider router={router} />;
}
