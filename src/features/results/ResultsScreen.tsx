import { motion } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { TOTAL_PAIRS } from '../../content';
import type { TeamId } from '../../domain/ids';
import { Screen } from '../../components/Screen';
import { ScreenFallback } from '../../components/ScreenFallback';
import { teamTokens } from '../../components/teamColors';
import { useRoom } from '../../game/state/useRoom';
import { useDeviceStore } from '../../state/deviceStore';
import { ar } from '../../i18n/ar';
import { to } from '../../app/routes';

export default function ResultsScreen(): JSX.Element {
  const { roomId = null } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const clearRoom = useDeviceStore((s) => s.clearRoom);
  const { room, loading, myTeamId } = useRoom(roomId);

  if (loading || !room) return <ScreenFallback />;

  const winnerId = room.game.winnerTeamId;
  const winner = winnerId ? room.teams[winnerId] : null;
  const iWon = !!winnerId && winnerId === myTeamId;

  return (
    <Screen
      footer={
        <div className="flex w-full gap-3">
          <button
            type="button"
            className="btn-secondary flex-1"
            onClick={() => {
              clearRoom();
              navigate(to.lobby());
            }}
          >
            {ar.results.exit}
          </button>
          <button
            type="button"
            className="btn-primary flex-[2]"
            onClick={() => navigate(to.lobby())}
          >
            {ar.results.rematch}
          </button>
        </div>
      }
    >
      <div className="relative flex flex-1 flex-col items-center justify-center gap-6 px-5">
        <Confetti active={iWon} />

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-cream/60"
        >
          {ar.results.winner}
        </motion.p>

        <motion.h1
          initial={{ scale: 0.5, rotate: -6 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 14 }}
          className={`text-center text-5xl ${winner ? teamTokens(winner.color).text : 'text-cream'}`}
        >
          {winner?.name ?? ar.results.finalScore}
        </motion.h1>

        {iWon && <p className="text-2xl text-pop-yellow">{ar.results.congrats}</p>}

        <div className="flex w-full max-w-sm gap-3">
          {(['teamA', 'teamB'] as TeamId[]).map((id) => {
            const team = room.teams[id];
            const isWinner = id === winnerId;
            return (
              <motion.div
                key={id}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: id === 'teamA' ? 0.1 : 0.18 }}
                className={`flex-1 rounded-chunk p-4 text-center ${
                  isWinner ? 'bg-ink-800 ring-2 ring-pop-yellow' : 'bg-ink-900'
                }`}
              >
                <p className="truncate text-sm text-cream/60">{team.name}</p>
                <p className={`nums text-4xl font-black ${teamTokens(team.color).text}`}>
                  {room.game.scores[id] ?? 0}
                </p>
              </motion.div>
            );
          })}
        </div>

        {/* Only stats the canonical state actually carries. */}
        <div className="flex w-full max-w-sm justify-around rounded-chunk bg-ink-900/70 p-4 text-center">
          <Stat
            label={ar.round.roundLabel}
            value={`${room.game.roundNumber}`}
          />
          <Stat
            label={ar.results.pairsMatched}
            value={`${Object.keys(room.game.matchedPairIds).length}/${TOTAL_PAIRS}`}
          />
          <Stat label={ar.setup.targetScore} value={`${room.game.targetScore}`} />
        </div>
      </div>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="flex flex-col gap-1">
      <span className="nums text-xl font-black text-cream">{value}</span>
      <span className="text-xs text-cream/50">{label}</span>
    </div>
  );
}

/** CSS-only celebration — a confetti library is not worth the bundle. */
function Confetti({ active }: { active: boolean }): JSX.Element | null {
  if (!active) return null;
  const pieces = Array.from({ length: 26 }, (_, i) => i);
  const colors = ['#FFD84D', '#FF5FA2', '#3DE0C0', '#54B8FF', '#57E08A'];

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((i) => (
        <motion.span
          key={i}
          initial={{ y: -40, x: `${(i * 37) % 100}%`, rotate: 0, opacity: 1 }}
          animate={{ y: '110vh', rotate: 540, opacity: 0.15 }}
          transition={{
            duration: 2.6 + (i % 5) * 0.4,
            delay: (i % 8) * 0.14,
            repeat: Infinity,
            ease: 'linear',
          }}
          className="absolute top-0 h-2.5 w-1.5 rounded-sm"
          style={{ backgroundColor: colors[i % colors.length] }}
        />
      ))}
    </div>
  );
}
