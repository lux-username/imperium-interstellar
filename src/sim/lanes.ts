/**
 * Charted lanes and the packet ships that run them.
 *
 * Lanes join worlds with real ports. Scheduled traffic — and therefore all
 * routine mail — moves only along lanes; a world with no lane is "off-lane"
 * and hears from the capital only when someone sends a hull there on purpose.
 *
 * Routing over the chart and the timetable arithmetic live in ./chart.ts,
 * which is public knowledge the UI may also use.
 */
import { hexDistance } from './hex'
import { nextInt, roll, type Rng } from './rng'
import type { Lane, LaneId, PacketSchedule, Ship, ShipId, World, WorldId } from './types'
import { laneId } from './chart'
import { ADMINISTRATION } from './generate'

// ---------------------------------------------------------------------------
// Charting

/** Ports that regular traffic calls at. C ports join the chart only as a short hop off a real port. */
function isPort(w: World): boolean {
  return w.profile.starport === 'A' || w.profile.starport === 'B'
}

/**
 * Packets on a busy lane turn straight around; elsewhere they lie over a
 * week at each end. `interval` is the gap between departures from one end;
 * the other end's departures are offset by half of it.
 */
function schedule(rng: Rng, a: World, b: World): PacketSchedule {
  const busy = isPort(a) && isPort(b) && a.profile.starport === 'A' && b.profile.starport === 'A'
  const dwell = busy ? 0 : roll(rng) >= 8 ? 0 : 1
  const interval = 2 * (1 + dwell)
  return { interval, phase: nextInt(rng, 0, interval - 1) }
}

/**
 * Lay lanes over a generated set of worlds.
 *
 * 1. Every pair of A/B ports within two parsecs is joined (J-1 and J-2 are common).
 * 2. A C port one parsec from any charted world gets a spur.
 * 3. Separate clusters are bridged by the shortest gap of three parsecs or
 *    less (J-3 is uncommon but a charted lane can justify it). Anything
 *    further apart stays separate: two charts, one of which the capital's
 *    packets never reach.
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
    const near = all.find((o) => on.has(o.id) && hexDistance(o.hex, w.hex) === 1)
    if (near) add(near, w)
  }

  // Bridge clusters. Only worlds already on the chart (plus lone ports) count.
  for (;;) {
    const on = charted()
    const nodes = all.filter((w) => on.has(w.id) || isPort(w))
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

// ---------------------------------------------------------------------------
// Packet ships

/** One packet per lane, starting in port at the lane's first end and waiting for its first scheduled departure. */
export function packetShips(rng: Rng, lanes: Record<LaneId, Lane>): Record<ShipId, Ship> {
  const ships: Record<ShipId, Ship> = {}
  const prefixes = ['Packet', 'Mail Boat', 'Courier', 'Tender']
  for (const lane of Object.values(lanes)) {
    const id = `s-packet-${lane.id.slice(2)}` as ShipId
    const number = nextInt(rng, 2, 99)
    ships[id] = {
      id,
      name: `${prefixes[nextInt(rng, 0, prefixes.length - 1)]} ${number}`,
      role: 'packet',
      faction: ADMINISTRATION,
      jump: Math.max(2, lane.jumpDistance),
      strength: 0,
      location: { kind: 'world', world: lane.ends[0] },
      commander: null,
      order: { kind: 'courier', route: [lane.ends[0], lane.ends[1]], then: null, repeat: true, leg: 1 },
      standing: { rally: null, onContact: 'favourable' },
      mailbag: [],
    }
  }
  return ships
}
