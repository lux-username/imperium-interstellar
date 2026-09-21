/**
 * The game as a whole: start one from a seed, advance it a week, and the
 * few things the player can do to it. Everything here mutates a GameState
 * in place and deterministically; callers that want the old state keep a
 * copy (see ./save.ts).
 */
import { hexLabel } from './hex'
import { route } from './chart'
import { chartLanes, packetShips } from './lanes'
import { deliverDirect, deliverHeld, learn, postDispatch, pruneMail, snapshotWorld } from './mail'
import { governorsWrite } from './governors'
import { spawnRumours, spreadRumours } from './rumours'
import { afterActionReports, departShips, impoundAtPorts, landShips, logWitnessed, shipRoute, unloadArrivals } from './ships'
import { fightAtWorlds, repairShips } from './combat'
import { harbourPirates, pirateOrders, pirateTalk, placePirates, seizePirates, spawnPirates, toutHavens } from './pirates'
import { placeWarlord, warlordActs } from './warlord'
import { THE_WARLORD, WARLORD, capitalOf } from './factions'
import { hexDistance } from './hex'
import { forgetOldEvents, governorChangedEvent, unrestEvent, unrestIsNews } from './events'
import { beginRevolt, fightContests, regrowGarrisons } from './world'
import { newCharacter } from './characters'
import { createRng, roll } from './rng'
import { generateWorlds, ADMINISTRATION, PLAYER } from './generate'
import { startingFleet } from './fleet'
import type { CharacterId, GameState, Mail, ShipId, StandingOrders, World, WorldId } from './types'
import type { Order } from './orders'
import type { Report, ReportId } from './view'

// ---------------------------------------------------------------------------
// New game

export function newGame(seed: number): GameState {
  const rng = createRng(seed)
  const { worlds, characters, factions, capital } = generateWorlds(rng)
  const lanes = chartLanes(rng, worlds)
  const ships = packetShips(rng, lanes)
  const fleet = startingFleet(rng, ADMINISTRATION, capital)
  Object.assign(ships, fleet.ships)
  Object.assign(characters, fleet.characters)
  const state: GameState = {
    seed,
    week: 0,
    rng,
    nextId: 1,
    capital,
    player: PLAYER,
    ending: null,
    worlds,
    lanes,
    ships,
    characters,
    factions,
    mail: {},
    events: {},
    rumours: [],
    beliefs: { [PLAYER]: { worlds: {}, ships: {} } },
  }
  placeWarlord(state)
  placePirates(state)
  pirateOrders(state)
  openingSurvey(state)
  warlordSurvey(state)
  observeCapital(state)
  // Week 0's sailings have already happened when the player sits down, so
  // every packet is where its timetable says it should be — and none of it is news.
  departShips(state)
  state.events = {}
  return state
}

/**
 * The desk inherits a survey of the subsector from the previous
 * administration. Every world is on it, but the entries are old — a few
 * weeks for worlds on the capital's packet routes, a year or more for
 * worlds nobody visits — and the worlds have moved on since.
 */
function openingSurvey(state: GameState): void {
  const ids = Object.keys(state.worlds).sort() as WorldId[]
  for (const id of ids) {
    const world = state.worlds[id]
    if (id === state.capital) continue
    const path = route(state.lanes, id, state.capital)
    const age = path ? path.length * 2 + roll(state.rng) : 20 + roll(state.rng) * 4
    surveyEntry(state, PLAYER, state.capital, world, age, path)
    // The world has had `age` weeks to drift since the survey was taken. Nothing that happened then is news now.
    for (let i = 0; i < Math.floor(age / 6); i++) driftWorld(state, world, false)
  }
}

/** The Warlord took the Commodore's charts with him: a stale picture of the worlds within reach of his border. */
function warlordSurvey(state: GameState): void {
  const seat = capitalOf(state, WARLORD)
  if (!seat || !state.characters[THE_WARLORD]) return
  const his = Object.values(state.worlds).filter((w) => w.faction === WARLORD)
  const ids = Object.keys(state.worlds).sort() as WorldId[]
  for (const id of ids) {
    const world = state.worlds[id]
    if (world.faction === WARLORD || !his.some((h) => hexDistance(h.hex, world.hex) <= 4)) continue
    surveyEntry(state, THE_WARLORD, seat, world, 10 + roll(state.rng), route(state.lanes, id, seat))
  }
}

/** One old survey entry about `world`, `age` weeks stale, entered straight into `reader`'s belief. */
function surveyEntry(state: GameState, reader: CharacterId, home: WorldId, world: World, age: number, path: WorldId[] | null): void {
  // A survey describes the world, not the traffic: whatever hull is in port today wasn't there back then.
  const snapshot = snapshotWorld(state, world)
  if (snapshot.kind === 'world') snapshot.world.ships = []
  const report: Report = {
    id: `r-survey-${hexLabel(world.hex)}-${reader}` as ReportId,
    channel: 'official',
    observer: world.governor ?? reader,
    observerName: world.governor ? state.characters[world.governor].name : 'Survey of the previous administration',
    observerTitle: world.governor ? 'governor' : null,
    observerShip: null,
    observerShipId: null,
    subject: 'Survey entry',
    lede: 'An entry from the survey of the previous administration.',
    observedAt: world.id,
    observed: -age,
    snapshot,
    events: [],
    envelope: { origin: world.id, destination: { kind: 'world', world: home }, sent: -age, route: path ?? [world.id], eta: 0 },
    delivered: 0,
  }
  // The desk keeps its survey with its mail, so it can look back; the Warlord's is only his picture.
  if (reader === PLAYER) deliverDirect(state, reader, report)
  else learn(state, reader, report)
}

// ---------------------------------------------------------------------------
// The week

/**
 * One week passes. Order matters: hulls land, whatever lies in the system
 * has its say, and only then do they unload — so a robbed packet has
 * nothing to hand over; everything unloads before anything sails, so a
 * packet turning straight around carries what just arrived; the world
 * changes before governors write, so a report describes this week.
 */
export function advanceWeek(state: GameState): void {
  if (state.ending) return
  state.week += 1
  forgetOldEvents(state)
  const landed = landShips(state)
  fightAtWorlds(state, landed)
  seizePirates(state)
  harbourPirates(state, landed)
  impoundAtPorts(state, landed)
  unloadArrivals(state, landed)
  afterActionReports(state)
  deliverHeld(state)
  const ids = Object.keys(state.worlds).sort() as WorldId[]
  for (const id of ids) driftWorld(state, state.worlds[id])
  fightContests(state)
  regrowGarrisons(state)
  governorsWrite(state)
  warlordActs(state)
  spawnPirates(state)
  pirateTalk(state)
  pirateOrders(state)
  toutHavens(state)
  spawnRumours(state)
  spreadRumours(state)
  repairShips(state)
  logWitnessed(state)
  departShips(state)
  pruneMail(state)
  observeCapital(state)
}

/**
 * The slow life of a world between reports. Unrest creeps up on a high
 * roll and settles on a low one, more readily where the garrison is thin
 * and less readily while a fight is on; at the top of the scale the world
 * rises (see ./world.ts). Now and then a governor dies, resigns, or is
 * quietly replaced by their own council, and the desk hears of it only
 * when the new one writes.
 */
export function driftWorld(state: GameState, world: World, record = true): void {
  if (world.profile.population === 0) return
  const r = roll(state.rng)
  const before = world.unrest
  const garrison = world.garrison + world.marines
  if (r >= (garrison === 0 ? 10 : 11) && world.unrest < 10) world.unrest += 1
  else if (r <= (garrison >= 3 ? 4 : 3) && world.unrest > 0 && !world.contest) world.unrest -= 1
  // A point either way within the same mood is not news; a change of mood, or either end of the scale, is.
  if (record && unrestIsNews(state, world.id, before, world.unrest)) unrestEvent(state, world.id, world.unrest, world.unrest > before)
  if (world.unrest >= 10 && !world.contest) beginRevolt(state, world)
  // Nobody's council quietly replaces the holder of a faction's seat.
  const isSeat = Object.values(state.factions).some((f) => f.capital === world.id)
  if (isSeat || world.contest) return
  if (roll(state.rng) === 2 && roll(state.rng) >= 9) replaceGovernor(state, world, record)
}

function replaceGovernor(state: GameState, world: World, record: boolean): void {
  const old = world.governor
  if (old && state.characters[old]) state.characters[old].post = { kind: 'unassigned', at: world.id }
  const id = `c-gov-${hexLabel(world.hex)}-${state.nextId}` as CharacterId
  state.nextId += 1
  state.characters[id] = newCharacter(state.rng, id, world.faction, { kind: 'governor', world: world.id })
  world.governor = id
  world.actingGovernor = id
  if (record) governorChangedEvent(state, world.id, state.characters[id].name)
}

/**
 * The player sits above the capital and sees it directly: no mail, no delay.
 * Kept with the reports rather than shown as news, so the desk can look
 * back at what lay in port on any week.
 */
function observeCapital(state: GameState): void {
  const capital = state.worlds[state.capital]
  const report: Report = {
    id: `r-desk-${state.week}` as ReportId,
    channel: 'official',
    observer: PLAYER,
    observerName: state.characters[PLAYER].name,
    observerTitle: null,
    observerShip: null,
    observerShipId: null,
    subject: 'The capital',
    lede: 'Seen from the desk.',
    observedAt: capital.id,
    observed: state.week,
    snapshot: snapshotWorld(state, capital),
    events: [],
    envelope: { origin: capital.id, destination: { kind: 'world', world: capital.id }, sent: state.week, route: [capital.id], eta: state.week },
    delivered: state.week,
  }
  deliverDirect(state, PLAYER, report)
}

// ---------------------------------------------------------------------------
// Player actions

/**
 * Write to the governor of a world asking for news. The letter rides the
 * packets out; the reply rides them back. Addressed to whoever the player
 * believes holds the seat — the office answers even if the name has changed.
 */
export function requestReport(state: GameState, world: WorldId, governor: CharacterId): Mail {
  return postDispatch(state, { kind: 'character', character: governor }, world, { kind: 'letter', text: 'Send a full report of your world and any hulls in port by the next packet.' })
}

/**
 * Give a ship an order. The dispatch goes to `address` — by default where
 * the desk last saw the hull, the capital if nowhere else — and is held
 * there until the ship turns up. A ship in port at the capital reads it at
 * once. New standing orders may ride along.
 */
export function orderShip(state: GameState, ship: ShipId, order: Order, address?: WorldId, standing?: Partial<StandingOrders>): Mail {
  const seen = state.beliefs[state.player]?.ships[ship]
  const to = address ?? seen?.ship.at ?? state.capital
  return postDispatch(state, { kind: 'ship', ship }, to, { kind: 'order', ship, order, ...(standing ? { standing } : {}) })
}

/**
 * Hand a piece of mail to a hull in port at the capital and send the hull
 * to the mail's address, then home. The envelope is re-routed along the
 * hull's own run, so it is picked up on departure and handed over — to the
 * recipient, or to the port to hold for them — on arrival. This is how
 * orders reach a world no packet calls at. Returns false if the hull is not
 * here or cannot get there.
 */
export function sendByCourier(state: GameState, courier: ShipId, mail: Mail): boolean {
  const hull = state.ships[courier]
  const env = mail.contents.kind === 'dispatch' ? mail.contents.dispatch.envelope : mail.contents.report.envelope
  const dest = env.destination.kind === 'world' ? env.destination.world : null
  if (!hull || !dest || hull.location.kind !== 'world' || hull.location.world !== state.capital) return false
  if (mail.status.kind !== 'awaiting_carrier' || mail.status.at !== state.capital) return false
  const path = shipRoute(state, hull, state.capital, dest)
  if (!path) return false
  env.route = path
  env.eta = state.week + path.length // sails next week, one jump a week
  // The run is an order like any other, so it shows on the desk's books; in port here, it is read at once.
  const run: Order = { kind: 'move', to: dest, then: { kind: 'world', world: state.capital } }
  postDispatch(state, { kind: 'ship', ship: courier }, state.capital, { kind: 'order', ship: courier, order: run })
  return true
}
