import * as THREE from 'three';
import { System } from '../core/System.js';
import type { EntityId } from '../core/types.js';
import type { EntityManager } from '../core/EntityManager.js';
import type { PositionComponent, RotationComponent } from '../components/TransformComponents.js';
import type { VelocityComponent, RigidBodyComponent } from '../components/PhysicsComponents.js';
import type { PlayerControllerComponent } from '../components/GameplayComponents.js';
import type { PhysicsSystem } from './PhysicsSystem.js';
import { InputSystem } from './InputSystem.js';

export class MovementSystem extends System {
    private entityManager: EntityManager;
    private camera: THREE.PerspectiveCamera;
    private physicsSystem: PhysicsSystem | null = null;
    private input: InputSystem | null = null;

    constructor(entityManager: EntityManager, camera: THREE.PerspectiveCamera, input?: InputSystem) {
        super(['PositionComponent', 'VelocityComponent', 'PlayerControllerComponent', 'RigidBodyComponent']);
        this.entityManager = entityManager;
        this.camera = camera;
        this.input = input ?? null;
    }

    setInputSystem(input: InputSystem): void {
        this.input = input;
    }

    setPhysicsSystem(physicsSystem: PhysicsSystem): void {
        this.physicsSystem = physicsSystem;
    }

    update(deltaTime: number, entities: EntityId[]): void {
        for (const entityId of entities) {
            const position = this.entityManager.getComponent<PositionComponent>(entityId, 'PositionComponent');
            const velocity = this.entityManager.getComponent<VelocityComponent>(entityId, 'VelocityComponent');
            const rotation = this.entityManager.getComponent<RotationComponent>(entityId, 'RotationComponent');
            const controller = this.entityManager.getComponent<PlayerControllerComponent>(entityId, 'PlayerControllerComponent');
            const rigidBody = this.entityManager.getComponent<RigidBodyComponent>(entityId, 'RigidBodyComponent');

            if (!position || !velocity || !controller || !rigidBody) continue;

            // Calculate movement direction relative to camera
            const cameraDirection = new THREE.Vector3();
            this.camera.getWorldDirection(cameraDirection);
            cameraDirection.y = 0; // Remove vertical component
            cameraDirection.normalize();

            const cameraRight = new THREE.Vector3();
            cameraRight.crossVectors(cameraDirection, new THREE.Vector3(0, 1, 0));

            // Calculate movement vector
            const moveVector = new THREE.Vector3(0, 0, 0);

            const forward = this.input?.isActionPressed('moveForward') ?? false;
            const backward = this.input?.isActionPressed('moveBackward') ?? false;
            const left = this.input?.isActionPressed('moveLeft') ?? false;
            const right = this.input?.isActionPressed('moveRight') ?? false;
            const sprint = this.input?.isActionPressed('sprint') ?? false;

            if (forward) {
                moveVector.add(cameraDirection);
            }
            if (backward) {
                moveVector.sub(cameraDirection);
            }
            if (left) {
                moveVector.sub(cameraRight);
            }
            if (right) {
                moveVector.add(cameraRight);
            }

            // Apply horizontal movement using physics forces
            if (moveVector.length() > 0) {
                moveVector.normalize();
                let speed = controller.moveSpeed;

                // Apply sprint multiplier
                if (sprint) {
                    speed *= controller.sprintMultiplier;
                }

                // Kinematic or dynamic: prefer velocity set for controller stability
                if (this.physicsSystem) {
                    const desiredVel = new THREE.Vector3(
                        moveVector.x * speed,
                        0,
                        moveVector.z * speed
                    );
                    this.physicsSystem.setVelocity(entityId, desiredVel);
                }

                // Rotate player to face movement direction
                if (rotation) {
                    const targetAngle = Math.atan2(moveVector.x, moveVector.z);
                    const quaternion = new THREE.Quaternion();
                    quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), targetAngle);

                    rotation.x = quaternion.x;
                    rotation.y = quaternion.y;
                    rotation.z = quaternion.z;
                    rotation.w = quaternion.w;
                }
            }

            // Handle jumping (kinematic-friendly): set upward velocity impulse
            if ((this.input?.isActionPressed('jump') ?? false) && this.isOnGround(velocity)) {
                if (this.physicsSystem) {
                    const jumpVel = new THREE.Vector3(0, controller.jumpForce, 0);
                    this.physicsSystem.setVelocity(entityId, jumpVel);
                }
            }
        }
    }

    private isOnGround(velocity: VelocityComponent): boolean {
        // Simple ground detection - check if vertical velocity is near zero
        return Math.abs(velocity.y) < 0.5;
    }
}