/**
 * Hand-built worlds for tests. Not a sim module: nothing in src/sim imports
 * this, and the module list in CLAUDE.md excludes it by name.
 */
import { advanceWeek } from './game'
import { departShips } from './ships'
import { playerTraits } from './characters'
import { createRng } from './rng'
import { startingFactions } from './factions'
import type { CharacterId, FactionId, GameState, LaneId, ShipId, WorldId } from './types'

/**
 * A hand-built chart: capital C — X — Y in a line. C–X packets turn straight
 * around (interval 2, phase 0); X–Y packets lie over a week at each end
 * (interval 4, phase 1). Governors at X and Y; nobody writes unless asked.
 */
export function line(): GameState {
  const C = 'w-c' as WorldId
  const X = 'w-x' as WorldId
  const Y = 'w-y' as WorldId
  const admin = 'f-admin' as FactionId
  const player = 'c-player' as CharacterId
  const govX = 'c-x' as CharacterId
  const govY = 'c-y' as CharacterId
  const profile = { starport: 'B' as const, size: 5, atmosphere: 6, hydrographics: 5, population: 5, government: 5, law: 5, tech: 9 }
  const world = (id: WorldId, name: string, col: number, gov: CharacterId) => ({
    id, name, hex: { col, row: 5 }, profile: { ...profile }, faction: admin, governor: gov, actingGovernor: gov, unrest: 0, garrison: 5, marines: 0, contest: null, lastLetter: 0,
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
    ending: null,
    worlds: { [C]: world(C, 'Capital', 1, player), [X]: world(X, 'Exe', 2, govX), [Y]: world(Y, 'Wye', 3, govY) },
    lanes: {
      [cx]: { id: cx, ends: [C, X], jumpDistance: 1, schedule: { interval: 2, phase: 0 } },
      [xy]: { id: xy, ends: [X, Y], jumpDistance: 1, schedule: { interval: 4, phase: 1 } },
    },
    ships: {
      [pcx]: { id: pcx, name: 'P1', role: 'packet', faction: admin, jump: 1, strength: 0, damage: 0, location: { kind: 'world', world: C }, commander: null, troops: { army: 0, marines: 0 }, passengers: [], havens: null, order: { kind: 'courier', route: [C, X], then: null, repeat: true, leg: 1 }, standing: { rally: null, onContact: 'never' }, mailbag: [] },
      [pxy]: { id: pxy, name: 'P2', role: 'packet', faction: admin, jump: 1, strength: 0, damage: 0, location: { kind: 'world', world: X }, commander: null, troops: { army: 0, marines: 0 }, passengers: [], havens: null, order: { kind: 'courier', route: [X, Y], then: null, repeat: true, leg: 1 }, standing: { rally: null, onContact: 'never' }, mailbag: [] },
    },
    characters: {
      [player]: { id: player, name: 'Gov', faction: admin, post: { kind: 'governor', world: C }, traits: playerTraits() },
      [govX]: { id: govX, name: 'Ex', faction: admin, post: { kind: 'governor', world: X }, traits: playerTraits() },
      [govY]: { id: govY, name: 'Wy', faction: admin, post: { kind: 'governor', world: Y }, traits: playerTraits() },
    },
    factions: startingFactions(C),
    mail: {},
    events: {},
    rumours: [],
    beliefs: { [player]: { worlds: {}, ships: {} } },
  }
  departShips(state) // as newGame() does: week 0's sailings are already under way
  return state
}

/** Run weeks until `until(state)` holds or `limit` weeks pass. */
export function runUntil(state: GameState, until: (s: GameState) => boolean, limit = 60): void {
  while (!until(state) && state.week < limit) advanceWeek(state)
}

