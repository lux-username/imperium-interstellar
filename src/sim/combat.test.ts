import { describe, expect, it } from 'vitest'
import { fightAtWorlds } from './combat'
import { advanceWeek, newGame, requestReport } from './game'
import { governorLetter } from './governors'
import { PIRATES, WARLORD } from './factions'
import { HULLS, newShip } from './fleet'
import { playerTraits } from './characters'
import { STARTING_PIRATES, isHaven, raided, seizePirates, spawnPirate } from './pirates'
import { createRng } from './rng'
import type { CharacterId, GameState, ShipId, WorldId } from './types'
import { line } from './fixtures.test-helper'

const C = 'w-c' as WorldId
const X = 'w-x' as WorldId
const Y = 'w-y' as WorldId

/** A raider lying off `at`, on a raiding patrol, knowing Y as her haven. */
function raider(s: GameState, at: WorldId, id = 's-raider' as ShipId): void {
  const cid = `c-${id}` as CharacterId
  s.characters[cid] = { id: cid, name: 'Raider', faction: PIRATES, post: { kind: 'commander', ship: id }, traits: { ...playerTraits(), loyalty: 'self' } }
  s.ships[id] = newShip(id, 'Black Gull', HULLS.raider, PIRATES, at, s.characters[cid])
  s.ships[id].havens = [Y]
  s.ships[id].order = { kind: 'patrol', world: at, weeks: 4, posture: 'favourable', then: { kind: 'world', world: Y }, began: 0 }
}

/** A warship of Government House's at `at`. */
function warship(s: GameState, at: WorldId, posture: 'never' | 'favourable' | 'always' = 'favourable', id = 's-war' as ShipId): void {
  const cid = `c-${id}` as CharacterId
  s.characters[cid] = { id: cid, name: 'Captain', faction: s.characters[s.player].faction, post: { kind: 'commander', ship: id }, traits: playerTraits() }
  s.ships[id] = newShip(id, 'Vigilant', HULLS.patrol, s.characters[s.player].faction, at, s.characters[cid])
  s.ships[id].standing = { rally: C, onContact: posture }
}

describe('a raider off a port', () => {
  it('robs the packet that comes in, and the mail is lost; the packet herself carries on', () => {
    const s = line()
    // P1 is in jump from C to X, arriving week 1. Put a letter aboard her.
    const packet = s.ships['s-cx' as ShipId]
    expect(packet.location.kind).toBe('transit')
    const mail = requestReport(s, X, 'c-x' as CharacterId)
    mail.status = { kind: 'aboard', ship: packet.id }
    packet.mailbag.push(mail.id)
    s.worlds[X].profile.starport = 'A' // the packet already at the quay is safe under an A port; the one arriving is in the open
    raider(s, X)
    advanceWeek(s)
    const robbed = Object.values(s.events).find((e) => e.kind === 'ship_robbed')
    expect(robbed?.ship?.id).toBe('s-cx')
    expect(mail.status).toEqual({ kind: 'lost', week: 1 })
    // She is let go, and turns straight around with the week's new mail as if nothing had happened.
    expect(s.ships['s-cx' as ShipId]).toBeDefined()
    expect(packet.faction).toBe('f-admin')
    expect(packet.location.kind).toBe('transit')
  })

  it('leaves a packet docked at her own A port alone: she cannot be forced out from under the guns', () => {
    const s = line()
    s.worlds[X].profile.starport = 'A'
    // P2 sits in port at X (her own faction's port) until week 1.
    const packet = s.ships['s-xy' as ShipId]
    expect(packet.location).toEqual({ kind: 'world', world: X })
    raider(s, X)
    fightAtWorlds(s)
    expect(Object.values(s.events).some((e) => e.kind === 'ship_robbed' && e.ship?.id === 's-xy')).toBe(false)
  })

  it('slows the merchants, and their talk, on the lanes that touch the port', () => {
    const s = line()
    expect(raided(s, X)).toBe(false)
    raider(s, X)
    expect(raided(s, X)).toBe(true)
    expect(raided(s, Y)).toBe(false)
  })
})

describe('warship against raider', () => {
  it('a patrol craft at favourable odds engages a lone raider; over many fights raiders are hit, taken, sunk or driven off', () => {
    const outcomes = { captured: 0, destroyed: 0, fled: 0, damaged: 0, nothing: 0 }
    for (let seed = 1; seed <= 40; seed++) {
      const s = line()
      s.rng = createRng(seed)
      raider(s, X)
      warship(s, X)
      fightAtWorlds(s)
      const kinds = new Set(Object.values(s.events).map((e) => e.kind))
      if (kinds.has('ship_captured')) outcomes.captured += 1
      else if (kinds.has('ship_destroyed')) outcomes.destroyed += 1
      else if (kinds.has('ship_fled')) outcomes.fled += 1
      else if (kinds.has('ship_damaged')) outcomes.damaged += 1
      else outcomes.nothing += 1
      // Either the raider was brought to action or she got clear before it.
      expect(kinds.has('battle') || kinds.has('ship_fled')).toBe(true)
    }
    expect(outcomes.captured + outcomes.destroyed + outcomes.fled).toBeGreaterThan(10)
  })

  it('a prize is ours, her captain gone, and sails for the captor’s rendezvous under a prize crew to wait for an officer', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const s = line()
      s.rng = createRng(seed)
      raider(s, X)
      warship(s, X, 'always')
      s.ships['s-war' as ShipId].strength = 6 // make it quick
      fightAtWorlds(s)
      const prize = s.ships['s-raider' as ShipId]
      if (!prize || prize.faction === PIRATES) continue
      expect(prize.faction).toBe('f-admin')
      expect(prize.commander).toBeNull()
      expect(prize.havens).toBeNull()
      expect(s.characters['c-s-raider' as CharacterId]).toBeUndefined()
      expect(prize.order).toEqual({ kind: 'move', to: C, then: null }) // the warship's rally is the capital
      advanceWeek(s) // she sails
      expect(prize.location.kind).toBe('transit')
      advanceWeek(s) // she lands and waits
      expect(prize.location).toEqual({ kind: 'world', world: C })
      advanceWeek(s)
      expect(prize.order).toEqual({ kind: 'hold' })
      expect(prize.location).toEqual({ kind: 'world', world: C })
      return
    }
    throw new Error('no capture in 60 seeds')
  })

  it('pirates who take an armed hull make her a pirate on the spot, with their own havens', () => {
    for (let seed = 1; seed <= 80; seed++) {
      const s = line()
      s.rng = createRng(seed)
      raider(s, X)
      s.ships['s-raider' as ShipId].strength = 6
      // A lone transport of ours coming in: armed, barely.
      const cid = 'c-tr' as CharacterId
      s.characters[cid] = { id: cid, name: 'Master', faction: 'f-admin' as never, post: { kind: 'commander', ship: 's-tr' as ShipId }, traits: playerTraits() }
      s.ships['s-tr' as ShipId] = newShip('s-tr' as ShipId, 'Carrier', HULLS.transport, 'f-admin' as never, C, s.characters[cid])
      s.ships['s-tr' as ShipId].location = { kind: 'transit', from: C, to: X, arrives: 1 }
      s.ships['s-tr' as ShipId].standing.onContact = 'never'
      advanceWeek(s)
      const taken = s.ships['s-tr' as ShipId]
      if (!taken || taken.faction !== PIRATES) continue
      expect(taken.commander).not.toBeNull()
      expect(taken.commander).not.toBe(cid)
      expect(taken.havens).toEqual([Y])
      return
    }
    throw new Error('no capture in 80 seeds')
  })

  it('a captain ordered never to engage sits tight at his own port and nothing happens', () => {
    const s = line()
    raider(s, X)
    warship(s, X, 'never')
    fightAtWorlds(s)
    expect(Object.values(s.events).filter((e) => e.kind === 'battle')).toEqual([])
  })

  it('the survivors write home about it', () => {
    const s = line()
    s.rng = createRng(3)
    raider(s, X)
    warship(s, X, 'always')
    advanceWeek(s)
    const letters = Object.values(s.mail).filter((m) => m.contents.kind === 'report' && m.contents.report.observer === 'c-s-war')
    const action = letters.some((m) => m.contents.kind === 'report' && m.contents.report.events.some((e) => e.kind === 'battle'))
    // Either the captain wrote of the action, or he was lost with his ship.
    expect(action || s.ships['s-war' as ShipId] === undefined || s.ships['s-war' as ShipId].faction !== 'f-admin').toBe(true)
  })
})

describe('scouts', () => {
  /** An unnamed scout of ours landing at `at` this week. */
  function scout(s: GameState, at: WorldId): void {
    s.ships['s-sc' as ShipId] = newShip('s-sc' as ShipId, 'Kestrel', HULLS.scout, 'f-admin' as never, C, null)
    s.ships['s-sc' as ShipId].location = { kind: 'transit', from: C, to: at, arrives: 1 }
    s.ships['s-sc' as ShipId].standing = { rally: null, onContact: 'always' } // the posture is ignored: a scout never fights
    s.ships['s-sc' as ShipId].order = { kind: 'hold' }
  }

  it('are left alone by pirates, who have nothing to take from them', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const s = line()
      s.rng = createRng(seed)
      raider(s, X)
      scout(s, X)
      advanceWeek(s)
      expect(Object.values(s.events).some((e) => e.ship?.id === 's-sc' && e.kind !== 'hull_arrived')).toBe(false)
      expect(s.ships['s-sc' as ShipId].location).toEqual({ kind: 'world', world: X })
    }
  })

  it('never join an action and almost always get clear of anyone else who comes for them', () => {
    let escaped = 0
    let caught = 0
    for (let seed = 1; seed <= 30; seed++) {
      const s = line()
      s.rng = createRng(seed)
      s.worlds[X].faction = WARLORD
      warship(s, X, 'always')
      s.ships['s-war' as ShipId].faction = WARLORD
      s.characters['c-s-war' as CharacterId].faction = WARLORD
      scout(s, X)
      advanceWeek(s)
      const events = Object.values(s.events)
      expect(events.some((e) => e.kind === 'battle')).toBe(false)
      if (events.some((e) => e.kind === 'ship_fled' && e.ship?.id === 's-sc')) escaped += 1
      if (events.some((e) => e.kind === 'ship_captured' && e.ship?.id === 's-sc')) caught += 1
    }
    expect(escaped).toBeGreaterThanOrEqual(25)
    expect(escaped + caught).toBe(30)
  })

  it('at the quay of her own port she sits out an action in orbit rather than running', () => {
    const s = line()
    s.worlds[X].profile.starport = 'A'
    warship(s, X, 'always')
    raider(s, X)
    s.ships['s-sc' as ShipId] = newShip('s-sc' as ShipId, 'Kestrel', HULLS.scout, 'f-admin' as never, X, null)
    s.ships['s-sc' as ShipId].order = { kind: 'hold' }
    fightAtWorlds(s)
    expect(Object.values(s.events).some((e) => e.kind === 'battle')).toBe(true)
    expect(Object.values(s.events).some((e) => e.ship?.id === 's-sc')).toBe(false)
    expect(s.ships['s-sc' as ShipId].location).toEqual({ kind: 'world', world: X })
  })
})

describe('havens', () => {
  it('a self-serving governor with a working port makes a haven; the capital never does', () => {
    const s = line()
    expect(isHaven(s, s.worlds[X])).toBe(false)
    s.characters['c-x' as CharacterId].traits.loyalty = 'self'
    expect(isHaven(s, s.worlds[X])).toBe(true)
    s.characters[s.player].traits.loyalty = 'self'
    expect(isHaven(s, s.worlds[C])).toBe(false)
  })

  it('a pirate who puts in where she is not welcome is seized and becomes a prize of the port', () => {
    const s = line()
    s.characters['c-y' as CharacterId].traits.loyalty = 'self'
    const pirate = spawnPirate(s, s.worlds[Y])
    expect(pirate.havens).toContain(Y)
    seizePirates(s)
    expect(pirate.faction).toBe(PIRATES)
    // She flees to X, which she does not know as a haven.
    pirate.location = { kind: 'world', world: X }
    pirate.order = { kind: 'hold' }
    seizePirates(s)
    expect(pirate.faction).toBe('f-admin')
    expect(pirate.commander).toBeNull()
    expect(Object.values(s.events).some((e) => e.kind === 'pirate_seized')).toBe(true)
  })

  it('a generated game starts with havens and raiders, and within forty weeks something has happened on the lanes', () => {
    let action = 0
    for (const seed of [1, 2, 3, 4]) {
      const s = newGame(seed)
      const pirates = Object.values(s.ships).filter((x) => x.faction === PIRATES)
      expect(pirates.length).toBe(STARTING_PIRATES)
      for (const p of pirates) expect(p.havens?.length).toBeGreaterThan(0)
      let seen = false
      for (let i = 0; i < 40; i++) {
        advanceWeek(s)
        if (Object.values(s.events).some((e) => ['ship_robbed', 'battle', 'pirate_seized'].includes(e.kind))) seen = true
      }
      if (seen) action += 1
    }
    expect(action).toBeGreaterThanOrEqual(3)
  })
})

describe("the port's guns", () => {
  it('a lone raider leaves a packet docked at an A port alone: the port’s two guns make the odds even, not favourable', () => {
    const s = line()
    s.worlds[X].profile.starport = 'A'
    raider(s, X)
    fightAtWorlds(s)
    expect(Object.values(s.events).some((e) => e.kind === 'ship_robbed' || e.kind === 'battle')).toBe(false)
  })

  it('the same raider robs a packet docked at a B port, whose single gun does not make the odds even, and at a D port with none', () => {
    for (const port of ['B', 'D'] as const) {
      const s = line()
      s.worlds[X].profile.starport = port
      raider(s, X)
      fightAtWorlds(s)
      expect(Object.values(s.events).some((e) => e.kind === 'ship_robbed' && e.ship?.id === 's-xy'), port).toBe(true)
    }
  })

  it('two raiders together will go for the packet under a B port’s guns, and the port shoots back', () => {
    let attacked = 0
    let raiderHurt = 0
    for (let seed = 1; seed <= 20; seed++) {
      const s = line()
      s.rng = createRng(seed)
      raider(s, X, 's-r1' as ShipId)
      raider(s, X, 's-r2' as ShipId)
      fightAtWorlds(s)
      const kinds = Object.values(s.events).map((e) => e.kind)
      if (kinds.includes('ship_robbed') || kinds.includes('battle')) attacked += 1
      if (Object.values(s.events).some((e) => (e.kind === 'ship_damaged' || e.kind === 'ship_destroyed' || e.kind === 'ship_captured') && e.ship?.faction === PIRATES)) raiderHurt += 1
    }
    expect(attacked).toBe(20) // 4 against 2: favourable every time
    expect(raiderHurt).toBeGreaterThan(0) // and the port's guns count in the exchange
  })

  it('the record names the raiders, not the packet, and the governor says the port fought: a packet is unarmed', () => {
    const s = line()
    s.rng = createRng(3)
    raider(s, X, 's-r1' as ShipId)
    raider(s, X, 's-r2' as ShipId)
    fightAtWorlds(s)
    const battle = Object.values(s.events).find((e) => e.kind === 'battle')
    expect(battle).toBeDefined()
    expect(battle?.ship?.faction).toBe(PIRATES)
    expect(battle?.level).toBe(0) // nothing of ours with guns: only the batteries
    const events = Object.values(s.events).filter((e) => e.at === X && e.kind !== 'hull_arrived')
    const mail = governorLetter(s, s.worlds[X], events)!
    const report = mail.contents.kind === 'report' ? mail.contents.report : null
    expect(report?.subject).toMatch(/port|quay/i)
    expect(report?.subject).not.toMatch(/our forces|Victory|Defeated/)
    expect(report?.lede).toMatch(/the port's batteries|under the port's guns/)
  })

  it('a docked warship fights from under the guns rather than running', () => {
    let fled = 0
    for (let seed = 1; seed <= 20; seed++) {
      const s = line()
      s.rng = createRng(seed)
      raider(s, X, 's-r1' as ShipId)
      raider(s, X, 's-r2' as ShipId)
      raider(s, X, 's-r3' as ShipId)
      warship(s, X, 'never') // 3 + port 2 = 5 against 6: they come for her
      fightAtWorlds(s)
      if (Object.values(s.events).some((e) => e.kind === 'ship_fled' && e.ship?.id === 's-war')) fled += 1
    }
    expect(fled).toBe(0)
  })
})
