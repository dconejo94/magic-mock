import { describe, expect, it, vi } from 'vitest';
import { CardDatabaseService } from '../../src/service.js';
import type { ScryfallClient } from '../../src/scryfall/client.js';
import type { ScryfallList } from '../../src/scryfall/types.js';
import { DELVER_OF_SECRETS, LIGHTNING_BOLT } from '../fixtures/cards.js';

function makeClientStub(): Record<
  'getCardByExactName' | 'getCardByFuzzyName' | 'getCardById' | 'searchCards',
  ReturnType<typeof vi.fn>
> {
  return {
    getCardByExactName: vi.fn(),
    getCardByFuzzyName: vi.fn(),
    getCardById: vi.fn(),
    searchCards: vi.fn(),
  };
}

describe('CardDatabaseService', () => {
  it('fetches by exact name once and serves repeats from cache', async () => {
    const stub = makeClientStub();
    stub.getCardByExactName.mockResolvedValue(LIGHTNING_BOLT);
    const service = new CardDatabaseService(stub as unknown as ScryfallClient);

    const first = await service.getCardByExactName('Lightning Bolt');
    const second = await service.getCardByExactName('lightning bolt  ');

    expect(first.name).toBe('Lightning Bolt');
    expect(second).toBe(first);
    expect(stub.getCardByExactName).toHaveBeenCalledTimes(1);
  });

  it('cross-populates the id cache from a name lookup', async () => {
    const stub = makeClientStub();
    stub.getCardByExactName.mockResolvedValue(LIGHTNING_BOLT);
    const service = new CardDatabaseService(stub as unknown as ScryfallClient);

    await service.getCardByExactName('Lightning Bolt');
    const byId = await service.getCardById(LIGHTNING_BOLT.id);

    expect(byId.name).toBe('Lightning Bolt');
    expect(stub.getCardById).not.toHaveBeenCalled();
  });

  it('resolves fuzzy lookups and caches under the resolved name', async () => {
    const stub = makeClientStub();
    stub.getCardByFuzzyName.mockResolvedValue(LIGHTNING_BOLT);
    const service = new CardDatabaseService(stub as unknown as ScryfallClient);

    const card = await service.getCardByFuzzyName('lighming bolt');
    const exact = await service.getCardByExactName('Lightning Bolt');

    expect(card.name).toBe('Lightning Bolt');
    expect(exact).toBe(card);
    expect(stub.getCardByExactName).not.toHaveBeenCalled();
  });

  it('maps search results and reports pagination', async () => {
    const stub = makeClientStub();
    const list: ScryfallList = {
      object: 'list',
      total_cards: 2,
      has_more: false,
      data: [LIGHTNING_BOLT, DELVER_OF_SECRETS],
    };
    stub.searchCards.mockResolvedValue(list);
    const service = new CardDatabaseService(stub as unknown as ScryfallClient);

    const result = await service.searchCards('c:r cmc=1');

    expect(result.cards).toHaveLength(2);
    expect(result.hasMore).toBe(false);
    expect(result.totalCards).toBe(2);

    // Search results populate the card caches too.
    const cached = await service.getCardById(DELVER_OF_SECRETS.id);
    expect(cached.name).toBe('Delver of Secrets // Insectile Aberration');
    expect(stub.getCardById).not.toHaveBeenCalled();
  });
});
