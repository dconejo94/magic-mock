import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { CardDatabaseError } from '../../src/errors.js';
import { loadBulkCardFile } from '../../src/offline/bulk-loader.js';
import { DELVER_OF_SECRETS, LIGHTNING_BOLT } from '../fixtures/cards.js';

describe('loadBulkCardFile', () => {
  let dir: string;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'bulk-loader-test-'));
  });

  it('loads and maps card objects, skipping junk entries', async () => {
    const path = join(dir, 'cards.json');
    await writeFile(
      path,
      JSON.stringify([LIGHTNING_BOLT, { object: 'not_a_card' }, DELVER_OF_SECRETS]),
    );

    const cards = await loadBulkCardFile(path);

    expect(cards.map((c) => c.name)).toEqual([
      'Lightning Bolt',
      'Delver of Secrets // Insectile Aberration',
    ]);
  });

  it('excludes non-gameplay layouts by default but honors a custom filter', async () => {
    const token = { ...LIGHTNING_BOLT, id: 'token-id', layout: 'token' };
    const path = join(dir, 'with-token.json');
    await writeFile(path, JSON.stringify([LIGHTNING_BOLT, token]));

    const defaultCards = await loadBulkCardFile(path);
    const allCards = await loadBulkCardFile(path, { filter: () => true });

    expect(defaultCards).toHaveLength(1);
    expect(allCards).toHaveLength(2);
  });

  it('throws a typed error for a missing file', async () => {
    await expect(loadBulkCardFile(join(dir, 'missing.json'))).rejects.toThrow(CardDatabaseError);
  });

  it('throws a typed error for a non-array payload', async () => {
    const path = join(dir, 'object.json');
    await writeFile(path, JSON.stringify({ object: 'list' }));

    await expect(loadBulkCardFile(path)).rejects.toThrow(CardDatabaseError);
  });
});
