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
import { stanceKey, type Declaration, type EmpireId, type Week, type WorldId } from './types'
import { isRumour, lineKey, type Belief, type Movement, type PersonSnapshot, type Report, type ShipSnapshot, type TrafficKnown } from './view'

export function emptyBelief(): Belief {
  return { worlds: {}, ships: {}, people: {}, stances: {}, prices: {}, lines: {}, traffic: {}, ties: {} }
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
  // The lines through this port, as of this look: a line seen before that the port no longer shows is gone.
  const seen = new Set(world.lines.map((l) => lineKey(l.from, l.to)))
  for (const k of Object.keys(belief.lines)) {
    const known = belief.lines[k]
    const touches = known.line.from === world.id || known.line.to === world.id
    if (touches && !seen.has(k) && report.observed >= known.observed) delete belief.lines[k]
  }
  for (const l of world.lines) {
    const k = lineKey(l.from, l.to)
    const known = belief.lines[k]
    if (!known || report.observed >= known.observed) belief.lines[k] = { line: { ...l }, observed: report.observed, report: report.id }
  }
  if (world.traffic.length > 0) learnTraffic(belief, world.id, world.traffic, report.channel === 'port' && report.observer === null && world.traffic.every((m) => m.week === report.observed) ? 'seen' : 'register', report.observed)
  const goods = Object.keys(world.market) as (keyof typeof world.market)[]
  if (goods.length > 0) {
    const prices = (belief.prices[world.id] ??= {})
    for (const g of goods) {
      const seen = world.market[g]
      const known = prices[g]
      if (seen && (!known || report.observed >= known.observed)) prices[g] = { price: seen.price, stock: seen.stock, observed: report.observed }
    }
  }
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

/** Weeks of traffic a reader keeps. */
export const TRAFFIC_WEEKS = 52

/** Enter lines of a port's register into a belief, newest first, one per hull and week, the better source winning. */
export function learnTraffic(belief: Pick<Belief, 'traffic'> & Partial<Pick<Belief, 'prices'>>, world: WorldId, lines: readonly Movement[], source: TrafficKnown['source'], observed: Week): number {
  // A sale or purchase is a price seen at that port that week, by whoever made it: evidence like any other, hearsay if heard.
  if (belief.prices) {
    const prices = (belief.prices[world] ??= {})
    for (const m of lines) {
      for (const x of [...m.sold, ...m.bought]) {
        const g = x.good as keyof typeof prices
        const known = prices[g]
        if (!known || m.week > known.observed) prices[g] = { price: x.price, stock: known?.stock ?? 0, observed: m.week, heard: source === 'heard' }
      }
    }
  }
  const known = (belief.traffic[world] ??= [])
  const rank = { register: 3, seen: 2, heard: 1 }
  let news = 0
  for (const m of lines) {
    const i = known.findIndex((k) => k.movement.week === m.week && k.movement.ship === m.ship)
    if (i >= 0) {
      const old = known[i]
      // A better source wins; so does a fuller line of the same page, since the evening's look has the day's trades the morning's lacked.
      const fuller = m.sold.length + m.bought.length > old.movement.sold.length + old.movement.bought.length || (m.to !== null && old.movement.to === null) || (m.from !== null && old.movement.from === null)
      if (rank[old.source] > rank[source] || (rank[old.source] === rank[source] && !fuller)) continue
      known[i] = { movement: { ...m, sold: m.sold.map((x) => ({ ...x })), bought: m.bought.map((x) => ({ ...x })) }, source, observed }
    } else known.push({ movement: { ...m, sold: m.sold.map((x) => ({ ...x })), bought: m.bought.map((x) => ({ ...x })) }, source, observed })
    news += 1
  }
  known.sort((a, b) => b.movement.week - a.movement.week || (a.movement.ship < b.movement.ship ? -1 : 1))
  belief.traffic[world] = known.filter((k) => observed - k.movement.week < TRAFFIC_WEEKS)
  return news
}
