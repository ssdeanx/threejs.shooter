import * as THREE from 'three';
import { System } from '../core/System.js';
import type { EntityManager } from '../core/EntityManager.js';
import type { EntityId } from '@/core/types.js';
import type { PositionComponent, RotationComponent, ScaleComponent } from '@/components/TransformComponents.js';
import type { VelocityComponent } from '@/components/PhysicsComponents.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

type MixerHandle = {
  mixer: THREE.AnimationMixer;
  actions: Record<string, THREE.AnimationAction>;
  root: THREE.Object3D;
};

export class SoldierSystem extends System {
  private scene: THREE.Scene;
  private entityManager: EntityManager;
  private loader = new GLTFLoader();

  private mixerHandle: MixerHandle | null = null;
  private soldierUrl = 'assets/models/characters/soldier.glb';
  private weaponUrl = 'assets/models/weapons/m4a1.glb';

  // Optional root for organizing character hierarchy in the scene
  private groupRoot: THREE.Group | null = null;
  private targetEntity: EntityId | null = null;
  // Reusable temps to avoid per-frame allocations
  private _qTmp: THREE.Quaternion = new THREE.Quaternion();
  // Track current animation to prevent restarting every frame
  private _currentAnim: string | null = null;

  constructor(scene: THREE.Scene, entityManager: EntityManager) {
    // This System doesn't depend on ECS components; we tick every frame for animation
    super([]);
    this.scene = scene;
    this.entityManager = entityManager;
  }

  async init(): Promise<void> {
    // Load soldier
    const soldier = await this.loadGLB(this.soldierUrl);
    const root = soldier.scene || soldier.scenes?.[0];
    if (!root) {
      console.error('SoldierSystem: GLB has no scene root');
      return;
    }

    // Place at origin (0,0,0)
    root.position.set(0, 0, 0);
    root.traverse((obj) => {
      obj.castShadow = true;
      obj.receiveShadow = true;
    });

    // Create organization group
    this.groupRoot = new THREE.Group();
    this.groupRoot.name = 'SoldierRoot';
    this.groupRoot.add(root);
    this.scene.add(this.groupRoot);

    // Setup animations
    const mixer = new THREE.AnimationMixer(root);
    const actions: Record<string, THREE.AnimationAction> = {};

    const clips = soldier.animations || [];
    for (const clip of clips) {
      const action = mixer.clipAction(clip);
      actions[clip.name] = action;
      // Do not play all by default
    }

    this.mixerHandle = { mixer, actions, root };

    // Play idle by default if present
    this.play('Soldier_Idle');

    // Load weapon and attach to RightHandSocket
    try {
      const weaponGltf = await this.loadGLB(this.weaponUrl);
      const weapon = weaponGltf.scene || weaponGltf.scenes?.[0];
      if (weapon) {
        weapon.traverse((obj) => {
          obj.castShadow = true;
          obj.receiveShadow = true;
        });

        const socket = this.findObjectByNames(root, ['RightHandSocket', 'RHandSocket', 'WeaponSocket', 'hand.R.socket']);
        if (socket) {
          socket.add(weapon);
          // Zero local transform so the weapon aligns with socket orientation from Blender
          weapon.position.set(0, 0, 0);
          weapon.rotation.set(0, 0, 0);
          weapon.scale.set(1, 1, 1);
        } else {
          console.warn('SoldierSystem: RightHandSocket not found; adding weapon under character root');
          root.add(weapon);
          weapon.position.set(0.2, 1.2, 0.2);
          weapon.rotation.set(0, 0, 0);
          weapon.scale.set(1, 1, 1);
        }
      } else {
        console.warn('SoldierSystem: Weapon GLB scene not found');
      }
    } catch (e) {
      console.warn('SoldierSystem: Failed to load weapon GLB', e);
    }
  }

  update(deltaTime: number): void {
    // Follow target entity transform (position/rotation/scale) when assigned
    if (this.groupRoot && this.targetEntity != null) {
      const pos = this.entityManager.getComponent<PositionComponent>(this.targetEntity, 'PositionComponent');
      if (pos) {
        this.groupRoot.position.set(pos.x, pos.y, pos.z);
      }
      const rot = this.entityManager.getComponent<RotationComponent>(this.targetEntity, 'RotationComponent');
      if (rot) {
        this._qTmp.set(rot.x, rot.y, rot.z, rot.w);
        this.groupRoot.quaternion.copy(this._qTmp);
      }
      const scl = this.entityManager.getComponent<ScaleComponent>(this.targetEntity, 'ScaleComponent');
      if (scl) {
        this.groupRoot.scale.set(scl.x, scl.y, scl.z);
      }

      // Animation selection based on velocity magnitude
      const vel = this.entityManager.getComponent<VelocityComponent>(this.targetEntity, 'VelocityComponent');
      if (vel && this.mixerHandle) {
        const speedSq = vel.x * vel.x + vel.y * vel.y + vel.z * vel.z;
        const running = speedSq > 0.01; // small threshold
        this._playIfDifferent(running ? 'Soldier_Run' : 'Soldier_Idle');
      }
    }

    if (this.mixerHandle) {
      this.mixerHandle.mixer.update(deltaTime);
    }
  }

  dispose(): void {
    if (this.mixerHandle) {
      // Stop all actions
      for (const a of Object.values(this.mixerHandle.actions)) {
        a.stop();
      }
      this.mixerHandle = null;
    }
    if (this.groupRoot) {
      this.scene.remove(this.groupRoot);
      // Optional deep disposal
      this.groupRoot.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.geometry?.dispose();
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((m) => m.dispose());
          } else {
            mesh.material?.dispose();
          }
        }
      });
      this.groupRoot = null;
    }
  }

  play(name: string): void {
    if (!this.mixerHandle) {
      return;
    }
    const action = this.mixerHandle.actions[name];
    if (!action) {
      console.warn(`SoldierSystem: animation "${name}" not found`);
      return;
    }
    // Crossfade from any currently playing action
    const current = Object.values(this.mixerHandle.actions).find((a) => a.isRunning());
    if (current && current !== action) {
      current.crossFadeTo(action.reset().play(), 0.25, false);
    } else {
      action.reset().play();
    }
  }

  private async loadGLB(url: string) {
    return new Promise<import('three/examples/jsm/loaders/GLTFLoader.js').GLTF>((resolve, reject) => {
      this.loader.load(
        url,
        (gltf) => resolve(gltf),
        undefined,
        (err) => reject(err)
      );
    });
  }

  private findObjectByNames(root: THREE.Object3D, names: string[]): THREE.Object3D | null {
    let found: THREE.Object3D | null = null;
    root.traverse((obj) => {
      if (found) {
        return;
      }
      if (obj.name && names.includes(obj.name)) {
        found = obj;
      }
    });
    return found;
  }

  private _playIfDifferent(name: string): void {
    if (!this.mixerHandle) {
      return;
    }
    if (this._currentAnim === name) {
      return;
    }
    const next = this.mixerHandle.actions[name];
    if (!next) {
      return;
    }
    const current = this._currentAnim ? this.mixerHandle.actions[this._currentAnim] : undefined;
    if (current && current !== next && current.isRunning()) {
      current.crossFadeTo(next.reset().play(), 0.2, false);
    } else {
      next.reset().play();
    }
    this._currentAnim = name;
  }

  // Presentation-only follow target; called by orchestrator to bind soldier visuals to an ECS entity
  setTarget(entityId: EntityId): void {
    this.targetEntity = entityId;
  }
}
