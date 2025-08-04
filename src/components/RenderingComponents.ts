// Rendering-related components
import type { EntityId } from '../core/types';

export interface MeshComponent {
  meshId: string; // Reference to Three.js mesh
  materialId: string;
  visible: boolean;
}

export interface CameraComponent {
  fov: number;
  near: number;
  far: number;
  target: EntityId | null; // Entity to follow
  offset: {
    x: number;
    y: number;
    z: number;
  };
}

// Helper functions
export const createMeshComponent = (
  meshId: string,
  materialId = 'default',
  visible = true
): MeshComponent => ({
  meshId,
  materialId,
  visible
});

export const createCameraComponent = (
  fov = 75,
  near = 0.1,
  far = 1000,
  target: EntityId | null = null,
  offset = { x: 0, y: 2, z: 5 }
): CameraComponent => ({
  fov,
  near,
  far,
  target,
  offset
});