/**
 * Subsector generation: which hexes hold worlds, what each world is like,
 * who governs it, and where the capital sits. Everything is driven by 2d6
 * through the seeded RNG, so a seed reproduces the same subsector.
 *
 * The profile procedures are our own. They follow the shape of 1977-era
 * world generation — each characteristic is a 2d6 roll shifted by the ones
 * before it — but the tables, thresholds and modifiers here are ours to tune.
 */
import { allHexes, hexDistance, hexLabel, SUBSECTOR_COLS, SUBSECTOR_ROWS, type Hex } from './hex'
import { neighbours } from './chart'
import { newCharacter, playerTraits } from './characters'
import { chartLanes } from './lanes'
import { worldCultures, worldName } from './names'
import { createRng, nextInt, roll, type Rng } from './rng'
import { ADMINISTRATION, PLAYER, startingFactions } from './factions'
import type { Character, CharacterId, Faction, FactionId, Lane, LaneId, StarportClass, World, WorldId, WorldProfile } from './types'

export { ADMINISTRATION, EMPIRE, PLAYER } from './factions'

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
// Placement and the capital

/** A hex holds a world on 9+ (about 28%): some twenty-odd worlds, so every one of them matters and the gaps between them are real. */
const WORLD_TARGET = 9

/** The fewest worlds a subsector may have; a sparse roll is topped up to this. */
const MIN_WORLDS = 16

function isEdge({ col, row }: Hex): boolean {
  return col === 1 || col === SUBSECTOR_COLS || row === 1 || row === SUBSECTOR_ROWS
}

/**
 * The capital sits on the subsector's edge (per the first campaign: nearest
 * the border the Empire lies beyond). Among edge worlds it is the one with
 * the most traffic to govern from: real ports within two parsecs count for
 * more than population. It is guaranteed a class A port and a tech level
 * that can build ships.
 */
function chooseCapital(worlds: World[]): World {
  const edge = worlds.filter((w) => isEdge(w.hex))
  const pool = edge.length > 0 ? edge : worlds
  const score = (w: World) => {
    const ports = worlds.filter((o) => o !== w && (o.profile.starport === 'A' || o.profile.starport === 'B') && hexDistance(o.hex, w.hex) <= 2)
    return ports.length * 3 + w.profile.population
  }
  const capital = pool.reduce((best, w) => (score(w) > score(best) ? w : best))
  capital.profile.starport = 'A'
  capital.profile.population = Math.max(capital.profile.population, 7)
  capital.profile.tech = Math.max(capital.profile.tech, 12)
  return capital
}

// ---------------------------------------------------------------------------

export interface Generated {
  worlds: Record<WorldId, World>
  characters: Record<CharacterId, Character>
  factions: Record<FactionId, Faction>
  capital: WorldId
}

/** A world at a hex: who settled it, what it is called, and what it is like. Quiet and ungoverned until the rest of generation says otherwise. */
function newWorld(rng: Rng, hex: Hex, taken: Set<string>): World {
  const cultures = worldCultures(rng)
  return {
    id: worldId(hex),
    name: worldName(rng, cultures, taken),
    hex,
    cultures,
    profile: generateProfile(rng),
    faction: ADMINISTRATION,
    governor: null,
    actingGovernor: null,
    unrest: 0,
    garrison: 0,
    marines: 0,
    contest: null,
    lastLetter: nextInt(rng, -7, 0),
  }
}

/**
 * Worlds, their governors, and the two factions every game starts with.
 * Lanes and ships are laid over this by ./lanes.ts; the whole thing is
 * assembled into a GameState by newGame() in ./game.ts.
 */
export function generateWorlds(rng: Rng): Generated {
  const taken = new Set<string>()
  const worlds: Record<WorldId, World> = {}
  const characters: Record<CharacterId, Character> = {}
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

  const capital = chooseCapital(list)

  // Every populated world has an appointed governor; the player holds the capital.
  characters[PLAYER] = { id: PLAYER, name: 'The Subsector Governor', faction: ADMINISTRATION, post: { kind: 'governor', world: capital.id }, traits: playerTraits() }
  capital.governor = PLAYER
  capital.actingGovernor = PLAYER
  for (const world of list) {
    // Starting unrest and garrison: mostly quiet, occasionally not.
    world.unrest = world.profile.population === 0 ? 0 : Math.max(0, roll(rng) - 9)
    // A world that rolls no garrison usually has one detachment after all; only a second low roll leaves it truly empty.
    const rolled = Math.floor(world.profile.population / 2) + roll(rng) - 7
    world.garrison = world.profile.population === 0 ? 0 : rolled >= 1 ? rolled : roll(rng) <= 3 ? 0 : 1
    if (world === capital) {
      // The capital's own garrison, plus Government House's reserve: 4 army and 2 marine detachments (spec.md → Starting position).
      world.unrest = 0
      world.garrison = Math.max(world.garrison, 2) + 4
      world.marines = 2
      continue
    }
    if (world.profile.population === 0) continue
    const id = `c-gov-${hexLabel(world.hex)}` as CharacterId
    characters[id] = newCharacter(rng, id, ADMINISTRATION, { kind: 'governor', world: world.id })
    world.governor = id
    world.actingGovernor = id
  }

  const factions: Record<FactionId, Faction> = startingFactions(capital.id)

  // A handful of officers without posts at the capital, for Government House to send out to seats and prizes.
  for (let i = 1; i <= 4; i++) {
    const id = `c-officer-${i}` as CharacterId
    characters[id] = newCharacter(rng, id, ADMINISTRATION, { kind: 'unassigned', at: capital.id })
  }

  return { worlds, characters, factions, capital: capital.id }
}

// ---------------------------------------------------------------------------
// The shape of the campaign

/** The most worlds a subsector may have before it is rerolled: too many and no single one matters. */
const MAX_WORLDS = 28

/** How many worlds a chokepoint must cut off from the capital to count as one. */
const CHOKE_MIN = 3

/** How far from the capital the Warlord's seat must be able to lie. */
const FRONTIER = 6

/** The worlds reachable from `from` over the lanes, leaving `without` out of the chart. */
function reachable(lanes: Record<LaneId, Lane>, from: WorldId, without: WorldId | null = null): Set<WorldId> {
  const seen = new Set<WorldId>([from])
  const queue = [from]
  while (queue.length > 0) {
    const w = queue.pop() as WorldId
    for (const n of neighbours(lanes, w)) {
      if (n === without || seen.has(n)) continue
      seen.add(n)
      queue.push(n)
    }
  }
  return seen
}

/**
 * Why a laid-out subsector is, or is not, a campaign worth playing. A
 * layout passes when every reason is null:
 *
 * - it has neither too few worlds nor too many;
 * - the capital's chart reaches most of them, so the packets and the
 *   rumours cover the ground the game is played on;
 * - a few worlds lie off the lanes altogether, dark until a hull is sent;
 * - there is a chokepoint: a world whose loss cuts a real piece of the
 *   chart off from the capital, which is something to hold, to patrol, and
 *   for the Warlord to want;
 * - and there is a far corner: a populated port far enough from the
 *   capital for the Warlord to seat himself with room between.
 */
export function layoutFaults(worlds: Record<WorldId, World>, lanes: Record<LaneId, Lane>, capital: WorldId): string[] {
  const faults: string[] = []
  const all = Object.values(worlds)
  const n = all.length
  if (n < MIN_WORLDS || n > MAX_WORLDS) faults.push(`${n} worlds`)
  const chart = reachable(lanes, capital)
  if (chart.size < Math.ceil(n * 0.55)) faults.push(`capital's chart reaches only ${chart.size} of ${n}`)
  const dark = all.filter((w) => neighbours(lanes, w.id).length === 0).length
  if (dark < 1 || dark > 8) faults.push(`${dark} dark worlds`)
  const choke = [...chart].some((w) => w !== capital && chart.size - reachable(lanes, capital, w).size - 1 >= CHOKE_MIN)
  if (!choke) faults.push('no chokepoint')
  const here = worlds[capital].hex
  const far = all.some((w) => w.id !== capital && w.profile.population > 0 && (w.profile.starport === 'A' || w.profile.starport === 'B') && hexDistance(w.hex, here) >= FRONTIER)
  if (!far) faults.push('no far corner')
  return faults
}

/** How many layouts are tried before the last is taken as it comes. Deterministic: the same seed makes the same tries. */
export const LAYOUT_TRIES = 40

/**
 * A subsector and its lanes, rolled again until the layout passes (see
 * layoutFaults) or the tries run out. Everything after this — ships,
 * pirates, the Warlord — is laid over what comes back.
 */
export function generateSubsector(rng: Rng): Generated & { lanes: Record<LaneId, Lane>; tries: number } {
  let last: (Generated & { lanes: Record<LaneId, Lane> }) | null = null
  for (let i = 1; i <= LAYOUT_TRIES; i++) {
    const g = generateWorlds(rng)
    const lanes = chartLanes(rng, g.worlds)
    last = { ...g, lanes }
    if (layoutFaults(g.worlds, lanes, g.capital).length === 0) return { ...last, tries: i }
  }
  return { ...(last as Generated & { lanes: Record<LaneId, Lane> }), tries: LAYOUT_TRIES }
}

/** Convenience for tests: a fresh RNG and a generated subsector from one seed. */
export function generateFromSeed(seed: number): Generated & { rng: Rng } {
  const rng = createRng(seed)
  return { ...generateWorlds(rng), rng }
}
