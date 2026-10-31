/**
 * Captain-agents: the people who sail the hulls the player does not. Each
 * week in port a captain sells what was brought here, refuels, and picks
 * the best believed margin within jump from the same brokers' table the
 * player reads — believed, because the only prices anyone has for another
 * world are the ones they last saw or were told. A captain with nothing
 * worth carrying goes to look somewhere their knowledge is oldest. The
 * same menu the player has at this seat; nothing here reads ground truth
 * about any world but the one the captain is standing on.
 */
import { hexDistance } from './hex'
import { buy, GOODS, sell, tariffFor, type Good } from './economy'
import { beliefOf, characterLocation } from './mail'
import { officerCulture, personName, rollSex } from './names'
import { nextInt, roll, type Rng } from './rng'
import { fuelPrice, holdFree, maintenanceCost, newShip, overdue, reachable, setCourse, unload } from './ships'
import { layUp } from './game'
import { stanceKey, SHIP_CLASSES, type Character, type CharacterId, type EmpireId, type GameState, type Ship, type ShipId, type Week, type WorldId } from './types'
import type { Belief } from './view'

/** A trader's purse at the start: enough for half a hold of something ordinary. */
const TRADER_PURSE = 30000

/** The least expected profit on a leg a captain will bother buying for. */
const WORTH_IT = 1500

/** Weeks a captain will hold cargo bought on speculation before dumping it wherever they are. */
const PATIENCE = 8

/**
 * The traders the subsector starts with: about one per populated world
 * with a working port, free traders mostly, a far trader now and then,
 * each owned by a captain of the world's own empire.
 */
export function spawnTraders(state: GameState, taken: Set<string>): void {
  const rng = state.rng
  const ids = Object.keys(state.worlds).sort() as WorldId[]
  let n = 1
  for (const id of ids) {
    const world = state.worlds[id]
    if (world.profile.population === 0 || !['A', 'B', 'C'].includes(world.profile.starport)) continue
    const count = world.profile.starport === 'A' ? 2 : roll(rng) >= 6 ? 1 : 0
    for (let i = 0; i < count; i++) {
      const empire = world.empire
      const cid = `c-trader-${n}` as CharacterId
      const sid = `s-trader-${n}` as ShipId
      n += 1
      const core = state.empires[empire].core
      const culture = officerCulture(rng, core)
      const sex = rollSex(rng)
      const captain: Character = { id: cid, name: personName(rng, culture, sex), culture, sex, empire, body: { kind: 'aboard', ship: sid }, purse: TRADER_PURSE + nextInt(rng, -5000, 10000), debt: null }
      state.characters[cid] = captain
      state.ships[sid] = newShip(rng, sid, roll(rng) >= 10 ? 'far_trader' : 'free_trader', empire, { kind: 'personal', character: cid }, id, taken, cid)
    }
  }
}

/** The captains in port with hulls of their own to run: everyone but the player. */
function tradingCaptains(state: GameState): { captain: Character; ship: Ship; at: WorldId }[] {
  const out: { captain: Character; ship: Ship; at: WorldId }[] = []
  const ids = Object.keys(state.ships).sort() as ShipId[]
  for (const id of ids) {
    const ship = state.ships[id]
    if (!ship.captain || ship.captain === state.player || ship.owner.kind !== 'personal' || ship.location.kind !== 'world' || ship.duty || ship.inYard !== null) continue
    const captain = state.characters[ship.captain]
    if (!captain || captain.captive || captain.body.kind !== 'aboard' || captain.body.ship !== ship.id) continue
    out.push({ captain, ship, at: ship.location.world })
  }
  return out
}

/** What a reader believes two empires' stance is: war only if they have heard so. */
function believesAtWar(belief: Belief, a: EmpireId, b: EmpireId): boolean {
  return a !== b && belief.stances[stanceKey(a, b)]?.stance === 'war'
}

interface Leg {
  to: WorldId
  good: Good
  tons: number
  profit: number
}

/** The best leg from here by the captain's own lights, or null if nothing clears the bar. */
function bestLeg(state: GameState, captain: Character, ship: Ship, at: WorldId): Leg | null {
  const here = state.worlds[at]
  const belief = beliefOf(state, captain.id)
  const room = holdFree(ship)
  let best: Leg | null = null
  for (const to of reachable(state, at, SHIP_CLASSES[ship.type].jump)) {
    const known = belief.prices[to]
    if (!known) continue
    const toEmpire = belief.worlds[to]?.snapshot.kind === 'world' ? belief.worlds[to].snapshot.world.empire : state.worlds[to].empire
    if (believesAtWar(belief, captain.empire, toEmpire)) continue
    for (const good of GOODS) {
      const sellAt = known[good]
      if (!sellAt) continue
      const cost = here.market[good].price * (1 + tariffFor(here.empire, captain.empire))
      const proceeds = sellAt.price * (1 - tariffFor(toEmpire, captain.empire))
      const margin = proceeds - cost
      if (margin <= 0) continue
      const tons = Math.min(room, here.market[good].stock, Math.floor(captain.purse / cost))
      if (tons <= 0) continue
      const profit = Math.round(margin * tons)
      if (!best || profit > best.profit) best = { to, good, tons, profit }
    }
  }
  return best && best.profit >= WORTH_IT ? best : null
}

/** Somewhere in reach the captain knows least about, preferring their own empire's ports and avoiding an enemy's. */
function somewhereToLook(state: GameState, captain: Character, ship: Ship, at: WorldId): WorldId | null {
  const belief = beliefOf(state, captain.id)
  const options = reachable(state, at, SHIP_CLASSES[ship.type].jump).filter((w) => {
    const e = belief.worlds[w]?.snapshot.kind === 'world' ? belief.worlds[w].snapshot.world.empire : state.worlds[w].empire
    return !believesAtWar(belief, captain.empire, e)
  })
  if (options.length === 0) return null
  const age = (w: WorldId) => {
    const p = belief.prices[w]
    if (!p) return Number.POSITIVE_INFINITY
    return state.week - Math.max(...Object.values(p).map((e) => e?.observed ?? -999))
  }
  const score = (w: WorldId) => {
    const e = belief.worlds[w]?.snapshot.kind === 'world' ? belief.worlds[w].snapshot.world.empire : state.worlds[w].empire
    const port = state.worlds[w].profile.starport
    return Math.min(age(w), 52) + (e === captain.empire ? 10 : 0) + (port === 'A' || port === 'B' ? 6 : port === 'C' ? 2 : -20)
  }
  options.sort((a, b) => score(b) - score(a) || (a < b ? -1 : 1))
  // A little whim, so a crowd of captains does not all go the same way.
  const top = options.slice(0, Math.min(3, options.length))
  return top[nextInt(state.rng, 0, top.length - 1)]
}

/** One captain's week in port. */
function captainActs(state: GameState, captain: Character, ship: Ship, at: WorldId): void {
  const here = state.worlds[at]
  const duty = tariffFor(here.empire, captain.empire)
  // Sell what pays, or what has been aboard too long.
  for (const lot of [...ship.hold]) {
    if (lot.kind !== 'cargo') continue
    const price = here.market[lot.good].price * (1 - duty)
    if (price > lot.paid || state.week - lot.week >= PATIENCE) {
      const n = unload(ship, lot.good, lot.tons)
      if (n > 0) captain.purse += sell(here, lot.good, n, captain.empire).credits
    }
  }
  // Fuel, if it can be had and afforded.
  const fuel = fuelPrice(here.profile.starport)
  while (fuel !== null && ship.fuel < SHIP_CLASSES[ship.type].tanks && captain.purse >= fuel + 2000) {
    captain.purse -= fuel
    ship.fuel += 1
  }
  if (ship.fuel < 1) return
  // Maintenance when due, if this is a dockyard and the purse allows; a captain lets it slide a while if short.
  if (state.week - ship.maintained >= 24 && ['A', 'B'].includes(here.profile.starport) && captain.purse >= maintenanceCost(ship) + 5000 && (overdue(ship, state.week) > 0 || roll(state.rng) >= 7)) {
    if (layUp(state, ship, here)) return
  }
  // Buy for the best believed margin, or go and look.
  const leg = bestLeg(state, captain, ship, at)
  if (leg) {
    const deal = buy(here, leg.good, leg.tons, captain.empire)
    if (deal) {
      captain.purse -= deal.credits
      ship.hold.push({ kind: 'cargo', good: leg.good, tons: deal.tons, paid: Math.round(deal.credits / deal.tons), from: at, week: state.week })
    }
    setCourse(state, ship, leg.to)
    return
  }
  // Cargo still aboard that would not sell here: carry it somewhere it might.
  const to = somewhereToLook(state, captain, ship, at)
  if (to) setCourse(state, ship, to)
}

/** Every captain in port acts. */
export function captainsAct(state: GameState): void {
  for (const { captain, ship, at } of tradingCaptains(state)) captainActs(state, captain, ship, at)
}

// ---------------------------------------------------------------------------
// Talk

/** Prices one reader knows that are newer than what another holds, copied across. Returns how many entries were news. */
export function tellPrices(from: Belief, to: Belief): number {
  let news = 0
  for (const w of Object.keys(from.prices) as WorldId[]) {
    const mine = (to.prices[w] ??= {})
    for (const g of Object.keys(from.prices[w]) as Good[]) {
      const theirs = from.prices[w][g]
      if (!theirs) continue
      const known = mine[g]
      if (!known || theirs.observed > known.observed) {
        mine[g] = { ...theirs }
        news += 1
      }
    }
  }
  return news
}

/** Captains lying in the same port swap what they know of prices. The player is not in the circle: they must go to the bar themselves. */
export function dockTalk(state: GameState): void {
  const byPort: Record<string, CharacterId[]> = {}
  for (const { captain, at } of tradingCaptains(state)) (byPort[at] ??= []).push(captain.id)
  for (const port of Object.keys(byPort).sort()) {
    const ids = byPort[port]
    if (ids.length < 2) continue
    for (const a of ids) for (const b of ids) if (a !== b) tellPrices(beliefOf(state, a), beliefOf(state, b))
  }
}

/** The player asks around the bar: every captain in port tells what they know. Returns how much was news. */
export function askAround(state: GameState): number {
  const at = characterLocation(state, state.player)
  if (at === null) return 0
  let news = 0
  for (const { captain } of tradingCaptains(state)) {
    if (characterLocation(state, captain.id) !== at) continue
    news += tellPrices(beliefOf(state, captain.id), beliefOf(state, state.player))
  }
  return news
}

/**
 * What a captain starting out already knows: their home port and the
 * ports within two jumps of it, as of a few weeks ago. Seeded from the
 * chart rather than the markets as they are, with the price written as it
 * stood when the game began: honest enough for a start.
 */
export function seedTraderKnowledge(state: GameState, rng: Rng, captain: Character, home: WorldId): void {
  const belief = beliefOf(state, captain.id)
  const near = (Object.keys(state.worlds).sort() as WorldId[]).filter((w) => hexDistance(state.worlds[w].hex, state.worlds[home].hex) <= 4)
  for (const w of near) {
    const age: Week = w === home ? 0 : nextInt(rng, 2, 10)
    const prices = (belief.prices[w] ??= {})
    for (const g of GOODS) prices[g] = { price: state.worlds[w].market[g].price, stock: state.worlds[w].market[g].stock, observed: -age }
  }
}
