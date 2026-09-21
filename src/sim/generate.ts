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
import { newCharacter, playerTraits } from './characters'
import { worldName } from './names'
import { createRng, nextInt, roll, type Rng } from './rng'
import { ADMINISTRATION, PLAYER, startingFactions } from './factions'
import type { Character, CharacterId, Faction, FactionId, StarportClass, World, WorldId, WorldProfile } from './types'

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

/** A hex holds a world on 8+ (about 42%). Sparser than the rules-default so clusters and gaps both exist. */
const WORLD_TARGET = 8

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
    const id = worldId(hex)
    const world: World = {
      id,
      name: worldName(rng, taken),
      hex,
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
    worlds[id] = world
    list.push(world)
  }

  // A subsector with fewer than a handful of worlds is no game; reroll the
  // sparse tail by filling random empty hexes until there are at least twelve.
  const hexes = allHexes()
  while (list.length < 12) {
    const hex = hexes[nextInt(rng, 0, hexes.length - 1)]
    const id = worldId(hex)
    if (worlds[id]) continue
    const world: World = {
      id,
      name: worldName(rng, taken),
      hex,
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
    world.garrison = world.profile.population === 0 ? 0 : Math.max(0, Math.floor(world.profile.population / 2) + roll(rng) - 7)
    if (world === capital) {
      // The capital's own garrison, plus the desk's reserve: 4 army and 2 marine detachments (spec.md → Starting position).
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

  // A handful of officers without posts at the capital, for the desk to send out to seats and prizes.
  for (let i = 1; i <= 4; i++) {
    const id = `c-officer-${i}` as CharacterId
    characters[id] = newCharacter(rng, id, ADMINISTRATION, { kind: 'unassigned', at: capital.id })
  }

  return { worlds, characters, factions, capital: capital.id }
}

/** Convenience for tests: a fresh RNG and a generated subsector from one seed. */
export function generateFromSeed(seed: number): Generated & { rng: Rng } {
  const rng = createRng(seed)
  return { ...generateWorlds(rng), rng }
}
