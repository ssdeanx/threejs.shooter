---
title: Game Rules
version: 1.0.0
lastUpdated: 2025-08-05
sourcePaths:
  - /src/**
---
Authoritative, code-sourced rules for gameplay systems and loop behavior observed under [src/](src:1). This document reflects what the game currently does — not future plans.

## Status Legend

- [*] Policy/Process — mandatory procedure
- [BP] Best‑Practice — required convention
- [HY] Hygiene — must be satisfied before work is considered complete

## Runtime Loop

- The entrypoint orchestrates a fixed‑step loop at 60 Hz in [src/main.ts](src/main.ts:175), rendering once per RAF.
- Deterministic system order (invoked by caller) in [src/main.ts](src/main.ts:63):
  1) Input
  2) Movement
  3) Physics
  4) Combat
  5) Scoring
  6) Camera
  7) Render

## Systems Responsibilities

## InputSystem

- Captures player input state for consumption by Movement and Combat.
- Registered first in [src/main.ts](src/main.ts:64).

## MovementSystem

- Consumes input and issues character movement intent.
- Integrates with Physics via kinematic/dynamic velocity APIs.
- Wired to Input and Physics in [src/main.ts](src/main.ts:55) and [src/main.ts](src/main.ts:61).

## PhysicsSystem

- Rapier‑based simulation; maps ECS components to rigid bodies/colliders.
- Fixed‑step tolerant; authoritative state sync back to ECS.
- APIs include init(...), update(...), setVelocity(...), applyImpulse(...), raycast(...). See [src/systems/PhysicsSystem.ts](src/systems/PhysicsSystem.ts:1).

## CombatSystem

- Handles weapon firing and hit/health interactions (targets have HealthComponent).
- Registered after Physics to ensure hits/raycasts see the latest state. See [src/main.ts](src/main.ts:67).

## ScoringSystem

- Updates score based on combat outcomes. Registered after Combat. See [src/main.ts](src/main.ts:68).

## CameraSystem

- Follows the player entity (third‑person offset); may accept collidable meshes to avoid clipping.
- Registered before Render and after gameplay systems. See [src/main.ts](src/main.ts:69).

## RenderSystem

- Creates/updates Three.js objects for entities with MeshComponent; sets up lighting and procedural terrain heightfield.
- Exposes getHeightfield() for physics initialization. See [src/systems/RenderSystem.ts](src/systems/RenderSystem.ts:38).
- Registered last among runtime systems. See [src/main.ts](src/main.ts:76).

## SoldierSystem

- Loads/animates rigged soldier GLB and attaches weapon GLB to expected sockets. See [src/systems/RenderSystem.ts](src/systems/RenderSystem.ts:248).
- Registered alongside other systems; init is kicked off asynchronously. See [src/main.ts](src/main.ts:71).

### Components In Play

- Transform: PositionComponent, RotationComponent, ScaleComponent [src/components/TransformComponents.ts](src/components/TransformComponents.ts:1)
- Physics: RigidBodyComponent, VelocityComponent, ColliderComponent [src/components/PhysicsComponents.ts](src/components/PhysicsComponents.ts:1)
- Rendering: MeshComponent, CameraComponent [src/components/RenderingComponents.ts](src/components/RenderingComponents.ts:1)
- Gameplay: HealthComponent, WeaponComponent, PlayerControllerComponent [src/components/GameplayComponents.ts](src/components/GameplayComponents.ts:1)
- Barrel exports: [src/components/index.ts](src/components/index.ts:1)

### World Setup

- Scene, camera, renderer, lights configured in [src/main.ts](src/main.ts:25).
- Visual ground mesh and procedural heightfield produced in [src/systems/RenderSystem.ts](src/systems/RenderSystem.ts:81) and consumed by Physics via getHeightfield() at init [src/main.ts](src/main.ts:191).

### Player Entity (observed)

- Created in [src/main.ts](src/main.ts:93) with Position, Rotation, Mesh(player), RigidBody(kinematicVelocity), Velocity, PlayerController, Weapon, Aim, Score.
- Camera entity follows player via CameraComponent targeting the player [src/main.ts](src/main.ts:128).

### Targets (observed)

- Simple cubes created with Position, Rotation, Mesh(cube), RigidBody(dynamic), Velocity, Health [src/main.ts](src/main.ts:138).

### Physics & Movement Behavior

- Kinematic player control uses setNextKinematicTranslation per tick under fixed dt; yaw is preserved to keep character upright [src/systems/PhysicsSystem.ts](src/systems/PhysicsSystem.ts:150).
- Dynamics use setLinvel/applyImpulse; transforms and velocities are written back to ECS every step [src/systems/PhysicsSystem.ts](src/systems/PhysicsSystem.ts:114).

### Rendering Behavior

- Shadow‑capable directional/ambient/hemisphere lighting with sane defaults [src/systems/RenderSystem.ts](src/systems/RenderSystem.ts:48).
- GLB soldier load with animation mixer and M4A1 attachment to common hand socket names [src/systems/RenderSystem.ts](src/systems/RenderSystem.ts:247).

### Asset Usage (runtime)

- GLBs loaded from [assets/models/...](assets/models/targets:1) via GLTFLoader [src/systems/RenderSystem.ts](src/systems/RenderSystem.ts:216).
- Prefer castShadow/receiveShadow set for meshes [src/systems/RenderSystem.ts](src/systems/RenderSystem.ts:223).

### Change Control

- [*] Keep deterministic order unchanged unless code updates all call sites coherently in the same change.
- [HY] No stubs/partials; systems must be fully wired and clean under lint/type‑check.

### References

- Entry and loop: [src/main.ts](src/main.ts:1)
- Systems: [src/systems/index.ts](src/systems/index.ts:1) and individual system files
- Components: [src/components/index.ts](src/components/index.ts:1)
