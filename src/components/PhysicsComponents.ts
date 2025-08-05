/**
 * Physics-related components (Rapier-aligned)
 * - ECS remains the source of truth; Rapier handles are cached for lookups.
 * - Avoid Cannon-specific fields; use discriminated unions for collider shapes.
 */

// Vector utility types kept simple to avoid importing Three in components.
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

// Intent velocity (optional). Source of truth for simulation lives in Rapier.
export type VelocityComponent = Vec3;

// Rapier body kinds
export type RigidBodyKind =
  | 'dynamic'
  | 'kinematicVelocity'
  | 'kinematicPosition'
  | 'fixed';

// Rigid body definition compatible with Rapier
export interface RigidBodyComponent {
  /** Rapier rigid body handle (set by PhysicsSystem when created) */
  handle?: number;

  /** Rapier body type */
  kind: RigidBodyKind;

  /** Optional explicit mass (usually derived from collider density) */
  mass?: number;

  /** Damping and gravity behavior */
  linearDamping?: number;
  angularDamping?: number;
  gravityScale?: number;

  /** Behavior flags */
  canSleep?: boolean;
  ccd?: boolean;
  /** Lock rotations around axes (common for characters: lock X/Z) */
  lockRot?: boolean;

  /** Optional cached velocities (read-model only; simulation owns truth) */
  linearVelocity?: Vec3;
  angularVelocity?: Vec3;

  /** Collision/solver bitmasks (16-bit groups typical) */
  collisionGroups?: number;
  solverGroups?: number;
}

// Collider discriminated union (Rapier)
export type ColliderShape =
  | { type: 'cuboid'; halfExtents: Vec3 }                  // half extents
  | { type: 'ball'; radius: number }                       // radius
  | { type: 'capsule'; radius: number; halfHeight: number } // radius, half-height (center to cap start)
  | { type: 'trimesh'; vertices: Float32Array; indices: Uint32Array } // indexed triangle mesh
  | { type: 'heightfield'; heights: number[][]; scale: Vec3 }; // heights[y][x], scale per axis

export interface ColliderOffset {
  position: Vec3;
  /** Optional local rotation as quaternion (x,y,z,w). Kept simple to avoid external types. */
  rotation?: { x: number; y: number; z: number; w: number };
}

export interface ColliderComponent {
  shape: ColliderShape;

  /** Physical/material properties */
  restitution?: number;
  friction?: number;
  sensor?: boolean;

  /** Rapier event/activity flags and groups */
  activeEvents?: number;
  activeCollisionTypes?: number;
  collisionGroups?: number;
  solverGroups?: number;

  /** Local offset (position/rotation) from the rigid body */
  offset?: ColliderOffset;
}

/** Optional character controller component for kinematic player movement */
export interface CharacterControllerComponent {
  mode: 'kinematicVelocity';
  slopeLimitDeg: number;
  stepHeight: number;
  snapToGround: boolean;
  maxSpeed: number;
  jumpSpeed: number;
  /** 0..1 how much control while airborne */
  airControl: number;
}

/* ------------------------- Helper factories ------------------------- */

export const createVelocityComponent = (x = 0, y = 0, z = 0): VelocityComponent => ({ x, y, z });

export const createRigidBodyComponent = (
  kind: RigidBodyKind = 'kinematicVelocity',
  opts: Partial<Omit<RigidBodyComponent, 'kind'>> = {}
): RigidBodyComponent => ({
  kind,
  linearDamping: 0,
  angularDamping: 0,
  gravityScale: 1,
  canSleep: true,
  ccd: false,
  lockRot: false,
  ...opts
});

export const createCuboidCollider = (
  halfExtents: Vec3,
  options: Partial<Omit<ColliderComponent, 'shape'>> = {}
): ColliderComponent => ({
  shape: { type: 'cuboid', halfExtents },
  restitution: 0,
  friction: 1,
  sensor: false,
  ...options
});

export const createBallCollider = (
  radius: number,
  options: Partial<Omit<ColliderComponent, 'shape'>> = {}
): ColliderComponent => ({
  shape: { type: 'ball', radius },
  restitution: 0,
  friction: 1,
  sensor: false,
  ...options
});

export const createCapsuleCollider = (
  radius: number,
  halfHeight: number,
  options: Partial<Omit<ColliderComponent, 'shape'>> = {}
): ColliderComponent => ({
  shape: { type: 'capsule', radius, halfHeight },
  restitution: 0,
  friction: 1,
  sensor: false,
  ...options
});

export const createTrimeshCollider = (
  vertices: Float32Array,
  indices: Uint32Array,
  options: Partial<Omit<ColliderComponent, 'shape'>> = {}
): ColliderComponent => ({
  shape: { type: 'trimesh', vertices, indices },
  restitution: 0,
  friction: 1,
  sensor: false,
  ...options
});

export const createHeightfieldCollider = (
  heights: number[][],
  scale: Vec3,
  options: Partial<Omit<ColliderComponent, 'shape'>> = {}
): ColliderComponent => ({
  shape: { type: 'heightfield', heights, scale },
  restitution: 0,
  friction: 1,
  sensor: false,
  ...options
});