import { describe, expect, it } from 'vitest'
import { codeStrength, isolationOf, priceOf } from './economy'
import { advanceWeek, newGame, PLAYER, playerShip } from './game'
import { characterLocation } from './mail'
import type { WorldId, WorldProfile } from './types'

const farm: WorldProfile = { starport: 'B', size: 6, atmosphere: 6, hydrographics: 6, population: 6, government: 5, law: 4, tech: 8 }

describe('gems and milk runs', () => {
  it('a world off the lanes sells its surplus cheaper and pays more for its wants than a hub', () => {
    expect(isolationOf(3)).toBe(0)
    expect(isolationOf(1)).toBe(1)
    expect(isolationOf(0)).toBe(2)
    expect(codeStrength(2)).toBeGreaterThan(codeStrength(0))
    const flat = { mood: 1, pressure: 0 }
    expect(priceOf(farm, 'grain', flat, 2)).toBeLessThan(priceOf(farm, 'grain', flat, 0))
    expect(priceOf(farm, 'machinery', flat, 2)).toBeGreaterThan(priceOf(farm, 'machinery', flat, 0))
  })

  it('worldgen sets isolation from the chart', () => {
    const state = newGame(91)
    const seen = new Set(Object.values(state.worlds).map((w) => w.isolation))
    expect(seen.has(0)).toBe(true)
    expect(seen.has(2)).toBe(true)
  })
})

describe('the guilds\' bulk lines', () => {
  it('within a year each guild has ranked its book and put haulers on lines, and the lines flatten the margin', () => {
    const state = newGame(92)
    let lines = 0
    let loaded = 0
    for (let i = 0; i < 60; i++) {
      advanceWeek(state)
      for (const g of Object.values(state.guilds)) lines += g.lines.length
      for (const s of Object.values(state.ships)) if (s.duty?.kind === 'haul' && s.hold.length > 0) loaded++
    }
    expect(lines).toBeGreaterThan(0)
    expect(loaded).toBeGreaterThan(0)
    const news = Object.values(state.worlds).flatMap((w) => w.news).some((n) => /bulk line/.test(n.text))
    expect(news).toBe(true)
    for (const g of Object.values(state.guilds)) {
      for (const l of g.lines) {
        // The line was reckoned on fresh prices known to the book, not on anything else.
        expect(g.book[l.from]?.[l.good]).toBeDefined()
        expect(g.book[l.to]?.[l.good]).toBeDefined()
        expect(g.danger[l.from] === undefined || state.week - g.danger[l.from] > 12).toBe(true)
      }
    }
  })
})

describe('the lender\'s patience', () => {
  it('two payments behind, the hull is taken at a home dockyard and her owner put ashore', () => {
    const state = newGame(93)
    const me = state.characters[PLAYER]
    me.purse = 0
    const ship = playerShip(state)!
    const here = characterLocation(state, PLAYER) as WorldId
    expect(['A', 'B']).toContain(state.worlds[here].profile.starport)
    for (let i = 0; i < 12 && playerShip(state); i++) {
      advanceWeek(state)
      me.purse = 0
    }
    expect(playerShip(state)).toBeNull()
    expect(ship.owner.kind).toBe('organisation')
    expect(me.body).toEqual({ kind: 'world', world: here })
    expect(me.debt).toBeNull()
    expect(state.worlds[here].news.some((n) => /lender/.test(n.text))).toBe(true)
  })
})
