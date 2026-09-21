import { describe, expect, it } from 'vitest'
import { recordEvent } from './events'
import { advanceWeek, newGame, requestReport } from './game'
import { discloses, governorLetter, quietInterval } from './governors'
import { buildPlayerView } from './player'
import { createRng } from './rng'
import type { Character, CharacterId, Traits, WorldId } from './types'
import type { Event, EventId } from './view'
import { line, runUntil } from './fixtures.test-helper'

const X = 'w-x' as WorldId
const C = 'w-c' as WorldId

function person(traits: Partial<Traits>): Character {
  return {
    id: 'c-t' as CharacterId,
    name: 'T',
    faction: 'f-admin' as Character['faction'],
    post: { kind: 'governor', world: X },
    traits: { loyalty: 'player', initiative: 0, competence: { administrative: 0, naval: 0, diplomatic: 0 }, ambition: 0, ...traits },
  }
}

function event(kind: Event['kind'], valence: Event['valence'], severity: number, level: number | null = null): Event {
  return { id: 'e-t' as EventId, at: X, week: 1, kind, valence, severity, ship: null, person: null, level }
}

/** How often a governor discloses an event, over many rolls. */
function rate(traits: Partial<Traits>, e: Event): number {
  const rng = createRng(1)
  let yes = 0
  for (let i = 0; i < 2000; i++) if (discloses(rng, person(traits), e)) yes++
  return yes / 2000
}

describe('what a governor chooses to say', () => {
  it('good news always goes out; routine traffic never does; a new governor introduces themselves', () => {
    expect(rate({ loyalty: 'self', initiative: 2 }, event('unrest_fell', 'good', 1))).toBe(1)
    expect(rate({ loyalty: 'player', initiative: -2 }, event('hull_arrived', 'neutral', 0))).toBe(0)
    expect(rate({ loyalty: 'self' }, event('governor_changed', 'neutral', 1))).toBe(1)
  })

  it('bad news is buried by the self-serving and the bold, sent by the loyal and the cautious, and harder to sit on as it gets worse', () => {
    const mild = event('unrest_rose', 'bad', 1, 4)
    const grave = event('unrest_rose', 'bad', 3, 8)
    const loyalCautious = rate({ loyalty: 'player', initiative: -2 }, mild)
    const ordinary = rate({}, mild)
    const selfBold = rate({ loyalty: 'self', initiative: 2 }, mild)
    expect(loyalCautious).toBeGreaterThan(ordinary)
    expect(ordinary).toBeGreaterThan(selfBold)
    expect(selfBold).toBeLessThan(0.1)
    expect(rate({ loyalty: 'self', initiative: 2 }, grave)).toBeGreaterThan(selfBold)
    expect(rate({}, grave)).toBeGreaterThan(0.8)
  })

  it('a self-serving governor\'s letter shows the world calmer than it is', () => {
    const s = line()
    s.worlds[X].unrest = 7
    s.characters['c-x' as CharacterId].traits.loyalty = 'self'
    const mail = governorLetter(s, s.worlds[X], [event('unrest_rose', 'bad', 2, 7)])!
    const report = mail.contents.kind === 'report' ? mail.contents.report : null
    expect(report?.snapshot.kind === 'world' && report.snapshot.world.unrest).toBe(5)
    expect(report?.events[0].level).toBe(5)
    // The truth is untouched.
    expect(s.worlds[X].unrest).toBe(7)
    s.characters['c-x' as CharacterId].traits.loyalty = 'player'
    const honest = governorLetter(s, s.worlds[X], [])!
    expect(honest.contents.kind === 'report' && honest.contents.report.snapshot.kind === 'world' && honest.contents.report.snapshot.world.unrest).toBe(7)
  })

  it('a quiet world writes only its "all quiet" letter, on its own interval, so silence means something', () => {
    const s = line()
    // Nothing happens on an empty world, so the only letters are routine ones.
    for (const w of Object.values(s.worlds)) w.profile.population = 0
    const gap = quietInterval(s.worlds[X])
    expect(gap).toBeGreaterThanOrEqual(8)
    expect(gap).toBeLessThanOrEqual(12)
    for (let i = 0; i < 3 * gap; i++) advanceWeek(s)
    const letters = Object.values(s.mail)
      .filter((m) => m.contents.kind === 'report' && m.contents.report.observer === 'c-x')
      .map((m) => (m.contents.kind === 'report' ? m.contents.report.observed : 0))
      .sort((a, b) => a - b)
    expect(letters).toEqual([gap, 2 * gap, 3 * gap])
    expect(Object.values(s.mail).every((m) => m.contents.kind !== 'report' || m.contents.report.events.length === 0)).toBe(true)
  })

  it('something worth mentioning brings a letter that week, and resets the quiet clock', () => {
    const s = line()
    for (const w of Object.values(s.worlds)) w.profile.population = 0
    s.characters['c-x' as CharacterId].traits.initiative = -2
    advanceWeek(s) // week 1
    advanceWeek(s) // week 2
    s.week = 3
    recordEvent(s, X, { kind: 'unrest_fell', valence: 'good', severity: 1, level: 1 })
    s.week = 2
    advanceWeek(s) // week 3: the event is this week's
    const letter = Object.values(s.mail).find((m) => m.contents.kind === 'report' && m.contents.report.observer === 'c-x')!
    expect(letter.contents.kind === 'report' && letter.contents.report.observed).toBe(3)
    expect(letter.contents.kind === 'report' && letter.contents.report.events.map((e) => e.kind)).toEqual(['unrest_fell'])
    expect(s.worlds[X].lastLetter).toBe(3)
    // The next routine letter counts from here.
    const gap = quietInterval(s.worlds[X])
    for (let i = 0; i < gap; i++) advanceWeek(s)
    const observed = Object.values(s.mail)
      .filter((m) => m.contents.kind === 'report' && m.contents.report.observer === 'c-x')
      .map((m) => (m.contents.kind === 'report' ? m.contents.report.observed : 0))
    expect(observed.sort((a, b) => a - b)).toEqual([3, 3 + gap])
  })

  it('a letter from the desk forces a report, still in the governor\'s own colours', () => {
    const s = line()
    for (const w of Object.values(s.worlds)) w.profile.population = 0
    s.worlds[X].unrest = 6
    s.characters['c-x' as CharacterId].traits.loyalty = 'self'
    const ask = requestReport(s, X, 'c-x' as CharacterId)
    runUntil(s, () => ask.status.kind === 'delivered', 10)
    const reply = Object.values(s.mail).find((m) => m.contents.kind === 'report' && m.contents.report.observer === 'c-x' && m.contents.report.observed === s.week)
    expect(reply).toBeDefined()
    expect(reply?.contents.kind === 'report' && reply.contents.report.snapshot.kind === 'world' && reply.contents.report.snapshot.world.unrest).toBe(4)
    expect(s.worlds[X].lastLetter).toBe(s.week)
  })

  it('in a generated game, letters mention only what happened where they were written, and never routine traffic', () => {
    const s = newGame(5)
    for (let i = 0; i < 30; i++) advanceWeek(s)
    const view = buildPlayerView(s)
    const letters = view.inbox.filter((r) => r.events.length > 0)
    expect(letters.length).toBeGreaterThan(0)
    for (const r of letters) {
      for (const e of r.events) {
        expect(e.at).toBe(r.observedAt)
        // Routine traffic is never news; a hull of another faction making port is.
        if (e.kind === 'hull_arrived') expect(e.ship?.faction).not.toBe(view.faction)
        expect(e.kind === 'hull_departed').toBe(false)
        expect(e.week).toBeLessThanOrEqual(r.observed)
      }
    }
    expect(view.chart[C]).toBeUndefined()
  })
})
