/**
 * The port register. Every hull's week at a port is a line in it: where
 * she came in from, what she sold and bought on the books, where she
 * declared for when she sailed. The port keeps a year. What a reader sees
 * of it depends on how they came by it: this week's page with their own
 * eyes, the notable sales by gossip, the whole year from the
 * administrator for a fee. Smuggling is not in it, which is the point of
 * smuggling.
 */
import type { GameState, Movement, Ship, Week, World, WorldId } from './types'
import type { Good } from './economy'

/** Weeks a port keeps its register. */
export const REGISTER_WEEKS = 52

/** The line for a hull this week, made if there is none. */
export function lineFor(state: GameState, world: World, ship: Ship): Movement {
  let m = world.register.find((x) => x.week === state.week && x.ship === ship.id)
  if (!m) {
    const captain = ship.captain ? state.characters[ship.captain] : null
    m = { week: state.week, ship: ship.id, shipName: ship.name, type: ship.type, empire: ship.empire, captain: ship.captain, captainName: captain?.name ?? null, from: null, to: null, sold: [], bought: [] }
    world.register.push(m)
  }
  return m
}

export function recordArrival(state: GameState, world: World, ship: Ship, from: WorldId): void {
  lineFor(state, world, ship).from = from
}

export function recordSailing(state: GameState, world: World, ship: Ship, to: WorldId): void {
  lineFor(state, world, ship).to = to
}

/** A trade goes on the hull's line for the week; tranches of one good are one entry, at the average price. */
export function recordTrade(state: GameState, world: World, ship: Ship, kind: 'sold' | 'bought', good: Good, tons: number, price: number): void {
  if (tons <= 0) return
  const side = lineFor(state, world, ship)[kind]
  const same = side.find((x) => x.good === good)
  if (same) {
    same.price = Math.round((same.price * same.tons + price * tons) / (same.tons + tons))
    same.tons += tons
  } else side.push({ good, tons, price })
}

/** Lines older than a year are struck. */
export function pruneRegisters(state: GameState): void {
  for (const w of Object.values(state.worlds)) w.register = w.register.filter((m) => state.week - m.week < REGISTER_WEEKS)
}

/** The register's lines from `since` on, newest first. */
export function registerSince(world: World, since: Week): Movement[] {
  return world.register.filter((m) => m.week >= since).sort((a, b) => b.week - a.week || (a.ship < b.ship ? -1 : 1))
}
