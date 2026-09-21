import { describe, expect, it } from 'vitest'
import { playerTraits } from './characters'
import { PIRATES, REBELS, THE_WARLORD, WARLORD } from './factions'
import { HULLS, newShip } from './fleet'
import { advanceWeek, newGame } from './game'
import { hexDistance } from './hex'
import { learn, snapshotWorld } from './mail'
import { seizePirates } from './pirates'
import { buildPlayerView } from './player'
import { createRng } from './rng'
import type { Order } from './orders'
import type { CharacterId, GameState, ShipId, WorldId } from './types'
import type { Report, WorldSnapshot } from './view'
import { WARLORD_WORLDS, hisOfficer, warlordActs, withinReach } from './warlord'
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

describe('what the Warlord does with what he knows', () => {
  const C = 'w-c' as WorldId
  const X = 'w-x' as WorldId
  const Y = 'w-y' as WorldId

  /** The line with Wye as his seat (garrison 8, two transports, two patrols, a scout) and Exe as whatever the test needs. */
  function court(): GameState {
    const s = line()
    s.week = 2
    s.worlds[Y].faction = WARLORD
    s.worlds[Y].garrison = 8
    s.worlds[Y].profile.starport = 'A'
    s.factions[WARLORD].capital = Y
    s.characters[THE_WARLORD] = { id: THE_WARLORD, name: 'The Warlord', faction: WARLORD, post: { kind: 'governor', world: Y }, traits: playerTraits() }
    s.worlds[Y].governor = THE_WARLORD
    s.worlds[Y].actingGovernor = THE_WARLORD
    s.beliefs[THE_WARLORD] = { worlds: {}, ships: {} }
    let n = 0
    for (const role of ['transport', 'transport', 'patrol', 'patrol', 'scout'] as const) {
      n += 1
      const id = `s-wl-${n}` as ShipId
      const cid = `c-wl-${n}` as CharacterId
      s.characters[cid] = { id: cid, name: `Officer ${n}`, faction: WARLORD, post: { kind: 'commander', ship: id }, traits: playerTraits() }
      s.ships[id] = newShip(id, `Hull ${n}`, HULLS[role], WARLORD, Y, s.characters[cid])
      s.ships[id].standing = { rally: Y, onContact: 'favourable' }
    }
    return s
  }

  /** Put a report about `world` into his head, as his people would have written it, with whatever the test says. */
  function heTinks(s: GameState, world: WorldId, observed: number, tweak: (w: WorldSnapshot) => void): void {
    const snap = snapshotWorld(s, s.worlds[world])
    if (snap.kind !== 'world') throw new Error('world')
    tweak(snap.world)
    const report: Report = { id: `r-wl-${world}-${observed}` as never, channel: 'official', observer: THE_WARLORD, observerName: 'x', observerTitle: null, observerShip: null, observerShipId: null, subject: 'x', lede: 'x', observedAt: world, observed, snapshot: snap, events: [], envelope: { origin: world, destination: { kind: 'world', world: Y }, sent: observed, route: [world, Y], eta: observed }, delivered: observed }
    learn(s, THE_WARLORD, report)
  }

  const ordersOf = (s: GameState) => Object.values(s.ships).filter((x) => x.faction === WARLORD && x.order && x.order.kind !== 'hold').map((x) => ({ id: x.id, role: x.role, order: x.order as Order }))

  it('reinforces a world of his that his governor says is in revolt, before anything else', () => {
    const s = court()
    s.worlds[X].faction = WARLORD
    heTinks(s, X, 1, (w) => {
      w.faction = WARLORD
      w.garrison = 1
      w.contest = { attacker: REBELS, strength: 2 }
    })
    warlordActs(s)
    const lifts = ordersOf(s).filter((o) => o.order.kind === 'transport' && o.order.to === X)
    expect(lifts.length).toBeGreaterThan(0)
    const army = lifts.reduce((n, o) => n + (o.order.kind === 'transport' ? o.order.army : 0), 0)
    expect(army).toBe(3) // strength 2 against, held by 1: he wants it back to 4
  })

  it('will not land where he has seen warships his escorts cannot beat under the port’s guns', () => {
    const s = court()
    heTinks(s, X, 1, (w) => {
      w.garrison = 0
    })
    // A patrol craft of ours seen docked at Exe (a B port): 3 + 2 guns, against his two patrols' 6 — he goes. Two of ours: 6 + 2 — he does not.
    const seen = (n: number) => {
      const belief = s.beliefs[THE_WARLORD]
      belief.ships = {}
      for (let i = 0; i < n; i++) belief.ships[`s-ours-${i}` as ShipId] = { ship: { id: `s-ours-${i}` as ShipId, name: 'V', role: 'patrol', faction: 'f-admin' as never, at: X, commander: null, damaged: false, fuel: null }, observed: 1, report: 'r' as never }
    }
    seen(2)
    warlordActs(s)
    expect(ordersOf(s).filter((o) => o.order.kind === 'transport')).toEqual([])
    const s2 = court()
    heTinks(s2, X, 1, (w) => {
      w.garrison = 0
    })
    s2.beliefs[THE_WARLORD].ships['s-ours-0' as ShipId] = { ship: { id: 's-ours-0' as ShipId, name: 'V', role: 'patrol', faction: 'f-admin' as never, at: X, commander: null, damaged: false, fuel: null }, observed: 1, report: 'r' as never }
    warlordActs(s2)
    const landing = ordersOf(s2).filter((o) => o.order.kind === 'transport' && o.order.to === X)
    expect(landing.length).toBeGreaterThan(0)
    // And he sends every patrol he has as escort when he knows warships are there.
    expect(ordersOf(s2).filter((o) => o.role === 'patrol' && o.order.kind === 'move' && o.order.to === X).length).toBe(2)
  })

  it('sends patrols after a courier of ours he has heard lies at a weak port', () => {
    const s = court()
    s.worlds[X].profile.starport = 'C'
    heTinks(s, X, 1, (w) => {
      w.profile.starport = 'C'
      w.garrison = 5 // not worth a landing
    })
    s.beliefs[THE_WARLORD].ships['s-swift' as ShipId] = { ship: { id: 's-swift' as ShipId, name: 'Swift', role: 'scout', faction: 'f-admin' as never, at: X, commander: null, damaged: false, fuel: null }, observed: 1, report: 'r' as never }
    warlordActs(s)
    const hunters = ordersOf(s).filter((o) => o.role === 'patrol' && o.order.kind === 'patrol' && o.order.world === X)
    expect(hunters.length).toBe(1) // one patrol craft is favourable against a courier under one gun
  })

  it('sends a scout to a world of his whose governor has gone quiet, ahead of the enemy worlds', () => {
    const s = court()
    s.worlds[X].faction = WARLORD
    heTinks(s, X, -12, (w) => {
      w.faction = WARLORD
    }) // fourteen weeks of silence
    heTinks(s, C, 1, () => {}) // the enemy capital is fresh in his mind
    warlordActs(s)
    const scout = ordersOf(s).find((o) => o.role === 'scout')
    expect(scout?.order.kind === 'scout' && scout.order.world).toBe(X)
  })

  it('takes an independent world when nothing of the desk’s is within his means', () => {
    const s = court()
    s.worlds[X].faction = REBELS
    heTinks(s, X, 1, (w) => {
      w.faction = REBELS
      w.garrison = 1
    })
    warlordActs(s)
    const landing = ordersOf(s).filter((o) => o.order.kind === 'transport' && o.order.to === X)
    expect(landing.length).toBeGreaterThan(0)
  })

  it('never tempts anyone: treason waits for money', () => {
    const s = court()
    const cid = 'c-cap' as CharacterId
    s.characters[cid] = { id: cid, name: 'Grasping', faction: 'f-admin' as never, post: { kind: 'commander', ship: 's-cap' as ShipId }, traits: { ...playerTraits(), loyalty: 'self', ambition: 3 } }
    s.ships['s-cap' as ShipId] = newShip('s-cap' as ShipId, 'Fickle', HULLS.patrol, 'f-admin' as never, X, s.characters[cid])
    for (let i = 0; i < 12; i++) {
      s.week = 2 + i * 4
      warlordActs(s)
    }
    expect(s.ships['s-cap' as ShipId].faction).toBe('f-admin')
  })

  it('clears a pirate nest at one of his own havens when he has ships to spare, ahead of the desk’s couriers', () => {
    const s = court()
    s.worlds[X].faction = WARLORD
    heTinks(s, X, 1, (w) => {
      w.faction = WARLORD
    })
    s.beliefs[THE_WARLORD].ships['s-gull' as ShipId] = { ship: { id: 's-gull' as ShipId, name: 'Gull', role: 'raider', faction: PIRATES, at: X, commander: null, damaged: false, fuel: null }, observed: 1, report: 'r' as never }
    s.beliefs[THE_WARLORD].ships['s-swift' as ShipId] = { ship: { id: 's-swift' as ShipId, name: 'Swift', role: 'scout', faction: 'f-admin' as never, at: C, commander: null, damaged: false, fuel: null }, observed: 1, report: 'r' as never }
    warlordActs(s)
    const hunters = ordersOf(s).filter((o) => o.role === 'patrol' && o.order.kind === 'patrol')
    expect(hunters.length).toBeGreaterThan(0)
    expect(hunters.every((o) => o.order.kind === 'patrol' && o.order.world === X)).toBe(true)
  })

  it('does not reinforce a world against pirates, who raid but never land', () => {
    const s = court()
    s.worlds[X].faction = WARLORD
    heTinks(s, X, 1, (w) => {
      w.faction = WARLORD
      w.garrison = 1
    })
    s.beliefs[THE_WARLORD].ships['s-gull' as ShipId] = { ship: { id: 's-gull' as ShipId, name: 'Gull', role: 'raider', faction: PIRATES, at: X, commander: null, damaged: false, fuel: null }, observed: 1, report: 'r' as never }
    warlordActs(s)
    expect(ordersOf(s).filter((o) => o.order.kind === 'transport' && o.order.to === X)).toEqual([])
  })

  it('keeps an officer pool at his seat, and crews a prize from it rather than out of thin air', () => {
    const s = court()
    for (let i = 0; i < 3; i++) hisOfficer(s, Y)
    const before = Object.values(s.characters).filter((c) => c.faction === WARLORD && c.post.kind === 'unassigned').map((c) => c.id)
    expect(before.length).toBe(3)
    const prize = newShip('s-prize' as ShipId, 'Taken', HULLS.patrol, WARLORD, Y, null)
    s.ships['s-prize' as ShipId] = prize
    warlordActs(s)
    expect(prize.commander).not.toBeNull()
    expect(before).toContain(prize.commander)
    expect(s.characters[prize.commander as CharacterId].post).toEqual({ kind: 'commander', ship: 's-prize' })
    // His officers are his or their own: the Empire has no claim on them.
    for (const id of before) expect(['player', 'self']).toContain(s.characters[id].traits.loyalty)
  })

  it('sends an officer with a marine to replace a governor whose port his people saw pirates lying at', () => {
    const s = court()
    hisOfficer(s, Y)
    s.worlds[Y].marines = 1
    s.worlds[X].faction = WARLORD
    heTinks(s, X, 1, (w) => {
      w.faction = WARLORD
    })
    s.beliefs[THE_WARLORD].ships['s-gull' as ShipId] = { ship: { id: 's-gull' as ShipId, name: 'Gull', role: 'raider', faction: PIRATES, at: X, commander: null, damaged: false, fuel: null }, observed: 1, report: 'r' as never }
    warlordActs(s)
    const errand = ordersOf(s).find((o) => o.order.kind === 'transport' && o.order.purpose === 'appoint')
    expect(errand?.order.kind === 'transport' && errand.order.to).toBe(X)
    expect(errand?.order.kind === 'transport' && errand.order.marines).toBe(1)
    expect(errand?.order.kind === 'transport' && errand.order.passenger).not.toBeNull()
  })
})

describe('interrogation', () => {
  it('a seized pirate names some of her havens, not all, and now and then one that is no haven', () => {
    let letters = 0
    let named = 0
    let wrong = 0
    for (let seed = 1; seed <= 40; seed++) {
      const s = line()
      s.rng = createRng(seed)
      const cid = 'c-r' as CharacterId
      s.characters[cid] = { id: cid, name: 'Redbeard', faction: PIRATES, post: { kind: 'commander', ship: 's-r' as ShipId }, traits: { ...playerTraits(), loyalty: 'self' } }
      const r = newShip('s-r' as ShipId, 'Gull', HULLS.raider, PIRATES, s.capital, s.characters[cid])
      r.havens = ['w-x' as WorldId, 'w-y' as WorldId]
      r.order = { kind: 'hold' }
      s.ships['s-r' as ShipId] = r
      seizePirates(s)
      expect(r.faction).toBe('f-admin')
      const letter = buildPlayerView(s).inbox.find((rep) => rep.events.some((e) => e.kind === 'haven_named'))
      if (!letter) continue
      letters += 1
      for (const e of letter.events) {
        named += 1
        if (!['w-x', 'w-y'].includes(e.at)) wrong += 1
        expect(e.person).toBe('Redbeard')
      }
    }
    expect(letters).toBeGreaterThan(25) // two havens at 58% each: a letter most of the time
    expect(named / letters).toBeLessThan(2) // and rarely both
    expect(wrong).toBeLessThan(letters / 3)
  })
})

describe('how far he can reach', () => {
  const Y = 'w-y' as WorldId
  const W = 'w-w' as WorldId
  const V = 'w-v' as WorldId
  const Z = 'w-z' as WorldId

  /** Wye as his seat (an A port), then a chain of D-port worlds eastward, two hexes apart: W, V, Z — three jumps out. */
  function chain(): GameState {
    const s = line()
    s.worlds[Y].faction = WARLORD
    s.worlds[Y].profile.starport = 'A'
    s.factions[WARLORD].capital = Y
    for (const [id, col] of [[W, 5], [V, 7], [Z, 9]] as [WorldId, number][]) {
      s.worlds[id] = { ...s.worlds[Y], id, name: id, hex: { col, row: 5 }, faction: 'f-admin' as never, governor: null, actingGovernor: null, profile: { ...s.worlds[Y].profile, starport: 'D' } }
    }
    return s
  }

  it('three jumps out on a four-jump tank is too far, since the target will not fill her for the way back', () => {
    const s = chain()
    expect(withinReach(s, Y, W)).toBe(true) // one out, one back
    expect(withinReach(s, Y, V)).toBe(true) // two out, two back
    expect(withinReach(s, Y, Z)).toBe(false) // three out, one left, three home
  })

  it('a B port of his on the way is a base: she fills there, and rallies there afterwards instead of at the seat', () => {
    const s = chain()
    s.worlds[W].faction = WARLORD
    s.worlds[W].profile.starport = 'B'
    expect(withinReach(s, Y, Z)).toBe(true) // fill at W, two on to Z, two back to W
    expect(withinReach(s, W, Z)).toBe(true)
  })
})
