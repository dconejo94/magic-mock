/**
 * Domain model for a Magic card as the platform understands it.
 *
 * This model is intentionally decoupled from Scryfall's wire format: the rest
 * of the system (rules engine adapter, vision service, clients) depends only
 * on these types, so the data provider can evolve or be swapped without
 * rippling through the codebase.
 */

/** Scryfall print identifier (UUID). Identifies a specific printing. */
export type CardPrintId = string;

/** Oracle identifier (UUID). Identifies the abstract card across printings. */
export type OracleId = string;

export type Legality = 'legal' | 'not_legal' | 'restricted' | 'banned';

export type Color = 'W' | 'U' | 'B' | 'R' | 'G';

export interface CardImageUris {
  readonly small?: string;
  readonly normal?: string;
  readonly large?: string;
  readonly png?: string;
  readonly artCrop?: string;
  readonly borderCrop?: string;
}

/** One face of a card (single-faced cards have exactly one). */
export interface CardFace {
  readonly name: string;
  readonly manaCost: string;
  readonly typeLine: string;
  readonly oracleText: string;
  readonly colors: readonly Color[];
  readonly power?: string;
  readonly toughness?: string;
  readonly loyalty?: string;
  readonly defense?: string;
  readonly imageUris?: CardImageUris;
}

export interface Card {
  /** Identifier of this specific printing. */
  readonly id: CardPrintId;
  /** Identifier of the abstract card (stable across printings). */
  readonly oracleId: OracleId;
  readonly name: string;
  readonly manaValue: number;
  readonly typeLine: string;
  readonly colorIdentity: readonly Color[];
  /** Card layout, e.g. "normal", "transform", "modal_dfc", "split". */
  readonly layout: string;
  readonly faces: readonly CardFace[];
  /** Format name → legality, e.g. { commander: "legal" }. */
  readonly legalities: Readonly<Record<string, Legality>>;
  readonly setCode: string;
  readonly collectorNumber: string;
  /** Image URIs for the card as a whole (absent for some multi-face layouts). */
  readonly imageUris?: CardImageUris;
}
