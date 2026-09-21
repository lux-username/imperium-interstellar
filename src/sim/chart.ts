/**
 * The star chart as public knowledge: which lanes exist, when packets sail,
 * and how long mail takes. Nothing here touches ground truth, so the UI may
 * use it (via ./view.ts) to show the player the same timetable arithmetic
 * the sim uses. Every jump takes one week whatever its length, so the
 * shortest route is the one with the fewest jumps.
 */
import { hexDistance, type Hex } from './hex'
import type { Lane, LaneId, Week, WorldId } from './types'

export function laneId(a: WorldId, b: WorldId): LaneId {
  return (a < b ? `l-${a.slice(2)}-${b.slice(2)}` : `l-${b.slice(2)}-${a.slice(2)}`) as LaneId
}

/** Week of the next packet departure from `from` along `lane`, at or after `week`. */
export function nextDeparture(lane: Lane, from: WorldId, week: Week): Week {
  const { interval, phase } = lane.schedule
  const offset = from === lane.ends[0] ? 0 : interval / 2
  const first = phase + offset
  if (week <= first) return first
  const since = (week - first) % interval
  return since === 0 ? week : week + interval - since
}

// ---------------------------------------------------------------------------
// Routing

/** The lane joining two worlds, if one is charted. */
export function laneBetween(lanes: Record<LaneId, Lane>, a: WorldId, b: WorldId): Lane | null {
  const direct = lanes[laneId(a, b)]
  if (direct) return direct
  for (const l of Object.values(lanes)) {
    if ((l.ends[0] === a && l.ends[1] === b) || (l.ends[0] === b && l.ends[1] === a)) return l
  }
  return null
}

/** Worlds one lane away from `from`. */
export function neighbours(lanes: Record<LaneId, Lane>, from: WorldId): WorldId[] {
  const out: WorldId[] = []
  for (const l of Object.values(lanes)) {
    if (l.ends[0] === from) out.push(l.ends[1])
    else if (l.ends[1] === from) out.push(l.ends[0])
  }
  return out.sort()
}

/**
 * Fewest-jumps route from one world to another over the chart, origin
 * first, or null if the lanes don't connect them. Ties break toward the
 * lower world id so the result is stable.
 */
export function route(lanes: Record<LaneId, Lane>, from: WorldId, to: WorldId): WorldId[] | null {
  if (from === to) return [from]
  const prev = new Map<WorldId, WorldId | null>([[from, null]])
  const queue: WorldId[] = [from]
  while (queue.length > 0) {
    const cur = queue.shift() as WorldId
    for (const next of neighbours(lanes, cur)) {
      if (prev.has(next)) continue
      prev.set(next, cur)
      if (next === to) {
        const path: WorldId[] = []
        for (let w: WorldId | null = to; w !== null; w = prev.get(w) ?? null) path.unshift(w)
        return path
      }
      queue.push(next)
    }
  }
  return null
}

/**
 * When mail handed in at `path[0]` on `week` should reach the end of `path`,
 * riding scheduled packets and transshipping at each stop. Exact while
 * nothing disturbs the schedules; an estimate once Phase 1 adds pirates.
 */
export function expectedArrival(lanes: Record<LaneId, Lane>, path: WorldId[], week: Week): Week | null {
  let t = week
  for (let i = 0; i + 1 < path.length; i++) {
    const lane = laneBetween(lanes, path[i], path[i + 1])
    if (!lane) return null
    t = nextDeparture(lane, path[i], t) + 1
  }
  return t
}

/**
 * Fewest-jumps path hex to hex for a hull that may leave the lanes: any
 * two worlds within `jump` parsecs are one jump apart. Positions are
 * public, so the Home Office can plan a courier's run with the same sums the sim
 * uses. Null if the hull cannot get there.
 */
export function hexRoute(positions: Record<WorldId, { hex: Hex }>, from: WorldId, to: WorldId, jump: number): WorldId[] | null {
  if (from === to) return [from]
  const ids = Object.keys(positions).sort() as WorldId[]
  const prev = new Map<WorldId, WorldId | null>([[from, null]])
  const queue: WorldId[] = [from]
  while (queue.length > 0) {
    const cur = queue.shift() as WorldId
    for (const next of ids) {
      if (prev.has(next) || hexDistance(positions[cur].hex, positions[next].hex) > jump) continue
      prev.set(next, cur)
      if (next === to) {
        const path: WorldId[] = []
        for (let w: WorldId | null = to; w !== null; w = prev.get(w) ?? null) path.unshift(w)
        return path
      }
      queue.push(next)
    }
  }
  return null
}
