import { System } from '@/core/System.js';
import type { EntityManager } from '@/core/EntityManager.js';
import type { EntityId } from '@/core/types.js';
import type { HealthComponent, EnemyComponent } from '@/components/GameplayComponents.js';
import { createWaveStatusComponent } from '@/components/GameplayComponents.js';
import type { SpawnerComponent, SpawnRequestComponent } from '@/components/GameplayComponents.js';
import { createSpawnRequest } from '@/components/GameplayComponents.js';

/**
 * WaveSystem
 * - Tracks alive enemies.
 * - When none remain, marks player WaveStatusComponent as 'clear' for a short duration.
 * - Spawning of the next wave is deferred to a dedicated spawner (future slice).
 */
export class WaveSystem extends System {
  private entityManager: EntityManager;
  private playerEntity: EntityId | null = null;
  private readonly showSeconds = 3; // duration to show CLEAR badge

  constructor(entityManager: EntityManager) {
    super(['HealthComponent', 'EnemyComponent']);
    this.entityManager = entityManager;
  }

  private ensurePlayer(): EntityId | null {
    if (this.playerEntity != null) {
      return this.playerEntity;
    }
    // Find the first entity that looks like the player (has PlayerControllerComponent)
    const candidates = (this.entityManager as unknown as { entities?: Set<EntityId> }).entities;
    if (!candidates || candidates.size === 0) {
      return null;
    }
    for (const eid of candidates) {
      const pc = this.entityManager.getComponent(eid, 'PlayerControllerComponent');
      if (pc) {
        this.playerEntity = eid;
        return eid;
      }
    }
    return null;
  }

  update(_dt: number, entities: EntityId[]): void {
    // Count alive enemies among provided entities (requiredComponents filters these)
    let alive = 0;
    for (const eid of entities) {
      const h = this.entityManager.getComponent<HealthComponent>(eid, 'HealthComponent');
      const en = this.entityManager.getComponent<EnemyComponent>(eid, 'EnemyComponent');
      if (!h || !en) {
        continue;
      }
      if (h.current > 0) {
        alive++;
      }
    }

    const now = Date.now() / 1000;
    if (alive === 0) {
      const player = this.ensurePlayer();
      if (player != null) {
        let ws = this.entityManager.getComponent(player, 'WaveStatusComponent') as
          | ReturnType<typeof createWaveStatusComponent>
          | undefined;
        if (!ws) {
          ws = createWaveStatusComponent();
          this.entityManager.addComponent(player, 'WaveStatusComponent', ws);
        }
        if (ws.state !== 'clear' || now >= ws.showUntil) {
          ws.state = 'clear';
          ws.showUntil = now + this.showSeconds;
          ws.version += 1;
        }

        // If the CLEAR window has elapsed, trigger next wave via SpawnRequest on enemy spawners
        if (now >= ws.showUntil) {
          // Transition back to idle for HUD and immediately request a new wave
          ws.state = 'idle';
          ws.version += 1;

          const compArrays = this.entityManager.getComponentArrays();
          const spArr = compArrays.get('SpawnerComponent') as (SpawnerComponent | undefined)[] | undefined;
          if (spArr) {
            for (let i = 0; i < spArr.length; i++) {
              const sp = spArr[i];
              if (!sp) {
                continue;
              }
              const spEntity = i as unknown as EntityId;
              // Only request on enemy spawners
              if (sp.prefab === 'enemy') {
                const existing = this.entityManager.getComponent<SpawnRequestComponent>(spEntity, 'SpawnRequestComponent');
                if (!existing) {
                  this.entityManager.addComponent(spEntity, 'SpawnRequestComponent', createSpawnRequest(5));
                } else {
                  // Merge by increasing count deterministically up to capacity hint
                  existing.count = Math.max(existing.count, 5);
                }
              }
            }
          }
        }
      }
    }
  }
}
