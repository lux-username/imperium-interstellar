/**
 * Deterministic PRNG for the simulation. The whole game state must be
 * reproducible from a seed, so nothing in src/sim may call Math.random.
 *
 * mulberry32: small, fast, good enough for dice. State is a single uint32
 * so it serializes trivially with the rest of GameState.
 */
export interface Rng {
  /** Current internal state; store this to resume the stream exactly. */
  state: number
}

export function createRng(seed: number): Rng {
  return { state: seed >>> 0 }
}

/** Uniform float in [0, 1). Advances the stream. */
export function nextFloat(rng: Rng): number {
  rng.state = (rng.state + 0x6d2b79f5) >>> 0
  let t = rng.state
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

/** Uniform integer in [min, max] inclusive. */
export function nextInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(nextFloat(rng) * (max - min + 1))
}

/** Roll `count` six-sided dice and sum them. The setting's native die. */
export function roll(rng: Rng, count = 2): number {
  let total = 0
  for (let i = 0; i < count; i++) total += nextInt(rng, 1, 6)
  return total
}

/** Result of one 2d6 roll: true if the sum is >= target. */
export function check(rng: Rng, target: number, modifier = 0): boolean {
  return roll(rng, 2) + modifier >= target
}
