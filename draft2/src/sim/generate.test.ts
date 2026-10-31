import { describe, expect, it } from 'vitest'
import { route } from './chart'
import { EMPIRES, generateFromSeed, generateProfile, generateSubsector, layoutFaults, LAYOUT_TRIES, profileString } from './generate'
import { hexDistance, SUBSECTOR_COLS, SUBSECTOR_ROWS } from './hex'
import { chartLanes } from './lanes'
import { createRng } from './rng'

describe('subsector generation', () => {
  it('is deterministic from the seed', () => {
    const a = generateFromSeed(7)
    const b = generateFromSeed(7)
    expect(a.worlds).toEqual(b.worlds)
    expect(a.empires).toEqual(b.empires)
  })

  it('differs between seeds', () => {
    expect(generateFromSeed(1).worlds).not.toEqual(generateFromSeed(2).worlds)
  })

  it('places some twenty-odd worlds inside the grid, with unique names', () => {
    const counts: number[] = []
    for (let seed = 1; seed <= 40; seed++) {
      const { worlds } = generateFromSeed(seed)
      const list = Object.values(worlds)
      counts.push(list.length)
      expect(new Set(list.map((w) => w.name)).size).toBe(list.length)
      for (const w of list) {
        expect(w.hex.col).toBeGreaterThanOrEqual(1)
        expect(w.hex.col).toBeLessThanOrEqual(SUBSECTOR_COLS)
        expect(w.hex.row).toBeGreaterThanOrEqual(1)
        expect(w.hex.row).toBeLessThanOrEqual(SUBSECTOR_ROWS)
      }
    }
    const mean = counts.reduce((a, b) => a + b, 0) / counts.length
    expect(mean).toBeGreaterThan(17)
    expect(mean).toBeLessThan(27)
  })

  it('profiles stay in range and print as eight digits', () => {
    const rng = createRng(3)
    for (let i = 0; i < 500; i++) {
      const p = generateProfile(rng)
      expect(p.tech).toBeGreaterThanOrEqual(0)
      expect(p.tech).toBeLessThanOrEqual(15)
      expect(p.law).toBeLessThanOrEqual(9)
      expect(profileString(p)).toMatch(/^[ABCDEX][0-9A-F]{6}-[0-9A-F]$/)
    }
  })
})

describe('three empires', () => {
  it('seat three distinct governors at class A ports and claim every world', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const { worlds, empires } = generateFromSeed(seed)
      const seats = Object.values(empires).map((e) => e.seat)
      expect(new Set(seats).size).toBe(3)
      expect(Object.keys(empires).sort()).toEqual(EMPIRES.map((e) => e.id).sort())
      for (const e of Object.values(empires)) {
        const seat = worlds[e.seat]
        expect(seat.profile.starport).toBe('A')
        expect(seat.profile.population).toBeGreaterThanOrEqual(7)
        expect(seat.empire).toBe(e.id)
        expect(e.capitalWeeks).toBeGreaterThanOrEqual(6)
        expect(e.capitalWeeks).toBeLessThanOrEqual(8)
      }
      for (const w of Object.values(worlds)) {
        expect(empires[w.empire]).toBeDefined()
        // Nearest seat claims the world.
        const mine = hexDistance(w.hex, worlds[empires[w.empire].seat].hex)
        for (const e of Object.values(empires)) expect(hexDistance(w.hex, worlds[e.seat].hex)).toBeGreaterThanOrEqual(mine)
      }
    }
  })

  it('rolls until the layout is a borderland: spaced seats, three holdings each, seats on one chart, some dark worlds', () => {
    let passed = 0
    for (let seed = 1; seed <= 30; seed++) {
      const g = generateSubsector(createRng(seed))
      const faults = layoutFaults(g.worlds, g.lanes, g.empires)
      if (faults.length === 0) passed++
      expect(g.tries).toBeLessThanOrEqual(LAYOUT_TRIES)
      if (faults.length > 0) continue
      const seats = Object.values(g.empires).map((e) => e.seat)
      expect(route(g.lanes, seats[0], seats[1])).not.toBeNull()
      expect(route(g.lanes, seats[0], seats[2])).not.toBeNull()
      for (const e of Object.values(g.empires)) expect(Object.values(g.worlds).filter((w) => w.empire === e.id).length).toBeGreaterThanOrEqual(3)
    }
    expect(passed).toBeGreaterThanOrEqual(27)
  })

  it('charts lanes the same way for the same seed', () => {
    const a = generateFromSeed(11)
    const b = generateFromSeed(11)
    expect(chartLanes(a.rng, a.worlds)).toEqual(chartLanes(b.rng, b.worlds))
  })
})
