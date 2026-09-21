import { describe, expect, it } from 'vitest'
import { advanceWeek } from './game'
import { REBELS } from './factions'
import { groundRound, landUnderFire, takeLosses } from './ground'
import { createRng } from './rng'
import type { CharacterId, ShipId, WorldId } from './types'
import { beginRevolt, changeHands, fightContests, regrowGarrisons } from './world'
import { line, runUntil } from './fixtures.test-helper'

const X = 'w-x' as WorldId
const Y = 'w-y' as WorldId

describe('ground fighting', () => {
  it('losses come out of the army before the marines', () => {
    expect(takeLosses({ army: 2, marines: 2 }, 1)).toEqual({ army: 1, marines: 2 })
    expect(takeLosses({ army: 2, marines: 2 }, 3)).toEqual({ army: 0, marines: 1 })
    expect(takeLosses({ army: 0, marines: 1 }, 5)).toEqual({ army: 0, marines: 0 })
  })

  it('equal forces each lose a detachment about two weeks in five', () => {
    const rng = createRng(7)
    let attackerLosses = 0
    let defenderLosses = 0
    for (let i = 0; i < 2000; i++) {
      const r = groundRound(rng, { army: 3, marines: 0 }, { army: 3, marines: 0 })
      attackerLosses += 3 - r.attackers.army
      defenderLosses += 3 - r.defenders.army
    }
    expect(attackerLosses / 2000).toBeGreaterThan(0.35)
    expect(attackerLosses / 2000).toBeLessThan(0.5)
    expect(defenderLosses / 2000).toBeGreaterThan(0.35)
    expect(defenderLosses / 2000).toBeLessThan(0.5)
  })

  it('a landing without a beachhead of marines costs a detachment on the way in', () => {
    expect(landUnderFire({ army: 3, marines: 0 })).toEqual({ landed: { army: 2, marines: 0 }, lost: 1 })
    expect(landUnderFire({ army: 3, marines: 2 })).toEqual({ landed: { army: 3, marines: 2 }, lost: 0 })
  })
})

describe('revolt', () => {
  it('an ungarrisoned world falls the week it rises; the governor with no ship in orbit is killed', () => {
    const s = line()
    s.worlds[Y].garrison = 0
    s.worlds[Y].unrest = 10
    beginRevolt(s, s.worlds[Y])
    expect(s.worlds[Y].faction).toBe(REBELS)
    expect(s.worlds[Y].contest).toBeNull()
    expect(s.characters['c-y' as CharacterId]).toBeUndefined()
    const kinds = Object.values(s.events).map((e) => e.kind).filter((k) => !k.startsWith('hull_')).sort()
    expect(kinds).toEqual(['governor_killed', 'revolt_began', 'world_fell'])
    // The rising's strength becomes the new garrison, and the rebels appoint one of their own.
    expect(s.worlds[Y].garrison).toBeGreaterThan(0)
    expect(s.characters[s.worlds[Y].governor as CharacterId].faction).toBe(REBELS)
  })

  it('a garrisoned world fights it out week by week, and the desk can still hear from it meanwhile', () => {
    const s = line()
    s.worlds[X].garrison = 4
    s.worlds[X].unrest = 10
    beginRevolt(s, s.worlds[X])
    expect(s.worlds[X].contest?.attacker).toBe(REBELS)
    expect(s.worlds[X].faction).toBe('f-admin')
    const before = s.worlds[X].garrison
    let weeks = 0
    while (s.worlds[X].contest && weeks < 60) {
      fightContests(s)
      weeks += 1
    }
    expect(weeks).toBeGreaterThan(0)
    expect(weeks).toBeLessThan(60)
    // Either the rising is crushed or the world is lost; nothing resolves in a single tick.
    const kinds = new Set(Object.values(s.events).map((e) => e.kind))
    expect(kinds.has('revolt_crushed') || kinds.has('world_fell')).toBe(true)
    if (kinds.has('world_fell')) expect(s.worlds[X].faction).toBe(REBELS)
    else expect(s.worlds[X].garrison).toBeLessThanOrEqual(before)
  })

  it('the governor gets off to a friendly hull in orbit when the palace falls, and unarmed hulls in port are seized', () => {
    const s = line()
    const packet = s.ships['s-xy' as ShipId] // in port at X on week 0
    expect(packet.location).toEqual({ kind: 'world', world: X })
    s.characters['c-w' as CharacterId] = { id: 'c-w' as CharacterId, name: 'W', faction: 'f-admin' as never, post: { kind: 'commander', ship: 's-w' as ShipId }, traits: s.characters[s.player].traits }
    s.ships['s-w' as ShipId] = { ...packet, id: 's-w' as ShipId, name: 'Warship', role: 'patrol', strength: 3, commander: 'c-w' as CharacterId, order: null, mailbag: [], passengers: [] }
    changeHands(s, s.worlds[X], REBELS, { army: 2, marines: 0 })
    expect(s.characters['c-x' as CharacterId].post).toEqual({ kind: 'passenger', ship: 's-w' })
    expect(s.ships['s-w' as ShipId].passengers).toEqual(['c-x'])
    expect(s.ships['s-w' as ShipId].faction).toBe('f-admin')
    expect(packet.faction).toBe(REBELS)
    expect(packet.order).toEqual({ kind: 'hold' })
  })

  it('a fallen world closes its port — but nobody knows yet, so the next packet sails in and is lost, and then the lane is silent', () => {
    const s = line()
    // P2 is in port at X; Wye falls while she is there. Nothing has told the desk.
    changeHands(s, s.worlds[Y], REBELS, { army: 2, marines: 0 })
    const packet = s.ships['s-xy' as ShipId]
    let arrivals = 0
    for (let i = 0; i < 12; i++) {
      advanceWeek(s)
      arrivals += Object.values(s.events).filter((e) => e.week === s.week && e.kind === 'hull_arrived' && e.at === Y && e.ship?.faction === 'f-admin').length
    }
    expect(arrivals).toBe(1)
    expect(packet.faction).toBe(REBELS)
    expect(packet.order).toEqual({ kind: 'hold' }) // her lane is not wholly the rebels', so she lies idle
    expect(Object.values(s.events).some((e) => e.kind === 'ship_captured' && e.ship?.id === 's-xy')).toBe(true)
    // No letter from Wye reaches the desk after the fall: the rebel governor writes to nobody the desk reads.
    const fromY = Object.values(s.mail).filter((m) => m.contents.kind === 'report' && m.contents.report.observedAt === Y && m.contents.report.channel === 'official' && m.status.kind === 'delivered')
    expect(fromY).toEqual([])
  })

  it('once the docks at a port have heard a neighbour fell, its packet is held back — word travels by lane, never faster', () => {
    const s = line()
    changeHands(s, s.worlds[Y], REBELS, { army: 2, marines: 0 })
    // The talk of it has reached Exe (as merchants would carry it) but not the capital.
    const fell = Object.values(s.events).find((e) => e.kind === 'world_fell')!
    s.rumours.push({ event: fell, origin: Y, born: 0, heard: { [Y]: 0, [X]: 1 } })
    for (let i = 0; i < 6; i++) advanceWeek(s)
    expect(Object.values(s.events).some((e) => e.kind === 'hull_arrived' && e.at === Y && e.ship?.faction === 'f-admin')).toBe(false)
    expect(s.ships['s-xy' as ShipId].faction).toBe('f-admin')
    // What the desk believes is no use to a packet lying at Exe: only the capital's own packets read the desk's mind.
    const s2 = line()
    changeHands(s2, s2.worlds[Y], REBELS, { army: 2, marines: 0 })
    s2.beliefs[s2.player].worlds[Y] = { id: 'r-t' as never, channel: 'official', observer: s2.player, observerName: 'x', observerTitle: null, observerShip: null, subject: 'x', lede: 'x', observedAt: Y, observed: 0, snapshot: { kind: 'world', world: { id: Y, name: 'Wye', hex: s2.worlds[Y].hex, profile: s2.worlds[Y].profile, faction: REBELS, governor: null, governorName: null, unrest: 2, garrison: 2, marines: 0, contest: null, ships: [] } }, events: [], envelope: { origin: Y, destination: { kind: 'world', world: s2.capital }, sent: 0, route: [Y], eta: 0 }, delivered: 0 }
    for (let i = 0; i < 6; i++) advanceWeek(s2)
    expect(s2.ships['s-xy' as ShipId].faction).toBe(REBELS) // she sailed in regardless, and was taken
  })

  it('an independent world regrows a garrison, slowly, up to a cap', () => {
    const s = line()
    changeHands(s, s.worlds[Y], REBELS, { army: 1, marines: 0 })
    for (let i = 0; i < 200; i++) regrowGarrisons(s)
    expect(s.worlds[Y].garrison).toBe(1 + Math.floor(s.worlds[Y].profile.population / 2))
  })

  it('the capital falling is the end of the game: the desk is taken, and the weeks stop', () => {
    const s = line()
    const C = s.capital
    s.worlds[C].garrison = 0
    s.worlds[C].unrest = 10
    beginRevolt(s, s.worlds[C])
    expect(s.worlds[C].faction).toBe(REBELS)
    expect(s.ending).toEqual({ kind: 'capital_fallen', by: REBELS, week: 0 })
    expect(s.characters[s.player]).toBeDefined() // held, not killed
    advanceWeek(s)
    expect(s.week).toBe(0)
  })

  it('a rising is news most governors write home about at once, asking for help', () => {
    let risings = 0
    let letters = 0
    for (let seed = 1; seed <= 48; seed++) {
      const s = line()
      s.rng = createRng(seed)
      s.worlds[X].garrison = 6
      s.worlds[X].unrest = 10
      runUntil(s, (st) => st.worlds[X].contest !== null || st.worlds[X].faction !== 'f-admin', 3)
      if (!Object.values(s.events).some((e) => e.at === X && e.kind === 'revolt_began')) continue // not every seed rises in three weeks
      risings += 1
      const letter = Object.values(s.mail).find((m) => m.contents.kind === 'report' && m.contents.report.observer === 'c-x' && m.contents.report.events.some((e) => e.kind === 'revolt_began'))
      if (!letter) continue
      letters += 1
      if (letter.contents.kind === 'report') expect(letter.contents.report.snapshot.kind === 'world' && letter.contents.report.snapshot.world.contest?.attacker).toBe(REBELS)
    }
    // 2d6 + 3 against 8: about five in six write; the rest sit on it.
    expect(risings).toBeGreaterThanOrEqual(24)
    expect(letters / risings).toBeGreaterThanOrEqual(0.6)
  })
})
