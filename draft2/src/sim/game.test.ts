import { describe, expect, it } from 'vitest'
import { route } from './chart'
import { advanceWeek, newGame, PLAYER, takePassage } from './game'
import { characterLocation } from './mail'
import { buildPlayerView } from './player'
import { stanceKnown } from './belief'
import { clone, deserialize, serialize } from './save'
import { stanceKey, stancePair, type GameState, type WorldId } from './types'

function scoutHere(state: GameState, here: WorldId) {
  for (let i = 0; i < 12; i++) {
    const hull = Object.values(state.ships).find((s) => s.location.kind === 'world' && s.location.world === here && s.run)
    if (hull) return hull
    advanceWeek(state)
  }
  throw new Error('no scout called')
}

describe('the game', () => {
  it('is deterministic over thirty weeks from a seed', () => {
    const a = newGame(9)
    const b = newGame(9)
    for (let i = 0; i < 30; i++) {
      advanceWeek(a)
      advanceWeek(b)
    }
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('starts the player at the first empire\'s seat with a stale chart of every world and a fresh sight of home', () => {
    const state = newGame(2)
    const view = buildPlayerView(state)
    const first = Object.values(state.empires).sort((x, y) => (x.id < y.id ? -1 : 1))[0]
    expect(view.body).toEqual({ kind: 'world', world: first.seat })
    expect(view.player.empire).toBe(first.id)
    for (const id of Object.keys(state.worlds) as WorldId[]) {
      const known = view.known.worlds[id]
      expect(known, id).toBeDefined()
      if (id === first.seat) expect(known.observed).toBe(0)
      else expect(known.observed).toBeLessThan(0)
    }
    expect(view.here?.world).toBe(first.seat)
  })

  it('news of a declaration travels no faster than a jump a week', () => {
    const state = newGame(7)
    // Force the first declaration now.
    const key = Object.keys(state.stances).sort()[0]
    state.stances[key].until = state.week + 1
    advanceWeek(state)
    const d = state.declarations[0]
    expect(d).toBeDefined()
    expect(stanceKey(d.pair[0], d.pair[1])).toBe(key)
    expect(stancePair(key)).toEqual(d.pair)
    const seats = d.pair.map((e) => state.empires[e].seat)
    for (const s of seats) expect(state.worlds[s].board[key]?.week).toBe(d.week)
    // Every other world: the board can only carry the news once enough weeks have passed for a hull to bring it.
    for (let i = 0; i < 12; i++) {
      advanceWeek(state)
      for (const w of Object.values(state.worlds)) {
        const heard = w.board[key]
        if (!heard) continue
        const hops = Math.min(...seats.map((s) => route(state.lanes, s, w.id)?.length ?? Number.POSITIVE_INFINITY)) - 1
        expect(state.week - d.week, `${w.name} heard too soon`).toBeGreaterThanOrEqual(hops)
      }
    }
    // And the player, standing still at a seat, knows it only if their seat is one of the two or a hull has brought it.
    const known = stanceKnown(state.beliefs[PLAYER], d.pair[0], d.pair[1])
    const home = characterLocation(state, PLAYER) as WorldId
    if (known) expect(state.worlds[home].board[key]).toBeDefined()
  })

  it('stances flip when their term runs out and both seats post it', () => {
    const state = newGame(11)
    for (const k of Object.keys(state.stances)) state.stances[k].until = 2
    advanceWeek(state)
    advanceWeek(state)
    expect(state.declarations.length).toBe(3)
    for (const d of state.declarations) {
      expect(d.stance).toBe('war')
      expect(state.stances[stanceKey(d.pair[0], d.pair[1])].until).toBeGreaterThanOrEqual(2 + 52)
    }
  })

  it('passage moves the player one lane in one week and their eyes go with them', () => {
    const state = newGame(6)
    const here = characterLocation(state, PLAYER) as WorldId
    const hull = scoutHere(state, here)
    expect(takePassage(state, hull.id)).toBe(true)
    const lane = state.lanes[hull.run!.lane]
    const to = lane.ends[0] === here ? lane.ends[1] : lane.ends[0]
    let moved = false
    for (let i = 0; i < 8 && !moved; i++) {
      advanceWeek(state)
      if (characterLocation(state, PLAYER) === to) moved = true
    }
    expect(moved).toBe(true)
    const view = buildPlayerView(state)
    expect(view.known.worlds[to].observed).toBe(state.week)
    expect(view.here?.world).toBe(to)
  })

  it('keeps mail only for the player; anyone else holds the fold alone', () => {
    const state = newGame(8)
    for (let i = 0; i < 5; i++) advanceWeek(state)
    for (const m of Object.values(state.mail)) expect(m.contents.kind === 'dispatch' || m.reader === PLAYER).toBe(true)
  })
})

describe('save', () => {
  it('round-trips and continues identically', () => {
    const state = newGame(12)
    for (let i = 0; i < 5; i++) advanceWeek(state)
    const loaded = deserialize(serialize(state))
    expect(loaded).toEqual(clone(state))
    advanceWeek(state)
    advanceWeek(loaded)
    expect(JSON.stringify(loaded)).toBe(JSON.stringify(state))
  })

  it('refuses the wrong format or version', () => {
    expect(() => deserialize('{"format":"x"}')).toThrow()
    expect(() => deserialize(JSON.stringify({ format: 'imperium-interstellar/draft2', version: 99, state: {} }))).toThrow(/version/)
  })
})
