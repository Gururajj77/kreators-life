import { attendeeMayOpen, RELATIONSHIPS } from '@kreators/shared';
import { Suspense, useEffect, type ReactNode } from 'react';
import { createBrowserRouter, Link, Navigate, Outlet, RouterProvider, ScrollRestoration, useLocation } from 'react-router';
import { Avatar } from './components/Avatar';
import { Button } from './components/Button';
import { ThemeToggle } from './components/ThemeToggle';
import { BrandMark } from './components/BrandMark';
import { Gate } from './components/Gate';
import { HowTo } from './components/HowTo';
import { TabBar } from './components/TabBar';
import { Assistant } from './components/AssistantButton';
import { ReminderBubble } from './components/Reminders';
import { RouteFallback } from './components/RouteFallback';
import { lazyNamed } from './lib/lazy';
import { coachJoinKept } from './lib/coachJoin';
import { friendAddKept } from './lib/friendAdd';
import { useMe } from './lib/queries';
import { useApplyTheme } from './lib/theme';
import { useFocus, useSession } from './lib/store';
import { useFocusSession } from './lib/focusSession';
import { FocusPill } from './components/FocusPill';
import { useLandOnHash } from './lib/useLandOnHash';
import { useWide } from './lib/useWide';
import { Auth } from './screens/Auth';
import { Home as Dashboard } from './screens/Home';
import { Today } from './screens/Today';
import { SetupChat } from './screens/SetupChat';
import { Welcome } from './screens/Welcome';
import { Home } from './site/Home';

// Mounted once by Root for anyone signed in, not a screen, but still downloaded only after the first paint so the entry stays under budget:
// a running clock is written down in the tab (sessionStorage, lib/focusSession.ts) and picked back up when it mounts, so a delay loses nothing.
const FocusRoundsHost = lazyNamed(() => import('./components/FocusRoundsHost'), 'FocusRoundsHost');
// The privacy card asks once and then stays away, so it comes in its own chunk right after the first paint (keeps the entry under budget).
const ConsentPopup = lazyNamed(() => import('./components/ConsentPopup'), 'ConsentPopup');
// "On this page", the dashes at the top right of a long page: its own chunk after the first paint, and a phone never downloads it.
const PageContents = lazyNamed(() => import('./components/PageContents'), 'PageContents');
// The bar that invites someone who joined an event to finish setting up: its own chunk, fetched only for them.
const AttendeeBar = lazyNamed(() => import('./components/AttendeeBar'), 'AttendeeBar');
// Back to top, the small round button left of the assistant's on every screen: its own chunk after the first paint.
const BackToTop = lazyNamed(() => import('./components/BackToTop'), 'BackToTop');
const Forgot = lazyNamed(() => import('./screens/PasswordReset'), 'Forgot');
const ResetPassword = lazyNamed(() => import('./screens/PasswordReset'), 'ResetPassword');
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
const AdminGuide = lazyNamed(() => import('./screens/AdminGuide'), 'AdminGuide');
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
const TeamPortal = lazyNamed(() => import('./site/ClientPortal'), 'TeamPortal');
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
const Book = lazyNamed(() => import('./screens/Book'), 'Book');
const Cards = lazyNamed(() => import('./screens/Cards'), 'Cards');
const Discover = lazyNamed(() => import('./screens/Discover'), 'Discover');
const CardTable = lazyNamed(() => import('./screens/CardTable'), 'CardTable');
const Plans = lazyNamed(() => import('./screens/Plans'), 'Plans');
const Coaching = lazyNamed(() => import('./screens/Coaching'), 'Coaching');
const CoachStudent = lazyNamed(() => import('./screens/CoachStudent'), 'CoachStudent');
const CoachJoin = lazyNamed(() => import('./screens/CoachJoin'), 'CoachJoin');
// All tables (2026-11-13): every list of a person's own data as a table they can sort, filter, copy, download and change in place; a
// coach's view of what a student shares and a super admin's view of a member's are the same two screens, read only.
const Tables = lazyNamed(() => import('./screens/Tables'), 'Tables');
const CoachTables = lazyNamed(() => import('./screens/Tables'), 'CoachTables');
const AdminTables = lazyNamed(() => import('./screens/Tables'), 'AdminTables');
const TableView = lazyNamed(() => import('./screens/TableView'), 'TableView');
const CoachTableView = lazyNamed(() => import('./screens/TableView'), 'CoachTableView');
const AdminTableView = lazyNamed(() => import('./screens/TableView'), 'AdminTableView');
// An invite link (2026-11-10): checks the code and goes on to Welcome with it kept for the tab.
const JoinInvite = lazyNamed(() => import('./screens/JoinInvite'), 'JoinInvite');
const School = lazyNamed(() => import('./screens/School'), 'School');
const Search = lazyNamed(() => import('./screens/Search'), 'Search');
const Sessions = lazyNamed(() => import('./screens/Sessions'), 'Sessions');
const Sleep = lazyNamed(() => import('./screens/Sleep'), 'Sleep');
const Fitness = lazyNamed(() => import('./screens/Fitness'), 'Fitness');
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
const Insights = lazyNamed(() => import('./screens/Insights'), 'Insights');
const TimeBlocks = lazyNamed(() => import('./screens/TimeBlocks'), 'TimeBlocks');
const You = lazyNamed(() => import('./screens/You'), 'You');
const CertificatePage = lazyNamed(() => import('./site/CertificatePage'), 'CertificatePage');
const InvoicePage = lazyNamed(() => import('./site/InvoicePage'), 'InvoicePage');
const Policy = lazyNamed(() => import('./site/Policy'), 'Policy');
const Copyright = lazyNamed(() => import('./site/Copyright'), 'Copyright');
const Licences = lazyNamed(() => import('./site/Licences'), 'Licences');
const Subprocessors = lazyNamed(() => import('./site/Subprocessors'), 'Subprocessors');
const Explore = lazyNamed(() => import('./site/Explore'), 'Explore');
const EventsList = lazyNamed(() => import('./site/Events'), 'EventsList');
const EventLanding = lazyNamed(() => import('./site/Events'), 'EventLanding');
const Feature = lazyNamed(() => import('./site/Feature'), 'Feature');
const Features = lazyNamed(() => import('./site/Features'), 'Features');
// /7rp downloads when it is opened (2026-11-07); before, it sat in the entry beside the landing page.
const SevenRP = lazyNamed(() => import('./site/SevenRP'), 'SevenRP');

function Loading() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-md px-md" role="status">
      <div className="flex gap-xs">
        {RELATIONSHIPS.map((r) => (
          <Avatar key={r.key} relationship={r.key} size={36} />
        ))}
      </div>
      <p className="m-0 text-subhead text-ink-soft">Setting things up</p>
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
function toSignIn(pathname: string, search: string, hash = '') {
  // The section too (`/today#supplements`), so signing in lands where the link pointed.
  const next = `${pathname}${search}${hash}`;
  return `/signin?next=${encodeURIComponent(next)}`;
}

function RequireSession() {
  const token = useSession((s) => s.token);
  const loc = useLocation();
  if (!token) return <Navigate to={toSignIn(loc.pathname, loc.search, loc.hash)} replace />;
  return <Outlet />;
}

function Shell() {
  const focus = useFocus((s) => s.on);
  // The lists no longer follow what gets opened (2026-11-07), so the visit times a device kept go.
  useEffect(() => {
    try {
      localStorage.removeItem('kreators.appUse');
    } catch {
      // private window: nothing was kept
    }
  }, []);
  const token = useSession((s) => s.token);
  const me = useMe();
  const loc = useLocation();
  if (!token) return <Navigate to={toSignIn(loc.pathname, loc.search, loc.hash)} replace />;
  if (me.isPending) return <Loading />;
  // Only when there is nothing to show: a background refetch that fails (the window refocused while offline) keeps the page as it was.
  if (me.isError && !me.data) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col items-center justify-center gap-md px-md text-center" role="alert">
        <Avatar relationship="self" size={72} mood="sleepy" />
        <p className="m-0 text-headline">Could not reach the server.</p>
        <p className="m-0 text-subhead text-ink-soft">Check your connection, then try again.</p>
        <Button onClick={() => me.refetch()}>Try again</Button>
      </div>
    );
  }
  // Setup not done: the setup chat first. Someone who joined an event from its public page gets the event first: the event, Party, Community,
  // Bond's chats, Inbox, the Profile tab and Help (ATTENDEE_PATHS in shared eventJoin.ts), with a bar inviting them to finish; anything else
  // still sends them to the setup chat.
  const attendee = !me.data.user.onboardedAt && Boolean(me.data.user.attendeeEvent);
  if (!me.data.user.onboardedAt && !(attendee && attendeeMayOpen(loc.pathname))) return <Navigate to="/onboarding" replace />;
  // Someone who opened a coach's invite link signed out comes back to its card once they are in (the token is kept for the tab only).
  const joining = coachJoinKept();
  if (joining) return <Navigate to={`/coach/join/${joining}`} replace />;
  // The same for a QR code's Add friend link: its page clears the kept link once a signed-in visitor lands there.
  const adding = friendAddKept();
  if (adding) return <Navigate to={adding} replace />;
  return (
    <>
      <Page tabs />
      {!focus && (
        <div className="contents no-print">
          <TabBar />
          <Assistant />
          <ReminderBubble />
          {attendee && (
            <Suspense fallback={null}>
              <AttendeeBar userId={me.data.user.id} />
            </Suspense>
          )}
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
  const token = useSession((s) => s.token);
  const wide = useWide();
  // A hash lands on its section once it is in the page, opening it when it is folded (an inbox note's link, a jump from another screen).
  useLandOnHash();
  // Every block of text reads as a rectangle: the fixer for blocks CSS cannot balance, downloaded after the first paint.
  useEffect(() => {
    let stop: (() => void) | undefined;
    let gone = false;
    void import('./lib/rectText').then((m) => {
      if (!gone) stop = m.startRectText();
    });
    return () => {
      gone = true;
      stop?.();
    };
  }, []);
  // Every helper tooltip in the empty room by its trigger, outside a popup's panel (the smart tips, 2026-11-12), after the first paint too.
  useEffect(() => {
    let stop: (() => void) | undefined;
    let gone = false;
    void import('./lib/smartTip').then((m) => {
      if (!gone) stop = m.startSmartTips();
    });
    return () => {
      gone = true;
      stop?.();
    };
  }, []);
  return (
    <>
      <ScrollRestoration />
      <Page tabs={false} />
      <Suspense fallback={null}>
        <ConsentPopup />
      </Suspense>
      {wide && (
        <Suspense fallback={null}>
          <PageContents />
        </Suspense>
      )}
      {/* The focus clock, for anyone signed in, at the root so no page change ever unmounts it: the app, the two chats, the vibe check,
          the public site and the card table's focus mode alike. Signing out (no token) takes it away. */}
      {token && (
        <Suspense fallback={null}>
          <FocusRoundsHost />
        </Suspense>
      )}
      <Suspense fallback={null}>
        <BackToTop />
      </Suspense>
    </>
  );
}

/**
 * Pages outside the app shell and the public site still get the theme switch, and a running focus clock its pill: at the top left on a
 * phone (where the first header starts 64px down to clear the corners; never pinned, it scrolls away with the page), and beside the theme switch at the top right on a laptop, where
 * the top left holds these pages' own BackLink (Admin, a public page, a product page).
 */
const DOORS = new Set(['/signin', '/signup', '/forgot', '/signin/reset', '/start']);

function Standalone() {
  const token = useSession((s) => s.token);
  // The vibe check carries the pill beside its own Close button.
  const { pathname } = useLocation();
  const vibe = pathname.startsWith('/vibe-check');
  const clock = useFocusSession((s) => s.snap.active) && Boolean(token) && !vibe;
  // The doors in (sign-in, sign-up, a lost password, Welcome) carry the mark back to the site; the other pages here keep their own
  // BackLink in that corner. On a phone a running clock takes the corner instead, as in the app.
  const door = DOORS.has(pathname) || pathname.startsWith('/join/');
  return (
    <>
      {door && (
        <div className={`safe-top absolute top-sm left-md z-30 no-print ${clock ? 'hidden md:block' : ''}`}>
          <Link to="/" aria-label="kreators.app, the site" className="toy toy-soft flex min-h-[44px] min-w-[44px] items-center justify-center whitespace-nowrap rounded-pill bg-card-strong px-sm font-display text-[16px] font-bold tracking-tight">
            <BrandMark compact />
          </Link>
        </div>
      )}
      <div className="safe-top fixed top-sm right-md z-30 flex items-center gap-xs">
        {clock && (
          <span className="no-print hidden md:flex">
            <FocusPill compact />
          </span>
        )}
        <ThemeToggle />
      </div>
      {clock && (
        <div className="safe-top absolute top-sm left-md z-30 no-print md:hidden">
          <FocusPill compact />
        </div>
      )}
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
  // Upcoming public events, and one event's page where a visitor joins and signs up in one go (the event attendee's way in).
  { path: '/events', element: <EventsList /> },
  { path: '/events/:id', element: <EventLanding /> },
  { path: '/features', element: <Features /> },
  { path: '/7rp', element: <SevenRP /> },
  { path: '/features/:key', element: <Feature /> },
  { path: '/c/:code', element: <CertificatePage /> },
  { path: '/i/:token', element: <PortalDocGate kind="invoices"><InvoicePage /></PortalDocGate> },
  { path: '/a/:token', element: <ClientPortal /> },
  { path: '/t/:token', element: <TeamPortal /> },
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
      { path: '/coach/join/:token', element: <CoachJoin /> },
      { path: '/join/:code', element: <JoinInvite /> },
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
      { path: '/insights', element: explained('insights', <Insights />) },
      // Time blocks: a page under Daily, not an app (core like Daily; docs/time-blocks.md).
      { path: '/time-blocks', element: <TimeBlocks /> },
      { path: '/profile', element: gated('profile', <Profile />) },
      { path: '/help', element: gated('help', <Help />) },
      { path: '/inbox', element: gated('notifications', <Inbox />) },
      // Rank and rewards are part of the game, not apps: always on.
      { path: '/leaderboard', element: gated('leaderboard', <Leaderboard />) },
      // All tables: on for everyone (core, may be hidden), each table its own page so it opens in a new tab.
      { path: '/tables', element: gated('tables', <Tables />) },
      { path: '/tables/:table', element: gated('tables', <TableView />) },
      { path: '/discover', element: gated('discover', <Discover />) },
      { path: '/cards', element: gated('cards', <Cards />) },
      { path: '/cards/:game', element: gated('cards', <CardTable />) },
      { path: '/rewards', element: <Rewards /> },
      { path: '/book', element: <Book /> },
      { path: '/plans', element: explained('assistant', <Plans />) },
      // learn and earn
      { path: '/school', element: gated('school', <School />) },
      { path: '/school/:id', element: gated('school', <Cohort />) },
      // The Admin guide: the private School cohort for the team, outside School's switch, shown only to an admin account.
      { path: '/admin/guide', element: <AdminGuide /> },
      // A member's tables for a super admin (a real session, never the admin key alone; read only, each opening audited).
      { path: '/admin/people/:id/tables', element: <AdminTables /> },
      { path: '/admin/people/:id/tables/:table', element: <AdminTableView /> },
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
      { path: '/coaching/students/:id/tables', element: gated('coaching', <CoachTables />) },
      { path: '/coaching/students/:id/tables/:table', element: gated('coaching', <CoachTableView />) },
      { path: '/wellbeing', element: gated('wellbeing', <Wellbeing />) },
      { path: '/mood', element: gated('mood', <Mood />) },
      { path: '/sleep', element: gated('sleep', <Sleep />) },
      { path: '/fitness', element: gated('fitness', <Fitness />) },
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
      // `/manage/connect` (Connect people for staff, their own kinds only, 2026-11-10) is drawn by Manage's own chunk, so the first download keeps no new import.
      { path: '/manage/:page?', element: gated('manage', <Manage />) },
    ],
  },
  // Old addresses keep working.
  { path: '/resources', element: <Navigate to="/knowledge" replace /> },
  { path: '/resources/:id', element: <OldPath from="/resources" to="/knowledge" /> },
  { path: '/studio', element: <Navigate to="/shop" replace /> },
  { path: '/studio/*', element: <OldPath from="/studio" to="/shop" /> },
  { path: '*', element: <Unknown /> },
    ],
  },
]);

function OldPath({ from, to }: { from: string; to: string }) {
  const loc = useLocation();
  return <Navigate to={`${to}${loc.pathname.slice(from.length)}${loc.search}${loc.hash}`} replace />;
}

/** An address nobody has: Home for someone signed in (2026-11-13, the frictionless pass), the public site's home for a visitor. */
function Unknown() {
  const token = useSession((s) => s.token);
  return <Navigate to={token ? '/home' : '/'} replace />;
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
