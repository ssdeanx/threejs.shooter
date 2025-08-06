/**
 * R3F bootstrap entry. Keep Vite entry path stable while delegating to React app.
 * Eliminates legacy RAF/renderer. All ECS wiring and loop live under src/react/.
 *
 * Canonical deterministic system order enforced by orchestrator(s):
 * 1) Input
 * 2) Movement
 * 3) Physics
 * 4) Combat
 * 5) Scoring
 * 6) Camera
 * 7) Render
 */
import './react/main.tsx';