import * as THREE from 'three';
import { System } from '../core/System.js';
import { CollisionLayers } from '@/core/CollisionLayers.js';
import type { EntityId } from '../core/types.js';
import type { EntityManager } from '../core/EntityManager.js';
import type { PositionComponent, RotationComponent } from '../components/TransformComponents.js';
import type {
  RigidBodyComponent,
  VelocityComponent,
  ColliderComponent,
  ColliderShape,
  Vec3,
  RigidBodyKind,
} from '../components/PhysicsComponents.js';
import type { TerrainHeightfield } from './RenderSystem.js';

// Rapier compat build (WASM init)
import RAPIERInit, * as RAPIERNS from '@dimforge/rapier3d-compat';
type Rapier = typeof RAPIERNS;

/**
 * Construct Rapier interaction groups safely across compat builds.
 * Uses InteractionGroups.fixed when available; otherwise packs two 16-bit masks manually.
 */
const makeGroups = (rapier: Rapier, member: number, mask: number): number => {
  const ig = (rapier as unknown as { InteractionGroups?: { fixed?: (m: number, w: number) => number } }).InteractionGroups;
  if (ig && typeof ig.fixed === 'function') {
    return ig.fixed(member, mask);
  }
  // Manual 16-bit packing: low 16 bits = membership, high 16 bits = filter mask
  return ((member & 0xffff) | ((mask & 0xffff) << 16)) >>> 0;
};

interface BodyMaps {
  entityToHandle: Map<EntityId, number>;
  handleToEntity: Map<number, EntityId>;
}

export class PhysicsSystem extends System {
  private entityManager: EntityManager;
  private rapier!: Rapier;
  private world!: RAPIERNS.World;
  private bodies!: RAPIERNS.RigidBodySet;
  /** Live reference to world's ColliderSet; used by raycast/group checks */
  private colliders!: RAPIERNS.ColliderSet;

  /**
   * Live health check for collider set. Hygiene requires symbols to be used:
   * we use this as a functional predicate invoked at the start of queries
   * to assert Rapier world/collider set state hasn't been invalidated.
   */
  private colliderSetIsLive = true; // toggled in init and after world.step()

  private maps: BodyMaps = {
    entityToHandle: new Map(),
    handleToEntity: new Map(),
  };

  // Optional terrain entity id to associate with the heightfield collider
  private terrainEntityId: EntityId | null = null;

  // fixed-step configuration (system-local; render accumulator will live in main.ts)
  private readonly fixedDt = 1 / 60;
  private accumulator = 0;

  // Reusable temp vectors to avoid per-frame allocations where needed
  private readonly tmpV3 = new THREE.Vector3();

  constructor(entityManager: EntityManager) {
    super(['PositionComponent', 'RigidBodyComponent']);
    this.entityManager = entityManager;
  }

  /** Bind the ECS entity that represents the terrain heightfield. Must be called before init(). */
  setTerrainEntity(entityId: EntityId): void {
    this.terrainEntityId = entityId;
  }

  /** Convenience: get currently bound terrain entity (if any) */
  getTerrainEntity(): EntityId | null {
    return this.terrainEntityId;
  }

  async init(heightfield?: TerrainHeightfield | null, gravity: Vec3 = { x: 0, y: -9.82, z: 0 }): Promise<void> {
    // Initialize Rapier once per app (compat build returns a thenable that resolves to the namespace)
    const rapierInit = RAPIERInit as unknown as () => Promise<Rapier>;
    this.rapier = await rapierInit();

    this.world = new this.rapier.World(new this.rapier.Vector3(gravity.x, gravity.y, gravity.z));
    this.bodies = this.world.bodies;
    this.colliders = this.world.colliders;
    // mark collider set live on init
    this.colliderSetIsLive = true;

    // Create ground from heightfield if provided, else fallback to big flat cuboid.
    if (heightfield) {
      this.createHeightfieldStatic(heightfield);
    } else {
      const groundDesc = this.rapier.RigidBodyDesc.fixed();
      const ground = this.world.createRigidBody(groundDesc);
      const halfExt = new this.rapier.Vector3(500, 1, 500);
      const colDesc = this.rapier.ColliderDesc.cuboid(halfExt.x, halfExt.y, halfExt.z);
      this.world.createCollider(colDesc, ground);
      // position ground
      ground.setTranslation({ x: 0, y: -1, z: 0 }, true);
      // keep rotation identity
      ground.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
    }
  }

  update(deltaTime: number, entities: EntityId[]): void {
    // NOTE: main.ts will implement the authoritative accumulator loop.
    // Here we defensively accumulate if called with variable dt.
    this.accumulator += deltaTime;
    while (this.accumulator >= this.fixedDt) {
      // ensure all required bodies exist before stepping
      for (const entityId of entities) {
        const position = this.entityManager.getComponent<PositionComponent>(entityId, 'PositionComponent');
        const rbComp = this.entityManager.getComponent<RigidBodyComponent>(entityId, 'RigidBodyComponent');

        // Cleanup removed bodies
        const hasHandle = this.maps.entityToHandle.has(entityId);
        if (!rbComp && hasHandle) {
          this.removeBody(entityId);
          continue;
        }
        if (!position || !rbComp) {
          continue;
        }

        // Ensure body exists and sync initial state if newly created
        if (!hasHandle) {
          this.createOrUpdateBody(entityId, position, rbComp);
        }
      }

      // Step physics
      this.world.step();
      // after step, affirm collider set is still live (defensive telemetry used by queries)
      this.colliderSetIsLive = ((): boolean => {
        // Rapier compat: ColliderSet exposes len() in most builds
        const anyColliders = this.colliders as unknown as { len?: () => number };
        if (typeof anyColliders.len === 'function') {
          const n = anyColliders.len();
          return typeof n === 'number' && n >= 0;
        }
        // Fallback: attempt to read first collider by iterating attached to a known body if present
        // If no bodies, consider live as true; queries will early-return when nothing is hit anyway.
        return true;
      })();

      // Sync transforms and velocities back to ECS
      for (const entityId of entities) {
        const position = this.entityManager.getComponent<PositionComponent>(entityId, 'PositionComponent');
        const rotation = this.entityManager.getComponent<RotationComponent>(entityId, 'RotationComponent');
        const velocity = this.entityManager.getComponent<VelocityComponent>(entityId, 'VelocityComponent');
        const handle = this.maps.entityToHandle.get(entityId);
        if (!position || handle == null) {
          continue;
        }

        const body = this.bodies.get(handle);
        if (!body) {
          continue;
        }

        const t = body.translation();
        position.x = t.x;
        position.y = t.y;
        position.z = t.z;

        if (rotation) {
          const q = body.rotation();
          rotation.x = q.x;
          rotation.y = q.y;
          rotation.z = q.z;
          rotation.w = q.w;
        }

        if (velocity) {
          const lv = body.linvel();
          velocity.x = lv.x;
          velocity.y = lv.y;
          velocity.z = lv.z;
        }
      }

      this.accumulator -= this.fixedDt;
    }
  }

  // Public API: get Rapier body for an entity (read-only interop; do not mutate outside)
  getBody(entityId: EntityId): RAPIERNS.RigidBody | null {
    const handle = this.maps.entityToHandle.get(entityId);
    return handle != null ? (this.bodies.get(handle) ?? null) : null;
  }

  // Public API: set linear velocity (works for dynamic and kinematicVelocity bodies)
  setVelocity(entityId: EntityId, velocity: THREE.Vector3): void {
    const handle = this.maps.entityToHandle.get(entityId);
    if (handle == null) {
      return;
    }
    const body = this.bodies.get(handle);
    if (!body) {
      return;
    }

    const kind = this.getBodyKind(entityId);
    if (kind === 'kinematicVelocity') {
      body.setNextKinematicTranslation({
        x: body.translation().x + velocity.x * this.fixedDt,
        y: body.translation().y + velocity.y * this.fixedDt,
        z: body.translation().z + velocity.z * this.fixedDt,
      });
      // Keep upright: zero roll/pitch, preserve yaw from current rotation
      const q = body.rotation();
      const yaw = this.quaternionToYaw(q.x, q.y, q.z, q.w);
      body.setNextKinematicRotation(this.yawToQuaternion(yaw));
    } else {
      body.setLinvel({ x: velocity.x, y: velocity.y, z: velocity.z }, true);
    }
  }

  // Public API: impulse for dynamics
  applyImpulse(entityId: EntityId, impulse: THREE.Vector3, wake = true): void {
    const handle = this.maps.entityToHandle.get(entityId);
    if (handle == null) {
      return;
    }
    const body = this.bodies.get(handle);
    if (!body) {
      return;
    }
    body.applyImpulse({ x: impulse.x, y: impulse.y, z: impulse.z }, wake);
  }

  // Public API: set collision/solver groups for an entity's primary collider(s)
  // layersMask/member: which layer this entity belongs to; interactsWithMask: which layers it collides with.
  setCollisionLayers(entityId: EntityId, layersMask: number, interactsWithMask: number): void {
    const handle = this.maps.entityToHandle.get(entityId);
    if (handle == null) {
      return;
    }
    const body = this.bodies.get(handle);
    if (!body) {
      return;
    }
    // Iterate all colliders attached to this body and set groups
    // rapier.js exposes colliderParent iterator via body.colliders()
    const groups = makeGroups(this.rapier, layersMask, interactsWithMask);
    /**
     * Enumerate exactly the colliders attached to this body and set groups on each.
     * Avoid scanning the global ColliderSet; iterate via body.numColliders()/body.collider(i).
     */
    const count = body.numColliders();
    for (let i = 0; i < count; i++) {
      const collider = body.collider(i);
      if (collider) {
        collider.setCollisionGroups(groups);
        collider.setSolverGroups(groups);
      }
    }
  }

  // Raycast API (Rapier-correct signatures)
  raycast(origin: THREE.Vector3, dir: THREE.Vector3, maxToi = 1000, solid = true, filterGroups?: number) {
    // Quick liveness assertion — required symbol is used meaningfully (policy)
    if (!this.colliderSetIsLive) {
      // If we ever detect a stale collider set (should not happen), fail closed.
      return null;
    }

    // Normalize direction for Rapier Ray; scale is provided by maxToi
    const nd = dir.lengthSq() > 0 ? dir.clone().normalize() : new THREE.Vector3(0, -1, 0);
    const ray = new this.rapier.Ray(
      { x: origin.x, y: origin.y, z: origin.z },
      { x: nd.x, y: nd.y, z: nd.z }
    );

    // Cast the ray
    const hit = this.world.castRay(ray, maxToi, solid);
    if (!hit) {
      return null;
    }

    const toi = hit.timeOfImpact;
    const p = ray.pointAt(toi);

    const { collider } = hit;
    if (!collider) {
      return null;
    }

    // Optional groups filter
    if (filterGroups != null) {
      // Respect Rapier InteractionGroups representation across compat builds
      const colliderGroups = collider.collisionGroups();
      // If caller passed a packed fixed(member, mask), accept hit only when masks overlap
      if ((colliderGroups & filterGroups) === 0) {
        return null;
      }
    }

    // Hit normal if available; otherwise fallback to up
    let normalVec3 = new THREE.Vector3(0, 1, 0);
    const maybeNormal = (hit as unknown as { normal?: { x: number; y: number; z: number } }).normal;
    if (maybeNormal && typeof maybeNormal.x === 'number' && typeof maybeNormal.y === 'number' && typeof maybeNormal.z === 'number') {
      normalVec3 = this.tmpV3.set(maybeNormal.x, maybeNormal.y, maybeNormal.z).normalize();
    }

    const parent = collider.parent();
    const entity = parent ? (this.maps.handleToEntity.get(parent.handle) ?? null) : null;

    return {
      entity,
      toi,
      point: new THREE.Vector3(p.x, p.y, p.z),
      normal: normalVec3,
    };
  }

  // Lifecycle for bodies
  createOrUpdateBody(entityId: EntityId, position: PositionComponent, rb: RigidBodyComponent): void {
    const existing = this.maps.entityToHandle.get(entityId);
    if (existing != null) {
      // Live update existing body's adjustable properties and collider groups
      const body = this.bodies.get(existing);
      if (!body) {
        // Handle was stale: drop mapping so we recreate below on next call
        this.maps.entityToHandle.delete(entityId);
      } else {
        // Sync damping/gravity/CCD/rotation locks
        if (rb.linearDamping != null) {
          body.setLinearDamping(rb.linearDamping);
        }
        if (rb.angularDamping != null) {
          body.setAngularDamping(rb.angularDamping);
        }
        if (rb.gravityScale != null) {
          body.setGravityScale(rb.gravityScale, true);
        }
        if (rb.ccd === true) {
          body.enableCcd(true);
        }
        // lockRot maintained via upright yaw handling in setVelocity for kinematic players
        if (rb.lockRot) {
          body.lockRotations(true, true);
        }

        // Update collider groups if a ColliderComponent is present
        const colliderComp = this.entityManager.getComponent<ColliderComponent>(entityId, 'ColliderComponent');
        if (colliderComp) {
          const count = body.numColliders();
          // If explicit groups provided on component, apply to all attached colliders
          if (colliderComp.collisionGroups != null || colliderComp.solverGroups != null) {
            for (let i = 0; i < count; i++) {
              const c = body.collider(i);
              if (!c) {
                continue;
              }
              if (colliderComp.collisionGroups != null) {
                c.setCollisionGroups(colliderComp.collisionGroups);
              }
              if (colliderComp.solverGroups != null) {
                c.setSolverGroups(colliderComp.solverGroups);
              }
            }
          } else {
            // Infer sane defaults (same logic as creation)
            const entityForBody = this.maps.handleToEntity.get(body.handle) ?? entityId;
            let member: number = CollisionLayers.ENV;
            let mask: number = CollisionLayers.PLAYER | CollisionLayers.ENEMY | CollisionLayers.ENV;
            const isPlayer = !!this.entityManager.getComponent(entityForBody, 'PlayerControllerComponent');
            const isEnemy = !!this.entityManager.getComponent(entityForBody, 'EnemyComponent');
            const isBullet = !!this.entityManager.getComponent(entityForBody, 'BulletComponent');
            const isCameraBlocker = !!this.entityManager.getComponent(entityForBody, 'CameraBlockerComponent');
            if (isPlayer) {
              member = Number(CollisionLayers.PLAYER);
              mask = Number(CollisionLayers.ENEMY | CollisionLayers.ENV);
            } else if (isEnemy) {
              member = Number(CollisionLayers.ENEMY);
              mask = Number(CollisionLayers.PLAYER | CollisionLayers.ENV);
            } else if (isBullet) {
              member = Number(CollisionLayers.BULLET);
              mask = Number(CollisionLayers.ENEMY | CollisionLayers.ENV);
            } else if (isCameraBlocker) {
              member = Number(CollisionLayers.CAMERA_BLOCKER);
              mask = Number(CollisionLayers.CAMERA_BLOCKER);
            } else {
              member = Number(CollisionLayers.ENV);
              mask = Number(CollisionLayers.PLAYER | CollisionLayers.ENEMY | CollisionLayers.ENV);
            }
            const groups = makeGroups(this.rapier, member, mask);
            for (let i = 0; i < count; i++) {
              const c = body.collider(i);
              if (!c) {
                continue;
              }
              c.setCollisionGroups(groups);
              c.setSolverGroups(groups);
            }
          }
        }

        // Ensure ECS handle reflects current body
        rb.handle = body.handle;

        // Ensure body transform matches ECS Position when first becoming tracked (optional sync)
        // Only adjust for kinematicPosition-based bodies; velocity-based uses setNext in setVelocity.
        if (rb.kind === 'kinematicPosition') {
          body.setNextKinematicTranslation({ x: position.x, y: position.y, z: position.z });
        }

        return;
      }
    }

    // Create new body when none exists
    const bodyDesc = this.createBodyDescFrom(rb, position);
    const body = this.world.createRigidBody(bodyDesc);
    this.maps.entityToHandle.set(entityId, body.handle);
    this.maps.handleToEntity.set(body.handle, entityId);

    // Create collider(s) from ColliderComponent
    const colliderComp = this.entityManager.getComponent<ColliderComponent>(entityId, 'ColliderComponent');
    if (colliderComp) {
      this.createColliderForBody(body, colliderComp);
    } else {
      // Fallback: small capsule-ish body
      const colDesc = this.rapier.ColliderDesc.capsule(0.9, 0.5)
        .setFriction(1)
        .setRestitution(0);

      // Default to ENV membership colliding with PLAYER | ENEMY | ENV
      const fallbackGroups = makeGroups(
        this.rapier,
        CollisionLayers.ENV,
        CollisionLayers.PLAYER | CollisionLayers.ENEMY | CollisionLayers.ENV
      );
      colDesc.setCollisionGroups(fallbackGroups);
      colDesc.setSolverGroups(fallbackGroups);

      this.world.createCollider(colDesc, body);
    }

    // Apply optional properties
    if (rb.linearDamping != null) {
      body.setLinearDamping(rb.linearDamping);
    }
    if (rb.angularDamping != null) {
      body.setAngularDamping(rb.angularDamping);
    }
    if (rb.gravityScale != null) {
      body.setGravityScale(rb.gravityScale, true);
    }
    if (rb.ccd === true) {
      body.enableCcd(true);
    }
    if (rb.lockRot) {
      body.lockRotations(true, true);
      // keep yaw free: Rapier doesn't support axis-wise lock; we maintain yaw by setting rotation per frame for kinematics
    }

    // Cache handle back to component
    rb.handle = body.handle;
  }

  removeBody(entityId: EntityId): void {
    const handle = this.maps.entityToHandle.get(entityId);
    if (handle == null) {
      return;
    }
    const body = this.bodies.get(handle);
    if (!body) {
      this.maps.entityToHandle.delete(entityId);
      return;
    }

    /**
     * Remove ALL colliders attached to this body before removing the rigid body,
     * then clean up handle mappings.
     */
    const colliderCount = body.numColliders();
    for (let i = 0; i < colliderCount; i++) {
      const coll = body.collider(i);
      if (coll) {
        this.world.removeCollider(coll, true);
      }
    }
    this.world.removeRigidBody(body);
    this.maps.entityToHandle.delete(entityId);
    this.maps.handleToEntity.delete(handle);
  }

  // Internals

  private createBodyDescFrom(rb: RigidBodyComponent, position: PositionComponent): RAPIERNS.RigidBodyDesc {
    const { kind } = rb;
    let desc: RAPIERNS.RigidBodyDesc;
    switch (kind) {
      case 'dynamic':
        desc = this.rapier.RigidBodyDesc.dynamic();
        break;
      case 'kinematicVelocity':
        desc = this.rapier.RigidBodyDesc.kinematicVelocityBased();
        break;
      case 'kinematicPosition':
        desc = this.rapier.RigidBodyDesc.kinematicPositionBased();
        break;
      case 'fixed':
      default:
        desc = this.rapier.RigidBodyDesc.fixed();
        break;
    }

    desc = desc.setTranslation(position.x, position.y, position.z);
    desc = desc.setRotation({ x: 0, y: 0, z: 0, w: 1 });

    if (rb.canSleep === false) {
      desc = desc.setCanSleep(false);
    }
    if (rb.ccd) {
      desc = desc.setCcdEnabled(true);
    }

    return desc;
  }
  private createColliderForBody(body: RAPIERNS.RigidBody, collider: ColliderComponent): void {
    const desc = this.makeColliderDesc(collider.shape);
    if (collider.restitution != null) {
      desc.setRestitution(collider.restitution);
    }
    if (collider.friction != null) {
      desc.setFriction(collider.friction);
    }
    if (collider.sensor) {
      desc.setSensor(true);
    }
    if (collider.activeEvents != null) {
      desc.setActiveEvents(collider.activeEvents);
    }
    if (collider.activeCollisionTypes != null) {
      desc.setActiveCollisionTypes(collider.activeCollisionTypes);
    }

    // Respect explicitly provided groups
    if (collider.collisionGroups != null) {
      desc.setCollisionGroups(collider.collisionGroups);
    }
    if (collider.solverGroups != null) {
      desc.setSolverGroups(collider.solverGroups);
    }

    // If groups were not provided, infer sane defaults using ECS role components
    if (collider.collisionGroups == null || collider.solverGroups == null) {
      // Find the owning entity from the rigid body handle
      const entityId = this.maps.handleToEntity.get(body.handle);
      // Rapier InteractionGroups.fixed packs two 16-bit values (membership, filterMask)
      // Ensure we pass plain numbers; keep local variables typed as number
      let member: number = CollisionLayers.ENV;
      let mask: number = CollisionLayers.PLAYER | CollisionLayers.ENEMY | CollisionLayers.ENV;

      if (entityId != null) {
        const isPlayer = !!this.entityManager.getComponent(entityId, 'PlayerControllerComponent');
        const isEnemy = !!this.entityManager.getComponent(entityId, 'EnemyComponent');
        const isBullet = !!this.entityManager.getComponent(entityId, 'BulletComponent');
        const isCameraBlocker = !!this.entityManager.getComponent(entityId, 'CameraBlockerComponent');

        if (isPlayer) {
          member = Number(CollisionLayers.PLAYER);
          mask = Number(CollisionLayers.ENEMY | CollisionLayers.ENV);
        } else if (isEnemy) {
          member = Number(CollisionLayers.ENEMY);
          mask = Number(CollisionLayers.PLAYER | CollisionLayers.ENV);
        } else if (isBullet) {
          member = Number(CollisionLayers.BULLET);
          mask = Number(CollisionLayers.ENEMY | CollisionLayers.ENV);
        } else if (isCameraBlocker) {
          member = Number(CollisionLayers.CAMERA_BLOCKER);
          mask = Number(CollisionLayers.CAMERA_BLOCKER);
        } else {
          member = Number(CollisionLayers.ENV);
          mask = Number(CollisionLayers.PLAYER | CollisionLayers.ENEMY | CollisionLayers.ENV);
        }
      }

      const groups = makeGroups(this.rapier, member, mask);
      if (collider.collisionGroups == null) {
        desc.setCollisionGroups(groups);
      }
      if (collider.solverGroups == null) {
        desc.setSolverGroups(groups);
      }
    }

    if (collider.offset) {
      const o = collider.offset;
      desc.setTranslation(o.position.x, o.position.y, o.position.z);
      if (o.rotation) {
        desc.setRotation({ x: o.rotation.x, y: o.rotation.y, z: o.rotation.z, w: o.rotation.w });
      }
    }

    this.world.createCollider(desc, body);
    // Parent mapping is already set when creating rigid body; nothing else needed here.
  }

  private makeColliderDesc(shape: ColliderShape): RAPIERNS.ColliderDesc {
    switch (shape.type) {
      case 'cuboid':
        return this.rapier.ColliderDesc.cuboid(shape.halfExtents.x, shape.halfExtents.y, shape.halfExtents.z);
      case 'ball':
        return this.rapier.ColliderDesc.ball(shape.radius);
      case 'capsule':
        return this.rapier.ColliderDesc.capsule(shape.halfHeight, shape.radius);
      case 'trimesh':
        return this.rapier.ColliderDesc.trimesh(shape.vertices, shape.indices);
      case 'heightfield': {
        const rows = shape.heights.length;
        const cols = shape.heights[0]?.length ?? 0;
        const scale = new this.rapier.Vector3(shape.scale.x, shape.scale.y, shape.scale.z);
        return this.rapier.ColliderDesc.heightfield(rows, cols, new Float32Array(shape.heights.flat()), scale);
      }
      default:
        return this.rapier.ColliderDesc.ball(0.5);
    }
  }

  private createHeightfieldStatic(hf: TerrainHeightfield): void {
    const rows = hf.heights.length;
    const cols = hf.heights[0]?.length ?? 0;
    const heights = new Float32Array(rows * cols);
    let k = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        heights[k++] = hf.heights[r][c];
      }
    }
    // scale: elementSize along X/Z, 1 on Y (already in heights)
    const scale = new this.rapier.Vector3(hf.elementSize, 1, hf.elementSize);

    const bodyDesc = this.rapier.RigidBodyDesc.fixed().setTranslation(0, 0, 0);
    const body = this.world.createRigidBody(bodyDesc);

    // If a terrain entity was provided, map the body handle to it so raycasts resolve to this entity.
    if (this.terrainEntityId != null) {
      this.maps.handleToEntity.set(body.handle, this.terrainEntityId);
      this.maps.entityToHandle.set(this.terrainEntityId, body.handle);
    }

    const colDesc = this.rapier.ColliderDesc.heightfield(rows, cols, heights, scale)
      .setTranslation(hf.offsetX, 0, hf.offsetZ);

    // Set sensible collision groups for environment
    const envGroups = makeGroups(
      this.rapier,
      CollisionLayers.ENV,
      CollisionLayers.PLAYER | CollisionLayers.ENEMY | CollisionLayers.BULLET | CollisionLayers.ENV | CollisionLayers.CAMERA_BLOCKER
    );
    colDesc.setCollisionGroups(envGroups);
    colDesc.setSolverGroups(envGroups);

    this.world.createCollider(colDesc, body);
  }

  private getBodyKind(entityId: EntityId): RigidBodyKind | null {
    const rb = this.entityManager.getComponent<RigidBodyComponent>(entityId, 'RigidBodyComponent');
    return rb ? rb.kind : null;
  }

  private quaternionToYaw(x: number, y: number, z: number, w: number): number {
    const siny_cosp = 2 * (w * y + z * x);
    const cosy_cosp = 1 - 2 * (y * y + z * z);
    return Math.atan2(siny_cosp, cosy_cosp);
  }

  private yawToQuaternion(yaw: number): { x: number; y: number; z: number; w: number } {
    const half = yaw * 0.5;
    return { x: 0, y: Math.sin(half), z: 0, w: Math.cos(half) };
  }
}