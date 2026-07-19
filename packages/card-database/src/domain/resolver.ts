import type { Card } from './card.js';

/**
 * Card name/id resolution contract shared by the online service
 * (CardDatabaseService) and the offline index (OfflineCardIndex).
 *
 * Consumers — most importantly the future vision service — depend on this
 * interface only, so online and offline resolution are interchangeable.
 * All methods reject with CardNotFoundError when no confident match exists.
 */
export interface CardResolver {
  /** Resolve by exact (case-insensitive) card name. */
  getCardByExactName(name: string): Promise<Card>;
  /** Resolve a possibly misspelled name (e.g. noisy OCR output). */
  getCardByFuzzyName(name: string): Promise<Card>;
  /** Resolve a specific printing by Scryfall print id. */
  getCardById(id: string): Promise<Card>;
}
