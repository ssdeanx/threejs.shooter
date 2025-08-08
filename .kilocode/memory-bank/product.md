# Product — Three.js Shooter • ECS + Rapier Prototype

Status: Draft
Owner: You (developer-maintained)
Last Updated: 2025-08-07

1. Why This Project Exists
- Validate a clean gameplay foundation that prioritizes determinism, architectural clarity, and iteration speed for third-person action prototypes.
- Provide a minimal yet production-grade pattern for: ECS state ownership, one-world physics, and a single deterministic loop hosted in React Three Fiber.

2. Problems It Solves
- Flaky gameplay due to variable frame-step or split time sources → fixed-step accumulator with one authoritative order.
- State scattered across React and scene objects → ECS owns game state; React is view-only.
- Physics and rendering disagree → one Rapier world as the collision/raycast oracle; systems query it consistently.
- Prototype entropy (stubs, unused code, partial migrations) → hygiene policy enforced as a first-class non-functional requirement.

3. How It Should Work (High Level)
- The R3F GameOrchestrator sets up the ECS world, constructs core systems, spawns initial entities (player, terrain, camera), and runs a fixed 60 Hz loop via an accumulator in useFrame.
- Systems execute in a deterministic order: Input → Movement → Physics → Combat → Scoring → Camera → Render.
- The PhysicsSystem owns the Rapier world lifecycle and provides services: collider/body creation, raycasts, impulses, velocity setting, and collision layer enforcement.
- Rendering translates ECS transforms and assets to Three.js objects; React components never mutate ECS directly during simulation; bindings are read-only.

4. User Experience Goals
- Fluid, responsive WASD locomotion with coyote-time jumps and slope-aware projection.
- A third-person camera that feels stable and readable, with pointer lock look, smoothing, and occlusion handling (camera blockers).
- Shooting that feels reliable (hitscan with distance falloff and clear hit feedback), without desync between visuals and physics.
- Stable perception of motion via fixed-step logic; optional interpolation experiments must not compromise determinism.

5. Product Scope (Phase 2 Focus)
- Movement: grounded state, jump logic, slope handling, yaw alignment.
- Camera: pointer-lock control, smoothing, configurable offset/FOV, raycast occlusion using CAMERA_BLOCKER.
- Combat: hitscan raycasts filtered to ENEMY|ENV, ADS toggles that affect camera parameters, transient hit markers.
- Scoring: simple scoring updates based on combat outcomes.
- Rendering: soldier model + weapon attach, animation updates, basic lights; optional heightfield (pending re-enable).
- PostFX: R3F post-processing scaffold prepared.

6. Out of Scope (for now)
- Networked multiplayer or rollback netcode.
- Full gameplay loop (missions, AI behavior trees, save systems).
- Complex animation graphs and weapon inventories.
- Multiple physics worlds or multi-scene orchestration.
- Procedural level generation beyond basic terrain.

7. Acceptance Criteria
- The entire simulation is driven by one fixed-step loop hosted in R3F; no hidden/duplicate loops.
- Rapier is the only collision oracle; all systems query it consistently.
- Grounded checks, camera occlusion, and hitscan are robust across variable render FPS.
- Collision masks are finalized and enforced for PLAYER, ENEMY, ENV, CAMERA_BLOCKER, BULLET.
- The codebase passes hygiene: no unused exports, no stubs, strict typing; no partial TODOs merged.

8. Product Pillars
- Determinism First: consistent outcomes regardless of frame rate variations.
- One Source of Truth: ECS for state, Rapier for collisions.
- View-Only React: rendering and orchestration, not game state mutation.
- Hygiene = Velocity: clean code enables faster iteration.

9. Primary Personas
- Gameplay Programmer prototyping mechanics quickly with confidence in correctness.
- Indie Developer building a small 3D shooter that can grow without architectural rewrites.

10. Risks and Constraints
- React StrictMode double invoke causing duplicate setup → orchestrator centralization and lifecycle guards.
- Rapier lifecycle management (dispose and re-init) → owned by PhysicsSystem; one world only.
- Interpolation desires vs. determinism → keep logic fixed-step; any interpolation must be visual-only and optional.

11. Roadmap Highlights
- Finalize and document collision masks and interaction groups.
- Re-enable heightfield once stable and integrated with grounded checks.
- Asset loading/disposal standardization; complete @ alias migration.
- Add feature flags for interpolation experimentation without violating determinism.

References
- Vision and goals: brief.md
- Overview: README.md
- Plan and session logs: TASKS.md