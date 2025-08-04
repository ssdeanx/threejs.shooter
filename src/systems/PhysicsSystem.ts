import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { System } from '../core/System.js';
import type { EntityId } from '../core/types.js';
import type { EntityManager } from '../core/EntityManager.js';
import type { PositionComponent, RotationComponent } from '../components/TransformComponents.js';
import type { RigidBodyComponent, VelocityComponent } from '../components/PhysicsComponents.js';

import type { TerrainHeightfield } from './RenderSystem.js';

export class PhysicsSystem extends System {
  private world: CANNON.World;
  private entityManager: EntityManager;
  private bodyMap = new Map<EntityId, CANNON.Body>();
  // Track which entities are kinematic players (locked rotation, move via setPosition)
  private kinematicPlayers = new Set<EntityId>();

  constructor(entityManager: EntityManager, heightfield?: TerrainHeightfield | null) {
    super(['PositionComponent', 'RigidBodyComponent']);
    this.entityManager = entityManager;
    this.world = this.initializePhysicsWorld(heightfield ?? null);
  }

  private initializePhysicsWorld(heightfield: TerrainHeightfield | null): CANNON.World {
    // Create physics world
    const world = new CANNON.World({
      gravity: new CANNON.Vec3(0, -9.82, 0),
    });

    // Use SAPBroadphase for better performance
    world.broadphase = new CANNON.SAPBroadphase(world);

    // Allow bodies to sleep when not moving
    world.allowSleep = true;

    // Build cannon-es Heightfield that matches the visual mesh from RenderSystem
    const groundMat = new CANNON.Material('ground');
    // Note: cannon-es contact properties are controlled via ContactMaterial; set a default here then pair later if needed
    const defaultGround = groundMat;

    if (heightfield) {
      const hfShape = new CANNON.Heightfield(heightfield.heights, { elementSize: heightfield.elementSize });
      const hfBody = new CANNON.Body({ mass: 0, material: defaultGround, type: CANNON.Body.STATIC });
      hfBody.addShape(hfShape, new CANNON.Vec3(heightfield.offsetX, 0, heightfield.offsetZ));
      hfBody.position.set(0, 0, 0);
      world.addBody(hfBody);
    } else {
      // Fallback: large base box if heightfield metadata not available yet
      const base = new CANNON.Box(new CANNON.Vec3(500, 1, 500));
      const groundBody = new CANNON.Body({ mass: 0, type: CANNON.Body.STATIC, material: defaultGround });
      groundBody.addShape(base);
      groundBody.position.set(0, -1, 0);
      world.addBody(groundBody);
    }

    console.log('Physics world initialized');
    return world;
  }

  update(deltaTime: number, entities: EntityId[]): void {
    // Step the physics world with fixed timestep
    this.world.fixedStep(1 / 60, deltaTime);

    // Update entity positions and rotations from physics bodies
    for (const entityId of entities) {
      const position = this.entityManager.getComponent<PositionComponent>(entityId, 'PositionComponent');
      const rotation = this.entityManager.getComponent<RotationComponent>(entityId, 'RotationComponent');
      const rigidBody = this.entityManager.getComponent<RigidBodyComponent>(entityId, 'RigidBodyComponent');

      // If Rigidbody removed but body still exists, cleanup and skip
      const existingBody = this.bodyMap.get(entityId);
      if (!rigidBody && existingBody) {
        this.removeBody(entityId);
        continue;
      }

      if (!position || !rigidBody) continue;

      let body = this.bodyMap.get(entityId);
      if (!body) {
        // Create physics body if it doesn't exist
        this.createPhysicsBody(entityId, position, rigidBody);
        body = this.bodyMap.get(entityId);
        if (!body) continue;
      }

      // Update component positions from physics body
      position.x = body.position.x;
      position.y = body.position.y;
      position.z = body.position.z;

      // Update rotation if component exists
      if (rotation) {
        rotation.x = body.quaternion.x;
        rotation.y = body.quaternion.y;
        rotation.z = body.quaternion.z;
        rotation.w = body.quaternion.w;
      }

      // Update velocity component if it exists
      const velocity = this.entityManager.getComponent<VelocityComponent>(entityId, 'VelocityComponent');
      if (velocity) {
        velocity.x = body.velocity.x;
        velocity.y = body.velocity.y;
        velocity.z = body.velocity.z;
      }
    }
  }

  private createPhysicsBody(entityId: EntityId, position: PositionComponent, rigidBody: RigidBodyComponent): void {
    // Create appropriate shape based on components
    let shape: CANNON.Shape;

    // Prefer ColliderComponent if present
    const collider = this.entityManager.getComponent<any>(entityId, 'ColliderComponent');
    if (collider) {
      const dims = collider.dimensions || { x: 1, y: 1, z: 1 };
      switch (collider.shape) {
        case 'box':
          shape = new CANNON.Box(new CANNON.Vec3(dims.x / 2, dims.y / 2, dims.z / 2));
          break;
        case 'sphere':
          shape = new CANNON.Sphere((dims.x ?? 1) / 2);
          break;
        case 'capsule':
          shape = new CANNON.Cylinder((dims.x ?? 1) / 2, (dims.x ?? 1) / 2, dims.y ?? 1.8, 8);
          break;
        case 'plane':
          shape = new CANNON.Plane();
          break;
        default:
          shape = new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5));
      }
    } else {
      // Fallback: Check if this is a player entity by looking for PlayerControllerComponent
      const hasPlayerController = this.entityManager.hasComponent(entityId, 'PlayerControllerComponent');
      if (hasPlayerController) {
        // Approximate capsule
        shape = new CANNON.Cylinder(0.5, 0.5, 1.8, 8);
      } else {
        // Default box
        shape = new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5));
      }
    }

    // Create physics body
    const body = new CANNON.Body({
      mass: rigidBody.mass,
      shape: shape!,
      position: new CANNON.Vec3(position.x, position.y, position.z),
      type: rigidBody.isKinematic ? CANNON.Body.KINEMATIC : CANNON.Body.DYNAMIC
    });

    // Add some damping to prevent sliding
    // Damping tuned for stability
    body.linearDamping = body.type === CANNON.Body.KINEMATIC ? 1.0 : 0.15;
    body.angularDamping = body.type === CANNON.Body.KINEMATIC ? 1.0 : 0.2;

    // Add body to world and store reference
    this.world.addBody(body);
    this.bodyMap.set(entityId, body);
  }

  addForce(entityId: EntityId, force: THREE.Vector3): void {
    const body = this.bodyMap.get(entityId);
    if (body) {
      body.applyLocalForce(new CANNON.Vec3(force.x, force.y, force.z));
    }
  }

  setVelocity(entityId: EntityId, velocity: THREE.Vector3): void {
    const body = this.bodyMap.get(entityId);
    if (!body) return;

    if (this.kinematicPlayers.has(entityId) || body.type === CANNON.Body.KINEMATIC) {
      // For kinematic, compute next position, snap to ground, keep upright
      const dt = 1 / 60;
      const next = new CANNON.Vec3(
        body.position.x + velocity.x * dt,
        body.position.y + velocity.y * dt,
        body.position.z + velocity.z * dt
      );
      // Simple ground snap and step offset
      const minY = 1; // approx half-height for capsule proxy
      if (next.y < minY) next.y = minY;
      body.position.copy(next);
      body.velocity.set(0, 0, 0);
      body.angularVelocity.set(0, 0, 0);
      // Keep upright by zeroing roll/pitch; preserve yaw by reading current quaternion -> euler
      {
        const q = body.quaternion;
        // Convert quaternion to yaw using standard formula
        const siny_cosp = 2 * (q.w * q.y + q.z * q.x);
        const cosy_cosp = 1 - 2 * (q.y * q.y + q.z * q.z);
        const yaw = Math.atan2(siny_cosp, cosy_cosp);
        body.quaternion.setFromEuler(0, yaw, 0);
      }
      body.aabbNeedsUpdate = true;
    } else {
      body.velocity.set(velocity.x, velocity.y, velocity.z);
    }
  }

  removeBody(entityId: EntityId): void {
    const body = this.bodyMap.get(entityId);
    if (body) {
      this.world.removeBody(body);
      this.bodyMap.delete(entityId);
    }
    this.kinematicPlayers.delete(entityId);
  }

  getWorld(): CANNON.World {
    return this.world;
  }
}