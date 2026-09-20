/** DEV ONLY. Ground-truth markers for the map, computed from GameState. See GodView.tsx. */
import type { GameState, WorldId } from '../sim/types'
import type { Overlay } from './geometry'

export function overlayFor(state: GameState): Overlay {
  const ships: Overlay['ships'] = []
  for (const s of Object.values(state.ships)) {
    const at = s.location.kind === 'world' ? s.location.world : s.location.to
    const hex = state.worlds[at]?.hex
    if (hex) ships.push({ hex, label: s.name, inTransit: s.location.kind === 'transit' })
  }
  const unrest: Record<WorldId, number> = {}
  for (const w of Object.values(state.worlds)) unrest[w.id] = w.unrest
  return { ships, unrest }
}

