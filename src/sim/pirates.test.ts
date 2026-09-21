import { describe, expect, it } from 'vitest'
import { playerTraits } from './characters'
import { fightAtWorlds, repairShips } from './combat'
import { PIRATES } from './factions'
import { HULLS, newShip } from './fleet'
import { advanceWeek } from './game'
import { discloses, governorLetter } from './governors'
import { harbourPirates, pirateOrders, pirateTalk, seizePirates, spawnPirate, toutHavens } from './pirates'
import { buildPlayerView } from './player'
import { spreadRumours } from './rumours'
import type { CharacterId, GameState, ShipId, WorldId } from './types'
import { line } from './fixtures.test-helper'

const C = 'w-c' as WorldId
const X = 'w-x' as WorldId
const Y = 'w-y' as WorldId

/** Wye's governor looks the other way: Wye is a haven, and a raider lies docked there knowing it. */
function havenAtY(s: GameState): ReturnType<typeof spawnPirate> {
  s.characters['c-y' as CharacterId].traits.loyalty = 'self'
  const pirate = spawnPirate(s, s.worlds[Y])
  pirate.order = { kind: 'hold' }
  return pirate
}

/** A patrol craft of the desk's landing at `at` this week. */
function patrol(s: GameState, at: WorldId, id = 's-war' as ShipId): void {
  const cid = `c-${id}` as CharacterId
  const faction = s.characters[s.player].faction
  s.characters[cid] = { id: cid, name: 'Captain', faction, post: { kind: 'commander', ship: id }, traits: playerTraits() }
  s.ships[id] = newShip(id, 'Vigilant', HULLS.patrol, faction, at, s.characters[cid])
  s.ships[id].standing = { rally: C, onContact: 'never' }
  s.ships[id].order = { kind: 'patrol', world: at, weeks: 4, posture: 'never', then: null, began: 0 }
}

describe('pirates at a haven they know', () => {
  it('rob nothing there: the packet that comes in is left alone, guns or no guns', () => {
    const s = line()
    s.worlds[Y].profile.starport = 'D' // no guns to hide under: only the rule keeps the packet safe
    havenAtY(s)
    // P2 is on her way X→Y; she lands at Y next week.
    const packet = s.ships['s-xy' as ShipId]
    packet.location = { kind: 'transit', from: X, to: Y, arrives: 1 }
    advanceWeek(s)
    expect(Object.values(s.events).some((e) => e.kind === 'ship_robbed')).toBe(false)
    expect(packet.location).toEqual({ kind: 'world', world: Y })
  })

  it('still fight back when a warship comes for them', () => {
    const s = line()
    const pirate = havenAtY(s)
    patrol(s, Y)
    s.ships['s-war' as ShipId].standing.onContact = 'always'
    fightAtWorlds(s, ['s-war' as ShipId])
    expect(Object.values(s.events).some((e) => e.kind === 'battle')).toBe(true)
    expect(pirate).toBeDefined()
  })
})

describe('where a raider goes hunting', () => {
  it('any world on the lanes will do, whatever its port, but never a haven she knows or a faction’s seat', () => {
    const s = line()
    s.worlds[X].profile.starport = 'D' // no port to speak of, but the packets call
    const pirate = havenAtY(s)
    pirate.order = null
    pirateOrders(s)
    expect(pirate.order).toMatchObject({ kind: 'patrol', world: X })
  })
})

describe('a governor who harbours pirates', () => {
  it('says nothing of their coming and going and lists none of them in port, but may still report a battle', () => {
    const s = line()
    const pirate = havenAtY(s)
    const governor = s.characters['c-y' as CharacterId]
    const arrived = { id: 'e-1' as never, at: Y, week: 1, kind: 'hull_arrived' as const, valence: 'neutral' as const, against: governor.faction, favours: null, severity: 2, ship: { id: pirate.id, name: pirate.name, role: 'raider' as const, faction: PIRATES, at: Y, commander: null, damaged: false, hulk: false, fuel: null }, person: null, level: null }
    const harboured = { ...arrived, kind: 'pirates_harboured' as const, valence: 'bad' as const, against: null, favours: PIRATES, severity: 3 }
    const battle = { ...arrived, kind: 'battle' as const, valence: 'bad' as const, against: null, severity: 2 }
    let arrivals = 0
    let harbourings = 0
    let battles = 0
    for (let i = 0; i < 200; i++) {
      if (discloses(s.rng, governor, arrived)) arrivals++
      if (discloses(s.rng, governor, harboured)) harbourings++
      if (discloses(s.rng, governor, battle)) battles++
    }
    expect(arrivals).toBe(0)
    expect(harbourings).toBe(0)
    expect(battles).toBeGreaterThan(0)
    const mail = governorLetter(s, s.worlds[Y], [])!
    const snap = mail.contents.kind === 'report' ? mail.contents.report.snapshot : null
    expect(snap?.kind === 'world' && snap.world.ships.some((h) => h.faction === PIRATES)).toBe(false)
    // An honest governor at the same port would list her.
    governor.traits.loyalty = 'player'
    const honest = governorLetter(s, s.worlds[Y], [])!
    const honestSnap = honest.contents.kind === 'report' ? honest.contents.report.snapshot : null
    expect(honestSnap?.kind === 'world' && honestSnap.world.ships.some((h) => h.faction === PIRATES)).toBe(true)
  })
})

describe('pirates seen to be harboured', () => {
  it('is recorded when a pirate docks and is not seized, naming the governor, and again when a hull arrives to find her there', () => {
    const s = line()
    const pirate = havenAtY(s)
    seizePirates(s)
    harbourPirates(s, [pirate.id])
    const first = Object.values(s.events).filter((e) => e.kind === 'pirates_harboured')
    expect(first).toHaveLength(1)
    expect(first[0].at).toBe(Y)
    expect(first[0].person).toBe('Wy')
    expect(first[0].ship?.id).toBe(pirate.id)
    // A week she merely lies there is not news again...
    harbourPirates(s, [])
    expect(Object.values(s.events).filter((e) => e.kind === 'pirates_harboured')).toHaveLength(1)
    // ...until someone arrives and sees it.
    patrol(s, Y)
    harbourPirates(s, ['s-war' as ShipId])
    expect(Object.values(s.events).filter((e) => e.kind === 'pirates_harboured')).toHaveLength(2)
  })

  it('is written home by the captain who saw it, whatever her temperament, and reaches the desk', () => {
    const s = line()
    const pirate = havenAtY(s)
    // The patrol craft lands at Y next week and finds the pirate docked there.
    patrol(s, Y)
    s.ships['s-war' as ShipId].location = { kind: 'transit', from: X, to: Y, arrives: 1 }
    s.characters['c-s-war' as CharacterId].traits.initiative = 2 // bold: would rather act than write, but this she writes
    advanceWeek(s)
    const letters = Object.values(s.mail).filter((m) => m.contents.kind === 'report' && m.contents.report.observer === 'c-s-war')
    expect(letters).toHaveLength(1)
    const report = letters[0].contents.kind === 'report' ? letters[0].contents.report : null
    expect(report?.events.some((e) => e.kind === 'pirates_harboured')).toBe(true)
    expect(report?.subject).toMatch(/harboured/i)
    // The letter goes by packet. Take the pirate out of the game so she cannot rob it on the way.
    delete s.ships[pirate.id]
    for (let i = 0; i < 12; i++) advanceWeek(s)
    const view = buildPlayerView(s)
    expect(view.inbox.some((r) => r.events.some((e) => e.kind === 'pirates_harboured' && e.at === Y && e.person === 'Wy'))).toBe(true)
  })
})

describe('dockyards', () => {
  it('a C port patches a hull that still fights, but a knocked-out hull lies there a hulk until she reaches a B or better', () => {
    const s = line()
    s.worlds[Y].profile.starport = 'C'
    patrol(s, Y)
    const ship = s.ships['s-war' as ShipId]
    ship.damage = 1 // hurt, still fights
    repairShips(s)
    expect(ship.damage).toBe(0)
    ship.damage = ship.strength // knocked out
    repairShips(s)
    expect(ship.damage).toBe(ship.strength)
    s.worlds[Y].profile.starport = 'B'
    repairShips(s)
    expect(ship.damage).toBe(ship.strength - 1)
  })

  it('a knocked-out pirate at a C haven limps to a haven with a dockyard; a merely hurt one refits where she lies', () => {
    const s = line()
    s.worlds[Y].profile.starport = 'C'
    s.worlds[X].profile.starport = 'B'
    s.characters['c-x' as CharacterId].traits.loyalty = 'self'
    const pirate = havenAtY(s)
    pirate.havens = [Y, X]
    pirate.damage = pirate.strength
    pirateOrders(s)
    expect(pirate.order).toEqual({ kind: 'move', to: X, then: null })
    pirate.damage = 1
    pirate.order = null
    pirateOrders(s)
    expect(pirate.order).toEqual({ kind: 'hold' })
  })

  it('a sighting says whether she is a hulk', () => {
    const s = line()
    patrol(s, Y)
    s.ships['s-war' as ShipId].damage = 3
    const view = (() => {
      const m = governorLetter(s, s.worlds[Y], [])!
      return m.contents.kind === 'report' ? m.contents.report : null
    })()
    expect(view?.snapshot.kind === 'world' && view.snapshot.world.ships.find((h) => h.id === 's-war')?.hulk).toBe(true)
  })
})

describe('pirates talk', () => {
  it('two hulls lying at the same world pool what they know of havens', () => {
    const s = line()
    s.characters['c-x' as CharacterId].traits.loyalty = 'self'
    const a = havenAtY(s)
    const b = havenAtY(s)
    a.havens = [Y]
    b.havens = [X]
    pirateTalk(s)
    expect(a.havens).toEqual([X, Y])
    expect(b.havens).toEqual([X, Y])
  })

  it('a hull docked at a haven hears the docks: a port that harboured pirates, or touts for them, is a haven to try; a pirate seized is one to strike off', () => {
    const s = line()
    const pirate = havenAtY(s)
    pirate.havens = [Y, C]
    const talk = (kind: 'pirates_harboured' | 'pirate_seized', at: WorldId) => ({ event: { id: `e-${kind}` as never, at, week: 1, kind, valence: 'bad' as const, against: null, favours: null, severity: 2, ship: null, person: null, level: null }, origin: at, born: 1, heard: { [Y]: 1 } })
    s.rumours.push(talk('pirates_harboured', X), talk('pirate_seized', C))
    pirateTalk(s)
    expect(pirate.havens).toEqual([X, Y])
    // Talk she has not reached is not heard: the same rumours at X mean nothing to a hull at Y.
    const other = havenAtY(s)
    other.havens = [Y]
    s.rumours = [{ ...talk('pirates_harboured', C), heard: { [X]: 0 } }]
    pirateTalk(s)
    expect(other.havens).toEqual([X, Y]) // pooled from her neighbour, not from the talk at X
  })

  it('a bold, self-serving governor at a haven puts it about that the port asks no questions; the desk hears it as talk and marks nothing', () => {
    const s = line()
    havenAtY(s)
    const governor = s.characters['c-y' as CharacterId]
    governor.traits.initiative = 2
    let touted = 0
    for (let i = 0; i < 100; i++) {
      s.week = i + 1
      toutHavens(s)
    }
    touted = s.rumours.filter((r) => r.event.kind === 'haven_touted').length
    expect(touted).toBeGreaterThan(5)
    expect(touted).toBeLessThan(40)
    expect(Object.values(s.events).some((e) => e.kind === 'haven_touted')).toBe(false)
    // A cautious governor holds their tongue.
    s.rumours = []
    governor.traits.initiative = -2
    for (let i = 0; i < 100; i++) toutHavens(s)
    expect(s.rumours).toHaveLength(0)
    // What reaches the desk is a rumour, and rumours mark no haven.
    governor.traits.initiative = 2
    for (let i = 0; i < 20; i++) {
      s.week += 1
      toutHavens(s)
      spreadRumours(s)
    }
    const view = buildPlayerView(s)
    expect(view.rumours.some((r) => r.snapshot.kind === 'event' && r.snapshot.event.kind === 'haven_touted')).toBe(true)
    expect(view.havens).toEqual([])
  })
})
