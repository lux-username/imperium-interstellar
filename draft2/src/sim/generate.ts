/**
 * Subsector generation: which hexes hold worlds, what each world is like,
 * and where the three empires' seats sit. Everything is driven by 2d6
 * through the seeded RNG, so a seed reproduces the same subsector.
 *
 * The profile procedures are our own. They follow the shape of 1977-era
 * world generation — each characteristic is a 2d6 roll shifted by the ones
 * before it — but the tables, thresholds and modifiers here are ours to tune.
 *
 * Draft 2 lays the subsector out as a borderland: three governor's seats,
 * as far from one another as the map allows, each holding the worlds nearer
 * to it than to the others, joined by lanes so that the border is a matter
 * of who sails where.
 */
import { allHexes, hexDistance, hexLabel, SUBSECTOR_COLS, SUBSECTOR_ROWS, type Hex } from './hex'
import { neighbours } from './chart'
import { chartLanes } from './lanes'
import { seatName, worldCultures, worldName } from './names'
import type { CoreName } from './data/names'
import { newMarket } from './economy'
import { createRng, nextInt, roll, type Rng } from './rng'
import type { Empire, EmpireId, Lane, LaneId, StarportClass, World, WorldId, WorldProfile } from './types'

export function worldId(hex: Hex): WorldId {
  return `w-${hexLabel(hex)}` as WorldId
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

// ---------------------------------------------------------------------------
// Profile

/** Weighted toward B: a subsector needs enough real ports for lanes to form clusters, not just pairs. */
function starport(rng: Rng): StarportClass {
  const r = roll(rng)
  if (r <= 2) return 'X'
  if (r <= 3) return 'E'
  if (r <= 5) return 'D'
  if (r <= 7) return 'C'
  if (r <= 10) return 'B'
  return 'A'
}

export function generateProfile(rng: Rng): WorldProfile {
  const port = starport(rng)
  const size = roll(rng) - 2
  const atmosphere = size === 0 ? 0 : clamp(roll(rng) - 7 + size, 0, 15)
  let hydro = size <= 1 ? 0 : roll(rng) - 7 + atmosphere
  if (atmosphere <= 1 || atmosphere >= 10) hydro -= 4
  const hydrographics = clamp(hydro, 0, 10)
  const population = roll(rng) - 2
  const government = population === 0 ? 0 : clamp(roll(rng) - 7 + population, 0, 15)
  const law = population === 0 ? 0 : clamp(roll(rng) - 7 + government, 0, 9)

  let tech = nextInt(rng, 1, 6)
  tech += { A: 6, B: 4, C: 2, D: 0, E: 0, X: -4 }[port]
  if (size <= 1) tech += 2
  else if (size <= 4) tech += 1
  if (atmosphere <= 3 || atmosphere >= 10) tech += 1
  if (hydrographics === 9) tech += 1
  else if (hydrographics === 10) tech += 2
  if (population >= 1 && population <= 5) tech += 1
  else if (population === 9) tech += 2
  else if (population === 10) tech += 4
  if (government === 0 || government === 5) tech += 1
  else if (government === 13) tech -= 2
  if (population === 0) tech = 0

  return { starport: port, size, atmosphere, hydrographics, population, government, law, tech: clamp(tech, 0, 15) }
}

/** Compact profile string, e.g. "B567A85-C": the eight characteristics as hex-ish digits. */
export function profileString(p: WorldProfile): string {
  const d = (n: number) => n.toString(16).toUpperCase()
  return `${p.starport}${d(p.size)}${d(p.atmosphere)}${d(p.hydrographics)}${d(p.population)}${d(p.government)}${d(p.law)}-${d(p.tech)}`
}

// ---------------------------------------------------------------------------
// Placement

/** A hex holds a world on 9+ (about 28%): some twenty-odd worlds, so every one of them matters and the gaps between them are real. */
const WORLD_TARGET = 9

/** The fewest worlds a subsector may have; a sparse roll is topped up to this. */
const MIN_WORLDS = 16

/** The most worlds a subsector may have before it is rerolled: too many and no single one matters. */
const MAX_WORLDS = 28

function isEdge({ col, row }: Hex): boolean {
  return col === 1 || col === SUBSECTOR_COLS || row === 1 || row === SUBSECTOR_ROWS
}

/** A world at a hex: who settled it, what it is called, and what it is like. Unclaimed until the seats are chosen. */
function newWorld(rng: Rng, hex: Hex, taken: Set<string>): World {
  const cultures = worldCultures(rng)
  const profile = generateProfile(rng)
  return {
    id: worldId(hex),
    name: worldName(rng, cultures, taken),
    hex,
    cultures,
    profile,
    empire: '' as EmpireId,
    board: {},
    market: newMarket(rng, profile),
    freight: [],
  }
}

// ---------------------------------------------------------------------------
// The three empires

/**
 * The powers that share the borderland: one English-like, one
 * Spanish-like, one French-like, by decision. The names are ours; `core`
 * says which culture table names their people and their seats.
 */
export const EMPIRES: readonly { id: EmpireId; name: string; core: CoreName }[] = [
  { id: 'e-wessmere' as EmpireId, name: 'The Wessmere Crown', core: 'english' },
  { id: 'e-castellar' as EmpireId, name: 'The Castellar Throne', core: 'spanish' },
  { id: 'e-vauclair' as EmpireId, name: 'The Vauclair Concord', core: 'french' },
]

/** The fewest parsecs between any two seats for a layout to count as a borderland rather than a brawl. */
const SEAT_SPACING = 4

/**
 * Three seats, as far from one another as the map allows. Candidates are
 * populated worlds, edge worlds preferred (the Empire each answers to lies
 * beyond that edge). The triple with the greatest smallest pairwise
 * distance wins; ties go to the greatest total distance, then to id order.
 * A seat is guaranteed a class A port and a tech level that can build ships.
 */
function chooseSeats(worlds: World[]): World[] {
  const populated = worlds.filter((w) => w.profile.population > 0)
  const edge = populated.filter((w) => isEdge(w.hex))
  const pool = (edge.length >= 3 ? edge : populated.length >= 3 ? populated : worlds).sort((a, b) => (a.id < b.id ? -1 : 1))
  let best: World[] | null = null
  let bestMin = -1
  let bestSum = -1
  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      for (let k = j + 1; k < pool.length; k++) {
        const d = [hexDistance(pool[i].hex, pool[j].hex), hexDistance(pool[j].hex, pool[k].hex), hexDistance(pool[i].hex, pool[k].hex)]
        const min = Math.min(...d)
        const sum = d[0] + d[1] + d[2]
        if (min > bestMin || (min === bestMin && sum > bestSum)) {
          best = [pool[i], pool[j], pool[k]]
          bestMin = min
          bestSum = sum
        }
      }
    }
  }
  const seats = best ?? pool.slice(0, 3)
  for (const seat of seats) {
    seat.profile.starport = 'A'
    seat.profile.population = Math.max(seat.profile.population, 7)
    seat.profile.tech = Math.max(seat.profile.tech, 12)
  }
  return seats
}

/** Every world answers to the nearest seat; ties go to the earlier empire. */
function claimWorlds(worlds: World[], empires: Empire[], byId: Record<WorldId, World>): void {
  for (const w of worlds) {
    let owner = empires[0]
    let nearest = Number.POSITIVE_INFINITY
    for (const e of empires) {
      const d = hexDistance(w.hex, byId[e.seat].hex)
      if (d < nearest) {
        nearest = d
        owner = e
      }
    }
    w.empire = owner.id
  }
}

// ---------------------------------------------------------------------------

export interface Generated {
  worlds: Record<WorldId, World>
  empires: Record<EmpireId, Empire>
}

/**
 * Worlds and the three empires that claim them. Lanes are laid over this
 * by ./lanes.ts; the whole thing is assembled into a game state by the
 * game module when it exists.
 */
export function generateWorlds(rng: Rng): Generated {
  const taken = new Set<string>()
  const worlds: Record<WorldId, World> = {}
  const list: World[] = []

  for (const hex of allHexes()) {
    if (roll(rng) < WORLD_TARGET) continue
    const world = newWorld(rng, hex, taken)
    worlds[world.id] = world
    list.push(world)
  }

  // A subsector with too few worlds is no game; fill random empty hexes until there are enough.
  const hexes = allHexes()
  while (list.length < MIN_WORLDS) {
    const hex = hexes[nextInt(rng, 0, hexes.length - 1)]
    const id = worldId(hex)
    if (worlds[id]) continue
    const world = newWorld(rng, hex, taken)
    worlds[id] = world
    list.push(world)
  }

  const seats = chooseSeats(list)
  // A seat's port and people were just raised; its market is rolled again to match.
  for (const seat of seats) seat.market = newMarket(rng, seat.profile)
  const empires: Record<EmpireId, Empire> = {}
  const order: Empire[] = []
  EMPIRES.forEach((e, i) => {
    // 12–16 weeks round trip to the imperial capital, per spec.
    const empire: Empire = { id: e.id, name: e.name, core: e.core, seat: seats[i].id, capitalWeeks: nextInt(rng, 6, 8) }
    // The seat is named by the power that sits there.
    taken.delete(seats[i].name)
    seats[i].name = seatName(rng, e.core, taken)
    empires[e.id] = empire
    order.push(empire)
  })
  claimWorlds(list, order, worlds)

  return { worlds, empires }
}

// ---------------------------------------------------------------------------
// The shape of the campaign

/** The worlds reachable from `from` over the lanes. */
function reachable(lanes: Record<LaneId, Lane>, from: WorldId): Set<WorldId> {
  const seen = new Set<WorldId>([from])
  const queue = [from]
  while (queue.length > 0) {
    const w = queue.pop() as WorldId
    for (const n of neighbours(lanes, w)) {
      if (seen.has(n)) continue
      seen.add(n)
      queue.push(n)
    }
  }
  return seen
}

/**
 * Why a laid-out subsector is, or is not, a borderland worth playing. A
 * layout passes when every reason is null:
 *
 * - it has neither too few worlds nor too many;
 * - the three seats are at least SEAT_SPACING parsecs apart, so each has
 *   worlds of its own between it and the others;
 * - each empire holds at least three worlds, and each seat has a world
 *   within two parsecs, so a J-2 hull can leave it;
 * - the seats are joined to one another over the chart, so trade and war
 *   between them run on lanes and the border is a thing ships cross;
 * - the chart from any seat reaches most of the worlds;
 * - and a few worlds lie off the lanes altogether, dark until a hull is sent.
 */
export function layoutFaults(worlds: Record<WorldId, World>, lanes: Record<LaneId, Lane>, empires: Record<EmpireId, Empire>): string[] {
  const faults: string[] = []
  const all = Object.values(worlds)
  const n = all.length
  if (n < MIN_WORLDS || n > MAX_WORLDS) faults.push(`${n} worlds`)
  const seats = Object.values(empires).map((e) => worlds[e.seat])
  for (let i = 0; i < seats.length; i++) {
    for (let j = i + 1; j < seats.length; j++) {
      const d = hexDistance(seats[i].hex, seats[j].hex)
      if (d < SEAT_SPACING) faults.push(`seats ${seats[i].name} and ${seats[j].name} only ${d} apart`)
    }
  }
  for (const e of Object.values(empires)) {
    const held = all.filter((w) => w.empire === e.id).length
    if (held < 3) faults.push(`${e.name} holds only ${held}`)
    const seat = worlds[e.seat]
    if (!all.some((w) => w !== seat && hexDistance(w.hex, seat.hex) <= 2)) faults.push(`${seat.name} has no world within two parsecs`)
  }
  const chart = reachable(lanes, seats[0].id)
  for (const s of seats.slice(1)) if (!chart.has(s.id)) faults.push(`${s.name} is not on ${seats[0].name}'s chart`)
  if (chart.size < Math.ceil(n * 0.55)) faults.push(`the chart reaches only ${chart.size} of ${n}`)
  const dark = all.filter((w) => neighbours(lanes, w.id).length === 0).length
  if (dark < 1 || dark > 8) faults.push(`${dark} dark worlds`)
  return faults
}

/** How many layouts are tried before the last is taken as it comes. Deterministic: the same seed makes the same tries. */
export const LAYOUT_TRIES = 60

/**
 * A subsector and its lanes, rolled again until the layout passes (see
 * layoutFaults) or the tries run out. Everything after this — ships,
 * people, organisations — is laid over what comes back.
 */
export function generateSubsector(rng: Rng): Generated & { lanes: Record<LaneId, Lane>; tries: number } {
  let last: (Generated & { lanes: Record<LaneId, Lane> }) | null = null
  for (let i = 1; i <= LAYOUT_TRIES; i++) {
    const g = generateWorlds(rng)
    const lanes = chartLanes(rng, g.worlds)
    last = { ...g, lanes }
    if (layoutFaults(g.worlds, lanes, g.empires).length === 0) return { ...last, tries: i }
  }
  return { ...(last as Generated & { lanes: Record<LaneId, Lane> }), tries: LAYOUT_TRIES }
}

/** Convenience for tests: a fresh RNG and a generated subsector from one seed. */
export function generateFromSeed(seed: number): Generated & { rng: Rng } {
  const rng = createRng(seed)
  return { ...generateWorlds(rng), rng }
}
