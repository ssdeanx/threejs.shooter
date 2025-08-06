/**
 * Physics-related components (Rapier-aligned for React/R3F orchestration)
 * - ECS remains the source of truth; Rapier handles are cached for lookups.
 * - Pure data only: no Three.js or Rapier imports here to keep components portable.
 * - Discriminated unions for collider shapes; values consumed by PhysicsSystem.
 */

// Vector utility types kept simple to avoid importing Three in components.
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

// Intent velocity (optional). Source of truth for simulation lives in Rapier.
export type VelocityComponent = Vec3;

/**
 * Rapier body kinds
 * Matches @react-three/rapier / Rapier core concepts, but we keep it as strings in ECS.
 */
export type RigidBodyKind = 'dynamic' | 'kinematicVelocity' | 'kinematicPosition' | 'fixed';

// Rigid body definition compatible with Rapier
export interface RigidBodyComponent {
  /**
   * Rapier rigid body handle (set by PhysicsSystem when created).
   * This is an opaque identifier (number) mapped by PhysicsSystem; not serialized.
   */
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

  /**
   * Collision groups bitfield packed as per Rapier interaction groups.
   * Suggested packing: ((membership & 0xFFFF) << 16) | (filter & 0xFFFF)
   */
  collisionGroups?: number;
  /** Solver groups bitfield */
  solverGroups?: number;
}

/**
 * Collider discriminated union (Rapier)
 * Note: Use Float32Array/Uint32Array for mesh data to avoid copying; creators should supply typed arrays.
 */
export type ColliderShape =
  | { type: 'cuboid'; halfExtents: Vec3 }                                 // half extents
  | { type: 'ball'; radius: number }                                      // radius
  | { type: 'capsule'; radius: number; halfHeight: number }               // radius, half-height (center to cap start)
  | { type: 'trimesh'; vertices: Float32Array; indices: Uint32Array }     // indexed triangle mesh
  | { type: 'heightfield'; heights: number[][]; scale: Vec3 };            // heights[y][x], scale per axis

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

  /**
   * Event/activity flags (bitfields mirrored from Rapier constants at usage sites).
   * Keep as numbers here to avoid importing Rapier in components.
   */
  activeEvents?: number;
  activeCollisionTypes?: number;

  /** Group bitfields (see RigidBodyComponent doc above) */
  collisionGroups?: number;
  solverGroups?: number;

  /** Local offset (position/rotation) from the rigid body */
  offset?: ColliderOffset;
}

/**
 * Optional character controller component for kinematic player movement.
 * Consumed by MovementSystem and PhysicsSystem; keeps parameters declarative.
 */
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
  ...opts,
});

export const createCuboidCollider = (
  halfExtents: Vec3,
  options: Partial<Omit<ColliderComponent, 'shape'>> = {}
): ColliderComponent => ({
  shape: { type: 'cuboid', halfExtents },
  restitution: 0,
  friction: 1,
  sensor: false,
  ...options,
});

export const createBallCollider = (
  radius: number,
  options: Partial<Omit<ColliderComponent, 'shape'>> = {}
): ColliderComponent => ({
  shape: { type: 'ball', radius },
  restitution: 0,
  friction: 1,
  sensor: false,
  ...options,
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
  ...options,
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
  ...options,
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
  ...options,
});