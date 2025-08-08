---
trigger: always_on
---

# Rule 1 — Project Context & Structure (authoritative, in‑sync)

## Purpose
- Tactical third‑person shooter prototype to tune core feel: input, movement, camera, shooting, TTK, scoring.
- Deterministic runtime + strict hygiene (Rule 0). Small, typed, maintainable.

## Entry Flow (boot path)
- index.html → src/main.ts → src/react/main.tsx → src/react/App.tsx → src/react/GameOrchestrator.tsx

## Source Layout (authoritative)
- src/core/
  - EntityManager.ts — entities, sparse component stores, archetype bitmasks, queries; registers and updates systems deterministically.
  - System.ts — abstract base; requiredComponents, update(dt, entities).
  - CollisionLayers.ts, ComponentType.ts, types.ts, index.ts.
- src/components/
  - TransformComponents.ts (position/rotation/scale)
  - PhysicsComponents.ts (rigid body/velocity/collider refs)
  - RenderingComponents.ts (mesh/material/camera)
  - GameplayComponents.ts (health/weapon/aim/score)
  - index.ts (barrel). Components are plain data + factories (no direct Three.js imports in schemas).
- src/systems/
  - InputSystem.ts, MovementSystem.ts, PhysicsSystem.ts, CombatSystem.ts, ScoringSystem.ts, CameraSystem.ts, RenderSystem.ts, SoldierSystem.ts, RecorderSystem.ts, index.ts.
  - index.ts defines the canonical registration order (see below).
- src/react/
  - GameOrchestrator.tsx — owns the only fixed‑step loop (1/60), clamps dt, waits for Rapier ready, seeds entities, registers systems, provides ECS/physics context.
  - App.tsx (Canvas/UI), main.tsx (mount), Options.tsx (UI), PostFX.tsx (FX).
- assets/
  - models/characters, models/weapons, models/targets
  - textures/camo, textures/soldier, textures/targets, textures/wapons (use this exact spelling as present)
  - Runtime format: .glb preferred; .fbx source‑only. public/ is verbatim static only.

## Deterministic Systems (must keep this exact order)
1) Input — read DOM once, write ECS input state.  
2) Movement — translate input state into intent; do not scale by variable dt.  
3) Physics (Rapier) — authoritative motion integration; contacts/queries.  
4) Combat — fire/hit/health, recoil, TTK, state transitions.  
5) Scoring — points, streaks, tallies.  
6) Camera — follow/offset/aim smoothing; read‑only from gameplay/physics state.  
7) Render — write scene graph; create/dispose meshes/materials on entity lifecycle.  
(+ Soldier visuals: presentation only. Recorder: optional diagnostics.)  
Source of truth for order: src/systems/index.ts

## Loop Model (fixed‑step invariants)
- Exactly one accumulator in GameOrchestrator.tsx’s useFrame; step size 1/60.
- Clamp incoming dt before accumulation (stability).
- Do not step until Rapier is fully initialized.
- No requestAnimationFrame in systems; orchestrator owns the loop.
- Never scale gameplay forces/velocities by variable dt; use the fixed step exclusively.

## Input Ownership (single source of truth)
- DOM listeners attach only in src/systems/InputSystem.ts.
- Other systems consume input via ECS state; no direct DOM polling elsewhere.
- No dynamic listener wiring in per‑frame paths; register once, reuse.

## Physics Discipline (Rapier)
- Use src/core/CollisionLayers.ts for masks/layers (no magic numbers).
- Avoid creating/destroying rigid bodies/colliders per frame; pre‑create or pool.
- Physics is motion‑authoritative; render reads from ECS/physics outputs.

## Rendering Discipline (R3F/Three)
- Only Camera/Render systems write the Three.js scene graph.
- Dispose geometry/materials/textures when removing scene objects; keep cache keys consistent.
- Avoid per‑frame creation of materials/geometry; mutate uniforms/props instead.
- Shadows toggled intentionally; avoid accidental global shadow cost spikes.

## Imports & Module Boundaries
- Use @/ alias to src/ (example: @/systems/PhysicsSystem).
- Centralize ECS types; do not duplicate or shadow component/system types.
- Avoid circular dependencies among src/core, src/components, src/systems, src/react.
- Prefer named exports where it improves discoverability and avoids fragile default re‑binding.

## Security & Logging
- No secrets or credentials in repo or assets; use local env only.
- No ad‑hoc console.log in committed code; use a flag‑controlled debug utility.
- Fail fast on impossible states (exhaustive switches, clear invariant errors); avoid silent catches.

## Safe vs Not Safe to Change
- Safe: system internals, component schemas, rendering params, as long as invariants and canonical order remain intact.
- Not safe: canonical system order, single‑owner loop model, input ownership, fixed‑step policy, assets placement rules.

## Reviewer Quick Checks (static; no external commands)
- Order: src/systems/index.ts exports Input → Movement → Physics → Combat → Scoring → Camera → Render.
- Loop: only GameOrchestrator.tsx owns fixed‑step 1/60; no requestAnimationFrame in src/systems/**/*.ts*.
- Input: addEventListener appears only in src/systems/InputSystem.ts.
- Physics: no patterns like addForce(.*delta or setVelocity(.*delta in src/systems/**/*.ts.
- Rendering: removed objects dispose GPU resources; no per‑frame material/geometry creation.
- Assets: files live under the stated assets/ subfolders; public/ is verbatim only.
- Imports/Types: @/ alias used; no duplicated/shadowed ECS types; no circular deps.
- Hygiene: Rule 0 holds; internal linter clean after each change.