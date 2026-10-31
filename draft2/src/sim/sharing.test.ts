import { describe, expect, it } from 'vitest'
import { askCaptain, onTheFence, roundWouldHelp, wantsInfo, willingness } from './agents'
import { characterLocation } from './mail'
import { advanceWeek, newGame, PLAYER } from './game'
import type { Character, EmpireId, WorldId } from './types'

const person = (id: string, empire: string, guild?: string, outlaw?: boolean): Character => ({ id: id as never, name: id, culture: 'English', sex: 'm', empire: empire as EmpireId, body: { kind: 'world', world: 'w' as WorldId }, purse: 0, debt: null, guild: guild as EmpireId | undefined, outlaw })

describe('who tells whom', () => {
  it('ranks guild-fellows, then countrymen outside the guild, then free traders across the border, then guild to outsider, then rival guilds', () => {
    const g1 = person('g1', 'e1', 'e1')
    const g2 = person('g2', 'e1', 'e1')
    const g3 = person('g3', 'e2', 'e2')
    const f1 = person('f1', 'e1')
    const f2 = person('f2', 'e1')
    const f3 = person('f3', 'e2')
    expect(willingness(g1, g2)).toBeGreaterThan(willingness(f1, f2))
    expect(willingness(f1, f2)).toBeGreaterThan(willingness(f1, f3))
    expect(willingness(f1, f3)).toBeGreaterThan(willingness(g1, f1))
    expect(willingness(g1, f1)).toBeGreaterThan(willingness(g1, g3))
    expect(onTheFence(willingness(f1, f2))).toBe(true)
    expect(onTheFence(willingness(f1, f3))).toBe(true)
    expect(onTheFence(willingness(g1, g2))).toBe(false)
    expect(willingness(person('o', 'e1', undefined, true), f1)).toBeLessThan(0.3)
  })

  it('a captain asks only when their knowledge within reach is thin or stale', () => {
    const state = newGame(81)
    const trader = Object.values(state.ships).find((s) => s.owner.kind === 'personal' && s.captain !== PLAYER && !s.duty && s.location.kind === 'world')!
    const c = state.characters[trader.captain!]
    const at = (trader.location as { world: WorldId }).world
    for (const w of Object.keys(state.worlds) as WorldId[]) state.beliefs[c.id].prices[w] = { grain: { price: 1, stock: 1, observed: state.week } }
    expect(wantsInfo(state, c, trader, at)).toBe(false)
    state.beliefs[c.id].prices = {}
    expect(wantsInfo(state, c, trader, at)).toBe(true)
  })

  it('the guild\'s book fills from members calling at the seat, and gossip gathers on the docks', () => {
    const state = newGame(82)
    for (let i = 0; i < 30; i++) advanceWeek(state)
    const books = Object.values(state.guilds).map((g) => Object.keys(g.book).length)
    expect(Math.max(...books)).toBeGreaterThan(0)
    const gossip = Object.values(state.worlds).reduce((n, w) => n + Object.keys(w.gossip).length, 0)
    expect(gossip).toBeGreaterThan(0)
    // The book keeps provenance: what a member saw is entered as seen, what they only heard stays hearsay.
    const seen = Object.values(state.guilds).reduce((n, g) => n + Object.values(g.book).reduce((t, w) => t + Object.values(w).filter((e) => !e?.heard).length, 0), 0)
    expect(seen).toBeGreaterThan(0)
  })
})

describe('standing a round', () => {
  it('is offered only after a refusal that a round would have tipped, and then tells', () => {
    const state = newGame(83)
    let seen = { told: 0, refused: 0, offered: 0, bought: 0 }
    for (let i = 0; i < 60; i++) {
      advanceWeek(state)
      const at = characterLocation(state, PLAYER)
      if (at === null) continue
      state.characters[PLAYER].purse = 100000
      for (const s of Object.values(state.ships)) {
        if (!s.captain || s.captain === PLAYER || s.duty || characterLocation(state, s.captain) !== at) continue
        expect(roundWouldHelp(state, s.captain)).toBe(false)
        const a = askCaptain(state, s.captain)
        if (a === 'told') {
          seen.told++
          expect(roundWouldHelp(state, s.captain)).toBe(false)
          expect(askCaptain(state, s.captain, true)).toBe('already')
        } else if (a === 'refused') {
          seen.refused++
          if (roundWouldHelp(state, s.captain)) {
            seen.offered++
            expect(askCaptain(state, s.captain, true)).toBe('told')
            seen.bought++
          } else expect(askCaptain(state, s.captain, true)).toBe('no_use')
        }
      }
    }
    expect(seen.told).toBeGreaterThan(0)
    expect(seen.refused).toBeGreaterThan(0)
    expect(seen.bought).toBe(seen.offered)
    expect(seen.offered).toBeGreaterThan(0)
  })
})
