/**
 * The hulls the Home Office starts with, and the officers who command them. All
 * of it sits in port at the capital on week 0 with no orders: the player's
 * first job is to send it somewhere. Numbers per spec.md → First campaign →
 * Starting position; tune there, not here.
 */
import { newCharacter } from './characters'
import { SHIP_NAMES, type NamedHull } from './data/ships'
import { nextInt, type Rng } from './rng'
import type { Character, CharacterId, FactionId, Ship, ShipId, ShipRole, WorldId } from './types'

export interface HullClass {
  role: ShipRole
  jump: number
  strength: number
  /** Jumps in the tanks when full. */
  fuel: number
  /** Detachments she can carry. */
  troops: number
}

/**
 * What each kind of hull is: patrol craft fight, escorts shepherd,
 * transports carry troops in numbers, scouts run and watch. A warship
 * takes a detachment in her spare berths; a scout has none. A scout
 * carries fuel scoops and skims what she burns, so her tanks are never
 * on the books.
 */
export const HULLS: Record<Exclude<ShipRole, 'packet' | 'merchant'>, HullClass> = {
  patrol: { role: 'patrol', jump: 2, strength: 3, fuel: 4, troops: 1 },
  escort: { role: 'escort', jump: 2, strength: 2, fuel: 4, troops: 1 },
  transport: { role: 'transport', jump: 2, strength: 1, fuel: 4, troops: 3 },
  scout: { role: 'scout', jump: 2, strength: 0, fuel: 0, troops: 0 },
  raider: { role: 'raider', jump: 2, strength: 2, fuel: 4, troops: 1 },
}

/** How many detachments a hull can carry. */
export function troopCapacity(role: ShipRole): number {
  return role === 'packet' || role === 'merchant' ? 0 : HULLS[role].troops
}

/** How many jumps a full tank gives a hull of this class. Packets carry none on the books: the lanes they serve keep them fuelled; scouts scoop their own. */
export function fuelCapacity(role: ShipRole): number {
  return burnsFuel(role) ? HULLS[role as keyof typeof HULLS].fuel : 0
}

/** Whether a hull of this class burns fuel at all. Packets are kept fuelled by their lanes; scouts have scoops. */
export function burnsFuel(role: ShipRole): boolean {
  return role !== 'packet' && role !== 'merchant' && role !== 'scout'
}

/** Hulls in port at the capital on week 0. */
export const STARTING_FLEET: { role: keyof typeof HULLS; count: number }[] = [
  { role: 'patrol', count: 4 },
  { role: 'escort', count: 2 },
  { role: 'transport', count: 2 },
  { role: 'scout', count: 6 },
]

const ORDINALS = ['II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']

/**
 * A name for a hull of this class not already in `taken`, from the class's
 * own pool (src/sim/data/ships.ts). The draw is random while names remain;
 * once the pool is spent the name is reused with a number, as navies do.
 * Adds the result to `taken`.
 */
export function shipName(rng: Rng, hull: NamedHull, taken: Set<string>): string {
  const pool = SHIP_NAMES[hull]
  const free = pool.filter((n) => !taken.has(n))
  let name = free.length > 0 ? free[nextInt(rng, 0, free.length - 1)] : pool[nextInt(rng, 0, pool.length - 1)]
  for (let i = 0; taken.has(name); i++) name = `${name.replace(/ [IVX]+$/, '')} ${ORDINALS[Math.min(i, ORDINALS.length - 1)]}`
  taken.add(name)
  return name
}

/** One hull of a class, with a freshly rolled commander, in port at `at`. */
export function newShip(id: ShipId, name: string, cls: HullClass, faction: FactionId, at: WorldId, commander: Character | null): Ship {
  return {
    id,
    name,
    role: cls.role,
    faction,
    jump: cls.jump,
    strength: cls.strength,
    damage: 0,
    fuel: cls.fuel,
    location: { kind: 'world', world: at },
    commander: commander?.id ?? null,
    troops: { army: 0, marines: 0 },
    passengers: [],
    havens: null,
    order: null,
    standing: { rally: at, onContact: 'favourable' },
    mailbag: [],
    lastOrders: 0,
    log: [],
  }
}

export function startingFleet(rng: Rng, faction: FactionId, capital: WorldId): { ships: Record<ShipId, Ship>; characters: Record<CharacterId, Character> } {
  const ships: Record<ShipId, Ship> = {}
  const characters: Record<CharacterId, Character> = {}
  const taken = new Set<string>()
  let n = 1
  for (const { role, count } of STARTING_FLEET) {
    for (let i = 0; i < count; i++) {
      const id = `s-${role}-${n}` as ShipId
      const cid = `c-cmdr-${n}` as CharacterId
      n += 1
      const commander = newCharacter(rng, cid, faction, { kind: 'commander', ship: id })
      characters[cid] = commander
      ships[id] = newShip(id, shipName(rng, role, taken), HULLS[role], faction, capital, commander)
    }
  }
  return { ships, characters }
}
