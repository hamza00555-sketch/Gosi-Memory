import { motion } from 'framer-motion';
import type { RoomState } from '../../domain/game';
import type { TeamId } from '../../domain/ids';
import { TEAM_COLORS } from '../../domain/teams';
import { activePlayerLabel } from '../../domain/teams';
import { RULES } from '../../game/rules/config';
import { scoreProgress } from '../../game/engine/selectors';
import { ar } from '../../i18n/ar';

interface Props {
  room: RoomState;
  myTeamId: TeamId | null;
  remainingMs: number;
}

const COLOR_CLASS: Record<(typeof TEAM_COLORS)[number], string> = {
  coral: 'bg-team-coral',
  violet: 'bg-team-violet',
  lime: 'bg-team-lime',
  amber: 'bg-team-amber',
};

const TEXT_CLASS: Record<(typeof TEAM_COLORS)[number], string> = {
  coral: 'text-team-coral',
  violet: 'text-team-violet',
  lime: 'text-team-lime',
  amber: 'text-team-amber',
};

/**
 * The only chrome over the live camera: scores, whose turn it is, who is
 * holding the phone, and the clock. Deliberately thin — the table is the board.
 */
export function GameHud({ room, myTeamId, remainingMs }: Props): JSX.Element {
  const seconds = Math.ceil(remainingMs / 1000);
  const urgent = remainingMs <= 5000 && remainingMs > 0;
  const activeTeam = room.teams[room.game.activeTeamId];

  return (
    <div className="pointer-events-none flex flex-col gap-2 px-3 pt-2">
      <div className="flex items-start gap-2">
        <TeamScore room={room} teamId="teamA" myTeamId={myTeamId} />

        <motion.div
          animate={urgent ? { scale: [1, 1.14, 1] } : { scale: 1 }}
          transition={urgent ? { repeat: Infinity, duration: 0.7 } : undefined}
          className={`hud-chip nums min-w-[3.2rem] text-center text-xl ${
            urgent ? 'text-bad' : 'text-cream'
          }`}
          aria-label={`${seconds}`}
        >
          {room.game.turnEndsAt > 0 ? seconds : RULES.turnDurationMs / 1000}
        </motion.div>

        <TeamScore room={room} teamId="teamB" myTeamId={myTeamId} />
      </div>

      <div className="flex justify-center" aria-live="polite">
        <span
          className={`hud-chip ${TEXT_CLASS[activeTeam.color]} flex items-center gap-1.5`}
        >
          <span className={`h-2 w-2 rounded-full ${COLOR_CLASS[activeTeam.color]}`} />
          {ar.game.turnOf} {activePlayerLabel(activeTeam)}
          {room.game.activeTeamId === myTeamId && (
            <span className="text-cream/50">· {ar.common.you}</span>
          )}
        </span>
      </div>
    </div>
  );
}

function TeamScore({
  room,
  teamId,
  myTeamId,
}: {
  room: RoomState;
  teamId: TeamId;
  myTeamId: TeamId | null;
}): JSX.Element {
  const team = room.teams[teamId];
  const active = room.game.activeTeamId === teamId;
  const score = room.game.scores[teamId] ?? 0;

  return (
    <div
      className={`flex-1 rounded-chunk bg-ink-950/70 px-3 py-1.5 backdrop-blur-md transition-opacity ${
        active ? 'opacity-100' : 'opacity-65'
      }`}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="truncate text-xs font-bold text-cream/70">
          {team.name}
          {teamId === myTeamId && <span className="text-cream/40"> ({ar.common.you})</span>}
        </span>
        <motion.span
          key={score}
          initial={{ scale: 1.5, color: '#FFD84D' }}
          animate={{ scale: 1, color: '#FFF6EC' }}
          transition={{ type: 'spring', stiffness: 500, damping: 20 }}
          className="nums font-display text-lg font-black"
        >
          {score}
        </motion.span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-pill bg-white/12">
        <motion.div
          className={`h-full rounded-pill ${COLOR_CLASS[team.color]}`}
          animate={{ width: `${scoreProgress(room, teamId) * 100}%` }}
          transition={{ type: 'spring', stiffness: 180, damping: 26 }}
        />
      </div>
    </div>
  );
}
