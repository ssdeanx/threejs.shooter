import * as THREE from 'three';
import { EntityManager } from './core/EntityManager.js';
import { RenderSystem, TerrainHeightfield } from './systems/RenderSystem.js';
import { PhysicsSystem } from './systems/PhysicsSystem.js';
import { MovementSystem } from './systems/MovementSystem.js';
import { CameraSystem } from './systems/CameraSystem.js';
import { InputSystem } from './systems/InputSystem.js';
import { SoldierSystem } from './systems/SoldierSystem.js';
import { CombatSystem } from './systems/CombatSystem.js';
import { ScoringSystem } from './systems/ScoringSystem.js';
import { createWeaponComponent, createAimComponent, createScoreComponent } from './components/GameplayComponents.js';

console.log('Three.js Shooter - Starting...');

// Initialize ECS
const entityManager = new EntityManager();

// Get canvas
const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
if (!canvas) {
    console.error('Canvas not found!');
    throw new Error('Canvas not found');
}

/** Create scene, camera, renderer */
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// Add lighting
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 10, 5);
directionalLight.castShadow = true;
scene.add(directionalLight);

const ambientLight = new THREE.AmbientLight(0x404040, 0.3);
scene.add(ambientLight);

/**
 * Initialize systems in correct update order:
 * Input -> Movement -> Physics -> Combat -> Scoring -> Camera -> Render
 */
const inputSystem = new InputSystem();
const renderSystem = new RenderSystem(scene, entityManager);
/**
 * Initialize Rapier-based PhysicsSystem and await WASM init.
 * Pass typed heightfield from RenderSystem.
 */
const hf: TerrainHeightfield | null = renderSystem.getHeightfield();
const physicsSystem = new PhysicsSystem(entityManager);
const movementSystem = new MovementSystem(entityManager, camera);
movementSystem.setInputSystem(inputSystem);
const cameraSystem = new CameraSystem(camera, entityManager, scene);
const combatSystem = new CombatSystem(entityManager, scene, camera, inputSystem);
const scoringSystem = new ScoringSystem();

// Connect movement system with physics system
movementSystem.setPhysicsSystem(physicsSystem);

// Register systems in update order
entityManager.registerSystem(inputSystem);
entityManager.registerSystem(movementSystem);
entityManager.registerSystem(physicsSystem);
entityManager.registerSystem(combatSystem);
entityManager.registerSystem(scoringSystem);
entityManager.registerSystem(cameraSystem);
// Soldier system: loads, animates, and updates the rigged character without touching RenderSystem
const soldierSystem = new SoldierSystem(scene, entityManager);
entityManager.registerSystem(soldierSystem);

// Kick off async initialization to load GLBs and start Idle animation with M4A1 attachment
void soldierSystem.init();
entityManager.registerSystem(renderSystem);

/**
 * Create ground (static Three.js object)
 * Also register as a camera collidable to prevent camera clipping.
 */
const groundGeometry = new THREE.PlaneGeometry(50, 50);
const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x7CFC00 });
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);
if (typeof (cameraSystem as any).addCollidable === 'function') {
  (cameraSystem as any).addCollidable(ground);
}

 // Create player entity with physics and movement
const playerEntity = entityManager.createEntity();
entityManager.addComponent(playerEntity, 'PositionComponent', { x: 0, y: 3, z: 0 });
entityManager.addComponent(playerEntity, 'RotationComponent', { x: 0, y: 0, z: 0, w: 1 });
entityManager.addComponent(playerEntity, 'MeshComponent', { 
  meshId: 'player', 
  materialId: 'playerMaterial', 
  visible: true
});
/**
 * Rapier-aligned RigidBodyComponent fields:
 * kind: 'dynamic' | 'kinematicVelocity' | 'kinematicPosition' | 'fixed'
 * optional: linearDamping, angularDamping, gravityScale, canSleep, ccd, lockRot
 */
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

/** Gameplay components on player (weapon, ADS, score) */
entityManager.addComponent(playerEntity, 'WeaponComponent', createWeaponComponent(25, 10, 30, 100));
entityManager.addComponent(playerEntity, 'AimComponent', createAimComponent(75, 55, { x: 0, y: 2, z: 5 }, { x: 0.2, y: 1.9, z: 4.2 }, 0.02, 0.005));
entityManager.addComponent(playerEntity, 'ScoreComponent', createScoreComponent());

// Create camera entity that follows the player
const cameraEntity = entityManager.createEntity();
entityManager.addComponent(cameraEntity, 'CameraComponent', {
  fov: 75,
  near: 0.1,
  far: 1000,
  target: playerEntity,
  offset: { x: 0, y: 2, z: 5 }
});

/** Create basic target cubes with health to shoot */
for (let i = 0; i < 3; i++) {
  const cubeEntity = entityManager.createEntity();
  entityManager.addComponent(cubeEntity, 'PositionComponent', {
    x: (i - 1) * 2,
    y: 5 + i,
    z: -3
  });
  entityManager.addComponent(cubeEntity, 'RotationComponent', { x: 0, y: 0, z: 0, w: 1 });
  entityManager.addComponent(cubeEntity, 'MeshComponent', {
    meshId: 'cube',
    materialId: `cubeMaterial${i}`,
    visible: true
  });
  entityManager.addComponent(cubeEntity, 'RigidBodyComponent', {
    kind: 'dynamic',
    linearDamping: 0.15,
    angularDamping: 0.2,
    gravityScale: 1,
    canSleep: true,
    ccd: false
  });
  entityManager.addComponent(cubeEntity, 'VelocityComponent', { x: 0, y: 0, z: 0 });
  entityManager.addComponent(cubeEntity, 'HealthComponent', { current: 50, maximum: 50 });
}

// Set camera position
camera.position.set(0, 2, 5);
camera.lookAt(0, 1, 0);

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

/**
 * Game loop with fixed-step accumulator to keep physics deterministic.
 * Order (approx): Input → Movement → Physics → Combat → Scoring → Camera → Render
 * entityManager.updateSystems(deltaTime) maintains registration order; we provide a fixed dt to stabilize physics.
 */
const FIXED_DT = 1 / 60;
let accumulator = 0;
// Safe perfNow wrapper to avoid ESLint no-undef across environments
const perfNow: () => number =
  (typeof window !== 'undefined' && 'performance' in window && typeof window.performance?.now === 'function')
    ? () => window.performance.now()
    : () => Date.now();
let lastTime = perfNow();

async function start() {
  // Await Rapier init before starting the loop
  await physicsSystem.init(hf ?? null);

  const frame = () => {
    requestAnimationFrame(frame);

    // Accumulate time
    const now = perfNow();
    const dt = (now - lastTime) / 1000;
    lastTime = now;
    accumulator += dt;

    // Step physics and other systems at fixed rate
    while (accumulator >= FIXED_DT) {
      entityManager.updateSystems(FIXED_DT);
      accumulator -= FIXED_DT;
    }

    // Render scene (no interpolation for now)
    renderer.render(scene, camera);
  };

  requestAnimationFrame(frame);
}

void start();

console.log('Three.js game loaded successfully!');