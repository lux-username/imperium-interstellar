/**
 * People: what kind of person a captain is, and how they stand to one
 * another. Traits are rolled at birth and scale the thresholds the
 * planner, the encounter rule, the sharing rule and the smuggling choice
 * already use; nothing here decides anything on its own. A relationship
 * is one record per ordered pair who have dealt with each other, moved by
 * what the sim already produces: telling and refusing, a round stood, an
 * undercut at a dock, a hail, a robbery, a ransom, a parole. The same
 * code runs between NPCs, so the subsector has friendships and grudges
 * the player was never part of.
 */
import { roll, type Rng } from './rng'
import type { Character, CharacterId, GameState, Relation, Traits, Week } from './types'

/** 2d6 to a trait in [0, 1]: the middle of the curve is ordinary. */
function spread(rng: Rng): number {
  const r = roll(rng)
  return Math.min(1, Math.max(0, (r - 2) / 10))
}

export function rollTraits(rng: Rng): Traits {
  return { greed: spread(rng), caution: spread(rng), openness: spread(rng), pride: spread(rng), loyalty: spread(rng) }
}

/** The player's own: ordinary in every way, since the player supplies the character. */
export function plainTraits(): Traits {
  return { greed: 0.5, caution: 0.5, openness: 0.5, pride: 0.5, loyalty: 0.5 }
}

export function traitsOf(c: Character | undefined): Traits {
  return c?.traits ?? plainTraits()
}

/** The word for a trait at its strength, or null if it is nothing to remark on. */
export function traitWord(key: keyof Traits, v: number): string | null {
  if (v >= 0.7) return { greed: 'grasping', caution: 'careful', openness: 'open-handed with news', pride: 'proud', loyalty: 'loyal to their own' }[key]
  if (v <= 0.3) return { greed: 'easily content', caution: 'bold', openness: 'close-mouthed', pride: 'easygoing', loyalty: 'a free agent' }[key]
  return null
}

/** The traits worth remarking on, strongest first. */
export function remarkable(t: Traits): string[] {
  return (Object.keys(t) as (keyof Traits)[])
    .map((k) => ({ k, d: Math.abs(t[k] - 0.5), w: traitWord(k, t[k]) }))
    .filter((x) => x.w !== null)
    .sort((a, b) => b.d - a.d || (a.k < b.k ? -1 : 1))
    .map((x) => x.w as string)
}

// ---------------------------------------------------------------------------
// Relationships

export function relKey(a: CharacterId, b: CharacterId): string {
  return `${a}|${b}`
}

/** How `a` stands to `b`, made cold on first meeting from what they are to each other. */
export function relation(state: GameState, a: CharacterId, b: CharacterId): Relation {
  const key = relKey(a, b)
  let r = state.relations[key]
  if (!r) {
    const ca = state.characters[a]
    const cb = state.characters[b]
    let regard = 0
    if (ca && cb) {
      if (ca.guild && ca.guild === cb.guild) regard += 0.5
      else if (ca.empire === cb.empire) regard += 0.2
      if (cb.outlaw && !ca.outlaw) regard -= 1
      regard *= 0.5 + traitsOf(ca).loyalty
    }
    r = { regard, trust: 0.5, dealings: 0, since: state.week, last: state.week, notes: [] }
    state.relations[key] = r
  }
  return r
}

/** What `a` thinks of `b`, from −3 (enemy) to 3 (friend), 0 for a stranger. */
export function regardOf(state: GameState, a: CharacterId, b: CharacterId): number {
  return state.relations[relKey(a, b)]?.regard ?? 0
}

/** Something passed between them: `a`'s regard for `b` moves by `delta`, bounded, and the Book keeps a line. */
export function deal(state: GameState, a: CharacterId, b: CharacterId, delta: number, note: string, week: Week = state.week): void {
  if (a === b || !state.characters[a] || !state.characters[b]) return
  const r = relation(state, a, b)
  // A proud person holds a slight; an easygoing one lets it go.
  const pride = traitsOf(state.characters[a]).pride
  const d = delta < 0 ? delta * (0.5 + pride) : delta
  r.regard = Math.max(-3, Math.min(3, r.regard + d))
  r.dealings += 1
  r.last = week
  r.notes.push(`wk ${week}: ${note}`)
  if (r.notes.length > 8) r.notes.shift()
}

/** `a` finds `b`'s word good or bad: trust moves. */
export function proved(state: GameState, a: CharacterId, b: CharacterId, good: boolean): void {
  const r = relation(state, a, b)
  r.trust = Math.max(0, Math.min(1, r.trust + (good ? 0.1 : -0.2)))
}

/** The word for how `a` stands to `b`. */
export function standingWord(regard: number): string {
  if (regard >= 2) return 'friend'
  if (regard >= 1) return 'well disposed'
  if (regard > -1) return 'indifferent'
  if (regard > -2) return 'rival'
  return 'enemy'
}
