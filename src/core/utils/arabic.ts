/**
 * Arabic text normalization for forgiving phrase-solve comparison.
 *
 * Players should win if they type the right phrase even with different
 * diacritics, hamza forms, or spacing. We normalize both sides before compare:
 * - strip tashkeel (diacritics) and tatweel
 * - unify alef variants (أ إ آ ا) and alef maqsura -> ya
 * - unify ta marbuta -> ha, and hamza-on-waw/ya
 * - collapse whitespace, trim, lowercase latin digits
 */
const TASHKEEL = /[ؐ-ًؚ-ٰٟۖ-ۜ۟-۪ۨ-ۭ]/g;
const TATWEEL = /ـ/g;

export function normalizeArabic(input: string): string {
  return input
    .replace(TASHKEEL, '')
    .replace(TATWEEL, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Compare two phrases for solve-equality after normalization. */
export function phrasesMatch(a: string, b: string): boolean {
  return normalizeArabic(a) === normalizeArabic(b);
}
