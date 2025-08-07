# Tech — Three.js Shooter • ECS + Rapier Prototype

Status: Draft
Owner: You (developer-maintained)
Last Updated: 2025-08-07

1. Technology Stack
- Language: TypeScript
- Runtime: Browser (Vite dev server)
- Core Rendering: Three.js via React Three Fiber (R3F)
- Physics: Rapier accessed via @react-three/rapier runtime namespace
- State Architecture: Custom ECS (EntityManager, System, components)
- Build Tool: Vite
- Linting: ESLint (flat config)
- Post Processing: R3F post-processing scaffold (PostFX.tsx)
- Asset Loading: GLB via a React hook (useGlbAsset)

2. Key Packages (from package.json)
- three
- @react-three/fiber
- @react-three/rapier
- react, react-dom
- typescript, vite
- eslint and plugins (per eslint.config.js)

Note: README mentions @dimforge/rapier3d-compat; current code integrates via @react-three/rapier default export at runtime. Types are isolated; PhysicsSystem owns lifecycle.

3. Project Structure (selected)
- Entry/HTML: index.html, public/index.html
- App Entrypoints: src/main.ts, src/react/main.tsx, src/react/App.tsx
- Orchestration: src/react/GameOrchestrator.tsx
- ECS Core: src/core/EntityManager.ts, src/core/System.ts, src/core/types.ts, src/core/ComponentType.ts, src/core/CollisionLayers.ts
- Systems: src/systems/*.ts (Input, Movement, Physics, Combat, Scoring, Camera, Soldier, Render)
- Components: src/components/*.ts (TransformComponents, PhysicsComponents, RenderingComponents, GameplayComponents)
- React Bindings: src/react/ecs-bindings.ts
- PostFX: src/react/PostFX.tsx
- Hooks: src/react/hooks/useGlbAsset.ts
- Config: vite.config.ts, tsconfig.json, eslint.config.js

4. Development Setup
- Install: npm install
- Start Dev: npm run dev (Vite)
- Build: npm run build
- Preview: npm run preview
- Lint: npm run lint (per eslint.config.js)

5. Deterministic Simulation Loop
- Host: GameOrchestrator useFrame (React Three Fiber)
- Mechanism: accumulator stepping at fixed 1/60 s
- Order per step: Input → Movement → Physics → Combat → Scoring → Camera → Render
- Constraint: no secondary loops or time sources; render FPS decoupled from logic

6. Physics Integration (Rapier via @react-three/rapier)
- World lifetime owned by PhysicsSystem (single-world policy)
- Services:
  - Collider and rigid-body creation
  - Raycast APIs (grounding, hitscan, camera occlusion)
  - Dynamics helpers (setVelocity, applyImpulse)
  - Collision masks via interaction groups
  - Entity ↔ body/collider mappings
- Grounding: multi-ray probe against ENV; slope normal and projection plane calculation
- Heightfield: temporarily disabled; flat ground collider active (re-enable planned)

7. Collision Layers and Masks
- Layers: PLAYER, ENEMY, ENV, CAMERA_BLOCKER, BULLET
- Implementation: 16-bit interaction groups configured through Rapier
- Usage:
  - Ground probe: ENV
  - Hitscan: ENEMY | ENV
  - Camera occlusion: CAMERA_BLOCKER
- Source: src/core/CollisionLayers.ts
- Policy: all systems must use consistent masks; helpers encouraged

8. Rendering and Assets
- RenderSystem updates Three objects after each simulation step; animation mixers updated post-sim
- Lighting configured centrally in RenderSystem
- Assets: GLB soldier + weapon attachment; useGlbAsset hook handles loading lifecycle
- PostFX: PostFX.tsx integrates R3F post-processing; ensure it remains view-only

9. React Integration Principles
- React orchestrates ECS construction and rendering; ECS owns simulation state
- StrictMode: protect against duplicate construction or loop registration
- ecs-bindings: provide read-only transform access to React UI; no ECS mutation from React components during simulation

10. Coding Standards and Hygiene
- TypeScript strictness enforced; avoid any except where absolutely necessary and justified
- ESLint as gate: no unused exports/symbols, no stubs/partials
- No TODO placeholders merged; prefer scoped issues or TASKS.md entries
- System boundaries respected: each system’s side-effects are explicit and localized

11. Configuration Notes
- tsconfig.json: paths and strict options aligned with ECS + R3F patterns; @ alias migration tracked in TASKS.md
- vite.config.ts: fast dev and HMR for R3F; ensure asset handling covers GLB and texture types
- eslint.config.js: flat config; run npm run lint before commits

12. Constraints and Trade-offs
- Determinism prioritized over micro-optimizations
- Single-world physics to avoid desync and complexity
- View-only React to prevent state divergence
- Optional interpolation experiments must not alter simulation state

13. Testing and Verification (manual for now)
- Verify single loop driver (no duplicate useFrame updates)
- Sanity tests:
  - Grounded movement stable across FPS variance
  - Camera occlusion blocks correctly via CAMERA_BLOCKER
  - Hitscan collides with ENEMY and ENV as expected
  - Collision masks consistent across systems
- Hygiene checks via ESLint and TypeScript builds

14. Next Technical Work
- Finalize collision mask helpers and document standard usage
- Re-enable heightfield with stable grounded probes
- Standardize asset disposal and lifecycle; ensure Physics/Render disposes correctly
- Complete @ alias migration across imports
- Add feature flag module for visual-only interpolation experiments

References
- brief.md — source-of-truth goals and constraints
- product.md — UX goals and acceptance criteria
- architecture.md — system design and order
- README.md — overview and diagrams
- TASKS.md — working plan, risks, and session logs