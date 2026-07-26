import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CARDS, PAIRS } from '../../content';
import { Screen } from '../../components/Screen';
import { isSimulatorEnabled } from '../../ar/recognition/SimulatorRecognizer';
import { getBackend } from '../../backend';
import { useDeviceStore } from '../../state/deviceStore';
import { defaultRoomConfig } from '../../game/engine';
import { ar } from '../../i18n/ar';
import { to } from '../../app/routes';

/**
 * Development harness for playing without a camera or printed cards.
 *
 * This is the ONLY place a card grid is allowed to exist, and the route is
 * unreachable unless VITE_ENABLE_AR_SIMULATOR is on — the shipped game is
 * camera-only by design, and a tappable grid in production would quietly
 * become the real interface.
 */
export default function ArSimulatorScreen(): JSX.Element | null {
  const navigate = useNavigate();
  const setRoom = useDeviceStore((s) => s.setRoom);
  const [busy, setBusy] = useState(false);

  const byPair = useMemo(
    () => PAIRS.map((pair) => ({ pair, cards: CARDS.filter((c) => c.pairId === pair.pairId) })),
    [],
  );

  if (!isSimulatorEnabled()) return null;

  const startSoloRoom = async (): Promise<void> => {
    setBusy(true);
    const backend = getBackend();
    const uid = await backend.ensureIdentity();
    const room = await backend.createRoom({
      hostUid: uid,
      targetScore: defaultRoomConfig().targetScore,
    });
    setRoom(room.id, 'teamA');
    navigate(to.setup(room.id));
  };

  return (
    <Screen title={ar.dev.simulatorTitle}>
      <div className="flex flex-col gap-5 px-5 pb-8">
        <p className="rounded-chunk bg-pop-yellow/15 p-3 text-sm text-cream/85">
          {ar.dev.simulatorBody}
        </p>

        <button
          type="button"
          className="btn-primary"
          disabled={busy}
          onClick={() => void startSoloRoom()}
        >
          {ar.lobby.create}
        </button>

        <div className="flex flex-col gap-3">
          <h2 className="text-lg text-cream/70">
            {CARDS.length} بطاقة · {PAIRS.length} أزواج
          </h2>
          {byPair.map(({ pair, cards }) => (
            <div key={pair.pairId} className="panel py-3">
              <p className="pb-2 text-sm font-bold text-cream/60">{pair.name}</p>
              <div className="grid grid-cols-2 gap-2">
                {cards.map((card) => (
                  <div
                    key={card.targetId}
                    className="rounded-chunk bg-ink-800 px-3 py-2 text-sm"
                  >
                    <p className="font-bold">{card.name}</p>
                    <p className="nums text-xs text-cream/40">{card.targetId}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Screen>
  );
}
