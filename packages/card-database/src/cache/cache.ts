/**
 * Cache abstraction for card data.
 *
 * Scryfall asks integrators to cache card data locally rather than re-fetch
 * it on demand; this interface lets the service swap the default in-memory
 * cache for Redis or an on-disk store without code changes.
 */
export interface Cache<V> {
  get(key: string): V | undefined;
  set(key: string, value: V): void;
  delete(key: string): void;
  clear(): void;
  readonly size: number;
}

export interface TtlCacheOptions {
  /** Time-to-live per entry in milliseconds. */
  readonly ttlMs: number;
  /** Maximum number of entries; least-recently-inserted are evicted first. */
  readonly maxEntries: number;
  /** Clock, injectable for deterministic tests. Defaults to Date.now. */
  readonly now?: () => number;
}

interface Entry<V> {
  readonly value: V;
  readonly expiresAt: number;
}

/** In-memory TTL cache with bounded size (FIFO eviction on overflow). */
export class InMemoryTtlCache<V> implements Cache<V> {
  private readonly entries = new Map<string, Entry<V>>();
  private readonly ttlMs: number;
  private readonly maxEntries: number;
  private readonly now: () => number;

  constructor(options: TtlCacheOptions) {
    if (options.ttlMs <= 0) {
      throw new RangeError('ttlMs must be positive');
    }
    if (options.maxEntries <= 0) {
      throw new RangeError('maxEntries must be positive');
    }
    this.ttlMs = options.ttlMs;
    this.maxEntries = options.maxEntries;
    this.now = options.now ?? Date.now;
  }

  get(key: string): V | undefined {
    const entry = this.entries.get(key);
    if (!entry) {
      return undefined;
    }
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: V): void {
    if (this.entries.size >= this.maxEntries && !this.entries.has(key)) {
      const oldest = this.entries.keys().next();
      if (!oldest.done) {
        this.entries.delete(oldest.value);
      }
    }
    this.entries.set(key, { value, expiresAt: this.now() + this.ttlMs });
  }

  delete(key: string): void {
    this.entries.delete(key);
  }

  clear(): void {
    this.entries.clear();
  }

  get size(): number {
    return this.entries.size;
  }
}
