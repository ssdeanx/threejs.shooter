---
title: Project Rules
version: 1.0.0
lastUpdated: 2025-08-05
sourcePaths:
  - /package.json
  - /vite.config.ts
  - /eslint.config.js
  - /tsconfig.json
  - /tsconfig.node.json
  - /public/**
  - /src/**
  - /assets/**
---
Authoritative project-wide rules derived strictly from the current repository code and assets. These rules govern execution model, contribution hygiene, and content placement.

## Status Legend

- [*] Policy/Process — mandatory procedure
- [BP] Best‑Practice — required convention; do not remove without approval
- [HY] Hygiene — must be satisfied before considering work complete

## Core Principles

- [BP] Authoritative Simulation: ECS + Rapier physics run under a deterministic fixed-step loop (60 Hz). Rendering is decoupled and write-only to ECS transforms. See [src/main.ts](src/main.ts:1) and [src/systems/PhysicsSystem.ts](src/systems/PhysicsSystem.ts:1).
- [BP] Deterministic System Order: Input → Movement → Physics → Combat → Scoring → Camera → Render. Enforced at call site in [src/main.ts](src/main.ts:1).
- [HY] Strict Hygiene: Zero unused imports/vars/types/functions; zero TypeScript errors; no lint warnings; no stubs/partials. Enforced by scripts in [package.json](package.json:13) and ESLint/TS configs in [eslint.config.js](eslint.config.js:1), [tsconfig.json](tsconfig.json:1).
- [*] Non-Removal of Best Practices: Do not remove existing best-practice conventions without explicit approval and a documented replacement plan in version control.

## Execution Model

- [BP] Fixed-Step Accumulator at 60 Hz. Perform multiple ticks per RAF to drain the accumulator; render once per frame. See [src/main.ts](src/main.ts:175).
- [BP] Rapier Initialization: Initialize Rapier asynchronously before stepping the world. See [src/systems/PhysicsSystem.ts](src/systems/PhysicsSystem.ts:45).
- [BP] ECS ↔ Physics Mapping: Maintain entity ↔ Rapier rigid body/collider handle maps; sync physics transforms/velocities back into ECS components each tick. See [src/systems/PhysicsSystem.ts](src/systems/PhysicsSystem.ts:20).

## Contribution Gates

- [HY] CI Entry Criteria: Lint clean ([package.json](package.json:17)), type-check clean ([package.json](package.json:18)), no unused symbols (see rules in [eslint.config.js](eslint.config.js:31)).
- [HY] All symbols used: Any new component/system/API must be wired into the ECS and used in the same change; no dead exports or unused files.
- [*] Changes must align with these rules; deviations require explicit approval captured in repository history (e.g., PR description/changelog notes).

### CRITICAL WARNING

- Do not introduce unused variables, imports, types, functions, files, or assets.
- Do not mask unused with underscores (_) or void operators; symbols must be legitimately used or removed alongside their call sites.
- Do not leave stubs, partial implementations, or placeholders; every introduced symbol must be fully implemented and used in the same change.
- Do not use any to bypass typing. Use precise types or isolate and document interop boundaries explicitly.
- Do not remove required code solely to silence lint or type errors.
- Violations are grounds for automatic rejection/termination of the change.

## Content & Assets

- [*] No secrets or private tokens committed. Use local .env files when needed and do not commit production secrets. Static assets ship under [assets/](assets/.gitkeep:1) and are served by Vite from [public/](public/index.html:1) as-is when placed there.

## References

- Architecture and developer guide: [README.md](README.md:1)
- Tooling/commands: [package.json](package.json:13), [vite.config.ts](vite.config.ts:1), [eslint.config.js](eslint.config.js:1), [tsconfig.json](tsconfig.json:1), [tsconfig.node.json](tsconfig.node.json:1)
