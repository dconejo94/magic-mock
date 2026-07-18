# ADR-0002: Scryfall as the exclusive card data source

- **Status:** Accepted
- **Date:** 2026-07-18

## Context

The platform needs card metadata: names, Oracle text, mana costs, types, legalities,
and images — for the UI, deck manager, and (critically) the vision service, which must
resolve noisy OCR output to real cards. This is reference data only; rules semantics
live in the rules engine (ADR-0001).

Scryfall is the de-facto standard card database: free, no API key, comprehensive,
updated within hours of set releases, and explicitly licensed for fan projects under
the WotC Fan Content Policy.

## Decision

Use **Scryfall exclusively** for card metadata, Oracle text, images, and legality
data, wrapped in a dedicated `card-database` module. Scryfall is **never** consulted
for game logic or rules enforcement.

Integration rules (from Scryfall's API documentation):

1. **Required headers:** every request sends an accurate `User-Agent` identifying
   this application, plus `Accept: application/json`.
2. **Rate limiting:** client-side pacing of 50–100 ms between requests (~10 req/s
   ceiling; heavy endpoints are throttled lower by Scryfall). HTTP 429 triggers
   backoff-and-retry, never a hammering loop.
3. **Caching is mandatory:** card data is cached for at least 24 hours. The cache is
   an injectable interface so in-memory can be swapped for Redis/disk.
4. **Bulk data for volume:** any workload needing many cards (vision index, deck
   import, offline play) must use Scryfall's daily bulk-data files, not API crawling.
   (Planned as a follow-up feature; the interface accommodates it.)
5. **Image policy:** `art_crop` images require artist + copyright attribution in the
   same interface; card data must never be paywalled.

## Consequences

- The `card-database` module is the single choke point for Scryfall coupling; its
  public API exposes only platform domain types (`Card`, `CardFace`, …), so a future
  provider change (or bulk-data mode) cannot ripple outward.
- The fuzzy-name endpoint gives the vision service a robust resolver for OCR noise.
- An offline/bulk index is required before production (vision matching cannot afford
  a network round-trip per detection); tracked as a roadmap feature.
