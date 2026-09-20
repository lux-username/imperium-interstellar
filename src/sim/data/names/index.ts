/**
 * The culture weighting tables, as data. `CORE` is the imperial core (Table B
 * in design/culture-tables.md); `WORLD` is the wider population (Table A).
 * Weights are percentages and each table sums to 100.
 *
 * Intended use: a world rolls 1d3 cultures from WORLD; an officer's name
 * comes from CORE 60% of the time and WORLD 40%.
 */
import type { Culture } from './culture'
import { english } from './english'
import { irish } from './irish'
import { scottish } from './scottish'
import { welsh } from './welsh'

export type { Culture } from './culture'

export interface Weighted {
  culture: Culture
  weight: number
}

export const CORE: Weighted[] = [
  { culture: english, weight: 65 },
  { culture: irish, weight: 25 },
  { culture: scottish, weight: 8 },
  { culture: welsh, weight: 2 },
]

export const WORLD: Weighted[] = []

/** Every culture in either table, for lookups by name. */
export const CULTURES: Culture[] = [...CORE, ...WORLD].map((w) => w.culture)
