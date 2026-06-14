import { describe, expect, it } from 'vitest';
import { normalizeArabic, phrasesMatch } from './arabic';

describe('Arabic normalization', () => {
  it('ignores diacritics, tatweel, and extra spacing', () => {
    expect(phrasesMatch('مَا خَابَ مَنِ اسْتَشَار', 'ما خاب من استشار')).toBe(true);
    expect(phrasesMatch('ما   خاب من استشار', ' ما خاب من استشار ')).toBe(true);
  });

  it('unifies alef and ya/alef-maqsura variants', () => {
    expect(phrasesMatch('أحمد', 'احمد')).toBe(true);
    expect(phrasesMatch('على', 'علي')).toBe(true);
  });

  it('rejects genuinely different phrases', () => {
    expect(phrasesMatch('ما خاب من استشار', 'القهوة أولا')).toBe(false);
  });

  it('normalizes ta-marbuta to ha', () => {
    expect(normalizeArabic('مدرسة')).toBe(normalizeArabic('مدرسه'));
  });
});
