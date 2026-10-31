import { describe, expect, it } from 'vitest'
import { absorb, beliefFrom, emptyBelief, hear, stanceKnown } from './belief'
import type { EmpireId, ReportId, ShipId, WorldId } from './types'
import type { Report, WorldSnapshot } from './view'

const A = 'e-a' as EmpireId
const B = 'e-b' as EmpireId

function world(id: string, week: number, extra: Partial<WorldSnapshot> = {}): Report {
  const w = id as WorldId
  return {
    id: `r-${id}-${week}` as ReportId,
    channel: 'port',
    observer: null,
    observerName: 'port',
    subject: id,
    observedAt: w,
    observed: week,
    snapshot: { kind: 'world', world: { id: w, name: id, hex: { col: 1, row: 1 }, profile: { starport: 'B', size: 5, atmosphere: 6, hydrographics: 5, population: 5, government: 5, law: 5, tech: 9 }, empire: A, ships: [], people: [], board: [], market: {}, news: [], ...extra } },
    envelope: { origin: w, destination: w, sent: week, route: [w], eta: week },
    delivered: week,
  }
}

describe('the fold', () => {
  it('keeps the newest report per world whatever order they arrive in', () => {
    const b = emptyBelief()
    absorb(b, world('w1', 5))
    absorb(b, world('w1', 3))
    expect(b.worlds['w1' as WorldId].observed).toBe(5)
    absorb(b, world('w1', 9))
    expect(b.worlds['w1' as WorldId].observed).toBe(9)
  })

  it('sights hulls and people from a world report, newest wins', () => {
    const b = emptyBelief()
    const ship = { id: 's1' as ShipId, name: 'Wren', type: 'scout' as const, empire: A, at: 'w1' as WorldId, captain: null, captainName: null }
    absorb(b, world('w1', 4, { ships: [ship] }))
    absorb(b, world('w2', 2, { ships: [{ ...ship, at: 'w2' as WorldId }], people: [{ id: 'c1' as never, name: 'X', empire: A, at: 'w2' as WorldId, aboard: null }] }))
    expect(b.ships['s1' as ShipId].ship.at).toBe('w1')
    expect(b.people['c1' as never].person.at).toBe('w2')
  })

  it('ignores rumour and anything observed after the cut-off', () => {
    const r = world('w1', 6)
    const rumour = { ...world('w1', 8), channel: 'docks' as const, id: 'r-x' as ReportId }
    const b = beliefFrom([r, rumour], 7)
    expect(b.worlds['w1' as WorldId].observed).toBe(6)
    expect(beliefFrom([world('w1', 10)], 7).worlds['w1' as WorldId]).toBeUndefined()
  })

  it('hears declarations off a notice board, newest per pair', () => {
    const b = emptyBelief()
    expect(stanceKnown(b, A, B)).toBeNull()
    expect(hear(b, { pair: [A, B], stance: 'war', week: 10 })).toBe(true)
    expect(hear(b, { pair: [B, A], stance: 'peace', week: 8 })).toBe(false)
    expect(stanceKnown(b, B, A)?.stance).toBe('war')
    absorb(b, world('w1', 20, { board: [{ pair: [A, B], stance: 'peace', week: 15 }] }))
    expect(stanceKnown(b, A, B)?.stance).toBe('peace')
  })
})
