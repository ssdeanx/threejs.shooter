/**
 * Collision bitmasks used across physics queries and collider setup.
 * Keep in sync with systems that depend on filtering semantics.
 */
export const CollisionLayers = {
  PLAYER: 0x0001,
  ENEMY: 0x0002,
  ENV: 0x0004,
  CAMERA_BLOCKER: 0x0008,
  BULLET: 0x0010,
} as const;

export type CollisionLayerKey = keyof typeof CollisionLayers;

/**
 * Packed interaction groups helper
 * Returns a 32-bit number where low 16 bits are membership and high 16 bits are filter mask.
 * Compatible with Rapier InteractionGroups.fixed(membership, filter) representation.
 */
export const interactionGroup = (membershipMask: number, filterMask: number): number => {
  const member = membershipMask & 0xffff;
  const mask = (filterMask & 0xffff) & 0xffff;
  return ((member) | (mask << 16)) >>> 0;
};

/**
 * Standardized system filter masks:
 * - Ground probe should only hit ENV
 * - Hitscan should hit ENEMY and ENV
 * - Camera occlusion should hit CAMERA_BLOCKER only
 */
export const GROUND_PROBE_MASK = CollisionLayers.ENV;
export const HITSCAN_MASK = (CollisionLayers.ENEMY | CollisionLayers.ENV);
export const CAMERA_OCCLUSION_MASK = CollisionLayers.CAMERA_BLOCKER;