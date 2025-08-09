import * as THREE from 'three';
import { System } from '../core/System.js';
import type { EntityId } from '../core/types.js';
import type { EntityManager } from '../core/EntityManager.js';
import type { CameraComponent } from '../components/RenderingComponents.js';
import type { HealthComponent, WeaponComponent, AimComponent, ScoreComponent, FireIntentComponent, CombatFeedbackComponent, WeakpointComponent } from '../components/GameplayComponents.js';
import type { PositionComponent, RotationComponent } from '@/components/TransformComponents.js';
import { createCombatFeedback } from '@/components/GameplayComponents.js';
import { InputSystem } from './InputSystem.js';
import { PhysicsSystem } from './PhysicsSystem.js';
import { RenderSystem } from './RenderSystem.js';
import { CollisionLayers, HITSCAN_MASK, interactionGroup } from '@/core/CollisionLayers.js';

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
  private render: RenderSystem | null = null;
  private scratchDir = new THREE.Vector3();
  // Reusable temporaries (no per-frame allocations in hot path)
  private scratchQuat = new THREE.Quaternion();
  private scratchLocal = new THREE.Vector3();
  private scratchWorld = new THREE.Vector3();

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

  setRenderSystem(render: RenderSystem): void {
    this.render = render;
  }

  update(_deltaTime: number, entities: EntityId[]): void {
    // Guard read ensures scene reference remains valid and satisfies lint without graph mutations
    if (!this.scene) {
      return;
    }
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

    // Fire: consume transient FireIntentComponent produced by WeaponSystem
    for (const entity of entities) {
      const weapon = this.entityManager.getComponent<WeaponComponent>(entity, 'WeaponComponent');
      if (!weapon) {
        continue;
      }
      const intent = this.entityManager.getComponent<FireIntentComponent>(entity, 'FireIntentComponent');
      if (!intent) {
        continue;
      }

      const hit = this.performHitscan(entity, weapon.range);
      if (hit) {
              const { targetEntity, point, distance } = hit;
              // critHit must be visible to HUD feedback below
              let critHit = false;
              const health = this.entityManager.getComponent<HealthComponent>(targetEntity, 'HealthComponent');
              if (health) {
                const before = health.current;
                
                // Distance-based linear falloff
                const range = Math.max(1, weapon.range ?? 100);
                const falloff = Math.max(0, 1 - distance / range);
                let dmg = Math.max(0, weapon.damage * falloff);
                // Crit check against optional WeakpointComponent (sphere in world space)
                const weak = this.entityManager.getComponent<WeakpointComponent>(targetEntity, 'WeakpointComponent');
                if (weak) {
                  const pos = this.entityManager.getComponent<PositionComponent>(targetEntity, 'PositionComponent');
                  const rot = this.entityManager.getComponent<RotationComponent>(targetEntity, 'RotationComponent');
                  if (pos && rot) {
                    const q = this.scratchQuat.set(rot.x, rot.y, rot.z, rot.w);
                    const local = this.scratchLocal.set(weak.offset.x, weak.offset.y, weak.offset.z);
                    const world = this.scratchWorld.copy(local).applyQuaternion(q).add({ x: pos.x, y: pos.y, z: pos.z } as THREE.Vector3);
                    const hitDist = world.distanceTo(point);
                    if (hitDist <= weak.radius) {
                      critHit = true;
                      dmg *= Math.max(1, weak.critMultiplier);
                    }
                  }
                }

                health.current = Math.max(0, health.current - dmg);
      
                const score = this.entityManager.getComponent<ScoreComponent>(entity, 'ScoreComponent');
                if (score) {
                  score.hits += 1;
                  score.score += 10; // +10 per hit base; crit bonus below
                  if (critHit) {
                    // Award crit bonus when actual weakpoint overlap occurred
                    score.score += 25;
                  }
                  if (before > 0 && health.current <= 0) {
                    score.kills += 1;
                    score.score += 50; // +50 per kill
                  }
                }

                // If killed: free spawner capacity, remove mesh, and destroy entity deterministically
                if (before > 0 && health.current <= 0) {
                  this.entityManager.removeComponent(targetEntity, 'SpawnedTagComponent');
                  if (this.render) {
                    this.render.removeEntityMesh(targetEntity);
                  }
                  this.entityManager.destroyEntity(targetEntity);
                }
              }

              // Emit HUD feedback: 'hit' if not set to 'crit' above
              let fb = this.entityManager.getComponent<CombatFeedbackComponent>(entity, 'CombatFeedbackComponent');
              if (!fb) {
                this.entityManager.addComponent(entity, 'CombatFeedbackComponent', createCombatFeedback());
                fb = this.entityManager.getComponent<CombatFeedbackComponent>(entity, 'CombatFeedbackComponent');
              }
              if (fb) {
                // Emit 'crit' or 'hit' state; HUD/RenderSystem will visualize as needed
                fb.state = critHit ? 'crit' : 'hit';
                fb.version++;
              }
      
            }
      else {
              // Miss feedback
              let fb = this.entityManager.getComponent<CombatFeedbackComponent>(entity, 'CombatFeedbackComponent');
              if (!fb) {
                this.entityManager.addComponent(entity, 'CombatFeedbackComponent', createCombatFeedback());
                fb = this.entityManager.getComponent<CombatFeedbackComponent>(entity, 'CombatFeedbackComponent');
              }
              if (fb) {
                fb.state = 'miss';
                fb.version++;
              }
            }

      // Fire intent consumed; remove so it doesn't persist to next frame.
      this.entityManager.removeComponent(entity, 'FireIntentComponent');
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

  // Use shared interactionGroup helper for consistency across systems

  private performHitscan(shooter: EntityId, maxRange = 100): { targetEntity: EntityId; point: THREE.Vector3; distance: number } | null {
    if (!this.physics) {
      return null;
    }

    const aim = this.entityManager.getComponent<AimComponent>(shooter, 'AimComponent');
    const spread = aim ? (aim.isAiming ? aim.spreadAim : aim.spreadBase) : 0.02;

    // Camera forward with random spread cone
    const dir = this.scratchDir.set(0, 0, -1).applyQuaternion(this.camera.quaternion).normalize();
    const shotDir = this.randomDirectionInCone(dir, spread);

    // Filter: BULLET collides with standardized HITSCAN_MASK
    // Ensure explicit CollisionLayers usage with HITSCAN_MASK
    const filterGroups = interactionGroup(CollisionLayers.BULLET, HITSCAN_MASK);

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
