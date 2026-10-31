import { describe, expect, it } from 'vitest'
import { tellPrices } from './agents'
import { emptyBelief } from './belief'
import { advanceWeek, newGame, PLAYER, talkAtBar } from './game'
import { characterLocation } from './mail'
import type { WorldId } from './types'

describe('captain-agents', () => {
  it('the subsector starts with traders who sail, trade and mostly prosper over a year', () => {
    const state = newGame(31)
    const traders = Object.values(state.ships).filter((s) => s.owner.kind === 'personal' && s.owner.character !== PLAYER && !s.duty).map((s) => state.characters[s.captain!])
    expect(traders.length).toBeGreaterThanOrEqual(8)
    const start = traders.map((c) => c.purse)
    let jumps = 0
    let dealsWeeks = 0
    for (let i = 0; i < 52; i++) {
      advanceWeek(state)
      for (const s of Object.values(state.ships)) if (s.owner.kind === 'personal' && s.owner.character !== PLAYER && !s.duty && s.location.kind === 'transit') jumps++
      if (Object.values(state.ships).some((s) => s.owner.kind === 'personal' && s.owner.character !== PLAYER && !s.duty && s.hold.length > 0)) dealsWeeks++
    }
    expect(jumps).toBeGreaterThan(traders.length * 8)
    expect(dealsWeeks).toBeGreaterThan(40)
    const richer = traders.filter((c, i) => c.purse > start[i]).length
    expect(richer).toBeGreaterThanOrEqual(traders.length * 0.4)
    // Nobody reads prices they never saw or heard: every believed price names a week it was seen.
    for (const c of traders) for (const w of Object.values(state.beliefs[c.id].prices)) for (const e of Object.values(w)) expect(e!.observed).toBeLessThanOrEqual(state.week)
  })

  it('captains avoid an enemy\'s ports once they have heard of the war', () => {
    const state = newGame(32)
    for (const k of Object.keys(state.stances)) state.stances[k].until = 1
    for (let i = 0; i < 30; i++) {
      advanceWeek(state)
      for (const s of Object.values(state.ships)) {
        if (s.owner.kind !== 'personal' || s.owner.character === PLAYER || s.duty || !s.captain || s.location.kind !== 'transit') continue
        const captain = state.characters[s.captain]
        const dest = state.worlds[s.location.to]
        const key = [captain.empire, dest.empire].sort().join(':')
        const heard = state.beliefs[captain.id].stances[key]
        if (heard?.stance === 'war') throw new Error(`${captain.name} sailed for an enemy port knowing of the war`)
      }
    }
  })

  it('talk carries newer prices and not older ones', () => {
    const a = emptyBelief()
    const b = emptyBelief()
    a.prices['w' as WorldId] = { grain: { price: 10, stock: 1, observed: 5 }, ore: { price: 7, stock: 1, observed: 2 } }
    b.prices['w' as WorldId] = { grain: { price: 12, stock: 1, observed: 8 } }
    expect(tellPrices(a, b)).toBe(1)
    expect(b.prices['w' as WorldId].grain!.price).toBe(12)
    expect(b.prices['w' as WorldId].ore!.price).toBe(7)
  })

  it('the player learns prices at the bar from captains in port', () => {
    const state = newGame(33)
    let learned = 0
    for (let i = 0; i < 20 && learned === 0; i++) {
      advanceWeek(state)
      if (characterLocation(state, PLAYER) !== null) learned = talkAtBar(state)
    }
    expect(learned).toBeGreaterThan(0)
  })
})
