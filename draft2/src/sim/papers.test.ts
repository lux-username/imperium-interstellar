import { describe, expect, it } from 'vitest'
import { tellTies } from './agents'
import { beginEncounter, resolveRound, settle } from './combat'
import { advanceWeek, buyPrize, claimPrizeMoney, consultBook, GUILD_FEE, joinGuild, MARQUE_FEE, newGame, orderHull, payGuildDues, PLAYER, playerShip, prizeMoneyOwed, prizesOffered, takeDelivery, takeMarque, yardOffers } from './game'
import { opportunity } from './imperial'
import { esteemOf, impressed, relation } from './people'
import { createRng } from './rng'
import { BUILD_WEEKS, newShip } from './ships'
import { stanceKey, stancePair, type CharacterId, type GameState, type ShipId, type WorldId } from './types'

/** Put the player at a world, with a purse. */
function playerAt(state: GameState, at: WorldId, purse: number): void {
  const me = state.characters[PLAYER]
  const ship = playerShip(state)!
  ship.location = { kind: 'world', world: at }
  ship.docked = state.week
  me.purse = purse
}

describe('papers: the yard, the court, the letter of marque and the guild ticket', () => {
  it('a hull ordered at an A port is built in the yard\'s time, warships only under a letter of marque; delivery takes the old hull in part exchange', () => {
    const state = newGame(201)
    const me = state.characters[PLAYER]
    const seat = state.empires[me.empire].seat
    const yardWorld = (Object.keys(state.worlds).sort() as WorldId[]).find((w) => state.worlds[w].profile.starport === 'A' && state.worlds[w].empire === me.empire) ?? seat
    state.worlds[yardWorld].profile.starport = 'A'
    playerAt(state, yardWorld, 400000)
    const offers = yardOffers(state)
    expect(offers.find((o) => o.type === 'armed_trader')?.allowed).toBe(true)
    expect(offers.find((o) => o.type === 'patrol_boat')?.allowed).toBe(false)
    expect(orderHull(state, 'patrol_boat')).toBe(false)
    expect(orderHull(state, 'armed_trader')).toBe(true)
    expect(me.hullOrder).toEqual({ type: 'armed_trader', at: yardWorld, ready: state.week + BUILD_WEEKS.armed_trader })
    expect(orderHull(state, 'free_trader')).toBe(false) // one at a time
    expect(takeDelivery(state)).toBe(false) // not ready
    state.week = me.hullOrder!.ready
    const old = playerShip(state)!
    const purse = me.purse
    expect(takeDelivery(state)).toBe(true)
    expect(playerShip(state)!.type).toBe('armed_trader')
    expect(state.ships[old.id]).toBeUndefined()
    expect(me.purse).toBe(purse + 30000)
    expect(me.hullOrder).toBeNull()
  })

  it('a letter of marque is sold at the own seat to a clean record; under it a capture of an enemy at war is a lawful prize, the court owes a third, and warships may be bought', () => {
    const state = newGame(202)
    const me = state.characters[PLAYER]
    const e = state.empires[me.empire]
    playerAt(state, e.seat, 50000)
    expect(takeMarque(state)).toBe(true)
    expect(me.purse).toBe(50000 - MARQUE_FEE)
    expect(me.marque?.empire).toBe(me.empire)
    expect(takeMarque(state)).toBe(false)
    // An enemy at war, met at the seat.
    const other = Object.keys(state.empires).find((x) => x !== me.empire)!
    const key = stanceKey(me.empire, other as never)
    state.stances[key] = { stance: 'war', since: state.week, until: state.week + 100 }
    state.worlds[e.seat].board[key] = { pair: stancePair(key), stance: 'war', week: state.week }
    const vid = `s-v-${state.nextId++}` as ShipId
    const cid = `c-v-${state.nextId++}` as CharacterId
    state.ships[vid] = newShip(createRng(7), vid, 'free_trader', other as never, { kind: 'personal', character: cid }, e.seat, new Set(), cid)
    state.characters[cid] = { id: cid, name: 'Diego', culture: 'Spanish', sex: 'm', empire: other as never, body: { kind: 'aboard', ship: vid }, purse: 1000, debt: null }
    const mine = playerShip(state)!
    mine.type = 'corvette'
    const enc = beginEncounter(state, mine, state.ships[vid], e.seat)
    resolveRound(state, enc, 'strike')
    const line = settle(state, enc)
    expect(line).toMatch(/prize/)
    expect(state.ships[vid].duty).toEqual({ kind: 'prize', to: e.seat, taker: me.empire, captor: PLAYER })
    expect(me.outlaw).toBeFalsy()
    advanceWeek(state)
    expect(prizeMoneyOwed(state)).toBeGreaterThan(0)
    const owed = prizeMoneyOwed(state)
    const before = me.purse
    expect(claimPrizeMoney(state)).toBe(owed)
    expect(me.purse).toBe(before + owed)
    const offered = prizesOffered(state)
    expect(offered.some((p) => p.ship === vid)).toBe(true)
    me.purse = 500000
    expect(buyPrize(state, vid)).toBe(true)
    expect(playerShip(state)!.id).toBe(vid)
    expect(state.ships[vid].owner).toEqual({ kind: 'personal', character: PLAYER })
  })

  it('the guild ticket is sold at the own seat; dues are set aside and paid there; the book is consulted; a year unpaid and the player is struck off like anyone', () => {
    const state = newGame(203)
    const me = state.characters[PLAYER]
    const g = state.guilds[me.empire]
    playerAt(state, g.seat, 20000)
    expect(joinGuild(state)).toBe(true)
    expect(me.guild).toBe(me.empire)
    expect(me.purse).toBe(20000 - GUILD_FEE)
    me.dues = 400
    expect(payGuildDues(state)).toBe(400)
    expect(me.dues).toBe(0)
    expect(consultBook(state)).toBeGreaterThanOrEqual(0)
    me.duesPaid = state.week - 60
    playerAt(state, g.seat, 5000)
    advanceWeek(state)
    expect(me.guild).toBeUndefined()
    expect(state.worlds[g.seat].news.some((n) => /struck .* off/.test(n.text))).toBe(true)
  })

  it('a friend\'s esteem of a third captain spreads in talk, at half strength', () => {
    const state = newGame(204)
    const ids = Object.keys(state.characters).sort().filter((c) => c !== PLAYER) as CharacterId[]
    const [a, b, c] = ids
    relation(state, b, a).regard = 2
    impressed(state, a, c, 4)
    tellTies(state, a, b)
    expect(esteemOf(state, b, c)).toBe(2)
    tellTies(state, a, b)
    expect(esteemOf(state, b, c)).toBe(2)
  })

  it('captains come in from the core, oftener when the seat sees room for them', () => {
    const state = newGame(205)
    for (const e of Object.values(state.empires)) expect(opportunity(state, e)).toBeGreaterThanOrEqual(0)
    let arrived = 0
    for (let w = 0; w < 156; w++) {
      advanceWeek(state)
      for (const wd of Object.values(state.worlds)) if (wd.news.some((n) => n.week === state.week && /in from the core/.test(n.text))) arrived++
    }
    expect(arrived).toBeGreaterThan(0)
    expect(Object.keys(state.characters).some((c) => c.startsWith('c-core-'))).toBe(true)
  })

  it('empires are at war with someone most of the time, and sometimes at peace with everyone', () => {
    const state = newGame(206)
    let atWar = 0
    let allPeace = 0
    const weeks = 312
    for (let w = 0; w < weeks; w++) {
      advanceWeek(state)
      const warKeys = Object.keys(state.stances).filter((k) => state.stances[k].stance === 'war')
      for (const e of Object.keys(state.empires)) if (warKeys.some((k) => k.includes(e))) atWar++
      if (warKeys.length === 0) allPeace++
    }
    expect(atWar / (weeks * 3)).toBeGreaterThan(0.55)
    expect(allPeace).toBeGreaterThan(0)
  }, 30000)
})
