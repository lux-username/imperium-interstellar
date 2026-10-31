import { describe, expect, it } from 'vitest'
import { bestPlan, rememberLeg } from './agents'
import { advanceWeek, newGame, PLAYER } from './game'
import type { Ship, WorldId } from './types'

function someTrader(state: ReturnType<typeof newGame>): Ship {
  let trader: Ship | undefined
  for (let i = 0; i < 40 && !trader; i++) {
    advanceWeek(state)
    trader = Object.values(state.ships).find((s) => s.owner.kind === 'personal' && s.captain && s.captain !== PLAYER && !s.duty && s.location.kind === 'world' && (bestPlan(state, state.characters[s.captain!], s, (s.location as { world: WorldId }).world)?.profit ?? 0) > 4000)
  }
  if (!trader) throw new Error('no captain with a plan')
  return trader
}

describe('smarter captains', () => {
  it('a pair that has lately paid nothing is rated at half, whatever the board says', () => {
    const state = newGame(141)
    const trader = someTrader(state)
    const c = state.characters[trader.captain!]
    const at = (trader.location as { world: WorldId }).world
    c.legs = {}
    const before = bestPlan(state, c, trader, at)!
    rememberLeg(state, c, at, before.to, 100)
    rememberLeg(state, c, at, before.to, 100)
    const after = bestPlan(state, c, trader, at)
    expect(after === null || after.to !== before.to || after.profit <= Math.ceil(before.profit / 2) + 1).toBe(true)
  })

  it('captains remember their legs, buy the register, and almost never let maintenance slide', () => {
    const state = newGame(142)
    let overdueWeeks = 0, weeks = 0
    for (let i = 0; i < 52; i++) {
      advanceWeek(state)
      for (const s of Object.values(state.ships)) {
        if (s.owner.kind !== 'personal' || !s.captain || s.captain === PLAYER || s.duty) continue
        weeks++
        if (state.week - s.maintained > 26) overdueWeeks++
      }
    }
    const traders = Object.values(state.ships).filter((s) => s.owner.kind === 'personal' && s.captain && s.captain !== PLAYER && !s.duty)
    expect(traders.filter((s) => Object.keys(state.characters[s.captain!].legs ?? {}).length > 0).length).toBeGreaterThan(traders.length / 2)
    expect(traders.filter((s) => Object.values(state.beliefs[s.captain!]?.traffic ?? {}).flat().some((k) => k.source === 'register')).length).toBeGreaterThan(traders.length / 2)
    expect(overdueWeeks / weeks).toBeLessThan(0.15)
  })
})
