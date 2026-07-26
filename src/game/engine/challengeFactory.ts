import { CHALLENGES } from '../../content';
import type {
  ChallengeDefinition,
  ChallengePayload,
  ChallengeState,
  ChallengeSubmission,
} from '../../domain/challenge';
import type { EpochMs, TeamId } from '../../domain/ids';
import { RULES } from '../rules/config';
import { createRng, deriveSeed, shuffle } from './rng';

/**
 * Build the challenge that follows a match.
 *
 * The payload is resolved once, by the host, and broadcast — the two devices
 * never recompute it. A reaction target that appeared at a different instant on
 * each screen, or two different symbol sequences, would make the race
 * meaningless, so this is the one place randomness for a challenge is allowed.
 */
export function createChallenge(
  seed: number,
  matchIndex: number,
  advantagedTeamId: TeamId,
  now: EpochMs,
): ChallengeState {
  const rng = createRng(deriveSeed(seed, matchIndex, 0x4c3a));
  const definition = CHALLENGES[rng.int(CHALLENGES.length)] as ChallengeDefinition;

  const startsAt = now + RULES.challengeIntroMs;
  const endsAt = startsAt + definition.durationMs;

  return {
    challengeId: definition.id,
    type: definition.type,
    prompt: definition.prompt,
    startsAt,
    endsAt,
    advantagedTeamId,
    advantage: definition.matchTeamAdvantage,
    headStartMs: RULES.challengeHeadStartMs,
    scoreReward: definition.scoreReward,
    payload: buildPayload(definition, rng, startsAt),
    submissions: {},
    winnerTeamId: null,
    resolved: false,
  };
}

function buildPayload(
  definition: ChallengeDefinition,
  rng: ReturnType<typeof createRng>,
  startsAt: EpochMs,
): ChallengePayload {
  switch (definition.type) {
    case 'reaction_rush': {
      // Randomize the wait so the target cannot be anticipated, but keep a
      // margin before the deadline so the round is always winnable.
      const window = Math.max(1000, definition.durationMs - 4000);
      return { kind: 'reaction_rush', revealAt: startsAt + 1200 + rng.int(window) };
    }
    case 'sequence_memory': {
      const span = RULES.sequenceMaxLength - RULES.sequenceMinLength + 1;
      const length = RULES.sequenceMinLength + rng.int(span);
      const palette = definition.options.length > 0 ? definition.options : ['١', '٢', '٣', '٤'];
      const sequence = Array.from(
        { length },
        () => palette[rng.int(palette.length)] as string,
      );
      return { kind: 'sequence_memory', sequence, palette, hideAtMs: RULES.sequenceShowMs };
    }
    case 'visual_puzzle': {
      // Shuffle the options so a repeat of the same challenge is not muscle
      // memory, and track where the correct answer landed.
      const indexed = definition.options.map((label, index) => ({ label, index }));
      const mixed = shuffle(indexed, rng);
      const correctAnswer = mixed.findIndex((o) => o.index === definition.correctAnswer);
      return {
        kind: 'visual_puzzle',
        options: mixed.map((o) => o.label),
        correctAnswer: correctAnswer >= 0 ? correctAnswer : 0,
        image: definition.assets[0] ?? null,
      };
    }
    case 'team_sync':
    default:
      // Zone count is set per team when rendering, capped at the roster size.
      return { kind: 'team_sync', zones: 0 };
  }
}

/**
 * Decide whether a submission is right. Correctness is judged here, on the
 * host, from the broadcast payload — a device reports only what it did.
 */
export function evaluateSubmission(
  challenge: ChallengeState,
  submission: Omit<ChallengeSubmission, 'correct'>,
  playerCount: number,
): boolean {
  const payload = challenge.payload;
  switch (payload.kind) {
    case 'reaction_rush':
      // answer -1 is the client admitting a foul (pressed before the reveal).
      return submission.answer >= 0 && submission.submittedAt >= payload.revealAt;
    case 'sequence_memory': {
      if (submission.sequence.length !== payload.sequence.length) return false;
      return submission.sequence.every((choice, i) => payload.palette[choice] === payload.sequence[i]);
    }
    case 'visual_puzzle':
      return submission.answer === payload.correctAnswer;
    case 'team_sync':
      // The device reports how many zones were held simultaneously.
      return submission.answer >= Math.min(playerCount, 3);
    default:
      return false;
  }
}
