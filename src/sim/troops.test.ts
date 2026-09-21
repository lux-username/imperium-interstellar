import { describe, expect, it } from 'vitest'
import { playerTraits } from './characters'
import { REBELS } from './factions'
import { HULLS, newShip } from './fleet'
import { advanceWeek, orderShip } from './game'
import { createRng } from './rng'
import type { CharacterId, GameState, ShipId, WorldId } from './types'
import type { Order } from './orders'
import { changeHands } from './world'
import { line, runUntil } from './fixtures.test-helper'

const C = 'w-c' as WorldId
const X = 'w-x' as WorldId
const Y = 'w-y' as WorldId
const T = 's-tr' as ShipId

/** The line with a transport and her commander in port at the capital, and an officer in the pool there. */
function withTransport(): GameState {
  const s = line()
  const cid = 'c-tr' as CharacterId
  s.characters[cid] = { id: cid, name: 'Master', faction: 'f-admin' as never, post: { kind: 'commander', ship: T }, traits: playerTraits() }
  s.ships[T] = newShip(T, 'Carrier', HULLS.transport, 'f-admin' as never, C, s.characters[cid])
  s.characters['c-off' as CharacterId] = { id: 'c-off' as CharacterId, name: 'Officer', faction: 'f-admin' as never, post: { kind: 'unassigned', at: C }, traits: playerTraits() }
  s.worlds[C].garrison = 6
  s.worlds[C].marines = 2
  return s
}

const transport = (to: WorldId, cargo: Partial<Extract<Order, { kind: 'transport' }>> = {}): Order => ({
  kind: 'transport',
  army: 0,
  marines: 0,
  passenger: null,
  purpose: 'land',
  to,
  then: { kind: 'world', world: C },
  loaded: false,
  ...cargo,
})

describe('the transport order', () => {
  it('loads from the garrison where the order is read and reinforces a friendly world, less what did not wake', () => {
    const s = withTransport()
    orderShip(s, T, transport(X, { army: 2, marines: 1 }))
    advanceWeek(s) // reads the order at the capital, loads, sails
    expect(s.worlds[C].garrison).toBe(4)
    expect(s.worlds[C].marines).toBe(1)
    expect(s.ships[T].troops).toEqual({ army: 2, marines: 1 })
    advanceWeek(s) // lands at X
    const landed = Object.values(s.events).find((e) => e.kind === 'troops_landed')
    expect(landed?.at).toBe(X)
    expect(landed?.ship?.id).toBe(T)
    expect(s.ships[T].troops).toEqual({ army: 0, marines: 0 })
    const arrived = s.worlds[X].garrison + s.worlds[X].marines - 5
    expect(arrived).toBe(landed?.level)
    expect(arrived).toBeGreaterThanOrEqual(0)
    expect(arrived).toBeLessThanOrEqual(3)
    // The master writes home from X; the letter is how the desk learns what arrived.
    const letter = Object.values(s.mail).find((m) => m.contents.kind === 'report' && m.contents.report.observer === 'c-tr' && m.contents.report.observedAt === X)
    expect(letter).toBeDefined()
    // And she heads for the rendezvous.
    expect(s.ships[T].order).toEqual({ kind: 'move', to: C, then: null })
  })

  it('never takes more than the hull can carry or the world can spare', () => {
    const s = withTransport()
    s.worlds[C].garrison = 1
    orderShip(s, T, transport(X, { army: 5, marines: 5 }))
    advanceWeek(s)
    expect(s.ships[T].troops).toEqual({ army: 1, marines: 2 })
    expect(s.worlds[C].garrison).toBe(0)
  })

  it('about one detachment in ten does not survive the cryo passage', () => {
    let sent = 0
    let arrived = 0
    for (let seed = 1; seed <= 40; seed++) {
      const s = withTransport()
      s.rng = createRng(seed)
      const before = s.worlds[X].garrison
      orderShip(s, T, transport(X, { army: 3 }))
      advanceWeek(s)
      advanceWeek(s)
      sent += 3
      arrived += s.worlds[X].garrison - before
    }
    expect(arrived / sent).toBeGreaterThan(0.8)
    expect(arrived / sent).toBeLessThan(0.97)
  })
})

describe('landings', () => {
  it('on a hostile world without a beachhead costs a detachment on the way in, then the ground contest begins', () => {
    const s = withTransport()
    changeHands(s, s.worlds[X], REBELS, { army: 2, marines: 0 })
    s.rng = createRng(11)
    orderShip(s, T, transport(X, { army: 3 }))
    advanceWeek(s)
    advanceWeek(s)
    const landed = Object.values(s.events).find((e) => e.kind === 'troops_landed' && e.at === X)
    expect(landed?.level).toBeLessThanOrEqual(2)
    if ((landed?.level ?? 0) > 0) {
      expect(s.worlds[X].contest?.attacker).toBe('f-admin')
      expect(s.worlds[X].faction).toBe(REBELS)
    }
  })

  it('behind a beachhead of marines the landing is clean, and cryo losses are an event of their own', () => {
    let clean = 0
    for (let seed = 1; seed <= 12; seed++) {
      const s = withTransport()
      s.rng = createRng(seed)
      changeHands(s, s.worlds[X], REBELS, { army: 2, marines: 0 })
      s.worlds[C].marines = 3
      orderShip(s, T, transport(X, { army: 1, marines: 2 }))
      advanceWeek(s)
      const carried = s.ships[T].troops.army + s.ships[T].troops.marines
      advanceWeek(s)
      const landed = Object.values(s.events).find((e) => e.kind === 'troops_landed' && e.at === X)?.level ?? 0
      const lost = Object.values(s.events).find((e) => e.kind === 'troops_lost' && e.at === X)?.level ?? 0
      // Everyone who woke came down, when both marines woke; one more is lost on the way in when they did not.
      if (lost === 0) {
        expect(landed).toBe(carried)
        clean += 1
      } else expect(landed + lost).toBeGreaterThanOrEqual(carried - 1)
    }
    expect(clean).toBeGreaterThan(0)
  })

  it('on a world nobody is holding, the landing takes it outright', () => {
    const s = withTransport()
    changeHands(s, s.worlds[X], REBELS, { army: 0, marines: 0 })
    s.worlds[X].garrison = 0
    orderShip(s, T, transport(X, { army: 2, marines: 2 }))
    advanceWeek(s)
    advanceWeek(s)
    expect(s.worlds[X].faction).toBe('f-admin')
    expect(Object.values(s.events).some((e) => e.kind === 'world_taken' && e.at === X)).toBe(true)
  })

  it('a relief force fights it out and the world is retaken or the landing thrown back', () => {
    const s = withTransport()
    changeHands(s, s.worlds[X], REBELS, { army: 1, marines: 0 })
    orderShip(s, T, transport(X, { army: 3, marines: 2 }))
    s.worlds[C].marines = 2
    runUntil(s, (st) => st.worlds[X].faction === 'f-admin' || Object.values(st.events).some((e) => e.kind === 'landing_repulsed'), 40)
    expect(s.worlds[X].faction === 'f-admin' || Object.values(s.events).some((e) => e.kind === 'landing_repulsed')).toBe(true)
  })
})

describe('appointments', () => {
  it('an unwilling incumbent ignores an officer who arrives without marines', () => {
    const s = withTransport()
    s.characters['c-x' as CharacterId].traits.loyalty = 'self'
    orderShip(s, T, transport(X, { passenger: 'c-off' as CharacterId, purpose: 'appoint' }))
    advanceWeek(s)
    expect(s.ships[T].passengers).toEqual(['c-off'])
    advanceWeek(s)
    expect(s.worlds[X].governor).toBe('c-x')
    expect(Object.values(s.events).some((e) => e.kind === 'appointment_refused' && e.at === X)).toBe(true)
    // The officer stays aboard and comes home.
    expect(s.ships[T].passengers).toEqual(['c-off'])
  })

  it('marines arriving with the appointment put the officer in the seat', () => {
    const s = withTransport()
    s.characters['c-x' as CharacterId].traits.loyalty = 'self'
    orderShip(s, T, transport(X, { passenger: 'c-off' as CharacterId, purpose: 'appoint', marines: 2 }))
    advanceWeek(s)
    advanceWeek(s)
    if (s.worlds[X].marines === 0) return // both marines lost on revival: a legitimate refusal
    expect(s.worlds[X].governor).toBe('c-off')
    expect(s.characters['c-off' as CharacterId].post).toEqual({ kind: 'governor', world: X })
    expect(s.characters['c-x' as CharacterId].post).toEqual({ kind: 'unassigned', at: X })
    expect(Object.values(s.events).some((e) => e.kind === 'appointment_made' && e.at === X)).toBe(true)
  })

  it('a governor loyal to the desk hands over without a fuss', () => {
    const s = withTransport()
    s.characters['c-x' as CharacterId].traits.loyalty = 'player'
    orderShip(s, T, transport(X, { passenger: 'c-off' as CharacterId, purpose: 'appoint' }))
    advanceWeek(s)
    advanceWeek(s)
    expect(s.worlds[X].governor).toBe('c-off')
  })
})

describe('prizes', () => {
  it('an officer sent out takes command of a prize lying in port, and she comes onto the books', () => {
    const s = withTransport()
    const prize = newShip('s-prize' as ShipId, 'Black Gull', HULLS.raider, 'f-admin' as never, X, null)
    s.ships['s-prize' as ShipId] = prize
    orderShip(s, T, transport(X, { passenger: 'c-off' as CharacterId, purpose: 'command' }))
    advanceWeek(s)
    advanceWeek(s)
    expect(prize.commander).toBe('c-off')
    expect(s.characters['c-off' as CharacterId].post).toEqual({ kind: 'commander', ship: 's-prize' })
    expect(Object.values(s.events).some((e) => e.kind === 'officer_took_command' && e.ship?.id === 's-prize')).toBe(true)
  })

  it('passengers step off at the capital into the pool', () => {
    const s = withTransport()
    orderShip(s, T, transport(Y, { passenger: 'c-off' as CharacterId, purpose: 'command' })) // no prize at Y: he rides back
    runUntil(s, (st) => st.ships[T].location.kind === 'world' && st.ships[T].location.world === C && st.week > 2, 12)
    expect(s.characters['c-off' as CharacterId].post).toEqual({ kind: 'unassigned', at: C })
    expect(s.ships[T].passengers).toEqual([])
  })
})
