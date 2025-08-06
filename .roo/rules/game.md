---
title: Game Rules
version: 1.1.0
lastUpdated: 2025-08-06
sourcePaths:
  - /src/**
---
Authoritative, code-sourced rules for gameplay systems and loop behavior observed under [src/](src:1). Reflects current React-driven orchestration.

## Status Legend

- [*] Policy/Process — mandatory procedure
- [BP] Best‑Practice — required convention
- [HY] Hygiene — must be satisfied before work is considered complete

## Runtime Model

- The app boots via [src/main.ts](src/main.ts:1) which imports [src/react/main.tsx](src/react/main.tsx:1).
- Deterministic system order is enforced by the React orchestrator in [src/react/GameOrchestrator.tsx](src/react/GameOrchestrator.tsx:55):
  1) Input
  2) Movement
  3) Physics
  4) Combat
  5) Scoring
  6) Camera
  7) Render
- Systems are stepped at fixed 60 Hz using a single accumulator inside the orchestrator’s [useFrame](src/react/GameOrchestrator.tsx:181). Systems must tolerate variable frame dt but are stepped at fixed dt by the orchestrator.

## Systems Responsibilities

### InputSystem

- Captures player input state for consumption by Movement and Combat.
- Registered first by the orchestrator (see [src/react/GameOrchestrator.tsx](src/react/GameOrchestrator.tsx:63)).

### MovementSystem

- Consumes input and issues character movement intent.
- Integrates with Physics via kinematic/dynamic velocity APIs.
- Wired to Input and Physics by the orchestrator (see [src/react/GameOrchestrator.tsx](src/react/GameOrchestrator.tsx:44), [src/react/GameOrchestrator.tsx](src/react/GameOrchestrator.tsx:51)).

### PhysicsSystem

- Rapier-based simulation; maps ECS components to rigid bodies/colliders.
- Authoritative state sync back to ECS on each update.
- Public APIs include init(...), update(...), setVelocity(...), applyImpulse(...), raycast(...). See [src/systems/PhysicsSystem.ts](src/systems/PhysicsSystem.ts:1).

### CombatSystem

- Handles weapon firing and hit/health interactions (targets have HealthComponent).
- Runs after Physics so raycasts/collisions use latest state.

### ScoringSystem

- Updates score based on combat outcomes. Runs after Combat.

### CameraSystem

- Follows the player entity (third‑person offset); may accept collidable meshes to avoid clipping.
- Runs after gameplay systems, before Render.

### RenderSystem

- Creates/updates Three.js objects for entities with MeshComponent; sets up lighting and procedural terrain heightfield.
- Exposes getHeightfield() for physics initialization. See [src/systems/RenderSystem.ts](src/systems/RenderSystem.ts:38).
- Runs after all other systems as the final step.

### SoldierSystem

- Loads/animates rigged soldier GLB and attaches weapon GLB to expected sockets. See [src/systems/RenderSystem.ts](src/systems/RenderSystem.ts:248).
- Registered and stepped under the orchestrator lifecycle.

## Components In Play

- Transform: PositionComponent, RotationComponent, ScaleComponent [src/components/TransformComponents.ts](src/components/TransformComponents.ts:1)
- Physics: RigidBodyComponent, VelocityComponent, ColliderComponent [src/components/PhysicsComponents.ts](src/components/PhysicsComponents.ts:1)
- Rendering: MeshComponent, CameraComponent [src/components/RenderingComponents.ts](src/components/RenderingComponents.ts:1)
- Gameplay: HealthComponent, WeaponComponent, PlayerControllerComponent [src/components/GameplayComponents.ts](src/components/GameplayComponents.ts:1)
- Barrel exports: [src/components/index.ts](src/components/index.ts:1)

## World Setup

- Scene/camera/renderer are owned by R3F; ECS wiring and stepping live in the orchestrator.
- Visual ground mesh and procedural heightfield are produced in [src/systems/RenderSystem.ts](src/systems/RenderSystem.ts:81); Physics consumes heightfield during init [src/systems/PhysicsSystem.ts](src/systems/PhysicsSystem.ts:45).

## Player and Targets (observed)

- Player entity composition and Camera follow are wired by the orchestrator (see [src/react/GameOrchestrator.tsx](src/react/GameOrchestrator.tsx:89)).
- Targets are created as simple dynamic bodies with Health; see [src/react/GameOrchestrator.tsx](src/react/GameOrchestrator.tsx:135).

## Change Control

- [*] Keep deterministic order unchanged unless code updates all call sites coherently in the same change.
- [HY] No stubs/partials; systems must be fully wired and clean under lint/type‑check.

### References

- React entry/orchestrator: [src/react/main.tsx](src/react/main.tsx:1), [src/react/GameOrchestrator.tsx](src/react/GameOrchestrator.tsx:1)
- Systems: [src/systems/index.ts](src/systems/index.ts:1)
- Components: [src/components/index.ts](src/components/index.ts:1)
