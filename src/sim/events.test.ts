import { describe, expect, it } from 'vitest'
import { EVENT_MEMORY, eventsAt, forgetOldEvents, recordEvent } from './events'
import { advanceWeek, newGame } from './game'
import { buildPlayerView } from './player'
import type { WorldId } from './types'

describe('events', () => {
  it('a new game has no events yet: nothing that happened before the desk sat down is news', () => {
    const s = newGame(7)
    expect(Object.keys(s.events)).toHaveLength(0)
  })

  it('the week records unrest steps, governor changes and hull movements at the worlds they happen at', () => {
    const s = newGame(7)
    for (let i = 0; i < 12; i++) advanceWeek(s)
    const all = Object.values(s.events)
    expect(all.length).toBeGreaterThan(0)
    const kinds = new Set(all.map((e) => e.kind))
    expect(kinds.has('hull_arrived')).toBe(true)
    expect(kinds.has('hull_departed')).toBe(true)
    for (const e of all) {
      expect(s.worlds[e.at], e.id).toBeDefined()
      expect(e.week).toBeGreaterThanOrEqual(1)
      expect(e.week).toBeLessThanOrEqual(s.week)
      if (e.kind === 'unrest_rose') expect(e.valence).toBe('bad')
      if (e.kind === 'unrest_fell') expect(e.valence).toBe('good')
      if (e.kind === 'hull_arrived' || e.kind === 'hull_departed') expect(e.ship).not.toBeNull()
    }
  })

  it('eventsAt lists a world\'s events in a week range, oldest first', () => {
    const s = newGame(7)
    const w = Object.keys(s.worlds).sort()[0] as WorldId
    s.week = 3
    recordEvent(s, w, { kind: 'unrest_rose', valence: 'bad', severity: 1, level: 2 })
    s.week = 5
    recordEvent(s, w, { kind: 'unrest_fell', valence: 'good', severity: 1, level: 1 })
    expect(eventsAt(s, w, 0, 10).map((e) => e.kind)).toEqual(['unrest_rose', 'unrest_fell'])
    expect(eventsAt(s, w, 4, 10).map((e) => e.kind)).toEqual(['unrest_fell'])
  })

  it('forgets events nobody could still be talking about', () => {
    const s = newGame(7)
    const w = Object.keys(s.worlds).sort()[0] as WorldId
    s.week = 1
    const old = recordEvent(s, w, { kind: 'unrest_rose', valence: 'bad', severity: 1, level: 2 })
    s.week = 2 + EVENT_MEMORY
    const recent = recordEvent(s, w, { kind: 'unrest_rose', valence: 'bad', severity: 1, level: 3 })
    forgetOldEvents(s)
    expect(s.events[old.id]).toBeUndefined()
    expect(s.events[recent.id]).toBeDefined()
  })

  it('every report the desk holds names its channel, and rumours and mail are separate piles', () => {
    const s = newGame(7)
    for (let i = 0; i < 8; i++) advanceWeek(s)
    const view = buildPlayerView(s)
    expect(view.inbox.length).toBeGreaterThan(0)
    expect(view.inbox.every((r) => r.channel === 'official' || r.channel === 'agent')).toBe(true)
    expect(view.rumours.every((r) => r.channel === 'merchant' || r.channel === 'docks')).toBe(true)
  })
})
