/**
 * How reports become a picture. A reader's belief is a fold over the
 * reports delivered to them: the newest report about each world, and the
 * newest sighting of each hull — from a report's snapshot of a world (what
 * lay in port), from a report about the hull itself, and from the events
 * a letter mentions, each of which says where a hull was on the week it
 * happened. A general report that tells of a raider making port three
 * weeks ago is a three-week-old sighting, not a fresh one.
 *
 * Pure: the sim folds each report in as it is delivered (see learn in
 * ./mail.ts), and the desk folds the whole inbox again with a cut-off week
 * to show what it now knows about a week gone by. The two agree because
 * they are the same fold.
 */
import type { ShipId, Week, WorldId } from './types'
import { isRumour, type Belief, type Event, type Report, type ShipSnapshot } from './view'

export function emptyBelief(): Belief {
  return { worlds: {}, ships: {} }
}

/**
 * Where an event puts the hull it names, if anywhere. A hull destroyed
 * is nowhere; a prisoner's notes name a world, not where she lies. A hull
 * that changed hands flies her new colours from that week.
 */
export function sightingFrom(e: Event): ShipSnapshot | null {
  if (!e.ship) return null
  switch (e.kind) {
    case 'ship_destroyed':
    case 'haven_named':
      return null
    case 'ship_captured':
    case 'pirate_seized':
    case 'defection':
    case 'officer_took_command':
      return e.favours ? { ...e.ship, at: e.at, faction: e.favours, commander: null } : { ...e.ship, at: e.at }
    default:
      return { ...e.ship, at: e.at }
  }
}

/**
 * Fold one report into a belief. A report observed after `asOf` — or an
 * event that happened after it — is left out, so the same fold can say
 * what the reader now knows about an earlier week. Talk is not knowledge:
 * a rumour goes in nowhere, so the map never rests on it.
 */
export function absorb(belief: Belief, report: Report, asOf: Week = Number.POSITIVE_INFINITY): void {
  if (isRumour(report.channel) || report.snapshot.kind === 'event') return
  const sight = (ship: ShipSnapshot, observed: Week) => {
    if (observed > asOf) return
    const known = belief.ships[ship.id]
    if (!known || observed >= known.observed) belief.ships[ship.id] = { ship, observed, report: report.id }
  }
  if (report.snapshot.kind === 'ship') sight(report.snapshot.ship, report.observed)
  else if (report.observed <= asOf) {
    const world = report.snapshot.world
    const known = belief.worlds[world.id]
    if (!known || report.observed >= known.observed) belief.worlds[world.id] = report
    for (const ship of world.ships) sight(ship, report.observed)
  }
  for (const e of report.events) {
    const seen = sightingFrom(e)
    if (seen) sight(seen, e.week)
  }
}

/** The picture a pile of reports adds up to, as of `asOf` (or now), folded in the order they arrived. */
export function beliefFrom(reports: readonly Report[], asOf?: Week): Belief {
  const belief = emptyBelief()
  const ordered = [...reports].sort((a, b) => (a.delivered ?? 0) - (b.delivered ?? 0) || (a.id < b.id ? -1 : 1))
  for (const r of ordered) absorb(belief, r, asOf)
  return belief
}

/**
 * Worlds the reader has been told harbour pirates, by a letter that saw
 * it, and still would as far as the reader knows: the governor named in
 * the letter is the one the newest report says holds the seal. A new
 * governor gets the benefit of the doubt until someone sees otherwise.
 */
export function knownHavens(reports: readonly Report[], belief: Belief): WorldId[] {
  const havens = new Set<WorldId>()
  for (const r of reports) {
    if (isRumour(r.channel)) continue
    for (const e of r.events) {
      if (e.kind !== 'pirates_harboured') continue
      const known = belief.worlds[e.at]
      const governor = known?.snapshot.kind === 'world' ? known.snapshot.world.governorName : null
      if (governor !== null && governor === e.person) havens.add(e.at)
    }
  }
  return [...havens].sort()
}

/** Whether a report is about a hull: it is the subject, it lay in port, or an event names it. */
export function mentionsShip(report: Report, ship: ShipId): boolean {
  const s = report.snapshot
  if (s.kind === 'ship' && s.ship.id === ship) return true
  if (s.kind === 'world' && s.world.ships.some((h) => h.id === ship)) return true
  if (s.kind === 'event' && s.event.ship?.id === ship) return true
  return report.events.some((e) => e.ship?.id === ship)
}
