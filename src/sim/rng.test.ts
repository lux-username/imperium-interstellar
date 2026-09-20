import { describe, expect, it } from 'vitest'
import { check, createRng, nextFloat, nextInt, roll } from './rng'

describe('rng', () => {
  it('is deterministic for a given seed', () => {
    const a = createRng(42)
    const b = createRng(42)
    const seqA = Array.from({ length: 20 }, () => nextFloat(a))
    const seqB = Array.from({ length: 20 }, () => nextFloat(b))
    expect(seqA).toEqual(seqB)
  })

  it('differs across seeds', () => {
    const a = createRng(1)
    const b = createRng(2)
    expect(nextFloat(a)).not.toBe(nextFloat(b))
  })

  it('resumes exactly from a saved state', () => {
    const a = createRng(7)
    nextFloat(a)
    nextFloat(a)
    const saved = a.state
    const expected = nextFloat(a)
    const resumed = { state: saved }
    expect(nextFloat(resumed)).toBe(expected)
  })

  it('keeps nextInt within bounds', () => {
    const rng = createRng(99)
    for (let i = 0; i < 1000; i++) {
      const n = nextInt(rng, 3, 5)
      expect(n).toBeGreaterThanOrEqual(3)
      expect(n).toBeLessThanOrEqual(5)
    }
  })

  it('rolls 2d6 in [2, 12]', () => {
    const rng = createRng(5)
    for (let i = 0; i < 1000; i++) {
      const r = roll(rng)
      expect(r).toBeGreaterThanOrEqual(2)
      expect(r).toBeLessThanOrEqual(12)
    }
  })

  it('check applies the modifier', () => {
    const rng = createRng(11)
    // 2d6 is always in [2, 12]: target 2 always succeeds, target 13 never does
    expect(check(rng, 2)).toBe(true)
    expect(check(rng, 13)).toBe(false)
    // a +11 modifier lifts the minimum roll to 13; a -11 drops the maximum to 1
    expect(check(rng, 13, 11)).toBe(true)
    expect(check(rng, 2, -11)).toBe(false)
  })
})
