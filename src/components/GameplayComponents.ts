// Gameplay-related components
export interface HealthComponent {
  current: number;
  maximum: number;
}

export interface WeaponComponent {
  damage: number;
  fireRate: number; // shots per second
  ammo: number;
  maxAmmo: number;
  range: number;
  lastFireTime: number;
}

export interface PlayerControllerComponent {
  moveSpeed: number;
  sprintMultiplier: number;
  jumpForce: number;
  mouseSensitivity: number;
}

/**
 * Aim down sights / combat aiming parameters
 * fovDefault is typically the camera default FOV; fovAim = 55 per spec.
 * shoulderOffset nudges the camera offset slightly while aiming.
 * spreadBase/spreadAim are radians cone half-angles for hip vs ADS.
 */
export interface AimComponent {
  isAiming: boolean;
  fovDefault: number;
  fovAim: number;
  shoulderOffset: { x: number; y: number; z: number };
  shoulderOffsetAim: { x: number; y: number; z: number };
  spreadBase: number; // e.g., 0.02 rad
  spreadAim: number;  // e.g., 0.005 rad
}

/** Player scoring */
export interface ScoreComponent {
  score: number;
  hits: number;
  kills: number;
}

// Helper functions
export const createHealthComponent = (maximum = 100): HealthComponent => ({
  current: maximum,
  maximum
});

export const createWeaponComponent = (
  damage = 25,
  fireRate = 10,
  maxAmmo = 30,
  range = 100
): WeaponComponent => ({
  damage,
  fireRate,
  ammo: maxAmmo,
  maxAmmo,
  range,
  lastFireTime: 0
});

export const createPlayerControllerComponent = (
  moveSpeed = 5,
  sprintMultiplier = 1.5,
  jumpForce = 10,
  mouseSensitivity = 0.002
): PlayerControllerComponent => ({
  moveSpeed,
  sprintMultiplier,
  jumpForce,
  mouseSensitivity
});

export const createAimComponent = (
  fovDefault = 75,
  fovAim = 55,
  shoulderOffset = { x: 0, y: 2, z: 5 },
  shoulderOffsetAim = { x: 0.2, y: 1.9, z: 4.2 },
  spreadBase = 0.02,
  spreadAim = 0.005
): AimComponent => ({
  isAiming: false,
  fovDefault,
  fovAim,
  shoulderOffset,
  shoulderOffsetAim,
  spreadBase,
  spreadAim
});

export const createScoreComponent = (): ScoreComponent => ({
  score: 0,
  hits: 0,
  kills: 0
});