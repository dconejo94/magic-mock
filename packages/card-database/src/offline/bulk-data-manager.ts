import { createWriteStream } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { CardDatabaseError } from '../errors.js';
import type { ScryfallClient } from '../scryfall/client.js';
import { loadBulkCardFile, type LoadBulkFileOptions } from './bulk-loader.js';
import { OfflineCardIndex, type OfflineCardIndexOptions } from './offline-card-index.js';

export interface BulkDataManagerOptions {
  /** Directory for the downloaded bulk file and its metadata. */
  readonly dataDir: string;
  /** Bulk export to use. Default "oracle_cards" (one entry per oracle card). */
  readonly bulkType?: string;
  /** Injectable fetch for the (large) bulk file download. */
  readonly fetchFn?: typeof fetch;
  readonly loadOptions?: LoadBulkFileOptions;
  readonly indexOptions?: OfflineCardIndexOptions;
}

interface StoredMeta {
  readonly updatedAt: string;
  readonly downloadUri: string;
}

export interface EnsureIndexResult {
  readonly index: OfflineCardIndex;
  /** True if a fresh bulk file was downloaded, false if the local copy was current. */
  readonly downloaded: boolean;
  /** Scryfall's updated_at timestamp for the data in use. */
  readonly updatedAt: string;
}

/**
 * Keeps a local copy of a Scryfall bulk-data export and builds an
 * OfflineCardIndex from it.
 *
 * Freshness follows Scryfall's own signal: the /bulk-data metadata's
 * updated_at (exports refresh daily). The big file is re-downloaded only
 * when that timestamp changes — exactly the "use bulk data, don't crawl"
 * integration Scryfall requires for volume workloads (ADR-0002).
 */
export class BulkDataManager {
  private readonly client: ScryfallClient;
  private readonly options: BulkDataManagerOptions;
  private readonly fetchFn: typeof fetch;

  constructor(client: ScryfallClient, options: BulkDataManagerOptions) {
    this.client = client;
    this.options = options;
    this.fetchFn = options.fetchFn ?? fetch;
  }

  /**
   * Returns an up-to-date offline index, downloading the bulk file only if
   * Scryfall reports newer data than the local copy.
   */
  async ensureIndex(): Promise<EnsureIndexResult> {
    const bulkType = this.options.bulkType ?? 'oracle_cards';
    const remote = await this.client.getBulkDataByType(bulkType);

    await mkdir(this.options.dataDir, { recursive: true });
    const dataPath = join(this.options.dataDir, `${bulkType}.json`);
    const metaPath = join(this.options.dataDir, `${bulkType}.meta.json`);

    const localMeta = await this.readMeta(metaPath);
    const isCurrent = localMeta?.updatedAt === remote.updated_at;

    if (!isCurrent) {
      await this.download(remote.download_uri, dataPath);
      const meta: StoredMeta = { updatedAt: remote.updated_at, downloadUri: remote.download_uri };
      await writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf8');
    }

    const cards = await loadBulkCardFile(dataPath, this.options.loadOptions);
    return {
      index: new OfflineCardIndex(cards, this.options.indexOptions),
      downloaded: !isCurrent,
      updatedAt: remote.updated_at,
    };
  }

  private async readMeta(metaPath: string): Promise<StoredMeta | undefined> {
    try {
      return JSON.parse(await readFile(metaPath, 'utf8')) as StoredMeta;
    } catch {
      return undefined;
    }
  }

  /** Streams the bulk file to disk (write to a temp name, then rename). */
  private async download(uri: string, destination: string): Promise<void> {
    const response = await this.fetchFn(uri, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok || !response.body) {
      throw new CardDatabaseError(
        `Bulk data download failed (HTTP ${String(response.status)}): ${uri}`,
      );
    }
    const partial = `${destination}.partial`;
    await pipeline(Readable.fromWeb(response.body), createWriteStream(partial));
    await rename(partial, destination);
  }
}
