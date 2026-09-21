/**
 * The Warlord: a former Commodore who took ships and a corner of the
 * subsector with him, and wants the rest. He is the campaign's rival
 * polity and its example of a governor's secession at once.
 *
 * He knows only what reaches him. His belief state is built exactly as the
 * player's is — from his governors' letters, his commanders' reports and
 * the rumours that reach his seat — and he chooses targets by what he
 * *believes* to be weakly held, which can be wrong. His scouts are hulls
 * the player's people may see; a scout seen at a world is a warning that
 * it is being looked at. He grows by capturing worlds and by taking
 * prizes; tempting the desk's captains waits for money (bribes and fear
 * are a later system). There is no negotiating with him in this campaign.
 */
import { hexRoute, neighbours, route } from './chart'
import { newCharacter } from './characters'
import { portGuns } from './combat'
import { THE_WARLORD, WARLORD, hostile } from './factions'
import { HULLS, newShip, shipName, troopCapacity } from './fleet'
import { hexDistance } from './hex'
import { roll } from './rng'
import type { CharacterId, GameState, Ship, ShipId, World, WorldId } from './types'
import type { ShipSnapshot, WorldSnapshot } from './view'

/** Worlds he starts with, ships he starts with (spec.md → Starting position). */
export const WARLORD_WORLDS = 6
const WARLORD_FLEET: { role: keyof typeof HULLS; count: number }[] = [
  { role: 'patrol', count: 4 },
  { role: 'transport', count: 2 },
  { role: 'scout', count: 2 },
]

/** He decides once a month, on a week of his own so his moves do not stack with the desk's. */
const DECISION_WEEK = 2

// ---------------------------------------------------------------------------
// Placement

/**
 * Week 0: his seat is the populated A/B port farthest from the player's
 * capital; his worlds are that and the nearest populated worlds to it. The
 * governors there went over with him. Packets on lanes wholly inside his
 * territory run for him; a packet caught in one of his ports on a lane out
 * of it is seized and lies idle.
 */
export function placeWarlord(state: GameState): void {
  const capital = state.worlds[state.capital]
  const populated = Object.values(state.worlds)
    .filter((w) => w.id !== state.capital && w.profile.population > 0)
    .sort((a, b) => hexDistance(b.hex, capital.hex) - hexDistance(a.hex, capital.hex) || (a.id < b.id ? -1 : 1))
  const seat = populated.find((w) => (w.profile.starport === 'A' || w.profile.starport === 'B') && hexDistance(w.hex, capital.hex) >= 4) ?? populated[0]
  if (!seat) return
  const held = [seat, ...populated.filter((w) => w !== seat).sort((a, b) => hexDistance(a.hex, seat.hex) - hexDistance(b.hex, seat.hex) || (a.id < b.id ? -1 : 1)).slice(0, WARLORD_WORLDS - 1)]

  state.factions[WARLORD].capital = seat.id
  state.characters[THE_WARLORD] = {
    id: THE_WARLORD,
    name: 'The Warlord',
    faction: WARLORD,
    post: { kind: 'governor', world: seat.id },
    traits: { loyalty: 'self', initiative: 1, competence: { administrative: 0, naval: 1, diplomatic: 0 }, ambition: 3 },
  }
  state.beliefs[THE_WARLORD] = { worlds: {}, ships: {} }

  for (const world of held) {
    world.faction = WARLORD
    if (world === seat) {
      if (world.governor && world.governor !== THE_WARLORD) state.characters[world.governor].post = { kind: 'unassigned', at: world.id }
      world.governor = THE_WARLORD
      world.actingGovernor = THE_WARLORD
      world.garrison = Math.max(world.garrison, 5)
      world.marines = 1
    } else {
      if (world.governor) state.characters[world.governor].faction = WARLORD
      world.garrison = Math.max(world.garrison, 2)
    }
    world.unrest = Math.min(world.unrest, 4)
  }

  // Ships: the hulls he took with him, and a captain for each.
  const taken = new Set(Object.values(state.ships).map((s) => s.name))
  let n = 1
  for (const { role, count } of WARLORD_FLEET) {
    for (let i = 0; i < count; i++) {
      const id = `s-wl-${role}-${n}` as ShipId
      const cid = `c-wl-${n}` as CharacterId
      n += 1
      const commander = newCharacter(state.rng, cid, WARLORD, { kind: 'commander', ship: id })
      state.characters[cid] = commander
      const ship = newShip(id, shipName(state.rng, taken), HULLS[role], WARLORD, seat.id, commander)
      ship.standing = { rally: seat.id, onContact: 'favourable' }
      state.ships[id] = ship
    }
  }

  // Packets in his ports.
  const his = new Set(held.map((w) => w.id))
  for (const ship of Object.values(state.ships)) {
    if (ship.role !== 'packet' || ship.location.kind !== 'world' || !his.has(ship.location.world)) continue
    ship.faction = WARLORD
    const lane = ship.order?.kind === 'courier' ? ship.order.route : []
    if (!lane.every((w) => his.has(w))) ship.order = { kind: 'hold' }
  }
}


// ---------------------------------------------------------------------------
// What he knows

/** A world as he last heard of it, and how long ago. */
interface Known {
  world: World
  snap: WorldSnapshot
  age: number
}

/** Enemy hulls as his people last saw them somewhere, with what he takes them to be worth. */
interface Sighted {
  strength: number
  age: number
}

/** Everything he has to go on this month, read once from his belief state and the public chart. */
interface Picture {
  seat: WorldId
  /** His own worlds as his governors last described them; a world nobody has written from is here with no snapshot. */
  own: { world: World; snap: WorldSnapshot | null; age: number }[]
  /** Worlds he believes are somebody else's, within reach. */
  targets: Known[]
  /** Hostile hulls seen recently, by world. */
  enemyAt: Record<WorldId, Sighted>
  /** How much losing a world would hurt the desk: chart facts, which he knows as well as anyone. */
  value: (w: World) => number
}

/** How long he trusts a sighting or a letter before he wants a fresh one. */
const FRESH = 8
/** A governor of his who has not written in this long is a worry in himself. */
const SILENCE = 12

/** What a hull of that class is worth in a fight, as far as he can tell from a sighting. */
function worth(role: ShipSnapshot['role']): number {
  return role === 'packet' || role === 'merchant' ? 0 : (HULLS[role as keyof typeof HULLS]?.strength ?? 0)
}

function hisWorlds(state: GameState): World[] {
  return Object.values(state.worlds)
    .filter((w) => w.faction === WARLORD)
    .sort((a, b) => (a.id < b.id ? -1 : 1))
}

function picture(state: GameState, seat: WorldId): Picture {
  const belief = state.beliefs[THE_WARLORD] ?? { worlds: {}, ships: {} }
  const his = hisWorlds(state)
  const near = (w: World) => his.some((h) => hexDistance(h.hex, w.hex) <= 4)

  const own = his.map((world) => {
    const r = belief.worlds[world.id]
    const snap = r?.snapshot.kind === 'world' ? r.snapshot.world : null
    return { world, snap, age: r ? state.week - r.observed : 999 }
  })

  const targets: Known[] = []
  for (const world of Object.values(state.worlds).sort((a, b) => (a.id < b.id ? -1 : 1))) {
    if (world.profile.population === 0 || world.id === state.capital || !near(world)) continue
    const r = belief.worlds[world.id]
    if (!r || r.snapshot.kind !== 'world' || r.snapshot.world.faction === WARLORD) continue
    targets.push({ world, snap: r.snapshot.world, age: state.week - r.observed })
  }

  const enemyAt: Record<WorldId, Sighted> = {}
  for (const sighting of Object.values(belief.ships)) {
    const age = state.week - sighting.observed
    if (age > FRESH || !hostile(sighting.ship.faction, WARLORD)) continue
    const at = sighting.ship.at
    enemyAt[at] = { strength: (enemyAt[at]?.strength ?? 0) + worth(sighting.ship.role), age: Math.min(enemyAt[at]?.age ?? age, age) }
  }

  // Chart facts: lanes, port, and how many worlds the desk reaches its capital through this one.
  const through: Record<WorldId, number> = {}
  for (const w of Object.values(state.worlds)) {
    const path = route(state.lanes, w.id, state.capital)
    if (!path) continue
    for (const step of path.slice(1, -1)) through[step] = (through[step] ?? 0) + 1
  }
  const value = (w: World) => neighbours(state.lanes, w.id).length * 2 + portGuns(w.profile.starport) + (through[w.id] ?? 0) * 3

  return { seat, own, targets, enemyAt, value }
}

// ---------------------------------------------------------------------------
// What he has

function idleAt(state: GameState, at: WorldId, role: Ship['role']): Ship[] {
  return Object.values(state.ships)
    .filter((s) => s.faction === WARLORD && s.role === role && s.commander && s.location.kind === 'world' && s.location.world === at && (!s.order || s.order.kind === 'hold') && s.damage === 0)
    .sort((a, b) => (a.id < b.id ? -1 : 1))
}

function strengthOf(ships: Ship[]): number {
  return ships.reduce((n, s) => n + s.strength - s.damage, 0)
}

/** Troops he can spare from the seat this month: he keeps a reserve against his own fate. */
function spare(state: GameState, seat: WorldId): number {
  return Math.max(0, state.worlds[seat].garrison - 4)
}

/** Load `army` detachments onto idle transports at the seat bound for `to`, with the patrols named as escort. Returns what was lifted. */
function dispatch(state: GameState, seat: WorldId, to: WorldId, army: number, escorts: Ship[]): number {
  let remaining = army
  for (const t of idleAt(state, seat, 'transport')) {
    if (remaining <= 0) break
    const load = Math.min(troopCapacity('transport'), remaining)
    remaining -= load
    t.order = { kind: 'transport', army: load, marines: 0, passenger: null, purpose: 'land', to, then: { kind: 'world', world: seat }, loaded: false }
  }
  const lifted = army - remaining
  if (lifted > 0) for (const p of escorts) p.order = { kind: 'move', to, then: { kind: 'world', world: seat } }
  return lifted
}

// ---------------------------------------------------------------------------
// What he does

/**
 * Once a month, in this order: crew any prizes that have reached him; put
 * out fires on his own worlds; land on the enemy world that is worth most
 * and looks weakest; pick off enemy hulls he can take cheaply; and send
 * scouts where his picture is thinnest. Everything he sends is a hull the
 * desk's people may see, and everything he decides is decided on what has
 * reached him — which can be stale, or wrong.
 */
export function warlordActs(state: GameState): void {
  const seat = state.factions[WARLORD].capital
  if (!seat || !state.characters[THE_WARLORD]) return
  if (state.week % 4 !== DECISION_WEEK) return
  const p = picture(state, seat)
  crewPrizes(state, seat)
  defend(state, p)
  attack(state, p)
  hunt(state, p)
  scout(state, p)
}

/** Prizes that have reached his seat get an officer he recruits on the spot. */
function crewPrizes(state: GameState, seat: WorldId): void {
  for (const prize of Object.values(state.ships).sort((a, b) => (a.id < b.id ? -1 : 1))) {
    if (prize.faction !== WARLORD || prize.commander !== null || prize.role === 'packet' || prize.location.kind !== 'world' || prize.location.world !== seat) continue
    const cid = `c-wl-${state.nextId}` as CharacterId
    state.nextId += 1
    state.characters[cid] = newCharacter(state.rng, cid, WARLORD, { kind: 'commander', ship: prize.id })
    prize.commander = cid
    prize.standing = { rally: seat, onContact: 'favourable' }
    prize.order = null
  }
}

/**
 * His own worlds first. A world his governor says is in revolt or under
 * attack gets enough to tip the fight; one where unrest is climbing, or
 * with enemy warships seen nearby, gets a detachment or two before it is
 * too late; escorts go where warships were seen. The worst case first.
 */
function defend(state: GameState, p: Picture): void {
  const worries = p.own
    .filter((o) => o.world.id !== p.seat && o.snap)
    .map((o) => {
      const snap = o.snap as WorldSnapshot
      const held = snap.garrison + snap.marines
      const threat = nearestEnemy(p, o.world)
      let need = 0
      let urgency = 0
      if (snap.contest) {
        need = Math.max(0, snap.contest.strength + 2 - held)
        urgency = 3
      } else if (snap.unrest >= 6 && held < 3) {
        need = 3 - held
        urgency = 2
      } else if (threat > 0 && held <= threat) {
        need = threat + 1 - held
        urgency = 1
      }
      return { o, need, urgency, threat }
    })
    .filter((w) => w.need > 0)
    .sort((a, b) => b.urgency - a.urgency || b.need - a.need || (a.o.world.id < b.o.world.id ? -1 : 1))
  for (const w of worries) {
    const lift = Math.min(spare(state, p.seat), w.need)
    if (lift <= 0 || hexRoute(state.worlds, p.seat, w.o.world.id, 2) === null) continue
    const escorts = w.threat > 0 ? idleAt(state, p.seat, 'patrol').slice(0, 2) : []
    dispatch(state, p.seat, w.o.world.id, lift, escorts)
  }
}

/** The strongest enemy force seen lately at or within two jumps of a world of his. */
function nearestEnemy(p: Picture, world: World): number {
  let worst = 0
  for (const [at, seen] of Object.entries(p.enemyAt)) {
    const there = (world.id as string) === at ? world : null
    const hex = there?.hex ?? p.own.find((o) => o.world.id === at)?.world.hex ?? p.targets.find((t) => t.world.id === at)?.world.hex
    if (hex && hexDistance(hex, world.hex) <= 4) worst = Math.max(worst, seen.strength)
  }
  return worst
}

/**
 * A landing, on the world he believes he can take that would hurt the desk
 * most to lose: a chokepoint, a busy port. He must believe his troops beat
 * the garrison and his escorts beat whatever warships were seen there,
 * under the port's guns if they are docked. Independent worlds are softer
 * and count for less, but he takes them when nothing of the desk's is
 * within his means — or now and then anyway, for the port.
 */
function attack(state: GameState, p: Picture): void {
  const transports = idleAt(state, p.seat, 'transport')
  const patrols = idleAt(state, p.seat, 'patrol')
  const lift = Math.min(spare(state, p.seat), transports.length * troopCapacity('transport'))
  if (lift <= 0) return
  const escortStrength = strengthOf(patrols)
  const candidates = p.targets
    .filter((t) => hexRoute(state.worlds, p.seat, t.world.id, 2) !== null)
    .map((t) => {
      const garrison = t.snap.garrison + t.snap.marines
      const warships = p.enemyAt[t.world.id]?.strength ?? 0
      const guns = warships > 0 ? portGuns(t.snap.profile.starport) : 0
      const independent = state.factions[t.snap.faction]?.kind === 'rebels'
      const feasible = garrison + 1 < lift && (warships === 0 || escortStrength > warships + guns)
      const value = independent ? portGuns(t.snap.profile.starport) : p.value(t.world)
      return { t, feasible, independent, value, garrison }
    })
    .filter((c) => c.feasible)
    .sort((a, b) => b.value - a.value || a.garrison - b.garrison || (a.t.world.id < b.t.world.id ? -1 : 1))
  if (candidates.length === 0) return
  const desks = candidates.filter((c) => !c.independent)
  const independents = candidates.filter((c) => c.independent)
  // The desk's worlds first; an independent one when that is all there is, or one month in four for its port.
  const pick = desks.length === 0 || (independents.length > 0 && roll(state.rng) >= 10) ? (independents[0] ?? desks[0]) : desks[0]
  const troops = Math.min(lift, pick.garrison + 3)
  const escorts = (p.enemyAt[pick.t.world.id]?.strength ?? 0) > 0 ? patrols : patrols.slice(0, 2)
  dispatch(state, p.seat, pick.t.world.id, troops, escorts)
}

/**
 * Enemy hulls seen lately, in the open or under a weak port, that his idle
 * patrols could take at favourable odds: a courier at a C port, a lone
 * transport. He sends what he needs and they lie off the port a few weeks.
 */
function hunt(state: GameState, p: Picture): void {
  const patrols = idleAt(state, p.seat, 'patrol')
  if (patrols.length === 0) return
  const mine = strengthOf(patrols)
  const prey = Object.entries(p.enemyAt)
    .map(([at, seen]) => {
      const world = state.worlds[at as WorldId]
      const known = p.targets.find((t) => t.world.id === at)
      // Docked at their own port, they have its guns; anywhere else they are in the open.
      const theirs = seen.strength + (known && known.snap.faction !== WARLORD ? portGuns(known.snap.profile.starport) : 0)
      return { at: at as WorldId, world, theirs, age: seen.age }
    })
    .filter((x) => x.world && x.theirs < mine && hexRoute(state.worlds, p.seat, x.at, 2) !== null && x.world.faction !== WARLORD)
    .sort((a, b) => a.theirs - b.theirs || a.age - b.age || (a.at < b.at ? -1 : 1))
  const target = prey[0]
  if (!target) return
  // Enough to be favourable, not the whole fleet.
  let sent = 0
  for (const patrol of patrols) {
    if (sent > target.theirs) break
    patrol.order = { kind: 'patrol', world: target.at, weeks: 3, posture: 'favourable', then: { kind: 'world', world: p.seat }, began: null }
    sent += patrol.strength - patrol.damage
  }
}

/**
 * Scouts go where his picture is thinnest and matters most: a world of his
 * whose governor has gone quiet, or wrote of trouble; then enemy worlds he
 * has never heard of or not heard of lately, the valuable ones first.
 */
function scout(state: GameState, p: Picture): void {
  const scouts = idleAt(state, p.seat, 'scout')
  if (scouts.length === 0) return
  const errands: { to: WorldId; score: number }[] = []
  for (const o of p.own) {
    if (o.world.id === p.seat) continue
    if (o.age >= SILENCE) errands.push({ to: o.world.id, score: 10 + o.age })
    else if (o.snap && (o.snap.contest || o.snap.unrest >= 6) && o.age >= 4) errands.push({ to: o.world.id, score: 8 })
  }
  const his = hisWorlds(state)
  for (const world of Object.values(state.worlds)) {
    if (world.faction === WARLORD || world.profile.population === 0 || world.id === state.capital) continue
    if (!his.some((h) => hexDistance(h.hex, world.hex) <= 4)) continue
    const known = p.targets.find((t) => t.world.id === world.id)
    const age = known ? known.age : 999
    if (age < FRESH) continue
    errands.push({ to: world.id, score: Math.min(age, 30) / 10 + p.value(world) / 4 })
  }
  errands.sort((a, b) => b.score - a.score || (a.to < b.to ? -1 : 1))
  for (const s of scouts) {
    const errand = errands.find((e) => hexRoute(state.worlds, p.seat, e.to, 2) !== null)
    if (!errand) break
    errands.splice(errands.indexOf(errand), 1)
    s.order = { kind: 'scout', world: errand.to, weeks: 1, then: { kind: 'world', world: p.seat }, lookedOn: null }
  }
}
