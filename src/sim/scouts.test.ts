import { describe, expect, it } from 'vitest'
import { playerTraits } from './characters'
import { HULLS, newShip } from './fleet'
import { advanceWeek, orderShip } from './game'
import type { CharacterId, GameState, ShipId, WorldId } from './types'
import { line, runUntil } from './fixtures.test-helper'

const C = 'w-c' as WorldId
const X = 'w-x' as WorldId
const S = 's-scout' as ShipId

function withScout(): GameState {
  const s = line()
  const cid = 'c-scout' as CharacterId
  s.characters[cid] = { id: cid, name: 'Eyes', faction: 'f-admin' as never, post: { kind: 'commander', ship: S }, traits: { ...playerTraits(), loyalty: 'self' } }
  s.ships[S] = newShip(S, 'Kestrel', HULLS.scout, 'f-admin' as never, C, s.characters[cid])
  return s
}

describe('a scout on watch', () => {
  it('lies off the world for the weeks ordered and then writes the one report nobody colours, with every hull that called', () => {
    const s = withScout()
    // Exe's governor shades unrest down by two in every letter; the truth is 7.
    s.characters['c-x' as CharacterId].traits.loyalty = 'self'
    s.worlds[X].unrest = 7
    orderShip(s, S, { kind: 'scout', world: X, weeks: 4, then: { kind: 'world', world: C }, lookedOn: null })
    advanceWeek(s) // sails
    advanceWeek(s) // arrives week 2, arrival letter
    expect(s.ships[S].location).toEqual({ kind: 'world', world: X })
    runUntil(s, (st) => st.ships[S].order?.kind !== 'scout', 12)
    const reports = Object.values(s.mail)
      .filter((m) => m.contents.kind === 'report' && m.contents.report.observer === 'c-scout')
      .map((m) => (m.contents.kind === 'report' ? m.contents.report : null))
    const watch = reports.find((r) => r?.channel === 'agent')
    expect(watch).toBeDefined()
    expect(watch?.observed).toBe(6) // arrived 2, watched 4
    // The truth, not the governor's version.
    expect(watch?.snapshot.kind === 'world' && watch.snapshot.world.unrest).toBe(s.worlds[X].unrest)
    // The stay's traffic is in it: the packets that called at Exe while she watched.
    const traffic = watch?.events.filter((e) => e.kind === 'hull_arrived' || e.kind === 'hull_departed') ?? []
    expect(traffic.length).toBeGreaterThan(0)
    for (const e of watch?.events ?? []) {
      expect(e.at).toBe(X)
      expect(e.week).toBeGreaterThanOrEqual(2)
      expect(e.week).toBeLessThanOrEqual(6)
    }
    // She goes home afterwards, and the report goes by packet since Exe is a friendly port on the lanes.
    expect(s.ships[S].order).toEqual({ kind: 'move', to: C, then: null })
    runUntil(s, () => watch?.delivered !== null, 20)
    expect(watch?.delivered).not.toBeNull()
  })

  it('a look is a week and an ordinary letter, as before', () => {
    const s = withScout()
    orderShip(s, S, { kind: 'scout', world: X, weeks: 1, then: { kind: 'world', world: C }, lookedOn: null })
    runUntil(s, (st) => st.ships[S].order?.kind !== 'scout' && st.week > 2, 12)
    const reports = Object.values(s.mail).filter((m) => m.contents.kind === 'report' && m.contents.report.observer === 'c-scout')
    expect(reports.length).toBe(1)
    expect(reports[0].contents.kind === 'report' && reports[0].contents.report.channel).toBe('official')
  })
})
