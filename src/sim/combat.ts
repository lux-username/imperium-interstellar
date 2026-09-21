/**
 * Fighting in space, resolved by the sim when hostile hulls share a
 * system. Strength, posture, commander traits and dice produce damage,
 * destruction, capture or retreat; there is no tactical layer. The desk
 * learns of it from the commanders' own after-action letters (see
 * ./ships.ts), which a self-serving commander shades.
 *
 * A hull docked at its own faction's port cannot be forced to fight: it
 * sorties if its posture says so and sits tight otherwise. Everyone else
 * in the system is in the open. A side that will not fight tries to break
 * off ship by ship — scouts almost always get away — and whatever is caught
 * with no guns is robbed (by pirates) or taken (by anyone else). A hull
 * taken with her guns intact goes to the captor's rendezvous under a prize
 * crew — or, taken by pirates, becomes a pirate on the spot. Mail aboard a
 * hull that is taken or destroyed is lost with her (#43).
 *
 * Numbers are placeholders for the 1b playtest.
 */
import { neighbours } from './chart'
import { isBold, isCautious } from './characters'
import { recordEvent } from './events'
import { ADMINISTRATION, PIRATES, capitalOf, hostile } from './factions'
import { hexDistance } from './hex'
import { shipsAt } from './mail'
import { pirateFromPrize } from './pirates'
import { check, nextInt, roll } from './rng'
import { impound } from './world'
import type { FactionId, GameState, Ship, ShipId, WorldId } from './types'
import type { Posture } from './orders'
import type { Valence } from './view'

/** What a hull can still bring to a fight. */
export function effectiveStrength(ship: Ship): number {
  return Math.max(0, ship.strength - ship.damage)
}

function sideStrength(ships: Ship[]): number {
  return ships.reduce((sum, s) => sum + effectiveStrength(s), 0)
}

/** How news of a loss reads at the desk: bad if the hull was ours, good if she was theirs. */
export function lossValence(faction: FactionId): Valence {
  return hostile(faction, ADMINISTRATION) ? 'good' : 'bad'
}

const POSTURES: Posture[] = ['never', 'overwhelming', 'favourable', 'even', 'always']

/** The lead hull's posture, read a step up by a bold commander and a step down by a cautious one. */
function postureOf(state: GameState, ships: Ship[]): Posture {
  const lead = [...ships].sort((a, b) => effectiveStrength(b) - effectiveStrength(a) || (a.id < b.id ? -1 : 1))[0]
  const commander = lead.commander ? state.characters[lead.commander] : null
  let i = POSTURES.indexOf(lead.standing.onContact)
  if (commander && isBold(commander)) i += 1
  if (commander && isCautious(commander)) i -= 1
  return POSTURES[Math.max(0, Math.min(POSTURES.length - 1, i))]
}

/** Whether a side chooses to fight, given what it can see of the other. */
function engages(state: GameState, us: Ship[], them: Ship[]): boolean {
  const own = sideStrength(us)
  if (own === 0) return false
  const enemy = sideStrength(them)
  switch (postureOf(state, us)) {
    case 'never':
      return false
    case 'overwhelming':
      return own >= enemy * 2 && own > enemy
    case 'favourable':
      return own > enemy
    case 'even':
      return own >= enemy
    case 'always':
      return true
  }
}

/** Naval competence of whoever leads the side; zero for a side of packets. */
function leadCompetence(state: GameState, ships: Ship[]): number {
  const lead = [...ships].sort((a, b) => effectiveStrength(b) - effectiveStrength(a) || (a.id < b.id ? -1 : 1))[0]
  const c = lead.commander ? state.characters[lead.commander] : null
  return c?.traits.competence.naval ?? 0
}

/**
 * Docked at a port of her own faction — or, for a pirate, at a haven she
 * knows — a hull is under the port's guns. A hull that only came out of
 * jump this week is still in the open, which is how raiders make a living.
 */
export function docked(state: GameState, ship: Ship, at: WorldId, arriving: ReadonlySet<ShipId> = new Set()): boolean {
  const world = state.worlds[at]
  if (!world || arriving.has(ship.id)) return false
  if (ship.faction === PIRATES) return ship.havens?.includes(at) ?? false
  return world.faction === ship.faction
}

// ---------------------------------------------------------------------------
// Breaking off

/**
 * A hull trying to get clear. Scouts are built for it; couriers and
 * packets are quick; warships are not. A good commander helps. She jumps
 * to a neighbouring world — a friendly one if there is one in range — and
 * arrives next week with whatever she carries.
 */
function breakOff(state: GameState, ship: Ship, at: WorldId): boolean {
  const target = ship.role === 'scout' ? 4 : ship.role === 'courier' || ship.role === 'packet' ? 7 : 9
  const commander = ship.commander ? state.characters[ship.commander] : null
  if (!check(state.rng, target, commander?.traits.competence.naval ?? 0)) return false
  const to = refuge(state, ship, at)
  if (!to) return false
  recordEvent(state, at, { kind: 'ship_fled', valence: 'neutral', severity: 1, ship })
  ship.location = { kind: 'transit', from: at, to, arrives: state.week + 1 }
  return true
}

/** Where a hull runs to: a charted neighbour, else anything within a jump, friendly first. Null if nowhere. */
function refuge(state: GameState, ship: Ship, at: WorldId): WorldId | null {
  const here = state.worlds[at]
  const charted = neighbours(state.lanes, at)
  const inRange = (Object.keys(state.worlds).sort() as WorldId[]).filter((w) => w !== at && hexDistance(state.worlds[w].hex, here.hex) <= ship.jump)
  const candidates = charted.length > 0 ? charted : inRange
  if (candidates.length === 0) return null
  const friendly = candidates.filter((w) => !hostile(state.worlds[w].faction, ship.faction))
  const pool = friendly.length > 0 ? friendly : candidates
  return pool[nextInt(state.rng, 0, pool.length - 1)]
}

// ---------------------------------------------------------------------------
// Losing a hull

/** Everything in the bag is gone: taken and destroyed, or lost with the ship. */
function loseMail(state: GameState, ship: Ship): void {
  for (const id of ship.mailbag) {
    const mail = state.mail[id]
    if (mail) mail.status = { kind: 'lost', week: state.week }
  }
  ship.mailbag = []
}

/** A hull with no guns caught in the open: pirates rob her and let her go; anyone else takes her. */
function overtaken(state: GameState, ship: Ship, at: WorldId, by: Ship[]): void {
  if (by[0].faction === PIRATES) {
    loseMail(state, ship)
    recordEvent(state, at, { kind: 'ship_robbed', valence: lossValence(ship.faction), severity: 2, ship })
    return
  }
  capture(state, ship, at, by)
}

/**
 * The hull is the captor's. Her people are lost to the game. Taken by
 * pirates with her guns intact, she is a pirate from this week, with her
 * captor's havens. Taken by anyone else, a packet is impounded (she needs
 * no officer and runs for the holder if her lane is theirs); anything else
 * sails for the captor's rendezvous under a prize crew and waits there for
 * an officer.
 */
export function capture(state: GameState, ship: Ship, at: WorldId, by: Ship[]): void {
  const captor = by[0].faction
  loseMail(state, ship)
  recordEvent(state, at, { kind: 'ship_captured', valence: lossValence(ship.faction), severity: 3, ship })
  if (ship.commander) delete state.characters[ship.commander]
  for (const p of ship.passengers) delete state.characters[p]
  ship.passengers = []
  ship.commander = null
  if (captor === PIRATES && ship.strength > 0) {
    pirateFromPrize(state, ship, by[0].havens ?? [])
    return
  }
  if (ship.role === 'packet') {
    impound(state, ship, captor)
    return
  }
  const lead = [...by].sort((x, y) => effectiveStrength(y) - effectiveStrength(x) || (x.id < y.id ? -1 : 1))[0]
  const home = lead.standing.rally ?? capitalOf(state, captor)
  ship.faction = captor
  ship.havens = null
  ship.order = home && home !== at ? { kind: 'move', to: home, then: null } : { kind: 'hold' }
  ship.standing = { rally: home, onContact: 'never' }
}

function destroy(state: GameState, ship: Ship, at: WorldId): void {
  loseMail(state, ship)
  recordEvent(state, at, { kind: 'ship_destroyed', valence: lossValence(ship.faction), severity: 3, ship })
  if (ship.commander) delete state.characters[ship.commander]
  for (const p of ship.passengers) delete state.characters[p]
  delete state.ships[ship.id]
}

// ---------------------------------------------------------------------------
// The action

/**
 * A few exchanges. Each round both sides roll to hit; a hit knocks a point
 * off one enemy hull, the biggest first. A hull with nothing left is
 * knocked out: destroyed on a high roll, otherwise taken if the other side
 * still has guns. After each round the side that is worse off may break
 * off ship by ship.
 */
function battle(state: GameState, at: WorldId, a: Ship[], b: Ship[]): void {
  const lead = (side: Ship[]) => [...side].sort((x, y) => effectiveStrength(y) - effectiveStrength(x) || (x.id < y.id ? -1 : 1))[0]
  recordEvent(state, at, { kind: 'battle', valence: 'bad', severity: 2, ship: lead(b) })
  // Sides are who flew which flag when the action began: a hull taken mid-action leaves her side, and does not flee as a prize.
  const flagA = a[0].faction
  const flagB = b[0].faction
  let sideA = a
  let sideB = b
  for (let round = 0; round < 3; round++) {
    const sa = sideStrength(sideA)
    const sb = sideStrength(sideB)
    if (sa === 0 || sb === 0) break
    const edge = Math.max(-3, Math.min(3, sa - sb))
    const hitsA = check(state.rng, 8, edge + leadCompetence(state, sideA))
    const hitsB = check(state.rng, 8, -edge + leadCompetence(state, sideB))
    if (hitsA) hit(state, at, lead(sideB), sideA)
    if (hitsB) hit(state, at, lead(sideA), sideB)
    sideA = sideA.filter((s) => state.ships[s.id] && s.location.kind === 'world' && s.faction === flagA)
    sideB = sideB.filter((s) => state.ships[s.id] && s.location.kind === 'world' && s.faction === flagB)
    if (sideA.length === 0 || sideB.length === 0) break
    // Whoever no longer likes the odds tries to get clear.
    if (!engages(state, sideA, sideB)) sideA = sideA.filter((s) => !breakOff(state, s, at))
    if (!engages(state, sideB, sideA)) sideB = sideB.filter((s) => !breakOff(state, s, at))
    if (sideA.length === 0 || sideB.length === 0) break
  }
}

/** A point of damage on `ship`, from `by`. Knocked out at zero. */
function hit(state: GameState, at: WorldId, ship: Ship, by: Ship[]): void {
  ship.damage += 1
  if (effectiveStrength(ship) > 0) {
    recordEvent(state, at, { kind: 'ship_damaged', valence: lossValence(ship.faction), severity: 1, ship })
    return
  }
  if (roll(state.rng) >= 9 || sideStrength(by) === 0) destroy(state, ship, at)
  else capture(state, ship, at, by)
}

/** Two hostile groups in one system decide what to do about each other. */
function encounter(state: GameState, at: WorldId, a: Ship[], b: Ship[], arriving: ReadonlySet<ShipId>): void {
  const wantsA = engages(state, a, b)
  const wantsB = engages(state, b, a)
  if (!wantsA && !wantsB) return
  if (wantsA && wantsB) {
    battle(state, at, a, b)
    return
  }
  const [hunters, quarry] = wantsA ? [a, b] : [b, a]
  const caught = quarry.filter((s) => !docked(state, s, at, arriving)).filter((s) => !breakOff(state, s, at))
  if (caught.length === 0) return
  if (sideStrength(caught) === 0) {
    for (const s of caught) overtaken(state, s, at, hunters)
    return
  }
  battle(state, at, hunters, caught)
}

/**
 * Every system where hostile hulls lie together this week. Groups are by
 * faction; each hostile pair has its encounter, recomputed as hulls flee
 * or change hands. Runs after hulls land and before they unload; `landed`
 * are this week's arrivals, still in the open.
 */
export function fightAtWorlds(state: GameState, landed: readonly ShipId[] = []): void {
  const arriving = new Set(landed)
  const ids = Object.keys(state.worlds).sort() as WorldId[]
  for (const at of ids) {
    const factions = [...new Set(shipsAt(state, at).map((s) => s.faction))].sort()
    for (let i = 0; i < factions.length; i++) {
      for (let j = i + 1; j < factions.length; j++) {
        if (!hostile(factions[i], factions[j])) continue
        const a = shipsAt(state, at).filter((s) => s.faction === factions[i])
        const b = shipsAt(state, at).filter((s) => s.faction === factions[j])
        if (a.length === 0 || b.length === 0) continue
        encounter(state, at, a, b, arriving)
      }
    }
  }
}

/** A knocked-about hull lying at a friendly A or B port is patched up a point a week. Pirates refit only at a haven. */
export function repairShips(state: GameState): void {
  for (const ship of Object.values(state.ships)) {
    if (ship.damage === 0 || ship.location.kind !== 'world') continue
    const world = state.worlds[ship.location.world]
    if (!docked(state, ship, world.id)) continue
    if (ship.faction !== PIRATES && world.profile.starport !== 'A' && world.profile.starport !== 'B') continue
    ship.damage -= 1
  }
}
