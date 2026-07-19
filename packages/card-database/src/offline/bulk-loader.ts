import { readFile } from 'node:fs/promises';
import type { Card } from '../domain/card.js';
import { CardDatabaseError } from '../errors.js';
import { mapScryfallCard } from '../scryfall/mapper.js';
import type { ScryfallCard } from '../scryfall/types.js';

/**
 * Layouts that are not resolvable gameplay cards. Tokens and emblems are
 * game *objects* the engine creates — they are never cast from a player's
 * physical deck, and their names collide with real cards.
 */
const NON_GAMEPLAY_LAYOUTS: ReadonlySet<string> = new Set([
  'token',
  'double_faced_token',
  'emblem',
  'art_series',
]);

export interface LoadBulkFileOptions {
  /** Custom card filter; defaults to excluding non-gameplay layouts. */
  readonly filter?: (card: ScryfallCard) => boolean;
}

function defaultFilter(card: ScryfallCard): boolean {
  return !NON_GAMEPLAY_LAYOUTS.has(card.layout);
}

/**
 * Loads a Scryfall bulk-data JSON file (an array of card objects, e.g. the
 * "oracle_cards" export) from disk and maps it to domain cards.
 */
export async function loadBulkCardFile(
  filePath: string,
  options: LoadBulkFileOptions = {},
): Promise<Card[]> {
  const filter = options.filter ?? defaultFilter;

  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(filePath, 'utf8'));
  } catch (cause) {
    throw new CardDatabaseError(`Failed to read bulk data file: ${filePath}`, { cause });
  }

  if (!Array.isArray(parsed)) {
    throw new CardDatabaseError(`Bulk data file is not a JSON array: ${filePath}`);
  }

  const cards: Card[] = [];
  for (const entry of parsed as unknown[]) {
    const candidate = entry as Partial<ScryfallCard>;
    if (candidate.object !== 'card' || typeof candidate.id !== 'string') {
      continue;
    }
    const wire = candidate as ScryfallCard;
    if (filter(wire)) {
      cards.push(mapScryfallCard(wire));
    }
  }
  return cards;
}
