---
trigger: model_decision
description: This is for using Blender tool to help user create full pipeline & use them in the game.  These tools allow you to use users live blender application.
---

# 02_models-textures.md — MCP Blender Tools (authoritative, copy-safe)

Authoritative list of the 17 Blender/MCP asset tools and how to use them for this repo. Scene ops first (inspect/edit/validate/document), then acquisition (PolyHaven, Sketchfab), then generation (Hyper3D).

Repo layout (authoritative)
- Models → assets/models/{characters,weapons,targets}/
- Textures → assets/textures/{camo,soldier,targets,wapons}/  ← use these exact names
- Static (verbatim) → public/  ← never place runtime models/textures here

Global conventions
- Runtime models: .glb (binary glTF). .fbx/.blend are sources only (not shipped).
- Units/axes: meters (scale=1.0 at export), Y-up; OpenGL normal maps (−Y).
- PBR channels: BaseColor/Emissive (sRGB). Normal/Metallic/Roughness/AO (Linear/Non-Color).
- Filenames: lower-kebab-case; version when UV/scale/origin changes: asset-name_vNN.glb.
- On load: set castShadow/receiveShadow intentionally. Always dispose GPU resources on removal.

----------------------------------------------------------------
Blender Scene Ops (inspect → edit → validate → document)

1) mcp0_get_scene_info
- Purpose: Summarize current Blender scene (objects, materials, collections).
- When: Before export; after batch edits; PR baseline metrics.
- Output: Scene counts/metadata for quick validation.
- Example: { "tool": "mcp0_get_scene_info" }

2) mcp0_get_object_info
- Purpose: Inspect a specific object (scale, rotation, origin/pivot, tri counts, materials).
- When: Enforce scale=1.0, Y-up upright, feet-center pivot (characters/targets), grip pivot (weapons).
- Params: object_name
- Output: Detailed object report.
- Example: { "tool": "mcp0_get_object_info", "object_name": "Soldier_Root" }

3) mcp0_execute_blender_code
- Purpose: Run Blender Python (idempotent; small steps).
- When: Batch rename materials, enforce suffixes, apply transforms, fix color spaces, merge materials.
- Params: code (Python)
- Output: Execution log/result.
- Example: { "tool": "mcp0_execute_blender_code", "code": "import bpy\nfor m in bpy.data.materials:\n    if not m.name.startswith('mat_'):\n        m.name = 'mat_' + m.name" }

4) mcp0_get_viewport_screenshot
- Purpose: Capture Blender viewport for PRs/reviews/changelog.
- Params: max_size (optional; default 800)
- Output: Image.
- Example: { "tool": "mcp0_get_viewport_screenshot", "max_size": 1200 }

5) mcp0_set_texture
- Purpose: Apply a previously downloaded PolyHaven texture to an object/material.
- Params: object_name, texture_id (from PolyHaven search/download)
- Output: Material update confirmation.
- Color spaces: BaseColor/Emissive = sRGB; Normal/Metallic/Roughness/AO = Non-Color.
- Example: { "tool": "mcp0_set_texture", "object_name": "Soldier_Body", "texture_id": "fabric_ripstop_b_2k" }

----------------------------------------------------------------
PolyHaven (status → categories → search → download)

6) mcp0_get_polyhaven_status
- Purpose: Check PolyHaven integration availability; gate all PolyHaven actions.
- Output: Available / Not available.
- Example: { "tool": "mcp0_get_polyhaven_status" }

7) mcp0_get_polyhaven_categories
- Purpose: List categories for hdris/textures/models.
- Params: asset_type? ("hdris" | "textures" | "models" | "all"; default "hdris")
- Output: Category names.
- Example: { "tool": "mcp0_get_polyhaven_categories", "asset_type": "textures" }

8) mcp0_search_polyhaven_assets
- Purpose: Find HDRIs/textures/models; optional category filter.
- Params: asset_type? (default "all"), categories? (comma-separated)
- Output: Asset list with IDs.
- Example: { "tool": "mcp0_search_polyhaven_assets", "asset_type": "textures", "categories": "fabric,leather" }

9) mcp0_download_polyhaven_asset
- Purpose: Download a PolyHaven asset at chosen resolution/format.
- Params: asset_id, asset_type ("hdris"|"textures"|"models"), resolution? ("1k"|"2k"|"4k"), file_format? ("png","jpg","exr","hdr"...)
- Placement after download:
  - Textures → assets/textures/<domain>/... with suffixes: _basecolor (sRGB), _normal (Linear −Y), _metallic (Linear), _roughness (Linear), _ao (Linear), _emissive (sRGB)
  - HDRIs → assets/textures/hdris/
  - Models → assets/models/<group>/
- Example: { "tool": "mcp0_download_polyhaven_asset", "asset_id": "fabric_ripstop_b", "asset_type": "textures", "resolution": "2k", "file_format": "png" }

----------------------------------------------------------------
Sketchfab (status → search → download)

10) mcp0_get_sketchfab_status
- Purpose: Check Sketchfab integration availability.
- Example: { "tool": "mcp0_get_sketchfab_status" }

11) mcp0_search_sketchfab_models
- Purpose: Search downloadable models for targets/props/etc.
- Params: query, categories?, count? (default 20), downloadable? (default true; keep true)
- Output: Results with UIDs.
- Example: { "tool": "mcp0_search_sketchfab_models", "query": "steel target silhouette", "count": 10, "downloadable": true }

12) mcp0_download_sketchfab_model
- Purpose: Download a model by UID (must be downloadable).
- Post: Clean in Blender (retopo/UV/bake), set pivots, export .glb (no embedded textures).
- Place → assets/models/{characters|weapons|targets}/
- Example: { "tool": "mcp0_download_sketchfab_model", "uid": "9a1b2c3d4e5f" }

----------------------------------------------------------------
Hyper3D Rodin (status → generate → poll → import)

13) mcp0_get_hyper3d_status
- Purpose: Check if Hyper3D is available.
- Example: { "tool": "mcp0_get_hyper3d_status" }

14) mcp0_generate_hyper3d_model_via_text
- Purpose: Generate a 3D asset from a short English prompt.
- Params: text_prompt, bbox_condition? [L,W,H] (relative shape)
- Output: Generation task identifier.
- Example: { "tool": "mcp0_generate_hyper3d_model_via_text", "text_prompt": "low-profile steel target on stand, game-ready, 1m tall", "bbox_condition": [1.0, 0.2, 1.0] }

15) mcp0_generate_hyper3d_model_via_images
- Purpose: Generate from reference images (URLs or local paths; use exactly one).
- Params: input_image_urls? or input_image_paths?, bbox_condition?
- Output: Task/request identifier.
- Example: { "tool": "mcp0_generate_hyper3d_model_via_images", "input_image_urls": ["https://example.com/ref1.jpg","https://example.com/ref2.jpg"], "bbox_condition": [1.2, 0.3, 1.0] }

16) mcp0_poll_rodin_job_status
- Purpose: Poll until generation completes (COMPLETED/Done) or fails.
- Params: request_id? (FAL_AI mode) or subscription_key? (MAIN_SITE mode)
- Output: Status; continue only when complete.
- Example: { "tool": "mcp0_poll_rodin_job_status", "request_id": "REQ-1234" }

17) mcp0_import_generated_asset
- Purpose: Import completed Hyper3D asset into Blender.
- Params: name, and either task_uuid or request_id (mode-specific)
- Post: Cleanup in Blender, retopo/UVs, bake; export .glb → assets/models/<group>/
- Example: { "tool": "mcp0_import_generated_asset", "name": "target_blockout", "request_id": "REQ-1234" }

----------------------------------------------------------------
Recommended Mini-Workflows (copy/paste)

A) Validate a candidate before export
- mcp0_get_scene_info → mcp0_get_object_info (key meshes) → mcp0_execute_blender_code (apply transforms; naming) → mcp0_get_object_info (verify scale=1.0, pivot OK) → mcp0_get_viewport_screenshot (attach to blender.md)

B) Acquire PBR textures from PolyHaven
- mcp0_get_polyhaven_status → mcp0_get_polyhaven_categories (textures) → mcp0_search_polyhaven_assets → mcp0_download_polyhaven_asset (2k–4k for hero, 1k for props)
- Place under assets/textures/<domain>/... with suffixes; verify color spaces.

C) Acquire a model from Sketchfab
- mcp0_get_sketchfab_status → mcp0_search_sketchfab_models (downloadable=true) → mcp0_download_sketchfab_model
- In Blender: clean, retopo/UV, bake; set pivots; scale=1.0; export .glb → assets/models/<group>/...

D) Generate a quick blockout via Hyper3D
- mcp0_get_hyper3d_status → mcp0_generate_hyper3d_model_via_text (or via_images) → mcp0_poll_rodin_job_status → mcp0_import_generated_asset
- Then same Blender cleanup/export steps as above.

----------------------------------------------------------------

## Notes & Log (living section, real entries only)

Purpose
- Capture practical findings, pitfalls, and decisions while using Blender/MCP tools.
- Keep entries short, factual, and tied to concrete artifacts under [assets/](cci:7://file:///home/sam/threejs.shooter/assets:0:0-0:0).
- No illustrative or fake examples. Only record real operations.

How to use
- Append a new entry per operation (download, generate, import, export, cleanup).
- Include exact tool names and params. Link any screenshots captured via `mcp0_get_viewport_screenshot`.
- When pivots/scale/UVs/materials change, bump the asset version (`_vNN`) and record the reason.

Entry template (copy/paste and fill with real data)
- Date: YYYY-MM-DD
- Operator: <your-name>
- Tool(s): mcp0_<tool-name>[, ...]
- Purpose: <short description>
- Inputs:
  - params: { ...exact parameters used... }
  - refs: <asset_id/uid/request_id/paths as applicable>
- Actions:
  - <bullet 1>
  - <bullet 2>
- Outputs:
  - files: `assets/models/...`, `assets/textures/...`
  - versions: `asset-name_vNN.glb`
  - screenshots: `docs/images/<slug>-YYYYMMDD.png`
- Validation:
  - scale=1.0, Y-up, pivot correct
  - textures color spaces correct; normal map OpenGL (−Y)
  - materials within target count
- Issues:
  - <error messages or unexpected behavior>
- Decisions:
  - <what we chose and why>
- Follow-ups:
  - <next steps/owner>

Maintenance
- Keep this section high-signal. If it grows beyond ~200 lines, move older entries to [blender.md](cci:7://file:///home/sam/threejs.shooter/blender.md:0:0-0:0) and keep the latest 10 here.
Export & Runtime Integration Checklist (static; no external commands)
- [.glb] scale=1.0; Y-up; single logical root; feet-center/grip pivot correct.
- [Textures] BaseColor/Emissive sRGB; Normal/Metallic/Roughness/AO Non-Color; OpenGL normal (−Y); suffixes consistent; within budgets.
- [Placement] All runtime under assets/...; nothing runtime in public/.
- [Runtime] RenderSystem disposes geometry/materials/textures on removal; no per-frame re-creation.
- [Naming] lower-kebab-case; version .glb when UV/scale/origin changes (_vNN).