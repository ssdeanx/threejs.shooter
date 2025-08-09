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
  private frames: { input: InputState; hash: string; entityCount: number; time: number }[] = [];
  private frame = 0;
  private elapsed = 0; // total simulated time captured via deltaTime

  constructor(entityManager: EntityManager, inputSystem: InputSystem) {
    super([]);
    this.entityManager = entityManager;
    this.inputSystem = inputSystem;
  }

  update(deltaTime: number, entities: EntityId[]): void {
    // advance deterministic time for recording/replay diagnostics
    this.elapsed += deltaTime;
    if (this.state === RecorderState.Recording) {
      // Record gameplay inputs only; never persist pause state into the recording
      const live = this.inputSystem.getInputState();
      this.frames.push({
        input: { ...live, isPaused: false },
        hash: this.entityManager.hash(),
        entityCount: entities.length,
        time: this.elapsed,
      });
    } else if (this.state === RecorderState.Replaying) {
      if (this.frame >= this.frames.length) {
        this.stop();
        return;
      }

      const frameData = this.frames[this.frame];
      // Apply recorded input but explicitly keep gameplay unpaused during replay
      const incoming = frameData.input as InputState;
      this.inputSystem.setInputState({ ...incoming, isPaused: false });

      const currentHash = this.entityManager.hash();
      const currentCount = entities.length;
      if (currentHash !== frameData.hash) {
        console.error(`Mismatch at frame ${this.frame}:`, {
          recorded: frameData.hash,
          current: currentHash,
          recordedCount: frameData.entityCount,
          currentCount,
          time: frameData.time,
        });
        this.stop();
      }
      // Secondary guard: entity count drift even if hash matches (surface context only)
      if (currentCount !== frameData.entityCount) {
        console.warn(`Entity count drift at frame ${this.frame}`, {
          recordedCount: frameData.entityCount,
          currentCount,
          time: frameData.time,
        });
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
    // Ensure gameplay is not paused while recording
    const current = this.inputSystem.getInputState();
    this.inputSystem.setInputState({ ...current, isPaused: false });
  }

  replay(): void {
    this.state = RecorderState.Replaying;
    this.frame = 0;
    // Ensure gameplay runs during replay
    const current = this.inputSystem.getInputState();
    this.inputSystem.setInputState({ ...current, isPaused: false });
  }

  stop(): void {
    this.state = RecorderState.Stopped;
    this.frame = 0;
    // Do not leave the game paused after recorder operations
    const current = this.inputSystem.getInputState();
    this.inputSystem.setInputState({ ...current, isPaused: false });
  }

  getFrames(): { input: InputState; hash: string; entityCount: number; time: number }[] {
    return this.frames;
  }
}