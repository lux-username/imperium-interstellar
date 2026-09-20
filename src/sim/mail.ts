/**
 * Mail: how reports and dispatches are written, carried and delivered.
 *
 * A piece of mail is handed in at a world and waits there for the next hull
 * departing along the first leg of its route. At each stop it is unloaded;
 * if that stop is its destination it is delivered, otherwise it waits again
 * for the next hull along the next leg. The arithmetic the whole game rests
 * on is: arrival = written + waiting + one week per jump.
 */
import type { CharacterId, DispatchId, GameState, Mail, MailId, ReportId, Ship, ShipId, Week, World, WorldId } from './types'
import type { Dispatch, DispatchPayload, Envelope, Recipient, Report, Snapshot } from './view'
import { expectedArrival, laneBetween, nextDeparture, route } from './chart'

// ---------------------------------------------------------------------------
// Minting

function mint<K extends string>(state: GameState, prefix: string): K {
  const id = `${prefix}-${state.nextId}` as K
  state.nextId += 1
  return id
}

/**
 * Postmark for mail handed in at `origin` on `sent`. Mail written during
 * the week's events can catch that week's departures; mail the player posts
 * between weeks has missed them and goes out with the next week's.
 */
function envelope(state: GameState, origin: WorldId, destination: WorldId, sent: Week): Envelope {
  const path = route(state.lanes, origin, destination) ?? [origin]
  return {
    origin,
    destination: { kind: 'world', world: destination },
    sent,
    route: path,
    eta: path.length > 1 ? expectedArrival(state.lanes, path, sent) : path[0] === destination ? sent : null,
  }
}

// ---------------------------------------------------------------------------
// Snapshots: what an observer at a world can see there.

export function snapshotWorld(state: GameState, world: World): Snapshot {
  const { id, name, hex, profile, faction, governor, unrest, garrison } = world
  const governorName = governor ? (state.characters[governor]?.name ?? null) : null
  return { kind: 'world', world: { id, name, hex: { ...hex }, profile: { ...profile }, faction, governor, governorName, unrest, garrison } }
}

export function snapshotShip(ship: Ship, at: WorldId): Snapshot {
  const { id, name, role, faction, commander } = ship
  return { kind: 'ship', ship: { id, name, role, faction, at, commander } }
}

/** Ships in port at a world right now. */
export function shipsAt(state: GameState, world: WorldId): Ship[] {
  return Object.values(state.ships)
    .filter((s) => s.location.kind === 'world' && s.location.world === world)
    .sort((a, b) => (a.id < b.id ? -1 : 1))
}

// ---------------------------------------------------------------------------
// Writing

/**
 * An observer at `at` writes a report of `snapshot` addressed to the
 * capital and hands it to the port. Returns the mail. If `at` is the capital
 * itself the report is delivered on the spot.
 */
export function writeReport(state: GameState, observer: CharacterId, at: WorldId, snapshot: Snapshot): Mail {
  const report: Report = {
    id: mint<ReportId>(state, 'r'),
    observer,
    observerName: state.characters[observer]?.name ?? 'Unknown',
    observedAt: at,
    observed: state.week,
    snapshot,
    envelope: envelope(state, at, state.capital, state.week),
    delivered: null,
  }
  const mail: Mail = { id: mint<MailId>(state, 'm'), contents: { kind: 'report', report }, status: { kind: 'awaiting_carrier', at } }
  state.mail[mail.id] = mail
  if (at === state.capital) deliver(state, mail, at)
  return mail
}

/** Everything a governor puts in the bag when they write home: their world, and every hull in port. */
export function governorReports(state: GameState, world: World): Mail[] {
  const governor = world.actingGovernor
  if (!governor) return []
  const out = [writeReport(state, governor, world.id, snapshotWorld(state, world))]
  for (const ship of shipsAt(state, world.id)) out.push(writeReport(state, governor, world.id, snapshotShip(ship, world.id)))
  return out
}

/** The player at the capital writes a dispatch to someone at `to` and hands it to the port. */
export function postDispatch(state: GameState, recipient: Recipient, to: WorldId, payload: DispatchPayload): Mail {
  const dispatch: Dispatch = {
    id: mint<DispatchId>(state, 'd'),
    sender: state.player,
    recipient,
    payload,
    envelope: envelope(state, state.capital, to, to === state.capital ? state.week : state.week + 1),
  }
  const mail: Mail = {
    id: mint<MailId>(state, 'm'),
    contents: { kind: 'dispatch', dispatch },
    status: { kind: 'awaiting_carrier', at: state.capital },
  }
  state.mail[mail.id] = mail
  if (to === state.capital) deliver(state, mail, to)
  return mail
}

// ---------------------------------------------------------------------------
// Carrying

function nextHop(mail: Mail, at: WorldId): WorldId | null {
  const env = mail.contents.kind === 'report' ? mail.contents.report.envelope : mail.contents.dispatch.envelope
  const i = env.route.indexOf(at)
  return i >= 0 && i + 1 < env.route.length ? env.route[i + 1] : null
}

function destinationWorld(mail: Mail): WorldId | null {
  const env = mail.contents.kind === 'report' ? mail.contents.report.envelope : mail.contents.dispatch.envelope
  return env.destination.kind === 'world' ? env.destination.world : null
}

/** A ship about to jump from `from` to `to` takes everything at `from` whose next leg is that jump. */
export function loadMail(state: GameState, ship: Ship, from: WorldId, to: WorldId): void {
  for (const mail of Object.values(state.mail)) {
    if (mail.status.kind !== 'awaiting_carrier' || mail.status.at !== from) continue
    if (nextHop(mail, from) !== to) continue
    mail.status = { kind: 'aboard', ship: ship.id }
    ship.mailbag.push(mail.id)
  }
}

/** A ship has arrived at `at`: everything aboard comes off and is delivered, held, or set down for the next leg. */
export function unloadMail(state: GameState, ship: Ship, at: WorldId): void {
  const bag = ship.mailbag
  ship.mailbag = []
  for (const id of bag) {
    const mail = state.mail[id]
    if (destinationWorld(mail) === at) deliver(state, mail, at)
    else mail.status = { kind: 'awaiting_carrier', at }
  }
}

// ---------------------------------------------------------------------------
// Delivery

/** Where a character is right now, if they are at a world. Phase 0 characters are governors, so: their world. */
export function characterLocation(state: GameState, character: CharacterId): WorldId | null {
  const c = state.characters[character]
  if (!c) return null
  if (c.post.kind === 'governor') return c.post.world
  if (c.post.kind === 'commander') {
    const loc = state.ships[c.post.ship]?.location
    return loc?.kind === 'world' ? loc.world : null
  }
  return null
}

/**
 * Whether a dispatch can be handed over at `at`. A ship must actually be in
 * port. A person must be there too — except that a letter addressed to a
 * world's governor is delivered to the governor's office, whoever now sits
 * in it: the desk may not know the name has changed.
 */
function recipientAt(state: GameState, dispatch: Dispatch, at: WorldId): boolean {
  const { recipient, envelope: env } = dispatch
  if (recipient.kind === 'ship') {
    const loc = state.ships[recipient.ship]?.location
    return loc?.kind === 'world' && loc.world === at
  }
  if (characterLocation(state, recipient.character) === at) return true
  const office = env.destination.kind === 'world' && env.destination.world === at && state.worlds[at]?.actingGovernor !== null
  const addressee = state.characters[recipient.character]
  return office && addressee !== undefined && addressee.post.kind !== 'commander'
}

/**
 * Mail has reached its address. A report goes to whoever holds the seal
 * there and updates their belief; a dispatch reaches its recipient if they
 * are present, otherwise it is held at the port for them.
 */
export function deliver(state: GameState, mail: Mail, at: WorldId): void {
  if (mail.contents.kind === 'report') {
    const reader = state.worlds[at]?.actingGovernor
    if (!reader) {
      mail.status = { kind: 'held', at, expires: null }
      return
    }
    const report = mail.contents.report
    report.delivered = state.week
    mail.status = { kind: 'delivered', week: state.week }
    learn(state, reader, report)
    return
  }
  const dispatch = mail.contents.dispatch
  if (!recipientAt(state, dispatch, at)) {
    mail.status = { kind: 'held', at, expires: null }
    return
  }
  mail.status = { kind: 'delivered', week: state.week }
  receiveDispatch(state, dispatch, at)
}

/** Held dispatches are re-offered each week in case the recipient has turned up. */
export function deliverHeld(state: GameState): void {
  for (const mail of Object.values(state.mail)) {
    if (mail.status.kind !== 'held') continue
    if (mail.status.expires !== null && state.week > mail.status.expires) {
      mail.status = { kind: 'lost', week: state.week }
      continue
    }
    if (mail.contents.kind === 'dispatch' && recipientAt(state, mail.contents.dispatch, mail.status.at)) {
      deliver(state, mail, mail.status.at)
    }
  }
}

/** A report enters a reader's belief if it is newer than what they already know about its subject. */
export function learn(state: GameState, reader: CharacterId, report: Report): void {
  const belief = (state.beliefs[reader] ??= { worlds: {}, ships: {} })
  const table = report.snapshot.kind === 'world' ? belief.worlds : belief.ships
  const key = report.snapshot.kind === 'world' ? report.snapshot.world.id : report.snapshot.ship.id
  const known = (table as Record<string, Report>)[key]
  if (!known || report.observed >= known.observed) (table as Record<string, Report>)[key] = report
}

/** What a recipient does on reading a dispatch. Phase 0: a letter to a governor prompts a fresh report home. */
function receiveDispatch(state: GameState, dispatch: Dispatch, at: WorldId): void {
  if (dispatch.payload.kind === 'letter' && dispatch.recipient.kind === 'character') {
    const world = state.worlds[at]
    if (world && world.actingGovernor) governorReports(state, world)
  }
  // Orders and appointments are Phase 1: acknowledged by delivery, acted on by nobody yet.
}

// ---------------------------------------------------------------------------
// Ship movement along lanes

/**
 * Ships that have landed this week. Cargo comes off before anything departs,
 * so a packet that turns straight around can carry on what just arrived.
 */
export function arriveShips(state: GameState): void {
  for (const ship of Object.values(state.ships)) {
    if (ship.location.kind !== 'transit' || ship.location.arrives > state.week) continue
    const at = ship.location.to
    ship.location = { kind: 'world', world: at }
    unloadMail(state, ship, at)
  }
}

/** Where a courier goes next, or null to stay. */
function courierNext(ship: Ship, at: WorldId): WorldId | null {
  if (!ship.order || ship.order.kind !== 'courier') return null
  const { route: path, repeat } = ship.order
  const i = path.indexOf(at)
  if (i < 0) return path[0] ?? null
  if (i + 1 < path.length) return path[i + 1]
  return repeat ? path[0] : null
}

/** Ships in port decide whether this is a departure week; those that go take the mail and jump. */
export function departShips(state: GameState): void {
  const ids = Object.keys(state.ships).sort() as ShipId[]
  for (const id of ids) {
    const ship = state.ships[id]
    if (ship.location.kind !== 'world') continue
    const from = ship.location.world
    const to = courierNext(ship, from)
    if (!to || to === from) continue
    const lane = laneBetween(state.lanes, from, to)
    // Packets keep the lane's timetable; anything else sails as soon as it can.
    if (ship.role === 'packet' && lane && nextDeparture(lane, from, state.week) !== state.week) continue
    loadMail(state, ship, from, to)
    ship.location = { kind: 'transit', from, to, arrives: state.week + 1 }
  }
}
