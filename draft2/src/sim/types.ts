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
import type { Hex } from './hex'

// ---------------------------------------------------------------------------
// Identity and time

declare const brand: unique symbol

/** A string id tagged with the kind of entity it names, so a WorldId can't be handed to something expecting a ShipId. */
export type Id<Kind extends string> = string & { readonly [brand]: Kind }

export type WorldId = Id<'world'>
export type LaneId = Id<'lane'>
export type EmpireId = Id<'empire'>

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
}

/** Each pair of empires is at war or at peace; the three pairs change independently. */
export type Stance = 'war' | 'peace'

/** Keyed by the two empire ids joined in sorted order with ':'. */
export type Stances = Record<string, Stance>

export function stanceKey(a: EmpireId, b: EmpireId): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`
}
