/**
 * What the player is allowed to see.
 *
 * The UI imports from this file (and the grid geometry in ./hex.ts) and
 * nothing else in src/sim. Everything exported here is either a delivered
 * report, something the player wrote, or public knowledge like the lane chart. A report carries a *snapshot* of what
 * an observer saw, never the ground-truth record itself, so a stale or
 * self-serving report is a first-class object rather than a lie about the
 * real thing.
 */
import type { Hex } from './hex'
import type { Order, Posture } from './orders'
import type {
  Address,
  CharacterId,
  DispatchId,
  EventId,
  FactionId,
  Lane,
  LaneId,
  Post,
  ReportId,
  ShipId,
  ShipRole,
  StarportClass,
  Week,
  WorldId,
  WorldProfile,
} from './types'

// Timetable arithmetic over the public chart, so the UI can tell the player
// when a letter should land using the same sums the sim uses.
export { expectedArrival, route } from './chart'

// The public-knowledge primitives the UI needs, re-exported so it never has
// a reason to reach into types.ts.
export type {
  Address,
  CharacterId,
  DispatchId,
  EventId,
  FactionId,
  Hex,
  Lane,
  LaneId,
  Order,
  Post,
  Posture,
  ReportId,
  ShipId,
  ShipRole,
  StarportClass,
  Week,
  WorldId,
  WorldProfile,
}

// ---------------------------------------------------------------------------
// Snapshots: an entity as it appeared to someone, somewhere, once.

export interface ShipSnapshot {
  id: ShipId
  name: string
  role: ShipRole
  faction: FactionId
  /** The world it was seen at. A ship in jump is seen by nobody. */
  at: WorldId
  commander: CharacterId | null
}

export interface WorldSnapshot {
  id: WorldId
  name: string
  hex: Hex
  profile: WorldProfile
  faction: FactionId
  governor: CharacterId | null
  /** As the observer knew it; carried in the snapshot so the desk learns a new name only when a report says so. */
  governorName: string | null
  unrest: number
  garrison: number
  /** Hulls in port when the observation was made. One report carries the world and its traffic together. */
  ships: ShipSnapshot[]
}

// ---------------------------------------------------------------------------
// Events: something that happened, as it may be told.

export type EventKind = 'unrest_rose' | 'unrest_fell' | 'governor_changed' | 'hull_arrived' | 'hull_departed' | 'dispatch_received'

/** Good or bad for whoever hears it; neutral is routine traffic nobody writes home about. */
export type Valence = 'good' | 'bad' | 'neutral'

/**
 * An occurrence at a world on a week. Ground truth keeps the originals in
 * GameState.events; a report carries a copy, which for a rumour may be
 * vaguer than the original about when and where.
 */
export interface Event {
  id: EventId
  at: WorldId
  week: Week
  kind: EventKind
  valence: Valence
  /** 0 (nothing) to 3 (serious). Drives whether a governor mentions it and how far a rumour travels. */
  severity: number
  /** The hull concerned, if any, as it appeared. */
  ship: ShipSnapshot | null
  /** The person concerned, if any, by name. */
  person: string | null
  /** The new level after a step, for unrest and the like. */
  level: number | null
}

export type Snapshot =
  | { kind: 'world'; world: WorldSnapshot }
  | { kind: 'ship'; ship: ShipSnapshot }
  /** A rumour: one event, as told. */
  | { kind: 'event'; event: Event }

// ---------------------------------------------------------------------------
// The postmark shared by everything that travels by hull.

export interface Envelope {
  /** Where it was handed to a carrier. */
  origin: WorldId
  destination: Address
  sent: Week
  /** The worlds it was planned to pass through, origin first. */
  route: WorldId[]
  /** When it was expected to arrive, if anyone could say. */
  eta: Week | null
}

// ---------------------------------------------------------------------------
// Reports: observations travelling toward the player.

/**
 * How a report came. This is all the player legitimately knows about its
 * provenance: who said it and by what route. There is no reliability score —
 * distortion is baked into the content when the report is written and never
 * recorded on it.
 */
export type Channel =
  /** A governor's or commander's own letter. */
  | 'official'
  /** One of the player's agents on the spot. */
  | 'agent'
  /** A trader's word at a port. */
  | 'merchant'
  /** Talk nobody will put a name to. */
  | 'docks'

export function isRumour(channel: Channel): boolean {
  return channel === 'merchant' || channel === 'docks'
}

export interface Report {
  id: ReportId
  channel: Channel
  observer: CharacterId
  observerName: string
  /** Where the observation was made. Can differ from `envelope.origin` when a ship saw something and posted it from its next port. */
  observedAt: WorldId
  observed: Week
  snapshot: Snapshot
  /** The events the writer chose to mention. A letter says what happened; the snapshot says how things stand. */
  events: Event[]
  envelope: Envelope
  /** Set when it reaches the desk. Age at reading is `week - observed`. */
  delivered: Week | null
}

// ---------------------------------------------------------------------------
// Dispatches: instructions travelling away from the player.

export type Recipient =
  | { kind: 'character'; character: CharacterId }
  | { kind: 'ship'; ship: ShipId }

export type DispatchPayload =
  | { kind: 'order'; ship: ShipId; order: Order }
  | { kind: 'appointment'; character: CharacterId; post: Post }
  | { kind: 'letter'; text: string }

export interface Dispatch {
  id: DispatchId
  sender: CharacterId
  recipient: Recipient
  payload: DispatchPayload
  envelope: Envelope
}

// ---------------------------------------------------------------------------
// Belief: what one person knows, which is only what has been delivered to them.

/** The newest word of a ship: where and when it was seen, and by which report. */
export interface Sighting {
  ship: ShipSnapshot
  observed: Week
  report: ReportId
}

export interface Belief {
  /** Newest delivered report about each world. */
  worlds: Record<WorldId, Report>
  /** Newest sighting of each ship, drawn from world reports (hulls in port) and any report about the ship itself. */
  ships: Record<ShipId, Sighting>
}

/** A world's entry on the star chart: where it is and what it is called. Public, like the lanes. */
export interface ChartEntry {
  id: WorldId
  name: string
  hex: Hex
}

/**
 * A hull on the desk's books: what it is and who was given it. Where it is
 * and what it is doing are belief, in `known.ships` and `outgoing`.
 */
export interface RosterEntry {
  id: ShipId
  name: string
  role: ShipRole
  jump: number
  commanderName: string | null
}

/**
 * The player's whole picture, rebuilt each week from their belief state and
 * their own outgoing mail. This is the only thing the UI renders.
 */
export interface PlayerView {
  week: Week
  capital: WorldId
  /** The lane chart is public knowledge and never stale. */
  lanes: Lane[]
  /** Every world's name and position. What is *happening* there is only in `known`. */
  chart: Record<WorldId, ChartEntry>
  known: Belief
  /** The hulls the desk commands, as listed on its books. Their whereabouts are in `known.ships`. */
  roster: RosterEntry[]
  /** Every official and agent report that has reached the desk, newest arrival first. This week's news is whatever has `delivered === week`. */
  inbox: Report[]
  /** What the docks are saying: merchant and docks-channel reports, kept apart from the mail so the two piles are never confused. */
  rumours: Report[]
  /** Dispatches the player has sent, newest first. Their fate is unknown until a report says otherwise. */
  outgoing: Dispatch[]
}
