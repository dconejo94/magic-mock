# CLAUDE.md — Authoritative Development Guide

This document governs every development session (human or AI) in this repository.
When in doubt, this file and the ADRs in `docs/adr/` win.

## Project goal

A production-quality platform for playing Magic: The Gathering with **physical
cards** and a synchronized **digital game state**: cameras detect played cards, the
rules engine enforces the Comprehensive Rules, all players (and spectators) stay in
sync, and AI opponents are supported. Architecture must support future clients
(web, desktop, mobile, VR).

## Non-negotiable principles

1. **Never reinvent existing solutions.** XMage is the rules engine (ADR-0001);
   Scryfall is the card data source (ADR-0002). Before building anything
   substantial, check for a mature open-source solution first.
2. **Only the rules engine mutates game state** (ADR-0004). LLMs and the vision
   pipeline _propose_ actions; the engine validates every one. No bypass exists.
3. **The rules engine is deterministic.** The ordered action log is the sync,
   replay, and audit primitive.
4. **Vision contains no game logic.** Card detection is replaceable without
   touching anything else. Uncertain detections degrade to user confirmation.
5. **Scryfall is data, never logic.**
6. **Modules are decoupled.** Domain types at boundaries; no wire formats or
   third-party types leaking across (see `card-database` for the pattern).

## Architecture

Read `docs/architecture.md` first, then the ADRs. Languages (ADR-0003):
TypeScript for services/clients (`packages/*`), JVM for the XMage engine service,
Python for the vision service (`services/*` when they land).

## Feature development process — one feature at a time

Never work on multiple features simultaneously. For every feature:

1. Analyze requirements.
2. Design (update/add an ADR if architecturally significant).
3. Identify architectural implications.
4. Implement.
5. Write unit tests.
6. Write integration tests.
7. Run all tests.
8. Run linters, formatters, static analysis (`npm run verify` covers all gates).
9. Manually verify (a reproducible command; record it in the PR/commit).
10. Write a short technical summary.
11. Commit.
12. Only then start the next feature.

No partially completed work. No unfinished TODOs. No skipping validation.

## Definition of Done

A feature is done when: implemented; unit + integration tested; `npm run verify`
passes; manually verified with a reproducible command; documented (README/ADR as
appropriate); committed with a conventional message. Anything less is not done.

## Quality gates

- `npm run verify` = build + typecheck + lint + format check + unit tests +
  integration tests. It must pass before every push (enforced by `.githooks/pre-push`;
  hooks activate via `npm install` → `prepare` → `core.hooksPath`).
- TypeScript is strict (see `tsconfig.base.json`); ESLint runs `strictTypeChecked`.
  Do not weaken compiler or lint options; fix the code instead.
- New non-TS services must arrive with equivalent gates (JVM: Spotless +
  Checkstyle/Detekt + JUnit; Python: Ruff + mypy + pytest) wired into `verify` and CI.
- CI (`.github/workflows/ci.yml`) runs the same gates on every PR; merging with a
  red check is forbidden.

## Testing requirements

- **Unit tests**: fast, deterministic, no I/O. Inject clocks, fetch, and sleep
  (see `ScryfallClient` options) — never sleep or hit the network in unit tests.
- **Integration tests**: real component composition against local, hermetic test
  doubles (see `test/integration/` in `card-database`: a real HTTP server speaking
  the provider's wire format). No external network in CI.
- **Live smoke tests**: opt-in only, env-gated (e.g. `SCRYFALL_LIVE=1`), never in CI.
- Every bug fix adds a regression test.

## Git workflow (GitHub Flow)

- `main` is always deployable; feature branches off `main`.
- **Branch naming** mirrors Conventional Commit types:
  `feat/<short-kebab-description>`, `fix/…`, `docs/…`, `chore/…`,
  `refactor/…` (e.g. `feat/engine-adapter-api`). One branch per feature.
- **Conventional Commits**: `feat(scope): …`, `fix: …`, `docs: …`, `chore: …`,
  `test: …`, `refactor: …`. Small, focused commits.
- Open a PR; CI must be green; squash-merge; delete the branch.

## Repository conventions

- `packages/<name>` = TypeScript workspace `@magic-mock/<name>`; `src/` for code,
  `test/{unit,integration,live,fixtures}` for tests; public API through
  `src/index.ts` only.
- Errors: typed error classes extending a module base error (see `errors.ts`).
- Immutable domain models (`readonly`), composition over inheritance, dependency
  injection via constructor options with sane defaults.
- External I/O clients take a `baseUrl` override so integration tests can point
  them at local doubles.

## Rules for AI assistants

- Follow this file and the ADRs; do not silently contradict an accepted ADR —
  propose a new ADR to supersede it.
- Complete the full feature pipeline before starting anything else; leave the tree
  green.
- Never commit secrets; never call live external APIs from tests without the
  env-var gate; respect Scryfall's rate/User-Agent/caching rules (ADR-0002).
- Do not add dependencies casually — prefer the standard library; justify each new
  dependency in the commit message.

## Project constraints

- Scryfall Fan Content / API policy: mandatory `User-Agent`, request pacing,
  ≥24 h caching, bulk data for volume workloads, artist attribution for art crops,
  no paywalling card data (ADR-0002).
- XMage is MIT; keep license headers/attribution intact when the engine service
  lands. Forge is GPL-3.0 — do not link Forge code into the platform.
- Wizards of the Coast Fan Content Policy applies to the product as a whole.

## Long-term roadmap

1. ✅ Card Database Service (Scryfall client, cache, domain model)
2. ✅ Scryfall bulk-data import + offline card index (prereq for vision at scale)
3. Engine Service: JVM wrapper embedding XMage; Engine Adapter API
   (create game / legal actions / propose action / state views / action log)
4. Match Service + Networking Gateway (WebSocket, action-log fan-out, reconnect)
5. Web client (play a full digital game vs a human)
6. AI Adapter (provider abstraction; legal-action selection agents; fallback chain)
7. Vision Service (detection, recognition via card index, calibration,
   confidence-gated proposals)
8. Physical-card loop end-to-end (camera → proposal → validation → sync)
9. Spectators, replays (from action logs), deck manager with legality checks
10. Persistence, auth, matchmaking, ranked play, horizontal scaling
