import { describe, expect, it } from 'vitest';
import { boundedLevenshtein, normalizeCardName } from '../../src/offline/normalize.js';

describe('normalizeCardName', () => {
  it('lowercases and collapses whitespace', () => {
    expect(normalizeCardName('  Lightning   Bolt ')).toBe('lightning bolt');
  });

  it('strips diacritics', () => {
    expect(normalizeCardName('Lim-Dûl the Necromancer')).toBe('lim dul the necromancer');
    expect(normalizeCardName('Jötun Grunt')).toBe('jotun grunt');
  });

  it('removes punctuation (apostrophes, commas, slashes)', () => {
    expect(normalizeCardName("Gaea's Cradle")).toBe('gaea s cradle');
    expect(normalizeCardName('Delver of Secrets // Insectile Aberration')).toBe(
      'delver of secrets insectile aberration',
    );
  });
});

describe('boundedLevenshtein', () => {
  it('computes exact distances within the bound', () => {
    expect(boundedLevenshtein('bolt', 'bolt', 2)).toBe(0);
    expect(boundedLevenshtein('bolt', 'bold', 2)).toBe(1);
    expect(boundedLevenshtein('lighming bolt', 'lightning bolt', 3)).toBe(2);
  });

  it('returns Infinity when the distance exceeds the bound', () => {
    expect(boundedLevenshtein('counterspell', 'lightning bolt', 3)).toBe(Infinity);
  });

  it('short-circuits on length difference', () => {
    expect(boundedLevenshtein('a', 'aaaaaa', 2)).toBe(Infinity);
  });

  it('handles empty strings', () => {
    expect(boundedLevenshtein('', 'ab', 2)).toBe(2);
    expect(boundedLevenshtein('ab', '', 2)).toBe(2);
  });
});
