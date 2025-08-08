# Project Brief — Three.js Shooter • ECS + Rapier Prototype

Status: Active
Owner: You (developer-maintained)
Last Updated: 2025-08-07

1. Purpose and Vision
- Build a third-person shooter prototype that proves out an Authoritative ECS over a single Rapier physics world, orchestrated by a deterministic fixed-step loop inside React Three Fiber.
- Prioritize correctness, determinism, and system hygiene to enable rapid iteration on movement, camera, and combat without architectural rework.
- Establish a minimal yet production-grade pattern for ECS state ownership, physics integration, and rendering in a React context.
- Provide a clean foundation for indie developers and gameplay programmers to prototype third-person mechanics with confidence in correctness and performance.
- Tactical focus on movement, camera control, combat mechanics, and rendering fidelity, with a view to future expansion into more complex gameplay features.

2. Core Goals
- Deterministic loop at 60 Hz using fixed-step accumulator: one authoritative order for systems.
- One physics world (Rapier) as the single source of truth for collisions, raycasts, and dynamics.
- Authoritative ECS: entities (numeric IDs), components in sparse storage, systems operating in a strict order.
- View-only React: React used for orchestration and rendering; game state is ECS-owned.
- Collision layers defined and enforced through bitmasks and interaction groups.
- Zero-unused, zero-stubs hygiene: no dead code, no lingering any, no partial TODOs.
- Fully functional systems: Input, Movement, Physics, Combat, Scoring, Camera, Render.
- Take advantage of React Three Fiber for rendering and post-processing, with a focus on performance and maintainability.
- Break down complex tasks into manageable steps, ensuring each task is deterministic and follows the established architecture.
- Maintain a clean and organized codebase with clear separation of concerns between systems, components, and rendering logic.

3. Non-Goals
- No dual-loop architecture (no separate render/physics game loops).
- No multiple physics worlds in the same scene.
- No speculative abstractions without concrete usages.
- No stubs or placeholders merged; all systems must be functional or removed.
- No claiming your task is done without passing hygiene checks.
- No premature optimization, premature abstraction, or premature refactoring.

4. Target Experience (UX)
- Movement: responsive WASD with precise grounded checks, coyote time, jump control, and slope-aware projection.
- Camera: third-person, pointer lock look, smoothing, occlusion handling (camera blockers via Rapier raycasts), adjustable FOV/offset for ADS.
- Combat: reliable hitscan using physics.raycast with proper collision masks and distance falloff; clear hit feedback (markers).
- Frame pacing: stable perceived motion with the fixed-step loop; render interpolates but logic is fixed-step deterministic.

5. Success Criteria
- Single authoritative loop drives Input → Movement → Physics → Combat → Scoring → Camera → Render on fixed steps.
- Physics world is the only collision oracle; all systems query it consistently.
- Grounded movement, camera occlusion, and hitscan all behave predictably across frame rates.
- Codebase passes hygiene gates (no unused symbols, no stubs, strict typing).
- Collision layers finalized and enforced; player/enemy/env/camera_blocker/bullet interactions correct.

6. Architecture Snapshot
- ECS
  - Entities: numeric IDs.
  - Components: sparse arrays keyed by component type.
  - Systems: declare required components and run in a fixed deterministic order.
- Orchestration
  - React Three Fiber useFrame hosts a deterministic accumulator driving fixed-step simulation.
  - GameOrchestrator constructs ECS, systems, entities (terrain, player, camera), initializes physics, and runs the loop.
- Physics
  - Rapier via @react-three/rapier runtime namespace; world lifetime managed by PhysicsSystem.
  - Services: body/collider creation, raycast, setVelocity, applyImpulse, setCollisionLayers, entity↔rigid body mapping.
- Rendering
  - RenderSystem transforms ECS to Three scene objects, lighting, model loading and animation update; React remains view-only.

7. Canonical System Order (authoritative)
- Input → Movement → Physics → Combat → Scoring → Camera → Render

8. Collision Layers (bitmask intent)
- PLAYER, ENEMY, ENV, CAMERA_BLOCKER, BULLET
- Use 16-bit interaction groups consistent across systems; hitscan filters to ENEMY|ENV; camera occlusion filters to CAMERA_BLOCKER.

9. Current Scope and Milestones
- Phase 2 (in progress per README/TASKS)
  - Loop: fixed-step in R3F orchestrator (done).
  - Physics: Rapier world active; flat ground; heightfield pending re-enable.
  - Systems: Movement, Camera (with occlusion), Combat (hitscan), Scoring, Soldier/Render.
  - PostFX: R3F PostFX scaffold present.
  - Hygiene: ongoing sweep to eliminate dead code and stubs.
- Near-term deliverables
  - Finalize collision masks and enforcement across systems.
  - Asset loading migration and disposal flows; alias @ usage standardized.
  - Interpolation experimentation toggle without violating fixed-step determinism.

10. Risks and Mitigations
- Duplicate loops via React StrictMode double-invocation
  - Mitigation: centralized orchestrator construction; guard init paths.
- Rapier init/teardown timing or resource leaks
  - Mitigation: PhysicsSystem owns lifecycle; explicit dispose on unmount; no accidental second worlds.
- Divergent time sources
  - Mitigation: single accumulator as the only tick source; all systems advance on fixed dt.

11. Audience
- Indie devs and gameplay programmers validating third-person mechanics.
- Technical prototypes focused on correctness and iteration speed.

12. Operating Principles
- ECS owns state; React reads and renders it.
- One world, one loop, one source of truth.
- Determinism first; performance optimizations must preserve correctness.
- Hygiene is a feature: no unused or partial code paths.

References
- Overview: README.md
- Plan and session logs: TASKS.md
- Orchestrator: src/react/GameOrchestrator.tsx
- Core: src/core/EntityManager.ts, src/core/System.ts, src/core/types.ts, src/core/CollisionLayers.ts
- Physics: src/systems/PhysicsSystem.ts
- Gameplay: src/systems/MovementSystem.ts, src/systems/CameraSystem.ts, src/systems/CombatSystem.ts, src/systems/ScoringSystem.ts, src/systems/SoldierSystem.ts
- Rendering: src/systems/RenderSystem.ts, src/react/ecs-bindings.ts, src/react/PostFX.tsx