import { describe, expect, it } from 'vitest'
import { advanceWeek, newGame, orderShip, sendByCourier } from './game'
import { postDispatch } from './mail'
import { governorLetter } from './governors'
import { buildPlayerView } from './player'
import { playerTraits } from './characters'
import { shipRoute } from './ships'
import type { CharacterId, GameState, ShipId, WorldId } from './types'
import { line, runUntil } from './fixtures.test-helper'

const C = 'w-c' as WorldId
const X = 'w-x' as WorldId
const Y = 'w-y' as WorldId
const Z = 'w-z' as WorldId

/** The line, plus a patrol craft with a commander at the capital and an off-lane world Z two parsecs beyond Y. */
function fleet(): GameState {
  const s = line()
  const cmdr = 'c-cmdr' as CharacterId
  const ship = 's-patrol' as ShipId
  s.characters[cmdr] = { id: cmdr, name: 'Cmdr', faction: s.characters[s.player].faction, post: { kind: 'commander', ship }, traits: playerTraits() }
  s.ships[ship] = {
    id: ship,
    name: 'Vigilant',
    role: 'patrol',
    faction: s.characters[s.player].faction,
    jump: 2,
    strength: 3,
    location: { kind: 'world', world: C },
    commander: cmdr,
    order: null,
    standing: { rally: C, onContact: 'favourable' },
    mailbag: [],
  }
  const govZ = 'c-z' as CharacterId
  s.worlds[Z] = { ...s.worlds[Y], id: Z, name: 'Zed', hex: { col: 5, row: 5 }, governor: govZ, actingGovernor: govZ, profile: { ...s.worlds[Y].profile, starport: 'D' } }
  s.characters[govZ] = { id: govZ, name: 'Zee', faction: s.characters[s.player].faction, post: { kind: 'governor', world: Z }, traits: playerTraits() }
  return s
}

const patrol = (s: GameState) => s.ships['s-patrol' as ShipId]
const at = (s: GameState) => (patrol(s).location.kind === 'world' ? (patrol(s).location as { world: WorldId }).world : null)

describe('ordered hulls', () => {
  it('an order given at the capital is taken up at once and the hull sails by lane, writing home on arrival', () => {
    const s = fleet()
    postDispatch(s, { kind: 'ship', ship: 's-patrol' as ShipId }, C, { kind: 'order', ship: 's-patrol' as ShipId, order: { kind: 'patrol', world: Y, weeks: 2, posture: 'favourable', then: null, began: null } })
    expect(patrol(s).order?.kind).toBe('patrol')
    // Hulls land and sail in the same week, so a hull passing through X is only ever seen in transit.
    advanceWeek(s)
    expect(patrol(s).location).toEqual({ kind: 'transit', from: C, to: X, arrives: 2 })
    advanceWeek(s)
    expect(patrol(s).location).toEqual({ kind: 'transit', from: X, to: Y, arrives: 3 })
    advanceWeek(s)
    expect(at(s)).toBe(Y)
    // The commander wrote from X on the way through and again on reaching Y; both go by packet.
    const letters = () => Object.values(s.mail).filter((m) => m.contents.kind === 'report' && m.contents.report.observer === 'c-cmdr').map((m) => (m.contents.kind === 'report' ? m.contents.report : null)!)
    expect(letters().map((r) => r.observedAt)).toEqual([X, Y])
    expect(letters().every((r) => r.channel === 'official')).toBe(true)
    expect(patrol(s).mailbag).toEqual([]) // handed to the port, not carried
    // Two weeks on station, a closing report, then home to the rally point.
    advanceWeek(s)
    expect(at(s)).toBe(Y)
    advanceWeek(s)
    expect(patrol(s).location.kind).toBe('transit')
    expect(letters().map((r) => r.observedAt)).toEqual([X, Y, Y])
    runUntil(s, (g) => at(g) === C && patrol(g).order?.kind === 'hold', 20)
    expect(at(s)).toBe(C)
  })

  it('a hull sent on purpose may leave the lanes within its jump rating; a packet may not', () => {
    const s = fleet()
    // Nothing charted reaches Z, so the hull plots by hex: C to Y is two parsecs, Y to Z two more.
    expect(shipRoute(s, patrol(s), C, Z)).toEqual([C, Y, Z])
    // Where the chart does connect, it is used even if a hex path would be shorter.
    expect(shipRoute(s, patrol(s), C, Y)).toEqual([C, X, Y])
    expect(shipRoute(s, s.ships['s-cx' as ShipId], C, Z)).toBeNull()
    patrol(s).jump = 1
    expect(shipRoute(s, patrol(s), C, Z)).toBeNull()
  })

  it('a scout at an off-lane world looks for a week, then carries its own letter and the port\'s stranded mail to the chart', () => {
    const s = fleet()
    // Zed's governor wrote long ago; nothing ever called.
    const stranded = governorLetter(s, s.worlds[Z], [])!
    expect(stranded.status).toEqual({ kind: 'awaiting_carrier', at: Z })
    patrol(s).order = { kind: 'scout', world: Z, then: null, lookedOn: null }
    runUntil(s, (g) => at(g) === Z, 10)
    const arrived = s.week
    expect(patrol(s).order).toEqual({ kind: 'scout', world: Z, then: null, lookedOn: arrived }) // the week is spent looking
    advanceWeek(s)
    expect(patrol(s).location.kind).toBe('transit')
    expect(stranded.status.kind).toBe('aboard')
    const own = Object.values(s.mail).find((m) => m.contents.kind === 'report' && m.contents.report.observer === 'c-cmdr' && m.contents.report.observedAt === Z)!
    expect(own.status.kind).toBe('aboard')
    expect(own.contents.kind === 'report' && own.contents.report.observed).toBe(arrived)
    // Set down at Y, re-routed, and both land on the desk by packet.
    runUntil(s, () => stranded.status.kind === 'delivered' && own.status.kind === 'delivered', 30)
    expect(stranded.status.kind).toBe('delivered')
    expect(own.status.kind).toBe('delivered')
    // The desk's word of Z is now at least as fresh as the scout's look (Zed's governor may have written since and had that letter carried too).
    const view = buildPlayerView(s)
    expect(view.known.worlds[Z].observed).toBeGreaterThanOrEqual(arrived)
    expect(view.inbox.some((r) => r.observer === 'c-cmdr' && r.observedAt === Z)).toBe(true)
  })

  it('a courier follows its route by leg, so a route that revisits a world is not ambiguous', () => {
    const s = fleet()
    patrol(s).order = { kind: 'courier', route: [X, C, Y], then: null, repeat: false, leg: 0 }
    for (let i = 0; i < 12; i++) advanceWeek(s)
    const landings = Object.values(s.events)
      .filter((e) => e.kind === 'hull_arrived' && e.ship?.id === 's-patrol')
      .sort((a, b) => a.week - b.week)
      .map((e) => e.at)
    // X, back to C, out through X to Y, then home to the rally point through X.
    expect(landings).toEqual([X, C, X, Y, X, C])
    expect(patrol(s).order?.kind).toBe('hold')
  })

  it('a new game starts with the fleet in port at the capital, on the books and seen from the desk', () => {
    const s = newGame(9)
    const view = buildPlayerView(s)
    expect(view.roster).toHaveLength(14)
    expect(view.roster.map((r) => r.role).sort()).toEqual(['courier', 'courier', 'courier', 'courier', 'escort', 'escort', 'patrol', 'patrol', 'patrol', 'patrol', 'scout', 'scout', 'transport', 'transport'])
    for (const entry of view.roster) {
      expect(entry.commanderName).not.toBeNull()
      expect(view.known.ships[entry.id]?.ship.at).toBe(s.capital)
    }
    // Order a patrol craft to the nearest world on the chart; the dispatch is read at once and the hull sails this week.
    const target = Object.values(s.lanes).find((l) => l.ends.includes(s.capital))!
    const dest = target.ends[0] === s.capital ? target.ends[1] : target.ends[0]
    const ship = view.roster.find((r) => r.role === 'patrol')!.id
    const mail = orderShip(s, ship, { kind: 'move', to: dest, then: null })
    expect(mail.status.kind).toBe('delivered')
    expect(s.ships[ship].order).toEqual({ kind: 'move', to: dest, then: null })
    advanceWeek(s)
    expect(s.ships[ship].location).toEqual({ kind: 'transit', from: s.capital, to: dest, arrives: 2 })
    // The desk's last word of it is still "in port here": nothing has reported it since.
    expect(buildPlayerView(s).known.ships[ship].ship.at).toBe(s.capital)
    expect(buildPlayerView(s).outgoing[0].payload.kind).toBe('order')
  })

  it('an order can be addressed elsewhere than the last sighting, and carry new standing orders', () => {
    const s = fleet()
    // The desk believes the hull is at C but sends the order to Y, where it is heading.
    patrol(s).order = { kind: 'move', to: Y, then: null }
    const mail = orderShip(s, 's-patrol' as ShipId, { kind: 'patrol', world: Y, weeks: 1, posture: 'always', then: null, began: null }, Y, { onContact: 'never', rally: X })
    expect(mail.status.kind).toBe('awaiting_carrier')
    expect(mail.contents.kind === 'dispatch' && mail.contents.dispatch.envelope.destination).toEqual({ kind: 'world', world: Y })
    runUntil(s, () => mail.status.kind === 'delivered', 20)
    expect(patrol(s).order?.kind).toBe('patrol')
    expect(patrol(s).standing).toEqual({ rally: X, onContact: 'never' })
    // After the patrol the hull heads for its new rally point.
    runUntil(s, (g) => at(g) === X && patrol(g).order?.kind === 'hold', 30)
    expect(at(s)).toBe(X)
  })

  it('a hull leaving a port the other way takes a copy of every letter waiting there; the desk reads each letter once', () => {
    const s = fleet()
    for (const w of Object.values(s.worlds)) w.profile.population = 0
    advanceWeek(s) // week 1: the C–X packet has just left X; the next leaves on week 3
    const original = governorLetter(s, s.worlds[X], [])!
    const reportId = original.contents.kind === 'report' ? original.contents.report.id : ''
    // A hull at X leaves for Y — away from the capital — with a copy, while the original waits for its packet.
    patrol(s).location = { kind: 'world', world: X }
    patrol(s).order = { kind: 'move', to: Y, then: null }
    advanceWeek(s) // week 2
    const copies = Object.values(s.mail).filter((m) => m.contents.kind === 'report' && m.contents.report.id === reportId)
    expect(copies).toHaveLength(2)
    expect(original.status).toEqual({ kind: 'awaiting_carrier', at: X })
    expect(patrol(s).mailbag).toHaveLength(1)
    // The original lands first by packet; the copy, set down at Y, comes home later and is thrown away.
    runUntil(s, () => original.status.kind === 'delivered', 10)
    const deliveredAt = s.week
    const copy = copies.find((m) => m.id !== original.id)!
    runUntil(s, () => s.mail[copy.id] === undefined, 30)
    expect(s.mail[copy.id]).toBeUndefined()
    const view = buildPlayerView(s)
    expect(view.inbox.filter((r) => r.id === reportId)).toHaveLength(1)
    expect(view.inbox.find((r) => r.id === reportId)?.delivered).toBe(deliveredAt)
  })

  it('a hull takes stranded letters only when its run reaches lanes that lead to their destination', () => {
    const s = fleet()
    for (const w of Object.values(s.worlds)) w.profile.population = 0
    // A second off-lane world W beyond Z, reachable only by hex.
    const W = 'w-w' as WorldId
    s.worlds[W] = { ...s.worlds[Z], id: W, name: 'Dub', hex: { col: 7, row: 5 }, governor: null, actingGovernor: null }
    const stranded = governorLetter(s, s.worlds[Z], [])!
    // Hull at Z bound further out to W: the letters stay on the dock.
    patrol(s).location = { kind: 'world', world: Z }
    patrol(s).order = { kind: 'move', to: W, then: null }
    advanceWeek(s)
    expect(stranded.status).toEqual({ kind: 'awaiting_carrier', at: Z })
    expect(patrol(s).location).toEqual({ kind: 'transit', from: Z, to: W, arrives: 2 })
    // Back at Z later, bound for home through Y (on the chart): taken.
    patrol(s).location = { kind: 'world', world: Z }
    patrol(s).order = { kind: 'move', to: C, then: null }
    advanceWeek(s)
    expect(stranded.status).toEqual({ kind: 'aboard', ship: 's-patrol' })
  })

  it('orders for a hull at an off-lane world go by courier: routed along its run, handed to the port, read when the hull calls', () => {
    const s = fleet()
    for (const w of Object.values(s.worlds)) w.profile.population = 0
    // The patrol craft is lying at Z, off the lanes, holding. A courier is in port at the capital.
    patrol(s).location = { kind: 'world', world: Z }
    patrol(s).order = { kind: 'hold' }
    const courierId = 's-courier' as ShipId
    s.ships[courierId] = { ...patrol(s), id: courierId, name: 'Swift', role: 'courier', strength: 0, location: { kind: 'world', world: C }, commander: null, order: null, mailbag: [] }
    const order = orderShip(s, 's-patrol' as ShipId, { kind: 'move', to: C, then: null }, Z)
    expect(order.contents.kind === 'dispatch' && order.contents.dispatch.envelope.eta).toBeNull() // no packet goes to Z
    expect(sendByCourier(s, courierId, order)).toBe(true)
    expect(order.contents.kind === 'dispatch' && order.contents.dispatch.envelope.route).toEqual([C, Y, Z])
    expect(order.contents.kind === 'dispatch' && order.contents.dispatch.envelope.eta).toBe(3) // sails week 1, two jumps
    advanceWeek(s) // week 1: the courier sails with it
    expect(order.status).toEqual({ kind: 'aboard', ship: courierId })
    advanceWeek(s) // week 2: through Y without setting it down (no lane from Y reaches Z)
    expect(order.status).toEqual({ kind: 'aboard', ship: courierId })
    advanceWeek(s) // week 3: lands at Z, hands over
    expect(order.status).toEqual({ kind: 'delivered', week: 3 })
    expect(patrol(s).order).toEqual({ kind: 'move', to: C, then: null })
    // The courier goes home.
    runUntil(s, (g) => g.ships[courierId].location.kind === 'world' && (g.ships[courierId].location as { world: WorldId }).world === C, 10)
    expect(s.ships[courierId].order?.kind).toBe('hold')
    // A hull that isn't there yet: the port holds the orders until it calls.
    const later = orderShip(s, 's-patrol' as ShipId, { kind: 'hold' }, Z)
    s.ships[courierId].order = null
    patrol(s).location = { kind: 'world', world: Y }
    patrol(s).order = { kind: 'move', to: Z, then: null }
    patrol(s).standing.rally = null // and stay there
    expect(sendByCourier(s, courierId, later)).toBe(true)
    runUntil(s, () => later.status.kind === 'delivered', 12)
    expect(later.status.kind).toBe('delivered')
  })

  it('a ship with nowhere to go holds and waits', () => {
    const s = fleet()
    patrol(s).jump = 1
    patrol(s).order = { kind: 'move', to: Z, then: null }
    advanceWeek(s)
    expect(patrol(s).order).toEqual({ kind: 'hold' })
    expect(at(s)).toBe(C)
  })
})
