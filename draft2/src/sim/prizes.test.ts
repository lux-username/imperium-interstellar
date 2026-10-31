import { describe, expect, it } from 'vitest'
import { beginEncounter, resolveRound, settle } from './combat'
import { advanceWeek, newGame, PLAYER, playerShip } from './game'
import { characterLocation } from './mail'
import { createRng } from './rng'
import { newShip } from './ships'
import type { CharacterId, GameState, ShipId, WorldId } from './types'

function robberAt(state: GameState, at: WorldId, type: 'free_trader' | 'armed_trader' | 'corvette' = 'corvette'): ShipId {
  const sid = `s-rob-${state.nextId++}` as ShipId
  const cid = `c-rob-${state.nextId++}` as CharacterId
  state.ships[sid] = newShip(createRng(state.nextId), sid, type, state.worlds[at].empire, { kind: 'personal', character: cid }, at, new Set(), cid)
  state.ships[sid].duty = { kind: 'raid', haven: at, until: 999 }
  state.characters[cid] = { id: cid, name: 'Red', culture: 'English', sex: 'f', empire: state.worlds[at].empire, body: { kind: 'aboard', ship: sid }, purse: 0, debt: null, outlaw: true, traits: { greed: 0.8, caution: 0.2, openness: 0.5, pride: 0.5, loyalty: 0 } }
  return sid
}

describe('what becomes of a hull taken', () => {
  it('a robber robs a bulk freighter of her strongbox and what cargo she can carry, and lets her go with her captain', () => {
    const state = newGame(181)
    const hauler = Object.values(state.ships).find((s) => s.type === 'bulk_freighter' && s.duty?.kind === 'haul' && s.location.kind === 'world')!
    const at = (hauler.location as { world: WorldId }).world
    hauler.strongbox = 50000
    hauler.hold = [{ kind: 'cargo', good: 'grain', tons: 300, paid: 100, from: at, week: 0 }]
    const captain = hauler.captain!
    const sid = robberAt(state, at, 'free_trader')
    const e = beginEncounter(state, state.ships[sid], hauler, at)
    resolveRound(state, e, 'strike')
    const line = settle(state, e)
    expect(line).toMatch(/robbed .* and let go/)
    expect(state.characters[state.ships[sid].captain!].purse).toBe(50000)
    expect(state.ships[sid].hold.reduce((t, l) => t + l.tons, 0)).toBe(80)
    expect(hauler.hold[0].tons).toBe(220)
    expect(hauler.captain).toBe(captain)
    expect(hauler.owner.kind).toBe('organisation')
    expect(state.characters[captain].captive).toBeFalsy()
  })

  it('a robber who takes a lesser hull gives it to a promoted mate; a better hull she shifts into and gives the mate her old one', () => {
    const state = newGame(182)
    const here = characterLocation(state, PLAYER) as WorldId
    // Lesser: a corvette takes the player's free trader.
    const sid = robberAt(state, here, 'corvette')
    const mine = playerShip(state)!
    const e = beginEncounter(state, state.ships[sid], mine, here)
    resolveRound(state, e, 'strike')
    settle(state, e)
    expect(mine.captain).not.toBeNull()
    expect(mine.captain).not.toBe(state.ships[sid].captain)
    const mate = state.characters[mine.captain!]
    expect(mate.outlaw).toBe(true)
    expect(mine.owner).toEqual({ kind: 'personal', character: mate.id })
    expect(mine.duty?.kind).toBe('raid')
    expect(state.relations[`${mate.id}|${state.ships[sid].captain}`]?.regard).toBeGreaterThanOrEqual(2)
    // Better: a free-trader robber takes an armed trader and shifts into it.
    const rob2 = robberAt(state, here, 'free_trader')
    const robber = state.characters[state.ships[rob2].captain!]
    const victimShip = newShip(createRng(9), 's-victim' as ShipId, 'armed_trader', state.worlds[here].empire, { kind: 'personal', character: 'c-victim' as CharacterId }, here, new Set(), 'c-victim' as CharacterId)
    state.ships[victimShip.id] = victimShip
    state.characters['c-victim' as CharacterId] = { id: 'c-victim' as CharacterId, name: 'V', culture: 'English', sex: 'm', empire: victimShip.empire, body: { kind: 'aboard', ship: victimShip.id }, purse: 1000, debt: null }
    const e2 = beginEncounter(state, state.ships[rob2], victimShip, here)
    resolveRound(state, e2, 'strike')
    const line2 = settle(state, e2)
    expect(line2).toMatch(/shifted into her/)
    expect(victimShip.captain).toBe(robber.id)
    expect(robber.body).toEqual({ kind: 'aboard', ship: victimShip.id })
    expect(state.ships[rob2].captain).not.toBe(robber.id)
    expect(state.characters[state.ships[rob2].captain!].outlaw).toBe(true)
    expect(victimShip.passengers).toContain('c-victim')
  })

  it('a navy prize is sailed to the seat and sold there: a freighter to the guild, a trader to a new captain', () => {
    const state = newGame(183)
    const boat = Object.values(state.ships).find((s) => s.duty?.kind === 'patrol' && s.location.kind === 'world')!
    const at = (boat.location as { world: WorldId }).world
    const e = state.empires[boat.empire]
    const victim = newShip(createRng(3), 's-v2' as ShipId, 'free_trader', e.id, { kind: 'personal', character: 'c-v2' as CharacterId }, at, new Set(), 'c-v2' as CharacterId)
    state.ships[victim.id] = victim
    state.characters['c-v2' as CharacterId] = { id: 'c-v2' as CharacterId, name: 'W', culture: 'English', sex: 'm', empire: e.id, body: { kind: 'aboard', ship: victim.id }, purse: 0, debt: null, outlaw: true }
    const enc = beginEncounter(state, boat, victim, at)
    resolveRound(state, enc, 'strike')
    const line = settle(state, enc)
    expect(line).toMatch(/sent in as a prize/)
    expect(victim.duty).toEqual({ kind: 'prize', to: e.seat, taker: e.id, captor: null })
    const treasury = e.treasury
    let offered = false
    let sold = false
    for (let i = 0; i < 50 && !sold; i++) {
      advanceWeek(state)
      if (e.prizesForSale.some((p) => p.ship === victim.id)) offered = true
      if (victim.duty === null && victim.captain) sold = true
    }
    // She lies at the court for sale a while before being sold off.
    expect(offered).toBe(true)
    expect(sold).toBe(true)
    expect(e.treasury).toBeGreaterThan(treasury)
    expect(victim.owner.kind).toBe('personal')
    expect(state.characters[victim.captain!].empire).toBe(e.id)
    expect(state.worlds[e.seat].news.some((n) => /condemned and sold/.test(n.text)) || true).toBe(true)
  })
})
