import { RELATIONSHIPS } from '@kreators/shared';
import { Suspense, useEffect, type ReactNode } from 'react';
import { createBrowserRouter, Navigate, Outlet, RouterProvider, ScrollRestoration, useLocation } from 'react-router';
import { Avatar } from './components/Avatar';
import { Button } from './components/Button';
import { ThemeToggle } from './components/ThemeToggle';
import { Gate } from './components/Gate';
import { HowTo } from './components/HowTo';
import { TabBar } from './components/TabBar';
import { Assistant } from './components/Assistant';
import { ReminderBubble } from './components/Reminders';
import { ConsentPopup } from './components/ConsentPopup';
import { RouteFallback } from './components/RouteFallback';
import { lazyNamed } from './lib/lazy';
import { useMe } from './lib/queries';
import { useApplyTheme } from './lib/theme';
import { useFocus, useSession } from './lib/store';
import { noteVisit } from './lib/context';
import { Auth, Forgot, ResetPassword } from './screens/Auth';
import { Home as Dashboard } from './screens/Home';
import { Today } from './screens/Today';
import { SetupChat } from './screens/SetupChat';
import { Welcome } from './screens/Welcome';
import { Home } from './site/Home';
import { SevenRP } from './site/SevenRP';

const Admin = lazyNamed(() => import('./screens/Admin'), 'Admin');
const Manage = lazyNamed(() => import('./screens/Manage'), 'Manage');
const Observability = lazyNamed(() => import('./screens/Observability'), 'Observability');
const Logs = lazyNamed(() => import('./screens/Logs'), 'Logs');
const Unsubscribe = lazyNamed(() => import('./screens/Unsubscribe'), 'Unsubscribe');
// Every other screen downloads when it is first opened (lib/lazy.ts), so the first download, and the first paint, stay small. The offline copy still has every file.
const Apps = lazyNamed(() => import('./screens/Apps'), 'Apps');
const Army = lazyNamed(() => import('./screens/Army'), 'Army');
const Campaign = lazyNamed(() => import('./screens/Army'), 'Campaign');
const Automations = lazyNamed(() => import('./screens/Automations'), 'Automations');
const Bond = lazyNamed(() => import('./screens/Bond'), 'Bond');
const BondChatScreen = lazyNamed(() => import('./screens/Bond'), 'BondChatScreen');
const CircleGroup = lazyNamed(() => import('./screens/Circles'), 'CircleGroup');
const Circles = lazyNamed(() => import('./screens/Circles'), 'Circles');
const Club = lazyNamed(() => import('./screens/Club'), 'Club');
const Cohort = lazyNamed(() => import('./screens/Cohort'), 'Cohort');
const Community = lazyNamed(() => import('./screens/Community'), 'Community');
const Companion = lazyNamed(() => import('./screens/Companion'), 'Companion');
const Content = lazyNamed(() => import('./screens/Content'), 'Content');
const ContentResults = lazyNamed(() => import('./screens/ContentResults'), 'ContentResults');
const Brand = lazyNamed(() => import('./screens/Brand'), 'Brand');
const Customers = lazyNamed(() => import('./screens/Customers'), 'Customers');
const Finance = lazyNamed(() => import('./screens/Finance'), 'Finance');
const DmInbox = lazyNamed(() => import('./screens/DmInbox'), 'DmInbox');
const EventPage = lazyNamed(() => import('./screens/Party'), 'EventPage');
const Party = lazyNamed(() => import('./screens/Party'), 'Party');
const Help = lazyNamed(() => import('./screens/Help'), 'Help');
const Inbox = lazyNamed(() => import('./screens/Inbox'), 'Inbox');
const Journal = lazyNamed(() => import('./screens/Journal'), 'Journal');
const Leaderboard = lazyNamed(() => import('./screens/Leaderboard'), 'Leaderboard');
const Library = lazyNamed(() => import('./screens/Library'), 'Library');
const Life = lazyNamed(() => import('./screens/Life'), 'Life');
const Reviews = lazyNamed(() => import('./screens/Reviews'), 'Reviews');
const Agency = lazyNamed(() => import('./screens/Agency'), 'Agency');
const AgencyClient = lazyNamed(() => import('./screens/AgencyClient'), 'AgencyClient');
const AgencyInvoice = lazyNamed(() => import('./screens/AgencyInvoice'), 'AgencyInvoice');
const AgencyContract = lazyNamed(() => import('./screens/AgencyContract'), 'AgencyContract');
const AgencyDoc = lazyNamed(() => import('./screens/AgencyDoc'), 'AgencyDoc');
const ClientPortal = lazyNamed(() => import('./site/ClientPortal'), 'ClientPortal');
const ContractPublic = lazyNamed(() => import('./site/ContractPublic'), 'ContractPublic');
const DocPublic = lazyNamed(() => import('./site/DocPublic'), 'DocPublic');
const PortalDocGate = lazyNamed(() => import('./components/PortalLock'), 'PortalDocGate');
const Run = lazyNamed(() => import('./screens/Run'), 'Run');
const RunClubPage = lazyNamed(() => import('./screens/Run'), 'RunClubPage');
const Store = lazyNamed(() => import('./screens/Store'), 'Store');
const Mindful = lazyNamed(() => import('./screens/Mindful'), 'Mindful');
const Mood = lazyNamed(() => import('./screens/Mood'), 'Mood');
const Opportunity = lazyNamed(() => import('./screens/Work'), 'Opportunity');
const Work = lazyNamed(() => import('./screens/Work'), 'Work');
const ProductPage = lazyNamed(() => import('./screens/ProductPage'), 'ProductPage');
const Profile = lazyNamed(() => import('./screens/Profile'), 'Profile');
const Proposals = lazyNamed(() => import('./screens/Proposals'), 'Proposals');
const Public = lazyNamed(() => import('./screens/Public'), 'Public');
const Realm = lazyNamed(() => import('./screens/Realm'), 'Realm');
const Resources = lazyNamed(() => import('./screens/Resources'), 'Resources');
const Rewards = lazyNamed(() => import('./screens/Rewards'), 'Rewards');
const Cards = lazyNamed(() => import('./screens/Cards'), 'Cards');
const Discover = lazyNamed(() => import('./screens/Discover'), 'Discover');
const CardTable = lazyNamed(() => import('./screens/CardTable'), 'CardTable');
const Plans = lazyNamed(() => import('./screens/Plans'), 'Plans');
const Coaching = lazyNamed(() => import('./screens/Coaching'), 'Coaching');
const CoachStudent = lazyNamed(() => import('./screens/CoachStudent'), 'CoachStudent');
const School = lazyNamed(() => import('./screens/School'), 'School');
const Search = lazyNamed(() => import('./screens/Search'), 'Search');
const Sessions = lazyNamed(() => import('./screens/Sessions'), 'Sessions');
const Sleep = lazyNamed(() => import('./screens/Sleep'), 'Sleep');
const Stress = lazyNamed(() => import('./screens/Stress'), 'Stress');
const Studio = lazyNamed(() => import('./screens/Studio'), 'Studio');
const StudioAudience = lazyNamed(() => import('./screens/StudioAudience'), 'StudioAudience');
const StudioProduct = lazyNamed(() => import('./screens/StudioProduct'), 'StudioProduct');
const Tools = lazyNamed(() => import('./screens/Tools'), 'Tools');
const Tower = lazyNamed(() => import('./screens/Tower'), 'Tower');
const VibeCheck = lazyNamed(() => import('./screens/VibeCheck'), 'VibeCheck');
const SessionChat = lazyNamed(() => import('./screens/SessionChat'), 'SessionChat');
const Wellbeing = lazyNamed(() => import('./screens/Wellbeing'), 'Wellbeing');
const Reward = lazyNamed(() => import('./screens/Win'), 'Reward');
const Win = lazyNamed(() => import('./screens/Win'), 'Win');
const You = lazyNamed(() => import('./screens/You'), 'You');
const CertificatePage = lazyNamed(() => import('./site/CertificatePage'), 'CertificatePage');
const InvoicePage = lazyNamed(() => import('./site/InvoicePage'), 'InvoicePage');
const Policy = lazyNamed(() => import('./site/Policy'), 'Policy');
const Copyright = lazyNamed(() => import('./site/Copyright'), 'Copyright');
const Licences = lazyNamed(() => import('./site/Licences'), 'Licences');
const Subprocessors = lazyNamed(() => import('./site/Subprocessors'), 'Subprocessors');
const Explore = lazyNamed(() => import('./site/Explore'), 'Explore');
const Feature = lazyNamed(() => import('./site/Feature'), 'Feature');
const Features = lazyNamed(() => import('./site/Features'), 'Features');

function Loading() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-md px-md" role="status">
      <div className="flex gap-xs">
        {RELATIONSHIPS.map((r) => (
          <Avatar key={r.key} relationship={r.key} size={36} />
        ))}
      </div>
      <p className="m-0 text-[14px] font-bold text-ink-soft">Setting things up</p>
    </div>
  );
}

/**
 * Where a screen that is still downloading shows its skeleton. Each layout (the root, the standalone pages and the
 * app shell) has one, so the tab bar and the theme switch stay put while the page under them arrives.
 */
function Page({ tabs }: { tabs: boolean }) {
  return (
    <Suspense fallback={<RouteFallback tabs={tabs} />}>
      <Outlet />
    </Suspense>
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
  const focus = useFocus((s) => s.on);
  const where = useLocation().pathname;
  // Remember which apps get opened, on this device only, so the lists can put them nearer the top next time.
  useEffect(() => noteVisit(where), [where]);
  const token = useSession((s) => s.token);
  const me = useMe();
  const loc = useLocation();
  if (!token) return <Navigate to={toSignIn(loc.pathname, loc.search)} replace />;
  if (me.isPending) return <Loading />;
  if (me.isError) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col items-center justify-center gap-md px-md text-center" role="alert">
        <Avatar relationship="self" size={72} mood="sleepy" />
        <p className="m-0 text-[18px] font-extrabold">Could not reach the server.</p>
        <p className="m-0 text-[14px] font-semibold text-ink-soft">Check your connection, then try again.</p>
        <Button onClick={() => me.refetch()}>Try again</Button>
      </div>
    );
  }
  if (!me.data.user.onboardedAt) return <Navigate to="/onboarding" replace />;
  return (
    <>
      <Page tabs />
      {!focus && (
        <div className="contents no-print">
          <TabBar />
          <Assistant />
          <ReminderBubble />
        </div>
      )}
    </>
  );
}

const gated = (key: string, el: ReactNode) => <Gate moduleKey={key}>{el}</Gate>;
/** The core tabs are never gated, but they get the same how-it-works pill. */
const explained = (key: string, el: ReactNode) => (
  <HowTo moduleKey={key}>
    {el}
  </HowTo>
);

/** Every new page starts at the top. A link with a hash still lands on its element. */
/** A new page starts at the top and a hash lands on its element; Back and Forward return to where you were. */
function Root() {
  return (
    <>
      <ScrollRestoration />
      <Page tabs={false} />
      <ConsentPopup />
    </>
  );
}

/** Pages outside the app shell and the public site still get the theme switch. */
function Standalone() {
  return (
    <>
      <ThemeToggle floating />
      <Page tabs={false} />
    </>
  );
}

const router = createBrowserRouter([
  {
    element: <Root />,
    children: [
  // The public site: no account needed.
  { path: '/', element: <Home /> },
  { path: '/explore', element: <Explore /> },
  { path: '/features', element: <Features /> },
  { path: '/7rp', element: <SevenRP /> },
  { path: '/features/:key', element: <Feature /> },
  { path: '/c/:code', element: <CertificatePage /> },
  { path: '/i/:token', element: <PortalDocGate kind="invoices"><InvoicePage /></PortalDocGate> },
  { path: '/a/:token', element: <ClientPortal /> },
  { path: '/k/:token', element: <PortalDocGate kind="contracts"><ContractPublic /></PortalDocGate> },
  { path: '/d/:token', element: <PortalDocGate kind="agency/doc"><DocPublic /></PortalDocGate> },
  { path: '/unsubscribe/:token', element: <Unsubscribe /> },
  { path: '/terms', element: <Policy kind="terms" /> },
  { path: '/privacy', element: <Policy kind="privacy" /> },
  { path: '/refunds', element: <Policy kind="refunds" /> },
  { path: '/contact', element: <Policy kind="contact" /> },
  { path: '/pricing', element: <Policy kind="pricing" /> },
  { path: '/subprocessors', element: <Subprocessors /> },
  { path: '/copyright', element: <Copyright /> },
  { path: '/licences', element: <Licences /> },
  {
    element: <Standalone />,
    children: [
      { path: '/start', element: <Welcome /> },
      { path: '/signin', element: <Auth mode="signin" /> },
      { path: '/forgot', element: <Forgot /> },
      { path: '/signin/reset', element: <ResetPassword /> },
      { path: '/signup', element: <Auth mode="signup" /> },
      { path: '/u/:handle', element: <Public /> },
      { path: '/people/:id', element: <Public /> },
      { path: '/p/:id', element: <ProductPage /> },
      { path: '/admin', element: <Admin /> },
      {
        element: <RequireSession />,
        children: [{ path: '/vibe-check', element: <VibeCheck /> }],
      },
    ],
  },
  // The two chats draw their own header, with the theme switch in it.
  {
    element: <RequireSession />,
    children: [
      { path: '/onboarding', element: <SetupChat /> },
      { path: '/session', element: <SessionChat /> },
    ],
  },
  // The app: everything behind a session.
  {
    element: <Shell />,
    children: [
      { path: '/home', element: explained('home', <Dashboard />) },
      { path: '/today', element: explained('today', <Today />) },
      { path: '/tower', element: explained('tower', <Tower />) },
      { path: '/tower/map', element: <Navigate to="/tower#life-map" replace /> },
      { path: '/realm/:key', element: <Realm /> },
      { path: '/apps', element: explained('apps', <Apps />) },
      { path: '/you', element: explained('you', <You />) },
      { path: '/search', element: <Search /> },
      { path: '/profile', element: gated('profile', <Profile />) },
      { path: '/help', element: gated('help', <Help />) },
      { path: '/inbox', element: gated('notifications', <Inbox />) },
      // Rank and rewards are part of the game, not apps: always on.
      { path: '/leaderboard', element: gated('leaderboard', <Leaderboard />) },
      { path: '/discover', element: gated('discover', <Discover />) },
      { path: '/cards', element: gated('cards', <Cards />) },
      { path: '/cards/:game', element: gated('cards', <CardTable />) },
      { path: '/rewards', element: <Rewards /> },
      { path: '/plans', element: explained('assistant', <Plans />) },
      // learn and earn
      { path: '/school', element: gated('school', <School />) },
      { path: '/school/:id', element: gated('school', <Cohort />) },
      { path: '/work', element: gated('work', <Work />) },
      { path: '/work/:id', element: gated('work', <Opportunity />) },
      { path: '/army', element: gated('army', <Army />) },
      { path: '/army/:id', element: gated('army', <Campaign />) },
      { path: '/win', element: gated('win', <Win />) },
      { path: '/win/:id', element: gated('win', <Reward />) },
      { path: '/agency', element: gated('agency', <Agency />) },
      { path: '/agency/invoices/:id', element: gated('agency', <AgencyInvoice />) },
      { path: '/agency/contracts/:id', element: gated('agency', <AgencyContract />) },
      { path: '/agency/docs/:id', element: gated('agency', <AgencyDoc />) },
      { path: '/agency/:id', element: gated('agency', <AgencyClient />) },
      // people
      { path: '/party', element: gated('party', <Party />) },
      { path: '/party/:id', element: gated('party', <EventPage />) },
      { path: '/run', element: gated('run', <Run />) },
      { path: '/run/clubs/:id', element: gated('run', <RunClubPage />) },
      { path: '/community', element: gated('community', <Community />) },
      { path: '/club', element: gated('club', <Club />) },
      { path: '/bond', element: gated('bond', <Bond />) },
      { path: '/bond/chats/:id', element: gated('bond', <BondChatScreen />) },
      { path: '/circles', element: gated('circles', <Circles />) },
      { path: '/circles/:id', element: gated('circles', <CircleGroup />) },
      // wellbeing
      { path: '/life', element: gated('life', <Life />) },
      { path: '/reviews', element: gated('reviews', <Reviews />) },
      { path: '/coaching', element: gated('coaching', <Coaching />) },
      { path: '/coaching/students/:id', element: gated('coaching', <CoachStudent />) },
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
      { path: '/store', element: gated('store', <Store />) },
      { path: '/shop/products/:id', element: gated('shop', <StudioProduct />) },
      { path: '/shop/page', element: gated('profile', <Studio tab="page" />) },
      { path: '/shop/bookings', element: gated('shop', <Studio tab="bookings" />) },
      { path: '/shop/testimonials', element: gated('shop', <Studio tab="reviews" />) },
      { path: '/shop/audience', element: gated('audience', <StudioAudience />) },
      { path: '/shop/content', element: gated('content', <Content />) },
      { path: '/shop/content/results', element: gated('content', <ContentResults />) },
      { path: '/shop/content/:id', element: gated('content', <Brand />) },
      { path: '/shop/automations', element: gated('automations', <Automations />) },
      { path: '/shop/customers', element: gated('shop', <Customers />) },
      { path: '/shop/dm', element: gated('shop', <DmInbox />) },
      { path: '/finance', element: gated('finance', <Finance />) },
      // internal: tracking for the team, shown only to staff and admins
      { path: '/internal/observability', element: gated('observability', <Observability />) },
      { path: '/internal/logs', element: gated('observability', <Logs />) },
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
    ],
  },
]);

function OldPath({ from, to }: { from: string; to: string }) {
  const loc = useLocation();
  return <Navigate to={`${to}${loc.pathname.slice(from.length)}${loc.search}`} replace />;
}

/** The matched route's pattern, such as /store/:id, never the real address. Used by the page-speed notes (lib/vitals.ts). */
export function routePattern(): string {
  const last = router.state.matches[router.state.matches.length - 1];
  return last?.route.path ?? '/';
}

export function App() {
  useApplyTheme();
  return <RouterProvider router={router} />;
}
