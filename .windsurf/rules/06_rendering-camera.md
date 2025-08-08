---
trigger: glob
globs: (src/react/*.tsx, src/systems/*.ts)
---

# Rule 6 — Rendering & Camera Systems (authoritative, copy‑safe)

Authoritative constraints for camera control and scene rendering. Camera runs before Render each fixed step. Only these systems mutate the Three.js scene graph.

## Purpose
- Keep scene mutations isolated to Camera/Render.
- Ensure visual smoothness without breaking fixed‑step determinism.
- Prevent GPU leaks and per‑frame churn.

## Ownership & Files
- Camera: [src/systems/CameraSystem.ts](cci:7://file:///home/sam/threejs.shooter/src/systems/CameraSystem.ts:0:0-0:0)
- Render: [src/systems/RenderSystem.ts](cci:7://file:///home/sam/threejs.shooter/src/systems/RenderSystem.ts:0:0-0:0)
- R3F integration/UI: [src/react/App.tsx](cci:7://file:///home/sam/threejs.shooter/src/react/App.tsx:0:0-0:0), [src/react/PostFX.tsx](cci:7://file:///home/sam/threejs.shooter/src/react/PostFX.tsx:0:0-0:0), [src/react/GameOrchestrator.tsx](cci:7://file:///home/sam/threejs.shooter/src/react/GameOrchestrator.tsx:0:0-0:0)

## Order & Data‑Flow (per fixed step)
1) CameraSystem — reads ECS (player/aim) → writes camera pose/params.
2) RenderSystem — reads ECS + camera → mutates Three.js scene graph.
- Post‑processing reads from camera/render state; it never drives simulation.

## Camera Rules
- Follow model: third‑person offset from `Transform` of the focus entity (e.g., player).
- Aim alignment: use ECS `Aim` data to orient camera/reticle; no direct DOM reads here.
- Smoothing: fixed‑step friendly (e.g., exponential/critically‑damped using the constant step). No variable‑dt factors.
- Collision‑aware camera: perform read‑only physics queries via an interface provided by `PhysicsSystem`; Camera itself must not step/mutate physics.
- Pointer‑lock/UI: respect pause/focus states written by `InputSystem`/UI; do not force lock.

## Render Rules
- Scene graph writes:
  - Create/destroy Three.js objects only in RenderSystem in response to ECS entity lifecycle.
  - Update transforms/material uniforms from ECS/Physics outputs.
- GPU resource lifecycle:
  - On removal: dispose `geometry`, `material`, `texture` and detach from scene.
  - Cache and reuse materials/geometry/textures when possible (keyed by file path + variant).
- No per‑frame creation:
  - Do not instantiate new materials/geometry/textures in hot loops; reuse and mutate.
  - Uniform updates are allowed; object construction is not.
- Shadows:
  - Set `castShadow`/`receiveShadow` intentionally per object on creation.
  - Do not toggle global shadow map size at runtime.

## Post‑Processing (if enabled)
- Configure once during init; changes are explicit and rare.
- Tuning parameters are read from ECS/UI state but do not affect simulation.
- No per‑frame effect graph rebuilds.

## Performance & Allocation Discipline
- No `new THREE.*` inside per‑entity render loops.
- Use small reusable temp vectors/matrices; avoid closures capturing allocations each frame.
- Batch renderer state changes when feasible (common materials grouped).

## Prohibitions (hard)
- No Three.js scene mutations outside Camera/Render systems.
- No per‑frame material/geometry/texture re‑creation.
- No variable‑dt smoothing in Camera; use the fixed step.
- No physics stepping or direct body mutations from Camera/Render.

## Reviewer Checklist (static; grep‑friendly)
- Ownership
  - Only [CameraSystem.ts](cci:7://file:///home/sam/threejs.shooter/src/systems/CameraSystem.ts:0:0-0:0) and [RenderSystem.ts](cci:7://file:///home/sam/threejs.shooter/src/systems/RenderSystem.ts:0:0-0:0) call `scene.add`, `scene.remove`, or set object transforms/materials.
- Order
  - [src/systems/index.ts](cci:7://file:///home/sam/threejs.shooter/src/systems/index.ts:0:0-0:0) lists Camera before Render (after Scoring).
- Smoothing
  - Camera math uses fixed‑step constants; no `delta`‑scaled interpolation.
- Resources
  - RenderSystem disposes GPU resources on entity removal.
  - Material/geometry/texture creation occurs on init or cache miss, not per frame.
- Shadows
  - Per‑object `castShadow/receiveShadow` set on creation; no global shadow size flips in update loop.
- Hygiene (Rule 0)
  - No `any`, no unused, no stubs/partials; internal lint clean.

## Acceptance Gates
- Camera runs before Render; only these systems mutate the scene.
- Fixed‑step camera smoothing; read‑only physics queries through Physics’ interface.
- Render creates/updates/tears down objects deterministically and disposes GPU resources.
- No per‑frame allocations in hot paths; caches in place.
- Internal lint passes (Rule 0).