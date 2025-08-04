import { System } from '../core/System.js';
import type { EntityId } from '../core/types.js';

export interface InputState {
  // Movement keys
  w: boolean;
  a: boolean;
  s: boolean;
  d: boolean;
  shift: boolean;
  space: boolean;

  // Mouse
  mouseX: number;
  mouseY: number;
  mouseMovementX: number;
  mouseMovementY: number;
  leftClick: boolean;
  rightClick: boolean;

  // Other keys
  r: boolean; // reload
  escape: boolean;
  tab: boolean;
}

export interface InputMapping {
  [action: string]: string[];
}

export interface InputConfig {
  keyMappings: InputMapping;
  mouseSensitivity: number;
  invertY: boolean;
}

export class InputSystem extends System {
  private inputState: InputState;
  private keyBuffer: Map<string, number> = new Map();
  private bufferTime = 100; // ms
  private isPointerLocked = false;
  private inputConfig: InputConfig;

  constructor(config?: Partial<InputConfig>) {
    super([]); // InputSystem doesn't require specific components
    this.inputState = this.createInitialInputState();
    this.inputConfig = this.createDefaultConfig(config);
    this.setupInputListeners();
  }

  private createDefaultConfig(userConfig?: Partial<InputConfig>): InputConfig {
    const defaultConfig: InputConfig = {
      keyMappings: {
        moveForward: ['KeyW'],
        moveBackward: ['KeyS'],
        moveLeft: ['KeyA'],
        moveRight: ['KeyD'],
        sprint: ['ShiftLeft'],
        jump: ['Space'],
        reload: ['KeyR'],
        pause: ['Escape'],
        inventory: ['Tab'],
        fire: ['Mouse0'],
        aim: ['Mouse1']
      },
      mouseSensitivity: 1.0,
      invertY: false
    };

    return {
      ...defaultConfig,
      ...userConfig,
      keyMappings: {
        ...defaultConfig.keyMappings,
        ...userConfig?.keyMappings
      }
    };
  }

  private createInitialInputState(): InputState {
    return {
      w: false,
      a: false,
      s: false,
      d: false,
      shift: false,
      space: false,
      mouseX: 0,
      mouseY: 0,
      mouseMovementX: 0,
      mouseMovementY: 0,
      leftClick: false,
      rightClick: false,
      r: false,
      escape: false,
      tab: false
    };
  }

  private setupInputListeners(): void {
    // Keyboard events
    document.addEventListener('keydown', (event) => {
      this.handleKeyDown(event);
    });

    document.addEventListener('keyup', (event) => {
      this.handleKeyUp(event);
    });

    // Mouse events
    document.addEventListener('click', (event) => {
      if (event.button === 0) { // Left click
        this.requestPointerLock();
      }
    });

    document.addEventListener('mousedown', (event) => {
      if (event.button === 0) {
        this.inputState.leftClick = true;
      } else if (event.button === 2) {
        this.inputState.rightClick = true;
      }
    });

    document.addEventListener('mouseup', (event) => {
      if (event.button === 0) {
        this.inputState.leftClick = false;
      } else if (event.button === 2) {
        this.inputState.rightClick = false;
      }
    });

    document.addEventListener('mousemove', (event) => {
      if (this.isPointerLocked) {
        this.inputState.mouseMovementX = event.movementX;
        this.inputState.mouseMovementY = event.movementY;
        this.inputState.mouseX += event.movementX;
        this.inputState.mouseY += event.movementY;
      }
    });

    // Pointer lock events
    document.addEventListener('pointerlockchange', () => {
      this.isPointerLocked = document.pointerLockElement === document.body;
    });

    // Browser focus/blur events
    window.addEventListener('blur', () => {
      this.clearInputState();
    });

    window.addEventListener('focus', () => {
      this.clearInputState();
    });

    // Prevent context menu on right click
    document.addEventListener('contextmenu', (event) => {
      event.preventDefault();
    });
  }

  private handleKeyDown(event: any): void {
    // Add to buffer for responsive input
    this.keyBuffer.set(event.code, Date.now());

    switch (event.code) {
      case 'KeyW':
        this.inputState.w = true;
        break;
      case 'KeyA':
        this.inputState.a = true;
        break;
      case 'KeyS':
        this.inputState.s = true;
        break;
      case 'KeyD':
        this.inputState.d = true;
        break;
      case 'ShiftLeft':
        this.inputState.shift = true;
        break;
      case 'Space':
        this.inputState.space = true;
        event.preventDefault();
        break;
      case 'KeyR':
        this.inputState.r = true;
        break;
      case 'Escape':
        this.inputState.escape = true;
        break;
      case 'Tab':
        this.inputState.tab = true;
        event.preventDefault();
        break;
    }
  }

  private handleKeyUp(event: any): void {
    switch (event.code) {
      case 'KeyW':
        this.inputState.w = false;
        break;
      case 'KeyA':
        this.inputState.a = false;
        break;
      case 'KeyS':
        this.inputState.s = false;
        break;
      case 'KeyD':
        this.inputState.d = false;
        break;
      case 'ShiftLeft':
        this.inputState.shift = false;
        break;
      case 'Space':
        this.inputState.space = false;
        break;
      case 'KeyR':
        this.inputState.r = false;
        break;
      case 'Escape':
        this.inputState.escape = false;
        break;
      case 'Tab':
        this.inputState.tab = false;
        break;
    }
  }

  private requestPointerLock(): void {
    if (!this.isPointerLocked) {
      document.body.requestPointerLock();
    }
  }

  private clearInputState(): void {
    // Clear all input states when focus is lost
    this.inputState.w = false;
    this.inputState.a = false;
    this.inputState.s = false;
    this.inputState.d = false;
    this.inputState.shift = false;
    this.inputState.space = false;
    this.inputState.leftClick = false;
    this.inputState.rightClick = false;
    this.inputState.r = false;
    this.inputState.escape = false;
    this.inputState.tab = false;
    this.keyBuffer.clear();
  }

  update(deltaTime: number, entities: EntityId[]): void {
    // Use deltaTime for frame-rate independent buffer cleanup
    const currentTime = Date.now();
    const bufferTimeMs = this.bufferTime * (1 + deltaTime); // Scale buffer time with frame rate

    for (const [key, time] of this.keyBuffer.entries()) {
      if (currentTime - time > bufferTimeMs) {
        this.keyBuffer.delete(key);
      }
    }

    // Update mouse sensitivity based on frame rate for consistent feel
    const frameRateAdjustment = deltaTime * 60; // Normalize to 60fps

    // Process entities that might need input state updates
    for (const entityId of entities) {
      // Even though InputSystem doesn't require specific components,
      // we could update per-entity input states here if needed
      if (entityId && frameRateAdjustment > 0) {
        // Input system processes global state but acknowledges entity context
        continue;
      }
    }

    // Reset mouse movement each frame (frame-rate independent)
    this.inputState.mouseMovementX = 0;
    this.inputState.mouseMovementY = 0;
  }

  // Public methods to access input state
  getInputState(): Readonly<InputState> {
    return this.inputState;
  }

  isKeyPressed(key: keyof InputState): boolean {
    return this.inputState[key] as boolean;
  }

  wasKeyJustPressed(keyCode: string): boolean {
    return this.keyBuffer.has(keyCode);
  }

  getMouseMovement(): { x: number; y: number } {
    return {
      x: this.inputState.mouseMovementX,
      y: this.inputState.mouseMovementY
    };
  }

  isPointerLockActive(): boolean {
    return this.isPointerLocked;
  }

  // Input mapping configuration methods
  isActionPressed(action: string): boolean {
    const keys = this.inputConfig.keyMappings[action];
    if (!keys) return false;

    return keys.some(key => {
      if (key === 'Mouse0') return this.inputState.leftClick;
      if (key === 'Mouse1') return this.inputState.rightClick;
      return this.keyBuffer.has(key) || this.isKeyCurrentlyPressed(key);
    });
  }

  wasActionJustPressed(action: string): boolean {
    const keys = this.inputConfig.keyMappings[action];
    if (!keys) return false;

    return keys.some(key => {
      if (key === 'Mouse0' || key === 'Mouse1') return false; // Mouse handled separately
      return this.keyBuffer.has(key);
    });
  }

  private isKeyCurrentlyPressed(keyCode: string): boolean {
    switch (keyCode) {
      case 'KeyW': return this.inputState.w;
      case 'KeyA': return this.inputState.a;
      case 'KeyS': return this.inputState.s;
      case 'KeyD': return this.inputState.d;
      case 'ShiftLeft': return this.inputState.shift;
      case 'Space': return this.inputState.space;
      case 'KeyR': return this.inputState.r;
      case 'Escape': return this.inputState.escape;
      case 'Tab': return this.inputState.tab;
      default: return false;
    }
  }

  // Configuration methods
  updateKeyMapping(action: string, keys: string[]): void {
    this.inputConfig.keyMappings[action] = keys;
  }

  getKeyMapping(action: string): string[] {
    return this.inputConfig.keyMappings[action] || [];
  }

  setMouseSensitivity(sensitivity: number): void {
    this.inputConfig.mouseSensitivity = Math.max(0.1, Math.min(5.0, sensitivity));
  }

  getMouseSensitivity(): number {
    return this.inputConfig.mouseSensitivity;
  }

  setInvertY(invert: boolean): void {
    this.inputConfig.invertY = invert;
  }

  isYInverted(): boolean {
    return this.inputConfig.invertY;
  }

  // Get adjusted mouse movement with sensitivity and invert settings
  getAdjustedMouseMovement(): { x: number; y: number } {
    return {
      x: this.inputState.mouseMovementX * this.inputConfig.mouseSensitivity,
      y: this.inputState.mouseMovementY * this.inputConfig.mouseSensitivity * (this.inputConfig.invertY ? -1 : 1)
    };
  }

  // Export/import configuration for saving
  exportConfig(): InputConfig {
    return { ...this.inputConfig };
  }

  importConfig(config: Partial<InputConfig>): void {
    this.inputConfig = {
      ...this.inputConfig,
      ...config,
      keyMappings: {
        ...this.inputConfig.keyMappings,
        ...config.keyMappings
      }
    };
  }
}