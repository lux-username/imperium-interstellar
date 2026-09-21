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
import { snapshotShip, writeReport } from './mail'
import { check, nextFloat, nextInt } from './rng'
import type { CharacterId, GameState, Ship, ShipId, World, WorldId } from './types'
import type { Event, EventId } from './view'

/** Chance per haven per week of a new hull putting out. Small: catching the ones at large should be enough to keep piracy down. */
export const SPAWN_CHANCE = 0.01

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

/** A pirate captain: one of the crew steps up. */
function pirateCaptain(state: GameState, ship: ShipId): CharacterId {
  const cid = `c-pirate-${state.nextId}` as CharacterId
  state.nextId += 1
  const captain = newCharacter(state.rng, cid, PIRATES, { kind: 'commander', ship })
  captain.traits.loyalty = 'self'
  state.characters[cid] = captain
  return cid
}

/** A new raider at `home`, with a captain and whatever other havens she has heard of. */
export function spawnPirate(state: GameState, home: World): Ship {
  const n = state.nextId
  state.nextId += 1
  const id = `s-pirate-${n}` as ShipId
  const taken = new Set(Object.values(state.ships).map((s) => s.name))
  const ship = newShip(id, shipName(state.rng, 'raider', taken), HULLS.raider, PIRATES, home.id, null)
  ship.commander = pirateCaptain(state, id)
  ship.standing = { rally: null, onContact: 'favourable' }
  ship.havens = [home.id, ...havens(state).filter((w) => w.id !== home.id && check(state.rng, 9)).map((w) => w.id)]
  state.ships[id] = ship
  return ship
}

/** An armed hull taken by pirates is a pirate from this week: a captain from the boarding party, her captor's havens, and a course for the nearest of them to refit. */
export function pirateFromPrize(state: GameState, ship: Ship, havensKnown: WorldId[]): void {
  ship.faction = PIRATES
  ship.commander = pirateCaptain(state, ship.id)
  ship.havens = [...havensKnown]
  ship.standing = { rally: null, onContact: 'favourable' }
  const home = ship.location.kind === 'world' ? nearestHaven(state, ship, ship.location.world) : null
  ship.order = home && ship.location.kind === 'world' && home !== ship.location.world ? { kind: 'move', to: home, then: null } : { kind: 'hold' }
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

/** Ports worth lying off: charted A/B ports with traffic, hostile to pirates, not a haven she means to keep, and never a faction's seat — that is where the fleet lies. */
function huntingGrounds(state: GameState, ship: Ship, from: WorldId): WorldId[] {
  const here = state.worlds[from]
  const seats = new Set(Object.values(state.factions).map((f) => f.capital))
  return (Object.keys(state.worlds).sort() as WorldId[]).filter((id) => {
    const w = state.worlds[id]
    if (id === from || ship.havens?.includes(id) || seats.has(id)) return false
    if (w.profile.starport !== 'A' && w.profile.starport !== 'B') return false
    if (!hostile(w.faction, PIRATES) || neighbours(state.lanes, id).length === 0) return false
    return hexDistance(w.hex, here.hex) <= ship.jump * 2
  })
}

/**
 * The nearest haven she *knows of*. She sails on her knowledge, not the
 * truth: a haven cleaned up since she heard of it will seize her. With the
 * tanks low she prefers one with a port that can fill them (B or better).
 */
function nearestHaven(state: GameState, ship: Ship, from: WorldId): WorldId | null {
  const known = (ship.havens ?? []).filter((h) => state.worlds[h])
  if (known.length === 0) return null
  const here = state.worlds[from]
  const fuelled = known.filter((h) => ['A', 'B'].includes(state.worlds[h].profile.starport))
  const pool = ship.fuel <= 2 && fuelled.length > 0 ? fuelled : known
  return [...pool].sort((a, b) => hexDistance(state.worlds[a].hex, here.hex) - hexDistance(state.worlds[b].hex, here.hex) || (a < b ? -1 : 1))[0]
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
    // No raid on a dry tank: a haven that cannot fuel her is a place to hide, not to sail from.
    if (ship.fuel < 3) {
      ship.order = home && home !== at ? { kind: 'move', to: home, then: null } : { kind: 'hold' }
      continue
    }
    const target = grounds[nextInt(state.rng, 0, grounds.length - 1)]
    const back = ship.havens && ship.havens.length > 0 ? ship.havens[nextInt(state.rng, 0, ship.havens.length - 1)] : home
    ship.order = { kind: 'patrol', world: target, weeks: nextInt(state.rng, 3, 6), posture: 'favourable', then: back ? { kind: 'world', world: back } : null, began: null }
  }
}

/**
 * What a captured crew lets slip. Each haven she knew is named on 2d6 ≥ 7;
 * on a 12 the crew also names a world that is no haven at all, to buy
 * themselves something. The questioner — the commander who took her, or
 * the governor whose port seized her — writes it home as an ordinary
 * letter: a report about the pirate hull, with one event per world named.
 * The events are the questioner's notes, not things that happened, so they
 * are not entered in the record a scout would read.
 */
export function interrogate(state: GameState, pirate: Ship, havensKnown: WorldId[], questioner: CharacterId, at: WorldId): void {
  if (havensKnown.length === 0) return
  const named = havensKnown.filter(() => check(state.rng, 7))
  if (check(state.rng, 12)) {
    const ports = (Object.keys(state.worlds).sort() as WorldId[]).filter((w) => !havensKnown.includes(w) && ['A', 'B', 'C'].includes(state.worlds[w].profile.starport) && w !== state.capital)
    if (ports.length > 0) named.push(ports[nextInt(state.rng, 0, ports.length - 1)])
  }
  if (named.length === 0) return
  const captain = pirate.commander ? state.characters[pirate.commander]?.name : null
  const notes: Event[] = named.map((w) => ({
    id: `e-q-${state.nextId++}` as EventId,
    at: w,
    week: state.week,
    kind: 'haven_named',
    valence: 'neutral',
    against: null,
    favours: null,
    severity: 1,
    ship: snapshotShip(pirate, at),
    person: captain ?? pirate.name,
    level: null,
  }))
  writeReport(state, questioner, at, { kind: 'ship', ship: snapshotShip(pirate, at) }, { events: notes, occasion: 'notes' })
}

/**
 * A pirate who puts in at a port she does not know to be a haven — because
 * she fled there, or the haven has since changed hands — is seized by the
 * port's governor and becomes their prize. Lying off a port to raid is not
 * putting in, and neither is passing through on the way somewhere else:
 * only a hull that means to stay is taken. Her crew are questioned.
 */
export function seizePirates(state: GameState): void {
  const ids = Object.keys(state.ships).sort() as ShipId[]
  for (const id of ids) {
    const ship = state.ships[id]
    if (ship.faction !== PIRATES || ship.location.kind !== 'world') continue
    const at = ship.location.world
    const world = state.worlds[at]
    if (ship.havens?.includes(at) && isHaven(state, world)) continue
    const order = ship.order
    const staying = !order || order.kind === 'hold' || (order.kind === 'move' && order.to === at)
    if (!staying) continue
    if (!world.actingGovernor || world.faction === PIRATES) continue
    recordEvent(state, at, { kind: 'pirate_seized', valence: 'neutral', against: PIRATES, favours: world.faction, severity: 2, ship })
    if (world.actingGovernor && state.factions[world.faction]?.capital) interrogate(state, ship, ship.havens ?? [], world.actingGovernor, at)
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
