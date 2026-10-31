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
import { buy, dutyRate, GOODS, marketScale, production, sell, valueScale, type Good } from './economy'
import { hexRoute } from './chart'
import { hexDistance } from './hex'
import { fuelPrice } from './ships'
import { officerCulture, personName, rollSex } from './names'
import { postNewsItem } from './news'
import { newShip, unload } from './ships'
import { stanceKey, SHIP_CLASSES, type Character, type CharacterId, type GameState, type Guild, type Line, type ShipId, type WorldId } from './types'

/** What a guild starts with to run its lines. */
export const GUILD_PURSE = 300000
/** Bulk freighters a guild keeps in the subsector. */
const HAULERS = 2
/** Weeks between rankings. */
const PLAN_EVERY = 8
/** How recent a price must be for the guild to plan on it. */
const FRESH = 26
/** The least a line must clear a week to be worth a hauler. */
const WORTH_A_HAULER = 2500

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
      ship.duty = { kind: 'haul', line: null }
      state.ships[sid] = ship
    }
  }
}

/** How much of a good a market moves a round without its price running away: the brokers' own scale, as every factor knows it. */
function absorbs(state: GameState, world: WorldId, good: Good): number {
  const p = state.worlds[world].profile
  return Math.round(1.2 * 40 * Math.max(0.5, marketScale(p)) * valueScale(good))
}

/** The load a line carries a trip: the hold, or what the smaller of the two markets can take, whichever is less. */
export function lineLoad(state: GameState, from: WorldId, to: WorldId, good: Good): number {
  return Math.max(10, Math.min(SHIP_CLASSES.bulk_freighter.hold, absorbs(state, from, good), absorbs(state, to, good)))
}

/** The guild's reckoning of a line's profit a week: a sized load of the good, the price knocked by the hauler's own sale, two weeks a round trip. */
function reckon(state: GameState, g: Guild, from: WorldId, to: WorldId, good: Good): number {
  const a = g.book[from]?.[good]
  const b = g.book[to]?.[good]
  if (!a || !b || state.week - a.observed > FRESH || state.week - b.observed > FRESH) return 0
  // A line wants a world that makes the good, not one that happened to have some on the dock.
  const made = production(state.worlds[from].profile, good)
  if (made < 5) return 0
  const tons = Math.min(lineLoad(state, from, to, good), Math.max(10, Math.min(a.stock, made * 3)))
  const toWorld = state.worlds[to]
  const fromWorld = state.worlds[from]
  const cost = a.price * (1 + dutyRate(fromWorld, g.empire))
  const scale = 40 * Math.max(0.5, marketScale(toWorld.profile)) * valueScale(good)
  const knocked = b.price * (1 - 0.5 * Math.tanh(tons / scale))
  const sale = ((b.price + knocked) / 2) * (1 - dutyRate(toWorld, g.empire))
  return Math.round(((sale - cost) * tons) / 2)
}

function closedTo(state: GameState, g: Guild, w: WorldId): boolean {
  const e = state.worlds[w].empire
  if (e === g.empire) return false
  return state.worlds[g.seat].board[stanceKey(e, g.empire)]?.stance === 'war'
}

/** Every eight weeks: rank what the book knows and put the haulers on the best of it. */
export function guildsPlan(state: GameState): void {
  for (const g of Object.values(state.guilds).sort((a, b) => (a.empire < b.empire ? -1 : 1))) {
    if (state.week - g.planned < PLAN_EVERY) continue
    g.planned = state.week
    const worlds = (Object.keys(g.book) as WorldId[]).filter((w) => state.worlds[w] && (g.danger[w] === undefined || state.week - g.danger[w] > 12) && !closedTo(state, g, w)).sort()
    const candidates: Line[] = []
    for (const from of worlds) {
      for (const to of worlds) {
        if (from === to || hexDistance(state.worlds[from].hex, state.worlds[to].hex) > SHIP_CLASSES.bulk_freighter.jump) continue
        let best: { good: Good; profit: number } | null = null
        for (const good of GOODS) {
          const profit = reckon(state, g, from, to, good)
          if (profit > 0 && (!best || profit > best.profit)) best = { good, profit }
        }
        if (!best) continue
        let back: { good: Good; profit: number } | null = null
        for (const good of GOODS) {
          const profit = reckon(state, g, to, from, good)
          if (profit > 0 && (!back || profit > back.profit)) back = { good, profit }
        }
        candidates.push({ from, to, good: best.good, back: back?.good ?? null, reckoned: best.profit + (back?.profit ?? 0), since: state.week, earned: 0 })
      }
    }
    candidates.sort((a, b) => b.reckoned - a.reckoned || (a.from < b.from ? -1 : 1) || (a.to < b.to ? -1 : 1))
    const chosen: Line[] = []
    // A line that has run a while and lost money is dropped whatever the book says: the hauler's results outrank the reckoning.
    const failed = (l: Line) => state.week - l.since >= 16 && l.earned <= 0
    for (const l of g.lines) if (failed(l)) postNewsItem(state, g.seat, `The guild has taken its bulk line off ${state.worlds[l.from].name} to ${state.worlds[l.to].name}: it did not pay.`)
    // A line already running stays while it still reckons positive and has not failed: a hauler is not pulled off a route every two months.
    for (const l of g.lines) {
      if (failed(l)) continue
      const c = candidates.find((x) => x.from === l.from && x.to === l.to)
      if (!c) continue
      l.good = c.good
      l.back = c.back
      l.reckoned = c.reckoned
      chosen.push(l)
    }
    for (const c of candidates) {
      if (chosen.length >= HAULERS) break
      if (c.reckoned < WORTH_A_HAULER) break
      // One line per pair of worlds.
      if (chosen.some((l) => (l.from === c.from && l.to === c.to) || (l.from === c.to && l.to === c.from))) continue
      chosen.push(c)
    }
    for (const l of chosen) if (!g.lines.some((o) => o.from === l.from && o.to === l.to)) postNewsItem(state, g.seat, `The guild has put a bulk line on ${state.worlds[l.from].name} to ${state.worlds[l.to].name}.`)
    g.lines = chosen
    // Haulers whose line is gone are stood down; idle haulers take up the new ones.
    const haulers = Object.values(state.ships).filter((s) => s.duty?.kind === 'haul' && s.owner.kind === 'organisation' && s.owner.empire === g.empire).sort((a, b) => (a.id < b.id ? -1 : 1))
    for (const h of haulers) {
      const d = h.duty as { kind: 'haul'; line: Line | null }
      if (!d.line) continue
      // Point the hauler at the guild's own record of her line, or stand her down if it is gone.
      d.line = chosen.find((l) => l.from === d.line!.from && l.to === d.line!.to) ?? null
    }
    for (const l of chosen) {
      if (haulers.some((h) => (h.duty as { line: Line | null }).line?.from === l.from && (h.duty as { line: Line | null }).line?.to === l.to)) continue
      const idle = haulers.find((h) => (h.duty as { line: Line | null }).line === null)
      if (idle) (idle.duty as { line: Line | null }).line = l
    }
  }
}

/** A hauler's week in port: sell what she brought, load for the far end, sail; or go home and wait. */
export function haulersAct(state: GameState): void {
  const ids = Object.keys(state.ships).sort() as ShipId[]
  for (const id of ids) {
    const ship = state.ships[id]
    if (ship.duty?.kind !== 'haul' || ship.location.kind !== 'world' || ship.owner.kind !== 'organisation' || ship.inYard !== null) continue
    const g = state.guilds[ship.owner.empire]
    const at = ship.location.world
    const here = state.worlds[at]
    // Sell everything aboard; the guild's purse takes it.
    const line0 = (ship.duty as { line: Line | null }).line
    for (const lot of [...ship.hold]) {
      const n = unload(ship, lot.good as Good, lot.tons)
      if (n > 0) {
        const deal = sell(here, lot.good as Good, n, g.empire)
        g.purse += deal.credits
        state.empires[here.empire].treasury += deal.duty
        if (line0) line0.earned += deal.credits - (lot.kind === 'cargo' ? lot.paid * n : 0)
      }
    }
    // Fuel wherever it is sold, on the guild's account; maintenance at the guild's own dockyards.
    const fuel = fuelPrice(here.profile.starport)
    while (fuel !== null && ship.fuel < SHIP_CLASSES.bulk_freighter.tanks && g.purse > fuel) {
      g.purse -= fuel
      ship.fuel += 1
    }
    // The guild's own yards do the work at cost: half what a private owner pays.
    if (here.empire === g.empire && ['A', 'B'].includes(here.profile.starport) && state.week - ship.maintained >= 24) {
      ship.maintained = state.week
      ship.damage = 0
      g.purse -= Math.round(SHIP_CLASSES.bulk_freighter.price / 20)
    }
    const jump = SHIP_CLASSES.bulk_freighter.jump
    /** The next hop toward a world, over any worlds within jump, or null if there is no way. */
    const hopTo = (to: WorldId): WorldId | null => {
      const path = hexRoute(state.worlds, at, to, jump)
      return path && path.length > 1 ? path[1] : null
    }
    const line = (ship.duty as { line: Line | null }).line
    if (!line) {
      if (at !== g.seat && ship.fuel >= 1) ship.course = hopTo(g.seat)
      continue
    }
    if (ship.fuel < 1) continue
    if (at !== line.from && at !== line.to) {
      // Not on the line yet: make for the loading end.
      ship.course = hopTo(line.from)
      continue
    }
    const outward = at === line.from
    const dest = outward ? line.to : line.from
    const good = outward ? line.good : line.back
    if (good && (at === line.from || at === line.to)) {
      const tons = Math.min(lineLoad(state, line.from, line.to, good as Good), here.market[good as Good].stock, Math.floor(g.purse / Math.max(1, here.market[good as Good].price * 1.3)))
      if (tons > 0) {
        const deal = buy(here, good as Good, tons, g.empire)
        if (deal) {
          g.purse -= deal.credits
          state.empires[here.empire].treasury += deal.duty
          ship.hold.push({ kind: 'cargo', good: good as Good, tons: deal.tons, paid: Math.round(deal.credits / deal.tons), from: at, week: state.week })
        }
      } else if (outward) {
        // Nothing on the dock at the loading end: wait for it rather than sail empty.
        continue
      }
    }
    ship.course = hopTo(dest)
  }
}

