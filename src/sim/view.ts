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
import type { Order, Posture, Purpose } from './orders'
import type {
  Address,
  CharacterId,
  DispatchId,
  Ending,
  EventId,
  FactionId,
  FactionKind,
  Lane,
  LaneId,
  Post,
  ReportId,
  ShipId,
  ShipRole,
  StandingOrders,
  StarportClass,
  Week,
  WorldId,
  WorldProfile,
} from './types'

// Timetable arithmetic over the public chart, so the UI can tell the player
// when a letter should land using the same sums the sim uses.
export { expectedArrival, hexRoute, nextDeparture, route } from './chart'

// The wording of events and letters is the sim's, so the inbox never says
// anything a letter did not.
export { UNREST_WORDS, eventLabel, eventText, unrestWord } from './letters'

// The fold from reports to a picture, so the Home Office can ask what it now
// knows about an earlier week with the same sums the sim uses.
export { beliefFrom, knownHavens, mentionsShip } from './belief'

// The public-knowledge primitives the UI needs, re-exported so it never has
// a reason to reach into types.ts.
export type {
  Address,
  CharacterId,
  DispatchId,
  Ending,
  EventId,
  FactionId,
  Hex,
  Lane,
  LaneId,
  Order,
  Post,
  Posture,
  Purpose,
  ReportId,
  ShipId,
  ShipRole,
  StandingOrders,
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
  /** Whether she looked knocked about. */
  damaged: boolean
  /** Whether she looked a wreck: nothing left to fight with, wanting a dockyard. */
  hulk: boolean
  /** Jumps in her tanks, when the port that saw her is her own side's and knows; null otherwise. */
  fuel: number | null
}

export interface WorldSnapshot {
  id: WorldId
  name: string
  hex: Hex
  profile: WorldProfile
  faction: FactionId
  governor: CharacterId | null
  /** As the observer knew it; carried in the snapshot so the Home Office learns a new name only when a report says so. */
  governorName: string | null
  unrest: number
  garrison: number
  marines: number
  /** A fight on the ground, if one was under way: who was attacking and with how much. */
  contest: { attacker: FactionId; strength: number } | null
  /** Hulls in port when the observation was made. One report carries the world and its traffic together. */
  ships: ShipSnapshot[]
}

/** How a world stands, as far as a snapshot can say. Loyal means held by the administration and quiet. */
export type WorldState = 'loyal' | 'unrest' | 'revolt' | 'contested' | 'independent' | 'warlord'

/**
 * Read a world's state off a snapshot, given who holds it. Pure, so the
 * map and the dossier agree with each other and with nothing else.
 */
export function worldStateOf(holder: FactionKind | undefined, contest: WorldSnapshot['contest'], unrest: number, contestantKind?: FactionKind): WorldState {
  if (holder === 'rival') return 'warlord'
  if (holder === 'rebels') return 'independent'
  if (contest) return contestantKind === 'rebels' ? 'revolt' : 'contested'
  return unrest >= 6 ? 'unrest' : 'loyal'
}

// ---------------------------------------------------------------------------
// Events: something that happened, as it may be told.

export type EventKind =
  | 'unrest_rose'
  | 'unrest_fell'
  | 'governor_changed'
  | 'hull_arrived'
  | 'hull_departed'
  | 'dispatch_received'
  /** The world rose; the garrison is fighting it. */
  | 'revolt_began'
  | 'revolt_crushed'
  /** The garrison is gone and the world has declared itself independent. `person` is the governor's fate. */
  | 'world_fell'
  | 'governor_fled'
  | 'governor_killed'
  /** Troops came down. `level` is how many detachments landed; `ship` the transport. */
  | 'troops_landed'
  /** Detachments that did not wake from the cryo passage. `level` is how many. */
  | 'troops_lost'
  /** A landing was thrown back or a garrison overcome. `ship` null; `person` the new holder's name. */
  | 'world_taken'
  | 'landing_repulsed'
  /** Hulls fought here. `ship` is the intruders' lead hull — the side that is not the port's own; `level` is the armed strength the port's own side had, 0 when only the batteries answered, null when neither side was the port's. */
  | 'battle'
  | 'ship_fled'
  | 'ship_damaged'
  | 'ship_destroyed'
  | 'ship_captured'
  /** A packet or courier was stopped and her bag taken. The mail is gone. */
  | 'ship_robbed'
  /** A pirate put in where she was not welcome and the port seized her. */
  | 'pirate_seized'
  /** A ship's officers took her over to the Warlord. */
  | 'defection'
  | 'appointment_made'
  | 'appointment_refused'
  | 'officer_took_command'
  /** Under questioning a captured pirate named the world as a haven. `person` is the pirate; `at` the world named. Not always true. */
  | 'haven_named'
  /** A pirate lay docked at the port and the port made no move to seize her. `ship` is the pirate, `level` how many, `person` the governor who let it pass. */
  | 'pirates_harboured'
  /** Talk put about by a governor that their port asks no questions of any hull that pays. Only ever a rumour; `person` is the governor. */
  | 'haven_touted'

/** Good or bad news. On an event this is the reading for a bystander; a party to it reads it by `against` and `favours`. */
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
  /** How it reads to someone with no side in it; parties read it through `against` and `favours` (see valenceFor in ./events.ts). */
  valence: Valence
  /** The side it went against, if any: whoever lost the hull, the world, the fight, the argument. */
  against: FactionId | null
  /** The side it favoured, if any. */
  favours: FactionId | null
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
  /** A scout that lay off the world and watched: the one channel that carries the plain truth. */
  | 'agent'
  /** A trader's word at a port. */
  | 'merchant'
  /** Talk nobody will put a name to. */
  | 'docks'

export function isRumour(channel: Channel): boolean {
  return channel === 'merchant' || channel === 'docks'
}

/** The office a writer holds. A governor writes for a world, a captain for a hull; a survey, the Home Office, a merchant and the docks hold none. */
export type Title = 'governor' | 'captain' | null

/** Reports the Home Office made itself — the capital seen from the window, the survey it inherited — have no letter behind them. */
export function isHomeObservation(id: ReportId): boolean {
  // 'r-desk-' is the prefix earlier saves used for the same thing.
  return id.startsWith('r-home-') || id.startsWith('r-desk-') || id.startsWith('r-survey-')
}

export interface Report {
  id: ReportId
  channel: Channel
  observer: CharacterId
  observerName: string
  observerTitle: Title
  /** The hull a captain writes from, by name. */
  observerShip: string | null
  observerShipId: ShipId | null
  /** What the letter is about, in a few words, as the writer put it. */
  subject: string
  /** The first sentence: the most important news, in the writer's words. */
  lede: string
  /** Where the observation was made. Can differ from `envelope.origin` when a ship saw something and posted it from its next port. */
  observedAt: WorldId
  observed: Week
  snapshot: Snapshot
  /** The events the writer chose to mention. A letter says what happened; the snapshot says how things stand. */
  events: Event[]
  envelope: Envelope
  /** Set when it reaches the Home Office. Age at reading is `week - observed`. */
  delivered: Week | null
}

// ---------------------------------------------------------------------------
// Dispatches: instructions travelling away from the player.

export type Recipient =
  | { kind: 'character'; character: CharacterId }
  | { kind: 'ship'; ship: ShipId }

export type DispatchPayload =
  /** New orders for a hull, and optionally new standing orders to go with them. */
  | { kind: 'order'; ship: ShipId; order: Order; standing?: Partial<StandingOrders> }
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

/** A world's entry on the star chart: where it is, what it is called and who settled it. Public, like the lanes. */
export interface ChartEntry {
  id: WorldId
  name: string
  hex: Hex
  /** The cultures that settled the world, by name. The survey knew this; it does not change. */
  cultures: string[]
}

/**
 * A hull on the Home Office's books: what it is and who was given it. Where it is
 * and what it is doing are belief, in `known.ships` and `outgoing`.
 */
export interface RosterEntry {
  id: ShipId
  name: string
  role: ShipRole
  jump: number
  /** Null for a prize: taken in action and waiting for an officer to be sent out to her. */
  commander: CharacterId | null
  commanderName: string | null
  /** Detachments she can carry; a fact of her class. */
  troops: number
  /** Jumps a full tank gives her; a fact of her class. */
  fuel: number
}

/** An officer at the capital without a post, whom the Home Office can send out to a seat or a prize. */
export interface PoolEntry {
  id: CharacterId
  name: string
}

/** A faction as the chart names it. Public: everyone knows who the Warlord is. */
export interface FactionEntry {
  id: FactionId
  name: string
  kind: FactionKind
}

/**
 * The player's whole picture, rebuilt each week from their belief state and
 * their own outgoing mail. This is the only thing the UI renders.
 */
export interface PlayerView {
  week: Week
  capital: WorldId
  /** Set once the game is over. */
  ending: Ending | null
  /** The lane chart is public knowledge and never stale. */
  lanes: Lane[]
  /** Every world's name and position. What is *happening* there is only in `known`. */
  chart: Record<WorldId, ChartEntry>
  factions: Record<FactionId, FactionEntry>
  /** The player's own faction, so the UI can tell a friendly snapshot from a hostile one. */
  faction: FactionId
  known: Belief
  /** The hulls the Home Office commands, as listed on its books. Their whereabouts are in `known.ships`. */
  roster: RosterEntry[]
  /** Officers at the capital with nothing to do, seen directly from the Home Office. */
  pool: PoolEntry[]
  /** The names on the administration's rolls, by id: everyone the Home Office has ever appointed or could. Names only; where they are is belief. */
  names: Record<CharacterId, string>
  /** Troops at the capital, seen directly from the Home Office. */
  reserve: { army: number; marines: number }
  /** Every official and agent report that has reached the Home Office, newest arrival first. This week's news is whatever has `delivered === week`. */
  inbox: Report[]
  /** What the Home Office saw for itself: the capital each week, and the survey it inherited. Not mail, but reports all the same, so a week gone by can be pictured. */
  observations: Report[]
  /** Worlds a letter has seen harbouring pirates, whose governor has not changed since as far as the Home Office knows. */
  havens: WorldId[]
  /** What the docks are saying: merchant and docks-channel reports, kept apart from the mail so the two piles are never confused. */
  rumours: Report[]
  /** Dispatches the player has sent, newest first. Their fate is unknown until a report says otherwise. */
  outgoing: Dispatch[]
}
