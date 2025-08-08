---
trigger: always_on
---

# Rule 9 — Module Boundaries & Types (authoritative, copy‑safe)

Enforce clear layering, imports, and type ownership.

## Allowed Import Directions
- `src/core/` → none (foundation)
- `src/components/` ↔ `src/core/` (data + factories only; no Three.js)
- `src/systems/` → `src/core/` + `src/components/`
- `src/react/` → `src/systems/` + `src/core/`
- Forbid: systems importing from `src/react/`; react importing components directly (use ECS state).

## Imports & Aliases
- Use `@/` alias to [src/](cci:7://file:///home/sam/threejs.shooter/src:0:0-0:0) everywhere.
- Prefer named exports for discoverability and stable refactors.
- Barrels ([index.ts](cci:7://file:///home/sam/threejs.shooter/src/core/index.ts:0:0-0:0)) expose stable APIs; avoid deep “reach‑in” paths.

## Type Ownership
- Centralize ECS types in `src/core/` (no duplicates/shadows in leaves).
- Components are pure data + factories (no Three.js imports).
- System APIs stable: `requiredComponents`, [update(dt, entities)](cci:1://file:///home/sam/threejs.shooter/src/core/System.ts:11:2-11:64).

## Circular Dependencies
- No cycles across `core/`, `components/`, `systems/`, `react/`.
- Break cycles with inversion (callbacks/interfaces) or event queues.

## Reviewer Checklist
- Grep imports start with `@/`.
- No `from "../react/..."` in `src/systems/**/*.ts*`.
- No `from "../components/..."` in `src/react/**/*.tsx` (bridge via ECS).
- Components don’t import `three` or R3F.
- No circular deps reported by simple grep heuristics (and code review).

## Acceptance Gates
- Layering holds; alias used; types centralized.
- No cycles; barrels used for public APIs.
- Internal lint clean (Rule 0).