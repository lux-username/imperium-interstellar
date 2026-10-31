/**
 * How reports become a picture. A reader's belief is a fold over the
 * reports delivered to them: the newest report about each world, the
 * newest sighting of each hull and each person, and the newest declaration
 * heard of for each pair of empires.
 *
 * Pure: the sim folds each report in as it is delivered (see learn in
 * ./mail.ts), and the player folds the whole inbox again with a cut-off
 * week to show what was known of a week gone by. The two agree because
 * they are the same fold. Every NPC has a belief; theirs is the fold
 * alone, with no pile of mail behind it.
 */
import { stanceKey, type Declaration, type EmpireId, type Week } from './types'
import { isRumour, type Belief, type PersonSnapshot, type Report, type ShipSnapshot } from './view'

export function emptyBelief(): Belief {
  return { worlds: {}, ships: {}, people: {}, stances: {}, prices: {} }
}

/** A declaration enters where it is newer than what is held for its pair. Returns whether it did. */
export function hear(belief: Pick<Belief, 'stances'>, d: Declaration): boolean {
  const key = stanceKey(d.pair[0], d.pair[1])
  const known = belief.stances[key]
  if (known && known.week >= d.week) return false
  belief.stances[key] = { pair: [d.pair[0], d.pair[1]], stance: d.stance, week: d.week }
  return true
}

/**
 * Fold one report into a belief. A report observed after `asOf` is left
 * out, so the same fold can say what the reader knew on an earlier week.
 * Talk is not knowledge: a rumour goes in nowhere, so the map never rests
 * on it.
 */
export function absorb(belief: Belief, report: Report, asOf: Week = Number.POSITIVE_INFINITY): void {
  if (isRumour(report.channel) || report.observed > asOf) return
  const sight = (ship: ShipSnapshot, observed: Week) => {
    const known = belief.ships[ship.id]
    if (!known || observed >= known.observed) belief.ships[ship.id] = { ship, observed, report: report.id }
  }
  const meet = (person: PersonSnapshot, observed: Week) => {
    const known = belief.people[person.id]
    if (!known || observed >= known.observed) belief.people[person.id] = { person, observed, report: report.id }
  }
  if (report.snapshot.kind === 'ship') {
    sight(report.snapshot.ship, report.observed)
    return
  }
  const world = report.snapshot.world
  const known = belief.worlds[world.id]
  if (!known || report.observed >= known.observed) belief.worlds[world.id] = report
  for (const ship of world.ships) sight(ship, report.observed)
  for (const person of world.people) meet(person, report.observed)
  for (const d of world.board) if (d.week <= asOf) hear(belief, d)
}

/** The picture a pile of reports adds up to, as of `asOf` (or now), folded in the order they arrived. */
export function beliefFrom(reports: readonly Report[], asOf?: Week): Belief {
  const belief = emptyBelief()
  const ordered = [...reports].sort((a, b) => (a.delivered ?? 0) - (b.delivered ?? 0) || (a.id < b.id ? -1 : 1))
  for (const r of ordered) absorb(belief, r, asOf)
  return belief
}

/** How a reader believes two empires stand: the newest declaration heard, or peace if none has ever been. */
export function stanceKnown(belief: Pick<Belief, 'stances'>, a: EmpireId, b: EmpireId): Declaration | null {
  return belief.stances[stanceKey(a, b)] ?? null
}
