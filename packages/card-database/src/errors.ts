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

/** Scryfall returned an unexpected error response. */
export class ScryfallApiError extends CardDatabaseError {
  constructor(
    readonly status: number,
    readonly details: string,
  ) {
    super(`Scryfall API error (HTTP ${String(status)}): ${details}`);
  }
}
