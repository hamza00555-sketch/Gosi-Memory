/**
 * AR-layer tuning. Deliberately separate from RULES: nothing here changes what
 * the game considers a legal move, only how tolerant the camera pipeline is.
 * RULES.minScanConfidence remains the single authority on the confidence floor.
 */
export const AR_TUNING = {
  /**
   * How long a target keeps a non-zero derived confidence after MindAR stops
   * reporting it. Within this window a re-acquisition is treated as the SAME
   * sighting (an 'updated', not a fresh 'found'), so a hand passing over a card
   * does not restart the scan gate's stability streak.
   */
  trackingGraceMs: 400,

  /**
   * Visual hold before an anchor hides. Spec range is 300-500ms: long enough to
   * absorb the flicker that motion blur causes at arm's length, short enough
   * that an object never lingers over a card that has actually been removed.
   */
  anchorGraceMs: 400,

  /** Procedural placeholder animation lengths, used when a GLB has no clips. */
  placeholder: {
    revealMs: 450,
    reactionMs: 700,
  },

  scanGate: {
    /**
     * Consecutive qualifying frames before a target counts. Tracking jitter
     * produces isolated one-or-two-frame hits; a deliberate "hold the card up"
     * gesture produces many. Four frames is roughly 130ms at 30fps.
     */
    stableFrames: 4,
    /** Per-target: a card left lying in view must not re-fire. */
    debounceMs: 1200,
    /** Global: nothing at all is accepted right after an accepted scan. */
    cooldownMs: 700,
  },

  /** Headless MindAR controller options. */
  controller: {
    /** Two, so both of a turn's picks can render at once. Each costs GPU time. */
    maxTrack: 2,
    /**
     * Consecutive frames MindAR needs before it declares a target found.
     * Deliberately looser than the library default of 5: reference images
     * photographed off-axis carry perspective distortion, so a real card can
     * sit at a dozen matched points where a clean scan would give hundreds,
     * and five-in-a-row is a bar it rarely clears. Acquiring eagerly is safe
     * here because ScanGate — not the tracker — decides what becomes a move,
     * and it independently requires four stable frames plus a debounce.
     */
    warmupTolerance: 2,
    /** Conversely, hold a target longer once acquired so a wobble is absorbed. */
    missTolerance: 8,
    filterMinCF: 0.0001,
    filterBeta: 1000,
  },
} as const;
