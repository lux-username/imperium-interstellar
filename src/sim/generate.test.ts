import { describe, expect, it } from 'vitest'
import { generateFromSeed, generateProfile, profileString } from './generate'
import { hexDistance, SUBSECTOR_COLS, SUBSECTOR_ROWS } from './hex'
import { createRng } from './rng'

describe('subsector generation', () => {
  it('is deterministic from the seed', () => {
    const a = generateFromSeed(7)
    const b = generateFromSeed(7)
    expect(a.worlds).toEqual(b.worlds)
    expect(a.characters).toEqual(b.characters)
    expect(a.capital).toBe(b.capital)
  })

  it('differs between seeds', () => {
    expect(generateFromSeed(1).worlds).not.toEqual(generateFromSeed(2).worlds)
  })

  it('places roughly a quarter of hexes — some twenty-odd worlds — all inside the grid, with unique names', () => {
    const counts: number[] = []
    for (let seed = 1; seed <= 40; seed++) {
      const { worlds } = generateFromSeed(seed)
      const list = Object.values(worlds)
      counts.push(list.length)
      const names = new Set(list.map((w) => w.name))
      expect(names.size).toBe(list.length)
      for (const w of list) {
        expect(w.hex.col).toBeGreaterThanOrEqual(1)
        expect(w.hex.col).toBeLessThanOrEqual(SUBSECTOR_COLS)
        expect(w.hex.row).toBeGreaterThanOrEqual(1)
        expect(w.hex.row).toBeLessThanOrEqual(SUBSECTOR_ROWS)
      }
    }
    const mean = counts.reduce((a, b) => a + b, 0) / counts.length
    expect(mean / (SUBSECTOR_COLS * SUBSECTOR_ROWS)).toBeGreaterThan(0.22)
    expect(mean / (SUBSECTOR_COLS * SUBSECTOR_ROWS)).toBeLessThan(0.35)
    expect(mean / (SUBSECTOR_COLS * SUBSECTOR_ROWS)).toBeLessThan(0.5)
  })

  it('puts the capital on the edge with an A port and a governor who is the player', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const { worlds, capital, characters } = generateFromSeed(seed)
      const c = worlds[capital]
      const onEdge = c.hex.col === 1 || c.hex.col === SUBSECTOR_COLS || c.hex.row === 1 || c.hex.row === SUBSECTOR_ROWS
      expect(onEdge).toBe(true)
      expect(c.profile.starport).toBe('A')
      expect(c.profile.tech).toBeGreaterThanOrEqual(12)
      expect(c.actingGovernor).toBe('c-player')
      expect(characters[c.actingGovernor!].post).toEqual({ kind: 'governor', world: capital })
    }
  })

  it('gives every populated world a governor and none to empty ones', () => {
    const { worlds, characters } = generateFromSeed(11)
    for (const w of Object.values(worlds)) {
      if (w.profile.population === 0) expect(w.governor).toBeNull()
      else {
        expect(w.governor).not.toBeNull()
        expect(characters[w.governor!].post).toEqual({ kind: 'governor', world: w.id })
      }
    }
  })

  it('keeps every profile characteristic in range', () => {
    const rng = createRng(99)
    for (let i = 0; i < 500; i++) {
      const p = generateProfile(rng)
      expect(p.size).toBeGreaterThanOrEqual(0)
      expect(p.size).toBeLessThanOrEqual(10)
      expect(p.atmosphere).toBeGreaterThanOrEqual(0)
      expect(p.atmosphere).toBeLessThanOrEqual(15)
      expect(p.hydrographics).toBeGreaterThanOrEqual(0)
      expect(p.hydrographics).toBeLessThanOrEqual(10)
      expect(p.population).toBeGreaterThanOrEqual(0)
      expect(p.population).toBeLessThanOrEqual(10)
      expect(p.government).toBeGreaterThanOrEqual(0)
      expect(p.government).toBeLessThanOrEqual(15)
      expect(p.law).toBeGreaterThanOrEqual(0)
      expect(p.law).toBeLessThanOrEqual(9)
      expect(p.tech).toBeGreaterThanOrEqual(0)
      expect(p.tech).toBeLessThanOrEqual(15)
      expect(profileString(p)).toMatch(/^[ABCDEX][0-9A-F]{6}-[0-9A-F]$/)
    }
  })

  it('hexDistance agrees with itself across the generated worlds', () => {
    const { worlds } = generateFromSeed(3)
    const list = Object.values(worlds)
    for (const a of list) for (const b of list) expect(hexDistance(a.hex, b.hex)).toBe(hexDistance(b.hex, a.hex))
  })
})
