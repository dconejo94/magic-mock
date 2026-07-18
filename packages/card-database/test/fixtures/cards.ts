import type { ScryfallCard } from '../../src/scryfall/types.js';

/** Realistic Scryfall payload subset for a plain creature. */
export const LIGHTNING_BOLT: ScryfallCard = {
  object: 'card',
  id: 'ce711943-c1a1-43a0-8b89-8d169cfb8e06',
  oracle_id: '4457ed35-7c10-48c8-9776-456485fdf070',
  name: 'Lightning Bolt',
  layout: 'normal',
  cmc: 1,
  type_line: 'Instant',
  mana_cost: '{R}',
  oracle_text: 'Lightning Bolt deals 3 damage to any target.',
  colors: ['R'],
  color_identity: ['R'],
  legalities: {
    standard: 'not_legal',
    modern: 'legal',
    legacy: 'legal',
    vintage: 'legal',
    commander: 'legal',
  },
  set: 'lea',
  collector_number: '161',
  image_uris: {
    small: 'https://cards.scryfall.io/small/bolt.jpg',
    normal: 'https://cards.scryfall.io/normal/bolt.jpg',
    large: 'https://cards.scryfall.io/large/bolt.jpg',
    art_crop: 'https://cards.scryfall.io/art_crop/bolt.jpg',
  },
};

/** Transform double-faced card: no top-level image_uris or mana_cost. */
export const DELVER_OF_SECRETS: ScryfallCard = {
  object: 'card',
  id: '11bf83bb-c95b-4b4f-9a56-ce7a1816307a',
  oracle_id: '28ea1a26-2e2f-4d53-84ac-8b8d16b26bb0',
  name: 'Delver of Secrets // Insectile Aberration',
  layout: 'transform',
  cmc: 1,
  type_line: 'Creature — Human Wizard // Creature — Human Insect',
  color_identity: ['U'],
  legalities: {
    modern: 'legal',
    legacy: 'legal',
    commander: 'legal',
  },
  set: 'isd',
  collector_number: '51',
  card_faces: [
    {
      name: 'Delver of Secrets',
      mana_cost: '{U}',
      type_line: 'Creature — Human Wizard',
      oracle_text:
        'At the beginning of your upkeep, look at the top card of your library. You may reveal that card. If an instant or sorcery card is revealed this way, transform Delver of Secrets.',
      colors: ['U'],
      power: '1',
      toughness: '1',
      image_uris: { normal: 'https://cards.scryfall.io/normal/delver-front.jpg' },
    },
    {
      name: 'Insectile Aberration',
      mana_cost: '',
      type_line: 'Creature — Human Insect',
      oracle_text: 'Flying',
      colors: ['U'],
      power: '3',
      toughness: '2',
      image_uris: { normal: 'https://cards.scryfall.io/normal/delver-back.jpg' },
    },
  ],
};
