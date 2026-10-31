/**
 * Hulls: naming by type, and sailing on one's own account. A hull with a
 * course set jumps when the week turns, if she has the fuel and the course
 * is within her jump; she lands next week whatever the distance. Movement
 * on the packets is in ./scouts.ts.
 */
import { SHIP_NAMES, type NamedHull } from './data/ships'
import { hexDistance } from './hex'
import { nextInt, type Rng } from './rng'
import { SHIP_CLASSES, type CargoLot, type CharacterId, type EmpireId, type GameState, type Owner, type Ship, type ShipId, type ShipType, type WorldId } from './types'
import type { Good } from './economy'

const POOL: Record<ShipType, NamedHull> = {
  scout: 'scout',
  free_trader: 'transport',
  far_trader: 'transport',
  bulk_freighter: 'transport',
  corvette: 'escort',
  frigate: 'patrol',
}

const ORDINALS = ['II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']

/** A name from the type's pool not yet in `taken`; when the pool runs dry the reuse is numbered as navies do. Adds the result to `taken`. */
export function shipName(rng: Rng, type: ShipType, taken: Set<string>): string {
  const pool = SHIP_NAMES[POOL[type]]
  const free = pool.filter((n) => !taken.has(n))
  let name = free.length > 0 ? free[nextInt(rng, 0, free.length - 1)] : pool[nextInt(rng, 0, pool.length - 1)]
  for (let i = 0; taken.has(name); i++) name = `${name.replace(/ [IVX]+$/, '')} ${ORDINALS[Math.min(i, ORDINALS.length - 1)]}`
  taken.add(name)
  return name
}

/** A new hull of a type, lying at a world, full tanks, empty hold. */
export function newShip(rng: Rng, id: ShipId, type: ShipType, empire: EmpireId, owner: Owner, at: WorldId, taken: Set<string>, captain: CharacterId | null = null): Ship {
  return {
    id,
    name: shipName(rng, type, taken),
    type,
    empire,
    owner,
    location: { kind: 'world', world: at },
    fuel: SHIP_CLASSES[type].tanks,
    damage: 0,
    hold: [],
    course: null,
    captain,
    passengers: [],
    mailbag: [],
    news: {},
    run: null,
    docked: -1,
  }
}

export function holdUsed(ship: Ship): number {
  return ship.hold.reduce((s, l) => s + l.tons, 0)
}

export function holdFree(ship: Ship): number {
  return SHIP_CLASSES[ship.type].hold - holdUsed(ship)
}

/** Tons of a good carried on the owner's account, and what was paid for them on average. */
export function holding(ship: Ship, good: Good): { tons: number; paid: number } | null {
  const lots = ship.hold.filter((l): l is Extract<CargoLot, { kind: 'cargo' }> => l.kind === 'cargo' && l.good === good)
  const tons = lots.reduce((s, l) => s + l.tons, 0)
  if (tons === 0) return null
  return { tons, paid: Math.round(lots.reduce((s, l) => s + l.tons * l.paid, 0) / tons) }
}

/** Take `tons` of a good off the owner's lots, oldest first. Returns the tons actually taken. */
export function unload(ship: Ship, good: Good, tons: number): number {
  let left = tons
  for (const lot of ship.hold) {
    if (left === 0) break
    if (lot.kind !== 'cargo' || lot.good !== good) continue
    const n = Math.min(left, lot.tons)
    lot.tons -= n
    left -= n
  }
  ship.hold = ship.hold.filter((l) => l.tons > 0)
  return tons - left
}

/** Worlds a hull at `from` can reach in one jump. */
export function reachable(state: GameState, from: WorldId, jump: number): WorldId[] {
  const here = state.worlds[from]
  return (Object.keys(state.worlds).sort() as WorldId[]).filter((id) => id !== from && hexDistance(state.worlds[id].hex, here.hex) <= jump)
}

/** Price of a tank of fuel at a port, or null where there is none. Refined at A and B; unrefined at C. */
export function fuelPrice(starport: string): number | null {
  if (starport === 'A' || starport === 'B') return 500
  if (starport === 'C') return 200
  return null
}

/** Set a hull's course for next week. False if out of jump, out of fuel, or not in port. */
export function setCourse(state: GameState, ship: Ship, to: WorldId | null): boolean {
  if (ship.location.kind !== 'world') return false
  if (to === null) {
    ship.course = null
    return true
  }
  if (!reachable(state, ship.location.world, SHIP_CLASSES[ship.type].jump).includes(to)) return false
  if (ship.fuel < 1) return false
  ship.course = to
  return true
}

/** Hulls with a course set jump: one tank, one week. Scouts on the packets are moved by ./scouts.ts. */
export function departOnAccount(state: GameState): void {
  const ids = Object.keys(state.ships).sort() as ShipId[]
  for (const id of ids) {
    const ship = state.ships[id]
    if (ship.run || ship.course === null || ship.location.kind !== 'world' || ship.fuel < 1) continue
    const from = ship.location.world
    if (!reachable(state, from, SHIP_CLASSES[ship.type].jump).includes(ship.course)) {
      ship.course = null
      continue
    }
    ship.fuel -= 1
    ship.location = { kind: 'transit', from, to: ship.course, arrives: state.week + 1 }
    ship.course = null
  }
}

/** Freight aboard for `at` is handed over and its fee paid to the hull's owner. Returns the credits earned. */
export function deliverFreight(state: GameState, ship: Ship, at: WorldId): number {
  let earned = 0
  const keep: CargoLot[] = []
  for (const lot of ship.hold) {
    if (lot.kind === 'freight' && lot.to === at) earned += lot.tons * lot.rate
    else keep.push(lot)
  }
  ship.hold = keep
  if (earned > 0 && ship.owner.kind === 'personal') {
    const owner = state.characters[ship.owner.character]
    if (owner) owner.purse += earned
  }
  return earned
}
