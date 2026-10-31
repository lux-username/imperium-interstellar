/**
 * Ground truth for draft 2. Everything here is what the simulation knows to
 * be so, which is precisely what no player and no NPC is shown directly:
 * each of them holds a belief folded from reports. The UI imports only from
 * ./view.ts (to come); this file exists for the sim and the dev-only god view.
 *
 * All of it is plain data: no classes, no Map/Set, no object references. An
 * entity points at another by id, so the whole state round-trips through
 * JSON unchanged.
 *
 * Keel phase: worlds, lanes and the three empires. Ships, characters,
 * organisations, prizes and relationships land with their phases.
 */
import type { CoreName } from './data/names'
import type { Good, Market } from './economy'
import type { Hex } from './hex'
import type { Sex } from './names'
import type { Rng } from './rng'
import type { Belief, Dispatch, Report } from './view'

// ---------------------------------------------------------------------------
// Identity and time

declare const brand: unique symbol

/** A string id tagged with the kind of entity it names, so a WorldId can't be handed to something expecting a ShipId. */
export type Id<Kind extends string> = string & { readonly [brand]: Kind }

export type WorldId = Id<'world'>
export type LaneId = Id<'lane'>
export type EmpireId = Id<'empire'>
export type ShipId = Id<'ship'>
export type CharacterId = Id<'character'>
export type ReportId = Id<'report'>
export type DispatchId = Id<'dispatch'>
export type MailId = Id<'mail'>

/** Weeks since the game began; week 0 is the opening turn. Every jump takes one. */
export type Week = number

// ---------------------------------------------------------------------------
// Worlds and lanes

/** A: full service and shipyard. B: full service. C: unrefined fuel only. D/E: little or nothing. X: no port at all. */
export type StarportClass = 'A' | 'B' | 'C' | 'D' | 'E' | 'X'

/** The compact description of a world produced by our 2d6 generation procedures. Each digit is a code, not a quantity. */
export interface WorldProfile {
  starport: StarportClass
  /** 0–10. */
  size: number
  /** 0–15. */
  atmosphere: number
  /** 0–10, fraction of surface that is water. */
  hydrographics: number
  /** 0–10, order of magnitude of inhabitants. */
  population: number
  /** 0–15. */
  government: number
  /** 0–9, higher is stricter. */
  law: number
  /** 0–15. Caps what can be built and repaired here. */
  tech: number
}

export interface World {
  id: WorldId
  name: string
  hex: Hex
  /** One to three cultures from the world table, by name, that settled here; the world's own name comes from their places. */
  cultures: string[]
  profile: WorldProfile
  /** The empire whose governor this world answers to. Every world belongs to one; there are no free ports yet. */
  empire: EmpireId
  /**
   * The port's notice board: the newest declaration of war or peace it has
   * heard of for each pair of empires. News reaches a board aboard the
   * hulls that call; a seat posts its own empire's declarations the week
   * they are made. Keyed as `stanceKey`.
   */
  board: Record<string, Declaration>
  /** What the dock holds and charges this week. Ground truth; anyone trading goes by the price they last saw. */
  market: Market
  /** Freight the brokers are offering this week, to be carried and paid on delivery. */
  freight: FreightOffer[]
  /** What happened here lately, as the port tells it: the newest last. Kept for NEWS_WEEKS. */
  news: NewsItem[]
  /** Prices let slip on the docks: what anyone in port may pick up as hearsay. */
  gossip: PriceBook
}

/** Prices by world and good, with when each was seen. The shape of a guild's book, a port's gossip, and the price slice of a belief. */
export type PriceBook = Record<WorldId, Partial<Record<string, { price: number; stock: number; observed: Week; heard?: boolean }>>>

/** An empire's merchant guild: for now, the book of prices kept at its headquarters at the seat. */
export interface Guild {
  empire: EmpireId
  seat: WorldId
  book: PriceBook
}

export interface NewsItem {
  week: Week
  text: string
}

export interface FreightOffer {
  id: string
  good: Good
  tons: number
  to: WorldId
  /** Credits per ton, paid on delivery at `to`. */
  rate: number
}

/**
 * When scouts leave each end of a lane. A scout sails, lands next week,
 * lies over a week, and sails back: a four-week round. One scout gives a
 * sailing from each end every four weeks; a busy lane has two, staggered,
 * so each end sees one every two.
 */
export interface PacketSchedule {
  /** The round: always 4 for now. */
  interval: number
  /** Week of the first departure from the first end, so neighbouring lanes are out of step. */
  phase: Week
  /** Scouts on the lane: 1 or 2. */
  scouts: number
}

/** A charted route. Scheduled traffic runs only along these; everything else is a deliberate off-lane jump. */
export interface Lane {
  id: LaneId
  ends: [WorldId, WorldId]
  /** Parsecs between the ends; a ship needs at least this jump rating. */
  jumpDistance: number
  schedule: PacketSchedule
}

// ---------------------------------------------------------------------------
// Empires

/**
 * One of the three powers that share the subsector as a borderland. Each
 * has a governor's seat at a world here, a navy and a merchant guild (both
 * to come as organisations), and an imperial capital off the map that is
 * `capitalWeeks` away one way.
 */
export interface Empire {
  id: EmpireId
  name: string
  /** Which culture table names its people and its seat. */
  core: CoreName
  /** The world where its governor sits, and where its prize court will sit. */
  seat: WorldId
  /** One-way weeks to the imperial capital beyond the subsector's edge. */
  capitalWeeks: number
  /** Duty collected at its ports, so far unspent: the governor's purse to be. */
  treasury: number
}

/** Each pair of empires is at war or at peace; the three pairs change independently. */
export type Stance = 'war' | 'peace'

/** Keyed by the two empire ids joined in sorted order with ':'. */
export type Stances = Record<string, Stance>

export function stanceKey(a: EmpireId, b: EmpireId): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`
}

export function stancePair(key: string): [EmpireId, EmpireId] {
  const [a, b] = key.split(':')
  return [a as EmpireId, b as EmpireId]
}

/** A declaration: the stance between a pair from `week`. The newest one for a pair is what holds, wherever it is read. */
export interface Declaration {
  pair: [EmpireId, EmpireId]
  stance: Stance
  week: Week
}

/** How things stand between a pair in truth, and when the term rolled for it runs out. */
export interface StanceState {
  stance: Stance
  since: Week
  /** The week the next declaration falls, rolled when this one was made. */
  until: Week
}

// ---------------------------------------------------------------------------
// Ships

/**
 * The six hull types (spec → Setting). No customisable parts: a type is a
 * stat line. The scout runs the packets and carries the mail; the rest
 * land with the free trader phase.
 */
export type ShipType = 'scout' | 'free_trader' | 'far_trader' | 'bulk_freighter' | 'corvette' | 'frigate'

export interface ShipClass {
  type: ShipType
  /** What she costs new. Maintenance is a tenth of it, twice a year. */
  price: number
  jump: number
  /** Tanks: jumps on a full load. Scouts scoop and never want for fuel. */
  tanks: number
  /** Tons of hold. */
  hold: number
  guns: number
  crew: number
}

export const SHIP_CLASSES: Record<ShipType, ShipClass> = {
  scout: { type: 'scout', price: 30000, jump: 3, tanks: 2, hold: 2, guns: 0, crew: 4 },
  free_trader: { type: 'free_trader', price: 60000, jump: 2, tanks: 2, hold: 80, guns: 1, crew: 5 },
  far_trader: { type: 'far_trader', price: 80000, jump: 3, tanks: 2, hold: 60, guns: 1, crew: 5 },
  bulk_freighter: { type: 'bulk_freighter', price: 150000, jump: 2, tanks: 2, hold: 400, guns: 0, crew: 10 },
  corvette: { type: 'corvette', price: 200000, jump: 2, tanks: 4, hold: 10, guns: 3, crew: 20 },
  frigate: { type: 'frigate', price: 600000, jump: 3, tanks: 4, hold: 20, guns: 6, crew: 60 },
}

/** Where a ship truly is. In transit means committed to a jump that lands on `arrives`. */
export type Location =
  | { kind: 'world'; world: WorldId }
  | { kind: 'transit'; from: WorldId; to: WorldId; arrives: Week }

/**
 * Who a hull belongs to. A personal hull can be sold or given; an
 * organisation's hull is assigned by its head. The post is the arm that
 * runs the scouts on the lanes; navy and guild land with their phases.
 */
export type Owner =
  | { kind: 'personal'; character: CharacterId }
  | { kind: 'organisation'; empire: EmpireId; arm: 'post' | 'navy' | 'guild' }

/** A scout's standing run: back and forth along one lane on its timetable. */
export interface PacketRun {
  lane: LaneId
}

/** A lot in a hold: bought on the owner's account to sell, or freight carried for a fee. */
export type CargoLot =
  | { kind: 'cargo'; good: Good; tons: number; paid: number; from: WorldId; week: Week }
  | { kind: 'freight'; good: Good; tons: number; to: WorldId; rate: number; from: WorldId; week: Week }

export interface Ship {
  id: ShipId
  name: string
  type: ShipType
  empire: EmpireId
  owner: Owner
  location: Location
  /** Jumps left in her tanks. */
  fuel: number
  /** Points of damage; her class's guns say how much she can take before she is a wreck. */
  damage: number
  hold: CargoLot[]
  /** Where she sails next, for a hull on her own account. Null: lying in port. */
  course: WorldId | null
  /** The captain, when the hull has a named one. Scouts' crews go unnamed. */
  captain: CharacterId | null
  /** People aboard other than the crew, by id. They go where the hull goes. */
  passengers: CharacterId[]
  mailbag: MailId[]
  /** The notice board as it stood where she last sailed from: the news she carries. */
  news: Record<string, Declaration>
  /** Set for a scout on the packets. */
  run: PacketRun | null
  /** The week she last came into port. She sails no sooner than the week after. */
  docked: Week
  /** Lying off the port in the approaches rather than docked: hunting what comes in, or waiting to. */
  lyingOff: boolean
  /** The week her last maintenance was finished. Due again MAINTENANCE_EVERY weeks on; overdue, her drive is a risk. */
  maintained: Week
  /** The week she comes out of the yard, while she is in it. */
  inYard: Week | null
  /** What she is for, when she is not trading: a navy hull cruising, or an outlaw's. */
  duty: Duty | null
}

/** A hull's standing employment beyond trade. */
export type Duty =
  /** Cruising the empire's worlds, lying off each a week or two. `until`: when to move on. */
  | { kind: 'patrol'; until: Week }
  /** An outlaw: lying off ports to take what comes, and selling it at a haven. */
  | { kind: 'raid'; haven: WorldId; until: Week }

// ---------------------------------------------------------------------------
// People

/** Where a person's body is. Mail reaches them only where their body is; so does news. */
export type Body = { kind: 'world'; world: WorldId } | { kind: 'aboard'; ship: ShipId }

export interface Character {
  id: CharacterId
  name: string
  culture: string
  sex: Sex
  /** The empire whose subject they are. */
  empire: EmpireId
  body: Body
  /** Credits in hand. */
  purse: number
  /** What they owe on their hull, if anything. */
  debt: Debt | null
  /** A member of their empire's merchant guild, if so. Members share freely among themselves and keep the guild's book. */
  guild?: EmpireId
  /** An outlaw has burned their standing with every empire: fair game for any navy, and welcome only at a haven. */
  outlaw?: boolean
  /** Held by a captor: where, and since when. Null when free. */
  captive?: Captivity | null
}

export interface Captivity {
  /** Who took them, by hull; null when it was a port's customs house. */
  by: ShipId | null
  /** The empire whose prisoner they are, or null for an outlaw's. */
  of: EmpireId | null
  since: Week
  /** Where they are held once landed; null while still aboard the captor. */
  at: WorldId | null
  /** The week they go free if nothing else frees them first. Set when landed. */
  term?: Week
}

/** A mortgage: a payment falls due every `every` weeks; missed payments pile up as arrears. */
export interface Debt {
  balance: number
  payment: number
  every: number
  nextDue: Week
  arrears: number
}

// ---------------------------------------------------------------------------
// Mail

export type MailStatus =
  | { kind: 'awaiting_carrier'; at: WorldId }
  | { kind: 'aboard'; ship: ShipId }
  /** At its address, waiting for the addressee to turn up. */
  | { kind: 'held'; at: WorldId; expires: Week | null }
  | { kind: 'delivered'; week: Week }
  | { kind: 'lost'; week: Week }

export type MailContents = { kind: 'report'; report: Report } | { kind: 'dispatch'; dispatch: Dispatch }

export interface Mail {
  id: MailId
  contents: MailContents
  status: MailStatus
  /** For a report: whom it is for. A dispatch names its own recipient. */
  reader?: CharacterId
}

// ---------------------------------------------------------------------------
// The game

export interface GameState {
  seed: number
  week: Week
  rng: Rng
  nextId: number
  worlds: Record<WorldId, World>
  lanes: Record<LaneId, Lane>
  empires: Record<EmpireId, Empire>
  /** How each pair of empires truly stands. */
  stances: Record<string, StanceState>
  /** Every declaration made, oldest first. */
  declarations: Declaration[]
  ships: Record<ShipId, Ship>
  characters: Record<CharacterId, Character>
  mail: Record<MailId, Mail>
  /** Everyone's belief, folded from what reached them. NPCs keep the fold only; the player keeps the mail too. */
  beliefs: Record<CharacterId, Belief>
  player: CharacterId
  /** An encounter waiting on the player's choice. The week cannot advance while it stands. */
  pending: Encounter | null
  guilds: Record<EmpireId, Guild>
  /** Captains the player has asked this week, so an answer is given once. */
  asked: Record<CharacterId, Week>
}

/** A meeting in the approaches, resolved a round at a time. */
export interface Encounter {
  attacker: ShipId
  defender: ShipId
  at: WorldId
  round: number
  /** What has happened so far, in order. */
  log: string[]
  /** How it ended, or null while it goes on. */
  outcome: EncounterOutcome | null
}

export type EncounterOutcome = 'escaped' | 'let_pass' | 'struck' | 'driven_off' | 'docked'
