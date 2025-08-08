# ECS vs. Zustand for Gameplay Logic

This document will provide a comparative analysis of using a pure ECS architecture versus a hybrid approach with Zustand for managing gameplay state in this deterministic third-person shooter.

## 1. Evaluation Criteria

- **Determinism & Replayability:** Can the state management guarantee identical outcomes from identical inputs?
- **Performance:** What are the CPU overheads for state updates, queries, and serialization?
- **Network Synchronization:** How easily can the state be serialized and synchronized for lockstep multiplayer?
- **Developer Experience:** How intuitive is the API for creating, updating, and querying game state?
- **Scalability:** How well does the architecture scale to hundreds of dynamic entities and complex systems?

## 2. Test Plan

A series of benchmarks and validation tests will be performed:

- **Benchmark 1 (State Updates):** Measure time to update 1000 entities per frame.
- **Benchmark 2 (State Queries):** Measure time to query components for 1000 entities per frame.
- **Validation 1 (Replay Hash):** Run a 5-minute simulation, record inputs, and verify that a replay produces a bit-for-bit identical state hash.
- **Validation 2 (Network Simulation):** Simulate a 100ms RTT with 1% packet loss and verify state convergence.

## 3. Recommendation

[Recommendation to be filled in after analysis is complete.]