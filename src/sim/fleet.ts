/**
 * The hulls the desk starts with, and the officers who command them. All
 * of it sits in port at the capital on week 0 with no orders: the player's
 * first job is to send it somewhere. Numbers per spec.md → First campaign →
 * Starting position; tune there, not here.
 */
import { newCharacter } from './characters'
import { word } from './names'
import { nextInt, type Rng } from './rng'
import type { Character, CharacterId, FactionId, Ship, ShipId, ShipRole, WorldId } from './types'

interface HullClass {
  role: ShipRole
  jump: number
  strength: number
}

/** What each kind of hull is: patrol craft fight, escorts shepherd, transports carry, couriers and scouts run. */
export const HULLS: Record<Exclude<ShipRole, 'packet' | 'merchant'>, HullClass> = {
  patrol: { role: 'patrol', jump: 2, strength: 3 },
  escort: { role: 'escort', jump: 2, strength: 2 },
  transport: { role: 'transport', jump: 2, strength: 1 },
  courier: { role: 'courier', jump: 2, strength: 0 },
  scout: { role: 'scout', jump: 2, strength: 0 },
}

/** Hulls in port at the capital on week 0. */
export const STARTING_FLEET: { role: keyof typeof HULLS; count: number }[] = [
  { role: 'patrol', count: 4 },
  { role: 'escort', count: 2 },
  { role: 'transport', count: 2 },
  { role: 'courier', count: 4 },
  { role: 'scout', count: 2 },
]

const PREFIXES = ['Vigilant', 'Steadfast', 'Resolute', 'Wayfarer', 'Sentinel', 'Harbinger', 'Lantern', 'Kestrel']

function shipName(rng: Rng, taken: Set<string>): string {
  for (;;) {
    const name = nextInt(rng, 1, 3) === 1 ? PREFIXES[nextInt(rng, 0, PREFIXES.length - 1)] : word(rng)
    if (!taken.has(name)) {
      taken.add(name)
      return name
    }
  }
}

/** One hull of a class, with a freshly rolled commander, in port at `at`. */
export function newShip(id: ShipId, name: string, cls: HullClass, faction: FactionId, at: WorldId, commander: Character): Ship {
  return {
    id,
    name,
    role: cls.role,
    faction,
    jump: cls.jump,
    strength: cls.strength,
    location: { kind: 'world', world: at },
    commander: commander.id,
    order: null,
    standing: { rally: at },
    mailbag: [],
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
      ships[id] = newShip(id, shipName(rng, taken), HULLS[role], faction, capital, commander)
    }
  }
  return { ships, characters }
}
