import React, { useMemo, useState, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import { GameOrchestrator, useGameOrchestrator } from '@/react/GameOrchestrator.js';
import PostFX from '@/react/PostFX.js';
import { BindTransform, useEntityManager } from '@/react/ecs-bindings.js';
import { RecorderState } from '@/systems/RecorderSystem';
import { useUIStore } from './stores/uiStore'; // Import useUIStore
import { Options } from './Options';
import HUD from './HUD';

const ENABLE_POSTFX = false;

// Feature flags for diagnostics and examples
const ENABLE_SMOKE = false;
const ENABLE_GLTF_EXAMPLE = false;

/**
 * DemoFollowerBox
 * Minimal sanity binding: a small Box that mirrors the player (camera target) transform.
 * Resolves the player entityId by reading the CameraComponent array once.
 * No ECS writes; per-frame copies reuse stable scratch objects in BindTransform.
 */
function DemoFollowerBox(): React.ReactElement | null {
  const entityManager = useEntityManager();
  const playerId = useMemo(() => {
    const camArray = entityManager.getComponentArrays().get('CameraComponent') as ({ target?: number }[] | undefined);
    if (!camArray) {
      return null;
    }
    for (let i = 0; i < camArray.length; i++) {
      const cam = camArray[i];
      if (cam && typeof cam.target === 'number') {
        return cam.target;
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

/**
 * Smoke — minimal diagnostics component to mount optional helpers/examples behind flags.
 * Keeps production clean while providing a quick sanity surface for development.
 */
function Smoke(): React.ReactElement | null {
  if (!ENABLE_SMOKE) {
    return null;
  }
  return (
    <>
      {/* Minimal demo view binding */}
      <DemoFollowerBox />
    </>
  );
}

/**
 * Optional GLTF example showcasing Suspense-friendly loading.
 * Disabled by default via feature flag to avoid changing visuals.
 */
function GltfExample(): React.ReactElement | null {
  if (!ENABLE_GLTF_EXAMPLE) {
    return null;
  }

  // Use dynamic import to stay ESM + satisfy lint rules
  const LazyGltf = React.lazy(async () => {
    const mod = await import('@/react/hooks/useGlbAsset.js');
    return {
      default: function Inner() {
        const { scene } = mod.useGlbAsset('assets/models/targets/crate.glb');
        const { scene: r3fScene } = useThree();
        useMemo(() => {
          r3fScene.add(scene);
          return () => {
            r3fScene.remove(scene);
          };
        }, [r3fScene, scene]);
        return <primitive object={scene} />;
      }
    };
  });

  return (
    <React.Suspense fallback={null}>
      <LazyGltf />
    </React.Suspense>
  );
}

function RecorderControls() {
  const orchestrator = useGameOrchestrator();
  const { isOptionsOpen } = useUIStore(); // Use useUIStore
  const [recorderState, setRecorderState] = useState(RecorderState.Stopped);

  const onRecord = () => {
    if (!orchestrator) {
      return;
    }
    orchestrator.recorderSystem.record();
    setRecorderState(RecorderState.Recording);
  };

  const onReplay = () => {
    if (!orchestrator) {
      return;
    }
    orchestrator.recorderSystem.replay();
    setRecorderState(RecorderState.Replaying);
  };

  const onStop = () => {
    if (!orchestrator) {
      return;
    }
    orchestrator.recorderSystem.stop();
    setRecorderState(RecorderState.Stopped);
  };

  // Hide all settings unless Options is open (Esc)
  if (!isOptionsOpen) {
    return null;
  }

  return (
    <div className="fixed top-2 left-2 z-50 text-white pointer-events-auto">
      <div className="flex gap-2">
        <button type="button" onClick={onRecord} disabled={recorderState === RecorderState.Recording} className="px-2 py-1 rounded bg-neutral-800/70 enabled:hover:bg-neutral-700/70 disabled:opacity-50">Record</button>
        <button type="button" onClick={onReplay} disabled={recorderState === RecorderState.Replaying} className="px-2 py-1 rounded bg-neutral-800/70 enabled:hover:bg-neutral-700/70 disabled:opacity-50">Replay</button>
        <button type="button" onClick={onStop} disabled={recorderState === RecorderState.Stopped} className="px-2 py-1 rounded bg-neutral-800/70 enabled:hover:bg-neutral-700/70 disabled:opacity-50">Stop</button>
      </div>
      <p className="mt-2 text-xs text-neutral-300 select-none">State: {RecorderState[recorderState]}</p>
      <Options />
    </div>
  );
}

// Sync InputSystem pause state (Esc) to UI store visibility; runs inside Canvas
function PauseUISync() {
  const orchestrator = useGameOrchestrator();
  const prev = useRef<boolean | null>(null);
  const { isOptionsOpen, toggleOptions } = useUIStore();
  useFrame(() => {
    if (!orchestrator) {
      return;
    }
    const paused = orchestrator.inputSystem.getInputState().isPaused;
    if (prev.current === null) {
      prev.current = paused;
      return;
    }
    if (paused !== prev.current) {
      // Open options when paused; close when unpaused
      if (paused !== isOptionsOpen) {
        toggleOptions();
      }
      prev.current = paused;
    }
  });
  return null;
}

export default function App() {
  return (
    <>
      <Canvas
        className="w-screen h-screen block"
        shadows
        camera={{ fov: 75, near: 0.1, far: 1000 }}
        gl={{ antialias: true }}
      >
        <Physics gravity={[0, -9.82, 0]}>
          <GameOrchestrator />
          <PauseUISync />
          <HUD />
          <Smoke />
          <GltfExample />
          <PostFX enabled={ENABLE_POSTFX} />
        </Physics>
      </Canvas>
      <RecorderControls />
    </>
  );
}