// Component type registry using bitmasks
export class ComponentType {
  private static nextBit = 1;
  private static typeMap = new Map<string, number>();
  
  static register(name: string): number {
    if (this.typeMap.has(name)) {
      return this.typeMap.get(name)!;
    }
    
    const bit = this.nextBit;
    this.nextBit <<= 1;
    this.typeMap.set(name, bit);
    return bit;
  }
  
  static get(name: string): number {
    const bit = this.typeMap.get(name);
    if (bit === undefined) {
      // Auto-register component if not found
      return this.register(name);
    }
    return bit;
  }
  
  static createArchetype(...componentNames: string[]): number {
    let archetype = 0;
    for (const name of componentNames) {
      archetype |= this.get(name);
    }
    return archetype;
  }
  
  static matchesArchetype(entityArchetype: number, requiredArchetype: number): boolean {
    return (entityArchetype & requiredArchetype) === requiredArchetype;
  }
}