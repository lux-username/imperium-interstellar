import { describe, expect, it } from 'vitest'
import { demandLevel, GOOD_SPECS, GOODS, supplyLevel, type Good } from './economy'
import { generateFromSeed } from './generate'
import { SUBSECTOR_COLS, SUBSECTOR_ROWS } from './hex'
import { advanceWeek, newGame } from './game'
import { homePrice } from './imperial'

describe('consequential worlds and the imperial trade', () => {
  it('seats sit on the edge; a few worlds are famous, each for a different good, and it triples their weight', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const { worlds, empires } = generateFromSeed(seed)
      for (const e of Object.values(empires)) {
        const h = worlds[e.seat].hex
        expect(h.col === 1 || h.col === SUBSECTOR_COLS || h.row === 1 || h.row === SUBSECTOR_ROWS, `seed ${seed}`).toBe(true)
        expect(e.exports.length).toBeGreaterThanOrEqual(1)
        expect(e.imports.length).toBeGreaterThanOrEqual(1)
        for (const g of e.exports) expect(e.home[g]).toBeLessThanOrEqual(0.7)
        for (const g of e.imports) expect(e.home[g]).toBeGreaterThanOrEqual(1.3)
      }
      const famous = Object.values(worlds).filter((w) => w.profile.specialty)
      expect(famous.length).toBeGreaterThanOrEqual(2)
      expect(new Set(famous.map((w) => w.profile.specialty!.good)).size).toBe(famous.length)
      for (const w of famous) {
        const sp = w.profile.specialty!
        if (sp.kind === 'maker') expect(supplyLevel(w.profile, sp.good as Good)).toBe(3)
        else expect(demandLevel(w.profile, sp.good as Good)).toBe(3)
      }
    }
  })

  it('imperial freighters call at the seat every few weeks, land the exports and take the imports, and the seat\'s prices follow the home market', () => {
    const state = newGame(151)
    const e = Object.values(state.empires).sort((a, b) => (a.id < b.id ? -1 : 1))[0]
    const seat = state.worlds[e.seat]
    const exp = e.exports[0] as Good
    const imp = e.imports[0] as Good
    let calls = 0
    for (let i = 0; i < 60; i++) {
      advanceWeek(state)
      for (const m of seat.register) if (m.week === state.week && m.ship.startsWith('s-imperial') && (m.sold.length || m.bought.length)) calls++
    }
    expect(calls).toBeGreaterThanOrEqual(5)
    expect(seat.register.some((m) => m.ship.startsWith('s-imperial') && m.sold.some((x) => x.good === exp))).toBe(true)
    expect(seat.register.some((m) => m.ship.startsWith('s-imperial') && m.bought.some((x) => x.good === imp))).toBe(true)
    // The export is held near or under its home price at the seat; the import above the base.
    expect(seat.market[exp].price).toBeLessThan(GOOD_SPECS[exp].base * 1.1)
    expect(homePrice(e, imp)).toBeGreaterThan(GOOD_SPECS[imp].base)
    void GOODS
  })
})
