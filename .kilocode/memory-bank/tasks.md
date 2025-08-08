# Tasks

## Wire Systems Together (Integration Pass)

Last updated: 2025-08-07

Goal:

Define authoritative fixed-timestep sim loop and deterministic system order. Prevent double updates, ensure single source of truth, and validate replay stability.

Scope:

- src/systems/**
- src/core/System.ts, EntityManager.ts
- No React changes

Steps:

1. System order: Input → Movement → Physics → Combat → Scoring → Camera → Render
2. Ensure single fixed-step authority (tick(dtFixed)) and forbid per-frame gameplay updates from React
3. Singleton systems where appropriate; guard against duplicate registration
4. Record/replay hooks: hash world each step; assert deterministic outputs for a fixed input sequence
5. Document constraints and update README

Acceptance:

- Fixed system order enforced
- Deterministic tick with no double updates
- Replay hash stable over N=10k steps given identical inputs
- README updated

---

## Options Screen on ESC (React UI + ECS-safe pausing)

Last updated: 2025-08-07

Goal:

ESC toggles options overlay; pausing affects ECS only. Rendering/UI continues. Persist/apply settings without creating a second gameplay loop.

Scope:

- src/react/**
- ECS pause flag owned by ECS; React reads state; commands dispatched via queue

Steps:

1. Keybinding ESC in React to open overlay
2. Dispatch ECS-safe pause/resume command; do not mutate gameplay from React
3. Overlay: audio, controls, graphics preferences
4. Persist to localStorage; apply non-gameplay side effects safely
5. Verify sim remains in single fixed loop

Acceptance:

- ESC toggles overlay and pauses ECS deterministically
- React remains read-only to gameplay state
- Settings persisted and applied without affecting determinism

---

## UI State with Zustand (Options and Non-deterministic UI)

Last updated: 2025-08-07

Goal:

Evaluate and optionally adopt Zustand for UI/options overlay and other non-simulation app state. ECS remains authoritative for gameplay, physics, and the fixed-timestep loop.

Scope:

- React UI only under src/react/**
- Options overlay preferences: audio, controls, graphics, overlay flags
- No changes to ECS systems in this planning task

Steps:

1. Draft a UI state schema
   - audio: master, sfx (0..1)
   - controls: sensitivity (float), invertY (bool)
   - graphics: quality enum [low, medium, high]
   - ui: isOptionsOpen (bool)
2. Define one-way data flow
   - ECS publishes read-only selectors for display
   - Zustand holds UI prefs and emits side-effect requests via an ECS-safe command queue (no direct gameplay mutation)
3. Persistence and migrations
   - localStorage with versioned key, e.g., app.ui.v1
   - migration notes for future schema changes
4. Risks and constraints
   - Pause flag and simulation authority stay in ECS
   - Prevent introducing a second simulation loop
   - Avoid React-driven gameplay updates
5. Output a migration plan limited to src/react/**
   - Identify components to connect to Zustand
   - Specify command queue touchpoints to ECS

Acceptance:

- Written schema and one-way data flow notes
- Persistence strategy with versioned key and migration approach
- Explicit statement: ECS remains source of truth for gameplay and pause
- No changes to src/systems/*.ts performed by this task

---

## Comparative Design Doc — ECS vs Zustand for Gameplay

Last updated: 2025-08-07

Goal:

Produce docs/ecs-vs-zustand.md comparing deterministic ECS gameplay vs attempting gameplay logic in Zustand stores, including tradeoffs, risks, and a test plan. Planning-only; no gameplay refactor here.

Comparison Axes:

- Determinism across fixed timesteps and replay ability
- System ordering and dependency graphs (Input → Movement → Physics → Combat → Scoring → Camera → Render)
- Time-travel/replay and network lockstep readiness
- Performance at scale (N = 1k+ entities)
- Debuggability and state inspection
- React rendering isolation and accidental reactivity coupling
- Complexity, ergonomics, and codebase sustainability

Evidence Plan (outline only):

1. Benchmarks
   - Move 1k entities for 10k fixed steps in each approach
   - Measure total duration, GC pressure, allocations/step
2. Replay test
   - Record 5s of inputs; compute per-step world hash
   - Verify byte-identical hashes over 3 seeds per approach
3. Network-sim test
   - Introduce artificial lag/freeze on one client
   - Observe divergence characteristics and recovery options

Deliverables:

- docs/ecs-vs-zustand.md with:
  - Tradeoff matrix and narrative
  - Detailed test plan and harness outline (commands, metrics)
  - Clear recommendation and decision record
  - Risks and rollback plan for any spike

Acceptance:

- Document exists with all sections
- Recommendation explicitly addresses determinism and lockstep goals
- Risks/mitigations defined

---

## Finalize Collision Masks (Project-Wide Checklist)
Last updated: 2025-08-07


Items:
- [ ] MovementSystem: ENV-only ground probe

- [ ] CombatSystem: hitscan ENEMY | ENV
- [ ] CameraSystem: occlusion CAMERA_BLOCKER
- [ ] Manual tests and expected behavior verification
- [ ] Update README.md and Memory Bank

---

Notes:
- Keep ECS authoritative for gameplay; React/Zustand limited to UI and preferences

- Maintain single fixed-timestep loop; no second simulation path
- Use deterministic record/replay to validate changes
