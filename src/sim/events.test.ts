import { describe, expect, it } from 'vitest'
import { EVENT_MEMORY, eventsAt, forgetOldEvents, recordEvent, unrestBand, unrestCrossed, unrestIsNews } from './events'
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

  it('unrest is news only when a world changes mood or reaches either end of the scale', () => {
    expect(unrestBand(0)).toBe('content')
    expect(unrestBand(1)).toBe('content')
    expect(unrestBand(2)).toBe('neutral')
    expect(unrestBand(5)).toBe('neutral')
    expect(unrestBand(6)).toBe('hostile')
    expect(unrestBand(10)).toBe('hostile')
    // Drifting within a mood is not news.
    expect(unrestCrossed(2, 3)).toBe(false)
    expect(unrestCrossed(4, 3)).toBe(false)
    expect(unrestCrossed(7, 8)).toBe(false)
    expect(unrestCrossed(3, 3)).toBe(false)
    // A change of mood is, either way.
    expect(unrestCrossed(1, 2)).toBe(true)
    expect(unrestCrossed(2, 1)).toBe(true)
    expect(unrestCrossed(5, 6)).toBe(true)
    expect(unrestCrossed(6, 5)).toBe(true)
    // So is settling completely, or open revolt.
    expect(unrestCrossed(1, 0)).toBe(true)
    expect(unrestCrossed(9, 10)).toBe(true)
    expect(unrestCrossed(10, 9)).toBe(false)
  })

  it('settling to nothing is news once, not every time a world flickers between one and none', () => {
    const s = newGame(7)
    const w = Object.keys(s.worlds).sort()[0] as WorldId
    s.week = 1
    expect(unrestIsNews(s, w, 1, 0)).toBe(true)
    recordEvent(s, w, { kind: 'unrest_fell', valence: 'good', severity: 1, level: 0 })
    s.week = 3
    expect(unrestIsNews(s, w, 1, 0)).toBe(false) // already told them
    expect(unrestIsNews(s, w, 1, 2)).toBe(true) // a change of mood is always news
    recordEvent(s, w, { kind: 'unrest_rose', valence: 'bad', severity: 1, level: 2 })
    s.week = 9
    expect(unrestIsNews(s, w, 1, 0)).toBe(true) // it had been unsettled since
  })

  it('a generated game records far fewer unrest events than unrest steps', () => {
    const s = newGame(7)
    let steps = 0
    for (let i = 0; i < 30; i++) {
      const before = Object.fromEntries(Object.values(s.worlds).map((w) => [w.id, w.unrest]))
      advanceWeek(s)
      for (const w of Object.values(s.worlds)) if (w.unrest !== before[w.id]) steps++
    }
    const events = Object.values(s.events).filter((e) => e.kind === 'unrest_rose' || e.kind === 'unrest_fell').length
    expect(steps).toBeGreaterThan(20)
    expect(events).toBeLessThan(steps / 2)
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
