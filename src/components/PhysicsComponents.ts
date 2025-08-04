// Physics-related components
export interface VelocityComponent {
  x: number;
  y: number;
  z: number;
}

export interface RigidBodyComponent {
  bodyId: number; // Reference to Cannon.js body
  mass: number;
  isKinematic: boolean;
}

export interface ColliderComponent {
  shape: 'box' | 'sphere' | 'capsule' | 'plane';
  dimensions: {
    x: number;
    y: number;
    z: number;
  };
}

// Helper functions
export const createVelocityComponent = (x = 0, y = 0, z = 0): VelocityComponent => ({ x, y, z });

export const createRigidBodyComponent = (bodyId: number, mass = 1, isKinematic = false): RigidBodyComponent => ({
  bodyId,
  mass,
  isKinematic
});

export const createColliderComponent = (
  shape: ColliderComponent['shape'],
  dimensions = { x: 1, y: 1, z: 1 }
): ColliderComponent => ({
  shape,
  dimensions
});