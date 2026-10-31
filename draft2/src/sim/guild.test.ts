import { describe, expect, it } from 'vitest'
import { codeStrength, isolationOf, priceOf, targetStock } from './economy'
import { advanceWeek, newGame, PLAYER, playerShip } from './game'
import { buildPlayerView } from './player'
import { characterLocation } from './mail'
import type { WorldId, WorldProfile } from './types'

const farm: WorldProfile = { starport: 'B', size: 6, atmosphere: 6, hydrographics: 6, population: 6, government: 5, law: 4, tech: 8 }

describe('gems and milk runs', () => {
  it('a world off the lanes sells its surplus cheaper and pays more for its wants than a hub', () => {
    expect(isolationOf(3)).toBe(0)
    expect(isolationOf(1)).toBe(1)
    expect(isolationOf(0)).toBe(2)
    expect(codeStrength(2)).toBeGreaterThan(codeStrength(0))
    const g = { mood: 1, stock: targetStock(farm, 'grain') }
    const m = { mood: 1, stock: targetStock(farm, 'machinery') }
    expect(priceOf(farm, 'grain', g, 2)).toBeLessThan(priceOf(farm, 'grain', g, 0))
    expect(priceOf(farm, 'machinery', m, 2)).toBeGreaterThan(priceOf(farm, 'machinery', m, 0))
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
        // The line was reckoned on worlds the book knows, not on anything else.
        expect(g.book[l.from]).toBeDefined()
        expect(g.book[l.to]).toBeDefined()
        expect(l.haulers).toBeGreaterThan(0)
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

describe('what a port says of the guild\'s lines', () => {
  it('a line is seen at either end, kept in belief by its newest word, and dropped when a later look no longer shows it', () => {
    const state = newGame(94)
    const g = Object.values(state.guilds)[0]
    const worlds = Object.keys(state.worlds).sort() as WorldId[]
    const from = worlds[0]
    const to = worlds[1]
    g.lines = [{ from, to, reckoned: 9999, since: 0, earned: 0, haulers: 1 }]
    const me = state.characters[PLAYER]
    me.body = { kind: 'world', world: from }
    const ship = playerShip(state)!
    ship.location = { kind: 'world', world: from }
    advanceWeek(state)
    const key = `${from}|${to}`
    expect(state.beliefs[PLAYER].lines[key]?.line.empire).toBe(g.empire)
    expect(state.beliefs[PLAYER].lines[key].observed).toBe(state.week)
    const view = buildPlayerView(state)
    expect(Object.keys(view.known.lines)).toContain(key)
    g.lines = []
    g.planned = state.week
    advanceWeek(state)
    expect(state.beliefs[PLAYER].lines[key]).toBeUndefined()
  })
})
