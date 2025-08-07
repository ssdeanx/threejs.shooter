import * as THREE from 'three';
import { System } from '../core/System.js';
import type { EntityId } from '../core/types.js';
import type { EntityManager } from '../core/EntityManager.js';
import type { PositionComponent } from '../components/TransformComponents.js';
import type { CameraComponent } from '../components/RenderingComponents.js';
import { CollisionLayers, CAMERA_OCCLUSION_MASK } from '@/core/CollisionLayers.js';
import type { PhysicsSystem } from '@/systems/PhysicsSystem.js';

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

  private mouseX = 0;
  private mouseY = 0;
  private cameraDistance = 5;
  private cameraHeight = 2;
  private mouseSensitivity = 0.0016; // slightly lower to reduce jitter with terrain
  private verticalAngle = 0;
  private horizontalAngle = 0;
  private invertLook = true; // Invert vertical mouse look when true
  private minVerticalAngle = -Math.PI / 3; // -60 degrees
  private maxVerticalAngle = Math.PI / 3;  // 60 degrees
  private minCameraDistance = 1; // Minimum distance from player

  constructor(camera: THREE.PerspectiveCamera, entityManager: EntityManager, scene: THREE.Scene) {
    super(['CameraComponent']);
    this.camera = camera;
    this.entityManager = entityManager;
    this.scene = scene;

    // Ensure the managed camera is attached to the scene exactly once
    if (this.scene && this.camera && this.camera.parent !== this.scene) {
      this.scene.add(this.camera);
    }

    this.setupMouseControls();
  }

  private setupMouseControls(): void {
    // Lock pointer on click
    document.addEventListener('click', () => {
      document.body.requestPointerLock();
    });

    // Handle mouse movement
    document.addEventListener('mousemove', (event) => {
      if (document.pointerLockElement === document.body) {
        this.mouseX += event.movementX * this.mouseSensitivity;
        this.mouseY += event.movementY * this.mouseSensitivity;

        // Update camera angles
        this.horizontalAngle -= event.movementX * this.mouseSensitivity;
        const dy = (this.invertLook ? -1 : 1) * event.movementY;
        this.verticalAngle -= dy * this.mouseSensitivity;

        // Clamp vertical angle
        this.verticalAngle = Math.max(this.minVerticalAngle, Math.min(this.maxVerticalAngle, this.verticalAngle));
      }
    });
  }

  update(deltaTime: number, entities: EntityId[]): void {
    // deterministic per-tick smoothing factor derived from dt
    const alpha = Math.max(0, Math.min(1, 1 - Math.exp(-this._smoothK * deltaTime)));

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

      // Calculate camera position based on mouse angles (no allocations)
      this._tmpA.set(tpos.x, tpos.y + this.cameraHeight, tpos.z);

      // Calculate camera offset based on angles
      this._tmpB.set(
        Math.sin(this.horizontalAngle) * this.cameraDistance * Math.cos(this.verticalAngle),
        Math.sin(this.verticalAngle) * this.cameraDistance,
        Math.cos(this.horizontalAngle) * this.cameraDistance * Math.cos(this.verticalAngle)
      );

      // Set target camera position
      this.targetPosition.copy(this._tmpA).add(this._tmpB);

      // Check for camera collision and adjust position (writes into _adjusted)
      const adjustedPosition = this.checkCameraCollision(this._tmpA, this.targetPosition);

      // Smooth camera movement using deterministic alpha
      this.currentPosition.copy(this.camera.position);
      this.currentPosition.lerp(adjustedPosition, alpha);

      // Update camera position
      this.camera.position.copy(this.currentPosition);

      // Make camera look at target
      this.camera.lookAt(this._tmpA.x, this._tmpA.y, this._tmpA.z);

      // Update camera properties
      if (this.camera.fov !== cameraComp.fov) {
        this.camera.fov = cameraComp.fov;
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
        // Explicitly include CollisionLayers reference to meet policy
        (CAMERA_OCCLUSION_MASK | CollisionLayers.CAMERA_BLOCKER)
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
}