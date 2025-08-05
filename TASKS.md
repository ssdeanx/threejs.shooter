# ThreeJS Shooter — Rapier + React Refactor Plan

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
- [HY] Enforcement: any introduced symbol (value, variable, import, type alias/interface, function/method) must be used and wired end-to-end in the same PR. If a symbol cannot be fully implemented, do not attempt the change. No partials. No leaving unused. No removals of required constructs. Violations result in a ban.

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

Movement
- [ ] src/systems/MovementSystem.ts
  - [~] Replace setVelocity semantics:
    - KinematicVelocity: physics.setVelocity(...) wired; further tuning pending
    - Dynamic: physics.applyImpulse(...) available; integrate intents next
  - [ ] Ground check via short downward raycast; cache grounded flag.
  - [ ] Reuse temp vectors (no per-frame allocations).

Camera
- [ ] src/systems/CameraSystem.ts
  - [ ] Replace Three.Raycaster with physics.raycast for player→camera collision.
  - [ ] Keep smoothing; support collision layers for camera blockers.
  - [ ] Maintain addCollidable API as a higher-level tagging mechanism internally mapped to layers.

Combat
- [ ] src/systems/CombatSystem.ts
  - [ ] Replace Three.raycaster with physics.raycast using weapon range.
  - [ ] Use colliderHandle → entityId map to resolve hits.
  - [ ] Compute hit point via origin + dir * toi.

Render
- [ ] src/systems/RenderSystem.ts
  - [ ] Remove direct physics coupling (terrain).
  - [ ] When generating visual terrain, create an ECS Terrain entity with ColliderComponent { type: 'heightfield' } for PhysicsSystem consumption.
  - [ ] Keep write-only transform updates.

Main loop
- [x] src/main.ts
  - [x] Introduce fixed-step accumulator and canonical order.
  - [x] Await physicsSystem.init() before starting animate.
  - [ ] Consider interpolation for visuals (optional).

Unchanged or Low Priority
- [ ] src/systems/SoldierSystem.ts, src/systems/ScoringSystem.ts, src/systems/index.ts
- [ ] src/components/TransformComponents.ts, RenderingComponents.ts, GameplayComponents.ts

R3F Integration (Phase 2, Optional)
- [ ] Move the loop to R3F’s useFrame using the same accumulator.
- [ ] Keep ECS + Rapier world outside React; no duplicate provider worlds.
- [ ] Bind meshes to ECS transforms; React components remain view-only.

Collision Layers & Groups (to define)
- [ ] Define bitmasks:
  - PLAYER, ENEMY, ENV, CAMERA_BLOCKER, BULLET
- [ ] Apply in ColliderComponent and raycast filters.
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
- P0 completed this session:
  - Updated src/components/PhysicsComponents.ts to Rapier schemas.
  - Replaced Cannon with Rapier in src/systems/PhysicsSystem.ts; added world init, maps, body/collider creation, setVelocity/applyImpulse, raycast; fixed TS/ESLint; preserved colliders set.
  - Introduced fixed-step accumulator in src/main.ts; added perfNow fallback; awaited physics.init() with heightfield passthrough.
- Session logs (this session):
  - 08:54: main loop updated with fixed-step accumulator and perfNow wrapper in ["src/main.ts"](src/main.ts:1)
  - 08:55: Rapier PhysicsSystem stabilized with init, setVelocity/applyImpulse, raycast, maps, and colliders Set in ["src/systems/PhysicsSystem.ts"](src/systems/PhysicsSystem.ts:1)
  - 08:56: TASKS.md checklist updated to reflect P0 completion and add P1 items including PhysicsSystem TODOs
  - 08:58: Policy updated: enforce zero-unused (values/variables/imports/types) and zero lint warnings. Added requirement to use gamethinking MCP tool prior to code changes and to record outcomes here.
  - 08:59: Added Best‑Practice directives; marked as non-removable without explicit approval.
  - 09:00: Clarified [HY] rules: all values/variables/imports/types/functions must be fully implemented and used in the same change; no stubs, no removals of required constructs, no unused symbols. Non-compliance results in a ban.
- Next actionable items (P1):
  - Wire MovementSystem intents fully: dynamic bodies → applyImpulse; grounded checks via physics.raycast; temp vector reuse.
  - Migrate CameraSystem and CombatSystem to physics.raycast; define collision layers, apply to colliders and filters.
  - Consider Terrain via ECS heightfield ColliderComponent to decouple RenderSystem.
  - PhysicsSystem TODOs to track in code at (@/src/systems/PhysicsSystem.ts):
    - Finalize collider groups/layers mapping and expose a typed filter in physics.raycast().
    - Define and enforce collision masks for PLAYER, ENEMY, ENV, CAMERA_BLOCKER, BULLET.
    - Ensure colliders Set is leveraged for lifecycle and layer updates.

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
- For textures, prefer 2k by default; allow 4k for hero assets; ensure power-of-two dimensions.

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
  1) blender.search_polyhaven_assets(asset_type="textures", categories="wood") → pick texture_id
  2) blender.download_polyhaven_asset(asset_id=..., asset_type="textures", resolution="2k")
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
