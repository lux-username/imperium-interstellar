/**
 * How a world changes hands. A revolt is a contest, not a switch: when
 * unrest boils over the rising fights the garrison week by week under the
 * ground model, and only when the garrison is gone does the governor flee
 * or die and the world become independent. A landing by another faction is
 * the same contest with different attackers. A world with no garrison
 * falls at once, which is what garrisons placed ahead of need are for.
 *
 * The Empire holds the port and the palace, not the planet (spec.md →
 * Premise), so "the world fell" means those two things were lost.
 */
import { hexLabel } from './hex'
import { newCharacter } from './characters'
import { recordEvent } from './events'
import { ADMINISTRATION, REBELS, WARLORD, hostile } from './factions'
import { groundRound, troopStrength } from './ground'
import { shipsAt } from './mail'
import { check, nextInt } from './rng'
import type { CharacterId, FactionId, GameState, Troops, World, WorldId } from './types'

// ---------------------------------------------------------------------------
// Revolt

/** The rising a world produces when it boils over: a few detachments' worth, more on a populous world. */
function risingStrength(state: GameState, world: World): number {
  return 1 + Math.floor(world.profile.population / 3) + nextInt(state.rng, 0, 1)
}

/**
 * Unrest has reached the top of the scale. The governor's letter asking for
 * help and the rumours follow from the event; the fighting follows from
 * the contest. A world with nobody to hold the port falls on the spot.
 */
export function beginRevolt(state: GameState, world: World): void {
  if (world.contest || world.profile.population === 0) return
  const rebels: Troops = { army: risingStrength(state, world), marines: 0 }
  recordEvent(state, world.id, { kind: 'revolt_began', valence: 'bad', severity: 3, level: rebels.army })
  if (troopStrength(garrisonOf(world)) === 0) {
    changeHands(state, world, REBELS, rebels)
    return
  }
  world.contest = { since: state.week, attacker: REBELS, attackers: rebels }
}

export function garrisonOf(world: World): Troops {
  return { army: world.garrison, marines: world.marines }
}

/** Every contest fights a round. Rebels on a populous world press harder; a strict state's garrison holds better. */
export function fightContests(state: GameState): void {
  const ids = Object.keys(state.worlds).sort() as WorldId[]
  for (const id of ids) {
    const world = state.worlds[id]
    const contest = world.contest
    if (!contest) continue
    const dm = {
      attacker: contest.attacker === REBELS && world.profile.population >= 7 ? 1 : 0,
      defender: world.profile.law >= 7 ? 1 : 0,
    }
    const result = groundRound(state.rng, contest.attackers, garrisonOf(world), dm)
    contest.attackers = result.attackers
    world.garrison = result.defenders.army
    world.marines = result.defenders.marines
    if (troopStrength(result.defenders) === 0) {
      changeHands(state, world, contest.attacker, contest.attackers)
    } else if (troopStrength(result.attackers) === 0) {
      world.contest = null
      if (contest.attacker === REBELS) {
        recordEvent(state, world.id, { kind: 'revolt_crushed', valence: 'good', severity: 2 })
        world.unrest = Math.max(0, world.unrest - 4)
      } else {
        recordEvent(state, world.id, { kind: 'landing_repulsed', valence: hostile(contest.attacker, ADMINISTRATION) ? 'good' : 'bad', severity: 2 })
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Change of hands

/**
 * The garrison is gone. The governor gets off to a friendly hull in orbit
 * if there is one and is killed if there is not; unarmed hulls in port are
 * seized; whoever won holds the port and the palace with what they have
 * left. A faction's own seat cannot fall this way in this campaign — the
 * rising is broken on the palace guard instead — since losing the capital
 * is an ending, and endings are Phase 1c.
 */
export function changeHands(state: GameState, world: World, winner: FactionId, troops: Troops): void {
  const loser = world.faction
  world.contest = null
  if (Object.values(state.factions).some((f) => f.capital === world.id)) {
    recordEvent(state, world.id, { kind: winner === REBELS ? 'revolt_crushed' : 'landing_repulsed', valence: 'good', severity: 2 })
    world.garrison = Math.max(world.garrison, 1)
    world.unrest = Math.min(world.unrest, 7)
    return
  }

  // The governor's fate.
  const governor = world.actingGovernor
  if (governor && governor !== state.player) {
    const refuge = shipsAt(state, world.id).find((s) => s.faction === loser && s.commander !== null)
    const name = state.characters[governor]?.name ?? null
    if (refuge) {
      state.characters[governor].post = { kind: 'passenger', ship: refuge.id }
      refuge.passengers.push(governor)
      recordEvent(state, world.id, { kind: 'governor_fled', valence: 'bad', severity: 2, person: name, ship: refuge })
    } else {
      delete state.characters[governor]
      recordEvent(state, world.id, { kind: 'governor_killed', valence: 'bad', severity: 3, person: name })
    }
  }

  // Hulls that cannot fight are taken at their moorings; the rest are in orbit and keep their freedom.
  for (const ship of shipsAt(state, world.id)) {
    if (ship.faction === loser && ship.strength === 0) {
      ship.faction = winner
      ship.order = { kind: 'hold' }
      if (ship.commander) {
        state.characters[ship.commander].post = { kind: 'unassigned', at: world.id }
        ship.commander = null
      }
    }
  }

  world.faction = winner
  world.garrison = troops.army
  world.marines = troops.marines
  world.lastLetter = state.week
  const id = `c-gov-${hexLabel(world.hex)}-${state.nextId}` as CharacterId
  state.nextId += 1
  state.characters[id] = newCharacter(state.rng, id, winner, { kind: 'governor', world: world.id })
  world.governor = id
  world.actingGovernor = id

  if (winner === REBELS) {
    world.unrest = 2
    recordEvent(state, world.id, { kind: 'world_fell', valence: 'bad', severity: 3, person: state.characters[id].name })
  } else {
    world.unrest = Math.min(world.unrest, 5)
    const good = winner === ADMINISTRATION
    recordEvent(state, world.id, { kind: 'world_taken', valence: good ? 'good' : 'bad', severity: 3, person: state.factions[winner]?.name ?? winner })
  }
}

// ---------------------------------------------------------------------------
// The slow life of lost worlds

/**
 * An independent world projects no power but slowly raises a garrison of
 * its own, so the longer it is left the more it takes to bring back. The
 * Warlord's seat recruits too: that is where his landings come from.
 */
export function regrowGarrisons(state: GameState): void {
  const ids = Object.keys(state.worlds).sort() as WorldId[]
  for (const id of ids) {
    const world = state.worlds[id]
    if (world.contest || world.profile.population === 0) continue
    if (world.faction === REBELS) {
      const cap = 1 + Math.floor(world.profile.population / 2)
      if (world.garrison < cap && check(state.rng, 10)) world.garrison += 1
    } else if (world.faction === WARLORD && state.factions[WARLORD]?.capital === id) {
      if (world.garrison < 8 && state.week % 4 === 0) world.garrison += 1
    }
  }
}
