import { describe, expect, it } from 'vitest'
import { SHIP_NAMES } from './ships'

function dupes(list: string[]): string[] {
  const seen = new Set<string>()
  return list.filter((s) => (seen.has(s) ? true : (seen.add(s), false)))
}

describe('ship name pools', () => {
  for (const [hull, names] of Object.entries(SHIP_NAMES)) {
    describe(hull, () => {
      it('holds at least a hundred names', () => {
        expect(names.length).toBeGreaterThanOrEqual(100)
      })
      it('has no duplicates or blanks', () => {
        expect(dupes(names)).toEqual([])
        expect(names.filter((s) => s.trim() !== s || s === '')).toEqual([])
      })
    })
  }

  it('never gives two classes the same name', () => {
    expect(dupes(Object.values(SHIP_NAMES).flat())).toEqual([])
  })
})
