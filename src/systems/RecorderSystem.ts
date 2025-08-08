import { System } from '@/core/System';
import type { EntityId } from '@/core/types';
import { InputSystem, type InputState } from './InputSystem';
import type { EntityManager } from '@/core/EntityManager';

export enum RecorderState {
  Stopped,
  Recording,
  Replaying
}

export class RecorderSystem extends System {
  private entityManager: EntityManager;
  private inputSystem: InputSystem;
  private state: RecorderState = RecorderState.Stopped;
  private frames: { input: InputState, hash: string }[] = [];
  private frame = 0;

  constructor(entityManager: EntityManager, inputSystem: InputSystem) {
    super([]);
    this.entityManager = entityManager;
    this.inputSystem = inputSystem;
  }

  update(deltaTime: number, entities: EntityId[]): void {
    if (this.state === RecorderState.Recording) {
      this.frames.push({
        input: this.inputSystem.getInputState(),
        hash: this.entityManager.hash(),
      });
    } else if (this.state === RecorderState.Replaying) {
      if (this.frame >= this.frames.length) {
        this.stop();
        return;
      }

      const frameData = this.frames[this.frame];
      this.inputSystem.setInputState(frameData.input as InputState);

      const currentHash = this.entityManager.hash();
      if (currentHash !== frameData.hash) {
        console.error(`Mismatch at frame ${this.frame}:`, {
          recorded: frameData.hash,
          current: currentHash,
        });
        this.stop();
      }

      this.frame++;
    }
  }

  isRecording(): boolean {
    return this.state === RecorderState.Recording;
  }

  isReplaying(): boolean {
    return this.state === RecorderState.Replaying;
  }

  record(): void {
    this.state = RecorderState.Recording;
    this.frames = [];
    this.frame = 0;
  }

  replay(): void {
    this.state = RecorderState.Replaying;
    this.frame = 0;
  }

  stop(): void {
    this.state = RecorderState.Stopped;
    this.frame = 0;
  }

  getFrames(): { input: InputState, hash: string }[] {
    return this.frames;
  }
}