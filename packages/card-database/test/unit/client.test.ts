import { describe, expect, it, vi } from 'vitest';
import { CardNotFoundError, ScryfallApiError } from '../../src/errors.js';
import { ScryfallClient } from '../../src/scryfall/client.js';
import { LIGHTNING_BOLT } from '../fixtures/cards.js';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeClient(
  fetchFn: typeof fetch,
  overrides: Partial<ConstructorParameters<typeof ScryfallClient>[0] & object> = {},
) {
  const sleeps: number[] = [];
  const client = new ScryfallClient({
    baseUrl: 'https://scryfall.test',
    fetchFn,
    sleepFn: (ms) => {
      sleeps.push(ms);
      return Promise.resolve();
    },
    ...overrides,
  });
  return { client, sleeps };
}

describe('ScryfallClient', () => {
  it('sends User-Agent and Accept headers on every request', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(LIGHTNING_BOLT));
    const { client } = makeClient(fetchFn as typeof fetch, { userAgent: 'test-agent/1.0' });

    await client.getCardByExactName('Lightning Bolt');

    const [url, init] = fetchFn.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe('https://scryfall.test/cards/named?exact=Lightning+Bolt');
    expect(new Headers(init.headers).get('User-Agent')).toBe('test-agent/1.0');
    expect(new Headers(init.headers).get('Accept')).toBe('application/json');
  });

  it('paces consecutive requests by the minimum interval', async () => {
    const fetchFn = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(LIGHTNING_BOLT)));
    const { client, sleeps } = makeClient(fetchFn as typeof fetch, {
      minRequestIntervalMs: 100,
    });

    await client.getCardById('a');
    await client.getCardById('b');

    // Second request must have waited (fetch resolves immediately, so the
    // elapsed wall time is < 100 ms and a pacing sleep is required).
    expect(sleeps.length).toBeGreaterThanOrEqual(1);
    expect(Math.max(...sleeps)).toBeLessThanOrEqual(100);
  });

  it('retries on 429 and then succeeds', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ object: 'error', code: 'rate', status: 429, details: 'slow down' }, 429),
      )
      .mockResolvedValueOnce(jsonResponse(LIGHTNING_BOLT));
    const { client } = makeClient(fetchFn as typeof fetch);

    const card = await client.getCardByExactName('Lightning Bolt');

    expect(card.name).toBe('Lightning Bolt');
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('gives up after maxRetries and throws a typed error', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ object: 'error', code: 'boom', status: 500, details: 'server error' }, 500),
      );
    const { client } = makeClient(fetchFn as typeof fetch, { maxRetries: 1 });

    await expect(client.getCardById('x')).rejects.toThrow(ScryfallApiError);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('translates 404 into CardNotFoundError without retrying', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ object: 'error', code: 'not_found', status: 404, details: 'no card' }, 404),
      );
    const { client } = makeClient(fetchFn as typeof fetch);

    await expect(client.getCardByExactName('Not A Card')).rejects.toThrow(CardNotFoundError);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('keeps serving requests after a failure (queue does not poison)', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ object: 'error', code: 'not_found', status: 404, details: 'no' }, 404),
      )
      .mockResolvedValueOnce(jsonResponse(LIGHTNING_BOLT));
    const { client } = makeClient(fetchFn as typeof fetch);

    await expect(client.getCardByExactName('bad')).rejects.toThrow(CardNotFoundError);
    const card = await client.getCardByExactName('Lightning Bolt');

    expect(card.name).toBe('Lightning Bolt');
  });
});
