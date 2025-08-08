---
trigger: glob
globs: src/systems/ScoringSystem.ts, src/systems/CombatSystem.ts, src/components/GameplayComponents.ts
---

# Rule 7 — Combat & Scoring (authoritative, copy‑safe)

Authoritative constraints for firing, damage, recoil, target state, and scoring. Runs deterministically after Physics each fixed step.

## Purpose
- Make firing and hit resolution deterministic and auditable.
- Centralize damage and scoring attribution.
- Keep weapon specs immutable and timers fixed‑step based.

## Ownership & Files
- Combat: [src/systems/CombatSystem.ts](cci:7://file:///home/sam/threejs.shooter/src/systems/CombatSystem.ts:0:0-0:0)
- Scoring: [src/systems/ScoringSystem.ts](cci:7://file:///home/sam/threejs.shooter/src/systems/ScoringSystem.ts:0:0-0:0)
- Weapon/Health components: [src/components/GameplayComponents.ts](cci:7://file:///home/sam/threejs.shooter/src/components/GameplayComponents.ts:0:0-0:0)

## Order & Data‑Flow (per fixed step)
1) PhysicsSystem — steps world and collects contacts/hits into a transient buffer.
2) CombatSystem — processes fire inputs, spawns projectiles/hitscan traces, resolves hits using authoritative positions/contacts.
3) ScoringSystem — updates score/streaks/milestones based on resolved damage/kill events.

## Weapons & Determinism
- Weapon spec component (immutable per instance):
  - `rateOfFire`, `burst`, `spread`, `recoil`, `damage`, `projectileSpeed`, `range`, `ammo`, `reloadTime`, `hitScan?: boolean`
- Cooldowns & timers:
  - Fixed‑step timers only (increment by constant dt per step).
  - No wall‑clock or variable‑dt math.
- Randomness:
  - Spread/recoil use a seeded PRNG per weapon/entity; seed stored in ECS for reproducibility.

## Firing Model
- Edge‑trigger:
  - InputSystem provides `firePrimaryPressed/Released` edges; Combat consumes edges once per step.
- Hitscan:
  - Ray from muzzle along aim; queries via Physics read‑only APIs; record impact, normal, distance.
- Projectile:
  - Spawn projectile entity with `Velocity`/`RigidBody` configured; enable CCD for fast movers (via Physics layers/config).
- Recoil:
  - Apply deterministic recoil to ECS aim/controller (not to physics directly).
- Ammo/Reload:
  - Decrement ammo deterministically; fixed‑step reload timers; block fire until complete.

## Damage & Health
- Health component with `current`, `max`, `invulnerableUntilStep?`.
- Damage application:
  - Apply at the Combat step using authoritative contact/hit data from the same frame.
  - Clamp to zero; transitions to `dead` state are single‑step and idempotent.
- Friendly‑fire and layers:
  - Respect collision/layer policy from [src/core/CollisionLayers.ts](cci:7://file:///home/sam/threejs.shooter/src/core/CollisionLayers.ts:0:0-0:0) for valid targets.

## Scoring Attribution
- Event inputs:
  - `hit`, `kill`, `streak`, `accuracy` metrics emitted by Combat with attacker/target IDs and weapon metadata.
- Scoring rules:
  - Award points per target type; bonus for streaks/headshots (if defined).
  - Update persistent ECS `Score` component.
- Analytics (optional):
  - Track step‑local counters (shots fired, hits landed) for accuracy; zeroed each life/interval.

## Performance & Allocation Discipline
- No heap allocations in per‑entity loops (reuse temp vectors/hit records).
- Projectiles pooled where feasible; destruction batched to avoid churn.

## Prohibitions (hard)
- No variable‑dt math for cooldowns, reloads, spread, recoil, or damage over time.
- No direct physics stepping or scene graph mutations in Combat/Scoring.
- No magic collision numbers; rely on [CollisionLayers.ts](cci:7://file:///home/sam/threejs.shooter/src/core/CollisionLayers.ts:0:0-0:0).
- No async mutations mid‑step; enqueue external results for next step only.

## Reviewer Checklist (static; grep‑friendly)
- Determinism
  - Weapon timers/cooldowns increment by the fixed dt; PRNG seed stored per weapon.
- Inputs
  - Combat consumes edge‑trigger fields from Input snapshot; no DOM reads here.
- Physics integration
  - Hitscan/contacts obtained through Physics queries/buffers; CCD enabled for fast projectiles.
- Damage/Health
  - Single authoritative application per step; state transitions (alive→dead) are guarded/idempotent.
- Scoring
  - Score updates come exclusively from Combat‑emitted events; no UI‑driven score changes.
- Allocations
  - No per‑frame allocations