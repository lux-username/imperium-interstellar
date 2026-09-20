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
import type { Order } from './orders'
import type {
  Address,
  CharacterId,
  DispatchId,
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
  FactionId,
  Hex,
  Lane,
  LaneId,
  Order,
  Post,
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
}

export interface ShipSnapshot {
  id: ShipId
  name: string
  role: ShipRole
  faction: FactionId
  /** The world it was seen at. A ship in jump is seen by nobody. */
  at: WorldId
  commander: CharacterId | null
}

export type Snapshot =
  | { kind: 'world'; world: WorldSnapshot }
  | { kind: 'ship'; ship: ShipSnapshot }

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

export interface Report {
  id: ReportId
  observer: CharacterId
  observerName: string
  /** Where the observation was made. Can differ from `envelope.origin` when a ship saw something and posted it from its next port. */
  observedAt: WorldId
  observed: Week
  snapshot: Snapshot
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

export interface Belief {
  /** Newest delivered report about each world. */
  worlds: Record<WorldId, Report>
  /** Newest delivered report about each ship. */
  ships: Record<ShipId, Report>
}

/** A world's entry on the star chart: where it is and what it is called. Public, like the lanes. */
export interface ChartEntry {
  id: WorldId
  name: string
  hex: Hex
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
  /** Everything that has reached the desk, newest arrival first. This week's news is whatever has `delivered === week`. */
  inbox: Report[]
  /** Dispatches the player has sent, newest first. Their fate is unknown until a report says otherwise. */
  outgoing: Dispatch[]
}
