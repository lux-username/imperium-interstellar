/**
 * Prizes. A hull taken lawfully is sailed by a prize crew to the captor's
 * seat, where she is condemned and sold: a bulk freighter to the empire's
 * guild if its purse can bear it, any other hull to a new captain of the
 * empire who sets up trading in her. The price, half of new, goes to the
 * treasury; shares for the flag, the captain and the crew wait for the
 * prize court proper. A prize crew burns fuel like anyone and fills her
 * tanks at the empire's own ports.
 */
import { hexRoute } from './chart'
import { FLOAT } from './guild'
import { officerCulture, personName, rollSex } from './names'
import { postNewsItem } from './news'
import { rollTraits } from './people'
import { fuelPrice } from './ships'
import { SHIP_CLASSES, type Character, type CharacterId, type GameState, type Ship, type ShipId } from './types'

/** What a condemned hull fetches: half what she cost new. */
export function prizeValue(ship: Ship): number {
  return Math.round(SHIP_CLASSES[ship.type].price / 2)
}

/** The court sits: she is sold, and the proceeds go to the treasury. Returns who has her now. */
function condemn(state: GameState, ship: Ship, taker: string): string {
  const e = state.empires[taker as never]
  const seat = state.worlds[e.seat]
  const value = prizeValue(ship)
  ship.duty = null
  ship.hold = []
  ship.damage = 0
  ship.lyingOff = false
  if (ship.type === 'bulk_freighter') {
    const g = state.guilds[e.id]
    if (g.purse >= value + FLOAT) {
      g.purse -= value + FLOAT
      e.treasury += value
      const cid = `c-hauler-${e.id.slice(2)}-${state.nextId++}` as CharacterId
      const culture = officerCulture(state.rng, e.core)
      const sex = rollSex(state.rng)
      state.characters[cid] = { id: cid, name: personName(state.rng, culture, sex), culture, sex, empire: e.id, body: { kind: 'aboard', ship: ship.id }, purse: 1000, debt: null, guild: e.id, traits: rollTraits(state.rng) }
      ship.owner = { kind: 'organisation', empire: e.id, arm: 'guild' }
      ship.empire = e.id
      ship.captain = cid
      ship.duty = { kind: 'haul', line: null, waited: 0 }
      ship.strongbox = FLOAT
      postNewsItem(state, seat.id, `The prize ${ship.name} was condemned and sold to the guild for ${value} Cr.`)
      return 'the guild'
    }
  }
  // A new captain of the empire buys her and sets up in trade.
  const cid = `c-trader-${e.id.slice(2)}-${state.nextId++}` as CharacterId
  const culture = officerCulture(state.rng, e.core)
  const sex = rollSex(state.rng)
  const c: Character = { id: cid, name: personName(state.rng, culture, sex), culture, sex, empire: e.id, body: { kind: 'aboard', ship: ship.id }, purse: 15000, debt: null, traits: rollTraits(state.rng) }
  state.characters[cid] = c
  e.treasury += value
  ship.owner = { kind: 'personal', character: cid }
  ship.empire = e.id
  ship.captain = cid
  ship.strongbox = 0
  postNewsItem(state, seat.id, `The prize ${ship.name} was condemned and sold to ${c.name} for ${value} Cr.`)
  return c.name
}

/** Prizes under way: a hop toward the seat each week, fuel at the empire's ports; at the seat, the court. */
export function prizesAct(state: GameState): void {
  for (const id of Object.keys(state.ships).sort() as ShipId[]) {
    const ship = state.ships[id]
    if (ship.duty?.kind !== 'prize' || ship.location.kind !== 'world') continue
    const at = ship.location.world
    const here = state.worlds[at]
    if (at === ship.duty.to) {
      condemn(state, ship, ship.duty.taker)
      continue
    }
    const price = fuelPrice(here.profile.starport)
    if (price !== null && here.empire === ship.duty.taker) ship.fuel = SHIP_CLASSES[ship.type].tanks
    if (ship.fuel < 1) continue
    const path = hexRoute(state.worlds, at, ship.duty.to, SHIP_CLASSES[ship.type].jump)
    ship.course = path && path.length > 1 ? path[1] : null
  }
}
