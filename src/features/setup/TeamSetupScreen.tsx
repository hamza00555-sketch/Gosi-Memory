import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getBackend } from '../../backend';
import { CodeDisplay } from '../../components/CodeDisplay';
import { ColorPicker } from '../../components/ColorPicker';
import { ConnectionBanner } from '../../components/ConnectionBanner';
import { Screen } from '../../components/Screen';
import { ScreenFallback } from '../../components/ScreenFallback';
import { Stepper } from '../../components/Stepper';
import { TARGET_SCORE_OPTIONS } from '../../domain/game';
import { MAX_PLAYERS_PER_TEAM, MIN_PLAYERS_PER_TEAM } from '../../domain/teams';
import type { TeamColor } from '../../domain/teams';
import { bothTeamsReady } from '../../game/engine/selectors';
import { useHostAuthority, useRoom } from '../../game/state/useRoom';
import { useDeviceStore } from '../../state/deviceStore';
import { ar } from '../../i18n/ar';
import { to } from '../../app/routes';
import { ObjectSetPicker } from './ObjectSetPicker';

/**
 * Everything a team decides before kickoff. Writes are debounced because every
 * keystroke would otherwise be a realtime round trip the other device has to
 * re-render.
 */
export default function TeamSetupScreen(): JSX.Element {
  const { roomId = null } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const backend = getBackend();

  const { room, connection, hostAbsent, myTeamId, isHost, loading } = useRoom(roomId);
  useHostAuthority(roomId, isHost);

  const selectObjectSet = useDeviceStore((s) => s.selectObjectSet);
  const debounce = useRef<number | null>(null);
  const [draftName, setDraftName] = useState<string | null>(null);

  const myTeam = room && myTeamId ? room.teams[myTeamId] : null;
  const otherTeam = room && myTeamId ? room.teams[myTeamId === 'teamA' ? 'teamB' : 'teamA'] : null;

  const patch = useCallback(
    (changes: Parameters<typeof backend.updateTeamSetup>[2], immediate = false) => {
      if (!roomId || !myTeamId) return;
      const write = (): void => void backend.updateTeamSetup(roomId, myTeamId, changes);
      if (debounce.current) window.clearTimeout(debounce.current);
      if (immediate) write();
      else debounce.current = window.setTimeout(write, 350);
    },
    [backend, roomId, myTeamId],
  );

  useEffect(
    () => () => {
      if (debounce.current) window.clearTimeout(debounce.current);
    },
    [],
  );

  // Once the host starts the match, both devices follow into preparation.
  useEffect(() => {
    if (room && room.status !== 'lobby' && roomId) navigate(to.prepare(roomId));
  }, [room, roomId, navigate]);

  const canStart = useMemo(() => !!room && isHost && bothTeamsReady(room), [room, isHost]);

  if (loading || !room || !myTeam || !otherTeam || !myTeamId) return <ScreenFallback />;

  const players = myTeam.players;

  return (
    <Screen
      title={ar.setup.teamTitle}
      banner={<ConnectionBanner status={connection} hostAbsent={hostAbsent} />}
      footer={
        <div className="flex w-full flex-col gap-2">
          <button
            type="button"
            className={myTeam.ready ? 'btn-secondary w-full' : 'btn-primary w-full'}
            onClick={() => patch({ ready: !myTeam.ready }, true)}
          >
            {myTeam.ready ? ar.setup.unready : ar.setup.markReady}
          </button>

          {isHost && (
            <button
              type="button"
              className="btn-primary w-full"
              disabled={!canStart}
              onClick={() => roomId && void backend.startMatch(roomId)}
            >
              {canStart
                ? ar.common.start
                : otherTeam.deviceUid
                  ? ar.setup.waitingReady
                  : ar.setup.waitingOtherTeam}
            </button>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-5 px-5">
        {isHost && (
          <div className="panel flex flex-col items-center">
            {/* CodeDisplay renders its own caption — do not repeat it here. */}
            <CodeDisplay code={room.code} />
          </div>
        )}

        <section className="panel flex flex-col gap-4">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-bold text-cream/70">{ar.setup.teamName}</span>
            <input
              className="field"
              value={draftName ?? myTeam.name}
              placeholder={ar.setup.teamNamePlaceholder}
              maxLength={24}
              onChange={(e) => {
                setDraftName(e.target.value);
                patch({ name: e.target.value });
              }}
              onBlur={() => setDraftName(null)}
            />
          </label>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-bold text-cream/70">{ar.setup.teamColor}</span>
            <ColorPicker
              label={ar.setup.teamColor}
              value={myTeam.color}
              taken={otherTeam.color}
              onChange={(color: TeamColor) => patch({ color }, true)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-bold text-cream/70">{ar.setup.playerCount}</span>
            <Stepper
              label={ar.setup.playerCount}
              value={myTeam.playerCount}
              min={MIN_PLAYERS_PER_TEAM}
              max={MAX_PLAYERS_PER_TEAM}
              onChange={(count) =>
                patch(
                  {
                    playerCount: count,
                    players: Array.from({ length: count }, (_, i) => ({
                      name: players[i]?.name ?? '',
                    })),
                  },
                  true,
                )
              }
            />
            <p className="text-xs text-cream/45">{ar.setup.playerCountHint}</p>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-bold text-cream/70">{ar.setup.playerNames}</span>
            {players.map((player, index) => (
              <input
                key={index}
                className="field"
                defaultValue={player.name}
                placeholder={`${ar.setup.playerPlaceholder} ${index + 1}`}
                maxLength={18}
                onChange={(e) => {
                  const next = players.map((p, i) =>
                    i === index ? { name: e.target.value } : { name: p.name },
                  );
                  patch({ players: next });
                }}
              />
            ))}
          </div>
        </section>

        <section className="panel flex flex-col gap-3">
          <div>
            <h2 className="text-lg">{ar.setup.objectSet}</h2>
            <p className="text-xs text-cream/45">{ar.setup.objectSetHint}</p>
          </div>
          <ObjectSetPicker
            value={myTeam.objectSetId}
            onChange={(id) => {
              selectObjectSet(id);
              patch({ objectSetId: id }, true);
            }}
          />
        </section>

        <section className="panel flex flex-col gap-3">
          <div>
            <h2 className="text-lg">{ar.setup.targetScore}</h2>
            <p className="text-xs text-cream/45">
              {isHost ? ar.setup.targetScoreHint : ar.setup.hostOnly}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {TARGET_SCORE_OPTIONS.map((score) => (
              <button
                key={score}
                type="button"
                disabled={!isHost}
                onClick={() => roomId && void backend.updateTargetScore(roomId, score)}
                className={`btn nums py-3 text-base ${
                  room.config.targetScore === score
                    ? 'bg-pop-yellow text-ink-950'
                    : 'bg-ink-700 text-cream'
                }`}
              >
                {score}
              </button>
            ))}
          </div>
        </section>

        <section className="panel flex items-center justify-between">
          <span className="text-sm text-cream/70">{ar.setup.otherTeam}</span>
          <span className="flex items-center gap-2 text-sm">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                otherTeam.deviceUid ? (otherTeam.ready ? 'bg-good' : 'bg-pop-yellow') : 'bg-ink-600'
              }`}
            />
            {otherTeam.deviceUid
              ? otherTeam.ready
                ? ar.common.ready
                : ar.common.notReady
              : ar.setup.waitingOtherTeam}
          </span>
        </section>
      </div>
    </Screen>
  );
}
