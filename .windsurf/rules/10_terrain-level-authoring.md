---
trigger: model_decision
description: Terrain & Level Authoring - Deterministic terrain, spawns, and placement.
---

# Rule 10 — Terrain & Level Authoring (authoritative, copy‑safe)

Deterministic terrain, spawns, and placement.

## Ownership & Files
- Visual terrain setup: `RenderSystem`.
- Terrain collider creation: `PhysicsSystem` init (heightfield/tri mesh).
- Collision config: [src/core/CollisionLayers.ts](cci:7://file:///home/sam/threejs.shooter/src/core/CollisionLayers.ts:0:0-0:0).

## Deterministic Placement
- Seeded spawns (player/targets) stored in ECS/config; no unseeded randomness.
- After Rapier ready: snap player to ground using a single downward query.
- Visual terrain and collider share source scale/origin; document any offsets.

## Authoring Rules
- Terrain assets exported at scale=1.0, Y‑up, sane pivot.
- Large static meshes: merged where possible to reduce draw calls.
- Materials limited and reusable; texture tiling avoids repetition.

## Runtime Discipline
- Create terrain mesh/collider once; no per‑frame rebuilds.
- Queries for ground snap only at boot or explicit respawn, not every frame.

## Prohibitions (hard)
- No random() without a fixed seed for placement.
- No magic numbers for collision; use [CollisionLayers.ts](cci:7://file:///home/sam/threejs.shooter/src/core/CollisionLayers.ts:0:0-0:0).
- No per‑frame generate/destroy of terrain chunks.

## Reviewer Checklist
- Ground snap occurs only after physics ready.
- Shared source/scale between visual terrain and collider.
- Spawns seeded/persisted; no ad‑hoc randomness.
- Terrain constructed once; no frame‑time rebuilds.

## Acceptance Gates
- Deterministic placement; terrain alignment verified.
- Seeded spawns and single ground snap.
- Internal lint clean (Rule 0).