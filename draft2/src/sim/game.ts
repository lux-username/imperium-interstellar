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
import { askCaptain, captainsAct, dockTalk, guildPost, listenAtBar, seedTraderKnowledge, spawnTraders } from './agents'
import { beginEncounter, npcChoice, quarrel, resolveRound, settle, type Choice, type Hail } from './combat'
import { huntersAct, spawnHunters } from './navy'
import { GUILD_PURSE, guildsPlan, haulersAct, spawnHaulers } from './guild'
import { captivityTick, landCaptives, payRansom, ransomFor } from './captivity'
import { postNewsItem } from './news'
import { hexLabel } from './hex'
import { route } from './chart'
import { buy, dutyRate, FINE_TIMES_DUTY, GOODS, inspectionChance, lotPrice, sell, tickMarkets, type Good } from './economy'
import { trade } from './agents'
import { generateSubsector } from './generate'
import { characterLocation, copyDeclaration, deliverHeld, observe, postLetter, postNews, pruneMail, snapshotWorld } from './mail'
import { officerCulture, personName, rollSex } from './names'
import { createRng, nextInt, roll } from './rng'
import { departOnAccount, fuelPrice, holdFree, MAINTENANCE_WEEKS, maintenanceCost, newShip, reachable, setCourse, unload } from './ships'
import { departScouts, landShips, packetScouts } from './scouts'
import { SHIP_CLASSES, stanceKey, stancePair, type CharacterId, type Declaration, type EmpireId, type FreightOffer, type GameState, type Mail, type ReportId, type Ship, type ShipId, type Week, type World, type WorldId } from './types'
import type { Report } from './view'

export const PLAYER = 'c-player' as CharacterId

/** What a free trader costs new, what the player starts with in hand, and the terms of the mortgage on her. */
export const SHIP_PRICE = 60000
export const STARTING_PURSE = 20000
export const MORTGAGE = { payment: 5000, every: 4 }

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
      snapshot.world.news = []
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
    pending: null,
    guilds: {},
    asked: {},
  }
  for (const e of Object.values(empires)) state.guilds[e.id] = { empire: e.id, seat: e.seat, book: {}, danger: {}, purse: GUILD_PURSE, lines: [], planned: 0, post: [] }
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
  spawnHunters(state, taken)
  spawnHaulers(state, taken)
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

/** Hulls in the yard come out when their month is up: mended, maintained, ready. */
export function finishMaintenance(state: GameState): void {
  const ids = Object.keys(state.ships).sort() as ShipId[]
  for (const id of ids) {
    const ship = state.ships[id]
    if (ship.inYard === null || state.week < ship.inYard) continue
    ship.inYard = null
    ship.maintained = state.week
    ship.damage = 0
  }
}

/** Lay a hull up for her maintenance at a dockyard: A or B ports, a tenth of her price, four weeks. The owner pays. */
export function layUp(state: GameState, ship: Ship, at: World): boolean {
  if (ship.location.kind !== 'world' || ship.inYard !== null || !['A', 'B'].includes(at.profile.starport)) return false
  const cost = maintenanceCost(ship)
  if (ship.owner.kind === 'personal') {
    const owner = state.characters[ship.owner.character]
    if (!owner || owner.purse < cost) return false
    owner.purse -= cost
  }
  ship.inYard = state.week + MAINTENANCE_WEEKS
  ship.course = null
  ship.lyingOff = false
  return true
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
  repossess(state)
}

/**
 * Two payments behind, the lender takes the hull the next time she lies
 * at a dockyard of her owner's empire: the debt is settled by the hull,
 * and her owner is put ashore.
 */
export function repossess(state: GameState): void {
  const ids = Object.keys(state.characters).sort() as CharacterId[]
  for (const id of ids) {
    const c = state.characters[id]
    const d = c.debt
    if (!d || d.arrears < 2 * d.payment) continue
    for (const ship of Object.values(state.ships)) {
      if (ship.owner.kind !== 'personal' || ship.owner.character !== id || ship.location.kind !== 'world') continue
      const at = state.worlds[ship.location.world]
      if (at.empire !== c.empire || !['A', 'B'].includes(at.profile.starport)) continue
      ship.owner = { kind: 'organisation', empire: at.empire, arm: 'guild' }
      ship.captain = null
      ship.course = null
      ship.lyingOff = false
      for (const p of ship.passengers) {
        const pc = state.characters[p]
        if (pc && !pc.captive) pc.body = { kind: 'world', world: at.id }
      }
      ship.passengers = []
      if (c.body.kind === 'aboard' && c.body.ship === ship.id) c.body = { kind: 'world', world: at.id }
      c.debt = null
      postNewsItem(state, at.id, `The lender's men took the ${ship.name} off ${c.name} for the arrears on her.`)
      break
    }
  }
}

/**
 * The approaches: every hull that landed this week meets whoever lies
 * off the port with a quarrel against her. An NPC's meeting is resolved
 * on the spot; the player's stands as `pending` until they choose. One
 * meeting a hull a week.
 */
export function approaches(state: GameState, landed: Ship[]): void {
  const lying = (at: WorldId) =>
    (Object.keys(state.ships).sort() as ShipId[])
      .map((id) => state.ships[id])
      .filter((s) => s.lyingOff && s.location.kind === 'world' && s.location.world === at && (!s.captain || !state.characters[s.captain]?.captive))
  for (const ship of landed) {
    if (ship.location.kind !== 'world' || state.pending) continue
    const at = ship.location.world
    for (const hunter of lying(at)) {
      // The player lying off is told of everything that comes in and chooses; an NPC hails only what she has a quarrel with.
      if (hunter.captain === state.player ? ship.type === 'scout' || ship.id === hunter.id : !quarrel(state, hunter, ship)) continue
      // Half the arrivals slip by unseen.
      if (roll(state.rng) < 7) continue
      const e = beginEncounter(state, hunter, ship, at)
      const mine = hunter.captain === state.player || ship.captain === state.player
      if (mine) {
        state.pending = e
        break
      }
      while (!e.outcome) resolveRound(state, e, npcChoice(state, e))
      postNewsItem(state, at, settle(state, e))
      break
    }
  }
}

export function advanceWeek(state: GameState): void {
  if (state.pending) return
  state.week += 1
  const landed = landShips(state)
  approaches(state, landed)
  landCaptives(state, landed)
  captivityTick(state)
  deliverHeld(state)
  stanceClock(state)
  tickMarkets(state)
  offerFreight(state)
  finishMaintenance(state)
  collectDebts(state)
  // Sailings happen before the week's observation: a hull that sails this week is gone from the port by then.
  departScouts(state)
  departOnAccount(state)
  observeAll(state)
  guildPost(state)
  dockTalk(state)
  // Captains decide on what they now see and have heard, and sail next week.
  // The guild's factor has first claim on the dock: haulers load before the free traders act.
  guildsPlan(state)
  haulersAct(state)
  captainsAct(state)
  huntersAct(state)
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

/** Whether the port's own board says the player's empire and the port's are at war: then there is no lawful trade. */
export function portClosed(state: GameState, at: World): boolean {
  const me = state.characters[state.player]
  return at.empire !== me.empire && at.board[stanceKey(at.empire, me.empire)]?.stance === 'war'
}

/** What the last trade off the books came to, for the UI to tell. */
export type Outcome = { kind: 'ok'; tons: number; credits: number; duty: number } | { kind: 'refused' } | { kind: 'caught'; tons: number; fine: number; arrested: boolean }

/**
 * The customs house looks into a trade off the books. Caught: the goods
 * are seized and a fine of three times the duty dodged is due; a purse
 * that cannot pay means arrest, and the hull waits at the port.
 */
function inspected(state: GameState, at: World, good: Good, tons: number, value: number): Outcome | null {
  const me = state.characters[state.player]
  if (nextInt(state.rng, 1, 100) > inspectionChance(at, me.empire, portClosed(state, at)) * 100) return null
  const fine = Math.round(value * dutyRate(at, me.empire) * FINE_TIMES_DUTY)
  at.market[good].stock += tons
  state.empires[at.empire].treasury += Math.min(fine, Math.max(0, me.purse))
  if (me.purse >= fine) {
    me.purse -= fine
    postNewsItem(state, at.id, `The customs house seized ${tons} t of ${good} off the ${playerShip(state)?.name ?? 'a trader'} and fined her master.`)
    return { kind: 'caught', tons, fine, arrested: false }
  }
  me.purse = Math.max(0, me.purse - fine)
  me.captive = { by: null, of: at.empire, since: state.week, at: at.id, term: state.week + nextInt(state.rng, 8, 16) }
  me.body = { kind: 'world', world: at.id }
  postNewsItem(state, at.id, `${me.name} of the ${playerShip(state)?.name ?? 'a trader'} was arrested for smuggling ${good}.`)
  return { kind: 'caught', tons, fine, arrested: true }
}

/** What a sale of `tons` of a good would fetch here, a ton and in all, duty off: the brokers' own sum, without making it. */
export function quoteSale(state: GameState, good: Good, tons: number, smuggle = false): { price: number; duty: number; credits: number } | null {
  const h = ownHullHere(state)
  if (!h || tons <= 0) return null
  const me = state.characters[state.player]
  const e = h.at.market[good]
  const price = lotPrice(h.at, good, e.mood, e.stock, tons)
  const duty = smuggle ? 0 : Math.round(tons * price * dutyRate(h.at, me.empire))
  return { price, duty, credits: tons * price - duty }
}

/**
 * What `tons` of a good would cost here, a ton and in all, duty on; and
 * the most that could be bought: what the dock holds, the hold takes and
 * the purse covers. The brokers' own sum, without making it.
 */
export function quoteBuy(state: GameState, good: Good, tons: number, smuggle = false): { price: number; duty: number; credits: number; most: number } | null {
  const h = ownHullHere(state)
  if (!h) return null
  const me = state.characters[state.player]
  const e = h.at.market[good]
  const rate = smuggle ? 0 : dutyRate(h.at, me.empire)
  // The most the purse covers, found by the same sum: price climbs as the dock empties.
  let most = Math.min(e.stock, holdFree(h.ship))
  while (most > 0 && lotPrice(h.at, good, e.mood, e.stock, -most) * most * (1 + rate) > me.purse) most -= 1
  const n = Math.max(0, Math.min(tons, most))
  if (n === 0) return { price: e.price, duty: 0, credits: 0, most }
  const price = lotPrice(h.at, good, e.mood, e.stock, -n)
  const duty = Math.round(n * price * rate)
  return { price, duty, credits: n * price + duty, most }
}

/** Buy at the brokers: as many tons as asked, the hold allows and the purse covers. Off the books there is no duty and the customs house may look. */
export function buyGoods(state: GameState, good: Good, tons: number, smuggle = false): Outcome {
  const h = ownHullHere(state)
  if (!h) return { kind: 'refused' }
  const me = state.characters[state.player]
  if (portClosed(state, h.at) && !smuggle) return { kind: 'refused' }
  const price = h.at.market[good].price
  const rate = smuggle ? 0 : dutyRate(h.at, me.empire)
  const affordable = Math.floor(me.purse / (price * (1 + rate)))
  const n = Math.min(tons, holdFree(h.ship), affordable)
  if (n <= 0) return { kind: 'refused' }
  const deal = buy(h.at, good, n, me.empire, { smuggle })
  if (!deal) return { kind: 'refused' }
  me.purse -= deal.credits
  trade(state, h.at, deal)
  if (smuggle) {
    const caught = inspected(state, h.at, good, deal.tons, deal.tons * deal.price)
    if (caught) return caught
  }
  h.ship.hold.push({ kind: 'cargo', good, tons: deal.tons, paid: Math.round(deal.credits / deal.tons), from: h.at.id, week: state.week })
  return { kind: 'ok', tons: deal.tons, credits: deal.credits, duty: deal.duty }
}

/** Sell at the brokers what is in the hold of a good. Off the books there is no duty and the customs house may look. */
export function sellGoods(state: GameState, good: Good, tons: number, smuggle = false): Outcome {
  const h = ownHullHere(state)
  if (!h) return { kind: 'refused' }
  const me = state.characters[state.player]
  if (portClosed(state, h.at) && !smuggle) return { kind: 'refused' }
  const n = unload(h.ship, good, tons)
  if (n === 0) return { kind: 'refused' }
  const deal = sell(h.at, good, n, me.empire, { smuggle })
  trade(state, h.at, deal)
  if (smuggle) {
    const caught = inspected(state, h.at, good, n, n * deal.price)
    if (caught) {
      // The goods are seized before the money changes hands.
      h.at.market[good].stock -= n
      return caught
    }
  }
  me.purse += deal.credits
  return { kind: 'ok', tons: n, credits: deal.credits, duty: deal.duty }
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
  if (!ship || ship.inYard !== null) return false
  const me = state.characters[state.player]
  if (me.captive) return false
  if (me.body.kind !== 'aboard' || me.body.ship !== ship.id) {
    // Step aboard if she lies where the player is.
    if (ship.location.kind !== 'world' || characterLocation(state, state.player) !== ship.location.world) return false
    me.body = { kind: 'aboard', ship: ship.id }
  }
  return setCourse(state, ship, to)
}

/** The player's answer to a hail when they are the one hailed. Resolves a round; settles the meeting when it ends. */
export function respond(state: GameState, choice: Choice): void {
  const e = state.pending
  if (!e || e.defender !== playerShip(state)?.id) return
  resolveRound(state, e, choice)
  if (e.outcome) {
    postNewsItem(state, e.at, settle(state, e))
    state.pending = null
  }
}

/** The player's decision when they are the one lying off: attack, and the other captain answers round by round, or let her pass. */
export function hail(state: GameState, decision: Hail): void {
  const e = state.pending
  if (!e || e.attacker !== playerShip(state)?.id) return
  if (decision === 'let_pass') {
    e.outcome = 'let_pass'
    e.log.push('You let her pass.')
  } else {
    while (!e.outcome) resolveRound(state, e, npcChoice(state, e))
  }
  postNewsItem(state, e.at, settle(state, e))
  state.pending = null
}

/** Lie off the port, or come in and dock. Lying off, the player hails what comes in and is not seen by the brokers. */
export function lieOff(state: GameState, on: boolean): boolean {
  const ship = playerShip(state)
  if (!ship || ship.location.kind !== 'world') return false
  ship.lyingOff = on
  return true
}

/** The player ransoms themselves, if held ashore and able. */
export function ransomSelf(state: GameState): boolean {
  return payRansom(state, state.characters[state.player])
}

/** What the player's captor asks. */
export function ransomAsked(state: GameState): number {
  return ransomFor(state.characters[state.player])
}

/** Terms a lender offers a captain without a hull: a free trader, nothing down, on top of whatever is still owed. */
export const LENDER = { payment: 6000, every: 4 }

/**
 * A captain with no hull can go to a lender at a port of their own empire
 * with a dockyard and come away with a free trader on a heavy mortgage.
 * Whatever was owed on the last hull is still owed.
 */
export function seeLender(state: GameState): boolean {
  const me = state.characters[state.player]
  const at = playerWorld(state)
  if (playerShip(state) || !at || me.captive || at.empire !== me.empire || !['A', 'B'].includes(at.profile.starport)) return false
  const taken = new Set(Object.values(state.ships).map((s) => s.name))
  const id = `s-player-${state.nextId++}` as ShipId
  const hull = newShip(state.rng, id, 'free_trader', me.empire, { kind: 'personal', character: me.id }, at.id, taken, me.id)
  hull.maintained = state.week
  state.ships[id] = hull
  me.body = { kind: 'aboard', ship: id }
  const owed = me.debt?.balance ?? 0
  me.debt = { balance: owed + SHIP_PRICE, payment: LENDER.payment, every: LENDER.every, nextDue: state.week + LENDER.every, arrears: me.debt?.arrears ?? 0 }
  return true
}

/** Lay the player's hull up for maintenance here. */
export function maintain(state: GameState): boolean {
  const h = ownHullHere(state)
  if (!h) return false
  const ok = layUp(state, h.ship, h.at)
  if (ok) state.characters[state.player].body = { kind: 'world', world: h.at.id }
  return ok
}

/** Mend a point of damage at a dockyard: A or B ports, a thousand a point. */
export function repair(state: GameState): boolean {
  const h = ownHullHere(state)
  if (!h || !['A', 'B'].includes(h.at.profile.starport) || h.ship.damage === 0) return false
  const me = state.characters[state.player]
  if (me.purse < 1000) return false
  me.purse -= 1000
  h.ship.damage -= 1
  return true
}

/** Listen at the bar: the docks' gossip, free to anyone. Returns how many prices were news. */
export function talkAtBar(state: GameState): number {
  return listenAtBar(state)
}

export { askCaptain }

/** The world the player's body is at, if not in jump. */
export function playerWorld(state: GameState): World | null {
  const id = characterLocation(state, state.player)
  return id === null ? null : state.worlds[id]
}

export type { Week }
