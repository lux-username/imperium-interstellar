/**
 * The hulls that hunt: each empire's corvettes on patrol, and the outlaws.
 * A patrol cruises her empire's worlds, lying off each a week or two; at
 * war she takes what the enemy sends in. An outlaw lies off a port until
 * she has taken something or the week runs out, then runs for a haven to
 * sell it. Both use the encounter rules in ./combat.ts, and both decide on
 * what they believe.
 */
import { GOODS, sell } from './economy'
import { hexRoute } from './chart'
import { hexDistance } from './hex'
import { postNewsItem } from './news'
import { beliefOf } from './mail'
import { officerCulture, personName, rollSex } from './names'
import { rollTraits } from './people'
import { nextInt, roll } from './rng'
import { fuelPrice, MAINTENANCE_EVERY, maintenanceCost, newShip, reachable, setCourse, unload } from './ships'
import { SHIP_CLASSES, type Character, type CharacterId, type Duty, type EmpireId, type GameState, type Ship, type ShipId, type WorldId } from './types'

/** Corvettes each empire keeps in the subsector. */
const CORVETTES = 3

/** Outlaw hulls at the start. */
const OUTLAWS = 0

function newCaptain(state: GameState, id: CharacterId, empire: EmpireId, ship: ShipId, purse: number, outlaw = false): Character {
  const core = state.empires[empire].core
  const culture = outlaw ? officerCulture(state.rng) : officerCulture(state.rng, core)
  const sex = rollSex(state.rng)
  const c: Character = { id, name: personName(state.rng, culture, sex), culture, sex, empire, body: { kind: 'aboard', ship }, purse, debt: null, traits: rollTraits(state.rng) }
  if (outlaw) c.outlaw = true
  return c
}

/** The next hop toward a world over any worlds within jump, or null if none. */
function hopToward(state: GameState, from: WorldId, to: WorldId): WorldId | null {
  if (from === to) return null
  const path = hexRoute(state.worlds, from, to, 3)
  return path && path.length > 1 ? path[1] : null
}

/** A world an outlaw can call home: a working port, slack law, not a seat. */
export function havens(state: GameState): WorldId[] {
  const seats = new Set(Object.values(state.empires).map((e) => e.seat))
  return (Object.keys(state.worlds).sort() as WorldId[]).filter((id) => {
    const w = state.worlds[id]
    return !seats.has(id) && w.profile.population > 0 && ['B', 'C'].includes(w.profile.starport) && w.profile.law <= 4
  })
}

/** Each navy's corvettes at its seat, and a few outlaws at havens. */
export function spawnHunters(state: GameState, taken: Set<string>): void {
  let n = 1
  for (const e of Object.values(state.empires).sort((a, b) => (a.id < b.id ? -1 : 1))) {
    for (let i = 0; i < CORVETTES; i++) {
      const sid = `s-navy-${n}` as ShipId
      const cid = `c-navy-${n}` as CharacterId
      n += 1
      const ship = newShip(state.rng, sid, 'patrol_boat', e.id, { kind: 'organisation', empire: e.id, arm: 'navy' }, e.seat, taken, cid)
      ship.duty = { kind: 'patrol', until: state.week, station: null }
      state.ships[sid] = ship
      state.characters[cid] = newCaptain(state, cid, e.id, sid, 2000)
    }
  }
  const dens = havens(state)
  for (let i = 0; i < OUTLAWS && dens.length > 0; i++) {
    const haven = dens[nextInt(state.rng, 0, dens.length - 1)]
    const sid = `s-outlaw-${i + 1}` as ShipId
    const cid = `c-outlaw-${i + 1}` as CharacterId
    const empire = state.worlds[haven].empire
    const ship = newShip(state.rng, sid, 'corvette', empire, { kind: 'personal', character: cid }, haven, taken, cid)
    ship.duty = { kind: 'raid', haven, until: state.week }
    state.ships[sid] = ship
    state.characters[cid] = newCaptain(state, cid, empire, sid, 5000, true)
  }
}

type Hunt = Exclude<Duty, { kind: 'haul' }>

function hunters(state: GameState): { captain: Character; ship: Ship; at: WorldId }[] {
  const out: { captain: Character; ship: Ship; at: WorldId }[] = []
  for (const id of Object.keys(state.ships).sort() as ShipId[]) {
    const ship = state.ships[id]
    if (!ship.duty || ship.duty.kind === 'haul' || !ship.captain || ship.location.kind !== 'world') continue
    const captain = state.characters[ship.captain]
    if (!captain || captain.captive) continue
    out.push({ captain, ship, at: ship.location.world })
  }
  return out
}

/** Weeks a boat holds a station before coming home for a new one. */
const STATION_WEEKS = 12

/**
 * What the navy knows of danger: what its captains hold, and what the
 * guild's factors have reported to the seat. The most dangerous world of
 * the empire that no boat is already on station at, if its danger is
 * worth a boat.
 */
function mostDangerous(state: GameState, empire: EmpireId): WorldId | null {
  const level: Record<string, number> = {}
  for (const s of Object.values(state.ships)) {
    if (s.duty?.kind !== 'patrol' || s.owner.kind !== 'organisation' || s.owner.empire !== empire || !s.captain) continue
    const b = state.beliefs[s.captain]
    if (!b) continue
    for (const w of Object.keys(b.danger) as WorldId[]) level[w] = Math.max(level[w] ?? 0, b.danger[w].level)
  }
  const g = state.guilds[empire]
  for (const w of Object.keys(g.danger) as WorldId[]) if (state.week - g.danger[w] <= 16) level[w] = Math.max(level[w] ?? 0, 0.6)
  const onStation = new Set(Object.values(state.ships).filter((s) => s.duty?.kind === 'patrol' && s.owner.kind === 'organisation' && s.owner.empire === empire).map((s) => (s.duty as { station?: WorldId | null }).station))
  const candidates = (Object.keys(level) as WorldId[]).filter((w) => state.worlds[w]?.empire === empire && level[w] >= 0.3 && !onStation.has(w)).sort((a, b) => level[b] - level[a] || (a < b ? -1 : 1))
  return candidates[0] ?? null
}

/** A patrol's next world: one of her empire's within jump, the one she has seen least lately. */
function nextStation(state: GameState, captain: Character, ship: Ship, at: WorldId): WorldId | null {
  const belief = beliefOf(state, captain.id)
  const own = reachable(state, at, SHIP_CLASSES[ship.type].jump).filter((w) => state.worlds[w].empire === captain.empire && state.worlds[w].profile.population > 0)
  if (own.length === 0) return null
  const age = (w: WorldId) => state.week - (belief.worlds[w]?.observed ?? -99)
  own.sort((a, b) => age(b) - age(a) || (a < b ? -1 : 1))
  const top = own.slice(0, Math.min(2, own.length))
  return top[nextInt(state.rng, 0, top.length - 1)]
}

/** Whether a patrol lies off or in port at a world. */
export function patrolAt(state: GameState, at: WorldId): Ship | null {
  for (const id of Object.keys(state.ships).sort() as ShipId[]) {
    const s = state.ships[id]
    if (s.duty?.kind === 'patrol' && s.location.kind === 'world' && s.location.world === at && s.captain && !state.characters[s.captain]?.captive) return s
  }
  return null
}

/** The hunters act: refuel, sell plunder at a haven, lie off, move on. */
export function huntersAct(state: GameState): void {
  for (const { captain, ship, at } of hunters(state)) {
    const duty = ship.duty as Hunt
    const here = state.worlds[at]
    // A robber lying off a port a patrol has come to does not wait to be found: she moves on.
    if (duty.kind === 'raid' && ship.lyingOff && patrolAt(state, at)) {
      ship.duty = { ...duty, until: state.week }
      ship.lyingOff = false
    }
    // The navy fuels and mends at any of its own ports; an outlaw only at a haven, and pays.
    const home = duty.kind === 'patrol' ? here.empire === ship.empire : at === duty.haven
    // A robber on her own account buys fuel wherever it is sold, like the trader she was.
    if (duty.kind === 'raid' && ship.owner.kind === 'personal' && !ship.lyingOff) {
      const price = fuelPrice(here.profile.starport)
      while (price !== null && ship.fuel < SHIP_CLASSES[ship.type].tanks && captain.purse >= price + 500) {
        captain.purse -= price
        ship.fuel += 1
      }
    }
    if (home && !ship.lyingOff) {
      ship.fuel = SHIP_CLASSES[ship.type].tanks
      if (ship.damage > 0) ship.damage = Math.max(0, ship.damage - 1)
      // The navy's yards keep her up; an outlaw's haven does what it can, at a price.
      if (state.week - ship.maintained >= MAINTENANCE_EVERY - 2 && ['A', 'B', 'C'].includes(here.profile.starport)) {
        if (duty.kind === 'raid') captain.purse -= Math.round(maintenanceCost(ship) / 2)
        ship.maintained = state.week
      }
    }
    if (duty.kind === 'raid' && at === duty.haven && ship.hold.length > 0) {
      for (const lot of [...ship.hold]) {
        const n = unload(ship, lot.good, lot.tons)
        // A haven asks no questions and takes no duty.
        if (n > 0) captain.purse += sell(here, lot.good, n, captain.empire, { smuggle: true }).credits
      }
    }
    // A boat that has reached her station lies off at once, for the station's whole term.
    if (duty.kind === 'patrol' && duty.station === at && !ship.lyingOff) {
      ship.lyingOff = true
      ship.duty = { ...duty, until: Math.max(duty.until, state.week + STATION_WEEKS) }
      continue
    }
    if (state.week < duty.until) continue
    if (ship.lyingOff || home) {
      // Time to move. A patrol goes to the next station; an outlaw with plunder goes home, else to a port worth watching.
      let to: WorldId | null = null
      if (duty.kind === 'patrol') {
        const station = duty.station ?? null
        if (station && at === station && state.week >= duty.until) {
          // Station held: home for a new assignment.
          ship.duty = { kind: 'patrol', until: state.week + 1, station: null }
          to = hopToward(state, at, state.empires[ship.empire].seat)
        } else if (station && at !== station) {
          to = hopToward(state, at, station)
        } else if (!station && at === state.empires[ship.empire].seat) {
          const worst = mostDangerous(state, ship.empire)
          if (worst) {
            ship.duty = { kind: 'patrol', until: state.week + STATION_WEEKS, station: worst }
            to = hopToward(state, at, worst)
            postNewsItem(state, at, `The ${ship.name} is sent to lie off ${state.worlds[worst].name}, where there has been trouble.`)
          } else to = nextStation(state, captain, ship, at)
        } else to = nextStation(state, captain, ship, at)
      }
      else if (ship.hold.length > 0 || ship.damage >= 2 || ship.fuel <= 1) to = at === duty.haven ? null : duty.haven
      else {
        const within = reachable(state, at, SHIP_CLASSES[ship.type].jump).filter((w) => w !== duty.haven && state.worlds[w].profile.population > 0)
        // Any port a trader calls at is worth lying off; the busy ones nearer home first.
        const good = within.filter((w) => ['A', 'B', 'C'].includes(state.worlds[w].profile.starport) && hexDistance(state.worlds[w].hex, state.worlds[duty.haven].hex) <= 4)
        const marks = good.length > 0 ? good : within.filter((w) => ['A', 'B', 'C'].includes(state.worlds[w].profile.starport))
        to = marks.length > 0 ? marks[nextInt(state.rng, 0, marks.length - 1)] : null
      }
      if (to && ship.fuel >= 1) {
        setCourse(state, ship, to)
        ship.lyingOff = false
        const d = ship.duty as Hunt
        if (!(d.kind === 'patrol' && d.station)) ship.duty = { ...d, until: state.week + 1 + (roll(state.rng) >= 8 ? 2 : 1) }
      } else if (duty.kind === 'raid' && at === duty.haven) {
        ship.duty = { ...duty, until: state.week + 2 }
      }
    } else {
      // Just arrived somewhere worth watching: lie off for the term; on station, for the station's whole term.
      ship.lyingOff = true
      const d = ship.duty as Hunt
      if (d.kind === 'patrol' && d.station === at) ship.duty = { ...d, until: Math.max(d.until, state.week + STATION_WEEKS) }
      else ship.duty = { ...d, until: state.week + 1 + (roll(state.rng) >= 8 ? 2 : 1) }
    }
  }
}

export { GOODS }
