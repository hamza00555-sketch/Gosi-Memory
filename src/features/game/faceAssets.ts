/**
 * Maps face asset ids to visual representations.
 *
 * Two parallel maps:
 *  - FACE_GLYPHS  → emoji/text placeholder (all existing faces)
 *  - FACE_IMAGES  → public image path (image-based faces)
 *
 * CardGrid checks FACE_IMAGES first; if a path is found it renders <img>,
 * otherwise it falls back to the glyph. Swap values here — no component
 * changes needed when real art lands.
 */

export const FACE_GLYPHS: Record<string, string> = {
  face_key: '🔑',
  face_heart: '❤️',
  face_coffee: '☕',
  face_star: '⭐',
  face_bolt: '⚡',
  face_moon: '🌙',
  face_gear: '⚙️',
  face_crown: '👑',
  face_leaf: '🍃',
  face_flame: '🔥',
  face_gem: '💎',
  face_anchor: '⚓',
};

/** Image-based card faces served from /public. Value is the public URL path. */
export const FACE_IMAGES: Record<string, string> = {
  face_qawsi_seal: '/assets/cards/qawsi-seal-card-08.png',
};

/** Returns the image path for a face asset, or null if it is glyph-only. */
export function imagePathFor(faceAssetId: string): string | null {
  return FACE_IMAGES[faceAssetId] ?? null;
}

/** Returns the glyph for a face asset (fallback for non-image faces). */
export function glyphFor(faceAssetId: string): string {
  return FACE_GLYPHS[faceAssetId] ?? '◆';
}
