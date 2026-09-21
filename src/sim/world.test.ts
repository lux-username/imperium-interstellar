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
    s.characters['c-w' as CharacterId] = { id: 'c-w' as CharacterId, name: 'W', faction: 'f-admin' as never, post: { kind: 'commander', ship: 's-w' as ShipId }, traits: s.characters[s.player].traits, agent: false }
    s.ships['s-w' as ShipId] = { ...packet, id: 's-w' as ShipId, name: 'Warship', role: 'patrol', strength: 3, commander: 'c-w' as CharacterId, order: null, mailbag: [], passengers: [] }
    changeHands(s, s.worlds[X], REBELS, { army: 2, marines: 0 })
    expect(s.characters['c-x' as CharacterId].post).toEqual({ kind: 'passenger', ship: 's-w' })
    expect(s.ships['s-w' as ShipId].passengers).toEqual(['c-x'])
    expect(s.ships['s-w' as ShipId].faction).toBe('f-admin')
    expect(packet.faction).toBe(REBELS)
    expect(packet.order).toEqual({ kind: 'hold' })
  })

  it('a fallen world closes its port: packets stop calling and nothing more arrives from it', () => {
    const s = line()
    changeHands(s, s.worlds[Y], REBELS, { army: 2, marines: 0 })
    const arrivalsAtY = () => Object.values(s.events).filter((e) => e.kind === 'hull_arrived' && e.at === Y && e.ship?.faction === 'f-admin').length
    for (let i = 0; i < 12; i++) advanceWeek(s)
    expect(arrivalsAtY()).toBe(0)
    // No letter from Wye reaches the desk after the fall: the rebel governor writes to nobody the desk reads.
    const fromY = Object.values(s.mail).filter((m) => m.contents.kind === 'report' && m.contents.report.observedAt === Y && m.contents.report.channel === 'official' && m.status.kind === 'delivered')
    expect(fromY).toEqual([])
  })

  it('an independent world regrows a garrison, slowly, up to a cap', () => {
    const s = line()
    changeHands(s, s.worlds[Y], REBELS, { army: 1, marines: 0 })
    for (let i = 0; i < 200; i++) regrowGarrisons(s)
    expect(s.worlds[Y].garrison).toBe(1 + Math.floor(s.worlds[Y].profile.population / 2))
  })

  it("a faction's seat does not fall in this campaign: the rising breaks on the palace guard", () => {
    const s = line()
    const C = s.capital
    s.worlds[C].garrison = 0
    s.worlds[C].unrest = 10
    beginRevolt(s, s.worlds[C])
    expect(s.worlds[C].faction).toBe('f-admin')
    expect(s.worlds[C].contest).toBeNull()
    expect(s.worlds[C].garrison).toBe(1)
  })

  it('a rising is news most governors write home about at once, asking for help', () => {
    let letters = 0
    for (let seed = 1; seed <= 12; seed++) {
      const s = line()
      s.rng = createRng(seed)
      s.worlds[X].garrison = 6
      s.worlds[X].unrest = 10
      runUntil(s, (st) => st.worlds[X].contest !== null || st.worlds[X].faction !== 'f-admin', 3)
      const letter = Object.values(s.mail).find((m) => m.contents.kind === 'report' && m.contents.report.observer === 'c-x' && m.contents.report.events.some((e) => e.kind === 'revolt_began'))
      if (!letter) continue
      letters += 1
      if (letter.contents.kind === 'report') expect(letter.contents.report.snapshot.kind === 'world' && letter.contents.report.snapshot.world.contest?.attacker).toBe(REBELS)
    }
    // 2d6 + 3 against 8: about five in six write; the rest sit on it.
    expect(letters).toBeGreaterThanOrEqual(8)
  })
})
