import React, { useMemo } from 'react';
import * as THREE from 'three';
import { Canvas, useThree } from '@react-three/fiber';
import { GameOrchestrator } from './GameOrchestrator';
import PostFX from './PostFX';
import { BindTransform, useEntityManager } from '@/react/ecs-bindings.js';

const ENABLE_POSTFX = false;

/**
 * DemoFollowerBox
 * Minimal sanity binding: a small Box that mirrors the player (camera target) transform.
 * Resolves the player entityId by reading the CameraComponent array once.
 * No ECS writes; per-frame copies reuse stable scratch objects in BindTransform.
 */
function DemoFollowerBox(): React.ReactElement | null {
  const entityManager = useEntityManager();
  const playerId = useMemo(() => {
    const camArray = entityManager.getComponentArrays().get('CameraComponent') as (unknown[] | undefined);
    if (!camArray) {
      return null;
    }
    for (let i = 0; i < camArray.length; i++) {
      const cam = camArray[i] as any;
      if (cam && typeof cam.target === 'number') {
        return cam.target as number;
      }
    }
    return null;
  }, [entityManager]);

  // If we couldn't resolve a player yet, render nothing.
  if (playerId == null) {
    return null;
  }

  // Create a single Mesh once; add to the R3F scene via <primitive>.
  const mesh = useMemo(() => {
    const geom = new THREE.BoxGeometry(0.2, 0.2, 0.2);
    const mat = new THREE.MeshLambertMaterial({ color: 0xffaa00 });
    const m = new THREE.Mesh(geom, mat);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }, []);

  // Attach to scene and bind transform
  const { scene } = useThree();
  useMemo(() => {
    scene.add(mesh);
    return () => {
      scene.remove(mesh);
      (mesh.geometry as THREE.BufferGeometry).dispose();
      (mesh.material as THREE.Material).dispose?.();
    };
  }, [scene, mesh]);

  return (
    <>
      <primitive object={mesh} />
      <BindTransform entityId={playerId} object={mesh} />
    </>
  );
}

export default function App() {
  return (
    <Canvas
      shadows
      camera={{ fov: 75, near: 0.1, far: 1000 }}
      gl={{ antialias: true }}
      style={{ width: '100vw', height: '100vh', display: 'block' }}
    >
      <GameOrchestrator />
      {/* Minimal demo view binding */}
      <DemoFollowerBox />
      <PostFX enabled={ENABLE_POSTFX} />
    </Canvas>
  );
}