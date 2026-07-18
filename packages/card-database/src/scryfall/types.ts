/**
 * Minimal Scryfall wire-format types — only the fields this service consumes.
 * See https://scryfall.com/docs/api/cards for the full schema.
 */

export interface ScryfallImageUris {
  readonly small?: string;
  readonly normal?: string;
  readonly large?: string;
  readonly png?: string;
  readonly art_crop?: string;
  readonly border_crop?: string;
}

export interface ScryfallCardFace {
  readonly name: string;
  readonly mana_cost?: string;
  readonly type_line?: string;
  readonly oracle_text?: string;
  readonly colors?: readonly string[];
  readonly power?: string;
  readonly toughness?: string;
  readonly loyalty?: string;
  readonly defense?: string;
  readonly image_uris?: ScryfallImageUris;
}

export interface ScryfallCard {
  readonly object: 'card';
  readonly id: string;
  readonly oracle_id?: string;
  readonly name: string;
  readonly layout: string;
  readonly cmc?: number;
  readonly type_line?: string;
  readonly mana_cost?: string;
  readonly oracle_text?: string;
  readonly colors?: readonly string[];
  readonly color_identity: readonly string[];
  readonly power?: string;
  readonly toughness?: string;
  readonly loyalty?: string;
  readonly defense?: string;
  readonly legalities: Readonly<Record<string, string>>;
  readonly set: string;
  readonly collector_number: string;
  readonly image_uris?: ScryfallImageUris;
  readonly card_faces?: readonly ScryfallCardFace[];
}

export interface ScryfallList {
  readonly object: 'list';
  readonly total_cards?: number;
  readonly has_more: boolean;
  readonly next_page?: string;
  readonly data: readonly ScryfallCard[];
}

export type ScryfallBulkDataType =
  'oracle_cards' | 'unique_artwork' | 'default_cards' | 'all_cards' | 'rulings';

export interface ScryfallBulkData {
  readonly object: 'bulk_data';
  readonly id: string;
  /** Usually a ScryfallBulkDataType; Scryfall may add new export types. */
  readonly type: string;
  readonly updated_at: string;
  readonly name: string;
  readonly description: string;
  readonly size: number;
  readonly download_uri: string;
  readonly content_type: string;
  readonly content_encoding: string;
}

export interface ScryfallBulkDataList {
  readonly object: 'list';
  readonly has_more: boolean;
  readonly data: readonly ScryfallBulkData[];
}

export interface ScryfallError {
  readonly object: 'error';
  readonly code: string;
  readonly status: number;
  readonly details: string;
}
