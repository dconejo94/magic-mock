import type { Cache } from './cache/cache.js';
import { InMemoryTtlCache } from './cache/cache.js';
import type { Card } from './domain/card.js';
import type { CardResolver } from './domain/resolver.js';
import { mapScryfallCard } from './scryfall/mapper.js';
import type { ScryfallClient } from './scryfall/client.js';

export interface CardDatabaseServiceOptions {
  /** Cache for resolved cards. Defaults to a 24 h in-memory TTL cache. */
  readonly cache?: Cache<Card>;
}

export interface CardSearchResult {
  readonly cards: readonly Card[];
  readonly hasMore: boolean;
  readonly totalCards?: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_MAX_ENTRIES = 10_000;

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Card metadata lookup for the rest of the platform.
 *
 * Composes the Scryfall client with a cache (Scryfall asks integrators to
 * cache card data for at least 24 hours). Exposes only domain types — no
 * Scryfall wire types leak past this boundary — and contains no game logic.
 */
export class CardDatabaseService implements CardResolver {
  private readonly client: ScryfallClient;
  private readonly cache: Cache<Card>;

  constructor(client: ScryfallClient, options: CardDatabaseServiceOptions = {}) {
    this.client = client;
    this.cache =
      options.cache ??
      new InMemoryTtlCache<Card>({ ttlMs: DAY_MS, maxEntries: DEFAULT_MAX_ENTRIES });
  }

  /** Resolve a card by exact (case-insensitive) name. */
  async getCardByExactName(name: string): Promise<Card> {
    const key = `name:${normalizeName(name)}`;
    const cached = this.cache.get(key);
    if (cached) {
      return cached;
    }
    const card = mapScryfallCard(await this.client.getCardByExactName(name));
    this.index(card, key);
    return card;
  }

  /**
   * Resolve a card by approximate name — the entry point for the vision
   * service, whose OCR output is noisy. Fuzzy results are cached under the
   * resolved card's real name, not the noisy query.
   */
  async getCardByFuzzyName(name: string): Promise<Card> {
    const exactKey = `name:${normalizeName(name)}`;
    const cached = this.cache.get(exactKey);
    if (cached) {
      return cached;
    }
    const card = mapScryfallCard(await this.client.getCardByFuzzyName(name));
    this.index(card);
    return card;
  }

  /** Resolve a specific printing by Scryfall id. */
  async getCardById(id: string): Promise<Card> {
    const key = `id:${id}`;
    const cached = this.cache.get(key);
    if (cached) {
      return cached;
    }
    const card = mapScryfallCard(await this.client.getCardById(id));
    this.index(card, key);
    return card;
  }

  /** Search with full Scryfall syntax. Results are cached individually. */
  async searchCards(query: string, page = 1): Promise<CardSearchResult> {
    const list = await this.client.searchCards(query, page);
    const cards = list.data.map(mapScryfallCard);
    for (const card of cards) {
      this.index(card);
    }
    return {
      cards,
      hasMore: list.has_more,
      ...(list.total_cards !== undefined && { totalCards: list.total_cards }),
    };
  }

  private index(card: Card, ...extraKeys: readonly string[]): void {
    this.cache.set(`id:${card.id}`, card);
    this.cache.set(`name:${normalizeName(card.name)}`, card);
    for (const key of extraKeys) {
      this.cache.set(key, card);
    }
  }
}
