/**
 * Names for worlds and people, drawn from the culture pools in
 * ./data/names. A world rolls 1d3 cultures from the WORLD table and takes
 * its name from their place pools; a person belongs to one culture — CORE
 * (the imperial core) six times in ten, WORLD the other four — and is named
 * by that culture's own pattern: family-first where the tradition is, a
 * patronymic where there were no surnames, one name where one name was
 * enough. See design/culture-tables.md for the tables and the reasoning.
 * Ships are named by class from src/sim/data/ships.ts, in ./fleet.ts.
 */
import { CORE, CULTURES, WORLD, type Culture } from './data/names'
import type { Community } from './data/names/culture'
import { nextInt, type Rng } from './rng'

export type Sex = 'm' | 'f'

function pick<T>(rng: Rng, list: readonly T[]): T {
  return list[nextInt(rng, 0, list.length - 1)]
}

/** One row of a weighting table, by weight. The weights need not sum to anything in particular. */
function weighted<T extends { weight: number }>(rng: Rng, rows: readonly T[]): T {
  const total = rows.reduce((s, r) => s + r.weight, 0)
  let n = nextInt(rng, 1, total)
  for (const row of rows) {
    n -= row.weight
    if (n <= 0) return row
  }
  return rows[rows.length - 1]
}

const BY_NAME = new Map(CULTURES.map((c) => [c.name, c]))

/** The culture record behind a name stored on a world or a character. */
export function cultureByName(name: string): Culture {
  const c = BY_NAME.get(name)
  if (!c) throw new Error(`Unknown culture: ${name}`)
  return c
}

// ---------------------------------------------------------------------------
// Worlds

/** Every world rolls 1d3 cultures from the world table; a repeat is rerolled, so the list is distinct. */
export function worldCultures(rng: Rng): string[] {
  const count = nextInt(rng, 1, 3)
  const names: string[] = []
  while (names.length < count) {
    const c = weighted(rng, WORLD).culture.name
    if (!names.includes(c)) names.push(c)
  }
  return names
}

/** How a toponym is reused when the bare name is already on the chart. */
const SEEDS = ['New', 'Port']

/**
 * A world name from one of its cultures' place pools, not already in
 * `taken`. A toponym already on the chart is tried as "New X" and "Port X"
 * before another is drawn. Adds the result to `taken`.
 */
export function worldName(rng: Rng, cultures: readonly string[], taken: Set<string>): string {
  for (;;) {
    const place = pick(rng, pick(rng, cultures.map(cultureByName)).places)
    for (const name of [place, ...SEEDS.map((s) => `${s} ${place}`)]) {
      if (taken.has(name)) continue
      taken.add(name)
      return name
    }
  }
}

// ---------------------------------------------------------------------------
// People

/** Which culture an officer's name comes from: the core six times in ten, the wider world the other four. */
export function officerCulture(rng: Rng): string {
  return weighted(rng, nextInt(rng, 1, 10) <= 6 ? CORE : WORLD).culture.name
}

export function rollSex(rng: Rng): Sex {
  return nextInt(rng, 0, 1) === 0 ? 'm' : 'f'
}

/** The pools a draw takes its given and family names from: one community, where the culture keeps them apart. */
function pools(rng: Rng, culture: Culture): Pick<Community, 'given' | 'family' | 'familyF'> {
  return culture.communities ? weighted(rng, culture.communities) : culture
}

/**
 * A full name in a culture, assembled by its pattern for the sex. `{given}`
 * draws from the given pool by sex; `{family}` from the family pool (the
 * feminine form for a woman where the culture inflects it); `{father}` a
 * man's given name, for the patronymic patterns.
 */
export function personName(rng: Rng, cultureName: string, sex: Sex): string {
  const culture = cultureByName(cultureName)
  const p = pools(rng, culture)
  const pattern = culture.pattern[sex]
  // Each token is drawn once, in a fixed order, so the stream is the same however a pattern is arranged.
  const given = pattern.includes('{given}') ? pick(rng, p.given[sex]) : ''
  let family = ''
  if (pattern.includes('{family}')) {
    const i = nextInt(rng, 0, p.family.length - 1)
    family = sex === 'f' && p.familyF ? p.familyF[i] : p.family[i]
  }
  const father = pattern.includes('{father}') ? pick(rng, p.given.m) : ''
  return pattern.replace('{given}', given).replace('{family}', family).replace('{father}', father)
}
