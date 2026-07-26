import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getBackend, isRealtimeAvailable } from '../../backend';
import { Logo } from '../../components/Logo';
import { Screen } from '../../components/Screen';
import { defaultRoomConfig } from '../../game/engine';
import { useDeviceStore } from '../../state/deviceStore';
import { useToastStore } from '../../state/toastStore';
import { ar } from '../../i18n/ar';
import { to } from '../../app/routes';

/** Create a room (becoming host and teamA) or go to the join flow. */
export default function LobbyScreen(): JSX.Element {
  const navigate = useNavigate();
  const setRoom = useDeviceStore((s) => s.setRoom);
  const setIdentity = useDeviceStore((s) => s.setIdentity);
  const pushToast = useToastStore((s) => s.show);
  const [busy, setBusy] = useState(false);

  const createRoom = async (): Promise<void> => {
    setBusy(true);
    try {
      const backend = getBackend();
      const uid = await backend.ensureIdentity();
      setIdentity(uid);
      const room = await backend.createRoom({
        hostUid: uid,
        targetScore: defaultRoomConfig().targetScore,
      });
      setRoom(room.id, 'teamA');
      navigate(to.setup(room.id));
    } catch {
      pushToast(ar.errors.generic, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <div className="flex flex-1 flex-col justify-between px-5 pb-6">
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 320, damping: 20 }}
          >
            <Logo size="lg" />
          </motion.div>
          <p className="text-center text-cream/60">{ar.app.tagline}</p>
        </div>

        <div className="flex flex-col gap-3">
          {/* Said up front, not discovered when the second phone cannot join. */}
          {!isRealtimeAvailable() && (
            <p className="rounded-chunk bg-pop-yellow/12 p-3 text-center text-sm text-cream/80">
              {ar.errors.firebaseMissing}
            </p>
          )}

          <button
            type="button"
            className="btn-primary w-full"
            disabled={busy}
            onClick={() => void createRoom()}
          >
            {ar.lobby.create}
          </button>
          <p className="px-2 text-center text-sm text-cream/45">{ar.lobby.createHint}</p>

          <button
            type="button"
            className="btn-secondary w-full"
            disabled={busy}
            onClick={() => navigate(to.join())}
          >
            {ar.lobby.join}
          </button>
          <p className="px-2 text-center text-sm text-cream/45">{ar.lobby.joinHint}</p>
        </div>
      </div>
    </Screen>
  );
}
