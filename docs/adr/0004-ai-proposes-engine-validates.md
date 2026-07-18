# ADR-0004: AI proposes, the rules engine validates

- **Status:** Accepted
- **Date:** 2026-07-18

## Context

The platform includes AI opponents and player assistance backed by LLMs (Claude,
OpenAI, Gemini, local models). LLMs are non-deterministic and fallible; game state
must remain correct and identical across all players. There is also a second,
non-LLM actor with the same trust problem: the **vision service**, whose card
detections are probabilistic.

## Decision

**No probabilistic component ever mutates game state.** All state transitions flow
through one gate:

```
proposer (LLM agent | human UI | vision pipeline)
    → Action proposal (typed, schema-validated)
        → Rules Engine validates
            → legal   → applied, appended to the action log, broadcast
            → illegal → rejected with a reason; proposer may retry
```

1. **Single mutation path.** The engine adapter's `proposeAction` is the only way to
   change a game. There is no privileged bypass — not for AI, not for the UI, not
   for admins.
2. **Provider abstraction.** An `AiProvider` interface (complete-with-tools style)
   with adapters per vendor; strategy code is provider-agnostic. Local models are a
   first-class target.
3. **LLM scope is bounded:** choose among legal actions, recommend plays, explain
   rules, answer questions. The engine supplies the set of legal actions; the LLM
   selects/parameterizes, it never invents.
4. **Fallback chain:** if an LLM proposal is illegal N times or times out, fall back
   to a trivial legal action (pass priority) or the engine's built-in AI, so games
   never stall.
5. Vision detections enter the same way: a detection becomes an action _proposal_
   ("player declares casting X"), is confirmed by the player where confidence is
   low, and is validated by the engine like any other action.

## Consequences

- Correctness is invariant to AI quality; upgrading or swapping models is risk-free
  to game integrity.
- The action log (ordered, validated actions) doubles as the replay format and the
  network synchronization primitive.
- Latency: an LLM turn costs a round-trip plus possible retries; mitigated by the
  legal-action list keeping proposals well-formed, and by the fallback chain.
