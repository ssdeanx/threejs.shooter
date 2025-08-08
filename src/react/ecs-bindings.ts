import React, { useContext, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { EntityManager } from '@/core/EntityManager.js';
import type { PositionComponent, RotationComponent, ScaleComponent } from '@/components/TransformComponents.js';

/**
 * EntityManagerContext
 * Exposes the single authoritative EntityManager to React children without creating duplicates.
 * GameOrchestrator must provide the value. Do not construct another EntityManager elsewhere.
 */
export const EntityManagerContext = React.createContext<EntityManager | null>(null);

export function useEntityManager(): EntityManager {
  const em = useContext(EntityManagerContext);
  if (!em) {
    throw new Error('EntityManagerContext is not provided. Wrap tree with <EntityManagerContext.Provider> in GameOrchestrator.');
  }
  return em;
}

/**
 * useEcsTransform(entityId)
 * Returns read-only views onto stable scratch THREE objects that mirror ECS transform components.
 * No ECS writes; avoids per-frame allocations by reusing memoized vectors/quaternion.
 */
export function useEcsTransform(entityId: number): {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  scale: THREE.Vector3;
} {
  const entityManager = useEntityManager();

  // Stable scratch objects – never recreated after initial mount
  const scratch = useMemo(() => ({
    position: new THREE.Vector3(),
    quaternion: new THREE.Quaternion(),
    scale: new THREE.Vector3(1, 1, 1),
  }), []);

  // Note: This hook itself does not subscribe to a clock; caller will likely
  // use <BindTransform /> or useFrame to copy these scratch values into an Object3D.
  // We populate from ECS now so initial values are correct.
  const pos = entityManager.getComponent<PositionComponent>(entityId, 'PositionComponent');
  if (pos) {
    scratch.position.set(pos.x, pos.y, pos.z);
  }

  const rot = entityManager.getComponent<RotationComponent>(entityId, 'RotationComponent');
  if (rot) {
    scratch.quaternion.set(rot.x, rot.y, rot.z, rot.w);
  } else {
    scratch.quaternion.identity();
  }

  const scl = entityManager.getComponent<ScaleComponent>(entityId, 'ScaleComponent');
  if (scl) {
    scratch.scale.set(scl.x, scl.y, scl.z);
  } else {
    scratch.scale.set(1, 1, 1);
  }

  return scratch;
}

/**
 * BindTransform
 * Applies ECS transform to a provided THREE.Object3D every frame.
 * View-only: reads ECS Position/Rotation/Scale and writes to the Three object; never writes back to ECS.
 */
export function BindTransform(props: { entityId: number; object: THREE.Object3D }): null {
  const entityManager = useEntityManager();

  // Stable scratch objects to avoid per-frame allocations
  const tmpPos = useMemo(() => new THREE.Vector3(), []);
  const tmpQuat = useMemo(() => new THREE.Quaternion(), []);
  const tmpScale = useMemo(() => new THREE.Vector3(1, 1, 1), []);

  useFrame(() => {
    // Read components
    const p = entityManager.getComponent<PositionComponent>(props.entityId, 'PositionComponent');
    const r = entityManager.getComponent<RotationComponent>(props.entityId, 'RotationComponent');
    const s = entityManager.getComponent<ScaleComponent>(props.entityId, 'ScaleComponent');

    if (p) {
      tmpPos.set(p.x, p.y, p.z);
    }
    if (r) {
      tmpQuat.set(r.x, r.y, r.z, r.w);
    }
    if (s) {
      tmpScale.set(s.x, s.y, s.z);
    }

    // Write to Three object (in-place)
    props.object.position.copy(tmpPos);
    props.object.quaternion.copy(tmpQuat);
    props.object.scale.copy(tmpScale);
  });

  return null;
}