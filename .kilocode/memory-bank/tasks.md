# Tasks — Three.js Shooter • ECS + Rapier Prototype

Status: Draft
Owner: You (developer-maintained)
Last Updated: 2025-08-07

Guidance
- These are repetitive workflows extracted from the current architecture. Follow steps precisely to preserve determinism, one-world physics, and hygiene.
- After completing a task, update context.md and adjust acceptance checks if needed.

## Add System to ECS Pipeline

Last performed: 2025-08-07

Files to modify
- src/systems/NewSystem.ts (new)
- src/systems/index.ts (export)
- src/react/GameOrchestrator.tsx (wire into order)
- src/core/types.ts (optional: add component types)
- src/components/* (if new components)

Steps
1. Define component types in src/core/types.ts (if needed) and add concrete component definitions in src/components/.
2. Create src/systems/NewSystem.ts:
   - Export class NewSystem implements System with constructor(EntityManager, services?) and update(dt) method.
   - Declare required components via a query or mask; avoid allocations in update.
3. Export the system from src/systems/index.ts.
4. Wire in GameOrchestrator.tsx:
   - Instantiate once alongside other systems.
   - Insert into the canonical order: Input → Movement → Physics → Combat → Scoring → Camera → Render.
   - Ensure side-effects are localized; do not introduce a second loop or time source.
5. Run hygiene:
   - TypeScript builds clean, ESLint has no unused exports or stubs.
6. Manual verification:
   - Confirm order is maintained; confirm no duplicate system updates per frame.

Important notes
- Systems must be deterministic under fixed step dt.
- Keep memory allocations during update minimal.

Example skeleton
- See existing systems like ["MovementSystem.ts"](src/systems/MovementSystem.ts:1) and ["CombatSystem.ts"](src/systems/CombatSystem.ts:1).

Acceptance
- System executes exactly once per fixed step in the intended order.
- No new warnings, no unused symbols, no stubs.

## Add Collider Layer and Apply Masks

Last performed: 2025-08-07

Files to modify
- src/core/CollisionLayers.ts
- src/systems/PhysicsSystem.ts (enforcement helpers)
- src/systems/MovementSystem.ts (ground probe filters)
- src/systems/CameraSystem.ts (occlusion filters)
- src/systems/CombatSystem.ts (hitscan filters)

Steps
1. Define new bit in src/core/CollisionLayers.ts (16-bit mask) and update any enums/constants.
2. Add or reuse helper in PhysicsSystem to apply Rapier interaction groups consistently.
3. Update raycast filters in relevant systems to include/exclude the new layer.
4. Validate creation sites (body/collider creation) set the correct group memberships for new entities.
5. Manual tests:
   - Ground probe: unaffected unless intended.
   - Camera occlusion: behaves as expected.
   - Hitscan: blocks or passes correctly per design.
6. Hygiene: ensure no dead constants or unused imports remain.

Important notes
- Keep a single source-of-truth bitmask mapping.
- Document any new layer usage in README and memory bank.

Acceptance
- Behavior change appears only where intended.
- All raycasts use consistent groups; no regressions in grounded, occlusion, hitscan.

## Add GLB Asset With Animation and Weapon Attachment

Last performed: 2025-08-07

Files to modify
- src/react/hooks/useGlbAsset.ts (if extending)
- src/systems/RenderSystem.ts (attach model, animation mixer)
- src/components/RenderingComponents.ts (component to reference asset id/path)
- public/ or assets/ folder for GLB file

Steps
1. Place GLB in public or assets; note path.
2. Create or extend a Rendering/Model component to store asset id/path and attach point metadata (e.g., weapon socket).
3. In RenderSystem:
   - On entity with Model component, load via useGlbAsset hook or pre-loader.
   - Create Object3D hierarchy and attach to corresponding entity’s Three object.
   - If animation: create THREE.AnimationMixer and update it in RenderSystem after sim step.
   - For weapon: find socket node and attach weapon mesh/model.
4. Disposal:
   - On entity removal or model change, detach and dispose geometries/materials/textures.
5. Hygiene: no unused imports; types are explicit.

Important notes
- RenderSystem reads ECS; do not mutate ECS inside Three callbacks.
- Ensure loaders are not re-created every frame.

Acceptance
- Model appears and animates; weapon attaches to the defined socket.
- No memory leaks on entity removal (devtools memory stable across reloads).

## Create View-Only React Binding for ECS Transform

Last performed: 2025-08-07

Files to modify
- src/react/ecs-bindings.ts
- src/components/TransformComponents.ts (ensure complete)
- src/react/App.tsx or scene components consuming the binding

Steps
1. In ecs-bindings.ts, add a read-only hook or component that maps an entity’s transform to a Three object.
2. Ensure the binding subscribes to ECS changes without causing state ownership issues (no ECS mutation).
3. Use the binding in a React component to render an entity proxy (e.g., a debug gizmo or label).
4. Verify it updates correctly after each fixed step.

Important notes
- React must not become a second state owner; keep data flow one-way from ECS to view.

Acceptance
- React-bound visuals reflect ECS transforms accurately; no feedback loops.

## Finalize Collision Masks (Project-Wide Checklist)

Last performed: 2025-08-07

Files to verify
- src/core/CollisionLayers.ts
- src/systems/MovementSystem.ts
- src/systems/CameraSystem.ts
- src/systems/CombatSystem.ts
- src/systems/PhysicsSystem.ts

Checklist
- [ ] PLAYER, ENEMY, ENV, CAMERA_BLOCKER, BULLET constants defined and documented.
- [ ] PhysicsSystem helper sets groups for bodies/colliders consistently.
- [ ] Ground probe filters ENV only.
- [ ] Hitscan filters ENEMY | ENV.
- [ ] Camera occlusion filters CAMERA_BLOCKER.
- [ ] Unit/spot tests (manual) executed; behaviors match expectations.
- [ ] README.md and memory bank updated.

## Re-enable Heightfield Safely

Last performed: 2025-08-07

Files to modify
- src/systems/PhysicsSystem.ts (heightfield creation)
- src/systems/MovementSystem.ts (grounding probes and slope projection)
- src/systems/RenderSystem.ts (visual terrain, if separate)
- README.md (note re-enable)

Steps
1. Implement heightfield collider creation and ensure it belongs to ENV layer.
2. Validate grounded probe rays handle heightfield normals and step offsets.
3. Ensure disposal paths and world ownership remain correct.
4. Manual test across slopes and edges; verify coyote time and projection still behave.

Acceptance
- Stable grounded behavior on heightfield surfaces; no leaks; loop determinism intact.