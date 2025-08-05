import * as THREE from 'three';
import { System } from '../core/System.js';
import type { EntityId } from '../core/types.js';
import type { EntityManager } from '../core/EntityManager.js';
import type { PositionComponent } from '../components/TransformComponents.js';
import type { CameraComponent } from '../components/RenderingComponents.js';
import { CollisionLayers } from '@/core/CollisionLayers.js';
import type { PhysicsSystem } from '@/systems/PhysicsSystem.js';

export class CameraSystem extends System {
  private camera: THREE.PerspectiveCamera;
  private entityManager: EntityManager;
  private scene: THREE.Scene;
  // Physics-driven occlusion (replaces Three.Raycaster)
  private physicsSystem: PhysicsSystem | null = null;

  private currentPosition = new THREE.Vector3();
  private targetPosition = new THREE.Vector3();
  private smoothingFactor = 0.1;
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
    for (const entityId of entities) {
      const cameraComp = this.entityManager.getComponent<CameraComponent>(entityId, 'CameraComponent');

      if (!cameraComp || !cameraComp.target) continue;

      // Get target entity position
      const targetPosition = this.entityManager.getComponent<PositionComponent>(cameraComp.target, 'PositionComponent');

      if (!targetPosition) continue;

      // Calculate camera position based on mouse angles
      const targetPos = new THREE.Vector3(targetPosition.x, targetPosition.y + this.cameraHeight, targetPosition.z);

      // Calculate camera offset based on angles
      const cameraOffset = new THREE.Vector3(
        Math.sin(this.horizontalAngle) * this.cameraDistance * Math.cos(this.verticalAngle),
        Math.sin(this.verticalAngle) * this.cameraDistance,
        Math.cos(this.horizontalAngle) * this.cameraDistance * Math.cos(this.verticalAngle)
      );

      // Set target camera position
      this.targetPosition.copy(targetPos).add(cameraOffset);

      // Check for camera collision and adjust position
      const adjustedPosition = this.checkCameraCollision(targetPos, this.targetPosition);

      // Smooth camera movement using deltaTime
      this.currentPosition.copy(this.camera.position);
      this.currentPosition.lerp(adjustedPosition, this.smoothingFactor * deltaTime * 60);

      // Update camera position
      this.camera.position.copy(this.currentPosition);

      // Make camera look at target
      this.camera.lookAt(targetPos.x, targetPos.y, targetPos.z);

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
    // Calculate direction from player to desired camera position
    const direction = new THREE.Vector3().subVectors(desiredCameraPos, playerPos);
    const distance = Math.max(direction.length(), this.minCameraDistance);
    if (distance <= this.minCameraDistance) {
      // Too close to meaningfully test; keep desired within min distance
      const dir = direction.lengthSq() > 0 ? direction.clone().normalize() : new THREE.Vector3(0, 0, 1);
      return new THREE.Vector3().copy(playerPos).add(dir.multiplyScalar(this.minCameraDistance));
    }
    const dir = direction.clone().normalize();

    // If physics available, prefer Rapier-based raycast filtered to CAMERA_BLOCKER
    if (this.physicsSystem) {
      const hit = this.physicsSystem.raycast(
        playerPos,
        dir,
        distance,
        true,
        CollisionLayers.CAMERA_BLOCKER
      );

      if (hit) {
        // Clamp camera just before the hit point with a small safety margin along the ray
        const safety = 0.05;
        const adjustedDistance = Math.max(hit.toi - safety, this.minCameraDistance);
        return new THREE.Vector3().copy(playerPos).add(dir.multiplyScalar(adjustedDistance));
      }
    }

    // Fallback: no physics yet; return desired position
    return desiredCameraPos;
  }

  setSmoothingFactor(factor: number): void {
    this.smoothingFactor = Math.max(0, Math.min(1, factor));
  }

  // Wire in PhysicsSystem for occlusion raycasts
  setPhysicsSystem(physics: PhysicsSystem): void {
    this.physicsSystem = physics;
  }
}