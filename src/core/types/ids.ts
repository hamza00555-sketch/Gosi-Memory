/**
 * Lightweight nominal id aliases.
 * They are plain strings at runtime but document intent at call sites.
 */
export type PlayerId = string;
export type RoomId = string;
export type GameId = string;
export type TeamId = string;
export type CardId = string;
export type PairId = string;
export type PhraseId = string;
export type WordId = string;
export type AssetId = string;
export type CosmeticId = string;

/** Room join code shown to users, e.g. "QW7K3P". */
export type RoomCode = string;

/** Unix epoch milliseconds. Stored as numbers everywhere for determinism. */
export type EpochMs = number;
