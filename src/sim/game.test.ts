import { describe, expect, it } from 'vitest'
import { advanceWeek, newGame, requestReport } from './game'
import { route } from './lanes'
import { departShips, governorReports } from './mail'
import { buildPlayerView } from './player'
import { createRng } from './rng'
import { clone, deserialize, serialize } from './save'
import type { CharacterId, FactionId, GameState, LaneId, ShipId, WorldId } from './types'

/**
 * A hand-built chart: capital C — X — Y in a line. C–X packets turn straight
 * around (interval 2, phase 0); X–Y packets lie over a week at each end
 * (interval 4, phase 1). Governors at X and Y; nobody writes unless asked.
 */
function line(): GameState {
  const C = 'w-c' as WorldId
  const X = 'w-x' as WorldId
  const Y = 'w-y' as WorldId
  const admin = 'f-admin' as FactionId
  const player = 'c-player' as CharacterId
  const govX = 'c-x' as CharacterId
  const govY = 'c-y' as CharacterId
  const profile = { starport: 'B' as const, size: 5, atmosphere: 6, hydrographics: 5, population: 5, government: 5, law: 5, tech: 9 }
  const world = (id: WorldId, name: string, col: number, gov: CharacterId) => ({
    id, name, hex: { col, row: 5 }, profile: { ...profile }, faction: admin, governor: gov, actingGovernor: gov, unrest: 0, garrison: 5,
  })
  const cx = 'l-c-x' as LaneId
  const xy = 'l-x-y' as LaneId
  const pcx = 's-cx' as ShipId
  const pxy = 's-xy' as ShipId
  const state: GameState = {
    seed: 0,
    week: 0,
    rng: createRng(0),
    nextId: 1,
    capital: C,
    player,
    worlds: { [C]: world(C, 'Capital', 1, player), [X]: world(X, 'Exe', 2, govX), [Y]: world(Y, 'Wye', 3, govY) },
    lanes: {
      [cx]: { id: cx, ends: [C, X], jumpDistance: 1, schedule: { interval: 2, phase: 0 } },
      [xy]: { id: xy, ends: [X, Y], jumpDistance: 1, schedule: { interval: 4, phase: 1 } },
    },
    ships: {
      [pcx]: { id: pcx, name: 'P1', role: 'packet', faction: admin, jump: 1, location: { kind: 'world', world: C }, commander: null, order: { kind: 'courier', route: [C, X], then: null, repeat: true }, mailbag: [] },
      [pxy]: { id: pxy, name: 'P2', role: 'packet', faction: admin, jump: 1, location: { kind: 'world', world: X }, commander: null, order: { kind: 'courier', route: [X, Y], then: null, repeat: true }, mailbag: [] },
    },
    characters: {
      [player]: { id: player, name: 'Gov', faction: admin, post: { kind: 'governor', world: C } },
      [govX]: { id: govX, name: 'Ex', faction: admin, post: { kind: 'governor', world: X } },
      [govY]: { id: govY, name: 'Wy', faction: admin, post: { kind: 'governor', world: Y } },
    },
    factions: { [admin]: { id: admin, name: 'Admin', kind: 'administration' } },
    mail: {},
    beliefs: { [player]: { worlds: {}, ships: {} } },
  }
  departShips(state) // as newGame() does: week 0's sailings are already under way
  return state
}

/** Run weeks until `until(state)` holds or `limit` weeks pass. */
function runUntil(state: GameState, until: (s: GameState) => boolean, limit = 60): void {
  while (!until(state) && state.week < limit) advanceWeek(state)
}

describe('report propagation', () => {
  it('a report from the next world arrives after the wait for a packet plus one jump', () => {
    const s = line()
    // Make the schedule the only thing that writes: the line's hexes report on weeks where (w + col*3 + 5) % 4 == 0.
    // X has col 2 → weeks 1, 5, 9…; we write by hand at week 0 and read the first arrival instead.
    const [mail] = governorReports(s, s.worlds['w-x' as WorldId])
    const report = mail.contents.kind === 'report' ? mail.contents.report : null
    expect(report?.envelope.route).toEqual(['w-x', 'w-c'])
    // C–X packet leaves C on even weeks, X on odd weeks. Written week 0 at X: waits to week 1, lands week 2.
    expect(report?.envelope.eta).toBe(2)
    runUntil(s, () => report?.delivered !== null)
    expect(report?.delivered).toBe(2)
    // Exe's governor also wrote on schedule at week 1 and that landed the same week; the newer observation holds.
    expect(s.beliefs[s.player].worlds['w-x' as WorldId].observed).toBeGreaterThanOrEqual(report?.observed ?? 0)
  })

  it('a report two lanes out transships and arrives when the timetable says', () => {
    const s = line()
    const [mail] = governorReports(s, s.worlds['w-y' as WorldId])
    const report = mail.contents.kind === 'report' ? mail.contents.report : null
    expect(report?.envelope.route).toEqual(['w-y', 'w-x', 'w-c'])
    // X–Y packet leaves Y on weeks 3, 7, …; lands X week 4. C–X packet leaves X on odd weeks: 5. Lands C week 6.
    expect(report?.envelope.eta).toBe(6)
    runUntil(s, () => report?.delivered !== null)
    expect(report?.delivered).toBe(6)
  })

  it('a newer observation wins over a later-delivered older one', () => {
    const s = line()
    const Y = 'w-y' as WorldId
    const [slow] = governorReports(s, s.worlds[Y]) // observed week 0, arrives week 6
    advanceWeek(s) // week 1
    s.worlds[Y].unrest = 9
    // The player hears it directly this once, as if by a fast courier: learn a week-1 observation now.
    const [fresh] = governorReports(s, s.worlds[Y])
    const freshReport = fresh.contents.kind === 'report' ? fresh.contents.report : null
    expect(freshReport).not.toBeNull()
    runUntil(s, () => (slow.contents.kind === 'report' ? slow.contents.report.delivered !== null : false))
    // Both are delivered now (plus whatever Wye's governor wrote on schedule); the week-0 observation never wins.
    const known = s.beliefs[s.player].worlds[Y]
    expect(slow.contents.kind === 'report' && slow.contents.report.delivered).not.toBeNull()
    expect(known.observed).toBeGreaterThanOrEqual(1)
    expect(known).not.toBe(slow.contents.kind === 'report' ? slow.contents.report : null)
  })
})

describe('dispatches', () => {
  it('a letter to a governor is delivered on the timetable and answered by return packet', () => {
    const s = line()
    const Y = 'w-y' as WorldId
    const mail = requestReport(s, Y, 'c-y' as CharacterId)
    const dispatch = mail.contents.kind === 'dispatch' ? mail.contents.dispatch : null
    // Posted after week 0's sailings. C→X leaves on even weeks: week 2, lands week 3. X→Y leaves X on weeks 1, 5…: week 5, lands week 6.
    expect(dispatch?.envelope.sent).toBe(1)
    expect(dispatch?.envelope.eta).toBe(6)
    runUntil(s, () => mail.status.kind === 'delivered')
    expect(mail.status).toEqual({ kind: 'delivered', week: 6 })
    // The reply is written at Y on week 6; Y→X leaves on weeks 3, 7…: week 7, lands 8; X→C leaves on odd weeks: 9, lands 10.
    const reply = Object.values(s.mail).find((m) => m.contents.kind === 'report' && m.contents.report.observer === 'c-y' && m.contents.report.observed === 6)
    expect(reply).toBeDefined()
    runUntil(s, () => reply?.status.kind === 'delivered')
    expect(reply?.status).toEqual({ kind: 'delivered', week: 10 })
    expect(buildPlayerView(s).outgoing.map((d) => d.id)).toEqual([dispatch?.id])
  })

  it('a letter to a replaced governor is opened by the office and still answered', () => {
    const s = line()
    const X = 'w-x' as WorldId
    const mail = requestReport(s, X, 'c-x' as CharacterId)
    // The governor the player wrote to is gone before the letter lands.
    s.characters['c-x' as CharacterId].post = { kind: 'unassigned' }
    s.characters['c-x2' as CharacterId] = { id: 'c-x2' as CharacterId, name: 'New', faction: 'f-admin' as FactionId, post: { kind: 'governor', world: X } }
    s.worlds[X].governor = 'c-x2' as CharacterId
    s.worlds[X].actingGovernor = 'c-x2' as CharacterId
    runUntil(s, () => mail.status.kind !== 'awaiting_carrier' && mail.status.kind !== 'aboard')
    expect(mail.status.kind).toBe('delivered')
    const reply = Object.values(s.mail).find((m) => m.contents.kind === 'report' && m.contents.report.observer === 'c-x2')
    expect(reply).toBeDefined()
  })
})

describe('a generated game', () => {
  it('is deterministic: same seed, same weeks, identical state', () => {
    const a = newGame(2026)
    const b = newGame(2026)
    for (let i = 0; i < 20; i++) {
      advanceWeek(a)
      advanceWeek(b)
    }
    expect(a).toEqual(b)
  })

  it('survives save and load and carries on identically', () => {
    const a = newGame(31)
    for (let i = 0; i < 5; i++) advanceWeek(a)
    const b = deserialize(serialize(a))
    expect(b).toEqual(a)
    for (let i = 0; i < 10; i++) {
      advanceWeek(a)
      advanceWeek(b)
    }
    expect(b).toEqual(a)
    expect(() => deserialize('{"format":"other"}')).toThrow()
  })

  it('delivers every routine report exactly when its envelope said it would', () => {
    const s = newGame(12)
    for (let i = 0; i < 40; i++) advanceWeek(s)
    let checked = 0
    for (const m of Object.values(s.mail)) {
      if (m.contents.kind !== 'report' || m.status.kind !== 'delivered') continue
      const r = m.contents.report
      expect(r.delivered, r.id).toBe(r.envelope.eta)
      checked++
    }
    expect(checked).toBeGreaterThan(20)
  })

  it('never gets mail out of an off-lane world', () => {
    const s = newGame(12)
    const offLane = Object.values(s.worlds).filter((w) => w.id !== s.capital && route(s.lanes, w.id, s.capital) === null)
    expect(offLane.length).toBeGreaterThan(0)
    for (let i = 0; i < 30; i++) advanceWeek(s)
    for (const w of offLane) {
      for (const m of Object.values(s.mail)) {
        if (m.contents.kind === 'report' && m.contents.report.observedAt === w.id) expect(m.status).toEqual({ kind: 'awaiting_carrier', at: w.id })
      }
      // The desk still shows only the opening survey for it.
      expect(s.beliefs[s.player].worlds[w.id].observed).toBeLessThan(0)
    }
  })

  it('starts with a survey of every world, older for worlds off the lanes', () => {
    const s = newGame(4)
    const view = buildPlayerView(s)
    for (const w of Object.values(s.worlds)) {
      const known = view.known.worlds[w.id]
      expect(known, w.name).toBeDefined()
      if (w.id === s.capital) expect(known.observed).toBe(0)
      else if (route(s.lanes, w.id, s.capital) === null) expect(known.observed).toBeLessThanOrEqual(-24)
    }
  })

  it('hands the UI a view with no ground truth in it', () => {
    const s = newGame(4)
    advanceWeek(s)
    const view = buildPlayerView(s)
    expect(Object.keys(view).sort()).toEqual(['capital', 'chart', 'inbox', 'known', 'lanes', 'outgoing', 'week'])
    // The view is independent of the state it came from: mutating truth doesn't move it.
    const copy = clone(s)
    for (const w of Object.values(copy.worlds)) w.unrest = 10
    expect(buildPlayerView(copy).known).toEqual(view.known)
  })
})
