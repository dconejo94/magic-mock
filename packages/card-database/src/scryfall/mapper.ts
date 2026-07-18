import type { Card, CardFace, CardImageUris, Color, Legality } from '../domain/card.js';
import type { ScryfallCard, ScryfallCardFace, ScryfallImageUris } from './types.js';

const COLORS: ReadonlySet<string> = new Set(['W', 'U', 'B', 'R', 'G']);
const LEGALITIES: ReadonlySet<string> = new Set(['legal', 'not_legal', 'restricted', 'banned']);

function toColors(values: readonly string[] | undefined): readonly Color[] {
  return (values ?? []).filter((v): v is Color => COLORS.has(v));
}

function toImageUris(uris: ScryfallImageUris | undefined): CardImageUris | undefined {
  if (!uris) {
    return undefined;
  }
  const mapped: CardImageUris = {
    ...(uris.small !== undefined && { small: uris.small }),
    ...(uris.normal !== undefined && { normal: uris.normal }),
    ...(uris.large !== undefined && { large: uris.large }),
    ...(uris.png !== undefined && { png: uris.png }),
    ...(uris.art_crop !== undefined && { artCrop: uris.art_crop }),
    ...(uris.border_crop !== undefined && { borderCrop: uris.border_crop }),
  };
  return mapped;
}

function toFace(face: ScryfallCardFace): CardFace {
  const imageUris = toImageUris(face.image_uris);
  return {
    name: face.name,
    manaCost: face.mana_cost ?? '',
    typeLine: face.type_line ?? '',
    oracleText: face.oracle_text ?? '',
    colors: toColors(face.colors),
    ...(face.power !== undefined && { power: face.power }),
    ...(face.toughness !== undefined && { toughness: face.toughness }),
    ...(face.loyalty !== undefined && { loyalty: face.loyalty }),
    ...(face.defense !== undefined && { defense: face.defense }),
    ...(imageUris !== undefined && { imageUris }),
  };
}

function toLegalities(wire: Readonly<Record<string, string>>): Record<string, Legality> {
  const result: Record<string, Legality> = {};
  for (const [format, value] of Object.entries(wire)) {
    if (LEGALITIES.has(value)) {
      result[format] = value as Legality;
    }
  }
  return result;
}

/**
 * Maps a Scryfall card to the platform's domain model.
 *
 * Single-faced cards are normalized to a one-element `faces` array so
 * consumers never branch on layout to read oracle text or stats.
 */
export function mapScryfallCard(wire: ScryfallCard): Card {
  const faces: CardFace[] =
    wire.card_faces !== undefined && wire.card_faces.length > 0
      ? wire.card_faces.map(toFace)
      : [
          toFace({
            name: wire.name,
            ...(wire.mana_cost !== undefined && { mana_cost: wire.mana_cost }),
            ...(wire.type_line !== undefined && { type_line: wire.type_line }),
            ...(wire.oracle_text !== undefined && { oracle_text: wire.oracle_text }),
            ...(wire.colors !== undefined && { colors: wire.colors }),
            ...(wire.power !== undefined && { power: wire.power }),
            ...(wire.toughness !== undefined && { toughness: wire.toughness }),
            ...(wire.loyalty !== undefined && { loyalty: wire.loyalty }),
            ...(wire.defense !== undefined && { defense: wire.defense }),
            ...(wire.image_uris !== undefined && { image_uris: wire.image_uris }),
          }),
        ];

  const imageUris = toImageUris(wire.image_uris);
  return {
    id: wire.id,
    oracleId: wire.oracle_id ?? wire.id,
    name: wire.name,
    manaValue: wire.cmc ?? 0,
    typeLine: wire.type_line ?? '',
    colorIdentity: toColors(wire.color_identity),
    layout: wire.layout,
    faces,
    legalities: toLegalities(wire.legalities),
    setCode: wire.set,
    collectorNumber: wire.collector_number,
    ...(imageUris !== undefined && { imageUris }),
  };
}
