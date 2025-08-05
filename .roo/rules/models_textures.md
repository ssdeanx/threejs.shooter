---
title: Models & Textures Rules
version: 1.0.0
lastUpdated: 2025-08-05
sourcePaths:
  - /assets/**
  - /src/**
---
Authoritative, repository-sourced guidance for 3D models and textures. Defines allowed formats, directory layout, and placement rules strictly based on what exists under [assets/](assets/.gitkeep:1). No speculative tooling content.

## Status Legend

- [*] Policy/Process — mandatory procedure
- [BP] Best‑Practice — required convention
- [HY] Hygiene — must be satisfied before work is considered complete

## Directory Layout (authoritative)

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
    - Trim-sheets/sets: [target_boxes_trimsheet.glb](assets/models/targets/target_boxes_trimsheet.glb:1), [trees_trimsheet.glb](assets/models/targets/trees_trimsheet.glb:1), [target_steel_trimsheet.glb](assets/models/targets/target_steel_trimsheet.glb:1)
    - Individuals/LODs/sets: [crate.glb](assets/models/targets/crate.glb:1), [targets_all.glb](assets/models/targets/targets_all.glb:1), Tree_0X variants, TargetSteel_0X_*variants, Bush_0X, fir_tree_* LODs, etc.
- Textures
  - [assets/textures/camo/](assets/textures/camo:1)
    - png and jpg variants, e.g. [camo_001.png](assets/textures/camo/camo_001.png:1), [image (10).jpg](assets/textures/camo/image (10).jpg:1)
  - [assets/textures/soldier/trimsheet/](assets/textures/soldier/trimsheet:1)
    - 2K trimsheet sets: BaseColor, Emissive, Normal, ORM (Urban, Woodland, and base)
      - e.g., [soldier_trimsheet_fabric_BaseColor@2k.png](assets/textures/soldier/trimsheet/soldier_trimsheet_fabric_BaseColor@2k.png:1)
  - [assets/textures/targets/](assets/textures/targets:1)
    - Subfolders for material/asset families (e.g., [crate/](assets/textures/targets/crate:1))

## Allowed Formats

- Models
  - [BP] .glb is the preferred model format for runtime import.
  - [BP] .fbx accepted for select sources (present: [hyper3d_soldier_character.fbx](assets/models/characters/hyper3d_soldier_character.fbx:1)); consider converting to .glb in pipeline when feasible.
- Textures
  - [BP] .png preferred.
  - [BP] .jpg acceptable for previews/camo atlases.
  - [BP] Trimsheets should use power‑of‑two resolutions (observed @2k).

## Placement Rules

- [*] Game-imported assets live under [assets/](assets/.gitkeep:1). Do not place game assets under [public/](public/index.html:1) unless they must be served verbatim without bundling.
- [*] Keep models grouped by domain:
  - Characters → [assets/models/characters/](assets/models/characters:1)
  - Weapons → [assets/models/weapons/](assets/models/weapons:1)
  - Targets/Environment props → [assets/models/targets/](assets/models/targets:1)
- [*] Keep textures grouped by material domain:
  - Camo → [assets/textures/camo/](assets/textures/camo:1)
  - Soldier trimsheets → [assets/textures/soldier/trimsheet/](assets/textures/soldier/trimsheet:1)
  - Targets → [assets/textures/targets/](assets/textures/targets:1) with subfolders per asset/material
- [HY] Use descriptive filenames reflecting set membership or variant (e.g., TargetSteel_0X_*, Tree_0X,*_trimsheet.glb).
- [HY] No secrets, licenses, or metadata embedded in binary assets. Maintain provenance outside binaries.

## Runtime Usage Guidance

- Import models from [assets/models](assets/models/targets:1) using Three.js loaders (see [src/systems/RenderSystem.ts](src/systems/RenderSystem.ts:206) for GLB usage patterns).
- Assign castShadow/receiveShadow appropriately to meshes at load time (see [src/systems/RenderSystem.ts](src/systems/RenderSystem.ts:223)).
- Prefer trimsheets for characters and environment sets to reduce draw calls and memory footprint.

## Example References in Code

- Soldier model and weapon attached at runtime: [src/systems/RenderSystem.ts](src/systems/RenderSystem.ts:248)
- Terrain is procedural; physics heightfield derived from render mesh: [src/systems/RenderSystem.ts](src/systems/RenderSystem.ts:139) and consumed by physics: [src/systems/PhysicsSystem.ts](src/systems/PhysicsSystem.ts:45)

## Change Control

- [*] New asset families must follow the existing directory conventions above.
- [HY] Remove or archive unused assets; avoid orphan binaries in version control.
