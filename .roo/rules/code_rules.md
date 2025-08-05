---
title: Code Rules
version: 1.0.0
lastUpdated: 2025-08-05
sourcePaths:
  - /eslint.config.js
  - /tsconfig.json
  - /tsconfig.node.json
  - /vite.config.ts
  - /src/**
---
Scope
Authoritative coding rules derived from the repository’s ESLint and TypeScript configuration and the current codebase under [src/](src:1). These are mandatory for all code contributions.

## Status Legend

- [*] Policy/Process — mandatory procedure
- [BP] Best‑Practice — required convention
- [HY] Hygiene — must be satisfied before work is considered complete

## Toolchain Baseline

- TypeScript compiler options: strict mode enabled with noEmit and unused checks. See [tsconfig.json](tsconfig.json:1).
  - target: ES2022; module: ESNext; moduleResolution: bundler; lib includes DOM/WebWorker.
  - alias: @ → src via [vite.config.ts](vite.config.ts:11) and [tsconfig.json](tsconfig.json:20).
- ESLint: flat config with JS recommended + TypeScript rules. See [eslint.config.js](eslint.config.js:1).
  - Enforced: [@typescript-eslint/no-unused-vars](eslint.config.js:33) error (argsIgnorePattern/varsIgnorePattern ^_).
  - Warnings: [@typescript-eslint/no-explicit-any](eslint.config.js:34). Prefer precise types.
  - Off: explicit-function-return-type (allowed for ergonomics).

## Hygiene (must pass locally)

- [HY] Lint clean: run [package.json](package.json:17) "npm run lint".
- [HY] Type-check clean: run [package.json](package.json:18) "npm run type-check".
- [HY] Zero unused symbols: remove or prefix intentionally unused with _ to satisfy [eslint.config.js](eslint.config.js:33).
- [HY] No stubs or partial implementations. All new exports must be used by game code within the same change set.
- [HY] No circular imports among core/components/systems. Extract shared types/utilities to break cycles.

### CRITICAL WARNING

- Do not introduce unused variables, imports, types, functions, files, or assets.
- Do not mask unused with underscores (_) or void operators; symbols must be legitimately used or removed alongside their call sites.
- Do not leave stubs, partial implementations, or placeholders; every introduced symbol must be fully implemented and used in the same change.
- Do not use any to bypass typing. Use precise types or isolate and document interop boundaries explicitly.
- Do not remove required code solely to silence lint or type errors.
- Violations are grounds for automatic rejection/termination of the change.

## Modules and Imports

- [BP] Use the @ alias for imports from [src/](src:1). Example: import { PhysicsSystem } from '@/systems/PhysicsSystem.js';
- [BP] Prefer barrel exports when it improves clarity: [src/components/index.ts](src/components/index.ts:1), [src/systems/index.ts](src/systems/index.ts:1).
- [BP] One primary responsibility per module. Avoid "catch‑all" files.

## TypeScript Practices

- [BP] Use explicit types for public APIs exported from systems/components.
- [BP] Keep ECS components as plain types/interfaces and factory helpers (no Three.js imports in component schemas). See [src/components/PhysicsComponents.ts](src/components/PhysicsComponents.ts:1).
- [BP] Avoid any; if interop requires it, isolate and document the boundary.

## Runtime Model Rules

- [*] Deterministic order: Input → Movement → Physics → Combat → Scoring → Camera → Render. Enforced by [src/main.ts](src/main.ts:63).
- [*] Fixed‑step physics (60 Hz): the accumulator loop lives in [src/main.ts](src/main.ts:175). Systems should be tolerant of variable dt but not implement their own render loops.
- [BP] Rendering is write‑only to ECS transforms; physics is authoritative for motion. See [src/systems/PhysicsSystem.ts](src/systems/PhysicsSystem.ts:70) and [src/systems/RenderSystem.ts](src/systems/RenderSystem.ts:157).

## Systems and Components

- [*] New ECS components live in [src/components/](src/components/index.ts:1) and include a typed schema and a factory when helpful.
- [*] New ECS systems live in [src/systems/](src/systems/index.ts:1) and must be registered in [src/main.ts](src/main.ts:63) respecting order.
- [BP] Do not couple game logic into [src/core](src/core/index.ts:1). Keep core generic.

## Three.js and Assets

- [BP] Use loaders from three/examples as needed; prefer GLB assets bundled under [assets/models](assets/models/targets:1).
- [BP] Set castShadow/receiveShadow appropriately and avoid duplicate scene lights. See [src/systems/RenderSystem.ts](src/systems/RenderSystem.ts:48).

## Commit Readiness Checklist

- [HY] Lint/type-check pass with zero warnings/errors.
- [HY] No dead exports or unused files.
- [HY] New public APIs are documented in [.roo/rules/api.md](.roo/rules/api.md:1) and wired in [src/main.ts](src/main.ts:63) when applicable.
