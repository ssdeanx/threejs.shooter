---
description: Actionable Blender 5 + MCP workflows for professional, web-ready assets (2025)
title: Blender Workflows
version: v0.4
last_updated: 2025-08-09T04:30:30-04:00
---
This is a practical, step-by-step library. Use alongside `blender_prompts.md` and the general guide in `blender.md`.

## Conventions

- Units: meters; +Y up; pivot at base center.
- PBR: BaseColor (sRGB), Normal (Non-Color, Tangent space), ORM (linear).
- Exports: GLB with tangents; KTX2 textures; Draco/Meshopt as appropriate.
- MCP tool names reflect the Blender MCP server functions (see `blender.md`).

---

## Workflow 0 — From‑Scratch Pipeline (Scene Bootstrap)

1. Initialize Scene

- Units → meters; scale = 1.0; enable glTF 2.0 exporter (with tangents)
- Remove default camera/light unless needed; neutral world background
- Add neutral HDRI (4–8k) for PBR checks; avoid strong color casts
- Collections: `00_ref`, `10_blockout`, `20_high`, `30_low`, `40_bake`, `50_export`

1. Reference & Blockout

- Place refs in `00_ref`; block primary forms in `10_blockout` (real dimensions)

1. High → Low → UV

- Author high in `20_high`; derive clean low in `30_low`; unwrap single UV set (even texel density)

1. Bake

- Bake Normal (tangent), AO (optional), and pack ORM (R=Occlusion, G=Roughness, B=Metallic)

1. Materials

- Single PBR material: BaseColor (sRGB), Normal (Non-Color), ORM (linear)

1. LODs

- LOD1 ≈ 50% tris; LOD2 ≈ 25%; preserve UVs and materials

1. Pivot/Transforms

- Pivot at base center (or mounting point); Apply L/R/S; +Y up for export

1. Export

- GLB selected only, include tangents; exclude cameras/lights; name as `[family]/[asset]_[lod].glb`

1. Compression

- KTX2: ETC1S for BaseColor/ORM; UASTC for Normals

1. QA & Manifest

- Snapshot: `blender.get_object_info()` + viewport screenshot
- Manifest fields: units, scale, pivots, tri counts per LOD, material slots, texture formats, license/source

---

## Workflow A — PolyHaven Intake → Game (MCP)

1. Search & Download

- blender.search_polyhaven_assets(asset_type="textures|hdris|models", categories="...")
- blender.download_polyhaven_asset(asset_id, asset_type, resolution="2k|4k")
- Optional: blender.set_texture(object_name, texture_id)

2. Scene Hygiene

- blender.execute_blender_code: apply transforms (L/R/S), recalc normals outside
- Center pivot at base; units meters; +Y up

3. UV & Materials

- blender.get_object_info(object_name) → verify UV islands, material slots
- Assign PBR nodes: BaseColor (sRGB), Normal (Non-Color), ORM (linear)

4. LODs

- Generate LOD1 (50%) and LOD2 (25%) via Decimate (preserve UVs)
5. Export

- GLB export with tangents; exclude lights/cameras
- Use Draco for large static meshes

6. Texture Compression

- Precompress textures to KTX2: ETC1S (albedo/ORM), UASTC (normals)

7. QA & Manifest

- blender.get_viewport_screenshot(); get_object_info()
- Write manifest: units, pivot, LODs, license, source, tri counts

---

## Workflow B — Sketchfab Intake (Downloadable-Only)

1. Search

- blender.search_sketchfab_models(query, categories, count=20, downloadable=true)
- Note license; pick CC0/CC-BY where possible

2. Import

- blender.download_sketchfab_model(uid)
- Apply transforms; clean materials; remove cameras/lights

3. Reduce & ReUV (if needed)

- Retopo (as needed), unwrap; rebake textures to BaseColor/Normal/ORM

4. LODs, Export, KTX2, QA

- Same as Workflow A

---

## Workflow C — Hyper3D (Text/Image) → Game

1) Generate
   - blender.generate_hyper3d_model_via_text(text_prompt, bbox_condition=[L,W,H])
   - OR blender.generate_hyper3d_model_via_images(input_image_urls|input_image_paths, bbox_condition=...)
   - blender.poll_rodin_job_status(...)
2) Import
   - blender.import_generated_asset(name, task_uuid|request_id)
   - Verify scale/pivot/UVs/material slots
3) Retopo & Bake (as needed)
   - Target single UV set; even texel density; bake PBR to textures
4) Optimize & Export
   - LODs; GLB with tangents; KTX2 textures; Draco for large meshes
5) QA & Manifest
   - Screenshot + object info; document constraints met

---

## Workflow D — Procedural Families (Geometry Nodes)

1) Author a GN group with inputs:
   - size (X/Y/Z), thickness, bevel radius, hole patterns/slots
2) Evaluate outputs:
   - Single mesh; single UV; one material; non-manifold free
3) Bake & Cleanup:
   - Apply GN to mesh; mark seams; unwrap; pack UVs; assign trimsheet material
4) LODs & Export & KTX2
   - Same as above

---

## Workflow E — Export & Compression Pipeline

1) GLB Export (Blender 5)
   - Include tangents; +Y up; meters; selected objects only; no lights/cameras
2) Textures → KTX2
   - Albedo/ORM → ETC1S (quality/budget tuned)
   - Normals → UASTC (higher quality; preserve detail)
3) Mesh Optimization (Optional)
   - Meshopt (gltfpack) post-pass for quantization/mesh optim
   - Validate animations/tangents after

---

## Workflow F — QA & Validation

- Visual: viewport screenshot; color cast neutral HDRI
- Metrics: tris per LOD, materials count, texture res & formats
- PBR checks: color spaces, normal orientation, ORM packing
- Gameplay: scale, pivot, bounds, collider hints noted
- Runtime: quick Three.js load test; castShadow/receiveShadow, disposal

---

## Anti‑Patterns (Avoid)

- Multiple tiny materials; fragmented UVs; non-power-of-two textures
- Procedural shaders not baked; mixed color spaces; missing tangents
- Excessive Draco on tiny meshes; KTX2 on already tiny PNGs
- Inconsistent units/orientation; pivot off-base; non-manifold geometry

---

## Examples (abbreviated)

- PolyHaven Wooden Crate → trimsheeted prop with LODs (A)
- Sketchfab Bench → retopo + rebake, then GLB/KTX2 (B)
- Hyper3D Target → prompt + bbox_condition, import, rebake, export (C)
- GN Barriers set → parametric sizes, single material, export (D)

---

## Notes & Log

- v0.4 (2025-08-09T04:30:30-04:00):
  - Added Workflow H (Hero Asset) with Hyper3D prompts → intake → bake → export → QA.
  - Fixed Markdown lints: list indentation (MD007) and ordered numbering (MD029).
- v0.2 (2025-08-09T04:04:18-04:00): Added professional header, From‑Scratch Pipeline with scene checks, and Notes & Log.
- v0.1: Initial workflows library.
