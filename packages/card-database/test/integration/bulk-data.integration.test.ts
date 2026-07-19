import { createServer, type Server } from 'node:http';
import { mkdtemp } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BulkDataManager } from '../../src/offline/bulk-data-manager.js';
import { ScryfallClient } from '../../src/scryfall/client.js';
import { DELVER_OF_SECRETS, LIGHTNING_BOLT } from '../fixtures/cards.js';

/**
 * End-to-end: /bulk-data metadata → streamed file download → load → index →
 * resolution, against a local server speaking Scryfall's wire protocol.
 */
describe('BulkDataManager against a Scryfall-shaped HTTP server', () => {
  let server: Server;
  let baseUrl: string;
  let bulkDownloads = 0;
  let updatedAt = '2026-07-18T09:00:00.000+00:00';

  beforeAll(async () => {
    server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const respond = (status: number, body: unknown): void => {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(body));
      };

      if (url.pathname === '/bulk-data/oracle_cards') {
        respond(200, {
          object: 'bulk_data',
          id: 'bulk-1',
          type: 'oracle_cards',
          updated_at: updatedAt,
          name: 'Oracle Cards',
          description: 'test',
          size: 123,
          download_uri: `${baseUrl}/files/oracle-cards.json`,
          content_type: 'application/json',
          content_encoding: 'gzip',
        });
        return;
      }
      if (url.pathname === '/files/oracle-cards.json') {
        bulkDownloads += 1;
        respond(200, [
          LIGHTNING_BOLT,
          DELVER_OF_SECRETS,
          { ...LIGHTNING_BOLT, id: 'token-1', layout: 'token' },
        ]);
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

  it('downloads, indexes, and then reuses the local copy until data changes', async () => {
    const dataDir = await mkdtemp(join(tmpdir(), 'bulk-int-'));
    const client = new ScryfallClient({
      baseUrl,
      userAgent: 'magic-mock-integration-test/1.0',
      minRequestIntervalMs: 1,
    });
    const manager = new BulkDataManager(client, { dataDir });

    // First run: downloads and builds the index (token filtered out).
    const first = await manager.ensureIndex();
    expect(first.downloaded).toBe(true);
    expect(first.index.size).toBe(2);
    expect(bulkDownloads).toBe(1);

    await expect(first.index.getCardByFuzzyName('lightnign bolt')).resolves.toMatchObject({
      name: 'Lightning Bolt',
    });

    // Second run, same updated_at: no re-download.
    const second = await manager.ensureIndex();
    expect(second.downloaded).toBe(false);
    expect(bulkDownloads).toBe(1);
    expect(second.index.size).toBe(2);

    // Scryfall publishes fresh data: re-download happens.
    updatedAt = '2026-07-19T09:00:00.000+00:00';
    const third = await manager.ensureIndex();
    expect(third.downloaded).toBe(true);
    expect(third.updatedAt).toBe(updatedAt);
    expect(bulkDownloads).toBe(2);
  });
});
