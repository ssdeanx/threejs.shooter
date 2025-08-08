---
trigger: model_decision
description: Game Loop & Systems | Authoritative constraints for the simulation loop and ECS execution to guarantee a deterministic 60 Hz game. This rule is static, self‑contained, and enforceable by code inspection. No external commands are required or allowed.
---

# Rule 3 — Game Loop & Systems Determinism (authoritative, copy‑safe)

Authoritative constraints for the simulation loop and ECS execution to guarantee a deterministic 60 Hz game. This rule is static, self‑contained, and enforceable by code inspection. No external commands are required or allowed.

## Purpose
- Ensure repeatable simulation independent of render FPS.
- Keep ownership and boundaries crystal clear to avoid hidden side‑effects.
- Maintain strict hygiene and performance in hot paths.

## Single Owner of the Loop
- The only simulation loop lives in [src/react/GameOrchestrator.tsx](cci:7://file:///home/sam/threejs.shooter/src/react/GameOrchestrator.tsx:0:0-0:0) inside R3F `useFrame`.
- No system calls `requestAnimationFrame`, `setInterval`, or creates independent timers/loops.
- Pausing, gating (e.g., physics readiness), and step accumulation occur only in [GameOrchestrator.tsx](cci:7://file:///home/sam/threejs.shooter/src/react/GameOrchestrator.tsx:0:0-0:0).

## Fixed‑Step Accumulator (60 Hz)
- The loop uses a single accumulator for a fixed step of `1/60`.
- Clamp incoming render `dt` before accumulation (e.g., `≤ 0.1`) to avoid spiral‑of‑death.
- While `acc >= FIXED_DT`, call `entityManager.updateSystems(FIXED_DT)` then reduce `acc -= FIXED_DT`.
- Do not “smooth” or “lerp” the fixed step; camera/render can smooth visually, but simulation stays fixed.

## Canonical System Order (must never change)
- Source of truth: [src/systems/index.ts](cci:7://file:///home/sam/threejs.shooter/src/systems/index.ts:0:0-0:0)
- Order:
  1) Input
  2) Movement
  3) Physics
  4) Combat
  5) Scoring
  6) Camera
  7) Render
  (+ Soldier visuals, Recorder as auxiliary)
- All features assume read‑after‑write semantics implied by this order.

## System Contracts & Boundaries
- Base class: [src/core/System.ts](cci:7://file:///home/sam/threejs.shooter/src/core/System.ts:0:0-0:0) — systems declare `requiredComponents` and implement [update(dt, entities)](cci:1://file:///home/sam/threejs.shooter/src/core/System.ts:11:2-11:64).
- A system only mutates state it owns or is responsible for by contract.
- Input ownership:
  - DOM listeners attach only in [src/systems/InputSystem.ts](cci:7://file:///home/sam/threejs.shooter/src/systems/InputSystem.ts:0:0-0:0).
  - All other systems read input via ECS components; no direct DOM polling elsewhere.
- Scene graph ownership:
  - Only `CameraSystem` and `RenderSystem` write to Three.js scene objects.
  - They must dispose GPU resources (geometry/materials/textures) on entity removal.
- Physics ownership:
  - `PhysicsSystem` is the only place that steps Rapier or mutates rigid body state.
  - Gameplay forces/velocities are never scaled by variable `dt` (fixed step only).

## Physics Readiness Gate
- No physics stepping or collider/rigid body queries until Rapier initialization completes.
- [GameOrchestrator.tsx](cci:7://file:///home/sam/threejs.shooter/src/react/GameOrchestrator.tsx:0:0-0:0) must gate stepping: if not ready, skip accumulation consumption (do not “catch up” later).

## Performance & Allocation Discipline
- No per‑frame heap allocations in hot loops (e.g., `new Vector3()` inside entity iteration).
- Reuse temporary vectors/arrays/closures or cache them at module scope where safe.
- No dynamic listener registration/unregistration in per‑frame paths.
- Avoid per‑frame creation of geometry/material/texture; mutate or reuse instead.

## Async & Ordering
- System [update(dt, entities)](cci:1://file:///home/sam/threejs.shooter/src/core/System.ts:11:2-11:64) must be synchronous for each fixed step.
- If async work is necessary (I/O, decoding), enqueue results to be applied at the start of a subsequent fixed step; never interleave mid‑step side‑effects.
- Do not re‑order systems within a frame or conditionally skip out‑of‑band work that would break determinism.

## Observability (low‑overhead)
- Use a flag‑controlled debug util (not `console.log` spam) to sample:
  - Step counts, processed entity counts per system.
  - Optional timers for system update durations (microbenchmark only when needed).
- Keep diagnostic allocations out of hot loops; guard all debugging behind compile‑time or feature flags.

## Prohibitions (hard)
- No `requestAnimationFrame`, `setTimeout`, `setInterval` inside `src/systems/**/*.ts*`.
- No physics stepping or queries before readiness is true.
- No variable‑dt scaling of gameplay magnitudes (forces/velocities/accelerations).
- No DOM listeners outside [InputSystem.ts](cci:7://file:///home/sam/threejs.shooter/src/systems/InputSystem.ts:0:0-0:0).
- No Three.js scene mutations outside Camera/Render systems.

## Reviewer Checklist (static; grep‑friendly)
- __Loop ownership__:
  - Only [GameOrchestrator.tsx](cci:7://file:///home/sam/threejs.shooter/src/react/GameOrchestrator.tsx:0:0-0:0) contains the fixed‑step accumulator and stepping.
  - Search: no `requestAnimationFrame(` in `src/systems/**/*.ts*`.
- __Fixed step__:
  - Presence of a single `const FIXED_DT = 1/60` (or equivalent) and a clamped `dt` before accumulation.
  - While‑loop drains `acc` in exact multiples of `FIXED_DT`.
- __Order__:
  - [src/systems/index.ts](cci:7://file:///home/sam/threejs.shooter/src/systems/index.ts:0:0-0:0) exports the canonical list: Input → Movement → Physics → Combat → Scoring → Camera → Render.
- __Input ownership__:
  - `addEventListener(` only appears in [src/systems/InputSystem.ts](cci:7://file:///home/sam/threejs.shooter/src/systems/InputSystem.ts:0:0-0:0).
- __Physics gating__:
  - Guard present: skip stepping until Rapier ready.
  - No calls to Rapier step/query paths prior to readiness flag in `PhysicsSystem`.
- __No variable‑dt scaling__:
  - Search: `delta.*force|force.*delta|velocity.*delta|delta.*velocity` should not appear as gameplay scaling.
- __Allocations__:
  - In systems, avoid `new THREE.*` inside entity loops; reuse temps.
- __Scene graph__:
  - Only Camera/Render systems write to Three.js scene; verify disposal on removal in `RenderSystem`.
- __Hygiene (Rule 0)__:
  - No `any`, no unused, no stubs/partials, no commented‑out code; internal lint clean.

## Minimal reference (not for copy‑paste; for shape only)
/*
Location: src/react/GameOrchestrator.tsx
- Owns: accumulator, clamp, readiness gate, system stepping call.
- Fixed step = 1/60, dt clamp ≤ 0.1, while(acc >= FIXED_DT) { updateSystems(FIXED_DT); acc -= FIXED_DT; }
- Blocks until rapierReady; no attempt to “catch up” skipped steps beyond clamped dt.
*/

## Acceptance Gates
- The loop exists only in [GameOrchestrator.tsx](cci:7://file:///home/sam/threejs.shooter/src/react/GameOrchestrator.tsx:0:0-0:0) and follows fixed‑step semantics.
- The system order in [src/systems/index.ts](cci:7://file:///home/sam/threejs.shooter/src/systems/index.ts:0:0-0:0) matches the canonical list exactly.
- Input, Physics, and Render/Camera ownership boundaries are respected as written.
- No evidence of variable‑dt gameplay scaling, mid‑step async mutations, or per‑frame heap churn.
- Internal lint is clean after the latest change (see Rule 0). 