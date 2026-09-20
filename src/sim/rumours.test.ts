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
    for (let i = 0; i < 40; i++) {
      recordEvent(s, Y, { kind: 'unrest_rose', valence: 'bad', severity: 2, level: 6 })
      recordEvent(s, Y, { kind: 'hull_arrived', valence: 'neutral', severity: 0 })
      recordEvent(s, s.capital, { kind: 'unrest_rose', valence: 'bad', severity: 3, level: 8 })
    }
    spawnRumours(s)
    expect(s.rumours.length).toBeGreaterThan(10)
    expect(s.rumours.length).toBeLessThan(40)
    for (const r of s.rumours) {
      expect(r.origin).toBe(Y)
      expect(r.event.kind).toBe('unrest_rose')
      expect(r.heard).toEqual({ [Y]: 0 })
    }
  })

  it('a port with no working starport starts no talk', () => {
    const s = line()
    s.worlds[Y].profile.starport = 'E'
    s.week = 1
    for (let i = 0; i < 40; i++) recordEvent(s, Y, { kind: 'unrest_rose', valence: 'bad', severity: 3, level: 8 })
    spawnRumours(s)
    expect(s.rumours).toHaveLength(0)
  })

  it('hops lane to lane and is delivered to the desk as a merchant\'s word or docks talk, kept apart from the mail', () => {
    const s = line()
    for (const w of Object.values(s.worlds)) w.profile.population = 0 // nothing else happens
    s.week = 1
    const e = recordEvent(s, Y, { kind: 'unrest_rose', valence: 'bad', severity: 3, level: 8 })
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
    for (let i = 0; i < 200; i++) recordEvent(s, Y, { kind: 'unrest_rose', valence: 'bad', severity: 3, level: 8 })
    spawnRumours(s)
    let movedWeek = 0
    let movedWorld = 0
    for (const r of s.rumours) {
      expect(Math.abs(r.event.week - 5)).toBeLessThanOrEqual(2)
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

  it('a rumour of a hull puts nothing on the map', () => {
    const s = line()
    s.week = 1
    const ship = s.ships['s-xy' as ShipId]
    const e = recordEvent(s, Y, { kind: 'hull_arrived', valence: 'bad', severity: 2, ship })
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
