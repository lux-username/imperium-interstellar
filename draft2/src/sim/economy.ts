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
import { nextFloat, nextInt, type Rng } from './rng'
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

/** How big a market the world is: tons a week the whole place moves, as a multiplier. */
export function marketScale(p: WorldProfile): number {
  if (p.population === 0) return 0
  if (p.population <= 4) return 0.5
  if (p.population <= 6) return 1
  if (p.population <= 8) return 2
  return 3
}

export interface MarketEntry {
  /** Tons on the dock a buyer can take. */
  stock: number
  /** Credits per ton this week. */
  price: number
  /** Slow random walk in [0.85, 1.2]. */
  mood: number
  /** Net tons sold here lately (negative: bought). Decays. */
  pressure: number
}

export type Market = Record<Good, MarketEntry>

const WEEKS_OF_STOCK = 8

/** Tons a week a world produces of a good. */
export function production(p: WorldProfile, good: Good): number {
  const s = supplyLevel(p, good)
  return s === 0 ? 0 : Math.round(10 * s * marketScale(p))
}

/** What the price of a good comes to at a world this week, before anyone trades. */
export function priceOf(p: WorldProfile, good: Good, entry: Pick<MarketEntry, 'mood' | 'pressure'>): number {
  const spec = GOOD_SPECS[good]
  const factor = 1 + 0.2 * demandLevel(p, good) - 0.2 * supplyLevel(p, good)
  const scale = 40 * Math.max(0.5, marketScale(p))
  const press = 1 - 0.5 * Math.tanh(entry.pressure / scale)
  return Math.max(1, Math.round(spec.base * factor * entry.mood * press))
}

/** A fresh market for a world: a few weeks of stock already on the dock, a mood of its own. */
export function newMarket(rng: Rng, p: WorldProfile): Market {
  const m = {} as Market
  for (const good of GOODS) {
    const mood = 0.85 + nextFloat(rng) * 0.35
    const entry: MarketEntry = { stock: Math.round(production(p, good) * nextInt(rng, 2, WEEKS_OF_STOCK)), price: 0, mood, pressure: 0 }
    entry.price = priceOf(p, good, entry)
    m[good] = entry
  }
  return m
}

/** A week passes at a world: stock accrues where goods are made, pressure eases, moods wander, prices are set. */
export function tickMarket(rng: Rng, world: World): void {
  const p = world.profile
  for (const good of GOODS) {
    const e = world.market[good]
    const made = production(p, good)
    e.stock = Math.min(made * WEEKS_OF_STOCK, e.stock + made)
    if (made === 0 && e.stock > 0) e.stock = Math.max(0, e.stock - Math.ceil(e.stock * 0.2))
    e.pressure *= 0.8
    if (Math.abs(e.pressure) < 0.5) e.pressure = 0
    e.mood = Math.min(1.2, Math.max(0.85, e.mood + (nextFloat(rng) - 0.5) * 0.04))
    e.price = priceOf(p, good, e)
  }
}

/** Duty at a port of another empire, on both buying and selling. */
export const TARIFF = 0.2

/** The duty a subject of `trader` pays at a port of `port`: none at home. */
export function tariffFor(port: EmpireId, trader: EmpireId): number {
  return port === trader ? 0 : TARIFF
}

export interface Deal {
  tons: number
  /** Credits that changed hands, duty included. */
  credits: number
  /** Credits per ton before duty. */
  price: number
}

/**
 * Buy up to `tons` of a good off the dock at `world`. Takes what is there,
 * at this week's price plus duty for a foreigner; the buying moves the
 * price for next week. Returns the deal, or null if nothing was there.
 */
export function buy(world: World, good: Good, tons: number, trader: EmpireId): Deal | null {
  const e = world.market[good]
  const n = Math.max(0, Math.min(tons, e.stock))
  if (n === 0) return null
  const price = e.price
  const credits = Math.round(n * price * (1 + tariffFor(world.empire, trader)))
  e.stock -= n
  e.pressure -= n
  e.price = priceOf(world.profile, good, e)
  return { tons: n, credits, price }
}

/** Sell `tons` of a good at `world` at this week's price less duty. The selling moves the price for next week. */
export function sell(world: World, good: Good, tons: number, trader: EmpireId): Deal {
  const e = world.market[good]
  const price = e.price
  const credits = Math.round(tons * price * (1 - tariffFor(world.empire, trader)))
  e.pressure += tons
  e.price = priceOf(world.profile, good, e)
  return { tons, credits, price }
}

/** Every world's market moves on a week. */
export function tickMarkets(state: GameState): void {
  const ids = Object.keys(state.worlds).sort() as WorldId[]
  for (const id of ids) tickMarket(state.rng, state.worlds[id])
}
