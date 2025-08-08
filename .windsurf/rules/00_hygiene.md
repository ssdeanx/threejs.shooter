---
trigger: always_on
---

# Rule 0 — Critical Hygiene (authoritative, must always hold)

## Core
- **No `any`, ever** — neither implicit nor explicit. Type interop boundaries precisely.
- **No unused, ever** — variables, params, imports, types, functions, enums, files. Delete immediately.
- **No stubs/partials** — no placeholders, TODOs, or commented‑out code in source.
- **Internal lint after every change** — fix all reported issues before proceeding. Do NOT run external build/lint/type‑check from rules/automation.

## Module & Structure
- **One responsibility per module** — avoid kitchen‑sink files; split cleanly.
- **Use `@/` alias to [src/](cci:7://file:///home/sam/threejs.shooter/src:0:0-0:0)** for imports (e.g., `@/systems/PhysicsSystem`).
- **Centralize ECS types** — no duplicated/shadowed component/system types.
- **No circular deps** across `src/core/`, `src/components/`, `src/systems/`, `src/react/`.
- **Named exports preferred** when it improves clarity and discoverability.

## ECS Contracts
- **Components are plain data + factories** — do not import Three.js in component schemas.
- **Systems declare `requiredComponents` and implement [update(dt, entities)](cci:1://file:///home/sam/threejs.shooter/src/core/System.ts:11:2-11:64)**.
- **No hidden global state** — systems mutate only the state they own.
- **Deterministic order** enforced in [src/systems/index.ts](cci:7://file:///home/sam/threejs.shooter/src/systems/index.ts:0:0-0:0); never re‑order ad hoc.

## Systems (per‑frame discipline)
- **No per‑frame allocations** (vectors/arrays/closures); reuse temporaries.
- **No dynamic event wiring per frame** — register once, reuse.
- **Clamp `dt` before accumulation** (e.g., `min(dt, 0.1)`).

## Physics (Rapier)
- **Ready gate** — never step or query before Rapier is fully initialized.
- **Fixed‑step gameplay** — never scale forces/velocities by variable `dt`.
- **Collision layers** from [src/core/CollisionLayers.ts](cci:7://file:///home/sam/threejs.shooter/src/core/CollisionLayers.ts:0:0-0:0) only — no magic numbers.
- **No create/destroy physics objects per frame** — pre‑create or pool.

## Rendering (R3F/Three)
- **Render/Camera systems are the only writers** to the Three.js scene graph.
- **Dispose GPU resources** — geometry/materials/textures when removed.
- **No per‑frame re‑creation** of materials/geometry; update props/uniforms instead.
- **Shadows** toggled intentionally; avoid unbounded global cost changes.

## Input Ownership
- **DOM listeners only in [src/systems/InputSystem.ts](cci:7://file:///home/sam/threejs.shooter/src/systems/InputSystem.ts:0:0-0:0)** — nowhere else.
- **No direct DOM polling** in other systems; propagate input via ECS components.

## Assets Discipline
- **Runtime assets under [assets/](cci:7://file:///home/sam/threejs.shooter/assets:0:0-0:0)**; [public/](cci:7://file:///home/sam/threejs.shooter/public:0:0-0:0) is verbatim static only.
- **Models** in `assets/models/{characters,weapons,targets}/`.
- **Textures** in `assets/textures/{camo,soldier,targets,wapons}/` (use existing spelling).
- **.glb** for runtime; **.fbx** source‑only (convert before use).
- **Set `castShadow`/`receiveShadow`** appropriately on load.

## Logging & Errors
- **No ad‑hoc `console.log`** in committed code; use a flag‑controlled debug util.
- **Fail fast** on impossible states (guards/exhaustive switches).
- **No silent catches** — surface actionable context.

## Security
- **No secrets in repo** — keys/tokens live in local env only.
- **No embedded network credentials** in code or assets.

## Build/Config & Security (authoritative, copy‑safe)

Locked configuration and security posture.

## Build & Tooling
- Vite config: `@` alias → [src/](cci:7://file:///home/sam/threejs.shooter/src:0:0-0:0); no dynamic import hacks.
- TypeScript strict mode; `noEmit` for type‑check.
- ESLint flat config enforced; internal lint must pass after each change.
- Rules/automation must NOT run external commands (build/lint/type‑check).

## Dependencies
- Pin critical libs; avoid unsafe/eval‑like packages.
- Avoid transitive peer chaos; prefer explicit versions.
- Document nontrivial upgrades in [README.md](cci:7://file:///home/sam/threejs.shooter/README.md:0:0-0:0).

## Secrets & .env
- No secrets/keys in repo or assets.
- [.env](cci:7://file:///home/sam/threejs.shooter/.env:0:0-0:0) (if used) not committed; never referenced from client code directly.

## Network & CSP (forward‑looking)
- No network calls without explicit feature flag and review.
- Plan for CSP: disallow `unsafe-eval`/`unsafe-inline` at deploy time.

## Public vs Assets
- [public/](cci:7://file:///home/sam/threejs.shooter/public:0:0-0:0) is verbatim static only (no runtime models/textures).
- Runtime assets live under [assets/](cci:7://file:///home/sam/threejs.shooter/assets:0:0-0:0) as defined in Rules 1–2.

## Prohibitions (hard)
- No rule or script triggers external `npm run ...`.
- No shipping `.fbx`/`.blend`; `.glb` only for runtime.
- No secrets, tokens, or credentials in code or assets.

## Reviewer Checklist
- [vite.config.ts](cci:7://file:///home/sam/threejs.shooter/vite.config.ts:0:0-0:0) has `@` alias; `tsconfig` strict true; ESLint flat config present.
- No external command execution from rules/automation.
- No secrets in repo; [.env](cci:7://file:///home/sam/threejs.shooter/.env:0:0-0:0) ignored; no client reads of secrets.
- [public/](cci:7://file:///home/sam/threejs.shooter/public:0:0-0:0) contains only verbatim static; runtime assets under [assets/](cci:7://file:///home/sam/threejs.shooter/assets:0:0-0:0).


## Review Gate (static checklist; no external commands)
- [ ] No `any` or implicit‑any.
- [ ] No unused vars/imports/types/functions/files; no commented‑out code.
- [ ] No stubs/partials remain.
- [ ] No per‑frame allocations or dynamic event wiring in systems.
- [ ] Only [InputSystem.ts](cci:7://file:///home/sam/threejs.shooter/src/systems/InputSystem.ts:0:0-0:0) attaches DOM listeners.
- [ ] No `requestAnimationFrame` in `src/systems/**/*.ts*`.
- [ ] No variable‑dt scaling of gameplay forces/velocities.
- [ ] Proper disposal of removed scene objects; no GPU leaks.
- [ ] Assets in correct [assets/](cci:7://file:///home/sam/threejs.shooter/assets:0:0-0:0) subfolders; [public/](cci:7://file:///home/sam/threejs.shooter/public:0:0-0:0) is verbatim only.
- [ ] Internal linter is clean after the latest change.