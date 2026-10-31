import { describe, expect, it } from 'vitest'
import { nextDeparture } from './chart'
import { advanceWeek, newGame } from './game'
import { otherEnd } from './scouts'

describe('scouts on the packets', () => {
  it('one per lane, each keeping her lane\'s timetable and never off it', () => {
    const state = newGame(14)
    expect(Object.keys(state.ships).length).toBe(Object.keys(state.lanes).length)
    const left: Record<string, number> = {}
    for (let i = 0; i < 24; i++) {
      for (const s of Object.values(state.ships)) {
        const lane = state.lanes[s.run!.lane]
        if (s.location.kind === 'transit') {
          expect(otherEnd(lane, s.location.from)).toBe(s.location.to)
          expect(s.location.arrives - state.week).toBeLessThanOrEqual(1)
          left[s.id] = (left[s.id] ?? 0) + 1
        } else {
          expect(otherEnd(lane, s.location.world)).not.toBeNull()
        }
      }
      advanceWeek(state)
    }
    // Every scout sailed at least a few times in six months.
    for (const s of Object.values(state.ships)) expect(left[s.id] ?? 0, s.name).toBeGreaterThanOrEqual(4)
  })

  it('sails on the week the timetable names', () => {
    const state = newGame(15)
    const s = Object.values(state.ships)[0]
    const lane = state.lanes[s.run!.lane]
    for (let i = 0; i < 10; i++) {
      if (s.location.kind === 'world') {
        const at = s.location.world
        const due = nextDeparture(lane, at, state.week + 1)
        advanceWeek(state)
        if (due === state.week) expect(s.location.kind).toBe('transit')
      } else advanceWeek(state)
    }
  })
})
