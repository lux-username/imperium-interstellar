import { describe, expect, it } from 'vitest'
import { buy, consumption, demandLevel, dutyRate, GOODS, inspectionChance, newMarket, priceOf, sell, supplyLevel, targetStock, tickMarket, tradeCodes } from './economy'
import { advanceWeek, buyGoods, newGame, playerShip, quoteBuy, quoteSale, refuel, sail, sellGoods, STARTING_PURSE, takeFreight } from './game'
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
    // At the stock each would like to hold, the codes alone decide; on a real dock the maker's heap and the wanter's bare dock widen it.
    const at = (p: WorldProfile, g: 'grain' | 'machinery') => priceOf(p, g, { mood: 1, stock: targetStock(p, g) })
    expect(at(farm, 'grain')).toBeLessThan(at(hive, 'grain'))
    expect(at(hive, 'machinery')).toBeLessThan(at(farm, 'machinery'))
    expect(supplyLevel(farm, 'instruments')).toBe(0)
  })

  it('buying takes stock and lifts the price; selling lowers it; everyone pays duty and a foreigner pays more', () => {
    const rng = createRng(1)
    const world = { id: 'w' as WorldId, name: 'w', hex: { col: 1, row: 1 }, cultures: [], profile: farm, empire: 'e-a' as never, board: {}, market: newMarket(rng, farm), freight: [], news: [], gossip: {}, isolation: 0 }
    const before = world.market.grain.price
    const stock = world.market.grain.stock
    expect(stock).toBeGreaterThan(0)
    const home = dutyRate(world, 'e-a' as never)
    expect(home).toBe(0.1)
    expect(dutyRate(world, 'e-b' as never)).toBe(0.2)
    const d = buy(world, 'grain', 20, 'e-a' as never)!
    expect(d.tons).toBe(20)
    // Each ton dearer than the last: the lot costs a little over the price on the board.
    expect(d.price).toBeGreaterThanOrEqual(before)
    expect(d.duty).toBe(Math.round(20 * d.price * home))
    expect(d.credits).toBe(20 * d.price + d.duty)
    expect(world.market.grain.stock).toBe(stock - 20)
    expect(world.market.grain.price).toBeGreaterThan(before)
    const mid = world.market.grain.price
    const s = sell(world, 'grain', 40, 'e-b' as never)
    expect(s.price).toBeLessThanOrEqual(mid)
    expect(s.duty).toBe(Math.round(40 * s.price * 0.2))
    expect(s.credits).toBe(40 * s.price - s.duty)
    expect(world.market.grain.price).toBeLessThan(mid)
    expect(sell(world, 'grain', 10, 'e-b' as never, { smuggle: true }).duty).toBe(0)
    tickMarket(rng, world)
    expect(world.market.grain.stock).toBeGreaterThan(stock - 20)
  })

  it('what is sold goes on the dock; what the world wants it eats week by week, and what it does not want slowly goes off', () => {
    const rng = createRng(2)
    const world = { id: 'w' as WorldId, name: 'w', hex: { col: 1, row: 1 }, cultures: [], profile: farm, empire: 'e-a' as never, board: {}, market: newMarket(rng, farm), freight: [], news: [], gossip: {}, isolation: 0 }
    expect(demandLevel(farm, 'metals')).toBeGreaterThan(0)
    expect(consumption(farm, 'metals')).toBeGreaterThan(consumption(farm, 'luxuries'))
    const metals = world.market.metals.stock
    sell(world, 'metals', 40, 'e-a' as never)
    expect(world.market.metals.stock).toBe(metals + 40)
    const before = world.market.metals.stock
    tickMarket(rng, world)
    expect(world.market.metals.stock).toBeLessThan(before)
    // Eaten, and a little gone off besides.
    expect(world.market.metals.stock).toBeGreaterThanOrEqual(before - consumption(farm, 'metals') - Math.ceil(before * 0.03) - 1)
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
    const bought = buyGoods(state, good, 10)
    expect(bought).toMatchObject({ kind: 'ok', tons: 10 })
    if (bought.kind !== 'ok') throw new Error('refused')
    expect(bought.duty).toBeGreaterThan(0)
    expect(state.characters[state.player].purse).toBe(STARTING_PURSE - bought.credits)
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
    expect(state.characters[state.player].debt!.balance).toBe(balance - 5000)
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
        expect(state.characters[state.player].purse).toBeGreaterThanOrEqual(purse + offer.tons * offer.rate - 5000)
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

describe('the sale quote', () => {
  it('says exactly what the brokers then pay', () => {
    const state = newGame(24)
    const here = characterLocation(state, state.player)!
    const good = GOODS.find((g) => state.worlds[here].market[g].stock >= 30)!
    buyGoods(state, good, 30)
    const q = quoteSale(state, good, 17)!
    expect(q.credits).toBe(17 * q.price - q.duty)
    const purse = state.characters[state.player].purse
    const s = sellGoods(state, good, 17)
    expect(s.kind).toBe('ok')
    if (s.kind === 'ok') expect(s.credits).toBe(q.credits)
    expect(state.characters[state.player].purse).toBe(purse + q.credits)
  })
})

describe('the buy quote', () => {
  it('says exactly what the brokers then charge, and caps at dock, hold and purse', () => {
    const state = newGame(25)
    const here = characterLocation(state, state.player)!
    const good = GOODS.find((g) => state.worlds[here].market[g].stock >= 30)!
    const q = quoteBuy(state, good, 12)!
    expect(q.most).toBeGreaterThanOrEqual(12)
    expect(q.most).toBeLessThanOrEqual(Math.min(80, state.worlds[here].market[good].stock))
    expect(q.credits).toBe(12 * q.price + q.duty)
    const purse = state.characters[state.player].purse
    const b = buyGoods(state, good, 12)
    expect(b.kind).toBe('ok')
    if (b.kind === 'ok') expect(b.credits).toBe(q.credits)
    expect(state.characters[state.player].purse).toBe(purse - q.credits)
    state.characters[state.player].purse = 1000
    const poor = quoteBuy(state, good, 50)!
    expect(poor.most * poor.price).toBeLessThanOrEqual(1000)
  })
})
