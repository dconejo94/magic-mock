import { CardNotFoundError, ScryfallApiError } from '../errors.js';
import type {
  ScryfallBulkData,
  ScryfallBulkDataList,
  ScryfallCard,
  ScryfallError,
  ScryfallList,
} from './types.js';

export interface ScryfallClientOptions {
  /** Base URL; override to point at a test double. */
  readonly baseUrl?: string;
  /**
   * Identifies this application to Scryfall, which requires a User-Agent on
   * every request.
   */
  readonly userAgent?: string;
  /**
   * Minimum delay between consecutive requests in milliseconds. Scryfall asks
   * for 50–100 ms between requests; default is conservative.
   */
  readonly minRequestIntervalMs?: number;
  /** Retries on HTTP 429/5xx before giving up. */
  readonly maxRetries?: number;
  /** Injectable fetch for tests. Defaults to global fetch. */
  readonly fetchFn?: typeof fetch;
  /** Injectable sleep for tests. Defaults to setTimeout. */
  readonly sleepFn?: (ms: number) => Promise<void>;
}

const DEFAULT_BASE_URL = 'https://api.scryfall.com';
const DEFAULT_USER_AGENT = 'magic-mock/0.1 (+https://github.com/dconejo94/magic-mock)';
const DEFAULT_MIN_INTERVAL_MS = 100;
const DEFAULT_MAX_RETRIES = 2;

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Thin, rate-limited HTTP client for the Scryfall REST API.
 *
 * Responsibilities: request pacing, required headers, retry on transient
 * failures, and translating HTTP errors into typed domain errors. It performs
 * no caching (see CardDatabaseService) and contains no game logic.
 */
export class ScryfallClient {
  private readonly baseUrl: string;
  private readonly userAgent: string;
  private readonly minIntervalMs: number;
  private readonly maxRetries: number;
  private readonly fetchFn: typeof fetch;
  private readonly sleepFn: (ms: number) => Promise<void>;

  /** Serializes requests so pacing holds across concurrent callers. */
  private queue: Promise<unknown> = Promise.resolve();
  private lastRequestAt = 0;

  constructor(options: ScryfallClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
    this.userAgent = options.userAgent ?? DEFAULT_USER_AGENT;
    this.minIntervalMs = options.minRequestIntervalMs ?? DEFAULT_MIN_INTERVAL_MS;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.fetchFn = options.fetchFn ?? fetch;
    this.sleepFn = options.sleepFn ?? defaultSleep;
  }

  /** GET /cards/named?exact= — exact (case-insensitive) name lookup. */
  async getCardByExactName(name: string): Promise<ScryfallCard> {
    return this.getJson<ScryfallCard>('/cards/named', { exact: name });
  }

  /** GET /cards/named?fuzzy= — tolerant name lookup for OCR/vision output. */
  async getCardByFuzzyName(name: string): Promise<ScryfallCard> {
    return this.getJson<ScryfallCard>('/cards/named', { fuzzy: name });
  }

  /** GET /cards/{id} — lookup by Scryfall print id. */
  async getCardById(id: string): Promise<ScryfallCard> {
    return this.getJson<ScryfallCard>(`/cards/${encodeURIComponent(id)}`);
  }

  /** GET /bulk-data — metadata for Scryfall's daily bulk-data exports. */
  async getBulkDataList(): Promise<ScryfallBulkDataList> {
    return this.getJson<ScryfallBulkDataList>('/bulk-data');
  }

  /** GET /bulk-data/{type} — metadata for one bulk export, e.g. "oracle_cards". */
  async getBulkDataByType(type: string): Promise<ScryfallBulkData> {
    return this.getJson<ScryfallBulkData>(`/bulk-data/${encodeURIComponent(type)}`);
  }

  /** GET /cards/search — full Scryfall search syntax; returns one page. */
  async searchCards(query: string, page = 1): Promise<ScryfallList> {
    return this.getJson<ScryfallList>('/cards/search', {
      q: query,
      page: String(page),
    });
  }

  private async getJson<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(this.baseUrl + path);
    for (const [key, value] of Object.entries(params ?? {})) {
      url.searchParams.set(key, value);
    }

    // Chain onto the queue so concurrent callers are paced sequentially.
    const result = this.queue.then(
      () => this.executeWithRetry<T>(url),
      () => this.executeWithRetry<T>(url),
    );
    this.queue = result.catch(() => undefined);
    return result;
  }

  private async executeWithRetry<T>(url: URL): Promise<T> {
    let attempt = 0;
    for (;;) {
      await this.pace();
      const response = await this.fetchFn(url, {
        headers: {
          'User-Agent': this.userAgent,
          Accept: 'application/json',
        },
      });

      if (response.ok) {
        return (await response.json()) as T;
      }

      const retryable = response.status === 429 || response.status >= 500;
      if (retryable && attempt < this.maxRetries) {
        attempt += 1;
        await this.sleepFn(this.minIntervalMs * 2 ** attempt);
        continue;
      }

      throw await this.toError(url, response);
    }
  }

  private async pace(): Promise<void> {
    const elapsed = Date.now() - this.lastRequestAt;
    if (elapsed < this.minIntervalMs) {
      await this.sleepFn(this.minIntervalMs - elapsed);
    }
    this.lastRequestAt = Date.now();
  }

  private async toError(url: URL, response: Response): Promise<Error> {
    let details = response.statusText;
    try {
      const body = (await response.json()) as Partial<ScryfallError>;
      if (typeof body.details === 'string') {
        details = body.details;
      }
    } catch {
      // Non-JSON error body; fall back to the status text.
    }
    if (response.status === 404) {
      return new CardNotFoundError(url.pathname + url.search);
    }
    return new ScryfallApiError(response.status, details);
  }
}
