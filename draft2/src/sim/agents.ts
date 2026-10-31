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
import { expectedArrival, route } from './chart'
import { recordTrade } from './register'
import { hexDistance } from './hex'
import { buy, demandLevel, dutyRate, FINE_TIMES_DUTY, GOOD_SPECS, GOODS, inspectionChance, levelOf, marketScale, production, sell, supplyLevel, valueScale, type Good } from './economy'
import { postNewsItem } from './news'
import { learnTraffic } from './belief'
import { deal, esteemOf, impressed, regardOf, relation, rollTraits, traitsOf } from './people'
import { beliefOf, characterLocation } from './mail'
import { officerCulture, personName, rollSex } from './names'
import { nextFloat, nextInt, roll, type Rng } from './rng'
import { fuelPrice, holdFree, maintenanceCost, newShip, overdue, reachable, setCourse, unload } from './ships'
import { layUp } from './game'
import { stanceKey, SHIP_CLASSES, type Character, type CharacterId, type EmpireId, type GameState, type Guild, type PriceBook, type RouteRequest, type Ship, type ShipId, type Week, type World, type WorldId, type WorldProfile } from './types'
import { lineKey, type Belief } from './view'

/** A trader's purse at the start: enough for half a hold of something ordinary. */
const TRADER_PURSE = 30000

/** The least expected profit on a leg a captain will bother buying for. */
const WORTH_IT = 1500

/** What a captain keeps back from cargo: the next maintenance and two tanks. */
function reserve(ship: Ship): number {
  return maintenanceCost(ship) + 1000
}

/** Other traders lying in the same port: they see the same dock. */
function rivalsAt(state: GameState, ship: Ship, at: WorldId): number {
  let n = 0
  for (const s of Object.values(state.ships)) if (s.id !== ship.id && s.owner.kind === 'personal' && !s.duty && s.captain && s.location.kind === 'world' && s.location.world === at) n++
  return n
}

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
      const captain: Character = { id: cid, name: personName(rng, culture, sex), culture, sex, empire, body: { kind: 'aboard', ship: sid }, purse: TRADER_PURSE + nextInt(rng, -5000, 10000), debt: null, traits: rollTraits(rng) }
      // About half carry the guild's ticket.
      if (roll(rng) >= 7) captain.guild = empire
      state.characters[cid] = captain
      state.ships[sid] = newShip(rng, sid, roll(rng) >= 10 ? 'far_trader' : 'free_trader', empire, { kind: 'personal', character: cid }, id, taken, cid)
    }
  }
}

/** Book a deal's duty to the port's governor and, when a hull and a side are given, the deal in the port's register. Returns the deal for chaining. */
export function trade(state: GameState, world: World, deal: { duty: number; credits: number; tons: number; price: number }, ship?: Ship, kind?: 'sold' | 'bought', good?: Good): { duty: number; credits: number; tons: number; price: number } {
  state.empires[world.empire].treasury += deal.duty
  if (ship && kind && good) recordTrade(state, world, ship, kind, good, deal.tons, deal.price)
  return deal
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

/** The captain's reckoning of a sale at a world they are not standing on. */
interface Expectation {
  /** Credits a ton for the first ton. */
  price: number
  /** Weeks since the price was seen. */
  age: number
}

/**
 * What a captain expects a good to fetch at a world, from what they last
 * saw or heard there, blended toward what a world of that profile usually
 * pays as the word ages: a seasoned captain knows a farm world pays little
 * for grain whatever the last rumour said. Null if the captain knows
 * nothing of the place.
 */
function expectedPrice(state: GameState, belief: Belief, world: WorldId, good: Good): Expectation | null {
  const known = belief.prices[world]?.[good]
  const snap = belief.worlds[world]?.snapshot.kind === 'world' ? belief.worlds[world].snapshot.world : null
  if (!known && !snap) return null
  const profile = snap?.profile ?? state.worlds[world].profile
  const prior = GOOD_SPECS[good].base * (1 + 0.2 * demandLevel(profile, good) - 0.2 * supplyLevel(profile, good))
  if (!known) return { price: prior, age: 52 }
  const age = Math.max(0, state.week - known.observed)
  // Hearsay ages twice as fast as what was seen.
  const trust = Math.max(0.5, 1 - (known.heard ? age * 2 : age) / 52)
  return { price: known.price * trust + prior * (1 - trust), age }
}

/** How far a sale of `tons` onto a dock believed to hold `stock` knocks the price: the brokers' own rule, as every captain knows it. */
function afterSelling(profile: WorldProfile, good: Good, price: number, stock: number, tons: number): number {
  return (price * levelOf(profile, good, stock + tons)) / levelOf(profile, good, stock)
}

/** The profile a captain believes a world has: from the chart, which never lies about a profile. */
function profileOf(state: GameState, belief: Belief, world: WorldId): WorldProfile {
  const snap = belief.worlds[world]?.snapshot
  return snap?.kind === 'world' ? snap.world.profile : state.worlds[world].profile
}

/** Whether the captain has heard of hulls taken in the approaches of a world lately. */
function dangerous(state: GameState, belief: Belief, world: WorldId): boolean {
  const snap = belief.worlds[world]?.snapshot
  if (snap?.kind !== 'world') return false
  return snap.world.news.some((n) => state.week - n.week <= 8 && /taken in the approaches/.test(n.text))
}

/** Whether fuel can be had at a world, as the chart has it. */
function fuelAt(state: GameState, belief: Belief, world: WorldId): boolean {
  return ['A', 'B', 'C'].includes(profileOf(state, belief, world).starport)
}

interface Lot {
  good: Good
  tons: number
  /** Expected profit on the lot, duty both ways and the captain's own sale allowed for. */
  profit: number
}

interface Plan {
  to: WorldId
  lots: Lot[]
  /** Freight lots on the board worth taking for this destination. */
  freight: string[]
  /** Profit on this leg. */
  profit: number
  /** This leg plus half the best believed leg onward: what makes a hub worth more than a dead end. */
  score: number
}

/**
 * The best lots to carry from `here` to `to` with `room` tons and `purse`
 * credits: the good with the best margin a ton first, as much of it as the
 * dock, the hold, the purse and the price it would fetch after the sale
 * allow, then the next good. Expected, not promised.
 */
function lotsFor(state: GameState, belief: Belief, captain: Character, here: World, to: WorldId, room: number, purse: number, buyHere: boolean): Lot[] {
  const toProfile = profileOf(state, belief, to)
  const toEmpire = belief.worlds[to]?.snapshot.kind === 'world' ? belief.worlds[to].snapshot.world.empire : state.worlds[to].empire
  const dutyOut = dutyRate({ profile: toProfile, empire: toEmpire }, captain.empire)
  const dutyIn = dutyRate(here, captain.empire)
  const margins: { good: Good; cost: number; sale: number; stockThere: number }[] = []
  for (const good of GOODS) {
    const exp = expectedPrice(state, belief, to, good)
    if (!exp) continue
    const cost = (buyHere ? here.market[good].price : expectedPrice(state, belief, here.id, good)?.price ?? here.market[good].price) * (1 + dutyIn)
    const sale = exp.price * (1 - dutyOut)
    const stockThere = belief.prices[to]?.[good]?.stock ?? 0
    if (sale > cost) margins.push({ good, cost, sale, stockThere })
  }
  margins.sort((a, b) => b.sale - b.cost - (a.sale - a.cost) || (a.good < b.good ? -1 : 1))
  const lots: Lot[] = []
  for (const m of margins) {
    if (room <= 0 || purse <= 0) break
    const stock = buyHere ? here.market[m.good].stock : Math.round(10 * marketScale(here.profile) * valueScale(m.good) * 4)
    const most = Math.min(room, stock, Math.floor(purse / m.cost))
    if (most <= 0) continue
    // Size the lot where the next ten tons would no longer pay.
    let best: Lot | null = null
    for (let n = 10; n <= most; n += 10) {
      const avg = (afterSelling(toProfile, m.good, m.sale, m.stockThere, n) + m.sale) / 2
      const profit = Math.round((avg - m.cost) * n)
      if (!best || profit > best.profit) best = { good: m.good, tons: n, profit }
    }
    if (most < 10) {
      const profit = Math.round((m.sale - m.cost) * most)
      best = { good: m.good, tons: most, profit }
    }
    if (!best || best.profit <= 0) continue
    lots.push(best)
    room -= best.tons
    purse -= best.tons * m.cost
  }
  return lots
}

/** The best believed leg onward from `from`, bought there at the prices last known: a guess at what the next week offers. */
function onwardProfit(state: GameState, belief: Belief, captain: Character, ship: Ship, from: WorldId, purse: number): number {
  const snap = belief.worlds[from]?.snapshot
  if (snap?.kind !== 'world') return 0
  const pretend = { ...state.worlds[from], profile: snap.world.profile, empire: snap.world.empire }
  let best = 0
  for (const next of reachable(state, from, SHIP_CLASSES[ship.type].jump)) {
    if (!belief.prices[next] && !belief.worlds[next]) continue
    const lots = lotsFor(state, belief, captain, pretend, next, SHIP_CLASSES[ship.type].hold, purse, false)
    const profit = lots.reduce((s, l) => s + l.profit, 0)
    if (profit > best) best = profit
  }
  return best
}

/** The best plan from here by the captain's own lights, or null if nothing clears the bar. */
export function bestPlan(state: GameState, captain: Character, ship: Ship, at: WorldId): Plan | null {
  const here = state.worlds[at]
  const belief = beliefOf(state, captain.id)
  const room = holdFree(ship)
  const avoid = routesToAvoid(state, captain)
  let best: Plan | null = null
  for (const to of reachable(state, at, SHIP_CLASSES[ship.type].jump)) {
    if (!belief.prices[to] && !belief.worlds[to]) continue
    const toEmpire = belief.worlds[to]?.snapshot.kind === 'world' ? belief.worlds[to].snapshot.world.empire : state.worlds[to].empire
    if (believesAtWar(belief, captain.empire, toEmpire)) continue
    // No jumping into a dry port on the last tank.
    if (ship.fuel - 1 < 1 && !fuelAt(state, belief, to)) continue
    const freight = here.freight.filter((f) => f.to === to)
    // Freight first where it pays better a ton than the best cargo margin would.
    const spend = Math.max(0, captain.purse - reserve(ship) * (0.5 + traitsOf(captain).caution))
    // A promise made is kept: nothing asked of them is bought here for there.
    const lots = lotsFor(state, belief, captain, here, to, room, spend, true).filter((l) => !avoid.some((x) => x.world === at && x.good === l.good))
    const cargoPerTon = lots.length > 0 ? lots[0].profit / lots[0].tons : 0
    let left = room
    let freightProfit = 0
    const taken: string[] = []
    for (const f of freight.sort((a, b) => b.rate - a.rate)) {
      if (f.rate < cargoPerTon || f.tons > left) continue
      taken.push(f.id)
      left -= f.tons
      freightProfit += f.tons * f.rate
    }
    const cargo = taken.length > 0 ? lotsFor(state, belief, captain, here, to, left, spend, true).filter((l) => !avoid.some((x) => x.world === at && x.good === l.good)) : lots
    let profit = freightProfit + cargo.reduce((s, l) => s + l.profit, 0)
    // Danger weighs on the careful far more than on the bold.
    if (dangerous(state, belief, to)) profit = Math.round(profit * (0.9 - 0.6 * traitsOf(captain).caution))
    // Every rival in port is after the same lots and the same markets; and every hull seen sailing for the same port
    // with the same goods these last two weeks got there first. A proud captain contests a rival's leg rather than yield it;
    // anyone else gives a rival a wider berth than a stranger.
    const t = traitsOf(captain)
    let crowd = 0
    for (const k of belief.traffic[at] ?? []) {
      if (k.movement.ship === ship.id || k.movement.to !== to || state.week - k.movement.week > 2 || !k.movement.bought.some((b) => cargo.some((l) => l.good === b.good))) continue
      const rival = k.movement.captain !== null && regardOf(state, captain.id, k.movement.captain) <= -1
      crowd += rival ? (t.pride >= 0.6 ? 0.3 : 1.5) : 1
    }
    // A guild line on this pair means a bulk hauler is already carrying whatever pays: the route is theirs. A captain who knows of it halves their hopes.
    const lined = belief.lines[lineKey(at, to)] !== undefined && state.week - belief.lines[lineKey(at, to)].observed <= 26
    profit = Math.round(profit / ((1 + 0.15 * rivalsAt(state, ship, at) + 0.3 * crowd) * (lined ? 2 : 1)))
    const onward = onwardProfit(state, belief, captain, ship, to, captain.purse + profit)
    const score = profit + Math.round(onward / 2)
    if (!best || score > best.score) best = { to, lots: cargo, freight: taken, profit, score }
  }
  // A grasping captain sails for a sliver; a content one wants a margin worth the week.
  return best && best.profit >= WORTH_IT * (1.5 - traitsOf(captain).greed) ? best : null
}

/** Whether some reachable world is believed to pay better for a lot than this port does now. */
function betterElsewhere(state: GameState, belief: Belief, captain: Character, ship: Ship, at: WorldId, good: Good, hereNet: number): boolean {
  for (const to of reachable(state, at, SHIP_CLASSES[ship.type].jump)) {
    const exp = expectedPrice(state, belief, to, good)
    if (!exp || !belief.prices[to]) continue
    const toEmpire = belief.worlds[to]?.snapshot.kind === 'world' ? belief.worlds[to].snapshot.world.empire : state.worlds[to].empire
    if (believesAtWar(belief, captain.empire, toEmpire)) continue
    if (exp.price * (1 - dutyRate({ profile: profileOf(state, belief, to), empire: toEmpire }, captain.empire)) > hereNet * 1.15) return true
  }
  return false
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
  // A world that hulls have lately come in from with cargo that sold well is worth a look: somebody found something there.
  const origins: Record<string, number> = {}
  for (const t of Object.values(belief.traffic)) {
    for (const k of t) {
      if (!k.movement.from || state.week - k.movement.week > 12 || k.movement.sold.length === 0) continue
      origins[k.movement.from] = (origins[k.movement.from] ?? 0) + k.movement.sold.reduce((sum, x) => sum + x.tons * x.price, 0)
    }
  }
  const score = (w: WorldId) => {
    const e = belief.worlds[w]?.snapshot.kind === 'world' ? belief.worlds[w].snapshot.world.empire : state.worlds[w].empire
    const port = state.worlds[w].profile.starport
    const lead = origins[w] ? Math.min(20, Math.round(origins[w] / 5000)) : 0
    return Math.min(age(w), 52) + (e === captain.empire ? 10 : 0) + (port === 'A' || port === 'B' ? 6 : port === 'C' ? 2 : -20) + lead
  }
  options.sort((a, b) => score(b) - score(a) || (a < b ? -1 : 1))
  // A little whim, so a crowd of captains does not all go the same way.
  const top = options.slice(0, Math.min(3, options.length))
  return top[nextInt(state.rng, 0, top.length - 1)]
}

/**
 * A captain carrying a good into a port where someone else sold the same
 * good this week or last, and now finds the price under what they paid,
 * knows who got there first. It is not forgotten.
 */
export function noticeUndercut(state: GameState, me: Character, ship: Ship, here: World, good: Good, paid: number): void {
  const net = here.market[good].price * (1 - dutyRate(here, me.empire))
  if (net >= paid) return
  for (const m of here.register) {
    if (m.ship === ship.id || !m.captain || state.week - m.week > 1 || !m.sold.some((x) => x.good === good)) continue
    deal(state, me.id, m.captain, -0.4, `${m.captainName} undercut me on ${good} at ${here.name}`, 'undercut')
  }
}

/**
 * A lot bought on someone's word is sold: the word is settled. A tip
 * that made money weighs a great deal; one that lost money is held
 * against the teller, though less, since markets move.
 */
export function settleTip(state: GameState, me: CharacterId, lot: { tip?: CharacterId | null; good: Good }, made: number, here: World): void {
  if (!lot.tip || lot.tip === me) return
  if (made > 0) deal(state, me, lot.tip, Math.min(1.5, 0.4 + made / 5000), `made ${made} on ${state.characters[lot.tip]?.name ?? 'a'}'s tip about ${lot.good} at ${here.name}`, 'tip_paid')
  else deal(state, me, lot.tip, -0.5, `${state.characters[lot.tip]?.name ?? 'a'}'s tip about ${lot.good} at ${here.name} cost me`, 'tip_cost')
}

/** One captain's week in port. */
function captainActs(state: GameState, captain: Character, ship: Ship, at: WorldId): void {
  const here = state.worlds[at]
  const belief = beliefOf(state, captain.id)
  const duty = dutyRate(here, captain.empire)
  // Sell what pays here, in tranches, while the price still beats what was paid; hold the rest for a port believed to pay more, unless it has been aboard too long.
  for (const lot of [...ship.hold]) {
    if (lot.kind !== 'cargo') continue
    noticeUndercut(state, captain, ship, here, lot.good, lot.paid)
    const stale = state.week - lot.week >= PATIENCE
    const net = here.market[lot.good].price * (1 - duty)
    if (stale && !betterElsewhere(state, belief, captain, ship, at, lot.good, net)) {
      const n = unload(ship, lot.good, lot.tons)
      if (n > 0) {
        const credits = trade(state, here, sell(here, lot.good, n, captain.empire), ship, 'sold', lot.good).credits
        captain.purse += credits
        settleTip(state, captain.id, lot, credits - lot.paid * n, here)
      }
      continue
    }
    let tons = lot.tons
    let made = 0
    let soldTons = 0
    while (tons > 0) {
      const n = Math.min(10, tons)
      const priceNow = here.market[lot.good].price * (1 - duty)
      if (priceNow <= lot.paid * 1.02) break
      if (!stale && betterElsewhere(state, belief, captain, ship, at, lot.good, priceNow)) break
      const sold = unload(ship, lot.good, n)
      if (sold === 0) break
      const credits = trade(state, here, sell(here, lot.good, sold, captain.empire), ship, 'sold', lot.good).credits
      captain.purse += credits
      made += credits - lot.paid * sold
      soldTons += sold
      tons -= sold
    }
    if (soldTons > 0) settleTip(state, captain.id, lot, made, here)
  }
  // Fuel, if it can be had and afforded.
  const fuel = fuelPrice(here.profile.starport)
  while (fuel !== null && ship.fuel < SHIP_CLASSES[ship.type].tanks && captain.purse >= fuel + 2000) {
    captain.purse -= fuel
    ship.fuel += 1
  }
  if (ship.fuel < 1) return
  // Maintenance when due, if this is a dockyard and the purse allows; a captain lets it slide a while if short.
  if (state.week - ship.maintained >= 26 - 4 * traitsOf(captain).caution && ['A', 'B'].includes(here.profile.starport) && captain.purse >= maintenanceCost(ship) + 5000 && (overdue(ship, state.week) > 0 || roll(state.rng) >= 7)) {
    if (layUp(state, ship, here)) return
  }
  // Buy for the best believed plan, or go and look.
  const plan = bestPlan(state, captain, ship, at)
  if (plan) {
    for (const id of plan.freight) {
      const i = here.freight.findIndex((f) => f.id === id)
      if (i < 0) continue
      const f = here.freight[i]
      if (f.tons > holdFree(ship)) continue
      here.freight.splice(i, 1)
      ship.hold.push({ kind: 'freight', good: f.good, tons: f.tons, to: f.to, rate: f.rate, from: at, week: state.week })
    }
    for (const lot of plan.lots) {
      const n = Math.min(lot.tons, holdFree(ship))
      if (n <= 0) break
      const t2 = traitsOf(captain)
      const dodge = dutyRate(here, captain.empire) >= 0.15 && t2.greed >= 0.7 && t2.caution <= 0.4
      const deal = buy(here, lot.good, n, captain.empire, { smuggle: dodge })
      if (deal && dodge && customsCatch(state, here, captain, ship, lot.good, deal.tons, deal.tons * deal.price)) continue
      if (!deal || deal.credits > captain.purse) {
        if (deal) {
          // Put it back: the purse would not stretch.
          here.market[lot.good].stock += deal.tons
        }
        continue
      }
      trade(state, here, deal, ship, 'bought', lot.good)
      captain.purse -= deal.credits
      const word = belief.prices[plan.to]?.[lot.good]
      ship.hold.push({ kind: 'cargo', good: lot.good, tons: deal.tons, paid: Math.round(deal.credits / deal.tons), from: at, week: state.week, tip: word?.heard && word.from ? word.from : null })
    }
    setCourse(state, ship, plan.to)
    return
  }
  // Nothing worth carrying. If the dock is merely picked over, wait a week for it to fill; else go and look, taking any freight that happens to be going that way.
  const pickedOver = GOODS.some((g) => production(here.profile, g) > 0 && here.market[g].stock < production(here.profile, g) * 2) && rivalsAt(state, ship, at) <= 2
  if (pickedOver && roll(state.rng) >= 5) return
  const to = somewhereToLook(state, captain, ship, at)
  if (to) {
    for (const f of [...here.freight]) {
      if (f.to !== to || f.tons > holdFree(ship)) continue
      here.freight.splice(here.freight.indexOf(f), 1)
      ship.hold.push({ kind: 'freight', good: f.good, tons: f.tons, to: f.to, rate: f.rate, from: at, week: state.week })
    }
    setCourse(state, ship, to)
  }
}

/**
 * The customs house looks into a trade off the books, as it does for the
 * player: caught, the goods are seized and a fine of three times the duty
 * dodged is due; a purse that cannot pay means arrest, and the hull waits.
 * Returns whether they were caught.
 */
export function customsCatch(state: GameState, here: World, captain: Character, ship: Ship, good: Good, tons: number, value: number): boolean {
  const atWar = here.empire !== captain.empire && here.board[stanceKey(here.empire, captain.empire)]?.stance === 'war'
  if (nextInt(state.rng, 1, 100) > inspectionChance(here, captain.empire, atWar) * 100) return false
  const fine = Math.round(value * dutyRate(here, captain.empire) * FINE_TIMES_DUTY)
  here.market[good].stock += tons
  state.empires[here.empire].treasury += Math.min(fine, Math.max(0, captain.purse))
  if (captain.purse >= fine) {
    captain.purse -= fine
    postNewsItem(state, here.id, `The customs house seized ${tons} t of ${good} off the ${ship.name} and fined her master, ${captain.name}.`)
    return true
  }
  captain.purse = Math.max(0, captain.purse - fine)
  captain.captive = { by: null, of: here.empire, since: state.week, at: here.id, term: state.week + nextInt(state.rng, 8, 16) }
  captain.body = { kind: 'world', world: here.id }
  ship.course = null
  postNewsItem(state, here.id, `${captain.name} of the ${ship.name} was arrested for smuggling ${good}.`)
  return true
}

/** Every captain in port acts. */
export function captainsAct(state: GameState): void {
  for (const { captain, ship, at } of tradingCaptains(state)) captainActs(state, captain, ship, at)
}

// ---------------------------------------------------------------------------
// Talk: who tells whom what, and at what price

/** What a round of drinks, or a plainer bribe, costs to loosen a tongue. */
export const BRIBE = 500

/** Prices one book holds that are newer than another's, copied across; `heard` marks hearsay. Returns how many entries were news. */
export function tellPrices(from: PriceBook, to: PriceBook, heard = true, teller?: CharacterId): number {
  let news = 0
  for (const w of Object.keys(from) as WorldId[]) {
    const mine = (to[w] ??= {})
    for (const g of Object.keys(from[w]) as Good[]) {
      const theirs = from[w][g]
      if (!theirs) continue
      const known = mine[g]
      if (!known || theirs.observed > known.observed) {
        mine[g] = { ...theirs, heard: heard || theirs.heard, from: teller ?? theirs.from }
        news += 1
      }
    }
  }
  return news
}

/**
 * How readily `teller` tells `asker` what they know of prices: a score
 * from 0 to 1. Guild-fellows tell each other everything; subjects of one
 * empire outside the guild stick together; free traders have a fellow
 * feeling across borders; a guild member tells an outsider little and a
 * rival guild less. Between 0.3 and 0.7 a captain is on the fence, and a
 * round of drinks moves them.
 */
export function willingness(teller: Character, asker: Character, state?: GameState): number {
  if (teller.id === asker.id) return 1
  let w: number
  if (teller.outlaw || asker.outlaw) w = 0.1
  else if (teller.guild && asker.guild) w = teller.guild === asker.guild ? 0.8 : 0.1
  else if (teller.guild || asker.guild) w = 0.25
  else if (teller.empire === asker.empire) w = 0.65
  else w = 0.5
  // An open-handed captain tells more, a close-mouthed one less; and a friend is told what a stranger is not.
  w += (traitsOf(teller).openness - 0.5) * 0.3
  if (state) w += 0.15 * regardOf(state, teller.id, asker.id) + 0.05 * esteemOf(state, teller.id, asker.id)
  return Math.max(0.02, Math.min(0.98, w))
}

export function onTheFence(w: number): boolean {
  return w >= 0.3 && w < 0.7
}

/** Whether a captain's knowledge of the worlds within two jumps is thin or stale enough to be worth asking about. */
export function wantsInfo(state: GameState, captain: Character, ship: Ship, at: WorldId): boolean {
  const belief = beliefOf(state, captain.id)
  const near = reachable(state, at, SHIP_CLASSES[ship.type].jump * 2)
  if (near.length === 0) return false
  let stale = 0
  for (const w of near) {
    const p = belief.prices[w]
    const newest = p ? Math.max(...Object.values(p).map((e) => e?.observed ?? -999)) : -999
    if (state.week - newest > 8) stale++
  }
  return stale / near.length > 0.4
}

/** Leak one world's prices from a captain's book into the port's gossip, and a page of what they saw come and go somewhere. */
function leak(state: GameState, captain: Character, port: World): void {
  const belief = beliefOf(state, captain.id)
  const worlds = Object.keys(belief.prices).sort() as WorldId[]
  if (worlds.length === 0) return
  const w = worlds[nextInt(state.rng, 0, worlds.length - 1)]
  tellPrices({ [w]: belief.prices[w] } as PriceBook, port.gossip)
  // And who they saw selling what where: the talk of the docks.
  const seen = Object.keys(belief.traffic).sort() as WorldId[]
  if (seen.length === 0) return
  const t = seen[nextInt(state.rng, 0, seen.length - 1)]
  const lines = belief.traffic[t].filter((k) => k.source !== 'heard' && state.week - k.movement.week <= 8 && (k.movement.sold.length > 0 || k.movement.bought.length > 0)).slice(0, 3)
  if (lines.length > 0) learnTraffic({ traffic: port.gossipTraffic }, t, lines.map((k) => k.movement), 'heard', state.week)
}

/** Gossip older than this is forgotten on the docks. */
const GOSSIP_WEEKS = 16

/**
 * The docks each week. Guild-fellows swap books as a matter of course.
 * Everyone lets something slip now and then, and everyone picks up what
 * is going round. A captain whose knowledge is thin asks the others, and
 * is told or not by their willingness; one on the fence can be bought a
 * round if the asker can spare it. At a guild's seat, members put what
 * they know into the guild's book and take out what is newer. The player
 * is in none of it: they go to the bar themselves.
 */
export function dockTalk(state: GameState): void {
  const byPort: Record<string, Character[]> = {}
  for (const { captain, at } of tradingCaptains(state)) (byPort[at] ??= []).push(captain)
  for (const port of Object.keys(byPort).sort() as WorldId[]) {
    const here = state.worlds[port]
    const captains = byPort[port]
    // Gossip ages off.
    for (const w of Object.keys(here.gossip) as WorldId[]) {
      for (const g of Object.keys(here.gossip[w]) as Good[]) if (state.week - (here.gossip[w][g]?.observed ?? 0) > GOSSIP_WEEKS) delete here.gossip[w][g]
      if (Object.keys(here.gossip[w]).length === 0) delete here.gossip[w]
    }
    for (const c of captains) {
      // Something always slips: one world's prices from about two captains in five, each week.
      if (roll(state.rng) >= 8) leak(state, c, here)
    }
    for (const c of captains) {
      const b = beliefOf(state, c.id)
      tellPrices(here.gossip, b.prices)
      for (const w of Object.keys(here.gossipTraffic) as WorldId[]) learnTraffic(b, w, here.gossipTraffic[w].map((k) => k.movement), 'heard', state.week)
    }
    // Dock talk about movements fades in a few weeks.
    for (const w of Object.keys(here.gossipTraffic) as WorldId[]) {
      here.gossipTraffic[w] = here.gossipTraffic[w].filter((k) => state.week - k.observed <= 6)
      if (here.gossipTraffic[w].length === 0) delete here.gossipTraffic[w]
    }
    for (const a of captains) {
      for (const b of captains) {
        if (a === b) continue
        if (a.guild && a.guild === b.guild) {
          tellAll(state, a.id, b.id)
          continue
        }
        // Everyone asks: more known is better than less. Only a captain whose knowledge is thin pays for it.
        const ship = state.ships[(b.body as { ship: ShipId }).ship]
        if (!ship) continue
        const w = willingness(a, b, state)
        const r = nextFloat(state.rng)
        let told = r < w
        if (!told && onTheFence(w) && r < w + 0.3 && wantsInfo(state, b, ship, port) && b.purse >= BRIBE + reserve(ship) + 2000) {
          b.purse -= BRIBE
          a.purse += BRIBE
          deal(state, a.id, b.id, 0.3, `${b.name} stood me a round at ${here.name}`, 'round')
          told = true
        }
        if (told) {
          tellAll(state, a.id, b.id)
          deal(state, b.id, a.id, 0.2, `${a.name} told me what they knew at ${here.name}`, 'told')
          maybeAskRoute(state, a, b, here)
        } else deal(state, b.id, a.id, -0.1, `${a.name} would not talk at ${here.name}`, 'refused')
      }
    }
    // The guild's offices: at the seat the book itself; at any other dockyard port of the empire a factor who takes
    // deposits and sends them on to the seat by the next sailings. Withdrawals only at the seat, where the book is.
    const guild = state.guilds[here.empire]
    const office = guild && (port === guild.seat || ['A', 'B'].includes(here.profile.starport))
    if (guild && office) {
      const deposit: PriceBook = {}
      const danger: Record<WorldId, Week> = {}
      for (const c of captains) {
        if (c.guild !== guild.empire) continue
        const belief = beliefOf(state, c.id)
        tellPrices(belief.prices, deposit, false)
        for (const w of Object.keys(belief.worlds) as WorldId[]) {
          const snap = belief.worlds[w].snapshot
          if (snap.kind !== 'world') continue
          for (const n of snap.world.news) if (/taken in the approaches/.test(n.text) && (danger[w] ?? -99) < n.week) danger[w] = n.week
        }
        if (port === guild.seat) tellPrices(guild.book, belief.prices, false)
      }
      if (Object.keys(deposit).length > 0 || Object.keys(danger).length > 0) {
        if (port === guild.seat) depositAt(guild, deposit, danger)
        else {
          const path = route(state.lanes, port, guild.seat)
          const weeks = path ? expectedArrival(state.lanes, path, state.week) ?? state.week + path.length : state.week + 2 * hexDistance(here.hex, state.worlds[guild.seat].hex)
          guild.post.push({ arrives: Math.max(state.week + 1, weeks), book: deposit, danger })
        }
      }
    }
  }
}

/** Enter a deposit in the guild's book, keeping provenance, and its danger notes where newer. */
export function depositAt(guild: Guild, book: PriceBook, danger: Record<WorldId, Week>): void {
  tellPrices(book, guild.book, false)
  for (const w of Object.keys(danger) as WorldId[]) if ((guild.danger[w] ?? -99) < danger[w]) guild.danger[w] = danger[w]
}

/** Deposits made at the guild's offices reach the seat when their sailings do; and every office posts its own dock's prices home each week. */
export function guildPost(state: GameState): void {
  for (const g of Object.values(state.guilds)) {
    const due = g.post.filter((p) => p.arrives <= state.week)
    g.post = g.post.filter((p) => p.arrives > state.week)
    for (const p of due.sort((a, b) => a.arrives - b.arrives)) depositAt(g, p.book, p.danger)
    factorsReport(state, g)
  }
}

/**
 * The factor at each of the guild's offices — the seat and every dockyard
 * port of the empire — reads their own dock and sends the prices to the
 * seat by the next sailings. The guild thus always knows its own ports as
 * of a few weeks ago, and depends on members only for everyone else's.
 */
function factorsReport(state: GameState, g: Guild): void {
  const ids = Object.keys(state.worlds).sort() as WorldId[]
  for (const id of ids) {
    const w = state.worlds[id]
    if (w.empire !== g.empire || !['A', 'B'].includes(w.profile.starport)) continue
    const book: PriceBook = { [id]: {} }
    for (const good of Object.keys(w.market) as Good[]) book[id][good] = { price: w.market[good].price, stock: w.market[good].stock, observed: state.week }
    const danger: Record<WorldId, Week> = {}
    for (const n of w.news) if (/taken in the approaches/.test(n.text) && (danger[id] ?? -99) < n.week) danger[id] = n.week
    if (id === g.seat) {
      depositAt(g, book, danger)
      continue
    }
    const path = route(state.lanes, id, g.seat)
    const weeks = path ? (expectedArrival(state.lanes, path, state.week) ?? state.week + path.length) : state.week + 2 * hexDistance(w.hex, state.worlds[g.seat].hex)
    g.post.push({ arrives: Math.max(state.week + 1, weeks), book, danger })
  }
}

// ---------------------------------------------------------------------------
// Route requests: "leave the metals at Londinium to me"

/** Weeks a request stands before a kept one is counted kept. */
export const REQUEST_WEEKS = 12

/** The route `a` would keep to themselves: where they buy the cargo aboard, and what. "Leave the metals at Londinium to me." */
function myRoute(state: GameState, a: Character): { world: WorldId; good: Good } | null {
  if (a.body.kind !== 'aboard') return null
  const ship = state.ships[a.body.ship]
  const lot = ship?.hold.find((l) => l.kind === 'cargo')
  if (!lot || lot.kind !== 'cargo') return null
  return { world: lot.from, good: lot.good }
}

/**
 * Having told `b` what they know, a captain with a route of their own
 * may ask `b` to leave it alone: as a favour if they are friends, as a
 * warning if not. A proud or grasping captain asks; an easygoing one
 * lets the world be. One ask per person at a time.
 */
export function maybeAskRoute(state: GameState, a: Character, b: Character, here: World): void {
  const r = relation(state, a.id, b.id)
  if (r.request) return
  const t = traitsOf(a)
  if (t.pride + t.greed < 1.1) return
  const route = myRoute(state, a)
  if (!route) return
  askRoute(state, a.id, b.id, route.world, route.good)
  void here
}

/** `a` asks `b` to leave a good at a world to them. The tone follows how `a` stands to `b`. */
export function askRoute(state: GameState, a: CharacterId, b: CharacterId, world: WorldId, good: Good): RouteRequest {
  const r = relation(state, a, b)
  const tone: RouteRequest['tone'] = regardOf(state, a, b) >= 1 ? 'solid' : 'orelse'
  r.request = { world, good, since: state.week, tone }
  const wn = state.worlds[world].name
  const an = state.characters[a].name
  deal(state, b, a, 0, tone === 'solid' ? `${an} asked me, as a favour, to leave the ${good} at ${wn} to them` : `${an} told me to stay off the ${good} at ${wn}, or else`, 'request_made')
  return r.request
}

/** Whether `b` will leave the route alone: a friend's ask is honoured; a warning is honoured by the careful; the rest ignore it. */
export function honours(state: GameState, b: Character, a: CharacterId, req: RouteRequest): boolean {
  const regard = regardOf(state, b.id, a)
  if (regard >= 0.5) return true
  if (req.tone === 'orelse' && traitsOf(b).caution >= 0.6) return true
  return false
}

/** The routes `b` has been asked to leave alone and means to. */
export function routesToAvoid(state: GameState, b: Character): { world: WorldId; good: Good }[] {
  const out: { world: WorldId; good: Good }[] = []
  for (const key of Object.keys(state.relations)) {
    if (!key.endsWith(`|${b.id}`)) continue
    const a = key.slice(0, key.indexOf('|')) as CharacterId
    const req = state.relations[key].request
    if (req && honours(state, b, a, req)) out.push({ world: req.world, good: req.good as Good })
  }
  return out
}

/**
 * Each week every standing request is checked against what the asker
 * can see of the register: the asked captain buying that good at that
 * world since the ask breaks it and makes an enemy; twelve weeks
 * without is a promise kept, and makes a friend.
 */
export function checkRequests(state: GameState): void {
  for (const key of Object.keys(state.relations).sort()) {
    const r = state.relations[key]
    if (!r.request) continue
    const [a, b] = key.split('|') as [CharacterId, CharacterId]
    const req = r.request
    const bName = state.characters[b]?.name ?? b
    const wn = state.worlds[req.world]?.name ?? req.world
    const seen = (beliefOf(state, a).traffic[req.world] ?? []).some((k) => k.movement.captain === b && k.movement.week > req.since && k.movement.bought.some((x) => x.good === req.good))
    if (seen) {
      r.request = null
      deal(state, a, b, -1.5, `${bName} went for the ${req.good} at ${wn} after I asked them not to`, 'request_broken')
      continue
    }
    if (state.week - req.since >= REQUEST_WEEKS) {
      r.request = null
      deal(state, a, b, 0.8, `${bName} left the ${req.good} at ${wn} to me, as asked`, 'request_kept')
    }
  }
}

/** The player listens at the bar: the docks' gossip. Returns how many prices were news. */
export function listenAtBar(state: GameState): number {
  const at = characterLocation(state, state.player)
  if (at === null) return 0
  const b = beliefOf(state, state.player)
  let n = tellPrices(state.worlds[at].gossip, b.prices)
  for (const w of Object.keys(state.worlds[at].gossipTraffic) as WorldId[]) n += learnTraffic(b, w, state.worlds[at].gossipTraffic[w].map((k) => k.movement), 'heard', state.week)
  return n
}

/** One captain tells another everything: prices, and who they saw come and go. */
export function tellAll(state: GameState, from: CharacterId, to: CharacterId): number {
  const a = beliefOf(state, from)
  const b = beliefOf(state, to)
  let n = tellPrices(a.prices, b.prices, true, from)
  for (const w of Object.keys(a.traffic) as WorldId[]) n += learnTraffic(b, w, a.traffic[w].filter((k) => state.week - k.movement.week <= 12).map((k) => k.movement), 'heard', state.week)
  n += tellTies(state, from, to)
  return n
}

/**
 * Talk is never only prices. A captain who tells what they know lets on
 * who they count a friend and who an enemy, and passes on what they have
 * heard of others' friendships and feuds. The hearer makes something of
 * it: a friend's enemy is a little their own enemy, a friend's friend a
 * little their friend. Returns how many ties were news.
 */
export function tellTies(state: GameState, from: CharacterId, to: CharacterId): number {
  const b = beliefOf(state, to)
  let n = 0
  const heard: { key: string; regard: number; teller: CharacterId }[] = []
  // The teller's own friends and enemies.
  for (const key of Object.keys(state.relations).sort()) {
    if (!key.startsWith(`${from}|`)) continue
    const r = state.relations[key]
    if (Math.abs(r.regard) < 1.5) continue
    heard.push({ key, regard: r.regard, teller: from })
  }
  // And what the teller has heard of others.
  const a = beliefOf(state, from)
  for (const key of Object.keys(a.ties).sort()) heard.push({ key, regard: a.ties[key].regard, teller: a.ties[key].from })
  for (const h of heard) {
    const [x, y] = h.key.split('|') as [CharacterId, CharacterId]
    if (y === to || x === to) continue
    const known = b.ties[h.key]
    if (known && known.observed >= state.week) continue
    b.ties[h.key] = { regard: h.regard, observed: state.week, from: h.teller }
    n += 1
    // What it means to the hearer: only the teller's own ties, and only if the teller is a friend.
    if (h.teller !== from || x !== from) continue
    const myRegard = regardOf(state, to, from)
    if (myRegard < 1) continue
    if (h.regard <= -1.5) deal(state, to, y, -0.3, `${state.characters[from].name} counts ${state.characters[y]?.name ?? y} an enemy`, 'tie')
    else if (h.regard >= 1.5) deal(state, to, y, 0.2, `${state.characters[from].name} counts ${state.characters[y]?.name ?? y} a friend`, 'tie')
  }
  return n
}

/** The player stands a captain a round for its own sake: a small warmth, once a month a person. */
export function standRound(state: GameState, who: CharacterId): boolean {
  const me = state.characters[state.player]
  const at = characterLocation(state, state.player)
  if (at === null || characterLocation(state, who) !== at || me.purse < BRIBE) return false
  const r = relation(state, who, state.player)
  if (r.lastRound !== undefined && state.week - r.lastRound < 4) return false
  me.purse -= BRIBE
  state.characters[who].purse += BRIBE
  r.lastRound = state.week
  deal(state, who, state.player, 0.15, `${me.name} stood me a round at ${state.worlds[at].name}`, 'round')
  return true
}

/**
 * What the week's page says of people worth knowing: a sale worth twenty
 * thousand, or a prize taken, raises the esteem of everyone at the port
 * who saw it for whoever did it.
 */
export function noticeImpressive(state: GameState): void {
  for (const id of Object.keys(state.worlds).sort() as WorldId[]) {
    const world = state.worlds[id]
    const page = world.register.filter((m) => m.week === state.week && m.captain)
    const present = (Object.keys(state.characters).sort() as CharacterId[]).filter((c) => characterLocation(state, c) === id)
    if (present.length < 2) continue
    for (const m of page) {
      const value = m.sold.reduce((s, x) => s + x.tons * x.price, 0)
      if (value < 20000) continue
      for (const c of present) if (c !== m.captain) impressed(state, c, m.captain!, 0.3, `saw ${m.captainName} sell ${Math.round(value / 1000)}k of cargo at ${world.name}`)
    }
  }
}

export type Answer = 'told' | 'refused' | 'already' | 'absent' | 'no_use'

/** Whether a round would tip a captain who refused the player this week: on the fence, and the roll fell within a round's reach. */
export function roundWouldHelp(state: GameState, who: CharacterId): boolean {
  const a = state.asked[who]
  if (!a || a.week !== state.week || a.told) return false
  const w = willingness(state.characters[who], state.characters[state.player], state)
  return onTheFence(w) && a.roll < w + 0.3
}

/**
 * The player asks a captain in port what they know. Once a week each; the
 * answer turns on a roll against their willingness. A captain who refused
 * can be stood a round, which tells only where it would have tipped the
 * roll; the UI offers it only then.
 */
export function askCaptain(state: GameState, who: CharacterId, bribe = false): Answer {
  const me = state.characters[state.player]
  const them = state.characters[who]
  const at = characterLocation(state, state.player)
  if (!them || at === null || characterLocation(state, who) !== at) return 'absent'
  const where = state.worlds[at].name
  const prior = state.asked[who]
  if (bribe) {
    if (!prior || prior.week !== state.week) return 'already'
    if (prior.told) return 'already'
    if (!roundWouldHelp(state, who) || me.purse < BRIBE) return 'no_use'
    me.purse -= BRIBE
    them.purse += BRIBE
    prior.told = true
    deal(state, who, state.player, 0.3, `${me.name} stood me a round at ${where}`, 'round')
    deal(state, state.player, who, 0.1, `came round for a drink at ${where}`, 'round')
    tellAll(state, who, state.player)
    return 'told'
  }
  if (prior && prior.week === state.week) return 'already'
  const w = willingness(them, me, state)
  const roll = nextFloat(state.rng)
  const told = roll < w
  state.asked[who] = { week: state.week, roll, told }
  if (!told) {
    deal(state, state.player, who, -0.1, `would not talk at ${where}`, 'refused')
    return 'refused'
  }
  deal(state, state.player, who, 0.2, `told me what they knew at ${where}`, 'told')
  deal(state, who, state.player, 0.1, `${me.name} asked civilly at ${where}`, 'told')
  tellAll(state, who, state.player)
  return 'told'
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
