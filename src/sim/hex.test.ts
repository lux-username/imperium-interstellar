import { describe, expect, it } from 'vitest'
import { allHexes, hexDistance, hexLabel } from './hex'

describe('hex', () => {
  it('distance to self is zero', () => {
    expect(hexDistance({ col: 3, row: 4 }, { col: 3, row: 4 })).toBe(0)
  })

  it('vertical neighbours are one parsec apart', () => {
    expect(hexDistance({ col: 3, row: 4 }, { col: 3, row: 5 })).toBe(1)
  })

  it('column neighbours in odd-q layout are one parsec apart', () => {
    // odd column 3 is shifted down; its upper-right neighbour is (4, 4) and lower-right (4, 5)
    expect(hexDistance({ col: 3, row: 4 }, { col: 4, row: 4 })).toBe(1)
    expect(hexDistance({ col: 3, row: 4 }, { col: 4, row: 5 })).toBe(1)
    expect(hexDistance({ col: 3, row: 4 }, { col: 4, row: 3 })).toBe(2)
  })

  it('is symmetric', () => {
    const a = { col: 1, row: 1 }
    const b = { col: 8, row: 10 }
    expect(hexDistance(a, b)).toBe(hexDistance(b, a))
  })

  it('formats four-digit labels', () => {
    expect(hexLabel({ col: 5, row: 3 })).toBe('0503')
    expect(hexLabel({ col: 8, row: 10 })).toBe('0810')
  })

  it('enumerates the full subsector', () => {
    expect(allHexes()).toHaveLength(80)
  })
})
