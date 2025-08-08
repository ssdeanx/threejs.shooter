# Context — Three.js Shooter • ECS + Rapier Prototype

Status: Draft
Owner: You (developer-maintained)
Last Updated: 2025-08-07

1. Current Work Focus
- Memory Bank initialization: brief.md, product.md, architecture.md, tech.md completed as drafts aligned to repo truth (README.md, TASKS.md, source).
- Phase 2 gameplay foundation: deterministic loop hosted in R3F, single Rapier world, core systems (Input, Movement, Physics, Combat, Scoring, Camera, Render) operational.
- Hygiene enforcement: strict typing preservation, no unused declarations, single-world/one-loop policy enforced.

2. Recent Changes
- brief.md authored with goals, non-goals, system order, collision layers, risks, references.
- product.md drafted: UX goals, scope, acceptance criteria, pillars, roadmap.
- architecture.md drafted: system design, source map, loop order, physics integration, collision masks, extension points.
- tech.md drafted: stack, packages, structure, dev commands, loop details, standards, next technical tasks.
- PhysicsSystem hardened:
  - Structural Rapier interfaces (RapierWorld, RapierColliderSet, etc.) retained and used in live paths.
  - makeGroupsTyped retained and used for all group applications to ensure stable InteractionGroups packing across builds.
  - __validateCollisionLayers retained and invoked at module load in a browser-safe way (no Node typings); configuration issues surface via console.error.
  - Heightfield creation path fully disabled by explicit guard; canonical static flat ground plane collider at y = 0 created during init.
  - Raycast normalizes direction, supports optional filterGroups, gates on collider-set liveness, and returns consistent shape.
  - Collision and solver groups are applied together consistently on creation and updates; defaults inferred via ECS role components.
- Deterministic loop confirmed centralized in src/react/GameOrchestrator.tsx with accumulator.

3. Next Steps (Execution-Ready)
- **Collision Mask Standardization COMPLETE**: All systems (Movement, Combat, Camera) now use the canonical masks from `src/core/CollisionLayers.ts`. Redundant bitwise operations were removed, enforcing a single source of truth.
- **Zustand vs. ECS Documentation**: Created `docs/ecs-vs-zustand.md` to formally evaluate state management strategies for gameplay logic.
- **Next Steps**:
  - Begin the "Wire Systems Together (Integration Pass)" to ensure a deterministic, single-loop architecture.
  - Plan the "Options Screen on ESC" feature, ensuring UI state remains separate from the ECS.
- Asset lifecycle and disposal
  - Standardize GLB loading/unloading (useGlbAsset) and Three object disposal paths in RenderSystem; verify no leaks.
- @ alias migration
  - Complete transition to @ paths consistently across systems/components/hooks per tsconfig and vite config.
- Interpolation experimentation (visual-only)
  - Add feature flag module; ensure any interpolation does not mutate ECS state; remains read-only on visuals.
- Tasks documentation
  - Author tasks.md workflows for “Add System”, “Add Collider Layer”, “Add GLB Asset”, “Create view-only binding” for repeatability.

4. Risks and Watchouts
- React StrictMode double invocation: guarantee single orchestrator/physics world construction.
- Mask misconfiguration: inconsistent filters cause false positives/negatives in grounded/hitscan/occlusion.
- Resource leaks: improper disposal when swapping scenes/assets/heightfield.
- Determinism drift: accidental secondary loops or time sources added by future code.

5. Success Criteria (near-term)
- All systems use consistent collision masks; validations pass in manual tests.
- Heightfield remains disabled and guarded; no accidental reintroduction.
- No duplicate loops/worlds; teardown is clean; ESLint/type checks clean.
- Feature flags in place; optional interpolation confirmed view-only.

## Critical Warnings
- Never leave unused interfaces/constants/helpers. Every declared item must be used in live code. Do not remove or leave unused.
- Heightfields are permanently disabled. Any heightfield collider creation must throw. Canonical ground is a flat plane at y = 0.
- All collision filtering must route through centralized makeGroups/makeGroupsTyped and adhere to CollisionLayers semantics. Always set both collisionGroups and solverGroups.

References
- Overview and diagrams: README.md
- Plan and session logs: TASKS.md
- Brief (source-of-truth goals): .kilocode/memory-bank/brief.md
- Architecture: .kilocode/memory-bank/architecture.md
- Tech: .kilocode/memory-bank/tech.md