import { describe, expect, it } from 'vitest'
import { emptyBelief, noteDanger, tellDanger } from './belief'
import { advanceWeek, newGame, PLAYER } from './game'
import { SHIP_CLASSES, type WorldId } from './types'

describe('danger as captains hold it', () => {
  it('rises sharply on word of a taking, eases with safe trades and more with a patrol seen', () => {
    const b = emptyBelief()
    const w = 'w1' as WorldId
    noteDanger(b, { id: w, news: [{ week: 10, text: 'X was taken in the approaches by Y' }], traffic: [], ships: [] }, 11)
    expect(b.danger[w].level).toBe(0.6)
    noteDanger(b, { id: w, news: [], traffic: [{ sold: [1], bought: [] }, { sold: [], bought: [1] }], ships: [] }, 12)
    expect(b.danger[w].level).toBe(0.5)
    noteDanger(b, { id: w, news: [], traffic: [], ships: [{ type: 'patrol_boat' }] }, 13)
    expect(b.danger[w].level).toBe(0.25)
    expect(b.patrolled[w]).toBe(13)
    // An older look never overwrites a newer word.
    noteDanger(b, { id: w, news: [{ week: 5, text: 'taken in the approaches' }], traffic: [], ships: [] }, 6)
    expect(b.danger[w].level).toBe(0.25)
    const c = emptyBelief()
    expect(tellDanger(b, c)).toBe(1)
    expect(c.danger[w].level).toBe(0.25)
    expect(c.patrolled[w]).toBe(13)
  })

  it('the new hulls have the guns they should', () => {
    expect(SHIP_CLASSES.armed_trader.guns).toBe(2)
    expect(SHIP_CLASSES.patrol_boat.guns).toBe(2)
    expect(SHIP_CLASSES.corvette.guns).toBe(3)
    expect(SHIP_CLASSES.armed_trader.hold).toBeLessThan(SHIP_CLASSES.free_trader.hold)
  })

  it('some traders start armed, and the navies sail patrol boats', () => {
    const state = newGame(131)
    const traders = Object.values(state.ships).filter((s) => s.owner.kind === 'personal' && s.captain !== PLAYER)
    expect(traders.some((s) => s.type === 'armed_trader')).toBe(true)
    expect(traders.filter((s) => s.type === 'armed_trader').length).toBeLessThan(traders.length / 2)
    expect(Object.values(state.ships).filter((s) => s.duty?.kind === 'patrol').every((s) => s.type === 'patrol_boat')).toBe(true)
  })

  it('a boat is sent to lie off a world the navy holds dangerous, and comes home after her term', () => {
    const state = newGame(132)
    const e = Object.values(state.empires).sort((a, b) => (a.id < b.id ? -1 : 1))[0]
    const boat = Object.values(state.ships).find((s) => s.duty?.kind === 'patrol' && s.empire === e.id)!
    const target = (Object.keys(state.worlds) as WorldId[]).find((w) => state.worlds[w].empire === e.id && w !== e.seat)!
    // The guild's factors have reported trouble there.
    state.guilds[e.id].danger[target] = state.week
    let stationed = 0
    let home = false
    for (let i = 0; i < 40; i++) {
      advanceWeek(state)
      const d = boat.duty as { kind: 'patrol'; station?: WorldId | null }
      if (d.station === target && boat.location.kind === 'world' && boat.location.world === target && boat.lyingOff) stationed++
      if (stationed > 0 && boat.location.kind === 'world' && boat.location.world === e.seat) home = true
    }
    expect(stationed).toBeGreaterThan(4)
    expect(home).toBe(true)
    expect(state.worlds[e.seat].news.some((n) => /sent to lie off/.test(n.text))).toBe(true)
  })
})
