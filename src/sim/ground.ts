/**
 * Fighting on the ground: one attrition model for every contest over a
 * world — a garrison against a rising, a landing against a garrison, the
 * Warlord's troops against the Home Office's. Each week both sides roll; a hit
 * costs the other side a detachment. Nothing is decided in a tick, so a
 * report that a world is contested is still true weeks later, and a relief
 * force can arrive in time. Numbers are placeholders for the 1b playtest.
 */
import { check, type Rng } from './rng'
import type { Troops } from './types'

export function troopStrength(t: Troops): number {
  return t.army + t.marines
}

/** How many detachments a transport must put down at once on a hostile world to land without loss. */
export const BEACHHEAD = 2

/** Detachments lost on revival after a cryo passage: one in ten, rolled per detachment. */
export const CRYO_LOSS = 0.1

/** Casualties come out of the army first; marines are the last to go. */
export function takeLosses(t: Troops, n: number): Troops {
  const army = Math.max(0, t.army - n)
  const spill = Math.max(0, n - t.army)
  return { army, marines: Math.max(0, t.marines - spill) }
}

export interface RoundResult {
  attackers: Troops
  defenders: Troops
}

/**
 * One week of fighting. Each side hits on 2d6 ≥ 8, shifted by the
 * difference in strength (capped at ±3) and any modifier the ground gives
 * it. Equal forces each lose a detachment about two weeks in five.
 */
export function groundRound(rng: Rng, attackers: Troops, defenders: Troops, dm: { attacker: number; defender: number } = { attacker: 0, defender: 0 }): RoundResult {
  const a = troopStrength(attackers)
  const d = troopStrength(defenders)
  const edge = Math.max(-3, Math.min(3, a - d))
  const attackerHits = check(rng, 8, edge + dm.attacker)
  const defenderHits = check(rng, 8, -edge + dm.defender)
  return {
    attackers: defenderHits ? takeLosses(attackers, 1) : attackers,
    defenders: attackerHits ? takeLosses(defenders, 1) : defenders,
  }
}

/**
 * Troops coming down on a hostile world. Fewer marines than a beachhead
 * needs, and the force takes a detachment's worth of casualties on the way
 * in; at least a beachhead's worth of marines and the landing is clean.
 */
export function landUnderFire(troops: Troops): { landed: Troops; lost: number } {
  if (troops.marines >= BEACHHEAD) return { landed: troops, lost: 0 }
  const total = troopStrength(troops)
  if (total === 0) return { landed: troops, lost: 0 }
  return { landed: takeLosses(troops, 1), lost: 1 }
}
