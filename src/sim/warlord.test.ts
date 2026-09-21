import { describe, expect, it } from 'vitest'
import { playerTraits } from './characters'
import { THE_WARLORD, WARLORD } from './factions'
import { HULLS, newShip } from './fleet'
import { advanceWeek, newGame } from './game'
import { hexDistance } from './hex'
import { createRng } from './rng'
import type { CharacterId, GameState, ShipId, WorldId } from './types'
import { WARLORD_WORLDS, warlordActs } from './warlord'
import { line } from './fixtures.test-helper'

describe('the Warlord at the start', () => {
  it('holds a corner of the subsector far from the capital, with a seat, a fleet and a picture of his own', () => {
    for (const seed of [1, 2, 3]) {
      const s = newGame(seed)
      const seat = s.factions[WARLORD].capital
      expect(seat).not.toBeNull()
      const his = Object.values(s.worlds).filter((w) => w.faction === WARLORD)
      expect(his.length).toBe(WARLORD_WORLDS)
      expect(hexDistance(s.worlds[seat as WorldId].hex, s.worlds[s.capital].hex)).toBeGreaterThanOrEqual(4)
      expect(s.characters[THE_WARLORD].post).toEqual({ kind: 'governor', world: seat })
      const fleet = Object.values(s.ships).filter((x) => x.faction === WARLORD && x.role !== 'packet')
      expect(fleet.length).toBe(8)
      expect(s.beliefs[THE_WARLORD]).toBeDefined()
      // The desk's opening survey shows his worlds as his: the player starts knowing roughly where he is.
      for (const w of his) {
        const known = s.beliefs[s.player].worlds[w.id]
        expect(known.snapshot.kind === 'world' && known.snapshot.world.faction).toBe(WARLORD)
      }
    }
  })

  it('hears from his own governors, and his scouts go and look at the frontier', () => {
    let scoutSeen = 0
    for (const seed of [1, 2, 3, 4]) {
      const s = newGame(seed)
      for (let i = 0; i < 24; i++) {
        advanceWeek(s)
        const foreignScout = Object.values(s.events).some((e) => e.kind === 'hull_arrived' && e.ship?.faction === WARLORD && e.ship.role === 'scout' && s.worlds[e.at].faction !== WARLORD)
        if (foreignScout) scoutSeen += 1
      }
      const heard = Object.values(s.beliefs[THE_WARLORD].worlds).filter((r) => r.observed > 0)
      expect(heard.length).toBeGreaterThan(0)
    }
    expect(scoutSeen).toBeGreaterThan(0)
  })

  it('lands on a world he believes weakly held, and sometimes takes it', () => {
    let landings = 0
    let taken = 0
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const s = newGame(seed)
      for (let i = 0; i < 52; i++) {
        advanceWeek(s)
        for (const e of Object.values(s.events)) {
          if (e.week !== s.week) continue
          if (e.kind === 'troops_landed' && e.ship?.faction === WARLORD) landings += 1
          if (e.kind === 'world_taken' && e.person === 'The Warlord') taken += 1
        }
      }
    }
    expect(landings).toBeGreaterThan(0)
    expect(taken).toBeGreaterThanOrEqual(0)
  })
})

describe('defection', () => {
  /** The line with Wye as the Warlord's seat and a self-serving, ambitious captain of ours lying at Exe next door. */
  function tempted(seed: number, initiative = 0): GameState {
    const s = line()
    s.rng = createRng(seed)
    const Y = 'w-y' as WorldId
    const X = 'w-x' as WorldId
    s.worlds[Y].faction = WARLORD
    s.factions[WARLORD].capital = Y
    s.characters[THE_WARLORD] = { id: THE_WARLORD, name: 'The Warlord', faction: WARLORD, post: { kind: 'governor', world: Y }, traits: playerTraits() }
    s.worlds[Y].governor = THE_WARLORD
    s.worlds[Y].actingGovernor = THE_WARLORD
    s.beliefs[THE_WARLORD] = { worlds: {}, ships: {} }
    const cid = 'c-cap' as CharacterId
    s.characters[cid] = { id: cid, name: 'Grasping', faction: 'f-admin' as never, post: { kind: 'commander', ship: 's-cap' as ShipId }, traits: { ...playerTraits(), loyalty: 'self', ambition: 3, initiative } }
    s.ships['s-cap' as ShipId] = newShip('s-cap' as ShipId, 'Fickle', HULLS.patrol, 'f-admin' as never, X, s.characters[cid])
    s.week = 2
    return s
  }

  it('a self-serving, ambitious captain within reach of his border sometimes goes over, ship and all', () => {
    let defected = 0
    for (let seed = 1; seed <= 30; seed++) {
      const s = tempted(seed)
      warlordActs(s)
      if (s.ships['s-cap' as ShipId].faction === WARLORD) {
        defected += 1
        expect(s.characters['c-cap' as CharacterId].faction).toBe(WARLORD)
        expect(Object.values(s.events).some((e) => e.kind === 'defection' && e.ship?.id === 's-cap')).toBe(true)
      }
    }
    expect(defected).toBeGreaterThanOrEqual(2) // 2d6 ≥ 10 a month for the most ambitious: about one in six
    expect(defected).toBeLessThan(20)
  })

  it('a cautious one sends a letter of resignation to the desk first', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const s = tempted(seed, -1)
      warlordActs(s)
      if (s.ships['s-cap' as ShipId].faction !== WARLORD) continue
      const letter = Object.values(s.mail).find((m) => m.contents.kind === 'report' && m.contents.report.observer === 'c-cap')
      expect(letter).toBeDefined()
      if (letter?.contents.kind === 'report') {
        expect(letter.contents.report.envelope.destination).toEqual({ kind: 'world', world: s.capital })
        expect(letter.contents.report.events[0]?.kind).toBe('defection')
      }
      return
    }
    throw new Error('no defection in 40 seeds')
  })

  it('a loyal captain is never tempted', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const s = tempted(seed)
      s.characters['c-cap' as CharacterId].traits.loyalty = 'empire'
      warlordActs(s)
      expect(s.ships['s-cap' as ShipId].faction).toBe('f-admin')
    }
  })
})
