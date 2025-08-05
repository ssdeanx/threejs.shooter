import * as THREE from 'three';
import { System } from '../core/System.js';
import type { EntityId } from '../core/types.js';
import type { EntityManager } from '../core/EntityManager.js';
import type { PositionComponent } from '../components/TransformComponents.js';
import type { MeshComponent, CameraComponent } from '../components/RenderingComponents.js';
import type { HealthComponent, WeaponComponent, AimComponent, ScoreComponent } from '../components/GameplayComponents.js';
import { InputSystem } from './InputSystem.js';

/**
 * CombatSystem
 * - Requires WeaponComponent to process firing.
 * - Uses active camera direction for hitscan with spread.
 * - Applies ADS by toggling AimComponent.isAiming via RMB and mutating CameraComponent fov/offset.
 */
export class CombatSystem extends System {
  private entityManager: EntityManager;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private input: InputSystem;
  private raycaster = new THREE.Raycaster();
  private scratchDir = new THREE.Vector3();

  constructor(entityManager: EntityManager, scene: THREE.Scene, camera: THREE.PerspectiveCamera, input: InputSystem) {
    super(['WeaponComponent']);
    this.entityManager = entityManager;
    this.scene = scene;
    this.camera = camera;
    this.input = input;
  }

  update(_deltaTime: number, entities: EntityId[]): void {
    const inputState = this.input.getInputState();

    // Hold-to-aim (RMB)
    for (const entity of entities) {
      const aim = this.entityManager.getComponent<AimComponent>(entity, 'AimComponent');
      if (aim) {
        const newAiming = !!inputState.rightClick;
        if (aim.isAiming !== newAiming) {
          aim.isAiming = newAiming;
          this.applyADSToCamera(aim);
        }
      }
    }

    // Fire (LMB). Respect fireRate / lastFireTime.
    for (const entity of entities) {
      const weapon = this.entityManager.getComponent<WeaponComponent>(entity, 'WeaponComponent');
      if (!weapon) continue;

      const now = Date.now() / 1000;
      const secondsPerShot = 1.0 / Math.max(0.0001, weapon.fireRate);
      if (!inputState.leftClick || (now - weapon.lastFireTime) < secondsPerShot) {
        continue;
      }

      // Optional ammo: leave enabled later
      if (weapon.ammo <= 0) {
        continue;
      }

      weapon.lastFireTime = now;
      // weapon.ammo -= 1;

      const hit = this.performHitscan(entity);
      if (hit) {
        const { targetEntity, point } = hit;
        const health = this.entityManager.getComponent<HealthComponent>(targetEntity, 'HealthComponent');
        if (health) {
          const before = health.current;
          health.current = Math.max(0, health.current - weapon.damage);

          const score = this.entityManager.getComponent<ScoreComponent>(entity, 'ScoreComponent');
          if (score) {
            score.hits += 1;
            score.score += 10; // +10 per hit
            if (before > 0 && health.current <= 0) {
              score.kills += 1;
              score.score += 50; // +50 per kill
            }
          }
        }
        void point; // placeholder for future VFX
      }
    }
  }

  private applyADSToCamera(aim: AimComponent): void {
    // Adjust CameraComponent(s) so CameraSystem applies next frame
    const compArrays = this.entityManager.getComponentArrays();
    const cameraArray = compArrays.get('CameraComponent') as (CameraComponent | undefined)[];
    if (!cameraArray) return;

    for (let i = 0; i < cameraArray.length; i++) {
      const cam = cameraArray[i];
      if (!cam) continue;
      cam.fov = aim.isAiming ? aim.fovAim : aim.fovDefault;

      // Shoulder offset nudge
      const src = aim.isAiming ? aim.shoulderOffsetAim : aim.shoulderOffset;
      cam.offset.x = src.x;
      cam.offset.y = src.y;
      cam.offset.z = src.z;
    }
  }

  private performHitscan(shooter: EntityId): { targetEntity: EntityId; point: THREE.Vector3 } | null {
    const aim = this.entityManager.getComponent<AimComponent>(shooter, 'AimComponent');
    const spread = aim ? (aim.isAiming ? aim.spreadAim : aim.spreadBase) : 0.02;

    // Camera forward
    const dir = this.scratchDir.set(0, 0, -1).applyQuaternion(this.camera.quaternion).normalize();
    const shotDir = this.randomDirectionInCone(dir, spread);

    this.raycaster.set(this.camera.position, shotDir);
    this.raycaster.far = 1000;

    // Gather visible meshes
    const objects: THREE.Object3D[] = [];
    this.scene.traverse((o) => {
      const anyO = o as any;
      if (anyO.isMesh && anyO.visible !== false) objects.push(o);
    });

    const intersects = this.raycaster.intersectObjects(objects, true);
    if (intersects.length === 0) return null;

    for (const inter of intersects) {
      const entity = this.mapObjectToEntity(inter.object);
      if (entity != null && entity !== shooter) {
        return { targetEntity: entity, point: inter.point.clone() };
      }
    }

    return null;
  }

  private mapObjectToEntity(obj: THREE.Object3D): EntityId | null {
    // Approximate: find nearest entity Position to intersection object world position
    const arrays = this.entityManager.getComponentArrays();
    const meshArray = arrays.get('MeshComponent') as (MeshComponent | undefined)[];
    if (!meshArray) return null;

    const worldPos = new THREE.Vector3();
    obj.getWorldPosition(worldPos);

    let bestEntity: EntityId | null = null;
    let bestDist = Number.POSITIVE_INFINITY;

    for (let entityId = 0; entityId < meshArray.length; entityId++) {
      const meshComp = meshArray[entityId];
      if (!meshComp) continue;
      const pos = this.entityManager.getComponent<PositionComponent>(entityId, 'PositionComponent');
      if (!pos) continue;
      const d = worldPos.distanceToSquared(new THREE.Vector3(pos.x, pos.y, pos.z));
      if (d < bestDist) {
        bestDist = d;
        bestEntity = entityId as EntityId;
      }
    }

    return bestEntity;
  }

  private randomDirectionInCone(center: THREE.Vector3, angle: number): THREE.Vector3 {
    if (angle <= 0) return center.clone();

    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(1 - v * (1 - Math.cos(angle)));
    const x = Math.sin(phi) * Math.cos(theta);
    const y = Math.sin(phi) * Math.sin(theta);
    const z = Math.cos(phi);

    const w = center.clone().normalize();
    const a = Math.abs(w.x) > 0.1 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const uVec = a.clone().cross(w).normalize();
    const vVec = w.clone().cross(uVec).normalize();

    return new THREE.Vector3()
      .addScaledVector(uVec, x)
      .addScaledVector(vVec, y)
      .addScaledVector(w, z)
      .normalize();
  }
}