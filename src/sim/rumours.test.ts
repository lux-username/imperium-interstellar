import { describe, expect, it } from 'vitest'
import { neighbours } from './chart'
import { recordEvent } from './events'
import { advanceWeek, newGame } from './game'
import { buildPlayerView } from './player'
import { spawnRumours, spreadRumours, THE_DOCKS } from './rumours'
import type { ShipId, WorldId } from './types'
import { line } from './fixtures.test-helper'

const Y = 'w-y' as WorldId

describe('rumour', () => {
  it('spawns from bad or good events at ports, never from routine traffic or events at the capital', () => {
    const s = line()
    s.week = 1
    for (let i = 0; i < 100; i++) {
      recordEvent(s, Y, { kind: 'unrest_rose', valence: 'bad', against: null, favours: null, severity: 2, level: 6 })
      recordEvent(s, Y, { kind: 'hull_arrived', valence: 'neutral', against: null, favours: null, severity: 0 })
      recordEvent(s, s.capital, { kind: 'unrest_rose', valence: 'bad', against: null, favours: null, severity: 3, level: 8 })
    }
    spawnRumours(s)
    // News becomes talk on 2d6 ≥ 9, good or bad alike: a bit over a quarter of the time.
    expect(s.rumours.length).toBeGreaterThan(15)
    expect(s.rumours.length).toBeLessThan(45)
    for (const r of s.rumours) {
      expect(r.origin).toBe(Y)
      expect(r.event.kind).toBe('unrest_rose')
      expect(r.heard).toEqual({ [Y]: 0 })
    }
  })

  it('the better the story, the more likely it is told: a world lost outruns a step of unrest', () => {
    const s = line()
    s.week = 1
    for (let i = 0; i < 100; i++) {
      recordEvent(s, Y, { kind: 'unrest_rose', valence: 'bad', against: null, favours: null, severity: 1, level: 2 })
      recordEvent(s, Y, { kind: 'world_fell', valence: 'bad', against: null, favours: null, severity: 3 })
    }
    spawnRumours(s)
    const mild = s.rumours.filter((r) => r.event.kind === 'unrest_rose').length
    const grave = s.rumours.filter((r) => r.event.kind === 'world_fell').length
    expect(grave).toBeGreaterThan(40)
    expect(mild).toBeLessThan(20)
    expect(grave).toBeGreaterThan(mild * 3)
  })

  it('a port with no working starport starts no talk', () => {
    const s = line()
    s.worlds[Y].profile.starport = 'E'
    s.week = 1
    for (let i = 0; i < 40; i++) recordEvent(s, Y, { kind: 'unrest_rose', valence: 'bad', against: null, favours: null, severity: 3, level: 8 })
    spawnRumours(s)
    expect(s.rumours).toHaveLength(0)
  })

  it('hops lane to lane and is delivered to the desk as a merchant\'s word or docks talk, kept apart from the mail', () => {
    const s = line()
    for (const w of Object.values(s.worlds)) w.profile.population = 0 // nothing else happens
    s.week = 1
    const e = recordEvent(s, Y, { kind: 'unrest_rose', valence: 'bad', against: null, favours: null, severity: 3, level: 8 })
    s.rumours.push({ event: { ...e }, origin: Y, born: 1, heard: { [Y]: 0 } })
    let weeks = 0
    while (buildPlayerView(s).rumours.length === 0 && weeks < 60) {
      advanceWeek(s)
      weeks++
    }
    const view = buildPlayerView(s)
    expect(view.rumours).toHaveLength(1)
    const heard = view.rumours[0]
    expect(heard.channel).toBe('docks') // two hops: Y → X → C
    expect(heard.observer).toBe(THE_DOCKS)
    expect(heard.snapshot.kind === 'event' && heard.snapshot.event.kind).toBe('unrest_rose')
    expect(heard.delivered).toBe(s.week)
    expect(view.inbox.some((r) => r.id === heard.id)).toBe(false)
    // Talk is not knowledge: the belief map is untouched by it.
    expect(view.known.worlds[Y]?.channel ?? 'official').toBe('official')
    expect(Object.values(view.known.ships).every((sighting) => !view.rumours.some((r) => r.id === sighting.report))).toBe(true)
    // It took at least the two hops to get here.
    expect(weeks).toBeGreaterThanOrEqual(2)
    // Talk heard at the capital is not re-heard.
    for (let i = 0; i < 10; i++) advanceWeek(s)
    expect(buildPlayerView(s).rumours).toHaveLength(1)
  })

  it('what is told stays near the truth: a week or two off, and only ever a neighbouring world', () => {
    const s = line()
    s.week = 5
    for (let i = 0; i < 200; i++) recordEvent(s, Y, { kind: 'unrest_rose', valence: 'bad', against: null, favours: null, severity: 3, level: 8 })
    spawnRumours(s)
    let movedWeek = 0
    let movedWorld = 0
    for (const r of s.rumours) {
      // Talk may make it older than it was, never newer.
      expect(r.event.week).toBeLessThanOrEqual(5)
      expect(r.event.week).toBeGreaterThanOrEqual(3)
      if (r.event.week !== 5) movedWeek++
      if (r.event.at !== Y) {
        movedWorld++
        expect(neighbours(s.lanes, Y)).toContain(r.event.at)
        expect(r.event.at).not.toBe(s.capital)
      }
    }
    expect(movedWeek).toBeGreaterThan(0)
    expect(movedWorld).toBeGreaterThan(0)
    expect(movedWorld).toBeLessThan(movedWeek)
  })

  it('goes no faster than a hull: nothing is heard of the week it happens, and a lane away takes a week', () => {
    const s = line()
    s.week = 1
    const e = recordEvent(s, 'w-x' as WorldId, { kind: 'unrest_rose', valence: 'bad', against: null, favours: null, severity: 3, level: 8 })
    for (let i = 0; i < 50; i++) s.rumours.push({ event: { ...e }, origin: e.at, born: 1, heard: { [e.at]: 0 } })
    spreadRumours(s)
    expect(s.rumours.every((r) => !(s.capital in r.heard))).toBe(true)
    expect(buildPlayerView(s).rumours).toHaveLength(0)
    s.week = 2
    spreadRumours(s)
    expect(s.rumours.some((r) => s.capital in r.heard)).toBe(true)
    expect(buildPlayerView(s).rumours.every((r) => r.delivered === 2 && r.observed <= 1)).toBe(true)
  })

  it('a rumour of a hull puts nothing on the map', () => {
    const s = line()
    s.week = 1
    const ship = s.ships['s-xy' as ShipId]
    const e = recordEvent(s, Y, { kind: 'hull_arrived', valence: 'bad', against: null, favours: null, severity: 2, ship })
    const before = JSON.stringify(s.beliefs[s.player].ships)
    s.rumours.push({ event: { ...e }, origin: Y, born: 1, heard: { [Y]: 0, ['w-x' as WorldId]: 1 } })
    for (let i = 0; i < 20; i++) advanceWeek(s)
    // The rumour reached the desk (X is a lane away), but the ship sightings are exactly what the desk saw for itself.
    const view = buildPlayerView(s)
    expect(view.rumours.some((r) => r.snapshot.kind === 'event' && r.snapshot.event.ship?.id === ship.id)).toBe(true)
    const rumourIds = new Set(view.rumours.map((r) => r.id))
    for (const sighting of Object.values(view.known.ships)) expect(rumourIds.has(sighting.report)).toBe(false)
    expect(before).toBeDefined()
  })

  it('in a generated game the docks tell the desk of worlds no official letter has come from', () => {
    const s = newGame(21)
    for (let i = 0; i < 40; i++) advanceWeek(s)
    const view = buildPlayerView(s)
    expect(view.rumours.length).toBeGreaterThan(0)
    for (const r of view.rumours) {
      expect(r.channel === 'merchant' || r.channel === 'docks').toBe(true)
      expect(r.snapshot.kind).toBe('event')
    }
    expect(s.rumours.every((r) => s.week - r.born <= 26)).toBe(true)
    // The spread never leaves the chart.
    for (const r of s.rumours) for (const w of Object.keys(r.heard)) expect(s.worlds[w as WorldId]).toBeDefined()
    spreadRumours(s)
  })
})
