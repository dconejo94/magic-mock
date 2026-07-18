# Magic Mock

Play Magic: The Gathering with **physical cards** while the platform maintains a
synchronized, rules-enforced **digital game state** — via camera-based card
recognition, a deterministic rules engine, and optional AI opponents.

> Status: early development. Current focus: platform foundations.
> See the [roadmap in CLAUDE.md](CLAUDE.md#long-term-roadmap).

## How it works

1. Each player points a camera at their play area; the **vision service** detects
   and recognizes the physical cards they play.
2. Detections become **action proposals**. The **rules engine**
   ([XMage](https://github.com/magefree/mage), embedded behind a platform-owned
   adapter) validates every proposal — nothing mutates game state except the engine.
3. Validated actions append to an ordered **action log**, which synchronizes all
   clients, powers spectating, and doubles as the replay format.
4. **AI opponents** (Claude, OpenAI, Gemini, or local models) pick among
   engine-supplied legal actions — they can never break the rules by construction.

Read [`docs/architecture.md`](docs/architecture.md) and the ADRs in
[`docs/adr/`](docs/adr/) for the full picture.

## Repository layout

```
packages/card-database   Card metadata via Scryfall (implemented)
services/                Engine service (JVM/XMage) and vision service (Python) — planned
docs/adr/                Architecture Decision Records
docs/architecture.md     System overview
CLAUDE.md                Authoritative development guide (process, gates, conventions)
```

## Developer setup

Requirements: Node.js ≥ 22.

```bash
npm install        # installs deps and activates git hooks
npm run verify     # build + typecheck + lint + format check + unit + integration tests
```

Per-package (example):

```bash
npm run test              -w @magic-mock/card-database   # unit tests (hermetic)
npm run test:integration  -w @magic-mock/card-database   # against a local Scryfall-shaped server
npm run test:live         -w @magic-mock/card-database   # opt-in smoke test vs real Scryfall
```

Quality gates run automatically: `pre-commit` (format + lint), `pre-push`
(full `verify`), and CI on every pull request.

## Contributing

One feature at a time, fully finished (implemented → tested → verified →
documented → committed). The process, Definition of Done, and conventions live in
[CLAUDE.md](CLAUDE.md).

## Card data & licensing notes

Card metadata and images come from [Scryfall](https://scryfall.com). This project
follows Scryfall's API guidelines (identifying User-Agent, request pacing, ≥24 h
caching, bulk data for volume). Magic: The Gathering is © Wizards of the Coast;
this is an unofficial fan project under the
[WotC Fan Content Policy](https://company.wizards.com/en/legal/fancontentpolicy).
