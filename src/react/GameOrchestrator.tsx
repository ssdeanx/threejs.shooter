import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';

import { EntityManager } from '@/core/EntityManager.js';
import { RenderSystem, TerrainHeightfield } from '@/systems/RenderSystem.js';
import { PhysicsSystem } from '@/systems/PhysicsSystem.js';
import { MovementSystem } from '@/systems/MovementSystem.js';
import { CameraSystem } from '@/systems/CameraSystem.js';
import { InputSystem } from '@/systems/InputSystem.js';
import { SoldierSystem } from '@/systems/SoldierSystem.js';
import { EntityManagerContext } from '@/react/ecs-bindings.js';
import { CombatSystem } from '@/systems/CombatSystem.js';
import { ScoringSystem } from '@/systems/ScoringSystem.js';
import { createWeaponComponent, createAimComponent, createScoreComponent } from '@/components/GameplayComponents.js';

/**
 * GameOrchestrator mounts inside R3F Canvas and owns the single authoritative loop via useFrame.
 * It wires ECS/Physics/Systems once, then steps them at a fixed 60 Hz accumulator inside useFrame.
 * Render is owned by R3F. RenderSystem remains write-only to ECS transforms/scene graph.
 */
export function GameOrchestrator() {
  const { scene, camera, gl } = useThree();
  // Provide the authoritative EntityManager to React children (bindings/hooks)
  // via context to avoid creating duplicate worlds.
  // We keep a single world constructed once and step it inside useFrame.
  const boot = useMemo(() => {
    const entityManager = new EntityManager();

    // Input
    const inputSystem = new InputSystem();

    // Scene/camera already provided by R3F
    // Enable shadows similarly to legacy main.ts
    gl.shadowMap.enabled = true;
    gl.shadowMap.type = THREE.PCFSoftShadowMap;

    // Systems
    const renderSystem = new RenderSystem(scene, entityManager);
    const hf: TerrainHeightfield | null = renderSystem.getHeightfield();

    const physicsSystem = new PhysicsSystem(entityManager);
    const movementSystem = new MovementSystem(entityManager, camera as THREE.PerspectiveCamera);
    movementSystem.setInputSystem(inputSystem);

    const cameraSystem = new CameraSystem(camera as THREE.PerspectiveCamera, entityManager, scene);
    const combatSystem = new CombatSystem(entityManager, scene, camera as THREE.PerspectiveCamera, inputSystem);
    const scoringSystem = new ScoringSystem();

    // Peer wiring
    movementSystem.setPhysicsSystem(physicsSystem);
    cameraSystem.setPhysicsSystem?.(physicsSystem);
    combatSystem.setPhysicsSystem?.(physicsSystem);

    // Canonical deterministic order (must match src/main.ts and .roo rules):
    // 1) Input
    // 2) Movement
    // 3) Physics
    // 4) Combat
    // 5) Scoring
    // 6) Camera
    // 7) Render
    entityManager.registerSystem(inputSystem);
    entityManager.registerSystem(movementSystem);
    entityManager.registerSystem(physicsSystem);
    entityManager.registerSystem(combatSystem);
    entityManager.registerSystem(scoringSystem);
    entityManager.registerSystem(cameraSystem);
    // 7) Render — ensure animation mixers and scene updates tick each frame
    entityManager.registerSystem(renderSystem);

    // Soldier visuals/animation (independent)
    const soldierSystem = new SoldierSystem(scene, entityManager);
    entityManager.registerSystem(soldierSystem);
    void soldierSystem.init();

    // Terrain entity mapped for physics raycasts
    const terrainEntity = entityManager.createEntity();
    entityManager.addComponent(terrainEntity, 'PositionComponent', { x: 0, y: 0, z: 0 });
    entityManager.addComponent(terrainEntity, 'RotationComponent', { x: 0, y: 0, z: 0, w: 1 });
    entityManager.addComponent(terrainEntity, 'TerrainColliderComponent', {
      kind: 'heightfield',
      rows: hf?.heights.length,
      cols: hf ? hf.heights[0]?.length : undefined,
      cellSize: hf?.elementSize
    });
    physicsSystem.setTerrainEntity(terrainEntity);

    // Player
    const playerEntity = entityManager.createEntity();
    entityManager.addComponent(playerEntity, 'PositionComponent', { x: 0, y: 3, z: 0 });
    entityManager.addComponent(playerEntity, 'RotationComponent', { x: 0, y: 0, z: 0, w: 1 });
    entityManager.addComponent(playerEntity, 'MeshComponent', {
      meshId: 'player',
      materialId: 'playerMaterial',
      visible: true
    });
    entityManager.addComponent(playerEntity, 'RigidBodyComponent', {
      kind: 'kinematicVelocity',
      linearDamping: 0.0,
      angularDamping: 0.0,
      gravityScale: 1,
      canSleep: true,
      ccd: false,
      lockRot: true
    });
    entityManager.addComponent(playerEntity, 'VelocityComponent', { x: 0, y: 0, z: 0 });
    entityManager.addComponent(playerEntity, 'PlayerControllerComponent', {
      moveSpeed: 5,
      sprintMultiplier: 1.5,
      jumpForce: 10,
      mouseSensitivity: 0.002
    });

    // Gameplay attachments
    entityManager.addComponent(playerEntity, 'WeaponComponent', createWeaponComponent(25, 10, 30, 100));
    entityManager.addComponent(playerEntity, 'AimComponent', createAimComponent(
      75, 55,
      { x: 0, y: 2, z: 5 },
      { x: 0.2, y: 1.9, z: 4.2 },
      0.02, 0.005
    ));
    entityManager.addComponent(playerEntity, 'ScoreComponent', createScoreComponent());

    // Camera component follows player
    const cameraEntity = entityManager.createEntity();
    entityManager.addComponent(cameraEntity, 'CameraComponent', {
      fov: 75,
      near: 0.1,
      far: 1000,
      target: playerEntity,
      offset: { x: 0, y: 2, z: 5 }
    });

    // Basic targets
    for (let i = 0; i < 3; i++) {
      const id = entityManager.createEntity();
      entityManager.addComponent(id, 'PositionComponent', {
        x: (i - 1) * 2,
        y: 5 + i,
        z: -3
      });
      entityManager.addComponent(id, 'RotationComponent', { x: 0, y: 0, z: 0, w: 1 });
      entityManager.addComponent(id, 'MeshComponent', {
        meshId: 'cube',
        materialId: `cubeMaterial${i}`,
        visible: true
      });
      entityManager.addComponent(id, 'RigidBodyComponent', {
        kind: 'dynamic',
        linearDamping: 0.15,
        angularDamping: 0.2,
        gravityScale: 1,
        canSleep: true,
        ccd: false
      });
      entityManager.addComponent(id, 'VelocityComponent', { x: 0, y: 0, z: 0 });
      entityManager.addComponent(id, 'HealthComponent', { current: 50, maximum: 50 });
    }

    // Initial camera placement
    (camera as THREE.PerspectiveCamera).position.set(0, 2, 5);
    (camera as THREE.PerspectiveCamera).lookAt(0, 1, 0);

    // Async Rapier init
    let rapierReady = false;
    (async () => {
      await physicsSystem.init(hf ?? null);
      rapierReady = true;
    })().catch((e) => {
      console.error('Physics init failed', e);
    });

    return {
      entityManager,
      physicsSystem,
      rapierReadyRef: { get ready() { return rapierReady; } },
    };
  }, []); // construct once

  // Fixed-step accumulator inside R3F's render loop
  // Single accumulator/loop lives here; do not introduce additional RAFs or direct WebGLRenderer renders.
  const accumulatorRef = useRef(0);
  const lastRef = useRef<number | null>(null);
  const FIXED_DT = 1 / 60;

  // Optional interpolation planning scaffold (disabled by default to keep authoritative visuals)
  // If enabled in the future, store previous and current transforms here and blend in view layer only.
  // Keeping this scaffold satisfies P2 planning without changing current behavior.
  const interpolation = useRef({
    enabled: false,
    alpha: 0, // blend factor for future visual interpolation
  });

  useFrame(({ clock }) => {
    // R3F already schedules render; we only step ECS/Physics deterministically
    const now = clock.getElapsedTime();
    if (lastRef.current == null) {
      lastRef.current = now;
      return;
    }
    let dt = now - lastRef.current;
    lastRef.current = now;

    // clamp dt to avoid spiral of death when tab resumes
    dt = Math.min(dt, 0.25);

    accumulatorRef.current += dt;

    // Only tick after Rapier is ready
    if (!(boot.rapierReadyRef.ready)) {
      return;
    }

    // Step fixed-update systems; CameraSystem receives the same R3F camera reference
    while (accumulatorRef.current >= FIXED_DT) {
      boot.entityManager.updateSystems(FIXED_DT);
      accumulatorRef.current -= FIXED_DT;
    }

    // Compute interpolation alpha for potential view-only smoothing (currently unused)
    if (interpolation.current.enabled) {
      interpolation.current.alpha = accumulatorRef.current / FIXED_DT;
    } else {
      interpolation.current.alpha = 0;
    }
  });

// Provide EntityManager to React subtree for view-only bindings.
// We don't add Three objects here because RenderSystem manages scene content.
return (
  <EntityManagerContext.Provider value={boot.entityManager}>
    <></>
  </EntityManagerContext.Provider>
);
}
