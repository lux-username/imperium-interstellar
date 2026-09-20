/**
 * Orders are data records with a few parameters and a rendezvous, never
 * scripts. The Phase 0 set is the minimum needed to move mail; Phase 1 adds
 * patrol, escort, blockade, transport, and survey.
 *
 * Every variant carries a `kind` literal; CLAUDE.md derives the list of
 * implemented order types by grepping this file for them.
 */
import type { Address, WorldId } from './types'

export type Order =
  /** Stay put. */
  | { kind: 'hold' }
  /** Go to a world, then hold there or head for the rendezvous. */
  | { kind: 'move'; to: WorldId; then: Address | null }
  /** Carry mail along a route of worlds, then return to the rendezvous. Scheduled packets run this forever. */
  | { kind: 'courier'; route: WorldId[]; then: Address | null; repeat: boolean }
