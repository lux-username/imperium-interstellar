import { describe, expect, it } from 'vitest'
import { buy, demandLevel, dutyRate, GOODS, inspectionChance, newMarket, priceOf, sell, supplyLevel, tickMarket, tradeCodes } from './economy'
import { advanceWeek, buyGoods, newGame, playerShip, refuel, sail, sellGoods, STARTING_PURSE, takeFreight } from './game'
import { characterLocation } from './mail'
import { createRng } from './rng'
import type { WorldId, WorldProfile } from './types'

const farm: WorldProfile = { starport: 'B', size: 6, atmosphere: 6, hydrographics: 6, population: 6, government: 5, law: 4, tech: 8 }
const hive: WorldProfile = { starport: 'A', size: 7, atmosphere: 4, hydrographics: 2, population: 9, government: 8, law: 7, tech: 13 }

describe('trade codes and prices', () => {
  it('reads codes off the profile', () => {
    expect(tradeCodes(farm)).toContain('Ag')
    expect(tradeCodes(farm)).toContain('Ni')
    expect(tradeCodes(hive)).toContain('In')
    expect(tradeCodes(hive)).toContain('Hi')
    expect(tradeCodes(hive)).toContain('Ht')
  })

  it('a world sells what it makes cheap and pays for what it wants', () => {
    expect(supplyLevel(farm, 'grain')).toBeGreaterThan(0)
    expect(demandLevel(hive, 'grain')).toBeGreaterThan(0)
    const flat = { mood: 1, pressure: 0 }
    expect(priceOf(farm, 'grain', flat)).toBeLessThan(priceOf(hive, 'grain', flat))
    expect(priceOf(hive, 'machinery', flat)).toBeLessThan(priceOf(farm, 'machinery', flat))
    expect(supplyLevel(farm, 'instruments')).toBe(0)
  })

  it('buying takes stock and lifts the price; selling lowers it; everyone pays duty and a foreigner pays more', () => {
    const rng = createRng(1)
    const world = { id: 'w' as WorldId, name: 'w', hex: { col: 1, row: 1 }, cultures: [], profile: farm, empire: 'e-a' as never, board: {}, market: newMarket(rng, farm), freight: [], news: [], gossip: {} }
    const before = world.market.grain.price
    const stock = world.market.grain.stock
    expect(stock).toBeGreaterThan(0)
    const home = dutyRate(world, 'e-a' as never)
    expect(home).toBe(0.1)
    expect(dutyRate(world, 'e-b' as never)).toBe(0.2)
    const d = buy(world, 'grain', 20, 'e-a' as never)!
    expect(d.tons).toBe(20)
    expect(d.duty).toBe(Math.round(20 * before * home))
    expect(d.credits).toBe(20 * before + d.duty)
    expect(world.market.grain.stock).toBe(stock - 20)
    expect(world.market.grain.price).toBeGreaterThan(before)
    const mid = world.market.grain.price
    const s = sell(world, 'grain', 40, 'e-b' as never)
    expect(s.duty).toBe(Math.round(40 * mid * 0.2))
    expect(s.credits).toBe(40 * mid - s.duty)
    expect(world.market.grain.price).toBeLessThan(mid)
    expect(sell(world, 'grain', 10, 'e-b' as never, { smuggle: true }).duty).toBe(0)
    tickMarket(rng, world)
    expect(world.market.grain.stock).toBeGreaterThan(stock - 20)
  })

  it('goods a world does not want go on the dock for resale; goods it wants are consumed', () => {
    const rng = createRng(2)
    const world = { id: 'w' as WorldId, name: 'w', hex: { col: 1, row: 1 }, cultures: [], profile: farm, empire: 'e-a' as never, board: {}, market: newMarket(rng, farm), freight: [], news: [], gossip: {} }
    expect(demandLevel(farm, 'metals')).toBeGreaterThan(0)
    const metals = world.market.metals.stock
    sell(world, 'metals', 40, 'e-a' as never)
    expect(world.market.metals.stock).toBe(metals)
    expect(demandLevel(farm, 'luxuries')).toBe(0)
    const luxuries = world.market.luxuries.stock
    sell(world, 'luxuries', 40, 'e-a' as never)
    expect(world.market.luxuries.stock).toBe(luxuries + 20)
  })

  it('the customs house looks harder at strict, big, foreign and wartime trade', () => {
    const slack = { profile: { ...farm, law: 1, starport: 'C' as const }, empire: 'e-a' as never }
    const strict = { profile: { ...hive, law: 9 }, empire: 'e-a' as never }
    expect(inspectionChance(slack, 'e-a' as never, false)).toBeLessThan(0.1)
    expect(inspectionChance(strict, 'e-a' as never, false)).toBeGreaterThan(0.5)
    expect(inspectionChance(strict, 'e-b' as never, true)).toBeGreaterThan(inspectionChance(strict, 'e-a' as never, false))
  })
})

describe('the trader at the brokers', () => {
  it('buys, sails, sells, pays for fuel and owes the lender', () => {
    const state = newGame(21)
    const ship = playerShip(state)!
    const here = characterLocation(state, state.player)!
    const good = GOODS.find((g) => state.worlds[here].market[g].stock >= 10)!
    const price = state.worlds[here].market[good].price
    expect(buyGoods(state, good, 10)).toMatchObject({ kind: 'ok', tons: 10 })
    expect(state.characters[state.player].purse).toBe(STARTING_PURSE - 10 * price - Math.round(10 * price * dutyRate(state.worlds[here], state.characters[state.player].empire)))
    expect(state.empires[state.worlds[here].empire].treasury).toBeGreaterThan(0)
    expect(ship.hold[0]).toMatchObject({ kind: 'cargo', good, tons: 10 })
    const to = Object.keys(state.worlds).find((w) => w !== here && sail(state, w as WorldId)) as WorldId
    expect(to).toBeDefined()
    expect(ship.course).toBe(to)
    advanceWeek(state)
    expect(ship.location.kind).toBe('transit')
    expect(ship.fuel).toBe(1)
    advanceWeek(state)
    expect(characterLocation(state, state.player)).toBe(to)
    const purse = state.characters[state.player].purse
    expect(sellGoods(state, good, 10).kind).toBe('ok')
    expect(state.characters[state.player].purse).toBeGreaterThan(purse)
    expect(ship.hold.length).toBe(0)
    const port = state.worlds[to].profile.starport
    const p2 = state.characters[state.player].purse
    if (port === 'A' || port === 'B' || port === 'C') {
      expect(refuel(state)).toBe(true)
      expect(ship.fuel).toBe(2)
      expect(state.characters[state.player].purse).toBeLessThan(p2)
    } else expect(refuel(state)).toBe(false)
    const debt = state.characters[state.player].debt!
    const balance = debt.balance
    const due = debt.nextDue
    while (state.week < due) advanceWeek(state)
    expect(state.characters[state.player].debt!.balance).toBe(balance - 2000)
  })

  it('carries freight and is paid on delivery', () => {
    const state = newGame(22)
    let tries = 0
    while (tries++ < 30) {
      const here = characterLocation(state, state.player)!
      const offer = state.worlds[here].freight.find((f) => state.worlds[f.to] && f.tons <= 80 && sail(state, f.to))
      if (offer) {
        const purse = state.characters[state.player].purse
        expect(takeFreight(state, offer.id)).toBe(true)
        advanceWeek(state)
        advanceWeek(state)
        expect(characterLocation(state, state.player)).toBe(offer.to)
        expect(playerShip(state)!.hold.length).toBe(0)
        expect(state.characters[state.player].purse).toBeGreaterThanOrEqual(purse + offer.tons * offer.rate - 2000)
        return
      }
      advanceWeek(state)
    }
    throw new Error('no freight offered in thirty weeks')
  })

  it('prices seen at the brokers enter the player\'s belief and age there', () => {
    const state = newGame(23)
    const here = characterLocation(state, state.player)!
    const known = state.beliefs[state.player].prices[here]
    // The price as it was seen; captains may have traded since.
    expect(known?.grain?.price).toBeGreaterThan(0)
    expect(known?.grain?.observed).toBe(0)
    const to = Object.keys(state.worlds).find((w) => w !== here && sail(state, w as WorldId)) as WorldId
    advanceWeek(state)
    advanceWeek(state)
    expect(state.beliefs[state.player].prices[here].grain!.observed).toBe(0)
    expect(state.beliefs[state.player].prices[to]?.grain?.observed).toBe(2)
  })
})
