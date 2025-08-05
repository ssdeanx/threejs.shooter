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