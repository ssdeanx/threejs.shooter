import { useMemo } from 'react';
import type { Group, Object3D } from 'three';
import { useGLTF } from '@react-three/drei';

/**
 * useGlbAsset
 * Suspense-friendly GLB loader that caches by URL via drei's useGLTF.
 * View-only: returns a root object for rendering; does not instantiate physics or modify ECS.
 *
 * Usage:
 *   const { scene } = useGlbAsset('assets/models/targets/crate.glb');
 *   return <primitive object={scene} />;
 *
 * Preload (optional):
 *   preloadGlb('assets/models/targets/crate.glb');
 */
export function useGlbAsset(url: string): { scene: Object3D | Group } {
  const gltf = useGLTF(url) as unknown as { scene?: Object3D | Group; scenes?: Array<Object3D | Group> };

  const root = useMemo<Object3D | Group>(() => {
    if (gltf.scene) return gltf.scene;
    const s = Array.isArray(gltf.scenes) ? gltf.scenes[0] : undefined;
    if (!s) {
      // Fail fast with a clear message instead of unsafe non-null assertion
      throw new Error(`useGlbAsset: GLB at "${url}" has no scene root`);
    }
    return s;
  }, [gltf, url]);

  return { scene: root };
}

// Optional: preloading helper
export function preloadGlb(url: string): void {
  useGLTF.preload(url);
}