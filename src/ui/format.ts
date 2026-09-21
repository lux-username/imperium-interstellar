/** Small formatting helpers shared by the panes. Everything takes PlayerView data only. */
import { worldStateOf, type Dispatch, type Event, type Order, type PlayerView, type Report, type ShipId, type Week, type WorldId, type WorldProfile, type WorldSnapshot, type WorldState } from '../sim/view'

/** A world's state as the desk believes it, from the newest snapshot. */
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
    case 'revolt_began':
      return 'the world has risen'
    case 'revolt_crushed':
      return 'the rising put down'
    case 'world_fell':
      return 'the world is lost'
    case 'governor_fled':
      return `Governor ${e.person ?? ''} fled`.replace('  ', ' ')
    case 'governor_killed':
      return `Governor ${e.person ?? ''} killed`.replace('  ', ' ')
    case 'troops_landed':
      return `${e.level ?? 0} detachment${e.level === 1 ? '' : 's'} landed`
    case 'world_taken':
      return `the world taken by ${e.person ?? 'force'}`
    case 'landing_repulsed':
      return 'a landing thrown back'
    case 'battle':
      return `action against ${e.ship?.name ?? 'hostile hulls'}`
    case 'ship_fled':
      return `${e.ship?.name ?? 'a hull'} broke off`
    case 'ship_damaged':
      return `${e.ship?.name ?? 'a hull'} damaged`
    case 'ship_destroyed':
      return `${e.ship?.name ?? 'a hull'} destroyed`
    case 'ship_captured':
      return `${e.ship?.name ?? 'a hull'} taken`
    case 'ship_robbed':
      return `${e.ship?.name ?? 'a hull'} stopped and robbed`
    case 'pirate_seized':
      return `pirate ${e.ship?.name ?? ''} seized in port`.replace('  ', ' ')
    case 'defection':
      return `${e.ship?.name ?? 'a hull'} gone over to the Warlord`
    case 'appointment_made':
      return `${e.person ?? 'a new governor'} installed`
    case 'appointment_refused':
      return `${e.person ?? 'the incumbent'} refuses to go`
    case 'officer_took_command':
      return `${e.person ?? 'an officer'} took command of ${e.ship?.name ?? 'a prize'}`
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
    case 'revolt_began':
      return 'The world has risen against us. The garrison holds the port and the palace and is fighting for both; send troops.'
    case 'revolt_crushed':
      return 'The rising has been put down. The garrison holds.'
    case 'world_fell':
      return 'The garrison is gone. The world has declared itself independent; the port is closed to us.'
    case 'governor_fled':
      return `Governor ${e.person ?? ''} got off to a ship in orbit as the palace fell.`.replace('  ', ' ')
    case 'governor_killed':
      return `Governor ${e.person ?? ''} was killed when the palace fell.`.replace('  ', ' ')
    case 'troops_landed':
      return `${e.level ?? 0} detachment${e.level === 1 ? '' : 's'} came down from ${e.ship?.name ?? 'a transport'}.`
    case 'world_taken':
      return `The world is in the hands of ${e.person ?? 'the attackers'}.`
    case 'landing_repulsed':
      return 'A landing was thrown back; the garrison holds.'
    case 'battle':
      return `Action was fought here against ${e.ship?.name ?? 'hostile hulls'}${e.ship ? ` (${e.ship.role})` : ''}.`
    case 'ship_fled':
      return `${e.ship?.name ?? 'A hull'} broke off and jumped clear.`
    case 'ship_damaged':
      return `${e.ship?.name ?? 'A hull'} took damage.`
    case 'ship_destroyed':
      return `${e.ship?.name ?? 'A hull'} was destroyed.`
    case 'ship_captured':
      return `${e.ship?.name ?? 'A hull'} was taken as a prize.`
    case 'ship_robbed':
      return `${e.ship?.name ?? 'A hull'} was stopped and her mail bag taken. Everything aboard is lost.`
    case 'pirate_seized':
      return `The pirate ${e.ship?.name ?? ''} put in here and was seized by the port.`.replace('  ', ' ')
    case 'defection':
      return `${e.ship?.name ?? 'A hull'} has gone over to the Warlord with her officers.`
    case 'appointment_made':
      return `${e.person ?? 'The new governor'} has taken the seal.`
    case 'appointment_refused':
      return `${e.person ?? 'The incumbent'} has read the appointment and declines to hand over the seal.`
    case 'officer_took_command':
      return `${e.person ?? 'An officer'} has taken command of ${e.ship?.name ?? 'the prize'}.`
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

/** The newest order the desk has sent to a ship, if any. */
export function lastOrderSent(view: PlayerView, ship: ShipId): Dispatch | null {
  for (const d of view.outgoing) {
    if (d.payload.kind === 'order' && d.payload.ship === ship) return d
  }
  return null
}
