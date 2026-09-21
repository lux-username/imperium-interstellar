import { describe, expect, it } from 'vitest'
import { POOL_MIN, type Culture } from './culture'
import { CORE, CULTURES, WORLD } from './index'

// Every culture file in this directory, whether or not the index lists it yet.
const files = import.meta.glob<Record<string, Culture>>('./*.ts', { eager: true })
const cultures: Culture[] = Object.entries(files)
  .filter(([path]) => !/\/(culture|index|names\.test)\.ts$/.test(path))
  .flatMap(([, mod]) => Object.values(mod).filter((v): v is Culture => typeof v === 'object' && v !== null && 'given' in v))

function dupes(list: string[]): string[] {
  const seen = new Set<string>()
  return list.filter((s) => (seen.has(s) ? true : (seen.add(s), false)))
}

describe('culture name pools', () => {
  it('finds culture files', () => {
    expect(cultures.length).toBeGreaterThan(0)
  })

  for (const c of cultures) {
    describe(c.name, () => {
      it('meets the minimum pool sizes', () => {
        expect(c.given.m.length, "men's given").toBeGreaterThanOrEqual(POOL_MIN.given)
        expect(c.given.f.length, "women's given").toBeGreaterThanOrEqual(POOL_MIN.given)
        expect(c.family.length, 'family').toBeGreaterThanOrEqual(POOL_MIN.family)
        expect(c.places.length, 'places').toBeGreaterThanOrEqual(POOL_MIN.places)
      })

      it('has no duplicates or blanks within a pool', () => {
        for (const [label, list] of [['m', c.given.m], ['f', c.given.f], ['family', c.family], ['places', c.places]] as const) {
          expect(dupes(list), `${label} dupes`).toEqual([])
          expect(list.filter((s) => s.trim() !== s || s === ''), `${label} blanks`).toEqual([])
        }
      })

      it('patterns use only known tokens and always a given name', () => {
        for (const p of [c.pattern.m, c.pattern.f]) {
          expect(p).toContain('{given}')
          expect(p.replace(/\{(given|family|father)\}/g, '')).not.toMatch(/[{}]/)
        }
      })

      it('feminine family forms, when present, align with the family list', () => {
        if (c.familyF) expect(c.familyF.length).toBe(c.family.length)
      })
    })
  }
})

describe('weighting tables', () => {
  it('CORE sums to 100', () => {
    expect(CORE.reduce((s, w) => s + w.weight, 0)).toBe(100)
  })

  it('WORLD sums to 100 once populated', () => {
    if (WORLD.length > 0) expect(WORLD.reduce((s, w) => s + w.weight, 0)).toBe(100)
  })

  it('lists each culture once', () => {
    expect(dupes(CULTURES.map((c) => c.name))).toEqual([])
  })

  it('lists every culture file', () => {
    const listed = new Set(CULTURES.map((c) => c.name))
    expect(cultures.map((c) => c.name).filter((n) => !listed.has(n))).toEqual([])
  })
})
