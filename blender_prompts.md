---
description: Prompt library for Blender 5 + MCP, Hyper3D, and web-ready asset creation
title: Blender + Hyper3D Prompt Library
version: v0.4
last_updated: 2025-08-09T04:29:45-04:00
---
## Overview

Use these templates to generate professional, web‑ready assets with precise constraints. Tune variables in brackets []. Pair prompts with the workflows in `blender_workflows.md`.

## Principles

- [specificity] Subject + function + materials + dimensions + topology + constraints + output
- [physically‑grounded] Real materials with PBR ranges (roughness/metalness)
- [game‑ready] Tri budgets, single UV set, clean pivot, meters, +Y up, one material unless justified
- [negative cues] Explicitly exclude unwanted traits (decals, emissive, extreme bevels)

## From-Scratch Scene Setup (Prompt to Assistant)

```txt
Goal: Initialize a clean Blender 5 scene for game-ready asset authoring.
Tasks:
- Set units to meters; scale = 1.0; +Y up for glTF export.
- Scene hygiene: remove default camera/light unless needed; set world background neutral.
- Add neutral HDRI (4–8k) for material validation; clamp color casts.
- Create Collections: 00_ref, 10_blockout, 20_high, 30_low, 40_bake, 50_export.
- Enable glTF exporter add-on; verify export options (tangents, selected only).
- Save file as [asset_family]/[asset_name]_work.blend under assets/models/source/…
Output: confirm settings snapshot and viewport screenshot.
```

## Hyper3D (Text) — Props

```txt
Create a [steel practice target] optimized for a tactical shooter.
Function: free‑standing plate with head weakpoint; stable base; outdoor use.
Materials: PBR steel, light wear. BaseColor/Normal/ORM only. No emissive.
Dimensions: 0.5m W × 1.0m H; bbox_condition: [0.5, 0.2, 1.2].
Topology: clean quads, ≤10k tris LOD0, single UV set.
Style: realistic; neutral color; no decals.
Constraints: pivot at base center; meters; +Y up; one material slot.
Output: GLB with PBR textures (PBR preferred over shaded-only).
Negative: no text, no emissive, no holes except mounting, no micro‑bevels > 5mm.
```

## Hyper3D (Text) — Weapons (hero)

```txt
Generate an [AR‑style carbine upper] shell (no internals).
Function: cosmetic hero mesh for third‑person; attachable rails.
Materials: anodized aluminum + polymer grips; PBR (BaseColor/Normal/ORM).
Dimensions: length 0.7m; bbox_condition: [0.7, 0.1, 0.2].
Topology: clean silhouette, even quads, ≤25k tris LOD0; single UV.
Style: realistic, neutral military palette; minor edge wear only.
Constraints: pivot at rear socket; meters; +Y up; ≤2 materials.
Output: GLB with PBR textures.
Negative: no trademarks/branding, no emissive, no internal mechanisms.
```

## Hyper3D (Text) — Hero Character (final)

```txt
Generate a game-ready hero character (modern tactical soldier: plate carrier, helmet rails, gloves, boots).
Dimensions ~1.80×0.55×0.35 m; bbox_condition [1,0.30,0.19].
target_faces 90000 (LOD0). One 4k PBR set: BaseColor (sRGB), Normal (linear), ORM (linear).
Topology: manifold only, joint-friendly loops at shoulders/elbows/knees; no overlapping shells; readable bevels; no micro-noise.
Symmetry: body X-sym; allow asymmetry on gear.
Name hero_soldier_LOD0. Output glTF-ready (single material).
Negatives: no emissive, no decals baked into albedo, no text/logos, no fantasy greebles.
```

## Hyper3D (Image) — Hero Weapon (final)

```txt
Use multi-view images (front/back/left/right/3-4; constant neutral lighting; gray backdrop). First image = material reference.
Hero assault rifle (receiver+barrel+M-LOK handguard+stock+rail). Dimensions 0.86×0.06×0.22 m; bbox_condition [1,0.07,0.26].
target_faces 24000 (LOD0). One 2k PBR set: BaseColor (sRGB), Normal (linear), ORM (linear).
Constraints: preserve planar surfaces and slot proportions; avoid deep undercuts; no floating geo; clean, manifold topology.
Name hero_ar_LOD0. Output glTF-ready (single material).
Negatives: no emissive, no engraved text, no baked-in logos, no sci-fi.
```

## Hyper3D (Image) — Targets (multiview)

```txt
Use the attached 3–4 orthographic photos of a steel target. Match shape and proportions; ignore background.
Generate PBR GLB. bbox_condition: [0.6, 0.2, 1.3].
Constraints: ≤10k tris, single material, pivot at base.
Negative: no decals, no emissive, no tiny bolts.
```

## Hyper3D (Text) — Environment Prop (trim‑sheet friendly)

```txt
Create a [shipping crate] suitable for trim‑sheet texturing.
Function: stackable outdoor crate; smooth lifting edges; no interior.
Materials: painted steel; PBR (BaseColor/Normal/ORM). Single material.
Dimensions: 1.2m × 0.8m × 0.8m; bbox_condition: [1.2, 0.8, 0.8].
Topology: even quads; ≤6k tris LOD0; single UV; large continuous islands.
Constraints: pivot at base center; +Y up; meters; trim‑sheet ready edges.
Output: GLB with PBR; prefer clean, bake‑friendly normals.
Negative: no decals, no emissive, no interior, no small hardware.
```

## Blender (Procedural/Automation) — Geometry Nodes Families

```txt
Create a parametric [barrier] family with Geometry Nodes.
Inputs: length [2.0m], height [1.0m], thickness [0.1m], slot_count [3], bevel_r [2mm].
Outputs: single mesh, single UV set, 1 material. Real‑world scale in meters.
Constraints: non‑manifold free, clean shading, export‑ready GLB.
```

## Blender Python (MCP) — Cleanup/Export

```txt
Task: Prepare selected object(s) for web export.
Steps: apply transforms (L/R/S), set pivot to base, ensure +Y up, recalc normals outside, limit material slots to ≤2, assign PBR nodes (BaseColor sRGB, Normal Non‑Color, ORM), generate LOD1 (0.5x tris) & LOD2 (0.25x), export GLB with tangents; no lights/cameras.
```

## Negative Prompt Library (mix‑in)

- no text / logos / decals / emissive
- no extreme bevels (>5mm) / no micro details under 3px texel density
- no internal cavities / no rigging / no tiny mechanical parts
- no translucent / volumetric materials

## Style/Material Mix‑ins

- Steel: roughness 0.5–0.7, slight anisotropy look, edge wear subtle
- Polymer: roughness 0.6–0.8, low metalness
- Painted: base color muted; chipped edges via normal only

## QA Prompts (post‑gen checks)

```txt
Verify: meters scale, +Y up, pivot at base; ≤[budget] tris; single UV; PBR channels correct (BaseColor sRGB, Normal Non‑Color, ORM linear); no unused materials; one material slot unless specified.
```

## Scene/Environment (HDRI) Prompts

```txt
Select a neutral outdoor HDRI (4–8k) for material validation; avoid harsh color casts.
```

### MCP Prompt Snippets (tool-driven)

- Scene snapshot
  - "Grab a scene summary and a viewport shot."
  - Tools: get_scene_info(); get_viewport_screenshot(max_size: 800)

- Object inspection
  - "Show full details for object 'Soldier_Rig' and a viewport shot."
  - Tools: get_object_info(object_name: "Soldier_Rig"); get_viewport_screenshot(max_size: 800)

- PolyHaven: search → download → apply
  - "Find a 2k camo texture from PolyHaven and apply it to 'AR_Receiver'."
  - Sequence: get_polyhaven_status() → search_polyhaven_assets(textures, categories: "camo") → download_polyhaven_asset(asset_id, "textures", resolution: "2k", file_format: "png") → set_texture(object_name: "AR_Receiver", texture_id: asset_id)

- Hyper3D (text)
  - "Generate a low‑poly steel target with bracket base, 1m tall; ratio [1,0.4,1.2]; import as 'steel_target_lp'."
  - Sequence: get_hyper3d_status() → generate_hyper3d_model_via_text(text_prompt, bbox_condition: [1,0.4,1.2]) → poll_rodin_job_status(request_id) → import_generated_asset(name: "steel_target_lp", request_id)

- Hyper3D (images)
  - "From these URLs, generate a realistic AR‑15 receiver variant; ratio [1,0.3,0.5]; import as 'ar_receiver_gen'."
  - Sequence: generate_hyper3d_model_via_images(input_image_urls: [..], bbox_condition: [1,0.3,0.5]) → poll_rodin_job_status(request_id) → import_generated_asset(name: "ar_receiver_gen", request_id)

- Sketchfab: search → download
  - "Search Sketchfab for 'ballistic dummy head', downloadable only, max 5; download best UID."
  - Sequence: get_sketchfab_status() → search_sketchfab_models(query: "ballistic dummy head", downloadable: true, count: 5) → download_sketchfab_model(uid)

- Viewport checkpoint
  - "After the import, capture a 1200px viewport screenshot."
  - Tool: get_viewport_screenshot(max_size: 1200)

- Cleanup
  - "Delete temporary objects named 'temp_*' and re‑screenshot."
  - Prefer dedicated deletion tool if available; otherwise avoid unless necessary.

---

## Notes & Log

- v0.4 (2025-08-09T04:29:45-04:00):
  - Added finalized hero character (text) and hero weapon (images) prompts with strict budgets, bbox_condition, and negatives.
  - No structural changes elsewhere; lint preserved.
- v0.3 (2025-08-09T04:14:22-04:00):
  - Added MCP prompt snippets: scene/object snapshots, PolyHaven apply, Hyper3D text/images, Sketchfab intake, checkpoints/cleanup.
  - Bumped version and timestamp; MCP‑only scope reinforced.
- v0.2 (2025-08-09T04:04:18-04:00):
  - Added professional header, from-scratch scene setup prompt, environment prop prompt, and expanded weapon constraints.
  - Structured for Blender 5 + Hyper3D with web-ready constraints.
- v0.1: Initial prompt library.
