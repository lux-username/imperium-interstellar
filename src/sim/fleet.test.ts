import { describe, expect, it } from 'vitest'
import { SHIP_NAMES } from './data/ships'
import { shipName } from './fleet'
import { advanceWeek, newGame } from './game'
import { createRng } from './rng'

describe('ship names', () => {
  it('come from the pool for the class and are never repeated while the pool lasts', () => {
    const rng = createRng(1)
    const taken = new Set<string>()
    const pool = new Set(SHIP_NAMES.escort)
    for (let i = 0; i < SHIP_NAMES.escort.length; i++) {
      const name = shipName(rng, 'escort', taken)
      expect(pool.has(name), name).toBe(true)
    }
    expect(taken.size).toBe(SHIP_NAMES.escort.length)
  })

  it('number the reuse once a pool is spent, as navies do', () => {
    const rng = createRng(2)
    const taken = new Set(SHIP_NAMES.scout)
    const second = shipName(rng, 'scout', taken)
    expect(second).toMatch(/ II$/)
    expect(SHIP_NAMES.scout).toContain(second.replace(/ II$/, ''))
    // Spend the seconds too and the thirds follow.
    for (const n of SHIP_NAMES.scout) taken.add(`${n} II`)
    expect(shipName(rng, 'scout', taken)).toMatch(/ III$/)
  })

  it('give every hull in a new game a name of its own class, packets and pirates included', () => {
    const s = newGame(3)
    for (let i = 0; i < 40; i++) advanceWeek(s)
    const seen = new Set<string>()
    const roles = new Set(Object.values(s.ships).map((ship) => ship.role))
    for (const role of ['patrol', 'scout', 'transport', 'packet', 'raider'] as const) expect(roles.has(role), role).toBe(true)
    for (const ship of Object.values(s.ships)) {
      if (ship.role === 'merchant') continue
      expect(SHIP_NAMES[ship.role], `${ship.name} (${ship.role})`).toContain(ship.name)
      expect(seen.has(ship.name), ship.name).toBe(false)
      seen.add(ship.name)
    }
  })
})
