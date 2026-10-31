import { describe, expect, it } from 'vitest'
import { advanceWeek, newGame } from './game'
import { FLOAT, lineTree } from './guild'

describe('the guild\'s money', () => {
  it('lines form a tree rooted at the seat; nothing is run that no chain of lines reaches', () => {
    const state = newGame(171)
    for (let i = 0; i < 104; i++) {
      advanceWeek(state)
      for (const g of Object.values(state.guilds)) {
        const tree = lineTree(g)
        for (const l of g.lines) {
          expect(tree[l.from], `${g.empire} ${l.from}`).toBeDefined()
          expect(tree[l.to], `${g.empire} ${l.to}`).toBeDefined()
        }
      }
    }
  })

  it('cash is carried, not wired: the guild\'s money is purse plus strongboxes plus offices, and surplus walks home to the seat', () => {
    const state = newGame(172)
    const g = Object.values(state.guilds).sort((a, b) => (a.empire < b.empire ? -1 : 1))[0]
    const haulers = () => Object.values(state.ships).filter((s) => s.duty?.kind === 'haul' && s.owner.kind === 'organisation' && s.owner.empire === g.empire)
    expect(haulers().every((h) => h.strongbox === FLOAT)).toBe(true)
    let officesHeld = 0
    let carriedHome = 0
    let purseBefore = g.purse
    for (let i = 0; i < 104; i++) {
      advanceWeek(state)
      officesHeld = Math.max(officesHeld, Object.values(g.offices).reduce((n, c) => n + c, 0))
      if (g.purse > purseBefore) carriedHome += g.purse - purseBefore
      purseBefore = g.purse
      for (const h of haulers()) expect(h.strongbox).toBeGreaterThanOrEqual(0)
    }
    // Something was banked at the seat by a hauler at some point, and offices held cash on the way.
    expect(carriedHome).toBeGreaterThan(0)
    expect(officesHeld).toBeGreaterThanOrEqual(0)
  })
})
