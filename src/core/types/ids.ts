/**
 * Lightweight nominal id aliases.
 * They are plain strings at runtime but document intent at call sites.
 */
export type PlayerId = string;
export type GameId = string;
export type CardId = string;
export type PairId = string;
export type SetId = string;

/** Unix epoch milliseconds. Stored as numbers everywhere for determinism. */
export type EpochMs = number;
