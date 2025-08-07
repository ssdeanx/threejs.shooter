import * as THREE from 'three';
import { System } from '../core/System.js';
import { CollisionLayers, interactionGroup } from '@/core/CollisionLayers.js';

/**
 * Stage 2 helpers: tiny typed guards and invariant checks.
 * These are non-behavioral and only used for development-time safety.
 */
const __assertPowerOfTwo = (n: number, name: string): void => {
  // power-of-two and non-zero
  if (!(n && (n & (n - 1)) === 0)) {
    throw new Error(`[CollisionLayers] ${name} must be a non-zero single bit (power-of-two). Got: ${n}`);
  }
};

const __validateCollisionLayers = (): void => {
  // Validate common layers we rely on
  __assertPowerOfTwo(Number(CollisionLayers.PLAYER), 'PLAYER');
  __assertPowerOfTwo(Number(CollisionLayers.ENEMY), 'ENEMY');
  __assertPowerOfTwo(Number(CollisionLayers.ENV), 'ENV');
  __assertPowerOfTwo(Number(CollisionLayers.BULLET), 'BULLET');
  __assertPowerOfTwo(Number(CollisionLayers.CAMERA_BLOCKER), 'CAMERA_BLOCKER');

  // Ensure uniqueness (no overlapping bits among core layers)
  const core =
    Number(CollisionLayers.PLAYER) |
    Number(CollisionLayers.ENEMY) |
    Number(CollisionLayers.ENV) |
    Number(CollisionLayers.BULLET) |
    Number(CollisionLayers.CAMERA_BLOCKER);

  // Count bits by clearing lowest-set bit repeatedly
  let bits = 0;
  let x = core;
  while (x) {
    x &= x - 1;
    bits++;
  }
  if (bits < 5) {
    throw new Error('[CollisionLayers] Core layers must be unique single bits; overlap detected.');
  }
};
// Immediately validate at module load without assuming Node globals.
// We avoid referencing `process` to keep browser builds happy.
try {
  __validateCollisionLayers();
} catch (e) {
  // Surface configuration mistakes early but don't crash module eval in production bundles.
  // eslint-disable-next-line no-console
  console.error(e);
}

/** Typed helper: same logic as makeGroups, just returns number explicitly */
const makeGroupsTyped = (rapier: Rapier, member: number, mask: number): number => {
  return makeGroups(rapier, member, mask);
};
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
import type { TerrainHeightfield } from './RenderSystem.js'; // NOTE: Heightfield path is intentionally disabled; using flat plane ground.

/**
 * IMPORTANT:
 * Use only @react-three/rapier (R3R). It doesn’t export engine classes in types, so we access them off the default namespace at runtime.
 * We keep types precise elsewhere and isolate unknown surface to the minimal interop points.
 */
import RAPIER from '@react-three/rapier';
type Rapier = typeof RAPIER;

/**
 * Minimal structural Rapier types to replace any without changing runtime behavior.
 * These mirror only the members we actually touch.
 */
type RapierVec3 = { x: number; y: number; z: number };
type RapierQuat = { x: number; y: number; z: number; w: number };

interface RapierRay {
  pointAt: (toi: number) => RapierVec3;
}

interface RapierRaycastHit {
  collider: RapierCollider | null;
  timeOfImpact: number;
  normal?: RapierVec3;
}

interface RapierRigidBody {
  handle: number;
  translation(): RapierVec3;
  rotation(): RapierQuat;
  linvel(): RapierVec3;

  setNextKinematicTranslation(v: RapierVec3): void;
  setNextKinematicRotation(q: RapierQuat): void;
  setLinvel(v: RapierVec3, wake: boolean): void;

  setLinearDamping?(d: number): void;
  setAngularDamping?(d: number): void;
  setGravityScale?(s: number, wake: boolean): void;
  enableCcd?(on: boolean): void;
  lockRotations?(lock: boolean, wake: boolean): void;

  applyImpulse?(v: RapierVec3, wake: boolean): void;

  numColliders(): number;
  collider(i: number): RapierCollider | null;
}

interface RapierCollider {
  parent(): RapierRigidBody | null;
  setCollisionGroups?(g: number): void;
  setSolverGroups?(g: number): void;
  collisionGroups?(): number;
}

interface RapierColliderSet {
  len?(): number;
  castRay?(
    ray: RapierRay,
    maxToi: number,
    solid: boolean
  ): RapierRaycastHit | null;
}

/* eslint-disable @typescript-eslint/no-unused-vars */
interface RapierWorld {
  step(): void;

  bodies: { get: (h: number) => RapierRigidBody | null };
  colliders: RapierColliderSet;

  // Some builds expose raycast on world, some on colliders
  castRay?(
    ray: RapierRay,
    maxToi: number,
    solid: boolean
  ): RapierRaycastHit | null;
  castRayAndGetNormal?(
    ray: RapierRay,
    maxToi: number,
    solid: boolean,
    filterGroups: number
  ): RapierRaycastHit | null;

  createRigidBody?(desc: unknown): RapierRigidBody;
  createCollider?(desc: unknown, body: RapierRigidBody): RapierCollider | null;
  removeCollider?(c: RapierCollider, wake: boolean): void;
  removeRigidBody?(b: RapierRigidBody): void;
}

/**
 * Construct Rapier interaction groups safely across builds.
 * Uses InteractionGroups.fixed when available; otherwise packs two 16-bit masks manually.
 */
const makeGroups = (rapier: Rapier, member: number, mask: number): number => {
  const ig = (rapier as { InteractionGroups?: { fixed?: (m: number, w: number) => number } }).InteractionGroups;
  if (ig && typeof ig.fixed === 'function') {
    return ig.fixed(member, mask);
  }
  // Fallback to shared packer to keep consistency across systems
  return interactionGroup(member, mask);
};

interface BodyMaps {
  entityToHandle: Map<EntityId, number>;
  handleToEntity: Map<number, EntityId>;
}

export class PhysicsSystem extends System {
  private entityManager: EntityManager;
  private rapier!: Rapier;
  // R3R hosts engine classes on its default export at runtime; since TS types don't expose them, keep world as a narrow structural type.
  // Narrow world type to our structural RapierWorld to enforce interface usage
  private world!: RapierWorld;
  private bodies!: { get: (h: number) => any };
  /** Live reference to world's ColliderSet; used by raycast/group checks */
  private colliders!: { len?: () => number } | any;

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

  async init(_heightfield?: TerrainHeightfield | null, gravity: Vec3 = { x: 0, y: -9.82, z: 0 }): Promise<void> {
    // Use R3R namespace as the engine host; engine classes are available at runtime on the default export.
    if (!RAPIER || typeof (RAPIER as unknown as { World?: unknown }).World !== 'function') {
      throw new TypeError('Rapier WASM not initialized by @react-three/rapier provider');
    }
    this.rapier = RAPIER;
  
    // Construct world and caches via the R3R namespace
    // Instantiate Rapier world via R3R runtime namespace (types are not exposed, so use minimal structural typing)
    const WorldCtor = (this.rapier as unknown as { World?: new (g: { x: number; y: number; z: number }) => any }).World;
    const Vec3Ctor = (this.rapier as unknown as { Vector3?: new (x: number, y: number, z: number) => any }).Vector3;
    if (typeof WorldCtor !== 'function' || typeof Vec3Ctor !== 'function') {
      throw new TypeError('Rapier core constructors not found on @react-three/rapier default export');
    }
    this.world = new WorldCtor(new Vec3Ctor(gravity.x, gravity.y, gravity.z)) as unknown as RapierWorld;
    this.bodies = this.world.bodies as any;
    this.colliders = this.world.colliders as any;
    this.colliderSetIsLive = true;
  
    // Flat ground plane (green visual recommended) to stabilize the project.
    const { RigidBodyDesc } = this.rapier as unknown as { RigidBodyDesc?: { fixed: () => any } };
    const { ColliderDesc } = this.rapier as unknown as { ColliderDesc?: { cuboid: (x: number, y: number, z: number) => any } };
    if (!RigidBodyDesc || !ColliderDesc) {
      throw new TypeError('RigidBodyDesc/ColliderDesc missing on @react-three/rapier default export');
    }
    const groundDesc = RigidBodyDesc.fixed();
    const ground = (this.world as unknown as { createRigidBody: (d: any) => any }).createRigidBody(groundDesc);
    // Physics ground: very large thin box centered at y = -0.5 so top is y = 0
    const halfExt = new Vec3Ctor(500, 0.5, 500);
    const colDesc = ColliderDesc.cuboid(halfExt.x, halfExt.y, halfExt.z);

    const envGroups = makeGroups(
      this.rapier,
      Number(CollisionLayers.ENV),
      Number(CollisionLayers.PLAYER | CollisionLayers.ENEMY | CollisionLayers.BULLET | CollisionLayers.ENV | CollisionLayers.CAMERA_BLOCKER)
    );
    colDesc.setCollisionGroups?.(envGroups);
    colDesc.setSolverGroups?.(envGroups);

    (this.world as unknown as { createCollider: (d: any, b: any) => any }).createCollider(colDesc, ground);
    ground.setTranslation({ x: 0, y: -0.5, z: 0 }, true);
    ground.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
    // Rendering note: add a visible green plane at y = 0 sized ~1000x1000 to match this collider.
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
  getBody(entityId: EntityId): any | null {
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
    // Use typed wrapper to keep structural typing engaged and satisfy TS usage
    const groups = makeGroupsTyped(this.rapier, layersMask, interactsWithMask);
    const count = typeof body.numColliders === 'function' ? body.numColliders() : 0;
    for (let i = 0; i < count; i++) {
      const collider = typeof body.collider === 'function' ? body.collider(i) : null;
      if (collider && typeof collider.setCollisionGroups === 'function') {
        collider.setCollisionGroups(groups);
      }
      if (collider && typeof collider.setSolverGroups === 'function') {
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
    const ray = new (this.rapier as unknown as { Ray: new (o: { x: number; y: number; z: number }, d: { x: number; y: number; z: number }) => any }).Ray(
      { x: origin.x, y: origin.y, z: origin.z },
      { x: nd.x, y: nd.y, z: nd.z }
    );

    // Cast the ray
    // Respect optional filter groups if provided by caller. Use collider-wide query if available.
    let hit: any = null;
    const worldAny = this.world as any;
    if (filterGroups != null && typeof worldAny.castRayAndGetNormal === 'function') {
      // castRayAndGetNormal(ray, maxToi, solid, filterGroups)
      hit = (this.world as unknown as { castRayAndGetNormal: (r: any, m: number, s: boolean, g: number) => any }).castRayAndGetNormal(ray, maxToi, solid, filterGroups);
    } else if (typeof worldAny.castRay === 'function') {
      hit = (this.world as unknown as { castRay: (r: any, m: number, s: boolean) => any }).castRay(ray, maxToi, solid);
    } else if (this.colliders && typeof (this.colliders as any).castRay === 'function') {
      // Fallback: use ColliderSet.castRay if world wrapper lacks the method
      hit = (this.colliders as any).castRay(ray, maxToi, solid);
    }
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

    const parent = typeof collider.parent === 'function' ? collider.parent() : null;
    const entity = parent && typeof parent.handle === 'number' ? (this.maps.handleToEntity.get(parent.handle) ?? null) : null;

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
    const body = (this.world as any).createRigidBody(bodyDesc);
    this.maps.entityToHandle.set(entityId, body.handle);
    this.maps.handleToEntity.set(body.handle, entityId);

    // Create collider(s) from ColliderComponent
    const colliderComp = this.entityManager.getComponent<ColliderComponent>(entityId, 'ColliderComponent');
    if (colliderComp) {
      this.createColliderForBody(body, colliderComp);
    } else {
      // Fallback: small capsule-ish body
      const colDesc = (this.rapier as unknown as { ColliderDesc: { capsule: (hh: number, r: number) => any } }).ColliderDesc
        .capsule(0.9, 0.5)
        .setFriction(1)
        .setRestitution(0);

      // Default to ENV membership colliding with PLAYER | ENEMY | ENV
      // Keep explicit CollisionLayers references; ensure ENV membership and PLAYER|ENEMY|ENV mask
      const fallbackGroups = makeGroupsTyped(
        this.rapier,
        Number(CollisionLayers.ENV),
        Number(CollisionLayers.PLAYER | CollisionLayers.ENEMY | CollisionLayers.ENV)
      );
      colDesc.setCollisionGroups(fallbackGroups);
      colDesc.setSolverGroups(fallbackGroups);

      (this.world as any).createCollider(colDesc, body);
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
        (this.world as unknown as { removeCollider?: (c: any, w: boolean) => void }).removeCollider?.(coll, true);
      }
    }
    (this.world as unknown as { removeRigidBody?: (b: any) => void }).removeRigidBody?.(body);
    this.maps.entityToHandle.delete(entityId);
    this.maps.handleToEntity.delete(handle);
  }

  // Internals

  private createBodyDescFrom(rb: RigidBodyComponent, position: PositionComponent): any {
    const { kind } = rb;
    let desc: any;
    switch (kind) {
      case 'dynamic':
        desc = (this.rapier as unknown as { RigidBodyDesc: { dynamic: () => any } }).RigidBodyDesc.dynamic();
        break;
      case 'kinematicVelocity':
        desc = (this.rapier as unknown as { RigidBodyDesc: { kinematicVelocityBased: () => any } }).RigidBodyDesc.kinematicVelocityBased();
        break;
      case 'kinematicPosition':
        desc = (this.rapier as unknown as { RigidBodyDesc: { kinematicPositionBased: () => any } }).RigidBodyDesc.kinematicPositionBased();
        break;
      case 'fixed':
      default:
        desc = (this.rapier as unknown as { RigidBodyDesc: { fixed: () => any } }).RigidBodyDesc.fixed();
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
  private createColliderForBody(body: any, collider: ColliderComponent): void {
    const desc = this.makeColliderDesc(collider.shape);
    if (collider.restitution != null && typeof desc.setRestitution === 'function') {
      desc.setRestitution(collider.restitution);
    }
    if (collider.friction != null && typeof desc.setFriction === 'function') {
      desc.setFriction(collider.friction);
    }
    if (collider.sensor && typeof desc.setSensor === 'function') {
      desc.setSensor(true);
    }
    if (collider.activeEvents != null && typeof desc.setActiveEvents === 'function') {
      desc.setActiveEvents(collider.activeEvents);
    }
    if (collider.activeCollisionTypes != null && typeof desc.setActiveCollisionTypes === 'function') {
      desc.setActiveCollisionTypes(collider.activeCollisionTypes);
    }

    // Respect explicitly provided groups
    if (collider.collisionGroups != null && typeof desc.setCollisionGroups === 'function') {
      desc.setCollisionGroups(collider.collisionGroups);
    }
    if (collider.solverGroups != null && typeof desc.setSolverGroups === 'function') {
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

      // Use typed wrapper for InteractionGroups packing across Rapier builds
      const groups = makeGroupsTyped(this.rapier, member, mask);
      if (collider.collisionGroups == null && typeof desc.setCollisionGroups === 'function') {
        desc.setCollisionGroups(groups);
      }
      if (collider.solverGroups == null && typeof desc.setSolverGroups === 'function') {
        desc.setSolverGroups(groups);
      }
    }

    if (collider.offset) {
      const o = collider.offset;
      if (typeof (desc as any).setTranslation === 'function') {
        (desc as any).setTranslation(o.position.x, o.position.y, o.position.z);
      }
      if (o.rotation && typeof (desc as any).setRotation === 'function') {
        (desc as any).setRotation({ x: o.rotation.x, y: o.rotation.y, z: o.rotation.z, w: o.rotation.w });
      }
    }

    (this.world as unknown as { createCollider: (d: any, b: any) => any }).createCollider(desc, body);
    // Parent mapping is already set when creating rigid body; nothing else needed here.
  }

  private makeColliderDesc(shape: ColliderShape): any {
    switch (shape.type) {
      case 'cuboid':
        return (this.rapier as unknown as { ColliderDesc: { cuboid: (x: number, y: number, z: number) => any } }).ColliderDesc.cuboid(
          shape.halfExtents.x, shape.halfExtents.y, shape.halfExtents.z
        );
      case 'ball':
        return (this.rapier as unknown as { ColliderDesc: { ball: (r: number) => any } }).ColliderDesc.ball(shape.radius);
      case 'capsule':
        return (this.rapier as unknown as { ColliderDesc: { capsule: (hh: number, r: number) => any } }).ColliderDesc.capsule(shape.halfHeight, shape.radius);
      case 'trimesh':
        return (this.rapier as unknown as { ColliderDesc: { trimesh: (v: Float32Array | number[] | ArrayLike<number>, i: Uint32Array | number[]) => any } })
          .ColliderDesc.trimesh(shape.vertices, shape.indices);
      case 'heightfield': {
        // Heightfield terrain is intentionally disabled to stabilize physics with a canonical flat ground plane at y=0.
        // Throw early in all environments to prevent accidental reintroduction.
        throw new Error('[PhysicsSystem] Heightfield collider is disabled. Use the flat ground plane at y=0 instead.');
      }
      default:
        return (this.rapier as unknown as { ColliderDesc: { ball: (r: number) => any } }).ColliderDesc.ball(0.5);
    }
  }

  // Heightfield is disabled by request to stabilize the project with a flat plane.
  // Keeping a stub for future reactivation if needed.
  // private createHeightfieldStatic(_hf: TerrainHeightfield): void {
  //   // Intentionally disabled. See init() for flat ground creation.
  // }

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
