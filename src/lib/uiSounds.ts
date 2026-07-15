/** Global UI sounds (generated, royalty-free — see scripts/generate-sounds.mjs). */
const base = `${import.meta.env.BASE_URL}sounds`;

export const UI_SOUNDS = {
  flip: `${base}/flip.wav`,
  match: `${base}/match.wav`,
  miss: `${base}/miss.wav`,
  win: `${base}/win.wav`,
} as const;
