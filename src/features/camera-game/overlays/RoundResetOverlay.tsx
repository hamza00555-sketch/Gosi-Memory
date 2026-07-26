import { motion } from 'framer-motion';
import type { RoomState } from '../../../domain/game';
import type { TeamId } from '../../../domain/ids';
import { ar } from '../../../i18n/ar';

interface Props {
  room: RoomState;
  myTeamId: TeamId | null;
  onConfirm: () => void;
}

/**
 * Shown when every pair has been found but nobody hit the target score. The
 * physical cards have to be reshuffled, so the game waits for both devices to
 * confirm rather than racing ahead of the table.
 */
export function RoundResetOverlay({ room, myTeamId, onConfirm }: Props): JSX.Element {
  const iConfirmed = myTeamId ? room.game.roundReadyTeams[myTeamId] === true : false;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-6 bg-ink-950/95 px-8 backdrop-blur-sm"
    >
      <span className="hud-chip nums text-cream/60">
        {ar.round.roundLabel} {room.game.roundNumber}
      </span>

      <h2 className="text-center text-4xl text-pop-yellow">{ar.round.exhaustedTitle}</h2>
      <p className="text-balance text-center text-lg text-cream/75">{ar.round.exhaustedBody}</p>

      <div className="flex gap-6 pt-2">
        {(['teamA', 'teamB'] as TeamId[]).map((id) => (
          <div key={id} className="flex flex-col items-center gap-2">
            <span
              className={`h-3 w-3 rounded-full ${
                room.game.roundReadyTeams[id] === true ? 'bg-good' : 'bg-ink-600'
              }`}
            />
            <span className="text-xs text-cream/60">{room.teams[id].name}</span>
          </div>
        ))}
      </div>

      {iConfirmed ? (
        <p className="text-cream/60">{ar.round.waitingOther}</p>
      ) : (
        <button type="button" onClick={onConfirm} className="btn-primary w-full max-w-sm">
          {ar.round.confirmShuffle}
        </button>
      )}
    </motion.div>
  );
}
