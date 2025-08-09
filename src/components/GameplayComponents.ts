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
  reloadTime: number; // seconds
  isReloading: boolean;
  reloadEndAt: number; // epoch seconds when reload completes
}

/** Weapon archetypes to support melee, assault rifle (AR), and SMG. */
export type WeaponArchetype = 'melee' | 'ar' | 'smg';

/** Separate meta so core WeaponComponent stays numeric-only. */
export interface WeaponMetaComponent {
  archetype: WeaponArchetype;
}

export const createWeaponMeta = (archetype: WeaponArchetype): WeaponMetaComponent => ({ archetype });

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

/** Tag component: marks an entity as an enemy (used for collision masks, targeting, and scoring) */
export interface EnemyComponent {
  kind: 'enemy';
}

/** Optional weakpoint for crits (e.g., head). Local-space position + radius. */
export interface WeakpointComponent {
  offset: { x: number; y: number; z: number };
  radius: number;
  critMultiplier: number; // damage multiplier when hit
}

/** Transient combat feedback for HUD (event-like via version increment) */
export interface CombatFeedbackComponent {
  state: 'hit' | 'crit' | 'miss' | 'none';
  version: number; // incremented each time state updates
}

/** Wave status for HUD and progression */
export interface WaveStatusComponent {
  state: 'idle' | 'clear';
  showUntil: number; // epoch seconds when to hide badge
  version: number;   // incremented for HUD to detect changes
}

/** Transient fire intent emitted by WeaponSystem and consumed by CombatSystem within the same fixed step */
export interface FireIntentComponent {
  requestedAt: number; // seconds since epoch
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
  range = 100,
  reloadTime = 1.6
): WeaponComponent => ({
  damage,
  fireRate,
  ammo: maxAmmo,
  maxAmmo,
  range,
  lastFireTime: 0,
  reloadTime,
  isReloading: false,
  reloadEndAt: 0
});

/** Factory: create a WeaponComponent tuned by archetype (no textures/assets here). */
export const createWeaponByArchetype = (archetype: WeaponArchetype): WeaponComponent => {
  switch (archetype) {
    case 'melee':
      // High damage, no ammo, very high fireRate but short range; reload irrelevant
      return createWeaponComponent(60, 2, 1, 2, 0.0);
    case 'smg':
      // Fast fire, low damage, larger mag, short-medium range, quick reload
      return createWeaponComponent(15, 12, 40, 60, 1.2);
    case 'ar':
    default:
      // Balanced baseline (assault rifle)
      return createWeaponComponent(25, 10, 30, 100, 1.6);
  }
};

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

export const createEnemyComponent = (): EnemyComponent => ({ kind: 'enemy' });

export const createWeakpointComponent = (
  offset = { x: 0, y: 0.7, z: 0 },
  radius = 0.22,
  critMultiplier = 2.0
): WeakpointComponent => ({ offset, radius, critMultiplier });

export const createCombatFeedback = (): CombatFeedbackComponent => ({
  state: 'none',
  version: 0,
});

export const createFireIntent = (): FireIntentComponent => ({
  requestedAt: 0
});

import type { EntityId } from '@/core/types.js';

export const createWaveStatusComponent = (): WaveStatusComponent => ({
  state: 'idle',
  showUntil: 0,
  version: 0,
});

/** Relation: weapon entity owned by an actor entity (e.g., player). */
export interface WeaponOwnerComponent {
  ownerEntity: EntityId;
}

export const createWeaponOwnerComponent = (ownerEntity: EntityId): WeaponOwnerComponent => ({ ownerEntity });

/** Generic spawner configuration component */
export interface SpawnerComponent {
  prefab: 'enemy' | 'weapon_ar' | 'weapon_smg' | 'cash' | 'perk' | 'gear';
  maxAlive: number;
  cooldown: number;
  lastSpawnAt: number; // seconds since epoch
  alive: number;       // advisory; actual alive computed by systems
}

/** One-shot intent to force a spawn now (consumed by SpawnerSystem). */
export interface SpawnRequestComponent {
  count: number;
}

/** Tag component on spawned entities to track origin spawner and lifecycle. */
export interface SpawnedTagComponent {
  spawnerEntity: number; // EntityId (kept as number here)
}

export const createSpawnerComponent = (
  prefab: SpawnerComponent['prefab'],
  maxAlive = 1,
  cooldown = 2.0
): SpawnerComponent => ({
  prefab,
  maxAlive,
  cooldown,
  lastSpawnAt: 0,
  alive: 0,
});

export const createSpawnRequest = (count = 1): SpawnRequestComponent => ({ count });