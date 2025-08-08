---
trigger: model_decision
description: Input Ownership & Controls | Authoritative constraints for all player input. Establishes a single source of truth, strict boundaries, and deterministic delivery of input state to systems.
---

# Rule 4 — Input Ownership & Controls (authoritative, copy‑safe)

Authoritative constraints for all player input. Establishes a single source of truth, strict boundaries, and deterministic delivery of input state to systems.

## Purpose
- Centralize DOM input in one place.
- Make input deterministic and frame‑safe for the fixed 60 Hz loop.
- Prevent leaks, double listeners, and UI conflicts.

## Single Source of Truth
- Only [src/systems/InputSystem.ts](cci:7://file:///home/sam/threejs.shooter/src/systems/InputSystem.ts:0:0-0:0) may attach DOM listeners.
- All other systems read input via ECS components (e.g., `PlayerController`, `Aim`, etc.).
- No direct DOM polling or event subscriptions outside [InputSystem.ts](cci:7://file:///home/sam/threejs.shooter/src/systems/InputSystem.ts:0:0-0:0).

## Allowed Inputs (baseline)
- Keyboard: WASD/Arrow keys movement, Space/Shift, R, E/Q, Escape.
- Mouse: move (for aim/look), left/right click (fire/alt), wheel (zoom).
- Pointer lock: optional for camera/aim; must be user‑initiated and reversible.
- Gamepad: optional; if added, mirror the same ECS input fields.

## InputSystem Responsibilities
- Register listeners once on init; remove on teardown.
- Normalize events to a small, typed ECS input state:
  - Movement axes: `moveX`, `moveY` in [−1, 1].
  - Look/aim deltas: `lookX`, `lookY` (scaled by a constant sensitivity; never by variable dt).
  - Buttons: `firePrimary`, `fireSecondary`, `reload`, `jump`, `sprint`, `interact`, `pause`.
  - Modifiers: `shift`, `ctrl`, `alt` if needed.
- Debounce/accumulate per render tick but commit only during each fixed step so simulation reads a stable snapshot.
- Provide “edge” flags for rising/falling transitions (e.g., `firePrimaryPressed`, `Released`) derived at the start of each fixed step.

## Determinism & Timing
- Input events can arrive at render rate; they must be captured and then sampled by the fixed‑step loop.
- Do not scale input magnitudes by variable render `dt`. Use constant sensitivities or per‑step accumulation with sane clamps.
- The only consumer of raw browser events is [InputSystem.ts](cci:7://file:///home/sam/threejs.shooter/src/systems/InputSystem.ts:0:0-0:0). Movement/Combat/Camera read the ECS snapshot during their own update.

## UI & Focus Safety
- If any HTML UI captures focus (e.g., text inputs, menus), `InputSystem` must suspend gameplay listeners or ignore events while UI‑focus is active.
- Escape toggles pause/menu safely:
  - Pausing stops simulation steps in [GameOrchestrator.tsx](cci:7://file:///home/sam/threejs.shooter/src/react/GameOrchestrator.tsx:0:0-0:0).
  - Pointer‑lock must be released on pause; restore on resume via explicit user action.

## Pointer Lock & Sensitivity
- Pointer lock may be requested by user action (click to focus).
- Sensitivity is a constant factor (configurable), not scaled by render `dt`.
- Clamp per‑step accumulated look deltas to avoid spikes on tab‑switch returns.

## Multiple Devices
- Keyboard/Mouse and Gamepad may coexist.
- If both active, define a stable priority (e.g., last‑used device wins for N frames) and record which device authored the snapshot for this step (for analytics/debug).

## Cleanup & Lifecycle
- Add listeners during system init; remove during teardown/unmount (including React unmount).
- Never add/remove listeners in per‑frame paths.
- On page blur/visibility‑change:
  - Zero volatile inputs (movement/look/buttons).
  - Release pointer lock if active.
  - Optionally auto‑pause to prevent runaway state.

## Prohibitions (hard)
- No `addEventListener` outside [src/systems/InputSystem.ts](cci:7://file:///home/sam/threejs.shooter/src/systems/InputSystem.ts:0:0-0:0).
- No polling `document`/`window` events in other systems/components.
- No variable‑dt scaling of input magnitudes (look/move sensitivity).
- No per‑frame listener registration/unregistration.
- No hidden global state carrying input outside ECS input components.

## Reviewer Checklist (static; grep‑friendly)
- Ownership:
  - `addEventListener(` appears only in [src/systems/InputSystem.ts](cci:7://file:///home/sam/threejs.shooter/src/systems/InputSystem.ts:0:0-0:0).
  - No `document.addEventListener` or `window.addEventListener` in `src/systems/**/*.ts*` except [InputSystem.ts](cci:7://file:///home/sam/threejs.shooter/src/systems/InputSystem.ts:0:0-0:0).
- Snapshot:
  - Input fields (axes, buttons, edges) are written once per fixed step and read by Movement/Combat/Camera in that step.
- Timing:
  - No multiplication by variable `dt` for look/move sensitivity; constants only.
- Lifecycle:
  - Listener add/remove happens at system init/teardown; not inside per‑frame updates.
  - Blur/visibility handlers zero volatile inputs and release pointer lock.
- UI focus:
  - Guard exists to ignore gameplay inputs when UI has focus or game is paused.
- Hygiene:
  - Types are strict; no `any`. No unused symbols or stubs. Internal lint clean (Rule 0).

## Minimal input state (reference shape; align with existing components)
/*
- moveX: number   // A/D or left/right (−1..1)
- moveY: number   // W/S or up/down   (−1..1)
- lookX: number   // accumulated per render tick, sampled per fixed step
- lookY: number
- firePrimary: boolean
- fireSecondary: boolean
- reload: boolean
- jump: boolean
- sprint: boolean
- interact: boolean
- pause: boolean
- firePrimaryPressed: boolean // rising edge (derived at step start)
- firePrimaryReleased: boolean // falling edge
- deviceAuthor: "kbm" | "gamepad"
*/

## Acceptance Gates
- Single source of truth (only [InputSystem.ts](cci:7://file:///home/sam/threejs.shooter/src/systems/InputSystem.ts:0:0-0:0) touches DOM).
- Stable per‑step input snapshot; no dt‑scaled magnitudes.
- Clean lifecycle: register once, remove on teardown, safe during blur/pause.
- UI focus and pointer‑lock are handled explicitly and reversibly.
- Internal lint is clean after the latest change (Rule 0).