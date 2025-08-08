# Architecture — Three.js Shooter • ECS + Rapier Prototype

Status: Draft
Owner: You (developer-maintained)
Last Updated: 2025-08-07

1. System Architecture (High Level)
- One deterministic simulation loop hosted in React Three Fiber via GameOrchestrator.useFrame (fixed-step accumulator).
- Authoritative ECS owns state: entities (numeric IDs), components in sparse stores, systems operating in a strict order.
- Single Rapier physics world owned by PhysicsSystem; all collision, raycast, and dynamics go through it.
- Rendering layer maps ECS transforms to Three objects; React is orchestration/view-only (no React-driven game state mutation).

2. Source Code Map (Key Paths)
- Orchestration: src/react/GameOrchestrator.tsx
- React App Entry: src/react/App.tsx, src/react/main.tsx
- React Bindings (read-only): src/react/ecs-bindings.ts
- Post Processing: src/react/PostFX.tsx
- ECS Core: src/core/EntityManager.ts, src/core/System.ts, src/core/types.ts, src/core/CollisionLayers.ts, src/core/ComponentType.ts
- Systems:
  - Input: src/systems/InputSystem.ts
  - Movement: src/systems/MovementSystem.ts
  - Physics: src/systems/PhysicsSystem.ts
  - Combat: src/systems/CombatSystem.ts
  - Scoring: src/systems/ScoringSystem.ts
  - Camera: src/systems/CameraSystem.ts
  - Soldier/Animation: src/systems/SoldierSystem.ts
  - Render: src/systems/RenderSystem.ts
- Components: src/components/* (TransformComponents.ts, PhysicsComponents.ts, RenderingComponents.ts, GameplayComponents.ts, index.ts)

3. Deterministic Loop and Order
- Loop host: GameOrchestrator.useFrame with accumulator advancing the sim in fixed 1/60 s steps.
- Authoritative system order per step:
  1) Input
  2) Movement
  3) Physics
  4) Combat
  5) Scoring
  6) Camera
  7) Render
- Only the accumulator advances time; there must be no secondary time sources.

4. ECS Design
- Entities: numeric IDs allocated by EntityManager.
- Components: sparse arrays/maps keyed by component type for cache-friendly iteration.
- Queries: each System declares required components; EntityManager builds archetype bitmasks to match entities quickly.
- Ownership: ECS is the single owner of game state; systems mutate ECS components; React reads.

5. Physics Integration (Rapier)
- Access: @react-three/rapier runtime namespace; types isolated to keep integration simple.
- Lifecycle: PhysicsSystem creates and owns the Rapier world; ensures single-world policy and proper disposal on teardown.
- Services:
  - Body and collider creation (terrain, player, enemies, bullets)
  - Raycasting (ground probe, hitscan, camera occlusion)
  - Dynamics helpers (setVelocity, applyImpulse)
  - Interaction groups/collision layers configuration
  - Entity ↔ rigid body/collider mapping
- Grounding: MovementSystem performs multi-ray probes against ENV to determine grounded, slope normal, and projection plane.
- Heightfield: temporarily disabled; flat ground collider active; re-enable plan tracked in TASKS.md.

6. Rendering and Assets
- RenderSystem maintains Three objects for visible entities, updates transforms from ECS each frame after simulation step(s).
- Lighting and scene setup handled centrally in RenderSystem.
- Asset loading: soldier GLB and weapon attachment; animation mixer updates post-sim.
- PostFX: R3F post-processing scaffold in PostFX.tsx integrated at the React layer.
- Rule: rendering reads ECS; it does not mutate ECS during the simulation step.

7. Collision Layers and Interaction Groups
- Layers: PLAYER, ENEMY, ENV, CAMERA_BLOCKER, BULLET.
- Implementation: 16-bit masks configured through Rapier interaction groups.
- Filters by feature:
  - Grounded probe: ENV
  - Hitscan: ENEMY | ENV (block by environment and hit enemies)
  - Camera occlusion: CAMERA_BLOCKER
- Enforcement: all systems using raycasts/collisions must request appropriate groups consistently.

8. React Integration Principles
- React coordinates creation of ECS world and Three scene; ECS state is never owned by React state hooks.
- StrictMode considerations: guard against duplicate setup; ensure single Orchestrator and single Physics world.
- Read-only bindings (ecs-bindings) expose ECS transforms for React components to render.

9. Critical Implementation Paths
- Startup:
  - GameOrchestrator constructs EntityManager and Systems once.
  - PhysicsSystem initializes Rapier world; flat ground collider created.
  - Entities spawned: terrain, player, camera rig; player snapped to ground via raycast.
- Frame:
  - Accumulator advances with elapsed render time.
  - For each fixed step: run systems in canonical order.
  - After sim updates, RenderSystem updates Three objects and animation mixers.

10. Key Technical Decisions
- One-world policy for physics; no multiple Rapier worlds in the same scene.
- Deterministic fixed-step loop inside R3F; render FPS does not affect logic outcomes.
- ECS authoritative over state; React is view-only orchestration and rendering.
- Hygiene policy: no unused exports, no stubs/partials, strict typing; merges must keep the codebase clean.

11. Risks and Mitigations
- Duplicate loops (e.g., StrictMode): centralize setup, use guards, verify single useFrame driver.
- Rapier lifecycle leaks: PhysicsSystem owns and disposes; verify teardown on unmount/reinit.
- Mask misconfiguration: consolidate constants (CollisionLayers.ts); add helper to standardize groups; verify in systems.
- Interpolation pressure: keep logic fixed-step; gate any visual interpolation behind flags without state mutation.

12. Extension Points
- Adding a new System: declare component requirements and insert into the ordered pipeline; ensure side-effects are scoped.
- New collider/layer: update CollisionLayers.ts, configure interaction groups, and update any raycast filters and creation sites.
- New asset: add GLB with useGlbAsset hook; introduce component for asset binding; update RenderSystem to attach and animate.
- Feature flags: add simple config module read by Orchestrator/Render to toggle visual-only experiments.

References
- Orchestrator: src/react/GameOrchestrator.tsx
- ECS Core: src/core/EntityManager.ts, src/core/System.ts, src/core/types.ts
- Physics: src/systems/PhysicsSystem.ts
- Movement: src/systems/MovementSystem.ts
- Camera: src/systems/CameraSystem.ts
- Combat: src/systems/CombatSystem.ts
- Render: src/systems/RenderSystem.ts
- Collision Layers: src/core/CollisionLayers.ts
- Bindings: src/react/ecs-bindings.ts
- PostFX: src/react/PostFX.tsx