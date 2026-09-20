/**
 * Shape of one culture's name pools. The pools are period names — roughly
 * the nineteenth century in each tradition — so that a world and its people
 * feel like they came from somewhere. See design/culture-tables.md for the
 * weighting tables and the reasoning; this directory is the single home for
 * the names themselves.
 */
export interface Culture {
  /** Display name, matching the row in the weighting tables. */
  name: string
  /** Heritage group the weighting tables sort by. */
  group: string
  /** Whether the family name is spoken before or after the given name. */
  order: 'given-family' | 'family-given'
  /**
   * How a full name is assembled, by gender. Tokens: `{given}` from
   * `given.m`/`given.f`; `{family}` from `family` (or `familyF` for women,
   * when present); `{father}` a man's given name, for patronymic cultures.
   */
  pattern: { m: string; f: string }
  /** Where the pools are thin, contested or reconstructed, say so here. */
  notes?: string
  given: { m: string[]; f: string[] }
  /** Family names, patronymic stems, epithets or titles — whatever the culture used second. */
  family: string[]
  /** Feminine forms of `family`, index-aligned, where surnames inflect by gender. */
  familyF?: string[]
  /** Toponyms: towns, rivers, provinces, mountains. Used bare or as seeds ("New X", "Port X"). */
  places: string[]
}

/** Minimum pool sizes every culture file must meet. Enforced by the test. */
export const POOL_MIN = { given: 80, family: 80, places: 60 } as const
