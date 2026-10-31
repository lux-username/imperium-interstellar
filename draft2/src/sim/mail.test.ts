import { describe, expect, it } from 'vitest'
import { route } from './chart'
import { advanceWeek, newGame, takePassage, writeLetter } from './game'
import { characterLocation, envelopeOf, readerOf, snapshotWorld, writeReport } from './mail'
import { sailsOn } from './scouts'
import type { CharacterId, GameState, WorldId } from './types'

/** A second person, placed at `at`, so letters have somewhere to go. */
function someone(state: GameState, id: string, at: WorldId): CharacterId {
  const cid = id as CharacterId
  state.characters[cid] = { id: cid, name: id, culture: 'English', sex: 'm', empire: state.worlds[at].empire, body: { kind: 'world', world: at }, purse: 0, debt: null }
  return cid
}

/** A world on the chart from the player's seat, `hops` lanes away. */
function away(state: GameState, hops: number): WorldId {
  const home = characterLocation(state, state.player) as WorldId
  const ids = Object.keys(state.worlds).sort() as WorldId[]
  for (const id of ids) {
    const path = route(state.lanes, home, id)
    if (path && path.length === hops + 1) return id
  }
  throw new Error(`no world ${hops} hops away`)
}

/** Advance until a scout on the packets lies in port at `here`, and return her. */
function scoutHere(state: GameState, here: WorldId) {
  for (let i = 0; i < 12; i++) {
    const hull = Object.values(state.ships).find((s) => s.location.kind === 'world' && s.location.world === here && s.run)
    if (hull) return hull
    advanceWeek(state)
  }
  throw new Error('no scout called')
}

describe('mail', () => {
  it('reaches a body at its address after waiting plus one week a jump, and never sooner', () => {
    const state = newGame(3)
    const to = away(state, 2)
    const them = someone(state, 'c-them', to)
    const mail = writeLetter(state, them, to, 'hello')!
    const env = envelopeOf(mail)
    expect(env.route.length).toBe(3)
    expect(env.eta).not.toBeNull()
    let delivered: number | null = null
    for (let i = 0; i < 20 && delivered === null; i++) {
      advanceWeek(state)
      if (mail.status.kind === 'delivered') delivered = state.week
    }
    expect(delivered).toBe(env.eta)
    expect(delivered!).toBeGreaterThanOrEqual(env.sent + 2)
  })

  it('is held at the address when the reader is elsewhere, and handed over when they arrive', () => {
    const state = newGame(3)
    const to = away(state, 1)
    const elsewhere = away(state, 2)
    const them = someone(state, 'c-them', elsewhere)
    const mail = writeLetter(state, them, to, 'hello')!
    for (let i = 0; i < 12; i++) advanceWeek(state)
    expect(mail.status.kind).toBe('held')
    state.characters[them].body = { kind: 'world', world: to }
    advanceWeek(state)
    expect(mail.status.kind).toBe('delivered')
  })

  it('a report read by its reader enters their belief, and only theirs', () => {
    const state = newGame(4)
    const here = characterLocation(state, state.player) as WorldId
    const to = away(state, 1)
    const them = someone(state, 'c-them', here)
    const other = someone(state, 'c-other', to)
    const m = writeReport(state, state.player, here, snapshotWorld(state, state.worlds[here]), them, here, { subject: 'a word' })
    expect(readerOf(m)).toBe(them)
    expect(m.status.kind).toBe('delivered')
    expect(state.beliefs[them].worlds[here]).toBeDefined()
    expect(state.beliefs[other]?.worlds[here]).toBeUndefined()
  })

  it('follows a passenger: a letter to where the player is going arrives after they do', () => {
    const state = newGame(5)
    const here = characterLocation(state, state.player) as WorldId
    const hull = scoutHere(state, here)
    const lane = state.lanes[hull!.run!.lane]
    const to = lane.ends[0] === here ? lane.ends[1] : lane.ends[0]
    const sailing = sailsOn(state, hull!, here, state.week + 1)!
    const friend = someone(state, 'c-friend', here)
    // The friend writes ahead to the port the player is bound for.
    state.characters[friend].body = { kind: 'world', world: here }
    expect(takePassage(state, hull!.id)).toBe(true)
    const mail = writeReport(state, friend, here, snapshotWorld(state, state.worlds[here]), state.player, to, { subject: 'ahead' })
    while (state.week < sailing + 1) advanceWeek(state)
    expect(characterLocation(state, state.player)).toBe(to)
    for (let i = 0; i < 10 && mail.status.kind !== 'delivered'; i++) advanceWeek(state)
    expect(mail.status.kind).toBe('delivered')
    expect(state.beliefs[state.player].worlds[here].observedAt).toBe(here)
  })
})
