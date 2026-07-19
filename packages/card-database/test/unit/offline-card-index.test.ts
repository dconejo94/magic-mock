import { describe, expect, it } from 'vitest';
import { AmbiguousCardNameError, CardNotFoundError } from '../../src/errors.js';
import { OfflineCardIndex } from '../../src/offline/offline-card-index.js';
import { mapScryfallCard } from '../../src/scryfall/mapper.js';
import type { ScryfallCard } from '../../src/scryfall/types.js';
import { DELVER_OF_SECRETS, LIGHTNING_BOLT } from '../fixtures/cards.js';

const COUNTERSPELL: ScryfallCard = {
  object: 'card',
  id: '11111111-1111-1111-1111-111111111111',
  oracle_id: '22222222-2222-2222-2222-222222222222',
  name: 'Counterspell',
  layout: 'normal',
  cmc: 2,
  type_line: 'Instant',
  mana_cost: '{U}{U}',
  oracle_text: 'Counter target spell.',
  colors: ['U'],
  color_identity: ['U'],
  legalities: { legacy: 'legal' },
  set: 'lea',
  collector_number: '54',
};

function makeIndex(extra: readonly ScryfallCard[] = []): OfflineCardIndex {
  return new OfflineCardIndex(
    [LIGHTNING_BOLT, DELVER_OF_SECRETS, COUNTERSPELL, ...extra].map(mapScryfallCard),
  );
}

describe('OfflineCardIndex', () => {
  it('resolves exact names case-insensitively', async () => {
    const index = makeIndex();

    const card = await index.getCardByExactName('LIGHTNING BOLT');

    expect(card.name).toBe('Lightning Bolt');
    expect(index.size).toBe(3);
  });

  it('resolves by print id and oracle id', async () => {
    const index = makeIndex();

    const byId = await index.getCardById(LIGHTNING_BOLT.id);
    const byOracle = index.getCardByOracleId(LIGHTNING_BOLT.oracle_id ?? '');

    expect(byId.name).toBe('Lightning Bolt');
    expect(byOracle?.name).toBe('Lightning Bolt');
  });

  it('resolves individual faces of a multi-face card', async () => {
    const index = makeIndex();

    const card = await index.getCardByExactName('Insectile Aberration');

    expect(card.name).toBe('Delver of Secrets // Insectile Aberration');
  });

  it('resolves OCR-style typos via fuzzy lookup', async () => {
    const index = makeIndex();

    await expect(index.getCardByFuzzyName('Lighming Bolt')).resolves.toMatchObject({
      name: 'Lightning Bolt',
    });
    await expect(index.getCardByFuzzyName('countersppell')).resolves.toMatchObject({
      name: 'Counterspell',
    });
  });

  it('rejects fuzzy queries beyond the edit-distance budget', async () => {
    const index = makeIndex();

    await expect(index.getCardByFuzzyName('zzzzzzzzzz')).rejects.toThrow(CardNotFoundError);
    await expect(index.getCardByFuzzyName('')).rejects.toThrow(CardNotFoundError);
  });

  it('refuses to guess between equally close fuzzy candidates', async () => {
    const near1: ScryfallCard = { ...COUNTERSPELL, id: 'a1', oracle_id: 'o1', name: 'Farm' };
    const near2: ScryfallCard = { ...COUNTERSPELL, id: 'a2', oracle_id: 'o2', name: 'Form' };
    const index = makeIndex([near1, near2]);

    await expect(index.getCardByFuzzyName('firm')).rejects.toThrow(AmbiguousCardNameError);
  });

  it('treats exact name collisions across different cards as ambiguous', async () => {
    const clash: ScryfallCard = {
      ...COUNTERSPELL,
      id: 'b1',
      oracle_id: 'different-oracle',
      name: 'Counterspell',
    };
    const index = makeIndex([clash]);

    await expect(index.getCardByExactName('Counterspell')).rejects.toThrow(CardNotFoundError);
  });

  it('does not duplicate oracle cards seen in multiple printings', () => {
    const reprint: ScryfallCard = { ...LIGHTNING_BOLT, id: 'reprint-id', set: 'm10' };
    const index = makeIndex([reprint]);

    expect(index.size).toBe(3);
  });
});
