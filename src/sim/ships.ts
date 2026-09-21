/**
 * Ships under way: what an order says to do next, how a hull gets there,
 * and what its commander writes when it arrives. Packets keep the lanes'
 * timetables; everything else sails as soon as it has somewhere to go.
 *
 * A charted route is preferred. A hull someone sent on purpose may also
 * jump off-lane to any world within its jump rating — that is what makes
 * scouts and warships worth having. Every jump costs a tank of fuel, and
 * only a port of class C or better that is open to her fills them: a hull
 * down to her last jump makes for fuel — her rendezvous if it will serve —
 * before anything else, and one with none sits where she is.
 */
import { hexRoute, laneBetween, nextDeparture, route } from './chart'
import { isBold, isCautious } from './characters'
import { burnsFuel, crewed, fuelCapacity } from './fleet'
import { PIRATES, THE_SCOUTS } from './factions'
import { hexDistance } from './hex'
import { eventsAt, hullArrivedEvent, hullDepartedEvent, recordEvent } from './events'
import { capitalOf, hostile } from './factions'
import type { Occasion } from './letters'
import { loadMail, snapshotWorld, unloadMail, writeReport } from './mail'
import { check } from './rng'
import { watchReport } from './scouts'
import { disembarkAtHome, loadCargo, takeOnWaiting, unloadCargo } from './troops'
import { impound } from './world'
import type { Address, CharacterId, GameState, Ship, ShipId, WorldId } from './types'
import type { Order } from './orders'
import type { Event } from './view'

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
          commanderReport(state, ship, at, 'look')
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
 * Whether the port a packet is leaving *knows* the far port is closed to
 * her side. Nothing travels faster than a hull: a port knows a world has
 * fallen only when the talk of it has reached its own docks along the
 * lanes — or, at a faction's seat, when the seat's own reports say so.
 * Until then the packet sails as usual, and is impounded on arrival.
 */
export function portKnowsClosed(state: GameState, from: WorldId, to: WorldId, faction: Ship['faction']): boolean {
  const fell = (kind: string) => kind === 'world_fell' || kind === 'world_taken'
  if (state.rumours.some((r) => r.event.at === to && fell(r.event.kind) && from in r.heard)) return true
  if (state.factions[faction]?.capital !== from) return false
  const leader = state.factions[faction]?.leader
  const known = leader ? state.beliefs[leader]?.worlds[to] : undefined
  return known?.snapshot.kind === 'world' && hostile(known.snapshot.world.faction, faction)
}

/**
 * A packet that docks at a port held against her side is taken at the
 * quay; scouts and warships stay in orbit and are not. Runs on this week's
 * arrivals after the encounters.
 */
export function impoundAtPorts(state: GameState, landed: readonly ShipId[]): void {
  for (const id of landed) {
    const ship = state.ships[id]
    if (!ship || ship.location.kind !== 'world') continue
    if (ship.role !== 'packet') continue
    const world = state.worlds[ship.location.world]
    if (!hostile(world.faction, ship.faction) || !world.actingGovernor) continue
    recordEvent(state, world.id, { kind: 'ship_captured', valence: 'neutral', against: ship.faction, favours: world.faction, severity: 2, ship })
    impound(state, ship, world.faction)
  }
}

/**
 * Whether a hull can fill her tanks here: a port of class C or better that
 * is open to her side — for a pirate, a haven she knows of that class. A C
 * port has only unrefined fuel, but fuel is fuel.
 */
export function refuelsAt(state: GameState, ship: Ship, at: WorldId): boolean {
  const world = state.worlds[at]
  if (!world || !['A', 'B', 'C'].includes(world.profile.starport)) return false
  if (ship.faction === PIRATES) return ship.havens?.includes(at) ?? false
  return !hostile(world.faction, ship.faction)
}

/** Fill the tanks if the port will do it. Called on arrival and again before sailing, in case the port changed hands meanwhile. */
export function refuel(state: GameState, ship: Ship, at: WorldId): void {
  if (burnsFuel(ship.role) && refuelsAt(state, ship, at)) ship.fuel = fuelCapacity(ship.role)
}

/**
 * Where a hull with one jump left should go instead of `to`, if `to` has
 * no fuel for her: the nearest place within a jump that has, her
 * rendezvous first if it qualifies. Null if nowhere — she stays.
 */
export function fuelStop(state: GameState, ship: Ship, from: WorldId, to: WorldId): WorldId | null {
  if (refuelsAt(state, ship, to)) return to
  const here = state.worlds[from]
  const inRange = (Object.keys(state.worlds).sort() as WorldId[]).filter((w) => w !== from && hexDistance(state.worlds[w].hex, here.hex) <= ship.jump && refuelsAt(state, ship, w))
  if (inRange.length === 0) return null
  const rendezvous = ship.order && 'then' in ship.order && ship.order.then?.kind === 'world' ? ship.order.then.world : ship.standing.rally
  if (rendezvous && inRange.includes(rendezvous)) return rendezvous
  return inRange.sort((a, b) => hexDistance(state.worlds[a].hex, state.worlds[to].hex) - hexDistance(state.worlds[b].hex, state.worlds[to].hex) || (a < b ? -1 : 1))[0]
}

/** A port where a hull of this faction can lie safely and hand mail to the packets for home. */
export function friendlyPort(state: GameState, ship: Ship, at: WorldId): boolean {
  const world = state.worlds[at]
  const home = capitalOf(state, ship.faction)
  return world !== undefined && world.faction === ship.faction && home !== null && route(state.lanes, at, home) !== null
}

/** Whether this hull has already posted a letter this week, so an action and an arrival do not make two. Notes from questioning prisoners are not the week's letter. */
function wroteThisWeek(state: GameState, ship: Ship): boolean {
  return Object.values(state.mail).some(
    (m) => m.contents.kind === 'report' && m.contents.report.observerShipId === ship.id && m.contents.report.observed === state.week && !m.contents.report.events.every((e) => e.kind === 'haven_named'),
  )
}

/** Who signs a hull's letters: her officer, or — for a scout — nobody in particular, the hull herself. */
export function writer(ship: Ship): CharacterId {
  return ship.commander ?? THE_SCOUTS
}

/** Events a captain at `at` this week would put in a letter: anything serious, hostile hulls making port, and what befell her own hull. Own-side traffic is not news. */
function seenThisWeek(state: GameState, ship: Ship, at: WorldId): Event[] {
  const commander = ship.commander ? state.characters[ship.commander] : null
  // A self-serving commander leaves out the moments that reflect on them: their own hull breaking off or getting
  // knocked about, and the detachments that did not wake from a passage in their hold.
  const own = (e: { ship: { id: string } | null }) => e.ship?.id === ship.id
  return eventsAt(state, at, state.week, state.week)
    .filter((e) => e.severity >= 2 || (own(e) && (e.kind === 'ship_fled' || e.kind === 'ship_damaged' || e.kind === 'troops_landed' || e.kind === 'troops_lost')))
    .filter((e) => e.kind !== 'hull_departed' && !(e.kind === 'hull_arrived' && (!e.ship || !hostile(e.ship.faction, ship.faction))))
    .filter((e) => !(commander?.traits.loyalty === 'self' && own(e) && (e.kind === 'ship_fled' || e.kind === 'ship_damaged' || e.kind === 'troops_lost')))
}

/**
 * A commander writes home: what the world looks like from orbit, what is
 * in port, and anything serious that happened here this week — headed by
 * the worst of it, or by the occasion when nothing did. A general report
 * adds everything logged since the last orders. At a friendly port on the
 * lanes the letter goes by the next packet; off the lanes or over a
 * hostile world it rides with the ship until it finds a port with a lane
 * home.
 */
export function commanderReport(state: GameState, ship: Ship, at: WorldId, occasion: Occasion = 'arrival'): void {
  if (!crewed(ship) || at === capitalOf(state, ship.faction) || capitalOf(state, ship.faction) === null) return
  if (wroteThisWeek(state, ship)) return
  const world = state.worlds[at]
  const seen = seenThisWeek(state, ship, at)
  let events = seen
  if (occasion === 'general') {
    const ids = new Set(seen.map((e) => e.id))
    events = [...ship.log.filter((e) => !ids.has(e.id)), ...seen]
    ship.log = []
  }
  const mail = writeReport(state, writer(ship), at, snapshotWorld(state, world), { events, occasion, since: occasion === 'general' ? ship.lastOrders : undefined, ship: ship.id, faction: ship.faction })
  if (!friendlyPort(state, ship, at)) {
    mail.status = { kind: 'aboard', ship: ship.id }
    ship.mailbag.push(mail.id)
  }
}

/** Whether `at` is where this run ends: the order is done here and what follows it — the rendezvous or the rally point — is here or nowhere. */
export function runEndsAt(ship: Ship, at: WorldId): boolean {
  const order = ship.order
  if (!order || order.kind === 'hold') return true
  const then = 'then' in order && order.then?.kind === 'world' ? order.then.world : ship.standing.rally
  const rests = then === null || then === at
  switch (order.kind) {
    case 'move':
    case 'transport':
      return order.to === at && rests
    case 'courier':
      return !order.repeat && order.route[order.route.length - 1] === at && rests
    default:
      return false
  }
}

/** Whether this week's events at `at` include a fight the ship was in, or anything that befell her — or pirates lying at the port unmolested, which a captain always reports. */
function foughtThisWeek(ship: Ship, seen: readonly Event[]): boolean {
  return seen.some((e) => (e.ship?.id === ship.id && e.kind !== 'hull_arrived') || (e.kind === 'battle' && e.ship !== null && (hostile(e.ship.faction, ship.faction) || e.ship.faction === ship.faction)) || e.kind === 'pirates_harboured')
}

/**
 * Whether a captain sends a quick update on this week's events. A fight
 * her own hull was in is always reported. Anything else — hostile hulls
 * sighted, trouble on the world below — depends on the captain: a
 * cautious one writes at the first sign, a bold one would rather act.
 */
function sendsUpdate(state: GameState, ship: Ship, seen: readonly Event[]): boolean {
  if (seen.length === 0) return false
  if (foughtThisWeek(ship, seen)) return true
  const commander = ship.commander ? state.characters[ship.commander] : null
  const dm = commander ? (isCautious(commander) ? 3 : isBold(commander) ? -3 : 0) : 0
  return check(state.rng, 7, dm)
}

/**
 * Every ship with an officer aboard notes what happened this week where
 * she lay, for her next general report: anything of note, hostile hulls
 * making port, and whatever befell her. A hull that broke off logs the
 * fight she left. Runs before the week's sailings, so a ship in transit
 * here is one that fled.
 */
export function logWitnessed(state: GameState): void {
  const ids = Object.keys(state.ships).sort() as ShipId[]
  for (const id of ids) {
    const ship = state.ships[id]
    if (!crewed(ship)) continue
    const at = ship.location.kind === 'world' ? ship.location.world : ship.location.from
    if (at === capitalOf(state, ship.faction)) continue
    for (const e of eventsAt(state, at, state.week, state.week)) {
      if (e.severity < 1 && e.ship?.id !== ship.id) continue
      if (e.kind === 'hull_departed' || (e.kind === 'hull_arrived' && (!e.ship || !hostile(e.ship.faction, ship.faction)))) continue
      ship.log.push(JSON.parse(JSON.stringify(e)) as Event)
    }
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
    refuel(state, ship, at)
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

/**
 * Quick updates: every commander in a system where something happened this
 * week may write home about it. A fight of her own is always written up,
 * and carried if it must be; anything else only from a port where the
 * letter can be posted, and only if the captain is the writing kind.
 */
export function afterActionReports(state: GameState): void {
  const ids = Object.keys(state.ships).sort() as ShipId[]
  for (const id of ids) {
    const ship = state.ships[id]
    if (!crewed(ship) || ship.location.kind !== 'world') continue
    const at = ship.location.world
    if (at === capitalOf(state, ship.faction) || wroteThisWeek(state, ship)) continue
    const seen = seenThisWeek(state, ship, at)
    if (!foughtThisWeek(ship, seen) && !friendlyPort(state, ship, at)) continue
    if (sendsUpdate(state, ship, seen)) commanderReport(state, ship, at, 'action')
  }
}

/**
 * Landing: a commander at any friendly port on the lanes writes home by
 * the next packet, so Government House can follow a hull from port to port. Off the
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
  if (!crewed(ship) || at === capitalOf(state, ship.faction)) return
  // The rendezvous made: a general report of everything since the last orders. Elsewhere, a letter of arrival.
  if (runEndsAt(ship, at)) commanderReport(state, ship, at, 'general')
  else if (friendlyPort(state, ship, at) || orderDestination(order) === at) commanderReport(state, ship, at, 'arrival')
}

/** Ships in port decide whether this is a departure week; those that go take the mail and jump. */
export function departShips(state: GameState): void {
  const ids = Object.keys(state.ships).sort() as ShipId[]
  for (const id of ids) {
    const ship = state.ships[id]
    if (ship.location.kind !== 'world') continue
    // Nobody to act on orders: a packet runs her lane regardless, a prize sails for the rendezvous under her prize crew, anything else waits.
    if (!crewed(ship) && !(ship.role === 'packet' && ship.order?.kind === 'courier') && ship.order?.kind !== 'move') continue
    const from = ship.location.world
    const wasPatrolling = ship.order?.kind === 'patrol' && ship.order.world === from && ship.order.began !== null
    const target = orderTarget(state, ship, from)
    if (wasPatrolling && ship.order?.kind !== 'patrol') commanderReport(state, ship, from, 'patrol_done')
    if (!target || target === from) continue
    const path = shipRoute(state, ship, from, target)
    if (!path || path.length < 2) {
      // Nowhere to go from here: hold and wait for new orders. (Phase 1b: send a courier saying so.)
      ship.order = { kind: 'hold' }
      continue
    }
    let to = path[1]
    const lane = laneBetween(state.lanes, from, to)
    // Packets keep the lane's timetable, and are held back only once the port they are leaving knows the far port is
    // closed to them; anything else sails as soon as it can.
    if (ship.role === 'packet' && lane && nextDeparture(lane, from, state.week) !== state.week) continue
    if (ship.role === 'packet' && portKnowsClosed(state, from, to, ship.faction)) continue
    // Fuel: the port may have filled her since she landed; with one jump left she goes only where there is more.
    if (burnsFuel(ship.role)) {
      refuel(state, ship, from)
      if (ship.fuel <= 0) continue
      if (ship.fuel === 1) {
        const stop = fuelStop(state, ship, from, to)
        if (stop === null) continue
        to = stop
      }
    }
    loadMail(state, ship, from, to, path)
    takeOnWaiting(state, ship, from)
    hullDepartedEvent(state, from, ship)
    if (burnsFuel(ship.role)) ship.fuel -= 1
    ship.location = { kind: 'transit', from, to, arrives: state.week + 1 }
  }
}
