/**
 * The economy: goods, and what each world makes, wants and charges.
 *
 * A world's profile yields trade codes (our own thresholds, in the 1977
 * shape); the codes say which goods a world produces and which it wants;
 * supply and demand set a price factor on the good's base price; a slow
 * random mood and the pressure of recent buying and selling move it from
 * there. Stock accumulates where a good is produced and is what a buyer
 * can take. Prices are ground truth here; what anyone trades on is the
 * price they last saw or heard, in their belief.
 */
import { nextFloat, type Rng } from './rng'
import type { EmpireId, GameState, World, WorldId, WorldProfile } from './types'

export type Good = 'grain' | 'textiles' | 'timber' | 'ore' | 'metals' | 'machinery' | 'instruments' | 'medicines' | 'luxuries' | 'spirits'

export const GOODS: readonly Good[] = ['grain', 'textiles', 'timber', 'ore', 'metals', 'machinery', 'instruments', 'medicines', 'luxuries', 'spirits']

export type TradeCode = 'Ag' | 'Na' | 'In' | 'Ni' | 'Ri' | 'Po' | 'Hi' | 'Lo' | 'Ht' | 'Lt' | 'Wa' | 'De' | 'Va' | 'As' | 'Ic' | 'Ga'

/** Trade codes from a profile. Our thresholds; tune freely. */
export function tradeCodes(p: WorldProfile): TradeCode[] {
  const c: TradeCode[] = []
  if (p.atmosphere >= 4 && p.atmosphere <= 9 && p.hydrographics >= 4 && p.hydrographics <= 8 && p.population >= 5 && p.population <= 7) c.push('Ag')
  if (p.atmosphere <= 3 && p.hydrographics <= 3 && p.population >= 6) c.push('Na')
  if ([0, 1, 2, 4, 7, 9].includes(p.atmosphere) && p.population >= 9) c.push('In')
  if (p.population <= 6) c.push('Ni')
  if ((p.atmosphere === 6 || p.atmosphere === 8) && p.population >= 6 && p.population <= 8) c.push('Ri')
  if (p.atmosphere >= 2 && p.atmosphere <= 5 && p.hydrographics <= 3) c.push('Po')
  if (p.population >= 9) c.push('Hi')
  if (p.population >= 1 && p.population <= 3) c.push('Lo')
  if (p.tech >= 12) c.push('Ht')
  if (p.tech <= 5 && p.population > 0) c.push('Lt')
  if (p.hydrographics === 10) c.push('Wa')
  if (p.hydrographics === 0 && p.atmosphere >= 2) c.push('De')
  if (p.atmosphere === 0 && p.size > 0) c.push('Va')
  if (p.size === 0) c.push('As')
  if (p.atmosphere <= 1 && p.hydrographics >= 1) c.push('Ic')
  if (p.atmosphere >= 5 && p.atmosphere <= 8 && p.hydrographics >= 4 && p.hydrographics <= 8 && p.size >= 6 && p.size <= 8) c.push('Ga')
  return c
}

interface GoodSpec {
  /** Credits per ton at a world that neither makes nor wants it. */
  base: number
  /** Codes that make it. */
  made: TradeCode[]
  /** Codes that want it. */
  wanted: TradeCode[]
  /** Tech a world needs to make it at all. */
  tech: number
}

export const GOOD_SPECS: Record<Good, GoodSpec> = {
  grain: { base: 300, made: ['Ag', 'Ga'], wanted: ['Hi', 'Na', 'In', 'Va', 'As', 'Ic'], tech: 0 },
  textiles: { base: 600, made: ['Ag', 'Ni'], wanted: ['Ri', 'Hi'], tech: 2 },
  timber: { base: 250, made: ['Ag', 'Ga'], wanted: ['In', 'Va', 'De', 'As'], tech: 0 },
  ore: { base: 400, made: ['As', 'Po', 'Va', 'De', 'Ic'], wanted: ['In'], tech: 3 },
  metals: { base: 1200, made: ['In', 'Ht'], wanted: ['Ni', 'Ag', 'Po'], tech: 6 },
  machinery: { base: 3000, made: ['In', 'Ht'], wanted: ['Ni', 'Ag', 'Po', 'Lt'], tech: 8 },
  instruments: { base: 8000, made: ['Ht'], wanted: ['Ri', 'In', 'Hi'], tech: 11 },
  medicines: { base: 6000, made: ['Ht', 'Ri'], wanted: ['Hi', 'Po', 'Lt'], tech: 9 },
  luxuries: { base: 10000, made: ['Ri'], wanted: ['Hi', 'Ht', 'In'], tech: 4 },
  spirits: { base: 1500, made: ['Ag', 'Wa', 'Ga'], wanted: ['Hi', 'In', 'Na'], tech: 1 },
}

/** How much a world makes or wants of a good: 0, 1 or 2. */
export function supplyLevel(p: WorldProfile, good: Good): number {
  if (p.tech < GOOD_SPECS[good].tech || p.population === 0) return 0
  const codes = tradeCodes(p)
  return Math.min(2, GOOD_SPECS[good].made.filter((c) => codes.includes(c)).length)
}

export function demandLevel(p: WorldProfile, good: Good): number {
  if (p.population === 0) return 0
  const codes = tradeCodes(p)
  return Math.min(2, GOOD_SPECS[good].wanted.filter((c) => codes.includes(c)).length)
}

/** How big a market the world is: a multiplier on what it makes and eats a week. */
export function marketScale(p: WorldProfile): number {
  if (p.population === 0) return 0
  if (p.population <= 4) return 0.5
  if (p.population <= 6) return 1
  if (p.population <= 8) return 2
  return 3
}

/**
 * A world's market in a good: what lies on the dock, and the price it
 * makes. The dock is a physical stock: production adds to it, consumption
 * draws it down, trade moves it, and the price follows how far the stock
 * sits from what the world would like to hold.
 */
export interface MarketEntry {
  /** Tons on the dock. */
  stock: number
  /** Credits per ton this week. */
  price: number
  /** Slow random walk in [0.85, 1.2]. */
  mood: number
}

export type Market = Record<Good, MarketEntry>

/** Dear goods move in small lots: tonnage scales down with the square root of the base price. */
export function valueScale(good: Good): number {
  return Math.sqrt(1000 / GOOD_SPECS[good].base)
}

/** Tons a week a world makes of a good. */
export function production(p: WorldProfile, good: Good): number {
  const s = supplyLevel(p, good)
  return s === 0 ? 0 : Math.max(1, Math.round(10 * s * marketScale(p) * valueScale(good)))
}

/** Tons a week a world eats of a good: what it wants, by its size; and a little of anything, if anyone lives there. */
export function consumption(p: WorldProfile, good: Good): number {
  const d = demandLevel(p, good)
  const scale = marketScale(p) * valueScale(good)
  if (scale === 0) return 0
  return Math.max(d > 0 ? 1 : 0, Math.round((d > 0 ? 6 * d : 0.5) * scale * 10) / 10)
}

/** The stock a world would like to hold: a month of what it makes and eats, and a little besides. */
export function targetStock(p: WorldProfile, good: Good): number {
  return Math.max(1, Math.round(4 * (production(p, good) + consumption(p, good)) + 5 * marketScale(p) * valueScale(good)))
}

/** How the price stands against the stock: dear when the dock is bare, cheap when it is heaped, within bounds. */
export function levelOf(p: WorldProfile, good: Good, stock: number): number {
  return Math.min(1.4, Math.max(0.7, Math.sqrt(targetStock(p, good) / Math.max(0.5, stock))))
}

/** The strength of a world's trade codes on its prices beyond what its stock says: a little more where nobody comes. */
export function codeStrength(isolation: number): number {
  return isolation === 0 ? 0.1 : isolation === 1 ? 0.15 : 0.2
}

/** How far from the lanes a world lies: 0 on two or more lanes, 1 on a spur, 2 dark. */
export function isolationOf(laneCount: number): number {
  return laneCount >= 2 ? 0 : laneCount === 1 ? 1 : 2
}

/** What the price of a good comes to at a world, from its stock, its codes and its mood. */
export function priceOf(p: WorldProfile, good: Good, entry: Pick<MarketEntry, 'mood' | 'stock'>, isolation = 0): number {
  const spec = GOOD_SPECS[good]
  const k = codeStrength(isolation)
  const factor = 1 + k * demandLevel(p, good) - k * supplyLevel(p, good)
  return Math.max(1, Math.round(spec.base * factor * entry.mood * levelOf(p, good, entry.stock)))
}

/** A fresh market for a world: makers hold more than they want, wanters less, and everyone has a mood. */
export function newMarket(rng: Rng, p: WorldProfile, isolation = 0): Market {
  const m = {} as Market
  for (const good of GOODS) {
    const mood = 0.85 + nextFloat(rng) * 0.35
    const target = targetStock(p, good)
    const made = production(p, good) > 0
    const wanted = demandLevel(p, good) > 0
    const share = made ? 0.8 + nextFloat(rng) * 0.8 : wanted ? 0.1 + nextFloat(rng) * 0.6 : nextFloat(rng) * 0.5
    const entry: MarketEntry = { stock: Math.round(target * share), price: 0, mood }
    entry.price = priceOf(p, good, entry, isolation)
    m[good] = entry
  }
  return m
}

/** Set every price afresh from the world's stock, codes and mood: after worldgen settles isolation. */
export function reprice(world: World): void {
  for (const good of GOODS) world.market[good].price = priceOf(world.profile, good, world.market[good], world.isolation)
}

/** A week passes at a world: the dock gains what is made, loses what is eaten, spoils a little, and is repriced. Moods wander. */
export function tickMarket(rng: Rng, world: World): void {
  const p = world.profile
  for (const good of GOODS) {
    const e = world.market[good]
    e.stock = Math.max(0, e.stock + production(p, good) - consumption(p, good))
    // What nobody makes or eats here slowly goes off, so a heap left by passing trade does not last forever.
    if (production(p, good) === 0) e.stock = Math.max(0, e.stock - Math.ceil(e.stock * 0.03))
    // A maker never heaps more than three months of output: the rest is not brought to the dock.
    const cap = targetStock(p, good) * 3
    if (e.stock > cap) e.stock = cap
    e.mood = Math.min(1.2, Math.max(0.85, e.mood + (nextFloat(rng) - 0.5) * 0.04))
    e.price = priceOf(p, good, e, world.isolation)
  }
}

// ---------------------------------------------------------------------------
// Duty and the customs house

/**
 * Every trade at a port pays duty to the governor of its empire. The rate
 * turns on the port (a big port is a cheap one), the law (a strict world
 * is a dear one), and whether the trader is a subject or a foreigner. At
 * war there is no lawful trade at all; see `smuggling`.
 */
export function dutyRate(world: Pick<World, 'profile' | 'empire'>, trader: EmpireId): number {
  const port = { A: 0.08, B: 0.1, C: 0.12, D: 0.15, E: 0.15, X: 0 }[world.profile.starport]
  const law = world.profile.law >= 7 ? 0.05 : world.profile.law <= 2 ? -0.02 : 0
  const foreign = world.empire === trader ? 0 : 0.1
  return Math.max(0, Math.round((port + law + foreign) * 100) / 100)
}

/** Kept for callers that only want to know whether a foreigner pays more here than a subject. */
export function tariffFor(port: EmpireId, trader: EmpireId): number {
  return port === trader ? 0 : 0.1
}

/**
 * The odds, per transaction, that the customs house looks into a trade
 * made off the books: slack worlds hardly bother, strict ones do, a big
 * port has the staff, and an enemy's goods are watched for.
 */
export function inspectionChance(world: Pick<World, 'profile' | 'empire'>, trader: EmpireId, atWar: boolean): number {
  const law = world.profile.law
  let p = law <= 2 ? 0.05 : law <= 5 ? 0.15 : law <= 8 ? 0.3 : 0.5
  if (world.profile.starport === 'A') p += 0.1
  if (world.empire !== trader) p += 0.05
  if (atWar) p += 0.2
  return Math.min(0.9, p)
}

/** What a smuggler caught pays, on top of losing the goods: three times the duty dodged. */
export const FINE_TIMES_DUTY = 3

export interface Deal {
  tons: number
  /** Credits that changed hands, duty included. */
  credits: number
  /** Credits per ton before duty. */
  price: number
  /** Duty paid to the port's governor. Zero off the books. */
  duty: number
}

export interface Terms {
  /** Off the books: no duty, and the customs house may look. */
  smuggle?: boolean
}

/** The price a lot of `tons` fetches or costs, a ton, as the dock's stock moves from `from` by `delta`: the price at the midpoint. */
export function lotPrice(world: Pick<World, 'profile' | 'isolation'>, good: Good, mood: number, from: number, delta: number): number {
  return Math.round(priceOf(world.profile, good, { mood, stock: Math.max(0, from + delta / 2) }, world.isolation))
}

/**
 * Buy up to `tons` of a good off the dock at `world`. Takes what is there,
 * at this week's price plus duty; the buying moves the price for next
 * week. Returns the deal, or null if nothing was there.
 */
export function buy(world: World, good: Good, tons: number, trader: EmpireId, terms: Terms = {}): Deal | null {
  const e = world.market[good]
  // Whole tons change hands; the dock may hold a fraction, which stays on it.
  const n = Math.max(0, Math.floor(Math.min(tons, e.stock)))
  if (n === 0) return null
  // Each ton dearer than the last as the dock empties: the lot is priced at its midpoint.
  const price = lotPrice(world, good, e.mood, e.stock, -n)
  const rate = terms.smuggle ? 0 : dutyRate(world, trader)
  const duty = Math.round(n * price * rate)
  e.stock -= n
  e.price = priceOf(world.profile, good, e, world.isolation)
  return { tons: n, credits: n * price + duty, price, duty }
}

/**
 * Sell `tons` of a good at `world` at this week's price less duty. The
 * selling moves the price for next week. What the world does not want
 * itself goes on the dock for resale; what it wants is consumed.
 */
export function sell(world: World, good: Good, tons: number, trader: EmpireId, terms: Terms = {}): Deal {
  tons = Math.max(0, Math.floor(tons))
  const e = world.market[good]
  // Each ton cheaper than the last as the dock heaps up: the lot is priced at its midpoint. All of it goes on the dock; what the world eats, it eats in time.
  const price = lotPrice(world, good, e.mood, e.stock, tons)
  const rate = terms.smuggle ? 0 : dutyRate(world, trader)
  const duty = Math.round(tons * price * rate)
  e.stock += tons
  e.price = priceOf(world.profile, good, e, world.isolation)
  return { tons, credits: tons * price - duty, price, duty }
}

/** Every world's market moves on a week. */
export function tickMarkets(state: GameState): void {
  const ids = Object.keys(state.worlds).sort() as WorldId[]
  for (const id of ids) tickMarket(state.rng, state.worlds[id])
}
