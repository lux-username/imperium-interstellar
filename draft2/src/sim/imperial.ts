/**
 * The imperial trade. Each empire's capital lies beyond the map, and two
 * freighters shuttle between it and the seat, a round trip of twice the
 * capital's distance. On each call a freighter lands the empire's
 * exports and whatever is dear at the seat against the home market,
 * takes the empire's wants and whatever is cheap, and sails again. The
 * home market drifts slowly, its exports always low and its wants always
 * high, so each empire pulls its seat's prices its own way, differently
 * every game, and steadies them against the home price in between.
 */
import { buy, GOOD_SPECS, GOODS, sell, targetStock, type Good } from './economy'
import { nextInt } from './rng'
import { recordSailing, recordTrade } from './register'
import { newShip } from './ships'
import { officerCulture, personName, rollSex } from './names'
import { rollTraits } from './people'
import { postNewsItem } from './news'
import { SHIP_CLASSES, type Character, type CharacterId, type Empire, type GameState, type Ship, type ShipId } from './types'

const FREIGHTERS = 2

/** Two freighters an empire, the first at the seat and the second half a round out, so a call comes every few weeks. */
export function spawnImperial(state: GameState, taken: Set<string>): void {
  let n = 1
  for (const e of Object.values(state.empires).sort((a, b) => (a.id < b.id ? -1 : 1))) {
    for (let i = 0; i < FREIGHTERS; i++) {
      const sid = `s-imperial-${n++}` as ShipId
      const ship = newShip(state.rng, sid, 'bulk_freighter', e.id, { kind: 'organisation', empire: e.id, arm: 'post' }, e.seat, taken)
      ship.duty = { kind: 'imperial' }
      if (i > 0) ship.location = { kind: 'transit', from: e.seat, to: e.seat, arrives: state.week + e.capitalWeeks }
      state.ships[sid] = ship
    }
  }
}

/** What the home market pays for a good, a ton. */
export function homePrice(e: Empire, good: Good): number {
  return Math.round(GOOD_SPECS[good].base * (e.home[good] ?? 1))
}

/** The home market wanders a little each call, its exports held low and its wants held high. */
function driftHome(state: GameState, e: Empire): void {
  for (const g of GOODS) {
    let v = (e.home[g] ?? 1) + (nextInt(state.rng, -3, 3)) / 100
    if (e.exports.includes(g)) v = Math.min(0.7, Math.max(0.5, v))
    else if (e.imports.includes(g)) v = Math.min(1.7, Math.max(1.3, v))
    else v = Math.min(1.15, Math.max(0.85, v))
    e.home[g] = Math.round(v * 100) / 100
  }
}

/** A freighter at the seat: land what the capital sends, take what it wants, trade the rest against the home price, and sail. */
function callAtSeat(state: GameState, e: Empire, ship: Ship): void {
  const seat = state.worlds[e.seat]
  const hold = SHIP_CLASSES.bulk_freighter.hold
  // Landing: the exports in bulk, then whatever is dear here against home, until the hold is accounted for.
  let landed = 0
  const land = (g: Good, tons: number) => {
    if (tons <= 0 || landed >= hold) return
    const n = Math.min(tons, hold - landed)
    const deal = sell(seat, g, n, e.id)
    state.empires[e.id].treasury += deal.duty
    recordTrade(state, seat, ship, 'sold', g, n, deal.price)
    landed += n
  }
  for (const g of e.exports) land(g as Good, Math.round(targetStock(seat.profile, g as Good) * 0.75))
  const dear = GOODS.filter((g) => !e.exports.includes(g) && seat.market[g].price > homePrice(e, g) * 1.3).sort((a, b) => seat.market[b].price / homePrice(e, b) - seat.market[a].price / homePrice(e, a))
  for (const g of dear) land(g, Math.round(targetStock(seat.profile, g) * 0.4))
  // Taking: the wants in bulk, then whatever is cheap here against home.
  let taken = 0
  const take = (g: Good, tons: number) => {
    if (tons <= 0 || taken >= hold) return
    const deal = buy(seat, g, Math.min(tons, hold - taken), e.id)
    if (!deal) return
    state.empires[e.id].treasury += deal.duty
    recordTrade(state, seat, ship, 'bought', g, deal.tons, deal.price)
    taken += deal.tons
  }
  for (const g of e.imports) take(g as Good, Math.round(targetStock(seat.profile, g as Good) * 0.75))
  const cheap = GOODS.filter((g) => !e.imports.includes(g) && seat.market[g].price < homePrice(e, g) * 0.7).sort((a, b) => seat.market[a].price / homePrice(e, a) - seat.market[b].price / homePrice(e, b))
  for (const g of cheap) take(g, Math.round(targetStock(seat.profile, g) * 0.4))
  driftHome(state, e)
}

/**
 * How much room the empire's trade has for one more captain, as the seat
 * knows it: the captains of the empire on the guild's rolls or in the
 * seat's register this past year, against the worlds the empire holds
 * (two captains a world is a full trade), tempered by how wide the price
 * spreads in the guild's book still are. Returns 0 (none) to 1 (wide open).
 */
export function opportunity(state: GameState, e: Empire): number {
  const g = state.guilds[e.id]
  const seat = state.worlds[e.seat]
  const known = new Set<string>()
  for (const m of seat.register) if (m.captain && m.empire === e.id && state.characters[m.captain] && state.ships[m.ship]?.owner.kind === 'personal') known.add(m.captain)
  for (const c of Object.values(state.characters)) if (c.guild === e.id && c.body.kind === 'aboard' && state.ships[c.body.ship]?.owner.kind === 'personal') known.add(c.id)
  const worlds = Object.values(state.worlds).filter((w) => w.empire === e.id).length
  const room = Math.max(0, Math.min(1, 1 - known.size / (2 * worlds)))
  // The book: the mean of the widest spread between each pair of the empire's worlds it has prices for.
  const booked = (Object.keys(g.book) as string[]).filter((w) => state.worlds[w as never]?.empire === e.id)
  let sum = 0
  let pairs = 0
  for (let i = 0; i < booked.length; i++) for (let j = i + 1; j < booked.length; j++) {
    const a = g.book[booked[i] as never]
    const b = g.book[booked[j] as never]
    if (!a || !b) continue
    let margin = 0
    for (const good of GOODS) { const x = a[good]; const y = b[good]; if (x && y) margin = Math.max(margin, Math.abs(x.price - y.price) / Math.max(1, Math.min(x.price, y.price))) }
    sum += margin
    pairs++
  }
  const spread = pairs === 0 ? 0.5 : Math.max(0, Math.min(1, (sum / pairs - 0.2) / 0.4))
  return room * spread
}

/** A new captain steps off the freighter: of the empire's core, a free trader, a purse, no ticket yet. */
function newArrival(state: GameState, e: Empire): void {
  const taken = new Set(Object.values(state.ships).map((s) => s.name))
  const n = state.nextId++
  const cid = `c-core-${e.id.slice(2)}-${n}` as CharacterId
  const sid = `s-core-${e.id.slice(2)}-${n}` as ShipId
  const culture = officerCulture(state.rng, e.core)
  const sex = rollSex(state.rng)
  const c: Character = { id: cid, name: personName(state.rng, culture, sex), culture, sex, empire: e.id, body: { kind: 'aboard', ship: sid }, purse: 20000 + nextInt(state.rng, 0, 15000), debt: null, traits: rollTraits(state.rng) }
  state.characters[cid] = c
  state.ships[sid] = newShip(state.rng, sid, nextInt(state.rng, 1, 4) === 1 ? 'armed_trader' : 'free_trader', e.id, { kind: 'personal', character: cid }, e.seat, taken, cid)
  e.lastArrival = state.week
  postNewsItem(state, e.seat, `${c.name} is in from the core with a hull and a purse, looking for a living.`)
}

/** Freighters that have come in call at the seat and sail again for the capital. */
export function imperialAct(state: GameState): void {
  for (const id of Object.keys(state.ships).sort() as ShipId[]) {
    const ship = state.ships[id]
    if (ship.duty?.kind !== 'imperial' || ship.owner.kind !== 'organisation') continue
    const e = state.empires[ship.owner.empire]
    if (ship.location.kind !== 'world') continue
    if (ship.docked === state.week) {
      callAtSeat(state, e, ship)
      // Word of room out here reaches the core on the freighters; a captain comes out on the next if there is any.
      const room = opportunity(state, e)
      if (state.week - e.lastArrival >= 8 && nextInt(state.rng, 1, 100) <= Math.round(10 + 60 * room)) newArrival(state, e)
      continue
    }
    // A week in port, then away again for the round.
    recordSailing(state, state.worlds[e.seat], ship, e.seat)
    ship.location = { kind: 'transit', from: e.seat, to: e.seat, arrives: state.week + 2 * e.capitalWeeks }
  }
}
