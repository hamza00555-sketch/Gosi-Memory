import { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { I18nProvider } from '../i18n';
import { ToastHost } from '../components/ToastHost';
import { ScreenFallback } from '../components/ScreenFallback';

// Lazy-load screens so the initial (home) bundle stays small — the AR screen
// pulls in three.js and (lazily) MindAR+TF.js, which must never block home.
const HomeScreen = lazy(() => import('../features/home/HomeScreen'));
const ArGameScreen = lazy(() => import('../features/game/ArGameScreen'));
const ResultsScreen = lazy(() => import('../features/results/ResultsScreen'));
const SettingsScreen = lazy(() => import('../features/settings/SettingsScreen'));
const PrintScreen = lazy(() => import('../features/tools/PrintScreen'));
const CompileScreen = lazy(() => import('../features/tools/CompileScreen'));

const router = createBrowserRouter([
  { path: '/', element: <HomeScreen /> },
  { path: '/play', element: <ArGameScreen /> },
  { path: '/results', element: <ResultsScreen /> },
  { path: '/settings', element: <SettingsScreen /> },
  { path: '/tools/print', element: <PrintScreen /> },
  { path: '/tools/compile', element: <CompileScreen /> },
  { path: '*', element: <HomeScreen /> },
]);

export function App(): JSX.Element {
  return (
    <I18nProvider>
      <div className="app-shell">
        <Suspense fallback={<ScreenFallback />}>
          <RouterProvider router={router} />
        </Suspense>
        <ToastHost />
      </div>
    </I18nProvider>
  );
}
