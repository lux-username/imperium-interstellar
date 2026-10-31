import { describe, expect, it } from 'vitest'
import { advanceWeek, maintain, newGame, PLAYER, playerShip, sail } from './game'
import { characterLocation } from './mail'
import { createRng } from './rng'
import { driveFault, MAINTENANCE_EVERY, MAINTENANCE_WEEKS, newShip, overdue } from './ships'
import type { CharacterId, ShipId, WorldId } from './types'

describe('maintenance', () => {
  it('the player lays her up at a dockyard for four weeks and a tenth of her price, and she comes out mended', () => {
    const state = newGame(51)
    const ship = playerShip(state)!
    ship.damage = 2
    const purse = state.characters[PLAYER].purse
    expect(maintain(state)).toBe(true)
    expect(state.characters[PLAYER].purse).toBe(purse - 6000)
    expect(ship.inYard).toBe(MAINTENANCE_WEEKS)
    expect(sail(state, Object.keys(state.worlds)[0] as WorldId)).toBe(false)
    expect(state.characters[PLAYER].body.kind).toBe('world')
    for (let i = 0; i < MAINTENANCE_WEEKS; i++) advanceWeek(state)
    expect(ship.inYard).toBeNull()
    expect(ship.damage).toBe(0)
    expect(ship.maintained).toBe(MAINTENANCE_WEEKS)
    expect(characterLocation(state, PLAYER)).toBe((ship.location as { world: WorldId }).world)
  })

  it('an overdue drive baulks now and then, and more the longer it goes', () => {
    const ship = newShip(createRng(1), 's' as ShipId, 'free_trader', 'e' as never, { kind: 'personal', character: 'c' as CharacterId }, 'w' as WorldId, new Set())
    expect(overdue(ship, MAINTENANCE_EVERY)).toBe(0)
    expect(overdue(ship, MAINTENANCE_EVERY + 10)).toBe(10)
    const rate = (week: number) => {
      const rng = createRng(7)
      let n = 0
      for (let i = 0; i < 2000; i++) if (driveFault(rng, ship, week)) n++
      return n / 2000
    }
    expect(rate(MAINTENANCE_EVERY)).toBe(0)
    expect(rate(MAINTENANCE_EVERY + 1)).toBeGreaterThan(0.01)
    expect(rate(MAINTENANCE_EVERY + 1)).toBeLessThan(0.06)
    expect(rate(MAINTENANCE_EVERY + 40)).toBeGreaterThan(rate(MAINTENANCE_EVERY + 1) * 3)
  })

  it('NPC captains take their hulls into the yard over a year', () => {
    const state = newGame(52)
    let laidUp = 0
    for (let i = 0; i < 60; i++) {
      advanceWeek(state)
      for (const s of Object.values(state.ships)) if (s.inYard !== null && s.owner.kind === 'personal' && s.owner.character !== PLAYER) laidUp++
    }
    expect(laidUp).toBeGreaterThan(0)
  })
})
