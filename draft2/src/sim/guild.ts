/**
 * The guilds' bulk lines. Every eight weeks a guild ranks the routes its
 * book knows — a good bought at one world and sold at another, both
 * prices seen lately, neither end dangerous, neither at war with the
 * guild — by profit a week for a bulk freighter, and puts its haulers on
 * the best. A hauler shuttles: buy at one end, sell at the other, carry
 * something back if anything pays. Her four hundred tons flatten the
 * margin, which is the point: a route the guild knows is a route a free
 * trader no longer makes money on. Haulers are few; the guild runs the
 * lucrative lines first and drops a line that stops paying.
 */
import { buy, dutyRate, easing, GOODS, marketDepth, pressureFactor, production, sell, type Good } from './economy'
import { hexRoute } from './chart'
import { hexDistance } from './hex'
import { fuelPrice } from './ships'
import { officerCulture, personName, rollSex } from './names'
import { postNewsItem } from './news'
import { newShip, unload } from './ships'
import { stanceKey, SHIP_CLASSES, type Character, type CharacterId, type GameState, type Guild, type Line, type ShipId, type WorldId } from './types'

/** What a guild starts with to run its lines. */
export const GUILD_PURSE = 300000
/** Bulk freighters a guild starts with. */
const HAULERS = 2
/** Weeks between rankings. */
const PLAN_EVERY = 8
/** How recent a price must be for the guild to plan on it. */
const FRESH = 26
/** The least a line must clear a week to be worth a hauler. */
const WORTH_A_HAULER = 1500

/** Each guild's haulers at its seat, with guild officers for captains. */
export function spawnHaulers(state: GameState, taken: Set<string>): void {
  let n = 1
  for (const g of Object.values(state.guilds).sort((a, b) => (a.empire < b.empire ? -1 : 1))) {
    for (let i = 0; i < HAULERS; i++) {
      const sid = `s-hauler-${n}` as ShipId
      const cid = `c-hauler-${n}` as CharacterId
      n += 1
      const core = state.empires[g.empire].core
      const culture = officerCulture(state.rng, core)
      const sex = rollSex(state.rng)
      const c: Character = { id: cid, name: personName(state.rng, culture, sex), culture, sex, empire: g.empire, body: { kind: 'aboard', ship: sid }, purse: 1000, debt: null, guild: g.empire }
      state.characters[cid] = c
      const ship = newShip(state.rng, sid, 'bulk_freighter', g.empire, { kind: 'organisation', empire: g.empire, arm: 'guild' }, g.seat, taken, cid)
      ship.duty = { kind: 'haul', line: null, waited: 0 }
      state.ships[sid] = ship
    }
  }
}

/** How much of a good a market moves a round without its price running away: the brokers' own depth, as every factor knows it. */
function absorbs(state: GameState, world: WorldId, good: Good): number {
  const w = state.worlds[world]
  return Math.round(1.2 * marketDepth(w.profile, good, w.isolation))
}

interface Lot {
  good: Good
  tons: number
  profit: number
}

/**
 * Running a line every `round` weeks, the pressure of its own loads
 * settles at a multiple of one load: what a one-off sale knocks, a
 * standing line knocks harder and keeps knocked. This is the multiple,
 * by how fast the world shrugs trade off.
 */
function steadyFactor(isolation: number, round: number): number {
  return 1 / (1 - easing(isolation) ** round)
}

/** The price a good settles to at a world under a standing line selling `tons` every `round` weeks. */
function steadySale(state: GameState, world: WorldId, good: Good, price: number, tons: number, round: number): number {
  const w = state.worlds[world]
  return price * pressureFactor(steadyFactor(w.isolation, round) * tons, marketDepth(w.profile, good, w.isolation))
}

/** The price a good settles to at a world under a standing line buying `tons` every `round` weeks. */
function steadyCost(state: GameState, world: WorldId, good: Good, price: number, tons: number, round: number): number {
  const w = state.worlds[world]
  return price * pressureFactor(-steadyFactor(w.isolation, round) * tons, marketDepth(w.profile, good, w.isolation))
}

/** The freshest word the guild or the captain has of a price at a world. */
function freshest(state: GameState, g: Guild, captain: CharacterId | null, world: WorldId, good: Good): { price: number; stock: number; observed: number } | null {
  const b = g.book[world]?.[good] ?? null
  const c = captain ? (state.beliefs[captain]?.prices[world]?.[good] ?? null) : null
  if (b && c) return c.observed > b.observed ? c : b
  return b ?? c
}

/**
 * The manifest a hauler would carry from one world to another: every good
 * with a margin at the steady state of a line run every `round` weeks,
 * each lot sized where the next five tons would no longer pay, dearest
 * margin a ton first, until the hold is full. Prices are the freshest the
 * guild's book or the captain's own eyes have; this end's dock is read
 * directly when she is standing on it.
 */
function manifest(state: GameState, g: Guild, captain: CharacterId | null, from: WorldId, to: WorldId, hold: number, round: number, dock: { price: (good: Good) => number | null; stock: (good: Good) => number } | null): Lot[] {
  const toWorld = state.worlds[to]
  const fromWorld = state.worlds[from]
  const dutyIn = dutyRate(fromWorld, g.empire) / 2
  const dutyOut = dutyRate(toWorld, g.empire) / 2
  const lots: Lot[] = []
  for (const good of GOODS) {
    const far = freshest(state, g, captain, to, good)
    const near = dock ? { price: dock.price(good), stock: dock.stock(good), observed: state.week } : freshest(state, g, captain, from, good)
    if (!far || !near || near.price === null || state.week - far.observed > FRESH || state.week - near.observed > FRESH) continue
    const made = production(fromWorld.profile, good)
    if (made < 3 && near.stock < 20) continue
    // The guild does not stop where its profit peaks, as a monopolist would: it carries on until the margin
    // on the last five tons is down to a sliver. That is what saturating a route means, and what leaves the
    // free trader nothing on it.
    const most = Math.min(absorbs(state, to, good) * 2, near.stock)
    let best: Lot | null = null
    for (let tons = 5; tons <= most; tons += 5) {
      const sale = steadySale(state, to, good, far.price, tons, round) * (1 - dutyOut)
      const cost = steadyCost(state, from, good, near.price, tons, round) * (1 + dutyIn)
      const profit = Math.round((sale - cost) * tons)
      const marginalSale = steadySale(state, to, good, far.price, tons + 5, round) * (1 - dutyOut)
      const marginalCost = steadyCost(state, from, good, near.price, tons + 5, round) * (1 + dutyIn)
      if (profit <= 0 || marginalSale - marginalCost < 0.03 * cost) break
      best = { good, tons, profit }
    }
    if (best) lots.push(best)
  }
  lots.sort((a, b) => b.profit / b.tons - a.profit / a.tons || (a.good < b.good ? -1 : 1))
  const out: Lot[] = []
  let room = hold
  for (const l of lots) {
    if (room <= 0) break
    const tons = Math.min(l.tons, room)
    out.push({ good: l.good, tons, profit: Math.round((l.profit * tons) / l.tons) })
    room -= tons
  }
  return out
}

/** A round trip on a line one jump long: out, back, a week's lie-over each end to load. */
const ROUND = 4

/** The guild's reckoning of a pair of worlds as a line: a hold each way at the steady state, for one hauler, a week. */
function reckon(state: GameState, g: Guild, from: WorldId, to: WorldId): number {
  const hold = SHIP_CLASSES.bulk_freighter.hold
  const out = manifest(state, g, null, from, to, hold, ROUND, null).reduce((s, l) => s + l.profit, 0)
  const back = manifest(state, g, null, to, from, hold, ROUND, null).reduce((s, l) => s + l.profit, 0)
  return Math.round((out + back) / ROUND)
}

function closedTo(state: GameState, g: Guild, w: WorldId): boolean {
  const e = state.worlds[w].empire
  if (e === g.empire) return false
  return state.worlds[g.seat].board[stanceKey(e, g.empire)]?.stance === 'war'
}

/** The most haulers a guild keeps. */
const MOST_HAULERS = 8
/** A guild with this much in hand beyond a hauler's price buys another; a guild short of its starting pair replaces them sooner. */
const GROW_AT = 200000 + SHIP_CLASSES.bulk_freighter.price

/** A guild flush with money adds a hauler at its seat, if its lines have work for one; one that has lost haulers replaces them as soon as it can. */
function growFleet(state: GameState, g: Guild, work: boolean): void {
  const fleet = Object.values(state.ships).filter((s) => s.duty?.kind === 'haul' && s.owner.kind === 'organisation' && s.owner.empire === g.empire).length
  const need = fleet < HAULERS ? SHIP_CLASSES.bulk_freighter.price + 50000 : GROW_AT
  if (fleet >= MOST_HAULERS || g.purse < need || (fleet >= HAULERS && !work)) return
  const taken = new Set(Object.values(state.ships).map((s) => s.name))
  const n = state.nextId++
  const sid = `s-hauler-${g.empire.slice(2)}-${n}` as ShipId
  const cid = `c-hauler-${g.empire.slice(2)}-${n}` as CharacterId
  const core = state.empires[g.empire].core
  const culture = officerCulture(state.rng, core)
  const sex = rollSex(state.rng)
  state.characters[cid] = { id: cid, name: personName(state.rng, culture, sex), culture, sex, empire: g.empire, body: { kind: 'aboard', ship: sid }, purse: 1000, debt: null, guild: g.empire }
  const ship = newShip(state.rng, sid, 'bulk_freighter', g.empire, { kind: 'organisation', empire: g.empire, arm: 'guild' }, g.seat, taken, cid)
  ship.duty = { kind: 'haul', line: null, waited: 0 }
  state.ships[sid] = ship
  g.purse -= SHIP_CLASSES.bulk_freighter.price
  postNewsItem(state, g.seat, `The guild has taken delivery of a new bulk freighter, the ${ship.name}.`)
}

type Haul = { kind: 'haul'; line: Line | null; waited: number }

/**
 * Every eight weeks: rank every pair of worlds the book knows as a line,
 * keep the lines that still pay, and put every hauler where the most
 * value remains, a line's value halving for each hauler already on it.
 * A line that has run sixteen weeks and made nothing is dropped.
 */
export function guildsPlan(state: GameState): void {
  for (const g of Object.values(state.guilds).sort((a, b) => (a.empire < b.empire ? -1 : 1))) {
    if (state.week - g.planned < PLAN_EVERY) continue
    g.planned = state.week
    // Work for another hauler: a running line whose value, shared among its haulers, still clears the bar twice over.
    growFleet(state, g, g.lines.some((l) => l.reckoned / 2 ** l.haulers >= 2 * WORTH_A_HAULER))
    const worlds = (Object.keys(g.book) as WorldId[]).filter((w) => state.worlds[w] && (g.danger[w] === undefined || state.week - g.danger[w] > 12) && !closedTo(state, g, w)).sort()
    const candidates: Line[] = []
    for (let i = 0; i < worlds.length; i++) {
      for (let j = i + 1; j < worlds.length; j++) {
        const from = worlds[i]
        const to = worlds[j]
        if (hexDistance(state.worlds[from].hex, state.worlds[to].hex) > SHIP_CLASSES.bulk_freighter.jump) continue
        const reckoned = reckon(state, g, from, to)
        if (reckoned < WORTH_A_HAULER) continue
        candidates.push({ from, to, reckoned, since: state.week, earned: 0, haulers: 0 })
      }
    }
    // A running line is judged on what it earns a week per hauler, not on a book its own loads have depressed.
    const earning = (l: Line) => l.earned / Math.max(1, state.week - l.since) / Math.max(1, l.haulers)
    const failed = (l: Line) => state.week - l.since >= 16 && earning(l) < WORTH_A_HAULER / 2
    const lines: Line[] = []
    for (const l of g.lines) {
      if (failed(l) || closedTo(state, g, l.from) || closedTo(state, g, l.to)) {
        postNewsItem(state, g.seat, `The guild has taken its bulk line off ${state.worlds[l.from].name} to ${state.worlds[l.to].name}.`)
        continue
      }
      const c = candidates.find((x) => x.from === l.from && x.to === l.to)
      // Its standing for new haulers is the better of what the book reckons and what it has shown.
      l.reckoned = Math.max(c?.reckoned ?? 0, state.week - l.since >= 8 ? Math.round(earning(l) * 2) : l.reckoned)
      l.haulers = 0
      lines.push(l)
    }
    for (const c of candidates) if (!lines.some((l) => l.from === c.from && l.to === c.to)) lines.push(c)
    // Assign every hauler to the line with the most value left.
    const haulers = Object.values(state.ships).filter((s) => s.duty?.kind === 'haul' && s.owner.kind === 'organisation' && s.owner.empire === g.empire).sort((a, b) => (a.id < b.id ? -1 : 1))
    const value = (l: Line) => l.reckoned / 2 ** l.haulers
    // Haulers already on a line that still runs keep it; the rest are placed afresh.
    const placed = new Set<string>()
    for (const h of haulers) {
      const d = h.duty as Haul
      const keep = d.line ? lines.find((l) => l.from === d.line!.from && l.to === d.line!.to) : null
      if (keep) {
        d.line = keep
        keep.haulers += 1
        placed.add(h.id)
      } else d.line = null
    }
    for (const h of haulers) {
      if (placed.has(h.id)) continue
      const best = [...lines].sort((a, b) => value(b) - value(a) || (a.from < b.from ? -1 : 1))[0]
      if (!best || value(best) < WORTH_A_HAULER) break
      ;(h.duty as Haul).line = best
      best.haulers += 1
      if (best.haulers === 1 && !g.lines.includes(best)) postNewsItem(state, g.seat, `The guild has put a bulk line on ${state.worlds[best.from].name} to ${state.worlds[best.to].name}.`)
    }
    g.lines = lines.filter((l) => l.haulers > 0)
  }
}

/** A hauler's week in port: sell what she brought, load whatever pays for the far end, sail; or go home and wait. */
export function haulersAct(state: GameState): void {
  const ids = Object.keys(state.ships).sort() as ShipId[]
  for (const id of ids) {
    const ship = state.ships[id]
    if (ship.duty?.kind !== 'haul' || ship.location.kind !== 'world' || ship.owner.kind !== 'organisation' || ship.inYard !== null) continue
    const g = state.guilds[ship.owner.empire]
    const at = ship.location.world
    const here = state.worlds[at]
    const d = ship.duty as Haul
    // Sell everything aboard; the guild's purse takes it.
    for (const lot of [...ship.hold]) {
      const n = unload(ship, lot.good as Good, lot.tons)
      if (n > 0) {
        const deal = sell(here, lot.good as Good, n, g.empire, { guild: true })
        g.purse += deal.credits
        state.empires[here.empire].treasury += deal.duty
        if (d.line) d.line.earned += deal.credits - (lot.kind === 'cargo' ? lot.paid * n : 0)
      }
    }
    // Fuel wherever it is sold, on the guild's account; maintenance at the guild's own yards at cost.
    const fuel = fuelPrice(here.profile.starport)
    while (fuel !== null && ship.fuel < SHIP_CLASSES.bulk_freighter.tanks && g.purse > fuel) {
      g.purse -= fuel
      ship.fuel += 1
    }
    if (here.empire === g.empire && ['A', 'B'].includes(here.profile.starport) && state.week - ship.maintained >= 24) {
      ship.maintained = state.week
      ship.damage = 0
      g.purse -= Math.round(SHIP_CLASSES.bulk_freighter.price / 20)
    }
    const jump = SHIP_CLASSES.bulk_freighter.jump
    const hopTo = (to: WorldId): WorldId | null => {
      const path = hexRoute(state.worlds, at, to, jump)
      return path && path.length > 1 ? path[1] : null
    }
    const line = d.line
    if (!line) {
      if (at !== g.seat && ship.fuel >= 1) ship.course = hopTo(g.seat)
      continue
    }
    if (ship.fuel < 1) continue
    if (at !== line.from && at !== line.to) {
      ship.course = hopTo(line.from)
      continue
    }
    const dest = at === line.from ? line.to : line.from
    const hold = SHIP_CLASSES.bulk_freighter.hold
    const lots = manifest(state, g, ship.captain, at, dest, hold, ROUND, { price: (good) => here.market[good].price, stock: (good) => here.market[good].stock })
    const worth = lots.reduce((s, l) => s + l.profit, 0)
    const tonsPlanned = lots.reduce((s, l) => s + l.tons, 0)
    // Sail when the manifest is worth the trip or she has waited long enough; otherwise wait for the dock to fill.
    if (worth < WORTH_A_HAULER * 2 && tonsPlanned < hold / 4 && d.waited < 2) {
      d.waited += 1
      continue
    }
    d.waited = 0
    for (const l of lots) {
      const tons = Math.min(l.tons, Math.floor(g.purse / Math.max(1, here.market[l.good].price * 1.3)))
      if (tons <= 0) continue
      const deal = buy(here, l.good, tons, g.empire, { guild: true })
      if (!deal) continue
      g.purse -= deal.credits
      state.empires[here.empire].treasury += deal.duty
      ship.hold.push({ kind: 'cargo', good: l.good, tons: deal.tons, paid: Math.round(deal.credits / deal.tons), from: at, week: state.week })
    }
    ship.course = hopTo(dest)
  }
}
