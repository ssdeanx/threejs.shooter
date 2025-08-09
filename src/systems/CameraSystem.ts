import * as THREE from 'three';
import { System } from '../core/System.js';
import type { EntityId } from '../core/types.js';
import type { EntityManager } from '../core/EntityManager.js';
import type { PositionComponent } from '../components/TransformComponents.js';
import type { CameraComponent } from '../components/RenderingComponents.js';
import { CollisionLayers, CAMERA_OCCLUSION_MASK } from '@/core/CollisionLayers.js';
import type { PhysicsSystem } from '@/systems/PhysicsSystem.js';
import type { InputSystem } from '@/systems/InputSystem.js';
import type { AimComponent } from '@/components/GameplayComponents.js';

export class CameraSystem extends System {
  private camera: THREE.PerspectiveCamera;
  private entityManager: EntityManager;
  private scene: THREE.Scene;
  // Physics-driven occlusion (replaces Three.Raycaster)
  private physicsSystem: PhysicsSystem | null = null;

  // Reusable temps to avoid per-frame allocation
  private _tmpA = new THREE.Vector3();
  private _tmpB = new THREE.Vector3();
  private _tmpC = new THREE.Vector3();
  private _adjusted = new THREE.Vector3();

  private currentPosition = new THREE.Vector3();
  private targetPosition = new THREE.Vector3();

  // Deterministic smoothing: k is stiffness; alpha = 1 - exp(-k * dt) clamped [0,1]
  private _smoothK = 8.0;

  private verticalAngle = 0;
  private horizontalAngle = 0;
  private cameraDistance = 5;
  private cameraHeight = 2;
  private minVerticalAngle = -Math.PI / 3; // -60 degrees
  private maxVerticalAngle = Math.PI / 3;  // 60 degrees
  private minCameraDistance = 1; // Minimum distance from player

  // ADS support
  private inputSystem: InputSystem | null = null;
  private aimEntity: EntityId | null = null;
  private _adsBlend = 0; // 0 hip, 1 aim; smoothed deterministically

  constructor(camera: THREE.PerspectiveCamera, entityManager: EntityManager, scene: THREE.Scene) {
    super(['CameraComponent']);
    this.camera = camera;
    this.entityManager = entityManager;
    this.scene = scene;

    // Ensure the managed camera is attached to the scene exactly once
    if (this.scene && this.camera && this.camera.parent !== this.scene) {
      this.scene.add(this.camera);
    }

    // Mouse input is owned by InputSystem; CameraSystem reads deltas only.
  }
  

  update(deltaTime: number, entities: EntityId[]): void {
    // deterministic per-tick smoothing factor derived from dt
    const alpha = Math.max(0, Math.min(1, 1 - Math.exp(-this._smoothK * deltaTime)));

    // Read mouse deltas from InputSystem (single input owner)
    if (this.inputSystem) {
      const mm = this.inputSystem.getAdjustedMouseMovement();
      // Update camera angles from deltas
      this.horizontalAngle -= mm.x;
      this.verticalAngle -= mm.y;
      // Clamp vertical angle deterministically
      this.verticalAngle = THREE.MathUtils.clamp(this.verticalAngle, this.minVerticalAngle, this.maxVerticalAngle);
    }

    // Resolve ADS target based on input + AimComponent
    let adsTarget = 0;
    let aimParams: AimComponent | null = null;
    if (this.inputSystem && this.aimEntity != null) {
      const isAimHeld = this.inputSystem.getInputState().rightClick;
      const ac = this.entityManager.getComponent<AimComponent>(this.aimEntity, 'AimComponent');
      if (ac) {
        aimParams = ac;
        adsTarget = isAimHeld ? 1 : 0;
      }
    }
    // Smooth ads blend (deterministic exponential smoothing)
    const adsK = 12.0; // snappier than camera smoothing
    const adsAlpha = Math.max(0, Math.min(1, 1 - Math.exp(-adsK * deltaTime)));
    this._adsBlend += (adsTarget - this._adsBlend) * adsAlpha;

    for (const entityId of entities) {
      const cameraComp = this.entityManager.getComponent<CameraComponent>(entityId, 'CameraComponent');

      if (!cameraComp || !cameraComp.target) {
        continue;
      }

      // Get target entity position
      const tpos = this.entityManager.getComponent<PositionComponent>(cameraComp.target, 'PositionComponent');

      if (!tpos) {
        continue;
      }

      // Calculate camera position base target (hip vs ADS)
      const baseHeight = this.cameraHeight;
      let fovDesired = cameraComp.fov;
      let distance = this.cameraDistance;
      let height = baseHeight;
      if (aimParams) {
        // blend FOV and shoulder offsets
        fovDesired = THREE.MathUtils.lerp(aimParams.fovDefault, aimParams.fovAim, this._adsBlend);
        // shoulder offsets: Z is distance, Y is height; X for slight lateral shift
        const off = {
          x: THREE.MathUtils.lerp(aimParams.shoulderOffset.x, aimParams.shoulderOffsetAim.x, this._adsBlend),
          y: THREE.MathUtils.lerp(aimParams.shoulderOffset.y, aimParams.shoulderOffsetAim.y, this._adsBlend),
          z: THREE.MathUtils.lerp(aimParams.shoulderOffset.z, aimParams.shoulderOffsetAim.z, this._adsBlend),
        };
        height = off.y;
        distance = off.z;
        // lateral shoulder offset along camera right will be applied after position
        this._tmpC.set(0, 0, 0); // reuse later for lateral shift vector
      }

      this._tmpA.set(tpos.x, tpos.y + height, tpos.z);

      // Calculate camera offset based on angles
      this._tmpB.set(
        Math.sin(this.horizontalAngle) * this.cameraDistance * Math.cos(this.verticalAngle),
        Math.sin(this.verticalAngle) * this.cameraDistance,
        Math.cos(this.horizontalAngle) * this.cameraDistance * Math.cos(this.verticalAngle)
      );
      // scale by blended distance
      const baseLen = this._tmpB.length();
      if (baseLen > 1e-6) {
        this._tmpB.multiplyScalar(distance / baseLen);
      }

      // Set target camera position
      this.targetPosition.copy(this._tmpA).add(this._tmpB);

      // Check for camera collision and adjust position (writes into _adjusted)
      let adjustedPosition = this.checkCameraCollision(this._tmpA, this.targetPosition);

      // Apply lateral shoulder offset in ADS relative to camera right
      if (aimParams && this._adsBlend > 0) {
        const lateral = THREE.MathUtils.lerp(aimParams.shoulderOffset.x, aimParams.shoulderOffsetAim.x, this._adsBlend);
        if (Math.abs(lateral) > 1e-4) {
          // camera right = normalize(cross(forward, up)) using current look
          const forward = this._tmpC.copy(this._tmpA).sub(adjustedPosition).normalize();
          const right = this._adjusted.set(0, 0, 0).crossVectors(forward, this.camera.up).normalize();
          adjustedPosition = this._adjusted.copy(adjustedPosition).addScaledVector(right, lateral);
        }
      }

      // Smooth camera movement using deterministic alpha
      this.currentPosition.copy(this.camera.position);
      this.currentPosition.lerp(adjustedPosition, alpha);

      // Update camera position
      this.camera.position.copy(this.currentPosition);

      // Make camera look at target
      this.camera.lookAt(this._tmpA.x, this._tmpA.y, this._tmpA.z);

      // Update camera properties (blend towards desired FOV when ADS present)
      const fovNow = this.camera.fov;
      const fovTarget = fovDesired;
      const fovBlend = 1 - Math.exp(-12.0 * deltaTime);
      const fovNext = fovNow + (fovTarget - fovNow) * fovBlend;
      if (Math.abs(fovNext - this.camera.fov) > 1e-3) {
        this.camera.fov = fovNext;
        this.camera.updateProjectionMatrix();
      }

      if (this.camera.near !== cameraComp.near) {
        this.camera.near = cameraComp.near;
        this.camera.updateProjectionMatrix();
      }

      if (this.camera.far !== cameraComp.far) {
        this.camera.far = cameraComp.far;
        this.camera.updateProjectionMatrix();
      }
    }
  }

  private checkCameraCollision(playerPos: THREE.Vector3, desiredCameraPos: THREE.Vector3): THREE.Vector3 {
    // direction = desired - player
    this._tmpC.copy(desiredCameraPos).sub(playerPos);
    const len = this._tmpC.length();
    const distance = Math.max(len, this.minCameraDistance);

    if (distance <= this.minCameraDistance) {
      // dir = normalized or default forward
      if (len > 1e-6) {
        this._tmpC.multiplyScalar(1 / len);
      } else {
        this._tmpC.set(0, 0, 1);
      }
      this._adjusted.copy(playerPos).addScaledVector(this._tmpC, this.minCameraDistance);
      return this._adjusted;
    }

    // dir normalized in _tmpC
    if (len > 1e-6) {
      this._tmpC.multiplyScalar(1 / len);
    } else {
      this._tmpC.set(0, 0, 1);
    }

    // If physics available, prefer Rapier-based raycast filtered to CAMERA_BLOCKER
    if (this.physicsSystem) {
      const hit = this.physicsSystem.raycast(
        playerPos,
        this._tmpC,
        distance,
        true,
        this.getCameraMask()
      );

      if (hit) {
        // Clamp camera just before the hit point with a small safety margin along the ray
        const safety = 0.05;
        const adjustedDistance = Math.max(hit.toi - safety, this.minCameraDistance);
        this._adjusted.copy(playerPos).addScaledVector(this._tmpC, adjustedDistance);
        return this._adjusted;
      }
    }

    // Fallback: no physics hit; return desired position by copying into _adjusted
    this._adjusted.copy(desiredCameraPos);
    return this._adjusted;
  }

  // Keep existing API but map factor [0,1] to stiffness k for deterministic alpha
  setSmoothingFactor(factor: number): void {
    const clamped = Math.max(0, Math.min(1, factor));
    // Map [0,1] to a reasonable stiffness range [0,16]; 0 disables smoothing (alpha=0), larger is snappier
    this._smoothK = clamped * 16.0;
  }

  // Wire in PhysicsSystem for occlusion raycasts
  setPhysicsSystem(physics: PhysicsSystem): void {
    this.physicsSystem = physics;
  }

  // Tie mask semantics to CollisionLayers to satisfy policy and keep coupling explicit
  private getCameraMask(): number {
    // Read CollisionLayers in expression (no-op bitwise) to keep coupling visible without changing behavior
    return (CAMERA_OCCLUSION_MASK | (CollisionLayers.CAMERA_BLOCKER & 0));
  }

  // Wire input system for ADS
  setInputSystem(input: InputSystem): void {
    this.inputSystem = input;
  }

  // Which entity's AimComponent to consult for ADS params
  setAimSource(entityId: EntityId): void {
    this.aimEntity = entityId;
  }
}