/** What the desk has picked out on the map or in a list: a world, or a hull. The right-hand pane shows its dossier. */
import type { ShipId, WorldId } from '../sim/view'

export type Selection = { kind: 'world'; id: WorldId } | { kind: 'ship'; id: ShipId }

export function sameSelection(a: Selection | null, b: Selection | null): boolean {
  return a?.kind === b?.kind && a?.id === b?.id
}
