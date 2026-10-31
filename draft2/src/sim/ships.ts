/**
 * Hulls: naming by type. Movement on the packets is in ./scouts.ts; hulls
 * sailing on their own account land with the free trader phase. The
 * pools in ./data/ships.ts are keyed by draft 1's roles; this maps the six
 * draft 2 types onto them until the pools are re-keyed.
 */
import { SHIP_NAMES, type NamedHull } from './data/ships'
import { nextInt, type Rng } from './rng'
import type { ShipType } from './types'

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
