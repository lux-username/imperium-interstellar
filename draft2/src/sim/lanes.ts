/**
 * Charted lanes.
 *
 * Lanes join worlds with real ports. Scheduled traffic — and therefore all
 * routine mail — moves only along lanes; a world with no lane is "off-lane"
 * and hears from anyone only when someone sends a hull there on purpose.
 *
 * Routing over the chart and the timetable arithmetic live in ./chart.ts,
 * which is public knowledge the UI may also use. The scouts that keep the
 * packet schedules land with the ship phase.
 */
import { hexDistance } from './hex'
import { nextInt, roll, type Rng } from './rng'
import type { Lane, LaneId, PacketSchedule, World, WorldId } from './types'
import { laneId } from './chart'

/** Ports that regular traffic calls at. C ports join the chart only as a spur off a charted world within two parsecs. */
function isPort(w: World): boolean {
  return w.profile.starport === 'A' || w.profile.starport === 'B'
}

/** A four-week round everywhere; a busy lane (two A ports, or an A and a B on a good roll) gets a second scout. */
function schedule(rng: Rng, a: World, b: World): PacketSchedule {
  const grade = (w: World) => (w.profile.starport === 'A' ? 2 : w.profile.starport === 'B' ? 1 : 0)
  const busy = grade(a) + grade(b) >= 4 || (grade(a) + grade(b) === 3 && roll(rng) >= 8)
  return { interval: 4, phase: nextInt(rng, 0, 3), scouts: busy ? 2 : 1 }
}

/**
 * Lay lanes over a generated set of worlds.
 *
 * 1. Every pair of A/B ports within two parsecs is joined (J-1 and J-2 are common).
 * 2. A C port within two parsecs of a charted world gets a spur to the nearest.
 * 3. Separate clusters — and lone C ports — are bridged by the shortest gap
 *    of three parsecs or less (J-3 is uncommon but a charted lane can
 *    justify it). Anything further apart stays separate. Worlds with no
 *    working port are never charted: they are dark until a hull is sent.
 */
export function chartLanes(rng: Rng, worlds: Record<WorldId, World>): Record<LaneId, Lane> {
  const lanes: Record<LaneId, Lane> = {}
  const all = Object.values(worlds).sort((a, b) => (a.id < b.id ? -1 : 1))
  const ports = all.filter(isPort)

  const add = (a: World, b: World) => {
    const id = laneId(a.id, b.id)
    if (lanes[id]) return
    const [x, y] = a.id < b.id ? [a, b] : [b, a]
    lanes[id] = { id, ends: [x.id, y.id], jumpDistance: hexDistance(x.hex, y.hex), schedule: schedule(rng, x, y) }
  }

  for (let i = 0; i < ports.length; i++) {
    for (let j = i + 1; j < ports.length; j++) {
      if (hexDistance(ports[i].hex, ports[j].hex) <= 2) add(ports[i], ports[j])
    }
  }

  const charted = () => new Set(Object.values(lanes).flatMap((l) => l.ends))
  for (const w of all) {
    if (w.profile.starport !== 'C') continue
    const on = charted()
    const near = all.filter((o) => on.has(o.id) && hexDistance(o.hex, w.hex) <= 2).sort((a, b) => hexDistance(a.hex, w.hex) - hexDistance(b.hex, w.hex) || (a.id < b.id ? -1 : 1))[0]
    if (near) add(near, w)
  }

  // Bridge clusters. Only worlds already on the chart, and lone worlds with a working port, count.
  for (;;) {
    const on = charted()
    const nodes = all.filter((w) => on.has(w.id) || isPort(w) || w.profile.starport === 'C')
    const comp = components(nodes.map((w) => w.id), Object.values(lanes))
    let best: [World, World] | null = null
    let bestD = 4
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        if (comp.get(nodes[i].id) === comp.get(nodes[j].id)) continue
        const d = hexDistance(nodes[i].hex, nodes[j].hex)
        if (d < bestD) {
          bestD = d
          best = [nodes[i], nodes[j]]
        }
      }
    }
    if (!best) break
    add(best[0], best[1])
  }

  return lanes
}

function components(ids: WorldId[], lanes: Lane[]): Map<WorldId, number> {
  const parent = new Map<WorldId, WorldId>()
  const find = (x: WorldId): WorldId => {
    let r = x
    while (parent.get(r) !== r) r = parent.get(r) ?? r
    return r
  }
  for (const id of ids) parent.set(id, id)
  for (const l of lanes) {
    if (!parent.has(l.ends[0]) || !parent.has(l.ends[1])) continue
    parent.set(find(l.ends[0]), find(l.ends[1]))
  }
  const out = new Map<WorldId, number>()
  const index = new Map<WorldId, number>()
  for (const id of ids) {
    const root = find(id)
    if (!index.has(root)) index.set(root, index.size)
    out.set(id, index.get(root) ?? 0)
  }
  return out
}
