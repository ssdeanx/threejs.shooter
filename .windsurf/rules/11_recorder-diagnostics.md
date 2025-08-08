---
trigger: model_decision
description: Recorder & Diagnostics - Low‑overhead capture of state/perf for debugging; off by default.
---

# Rule 11 — Recorder & Diagnostics (authoritative, copy‑safe)

Low‑overhead capture of state/perf for debugging; off by default.

## Ownership & Files
- Recorder: [src/systems/RecorderSystem.ts](cci:7://file:///home/sam/threejs.shooter/src/systems/RecorderSystem.ts:0:0-0:0) (optional)
- UI toggles: [src/react/Options.tsx](cci:7://file:///home/sam/threejs.shooter/src/react/Options.tsx:0:0-0:0) (if present)
- Artifacts: in‑memory ring buffer; optional dev‑only JSON under [docs/](cci:7://file:///home/sam/threejs.shooter/docs:0:0-0:0) (not shipped)

## Behavior
- Sample at a configurable stride (e.g., every N fixed steps).
- Capture minimal snapshots: timestamps (step index), player pose, score deltas, perf counters.
- Optional viewport screenshots are manual, not automatic.

## Overhead Control
- Feature‑flagged; default OFF.
- Zero allocations in hot loops when disabled.
- When enabled, reuse buffers; cap history length.

## Privacy & Security
- No PII or secrets; no external network calls.
- Dev‑only artifacts; excluded from production bundles.

## Prohibitions (hard)
- No per‑frame JSON serialization when enabled; batch or stride only.
- No writes to [public/](cci:7://file:///home/sam/threejs.shooter/public:0:0-0:0); dev artifacts go to [docs/](cci:7://file:///home/sam/threejs.shooter/docs:0:0-0:0) or memory.
- No enabling by default.

## Reviewer Checklist
- Recorder guarded by a feature flag; default OFF.
- Stride sampling implemented; ring buffer present.
- No allocations in hot loops when disabled.
- No external network I/O in recorder paths.

## Acceptance Gates
- Recorder is optional, low‑overhead, and safe.
- Artifacts stored only in dev contexts.
- Internal lint clean (Rule 0).
