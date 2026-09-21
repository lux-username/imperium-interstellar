import { describe, expect, it } from 'vitest'
import { advanceWeek, newGame, requestReport } from './game'
import { route } from './chart'
import { governorLetter } from './governors'
import { buildPlayerView } from './player'
import { playerTraits } from './characters'
import { clone, deserialize, serialize } from './save'
import type { CharacterId, FactionId, WorldId } from './types'
import { isRumour } from './view'
import { line, runUntil } from './fixtures.test-helper'

describe('report propagation', () => {
  it('a report from the next world arrives after the wait for a packet plus one jump', () => {
    const s = line()
    // Make the schedule the only thing that writes: the line's hexes report on weeks where (w + col*3 + 5) % 4 == 0.
    // X has col 2 → weeks 1, 5, 9…; we write by hand at week 0 and read the first arrival instead.
    const mail = governorLetter(s, s.worlds['w-x' as WorldId], [])!
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
    const mail = governorLetter(s, s.worlds['w-y' as WorldId], [])!
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
    const slow = governorLetter(s, s.worlds[Y], [])! // observed week 0, arrives week 6
    advanceWeek(s) // week 1
    s.worlds[Y].unrest = 9
    // The player hears it directly this once, as if by a fast courier: learn a week-1 observation now.
    const fresh = governorLetter(s, s.worlds[Y], [])!
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
    s.characters['c-x' as CharacterId].post = { kind: 'unassigned', at: X }
    s.characters['c-x2' as CharacterId] = { id: 'c-x2' as CharacterId, name: 'New', faction: 'f-admin' as FactionId, post: { kind: 'governor', world: X }, traits: playerTraits() }
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

  it('delivers most routine reports when their envelopes said; a hull passing may bring one early, a raider may make one late', () => {
    const s = newGame(12)
    for (let i = 0; i < 40; i++) advanceWeek(s)
    let checked = 0
    let onTime = 0
    for (const m of Object.values(s.mail)) {
      if (m.contents.kind !== 'report' || m.status.kind !== 'delivered') continue
      const r = m.contents.report
      if (isRumour(r.channel) || r.envelope.eta === null) continue // talk keeps no timetable
      // Governors' letters to the desk ride the packets; a commander's letter may come home faster aboard his own hull,
      // and a packet chased off her lane by a raider may land a letter early by another route (the envelope shows the re-routing).
      if (r.envelope.destination.kind !== 'world' || r.envelope.destination.world !== s.capital || s.characters[r.observer]?.post.kind !== 'governor') continue
      if (r.envelope.route[0] !== r.envelope.origin) continue
      if (r.delivered === r.envelope.eta) onTime++
      checked++
    }
    expect(checked).toBeGreaterThan(20)
    // The timetable is exact until something disturbs it; with raiders about, most letters still keep it.
    expect(onTime / checked).toBeGreaterThan(0.6)
  })

  it('learns where hulls are from world reports, one report per governor letter', () => {
    const s = newGame(12)
    for (let i = 0; i < 20; i++) advanceWeek(s)
    const view = buildPlayerView(s)
    // Every sighting cites the letter it came from: a world report that listed the hull in port, or a questioned prize's own.
    expect(view.inbox.every((r) => r.snapshot.kind === 'world' || r.snapshot.kind === 'ship')).toBe(true)
    const sightings = Object.values(view.known.ships)
    expect(sightings.length).toBeGreaterThan(3)
    let fromMail = 0
    for (const sighting of sightings) {
      const source = view.inbox.find((r) => r.id === sighting.report)
      if (!source) {
        // Seen from the desk itself: the capital is observed directly, not by mail.
        expect(sighting.report).toMatch(/^r-desk-/)
        expect(sighting.ship.at).toBe(s.capital)
        continue
      }
      fromMail++
      const cited = source.snapshot.kind === 'world' ? source.snapshot.world.ships.some((sh) => sh.id === sighting.ship.id) : source.snapshot.kind === 'ship' && source.snapshot.ship.id === sighting.ship.id
      expect(cited).toBe(true)
      expect(sighting.observed).toBe(source.observed)
    }
    expect(fromMail).toBeGreaterThan(0)
  })

  it('never gets mail out of an off-lane world', () => {
    const s = newGame(12)
    // The desk's own worlds off the lanes; the Warlord's write to his seat, not ours.
    const offLane = Object.values(s.worlds).filter((w) => w.id !== s.capital && w.faction === s.characters[s.player].faction && route(s.lanes, w.id, s.capital) === null)
    expect(offLane.length).toBeGreaterThan(0)
    for (let i = 0; i < 30; i++) advanceWeek(s)
    for (const w of offLane) {
      for (const m of Object.values(s.mail)) {
        if (m.contents.kind !== 'report' || m.contents.report.observedAt !== w.id) continue
        const dest = m.contents.report.envelope.destination
        if (dest.kind !== 'world' || dest.world !== s.capital) continue // the Warlord's people write to his seat
        expect(m.status).toEqual({ kind: 'awaiting_carrier', at: w.id })
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
    expect(Object.keys(view).sort()).toEqual(['capital', 'chart', 'ending', 'faction', 'factions', 'inbox', 'known', 'lanes', 'outgoing', 'pool', 'reserve', 'roster', 'rumours', 'week'])
    // The view is independent of the state it came from: mutating truth doesn't move it.
    const copy = clone(s)
    for (const w of Object.values(copy.worlds)) w.unrest = 10
    expect(buildPlayerView(copy).known).toEqual(view.known)
  })
})

describe('the desk reads only its own mail', () => {
  it('never shows a letter addressed to the Warlord’s seat, nor talk heard there', () => {
    const s = newGame(7)
    for (let i = 0; i < 30; i++) advanceWeek(s)
    const view = buildPlayerView(s)
    for (const r of [...view.inbox, ...view.rumours]) {
      expect(r.envelope.destination).toEqual({ kind: 'world', world: s.capital })
    }
    // And his seat did get letters of its own.
    const his = Object.values(s.mail).filter((m) => m.contents.kind === 'report' && m.status.kind === 'delivered' && m.contents.report.envelope.destination.kind === 'world' && m.contents.report.envelope.destination.world !== s.capital)
    expect(his.length).toBeGreaterThan(0)
  })
})
