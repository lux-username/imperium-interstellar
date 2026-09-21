/** Small formatting helpers shared by the panes. Everything takes PlayerView data only. */
import { unrestWord, worldStateOf, type Dispatch, type FactionId, type Order, type PlayerView, type Report, type ShipId, type ShipSnapshot, type Week, type WorldId, type WorldProfile, type WorldSnapshot, type WorldState } from '../sim/view'

// The wording of events is the sim's (see src/sim/letters.ts): the panes say only what a letter said.
export { UNREST_WORDS, eventLabel, eventText, unrestWord } from '../sim/view'

/** How a writer signs: "Governor Sarah Bradley", "Captain Amelia Middleton — Blackwing", "Scout Wren" (her crew go unnamed). A merchant or the docks sign as they are named. */
export function signature(r: Report): string {
  if (r.observerTitle === 'scout') return `Scout ${r.observerShip ?? r.observerName}`
  const title = r.observerTitle === 'governor' ? 'Governor ' : r.observerTitle === 'captain' ? 'Captain ' : ''
  return `${title}${r.observerName}${r.observerShip ? ` — ${r.observerShip}` : ''}`
}

/** The heading of an inbox row: who is reporting and what about. */
export function headline(view: PlayerView, r: Report): string {
  if (r.channel === 'agent') return `${r.observerShip ?? r.observerName} watch report: ${r.subject}`
  if (r.observerTitle === 'captain') return `${r.observerShip ?? r.observerName} captain's report: ${r.subject}`
  if (r.observerTitle === 'scout') return `${r.observerShip ?? r.observerName} scout's report: ${r.subject}`
  if (r.observerTitle === 'governor') return `${worldName(view, r.observedAt)} governor's report: ${r.subject}`
  return `${worldName(view, subjectWorld(r))}: ${r.subject}`
}

/** A world's state as Government House believes it, from the newest snapshot. */
export function stateOf(view: PlayerView, snap: WorldSnapshot): WorldState {
  return worldStateOf(view.factions[snap.faction]?.kind, snap.contest, snap.unrest, snap.contest ? view.factions[snap.contest.attacker]?.kind : undefined)
}

export const STATE_WORDS: Record<WorldState, string> = {
  loyal: 'loyal',
  unrest: 'unrestful',
  revolt: 'in revolt',
  contested: 'contested',
  independent: 'independent',
  warlord: 'held by the Warlord',
}

/** "held by the Warlord", "independent", "ours, in revolt" — the holder and the fight, for a dossier line. */
export function holderText(view: PlayerView, snap: WorldSnapshot): string {
  const state = stateOf(view, snap)
  if (state === 'warlord' || state === 'independent') return STATE_WORDS[state]
  const who = snap.faction === view.faction ? 'ours' : (view.factions[snap.faction]?.name ?? 'unknown')
  if (snap.contest) {
    const attacker = view.factions[snap.contest.attacker]
    return `${who}, ${state === 'revolt' ? 'in revolt' : `under attack by ${attacker?.name ?? 'unknown forces'}`} (${snap.contest.strength} detachment${snap.contest.strength === 1 ? '' : 's'} against the garrison)`
  }
  return `${who}, ${unrestWord(snap.unrest)}`
}

/** "in 2 wk", "this week", "next week" for a lane's next sailing. */
export function sailsText(week: Week, next: Week): string {
  const n = next - week
  return n <= 0 ? 'sails this week' : n === 1 ? 'sails next week' : `sails in ${n} wk`
}

/** "now", "1 wk ago", "14 wk ago". */
export function ago(week: Week, observed: Week): string {
  const n = week - observed
  if (n <= 0) return 'now'
  return `${n} wk ago`
}

export function weekLabel(week: Week): string {
  return `wk ${week}`
}

/** Compact profile string, e.g. "B567555-9". Same encoding the sim uses. */
export function profileString(p: WorldProfile): string {
  const d = (n: number) => n.toString(16).toUpperCase()
  return `${p.starport}${d(p.size)}${d(p.atmosphere)}${d(p.hydrographics)}${d(p.population)}${d(p.government)}${d(p.law)}-${d(p.tech)}`
}

export function worldName(view: PlayerView, id: WorldId): string {
  return view.chart[id]?.name ?? id
}

/** The world a report is about, for selection: the world itself, or where the ship was seen. */
export function subjectWorld(report: Report): WorldId {
  const s = report.snapshot
  return s.kind === 'world' ? s.world.id : s.kind === 'ship' ? s.ship.at : s.event.at
}

/** Whose colours a hull flies, for the map and the tags: ours, the Warlord's, pirate, independent, or nobody's we know. */
export type Colours = 'own' | 'warlord' | 'pirates' | 'rebels' | 'other'

export function coloursOf(view: PlayerView, faction: FactionId): Colours {
  if (faction === view.faction) return 'own'
  const kind = view.factions[faction]?.kind
  return kind === 'rival' ? 'warlord' : kind === 'pirates' ? 'pirates' : kind === 'rebels' ? 'rebels' : 'other'
}

/** ", damaged" or ", a hulk — wants a dockyard": how a sighting describes her state, if it is worth a word. */
export function conditionText(ship: ShipSnapshot): string {
  return ship.hulk ? ', a hulk — wants a dockyard (B or better)' : ship.damaged ? ', damaged' : ''
}

/** "patrol craft", "Warlord escort", "pirate raider": a hull's kind with whose it is, unless ours. */
export function hullKind(view: PlayerView, ship: ShipSnapshot): string {
  const colours = coloursOf(view, ship.faction)
  const whose = colours === 'own' ? '' : colours === 'warlord' ? 'Warlord ' : colours === 'pirates' ? 'pirate ' : colours === 'rebels' ? 'independent ' : `${view.factions[ship.faction]?.name ?? 'unknown'} `
  return `${whose}${ship.role}`
}

/** Freshness bucket for colouring: how old is what we know. */
export function freshness(week: Week, observed: Week): 'fresh' | 'aging' | 'stale' | 'ancient' {
  const n = week - observed
  if (n <= 4) return 'fresh'
  if (n <= 12) return 'aging'
  if (n <= 30) return 'stale'
  return 'ancient'
}


/** An order as Government House would write it. */
export function orderText(view: PlayerView, order: Order): string {
  const target = order.kind === 'move' || order.kind === 'transport' ? order.to : order.kind === 'patrol' || order.kind === 'scout' ? order.world : null
  const then = 'then' in order && order.then?.kind === 'world' && order.then.world !== target ? `, then ${worldName(view, order.then.world)}` : ''
  switch (order.kind) {
    case 'hold':
      return 'hold position'
    case 'move':
      return `proceed to ${worldName(view, order.to)}${then}`
    case 'patrol':
      return `patrol ${worldName(view, order.world)} for ${order.weeks} wk${then}`
    case 'scout':
      return order.weeks <= 1 ? `look in at ${worldName(view, order.world)} and report${then}` : `watch ${worldName(view, order.world)} for ${order.weeks} wk and report${then}`
    case 'courier':
      return `run mail ${order.route.map((w) => worldName(view, w)).join(' → ')}${order.repeat ? ' and repeat' : ''}${then}`
    case 'transport':
      return `${transportCargo(order)} to ${worldName(view, order.to)}${then}`
  }
}

/** "carry 2 army and 1 marine detachments", "carry an officer to take the seal", etc. */
function transportCargo(order: Extract<Order, { kind: 'transport' }>): string {
  const troops = [order.army > 0 ? `${order.army} army` : '', order.marines > 0 ? `${order.marines} marine` : ''].filter(Boolean).join(' and ')
  const troopText = troops ? `${troops} detachment${order.army + order.marines === 1 ? '' : 's'}` : ''
  const person = order.purpose === 'appoint' ? 'an officer to take the seal' : order.purpose === 'command' ? 'an officer to take command of the prize' : ''
  return `carry ${[troopText, person].filter(Boolean).join(' and ') || 'nothing'}`
}

/** The newest order Government House has sent to a ship, if any. */
export function lastOrderSent(view: PlayerView, ship: ShipId): Dispatch | null {
  for (const d of view.outgoing) {
    if (d.payload.kind === 'order' && d.payload.ship === ship) return d
  }
  return null
}

/** The worlds an order calls at, in turn, ending with the rendezvous if it names one. */
export function orderStops(order: Order): WorldId[] {
  const stops: WorldId[] = []
  switch (order.kind) {
    case 'hold':
      break
    case 'move':
    case 'transport':
      stops.push(order.to)
      break
    case 'patrol':
    case 'scout':
      stops.push(order.world)
      break
    case 'courier':
      stops.push(...order.route)
      break
  }
  if ('then' in order && order.then?.kind === 'world' && order.then.world !== stops[stops.length - 1]) stops.push(order.then.world)
  return stops
}
