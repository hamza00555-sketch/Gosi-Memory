import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getBackend } from '../../backend';
import type { BackendError } from '../../backend/types';
import { CodeInput } from '../../components/CodeInput';
import { Screen } from '../../components/Screen';
import { useDeviceStore } from '../../state/deviceStore';
import { ar } from '../../i18n/ar';
import { to } from '../../app/routes';

/** Second device joins by code and claims teamB. */
export default function JoinScreen(): JSX.Element {
  const navigate = useNavigate();
  const setRoom = useDeviceStore((s) => s.setRoom);
  const setIdentity = useDeviceStore((s) => s.setIdentity);

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const join = async (value: string): Promise<void> => {
    if (value.length < 4 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const backend = getBackend();
      const uid = await backend.ensureIdentity();
      setIdentity(uid);
      const room = await backend.joinRoomByCode(value, uid);
      // Rejoining your own team must land you back where you were, so read the
      // side from the room rather than assuming teamB.
      const teamId = room.teams.teamA.deviceUid === uid ? 'teamA' : 'teamB';
      setRoom(room.id, teamId);
      navigate(to.setup(room.id));
    } catch (err) {
      const code = (err as BackendError).code;
      setError(code === 'ROOM_FULL' ? ar.lobby.roomFull : ar.lobby.roomNotFound);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      title={ar.lobby.join}
      onBack={() => navigate(to.lobby())}
      footer={
        <button
          type="button"
          className="btn-primary w-full"
          disabled={code.length < 4 || busy}
          onClick={() => void join(code)}
        >
          {busy ? ar.lobby.connecting : ar.common.confirm}
        </button>
      }
    >
      <div className="flex flex-col gap-6 px-5 pt-6">
        <p className="text-center text-cream/70">{ar.lobby.joinHint}</p>
        <CodeInput
          value={code}
          onChange={(next) => {
            setCode(next);
            setError(null);
          }}
          onComplete={(value) => void join(value)}
          error={error}
          autoFocus
          disabled={busy}
        />
      </div>
    </Screen>
  );
}
