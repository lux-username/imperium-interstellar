/**
 * Scouts on the packets. Draft 1's packet and courier are one hull now:
 * the scout, small and unarmed, with fuel scoops, crewed by nobody the
 * rolls name. One scout runs each charted lane on its timetable, and
 * everything that moves between worlds on a schedule — mail, news,
 * passengers — moves aboard her. Scouts sent on purpose land with the
 * ship phase.
 */
import { nextDeparture } from './chart'
import { shipName } from './ships'
import { loadMail, unloadMail } from './mail'
import { deliverFreight } from './ships'
import type { Rng } from './rng'
import type { Empire, EmpireId, GameState, Lane, LaneId, Ship, ShipId, World, WorldId } from './types'

/** The scouts of each lane, one at each end where there are two, run by the post of the empire that holds the end they start at. */
export function packetScouts(rng: Rng, lanes: Record<LaneId, Lane>, worlds: Record<WorldId, World>, empires: Record<EmpireId, Empire>): Record<ShipId, Ship> {
  const ships: Record<ShipId, Ship> = {}
  const taken = new Set<string>()
  const ids = Object.keys(lanes).sort() as LaneId[]
  for (const id of ids) {
    const lane = lanes[id]
    for (let i = 0; i < lane.schedule.scouts; i++) {
      const start = lane.ends[i % 2]
      const home = worlds[start]
      const empire = empires[home.empire]?.id ?? home.empire
      const sid = `s-scout-${id.slice(2)}${i === 0 ? '' : `-${i + 1}`}` as ShipId
      ships[sid] = {
      id: sid,
      name: shipName(rng, 'scout', taken),
      type: 'scout',
      empire,
      owner: { kind: 'organisation', empire, arm: 'post' },
      location: { kind: 'world', world: start },
      fuel: 2,
      damage: 0,
      hold: [],
      course: null,
      captain: null,
      passengers: [],
      mailbag: [],
      news: {},
      run: { lane: id },
      docked: -1,
      }
    }
  }
  return ships
}

/** The other end of a scout's lane from `at`, or null if she is not on it. */
export function otherEnd(lane: Lane, at: WorldId): WorldId | null {
  return lane.ends[0] === at ? lane.ends[1] : lane.ends[1] === at ? lane.ends[0] : null
}

/** When a scout in port at `at` next sails, at or after `week`. Null if she is not on the packets or not at an end of her lane. */
export function sailsOn(state: GameState, ship: Ship, at: WorldId, week: number): number | null {
  if (!ship.run) return null
  const lane = state.lanes[ship.run.lane]
  if (!lane || otherEnd(lane, at) === null) return null
  return nextDeparture(lane, at, week)
}

/**
 * Scouts whose timetable says this week sail: bags and news aboard, and
 * away. Passengers go with her. Arrival is next week whatever the lane's
 * length. A scout sails no sooner than the week after she landed, and
 * where two of a lane's scouts lie at one end only the longer-docked goes.
 */
export function departScouts(state: GameState): void {
  const ids = Object.keys(state.ships).sort() as ShipId[]
  const sailedFrom = new Set<string>()
  const candidates = ids
    .map((id) => state.ships[id])
    .filter((s) => s.run && s.location.kind === 'world' && s.docked < state.week)
    .sort((a, b) => a.docked - b.docked || (a.id < b.id ? -1 : 1))
  for (const ship of candidates) {
    if (!ship.run || ship.location.kind !== 'world') continue
    const at = ship.location.world
    const key = `${ship.run.lane}@${at}`
    if (sailedFrom.has(key)) continue
    if (sailsOn(state, ship, at, state.week) !== state.week) continue
    const to = otherEnd(state.lanes[ship.run.lane], at)
    if (to === null) continue
    loadMail(state, ship, at, to)
    ship.location = { kind: 'transit', from: at, to, arrives: state.week + 1 }
    sailedFrom.add(key)
  }
}

/**
 * Hulls whose jump lands this week come in: mail and news come off,
 * passengers step ashore. Returns the hulls that landed.
 */
export function landShips(state: GameState): Ship[] {
  const landed: Ship[] = []
  const ids = Object.keys(state.ships).sort() as ShipId[]
  for (const id of ids) {
    const ship = state.ships[id]
    if (ship.location.kind !== 'transit' || ship.location.arrives > state.week) continue
    const at = ship.location.to
    ship.location = { kind: 'world', world: at }
    ship.docked = state.week
    unloadMail(state, ship, at)
    deliverFreight(state, ship, at)
    for (const p of ship.passengers) {
      const c = state.characters[p]
      if (c) c.body = { kind: 'world', world: at }
    }
    ship.passengers = []
    landed.push(ship)
  }
  return landed
}
