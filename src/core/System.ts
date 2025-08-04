import type { EntityId } from './types';

export abstract class System {
  protected requiredComponents: string[] = [];
  protected requiredArchetype = 0;
  
  constructor(componentNames: string[]) {
    this.requiredComponents = componentNames;
    // Archetype will be calculated when components are registered
  }
  
  abstract update(deltaTime: number, entities: EntityId[]): void;
  
  getRequiredComponents(): string[] {
    return this.requiredComponents;
  }
  
  setRequiredArchetype(archetype: number): void {
    this.requiredArchetype = archetype;
  }
  
  getRequiredArchetype(): number {
    return this.requiredArchetype;
  }
}