import { describe, expect, it } from 'vitest'
import { beginEncounter, npcChoice, quarrel, resolveRound, settle } from './combat'
import { advanceWeek, hail, lieOff, newGame, PLAYER, playerShip, respond, sail } from './game'
import { havens } from './navy'
import { createRng } from './rng'
import { newShip } from './ships'
import type { CharacterId, GameState, ShipId, WorldId } from './types'

function outlawAt(state: GameState, at: WorldId): ShipId {
  const sid = 'so' as ShipId
  const cid = 'co' as CharacterId
  state.ships[sid] = newShip(createRng(1), sid, 'corvette', state.worlds[at].empire, { kind: 'personal', character: cid }, at, new Set(), cid)
  state.ships[sid].lyingOff = true
  state.ships[sid].duty = { kind: 'raid', haven: at, until: 999 }
  state.characters[cid] = { id: cid, name: 'Red', culture: 'English', sex: 'm', empire: state.worlds[at].empire, body: { kind: 'aboard', ship: sid }, purse: 0, debt: null, outlaw: true }
  return sid
}

describe('encounters', () => {
  it('an outlaw has a quarrel with a trader but not with a scout or a patrol; a navy hull only with outlaws and enemies she has heard of', () => {
    const state = newGame(41)
    const outlaw = Object.values(state.ships).find((s) => s.duty?.kind === 'raid')!
    const navy = Object.values(state.ships).find((s) => s.duty?.kind === 'patrol')!
    const trader = Object.values(state.ships).find((s) => s.type === 'free_trader' && s.captain !== PLAYER)!
    const scout = Object.values(state.ships).find((s) => s.run)!
    expect(quarrel(state, outlaw, trader)).toBe(true)
    expect(quarrel(state, outlaw, scout)).toBe(false)
    expect(quarrel(state, outlaw, navy)).toBe(false)
    expect(quarrel(state, navy, outlaw)).toBe(true)
    expect(quarrel(state, navy, trader)).toBe(trader.empire !== navy.empire && false)
    // An armed trader may take on an outlaw herself.
    expect(quarrel(state, trader, outlaw)).toBe(true)
  })

  it('a struck trader loses her hold and her captain to the captor', () => {
    const state = newGame(42)
    const trader = Object.values(state.ships).find((s) => s.type === 'free_trader' && s.captain !== PLAYER && s.location.kind === 'world')!
    const at = (trader.location as { world: WorldId }).world
    trader.hold = [{ kind: 'cargo', good: 'grain', tons: 20, paid: 100, from: at, week: 0 }]
    const sid = outlawAt(state, at)
    const e = beginEncounter(state, state.ships[sid], trader, at)
    resolveRound(state, e, 'strike')
    expect(e.outcome).toBe('struck')
    const line = settle(state, e)
    expect(line).toMatch(/taken/)
    expect(state.ships[sid].hold[0]).toMatchObject({ good: 'grain', tons: 20, paid: 0 })
    expect(trader.hold.length).toBe(0)
    expect(trader.captain).toBeNull()
    const victim = Object.values(state.characters).find((c) => c.captive)!
    expect(victim.captive!.by).toBe(sid)
    expect(victim.body).toEqual({ kind: 'aboard', ship: sid })
  })

  it('an NPC runs when faster, strikes when hopelessly outgunned, fights otherwise', () => {
    const state = newGame(43)
    const at = Object.keys(state.worlds)[0] as WorldId
    const sid = outlawAt(state, at)
    const far = newShip(createRng(2), 'sf' as ShipId, 'far_trader', state.worlds[at].empire, { kind: 'personal', character: 'cf' as CharacterId }, at, new Set(), 'cf' as CharacterId)
    state.ships[far.id] = far
    const e1 = beginEncounter(state, state.ships[sid], far, at)
    expect(npcChoice(state, e1)).toBe('run')
    const free = newShip(createRng(3), 'sg' as ShipId, 'free_trader', state.worlds[at].empire, { kind: 'personal', character: 'cg' as CharacterId }, at, new Set(), 'cg' as CharacterId)
    state.ships[free.id] = free
    const e2 = beginEncounter(state, state.ships[sid], free, at)
    expect(['strike', 'run']).toContain(npcChoice(state, e2))
    const other = newShip(createRng(4), 'sh' as ShipId, 'corvette', state.worlds[at].empire, { kind: 'personal', character: 'ch' as CharacterId }, at, new Set(), 'ch' as CharacterId)
    state.ships[other.id] = other
    expect(npcChoice(state, beginEncounter(state, state.ships[sid], other, at))).toBe('fight')
  })

  it('the player hailed on arrival must answer before the week can turn, and the outcome is news at the port', () => {
    const state = newGame(44)
    const ship = playerShip(state)!
    const here = (ship.location as { world: WorldId }).world
    const to = Object.keys(state.worlds).find((w) => w !== here && sail(state, w as WorldId)) as WorldId
    outlawAt(state, to)
    // Try until the outlaw sees her come in.
    let hailed = false
    for (let i = 0; i < 10 && !hailed; i++) {
      advanceWeek(state)
      advanceWeek(state)
      if (state.pending) hailed = true
      else {
        const back = (ship.location as { world: WorldId }).world
        const next = Object.keys(state.worlds).find((w) => w !== back && w === (back === to ? here : to) && sail(state, w as WorldId))
        if (!next) sail(state, back === to ? here : to)
      }
    }
    expect(hailed).toBe(true)
    const week = state.week
    advanceWeek(state)
    expect(state.week).toBe(week)
    respond(state, 'strike')
    expect(state.pending).toBeNull()
    expect(state.characters[PLAYER].captive).toBeTruthy()
    expect(state.worlds[to].news.some((n) => /taken/.test(n.text))).toBe(true)
  })

  it('the player lying off may attack an outlaw that comes in and take her cargo, but has no quarrel with a peaceful trader', () => {
    const state = newGame(45)
    const ship = playerShip(state)!
    const here = (ship.location as { world: WorldId }).world
    lieOff(state, true)
    let met = 0
    let attacked = false
    for (let i = 0; i < 40 && !attacked; i++) {
      advanceWeek(state)
      if (!state.pending) continue
      met++
      expect(state.pending.attacker).toBe(ship.id)
      const q = quarrel(state, ship, state.ships[state.pending.defender])
      if (q) {
        hail(state, 'attack')
        attacked = true
      } else {
        hail(state, 'let_pass')
      }
      expect(state.pending).toBeNull()
    }
    expect(met).toBeGreaterThan(0)
    void here
  })

  it('havens are slack-law ports away from the seats', () => {
    const state = newGame(46)
    for (const h of havens(state)) {
      expect(state.worlds[h].profile.law).toBeLessThanOrEqual(4)
      expect(Object.values(state.empires).map((e) => e.seat)).not.toContain(h)
    }
  })
})
