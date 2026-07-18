import { describe, expect, it } from 'vitest';
import { mapScryfallCard } from '../../src/scryfall/mapper.js';
import { DELVER_OF_SECRETS, LIGHTNING_BOLT } from '../fixtures/cards.js';

describe('mapScryfallCard', () => {
  it('maps a single-faced card to a one-element faces array', () => {
    const card = mapScryfallCard(LIGHTNING_BOLT);

    expect(card.id).toBe(LIGHTNING_BOLT.id);
    expect(card.oracleId).toBe(LIGHTNING_BOLT.oracle_id);
    expect(card.name).toBe('Lightning Bolt');
    expect(card.manaValue).toBe(1);
    expect(card.layout).toBe('normal');
    expect(card.faces).toHaveLength(1);
    expect(card.faces[0]?.manaCost).toBe('{R}');
    expect(card.faces[0]?.oracleText).toContain('3 damage');
    expect(card.faces[0]?.colors).toEqual(['R']);
    expect(card.imageUris?.artCrop).toBe('https://cards.scryfall.io/art_crop/bolt.jpg');
  });

  it('maps legalities, filtering unknown values', () => {
    const card = mapScryfallCard({
      ...LIGHTNING_BOLT,
      legalities: { modern: 'legal', weird: 'someday' },
    });

    expect(card.legalities).toEqual({ modern: 'legal' });
  });

  it('maps a transform card with both faces and per-face images', () => {
    const card = mapScryfallCard(DELVER_OF_SECRETS);

    expect(card.faces).toHaveLength(2);
    expect(card.faces[0]?.name).toBe('Delver of Secrets');
    expect(card.faces[0]?.power).toBe('1');
    expect(card.faces[1]?.name).toBe('Insectile Aberration');
    expect(card.faces[1]?.toughness).toBe('2');
    expect(card.faces[1]?.imageUris?.normal).toContain('delver-back');
    expect(card.imageUris).toBeUndefined();
  });

  it('falls back to the print id when oracle_id is absent', () => {
    const rest = { ...LIGHTNING_BOLT };
    delete (rest as { oracle_id?: string }).oracle_id;
    const card = mapScryfallCard(rest);

    expect(card.oracleId).toBe(LIGHTNING_BOLT.id);
  });

  it('filters non-WUBRG color identity values defensively', () => {
    const card = mapScryfallCard({ ...LIGHTNING_BOLT, color_identity: ['R', 'C'] });

    expect(card.colorIdentity).toEqual(['R']);
  });
});
