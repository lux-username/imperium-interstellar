import { describe, expect, it } from 'vitest'
import { advanceWeek, buyGoods, buyRegister, newGame, PLAYER, playerShip, registerFee, sail, sellGoods, talkAtBar } from './game'
import { characterLocation } from './mail'
import type { WorldId } from './types'
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
    // Gossip: somewhere in the subsector the docks are talking of someone's sale elsewhere.
    let heard = 0
    for (let i = 0; i < 30 && heard === 0; i++) {
      advanceWeek(state)
      if (characterLocation(state, PLAYER) !== null) {
        talkAtBar(state)
        heard = Object.values(state.beliefs[PLAYER].traffic).flat().filter((k) => k.source === 'heard').length
      }
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
