/**
 * Troops and passengers: what a transport takes aboard where its order is
 * read, and what happens when it puts them down. Detachments travel
 * cryofrozen and one in ten does not survive revival, so a force arrives
 * weaker than it left by an amount Government House learns only from the
 * commander's letter. On a friendly world troops reinforce the garrison;
 * on a hostile one they land under fire — cleanly only behind a beachhead
 * of marines — and the ground contest begins (see ./ground.ts, ./world.ts).
 *
 * A passenger is put down for a purpose: to take the governor's seat
 * (which an unwilling incumbent concedes only to marines) or to take
 * command of a prize lying in port.
 */
import { recordEvent } from './events'
import { capitalOf, hostile } from './factions'
import { troopCapacity } from './fleet'
import { CRYO_LOSS, landUnderFire, troopStrength } from './ground'
import { nextFloat } from './rng'
import type { GameState, Ship, Troops, WorldId } from './types'
import type { Order } from './orders'
import { changeHands } from './world'

type Transport = Extract<Order, { kind: 'transport' }>

/**
 * Take the cargo aboard at `at`: troops from the garrison there, if the
 * world is ours, and the passenger, if they are standing on the quay. What
 * is not there is not loaded; the order goes on with what it has.
 */
export function loadCargo(state: GameState, ship: Ship, at: WorldId, order: Transport): void {
  order.loaded = true
  const world = state.worlds[at]
  if (world.faction === ship.faction) {
    const room = Math.max(0, troopCapacity(ship.role) - troopStrength(ship.troops))
    const army = Math.min(order.army, world.garrison, room)
    const marines = Math.min(order.marines, world.marines, room - army)
    world.garrison -= army
    world.marines -= marines
    ship.troops = { army: ship.troops.army + army, marines: ship.troops.marines + marines }
  }
  const passenger = order.passenger ? state.characters[order.passenger] : null
  if (passenger && passenger.post.kind === 'unassigned' && passenger.post.at === at && passenger.faction === ship.faction) {
    passenger.post = { kind: 'passenger', ship: ship.id }
    ship.passengers.push(passenger.id)
  }
}

/** Revival after the cryo passage: each detachment has its chance of not waking. The losses are an event the commander may or may not mention. */
function revive(state: GameState, ship: Ship, at: WorldId, troops: Troops): Troops {
  let army = 0
  let marines = 0
  for (let i = 0; i < troops.army; i++) if (nextFloat(state.rng) >= CRYO_LOSS) army += 1
  for (let i = 0; i < troops.marines; i++) if (nextFloat(state.rng) >= CRYO_LOSS) marines += 1
  const lost = troopStrength(troops) - army - marines
  if (lost > 0) recordEvent(state, at, { kind: 'troops_lost', valence: 'neutral', against: ship.faction, severity: 1, ship, level: lost })
  return { army, marines }
}

/** The transport has reached `at`: everything and everyone comes off, for the purpose the order named. */
export function unloadCargo(state: GameState, ship: Ship, at: WorldId, order: Transport): void {
  const world = state.worlds[at]
  if (troopStrength(ship.troops) > 0) {
    const revived = revive(state, ship, at, ship.troops)
    ship.troops = { army: 0, marines: 0 }
    if (hostile(world.faction, ship.faction)) assault(state, ship, at, revived)
    else {
      world.garrison += revived.army
      world.marines += revived.marines
      recordEvent(state, at, { kind: 'troops_landed', valence: 'neutral', favours: ship.faction, severity: 1, ship, level: troopStrength(revived) })
    }
  }
  const passenger = order.passenger && ship.passengers.includes(order.passenger) ? state.characters[order.passenger] : null
  if (!passenger) return
  const disembark = () => {
    ship.passengers = ship.passengers.filter((p) => p !== passenger.id)
  }
  if (order.purpose === 'command') {
    const prize = Object.values(state.ships)
      .filter((s) => s.faction === ship.faction && s.commander === null && s.role !== 'packet' && s.location.kind === 'world' && s.location.world === at)
      .sort((a, b) => (a.id < b.id ? -1 : 1))[0]
    if (!prize) return
    disembark()
    passenger.post = { kind: 'commander', ship: prize.id }
    prize.commander = passenger.id
    prize.standing = { rally: capitalOf(state, ship.faction), onContact: 'favourable' }
    recordEvent(state, at, { kind: 'officer_took_command', valence: 'neutral', favours: ship.faction, severity: 1, ship: prize, person: passenger.name })
    return
  }
  if (order.purpose === 'appoint' && world.faction === ship.faction) {
    const incumbent = world.actingGovernor ? state.characters[world.actingGovernor] : null
    const willing = !incumbent || incumbent.traits.loyalty === 'player' || incumbent.id === state.player
    if (!willing && world.marines === 0) {
      recordEvent(state, at, { kind: 'appointment_refused', valence: 'neutral', against: ship.faction, severity: 2, person: incumbent.name })
      return
    }
    disembark()
    if (incumbent && incumbent.id !== state.player) incumbent.post = { kind: 'unassigned', at }
    passenger.post = { kind: 'governor', world: at }
    world.governor = passenger.id
    world.actingGovernor = passenger.id
    world.lastLetter = state.week
    recordEvent(state, at, { kind: 'appointment_made', valence: 'neutral', favours: ship.faction, severity: 1, person: passenger.name })
  }
}

/**
 * Troops put down on a world held against us. Without a beachhead the
 * landing costs a detachment; then the ground contest begins, or joins
 * one our side already has going. A world with nobody to hold the port
 * falls at once. A rising already under way throws in with the newcomers.
 */
function assault(state: GameState, ship: Ship, at: WorldId, troops: Troops): void {
  const world = state.worlds[at]
  const { landed } = landUnderFire(troops)
  recordEvent(state, at, { kind: 'troops_landed', valence: 'neutral', against: world.faction, favours: ship.faction, severity: 2, ship, level: troopStrength(landed) })
  if (troopStrength(landed) === 0) {
    // Shot to pieces on the way in: a landing thrown back before it began.
    recordEvent(state, at, { kind: 'landing_repulsed', valence: 'neutral', favours: world.faction, against: ship.faction, severity: 2 })
    return
  }
  const defenders = world.garrison + world.marines
  if (defenders === 0) {
    changeHands(state, world, ship.faction, landed)
    return
  }
  if (world.contest && world.contest.attacker === ship.faction) {
    world.contest.attackers = { army: world.contest.attackers.army + landed.army, marines: world.contest.attackers.marines + landed.marines }
    return
  }
  const rising = world.contest ? world.contest.attackers : { army: 0, marines: 0 }
  world.contest = { since: state.week, attacker: ship.faction, attackers: { army: landed.army + rising.army, marines: landed.marines + rising.marines } }
}

/** At their own faction's seat, everyone riding as a passenger steps off into the pool. */
export function disembarkAtHome(state: GameState, ship: Ship, at: WorldId): void {
  if (capitalOf(state, ship.faction) !== at) return
  for (const id of ship.passengers) {
    const c = state.characters[id]
    if (c) c.post = { kind: 'unassigned', at }
  }
  ship.passengers = []
}

/** Anyone of the ship's own side stranded on a quay that is not theirs — an unseated governor, say — comes aboard for a ride home. */
export function takeOnWaiting(state: GameState, ship: Ship, at: WorldId): void {
  if (ship.role === 'packet' || !ship.commander || state.worlds[at]?.faction === ship.faction) return
  for (const c of Object.values(state.characters)) {
    if (c.faction !== ship.faction || c.post.kind !== 'unassigned' || c.post.at !== at) continue
    c.post = { kind: 'passenger', ship: ship.id }
    ship.passengers.push(c.id)
  }
}
