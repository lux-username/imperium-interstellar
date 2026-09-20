import { describe, expect, it } from 'vitest'
import { generateFromSeed } from './generate'
import { hexDistance } from './hex'
import { expectedArrival, nextDeparture, route } from './chart'
import { chartLanes, packetShips } from './lanes'
import type { Lane, LaneId, WorldId } from './types'

function chart(seed: number) {
  const g = generateFromSeed(seed)
  const lanes = chartLanes(g.rng, g.worlds)
  return { ...g, lanes }
}

describe('lane charting', () => {
  it('is deterministic', () => {
    expect(chart(5).lanes).toEqual(chart(5).lanes)
  })

  it('joins only worlds with ports, never further than three parsecs, and never a world to itself', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const { worlds, lanes } = chart(seed)
      for (const l of Object.values(lanes)) {
        const [a, b] = l.ends.map((id) => worlds[id])
        expect(a.id).not.toBe(b.id)
        expect(['A', 'B', 'C']).toContain(a.profile.starport)
        expect(['A', 'B', 'C']).toContain(b.profile.starport)
        expect(l.jumpDistance).toBe(hexDistance(a.hex, b.hex))
        expect(l.jumpDistance).toBeGreaterThanOrEqual(1)
        expect(l.jumpDistance).toBeLessThanOrEqual(3)
      }
    }
  })

  it('joins every pair of A/B ports within two parsecs', () => {
    const { worlds, lanes } = chart(8)
    const ports = Object.values(worlds).filter((w) => w.profile.starport === 'A' || w.profile.starport === 'B')
    for (const a of ports) {
      for (const b of ports) {
        if (a.id >= b.id || hexDistance(a.hex, b.hex) > 2) continue
        const joined = Object.values(lanes).some((l) => l.ends.includes(a.id) && l.ends.includes(b.id))
        expect(joined, `${a.name}–${b.name}`).toBe(true)
      }
    }
  })

  it('leaves D/E/X worlds off-lane so their mail never routes', () => {
    const { worlds, lanes, capital } = chart(8)
    for (const w of Object.values(worlds)) {
      if (['D', 'E', 'X'].includes(w.profile.starport)) expect(route(lanes, w.id, capital)).toBeNull()
    }
  })

  it('gives every lane exactly one packet, starting at the first end', () => {
    const { lanes, rng } = chart(8)
    const ships = packetShips(rng, lanes)
    expect(Object.keys(ships).length).toBe(Object.keys(lanes).length)
    for (const s of Object.values(ships)) {
      expect(s.role).toBe('packet')
      expect(s.order?.kind).toBe('courier')
      expect(s.location.kind).toBe('world')
    }
  })
})

describe('packet timetables', () => {
  const lane: Lane = {
    id: 'l-x' as LaneId,
    ends: ['w-a' as WorldId, 'w-b' as WorldId],
    jumpDistance: 1,
    schedule: { interval: 4, phase: 1 },
  }

  it('departs the first end every interval from the phase week', () => {
    expect(nextDeparture(lane, lane.ends[0], 0)).toBe(1)
    expect(nextDeparture(lane, lane.ends[0], 1)).toBe(1)
    expect(nextDeparture(lane, lane.ends[0], 2)).toBe(5)
    expect(nextDeparture(lane, lane.ends[0], 5)).toBe(5)
    expect(nextDeparture(lane, lane.ends[0], 6)).toBe(9)
  })

  it('departs the far end half an interval later', () => {
    expect(nextDeparture(lane, lane.ends[1], 0)).toBe(3)
    expect(nextDeparture(lane, lane.ends[1], 3)).toBe(3)
    expect(nextDeparture(lane, lane.ends[1], 4)).toBe(7)
  })

  it('adds up the wait at each stop plus one week per jump', () => {
    const b = 'w-b' as WorldId
    const c = 'w-c' as WorldId
    const second: Lane = { id: 'l-y' as LaneId, ends: [b, c], jumpDistance: 2, schedule: { interval: 2, phase: 0 } }
    const lanes = { [lane.id]: lane, [second.id]: second }
    // Handed in at a on week 0: waits to week 1, lands at b week 2; b→c departs even weeks, so leaves week 2, lands week 3.
    expect(expectedArrival(lanes, [lane.ends[0], b, c], 0)).toBe(3)
    // Handed in at a on week 2: waits to week 5, lands b week 6, leaves week 6, lands week 7.
    expect(expectedArrival(lanes, [lane.ends[0], b, c], 2)).toBe(7)
  })
})

describe('routing', () => {
  it('finds the fewest-jump path and null across a gap', () => {
    const a = 'w-a' as WorldId
    const b = 'w-b' as WorldId
    const c = 'w-c' as WorldId
    const d = 'w-d' as WorldId
    const mk = (x: WorldId, y: WorldId): Lane => ({ id: `l-${x}-${y}` as LaneId, ends: [x, y], jumpDistance: 1, schedule: { interval: 2, phase: 0 } })
    const lanes = Object.fromEntries([mk(a, b), mk(b, c), mk(a, c)].map((l) => [l.id, l])) as Record<LaneId, Lane>
    expect(route(lanes, a, c)).toEqual([a, c])
    expect(route(lanes, a, a)).toEqual([a])
    expect(route(lanes, a, d)).toBeNull()
  })
})
