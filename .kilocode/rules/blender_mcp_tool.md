# Blender MCP Tool — Content Pipeline Rules

These rules standardize how we use the Blender MCP server and auxiliary MCP tools to create textures, models, materials, and HDRIs for this project. Adhere strictly to ensure assets are performant, reproducible, and compliant with repository hygiene.

Scope:
- Applies to all 3D assets (models, rigs, animations), textures (PBR maps), HDRIs, and generated content (Hyper3D).
- MCP tools must be used in atomic, reviewable steps. Avoid multi-step opaque scripts.

## Golden Rules

1) Plan first
- Before running any MCP tool, write a one-line session note (who/what/why) in the Session Log.
- Choose the minimal set of tools to achieve the outcome; prefer smaller verifiable steps.
- MCP tools in this document are only to be invoked when you explicitly ask to use them; tool names in examples match the real tool IDs you have access to.

2) Provenance and manifests
- Every asset must have a manifest.json with: units, scale, LODs, collider hint, license (SPDX or URL), source, processing steps, and export settings.
- No orphan assets: if not referenced by runtime or a tracked task with owner/date, remove or move under a clearly labeled WIP.

3) Formats and locations
- Models: GLB preferred; place under assets/models/{family}/...
- Textures: power-of-two PNG/WebP under assets/textures/{family}/...
- HDRIs: under assets/textures/hdris/ with resolution suffix (1k/2k/4k).

4) Runtime compatibility
- +Y Up, meters, reasonable scale. Pivots at base. Baked transforms.
- Export glTF PBR materials (BaseColor, MetallicRoughness, Normal, AO, Emissive as needed).

## Allowed MCP Tools (exact interfaces) — used only when you explicitly ask to use these tools

Blender session:
- get_scene_info() // Returns scene metadata: unit scale (meters), up-axis, object counts, collections. Use to verify +Y up, meters, and a clean scene before export.
- get_object_info(object_name) // Returns an object's transforms, hierarchy, materials, and modifiers. Use to confirm pivot at base, baked transforms, naming, and rig parts.
- get_viewport_screenshot(max_size = 800) // Captures the active 3D viewport. Use at checkpoints (blockout, sculpt, texture, final) and attach to PR.
- execute_blender_code(code) // Executes small, reviewable Python micro-scripts. Use for: creating primitives, applying transforms, UV ops, baking setup, LOD decimates. Log intent and result.

PolyHaven:
- get_polyhaven_categories(asset_type) // Lists available categories for the chosen asset type (hdris, textures, models). Use to narrow searches to relevant materials.
- search_polyhaven_assets(asset_type, categories?) // Searches PolyHaven. Provide categories for better matches (e.g., "metal", "wood"). Returns IDs for download.
- download_polyhaven_asset(asset_id, asset_type, resolution?, file_format?) // Downloads the asset into Blender. Prefer 1k by default; 2k/4k for hero assets.

Textures:
- set_texture(object_name, texture_id) // Applies a previously downloaded PolyHaven texture set to the object’s material. Ensure power-of-two textures, proper channel wiring.

Status:
- get_polyhaven_status() // Checks if PolyHaven integration is available.
- get_hyper3d_status() // Checks Hyper3D availability and mode. Silently remember mode for subsequent steps.
- get_sketchfab_status() // Checks if Sketchfab integration is available.

Sketchfab:
- search_sketchfab_models(query, categories?, count = 20, downloadable = true) // Finds downloadable models. Use as base meshes for kitbashing or blockout shortcuts.
- download_sketchfab_model(uid) // Imports a Sketchfab model. Normalize transforms, scale, and pivots immediately after import.

Hyper3D:
- generate_hyper3d_model_via_text(text_prompt, bbox_condition?) // Generates a base model from text; optional [L,W,H] ratio bounding box. Use for fast ideation.
- generate_hyper3d_model_via_images(input_image_paths? | input_image_urls?, bbox_condition?) // Generates a model from images. Provide paths or URLs depending on mode.
- poll_rodin_job_status(subscription_key? | request_id?) // Polls generation status. Proceed only when completed or failed; handle failures explicitly.
- import_generated_asset(name, task_uuid? | request_id?) // Imports the completed Hyper3D model into Blender for refinement.

Auxiliary (permitted):
- fetch.fetch(url) // Fetch web content for references/specs. Keep sources for manifest provenance.
- tavily.tavily-search // General-purpose web search for documentation or references.
- npm-sentinel-* (versions, vulns, size) // NPM package checks when adding pipelines/scripts around assets (tooling hygiene).
- codacy_cli_analyze // Run local code quality checks for pipeline scripts.
- context7 (live documentation) // Pull up-to-date docs for libraries used in asset tooling.

Design Aides (optional):
- gamethinking.gamedesignthinking(...) // Structure core mechanic ideas, break down implementation into components, and branch parallel systems (physics/rendering/controls). Use for planning only; do not substitute asset provenance or QA steps.
- clear-thought.visualreasoning(...) // Create quick diagrams/flowcharts of pipelines, scene graphs, or LOD strategies. Use to align on approach before executing Blender steps. Keep outputs as references, not as assets.

## Standard Pipelines (aligned with blender.md)

A) Texture an imported model
1. blender.search_polyhaven_assets(asset_type="textures", categories?)
2. blender.download_polyhaven_asset(asset_id, asset_type="textures", resolution="1k")
3. blender.set_texture(object_name, texture_id)
4. blender.get_viewport_screenshot() → attach to PR
5. Update manifest.json with texture list, resolution, licensing

B) Generate a hero prop (Hyper3D)
1. blender.generate_hyper3d_model_via_text(text_prompt, bbox_condition=[L,W,H])
2. blender.poll_rodin_job_status(...) until completed
3. blender.import_generated_asset(name="HeroProp_X", task_uuid|request_id)
4. blender.get_object_info("HeroProp_X") → verify UVs/materials; record dimensions
5. Optimize (decimate/LOD if needed), export GLB, create manifest

C) Source model from Sketchfab
1. blender.search_sketchfab_models(query, categories?, downloadable=true)
2. blender.download_sketchfab_model(uid)
3. Normalize scale/pivot/transforms; verify materials
4. Export GLB; add manifest with license metadata (URL or SPDX)

## Quality and Performance

- Prefer 1k textures by default; 2k/4k for hero assets only; always power-of-two.
- Keep polygon counts appropriate; add LODs where beneficial. Triangulate if runtime consistency gains.
- Reuse trimsheets for repeated families; minimize material slots to cut draw calls.

## Export Policy (GLB)

- Apply transforms (location/rotation/scale) before export.
- +Y Up, meters; pivot at base.
- Export selected objects (recommended). Exclude cameras/lights unless intentionally required.
- Export PBR materials; include tangents if normal maps are used.
- Remove unused nodes/materials/animations.

## Validation (Mandatory before commit)

- GLB loads with GLTFLoader and in the R3F scene.
- Materials resolve; textures are power-of-two and under correct folders.
- Manifest.json present with complete metadata and licensing.
- Viewport screenshot attached to PR when visuals changed.

## Failure Modes to Avoid

- Opaque multi-step “do everything” scripts — always break into micro-steps.
- Missing license metadata or unclear provenance.
- Assets without manifests or not referenced anywhere.
- Excessive texture resolutions or redundant material slots.
- Non-standard pivots/orientation/scales.

## Consistency With blender.md

- This rule complements blender.md. If blender.md changes tool interfaces or workflow details, update this rule in the same PR to remain in lockstep.
