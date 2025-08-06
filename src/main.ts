/**
 * R3F bootstrap entry. Keep Vite entry path stable while delegating to React app.
 * Eliminates legacy RAF/renderer. All ECS wiring and loop live under src/react/.
 */
import './react/main.tsx';