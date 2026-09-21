/**
 * Mail: how reports and dispatches are written, carried and delivered.
 *
 * A piece of mail is handed in at a world and waits there for the next hull
 * departing along the first leg of its route. At each stop it is unloaded;
 * if that stop is its destination it is delivered, otherwise it waits again
 * for the next hull along the next leg. The arithmetic the whole game rests
 * on is: arrival = written + waiting + one week per jump.
 */
import type { CharacterId, DispatchId, GameState, Mail, MailId, ReportId, Ship, Week, World, WorldId } from './types'
import type { Order } from './orders'
import type { Channel, Dispatch, DispatchPayload, Envelope, Event, Recipient, Report, ShipSnapshot, Snapshot } from './view'
import { expectedArrival, route } from './chart'
import { dispatchReceivedEvent } from './events'
import { capitalOf } from './factions'

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

export function snapshotShip(ship: Ship, at: WorldId): ShipSnapshot {
  const { id, name, role, faction, commander } = ship
  return { id, name, role, faction, at, commander, damaged: ship.damage > 0 }
}

/** A world as seen from its own port this week: its state and every hull lying there. */
export function snapshotWorld(state: GameState, world: World): Snapshot {
  const { id, name, hex, profile, faction, governor, unrest, garrison, marines } = world
  const governorName = governor ? (state.characters[governor]?.name ?? null) : null
  const ships = shipsAt(state, id).map((s) => snapshotShip(s, id))
  const contest = world.contest ? { attacker: world.contest.attacker, strength: world.contest.attackers.army + world.contest.attackers.marines } : null
  return { kind: 'world', world: { id, name, hex: { ...hex }, profile: { ...profile }, faction, governor, governorName, unrest, garrison, marines, contest, ships } }
}

/** Ships in port at a world right now. */
export function shipsAt(state: GameState, world: WorldId): Ship[] {
  return Object.values(state.ships)
    .filter((s) => s.location.kind === 'world' && s.location.world === world)
    .sort((a, b) => (a.id < b.id ? -1 : 1))
}

// ---------------------------------------------------------------------------
// Writing

export interface Writing {
  channel?: Channel
  /** The events the writer chose to mention. */
  events?: Event[]
  observerName?: string
}

/**
 * An observer at `at` writes a report of `snapshot` addressed to their
 * faction's seat — the desk, for the player's people — and hands it to the
 * port. Returns the mail. If `at` is the seat itself the report is
 * delivered on the spot.
 */
export function writeReport(state: GameState, observer: CharacterId, at: WorldId, snapshot: Snapshot, writing: Writing = {}): Mail {
  const faction = state.characters[observer]?.faction
  const home = (faction && capitalOf(state, faction)) ?? state.capital
  const report: Report = {
    id: mint<ReportId>(state, 'r'),
    channel: writing.channel ?? 'official',
    observer,
    observerName: writing.observerName ?? state.characters[observer]?.name ?? 'Unknown',
    observedAt: at,
    observed: state.week,
    snapshot,
    events: writing.events ?? [],
    envelope: envelope(state, at, home, state.week),
    delivered: null,
  }
  const mail: Mail = { id: mint<MailId>(state, 'm'), contents: { kind: 'report', report }, status: { kind: 'awaiting_carrier', at } }
  state.mail[mail.id] = mail
  if (at === home) deliver(state, mail, at)
  return mail
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

function envelopeOf(mail: Mail): Envelope {
  return mail.contents.kind === 'report' ? mail.contents.report.envelope : mail.contents.dispatch.envelope
}

/** Letters a port holds for the newest few; older ones nobody has collected are thrown out. */
export const MAILBAG_CAP = 6

/** The report ids already in a ship's hold, so it never carries two copies of one letter. */
function reportsAboard(state: GameState, ship: Ship): Set<string> {
  const ids = new Set<string>()
  for (const id of ship.mailbag) {
    const m = state.mail[id]
    if (m?.contents.kind === 'report') ids.add(m.contents.report.id)
  }
  return ids
}

/**
 * Whether a hull following `path` can get mail to `dest`: it will call at
 * `dest` itself, or at some port on a lane network that reaches it.
 */
function pathReaches(state: GameState, path: WorldId[], dest: WorldId): boolean {
  return path.slice(1).some((w) => w === dest || route(state.lanes, w, dest) !== null)
}

/**
 * A ship about to jump from `from` to `to` takes everything at `from` whose
 * next leg is that jump. A hull someone sent on purpose — with `path` the
 * run it is making — also takes a *copy* of every report lying at the port
 * for the desk (the original waits for its packet) and takes outright
 * whatever has no scheduled way home; but only when its run calls at the
 * destination or at a port on lanes that reach it. A hull bound the wrong
 * way leaves the letters where they are.
 */
export function loadMail(state: GameState, ship: Ship, from: WorldId, to: WorldId, path: WorldId[] = [from, to]): void {
  // The port hands its bags only to hulls of its own side.
  if (state.worlds[from]?.faction !== ship.faction) return
  const ids = Object.keys(state.mail).sort() as MailId[]
  const carrying = ship.role === 'packet' ? null : reportsAboard(state, ship)
  for (const id of ids) {
    const mail = state.mail[id]
    if (mail.status.kind !== 'awaiting_carrier' || mail.status.at !== from) continue
    const dest = destinationWorld(mail)
    const hop = nextHop(mail, from)
    if (hop === to) {
      mail.status = { kind: 'aboard', ship: ship.id }
      ship.mailbag.push(mail.id)
      continue
    }
    if (!carrying || dest === null || dest === from || !pathReaches(state, path, dest)) continue
    if (hop === null) {
      // Stranded: nothing scheduled will ever take it, so this hull does.
      mail.status = { kind: 'aboard', ship: ship.id }
      ship.mailbag.push(mail.id)
    } else if (mail.contents.kind === 'report' && dest === state.capital && mail.contents.report.observer !== ship.commander) {
      // A copy for the hull; the port keeps the original for the packet.
      if (carrying.has(mail.contents.report.id)) continue
      const copy: Mail = {
        id: mint<MailId>(state, 'm'),
        contents: { kind: 'report', report: JSON.parse(JSON.stringify(mail.contents.report)) as Report },
        status: { kind: 'aboard', ship: ship.id },
      }
      state.mail[copy.id] = copy
      ship.mailbag.push(copy.id)
      carrying.add(mail.contents.report.id)
    }
  }
}

/** Whether a report with this id has already reached a reader somewhere. */
function alreadyDelivered(state: GameState, reportId: string): boolean {
  for (const m of Object.values(state.mail)) {
    if (m.contents.kind === 'report' && m.contents.report.id === reportId && m.status.kind === 'delivered') return true
  }
  return false
}

/**
 * A ship has arrived at `at`: everything aboard comes off and is delivered
 * or set down for the next leg. Mail that got here off its planned route is
 * re-routed from here; if no lane leads on from here it stays aboard.
 */
export function unloadMail(state: GameState, ship: Ship, at: WorldId): void {
  const bag = ship.mailbag
  ship.mailbag = []
  for (const id of bag) {
    const mail = state.mail[id]
    const dest = destinationWorld(mail)
    if (dest === at) {
      deliver(state, mail, at)
      continue
    }
    const env = envelopeOf(mail)
    if (!env.route.includes(at) && dest !== null) {
      const path = route(state.lanes, at, dest)
      if (!path) {
        ship.mailbag.push(id)
        continue
      }
      env.route = path
      env.eta ??= expectedArrival(state.lanes, path, state.week)
    }
    mail.status = { kind: 'awaiting_carrier', at }
  }
}

/** Ports throw out reports nobody has collected beyond the newest few. The capital keeps everything: that is the desk's outgoing tray. */
export function pruneMail(state: GameState): void {
  const waiting: Record<string, Mail[]> = {}
  for (const mail of Object.values(state.mail)) {
    if (mail.status.kind !== 'awaiting_carrier' || mail.status.at === state.capital || mail.contents.kind !== 'report') continue
    ;(waiting[mail.status.at] ??= []).push(mail)
  }
  for (const pile of Object.values(waiting)) {
    if (pile.length <= MAILBAG_CAP) continue
    pile.sort((a, b) => envelopeOf(b).sent - envelopeOf(a).sent || (a.id < b.id ? 1 : -1))
    for (const mail of pile.slice(MAILBAG_CAP)) delete state.mail[mail.id]
  }
}

// ---------------------------------------------------------------------------
// Delivery

/** Where a character is right now, if they are at a world. Phase 0 characters are governors, so: their world. */
export function characterLocation(state: GameState, character: CharacterId): WorldId | null {
  const c = state.characters[character]
  if (!c) return null
  if (c.post.kind === 'governor' || c.post.kind === 'watching') return c.post.world
  if (c.post.kind === 'unassigned') return c.post.at
  const loc = state.ships[c.post.ship]?.location
  return loc?.kind === 'world' ? loc.world : null
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
    // A second copy of a letter already read is thrown away, whichever copy came first.
    if (alreadyDelivered(state, report.id)) {
      delete state.mail[mail.id]
      return
    }
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

/**
 * A report enters a reader's belief where it is newer than what they already
 * know. A world report updates the world and every hull it lists in port.
 */
export function learn(state: GameState, reader: CharacterId, report: Report): void {
  const belief = (state.beliefs[reader] ??= { worlds: {}, ships: {} })
  const sight = (ship: ShipSnapshot) => {
    const known = belief.ships[ship.id]
    if (!known || report.observed >= known.observed) belief.ships[ship.id] = { ship, observed: report.observed, report: report.id }
  }
  if (report.snapshot.kind === 'ship') {
    sight(report.snapshot.ship)
    return
  }
  // Talk is not knowledge: a rumour goes in the rumours pile and nowhere else, so the map never rests on it.
  if (report.snapshot.kind === 'event') return
  const world = report.snapshot.world
  const known = belief.worlds[world.id]
  if (!known || report.observed >= known.observed) belief.worlds[world.id] = report
  for (const ship of world.ships) sight(ship)
}

/**
 * What a recipient does on reading a dispatch. A letter to a governor's
 * office is recorded as an event, and the governor answers it when they
 * write this week (see ./governors.ts); an order to a ship replaces what
 * it was doing, from the beginning. Appointments are Phase 1b.
 */
function receiveDispatch(state: GameState, dispatch: Dispatch, at: WorldId): void {
  const { payload, recipient } = dispatch
  if (payload.kind === 'letter' && recipient.kind === 'character' && at !== state.capital) dispatchReceivedEvent(state, at)
  if (payload.kind === 'order' && recipient.kind === 'ship') {
    const ship = state.ships[recipient.ship]
    if (ship) {
      ship.order = JSON.parse(JSON.stringify(payload.order)) as Order
      if (payload.standing) ship.standing = { ...ship.standing, ...payload.standing }
    }
  }
}
