import { System } from '@/core/System.js';
import type { EntityId } from '@/core/types.js';
import type { EntityManager } from '@/core/EntityManager.js';
import { interactionGroup, CollisionLayers } from '@/core/CollisionLayers.js';
import type { SpawnerComponent, SpawnRequestComponent, SpawnedTagComponent } from '@/components/GameplayComponents.js';
import {
  createWeaponByArchetype,
  createHealthComponent,
  createEnemyComponent,
  createWeakpointComponent,
} from '@/components/GameplayComponents.js';
import type { PositionComponent } from '@/components/TransformComponents.js';
import { createPositionComponent, createRotationComponent, createScaleComponent } from '@/components/TransformComponents.js';
import type { MeshComponent } from '@/components/RenderingComponents.js';
import { createMeshComponent } from '@/components/RenderingComponents.js';
import type { RigidBodyComponent, ColliderComponent } from '@/components/PhysicsComponents.js';
import { createRigidBodyComponent, createCuboidCollider } from '@/components/PhysicsComponents.js';

/**
 * SpawnerSystem: generalized spawns for enemies, weapons, and future pickups (gear/perks/cash).
 * Deterministic, allocation-aware. Requires only SpawnerComponent on the spawner entity.
 */
export class SpawnerSystem extends System {
  private em: EntityManager;

  constructor(entityManager: EntityManager) {
    super(['SpawnerComponent']);
    this.em = entityManager;
  }

  update(_dt: number, entities: EntityId[]): void {
    const now = Date.now() / 1000;

    for (const spawner of entities) {
      const sp = this.em.getComponent<SpawnerComponent>(spawner, 'SpawnerComponent');
      if (!sp) {
        continue;
      }

      // Compute current alive count by scan to avoid stale counters
      let alive = 0;
      const spawnedArchetype = this.em.getComponentArrays().get('SpawnedTagComponent');
      if (spawnedArchetype) {
        // Iterate once; component arrays are sparse by entityId
        const arr = spawnedArchetype as (SpawnedTagComponent | undefined)[];
        for (let i = 0; i < arr.length; i++) {
          const tag = arr[i];
          if (tag && tag.spawnerEntity === spawner) {
            alive++;
          }
        }
      }

      // Check spawn request (one-shot)
      const req = this.em.getComponent<SpawnRequestComponent>(spawner, 'SpawnRequestComponent');
      const requestCount = req ? Math.max(0, req.count) : 0;
      if (req) {
        this.em.removeComponent(spawner, 'SpawnRequestComponent');
      }

      // Cooldown gating for autonomous spawning
      const canAuto = (now - sp.lastSpawnAt) >= sp.cooldown;
      let toSpawn = 0;
      if (requestCount > 0) {
        toSpawn = requestCount;
      } else if (canAuto && alive < sp.maxAlive) {
        toSpawn = 1;
      }

      // Limit by capacity
      const capacity = Math.max(0, sp.maxAlive - alive);
      toSpawn = Math.min(toSpawn, capacity);
      if (toSpawn <= 0) {
        continue;
      }

      // Spawn deterministically at spawner's position with small fixed offsets
      const basePos = this.em.getComponent<PositionComponent>(spawner, 'PositionComponent');
      const bx = basePos ? basePos.x : 0;
      const by = basePos ? basePos.y : 0;
      const bz = basePos ? basePos.z : 0;

      for (let i = 0; i < toSpawn; i++) {
        const e = this.spawnPrefab(sp.prefab, bx, by, bz, i);
        // Tag linkage
        const tag: SpawnedTagComponent = { spawnerEntity: spawner };
        this.em.addComponent(e, 'SpawnedTagComponent', tag);
      }

      sp.lastSpawnAt = now;
    }
  }

  private spawnPrefab(kind: SpawnerComponent['prefab'], bx: number, by: number, bz: number, index: number): EntityId {
    const e = this.em.createEntity();
    // Deterministic ring offsets (no random)
    const dx = ((index % 3) - 1) * 2;
    const dz = (Math.floor(index / 3) - 1) * 2;
    this.em.addComponent<PositionComponent>(e, 'PositionComponent', createPositionComponent(bx + dx, by, bz + dz));
    this.em.addComponent(e, 'RotationComponent', createRotationComponent());
    this.em.addComponent(e, 'ScaleComponent', createScaleComponent());

    switch (kind) {
      case 'enemy': {
        // Simple static target with a collider; health + enemy tag
        const rb: RigidBodyComponent = createRigidBodyComponent('fixed');
        const collider: ColliderComponent = createCuboidCollider({ x: 0.5, y: 0.5, z: 0.5 });
        // Set groups: ENV member is acceptable for static targets colliding with bullets/player
        const groups = interactionGroup(Number(CollisionLayers.ENEMY), Number(CollisionLayers.BULLET | CollisionLayers.PLAYER));
        rb.collisionGroups = groups;
        collider.collisionGroups = groups;
        this.em.addComponent(e, 'RigidBodyComponent', rb);
        this.em.addComponent(e, 'ColliderComponent', collider);
        // Visual: GLB steel target prefab via RenderSystem
        const mesh: MeshComponent = createMeshComponent('steel_target', 'steel_target', true);
        this.em.addComponent(e, 'MeshComponent', mesh);
        this.em.addComponent(e, 'HealthComponent', createHealthComponent(100));
        this.em.addComponent(e, 'EnemyComponent', createEnemyComponent());
        // Weakpoint (e.g., head)
        this.em.addComponent(e, 'WeakpointComponent', createWeakpointComponent());
        break;
      }
      case 'weapon_ar': {
        const weapon = createWeaponByArchetype('ar');
        this.em.addComponent(e, 'WeaponComponent', weapon);
        break;
      }
      case 'weapon_smg': {
        const weapon = createWeaponByArchetype('smg');
        this.em.addComponent(e, 'WeaponComponent', weapon);
        break;
      }
      case 'cash':
      case 'perk':
      case 'gear':
      default: {
        // Placeholder entities for future pickups; keep transform only
        break;
      }
    }

    return e;
  }
}
