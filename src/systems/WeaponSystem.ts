import { System } from '@/core/System.js';
import type { EntityId } from '@/core/types.js';
import type { EntityManager } from '@/core/EntityManager.js';
import type { WeaponComponent, FireIntentComponent } from '@/components/GameplayComponents.js';
import { createFireIntent } from '@/components/GameplayComponents.js';
import { InputSystem } from '@/systems/InputSystem.js';

// WeaponSystem: owns firing cadence and ammo consumption. Emits FireIntentComponent for CombatSystem to consume.
export class WeaponSystem extends System {
  private em: EntityManager;
  private input: InputSystem;

  constructor(entityManager: EntityManager, input: InputSystem) {
    super(['WeaponComponent']);
    this.em = entityManager;
    this.input = input;
  }

  update(_dt: number, entities: EntityId[]): void {
    const inputState = this.input.getInputState();
    const wantsFire = !!inputState.leftClick;
    const wantsReload = !!inputState.r;
    const now = Date.now() / 1000;

    for (const e of entities) {
      const weapon = this.em.getComponent<WeaponComponent>(e, 'WeaponComponent');
      if (!weapon) {
        continue;
      }

      // Complete reload if in progress
      if (weapon.isReloading) {
        if (now >= weapon.reloadEndAt) {
          weapon.isReloading = false;
          weapon.reloadEndAt = 0;
          weapon.ammo = weapon.maxAmmo;
        }
      }

      // Start reload on input when eligible
      if (wantsReload && !weapon.isReloading && weapon.ammo < weapon.maxAmmo) {
        weapon.isReloading = true;
        weapon.reloadEndAt = now + Math.max(0.1, weapon.reloadTime);
      }

      // Enforce fire cadence and gating on ammo/reload
      const secondsPerShot = 1.0 / Math.max(0.0001, weapon.fireRate);
      const canShoot = !weapon.isReloading && (now - weapon.lastFireTime) >= secondsPerShot && weapon.ammo > 0;

      // Clean up any stale FireIntent if player is not firing
      const existingIntent = this.em.getComponent<FireIntentComponent>(e, 'FireIntentComponent');
      if (!wantsFire || !canShoot) {
        if (existingIntent) {
          this.em.removeComponent(e, 'FireIntentComponent');
        }
        continue;
      }

      // Fire: decrement ammo, stamp lastFireTime, emit intent (transient)
      weapon.ammo -= 1;
      weapon.lastFireTime = now;

      if (!existingIntent) {
        this.em.addComponent(e, 'FireIntentComponent', createFireIntent());
      } else {
        existingIntent.requestedAt = now;
      }
    }
  }
}
