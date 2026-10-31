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
import { hexLabel } from './hex'
import { route } from './chart'
import { generateSubsector } from './generate'
import { characterLocation, copyDeclaration, deliverHeld, observe, postLetter, postNews, pruneMail, snapshotWorld } from './mail'
import { officerCulture, personName, rollSex } from './names'
import { createRng, nextInt, roll } from './rng'
import { departScouts, landShips, packetScouts } from './scouts'
import { stanceKey, stancePair, type CharacterId, type Declaration, type EmpireId, type GameState, type Mail, type ReportId, type ShipId, type Week, type World, type WorldId } from './types'
import type { Report } from './view'

export const PLAYER = 'c-player' as CharacterId

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
    characters: { [PLAYER]: { id: PLAYER, name: personName(rng, culture, sex), culture, sex, empire: first.id, body: { kind: 'world', world: home } } },
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
  openingChart(state, PLAYER, home)
  observeAll(state)
  departScouts(state)
  return state
}

export function advanceWeek(state: GameState): void {
  state.week += 1
  landShips(state)
  deliverHeld(state)
  stanceClock(state)
  observeAll(state)
  departScouts(state)
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

/** The world the player's body is at, if not in jump. */
export function playerWorld(state: GameState): World | null {
  const id = characterLocation(state, state.player)
  return id === null ? null : state.worlds[id]
}

export type { Week }
