/**
 * What a reader is allowed to see.
 *
 * The UI imports from this file (and the grid geometry in ./hex.ts) and
 * nothing else in src/sim. Everything exported here is either a delivered
 * report, something the player wrote, or public knowledge like the lane
 * chart. A report carries a *snapshot* of what an observer saw, never the
 * ground-truth record itself, so a stale or self-serving report is a
 * first-class object rather than a lie about the real thing.
 *
 * The same shapes serve every reader: an NPC's belief is folded from the
 * same reports, and the sim never hands an NPC ground truth either.
 */
import type { Good } from './economy'
import type { Hex } from './hex'
import type { CargoLot, CharacterId, Debt, Declaration, DispatchId, Movement, EmpireId, Lane, LaneId, ReportId, ShipId, ShipType, Stance, StarportClass, Week, WorldId, WorldProfile } from './types'

export { expectedArrival, hexRoute, nextDeparture, route } from './chart'
export { beliefFrom, stanceKnown } from './belief'
export { stanceKey, stancePair } from './types'

export type { CargoLot, CharacterId, Debt, Declaration, Good, Movement, DispatchId, EmpireId, Hex, Lane, LaneId, ReportId, ShipId, ShipType, Stance, StarportClass, Week, WorldId, WorldProfile }

// ---------------------------------------------------------------------------
// Snapshots: an entity as it appeared to someone, somewhere, once.

export interface ShipSnapshot {
  id: ShipId
  name: string
  type: ShipType
  empire: EmpireId
  /** The world it was seen at. A ship in jump is seen by nobody. */
  at: WorldId
  captain: CharacterId | null
  captainName: string | null
}

/** A person as they were seen: at a world, or aboard a hull lying there. */
export interface PersonSnapshot {
  id: CharacterId
  name: string
  empire: EmpireId
  at: WorldId
  aboard: ShipId | null
  /** Held here as a prisoner, and what their captor asks. */
  held?: number
}

export interface WorldSnapshot {
  id: WorldId
  name: string
  hex: Hex
  profile: WorldProfile
  empire: EmpireId
  /** Hulls in port when the observation was made. One report carries the world and its traffic together. */
  ships: ShipSnapshot[]
  /** People seen about the port: passengers waiting, captains ashore. */
  people: PersonSnapshot[]
  /** The port's notice board as it stood: the newest declaration it had heard of, per pair. */
  board: Declaration[]
  /** What the brokers were charging and what lay on the dock, as seen. Empty when the observer never went to the brokers (the chart). */
  market: Partial<Record<Good, { price: number; stock: number }>>
  /** What the port was telling of lately. */
  news: { week: Week; text: string }[]
  /** Bulk lines a guild runs through this port, as the factor will tell anyone: the two ends and whose guild. */
  lines: LineSeen[]
  /** Pages of the port's register the observer saw: this week's with their own eyes, a year's from the administrator. */
  traffic: Movement[]
}

export interface LineSeen {
  from: WorldId
  to: WorldId
  empire: EmpireId
}

/** The newest word of a guild line: keyed by its two ends. */
export interface LineKnown {
  line: LineSeen
  observed: Week
  report: ReportId
}

export type Snapshot = { kind: 'world'; world: WorldSnapshot } | { kind: 'ship'; ship: ShipSnapshot }

// ---------------------------------------------------------------------------
// Mail

export interface Envelope {
  /** Where it was handed to a carrier. */
  origin: WorldId
  /** The world it is addressed to: where the sender believed the addressee would be. */
  destination: WorldId
  sent: Week
  /** The worlds it was planned to pass through, origin first. */
  route: WorldId[]
  /** When it was expected to arrive, if anyone could say. */
  eta: Week | null
}

/**
 * How a report came. There is no reliability score — distortion is baked
 * into the content when the report is written and never recorded on it.
 */
export type Channel =
  /** A letter from a named person. */
  | 'official'
  /** The harbourmaster's port list, or a reader's own eyes. */
  | 'port'
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
  /** The person who wrote it, or null for a port's own list. */
  observer: CharacterId | null
  observerName: string
  /** What the letter is about, in a few words, as the writer put it. */
  subject: string
  /** Where the observation was made. */
  observedAt: WorldId
  observed: Week
  snapshot: Snapshot
  envelope: Envelope
  /** Set when it reaches its reader. Age at reading is `week - observed`. */
  delivered: Week | null
}

export interface Dispatch {
  id: DispatchId
  sender: CharacterId
  recipient: CharacterId
  text: string
  envelope: Envelope
}

// ---------------------------------------------------------------------------
// Belief: the fold

/** The newest word of a ship: where and when it was seen, and by which report. */
export interface Sighting {
  ship: ShipSnapshot
  observed: Week
  report: ReportId
}

/** The newest word of a person. The seed of the Book. */
export interface PersonKnown {
  person: PersonSnapshot
  observed: Week
  report: ReportId
}

export interface Belief {
  /** Newest delivered report about each world. */
  worlds: Record<WorldId, Report>
  /** Newest sighting of each ship, drawn from world reports (hulls in port) and any report about the ship itself. */
  ships: Record<ShipId, Sighting>
  /** Newest sighting of each person. */
  people: Record<CharacterId, PersonKnown>
  /** The newest declaration heard of for each pair of empires, keyed as `stanceKey`. */
  stances: Record<string, Declaration>
  /** Guild bulk lines the reader has seen running, keyed by `lineKey`. */
  lines: Record<string, LineKnown>
  /** What the reader knows of who came and went at each port, newest first, each line stamped with how they know it. */
  traffic: Record<WorldId, TrafficKnown[]>
  /** Friendships and enmities between others the reader has been told of, keyed `a|b` for a's regard of b. */
  ties: Record<string, TieKnown>
  /** How dangerous the reader holds each world's approaches, 0 to 1: raised by word of a taking, eased by word of safe trade and of patrols. */
  danger: Record<WorldId, { level: number; observed: Week }>
  /** The last week the reader saw or heard of a patrol at a world. */
  patrolled: Record<WorldId, Week>
  /** Last-known price and stock per world and good, from the newest sight of that market. */
  prices: Record<WorldId, Partial<Record<Good, { price: number; stock: number; observed: Week; heard?: boolean; from?: CharacterId }>>>
}

// ---------------------------------------------------------------------------
// The player's view

/** A world's entry on the star chart: where it is, what it is called and who settled it. Public, like the lanes. */
export interface ChartEntry {
  id: WorldId
  name: string
  hex: Hex
  cultures: string[]
}

/** An empire as the chart names it. Public: everyone knows where the three seats are. */
export interface EmpireEntry {
  id: EmpireId
  name: string
  seat: WorldId
  /** What the empire ships in from its capital in bulk, and what it sends home: common knowledge. */
  exports: string[]
  imports: string[]
}

/** A hull lying in the same port as the player, seen directly. */
export interface HullHere {
  id: ShipId
  name: string
  type: ShipType
  empire: EmpireId
  captain: CharacterId | null
  captainName: string | null
  /** How the captain stands toward telling the player what they know: glad, on the fence, or tight. Null for an unnamed crew. */
  mood: 'glad' | 'fence' | 'tight' | null
  /** Whether the captain wears the guild's ticket. */
  guild: boolean
  /** Whether the player has already asked them this week, and whether they told. */
  asked: boolean
  told: boolean
  /** Something they say on seeing you, from what last passed between you. */
  greeting: string | null
  /** Whether a round for its own sake would be welcome this week. */
  roundWelcome: boolean
  /** Whether they would grant you a route if asked: they must think well of you. */
  wouldGrant: boolean
  /** They refused, but a round would bring them round. */
  roundWouldHelp: boolean
  /** For a scout on the packets: where she sails to next and when. */
  sailsTo: WorldId | null
  sailsOn: Week | null
}

/** The player's own hull, seen from her own deck: certain, like the body. */
export interface OwnShip {
  id: ShipId
  name: string
  type: ShipType
  jump: number
  price: number
  fuel: number
  /** Weeks until maintenance is due (negative: overdue), and when she comes out of the yard if she is in it. */
  maintenanceDueIn: number
  inYard: Week | null
  maintenanceCost: number
  tanks: number
  holdTons: number
  holdUsed: number
  hold: CargoLot[]
  damage: number
  guns: number
  course: WorldId | null
}

/** A world the player's hull can jump to from here, and whether the lanes also go there. */
export interface Destination {
  world: WorldId
  parsecs: number
  charted: boolean
}

/** What a place in the port offers this week, as seen on the spot. */
export interface MarketRow {
  good: Good
  price: number
  stock: number
  /** What the player paid for what is in the hold of it, averaged, or null. */
  holding: { tons: number; paid: number } | null
}

export interface FreightRow {
  id: string
  good: Good
  tons: number
  to: WorldId
  rate: number
}

/** A page of the Book: one person the player has dealt with or watched. */
export interface BookEntry {
  id: CharacterId
  name: string
  empire: EmpireId
  guild: boolean
  outlaw: boolean
  /** The hull they were last seen aboard, if known. */
  hull: string | null
  /** Where and when last seen, if ever. */
  lastSeen: { world: WorldId; week: Week } | null
  /** How the player stands to them, in a word, and the number behind it. */
  standing: string
  regard: number
  /** How far their word has proved good. */
  trust: number
  dealings: number
  /** The last few things that passed between you. */
  notes: string[]
  /** How much you have seen them to be worth knowing, in a word. */
  esteem: string
  /** What they have asked of you, if anything, and what you have asked of them. */
  askedOfYou: { world: WorldId; good: string; since: Week; tone: 'solid' | 'orelse' } | null
  askedByYou: { world: WorldId; good: string; since: Week } | null
  /** What you have made of their character so far: a word or two, more with acquaintance. */
  impression: string[]
  /** Trades of theirs you have seen or heard of, newest first, a few. */
  seenTrading: string[]
  /** Who they are said to count a friend, and an enemy, with who said so. */
  friends: { name: string; from: string }[]
  enemies: { name: string; from: string }[]
}

/**
 * The player's whole picture, rebuilt each week from their belief and their
 * own mail. This is the only thing the UI renders.
 */
export interface PlayerView {
  week: Week
  player: { id: CharacterId; name: string; empire: EmpireId }
  /** Where the player's body is: a world, or aboard a hull between worlds. */
  body: { kind: 'world'; world: WorldId } | { kind: 'aboard'; ship: ShipId; shipName: string; from: WorldId; to: WorldId; arrives: Week }
  /** The lane chart is public knowledge and never stale. */
  lanes: Lane[]
  chart: Record<WorldId, ChartEntry>
  empires: Record<EmpireId, EmpireEntry>
  known: Belief
  /** What the player sees for themselves where they are this week. Null in jump. */
  here: { world: WorldId; empire: EmpireId; starport: StarportClass; hulls: HullHere[]; market: MarketRow[]; freight: FreightRow[]; duty: number; closed: boolean; inspection: number; refuel: number | null; destinations: Destination[] } | null
  /** Purse and debt: certain. */
  purse: number
  debt: Debt | null
  /** The player's own hull, or null if they have none. */
  ship: OwnShip | null
  /** Prisoners held at this port, whose ransom the player could pay. */
  prisoners: { id: CharacterId; name: string; empire: EmpireId; ransom: number }[]
  /** Hulls here that could be asked to stand with the player in a fight, by name. */
  allies: { ship: ShipId; name: string; captain: string; guns: number }[]
  /** A meeting in the approaches waiting on the player. */
  pending: { attacker: { id: ShipId; name: string; type: ShipType; empire: EmpireId; guns: number }; defender: { id: ShipId; name: string; type: ShipType; empire: EmpireId; guns: number }; mine: 'attacker' | 'defender'; round: number; log: string[]; quarrel: boolean; ally: string | null } | null
  /** Whether the player's hull lies off the port rather than docked. */
  lyingOff: boolean
  /** The player is a prisoner: whose, since when, where held if landed, and what is asked. */
  captive: { of: EmpireId | null; since: Week; at: WorldId | null; aboard: string | null; ransom: number; term: Week | null } | null
  /** Whether a lender here would set the player up with a hull. */
  lenderHere: boolean
  /** The Book: everyone the player has dealt with or watched, most dealt-with first. */
  book: BookEntry[]
  /** Every letter that has reached the player, newest arrival first. */
  inbox: Report[]
  /** What the player saw with their own eyes each week. Not mail, but reports all the same. */
  observations: Report[]
  /** Letters the player has sent, newest first. */
  outgoing: Dispatch[]
}

/** A line of a port's register as the reader has it, and by what means. */
export interface TrafficKnown {
  movement: Movement
  source: 'seen' | 'register' | 'heard'
  /** When the reader learned it. */
  observed: Week
}

/** What one person is said to think of another, as the reader heard it. */
export interface TieKnown {
  regard: number
  observed: Week
  /** Who said so. */
  from: CharacterId
}

/** The key of a line between two worlds, whichever way round. */
export function lineKey(a: WorldId, b: WorldId): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`
}
