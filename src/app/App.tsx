import { lazy, Suspense, useEffect } from 'react';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import { getBackend } from '../backend';
import { ScreenFallback } from '../components/ScreenFallback';
import { ToastHost } from '../components/ToastHost';
import { isSimulatorEnabled } from '../ar/recognition/SimulatorRecognizer';
import { useDeviceStore } from '../state/deviceStore';
import { ROUTES } from './routes';

// Screens are lazy so the camera/AR bundle — three.js plus the MindAR
// controller — is fetched only once a match actually starts.
const SplashScreen = lazy(() => import('../features/splash/SplashScreen'));
const OnboardingScreen = lazy(() => import('../features/onboarding/OnboardingScreen'));
const HowToPlayScreen = lazy(() => import('../features/onboarding/HowToPlayScreen'));
const LobbyScreen = lazy(() => import('../features/lobby/LobbyScreen'));
const JoinScreen = lazy(() => import('../features/lobby/JoinScreen'));
const TeamSetupScreen = lazy(() => import('../features/setup/TeamSetupScreen'));
// Camera permission, asset preload and tracking calibration all live with the
// AR feature rather than with team setup, because that is what they gate.
const PrepareScreen = lazy(() => import('../features/camera-game/PrepareScreen'));
const CameraGameScreen = lazy(() => import('../features/camera-game/CameraGameScreen'));
const ResultsScreen = lazy(() => import('../features/results/ResultsScreen'));
const ArSimulatorScreen = lazy(() => import('../features/dev/ArSimulatorScreen'));

const router = createBrowserRouter([
  { path: ROUTES.splash, element: <SplashScreen /> },
  { path: ROUTES.onboarding, element: <OnboardingScreen /> },
  { path: ROUTES.howToPlay, element: <HowToPlayScreen /> },
  { path: ROUTES.lobby, element: <LobbyScreen /> },
  { path: ROUTES.join, element: <JoinScreen /> },
  { path: ROUTES.setup, element: <TeamSetupScreen /> },
  { path: ROUTES.prepare, element: <PrepareScreen /> },
  { path: ROUTES.play, element: <CameraGameScreen /> },
  { path: ROUTES.results, element: <ResultsScreen /> },
  // The simulator is a development affordance; in a production build the route
  // resolves to nothing so it cannot be reached by typing the URL.
  {
    path: ROUTES.devSimulator,
    element: isSimulatorEnabled() ? <ArSimulatorScreen /> : <Navigate to={ROUTES.splash} replace />,
  },
  { path: '*', element: <Navigate to={ROUTES.splash} replace /> },
]);

export function App(): JSX.Element {
  const setIdentity = useDeviceStore((s) => s.setIdentity);

  // Claim an anonymous identity once, up front: every command is stamped with
  // it, and a device that reloads must come back as the same player.
  useEffect(() => {
    let cancelled = false;
    void getBackend()
      .ensureIdentity()
      .then((uid) => {
        if (!cancelled) setIdentity(uid);
      })
      .catch(() => {
        /* Surfaced per-screen; the app still renders in offline mode. */
      });
    return () => {
      cancelled = true;
    };
  }, [setIdentity]);

  return (
    <>
      <Suspense fallback={<ScreenFallback />}>
        <RouterProvider router={router} />
      </Suspense>
      <ToastHost />
    </>
  );
}
