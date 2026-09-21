/**
 * Pirates: no faction to speak of and no bases of their own. They live off
 * havens — worlds with a working port whose governor is self-interested
 * enough to look the other way, or independent worlds — and each hull
 * knows only the havens she was told of at spawn. She raids by lying off a
 * busy port for a few weeks, robbing what comes and goes, then puts back
 * in to a haven she knows. A pirate who puts in anywhere else is seized by
 * the port. So a pirate problem on a lane is usually also a governor
 * problem at one end of it, and the desk learns where from what its
 * hulls see in port and from the docks.
 */
import { neighbours } from './chart'
import { newCharacter } from './characters'
import { recordEvent } from './events'
import { PIRATES, REBELS, hostile } from './factions'
import { HULLS, newShip, shipName } from './fleet'
import { hexDistance } from './hex'
import { check, nextFloat, nextInt } from './rng'
import type { CharacterId, GameState, Ship, ShipId, World, WorldId } from './types'

/** Chance per haven per week of a new hull putting out. Small: catching the ones at large should be enough to keep piracy down. */
export const SPAWN_CHANCE = 0.015

/** How many are at large when the game begins (spec.md → Starting position). */
export const STARTING_PIRATES = 5

export function isHaven(state: GameState, world: World): boolean {
  const port = world.profile.starport
  if (port !== 'A' && port !== 'B' && port !== 'C') return false
  if (world.faction === REBELS) return true
  const governor = world.actingGovernor ? state.characters[world.actingGovernor] : null
  return governor !== null && governor !== undefined && governor.traits.loyalty === 'self' && world.id !== state.capital
}

export function havens(state: GameState): World[] {
  return Object.values(state.worlds)
    .filter((w) => isHaven(state, w))
    .sort((a, b) => (a.id < b.id ? -1 : 1))
}

/** A new raider at `home`, with a captain and whatever other havens she has heard of. */
export function spawnPirate(state: GameState, home: World): Ship {
  const n = state.nextId
  state.nextId += 1
  const id = `s-pirate-${n}` as ShipId
  const cid = `c-pirate-${n}` as CharacterId
  const captain = newCharacter(state.rng, cid, PIRATES, { kind: 'commander', ship: id })
  captain.traits.loyalty = 'self'
  state.characters[cid] = captain
  const taken = new Set(Object.values(state.ships).map((s) => s.name))
  const ship = newShip(id, shipName(state.rng, taken), HULLS.raider, PIRATES, home.id, captain)
  ship.standing = { rally: null, onContact: 'favourable' }
  ship.havens = [home.id, ...havens(state).filter((w) => w.id !== home.id && check(state.rng, 9)).map((w) => w.id)]
  state.ships[id] = ship
  return ship
}

/**
 * Week 0: make sure there are havens to spawn from — at least two, so the
 * problem has more than one address — and put the starting pirates at
 * them. Havens are made by corrupting the governors of C-or-better ports
 * away from the capital.
 */
export function placePirates(state: GameState): void {
  const capital = state.worlds[state.capital]
  const candidates = Object.values(state.worlds)
    .filter((w) => w.id !== state.capital && w.actingGovernor && ['A', 'B', 'C'].includes(w.profile.starport) && hexDistance(w.hex, capital.hex) >= 3)
    .sort((a, b) => hexDistance(b.hex, capital.hex) - hexDistance(a.hex, capital.hex) || (a.id < b.id ? -1 : 1))
  for (const w of candidates) {
    if (havens(state).length >= 2) break
    const governor = state.characters[w.actingGovernor as CharacterId]
    if (governor) governor.traits.loyalty = 'self'
  }
  const homes = havens(state)
  if (homes.length === 0) return
  for (let i = 0; i < STARTING_PIRATES; i++) spawnPirate(state, homes[i % homes.length])
}

/** Each week each haven may put out a new hull. */
export function spawnPirates(state: GameState): void {
  for (const home of havens(state)) {
    if (nextFloat(state.rng) < SPAWN_CHANCE) spawnPirate(state, home)
  }
}

// ---------------------------------------------------------------------------
// What a raider does

/** Ports worth lying off: charted A/B ports with traffic, hostile to pirates, not a haven she means to keep. */
function huntingGrounds(state: GameState, ship: Ship, from: WorldId): WorldId[] {
  const here = state.worlds[from]
  return (Object.keys(state.worlds).sort() as WorldId[]).filter((id) => {
    const w = state.worlds[id]
    if (id === from || ship.havens?.includes(id)) return false
    if (w.profile.starport !== 'A' && w.profile.starport !== 'B') return false
    if (!hostile(w.faction, PIRATES) || neighbours(state.lanes, id).length === 0) return false
    return hexDistance(w.hex, here.hex) <= ship.jump * 2
  })
}

function nearestHaven(state: GameState, ship: Ship, from: WorldId): WorldId | null {
  const known = (ship.havens ?? []).filter((h) => state.worlds[h] && isHaven(state, state.worlds[h]))
  if (known.length === 0) return null
  const here = state.worlds[from]
  return [...known].sort((a, b) => hexDistance(state.worlds[a].hex, here.hex) - hexDistance(state.worlds[b].hex, here.hex) || (a < b ? -1 : 1))[0]
}

/**
 * Raiders in port decide the week. Hurt, at a haven: stay and refit. Fit,
 * at a haven: pick a port to lie off for a few weeks, then come back to
 * some haven she knows. Anywhere else — she fled here, or her haven was
 * cleaned up — make for the nearest haven she knows of.
 */
export function pirateOrders(state: GameState): void {
  const ids = Object.keys(state.ships).sort() as ShipId[]
  for (const id of ids) {
    const ship = state.ships[id]
    if (ship.faction !== PIRATES || ship.location.kind !== 'world' || !ship.commander) continue
    const at = ship.location.world
    const busy = ship.order && ship.order.kind !== 'hold' && !(ship.order.kind === 'move' && ship.order.to === at)
    if (busy) continue
    const atHaven = ship.havens?.includes(at) ?? false
    if (atHaven && ship.damage > 0) {
      ship.order = { kind: 'hold' }
      continue
    }
    const home = nearestHaven(state, ship, at)
    if (!atHaven) {
      ship.order = home ? { kind: 'move', to: home, then: null } : { kind: 'hold' }
      continue
    }
    const grounds = huntingGrounds(state, ship, at)
    if (grounds.length === 0) {
      ship.order = { kind: 'hold' }
      continue
    }
    const target = grounds[nextInt(state.rng, 0, grounds.length - 1)]
    const back = ship.havens && ship.havens.length > 0 ? ship.havens[nextInt(state.rng, 0, ship.havens.length - 1)] : home
    ship.order = { kind: 'patrol', world: target, weeks: nextInt(state.rng, 3, 6), posture: 'favourable', then: back ? { kind: 'world', world: back } : null, began: null }
  }
}

/**
 * A pirate who puts in at a port she does not know to be a haven — because
 * she fled there, or the haven has since changed hands — is seized by the
 * port's governor and becomes their prize. Lying off a port to raid is not
 * putting in.
 */
export function seizePirates(state: GameState): void {
  const ids = Object.keys(state.ships).sort() as ShipId[]
  for (const id of ids) {
    const ship = state.ships[id]
    if (ship.faction !== PIRATES || ship.location.kind !== 'world') continue
    const at = ship.location.world
    const world = state.worlds[at]
    if (ship.havens?.includes(at) && isHaven(state, world)) continue
    if (ship.order?.kind === 'patrol' && ship.order.world === at) continue
    if (!world.actingGovernor || world.faction === PIRATES) continue
    recordEvent(state, at, { kind: 'pirate_seized', valence: 'good', severity: 2, ship })
    if (ship.commander) delete state.characters[ship.commander]
    ship.commander = null
    ship.faction = world.faction
    ship.havens = null
    ship.order = { kind: 'hold' }
    ship.standing = { rally: null, onContact: 'never' }
    for (const m of ship.mailbag) if (state.mail[m]) state.mail[m].status = { kind: 'lost', week: state.week }
    ship.mailbag = []
  }
}

/** Whether an armed hostile hull is lying in a system: what slows the merchants, and their talk, on the lanes touching it (#47). */
export function raided(state: GameState, at: WorldId): boolean {
  const world = state.worlds[at]
  return Object.values(state.ships).some((s) => s.location.kind === 'world' && s.location.world === at && s.strength > s.damage && hostile(s.faction, world.faction))
}
