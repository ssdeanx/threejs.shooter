// Transform-related components
export interface PositionComponent {
  x: number;
  y: number;
  z: number;
}

export interface RotationComponent {
  x: number;
  y: number;
  z: number;
  w: number; // quaternion w component
}

export interface ScaleComponent {
  x: number;
  y: number;
  z: number;
}

// Helper functions for creating components
export const createPositionComponent = (x = 0, y = 0, z = 0): PositionComponent => ({ x, y, z });
export const createRotationComponent = (x = 0, y = 0, z = 0, w = 1): RotationComponent => ({ x, y, z, w });
export const createScaleComponent = (x = 1, y = 1, z = 1): ScaleComponent => ({ x, y, z });