import { describe, expect, it } from 'vitest'
import { nextDeparture } from './chart'
import { advanceWeek, newGame } from './game'
import { otherEnd } from './scouts'

describe('scouts on the packets', () => {
  it('one per lane, each keeping her lane\'s timetable and never off it', () => {
    const state = newGame(14)
    expect(Object.values(state.ships).filter((s) => s.run).length).toBe(Object.values(state.lanes).reduce((n, l) => n + l.schedule.scouts, 0))
    const left: Record<string, number> = {}
    for (let i = 0; i < 24; i++) {
      for (const s of Object.values(state.ships)) {
        if (!s.run) continue
        const lane = state.lanes[s.run.lane]
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
    for (const s of Object.values(state.ships)) if (s.run) expect(left[s.id] ?? 0, s.name).toBeGreaterThanOrEqual(4)
  })

  it('a scout lies over a week, and a sailing leaves on every week the timetable names once the lane is running', () => {
    const state = newGame(15)
    for (let i = 0; i < 8; i++) advanceWeek(state)
    for (let i = 0; i < 24; i++) {
      advanceWeek(state)
      for (const lane of Object.values(state.lanes)) {
        for (const end of lane.ends) {
          if (nextDeparture(lane, end, state.week) !== state.week) continue
          const sailed = Object.values(state.ships).some((s) => s.run?.lane === lane.id && s.location.kind === 'transit' && s.location.from === end && s.location.arrives === state.week + 1)
          expect(sailed, `${lane.id} from ${end} week ${state.week}`).toBe(true)
        }
      }
      for (const s of Object.values(state.ships)) if (s.run && s.location.kind === 'transit') expect(s.docked).toBeLessThan(state.week)
    }
  })
})
