/**
 * Maps face asset ids to placeholder glyphs. Organized in one table so real art
 * (SVG/GLB) can replace these without touching components — swap the values.
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

export function glyphFor(faceAssetId: string): string {
  return FACE_GLYPHS[faceAssetId] ?? '◆';
}
