# ADR-0001: Adopt XMage as the core rules engine

- **Status:** Accepted
- **Date:** 2026-07-18

## Context

The platform requires complete, deterministic enforcement of the Magic: The Gathering
Comprehensive Rules. Implementing the rules from scratch is a multi-year effort
(priority, the stack, the seven-layer system, replacement effects, state-based actions,
~30,000 unique cards). Rule #1 of this project: never reinvent existing solutions.

We investigated every credible open-source engine (web research performed 2026-07-18;
source links at the bottom).

### Candidates

| Project         | License          | Language    | Rules enforcement                                           | Multiplayer server                                        | Cards                               | Activity (2026)                                     |
| --------------- | ---------------- | ----------- | ----------------------------------------------------------- | --------------------------------------------------------- | ----------------------------------- | --------------------------------------------------- |
| **XMage**       | MIT              | Java        | Full                                                        | **Yes — dedicated headless server, server-authoritative** | 31,000+ unique / 91,000+ reprints   | Very active (release 2026-07-11, push daily)        |
| **Forge**       | GPL-3.0          | Java        | Full                                                        | No (desktop-first; headless `sim` mode for AI-vs-AI)      | ~30,300+ unique (>99% of all cards) | Very active (release 2026-06-22, push daily)        |
| Cockatrice      | GPL-2.0          | C++         | **None** — virtual tabletop, players enforce rules manually | Yes (Servatrice)                                          | n/a                                 | Active                                              |
| Magarena        | GPL-3.0          | Java/Groovy | Full for its pool                                           | No — single-player vs AI only                             | ~2,000                              | **Abandoned** (last release 2019, last commit 2023) |
| Spellsource     | GPL-2.0/AGPL-3.0 | Java        | **Not MTG** — Hearthstone-like engine                       | Yes                                                       | n/a                                 | Stalled (2023)                                      |
| Phase           | MIT/Apache-2.0   | Rust        | Claims full CR                                              | Yes (WebSocket)                                           | Claims 34,300+                      | Active but young (~194 stars)                       |
| Argentum Engine | MIT              | Kotlin      | Deterministic rules library                                 | Yes (Spring Boot)                                         | Unverified                          | Active but tiny (~44 stars)                         |

### Key findings

- **Only Forge and XMage are mature, full-coverage engines.** Both are healthy
  (~2.3–2.5k stars, daily pushes, per-set releases, 19 and 16 years of history).
- **XMage is MIT-licensed**; Forge is GPL-3.0 (copyleft obligations on distribution).
- **XMage is the only mature engine with a real client-server architecture**:
  `Mage.Server` is a headless dedicated server holding authoritative game state,
  `Mage` is the engine module, `Mage.Common` the protocol. Its own test framework
  (`Mage.Tests`) runs full games headlessly in-process — proof that in-process
  embedding works.
- **Forge's strengths are its AI and card-scripting DSL** (cards are data files, so
  non-programmers keep coverage near 100%; its heuristic AI can pilot nearly the whole
  pool). But it has no production server, and GPL-3.0 constrains downstream options.
- **Neither ships as a library** (no Maven Central artifacts, no stable public API).
  Adopting either means building the modules and wrapping internals.
- Phase (Rust) and Argentum (Kotlin) are promising but far too young to bet a
  platform on; unverifiable correctness claims, tiny communities.

## Decision

**Adopt XMage as the core rules engine**, embedded behind a platform-owned
**Engine Adapter** (anti-corruption layer):

1. The adapter exposes a stable, versioned, transport-friendly API
   (propose-action / validate / apply / state-view) owned by this project.
2. No XMage type ever crosses the adapter boundary; the rest of the platform depends
   only on our domain model.
3. The adapter is exercised the way `Mage.Tests` does it: engine modules embedded
   in-process in a JVM service, headless.

### Why XMage over Forge

- **Architecture fit:** server-authoritative state and a headless server are exactly
  the platform's topology (physical-card clients are thin views + input devices; the
  server is the source of truth). Forge would require building that server ourselves.
- **License:** MIT permits any future distribution or hosting model without copyleft
  obligations, and mixes cleanly with our MIT/permissive stack.
- **Multiplayer pedigree:** XMage's rules enforcement has been battle-tested by years
  of 24/7 public online play — the closest proxy to our production workload.
- **Rules coverage:** 31,000+ unique cards with full enforcement, updated per set.

### Trade-offs accepted

- **Weaker AI than Forge.** Mitigation: the AI Adapter (ADR-0004) is engine-agnostic —
  LLM-driven agents propose actions validated by the engine; XMage's built-in AI is
  only a fallback. Forge's `sim` mode can still be used offline for AI research
  without linking GPL code into the platform.
- **Cards are Java classes**, so tracking new sets depends on the XMage community
  (which has done so reliably for 15+ years). We track upstream rather than fork hard.
- **Java-serialization socket protocol is dated.** We do not use it: the adapter
  embeds the engine in-process and exposes our own API, so XMage's protocol never
  becomes a platform dependency.
- **No documented seeded-determinism or replay.** The adapter must capture the
  action log (every validated action, in order) as the platform's replay/sync
  primitive, and determinism must be verified with scripted-game tests (XMage's own
  test framework demonstrates deterministic scripted scenarios).

## Consequences

- The platform gains ~31,000 rules-enforced cards on day one of engine integration.
- A JVM service (`engine-service`) enters the architecture; all other modules stay
  polyglot behind transport APIs.
- The Engine Adapter interface is the most important contract in the system; if XMage
  ever becomes unmaintainable, the adapter is the seam where Forge (or Phase, if it
  matures) would be substituted.
- We contribute fixes upstream where practical instead of forking.

## Sources

- XMage: <https://github.com/magefree/mage> (MIT per LICENSE.txt; 31,000+ cards per
  README; release xmage_1.4.60V3, 2026-07-11), architecture review
  <https://delftswa.gitbooks.io/desosa2018/content/xmage/chapter.html>, headless test
  framework <https://github.com/magefree/mage/wiki/Development-testing-tools>
- Forge: <https://github.com/Card-Forge/forge> (GPL-3.0 per LICENSE), card scripting
  <https://github.com/Card-Forge/forge/wiki/Card-scripting-API>, AI notes
  <https://github.com/Card-Forge/forge/wiki/AI>
- Cockatrice: <https://github.com/Cockatrice/Cockatrice> (no rules enforcement)
- Magarena: <https://github.com/magarena/magarena/commits/master> (dormant)
- Spellsource: <https://github.com/hiddenswitch/Spellsource/blob/master/LICENSE.md>
- Phase: <https://github.com/phase-rs/phase>; Argentum:
  <https://github.com/wingedsheep/argentum-engine>
