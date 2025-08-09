import { useMemo, useRef, useContext, createContext, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useRapier } from '@react-three/rapier';

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
import { WeaponSystem } from '@/systems/WeaponSystem.js';
import { WaveSystem } from '@/systems/WaveSystem.js';
import { SpawnerSystem } from '@/systems/SpawnerSystem.js';
import { RecorderSystem } from '@/systems/RecorderSystem.js';
import { createWeaponComponent, createWeaponOwnerComponent, createAimComponent, createScoreComponent, createEnemyComponent, createWeakpointComponent, createSpawnerComponent, createSpawnRequest } from '@/components/GameplayComponents.js';
import type { PositionComponent } from '@/components/TransformComponents.js';
import type { VelocityComponent } from '@/components/PhysicsComponents.js';
import { createCuboidCollider } from '@/components/PhysicsComponents.js';
import { CollisionLayers, interactionGroup } from '@/core/CollisionLayers.js';

/**
 * GameOrchestrator mounts inside R3F Canvas and owns the single authoritative loop via useFrame.
 * It wires ECS/Physics/Systems once, then steps them at a fixed 60 Hz accumulator inside useFrame.
 * Render is owned by R3F. RenderSystem remains write-only to ECS transforms/scene graph.
 */
interface BootContext {
  entityManager: EntityManager;
  physicsSystem: PhysicsSystem;
  recorderSystem: RecorderSystem;
  inputSystem: InputSystem;
  rapierReadyRef: { readonly ready: boolean };
  playerEntity: number;
}
const GameOrchestratorContext = createContext<BootContext | null>(null);

export const useGameOrchestrator = (): BootContext | null => {
  return useContext(GameOrchestratorContext);
};

export function GameOrchestrator() {
  const { scene, camera, gl } = useThree();
  // Read Rapier world/provider from R3R <Physics> context (already mounted in App.tsx)
  const { world, rapier } = useRapier();
  // Provide the authoritative EntityManager to React children (bindings/hooks)
  // via context to avoid creating duplicate worlds.
  // We keep a single world constructed once and step it inside useFrame.
  const boot = useMemo(() => {
    const entityManager = new EntityManager();

    // Input
    const inputSystem = new InputSystem();
    // Attach input listeners once to the R3F canvas so keys/mouse are captured.
    // This fixes the "can't move" issue when InputSystem isn't wired to any DOM element.
    // Safe to do at boot since gl.domElement is stable for the Canvas lifetime.
    inputSystem.attach(gl.domElement);

    // Scene/camera already provided by R3F
    // Enable shadows similarly to legacy main.ts
    gl.shadowMap.enabled = true;
    gl.shadowMap.type = THREE.PCFSoftShadowMap;

    // Ensure a sane initial camera so we see the flat green ground immediately
    // This runs once at boot, before physics is ready and before CameraSystem adjusts follow/aim.
    // Keep outside of per-frame paths to avoid churn.
    const cam = camera as THREE.PerspectiveCamera;
    if (cam) {
      cam.position.set(0, 6, 10);
      cam.up.set(0, 1, 0);
      cam.lookAt(new THREE.Vector3(0, 0, 0));
    }

    // Systems
    const renderSystem = new RenderSystem(scene, entityManager);
    // IMPORTANT: ensure the visual terrain/heightfield exists before physics init.
    // RenderSystem.createVisualGround() runs in its constructor, so heightfield is available now.
    const hf: TerrainHeightfield | null = renderSystem.getHeightfield();

    const physicsSystem = new PhysicsSystem(entityManager);
    const movementSystem = new MovementSystem(entityManager, camera as THREE.PerspectiveCamera);
    movementSystem.setInputSystem(inputSystem);

    const cameraSystem = new CameraSystem(camera as THREE.PerspectiveCamera, entityManager, scene);
    cameraSystem.setInputSystem(inputSystem);
    const combatSystem = new CombatSystem(entityManager, scene, camera as THREE.PerspectiveCamera, inputSystem);
    combatSystem.setRenderSystem(renderSystem);
    const scoringSystem = new ScoringSystem();
    const recorderSystem = new RecorderSystem(entityManager, inputSystem);
    const weaponSystem = new WeaponSystem(entityManager, inputSystem);
    const waveSystem = new WaveSystem(entityManager);
    const spawnerSystem = new SpawnerSystem(entityManager);

    // Peer wiring
    movementSystem.setPhysicsSystem(physicsSystem);
    cameraSystem.setPhysicsSystem?.(physicsSystem);
    combatSystem.setPhysicsSystem?.(physicsSystem);

    // Canonical deterministic order (must match src/main.ts and .roo rules):
    // 1) Input
    // 2) Movement
    // 3) Physics
    // 4) Weapon
    // 5) Combat
    // 6) Scoring
    // 7) Wave (progression/meta)
    // 8) Spawner (generic object spawns)
    // 9) Camera
    // 10) Render
    entityManager.registerSystem(inputSystem);
    entityManager.registerSystem(recorderSystem);
    entityManager.registerSystem(movementSystem);
    entityManager.registerSystem(physicsSystem);
    entityManager.registerSystem(weaponSystem);
    entityManager.registerSystem(combatSystem);
    entityManager.registerSystem(scoringSystem);
    entityManager.registerSystem(waveSystem);
    entityManager.registerSystem(spawnerSystem);
    entityManager.registerSystem(cameraSystem);
    // Render — ensure animation mixers and scene updates tick each frame
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
    // Weapon ownership metadata for modular upgrades (scopes/grips/stocks/etc.)
    entityManager.addComponent(playerEntity, 'WeaponOwnerComponent', createWeaponOwnerComponent(playerEntity));
    entityManager.addComponent(playerEntity, 'AimComponent', createAimComponent(
      75, 55,
      { x: 0, y: 2, z: 5 },
      { x: 0.2, y: 1.9, z: 4.2 },
      0.02,
      0.005
    ));
    cameraSystem.setAimSource(playerEntity);
    entityManager.addComponent(playerEntity, 'ScoreComponent', createScoreComponent());
    // Ensure Soldier visuals follow the player entity
    soldierSystem.setTarget(playerEntity);

    // Camera component follows player
    const cameraEntity = entityManager.createEntity();
    entityManager.addComponent(cameraEntity, 'CameraComponent', {
      fov: 75,
      near: 0.1,
      far: 1000,
      target: playerEntity,
      offset: { x: 0, y: 2, z: 5 }
    });

    // Helper: spawn an enemy target prefab (box) — easy drop-in
    const spawnEnemyTarget = (x: number, y: number, z: number, materialId: string): number => {
      const eid = entityManager.createEntity();
      entityManager.addComponent(eid, 'PositionComponent', { x, y, z });
      entityManager.addComponent(eid, 'RotationComponent', { x: 0, y: 0, z: 0, w: 1 });
      entityManager.addComponent(eid, 'MeshComponent', { meshId: 'cube', materialId, visible: true });
      entityManager.addComponent(eid, 'RigidBodyComponent', {
        kind: 'dynamic',
        linearDamping: 0.15,
        angularDamping: 0.2,
        gravityScale: 1,
        canSleep: true,
        ccd: false
      });
      // Explicit box collider matching unit cube; ENEMY membership, collides with PLAYER|ENV
      const groups = interactionGroup(Number(CollisionLayers.ENEMY), Number(CollisionLayers.PLAYER | CollisionLayers.ENV));
      entityManager.addComponent(eid, 'ColliderComponent', createCuboidCollider({ x: 0.5, y: 0.5, z: 0.5 }, {
        collisionGroups: groups,
        solverGroups: groups,
      }));
      entityManager.addComponent(eid, 'VelocityComponent', { x: 0, y: 0, z: 0 });
      entityManager.addComponent(eid, 'HealthComponent', { current: 50, maximum: 50 });
      entityManager.addComponent(eid, 'EnemyComponent', createEnemyComponent());
      // Add head weakpoint: small sphere offset upward
      entityManager.addComponent(eid, 'WeakpointComponent', createWeakpointComponent({ x: 0, y: 0.6, z: 0 }, 0.22, 2.0));
      return eid;
    };

    // Seed a few enemies up front
    spawnEnemyTarget(-2, 6, -6, 'cubeMaterial0');
    spawnEnemyTarget(0, 7, -8, 'cubeMaterial1');
    spawnEnemyTarget(2, 6, -10, 'cubeMaterial2');

    // Seed a generic spawner that will maintain up to 3 alive enemies with a short cooldown
    const spawner = entityManager.createEntity();
    entityManager.addComponent(spawner, 'PositionComponent', { x: 4, y: 6, z: -12 });
    entityManager.addComponent(spawner, 'RotationComponent', { x: 0, y: 0, z: 0, w: 1 });
    entityManager.addComponent(spawner, 'SpawnerComponent', createSpawnerComponent('enemy', 3, 1.5));
    // Kick it once to spawn immediately on boot (one-shot request)
    entityManager.addComponent(spawner, 'SpawnRequestComponent', createSpawnRequest(2));

    // GLB steel target prefab
    const spawnSteelTarget = (x: number, y: number, z: number): number => {
      const eid = entityManager.createEntity();
      entityManager.addComponent(eid, 'PositionComponent', { x, y, z });
      entityManager.addComponent(eid, 'RotationComponent', { x: 0, y: 0, z: 0, w: 1 });
      entityManager.addComponent(eid, 'MeshComponent', { meshId: 'steel_target', materialId: 'steel_target_mat', visible: true });
      entityManager.addComponent(eid, 'RigidBodyComponent', {
        kind: 'dynamic',
        linearDamping: 0.2,
        angularDamping: 0.25,
        gravityScale: 1,
        canSleep: true,
        ccd: false
      });
      const groups = interactionGroup(Number(CollisionLayers.ENEMY), Number(CollisionLayers.PLAYER | CollisionLayers.ENV));
      entityManager.addComponent(eid, 'ColliderComponent', createCuboidCollider({ x: 0.5, y: 0.8, z: 0.2 }, {
        collisionGroups: groups,
        solverGroups: groups,
      }));
      entityManager.addComponent(eid, 'VelocityComponent', { x: 0, y: 0, z: 0 });
      entityManager.addComponent(eid, 'HealthComponent', { current: 60, maximum: 60 });
      entityManager.addComponent(eid, 'EnemyComponent', createEnemyComponent());
      entityManager.addComponent(eid, 'WeakpointComponent', createWeakpointComponent({ x: 0, y: 1.2, z: 0 }, 0.18, 2.0));
      return eid;
    };

    spawnSteelTarget(4, 6, -12);

    // Initial camera placement
    (camera as THREE.PerspectiveCamera).position.set(0, 2, 5);
    (camera as THREE.PerspectiveCamera).lookAt(0, 1, 0);

    // Attach to provider world; avoid creating a second Rapier world
    let rapierReady = false;
    console.log('[BOOT] Attaching to provider Rapier world…');
    try {
      // Provide our PhysicsSystem with the live world (attach accepts unknown and validates)
      physicsSystem.attach(world, rapier);
      rapierReady = true;
      console.log('[BOOT] Physics attached (provider world)');

      // Snap player after world is available
      const {entities} = entityManager as unknown as { entities?: Set<number> };
      let snapped = false;
      if (entities && entities.size > 0) {
        for (const eid of entities) {
          const pc = entityManager.getComponent(eid, 'PlayerControllerComponent');
          const pos = entityManager.getComponent<PositionComponent>(eid, 'PositionComponent');
          const rb = entityManager.getComponent(eid, 'RigidBodyComponent');
          if (pc && pos && rb) {
            const origin = new THREE.Vector3(pos.x, pos.y + 2, pos.z);
            const dir = new THREE.Vector3(0, -1, 0);
            const hit = physicsSystem.raycast(origin, dir, 50, true);
            console.log('[BOOT] Player ground raycast:', {
              origin: origin.toArray(),
              hit: !!hit,
              point: hit?.point && hit.point.toArray(),
              normal: hit?.normal && hit.normal.toArray(),
              toi: hit?.toi
            });
            if (hit) {
              pos.x = hit.point.x;
              pos.y = hit.point.y + 0.9;
              pos.z = hit.point.z;
              const vel = entityManager.getComponent<VelocityComponent>(eid, 'VelocityComponent');
              if (vel) { vel.x = 0; vel.y = 0; vel.z = 0; }
              snapped = true;
            }
            console.log('[BOOT] Player spawn pos after snap:', { x: pos.x, y: pos.y, z: pos.z }, { snapped });
            break;
          }
        }
      } else {
        console.warn('[BOOT] No entities set found to snap player');
      }
    } catch (e) {
      console.error('[BOOT] Physics attach failed', e);
    }

    return {
      entityManager,
      physicsSystem,
      recorderSystem,
      inputSystem,
      rapierReadyRef: { get ready() { return rapierReady; } },
      playerEntity,
    };
  }, []); // construct once

  // Detach input listeners on unmount to avoid leaks
  useEffect(() => {
    return () => {
      boot?.inputSystem.detach();
    };
  }, [boot]);

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
    if (!boot.inputSystem.getInputState().isPaused) {
      while (accumulatorRef.current >= FIXED_DT) {
        boot.entityManager.updateSystems(FIXED_DT);
        accumulatorRef.current -= FIXED_DT;
      }
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
  <GameOrchestratorContext.Provider value={boot}>
    <EntityManagerContext.Provider value={boot.entityManager}>
      <></>
    </EntityManagerContext.Provider>
  </GameOrchestratorContext.Provider>
);
}
