/**
 * ECS Components barrel
 * Note: createColliderComponent no longer exists. Prefer specific collider factories.
 */
export type { PositionComponent, RotationComponent, ScaleComponent } from './TransformComponents.js';
export { createPositionComponent, createRotationComponent, createScaleComponent } from './TransformComponents.js';

export {
  createVelocityComponent,
  createRigidBodyComponent,
  createCuboidCollider as createColliderComponent,
  createCuboidCollider,
  createBallCollider,
  createCapsuleCollider,
  createTrimeshCollider,
  createHeightfieldCollider,
} from './PhysicsComponents.js';

// Re-export physics types exactly once
export type {
  Vec3,
  VelocityComponent,
  RigidBodyKind,
  RigidBodyComponent,
  ColliderShape,
  ColliderOffset,
  ColliderComponent,
  CharacterControllerComponent,
} from './PhysicsComponents.js';

export type { HealthComponent, WeaponComponent, PlayerControllerComponent } from './GameplayComponents.js';
export { createHealthComponent, createWeaponComponent, createPlayerControllerComponent } from './GameplayComponents.js';

export type { MeshComponent, CameraComponent } from './RenderingComponents.js';
export { createMeshComponent, createCameraComponent } from './RenderingComponents.js';

/** Terrain components */
export interface TerrainColliderComponent {
  kind: 'heightfield';
  /** rows x cols of the height grid for reference/debug; optional at runtime */
  rows?: number;
  cols?: number;
  /** cell size (element size) in world units */
  cellSize?: number;
}
export function createTerrainColliderComponent(rows?: number, cols?: number, cellSize?: number): TerrainColliderComponent {
  return { kind: 'heightfield', rows, cols, cellSize };
}