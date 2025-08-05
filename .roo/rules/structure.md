---
title: Structure Rules
version: 1.0.0
lastUpdated: 2025-08-05
sourcePaths:
  - /src/**
  - /assets/**
  - /public/**
  - /index.html
  - /vite.config.ts
  - /package.json
---
Scope
Authoritative, code-sourced rules describing the current repository layout and where new code and assets must live. This mirrors what exists under [src/](src:1), [assets/](assets/.gitkeep:1), and [public/](public/index.html:1).

## Status Legend

- [*] Policy/Process — mandatory procedure
- [BP] Best‑Practice — required convention
- [HY] Hygiene — must be satisfied before work is considered complete

## Top‑Level

- [package.json](package.json:1) — scripts, deps, dev server.
- [vite.config.ts](vite.config.ts:1) — Vite config; alias @ → src.
- [tsconfig.json](tsconfig.json:1), [tsconfig.node.json](tsconfig.node.json:1) — TypeScript configs.
- [eslint.config.js](eslint.config.js:1) — ESLint flat config.
- [index.html](index.html:1) — Vite HTML entry (root).
- [public/](public/index.html:1) — static files served as‑is (no hashing, no transforms).
- [assets/](assets/.gitkeep:1) — project-shipped models and textures (imported/bundled).
- [src/](src:1) — application source.

## Source Layout (authoritative)

- [src/main.ts](src/main.ts:1) — Entry point; constructs ECS world, registers systems, runs fixed‑step loop and render.
- [src/debug.ts](src/debug.ts:1), [src/simple-test.ts](src/simple-test.ts:1) — utilities/smoke tests.
- Core ECS ([src/core/](src/core/index.ts:1))
  - [ComponentType.ts](src/core/ComponentType.ts:1)
  - [EntityManager.ts](src/core/EntityManager.ts:1)
  - [System.ts](src/core/System.ts:1)
  - [types.ts](src/core/types.ts:1)
  - [index.ts](src/core/index.ts:1)
- Components ([src/components/](src/components/index.ts:1))
  - [TransformComponents.ts](src/components/TransformComponents.ts:1)
  - [PhysicsComponents.ts](src/components/PhysicsComponents.ts:1)
  - [RenderingComponents.ts](src/components/RenderingComponents.ts:1)
  - [GameplayComponents.ts](src/components/GameplayComponents.ts:1)
  - [index.ts](src/components/index.ts:1)
- Systems ([src/systems/](src/systems/index.ts:1))
  - [InputSystem.ts](src/systems/InputSystem.ts:1)
  - [MovementSystem.ts](src/systems/MovementSystem.ts:1)
  - [PhysicsSystem.ts](src/systems/PhysicsSystem.ts:1)
  - [CombatSystem.ts](src/systems/CombatSystem.ts:1)
  - [ScoringSystem.ts](src/systems/ScoringSystem.ts:1)
  - [CameraSystem.ts](src/systems/CameraSystem.ts:1)
  - [RenderSystem.ts](src/systems/RenderSystem.ts:1)
  - [SoldierSystem.ts](src/systems/SoldierSystem.ts:1)
  - [index.ts](src/systems/index.ts:1)
- [scripts/](scripts:1) — helper scripts (if any).

## Deterministic Update Order (enforced by caller)

- [*] The canonical order invoked from [src/main.ts](src/main.ts:175):
  1) Input
  2) Movement
  3) Physics
  4) Combat
  5) Scoring
  6) Camera
  7) Render

## File Placement Rules

- [*] New ECS components: place under [src/components/](src/components/index.ts:1) with a typed schema; export from the barrel when appropriate.
- [*] New ECS systems: place under [src/systems/](src/systems/index.ts:1) and register them in [src/main.ts](src/main.ts:63).
- [BP] Core abstractions belong in [src/core/](src/core/index.ts:1); do not add game logic to core.
- [BP] Keep single-responsibility modules; avoid “catch‑all” files.

Imports, Aliases, Indices

- [BP] Use alias @ for imports targeting [src/](vite.config.ts:11).
- [BP] Prefer the barrels [src/components/index.ts](src/components/index.ts:1) and [src/systems/index.ts](src/systems/index.ts:1) when it improves ergonomics.
- [HY] No circular imports among core/components/systems. Extract shared types to break cycles.

## Assets Layout (authoritative)

- Models
  - [assets/models/characters/](assets/models/characters:1)
    - [hyper3d_soldier_character.fbx](assets/models/characters/hyper3d_soldier_character.fbx:1)
    - [hyper3d_soldier_character.glb](assets/models/characters/hyper3d_soldier_character.glb:1)
    - [soldier.glb](assets/models/characters/soldier.glb:1)
  - [assets/models/weapons/](assets/models/weapons:1)
    - [ak74.glb](assets/models/weapons/ak74.glb:1)
    - [m4a1.glb](assets/models/weapons/m4a1.glb:1)
    - [weapons_trimsheet.glb](assets/models/weapons/weapons_trimsheet.glb:1)
  - [assets/models/targets/](assets/models/targets:1)
    - Trim-sheets and grouped sets like [target_boxes_trimsheet.glb](assets/models/targets/target_boxes_trimsheet.glb:1), [trees_trimsheet.glb](assets/models/targets/trees_trimsheet.glb:1), [target_steel_trimsheet.glb](assets/models/targets/target_steel_trimsheet.glb:1)
    - Individual and set pieces (e.g., [crate.glb](assets/models/targets/crate.glb:1), [targets_all.glb](assets/models/targets/targets_all.glb:1), Tree_0X, TargetSteel_0X_* variants)
- Textures
  - Camo variants under [assets/textures/camo/](assets/textures/camo:1) (png, jpg)
    - e.g., [camo_001.png](assets/textures/camo/camo_001.png:1), [image (10).jpg](assets/textures/camo/image (10).jpg:1)
  - Soldier trimsheets under [assets/textures/soldier/trimsheet/](assets/textures/soldier/trimsheet:1) (@2k variants for BaseColor/Emissive/Normal/ORM)
    - e.g., [soldier_trimsheet_fabric_BaseColor@2k.png](assets/textures/soldier/trimsheet/soldier_trimsheet_fabric_BaseColor@2k.png:1)
  - Targets texture roots under [assets/textures/targets/](assets/textures/targets:1) with subfolders (e.g., crate)

## Asset Placement Rules

- [*] Game-imported assets belong under [assets/](assets/.gitkeep:1). Public files that must be served verbatim belong under [public/](public/index.html:1).
- [BP] Models as .glb (preferred) or .fbx only when needed (e.g., [hyper3d_soldier_character.fbx](assets/models/characters/hyper3d_soldier_character.fbx:1)).
- [BP] Texture formats: png preferred, jpg acceptable for previews/camo. Keep trimsheets at power‑of‑two resolutions (e.g., 2K).
- [HY] Follow directory naming already established (characters, weapons, targets; camo, soldier/trimsheet).
- [HY] No secrets or licenses embedded in assets. Maintain provenance outside of binary files.

## Notes

- This document reflects the repository as it exists. If new directories emerge, add them here with placement rules in the same change that introduces them.
