import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CardDatabaseService } from '../../src/service.js';
import { CardNotFoundError } from '../../src/errors.js';
import { ScryfallClient } from '../../src/scryfall/client.js';
import { DELVER_OF_SECRETS, LIGHTNING_BOLT } from '../fixtures/cards.js';

/**
 * End-to-end test of client + mapper + cache + service against a real HTTP
 * server that speaks the Scryfall wire protocol (fixtures, local, hermetic).
 */
describe('CardDatabaseService against a Scryfall-shaped HTTP server', () => {
  let server: Server;
  let baseUrl: string;
  let requestCount = 0;
  let lastUserAgent: string | undefined;

  beforeAll(async () => {
    server = createServer((req, res) => {
      requestCount += 1;
      lastUserAgent = req.headers['user-agent'];
      const url = new URL(req.url ?? '/', 'http://localhost');

      const respond = (status: number, body: unknown): void => {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(body));
      };

      if (url.pathname === '/cards/named') {
        const exact = url.searchParams.get('exact')?.toLowerCase();
        const fuzzy = url.searchParams.get('fuzzy')?.toLowerCase();
        if (exact === 'lightning bolt' || fuzzy?.startsWith('light')) {
          respond(200, LIGHTNING_BOLT);
          return;
        }
        respond(404, { object: 'error', code: 'not_found', status: 404, details: 'not found' });
        return;
      }
      if (url.pathname === `/cards/${DELVER_OF_SECRETS.id}`) {
        respond(200, DELVER_OF_SECRETS);
        return;
      }
      if (url.pathname === '/cards/search') {
        respond(200, {
          object: 'list',
          total_cards: 2,
          has_more: false,
          data: [LIGHTNING_BOLT, DELVER_OF_SECRETS],
        });
        return;
      }
      respond(404, { object: 'error', code: 'not_found', status: 404, details: 'no route' });
    });

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', resolve);
    });
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${String(address.port)}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  });

  function makeService(): CardDatabaseService {
    const client = new ScryfallClient({
      baseUrl,
      userAgent: 'magic-mock-integration-test/1.0',
      minRequestIntervalMs: 1,
    });
    return new CardDatabaseService(client);
  }

  it('resolves, maps, and caches a card end-to-end over HTTP', async () => {
    const service = makeService();
    const before = requestCount;

    const card = await service.getCardByExactName('Lightning Bolt');
    expect(card.name).toBe('Lightning Bolt');
    expect(card.faces[0]?.oracleText).toContain('3 damage');
    expect(lastUserAgent).toBe('magic-mock-integration-test/1.0');

    await service.getCardByExactName('Lightning Bolt');
    expect(requestCount - before).toBe(1);
  });

  it('resolves a transform card by id with both faces intact', async () => {
    const service = makeService();

    const card = await service.getCardById(DELVER_OF_SECRETS.id);

    expect(card.layout).toBe('transform');
    expect(card.faces).toHaveLength(2);
    expect(card.faces[1]?.name).toBe('Insectile Aberration');
  });

  it('surfaces unknown cards as CardNotFoundError', async () => {
    const service = makeService();

    await expect(service.getCardByExactName('Zzzz Not Real')).rejects.toThrow(CardNotFoundError);
  });

  it('searches and returns mapped domain cards', async () => {
    const service = makeService();

    const result = await service.searchCards('cmc=1');

    expect(result.totalCards).toBe(2);
    expect(result.cards.map((c) => c.layout)).toEqual(['normal', 'transform']);
  });
});
