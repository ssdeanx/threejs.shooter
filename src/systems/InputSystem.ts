import { System } from '../core/System.js';
import type { EntityId } from '../core/types.js';

export interface InputState {
  isPaused: boolean;

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

/* eslint-env browser */
export class InputSystem extends System {
  private inputState: InputState;
  private keyBuffer: Map<string, number> = new Map();
  private bufferTime = 100; // ms
  private isPointerLocked = false;
  private inputConfig: InputConfig;

  // attachment lifecycle
  private attachedEl: globalThis.HTMLElement | null = null;
  private cleanupFns: Array<() => void> = [];

  constructor(config?: Partial<InputConfig>) {
    super([]); // InputSystem doesn't require specific components
    this.inputState = this.createInitialInputState();
    this.inputConfig = this.createDefaultConfig(config);
    // Do NOT attach globally here; caller must attach to a specific canvas/element.
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
      isPaused: false,
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
private addListener<K extends keyof globalThis.DocumentEventMap>(
  target: globalThis.Document | globalThis.HTMLElement | globalThis.Window,
  type: K,
  listener: (ev: globalThis.DocumentEventMap[K]) => void,
  opts?: boolean | globalThis.AddEventListenerOptions
) {
  target.addEventListener(type, listener as globalThis.EventListener, opts as boolean | globalThis.AddEventListenerOptions | undefined);
  this.cleanupFns.push(() => target.removeEventListener(type, listener as globalThis.EventListener, opts as boolean | globalThis.AddEventListenerOptions | undefined));
}

  attach(target: globalThis.HTMLElement): void {
    if (this.attachedEl === target) {
      return;
    }
    this.detach();

    this.attachedEl = target;

    // Ensure target can receive focus and keyboard
    if ((this.attachedEl as any).tabIndex == null || (this.attachedEl as any).tabIndex < 0) {
      (this.attachedEl as any).tabIndex = 0;
    }

    // Focus on click to ensure key events deliver to element
    const focusOnClick = () => this.attachedEl?.focus({ preventScroll: true });
    this.addListener(this.attachedEl, 'click', focusOnClick);

    // Keyboard scoped to element
    this.addListener(this.attachedEl, 'keydown', (event: globalThis.KeyboardEvent) => this.handleKeyDown(event));
    this.addListener(this.attachedEl, 'keyup', (event: globalThis.KeyboardEvent) => this.handleKeyUp(event));

    // Mouse on element
    this.addListener(this.attachedEl, 'mousedown', (event: globalThis.MouseEvent) => {
      if (event.button === 0) {
        this.inputState.leftClick = true;
      } else if (event.button === 2) {
        this.inputState.rightClick = true;
      }
    });
    this.addListener(this.attachedEl, 'mouseup', (event: globalThis.MouseEvent) => {
      if (event.button === 0) {
        this.inputState.leftClick = false;
      } else if (event.button === 2) {
        this.inputState.rightClick = false;
      }
    });

    // Request pointer lock on primary click on the element
    this.addListener(this.attachedEl, 'click', (event: globalThis.MouseEvent) => {
      if (event.button === 0) {
        this.requestPointerLock();
      }
    });

    // Mouse move uses document events while locked; otherwise local move still updates accumulated position.
    // Also handle unlocked case so React-embedded canvas still sees deltas pre-lock.
    this.addListener(document, 'mousemove', (event: globalThis.MouseEvent) => {
      const dx = event.movementX || 0;
      const dy = event.movementY || 0;
      if (this.isPointerLocked) {
        this.inputState.mouseMovementX = dx;
        this.inputState.mouseMovementY = dy;
        this.inputState.mouseX += dx;
        this.inputState.mouseY += dy;
      } else if (this.attachedEl) {
        // Provide small deltas even when not locked to help UI aim previews without violating pointer-lock semantics
        this.inputState.mouseMovementX = dx;
        this.inputState.mouseMovementY = dy;
      }
    });

    // Prevent context menu only while attached
    this.addListener(this.attachedEl, 'contextmenu', (event: globalThis.MouseEvent) => {
      event.preventDefault();
    });

    // Pointer lock change on document
    this.addListener(document, 'pointerlockchange', () => {
      this.isPointerLocked = document.pointerLockElement === this.attachedEl;
      if (!this.isPointerLocked) {
        // zero out deltas when unlocking to avoid stale movement
        this.inputState.mouseMovementX = 0;
        this.inputState.mouseMovementY = 0;
      }
    });

    // Window focus management
    this.addListener(window, 'blur', () => this.clearInputState());
    this.addListener(window, 'focus', () => this.clearInputState());
  }

  detach(): void {
    // Remove all listeners added since last attach
    for (const fn of this.cleanupFns) {
      try { fn(); } catch { /* noop */ }
    }
    this.cleanupFns = [];
    this.attachedEl = null;
    this.isPointerLocked = false;
    this.clearInputState();
  }

  private setupInputListeners(): void {
    // Kept for backward compatibility if ever called; route to document-less attach (no-op)
    // Prefer attach(target) from orchestrator.
  }

  private handleKeyDown(event: globalThis.KeyboardEvent): void {
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
        this.inputState.isPaused = !this.inputState.isPaused;
        break;
      case 'Tab':
        this.inputState.tab = true;
        event.preventDefault();
        break;
    }
  }

  private handleKeyUp(event: globalThis.KeyboardEvent): void {
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
    if (!this.isPointerLocked && this.attachedEl) {
      // Focus first so browsers deliver keys to the element
      this.attachedEl.focus({ preventScroll: true });
      this.attachedEl.requestPointerLock();
    }
  }

  private clearInputState(): void {
    // Clear all input states when focus is lost
    this.inputState.isPaused = false;
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

  setInputState(newState: InputState): void {
    this.inputState = { ...newState };
  }

  getAttachedElement(): globalThis.HTMLElement | null {
    return this.attachedEl;
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
    if (!keys) {
      return false;
    }

    return keys.some(key => {
      if (key === 'Mouse0') {
        return this.inputState.leftClick;
      }
      if (key === 'Mouse1') {
        return this.inputState.rightClick;
      }
      return this.keyBuffer.has(key) || this.isKeyCurrentlyPressed(key);
    });
  }

  wasActionJustPressed(action: string): boolean {
    const keys = this.inputConfig.keyMappings[action];
    if (!keys) {
      return false;
    }

    return keys.some(key => {
      if (key === 'Mouse0' || key === 'Mouse1') {
        return false;
      } // Mouse handled separately
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