import React, { useMemo, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useThree } from '@react-three/fiber';
import { GameOrchestrator, useGameOrchestrator } from '@/react/GameOrchestrator.js';
import PostFX from '@/react/PostFX.js';
import { BindTransform, useEntityManager } from '@/react/ecs-bindings.js';
import { RecorderState } from '@/systems/RecorderSystem';
import { useUIStore } from './stores/uiStore'; // Import useUIStore
import { Options } from './Options';

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
  const { isOptionsOpen, toggleOptions } = useUIStore(); // Use useUIStore
  const [recorderState, setRecorderState] = useState(RecorderState.Stopped);

  const onRecord = () => {
    if (!orchestrator) return;
    orchestrator.recorderSystem.record();
    setRecorderState(orchestrator.recorderSystem.state);
  };

  const onReplay = () => {
    if (!orchestrator) return;
    orchestrator.recorderSystem.replay();
    setRecorderState(orchestrator.recorderSystem.state);
  };

  const onStop = () => {
    if (!orchestrator) return;
    orchestrator.recorderSystem.stop();
    setRecorderState(orchestrator.recorderSystem.state);
  };

  // Toggle pause state in InputSystem and UI store
  const onTogglePause = () => {
    if (!orchestrator) return;
    const newState = !orchestrator.inputSystem.getInputState().isPaused;
    orchestrator.inputSystem.setInputState({ ...orchestrator.inputSystem.getInputState(), isPaused: newState });
    // Also toggle options UI state
    toggleOptions();
  };

  return (
    <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 1, color: 'white' }}>
      <button type="button" onClick={onRecord} disabled={recorderState === RecorderState.Recording}>Record</button>
      <button type="button" onClick={onReplay} disabled={recorderState === RecorderState.Replaying}>Replay</button>
      <button type="button" onClick={onStop} disabled={recorderState === RecorderState.Stopped}>Stop</button>
      {/* Use isOptionsOpen from Zustand to determine button text */}
      <button type="button" onClick={onTogglePause}>{isOptionsOpen ? 'Close Options' : 'Open Options'}</button>
      <p>State: {RecorderState[recorderState]}</p>
      {isOptionsOpen && <Options />} {/* Conditionally render Options based on isOptionsOpen */}
    </div>
  );
}

export default function App() {
  return (
    <>
      <Canvas
        shadows
        camera={{ fov: 75, near: 0.1, far: 1000 }}
        gl={{ antialias: true }}
        style={{ width: '100vw', height: '100vh', display: 'block' }}
      >
        <GameOrchestrator />
        <Smoke />
        <GltfExample />
        <PostFX enabled={ENABLE_POSTFX} />
      </Canvas>
      <RecorderControls />
    </>
  );
}