import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArStage } from '../../ar/stage';
import type { CardId, PairId } from '../../core/types/ids';
import { useI18n } from '../../i18n';
import { playSound, preloadSound, unlockAudio } from '../../lib/audio';
import { hasCameraSupport, isInAppBrowser } from '../../lib/platform';
import { loadSet, pairOf, setAssetUrl, type CardSet } from '../../lib/sets';
import { UI_SOUNDS } from '../../lib/uiSounds';
import {
  FusionResolver,
  MindArAdapter,
  MockAdapter,
  QrAdapter,
} from '../../recognition';
import { useMatchStore } from '../../state/matchStore';
import { useToastStore } from '../../state/toastStore';
import { HudTopBar } from './HudTopBar';
import { MockPanel } from './MockPanel';
import { useMatchController } from './useMatchController';

type ScreenPhase = 'intro' | 'starting' | 'running' | 'denied' | 'mock';

/**
 * The referee screen: live camera + recognition + AR objects + the HUD.
 *
 * Session wiring (created on "start", torn down on unmount):
 *   camera video ──► QrAdapter ─┐
 *                 ─► MindAR    ─┴─► FusionResolver ─► useMatchController ─► engine
 *                                        │
 *                                   ArStage (renders resolver tracks as 3D objects)
 */
export default function ArGameScreen(): JSX.Element {
  const { t } = useI18n();
  const navigate = useNavigate();
  const pushToast = useToastStore((s) => s.push);
  const { game, players } = useMatchStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<ArStage | null>(null);
  const resolverRef = useRef<FusionResolver | null>(null);
  const adaptersRef = useRef<Array<{ stop: () => void }>>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const mockRef = useRef<MockAdapter | null>(null);

  const [phase, setPhase] = useState<ScreenPhase>('intro');
  const [set, setSet] = useState<CardSet | null>(null);
  const [banner, setBanner] = useState<{ text: string; tone: 'info' | 'success' | 'error' } | null>(null);
  const [now, setNow] = useState(Date.now());
  const inApp = isInAppBrowser();

  const controller = useMatchController({
    onRevealed: (_cardId: CardId, pairId: PairId) => {
      playSound(UI_SOUNDS.flip, 0.7);
      if (set) {
        const pair = pairOf(set, pairId);
        if (pair?.sound) playSound(setAssetUrl(set.setId, pair.sound));
      }
    },
    onMatched: (cardIds) => {
      playSound(UI_SOUNDS.match);
      stageRef.current?.celebrateMatch(cardIds);
      setBanner({ text: t.game.matched, tone: 'success' });
    },
    onMissed: (cardIds) => {
      playSound(UI_SOUNDS.miss, 0.8);
      stageRef.current?.markMissed(cardIds);
      setBanner({ text: t.game.missed, tone: 'error' });
    },
    onTurnPassed: () => setBanner(null),
    onCompleted: () => {
      playSound(UI_SOUNDS.win);
      setTimeout(() => navigate('/results'), 1400);
    },
    onRejected: (code) => {
      pushToast(
        code === 'CARD_ALREADY_MATCHED' ? t.game.alreadyMatched : t.game.sameCardAgain,
        'warning',
      );
    },
  });

  // Guard: no live match -> home.
  useEffect(() => {
    if (!game) navigate('/', { replace: true });
    else if (game.status === 'completed') navigate('/results', { replace: true });
  }, [game, navigate]);

  // Content set for this match.
  useEffect(() => {
    if (!game) return;
    loadSet(game.setId)
      .then(setSet)
      .catch(() => pushToast(t.common.error, 'error'));
  }, [game?.setId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clock for the solo timer.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Clear the banner when the selection resets (mismatch reveal ended).
  useEffect(() => {
    if (game?.phase === 'selecting_first') setBanner(null);
  }, [game?.phase]);

  const teardown = useCallback(() => {
    adaptersRef.current.forEach((a) => a.stop());
    adaptersRef.current = [];
    resolverRef.current?.detach();
    resolverRef.current = null;
    stageRef.current?.dispose();
    stageRef.current = null;
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
  }, []);
  useEffect(() => teardown, [teardown]);

  const wireResolver = useCallback(
    (resolver: FusionResolver) => {
      resolver.onCardSeen((track) => controller.applyScan(track.cardId));
      resolver.onNoise(() => pushToast(t.game.foreignCard, 'warning'));
      resolverRef.current = resolver;
    },
    [controller, pushToast, t.game.foreignCard],
  );

  /** MUST run synchronously inside the tap: audio unlock before any await. */
  const startCamera = (): void => {
    if (!set) return;
    unlockAudio();
    Object.values(UI_SOUNDS).forEach(preloadSound);
    setPhase('starting');

    void (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        streamRef.current = stream;
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();
        if (video.videoWidth === 0) {
          await new Promise<void>((resolve) => {
            video.addEventListener('loadedmetadata', () => resolve(), { once: true });
          });
        }

        const resolver = new FusionResolver({
          activeSetId: set.setId,
          resolveSide: controller.resolveSide,
        });
        wireResolver(resolver);

        const qr = new QrAdapter();
        resolver.attach(qr);
        await qr.start({ video });
        adaptersRef.current.push(qr);

        const stage = new ArStage(containerRef.current!, video, set);
        stage.setTracksProvider(() => resolver.getTracks());
        stageRef.current = stage;

        // Image tracking is best-effort: without a compiled .mind the game
        // still fully works over QR.
        try {
          const mind = new MindArAdapter(set);
          resolver.attach(mind);
          await mind.start({ video });
          const proj = mind.getProjectionMatrix();
          if (proj) stage.useMindArProjection(proj, (i) => mind.getTargetDimensions(i));
          adaptersRef.current.push(mind);
          pushToast(t.game.imageTrackingOn, 'success');
        } catch {
          pushToast(t.game.imageTrackingOff, 'info');
        }

        stage.layout();
        setPhase('running');
      } catch {
        teardown();
        setPhase('denied');
      }
    })();
  };

  const startMock = (): void => {
    if (!set) return;
    unlockAudio();
    Object.values(UI_SOUNDS).forEach(preloadSound);
    const resolver = new FusionResolver({
      activeSetId: set.setId,
      resolveSide: controller.resolveSide,
    });
    wireResolver(resolver);
    const mock = new MockAdapter();
    resolver.attach(mock);
    void mock.start({ video: videoRef.current! });
    adaptersRef.current.push(mock);
    mockRef.current = mock;
    setPhase('mock');
  };

  if (!game) return <div className="h-full bg-navy-950" />;

  const currentName = players.find((p) => p.id === game.currentTurnPlayerId)?.name ?? '';
  const instruction =
    game.phase === 'selecting_first'
      ? t.game.flipFirst
      : game.phase === 'selecting_second'
        ? t.game.flipSecond
        : null;

  return (
    <main className="relative h-full w-full overflow-hidden bg-navy-950">
      {/* Camera + AR canvas live here; ArStage manages their exact rects. */}
      <div ref={containerRef} className="absolute inset-0 overflow-hidden">
        <video ref={videoRef} playsInline muted className="absolute" />
      </div>

      {phase === 'mock' && set ? (
        <div className="absolute inset-0 top-24 z-10">
          <MockPanel
            set={set}
            game={game}
            onScan={(pairId, side) => mockRef.current?.simulateScan(set.setId, pairId, side)}
          />
        </div>
      ) : null}

      {/* HUD */}
      {(phase === 'running' || phase === 'mock') && (
        <div className="absolute inset-x-0 top-0 z-20">
          <HudTopBar game={game} players={players} now={now} />
          <div className="px-3">
            {game.turnOrder.length > 1 ? (
              <div className="mx-auto w-fit rounded-full bg-brand-blue/30 px-4 py-1 text-sm text-white backdrop-blur">
                {t.game.yourTurn} <b className="text-brand-cyan">{currentName}</b>
              </div>
            ) : null}
            {banner ? (
              <div
                className={`mx-auto mt-2 w-fit rounded-full px-4 py-1.5 text-sm font-bold backdrop-blur ${
                  banner.tone === 'success'
                    ? 'bg-brand-green/30 text-brand-green'
                    : banner.tone === 'error'
                      ? 'bg-red-500/25 text-red-200'
                      : 'bg-white/10 text-white'
                }`}
              >
                {banner.text}
              </div>
            ) : instruction ? (
              <div className="mx-auto mt-2 w-fit rounded-full bg-black/40 px-4 py-1.5 text-sm text-white/85 backdrop-blur">
                {instruction}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Bottom bar */}
      {(phase === 'running' || phase === 'mock') && (
        <div className="absolute inset-x-0 bottom-0 z-20 flex items-center justify-between p-4">
          <button type="button" onClick={() => navigate('/')} className="btn-ghost px-4 py-2 text-sm">
            {t.game.exit}
          </button>
          <MuteButton />
        </div>
      )}

      {/* Intro / permission overlays */}
      {phase !== 'running' && phase !== 'mock' ? (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-navy-950/92 p-6 text-center backdrop-blur">
          {inApp ? (
            <>
              <div className="text-4xl">🧭</div>
              <h2 className="font-display text-xl font-bold text-white">{t.game.inAppTitle}</h2>
              <p className="max-w-xs text-sm leading-6 text-white/70">{t.game.inAppBody}</p>
              <button type="button" onClick={startMock} className="btn-ghost px-6 py-3">
                {t.game.mockMode}
              </button>
            </>
          ) : phase === 'denied' || !hasCameraSupport() ? (
            <>
              <div className="text-4xl">📷</div>
              <h2 className="font-display text-xl font-bold text-white">{t.game.cameraDeniedTitle}</h2>
              <p className="max-w-xs text-sm leading-6 text-white/70">{t.game.cameraDeniedBody}</p>
              <button type="button" onClick={startMock} className="btn-primary px-6 py-3">
                {t.game.mockMode}
              </button>
              {hasCameraSupport() ? (
                <button type="button" onClick={startCamera} className="btn-ghost px-6 py-2 text-sm">
                  {t.common.retry}
                </button>
              ) : null}
            </>
          ) : (
            <>
              <div className="text-4xl">🃏</div>
              <p className="max-w-xs text-sm leading-6 text-white/70">{t.game.pointCamera}</p>
              <button
                type="button"
                onClick={startCamera}
                disabled={!set || phase === 'starting'}
                className="btn-primary px-8 py-4 text-lg"
              >
                {phase === 'starting' ? t.common.loading : t.game.cameraStart}
              </button>
              <button type="button" onClick={startMock} disabled={!set} className="btn-ghost px-6 py-2 text-sm">
                {t.game.mockMode}
              </button>
            </>
          )}
        </div>
      ) : null}
    </main>
  );
}

function MuteButton(): JSX.Element {
  const { t } = useI18n();
  const [muted, setMuted] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        // Local toggle for the session; persistent preference lives in settings.
        import('../../lib/audio').then((m) => m.setAudioMuted(!muted));
        setMuted(!muted);
      }}
      className="btn-ghost px-4 py-2 text-sm"
      aria-label={muted ? t.game.unmute : t.game.mute}
    >
      {muted ? '🔇' : '🔊'}
    </button>
  );
}
