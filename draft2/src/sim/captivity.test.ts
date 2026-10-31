import { describe, expect, it } from 'vitest'
import { ransomFor } from './captivity'
import { beginEncounter, resolveRound, settle } from './combat'
import { advanceWeek, newGame, PLAYER, playerShip, ransomSelf, seeLender } from './game'
import { characterLocation } from './mail'
import { createRng } from './rng'
import { newShip, reachable } from './ships'
import type { CharacterId, GameState, ShipId, WorldId } from './types'

function outlawAt(state: GameState, at: WorldId, haven: WorldId): ShipId {
  const sid = 'so' as ShipId
  const cid = 'co' as CharacterId
  state.ships[sid] = newShip(createRng(1), sid, 'corvette', state.worlds[at].empire, { kind: 'personal', character: cid }, at, new Set(), cid)
  state.ships[sid].duty = { kind: 'raid', haven, until: 0 }
  state.characters[cid] = { id: cid, name: 'Red', culture: 'English', sex: 'f', empire: state.worlds[at].empire, body: { kind: 'aboard', ship: sid }, purse: 0, debt: null, outlaw: true }
  return sid
}

describe('captivity', () => {
  it('a taken captain is carried to the haven, landed, and put ashore when the outlaws tire of her, with half her purse gone', () => {
    const state = newGame(61)
    const ship = playerShip(state)!
    const here = (ship.location as { world: WorldId }).world
    const haven = reachable(state, here, 2)[0]
    const sid = outlawAt(state, here, haven)
    const e = beginEncounter(state, state.ships[sid], ship, here)
    resolveRound(state, e, 'strike')
    settle(state, e)
    const me = state.characters[PLAYER]
    expect(me.captive?.by).toBe(sid)
    expect(me.purse).toBe(10000)
    expect(playerShip(state)).toBeNull()
    // The outlaw runs home with her prisoner.
    state.ships[sid].course = haven
    advanceWeek(state)
    advanceWeek(state)
    expect(me.captive?.at).toBe(haven)
    expect(characterLocation(state, PLAYER)).toBe(haven)
    expect(me.captive?.term).toBeGreaterThan(state.week)
    expect(state.worlds[haven].news.some((n) => /prisoner/.test(n.text))).toBe(true)
    const term = me.captive!.term!
    while (state.week < term) advanceWeek(state)
    expect(me.captive).toBeNull()
    expect(characterLocation(state, PLAYER)).toBe(haven)
  })

  it('ransom buys release at once, and the lender sets a captain up again at a dockyard of their own empire', () => {
    const state = newGame(62)
    const ship = playerShip(state)!
    const here = (ship.location as { world: WorldId }).world
    const sid = outlawAt(state, here, here)
    const e = beginEncounter(state, state.ships[sid], ship, here)
    resolveRound(state, e, 'strike')
    settle(state, e)
    const me = state.characters[PLAYER]
    expect(ransomSelf(state)).toBe(false) // still aboard
    advanceWeek(state) // the outlaw is already at her haven: prisoner landed next tick? She has not sailed; landCaptives needs a landing.
    state.ships[sid].course = reachable(state, here, 2)[0]
    advanceWeek(state)
    state.ships[sid].course = here
    advanceWeek(state)
    advanceWeek(state)
    expect(me.captive?.at).toBe(here)
    const asked = ransomFor(me)
    const purse = me.purse
    expect(ransomSelf(state)).toBe(true)
    expect(me.captive).toBeNull()
    expect(me.purse).toBe(purse - asked)
    const owed = me.debt!.balance
    expect(seeLender(state)).toBe(true)
    expect(playerShip(state)).not.toBeNull()
    expect(me.debt!.balance).toBe(owed + 60000)
    expect(me.debt!.payment).toBe(6000)
    expect(seeLender(state)).toBe(false)
  })

  it('a navy\'s prisoner goes free when the port hears of peace', () => {
    const state = newGame(63)
    const empires = Object.keys(state.empires).sort()
    const me = state.characters[PLAYER]
    const foe = empires.find((e) => e !== me.empire)!
    const at = state.empires[foe as never].seat
    me.captive = { by: 's-navy-1' as ShipId, of: foe as never, since: 0, at, term: 999 }
    me.body = { kind: 'world', world: at }
    const key = [foe, me.empire].sort().join(':')
    state.worlds[at].board[key] = { pair: [empires[0] as never, empires[1] as never], stance: 'war', week: 0 }
    advanceWeek(state)
    expect(me.captive).not.toBeNull()
    state.worlds[at].board[key] = { pair: [empires[0] as never, empires[1] as never], stance: 'peace', week: 1 }
    advanceWeek(state)
    expect(me.captive).toBeNull()
  })
})
