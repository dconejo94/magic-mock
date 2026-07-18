import { describe, expect, it } from 'vitest';
import { CardDatabaseService } from '../../src/service.js';
import { ScryfallClient } from '../../src/scryfall/client.js';

/**
 * Live smoke test against the real Scryfall API. Opt-in only (network,
 * external dependency): run with `npm run test:live -w @magic-mock/card-database`.
 */
describe.runIf(process.env.SCRYFALL_LIVE === '1')('Scryfall live smoke test', () => {
  it('resolves Lightning Bolt from the real API', async () => {
    const service = new CardDatabaseService(new ScryfallClient());

    const card = await service.getCardByExactName('Lightning Bolt');

    expect(card.name).toBe('Lightning Bolt');
    expect(card.faces[0]?.oracleText).toContain('3 damage');
    expect(card.legalities.modern).toBe('legal');
  }, 30_000);
});
