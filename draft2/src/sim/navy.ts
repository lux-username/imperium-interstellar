/**
 * The hulls that hunt: each empire's corvettes on patrol, and the outlaws.
 * A patrol cruises her empire's worlds, lying off each a week or two; at
 * war she takes what the enemy sends in. An outlaw lies off a port until
 * she has taken something or the week runs out, then runs for a haven to
 * sell it. Both use the encounter rules in ./combat.ts, and both decide on
 * what they believe.
 */
import { GOODS, sell } from './economy'
import { hexDistance } from './hex'
import { beliefOf } from './mail'
import { officerCulture, personName, rollSex } from './names'
import { rollTraits } from './people'
import { nextInt, roll } from './rng'
import { MAINTENANCE_EVERY, maintenanceCost, newShip, reachable, setCourse, unload } from './ships'
import { SHIP_CLASSES, type Character, type CharacterId, type Duty, type EmpireId, type GameState, type Ship, type ShipId, type WorldId } from './types'

/** Corvettes each empire keeps in the subsector. */
const CORVETTES = 2

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
      const ship = newShip(state.rng, sid, 'corvette', e.id, { kind: 'organisation', empire: e.id, arm: 'navy' }, e.seat, taken, cid)
      ship.duty = { kind: 'patrol', until: state.week }
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

/** The hunters act: refuel, sell plunder at a haven, lie off, move on. */
export function huntersAct(state: GameState): void {
  for (const { captain, ship, at } of hunters(state)) {
    const duty = ship.duty as Hunt
    const here = state.worlds[at]
    // The navy fuels and mends at any of its own ports; an outlaw only at a haven, and pays.
    const home = duty.kind === 'patrol' ? here.empire === ship.empire : at === duty.haven
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
    if (state.week < duty.until) continue
    if (ship.lyingOff || home) {
      // Time to move. A patrol goes to the next station; an outlaw with plunder goes home, else to a port worth watching.
      let to: WorldId | null = null
      if (duty.kind === 'patrol') to = nextStation(state, captain, ship, at)
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
        ship.duty = { ...duty, until: state.week + 1 + (roll(state.rng) >= 8 ? 2 : 1) }
      } else if (duty.kind === 'raid' && at === duty.haven) {
        ship.duty = { ...duty, until: state.week + 2 }
      }
    } else {
      // Just arrived somewhere worth watching: lie off for the term.
      ship.lyingOff = true
      ship.duty = { ...duty, until: state.week + 1 + (roll(state.rng) >= 8 ? 2 : 1) }
    }
  }
}

export { GOODS }
