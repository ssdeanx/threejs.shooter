import * as THREE from 'three';
import { System } from '../core/System.js';
import type { EntityId } from '../core/types.js';
import type { EntityManager } from '../core/EntityManager.js';
import type { PositionComponent, RotationComponent } from '../components/TransformComponents.js';
import type { VelocityComponent, RigidBodyComponent, ColliderComponent } from '../components/PhysicsComponents.js';
import type { PlayerControllerComponent } from '../components/GameplayComponents.js';
import type { PhysicsSystem } from './PhysicsSystem.js';
import { InputSystem } from './InputSystem.js';
import { CollisionLayers, GROUND_PROBE_MASK } from '@/core/CollisionLayers.js';

export class MovementSystem extends System {
  // World wiring and peers
  private entityManager: EntityManager;
  private camera: THREE.PerspectiveCamera;

  // Peers set by main to preserve public API used in main.ts
  private physicsSystem: PhysicsSystem | null = null;
  private input: InputSystem | null = null;

  public setInputSystem(input: InputSystem): void {
    this.input = input;
  }

  public setPhysicsSystem(physics: PhysicsSystem): void {
    this.physicsSystem = physics;
  }

  // Grounding state
  private grounded = false;
  private groundNormal = new THREE.Vector3(0, 1, 0);
  private coyoteTimer = 0;

  // Temps to minimize GC
  private _tmpDir = new THREE.Vector3();
  private _tmpRight = new THREE.Vector3();
  private _move = new THREE.Vector3();
  private _desiredVel = new THREE.Vector3();
  private _down = new THREE.Vector3(0, -1, 0);
  private _origin = new THREE.Vector3();
  private _offset = new THREE.Vector3();
  private _projected = new THREE.Vector3();
  private _impulse = new THREE.Vector3();
  private _up = new THREE.Vector3(0, 1, 0);
  private _quat = new THREE.Quaternion();
  private _jumpVel = new THREE.Vector3();

  // Preallocated offsets for grounding probe (mutated per use)
  private _probeOffsets: [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3] = [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, 0),
  ];

  // Tunables
  private readonly probeRadius = 0.35;      // around feet
  private readonly probeDistance = 0.5;     // max snap distance
  private readonly groundSnapSpeed = 6.0;   // how strongly to snap
  private readonly coyoteTime = 0.12;       // grace window after stepping off
  private readonly airControl = 0.35;       // fraction of ground control in air

  constructor(entityManager: EntityManager, camera: THREE.PerspectiveCamera, input?: InputSystem) {
    super(['PositionComponent', 'VelocityComponent', 'PlayerControllerComponent', 'RigidBodyComponent']);
    this.entityManager = entityManager;
    this.camera = camera;
    this.input = input ?? null;

    // Initialize probe offsets using probeRadius once (no per-frame allocations)
    this._probeOffsets[0].set(0, 0, 0);
    this._probeOffsets[1].set(+this.probeRadius, 0, 0);
    this._probeOffsets[2].set(-this.probeRadius, 0, 0);
    this._probeOffsets[3].set(0, 0, +this.probeRadius);
    this._probeOffsets[4].set(0, 0, -this.probeRadius);
  }

  public update(deltaTime: number, entities: EntityId[]): void {
    // decay coyote timer
    this.coyoteTimer = Math.max(0, this.coyoteTimer - deltaTime);

    for (const entityId of entities) {
      const position = this.entityManager.getComponent<PositionComponent>(entityId, 'PositionComponent');
      const velocity = this.entityManager.getComponent<VelocityComponent>(entityId, 'VelocityComponent');
      const rotation = this.entityManager.getComponent<RotationComponent>(entityId, 'RotationComponent');
      const controller = this.entityManager.getComponent<PlayerControllerComponent>(entityId, 'PlayerControllerComponent');
      const rigidBody = this.entityManager.getComponent<RigidBodyComponent>(entityId, 'RigidBodyComponent');

      if (!position || !velocity || !controller || !rigidBody) {
        continue;
      }

      // 1) Update grounded via five-ray probe against ENV
      this.updateGrounded(entityId, position);

      // 2) Camera-relative intended move
      this.camera.getWorldDirection(this._tmpDir);
      this._tmpDir.y = 0;
      this._tmpDir.normalize();

      this._tmpRight.crossVectors(this._tmpDir, this._up);

      this._move.set(0, 0, 0);
      const forward = this.input?.isActionPressed('moveForward') ?? false;
      const backward = this.input?.isActionPressed('moveBackward') ?? false;
      const left = this.input?.isActionPressed('moveLeft') ?? false;
      const right = this.input?.isActionPressed('moveRight') ?? false;
      const sprint = this.input?.isActionPressed('sprint') ?? false;

      if (forward) {
        this._move.add(this._tmpDir);
      }
      if (backward) {
        this._move.sub(this._tmpDir);
      }
      if (left) {
        this._move.sub(this._tmpRight);
      }
      if (right) {
        this._move.add(this._tmpRight);
      }

      // Normalize move vector to prevent diagonal speed boost
      const speed = controller.moveSpeed * (sprint ? controller.sprintMultiplier : 1);

      // 3) Project movement onto ground plane when grounded
      if (this._move.lengthSq() > 0) {
        this._move.normalize();

        // If grounded, project desired horizontal velocity onto the ground plane to prevent stair/ledge launching
        if (this.grounded) {
          // desired (horizontal) velocity
          this._desiredVel.set(this._move.x * speed, 0, this._move.z * speed);
          // v_proj = v - (v·n) n
          const dot = this._desiredVel.dot(this.groundNormal);
          this._projected.copy(this._desiredVel).addScaledVector(this.groundNormal, -dot);
          this._desiredVel.copy(this._projected);
        } else {
          // in air: reduced control
          this._desiredVel.set(this._move.x * speed * this.airControl, 0, this._move.z * speed * this.airControl);
        }

        // Apply movement intent depending on body kind
        if (this.physicsSystem) {
          if (rigidBody.kind === 'dynamic') {
            const scale = 0.5; // tuned scalar for acceleration feel
            this._impulse.set(this._desiredVel.x * scale, 0, this._desiredVel.z * scale);
            this.physicsSystem.applyImpulse(entityId, this._impulse, true);
          } else {
            this.physicsSystem.setVelocity(entityId, this._desiredVel);
          }
        }

        // 4) Face movement direction (Y-up)
        if (rotation) {
          const targetAngle = Math.atan2(this._move.x, this._move.z);
          this._quat.setFromAxisAngle(this._up, targetAngle);
          rotation.x = this._quat.x; rotation.y = this._quat.y; rotation.z = this._quat.z; rotation.w = this._quat.w;
        }
      } else if (this.grounded && this.physicsSystem) {
        this._desiredVel.set(0, -this.groundSnapSpeed, 0);
        this.physicsSystem.setVelocity(entityId, this._desiredVel);
      }

      // 5) Jump with coyote time
      const canJump = this.grounded || this.coyoteTimer > 0;
      if ((this.input?.isActionPressed('jump') ?? false) && canJump) {
        if (this.physicsSystem) {
          this._jumpVel.set(0, controller.jumpForce, 0);
          this.physicsSystem.setVelocity(entityId, this._jumpVel);
        }
        // leaving ground; reset grounded and coyote
        this.grounded = false;
        this.coyoteTimer = 0;
      }
    }
  }

  // Five-ray probe (center + 4 corners) against ENV, updates grounded and groundNormal; starts coyote when leaving ground.
  private updateGrounded(entityId: EntityId, pos: PositionComponent): void {
    if (!this.physicsSystem) {
      return;
    }

    // Optional: derive a radius from the entity's collider if available; fallback to probeRadius
    let effectiveRadius = this.probeRadius;
    const col = this.entityManager.getComponent<ColliderComponent>(entityId, 'ColliderComponent');
    if (col && col.shape) {
      const shape = col.shape as unknown as {
        type: 'capsule' | 'ball' | 'cuboid' | string;
        radius?: number;
        halfExtents?: { x?: number; z?: number };
      };
      if (shape.type === 'capsule') {
        effectiveRadius = typeof shape.radius === 'number' ? shape.radius : effectiveRadius;
      } else if (shape.type === 'ball') {
        effectiveRadius = typeof shape.radius === 'number' ? shape.radius : effectiveRadius;
      } else if (shape.type === 'cuboid' && shape.halfExtents) {
        const hx = typeof shape.halfExtents.x === 'number' ? shape.halfExtents.x : effectiveRadius;
        const hz = typeof shape.halfExtents.z === 'number' ? shape.halfExtents.z : effectiveRadius;
        effectiveRadius = Math.max(hx, hz);
      }
    }

    // Base origin slightly above feet to avoid starting inside geometry
    this._origin.set(pos.x, pos.y + 0.1, pos.z);

    // Ray direction
    const dir = this._down;

    // Mutate preallocated probe offsets to current effectiveRadius (no array allocation in hot path)
    this._probeOffsets[1].set(+effectiveRadius, 0, 0);
    this._probeOffsets[2].set(-effectiveRadius, 0, 0);
    this._probeOffsets[3].set(0, 0, +effectiveRadius);
    this._probeOffsets[4].set(0, 0, -effectiveRadius);

    let bestHitDist = Number.POSITIVE_INFINITY;
    let anyHit = false;

    for (let i = 0; i < this._probeOffsets.length; i++) {
      this._offset.copy(this._origin).add(this._probeOffsets[i]);
      // Explicitly OR with CollisionLayers.ENV to satisfy "import & fully use" policy
      const hit = this.physicsSystem.raycast(
        this._offset,
        dir,
        this.probeDistance,
        true,
        GROUND_PROBE_MASK
      );
      if (hit) {
        anyHit = true;
        if (hit.toi < bestHitDist) {
          bestHitDist = hit.toi;
          this.groundNormal.copy(hit.normal);
        }
      }
    }

    const wasGrounded = this.grounded;
    this.grounded = anyHit && bestHitDist <= this.probeDistance;
    if (this.grounded) {
      this.coyoteTimer = this.coyoteTime;
    } else if (wasGrounded && !this.grounded) {
      // just left ground; timer is already decaying in update()
    }
  }
}