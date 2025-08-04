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