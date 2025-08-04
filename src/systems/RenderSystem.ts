import * as THREE from 'three';
import { System } from '../core/System.js';
import type { EntityId } from '../core/types.js';
import type { EntityManager } from '../core/EntityManager.js';
import type { PositionComponent, RotationComponent, ScaleComponent } from '../components/TransformComponents.js';
import type { MeshComponent } from '../components/RenderingComponents.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export interface TerrainHeightfield {
    heights: number[][];
    elementSize: number;
    offsetX: number;
    offsetZ: number;
}
export class RenderSystem extends System {
    private scene: THREE.Scene;
    private entityManager: EntityManager;
    // Cache reusable resources by id
    private geometryCache = new Map<string, THREE.BufferGeometry>();
    private materialCache = new Map<string, THREE.Material>();
    // One Object3D per entity (can be Mesh or Group from GLB)
    private entityObject = new Map<EntityId, THREE.Object3D>();
    // Animation mixers per entity for skinned GLBs
    private entityMixer = new Map<EntityId, THREE.AnimationMixer>();
    private gltfLoader = new GLTFLoader();

    private heightfieldData: TerrainHeightfield | null = null;

    constructor(scene: THREE.Scene, entityManager: EntityManager) {
        super(['PositionComponent', 'MeshComponent']);
        this.scene = scene;
        this.entityManager = entityManager;
        this.initializeDefaultMaterials();
        this.setupLighting();
        this.createVisualGround();
    }

    // Expose terrain heightfield to other systems without globals/any
    getHeightfield(): TerrainHeightfield | null {
        return this.heightfieldData;
    }

    private initializeDefaultMaterials(): void {
        const defaultMaterial = new THREE.MeshLambertMaterial({ color: 0x00ff00 });
        this.materialCache.set('default', defaultMaterial);
    }

    // Ensure scene has sane lighting so terrain and character are visible
    private setupLighting(): void {
        // Remove existing lights if any to avoid duplicates causing bands
        const toRemove: THREE.Object3D[] = [];
        this.scene.traverse((o) => {
            if ((o as any).isLight) toRemove.push(o);
        });
        toRemove.forEach(o => this.scene.remove(o));

        // Ambient light for base visibility
        const ambient = new THREE.AmbientLight(0xffffff, 0.35);
        this.scene.add(ambient);

        // Directional sun light
        const sun = new THREE.DirectionalLight(0xffffff, 1.1);
        sun.position.set(50, 120, 80);
        sun.castShadow = true;
        sun.shadow.mapSize.set(2048, 2048);
        sun.shadow.bias = -0.0001;
        sun.shadow.camera.near = 0.5;
        sun.shadow.camera.far = 500;
        const d = 200;
        (sun.shadow.camera as THREE.OrthographicCamera).left = -d;
        (sun.shadow.camera as THREE.OrthographicCamera).right = d;
        (sun.shadow.camera as THREE.OrthographicCamera).top = d;
        (sun.shadow.camera as THREE.OrthographicCamera).bottom = -d;
        this.scene.add(sun);

        // Optional fill light to soften shadows
        const fill = new THREE.HemisphereLight(0x88bbff, 0x334422, 0.35);
        this.scene.add(fill);
    }

    // Create a large displaced ground mesh for visuals and expose heightfield to PhysicsSystem via global scene reference
    private createVisualGround(): void {
        const size = 1000;
        const segments = 128; // friendlier for heightfield grid (rows = cols = segments+1)
        const geo = new THREE.PlaneGeometry(size, size, segments, segments);
        const pos = geo.attributes.position as THREE.BufferAttribute;
        const v = new THREE.Vector3();
        function hash(n: number) { return Math.sin(n) * 43758.5453123; }
        function noise2(x: number, y: number) {
            const i = Math.floor(x), j = Math.floor(y);
            const fX = x - i, fY = y - j;
            const a = hash(i * 127.1 + j * 311.7);
            const b = hash((i + 1) * 127.1 + j * 311.7);
            const c = hash(i * 127.1 + (j + 1) * 311.7);
            const d = hash((i + 1) * 127.1 + (j + 1) * 311.7);
            const uX = fX * fX * (3 - 2 * fX);
            const uY = fY * fY * (3 - 2 * fY);
            return THREE.MathUtils.lerp(
                THREE.MathUtils.lerp(a, b, uX),
                THREE.MathUtils.lerp(c, d, uX),
                uY
            );
        }
        const amp = 8;

        // Build height grid (rows x cols)
        const cols = segments + 1;
        const rows = segments + 1;
        const heights: number[][] = Array.from({ length: rows }, () => Array(cols).fill(0));

        for (let iy = 0; iy < rows; iy++) {
            for (let ix = 0; ix < cols; ix++) {
                const i = iy * cols + ix;
                v.fromBufferAttribute(pos, i);
                const nx = (v.x / 220) + 1000;
                const nz = (v.y / 220) + 1000; // plane local second axis before rotation
                const h =
                    noise2(nx, nz) * amp * 0.5 +
                    noise2(nx * 0.5, nz * 0.5) * amp * 0.3 +
                    noise2(nx * 0.25, nz * 0.25) * amp * 0.2;
                v.z = h;
                heights[iy][ix] = h;
                pos.setXYZ(i, v.x, v.y, v.z);
            }
        }
        pos.needsUpdate = true;
        geo.computeVertexNormals();

        const mat = new THREE.MeshStandardMaterial({
            color: 0x556b2f,
            roughness: 0.95,
            metalness: 0.0,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.receiveShadow = true;
        mesh.frustumCulled = false;

        // Store typed heightfield in-system for PhysicsSystem to retrieve explicitly
        this.heightfieldData = {
            heights,
            elementSize: size / segments,
            offsetX: -size / 2,
            offsetZ: -size / 2,
        };

        this.scene.add(mesh);

        // Ensure no accidental surrounding walls: remove any tall planes/boxes tagged as 'wall'
        const toRemove: THREE.Object3D[] = [];
        this.scene.traverse((o) => {
          if ((o as any).userData?.type === 'wall') toRemove.push(o);
        });
        toRemove.forEach(o => this.scene.remove(o));
    }

    update(deltaTime: number, entities: EntityId[]): void {
        for (const entityId of entities) {
            const position = this.entityManager.getComponent<PositionComponent>(entityId, 'PositionComponent');
            const meshComp = this.entityManager.getComponent<MeshComponent>(entityId, 'MeshComponent');
            const rotation = this.entityManager.getComponent<RotationComponent>(entityId, 'RotationComponent');
            const scale = this.entityManager.getComponent<ScaleComponent>(entityId, 'ScaleComponent');

            if (!position || !meshComp) continue;

            let obj = this.entityObject.get(entityId);

            if (!obj) {
                obj = this.createRenderable(entityId, meshComp);
                if (obj) {
                    this.entityObject.set(entityId, obj);
                    this.scene.add(obj);
                }
            }

            if (!obj) continue;

            // Update position
            obj.position.set(position.x, position.y, position.z);

            // Update rotation if available
            if (rotation) {
                (obj as any).quaternion?.set(rotation.x, rotation.y, rotation.z, rotation.w);
                if (!(obj as any).quaternion) {
                    // fallback for objects without quaternion (rare)
                    obj.setRotationFromQuaternion(new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w));
                }
            }

            // Update scale if available
            if (scale) {
                obj.scale.set(scale.x, scale.y, scale.z);
            }

            // Update visibility
            (obj as any).visible = meshComp.visible;

            // Advance animation mixer if any
            const mixer = this.entityMixer.get(entityId);
            if (mixer) {
                mixer.update(deltaTime);
            }
        }
    }

    private createRenderable(entityId: EntityId, meshComp: MeshComponent): THREE.Object3D {
        // Special case: soldier GLB replaces 'player' capsule
        if (meshComp.meshId === 'player') {
            // Load once per meshId and clone for entities if needed later
            // For now, load directly and attach animations
            const group = new THREE.Group();
            group.name = 'Player_Soldier_Pending';
            // Kick async load; placeholder invisible to avoid purple capsule look
            group.visible = meshComp.visible !== false; // follow component flag

            this.gltfLoader.load(
                'assets/models/characters/soldier.glb',
                (gltf) => {
                    const root = gltf.scene || gltf.scenes?.[0];
                    if (!root) return;

                    // Shadows
                    root.traverse((o: any) => {
                        if (o.isMesh) {
                            o.castShadow = true;
                            o.receiveShadow = true;
                        }
                    });

                    // Replace placeholder content and normalize transform
                    group.name = 'Player_Soldier';
                    while (group.children.length) group.remove(group.children[0]);
                    root.position.set(0, 0, 0);
                    root.rotation.set(0, 0, 0);
                    root.scale.set(1, 1, 1);
                    group.add(root);

                    // Setup animation mixer and play idle if found
                    const mixer = new THREE.AnimationMixer(root);
                    this.entityMixer.set(entityId, mixer);

                    const idle = gltf.animations.find(a => a.name === 'Soldier_Idle') || gltf.animations[0];
                    if (idle) {
                        mixer.clipAction(idle).reset().play();
                    }

                    // Load M4 and attach to common socket names
                    this.gltfLoader.load(
                        'assets/models/weapons/m4a1.glb',
                        (wgltf) => {
                            const weapon = wgltf.scene || wgltf.scenes?.[0];
                            if (!weapon) return;
                            weapon.traverse((o: any) => {
                                if (o.isMesh) {
                                    o.castShadow = true;
                                    o.receiveShadow = true;
                                }
                            });
                            const socket = this.findObjectByNames(root, ['RightHandSocket','RHandSocket','WeaponSocket','hand.R.socket']);
                            if (socket) {
                                socket.add(weapon);
                                weapon.position.set(0,0,0);
                                weapon.rotation.set(0,0,0);
                                weapon.scale.set(1,1,1);
                            } else {
                                root.add(weapon);
                                weapon.position.set(0.2, 1.2, 0.2);
                            }
                        },
                        undefined,
                        () => {/* ignore weapon load error */}
                    );
                },
                undefined,
                (err) => {
                    // Soldier failed; fallback to a visible capsule so player isn't invisible
                    console.warn('Soldier GLB load failed, using capsule fallback', err);
                    while (group.children.length) group.remove(group.children[0]);
                    const fallback = new THREE.Mesh(
                        new THREE.CapsuleGeometry(0.5, 1.8, 4, 8),
                        new THREE.MeshLambertMaterial({ color: 0x5555ff })
                    );
                    fallback.castShadow = true;
                    fallback.receiveShadow = true;
                    group.add(fallback);
                }
            );

            return group;
        }

        // Fallback primitives for other meshIds
        // Get or create geometry by meshId
        let geometry = this.geometryCache.get(meshComp.meshId);
        if (!geometry) {
            switch (meshComp.meshId) {
                case 'cube':
                    geometry = new THREE.BoxGeometry(1, 1, 1);
                    break;
                case 'sphere':
                    geometry = new THREE.SphereGeometry(0.5, 16, 16);
                    break;
                default:
                    geometry = new THREE.BoxGeometry(1, 1, 1);
            }
            this.geometryCache.set(meshComp.meshId, geometry);
        }

        // Get or create material by materialId
        let material = this.materialCache.get(meshComp.materialId);
        if (!material) {
            material = new THREE.MeshLambertMaterial({ color: Math.random() * 0xffffff });
            this.materialCache.set(meshComp.materialId, material);
        }

        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        // Mark special-purpose flags
        if (meshComp.meshId === 'player') {
            mesh.userData.isPlayer = true;
        }

        return mesh;
    }

    private findObjectByNames(root: THREE.Object3D, names: string[]): THREE.Object3D | null {
        let found: THREE.Object3D | null = null;
        root.traverse((obj) => {
            if (found) return;
            if (obj.name && names.includes(obj.name)) {
                found = obj;
            }
        });
        return found;
    }



    // Optional: remove an entity's object when needed
    removeEntityMesh(entityId: EntityId): void {
        const obj = this.entityObject.get(entityId);
        if (obj) {
            this.scene.remove(obj);
            // best-effort dispose of geometries/materials
            obj.traverse((o: any) => {
                if (o.isMesh) {
                    o.geometry?.dispose?.();
                    if (Array.isArray(o.material)) {
                        o.material.forEach((m: any) => m?.dispose?.());
                    } else {
                        o.material?.dispose?.();
                    }
                }
            });
            this.entityObject.delete(entityId);
        }
        const mixer = this.entityMixer.get(entityId);
        if (mixer) {
            this.entityMixer.delete(entityId);
        }
    }
}