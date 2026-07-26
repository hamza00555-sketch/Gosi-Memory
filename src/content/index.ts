import { z } from 'zod';
import type { CardDefinition, PairDefinition, TargetManifestEntry } from '../domain/cards';
import type { ChallengeDefinition } from '../domain/challenge';
import type { ObjectSetDefinition } from '../domain/objectSets';
import { DEFAULT_OBJECT_SET_ID } from '../domain/objectSets';
import type { PuzzleDefinition } from '../domain/puzzle';

import cardsRaw from './cards.json';
import pairsRaw from './pairs.json';
import targetsRaw from './targets-manifest.json';
import objectSetsRaw from './object-sets.json';
import challengesRaw from './challenges.json';
import puzzlesRaw from './puzzles.json';
import soundsRaw from './sounds.json';

/**
 * Content is data, not code. It is parsed once at module load and validated
 * with Zod so an authoring mistake — a pair pointing at a missing card, a
 * duplicate targetIndex — fails loudly at startup instead of becoming a
 * mysterious runtime bug during a match.
 */

const vec3 = z.tuple([z.number(), z.number(), z.number()]);

const cardSchema = z.object({
  targetId: z.string().min(1),
  pairId: z.string().min(1),
  side: z.enum(['a', 'b']),
  name: z.string().min(1),
  description: z.string(),
});

const pairSchema = z.object({
  pairId: z.string().min(1),
  name: z.string().min(1),
  targetIds: z.tuple([z.string().min(1), z.string().min(1)]),
});

const targetSchema = z.object({
  targetIndex: z.number().int().min(0),
  targetId: z.string().min(1),
  pairId: z.string().min(1),
  targetImage: z.string().min(1),
});

const arObjectSchema = z.object({
  modelPath: z.string().min(1),
  scale: vec3,
  position: vec3,
  rotation: vec3,
  revealClip: z.string(),
  idleClip: z.string(),
  matchClip: z.string(),
  mismatchClip: z.string(),
  placeholderShape: z.enum(['prism', 'orb', 'ring', 'cube']),
  placeholderColor: z.string(),
});

const objectSetSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  isDefault: z.boolean(),
  isPurchasable: z.boolean(),
  futurePrice: z.number().min(0),
  unlockSource: z.enum(['free', 'purchase', 'reward', 'dev']),
  previewImage: z.string(),
  objects: z.record(z.string(), arObjectSchema),
});

const challengeSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['reaction_rush', 'sequence_memory', 'visual_puzzle', 'team_sync']),
  durationMs: z.number().int().positive(),
  prompt: z.string().min(1),
  options: z.array(z.string()),
  correctAnswer: z.number().int(),
  assets: z.array(z.string()),
  matchTeamAdvantage: z.enum(['head_start', 'extra_attempt', 'score_bonus']),
  scoreReward: z.number().int().min(0),
});

const puzzleSchema = z.object({
  id: z.string().min(1),
  prompt: z.string().min(1),
  image: z.string().min(1),
  pieceCount: z.number().int().min(4),
  options: z.array(z.string()).length(4),
  correctAnswer: z.number().int().min(0).max(3),
});

const soundSchema = z.object({
  id: z.string().min(1),
  src: z.string().min(1),
  volume: z.number().min(0).max(1),
  loop: z.boolean(),
});

function parse<T>(schema: z.ZodType<T>, value: unknown, label: string): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new Error(`[content] ${label} failed validation: ${result.error.message}`);
  }
  return result.data;
}

export const CARDS: CardDefinition[] = parse(
  z.array(cardSchema),
  cardsRaw.cards,
  'cards.json',
);

export const PAIRS: PairDefinition[] = parse(
  z.array(pairSchema),
  pairsRaw.pairs,
  'pairs.json',
) as PairDefinition[];

export const TARGETS: TargetManifestEntry[] = parse(
  z.array(targetSchema),
  targetsRaw.targets,
  'targets-manifest.json',
);

export const MIND_FILE_URL: string = targetsRaw.mindFile;

export const OBJECT_SETS: ObjectSetDefinition[] = parse(
  z.array(objectSetSchema),
  objectSetsRaw.sets,
  'object-sets.json',
) as ObjectSetDefinition[];

export const CHALLENGES: ChallengeDefinition[] = parse(
  z.array(challengeSchema),
  challengesRaw.challenges,
  'challenges.json',
);

export const PUZZLES: PuzzleDefinition[] = parse(
  z.array(puzzleSchema),
  puzzlesRaw.puzzles,
  'puzzles.json',
);

export interface SoundDefinition {
  id: string;
  src: string;
  volume: number;
  loop: boolean;
}

export const SOUNDS: SoundDefinition[] = parse(
  z.array(soundSchema),
  soundsRaw.sounds,
  'sounds.json',
);

// ---------------------------------------------------------------------------
// Cross-file integrity. These catch the authoring mistakes that Zod cannot see
// because they span two files.
// ---------------------------------------------------------------------------

function assertContentIntegrity(): void {
  const cardIds = new Set(CARDS.map((c) => c.targetId));
  if (cardIds.size !== CARDS.length) {
    throw new Error('[content] duplicate targetId in cards.json');
  }

  const pairIds = new Set(PAIRS.map((p) => p.pairId));
  if (pairIds.size !== PAIRS.length) {
    throw new Error('[content] duplicate pairId in pairs.json');
  }

  for (const pair of PAIRS) {
    const [a, b] = pair.targetIds;
    if (a === b) throw new Error(`[content] ${pair.pairId} lists the same card twice`);
    for (const id of pair.targetIds) {
      if (!cardIds.has(id)) {
        throw new Error(`[content] ${pair.pairId} references unknown card "${id}"`);
      }
    }
  }

  for (const card of CARDS) {
    if (!pairIds.has(card.pairId)) {
      throw new Error(`[content] card "${card.targetId}" references unknown pair "${card.pairId}"`);
    }
  }

  // Every card must be recognizable, and indices must be a dense 0..n-1 range —
  // MindAR reports positional indices, so a gap silently mis-maps every card
  // after it.
  const indices = TARGETS.map((t) => t.targetIndex).sort((x, y) => x - y);
  indices.forEach((value, position) => {
    if (value !== position) {
      throw new Error(
        `[content] targetIndex must be dense starting at 0; expected ${position}, found ${value}`,
      );
    }
  });

  for (const target of TARGETS) {
    const card = CARDS.find((c) => c.targetId === target.targetId);
    if (!card) {
      throw new Error(`[content] manifest lists unknown card "${target.targetId}"`);
    }
    if (card.pairId !== target.pairId) {
      throw new Error(
        `[content] pairId mismatch for "${target.targetId}": manifest says ${target.pairId}, cards.json says ${card.pairId}`,
      );
    }
  }

  for (const card of CARDS) {
    if (!TARGETS.some((t) => t.targetId === card.targetId)) {
      throw new Error(`[content] card "${card.targetId}" is missing from targets-manifest.json`);
    }
  }

  const defaultSet = OBJECT_SETS.find((s) => s.id === DEFAULT_OBJECT_SET_ID);
  if (!defaultSet) {
    throw new Error(`[content] the default object set "${DEFAULT_OBJECT_SET_ID}" is missing`);
  }
  if (!defaultSet.isDefault) {
    throw new Error(`[content] "${DEFAULT_OBJECT_SET_ID}" must have isDefault: true`);
  }
  // The default set is the fallback for every other set, so it alone must be
  // complete. Other sets may be partial by design.
  for (const card of CARDS) {
    if (!defaultSet.objects[card.targetId]) {
      throw new Error(`[content] default set has no object for "${card.targetId}"`);
    }
  }
}

assertContentIntegrity();

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

const cardByTargetId = new Map(CARDS.map((c) => [c.targetId, c]));
const targetByIndexMap = new Map(TARGETS.map((t) => [t.targetIndex, t]));
const targetByIdMap = new Map(TARGETS.map((t) => [t.targetId, t]));
const pairByIdMap = new Map(PAIRS.map((p) => [p.pairId, p]));
const objectSetByIdMap = new Map(OBJECT_SETS.map((s) => [s.id, s]));
const puzzleByIdMap = new Map(PUZZLES.map((p) => [p.id, p]));
const challengeByIdMap = new Map(CHALLENGES.map((c) => [c.id, c]));

export function getCard(targetId: string): CardDefinition | undefined {
  return cardByTargetId.get(targetId);
}

export function getTargetByIndex(index: number): TargetManifestEntry | undefined {
  return targetByIndexMap.get(index);
}

export function getTargetById(targetId: string): TargetManifestEntry | undefined {
  return targetByIdMap.get(targetId);
}

export function getPair(pairId: string): PairDefinition | undefined {
  return pairByIdMap.get(pairId);
}

export function getObjectSet(setId: string): ObjectSetDefinition | undefined {
  return objectSetByIdMap.get(setId);
}

export function getDefaultObjectSet(): ObjectSetDefinition {
  // Guaranteed present by assertContentIntegrity.
  return objectSetByIdMap.get(DEFAULT_OBJECT_SET_ID)!;
}

export function getPuzzle(puzzleId: string): PuzzleDefinition | undefined {
  return puzzleByIdMap.get(puzzleId);
}

export function getChallenge(challengeId: string): ChallengeDefinition | undefined {
  return challengeByIdMap.get(challengeId);
}

/** Total number of pairs in the active pack — the round ends when all match. */
export const TOTAL_PAIRS = PAIRS.length;
