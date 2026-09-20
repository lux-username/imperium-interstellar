import { describe, expect, expectTypeOf, it } from 'vitest'
import { playerTraits } from './characters'
import { createRng } from './rng'
import type {
  CharacterId,
  FactionId,
  GameState,
  LaneId,
  MailId,
  ReportId,
  ShipId,
  World,
  WorldId,
} from './types'
import type { PlayerView, Report, WorldSnapshot } from './view'

// A hand-built two-world subsector: the capital and one lane-world that has
// just sent a report home. Enough to exercise every record type once.
function fixture(): GameState {
  const capital = 'w-capital' as WorldId
  const outpost = 'w-outpost' as WorldId
  const admin = 'f-admin' as FactionId
  const player = 'c-player' as CharacterId
  const governor = 'c-governor' as CharacterId
  const packet = 's-packet' as ShipId
  const lane = 'l-1' as LaneId
  const report: Report = {
    id: 'r-1' as ReportId,
    channel: 'official',
    observer: governor,
    observerName: 'Governor of Outpost',
    observedAt: outpost,
    observed: 2,
    snapshot: {
      kind: 'world',
      world: {
        id: outpost,
        name: 'Outpost',
        hex: { col: 3, row: 4 },
        profile: { starport: 'C', size: 4, atmosphere: 5, hydrographics: 3, population: 4, government: 2, law: 3, tech: 7 },
        faction: admin,
        governor,
        governorName: 'Governor of Outpost',
        unrest: 1,
        garrison: 1,
        ships: [],
      },
    },
    events: [],
    envelope: { origin: outpost, destination: { kind: 'world', world: capital }, sent: 3, route: [outpost, capital], eta: 4 },
    delivered: null,
  }
  return {
    seed: 42,
    week: 3,
    nextId: 1,
    rng: createRng(42),
    capital,
    player,
    worlds: {
      [capital]: {
        id: capital,
        name: 'Capital',
        hex: { col: 2, row: 3 },
        profile: { starport: 'A', size: 6, atmosphere: 6, hydrographics: 7, population: 8, government: 5, law: 4, tech: 12 },
        faction: admin,
        governor: player,
        actingGovernor: player,
        unrest: 0,
        garrison: 4,
        lastLetter: 0,
      },
      [outpost]: {
        id: outpost,
        name: 'Outpost',
        hex: { col: 3, row: 4 },
        profile: { starport: 'C', size: 4, atmosphere: 5, hydrographics: 3, population: 4, government: 2, law: 3, tech: 7 },
        faction: admin,
        governor,
        actingGovernor: governor,
        unrest: 1,
        garrison: 1,
        lastLetter: 0,
      },
    },
    lanes: { [lane]: { id: lane, ends: [capital, outpost], jumpDistance: 2, schedule: { interval: 2, phase: 1 } } },
    ships: {
      [packet]: {
        id: packet,
        name: 'Packet One',
        role: 'packet',
        faction: admin,
        jump: 2,
        strength: 0,
        location: { kind: 'transit', from: outpost, to: capital, arrives: 4 },
        commander: null,
        order: { kind: 'courier', route: [capital, outpost], then: null, repeat: true, leg: 0 },
        standing: { rally: null },
        mailbag: ['m-1' as MailId],
      },
    },
    characters: {
      [player]: { id: player, name: 'The Governor-General', faction: admin, post: { kind: 'governor', world: capital }, traits: playerTraits() },
      [governor]: { id: governor, name: 'Governor of Outpost', faction: admin, post: { kind: 'governor', world: outpost }, traits: playerTraits() },
    },
    factions: { [admin]: { id: admin, name: 'The Administration', kind: 'administration' } },
    mail: { ['m-1' as MailId]: { id: 'm-1' as MailId, contents: { kind: 'report', report }, status: { kind: 'aboard', ship: packet } } },
    events: {},
    beliefs: { [player]: { worlds: {}, ships: {} }, [governor]: { worlds: {}, ships: {} } },
  }
}

describe('core types', () => {
  it('round-trips GameState through JSON unchanged', () => {
    const state = fixture()
    const restored = JSON.parse(JSON.stringify(state)) as GameState
    expect(restored).toEqual(state)
  })

  it('keeps ids of different kinds apart', () => {
    expectTypeOf<WorldId>().not.toEqualTypeOf<ShipId>()
    expectTypeOf<WorldId>().not.toMatchTypeOf<ShipId>()
    // A plain string is not an id until something in the sim says which kind it is.
    expectTypeOf<string>().not.toMatchTypeOf<WorldId>()
  })

  it('keeps the truth out of the view', () => {
    // A World carries who is actually holding the seal; a snapshot does not, so
    // the truth record is not usable where a report is expected.
    expectTypeOf<World>().not.toEqualTypeOf<WorldSnapshot>()
    expectTypeOf<PlayerView>().not.toHaveProperty('worlds')
    expectTypeOf<PlayerView>().not.toHaveProperty('rng')
  })
})
