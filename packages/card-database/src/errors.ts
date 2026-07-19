/** Base class for all card-database errors. */
export class CardDatabaseError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
  }
}

/** The requested card does not exist (Scryfall 404). */
export class CardNotFoundError extends CardDatabaseError {
  constructor(readonly query: string) {
    super(`Card not found: ${query}`);
  }
}

/** A fuzzy name matched multiple cards equally well; refusing to guess. */
export class AmbiguousCardNameError extends CardDatabaseError {
  constructor(readonly query: string) {
    super(`Card name is ambiguous: ${query}`);
  }
}

/** Scryfall returned an unexpected error response. */
export class ScryfallApiError extends CardDatabaseError {
  constructor(
    readonly status: number,
    readonly details: string,
  ) {
    super(`Scryfall API error (HTTP ${String(status)}): ${details}`);
  }
}
