import type { Card, OracleId } from '../domain/card.js';
import type { CardResolver } from '../domain/resolver.js';
import { AmbiguousCardNameError, CardNotFoundError } from '../errors.js';
import { boundedLevenshtein, normalizeCardName } from './normalize.js';

export interface OfflineCardIndexOptions {
  /**
   * Maximum edit distance accepted by fuzzy resolution, as a fraction of the
   * query length (minimum 1, maximum 4). Default 0.25 — roughly one typo per
   * four characters, comparable to Scryfall's fuzzy endpoint.
   */
  readonly maxFuzzyDistanceRatio?: number;
}

/**
 * In-memory card index built from a Scryfall bulk-data export.
 *
 * Offline counterpart of CardDatabaseService (both implement CardResolver):
 * no network round-trips, so per-frame vision lookups are affordable. Names
 * are indexed under the full card name AND each face name, all normalized.
 * Fuzzy resolution mirrors Scryfall semantics: a single confident match wins;
 * ambiguity is an error, never a guess.
 */
export class OfflineCardIndex implements CardResolver {
  private readonly byId = new Map<string, Card>();
  private readonly byOracleId = new Map<OracleId, Card>();
  private readonly byName = new Map<string, Card>();
  /** Normalized names that collide across different oracle cards. */
  private readonly ambiguousNames = new Set<string>();
  private readonly maxFuzzyDistanceRatio: number;

  constructor(cards: Iterable<Card>, options: OfflineCardIndexOptions = {}) {
    this.maxFuzzyDistanceRatio = options.maxFuzzyDistanceRatio ?? 0.25;
    for (const card of cards) {
      this.add(card);
    }
  }

  get size(): number {
    return this.byOracleId.size;
  }

  getCardByExactName(name: string): Promise<Card> {
    const card = this.lookupName(normalizeCardName(name));
    if (!card) {
      return Promise.reject(new CardNotFoundError(name));
    }
    return Promise.resolve(card);
  }

  getCardByFuzzyName(name: string): Promise<Card> {
    const query = normalizeCardName(name);
    if (query.length === 0) {
      return Promise.reject(new CardNotFoundError(name));
    }

    const exact = this.lookupName(query);
    if (exact) {
      return Promise.resolve(exact);
    }

    const maxDistance = Math.min(
      4,
      Math.max(1, Math.round(query.length * this.maxFuzzyDistanceRatio)),
    );
    let best: Card | undefined;
    let bestDistance = Infinity;
    let tied = false;

    for (const [candidate, card] of this.byName) {
      const distance = boundedLevenshtein(query, candidate, maxDistance);
      if (distance < bestDistance) {
        best = card;
        bestDistance = distance;
        tied = false;
      } else if (distance === bestDistance && distance !== Infinity && card !== best) {
        tied = true;
      }
    }

    if (!best || bestDistance === Infinity) {
      return Promise.reject(new CardNotFoundError(name));
    }
    if (tied) {
      return Promise.reject(new AmbiguousCardNameError(name));
    }
    return Promise.resolve(best);
  }

  getCardById(id: string): Promise<Card> {
    const card = this.byId.get(id);
    if (!card) {
      return Promise.reject(new CardNotFoundError(id));
    }
    return Promise.resolve(card);
  }

  /** Lookup by oracle id (stable across printings) — offline-only extra. */
  getCardByOracleId(oracleId: OracleId): Card | undefined {
    return this.byOracleId.get(oracleId);
  }

  private add(card: Card): void {
    this.byId.set(card.id, card);
    // One representative printing per oracle card; first one wins so the
    // bulk file's ordering (oracle_cards has one entry per oracle id) holds.
    if (!this.byOracleId.has(card.oracleId)) {
      this.byOracleId.set(card.oracleId, card);
    }

    const names = new Set<string>([normalizeCardName(card.name)]);
    for (const face of card.faces) {
      names.add(normalizeCardName(face.name));
    }
    for (const name of names) {
      if (name.length === 0) {
        continue;
      }
      const existing = this.byName.get(name);
      if (existing && existing.oracleId !== card.oracleId) {
        this.ambiguousNames.add(name);
      } else {
        this.byName.set(name, card);
      }
    }
  }

  private lookupName(normalized: string): Card | undefined {
    if (this.ambiguousNames.has(normalized)) {
      return undefined;
    }
    return this.byName.get(normalized);
  }
}
