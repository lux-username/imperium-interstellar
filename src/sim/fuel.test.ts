import { describe, expect, it } from 'vitest'
import { playerTraits } from './characters'
import { PIRATES } from './factions'
import { HULLS, newShip } from './fleet'
import { advanceWeek, orderShip } from './game'
import { refuelsAt } from './ships'
import type { CharacterId, GameState, ShipId, WorldId } from './types'
import { line } from './fixtures.test-helper'

const C = 'w-c' as WorldId
const X = 'w-x' as WorldId
const Y = 'w-y' as WorldId
const P = 's-pat' as ShipId

/** The line with a patrol craft at the capital. Exe and Wye are made D ports: no fuel out there. */
function thirsty(): GameState {
  const s = line()
  s.worlds[X].profile.starport = 'D'
  s.worlds[Y].profile.starport = 'D'
  s.characters['c-p' as CharacterId] = { id: 'c-p' as CharacterId, name: 'P', faction: 'f-admin' as never, post: { kind: 'commander', ship: P }, traits: playerTraits() }
  s.ships[P] = newShip(P, 'Vigilant', HULLS.patrol, 'f-admin' as never, C, s.characters['c-p' as CharacterId])
  s.ships[P].standing.rally = null // hold where the order ends; no rally to run home to
  return s
}

const at = (s: GameState) => (s.ships[P].location.kind === 'world' ? (s.ships[P].location as { world: WorldId }).world : 'transit')

describe('fuel', () => {
  it('every jump costs a tank, and a port of class B or better that is ours fills them', () => {
    const s = thirsty()
    expect(s.ships[P].fuel).toBe(HULLS.patrol.fuel)
    orderShip(s, P, { kind: 'move', to: Y, then: null })
    advanceWeek(s) // C→X
    advanceWeek(s) // lands X (D: no fuel), sails X→Y
    advanceWeek(s) // lands Y and holds
    expect(at(s)).toBe(Y)
    expect(s.ships[P].fuel).toBe(HULLS.patrol.fuel - 2)
    const order = orderShip(s, P, { kind: 'move', to: C, then: null }, Y)
    order.status = { kind: 'held', at: Y, expires: null } // as if the order were already waiting at Wye
    for (let i = 0; i < 4; i++) advanceWeek(s)
    expect(at(s)).toBe(C) // home at a B port of ours: tanks full
    expect(s.ships[P].fuel).toBe(HULLS.patrol.fuel)
  })

  it('with one jump left she goes for fuel instead of her destination — the rendezvous if it will serve', () => {
    const s = thirsty()
    // Lying at Exe with one jump left, ordered on to Wye (no fuel there) and then home.
    s.ships[P].location = { kind: 'world', world: X }
    s.ships[P].fuel = 1
    s.ships[P].order = { kind: 'move', to: Y, then: { kind: 'world', world: C } }
    advanceWeek(s)
    expect(s.ships[P].location).toEqual({ kind: 'transit', from: X, to: C, arrives: 2 })
    advanceWeek(s) // lands at the capital, fills her tanks, and sets out for Wye again the same week
    expect(s.ships[P].location).toEqual({ kind: 'transit', from: C, to: X, arrives: 3 })
    expect(s.ships[P].fuel).toBe(HULLS.patrol.fuel - 1)
  })

  it('with none she sits where she is until fuel comes to her', () => {
    const s = thirsty()
    s.ships[P].fuel = 1
    orderShip(s, P, { kind: 'move', to: Y, then: null })
    advanceWeek(s) // with one jump left and nothing at X, she does not even start — unless C itself refuels her first, which it does
    expect(s.ships[P].fuel).toBe(HULLS.patrol.fuel - 1)
    // Strand her properly: at Exe with nothing left.
    const s2 = thirsty()
    s2.ships[P].location = { kind: 'world', world: X }
    s2.ships[P].fuel = 0
    orderShip(s2, P, { kind: 'move', to: C, then: null }, X)
    for (let i = 0; i < 4; i++) advanceWeek(s2)
    expect(at(s2)).toBe(X)
  })

  it('a pirate fills her tanks only at a haven of class B or better that she knows', () => {
    const s = line()
    const cid = 'c-r' as CharacterId
    s.characters[cid] = { id: cid, name: 'R', faction: PIRATES, post: { kind: 'commander', ship: 's-r' as ShipId }, traits: { ...playerTraits(), loyalty: 'self' } }
    const r = newShip('s-r' as ShipId, 'Gull', HULLS.raider, PIRATES, Y, s.characters[cid])
    r.fuel = 1
    r.havens = [Y]
    s.ships['s-r' as ShipId] = r
    s.characters['c-y' as CharacterId].traits.loyalty = 'self' // Wye is a haven, and a B port
    expect(refuelsAt(s, r, Y)).toBe(true)
    expect(refuelsAt(s, r, X)).toBe(false) // a B port she does not know as a haven
    expect(refuelsAt(s, r, C)).toBe(false)
    r.location = { kind: 'transit', from: X, to: Y, arrives: 1 }
    advanceWeek(s)
    expect(r.fuel).toBeGreaterThanOrEqual(HULLS.raider.fuel - 1) // filled on landing, and perhaps off again the same week
  })

  it('a packet burns nothing and carries nothing on the books', () => {
    const s = line()
    for (let i = 0; i < 8; i++) advanceWeek(s)
    for (const p of Object.values(s.ships).filter((x) => x.role === 'packet')) expect(p.fuel).toBe(0)
    expect(Object.values(s.events).filter((e) => e.kind === 'hull_departed').length).toBeGreaterThan(4)
  })
})
