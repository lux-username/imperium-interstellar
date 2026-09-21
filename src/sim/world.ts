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
import { ADMINISTRATION, REBELS, WARLORD, capitalOf } from './factions'
import { groundRound, troopStrength } from './ground'
import { shipsAt } from './mail'
import { check, nextInt } from './rng'
import type { CharacterId, FactionId, GameState, Ship, Troops, World, WorldId } from './types'

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
  recordEvent(state, world.id, { kind: 'revolt_began', valence: 'neutral', against: world.faction, favours: REBELS, severity: 3, level: rebels.army })
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
        recordEvent(state, world.id, { kind: 'revolt_crushed', valence: 'neutral', favours: world.faction, against: REBELS, severity: 2 })
        world.unrest = Math.max(0, world.unrest - 4)
      } else {
        recordEvent(state, world.id, { kind: 'landing_repulsed', valence: 'neutral', favours: world.faction, against: contest.attacker, severity: 2 })
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
 * left. The player's own seat falling is the end of the game — the desk is
 * taken, for ransom or a show trial; the Warlord's seat falling finishes
 * him as a power, and his governors have nobody left to write to.
 */
export function changeHands(state: GameState, world: World, winner: FactionId, troops: Troops): void {
  const loser = world.faction
  world.contest = null
  if (world.id === state.capital) {
    state.ending = { kind: 'capital_fallen', by: winner, week: state.week }
  }
  for (const f of Object.values(state.factions)) {
    if (f.capital === world.id && f.id !== ADMINISTRATION) {
      f.capital = null
      if (f.leader) delete state.characters[f.leader]
      f.leader = null
    }
  }

  // The governor's fate. The player is not killed: the desk is taken, and the game ends with it.
  const governor = world.actingGovernor
  if (governor && governor !== state.player && state.characters[governor]) {
    const refuge = shipsAt(state, world.id).find((s) => s.faction === loser && s.commander !== null)
    const name = state.characters[governor]?.name ?? null
    if (refuge) {
      state.characters[governor].post = { kind: 'passenger', ship: refuge.id }
      refuge.passengers.push(governor)
      recordEvent(state, world.id, { kind: 'governor_fled', valence: 'neutral', against: loser, severity: 2, person: name, ship: refuge })
    } else {
      delete state.characters[governor]
      recordEvent(state, world.id, { kind: 'governor_killed', valence: 'neutral', against: loser, severity: 3, person: name })
    }
  }

  // Hulls that cannot fight are taken at their moorings; the rest are in orbit and keep their freedom.
  for (const ship of shipsAt(state, world.id)) {
    if (ship.faction === loser && ship.strength === 0) impound(state, ship, winner)
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
    recordEvent(state, world.id, { kind: 'world_fell', valence: 'neutral', against: loser, favours: REBELS, severity: 3, person: state.characters[id].name })
  } else {
    world.unrest = Math.min(world.unrest, 5)
    recordEvent(state, world.id, { kind: 'world_taken', valence: 'neutral', against: loser, favours: winner, severity: 3, person: state.factions[winner]?.name ?? winner })
  }
}

/**
 * An unarmed hull taken at a port: she is the holder's now. A packet keeps
 * her run if both ends of her lane are the holder's — packets need no
 * officer, a nameless junior takes her — and lies idle otherwise; anything
 * else waits for the holder to crew her. Her mail is lost either way.
 */
export function impound(state: GameState, ship: Ship, holder: FactionId): void {
  for (const m of ship.mailbag) if (state.mail[m]) state.mail[m].status = { kind: 'lost', week: state.week }
  ship.mailbag = []
  if (ship.commander) {
    const c = state.characters[ship.commander]
    if (c && ship.location.kind === 'world') c.post = { kind: 'unassigned', at: ship.location.world }
    ship.commander = null
  }
  ship.faction = holder
  ship.havens = null
  if (ship.role === 'packet' && ship.order?.kind === 'courier') {
    if (!ship.order.route.every((w) => state.worlds[w]?.faction === holder)) ship.order = { kind: 'hold' }
  } else {
    ship.order = { kind: 'hold' }
  }
  ship.standing = { rally: capitalOf(state, holder), onContact: 'never' }
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
