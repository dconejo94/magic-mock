# ADR-0003: Monorepo and language strategy

- **Status:** Accepted
- **Date:** 2026-07-18

## Context

The platform spans several very different workloads: a JVM rules engine (ADR-0001),
a computer-vision pipeline, real-time networking, LLM integration, and multiple
future clients (web first; desktop/mobile/VR later). We need a repository and
language strategy that keeps modules decoupled without drowning a small team in
infrastructure.

## Decision

**One monorepo, npm workspaces at the root, three sanctioned languages, each chosen
by workload:**

| Language                         | Used for                                                                                                       | Rationale                                                                                   |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| **TypeScript (Node 22, strict)** | Platform services (card database, match service, networking gateway, AI adapter), web client, shared contracts | One language across services and web client; strong typing; first-class JSON/HTTP/WebSocket |
| **Java/Kotlin (JVM)**            | `engine-service` — the XMage Engine Adapter                                                                    | XMage is Java; in-process embedding requires the JVM                                        |
| **Python**                       | `vision-service`                                                                                               | OpenCV, ONNX/PyTorch ecosystem is Python-native                                             |

Structure:

```
packages/    TypeScript workspaces (@magic-mock/*)
services/    Non-TS services: engine-service (JVM), vision-service (Python)
docs/        ADRs, architecture
```

Cross-language boundaries are **transport APIs** (HTTP/WebSocket now, gRPC if
profiling demands it) with schema-defined contracts. No language reaches into
another's internals.

Quality gates (configured at the repo root, enforced by git hooks and CI):

- TypeScript: `tsc --strict` (+ `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`), ESLint `strictTypeChecked`, Prettier, Vitest.
- Each non-TS service brings the equivalent stack when it lands
  (JVM: Spotless + Checkstyle/Detekt + JUnit; Python: Ruff + mypy + pytest) wired
  into the same root `verify` entry point and CI.

## Alternatives considered

- **All-JVM platform** (since the engine is Java): rejected — poor fit for the
  vision stack and web tooling; slower iteration on clients.
- **Polyrepo:** rejected at this stage — cross-cutting changes (shared contracts)
  dominate early development; a monorepo keeps them atomic. Can be revisited if team
  or deploy topology demands it.
- **Rust core (Phase engine):** rejected with the engine choice (ADR-0001).

## Consequences

- Single `npm run verify` (build + typecheck + lint + format + unit + integration)
  is the repo-wide quality gate; CI runs it on every PR.
- Polyglot cost is contained: exactly one JVM service and one Python service, both
  behind transport APIs.
