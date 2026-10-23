import { RELATIONSHIPS } from '@kreators/shared';
import { createBrowserRouter, Navigate, Outlet, RouterProvider } from 'react-router';
import { Avatar } from './components/Avatar';
import { Button } from './components/Button';
import { TabBar } from './components/TabBar';
import { useMe } from './lib/queries';
import { useSession } from './lib/store';
import { Admin } from './screens/Admin';
import { Leaderboard } from './screens/Leaderboard';
import { Realm } from './screens/Realm';
import { Rewards } from './screens/Rewards';
import { Today } from './screens/Today';
import { Tower } from './screens/Tower';
import { VibeCheck } from './screens/VibeCheck';
import { Welcome } from './screens/Welcome';
import { You } from './screens/You';

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

function RequireSession() {
  const token = useSession((s) => s.token);
  if (!token) return <Navigate to="/" replace />;
  return <Outlet />;
}

function Shell() {
  const token = useSession((s) => s.token);
  const me = useMe();
  if (!token) return <Navigate to="/" replace />;
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

const router = createBrowserRouter([
  { path: '/', element: <Welcome /> },
  {
    element: <RequireSession />,
    children: [{ path: '/vibe-check', element: <VibeCheck /> }],
  },
  {
    element: <Shell />,
    children: [
      { path: '/today', element: <Today /> },
      { path: '/tower', element: <Tower /> },
      { path: '/realm/:key', element: <Realm /> },
      { path: '/leaderboard', element: <Leaderboard /> },
      { path: '/you', element: <You /> },
      { path: '/rewards', element: <Rewards /> },
    ],
  },
  { path: '/home', element: <Navigate to="/today" replace /> },
  { path: '/admin', element: <Admin /> },
  { path: '*', element: <Navigate to="/" replace /> },
]);

export function App() {
  return <RouterProvider router={router} />;
}
