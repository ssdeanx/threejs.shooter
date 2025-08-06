import * as THREE from 'three';
import { System } from '../core/System.js';
import type { EntityId } from '../core/types.js';
import type { EntityManager } from '../core/EntityManager.js';
import type { CameraComponent } from '../components/RenderingComponents.js';
import type { HealthComponent, WeaponComponent, AimComponent, ScoreComponent } from '../components/GameplayComponents.js';
import { InputSystem } from './InputSystem.js';
import { PhysicsSystem } from './PhysicsSystem.js';
import { CollisionLayers } from '@/core/CollisionLayers.js';

/**
 * CombatSystem
 * - Requires WeaponComponent to process firing.
 * - Uses active camera direction for hitscan with spread.
 * - Applies ADS by toggling AimComponent.isAiming via RMB and mutating CameraComponent fov/offset.
 * - Raycast-based hit detection via PhysicsSystem.raycast() with BULLET vs ENEMY|ENV filtering.
 */
export class CombatSystem extends System {
  private entityManager: EntityManager;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private input: InputSystem;
  private physics: PhysicsSystem | null = null;
  private scratchDir = new THREE.Vector3();
  // transient hit marker to visualize impact point when a target is hit
  private hitMarker: THREE.Object3D | null = null;

  constructor(entityManager: EntityManager, scene: THREE.Scene, camera: THREE.PerspectiveCamera, input: InputSystem) {
    super(['WeaponComponent']);
    this.entityManager = entityManager;
    this.scene = scene;
    this.camera = camera;
    this.input = input;
  }

  setPhysicsSystem(physics: PhysicsSystem): void {
    this.physics = physics;
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
      if (!weapon) {
        continue;
      }

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

      const hit = this.performHitscan(entity, weapon.range);
      if (hit) {
              const { targetEntity, point, distance } = hit;
              const health = this.entityManager.getComponent<HealthComponent>(targetEntity, 'HealthComponent');
              if (health) {
                const before = health.current;
      
                // Distance-based linear falloff
                const range = Math.max(1, weapon.range ?? 100);
                const falloff = Math.max(0, 1 - distance / range);
                const dmg = Math.max(0, weapon.damage * falloff);
      
                health.current = Math.max(0, health.current - dmg);
      
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
      
              // Place a tiny transient hit marker at the impact point.
              // Remove previous marker (if any), then add a new one at the impact point.
              if (this.hitMarker) {
                this.scene.remove(this.hitMarker);
                this.hitMarker.traverse(obj => {
                  const mesh = obj as THREE.Mesh;
                  const hasGeom = (mesh as THREE.Mesh).geometry as THREE.BufferGeometry | undefined;
                  if (hasGeom) {
                    hasGeom.dispose();
                  }
                  const mat = (mesh as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
                  if (Array.isArray(mat)) {
                    mat.forEach(m => m.dispose?.());
                  } else if (mat) {
                    mat.dispose?.();
                  }
                });
                this.hitMarker = null;
              }
              const markerGeom = new THREE.SphereGeometry(0.06, 8, 8);
              const markerMat = new THREE.MeshBasicMaterial({ color: 0xff3355 });
              const marker = new THREE.Mesh(markerGeom, markerMat);
              marker.position.copy(point);
              marker.renderOrder = 9999; // ensure visible
              this.scene.add(marker);
              this.hitMarker = marker;
      
            }
      else if (this.hitMarker) {
                this.scene.remove(this.hitMarker);
                this.hitMarker.traverse(obj => {
                  const mesh = obj as THREE.Mesh;
                  const hasGeom = (mesh as THREE.Mesh).geometry as THREE.BufferGeometry | undefined;
                  if (hasGeom) {
                    hasGeom.dispose();
                  }
                  const mat = (mesh as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
                  if (Array.isArray(mat)) {
                    mat.forEach(m => m.dispose?.());
                  } else if (mat) {
                    mat.dispose?.();
                  }
                });
                this.hitMarker = null;
              }
    }
  }

  private applyADSToCamera(aim: AimComponent): void {
    // Adjust CameraComponent(s) so CameraSystem applies next frame
    const compArrays = this.entityManager.getComponentArrays();
    const cameraArray = compArrays.get('CameraComponent') as (CameraComponent | undefined)[];
    if (!cameraArray) {
      return;
    }

    for (let i = 0; i < cameraArray.length; i++) {
      const cam = cameraArray[i];
      if (!cam) {
        continue;
      }
      cam.fov = aim.isAiming ? aim.fovAim : aim.fovDefault;

      // Shoulder offset nudge
      const src = aim.isAiming ? aim.shoulderOffsetAim : aim.shoulderOffset;
      cam.offset.x = src.x;
      cam.offset.y = src.y;
      cam.offset.z = src.z;
    }
  }

  // Local packer compatible with PhysicsSystem usage (16-bit member | 16-bit mask<<16)
  private makeGroupsPack(member: number, mask: number): number {
    return ((member & 0xffff) | ((mask & 0xffff) << 16)) >>> 0;
  }

  private performHitscan(shooter: EntityId, maxRange = 100): { targetEntity: EntityId; point: THREE.Vector3; distance: number } | null {
    if (!this.physics) {
      return null;
    }

    const aim = this.entityManager.getComponent<AimComponent>(shooter, 'AimComponent');
    const spread = aim ? (aim.isAiming ? aim.spreadAim : aim.spreadBase) : 0.02;

    // Camera forward with random spread cone
    const dir = this.scratchDir.set(0, 0, -1).applyQuaternion(this.camera.quaternion).normalize();
    const shotDir = this.randomDirectionInCone(dir, spread);

    // Filter: BULLET collides with ENEMY | ENV
    const filterGroups = this.makeGroupsPack(CollisionLayers.BULLET, CollisionLayers.ENEMY | CollisionLayers.ENV);

    const hit = this.physics.raycast(this.camera.position, shotDir, maxRange, true, filterGroups);
    if (!hit || hit.entity == null || hit.entity === shooter) {
      return null;
    }

    const distance = hit.toi;
    return { targetEntity: hit.entity, point: hit.point.clone(), distance };
  }

  private randomDirectionInCone(center: THREE.Vector3, angle: number): THREE.Vector3 {
    if (angle <= 0) {
      return center.clone();
    }

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
