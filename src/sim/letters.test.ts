import { describe, expect, it } from 'vitest'
import { playerTraits } from './characters'
import { recordEvent } from './events'
import { PIRATES, WARLORD } from './factions'
import { HULLS, newShip } from './fleet'
import { advanceWeek, orderShip } from './game'
import { governorLetter } from './governors'
import { heading, leadEvent } from './letters'
import { postDispatch, snapshotWorld } from './mail'
import { createRng } from './rng'
import { afterActionReports, commanderReport, logWitnessed, runEndsAt } from './ships'
import type { CharacterId, GameState, ShipId, WorldId } from './types'
import type { Report } from './view'
import { line, runUntil } from './fixtures.test-helper'

const C = 'w-c' as WorldId
const X = 'w-x' as WorldId
const Y = 'w-y' as WorldId

const reports = (s: GameState, observer: CharacterId): Report[] =>
  Object.values(s.mail)
    .filter((m) => m.contents.kind === 'report' && m.contents.report.observer === observer)
    .map((m) => (m.contents.kind === 'report' ? m.contents.report : null)!)

/** A warship of Government House's at `at`, rallying on C. */
function warship(s: GameState, at: WorldId, id = 's-war' as ShipId, initiative = 0): void {
  const cid = `c-${id}` as CharacterId
  s.characters[cid] = { id: cid, name: 'Amelia Middleton', faction: s.characters[s.player].faction, post: { kind: 'commander', ship: id }, traits: { ...playerTraits(), initiative } }
  s.ships[id] = newShip(id, 'Blackwing', HULLS.patrol, s.characters[s.player].faction, at, s.characters[cid])
  s.ships[id].standing = { rally: C, onContact: 'favourable' }
}

/** A pirate raider at `at`. */
function raider(s: GameState, at: WorldId, id = 's-raider' as ShipId): void {
  const cid = `c-${id}` as CharacterId
  s.characters[cid] = { id: cid, name: 'Raider', faction: PIRATES, post: { kind: 'commander', ship: id }, traits: { ...playerTraits(), loyalty: 'self' } }
  s.ships[id] = newShip(id, 'Black Gull', HULLS.raider, PIRATES, at, s.characters[cid])
  s.ships[id].havens = [Y]
  s.ships[id].order = { kind: 'hold' }
}

describe('a letter is headed by its news', () => {
  it("a governor with nothing to say writes 'All quiet', with the world's state as the first sentence", () => {
    const s = line()
    const r = governorLetter(s, s.worlds[X], [])!.contents as { report: Report }
    expect(r.report.subject).toBe('All quiet')
    expect(r.report.lede).toBe('The world is quiet.')
    expect(r.report.observerTitle).toBe('governor')
    expect(r.report.observerShip).toBeNull()
  })

  it('a requested report says so', () => {
    const s = line()
    const r = governorLetter(s, s.worlds[X], [], true)!.contents as { report: Report }
    expect(r.report.subject).toBe('Report as requested: all quiet')
  })

  it('a governor leads with the worst of the news and counts the rest', () => {
    const s = line()
    s.week = 3
    const rose = recordEvent(s, X, { kind: 'unrest_rose', valence: 'neutral', against: s.worlds[X].faction, severity: 1, level: 6 })
    const risen = recordEvent(s, X, { kind: 'revolt_began', valence: 'neutral', against: s.worlds[X].faction, severity: 3, level: 2 })
    expect(leadEvent([rose, risen])?.id).toBe(risen.id)
    const r = governorLetter(s, s.worlds[X], [rose, risen])!.contents as { report: Report }
    expect(r.report.subject).toBe('The world has risen! (+1)')
    expect(r.report.lede).toBe('The world has risen against us; the garrison is fighting for the port and the palace.')
  })

  it('hostile hulls making port are a sighting, counted', () => {
    const s = line()
    s.week = 2
    raider(s, X)
    raider(s, X, 's-raider-2' as ShipId)
    const arrivals = [s.ships['s-raider' as ShipId], s.ships['s-raider-2' as ShipId]].map((ship) => recordEvent(s, X, { kind: 'hull_arrived', valence: 'neutral', against: s.worlds[X].faction, severity: 2, ship }))
    const r = governorLetter(s, s.worlds[X], arrivals)!.contents as { report: Report }
    expect(r.report.subject).toBe('Pirates sighted! (+1)')
    expect(r.report.lede).toBe('2 pirate hulls were sighted in the system.')
  })

  it("a captain signs with her ship, and an arrival letter says where she is; pirates in port make it a sighting", () => {
    const s = line()
    s.week = 1
    warship(s, X)
    commanderReport(s, s.ships['s-war' as ShipId], X, 'arrival')
    const [r] = reports(s, 'c-s-war' as CharacterId)
    expect(r.observerTitle).toBe('captain')
    expect(r.observerShip).toBe('Blackwing')
    expect(r.subject).toBe('Arrived at Exe')
    expect(r.lede).toBe('We have made port at Exe; the world is ours and calm.')
    // Next week a pirate is lying in port when she looks.
    s.week = 2
    raider(s, X)
    commanderReport(s, s.ships['s-war' as ShipId], X, 'arrival')
    const r2 = reports(s, 'c-s-war' as CharacterId)[1]
    expect(r2.subject).toBe('Pirates sighted!')
    expect(r2.lede).toBe('1 pirate hull lies at Exe.')
  })

  it('a captain who broke off from pirates reports a defeat in her own words', () => {
    const s = line()
    s.week = 1
    warship(s, X)
    const ship = s.ships['s-war' as ShipId]
    raider(s, X)
    const events = [
      recordEvent(s, X, { kind: 'battle', valence: 'bad', severity: 2, ship: s.ships['s-raider' as ShipId] }),
      recordEvent(s, X, { kind: 'ship_fled', valence: 'neutral', against: ship.faction, severity: 1, ship }),
    ]
    const h = heading(s, { side: ship.faction, ship: ship.id, at: X, week: 1, snapshot: snapshotWorld(s, s.worlds[X]), events, occasion: 'action' })
    expect(h.subject).toBe('Defeated by pirates (+1)')
    expect(h.lede).toBe('The pirates outnumbered us and I broke off.')
    // The governor below tells the same fight from the ground.
    const g = heading(s, { side: ship.faction, ship: null, at: X, week: 1, snapshot: snapshotWorld(s, s.worlds[X]), events, occasion: 'letter' })
    expect(g.subject).toBe('Retreat from pirates (+1)')
    expect(g.lede).toBe('Our forces broke off from the pirates.')
  })

  it('a landing reads one way to the side it favours and another to the side it is against', () => {
    const s = line()
    s.week = 1
    const admin = s.worlds[X].faction
    const e = recordEvent(s, X, { kind: 'troops_landed', valence: 'neutral', against: admin, favours: WARLORD, severity: 2, level: 3 })
    const snapshot = snapshotWorld(s, s.worlds[X])
    expect(heading(s, { side: admin, ship: null, at: X, week: 1, snapshot, events: [e], occasion: 'letter' })).toEqual({ subject: 'Enemy landing!', lede: '3 detachments of the Warlord came down on the world.' })
    expect(heading(s, { side: WARLORD, ship: null, at: X, week: 1, snapshot, events: [e], occasion: 'letter' })).toEqual({ subject: 'Reinforcements landed', lede: '3 detachments came down from a transport.' })
  })
})

describe('captains write on occasion', () => {
  it('a hull sent out and back writes a general report on making the rendezvous, covering everything since her orders', () => {
    const s = line()
    warship(s, C)
    const ship = s.ships['s-war' as ShipId]
    expect(runEndsAt(ship, C)).toBe(true)
    postDispatch(s, { kind: 'ship', ship: ship.id }, C, { kind: 'order', ship: ship.id, order: { kind: 'patrol', world: Y, weeks: 2, posture: 'favourable', then: null, began: null } })
    expect(ship.lastOrders).toBe(0)
    // She is not at rest at Y: the patrol continues there and the rally point is C.
    expect(runEndsAt(ship, Y)).toBe(false)
    // While she is on station, the world she is over sees trouble.
    runUntil(s, (g) => g.ships['s-war' as ShipId].location.kind === 'world' && (g.ships['s-war' as ShipId].location as { world: WorldId }).world === Y, 10)
    recordEvent(s, Y, { kind: 'unrest_rose', valence: 'neutral', against: s.worlds[Y].faction, severity: 2, level: 6 })
    logWitnessed(s) // as the week's events would have been, had it happened during the week
    runUntil(s, (g) => g.ships['s-war' as ShipId].location.kind === 'world' && (g.ships['s-war' as ShipId].location as { world: WorldId }).world === C && g.ships['s-war' as ShipId].order?.kind === 'hold', 20)
    // Her log carried the event home; the general report is not written at the capital itself, where Government House sees her directly.
    const all = reports(s, 'c-s-war' as CharacterId)
    expect(all.some((r) => r.subject.startsWith('General report'))).toBe(false)
    expect(s.ships['s-war' as ShipId].log.some((e) => e.kind === 'unrest_rose')).toBe(true)
  })

  it('a hull whose run ends away from the capital writes the general report there, and her log is cleared', () => {
    const s = line()
    warship(s, C)
    const ship = s.ships['s-war' as ShipId]
    ship.standing.rally = null
    orderShip(s, ship.id, { kind: 'patrol', world: Y, weeks: 2, posture: 'favourable', then: { kind: 'world', world: X }, began: null })
    // She patrols Y, then comes to rest at X, the rendezvous.
    runUntil(s, (g) => g.ships['s-war' as ShipId].location.kind === 'world' && (g.ships['s-war' as ShipId].location as { world: WorldId }).world === Y, 10)
    recordEvent(s, Y, { kind: 'unrest_rose', valence: 'neutral', against: s.worlds[Y].faction, severity: 2, level: 6 })
    logWitnessed(s) // as the week's events would have been, had it happened during the week
    runUntil(s, (g) => g.ships['s-war' as ShipId].location.kind === 'world' && (g.ships['s-war' as ShipId].location as { world: WorldId }).world === X, 10)
    const general = reports(s, 'c-s-war' as CharacterId).find((r) => r.subject.startsWith('General report'))!
    expect(general).toBeDefined()
    expect(general.subject).toBe('General report: unrest rising')
    expect(general.lede).toMatch(/^We have made the rendezvous at Exe; the most serious news since your orders of wk 0 is that unrest has risen: the world is unruly \(Wye, wk \d+\)\.$/)
    expect(general.events.some((e) => e.kind === 'unrest_rose' && e.at === Y)).toBe(true)
    expect(s.ships['s-war' as ShipId].log).toEqual([])
  })

  it('fresh orders open a fresh log', () => {
    const s = line()
    warship(s, X)
    const ship = s.ships['s-war' as ShipId]
    ship.log.push(recordEvent(s, X, { kind: 'unrest_rose', valence: 'neutral', against: s.worlds[X].faction, severity: 2, level: 6 }))
    s.week = 4
    postDispatch(s, { kind: 'ship', ship: ship.id }, C, { kind: 'order', ship: ship.id, order: { kind: 'hold' } })
    advanceWeek(s)
    advanceWeek(s)
    expect(ship.lastOrders).toBeGreaterThan(0)
    expect(ship.log.some((e) => e.kind === 'unrest_rose')).toBe(false)
  })

  it('a sighting is a quick update from a cautious captain at a port on the lanes, and not from a bold one', () => {
    const count = (initiative: number, seed: number): number => {
      const s = line()
      s.rng = createRng(seed)
      s.week = 1
      warship(s, X, 's-war' as ShipId, initiative)
      raider(s, X)
      recordEvent(s, X, { kind: 'hull_arrived', valence: 'neutral', against: s.worlds[X].faction, severity: 2, ship: s.ships['s-raider' as ShipId] })
      afterActionReports(s)
      return reports(s, 'c-s-war' as CharacterId).length
    }
    let cautious = 0
    let bold = 0
    for (let seed = 1; seed <= 20; seed++) {
      cautious += count(-2, seed)
      bold += count(2, seed)
    }
    expect(cautious).toBeGreaterThan(bold)
    expect(cautious).toBeGreaterThanOrEqual(15)
  })

  it('a fight of her own is always written up, even where it must be carried', () => {
    const s = line()
    s.week = 1
    warship(s, Y, 's-war' as ShipId, 2)
    const ship = s.ships['s-war' as ShipId]
    s.worlds[Y].faction = WARLORD // no friendly port to post from
    raider(s, Y)
    recordEvent(s, Y, { kind: 'battle', valence: 'bad', severity: 2, ship: s.ships['s-raider' as ShipId] })
    recordEvent(s, Y, { kind: 'ship_damaged', valence: 'neutral', against: ship.faction, favours: PIRATES, severity: 1, ship })
    afterActionReports(s)
    const [r] = reports(s, 'c-s-war' as CharacterId)
    expect(r).toBeDefined()
    expect(r.subject).toBe('Battle against pirates (+1)')
    expect(ship.mailbag).toHaveLength(1)
  })
})
