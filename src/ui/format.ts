/** Small formatting helpers shared by the panes. Everything takes PlayerView data only. */
import type { Dispatch, Event, Order, PlayerView, Report, ShipId, Week, WorldId, WorldProfile } from '../sim/view'

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

/** A few words for an event, for a subject line. */
export function eventLabel(e: Event): string {
  switch (e.kind) {
    case 'unrest_rose':
      return `unrest up, now ${unrestWord(e.level ?? 0)}`
    case 'unrest_fell':
      return `unrest down, now ${unrestWord(e.level ?? 0)}`
    case 'governor_changed':
      return `new governor ${e.person ?? ''}`.trim()
    case 'hull_arrived':
      return `${e.ship?.name ?? 'a hull'} made port`
    case 'hull_departed':
      return `${e.ship?.name ?? 'a hull'} sailed`
    case 'dispatch_received':
      return 'your letter received'
  }
}

/** One sentence for an event, as a letter or a rumour would put it. */
export function eventText(e: Event): string {
  switch (e.kind) {
    case 'unrest_rose':
      return `Unrest has risen: the world is ${unrestWord(e.level ?? 0)}.`
    case 'unrest_fell':
      return `Unrest has eased: the world is ${unrestWord(e.level ?? 0)}.`
    case 'governor_changed':
      return `${e.person ?? 'A new governor'} now holds the seal.`
    case 'hull_arrived':
      return `${e.ship?.name ?? 'A hull'}${e.ship ? ` (${e.ship.role})` : ''} made port.`
    case 'hull_departed':
      return `${e.ship?.name ?? 'A hull'} sailed.`
    case 'dispatch_received':
      return 'Your dispatch was received.'
  }
}

/** Freshness bucket for colouring: how old is what we know. */
export function freshness(week: Week, observed: Week): 'fresh' | 'aging' | 'stale' | 'ancient' {
  const n = week - observed
  if (n <= 4) return 'fresh'
  if (n <= 12) return 'aging'
  if (n <= 30) return 'stale'
  return 'ancient'
}

export const UNREST_WORDS = ['calm', 'uneasy', 'grumbling', 'grumbling', 'restive', 'restive', 'unruly', 'unruly', 'rioting', 'rioting', 'in revolt']

export function unrestWord(n: number): string {
  return UNREST_WORDS[Math.max(0, Math.min(10, n))]
}

/** An order as the desk would write it. */
export function orderText(view: PlayerView, order: Order): string {
  const target = order.kind === 'move' ? order.to : order.kind === 'patrol' || order.kind === 'scout' ? order.world : null
  const then = 'then' in order && order.then?.kind === 'world' && order.then.world !== target ? `, then ${worldName(view, order.then.world)}` : ''
  switch (order.kind) {
    case 'hold':
      return 'hold position'
    case 'move':
      return `proceed to ${worldName(view, order.to)}${then}`
    case 'patrol':
      return `patrol ${worldName(view, order.world)} for ${order.weeks} wk${then}`
    case 'scout':
      return `scout ${worldName(view, order.world)} and report${then}`
    case 'courier':
      return `run mail ${order.route.map((w) => worldName(view, w)).join(' → ')}${order.repeat ? ' and repeat' : ''}${then}`
  }
}

/** The newest order the desk has sent to a ship, if any. */
export function lastOrderSent(view: PlayerView, ship: ShipId): Dispatch | null {
  for (const d of view.outgoing) {
    if (d.payload.kind === 'order' && d.payload.ship === ship) return d
  }
  return null
}
