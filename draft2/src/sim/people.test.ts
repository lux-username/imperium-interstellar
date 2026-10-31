import { describe, expect, it } from 'vitest'
import { askCaptain, tellTies, willingness } from './agents'
import { beginEncounter, npcChoice, resolveRound, settle } from './combat'
import { advanceWeek, newGame, PLAYER, playerShip, sellGoods, buyGoods, sail } from './game'
import { characterLocation } from './mail'
import { deal, regardOf, relation, remarkable, rollTraits, standingWord } from './people'
import { buildPlayerView } from './player'
import { createRng } from './rng'
import { newShip } from './ships'
import type { Character, CharacterId, ShipId, WorldId } from './types'

const person = (id: string, empire: string, traits: Partial<Character['traits'] & object> = {}): Character => ({ id: id as never, name: id, culture: 'English', sex: 'f', empire: empire as never, body: { kind: 'world', world: 'w' as WorldId }, purse: 0, debt: null, traits: { greed: 0.5, caution: 0.5, openness: 0.5, pride: 0.5, loyalty: 0.5, ...traits } })

describe('traits', () => {
  it('are rolled on a curve and read as words at the extremes', () => {
    const rng = createRng(3)
    const t = rollTraits(rng)
    for (const v of Object.values(t)) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
    }
    expect(remarkable({ greed: 0.9, caution: 0.1, openness: 0.5, pride: 0.5, loyalty: 0.5 }).sort()).toEqual(['bold', 'grasping'])
    expect(remarkable({ greed: 0.5, caution: 0.5, openness: 0.5, pride: 0.5, loyalty: 0.5 })).toEqual([])
  })

  it('an open-handed captain tells more than a close-mouthed one; a friend is told what a stranger is not', () => {
    const state = newGame(111)
    const asker = person('asker', 'e-castellar')
    state.characters[asker.id] = asker
    const open = person('open', 'e-castellar', { openness: 0.9 })
    const shut = person('shut', 'e-castellar', { openness: 0.1 })
    state.characters[open.id] = open
    state.characters[shut.id] = shut
    expect(willingness(open, asker, state)).toBeGreaterThan(willingness(shut, asker, state))
    const w0 = willingness(open, asker, state)
    deal(state, open.id, asker.id, 2, 'old friends')
    expect(willingness(open, asker, state)).toBeGreaterThan(w0)
  })

  it('a careful captain strikes where a bold one fights', () => {
    const state = newGame(112)
    const at = Object.keys(state.worlds)[0] as WorldId
    const mk = (id: string, type: 'corvette' | 'free_trader', caution: number) => {
      const c = person(id, state.worlds[at].empire, { caution })
      c.body = { kind: 'aboard', ship: `s-${id}` as ShipId }
      state.characters[c.id] = c
      const ship = newShip(createRng(1), `s-${id}` as ShipId, type, state.worlds[at].empire, { kind: 'personal', character: c.id }, at, new Set(), c.id)
      state.ships[ship.id] = ship
      return ship
    }
    const hunter = mk('hunter', 'corvette', 0.5)
    const careful = mk('careful', 'free_trader', 0.95)
    const bold = mk('bold', 'free_trader', 0.05)
    // Three guns to one: at two-to-one a careful captain strikes; a bold one wants four-to-one before she does.
    const e1 = beginEncounter(state, hunter, careful, at)
    e1.round = 1
    expect(npcChoice(state, e1)).toBe('strike')
    const e2 = beginEncounter(state, hunter, bold, at)
    e2.round = 1
    expect(npcChoice(state, e2)).toBe('fight')
  })
})

describe('relationships', () => {
  it('start from what people are to each other, move with dealings, and a proud person holds a slight longer', () => {
    const state = newGame(113)
    const a = person('a', 'e-castellar', { pride: 0.9 })
    const b = person('b', 'e-castellar', { pride: 0.1 })
    const c = person('c', 'e-vauclair')
    for (const x of [a, b, c]) state.characters[x.id] = x
    expect(relation(state, a.id, b.id).regard).toBeGreaterThan(relation(state, a.id, c.id).regard)
    deal(state, a.id, c.id, -1, 'slighted')
    deal(state, b.id, c.id, -1, 'slighted')
    expect(regardOf(state, a.id, c.id)).toBeLessThan(regardOf(state, b.id, c.id))
    expect(standingWord(-2.5)).toBe('enemy')
    expect(standingWord(-3)).toBe('sworn enemy')
    expect(standingWord(2.5)).toBe('friend')
    expect(standingWord(3)).toBe('fast friend')
    expect(standingWord(0.5)).toBe('warm')
    expect(standingWord(-0.5)).toBe('cool')
  })

  it('being robbed makes an enemy; telling makes a friend of sorts; an undercut is remembered', () => {
    const state = newGame(114)
    const me = state.characters[PLAYER]
    const here = characterLocation(state, PLAYER) as WorldId
    // Robbed.
    const sid = 'so' as ShipId
    const cid = 'co' as CharacterId
    state.ships[sid] = newShip(createRng(1), sid, 'corvette', state.worlds[here].empire, { kind: 'personal', character: cid }, here, new Set(), cid)
    state.characters[cid] = { ...person('Red', state.worlds[here].empire), id: cid, name: 'Red', body: { kind: 'aboard', ship: sid }, outlaw: true }
    const e = beginEncounter(state, state.ships[sid], playerShip(state)!, here)
    resolveRound(state, e, 'strike')
    settle(state, e)
    expect(regardOf(state, PLAYER, cid)).toBeLessThanOrEqual(-2)
    expect(buildPlayerView(state).book.find((p) => p.id === cid)?.standing).toBe('enemy')
    void me
  })

  it('the player notices who undercut them, and the Book keeps the line', () => {
    const state = newGame(115)
    const here = characterLocation(state, PLAYER) as WorldId
    const port = state.worlds[here]
    const good = (Object.keys(port.market) as (keyof typeof port.market)[]).find((g) => port.market[g].stock >= 30)!
    buyGoods(state, good, 20)
    // Someone sold the same good here this week, and the price is now under what we paid.
    const rival = person('rival', port.empire)
    state.characters[rival.id] = rival
    port.register.push({ week: state.week, ship: 's-r' as ShipId, shipName: 'Rook', type: 'free_trader', empire: port.empire, captain: rival.id, captainName: 'rival', from: null, to: null, sold: [{ good, tons: 40, price: 1 }], bought: [] })
    port.market[good].stock += 400
    port.market[good].price = 1
    sellGoods(state, good, 20)
    expect(regardOf(state, PLAYER, rival.id)).toBeLessThan(0)
    const page = buildPlayerView(state).book.find((p) => p.id === rival.id)!
    expect(page.notes.some((n) => /undercut/.test(n))).toBe(true)
  })

  it('asking at the bar moves regard both ways and the Book grows', () => {
    const state = newGame(116)
    let asked = 0
    for (let i = 0; i < 30 && asked === 0; i++) {
      advanceWeek(state)
      const at = characterLocation(state, PLAYER)
      if (at === null) continue
      for (const s of Object.values(state.ships)) {
        if (!s.captain || s.captain === PLAYER || s.duty || characterLocation(state, s.captain) !== at) continue
        const a = askCaptain(state, s.captain)
        if (a === 'told' || a === 'refused') {
          asked++
          expect(state.relations[`${PLAYER}|${s.captain}`]?.dealings).toBeGreaterThan(0)
        }
      }
    }
    expect(asked).toBeGreaterThan(0)
    expect(buildPlayerView(state).book.length).toBeGreaterThan(0)
    void sail
  })
})

describe('talk of friends and enemies', () => {
  it('a teller lets on their ties, the hearer makes something of a friend\'s enemy, and the Book shows who said so', () => {
    const state = newGame(117)
    const here = characterLocation(state, PLAYER) as WorldId
    const teller = person('teller', state.worlds[here].empire, { openness: 1 })
    const foe = person('foe', state.worlds[here].empire)
    const pal = person('pal', state.worlds[here].empire)
    for (const x of [teller, foe, pal]) state.characters[x.id] = x
    deal(state, teller.id, foe.id, -3, 'robbed me')
    deal(state, teller.id, pal.id, 3, 'saved me')
    // The player counts the teller a friend already.
    deal(state, PLAYER, teller.id, 2, 'old friends')
    state.asked[teller.id] = { week: -1, roll: 0, told: false }
    const n = tellTies(state, teller.id, PLAYER)
    expect(n).toBe(2)
    expect(regardOf(state, PLAYER, foe.id)).toBeLessThan(0)
    expect(regardOf(state, PLAYER, pal.id)).toBeGreaterThan(0)
    const page = buildPlayerView(state).book.find((p) => p.id === teller.id)!
    expect(page.enemies.map((e) => e.name)).toContain('foe')
    expect(page.friends.map((e) => e.name)).toContain('pal')
    expect(page.enemies[0].from).toBe('teller')
  })
})
