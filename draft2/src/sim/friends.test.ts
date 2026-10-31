import { describe, expect, it } from 'vitest'
import { askRoute, checkRequests, honours, routesToAvoid, settleTip, standRound } from './agents'
import { ransomAnother } from './captivity'
import { beginEncounter, joinEncounter, possibleAllies, resolveRound, settle, willStand } from './combat'
import { advanceWeek, askForRoute, newGame, PLAYER, playerShip } from './game'
import { characterLocation } from './mail'
import { deal, greeting, regardOf, relation } from './people'
import { emptyBelief } from './belief'
import { buildPlayerView } from './player'
import { createRng } from './rng'
import { newShip } from './ships'
import type { Character, CharacterId, ShipId, WorldId } from './types'

const person = (state: ReturnType<typeof newGame>, id: string, at: WorldId, traits: Partial<NonNullable<Character['traits']>> = {}): Character => {
  const c: Character = { id: id as never, name: id, culture: 'English', sex: 'm', empire: state.worlds[at].empire, body: { kind: 'world', world: at }, purse: 50000, debt: null, traits: { greed: 0.5, caution: 0.5, openness: 0.5, pride: 0.5, loyalty: 0.5, ...traits } }
  state.characters[c.id] = c
  return c
}

describe('ways to make friends', () => {
  it('a tip that made money weighs a great deal; one that lost money is held against the teller', () => {
    const state = newGame(121)
    const here = characterLocation(state, PLAYER) as WorldId
    const teller = person(state, 'teller', here)
    settleTip(state, PLAYER, { tip: teller.id, good: 'grain' }, 9000, state.worlds[here])
    expect(regardOf(state, PLAYER, teller.id)).toBeGreaterThanOrEqual(1.5)
    expect(greeting(state, PLAYER, teller.id)).toMatch(/Thanks for that tip/)
    const bad = person(state, 'bad', here)
    settleTip(state, PLAYER, { tip: bad.id, good: 'ore' }, -2000, state.worlds[here])
    expect(regardOf(state, PLAYER, bad.id)).toBeLessThan(0)
  })

  it('a friend stands with you in the approaches, and both remember it', () => {
    const state = newGame(122)
    const here = characterLocation(state, PLAYER) as WorldId
    const me = playerShip(state)!
    const pal = person(state, 'pal', here, { caution: 0.9 })
    const palShip = newShip(createRng(2), 's-pal' as ShipId, 'free_trader', pal.empire, { kind: 'personal', character: pal.id }, here, new Set(), pal.id)
    palShip.docked = state.week
    pal.body = { kind: 'aboard', ship: palShip.id }
    state.ships[palShip.id] = palShip
    const outlaw = person(state, 'outlaw', here, { caution: 0.1 })
    outlaw.outlaw = true
    const raider = newShip(createRng(3), 's-raider' as ShipId, 'corvette', outlaw.empire, { kind: 'personal', character: outlaw.id }, here, new Set(), outlaw.id)
    outlaw.body = { kind: 'aboard', ship: raider.id }
    state.ships[raider.id] = raider
    const e = beginEncounter(state, raider, me, here)
    expect(possibleAllies(state, e).map((s) => s.id)).toContain(palShip.id)
    // A careful stranger will not; a friend will.
    expect(willStand(state, palShip, e)).toBe(false)
    deal(state, pal.id, PLAYER, 1.5, 'old friends')
    expect(willStand(state, palShip, e)).toBe(true)
    joinEncounter(state, e, palShip)
    while (!e.outcome) resolveRound(state, e, 'fight')
    settle(state, e)
    if (e.outcome !== 'struck') {
      expect(regardOf(state, PLAYER, pal.id)).toBeGreaterThanOrEqual(1)
      expect(greeting(state, pal.id, PLAYER)).toMatch(/fought them off/)
    }
  })

  it('a route asked is honoured by a friend and by the careful when warned; breaking it makes an enemy, keeping it a friend', () => {
    const state = newGame(123)
    const here = characterLocation(state, PLAYER) as WorldId
    const asker = person(state, 'asker', here, { pride: 0.9 })
    const friend = person(state, 'friend', here)
    const careful = person(state, 'careful', here, { caution: 0.9 })
    const bold = person(state, 'bold', here, { caution: 0.1 })
    deal(state, friend.id, asker.id, 1, 'friends')
    const world = Object.keys(state.worlds).sort()[3] as WorldId
    const r1 = askRoute(state, asker.id, friend.id, world, 'grain')
    expect(r1.tone).toBe('orelse')
    expect(honours(state, friend, asker.id, r1)).toBe(true)
    const r2 = askRoute(state, asker.id, careful.id, world, 'grain')
    expect(honours(state, careful, asker.id, r2)).toBe(true)
    const r3 = askRoute(state, asker.id, bold.id, world, 'grain')
    expect(honours(state, bold, asker.id, r3)).toBe(false)
    expect(routesToAvoid(state, friend)).toEqual([{ world, good: 'grain' }])
    // The bold one is seen buying it there: broken.
    state.beliefs[asker.id] ??= emptyBelief()
    state.beliefs[asker.id].traffic[world] = [{ movement: { week: state.week + 1, ship: 's-b' as ShipId, shipName: 'B', type: 'free_trader', empire: bold.empire, captain: bold.id, captainName: 'bold', from: null, to: null, sold: [], bought: [{ good: 'grain', tons: 10, price: 1 }] }, source: 'heard', observed: state.week + 1 }]
    state.week += 1
    checkRequests(state)
    expect(regardOf(state, asker.id, bold.id)).toBeLessThan(-1)
    expect(relation(state, asker.id, bold.id).request).toBeNull()
    // Twelve weeks on, the friend has kept it.
    state.week += 12
    checkRequests(state)
    expect(regardOf(state, asker.id, friend.id)).toBeGreaterThanOrEqual(0.9)
    expect(greeting(state, asker.id, friend.id)).toMatch(/left that route/)
  })

  it('the player may ask a route of one who thinks well of them, and only then', () => {
    const state = newGame(124)
    const here = characterLocation(state, PLAYER) as WorldId
    const c = person(state, 'c', here)
    const world = Object.keys(state.worlds).sort()[2] as WorldId
    expect(askForRoute(state, c.id, world, 'ore')).toBe(false)
    deal(state, c.id, PLAYER, 1.2, 'likes me')
    expect(askForRoute(state, c.id, world, 'ore')).toBe(true)
    expect(askForRoute(state, c.id, world, 'ore')).toBe(false)
    const page = buildPlayerView(state).book.find((p) => p.id === c.id)!
    expect(page.askedByYou?.good).toBe('ore')
  })

  it('paying another\'s ransom makes a friend for life, and those who saw it think the more of you', () => {
    const state = newGame(125)
    const here = characterLocation(state, PLAYER) as WorldId
    const held = person(state, 'held', here)
    held.captive = { by: null, of: state.worlds[here].empire, since: 0, at: here, term: 99 }
    held.purse = 0
    const witness = person(state, 'witness', here)
    state.characters[PLAYER].purse = 50000
    expect(ransomAnother(state, PLAYER, held)).toBe(true)
    expect(held.captive).toBeNull()
    expect(regardOf(state, held.id, PLAYER)).toBeGreaterThanOrEqual(2.5)
    expect(relation(state, witness.id, PLAYER).esteem).toBeGreaterThan(0)
    expect(greeting(state, held.id, PLAYER)).toMatch(/liberty/)
  })

  it('a round for its own sake warms a little, and not again within the month', () => {
    const state = newGame(126)
    const here = characterLocation(state, PLAYER) as WorldId
    const c = person(state, 'c', here)
    expect(standRound(state, c.id)).toBe(true)
    const r = regardOf(state, c.id, PLAYER)
    expect(r).toBeGreaterThan(0)
    expect(standRound(state, c.id)).toBe(false)
    state.week += 4
    expect(standRound(state, c.id)).toBe(true)
    expect(regardOf(state, c.id, PLAYER)).toBeGreaterThan(r)
  })

  it('nothing fades: a friend not seen for years is a friend still', () => {
    const state = newGame(127)
    const here = characterLocation(state, PLAYER) as WorldId
    const c = person(state, 'c', here)
    deal(state, PLAYER, c.id, 2.5, 'saved my life')
    c.body = { kind: 'world', world: Object.keys(state.worlds).sort()[7] as WorldId }
    for (let i = 0; i < 160; i++) advanceWeek(state)
    // Only a dealing moves regard; time alone never does. (A friend's word of them might, which is by design.)
    expect(regardOf(state, PLAYER, c.id)).toBeGreaterThanOrEqual(2)
    void CharacterId_
  })
})
const CharacterId_ = null as unknown as CharacterId
