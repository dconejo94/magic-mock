/**
 * Normalizes a card name for matching: lowercase, diacritics stripped
 * (Lim-Dûl → lim-dul → limdul), punctuation removed, whitespace collapsed.
 * OCR output and human typing both survive this normalization.
 */
export function normalizeCardName(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Levenshtein distance with an upper bound: returns Infinity as soon as the
 * distance is guaranteed to exceed `maxDistance`, which keeps scanning a
 * 30k-name index cheap.
 */
export function boundedLevenshtein(a: string, b: string, maxDistance: number): number {
  if (a === b) {
    return 0;
  }
  if (Math.abs(a.length - b.length) > maxDistance) {
    return Infinity;
  }
  if (a.length === 0 || b.length === 0) {
    return Math.max(a.length, b.length);
  }

  let previous = new Array<number>(b.length + 1);
  let current = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j += 1) {
    previous[j] = j;
  }

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    let rowMin = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const value = Math.min(
        (previous[j] ?? Infinity) + 1,
        (current[j - 1] ?? Infinity) + 1,
        (previous[j - 1] ?? Infinity) + cost,
      );
      current[j] = value;
      if (value < rowMin) {
        rowMin = value;
      }
    }
    if (rowMin > maxDistance) {
      return Infinity;
    }
    [previous, current] = [current, previous];
  }

  const distance = previous[b.length] ?? Infinity;
  return distance <= maxDistance ? distance : Infinity;
}
