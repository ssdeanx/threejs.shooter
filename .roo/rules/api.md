---
title: API Rules
version: 1.0.0
lastUpdated: 2025-08-05
sourcePaths:
  - /src/**
---
Scope
High-level, code-sourced description of public APIs exposed by systems/components under [src/](src:1). This documents stable entry points used by the game loop and other systems. No speculative or task-planning content.

## Status Legend

- [*] Policy/Process — mandatory procedure
- [BP] Best‑Practice — required convention

## ECS Core Contracts

- Entity lifecycle and update order are orchestrated from [src/main.ts](src/main.ts:63) with a fixed-step loop at [src/main.ts](src/main.ts:175).
- Systems implement a uniform update(deltaTime, entities) contract derived from the base [System](src/core/System.ts:1).
- The world registry is managed by [EntityManager](src/core/EntityManager.ts:1).

## EntityManager

Authoritative API for entity/component composition used throughout systems.

Stable usage reflected in code:

- createEntity(): number
- addComponent(entityId, componentName, componentData): void
- getComponent<T>(entityId, componentName): T | undefined
- registerSystem(system): void
- updateSystems(dt): void

References:

- Composition and queries are used in [src/systems/PhysicsSystem.ts](src/systems/PhysicsSystem.ts:70), [src/systems/RenderSystem.ts](src/systems/RenderSystem.ts:157), and [src/main.ts](src/main.ts:63).

## Systems APIs

Systems expose constructor/init methods and select helpers called by peers or main. The canonical deterministic call order is enforced by main.

## PhysicsSystem

Location: [src/systems/PhysicsSystem.ts](src/systems/PhysicsSystem.ts:1)

Purpose: Integrates Rapier physics world, maps ECS components to rigid bodies/colliders, steps simulation, and writes transforms/velocities back into ECS.

Public surface (stable in code):

- constructor(entityManager)
- init(heightfield?: TerrainHeightfield | null, gravity?: Vec3): Promise<void> [src/systems/PhysicsSystem.ts](src/systems/PhysicsSystem.ts:45)
- update(deltaTime: number, entities: EntityId[]): void [src/systems/PhysicsSystem.ts](src/systems/PhysicsSystem.ts:70)
- setVelocity(entityId: EntityId, velocity: THREE.Vector3): void [src/systems/PhysicsSystem.ts](src/systems/PhysicsSystem.ts:139)
- applyImpulse(entityId: EntityId, impulse: THREE.Vector3, wake = true): void [src/systems/PhysicsSystem.ts](src/systems/PhysicsSystem.ts:166)
- raycast(origin: THREE.Vector3, dir: THREE.Vector3, maxToi = 1000, solid = true, filterGroups?: number): { entity: EntityId | null; toi: number; point: THREE.Vector3; normal: THREE.Vector3 } | null [src/systems/PhysicsSystem.ts](src/systems/PhysicsSystem.ts:179)

Behavioral notes:

- Fixed-step 60 Hz internally tolerant to variable dt; authoritative accumulator lives in main. See [src/main.ts](src/main.ts:175).
- ECS ↔ physics mapping via handle maps. See [src/systems/PhysicsSystem.ts](src/systems/PhysicsSystem.ts:20).
- Colliders created from ColliderComponent if present; defaults to capsule otherwise. See [src/systems/PhysicsSystem.ts](src/systems/PhysicsSystem.ts:244).

## RenderSystem

Location: [src/systems/RenderSystem.ts](src/systems/RenderSystem.ts:1)

Purpose: Creates and updates Three.js objects for entities with MeshComponent; sets up lighting and builds a procedural terrain heightfield.

Public surface:

- constructor(scene: THREE.Scene, entityManager: EntityManager)
- getHeightfield(): TerrainHeightfield | null [src/systems/RenderSystem.ts](src/systems/RenderSystem.ts:38)
- update(deltaTime: number, entities: EntityId[]): void [src/systems/RenderSystem.ts](src/systems/RenderSystem.ts:157)
- removeEntityMesh(entityId: EntityId): void [src/systems/RenderSystem.ts](src/systems/RenderSystem.ts:341)

Notes:

- GLB loading for soldier and weapon with animation mixer wiring. See [src/systems/RenderSystem.ts](src/systems/RenderSystem.ts:206).
- Heightfield data exposed for physics initialization. See [src/systems/RenderSystem.ts](src/systems/RenderSystem.ts:39).

## Other Systems

- InputSystem, MovementSystem, CameraSystem, CombatSystem, ScoringSystem, SoldierSystem exist and are registered in order in [src/main.ts](src/main.ts:63). Their update contracts follow System base; specific public functions used by peers include:
  - MovementSystem.setInputSystem(inputSystem) and setPhysicsSystem(physicsSystem) as seen in [src/main.ts](src/main.ts:55) and [src/main.ts](src/main.ts:61).
  - CameraSystem potentially exposes addCollidable(mesh) pattern consumed in [src/main.ts](src/main.ts:88).

### Components APIs

Components are plain structured data with factory helpers. They do not import Three.js and are typed for ECS/Physics interop.

- PhysicsComponents: Vec3, VelocityComponent, RigidBodyComponent, ColliderComponent, CharacterControllerComponent, and factory helpers createRigidBodyComponent, createCuboidCollider, createBallCollider, createCapsuleCollider, createTrimeshCollider, createHeightfieldCollider [src/components/PhysicsComponents.ts](src/components/PhysicsComponents.ts:1).
- TransformComponents: PositionComponent, RotationComponent, ScaleComponent and factory helpers [src/components/TransformComponents.ts](src/components/TransformComponents.ts:1).
- RenderingComponents: MeshComponent, CameraComponent and factory helpers [src/components/RenderingComponents.ts](src/components/RenderingComponents.ts:1).
- GameplayComponents: HealthComponent, WeaponComponent, PlayerControllerComponent and factory helpers [src/components/GameplayComponents.ts](src/components/GameplayComponents.ts:1).
- Barrel exports for ergonomics in [src/components/index.ts](src/components/index.ts:1).

### Main Entry API

The application initializes and wires systems, then starts a RAF-driven loop with a fixed 60 Hz accumulator:

- Canvas acquisition and scene/camera/renderer setup [src/main.ts](src/main.ts:18)
- System construction/registration in deterministic order [src/main.ts](src/main.ts:63)
- Await physics init before entering loop [src/main.ts](src/main.ts:189)
- Accumulator stepping and render [src/main.ts](src/main.ts:193)

### Stability and Change Control

- Public APIs documented here must remain compatible with their call sites across [src/](src:1). If a signature change is necessary, update references and this file within the same change.
- New public APIs must be used by game code in the same PR/change set and lint/type-check clean before merge.

### References

- Systems: [src/systems/index.ts](src/systems/index.ts:1) and individual files.
- Components: [src/components/index.ts](src/components/index.ts:1) and individual files.
- Entry: [src/main.ts](src/main.ts:1)
