/**
 * The game as a whole: start one from a seed, advance it a week, and the
 * few things the player can do to it. Everything here mutates a GameState
 * in place and deterministically; callers that want the old state keep a
 * copy (see ./save.ts).
 *
 * Keel: three empires whose stances change on a clock, scouts running the
 * lanes with mail and news, every body at a port seeing the port, and a
 * player who can take passage. Nothing trades or fights yet.
 */
import { askAround, captainsAct, dockTalk, seedTraderKnowledge, spawnTraders } from './agents'
import { hexLabel } from './hex'
import { route } from './chart'
import { buy, GOODS, sell, tickMarkets, type Good } from './economy'
import { generateSubsector } from './generate'
import { characterLocation, copyDeclaration, deliverHeld, observe, postLetter, postNews, pruneMail, snapshotWorld } from './mail'
import { officerCulture, personName, rollSex } from './names'
import { createRng, nextInt, roll } from './rng'
import { departOnAccount, fuelPrice, holdFree, newShip, reachable, setCourse, unload } from './ships'
import { departScouts, landShips, packetScouts } from './scouts'
import { SHIP_CLASSES, stanceKey, stancePair, type CharacterId, type Declaration, type EmpireId, type FreightOffer, type GameState, type Mail, type ReportId, type Ship, type ShipId, type Week, type World, type WorldId } from './types'
import type { Report } from './view'

export const PLAYER = 'c-player' as CharacterId

/** What a free trader costs new, what the player starts with in hand, and the terms of the mortgage on her. */
export const SHIP_PRICE = 60000
export const STARTING_PURSE = 20000
export const MORTGAGE = { payment: 2000, every: 4 }

// ---------------------------------------------------------------------------
// The stance clock

/** Weeks a war runs before the next declaration: one to three years. */
function warTerm(state: GameState): number {
  return nextInt(state.rng, 52, 156)
}

/** Weeks a peace holds: two to five years. The opening peace is shorter, so the first war comes within the first year or two. */
function peaceTerm(state: GameState, opening = false): number {
  return opening ? nextInt(state.rng, 20, 80) : nextInt(state.rng, 104, 260)
}

/** A declaration is made at both seats the week it is made; the rest of the subsector hears when a hull brings it. */
function declare(state: GameState, key: string, stance: Declaration['stance']): void {
  const pair = stancePair(key)
  const d: Declaration = { pair, stance, week: state.week }
  state.declarations.push(d)
  state.stances[key] = { stance, since: state.week, until: state.week + (stance === 'war' ? warTerm(state) : peaceTerm(state)) }
  for (const e of pair) postNews(state.worlds[state.empires[e].seat], [copyDeclaration(d)])
}

/** Each pair whose term has run out changes its stance. Pairs are independent. */
export function stanceClock(state: GameState): void {
  for (const key of Object.keys(state.stances).sort()) {
    const s = state.stances[key]
    if (state.week < s.until) continue
    declare(state, key, s.stance === 'war' ? 'peace' : 'war')
  }
}

// ---------------------------------------------------------------------------
// Seeing

/** Everyone whose body is at a port sees the port this week. One snapshot per world, shared by every reader there. */
export function observeAll(state: GameState): void {
  const ids = Object.keys(state.worlds).sort() as WorldId[]
  for (const id of ids) {
    const world = state.worlds[id]
    const readers = (Object.keys(state.characters).sort() as CharacterId[]).filter((c) => characterLocation(state, c) === id)
    if (readers.length === 0) continue
    const report: Report = {
      id: `r-eye-${state.week}-${hexLabel(world.hex)}` as ReportId,
      channel: 'port',
      observer: null,
      observerName: `The port of ${world.name}`,
      subject: world.name,
      observedAt: id,
      observed: state.week,
      snapshot: snapshotWorld(state, world),
      envelope: { origin: id, destination: id, sent: state.week, route: [id], eta: state.week },
      delivered: state.week,
    }
    for (const reader of readers) observe(state, reader, report)
  }
}

/**
 * The player starts with a chart of the subsector: every world is on it,
 * but the entries are old — a few weeks for worlds on the lanes from where
 * they stand, a year or more for worlds nobody visits.
 */
function openingChart(state: GameState, reader: CharacterId, home: WorldId): void {
  const ids = Object.keys(state.worlds).sort() as WorldId[]
  for (const id of ids) {
    if (id === home) continue
    const world = state.worlds[id]
    const path = route(state.lanes, id, home)
    const age = path ? path.length * 2 + roll(state.rng) : 20 + roll(state.rng) * 4
    const snapshot = snapshotWorld(state, world)
    if (snapshot.kind === 'world') {
      snapshot.world.ships = []
      snapshot.world.people = []
      snapshot.world.board = []
      snapshot.world.market = {}
    }
    const report: Report = {
      id: `r-chart-${hexLabel(world.hex)}` as ReportId,
      channel: 'port',
      observer: null,
      observerName: 'The chart',
      subject: `${world.name}, from the chart`,
      observedAt: id,
      observed: -age,
      snapshot,
      envelope: { origin: id, destination: home, sent: -age, route: path ?? [id], eta: 0 },
      delivered: 0,
    }
    observe(state, reader, report)
  }
}

// ---------------------------------------------------------------------------

export function newGame(seed: number): GameState {
  const rng = createRng(seed)
  const { worlds, empires, lanes } = generateSubsector(rng)
  const ships = packetScouts(rng, lanes, worlds, empires)
  const first = Object.values(empires).sort((a, b) => (a.id < b.id ? -1 : 1))[0]
  const home = first.seat
  const culture = officerCulture(rng, first.core)
  const sex = rollSex(rng)
  const state: GameState = {
    seed,
    week: 0,
    rng,
    nextId: 1,
    worlds,
    lanes,
    empires,
    stances: {},
    declarations: [],
    ships,
    characters: {
      [PLAYER]: {
        id: PLAYER,
        name: personName(rng, culture, sex),
        culture,
        sex,
        empire: first.id,
        body: { kind: 'world', world: home },
        purse: STARTING_PURSE,
        debt: { balance: SHIP_PRICE - 10000, payment: MORTGAGE.payment, every: MORTGAGE.every, nextDue: MORTGAGE.every, arrears: 0 },
      },
    },
    mail: {},
    beliefs: {},
    player: PLAYER,
  }
  const eids = Object.keys(empires).sort() as EmpireId[]
  for (let i = 0; i < eids.length; i++) {
    for (let j = i + 1; j < eids.length; j++) {
      state.stances[stanceKey(eids[i], eids[j])] = { stance: 'peace', since: 0, until: peaceTerm(state, true) }
    }
  }
  const taken = new Set(Object.values(ships).map((s) => s.name))
  const own = newShip(rng, 's-player' as ShipId, 'free_trader', first.id, { kind: 'personal', character: PLAYER }, home, taken, PLAYER)
  state.ships[own.id] = own
  state.characters[PLAYER].body = { kind: 'aboard', ship: own.id }
  spawnTraders(state, taken)
  offerFreight(state)
  openingChart(state, PLAYER, home)
  for (const c of Object.values(state.characters)) {
    if (c.id === PLAYER || c.body.kind !== 'aboard') continue
    const at = state.ships[c.body.ship]?.location
    if (at?.kind === 'world') seedTraderKnowledge(state, rng, c, at.world)
  }
  observeAll(state)
  captainsAct(state)
  departScouts(state)
  return state
}

// ---------------------------------------------------------------------------
// Freight and debts

/** The brokers at each port put up a few lots a week for worlds on the lanes nearby, and take down last week's. */
export function offerFreight(state: GameState): void {
  const ids = Object.keys(state.worlds).sort() as WorldId[]
  for (const id of ids) {
    const world = state.worlds[id]
    world.freight = []
    if (world.profile.population === 0 || world.profile.starport === 'X' || world.profile.starport === 'E') continue
    const n = Math.max(0, roll(state.rng) - 8)
    const near = reachable(state, id, 2).filter((w) => state.worlds[w].profile.population > 0)
    for (let i = 0; i < n && near.length > 0; i++) {
      const to = near[nextInt(state.rng, 0, near.length - 1)]
      const good = GOODS[nextInt(state.rng, 0, GOODS.length - 1)]
      const offer: FreightOffer = { id: `f-${state.nextId++}`, good, tons: nextInt(state.rng, 1, 4) * 10, to, rate: nextInt(state.rng, 40, 120) }
      world.freight.push(offer)
    }
  }
}

/** Every hull on a personal account costs her owner her upkeep each week, paid or not. */
export function payUpkeep(state: GameState): void {
  const ids = Object.keys(state.ships).sort() as ShipId[]
  for (const id of ids) {
    const ship = state.ships[id]
    if (ship.owner.kind !== 'personal') continue
    const owner = state.characters[ship.owner.character]
    if (owner) owner.purse -= SHIP_CLASSES[ship.type].upkeep
  }
}

/** Payments fall due; what cannot be paid goes to arrears. */
export function collectDebts(state: GameState): void {
  const ids = Object.keys(state.characters).sort() as CharacterId[]
  for (const id of ids) {
    const c = state.characters[id]
    const d = c.debt
    if (!d || state.week < d.nextDue) continue
    d.nextDue += d.every
    const due = d.payment + d.arrears
    const paid = Math.min(due, Math.max(0, c.purse))
    c.purse -= paid
    d.balance = Math.max(0, d.balance - paid)
    d.arrears = due - paid
    if (d.balance === 0) c.debt = null
  }
}

export function advanceWeek(state: GameState): void {
  state.week += 1
  landShips(state)
  deliverHeld(state)
  stanceClock(state)
  tickMarkets(state)
  offerFreight(state)
  payUpkeep(state)
  collectDebts(state)
  // Sailings happen before the week's observation: a hull that sails this week is gone from the port by then.
  departScouts(state)
  departOnAccount(state)
  observeAll(state)
  dockTalk(state)
  // Captains decide on what they now see and have heard, and sail next week.
  captainsAct(state)
  pruneMail(state)
}

// ---------------------------------------------------------------------------
// What the player can do

/** Board a hull lying in the same port. The player's body goes where she goes; they step ashore where she lands. */
export function takePassage(state: GameState, ship: ShipId): boolean {
  const hull = state.ships[ship]
  const here = characterLocation(state, state.player)
  if (!hull || here === null || hull.location.kind !== 'world' || hull.location.world !== here) return false
  const me = state.characters[state.player]
  if (me.body.kind === 'aboard') {
    const was = state.ships[me.body.ship]
    if (was) was.passengers = was.passengers.filter((p) => p !== state.player)
  }
  me.body = { kind: 'aboard', ship }
  if (!hull.passengers.includes(state.player)) hull.passengers.push(state.player)
  return true
}

/** Step ashore from a hull lying in port. */
export function goAshore(state: GameState): boolean {
  const me = state.characters[state.player]
  if (me.body.kind !== 'aboard') return false
  const hull = state.ships[me.body.ship]
  if (!hull || hull.location.kind !== 'world') return false
  hull.passengers = hull.passengers.filter((p) => p !== state.player)
  me.body = { kind: 'world', world: hull.location.world }
  return true
}

/** Write to someone at the world the player believes them to be. Rides the next sailing. */
export function writeLetter(state: GameState, recipient: CharacterId, to: WorldId, text: string): Mail | null {
  return postLetter(state, state.player, recipient, to, text)
}

/** The player's own hull, if they have one. */
export function playerShip(state: GameState): Ship | null {
  for (const s of Object.values(state.ships)) if (s.owner.kind === 'personal' && s.owner.character === state.player) return s
  return null
}

/** The player's hull, if it lies in the port the player is at. */
function ownHullHere(state: GameState): { ship: Ship; at: World } | null {
  const ship = playerShip(state)
  const at = playerWorld(state)
  if (!ship || !at || ship.location.kind !== 'world' || ship.location.world !== at.id) return null
  return { ship, at }
}

/** Buy at the brokers: as many tons as asked, the hold allows and the purse covers. Returns tons bought. */
export function buyGoods(state: GameState, good: Good, tons: number): number {
  const h = ownHullHere(state)
  if (!h) return 0
  const me = state.characters[state.player]
  const price = h.at.market[good].price
  const affordable = Math.floor(me.purse / (price * 1.2))
  const n = Math.min(tons, holdFree(h.ship), affordable)
  if (n <= 0) return 0
  const deal = buy(h.at, good, n, me.empire)
  if (!deal) return 0
  me.purse -= deal.credits
  h.ship.hold.push({ kind: 'cargo', good, tons: deal.tons, paid: Math.round(deal.credits / deal.tons), from: h.at.id, week: state.week })
  return deal.tons
}

/** Sell at the brokers what is in the hold of a good. Returns credits taken. */
export function sellGoods(state: GameState, good: Good, tons: number): number {
  const h = ownHullHere(state)
  if (!h) return 0
  const me = state.characters[state.player]
  const n = unload(h.ship, good, tons)
  if (n === 0) return 0
  const deal = sell(h.at, good, n, me.empire)
  me.purse += deal.credits
  return deal.credits
}

/** Fill a tank at the docks. Returns false if there is no fuel here, no room, or no money. */
export function refuel(state: GameState): boolean {
  const h = ownHullHere(state)
  if (!h) return false
  const me = state.characters[state.player]
  const price = fuelPrice(h.at.profile.starport)
  if (price === null || h.ship.fuel >= SHIP_CLASSES[h.ship.type].tanks || me.purse < price) return false
  me.purse -= price
  h.ship.fuel += 1
  return true
}

/** Take a freight lot aboard from the brokers' board. */
export function takeFreight(state: GameState, offer: string): boolean {
  const h = ownHullHere(state)
  if (!h) return false
  const i = h.at.freight.findIndex((f) => f.id === offer)
  if (i < 0) return false
  const f = h.at.freight[i]
  if (f.tons > holdFree(h.ship)) return false
  h.at.freight.splice(i, 1)
  h.ship.hold.push({ kind: 'freight', good: f.good, tons: f.tons, to: f.to, rate: f.rate, from: h.at.id, week: state.week })
  return true
}

/** Set the player's hull's course for next week. */
export function sail(state: GameState, to: WorldId | null): boolean {
  const ship = playerShip(state)
  if (!ship) return false
  const me = state.characters[state.player]
  if (me.body.kind !== 'aboard' || me.body.ship !== ship.id) return false
  return setCourse(state, ship, to)
}

/** Ask around the bar. Once a visit is enough; the same captains say the same things. Returns how many prices were news. */
export function talkAtBar(state: GameState): number {
  return askAround(state)
}

/** The world the player's body is at, if not in jump. */
export function playerWorld(state: GameState): World | null {
  const id = characterLocation(state, state.player)
  return id === null ? null : state.worlds[id]
}

export type { Week }
