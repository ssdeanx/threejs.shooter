import type { EntityId } from './types';
import { ComponentType } from './ComponentType';
import { System } from './System';

export class EntityManager {
  private nextEntityId: EntityId = 1;
  private entityArchetypes = new Map<EntityId, number>();
  private componentArrays = new Map<string, unknown[]>();
  private systems: System[] = [];
  private archetypeQueries = new Map<number, EntityId[]>();
  
  createEntity(): EntityId {
    const entityId = this.nextEntityId++;
    this.entityArchetypes.set(entityId, 0);
    return entityId;
  }
  
  destroyEntity(entityId: EntityId): void {
    // Remove from all component arrays
    for (const [, array] of this.componentArrays) {
      if (array[entityId]) {
        delete array[entityId];
      }
    }
    
    // Remove from archetype queries
    for (const [, entities] of this.archetypeQueries) {
      const index = entities.indexOf(entityId);
      if (index !== -1) {
        entities.splice(index, 1);
      }
    }
    
    this.entityArchetypes.delete(entityId);
  }
  
  addComponent<T>(entityId: EntityId, componentName: string, component: T): void {
    // Ensure component array exists
    if (!this.componentArrays.has(componentName)) {
      this.componentArrays.set(componentName, []);
      ComponentType.register(componentName);
    }
    
    // Add component to array
    const array = this.componentArrays.get(componentName)!;
    array[entityId] = component;
    
    // Update entity archetype
    const componentBit = ComponentType.get(componentName);
    const currentArchetype = this.entityArchetypes.get(entityId) || 0;
    const newArchetype = currentArchetype | componentBit;
    this.entityArchetypes.set(entityId, newArchetype);
    
    // Update archetype queries
    this.updateArchetypeQueries(entityId, currentArchetype, newArchetype);
  }
  
  removeComponent(entityId: EntityId, componentName: string): void {
    const array = this.componentArrays.get(componentName);
    if (!array || !array[entityId]) {
      return;
    }
    
    delete array[entityId];
    
    // Update entity archetype
    const componentBit = ComponentType.get(componentName);
    const currentArchetype = this.entityArchetypes.get(entityId) || 0;
    const newArchetype = currentArchetype & ~componentBit;
    this.entityArchetypes.set(entityId, newArchetype);
    
    // Update archetype queries
    this.updateArchetypeQueries(entityId, currentArchetype, newArchetype);
  }
  
  getComponent<T>(entityId: EntityId, componentName: string): T | null {
    const array = this.componentArrays.get(componentName);
    return (array?.[entityId] as T) || null;
  }
  
  hasComponent(entityId: EntityId, componentName: string): boolean {
    const array = this.componentArrays.get(componentName);
    return array?.[entityId] !== undefined;
  }
  
  queryEntities(archetype: number): EntityId[] {
    if (!this.archetypeQueries.has(archetype)) {
      this.archetypeQueries.set(archetype, []);
      
      // Populate with existing entities that match
      for (const [entityId, entityArchetype] of this.entityArchetypes) {
        if (ComponentType.matchesArchetype(entityArchetype, archetype)) {
          this.archetypeQueries.get(archetype)!.push(entityId);
        }
      }
    }
    
    return this.archetypeQueries.get(archetype)!;
  }
  
  registerSystem(system: System): void {
    // Calculate required archetype for system
    const archetype = ComponentType.createArchetype(...system.getRequiredComponents());
    system.setRequiredArchetype(archetype);
    this.systems.push(system);
  }
  
  updateSystems(deltaTime: number): void {
    for (const system of this.systems) {
      const entities = this.queryEntities(system.getRequiredArchetype());
      system.update(deltaTime, entities);
    }
  }
  
  private updateArchetypeQueries(entityId: EntityId, oldArchetype: number, newArchetype: number): void {
    // Remove from old matching queries
    for (const [archetype, entities] of this.archetypeQueries) {
      const wasMatching = ComponentType.matchesArchetype(oldArchetype, archetype);
      const isMatching = ComponentType.matchesArchetype(newArchetype, archetype);
      
      if (wasMatching && !isMatching) {
        const index = entities.indexOf(entityId);
        if (index !== -1) {
          entities.splice(index, 1);
        }
      } else if (!wasMatching && isMatching) {
        entities.push(entityId);
      }
    }
  }
  
  getEntityCount(): number {
    return this.entityArchetypes.size;
  }
  
  getComponentArrays(): Map<string, unknown[]> {
    return this.componentArrays;
  }
}