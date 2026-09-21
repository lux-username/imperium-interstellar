/**
 * Orders are data records with a few parameters and a rendezvous, never
 * scripts. Progress lives on the order itself (a courier's leg, a patrol's
 * start week) so a ship handed a fresh order starts it from the beginning.
 *
 * Every variant carries a `kind` literal; CLAUDE.md derives the list of
 * implemented order types by grepping this file for them.
 */
import type { Address, CharacterId, Week, WorldId } from './types'

/** When to fight, if it comes to it. A bold commander reads this one step up, a cautious one a step down. */
export type Posture = 'never' | 'overwhelming' | 'favourable' | 'even' | 'always'

export type Order =
  /** Stay put. */
  | { kind: 'hold' }
  /** Go to a world, then hold there or head for the rendezvous. */
  | { kind: 'move'; to: WorldId; then: Address | null }
  /**
   * Carry mail along a route of worlds, then return to the rendezvous.
   * `leg` is the index of the next stop; it wraps when `repeat`. Scheduled
   * packets run a two-world loop forever.
   */
  | { kind: 'courier'; route: WorldId[]; then: Address | null; repeat: boolean; leg: number }
  /** Sit at a world for `weeks` from arrival, engaging per `posture`, then head for the rendezvous. */
  | { kind: 'patrol'; world: WorldId; weeks: number; posture: Posture; then: Address | null; began: Week | null }
  /**
   * Go to a world and lie off it for `weeks` from arrival, then write the
   * one fully accurate report in the game — its true state and every hull
   * that called while the scout watched — and head for the rendezvous. One
   * week is a look; several is a watch.
   */
  | { kind: 'scout'; world: WorldId; weeks: number; then: Address | null; lookedOn: Week | null }
  /**
   * Take troops and a passenger from wherever the order is read and put
   * them down at `to`, then head for the rendezvous. What happens on
   * landing depends on `purpose`: troops reinforce a friendly garrison or
   * assault a hostile one; a passenger takes the governor's seat (marines
   * enforce it) or takes command of a prize lying there. `loaded` is set
   * once the cargo is aboard.
   */
  | { kind: 'transport'; army: number; marines: number; passenger: CharacterId | null; purpose: Purpose; to: WorldId; then: Address | null; loaded: boolean }

/** What a transport is for. */
export type Purpose = 'land' | 'appoint' | 'command'
