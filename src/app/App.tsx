import { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { ToastHost } from '../components/ToastHost';
import { ScreenFallback } from '../components/ScreenFallback';

// Lazy-load screens so the initial (lobby) bundle stays small and the heavier
// game/AR screen is fetched only when a match starts.
const LobbyScreen = lazy(() => import('../features/lobby/LobbyScreen'));
const RoomScreen = lazy(() => import('../features/room/RoomScreen'));
const GameScreen = lazy(() => import('../features/game/GameScreen'));
const ResultsScreen = lazy(() => import('../features/results/ResultsScreen'));
const StoreScreen = lazy(() => import('../features/store/StoreScreen'));

const router = createBrowserRouter([
  { path: '/', element: <LobbyScreen /> },
  { path: '/store', element: <StoreScreen /> },
  { path: '/room/:roomId', element: <RoomScreen /> },
  { path: '/game/:roomId', element: <GameScreen /> },
  { path: '/results/:roomId', element: <ResultsScreen /> },
  { path: '*', element: <LobbyScreen /> },
]);

export function App(): JSX.Element {
  return (
    <div className="app-shell">
      <Suspense fallback={<ScreenFallback />}>
        <RouterProvider router={router} />
      </Suspense>
      <ToastHost />
    </div>
  );
}
