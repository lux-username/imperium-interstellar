/**
 * People: how their traits are rolled and how those traits read. The
 * numbers are 2d6 tables of our own; tune freely. Nothing here decides what
 * a person does — that lives with the thing they do (a letter, an order) —
 * it only says what kind of person they are.
 */
import type { Character, CharacterId, FactionId, Post, Traits } from './types'
import { officerCulture, personName, rollSex } from './names'
import { roll, type Rng } from './rng'

/** −2 … +2 from 2d6: the middle of the curve is ordinary. */
function spread(rng: Rng): number {
  const r = roll(rng)
  if (r <= 4) return -2
  if (r <= 6) return -1
  if (r <= 8) return 0
  if (r <= 10) return 1
  return 2
}

/**
 * An inherited governor or a serving officer, loyalty unknown to the Home Office.
 * About a quarter serve themselves, a quarter would follow the Home Office, and
 * the rest are the Empire's people — which is the same thing until the
 * Home Office and the Empire disagree.
 */
export function rollTraits(rng: Rng): Traits {
  const l = roll(rng)
  const loyalty = l <= 5 ? 'self' : l <= 8 ? 'empire' : 'player'
  const a = roll(rng)
  return {
    loyalty,
    initiative: spread(rng),
    competence: { administrative: spread(rng), naval: spread(rng), diplomatic: spread(rng) },
    ambition: a <= 5 ? 0 : a <= 8 ? 1 : a <= 10 ? 2 : 3,
  }
}

/** The player's own seat: no traits to speak of, since the player supplies them. */
export function playerTraits(): Traits {
  return { loyalty: 'player', initiative: 0, competence: { administrative: 0, naval: 0, diplomatic: 0 }, ambition: 0 }
}

/**
 * A new person with rolled traits, named and posted. The name comes from
 * one culture — the imperial core six times in ten, the wider world the
 * other four — and the same pool serves every side: the Home Office's officers,
 * the Warlord's, a pirate captain.
 */
export function newCharacter(rng: Rng, id: CharacterId, faction: FactionId, post: Post): Character {
  const culture = officerCulture(rng)
  const sex = rollSex(rng)
  return { id, name: personName(rng, culture, sex), culture, sex, faction, post, traits: rollTraits(rng) }
}

/** Bold people act before they are sure; cautious ones write first. */
export function isBold(c: Character): boolean {
  return c.traits.initiative > 0
}

export function isCautious(c: Character): boolean {
  return c.traits.initiative < 0
}
