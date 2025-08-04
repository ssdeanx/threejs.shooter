import * as THREE from 'three';
import { System } from '../core/System.js';
import type { EntityId } from '../core/types.js';
import type { EntityManager } from '../core/EntityManager.js';
import type { PositionComponent } from '../components/TransformComponents.js';
import type { CameraComponent } from '../components/RenderingComponents.js';

export class CameraSystem extends System {
  private camera: THREE.PerspectiveCamera;
  private entityManager: EntityManager;
  private scene: THREE.Scene;
  private raycaster = new THREE.Raycaster();
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
  // Optimized collision set
  private collidables = new Set<THREE.Object3D>();

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
    const distance = direction.length();
    direction.normalize();

    // Set up raycaster from player position towards camera
    this.raycaster.set(playerPos, direction);
    this.raycaster.far = distance;

    // Use maintained collidable set instead of per-frame traversal
    const intersectableObjects: THREE.Object3D[] = Array.from(this.collidables).filter(
      (o) => (o as any).visible !== false
    );

    // Check for intersections
    const intersections = this.raycaster.intersectObjects(intersectableObjects, false);

    if (intersections.length > 0) {
      // Find the closest intersection
      const closestIntersection = intersections[0];
      const intersectionDistance = closestIntersection.distance;

      // Calculate adjusted camera position
      const adjustedDistance = Math.max(intersectionDistance - 0.5, this.minCameraDistance);
      const adjustedPosition = new THREE.Vector3()
        .copy(playerPos)
        .add(direction.multiplyScalar(adjustedDistance));

      return adjustedPosition;
    }

    // No collision, return desired position
    return desiredCameraPos;
  }

  setSmoothingFactor(factor: number): void {
    this.smoothingFactor = Math.max(0, Math.min(1, factor));
  }

  // Public API to manage collidable objects
  addCollidable(obj: THREE.Object3D): void {
    this.collidables.add(obj);
  }

  removeCollidable(obj: THREE.Object3D): void {
    this.collidables.delete(obj);
  }
}