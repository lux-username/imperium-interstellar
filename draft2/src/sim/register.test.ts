import { describe, expect, it } from 'vitest'
import { advanceWeek, buyGoods, buyRegister, newGame, PLAYER, playerShip, registerFee, sail, sellGoods, talkAtBar } from './game'
import { characterLocation } from './mail'
import { learnTraffic } from './belief'
import { bestPlan } from './agents'
import { lineKey } from './view'
import type { Ship, WorldId } from './types'
import { GOODS as GOODS_ } from './economy'

describe('the port register', () => {
  it('records arrivals, sailings and trades on the books, and not smuggling', () => {
    const state = newGame(101)
    const here = characterLocation(state, PLAYER) as WorldId
    const port = state.worlds[here]
    const good = GOODS_.find((g) => port.market[g].stock >= 40)!
    buyGoods(state, good, 10)
    port.profile.law = 0
    let smuggled = 0
    for (let i = 0; i < 5 && smuggled === 0; i++) if (buyGoods(state, good, 5, true).kind === 'ok') smuggled = 5
    const line = port.register.find((m) => m.ship === playerShip(state)!.id && m.week === state.week)!
    expect(line.bought.length).toBe(1)
    expect(line.bought[0]).toMatchObject({ good, tons: 10 })
    const to = Object.keys(state.worlds).find((w) => w !== here && sail(state, w as WorldId)) as WorldId
    advanceWeek(state)
    // The sailing is on the page of the week she sailed.
    expect(port.register.find((m) => m.ship === playerShip(state)!.id && m.to !== null)?.to).toBe(to)
    advanceWeek(state)
    const there = state.worlds[to].register.find((m) => m.ship === playerShip(state)!.id && m.week === state.week)!
    expect(there.from).toBe(here)
    sellGoods(state, good, 10)
    expect(there.sold[0]).toMatchObject({ good, tons: 10 })
  })

  it('the player sees this week\'s page with their own eyes, buys the year from the administrator, and the docks talk of sales', () => {
    const state = newGame(102)
    for (let i = 0; i < 20; i++) advanceWeek(state)
    const here = characterLocation(state, PLAYER) as WorldId
    const seen = state.beliefs[PLAYER].traffic[here] ?? []
    // Only what was seen with the player's own eyes, week by week they were there.
    for (const k of seen) expect(['seen', 'heard']).toContain(k.source)
    const fee = registerFee(state)!
    expect(fee).toBeGreaterThan(0)
    state.characters[PLAYER].purse = 100000
    const got = buyRegister(state)
    expect(got).toBeGreaterThanOrEqual(0)
    const after = state.beliefs[PLAYER].traffic[here]
    expect(after.length).toBe(state.worlds[here].register.length)
    expect(after.some((k) => k.source === 'register')).toBe(true)
    expect(after.every((k) => state.week - k.movement.week < 52)).toBe(true)
    // Gossip: somewhere in the subsector, someone has heard of someone else's sale elsewhere.
    let heard = 0
    for (let i = 0; i < 30 && heard === 0; i++) {
      advanceWeek(state)
      if (characterLocation(state, PLAYER) !== null) talkAtBar(state)
      heard = Object.values(state.beliefs).reduce((n, b) => n + Object.values(b.traffic).flat().filter((k) => k.source === 'heard').length, 0)
    }
    expect(heard).toBeGreaterThan(0)
  })

  it('captains learn of each other\'s comings and goings the same way, and ports keep only a year', () => {
    const state = newGame(103)
    for (let i = 0; i < 60; i++) advanceWeek(state)
    for (const w of Object.values(state.worlds)) for (const m of w.register) expect(state.week - m.week).toBeLessThan(52)
    const captains = Object.values(state.characters).filter((c) => c.id !== PLAYER && state.beliefs[c.id])
    const knowing = captains.filter((c) => Object.values(state.beliefs[c.id].traffic).some((t) => t.some((k) => k.source === 'heard'))).length
    expect(knowing).toBeGreaterThan(captains.length / 4)
  })
})

describe('what captains do with the register', () => {
  it('a sale heard of elsewhere becomes a price in the hearer\'s book, marked hearsay', () => {
    const state = newGame(104)
    const c = Object.values(state.characters).find((x) => x.id !== PLAYER && state.beliefs[x.id])!
    const b = state.beliefs[c.id]
    const w = Object.keys(state.worlds).sort()[5] as WorldId
    b.prices[w] = {}
    const m = { week: 3, ship: 's-x' as never, shipName: 'X', type: 'free_trader' as const, empire: c.empire, captain: null, captainName: null, from: null, to: null, sold: [{ good: 'grain', tons: 20, price: 777 }], bought: [] }
    learnTraffic(b, w, [m], 'heard', 5)
    expect(b.prices[w].grain).toMatchObject({ price: 777, observed: 3, heard: true })
  })

  it('a captain who knows of a guild line on the pair they would sail expects half as much from it', () => {
    const state = newGame(105)
    // Wait for a week in which some captain in port has a plan worth the name.
    let trader: Ship | undefined
    for (let i = 0; i < 40 && !trader; i++) {
      advanceWeek(state)
      trader = Object.values(state.ships).find((s) => s.owner.kind === 'personal' && s.captain && s.captain !== PLAYER && !s.duty && s.location.kind === 'world' && (bestPlan(state, state.characters[s.captain!], s, (s.location as { world: WorldId }).world)?.profit ?? 0) > 4000)
    }
    if (!trader) throw new Error('no captain with a plan in forty weeks')
    const c = state.characters[trader.captain!]
    const at = (trader.location as { world: WorldId }).world
    const before = bestPlan(state, c, trader, at)!
    state.beliefs[c.id].lines[lineKey(at, before.to)] = { line: { from: at, to: before.to, empire: c.empire }, observed: state.week, report: 'r' as never }
    const after = bestPlan(state, c, trader, at)
    expect(after === null || after.to !== before.to || after.profit <= Math.ceil(before.profit / 2)).toBe(true)
  })
})
