# ThreeJS Shooter — Rapier + React Refactor Plan

### CRITICAL WARNING

- Do not introduce unused variables, imports, types, functions, files, or assets.
- Do not mask unused with underscores (_) or void operators; symbols must be legitimately used or removed alongside their call sites.
- Do not leave stubs, partial implementations, or placeholders; every introduced symbol must be fully implemented and used in the same change.
- Do not use any to bypass typing. Use precise types or isolate and document interop boundaries explicitly.
- Do not remove required code solely to silence lint or type errors.
- Violations are grounds for automatic rejection/termination of the change.

### Acceptance Gates — Critical

- Lint clean and type-check clean with zero warnings/errors.
- No unused symbols; no underscore/void masking.
- No use of any to bypass typing; interop boundaries must be isolated and documented.
- No stubs/partials; all new APIs used by game code within the same change set.
- Do not remove working code solely to appease lint/type errors.

Purpose
Create a persistent, incremental checklist to migrate from Cannon to Rapier and align ECS with an authoritative fixed-step loop. Use this as cross-session context. Only implement items explicitly marked as “In Progress” for the current session.
- Always run the gamethinking MCP tool to plan core mechanics and system changes before making code edits. Document key decisions from gamethinking runs in the Session Log.
- [HY] Absolute hygiene requirement: always use and fully implement any declared values, variables, imports, types, and functions. Do not leave unused or partially implemented symbols. There is zero tolerance for leaving stubs or removing required items: everything must be fully functional at all times or you will be banned.

Status Legend
- [ ] TODO
- [~] In Progress
- [x] Done
- [!] Risk/Decision
- [*] Policy/Process
- [BP] Best‑Practice Directive (must not be removed without explicit approval)
- [HY] Hygiene Rule (must be enforced in code before marking tasks done)

Goals
- Replace Cannon physics with Rapier while keeping ECS authoritative.
- Introduce a fixed-step accumulator and deterministic system order.
- Update Movement, Camera, Combat to use Rapier APIs and queries.
- Keep imperative rendering initially; optionally integrate React Three Fiber (R3F) later without duplicating the physics world.
- Institutionalize engineering hygiene: zero unused symbols (imports, vars, types), zero TypeScript errors, zero lint warnings on commit.
- Adhere to best practices patterns established for this project (naming, component separation, authoritative simulation, tick ordering, event-driven interactions). Never remove existing best‑practice conventions already present unless explicitly approved.
- [HY] Enforcement: any introduced symbol (value, variable, import, type alias/interface, function/method) must be used and wired end-to-end in the same PR. If a symbol cannot be fully implemented, do not attempt the change. No partials. No leaving unused. No removals of required constructs. Violations result in a ban. Using _

Canonical System Order (deterministic)
1) Input
2) Movement (apply intents → Rapier bodies)
3) Physics (fixed-step Rapier world.step)
4) Combat (raycasts/intersections)
5) Scoring
6) Camera (follow, collision)
7) Render (write-only transforms, then draw)

Fixed-step Loop Design
- fixedDt = 1/60
- Accumulator += renderDelta
- While accumulator ≥ fixedDt:
  - Input.update(fixedDt)
  - Movement.update(fixedDt)
  - Physics.update(fixedDt) → world.step(fixedDt) and sync ECS transforms
  - Combat.update(fixedDt)
  - Scoring.update(fixedDt)
  - Camera.update(fixedDt)
  - accumulator -= fixedDt
- RenderSystem.update(renderDelta) and renderer.render(scene, camera)
- Optional: interpolation for visuals using last/current physics states.

Migration Checklist (File-by-File)

Components
- [x] src/components/PhysicsComponents.ts
  - [x] Replace Cannon-centric fields.
  - [x] Add Rapier-compatible types.
    - RigidBodyComponent
      - handle?: number
      - kind: 'dynamic' | 'kinematicVelocity' | 'kinematicPosition' | 'fixed'
      - mass?: number
      - linearDamping?: number, angularDamping?: number
      - canSleep?: boolean, ccd?: boolean, lockRot?: boolean
      - gravityScale?: number
      - linearVelocity?: { x; y; z }, angularVelocity?: { x; y; z }
      - collisionGroups?: number, solverGroups?: number
    - ColliderComponent (discriminated union):
      - cuboid/ball/capsule/trimesh/heightfield
      - offset: position + optional rotation (quat)
      - restitution, friction, sensor
      - activeEvents, activeCollisionTypes, groups
    - CharacterControllerComponent (optional but recommended)
      - mode: 'kinematicVelocity'
      - slopeLimitDeg, stepHeight, snapToGround
      - maxSpeed, jumpSpeed, airControl
  - [x] Clarify VelocityComponent usage (intent vs source-of-truth).

Physics
- [x] src/systems/PhysicsSystem.ts
  - [x] Remove Cannon; use Rapier from '@dimforge/rapier3d-compat'.
  - [x] Await Rapier.init() exactly once.
  - [x] Create world with gravity; enable sleeping.
  - [x] Body/collider creation from ECS components.
  - [x] Maintain maps: entityId → rigidBodyHandle; colliderHandle → entityId.
  - [x] Fixed-step update; sync Position/Rotation (and optionally Velocity) back to ECS.
  - [x] Expose APIs:
    - init(opts?: { gravity: { x; y; z } })
    - createOrUpdateBody(entityId)
    - removeBody(entityId)
    - setLinvel(entityId, v) [implemented as setVelocity(entityId, THREE.Vector3)]
    - applyImpulse(entityId, i, wake?)
    - raycast(origin, dir, maxToi, solid?, filterGroups?) → hit | null
    - getBody(entityId) → RigidBody | null
    - getTerrainEntity() → EntityId | null
    - setCollisionLayers(entityId, layersMask, interactsWithMask): void
    - getBody(entityId) → RigidBody | null
    - getTerrainEntity() → EntityId | null
    - setCollisionLayers(entityId, layersMask, interactsWithMask): void

Movement
- [x] src/systems/MovementSystem.ts
  - [x] Replace setVelocity semantics:
    - KinematicVelocity: physics.setVelocity(...) wired
    - Dynamic: physics.applyImpulse(...) integrated for lateral intents
  - [x] Ground check via short downward raycast; cache grounded flag.
  - [x] Reuse temp vectors (no per-frame allocations).

Camera
- [x] src/systems/CameraSystem.ts
  - [x] Replace Three.Raycaster with physics.raycast for player→camera collision.
  - [x] Keep smoothing; support collision layers for camera blockers.
  - [x] Maintain addCollidable API as a higher-level tagging mechanism internally mapped to layers.

Combat
- [x] src/systems/CombatSystem.ts
  - [x] Replace Three.raycaster with physics.raycast using weapon range.
  - [x] Use colliderHandle → entityId map to resolve hits.
  - [x] Compute hit point via origin + dir * toi.

Render
- [x] src/systems/RenderSystem.ts
  - [x] Remove direct physics coupling (terrain) by routing terrain to Physics via ECS marker + PhysicsSystem.setTerrainEntity.
  - [x] When generating visual terrain, create an ECS Terrain entity with ColliderComponent { type: 'heightfield' } for PhysicsSystem consumption.
  - [x] Keep write-only transform updates.

Main loop
- [x] src/main.ts
  - [x] Introduce fixed-step accumulator and canonical order.
  - [x] Await physicsSystem.init() before starting animate.
  - [ ] Optional: interpolation planning (unchanged).

Unchanged or Low Priority
- [x] src/systems/SoldierSystem.ts, src/systems/ScoringSystem.ts, src/systems/index.ts
- [x] src/components/TransformComponents.ts, RenderingComponents.ts, GameplayComponents.ts

Phase 2 — R3F Integration

[*] Dependencies alignment (do not modify package.json in this task)
- [ ] Confirm these deps are already present in package.json: "@react-three/fiber", "@react-three/drei", "@react-three/postprocessing", "react", "react-dom".
- [ ] Verify that the core "postprocessing" library is present and version-compatible with "@react-three/postprocessing"; if missing, plan an install step and align versions with three and @react-three/postprocessing before implementation.

- [ ] Adopt R3F for render scheduling
  - [x] Introduce <Canvas> in index.html or App, ensure only one renderer.
  - [ ] Port the RAF render to R3F’s useFrame; maintain accumulator logic (fixedDt=1/60) inside a single orchestrator hook.
  - [ ] Call RenderSystem.update from the R3F pass without ECS back-writes.
  - [x] Ensure exactly one loop/accumulator exists. If migrating fully to R3F, disable the legacy RAF; otherwise keep legacy until parity test passes, then remove the legacy loop in the same change set to avoid dual loops.

- [ ] Postprocessing
  - [~] Postprocessing pipeline
    - [x] Add "postprocessing" core lib if not present; keep versions compatible with three and @react-three/postprocessing.
    - [x] Create a minimal Effects chain using @react-three/postprocessing (e.g., SMAA or FXAA first, then optional Bloom/SSR).
    - [x] Ensure effects are view-only and driven from the R3F useFrame render pass; no ECS/physics back-writes and no per-frame allocations.
    - [x] Provide feature toggles via a small React config layer (contexts/hooks or component props) without leaking into ECS.

- [ ] ECS/Physics ownership (One World)
  - [ ] Single authoritative Rapier world managed by ECS/PhysicsSystem; React must not instantiate another physics world/provider.
  - [ ] Audit any @react-three/rapier usage; ensure it consumes the existing world or is not used.
  - [ ] Expose read-only hooks/selectors to bridge ECS transforms into React without writes (React is strictly view-only).

- [x] View binding
- [x] Create minimal React components/hooks that read ECS MeshComponent transforms and apply them to Three objects (read-only).
- [x] Prove no ECS/physics writes from React; only read → Three.js object transforms.

- [ ] Asset loading in React
  - [ ] Migrate GLB loads to Suspense-friendly hooks while preserving MeshComponent mapping.
  - [ ] Ensure materials/geometries allocated once; dispose on unmount.

- [x] Camera in R3F
- [x] Drive camera position/rotation via CameraSystem output; set as default in R3F scene.
- [x] Keep deterministic smoothing; no per-frame allocations; no extra cameras created.

- [ ] Dev ergonomics & hygiene
  - [ ] Establish @ alias in React files; no unused imports/vars; no any.
  - [ ] Add lightweight story/smoke route to verify Three objects match ECS transforms.

Risks & Mitigations (P2 specific)
- [!] React StrictMode double effects
  - Mitigation: Guard world init with idempotent flags; avoid side effects in component bodies; isolate to useEffect with stable deps.
- [!] Duplicate render/physics loops
  - Mitigation: Single accumulator orchestrator; disable legacy RAF if present.
- [!] Reconciliation overhead for large scenes
  - Mitigation: Keep heavy-object creation outside React; reuse Three objects; use keys and memoization.
- [!] State ownership confusion
  - Mitigation: Document “React is view-only” in TASKS.md; enforce via lint rule patterns and code review.

Collision Layers & Groups (to define)
- [x] Define bitmasks:
  - PLAYER, ENEMY, ENV, CAMERA_BLOCKER, BULLET
- [x] Apply in ColliderComponent and raycast filters.
- [*] Process: Before implementing layers/masks, run a planning step with the gamethinking MCP tool to define interaction rules (who collides with whom), then codify them here and implement in code.

Risks & Mitigations
- [!] Rapier WASM init timing
  - Mitigation: physics.init() awaited before use; gate body creation until ready.
- [!] Duplicate Rapier worlds (if @react-three/rapier is used)
  - Mitigation: single ECS-managed world; avoid provider or inject existing world.
- [!] React StrictMode double effects (if R3F used)
  - Mitigation: keep physics outside React lifecycle; only call step from useFrame.
- [!] Kinematic controller behavior difference vs Cannon
  - Mitigation: prefer kinematicVelocityBased; lock rotations; snap-to-ground via short cast.
- [!] Nondeterminism without fixed-step
  - Mitigation: accumulator; optional interpolation.

Session Log

2025-08-05
- Plan authored and checklist created.
- Phase 1 completed this session across Components, Physics, Movement, Camera, Combat, Main loop, and Render write-only behavior.
- Session logs (this session):
  - 10:22: Centralized collision layers and helpers in ["src/core/CollisionLayers.ts"](src/core/CollisionLayers.ts:1); applied to colliders and raycast filters.
  - 10:35: Camera occlusion migrated to PhysicsSystem.raycast with CAMERA_BLOCKER filter in ["src/systems/CameraSystem.ts"](src/systems/CameraSystem.ts:1); injected physics via setPhysicsSystem and wired in ["src/main.ts"](src/main.ts:1).
  - 10:58: Combat hitscan migrated to PhysicsSystem.raycast with BULLET vs ENEMY|ENV in ["src/systems/CombatSystem.ts"](src/systems/CombatSystem.ts:1); spread/falloff implemented; transient hit markers added.
  - 11:20: Terrain entity created and bound to heightfield body; physics resolves heightfield hits to ECS entity via setTerrainEntity in ["src/systems/PhysicsSystem.ts"](src/systems/PhysicsSystem.ts:1) and wired from ["src/main.ts"](src/main.ts:1).
  - 11:42: Movement grounded checks using multi-probe raycasts against ENV; coyote time, snap-to-ground, yaw alignment in ["src/systems/MovementSystem.ts"](src/systems/MovementSystem.ts:1).
  - 12:05: Movement dynamic intents integrated: kinematic uses setVelocity; dynamic uses applyImpulse; temp vectors consolidated.
  - 12:12: PhysicsSystem convenience APIs added: getBody(), getTerrainEntity(), setCollisionLayers().
- Next: Phase 2 planning
- R3F Integration tasks authored under “Phase 2 — R3F Integration”.
- Interpolation remains optional and will be evaluated during P2 without affecting authoritative simulation.
- Update: Phase 2 scope expanded to include postprocessing via @react-three/postprocessing with the core "postprocessing" library, and explicit “one-world” enforcement (single authoritative Rapier world managed by ECS/PhysicsSystem; React must not create another world/provider). Render scheduling requires exactly one accumulator/loop; disable legacy RAF when fully migrated to R3F, otherwise remove legacy in the same change set after parity.

2025-08-06
- Added PostFX toggleable FXAA chain using @react-three/postprocessing in ["src/react/PostFX.tsx"](src/react/PostFX.tsx:1) and wired in ["src/react/App.tsx"](src/react/App.tsx:1); effects off by default via ENABLE_POSTFX=false.
- Phase 2 — R3F Integration:
  - Introduced ECS→R3F view-only bindings in ["src/react/ecs-bindings.ts"](src/react/ecs-bindings.ts:1): useEcsTransform() and <BindTransform /> with stable scratch objects.
  - Provided EntityManager to React via context from ["src/react/GameOrchestrator.tsx"](src/react/GameOrchestrator.tsx:1); preserved one-world/one-loop.
  - Synced R3F default camera via existing CameraSystem that operates on the same camera instance (no extra cameras, no allocations).
  - Added minimal demo follower box bound to player in ["src/react/App.tsx"](src/react/App.tsx:1).

Notes
- Keep ECS authoritative; rendering remains write-only.
- Avoid per-frame allocations in systems; hoist temps.
- Heightfield collider flows through ECS component, not via RenderSystem->Physics coupling.
- Critical engineering policy: eliminate all unused values, variables, imports, and types; resolve TS/ESLint warnings immediately so the project stays fully functional. Placeholders are forbidden unless fully wired and functional in the same change.
- Best-practice guardrail: follow the established patterns already adopted in this codebase (naming, controller split, input → intent → physics, deterministic order). Do not remove these items; if deprecating, mark clearly and provide an approved replacement first.
- [HY] PR acceptance criteria: no unused symbols, no “TODO: wire later” stubs left in code, no TS errors, and zero lint warnings. If Unreal patterns exist (naming/components/tick), they must be honored and not stripped.

---

MCP Tools — Blender Pipeline (3D Assets, Textures, Materials)

[*] Purpose
Define and enforce a standardized MCP-based content pipeline using the connected Blender MCP server and related asset sources. This section is a planning/spec reference; do not implement new tools without a prior planning step logged here.

BP-1 Tools Inventory (exact names and params as implemented)

- blender.get_scene_info() — Get detailed information about the current Blender scene.
  Parameters: none.

- blender.get_object_info(object_name) — Get detailed information about a specific object in the Blender scene.
  Parameters:
  - object_name: string (required)

- blender.get_viewport_screenshot(max_size) — Capture a screenshot of the current Blender 3D viewport.
  Parameters:
  - max_size: integer (optional; default 800). Returns an Image.

- blender.execute_blender_code(code) — Execute arbitrary Python code in Blender (use step-by-step micro-scripts).
  Parameters:
  - code: string (required)

- blender.get_polyhaven_categories(asset_type) — Get a list of categories for a specific asset type on Polyhaven.
  Parameters:
  - asset_type: string (hdris | textures | models | all)

- blender.search_polyhaven_assets(asset_type, categories) — Search for assets on Polyhaven with optional filtering.
  Parameters:
  - asset_type: string (hdris | textures | models | all)
  - categories: string (optional; comma-separated)

- blender.download_polyhaven_asset(asset_id, asset_type, resolution, file_format) — Download and import a Polyhaven asset into Blender.
  Parameters:
  - asset_id: string (required)
  - asset_type: string (required; hdris | textures | models)
  - resolution: string (optional; e.g., 1k, 2k, 4k)
  - file_format: string (optional; hdr/exr for HDRIs; jpg/png for textures; gltf/fbx for models)

- blender.set_texture(object_name, texture_id) — Apply a previously downloaded Polyhaven texture to an object.
  Parameters:
  - object_name: string (required)
  - texture_id: string (required)

- blender.get_polyhaven_status() — Check if PolyHaven integration is enabled in Blender.
  Parameters: none.

- blender.get_hyper3d_status() — Check if Hyper3D Rodin integration is enabled in Blender.
  Parameters: none. Note: silently remember the key type.

- blender.get_sketchfab_status() — Check if Sketchfab features are available.
  Parameters: none.

- blender.search_sketchfab_models(query, categories, count, downloadable) — Search for models on Sketchfab.
  Parameters:
  - query: string (required)
  - categories: string (optional; comma-separated)
  - count: integer (optional; default 20)
  - downloadable: boolean (optional; default true)

- blender.download_sketchfab_model(uid) — Download and import a Sketchfab model by its UID.
  Parameters:
  - uid: string (required)

- blender.generate_hyper3d_model_via_text(text_prompt, bbox_condition) — Generate a 3D asset via Hyper3D (text).
  Parameters:
  - text_prompt: string (required; English)
  - bbox_condition: array of floats length 3 (optional; [Length, Width, Height] ratio)

- blender.generate_hyper3d_model_via_images(input_image_paths, input_image_urls, bbox_condition) — Generate a 3D asset via images.
  Parameters:
  - input_image_paths: array of absolute paths (optional; required in MAIN_SITE mode)
  - input_image_urls: array of URLs (optional; required in FAL_AI mode)
  - bbox_condition: array of numbers length 3 (optional)
  Only one of input_image_paths or input_image_urls must be provided based on current mode.

- blender.poll_rodin_job_status(subscription_key, request_id) — Poll Hyper3D job completion.
  Parameters:
  - subscription_key: string (MAIN_SITE mode)
  - request_id: string (FAL_AI mode)
  Behavior:
  - MAIN_SITE: returns list of statuses; done when all are "Done"; "Failed" indicates failure.
  - FAL_AI: returns task status; done when "COMPLETED"; "IN_PROGRESS" indicates running.

- blender.import_generated_asset(name, task_uuid, request_id) — Import the asset generated by Hyper3D.
  Parameters:
  - name: string (required; scene object name)
  - task_uuid: string (MAIN_SITE mode; optional)
  - request_id: string (FAL_AI mode; optional)
  Supply exactly one of task_uuid or request_id based on the current Hyper3D mode.

BP-2 Content Pipeline (High Level)
1) Concept → Proxy
   - Use simple proxies (boxes/capsules) sized for gameplay first; author colliders in ECS.
   - Artifacts: viewport screenshot, notes.
2) Source Acquisition
   - Use PolyHaven for HDRIs/textures/models and Sketchfab for downloadable models.
   - Prefer CC0 content; record license metadata alongside assets.
3) Hyper3D Generation (when custom)
   - For unique props/weapons/characters, generate via Hyper3D text prompt; specify bbox_condition for normalized dimensions.
   - Poll status and import once complete; rescale as needed.
4) Material/UV Pass
   - Verify UVs with blender.get_object_info(); re-unwrap if needed; apply PBR textures.
5) Optimization
   - Apply decimate/LOD; triangulate if necessary; ensure consistent normals; pack textures.
6) Export → Game
   - Export GLB/GLTF with embedded textures; maintain Y-up, meters units; pivot at base.
   - Maintain a manifest.json per asset with: units, scale, LODs, collider hint, license, source.

BP-3 Automation Patterns
- Execute blender.execute_blender_code() in small, reviewable chunks; log each chunk and the outcome.
- Store downloaded assets and generated models in versioned folders: assets/{models,textures,hdris}/source|processed.
- After import/generation, call blender.get_object_info() and snapshot materials/UVs into the manifest.
- For textures, prefer 1k by default; allow 2k or 4k for hero assets; ensure power-of-two dimensions.

Policy & Hygiene (Content)
- [HY] No orphan assets: every asset must have a manifest and be referenced by the game or a pending task with owner/date.
- [HY] License metadata must be captured (SPDX or URL) before merging assets.
- [BP] Consistent pivots/origin at base; scale applied (1,1,1); transforms baked before export.
- [BP] Texture naming: {asset}_{map}_{res}.png (e.g., crate_albedo_2k.png).
- [*] All Blender/asset operations must be planned with a short note (who/what/why) in the Session Log.

MCP Tools — Auxiliary (Web, NPM, Codacy)
- fetch.fetch(url) — Internet retrieval for docs/specs (e.g., Rapier/Three/GLTF).
- tavily.tavily-search — Real-time search for references/news (when needed).
- npm-sentinel — Check NPM versions/vulns/size before adding deps (avoid bloat).
- codacy_cli_analyze — On-demand local quality pass (do not replace PR gates).
- context7 — Live docs for libraries (routing/hooks specifics when integrating R3F).

Blender MCP Usage Playbooks (Examples)
- Texture an imported model:
  1) blender.search_polyhaven_assets(asset_type="textures", categories="avatar") → pick texture_id
  2) blender.download_polyhaven_asset(asset_id=..., asset_type="textures", resolution="1k")
  3) blender.set_texture(object_name="Crate_A", texture_id=...)
  4) blender.get_viewport_screenshot() → attach to PR
- Generate a hero prop via Hyper3D:
  1) blender.generate_hyper3d_model_via_text("sci‑fi crate with beveled edges, PBR-ready", bbox_condition=[1.0,1.0,1.0])
  2) blender.poll_rodin_job_status(...) until Done/COMPLETED
  3) blender.import_generated_asset(name="Crate_Hero", task_uuid|request_id)
  4) blender.get_object_info("Crate_Hero") → verify materials/UVs; create manifest

Future Tracks (Art)
- [ ] Establish asset folder structure and manifest schema.
- [ ] Add automated preview renders via blender.get_viewport_screenshot() for PR checks.
- [ ] Define LOD budgets and per-platform texture caps (desktop/mobile).
- [ ] Author “collision hint” convention in manifest for ECS collider generation (cuboid/capsule/convex hull).

