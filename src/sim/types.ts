/**
 * Ground truth. Everything here is what the simulation knows to be so, which
 * is precisely what the player is never shown directly. The UI imports only
 * from ./view.ts; this file exists for the sim and the dev-only god view.
 *
 * All of it is plain data: no classes, no Map/Set, no object references. An
 * entity points at another by id, so the whole GameState round-trips through
 * JSON unchanged.
 */
import type { Hex } from './hex'
import type { Order } from './orders'
import type { Rng } from './rng'
import type { Belief, Dispatch, Event, Report } from './view'

// ---------------------------------------------------------------------------
// Identity and time

declare const brand: unique symbol

/** A string id tagged with the kind of entity it names, so a WorldId can't be handed to something expecting a ShipId. */
export type Id<Kind extends string> = string & { readonly [brand]: Kind }

export type WorldId = Id<'world'>
export type LaneId = Id<'lane'>
export type ShipId = Id<'ship'>
export type CharacterId = Id<'character'>
export type FactionId = Id<'faction'>
export type ReportId = Id<'report'>
export type DispatchId = Id<'dispatch'>
export type MailId = Id<'mail'>
export type EventId = Id<'event'>

/** Weeks since the game began; week 0 is the opening turn. Every jump takes one. */
export type Week = number

// ---------------------------------------------------------------------------
// Places

/** Somewhere a thing can be delivered to: a world, or a rally point in open space. */
export type Address = { kind: 'world'; world: WorldId } | { kind: 'rally'; hex: Hex }

/** Where a ship truly is. In transit means committed to a jump that lands on `arrives`. */
export type Location =
  | { kind: 'world'; world: WorldId }
  | { kind: 'transit'; from: WorldId; to: WorldId; arrives: Week }

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
  profile: WorldProfile
  faction: FactionId
  /** The appointed governor, if any. */
  governor: CharacterId | null
  /** Whoever holds the seal here right now. At the capital this is the player until Phase 2 deputies exist. */
  actingGovernor: CharacterId | null
  /** 0–10. */
  unrest: number
  /** Abstract strength of the garrison. */
  garrison: number
  /** When the governor's office last wrote to the desk. Drives the "all quiet" letter. */
  lastLetter: Week
}

/** When packets leave each end of a lane. */
export interface PacketSchedule {
  /** A packet departs every `interval` weeks. */
  interval: number
  /** Week of the first departure, so neighbouring lanes are out of step. */
  phase: Week
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
// Ships, characters, factions

/**
 * What a hull is for. Packets run the lanes on schedule; scouts are tiny
 * two-person hulls that look and run; patrol craft, escorts and transports
 * are the warships the desk commands.
 */
export type ShipRole = 'packet' | 'courier' | 'scout' | 'patrol' | 'escort' | 'transport' | 'merchant'

/** Hulls the desk can give orders to; the rest run themselves. */
export const COMMANDABLE_ROLES: readonly ShipRole[] = ['courier', 'scout', 'patrol', 'escort', 'transport']

/** What a ship does when its order runs out or something unexpected happens. Phase 1b adds contact posture and a damage threshold. */
export interface StandingOrders {
  /** Where to go when there is nothing else to do. Null: hold wherever the last order ended. */
  rally: WorldId | null
}

export interface Ship {
  id: ShipId
  name: string
  role: ShipRole
  faction: FactionId
  /** Jump rating: the most parsecs one jump can cover. */
  jump: number
  /** Abstract fighting strength. Zero for hulls that only run. */
  strength: number
  location: Location
  commander: CharacterId | null
  /** What the ship is doing. Null means holding where it is. */
  order: Order | null
  standing: StandingOrders
  /** Mail in the hold, by MailId. */
  mailbag: MailId[]
}

export type Post =
  | { kind: 'governor'; world: WorldId }
  | { kind: 'commander'; ship: ShipId }
  | { kind: 'unassigned' }

/** Whose interest a person serves when it comes to it. Corruption is loyalty to self. */
export type Loyalty = 'player' | 'empire' | 'self'

/**
 * What a person is like. The player never reads these directly; they show
 * in what the person writes, does and leaves out.
 */
export interface Traits {
  loyalty: Loyalty
  /** −2 cautious … +2 bold. A modifier wherever nerve matters. */
  initiative: number
  /** −2 … +2 modifiers on the three kinds of work. */
  competence: { administrative: number; naval: number; diplomatic: number }
  /** 0 content … 3 hungry. */
  ambition: number
}

export interface Character {
  id: CharacterId
  name: string
  faction: FactionId
  post: Post
  traits: Traits
}

export type FactionKind = 'empire' | 'administration' | 'rival' | 'pirates' | 'rebels'

export interface Faction {
  id: FactionId
  name: string
  kind: FactionKind
}

// ---------------------------------------------------------------------------
// Mail
//
// Reports travel toward the capital, dispatches travel away from it, and the
// same hulls carry both. Ground truth tracks each item's true whereabouts here;
// the item itself (see view.ts) carries only what its reader is entitled to see.

export type MailStatus =
  /** Written, waiting at a world for the next hull heading the right way. */
  | { kind: 'awaiting_carrier'; at: WorldId }
  | { kind: 'aboard'; ship: ShipId }
  /** Reached its address but the recipient wasn't there. Kept until they arrive or `expires`. */
  | { kind: 'held'; at: WorldId; expires: Week | null }
  | { kind: 'delivered'; week: Week }
  /** The hull carrying it never arrived. */
  | { kind: 'lost'; week: Week }

export type MailContents =
  | { kind: 'report'; report: Report }
  | { kind: 'dispatch'; dispatch: Dispatch }

export interface Mail {
  id: MailId
  contents: MailContents
  status: MailStatus
}

// ---------------------------------------------------------------------------
// The whole game

export interface GameState {
  /** The seed the game was generated from; with `rng` it reproduces everything. */
  seed: number
  week: Week
  rng: Rng
  /** Next serial for minting ids of things created during play (mail, reports, dispatches). */
  nextId: number
  capital: WorldId
  /** The character the player governs as. Their belief state is the source of the PlayerView. */
  player: CharacterId
  worlds: Record<WorldId, World>
  lanes: Record<LaneId, Lane>
  ships: Record<ShipId, Ship>
  characters: Record<CharacterId, Character>
  factions: Record<FactionId, Faction>
  mail: Record<MailId, Mail>
  /** What has happened, by week and world: the unit of news. Forgotten after EVENT_MEMORY weeks (see ./events.ts). */
  events: Record<EventId, Event>
  /**
   * What each acting character knows, built only from reports delivered to
   * them. The player's view is derived from `beliefs[player]` rather than
   * stored, so it can never drift from the reports that justify it.
   */
  beliefs: Record<CharacterId, Belief>
}
