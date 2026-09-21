/**
 * Ships under way: what an order says to do next, how a hull gets there,
 * and what its commander writes when it arrives. Packets keep the lanes'
 * timetables; everything else sails as soon as it has somewhere to go.
 *
 * A charted route is preferred. A hull someone sent on purpose may also
 * jump off-lane to any world within its jump rating — that is what makes
 * scouts and warships worth having. Fuel risk is Phase 1b.
 */
import { hexRoute, laneBetween, nextDeparture, route } from './chart'
import { eventsAt, hullArrivedEvent, hullDepartedEvent, recordEvent } from './events'
import { lossValence } from './combat'
import { capitalOf, hostile } from './factions'
import { loadMail, snapshotWorld, unloadMail, writeReport } from './mail'
import { watchReport } from './scouts'
import { disembarkAtHome, loadCargo, takeOnWaiting, unloadCargo } from './troops'
import { impound } from './world'
import type { Address, GameState, Ship, ShipId, WorldId } from './types'
import type { Order } from './orders'

// ---------------------------------------------------------------------------
// Routing

/**
 * Fewest-jumps path from one world to another for this hull: over the
 * chart if it connects them, otherwise hex to hex within jump range for a
 * hull that may leave the lanes. Null if it cannot get there.
 */
export function shipRoute(state: GameState, ship: Ship, from: WorldId, to: WorldId): WorldId[] | null {
  const charted = route(state.lanes, from, to)
  if (charted || ship.role === 'packet') return charted
  return hexRoute(state.worlds, from, to, ship.jump)
}

// ---------------------------------------------------------------------------
// Orders

/** The order a ship falls back to when the current one is done: the rendezvous, the rally point, or nothing. */
function afterwards(ship: Ship, then: Address | null): Order {
  const world = then?.kind === 'world' ? then.world : ship.standing.rally
  return world ? { kind: 'move', to: world, then: null } : { kind: 'hold' }
}

/**
 * Where the ship's order says to head next from `at`, or null to stay this
 * week. Orders that are complete give way to what comes after them.
 */
export function orderTarget(state: GameState, ship: Ship, at: WorldId): WorldId | null {
  for (let hops = 0; hops < 3; hops++) {
    const order = ship.order ?? afterwards(ship, null)
    switch (order.kind) {
      case 'hold':
        return null
      case 'move':
        if (order.to !== at) return order.to
        ship.order = afterwards(ship, order.then)
        if (ship.order.kind === 'move' && ship.order.to === at) ship.order = { kind: 'hold' }
        continue
      case 'courier': {
        // Skip stops already reached, wrapping on a repeating loop.
        while (order.leg < order.route.length && order.route[order.leg] === at) {
          order.leg += 1
          if (order.leg >= order.route.length && order.repeat) order.leg = 0
        }
        if (order.leg < order.route.length) return order.route[order.leg]
        ship.order = afterwards(ship, order.then)
        continue
      }
      case 'patrol':
        if (order.world !== at) return order.world
        if (order.began === null) order.began = state.week
        if (state.week < order.began + order.weeks) return null
        ship.order = afterwards(ship, order.then)
        continue
      case 'scout': {
        if (order.world !== at) return order.world
        if (order.lookedOn === null) {
          order.lookedOn = state.week
          commanderReport(state, ship, at)
        }
        const stay = Math.max(1, order.weeks)
        if (state.week < order.lookedOn + stay) return null
        // A watch ends with the one report nobody colours; a look was written on arrival.
        if (stay > 1) watchReport(state, ship, at, order.lookedOn, friendlyPort(state, ship, at))
        ship.order = afterwards(ship, order.then)
        continue
      }
      case 'transport':
        if (!order.loaded) loadCargo(state, ship, at, order)
        if (order.to !== at) return order.to
        // Already where the cargo is going: put it down here and now.
        unloadCargo(state, ship, at, order)
        ship.order = afterwards(ship, order.then)
        continue
    }
  }
  return null
}

/** The world an order is ultimately about, for deciding when a commander writes. */
function orderDestination(order: Order | null): WorldId | null {
  if (!order) return null
  if (order.kind === 'move' || order.kind === 'transport') return order.to
  if (order.kind === 'patrol' || order.kind === 'scout') return order.world
  return null
}

// ---------------------------------------------------------------------------
// Commanders' reports

/** Whether a port will take a hull of this faction at all. A hostile world's port is closed to it: no fuel, no mail, no landing. */
export function portOpenTo(state: GameState, at: WorldId, faction: Ship['faction']): boolean {
  const world = state.worlds[at]
  return world !== undefined && !hostile(world.faction, faction)
}

/**
 * Whether this faction's seat *believes* a port is closed to it. Hulls do
 * not know a world has fallen until word gets back: packets keep sailing
 * in and being lost until a report reaches the seat. A faction with no
 * seat believes nothing.
 */
export function believedClosed(state: GameState, at: WorldId, faction: Ship['faction']): boolean {
  const leader = state.factions[faction]?.leader
  const known = leader ? state.beliefs[leader]?.worlds[at] : undefined
  if (!known || known.snapshot.kind !== 'world') return false
  return hostile(known.snapshot.world.faction, faction)
}

/**
 * An unarmed hull that docks at a port held against her side is taken at
 * the quay: packets and couriers land; scouts and warships stay in orbit
 * and are not. Runs on this week's arrivals after the encounters.
 */
export function impoundAtPorts(state: GameState, landed: readonly ShipId[]): void {
  for (const id of landed) {
    const ship = state.ships[id]
    if (!ship || ship.location.kind !== 'world') continue
    if (ship.role !== 'packet' && ship.role !== 'courier') continue
    const world = state.worlds[ship.location.world]
    if (!hostile(world.faction, ship.faction) || !world.actingGovernor) continue
    recordEvent(state, world.id, { kind: 'ship_captured', valence: lossValence(ship.faction), severity: 2, ship })
    impound(state, ship, world.faction)
  }
}

/** A port where a hull of this faction can lie safely and hand mail to the packets for home. */
export function friendlyPort(state: GameState, ship: Ship, at: WorldId): boolean {
  const world = state.worlds[at]
  const home = capitalOf(state, ship.faction)
  return world !== undefined && world.faction === ship.faction && home !== null && route(state.lanes, at, home) !== null
}

/** Whether this officer has already posted a letter this week, so an action and an arrival do not make two. */
function wroteThisWeek(state: GameState, commander: Ship['commander']): boolean {
  return Object.values(state.mail).some((m) => m.contents.kind === 'report' && m.contents.report.observer === commander && m.contents.report.observed === state.week)
}

/**
 * A commander writes home: what the world looks like from orbit, what is
 * in port, and anything serious that happened here this week. At a
 * friendly port on the lanes the letter goes by the next packet; off the
 * lanes or over a hostile world it rides with the ship until it finds a
 * port with a lane home.
 */
export function commanderReport(state: GameState, ship: Ship, at: WorldId): void {
  if (!ship.commander || at === capitalOf(state, ship.faction) || capitalOf(state, ship.faction) === null) return
  if (wroteThisWeek(state, ship.commander)) return
  const world = state.worlds[at]
  const commander = state.characters[ship.commander]
  // A self-serving commander leaves out the moments that reflect on them: their own hull breaking off or getting
  // knocked about, and the detachments that did not wake from a passage in their hold.
  const own = (e: { ship: { id: string } | null }) => e.ship?.id === ship.id
  const seen = eventsAt(state, at, state.week, state.week)
    .filter((e) => e.severity >= 2 || (own(e) && (e.kind === 'ship_fled' || e.kind === 'troops_landed' || e.kind === 'troops_lost')))
    .filter((e) => e.kind !== 'hull_arrived' && e.kind !== 'hull_departed')
    .filter((e) => !(commander?.traits.loyalty === 'self' && own(e) && (e.kind === 'ship_fled' || e.kind === 'ship_damaged' || e.kind === 'troops_lost')))
  const mail = writeReport(state, ship.commander, at, snapshotWorld(state, world), { events: seen })
  if (!friendlyPort(state, ship, at)) {
    mail.status = { kind: 'aboard', ship: ship.id }
    ship.mailbag.push(mail.id)
  }
}

// ---------------------------------------------------------------------------
// The week's movements

/**
 * Ships that have landed this week come out of jump. They do not unload
 * yet: whatever is lying in the system gets its say first (see ./combat.ts).
 * Returns the hulls that landed.
 */
export function landShips(state: GameState): ShipId[] {
  const landed: ShipId[] = []
  const ids = Object.keys(state.ships).sort() as ShipId[]
  for (const id of ids) {
    const ship = state.ships[id]
    if (ship.location.kind !== 'transit' || ship.location.arrives > state.week) continue
    const at = ship.location.to
    ship.location = { kind: 'world', world: at }
    hullArrivedEvent(state, at, ship)
    landed.push(id)
  }
  return landed
}

/**
 * The week's arrivals unload, if they are still here to do it. Cargo comes
 * off before anything departs, so a packet that turns straight around can
 * carry on what just arrived.
 */
export function unloadArrivals(state: GameState, landed: ShipId[]): void {
  for (const id of landed) {
    const ship = state.ships[id]
    if (!ship || ship.location.kind !== 'world') continue
    const at = ship.location.world
    unloadMail(state, ship, at)
    onArrival(state, ship, at)
  }
}

/** Every commander in a system where something happened this week writes home about it. */
export function afterActionReports(state: GameState): void {
  const ids = Object.keys(state.ships).sort() as ShipId[]
  for (const id of ids) {
    const ship = state.ships[id]
    if (!ship.commander || ship.location.kind !== 'world') continue
    const at = ship.location.world
    const action = eventsAt(state, at, state.week, state.week).some((e) => ['battle', 'ship_robbed', 'ship_captured', 'ship_destroyed', 'pirate_seized', 'world_fell', 'world_taken'].includes(e.kind))
    if (action) commanderReport(state, ship, at)
  }
}

/**
 * Landing: a commander at any friendly port on the lanes writes home by
 * the next packet, so the desk can follow a hull from port to port. Off the
 * lanes they write only where the order was taking them, and carry it.
 */
function onArrival(state: GameState, ship: Ship, at: WorldId): void {
  const order = ship.order
  if (order?.kind === 'patrol' && order.world === at && order.began === null) order.began = state.week
  if (order?.kind === 'scout' && order.world === at && order.lookedOn === null) order.lookedOn = state.week
  if (order?.kind === 'transport' && order.to === at && order.loaded) {
    unloadCargo(state, ship, at, order)
    ship.order = afterwards(ship, order.then)
  }
  disembarkAtHome(state, ship, at)
  if (!ship.commander || at === capitalOf(state, ship.faction)) return
  if (friendlyPort(state, ship, at) || orderDestination(order) === at) commanderReport(state, ship, at)
}

/** Ships in port decide whether this is a departure week; those that go take the mail and jump. */
export function departShips(state: GameState): void {
  const ids = Object.keys(state.ships).sort() as ShipId[]
  for (const id of ids) {
    const ship = state.ships[id]
    if (ship.location.kind !== 'world') continue
    // No officer aboard: a packet runs her lane regardless, a prize sails for the rendezvous under her prize crew, anything else waits.
    if (ship.commander === null && !(ship.role === 'packet' && ship.order?.kind === 'courier') && ship.order?.kind !== 'move') continue
    const from = ship.location.world
    const wasPatrolling = ship.order?.kind === 'patrol' && ship.order.world === from && ship.order.began !== null
    const target = orderTarget(state, ship, from)
    if (wasPatrolling && ship.order?.kind !== 'patrol') commanderReport(state, ship, from)
    if (!target || target === from) continue
    const path = shipRoute(state, ship, from, target)
    if (!path || path.length < 2) {
      // Nowhere to go from here: hold and wait for new orders. (Phase 1b: send a courier saying so.)
      ship.order = { kind: 'hold' }
      continue
    }
    const to = path[1]
    const lane = laneBetween(state.lanes, from, to)
    // Packets keep the lane's timetable, and are held back only once their seat has heard the far port is closed to them;
    // anything else sails as soon as it can.
    if (ship.role === 'packet' && lane && nextDeparture(lane, from, state.week) !== state.week) continue
    if (ship.role === 'packet' && believedClosed(state, to, ship.faction)) continue
    loadMail(state, ship, from, to, path)
    takeOnWaiting(state, ship, from)
    hullDepartedEvent(state, from, ship)
    ship.location = { kind: 'transit', from, to, arrives: state.week + 1 }
  }
}
