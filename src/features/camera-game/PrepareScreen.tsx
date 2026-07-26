import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { preloadObjectSet } from '../../ar/loaders/objectSetLoader';
import { targetsAvailable } from '../../ar/loaders/targetLibrary';
import { Screen } from '../../components/Screen';
import { useRoom } from '../../game/state/useRoom';
import { useDeviceStore } from '../../state/deviceStore';
import { ar } from '../../i18n/ar';
import { to } from '../../app/routes';

type Step = 'camera' | 'loading' | 'ready' | 'blocked';

/**
 * Gate between team setup and the match: camera permission, then the two asset
 * families the AR layer needs. Both can legitimately be incomplete in a fresh
 * checkout, so this screen reports what is missing plainly rather than hanging
 * on a spinner or pretending everything loaded.
 */
export default function PrepareScreen(): JSX.Element {
  const { roomId = null } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const objectSetId = useDeviceStore((s) => s.selectedObjectSetId);
  const { room } = useRoom(roomId);

  const [step, setStep] = useState<Step>('camera');
  const [progress, setProgress] = useState({ loaded: 0, total: 0 });
  const [hasTargets, setHasTargets] = useState<boolean | null>(null);
  const [missingModels, setMissingModels] = useState<string[]>([]);
  const [cameraError, setCameraError] = useState<'denied' | 'unsupported' | null>(null);
  const startedRef = useRef(false);

  const runPreload = useCallback(async () => {
    setStep('loading');
    const [targetsOk, result] = await Promise.all([
      targetsAvailable(),
      preloadObjectSet(objectSetId, (loaded, total) => setProgress({ loaded, total })),
    ]);
    setHasTargets(targetsOk);
    setMissingModels(result.missingModels);
    setStep('ready');
  }, [objectSetId]);

  const requestCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('unsupported');
      setStep('blocked');
      return;
    }
    try {
      // Ask, then release immediately — ArStage opens its own stream. This is
      // only to surface the permission prompt before the match begins.
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      stream.getTracks().forEach((t) => t.stop());
      await runPreload();
    } catch {
      setCameraError('denied');
      setStep('blocked');
    }
  }, [runPreload]);

  // Skip the explainer when permission was already granted on a previous match.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void navigator.permissions
      ?.query({ name: 'camera' as PermissionName })
      .then((status) => {
        if (status.state === 'granted') void requestCamera();
      })
      .catch(() => undefined);
  }, [requestCamera]);

  const pct = progress.total > 0 ? Math.round((progress.loaded / progress.total) * 100) : 0;

  return (
    <Screen title={ar.preload.title}>
      <div className="flex flex-1 flex-col justify-center gap-6 px-5">
        {step === 'camera' && (
          <div className="panel flex flex-col gap-4 text-center">
            <h2 className="text-2xl">{ar.camera.permissionTitle}</h2>
            <p className="text-balance text-cream/75">{ar.camera.permissionBody}</p>
            <button type="button" className="btn-primary" onClick={() => void requestCamera()}>
              {ar.camera.permissionCta}
            </button>
          </div>
        )}

        {step === 'blocked' && (
          <div className="panel flex flex-col gap-4 text-center">
            <h2 className="text-2xl text-bad">
              {cameraError === 'unsupported' ? ar.camera.unsupported : ar.camera.denied}
            </h2>
            <p className="text-balance text-cream/75">
              {cameraError === 'unsupported' ? ar.camera.unsupportedHelp : ar.camera.deniedHelp}
            </p>
            <button type="button" className="btn-secondary" onClick={() => void requestCamera()}>
              {ar.common.retry}
            </button>
          </div>
        )}

        {step === 'loading' && (
          <div className="panel flex flex-col items-center gap-5">
            <p className="font-display text-xl">{ar.preload.objects}</p>
            <div className="h-3 w-full overflow-hidden rounded-pill bg-ink-800">
              <motion.div
                className="h-full rounded-pill bg-pop-yellow"
                animate={{ width: `${pct}%` }}
                transition={{ type: 'spring', stiffness: 140, damping: 24 }}
              />
            </div>
            <span className="nums text-cream/60">{pct}%</span>
          </div>
        )}

        {step === 'ready' && (
          <div className="panel flex flex-col gap-4">
            <h2 className="text-center text-2xl text-good">{ar.preload.ready}</h2>

            {/* Told plainly rather than discovered mid-match. */}
            {hasTargets === false && (
              <p className="rounded-chunk bg-bad/15 p-3 text-sm text-cream/85">
                مكتبة التعرف <span className="nums">qawsi-cards.mind</span> غير موجودة بعد — لن
                يتعرف الجهاز على البطاقات حتى تُضاف.
              </p>
            )}
            {missingModels.length > 0 && (
              <p className="rounded-chunk bg-pop-yellow/15 p-3 text-sm text-cream/85">
                <span className="nums">{missingModels.length}</span> مجسّمًا غير متوفر — سيتم عرض
                أشكال مؤقتة بدلًا منها.
              </p>
            )}

            <p className="text-center text-sm text-cream/60">{ar.calibration.body}</p>

            <button
              type="button"
              className="btn-primary"
              disabled={!roomId}
              onClick={() => roomId && navigate(to.play(roomId))}
            >
              {room?.game.phase === 'countdown' ? ar.common.start : ar.common.next}
            </button>
          </div>
        )}
      </div>
    </Screen>
  );
}
