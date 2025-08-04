# Project Context: Three.js Shooter Game

This project is a 3D third-person shooter game built using Three.js and an Entity-Component-System (ECS) architecture.

## Overview

The game is built around an ECS pattern, promoting modularity and scalability. It integrates a 3D physics engine for realistic interactions and is developed using TypeScript for type safety and maintainability.

## Key Technologies

* **Three.js:** For 3D rendering and scene management.
* **Cannon-es:** For realistic physics simulations (rigid bodies, collisions).
* **ECS (Entity-Component-System):**
  * **Entities:** Unique identifiers for game objects.
  * **Components:** Data containers attached to entities (e.g., PositionComponent, RigidBodyComponent, MeshComponent).
  * **Systems:** Logic that processes entities based on their components (e.g., RenderSystem, PhysicsSystem, MovementSystem, CameraSystem).
* **TypeScript:** Provides static typing for improved code quality and developer experience.
* **Vite:** A fast build tool for rapid development with hot module replacement.

## Core Functionality

* **Scene Setup:** Initializes a basic 3D scene with a ground plane, directional, and ambient lighting.
* **Player Entity:** A player entity is created with position, rotation, mesh, rigid body, velocity, and a `PlayerControllerComponent` for movement and input handling.
* **Physics Objects:** Multiple cube entities are created with physics properties, demonstrating basic object interactions and falling behavior.
* **Camera Control:** The `CameraSystem` manages the game camera, designed to follow the player entity.
* **Game Loop:** Uses `requestAnimationFrame` to continuously update all ECS systems (rendering, physics, movement, camera) and render the scene, ensuring smooth animations and interactions.

## Project Structure Highlights

* `src/main.ts`: Entry point, sets up the scene, initializes ECS, and runs the game loop.
* `src/components/`: Defines various data components used in the ECS (e.g., `GameplayComponents.ts`, `PhysicsComponents.ts`, `RenderingComponents.ts`, `TransformComponents.ts`).
* `src/core/`: Contains the core ECS implementation (`EntityManager.ts`, `System.ts`, `ComponentType.ts`, `types.ts`).
* `src/systems/`: Implements the game logic that operates on components (e.g., `CameraSystem.ts`, `InputSystem.ts`, `MovementSystem.ts`, `PhysicsSystem.ts`, `RenderSystem.ts`).

## Goal for Gemini CLI

This `GEMINI.md` file serves as a comprehensive overview for the Gemini CLI, allowing it to understand the project's context, architecture, and technologies. This should enable more accurate and relevant responses when interacting with the project via the CLI.

## Best Practices

* **ECS Principle Adherence:** Strictly separate data (Components), logic (Systems), and unique identifiers (Entities). Avoid mixing logic within components or directly manipulating entities outside of systems.
* **Component Granularity:** Keep components small and focused on a single piece of data. This promotes reusability and simplifies system logic.
* **System Singularity:** Each system should ideally focus on a single responsibility (e.g., `RenderSystem` for rendering, `PhysicsSystem` for physics).
* **Data-Oriented Design:** Structure data in components to be cache-friendly and easily processed by systems, especially for performance-critical parts like physics and rendering.
* **Three.js Memory Management:** Properly dispose of Three.js geometries, materials, and textures when they are no longer needed to prevent memory leaks, especially in a long-running game.
* **Physics World Integration:** Ensure a clear and consistent mapping between Three.js visual objects and Cannon-es physics bodies, handling transformations and synchronization carefully.
* **Input Handling Decoupling:** Separate raw input (keyboard, mouse events) from game-specific actions. An `InputSystem` should translate raw input into events or flags that other systems (like `MovementSystem`) can react to.
* **Delta Time Usage:** Always use `deltaTime` for physics and movement calculations to ensure consistent behavior across different frame rates.
* **Asset Optimization:** Optimize 3D models and textures (e.g., poly count, texture resolution, format) for web performance.

## Design Patterns

* **Entity-Component-System (ECS):** The core architectural pattern.
  * **Entities:** Simple IDs.
  * **Components:** Pure data objects (e.g., `PositionComponent`, `VelocityComponent`).
  * **Systems:** Functions that iterate over entities with specific components and apply logic (e.g., `MovementSystem` processes entities with `PositionComponent` and `VelocityComponent`).
* **Observer Pattern:** Can be used for communication between systems or between systems and UI, e.g., an event system for handling collisions or player actions.
* **Factory Pattern:** For creating complex entities or components with predefined configurations.
* **Resource Management Pattern:** For loading and managing assets (models, textures) efficiently, preventing redundant loading and ensuring proper disposal.

## Anti-Patterns to Avoid

* **God Objects/Systems:** Avoid creating components or systems that try to do too much. For example, a "PlayerComponent" that handles movement, rendering, and input directly. This defeats the purpose of ECS.
* **Tight Coupling:** Systems should not directly depend on or call methods of other specific systems. Communication should ideally happen through components or a well-defined event system.
* **Direct DOM Manipulation (in game loop):** Avoid directly manipulating the DOM (Document Object Model) within the main game loop, as this can lead to performance bottlenecks. UI updates should be batched or handled asynchronously.
* **Blocking Operations:** Do not perform long-running synchronous operations in the game loop, as this will freeze the application. Use asynchronous patterns for loading assets or complex calculations.
* **Magic Strings/Numbers:** Avoid using un-named string or number literals for component types or other identifiers. Use enums or constants for clarity and maintainability.
* **Global State Abuse:** Minimize reliance on global variables. Pass necessary data through system updates or use a dedicated state management system.
