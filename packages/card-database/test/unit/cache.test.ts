import { describe, expect, it } from 'vitest';
import { InMemoryTtlCache } from '../../src/cache/cache.js';

function makeClock(start = 0): { now: () => number; advance: (ms: number) => void } {
  let time = start;
  return {
    now: () => time,
    advance: (ms: number) => {
      time += ms;
    },
  };
}

describe('InMemoryTtlCache', () => {
  it('stores and retrieves values within the TTL', () => {
    const clock = makeClock();
    const cache = new InMemoryTtlCache<string>({ ttlMs: 1000, maxEntries: 10, now: clock.now });

    cache.set('a', 'value');
    clock.advance(999);

    expect(cache.get('a')).toBe('value');
  });

  it('expires entries after the TTL', () => {
    const clock = makeClock();
    const cache = new InMemoryTtlCache<string>({ ttlMs: 1000, maxEntries: 10, now: clock.now });

    cache.set('a', 'value');
    clock.advance(1000);

    expect(cache.get('a')).toBeUndefined();
    expect(cache.size).toBe(0);
  });

  it('evicts the oldest entry when full', () => {
    const cache = new InMemoryTtlCache<string>({ ttlMs: 1000, maxEntries: 2, now: () => 0 });

    cache.set('a', '1');
    cache.set('b', '2');
    cache.set('c', '3');

    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe('2');
    expect(cache.get('c')).toBe('3');
    expect(cache.size).toBe(2);
  });

  it('overwrites an existing key without evicting', () => {
    const cache = new InMemoryTtlCache<string>({ ttlMs: 1000, maxEntries: 2, now: () => 0 });

    cache.set('a', '1');
    cache.set('b', '2');
    cache.set('a', 'updated');

    expect(cache.get('a')).toBe('updated');
    expect(cache.get('b')).toBe('2');
  });

  it('rejects non-positive ttl and maxEntries', () => {
    expect(() => new InMemoryTtlCache({ ttlMs: 0, maxEntries: 1 })).toThrow(RangeError);
    expect(() => new InMemoryTtlCache({ ttlMs: 1, maxEntries: 0 })).toThrow(RangeError);
  });
});
