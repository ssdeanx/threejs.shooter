---
trigger: always_on
---

# Rule 8 — Performance & Memory (authoritative, copy‑safe)

Keep hot paths allocation‑free and predictable at 60 Hz.

## Budgets & Goals
- Draw calls: target ≤ 200 (prototype); review spikes.
- Tris (LOD0): Characters ≤ 60k; Weapons ≤ 25k; Props/Targets ≤ 10k.
- Materials per asset: 1–3 preferred.

## Allocation Discipline
- No `new THREE.*`, arrays, or closures in per‑entity loops. Reuse temps.
- No per‑frame create/destroy of ECS entities that can be pooled (e.g., projectiles).
- No per‑frame event wiring; register once, reuse.

## Caches & Pools
- Render caches keyed by `filepath + variant` for geometry/material/texture.
- Reference‑count textures/materials; dispose when last reference removed.
- Pool short‑lived entities (projectiles, hit markers).

## Profiling (dev‑only, flag‑gated)
- Optional counters per system: processed entities, step time.
- Sampling window (e.g., every N fixed steps), off by default.
- Zero allocations for profiling in hot loops when disabled.

## Prohibitions (hard)
- No per‑frame object allocations in `src/systems/**/*.ts*` loops.
- No global renderer state toggles per frame (e.g., shadow map size).
- No asset loads on the critical path; preload or async + apply at step boundaries.

## Reviewer Checklist
- Grep: `new THREE|\\[\\]|new Array\\(|Array\\(|new Map\\(|new Set\\(` in system loops.
- RenderSystem has caches and disposal; projectiles are pooled.
- No per‑frame `scene.add/remove` churn for static content.
- Hygiene: Rule 0 passes (no `any`, no unused, no stubs).

## Acceptance Gates
- Allocation‑free hot paths; caches/pools in place.
- Budgets met or exceptions documented with rationale.
- Internal lint clean (Rule 0).
