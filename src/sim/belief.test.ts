import { describe, expect, it } from 'vitest'
import { beliefFrom, knownHavens, mentionsShip } from './belief'
import { PIRATES } from './factions'
import { advanceWeek, newGame } from './game'
import { buildPlayerView } from './player'
import type { CharacterId, ReportId, ShipId, WorldId } from './types'
import type { Event, EventId, Report, ShipSnapshot } from './view'

const C = 'w-c' as WorldId
const X = 'w-x' as WorldId
const Y = 'w-y' as WorldId

const raider: ShipSnapshot = { id: 's-r' as ShipId, name: 'Black Gull', role: 'raider', faction: PIRATES, at: X, commander: null, damaged: false, fuel: null }

function event(kind: Event['kind'], at: WorldId, week: number, extra: Partial<Event> = {}): Event {
  return { id: `e-${kind}-${week}` as EventId, at, week, kind, valence: 'neutral', against: null, favours: null, severity: 2, ship: raider, person: null, level: null, ...extra }
}

/** A captain's letter from `at`, observed `observed`, delivered `delivered`, listing `ships` in port and mentioning `events`. */
function letter(id: string, at: WorldId, observed: number, delivered: number, ships: ShipSnapshot[], events: Event[], governorName = 'G'): Report {
  return {
    id: id as ReportId,
    channel: 'official',
    observer: 'c-cap' as CharacterId,
    observerName: 'Cap',
    observerTitle: 'captain',
    observerShip: 'Vigilant',
    observerShipId: 's-v' as ShipId,
    subject: 's',
    lede: 'l',
    observedAt: at,
    observed,
    snapshot: {
      kind: 'world',
      world: { id: at, name: at, hex: { col: 1, row: 1 }, profile: { starport: 'B', size: 5, atmosphere: 6, hydrographics: 5, population: 5, government: 5, law: 5, tech: 9 }, faction: 'f-admin' as never, governor: 'c-g' as CharacterId, governorName, unrest: 0, garrison: 1, marines: 0, contest: null, ships },
    },
    events,
    envelope: { origin: at, destination: { kind: 'world', world: C }, sent: observed, route: [at, C], eta: delivered },
    delivered,
  }
}

describe('the fold from reports to a picture', () => {
  it('takes a sighting from an event on the week it happened, not the week the letter was written', () => {
    // A general report written at Y in week 20 says the raider made port at X in week 14.
    const general = letter('r-1', Y, 20, 24, [], [event('hull_arrived', X, 14)])
    const belief = beliefFrom([general])
    expect(belief.ships[raider.id]).toEqual({ ship: { ...raider, at: X }, observed: 14, report: 'r-1' })
    // A later world report that lists her at Y outranks it; an older event does not.
    const later = letter('r-2', Y, 16, 25, [{ ...raider, at: Y }], [event('hull_arrived', Y, 16)])
    expect(beliefFrom([general, later]).ships[raider.id].ship.at).toBe(Y)
    expect(beliefFrom([general, later]).ships[raider.id].observed).toBe(16)
  })

  it('can say what the desk now knows about an earlier week', () => {
    const general = letter('r-1', Y, 20, 24, [{ ...raider, at: Y }], [event('hull_arrived', X, 14), event('hull_departed', X, 17)])
    const now = beliefFrom([general])
    expect(now.ships[raider.id].ship.at).toBe(Y)
    expect(now.worlds[Y]).toBe(general)
    const then = beliefFrom([general], 15)
    expect(then.ships[raider.id]).toMatchObject({ observed: 14, ship: { at: X } })
    expect(then.worlds[Y]).toBeUndefined()
    expect(beliefFrom([general], 13).ships[raider.id]).toBeUndefined()
  })

  it('shows a hull destroyed nowhere, and a hull taken in her captor’s colours', () => {
    const sunk = letter('r-1', X, 5, 6, [], [event('ship_destroyed', X, 5, { against: PIRATES, favours: 'f-admin' as never })])
    expect(beliefFrom([sunk]).ships[raider.id]).toBeUndefined()
    const taken = letter('r-2', X, 5, 6, [], [event('ship_captured', X, 5, { against: PIRATES, favours: 'f-admin' as never })])
    expect(beliefFrom([taken]).ships[raider.id].ship.faction).toBe('f-admin')
  })

  it('agrees with what the sim learned as the letters came in, in a generated game', () => {
    const s = newGame(12)
    for (let i = 0; i < 30; i++) advanceWeek(s)
    const view = buildPlayerView(s)
    const refolded = beliefFrom([...view.inbox, ...view.observations])
    expect(Object.keys(refolded.worlds).sort()).toEqual(Object.keys(view.known.worlds).sort())
    for (const [id, r] of Object.entries(view.known.worlds)) expect(refolded.worlds[id as WorldId].id).toBe(r.id)
    expect(Object.keys(refolded.ships).sort()).toEqual(Object.keys(view.known.ships).sort())
    for (const [id, sighting] of Object.entries(view.known.ships)) {
      expect(refolded.ships[id as ShipId].observed).toBe(sighting.observed)
      expect(refolded.ships[id as ShipId].ship.at).toBe(sighting.ship.at)
    }
    // And as of the present week the fold is the same thing.
    expect(Object.keys(beliefFrom([...view.inbox, ...view.observations], view.week).ships).length).toBe(Object.keys(view.known.ships).length)
  })

  it('a sighting from an event cites the letter that mentioned it', () => {
    const s = newGame(12)
    for (let i = 0; i < 30; i++) advanceWeek(s)
    const view = buildPlayerView(s)
    for (const sighting of Object.values(view.known.ships)) {
      const source = [...view.inbox, ...view.observations].find((r) => r.id === sighting.report)
      expect(source).toBeDefined()
      expect(mentionsShip(source!, sighting.ship.id)).toBe(true)
    }
  })
})

describe('worlds known to harbour pirates', () => {
  it('are marked from a letter that saw it, and unmarked once a new governor is known to hold the seal', () => {
    const seen = letter('r-1', X, 5, 8, [raider], [event('pirates_harboured', X, 5, { valence: 'bad', favours: PIRATES, severity: 3, person: 'Ex' })], 'Ex')
    const belief = beliefFrom([seen])
    expect(knownHavens([seen], belief)).toEqual([X])
    const replaced = letter('r-2', X, 9, 12, [], [event('governor_changed', X, 9, { ship: null, person: 'New' })], 'New')
    expect(knownHavens([seen, replaced], beliefFrom([seen, replaced]))).toEqual([])
    // Talk that names a haven marks nothing.
    const talk: Report = { ...seen, id: 'r-3' as ReportId, channel: 'docks' }
    expect(knownHavens([talk], beliefFrom([seen]))).toEqual([])
  })
})
