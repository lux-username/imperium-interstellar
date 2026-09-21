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
 * it is being looked at. He grows by capturing worlds and by tempting
 * self-interested captains within reach of his border. There is no
 * negotiating with him in this campaign.
 */
import { hexRoute } from './chart'
import { isCautious, newCharacter } from './characters'
import { recordEvent } from './events'
import { ADMINISTRATION, THE_WARLORD, WARLORD } from './factions'
import { HULLS, newShip, shipName, troopCapacity } from './fleet'
import { hexDistance } from './hex'
import { snapshotShip, writeReport } from './mail'
import { check } from './rng'
import type { CharacterId, GameState, Ship, ShipId, World, WorldId } from './types'

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
// What he knows and what he does

function hisWorlds(state: GameState): World[] {
  return Object.values(state.worlds)
    .filter((w) => w.faction === WARLORD)
    .sort((a, b) => (a.id < b.id ? -1 : 1))
}

/** Worlds not his within two jumps of any of his, by hex — where he can reach and would want. */
function frontier(state: GameState): World[] {
  const his = hisWorlds(state)
  return Object.values(state.worlds)
    .filter((w) => w.faction !== WARLORD && w.profile.population > 0 && w.id !== state.capital && his.some((h) => hexDistance(h.hex, w.hex) <= 4))
    .sort((a, b) => (a.id < b.id ? -1 : 1))
}

function idleAt(state: GameState, at: WorldId, role: Ship['role']): Ship[] {
  return Object.values(state.ships)
    .filter((s) => s.faction === WARLORD && s.role === role && s.commander && s.location.kind === 'world' && s.location.world === at && (!s.order || s.order.kind === 'hold') && s.damage === 0)
    .sort((a, b) => (a.id < b.id ? -1 : 1))
}

/** What he believes a world's garrison to be, and how old that belief is. Null if he has never heard. */
function believedGarrison(state: GameState, world: WorldId): { strength: number; age: number } | null {
  const report = state.beliefs[THE_WARLORD]?.worlds[world]
  if (!report || report.snapshot.kind !== 'world') return null
  const w = report.snapshot.world
  return { strength: w.garrison + w.marines, age: state.week - report.observed }
}

/**
 * Once a month: send scouts to look at frontier worlds he has not heard of
 * lately; land on the frontier world he believes weakest, if he can spare
 * the troops; and try the loyalty of self-interested captains near his
 * border. Everything he sends is a hull the player's people may see.
 */
export function warlordActs(state: GameState): void {
  const seat = state.factions[WARLORD].capital
  if (!seat || !state.characters[THE_WARLORD]) return
  if (state.week % 4 !== DECISION_WEEK) return
  const home = state.worlds[seat]

  // Scouts, to whatever he knows least about.
  const targets = frontier(state)
    .map((w) => ({ w, belief: believedGarrison(state, w.id) }))
    .filter(({ w }) => hexRoute(state.worlds, seat, w.id, 2) !== null)
    .sort((a, b) => (b.belief?.age ?? 999) - (a.belief?.age ?? 999) || (a.w.id < b.w.id ? -1 : 1))
  for (const scout of idleAt(state, seat, 'scout')) {
    const target = targets.find(({ belief }) => belief === null || belief.age >= 8)
    if (!target) break
    scout.order = { kind: 'scout', world: target.w.id, weeks: 1, then: { kind: 'world', world: seat }, lookedOn: null }
    targets.splice(targets.indexOf(target), 1)
  }

  // Prizes that have reached his seat get an officer he recruits on the spot.
  for (const prize of Object.values(state.ships).sort((a, b) => (a.id < b.id ? -1 : 1))) {
    if (prize.faction !== WARLORD || prize.commander !== null || prize.role === 'packet' || prize.location.kind !== 'world' || prize.location.world !== seat) continue
    const cid = `c-wl-${state.nextId}` as CharacterId
    state.nextId += 1
    state.characters[cid] = newCharacter(state.rng, cid, WARLORD, { kind: 'commander', ship: prize.id })
    prize.commander = cid
    prize.standing = { rally: seat, onContact: 'favourable' }
    prize.order = null
  }

  // A landing, on the frontier world he believes weakest — if he believes he can take it. He keeps his own seat held.
  const transports = idleAt(state, seat, 'transport')
  const spare = Math.max(0, home.garrison - 4)
  const lift = Math.min(spare, transports.length * troopCapacity('transport'))
  if (lift > 0) {
    // He lands only where his own picture says an enemy holds the world; a world he has lost without hearing of it is not yet a target.
    const believedEnemy = (w: World) => {
      const snap = state.beliefs[THE_WARLORD]?.worlds[w.id]?.snapshot
      return snap?.kind === 'world' && snap.world.faction !== WARLORD
    }
    const known = frontier(state)
      .filter((w) => believedEnemy(w) && hexRoute(state.worlds, seat, w.id, 2) !== null)
      .map((w) => ({ w, belief: believedGarrison(state, w.id) }))
      .filter((t): t is { w: World; belief: { strength: number; age: number } } => t.belief !== null)
      .sort((a, b) => a.belief.strength - b.belief.strength || (a.w.id < b.w.id ? -1 : 1))
    const target = known.find(({ belief }) => belief.strength + 1 < lift)
    if (target) {
      let remaining = lift
      for (const t of transports) {
        if (remaining <= 0) break
        const army = Math.min(troopCapacity('transport'), remaining)
        remaining -= army
        t.order = { kind: 'transport', army, marines: 0, passenger: null, purpose: 'land', to: target.w.id, then: { kind: 'world', world: seat }, loaded: false }
      }
      for (const p of idleAt(state, seat, 'patrol').slice(0, 2)) p.order = { kind: 'move', to: target.w.id, then: { kind: 'world', world: seat } }
    }
  }

  recruit(state, seat)
}

/**
 * A self-interested, ambitious captain of the desk's whose hull lies within
 * reach of his border may go over, ship and all. It is not announced: the
 * event may become a rumour; a cautious captain sends a letter of
 * resignation first; a governor who saw it may write; otherwise the desk
 * learns of it when a hull that used to be theirs turns up on the other
 * side of an action. Mail aboard is lost with her (#43).
 */
function recruit(state: GameState, seat: WorldId): void {
  const his = hisWorlds(state)
  const ids = Object.keys(state.ships).sort() as ShipId[]
  for (const id of ids) {
    const ship = state.ships[id]
    if (ship.faction !== ADMINISTRATION || !ship.commander || ship.location.kind !== 'world' || ship.role === 'packet') continue
    const at = ship.location.world
    if (at === state.capital || !his.some((h) => hexDistance(h.hex, state.worlds[at].hex) <= 4)) continue
    const captain = state.characters[ship.commander]
    if (!captain || captain.traits.loyalty !== 'self' || captain.traits.ambition < 2) continue
    if (!check(state.rng, 11, captain.traits.ambition - 2)) continue
    const event = recordEvent(state, at, { kind: 'defection', valence: 'bad', severity: 3, ship, person: captain.name })
    // Written while still on the desk's books, so it is addressed to the desk.
    if (isCautious(captain)) writeReport(state, captain.id, at, { kind: 'ship', ship: snapshotShip(ship, at) }, { events: [event] })
    for (const m of ship.mailbag) if (state.mail[m]) state.mail[m].status = { kind: 'lost', week: state.week }
    ship.mailbag = []
    for (const p of ship.passengers) {
      const c = state.characters[p]
      if (c) c.post = { kind: 'unassigned', at }
    }
    ship.passengers = []
    ship.faction = WARLORD
    captain.faction = WARLORD
    ship.order = { kind: 'move', to: seat, then: null }
    ship.standing = { rally: seat, onContact: 'favourable' }
  }
}
