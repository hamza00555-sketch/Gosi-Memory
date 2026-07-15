import { z } from 'zod';
import type { CardSide } from '../core/types/card';
import type { PairId, SetId } from '../core/types/ids';

/**
 * Card sets ("ستات") are the content packs of the game: a themed folder under
 * /public/sets/<setId>/ holding set.json + card face images + AR objects +
 * sounds + (optionally) a compiled MindAR targets file.
 *
 * Adding a new set requires NO code: drop a folder and list it in
 * /public/sets/index.json.
 */

const localizedText = z.object({ ar: z.string(), en: z.string() });
export type LocalizedText = z.infer<typeof localizedText>;

const setObjectSchema = z.object({
  /** "model" = GLB loaded with GLTFLoader; "image" = flat billboard texture. */
  kind: z.enum(['model', 'image']),
  /** Path relative to the set folder, e.g. "objects/crab.glb". */
  src: z.string(),
  /** Uniform scale in card-width units (1 = as wide as the card). */
  scale: z.number().positive().default(0.8),
  /** Lift above the card plane, in card-width units. */
  yOffset: z.number().default(0.25),
  /** Idle spin speed in radians/second (0 disables). */
  spin: z.number().default(0.6),
});

const setPairSchema = z.object({
  pairId: z.string().min(1),
  name: localizedText,
  /** Printed card face; also the MindAR tracking target. Relative path. */
  faceImage: z.string(),
  /** Zero-based index of faceImage inside the compiled targets.mind. */
  targetIndex: z.number().int().nonnegative(),
  object: setObjectSchema,
  /** Sound played when the pair's object appears. Relative path. */
  sound: z.string().nullable().default(null),
});

export const cardSetSchema = z.object({
  setId: z.string().min(1),
  name: localizedText,
  description: localizedText,
  /** Accent color used in menus/print sheets for this set. */
  themeColor: z.string().default('#22d3ee'),
  /** Compiled MindAR multi-target file, relative path (null = QR-only set). */
  mindFile: z.string().nullable().default(null),
  pairs: z.array(setPairSchema).min(2),
});

const setIndexSchema = z.object({
  sets: z.array(
    z.object({
      setId: z.string(),
      name: localizedText,
      themeColor: z.string().default('#22d3ee'),
    }),
  ),
});

export type SetObject = z.infer<typeof setObjectSchema>;
export type SetPair = z.infer<typeof setPairSchema>;
export type CardSet = z.infer<typeof cardSetSchema>;
export type SetIndexEntry = z.infer<typeof setIndexSchema>['sets'][number];

export function setBaseUrl(setId: SetId): string {
  return `${import.meta.env.BASE_URL}sets/${setId}`;
}

/** Resolve a set-relative asset path ("objects/crab.glb") to a fetchable URL. */
export function setAssetUrl(setId: SetId, relativePath: string): string {
  return `${setBaseUrl(setId)}/${relativePath.replace(/^\/+/, '')}`;
}

export async function loadSetIndex(): Promise<SetIndexEntry[]> {
  const res = await fetch(`${import.meta.env.BASE_URL}sets/index.json`);
  if (!res.ok) throw new Error(`sets/index.json: HTTP ${res.status}`);
  return setIndexSchema.parse(await res.json()).sets;
}

const setCache = new Map<SetId, CardSet>();

export async function loadSet(setId: SetId): Promise<CardSet> {
  const cached = setCache.get(setId);
  if (cached) return cached;
  const res = await fetch(setAssetUrl(setId, 'set.json'));
  if (!res.ok) throw new Error(`sets/${setId}/set.json: HTTP ${res.status}`);
  const parsed = cardSetSchema.parse(await res.json());
  setCache.set(setId, parsed);
  return parsed;
}

export function pairOf(set: CardSet, pairId: PairId): SetPair | undefined {
  return set.pairs.find((p) => p.pairId === pairId);
}

export function pairByTargetIndex(set: CardSet, targetIndex: number): SetPair | undefined {
  return set.pairs.find((p) => p.targetIndex === targetIndex);
}

// ----------------------------------------------------------------------------
// QR payload codec — what gets printed on every card corner.
// ----------------------------------------------------------------------------

export const QR_PREFIX = 'gosi1';

export interface QrPayload {
  setId: SetId;
  pairId: PairId;
  side: CardSide;
}

/** `gosi1:<setId>:<pairId>:<a|b>` — colons are reserved separators. */
export function encodeQrPayload(p: QrPayload): string {
  return `${QR_PREFIX}:${p.setId}:${p.pairId}:${p.side}`;
}

/** Returns null for anything that is not one of our card QR codes. */
export function decodeQrPayload(text: string): QrPayload | null {
  const parts = text.trim().split(':');
  if (parts.length !== 4 || parts[0] !== QR_PREFIX) return null;
  const [, setId, pairId, side] = parts as [string, string, string, string];
  if (!setId || !pairId || (side !== 'a' && side !== 'b')) return null;
  return { setId, pairId, side };
}
