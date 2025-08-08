---
trigger: model_decision
description: Physics (Rapier) Determinism & Collisions | Authoritative constraints for Rapier usage, stepping, collisions, and data‑flow. Enforce deterministic 60 Hz physics and clean ownership boundaries.
globs: src/**/*.ts, src/**/*.tsx
---

# Rule 5 — Physics (Rapier) Determinism & Collisions (authoritative, copy‑safe)

Authoritative constraints for Rapier usage, stepping, collisions, and data‑flow. Enforce deterministic 60 Hz physics and clean ownership boundaries.

## Purpose
- Keep physics authoritative and reproducible at 60 Hz.
- Define collision layers/masks centrally and forbid magic numbers.
- Ensure clean lifecycle, zero per‑frame churn, and correct ECS sync.

## Ownership & Files
- Physics system code: src/systems/PhysicsSystem.ts
- Collision layers/masks (source of truth): src/core/CollisionLayers.ts
- Loop owner & readiness gate: src/react/GameOrchestrator.tsx

## Readiness & Stepping
- Initialize Rapier once (async). Until ready, the simulation loop must not step or query Rapier.
- Fixed‑step only (1/60): call world.step() exactly once per fixed substep.
- Clamp render dt before accumulation (e.g., ≤ 0.1). Do not “catch up” beyond clamped dt.

## Data‑Flow & Order (within each fixed step)
1) InputSystem — reads DOM, writes ECS input.
2) MovementSystem — computes kinematic targets/forces for this step.
3) PhysicsSystem — applies kinematic targets/forces, then world.step().
4) CombatSystem — consumes contacts/hits collected during Physics.
5) ScoringSystem → CameraSystem → RenderSystem — read ECS state updated by Physics.

Notes
- Kinematic bodies: set target poses/velocities in Movement (pre‑step).
- Physics writes authoritative transforms/velocities back to ECS after world.step().
- Rendering reads ECS state after Physics in the same step.

## Collision Layers & Masks (centralized)
- All colliders must use constants from src/core/CollisionLayers.ts for both layer and mask.
- Define and maintain canonical groups (example names; keep in code as constants):
  - PLAYER, PROJECTILE, ENVIRONMENT, TARGET, SENSOR
- Sensors (triggers) do not affect dynamics; they only raise events.
- Continuous Collision Detection (CCD) must be enabled for fast projectiles.

## Bodies, Colliders, Lifecycle
- Pre‑create or pool bodies/colliders; never create/destroy inside hot per‑frame loops.
- Destruction must clean up:
  - Rapier world body/collider
  - ECS components referencing them
  - Any cached render proxies (dispose handled by RenderSystem)
- Terrain uses heightfield/triangle mesh colliders with friction/restitution sourced centrally (no magic numbers inline).

## Forces, Velocities, Units
- Never multiply gameplay forces/velocities by variable render dt.
- Magnitudes represent per‑step inputs or are integrated by Rapier using the fixed step.
- Use meters‑seconds SI; keep gravity and unit scales consistent.

## Queries & Events
- Queries (ray/sweep/contact) must run only when physicsReady is true and within PhysicsSystem.
- Contact/hit events collected during world.step() are published via a transient per‑step buffer.
- CombatSystem consumes the buffer in the same step; buffer is cleared at step end.

## Performance & Allocation Discipline
- No per‑frame heap allocations in Physics hot paths (avoid new Vector3() in loops). Reuse temporaries.
- No dynamic event/listener wiring inside per‑frame code.
- Avoid per‑frame creation of shapes/bodies; pool or reuse.

## Async & Determinism
- PhysicsSystem.update(dt, entities) is synchronous for each substep.
- Any async I/O (asset loads, decoder work) must enqueue results to apply at the next step boundary. Never mutate world mid‑step.

## Prohibitions (hard)
- No Rapier step/query before readiness.
- No variable‑dt scaling of forces/velocities/accelerations.
- No magic collision layer/mask numbers; use src/core/CollisionLayers.ts only.
- No body/collider create/destroy in per‑frame loops.
- No scene graph mutations from PhysicsSystem (Render/Camera own the Three.js scene).

## Reviewer Checklist (static; grep‑friendly)
- Readiness
  - Guard exists in GameOrchestrator.tsx: skip stepping until physicsReady.
  - PhysicsSystem does not call world.step() or queries before readiness.
- Fixed‑step usage
  - Single world.step() per substep; no partial/integrated variable dt code.
  - No gameplay code multiplies by frame dt for physics magnitudes.
- Order & data‑flow
  - Movement sets kinematic targets before Physics.
  - Physics writes back ECS Transform/Velocity after step; Combat consumes contact buffer after Physics.
- Collisions
  - All colliders use CollisionLayers.ts constants for layer/mask.
  - CCD is enabled on fast projectiles.
  - Sensors marked correctly and excluded from dynamics.
- Lifecycle
  - No create/destroy in per‑frame loops; pooling or batched lifecycle outside hot paths.
  - Destroy paths purge ECS refs and trigger RenderSystem disposal.
- Allocations
  - No new THREE.* or array allocations inside Physics entity loops; temps reused.
- Hygiene (Rule 0)
  - Types are strict; no any. No unused or stubs. Internal lint clean.

## Acceptance Gates
- Physics steps only at fixed 60 Hz and only when ready.
- System order and data‑flow match the canonical sequence; no mid‑step async mutations.
- Layers/masks come exclusively from src/core/CollisionLayers.ts; CCD configured for fast movers.
- Clean lifecycle and zero per‑frame allocation churn in Physics hot paths.
- Internal lint passes after the latest changes (Rule 0).