/**
 * Fighting in space, resolved by the sim when hostile hulls share a
 * system. Strength, posture, commander traits and dice produce damage,
 * destruction, capture or retreat; there is no tactical layer. The Home Office
 * learns of it from the commanders' own after-action letters (see
 * ./ships.ts), which a self-serving commander shades.
 *
 * A port has guns of its own — A ports more, B ports some, nothing below — and they count
 * for any side docked there, both in weighing the odds and in the
 * exchange. Docked hulls stand and fight from under them rather than
 * running; a hull that only came out of jump this week is still in the
 * open, which is how raiders make a living. A side in the open that will
 * not fight tries to break off ship by ship — scouts almost always get
 * away — and whatever is caught with no guns is robbed (by pirates) or
 * taken (by anyone else). A hull
 * taken with her guns intact goes to the captor's rendezvous under a prize
 * crew — or, taken by pirates, becomes a pirate on the spot. Mail aboard a
 * hull that is taken or destroyed is lost with her (#43).
 *
 * Numbers are placeholders for the 1b playtest.
 */
import { neighbours } from './chart'
import { isBold, isCautious } from './characters'
import { recordEvent } from './events'
import { PIRATES, capitalOf, hostile } from './factions'
import { hexDistance } from './hex'
import { shipsAt } from './mail'
import { interrogate, pirateFromPrize } from './pirates'
import { check, nextInt, roll } from './rng'
import { impound } from './world'
import type { FactionId, GameState, Ship, ShipId, WorldId } from './types'
import type { Posture } from './orders'

/** What a hull can still bring to a fight. */
export function effectiveStrength(ship: Ship): number {
  return Math.max(0, ship.strength - ship.damage)
}

/** A hull with nothing left: knocked out in action, or a prize. She cannot fight, and only a dockyard can put her back together. */
export function knockedOut(ship: Pick<Ship, 'strength' | 'damage'>): boolean {
  return ship.strength > 0 && ship.damage >= ship.strength
}

/** Ports with a dockyard, which can rebuild a knocked-out hull. A C port can only patch one that still fights. */
export function hasDockyard(starport: string): boolean {
  return starport === 'A' || starport === 'B'
}

function hullStrength(ships: Ship[]): number {
  return ships.reduce((sum, s) => sum + effectiveStrength(s), 0)
}

/** What a port's own batteries are worth to a side docked there: enough to make a lone raider think twice at an A port, not enough to stop two anywhere. Placeholders for the playtest. */
export function portGuns(starport: string): number {
  return starport === 'A' ? 2 : starport === 'B' ? 1 : 0
}

/** Where an encounter is and who is only just arriving; the port's guns count for whoever is docked. */
interface Scene {
  at: WorldId
  arriving: ReadonlySet<ShipId>
}

/** A side's fighting power: its hulls, plus the port's guns if any of it lies docked there — and the guns are the holder's, so a pirate at a haven gets none. */
function sideStrength(state: GameState, ships: Ship[], scene: Scene): number {
  const hulls = hullStrength(ships)
  const world = state.worlds[scene.at]
  const underGuns = ships.some((s) => s.faction === world?.faction && docked(state, s, scene.at, scene.arriving))
  return hulls + (underGuns ? portGuns(world?.profile.starport ?? 'X') : 0)
}

const POSTURES: Posture[] = ['never', 'overwhelming', 'favourable', 'even', 'always']

/** The lead hull's posture, read a step up by a bold commander and a step down by a cautious one. */
function postureOf(state: GameState, ships: Ship[]): Posture {
  const lead = [...ships].sort((a, b) => effectiveStrength(b) - effectiveStrength(a) || (a.id < b.id ? -1 : 1))[0]
  const commander = lead.commander ? state.characters[lead.commander] : null
  let i = POSTURES.indexOf(lead.standing.onContact)
  if (commander && isBold(commander)) i += 1
  if (commander && isCautious(commander)) i -= 1
  return POSTURES[Math.max(0, Math.min(POSTURES.length - 1, i))]
}

function odds(posture: Posture, own: number, enemy: number): boolean {
  switch (posture) {
    case 'never':
      return false
    case 'overwhelming':
      return own >= enemy * 2 && own > enemy
    case 'favourable':
      return own > enemy
    case 'even':
      return own >= enemy
    case 'always':
      return true
  }
}

/**
 * Pirates at a haven they know are guests, and keep the peace: no robbery
 * at the port that shelters them, whatever comes in. They still fight back
 * if someone starts it.
 */
function keepsPeace(us: Ship[], at: WorldId): boolean {
  return us.length > 0 && us[0].faction === PIRATES && us.every((s) => s.havens?.includes(at))
}

/** Whether a side, taken all together and with its port, would come out and fight. A port's guns never sortie on their own. */
function wouldSortie(state: GameState, us: Ship[], them: Ship[], scene: Scene): boolean {
  if (hullStrength(us) === 0 || keepsPeace(us, scene.at)) return false
  return odds(postureOf(state, us), sideStrength(state, us, scene), sideStrength(state, them, scene))
}

/**
 * Whether a side chooses to fight, given what it can reach of the other.
 * The port protects what lies under it, not the approaches: a hunter weighs
 * the hulls in the open, and counts the docked hulls and the port's guns
 * only if those would actually come out to meet her.
 */
function engages(state: GameState, us: Ship[], them: Ship[], scene: Scene): boolean {
  if (hullStrength(us) === 0 || keepsPeace(us, scene.at)) return false
  const own = sideStrength(state, us, scene)
  const open = them.filter((s) => !docked(state, s, scene.at, scene.arriving))
  const enemy = wouldSortie(state, them, us, scene) ? sideStrength(state, them, scene) : hullStrength(open)
  return odds(postureOf(state, us), own, enemy)
}

/** Naval competence of whoever leads the side; zero for a side of packets. */
function leadCompetence(state: GameState, ships: Ship[]): number {
  const lead = [...ships].sort((a, b) => effectiveStrength(b) - effectiveStrength(a) || (a.id < b.id ? -1 : 1))[0]
  const c = lead.commander ? state.characters[lead.commander] : null
  return c?.traits.competence.naval ?? 0
}

/**
 * Docked at a port of her own faction — or, for a pirate, at a haven she
 * knows — a hull is under the port's guns. A hull that only came out of
 * jump this week is still in the open, which is how raiders make a living.
 */
export function docked(state: GameState, ship: Ship, at: WorldId, arriving: ReadonlySet<ShipId> = new Set()): boolean {
  const world = state.worlds[at]
  if (!world || arriving.has(ship.id)) return false
  if (ship.faction === PIRATES) return ship.havens?.includes(at) ?? false
  return world.faction === ship.faction
}

// ---------------------------------------------------------------------------
// Breaking off

/**
 * A hull trying to get clear. Scouts are built for it; couriers and
 * packets are quick; warships are not. A good commander helps. She jumps
 * to a neighbouring world — a friendly one if there is one in range — and
 * arrives next week with whatever she carries.
 */
function breakOff(state: GameState, ship: Ship, at: WorldId): boolean {
  const target = ship.role === 'scout' ? 4 : ship.role === 'packet' ? 7 : 9
  const commander = ship.commander ? state.characters[ship.commander] : null
  if (!check(state.rng, target, commander?.traits.competence.naval ?? 0)) return false
  const to = refuge(state, ship, at)
  if (!to) return false
  recordEvent(state, at, { kind: 'ship_fled', valence: 'neutral', against: ship.faction, severity: 1, ship })
  ship.location = { kind: 'transit', from: at, to, arrives: state.week + 1 }
  return true
}

/** Where a hull runs to: a charted neighbour, else anything within a jump, friendly first. Null if nowhere. */
function refuge(state: GameState, ship: Ship, at: WorldId): WorldId | null {
  const here = state.worlds[at]
  const charted = neighbours(state.lanes, at)
  const inRange = (Object.keys(state.worlds).sort() as WorldId[]).filter((w) => w !== at && hexDistance(state.worlds[w].hex, here.hex) <= ship.jump)
  const candidates = charted.length > 0 ? charted : inRange
  if (candidates.length === 0) return null
  const friendly = candidates.filter((w) => !hostile(state.worlds[w].faction, ship.faction))
  const pool = friendly.length > 0 ? friendly : candidates
  return pool[nextInt(state.rng, 0, pool.length - 1)]
}

// ---------------------------------------------------------------------------
// Losing a hull

/** Everything in the bag is gone: taken and destroyed, or lost with the ship. */
function loseMail(state: GameState, ship: Ship): void {
  for (const id of ship.mailbag) {
    const mail = state.mail[id]
    if (mail) mail.status = { kind: 'lost', week: state.week }
  }
  ship.mailbag = []
}

/** A hull with no guns caught in the open: pirates rob her and let her go; anyone else takes her. */
function overtaken(state: GameState, ship: Ship, at: WorldId, by: Ship[]): void {
  if (by[0].faction === PIRATES) {
    loseMail(state, ship)
    recordEvent(state, at, { kind: 'ship_robbed', valence: 'neutral', against: ship.faction, favours: PIRATES, severity: 2, ship })
    return
  }
  capture(state, ship, at, by)
}

/**
 * The hull is the captor's. Her people are lost to the game. Taken by
 * pirates with her guns intact, she is a pirate from this week, with her
 * captor's havens. Taken by anyone else, a packet is impounded (she needs
 * no officer and runs for the holder if her lane is theirs); anything else
 * sails for the captor's rendezvous under a prize crew and waits there for
 * an officer.
 */
export function capture(state: GameState, ship: Ship, at: WorldId, by: Ship[]): void {
  const captor = by[0].faction
  loseMail(state, ship)
  recordEvent(state, at, { kind: 'ship_captured', valence: 'neutral', against: ship.faction, favours: captor, severity: 3, ship })
  // A pirate crew is questioned by whoever took them, if that side keeps a seat to write to.
  const questioner = by.find((s) => s.commander)?.commander ?? null
  if (ship.faction === PIRATES && questioner && capitalOf(state, captor)) interrogate(state, ship, ship.havens ?? [], questioner, at)
  if (ship.commander) delete state.characters[ship.commander]
  for (const p of ship.passengers) delete state.characters[p]
  ship.passengers = []
  ship.commander = null
  if (captor === PIRATES && ship.strength > 0) {
    pirateFromPrize(state, ship, by[0].havens ?? [])
    return
  }
  if (ship.role === 'packet') {
    impound(state, ship, captor)
    return
  }
  const lead = [...by].sort((x, y) => effectiveStrength(y) - effectiveStrength(x) || (x.id < y.id ? -1 : 1))[0]
  const home = lead.standing.rally ?? capitalOf(state, captor)
  ship.faction = captor
  ship.havens = null
  ship.order = home && home !== at ? { kind: 'move', to: home, then: null } : { kind: 'hold' }
  ship.standing = { rally: home, onContact: 'never' }
}

function destroy(state: GameState, ship: Ship, at: WorldId, by: FactionId): void {
  loseMail(state, ship)
  recordEvent(state, at, { kind: 'ship_destroyed', valence: 'neutral', against: ship.faction, favours: by, severity: 3, ship })
  if (ship.commander) delete state.characters[ship.commander]
  for (const p of ship.passengers) delete state.characters[p]
  delete state.ships[ship.id]
}

// ---------------------------------------------------------------------------
// The action

/**
 * A few exchanges. Each round both sides roll to hit; a hit knocks a point
 * off one enemy hull, the biggest first. A hull with nothing left is
 * knocked out: destroyed on a high roll, otherwise taken if the other side
 * still has guns. After each round the side in the open that is worse off
 * may break off ship by ship; a docked side fights on under the port.
 */
function battle(state: GameState, scene: Scene, a: Ship[], b: Ship[]): void {
  const { at } = scene
  const lead = (side: Ship[]) => [...side].sort((x, y) => effectiveStrength(y) - effectiveStrength(x) || (x.id < y.id ? -1 : 1))[0]
  // The record names the intruder — the side that is not the port's own — and says whether the port's side had any
  // guns of its own to answer with, or only the batteries: a packet at the quay does not fight, the port does.
  const holder = state.worlds[at]?.faction
  const [intruders, defenders] = a[0].faction === holder ? [b, a] : [a, b]
  recordEvent(state, at, { kind: 'battle', valence: 'bad', severity: 2, ship: lead(intruders), level: defenders[0].faction === holder ? hullStrength(defenders) : null })
  // Sides are who flew which flag when the action began: a hull taken mid-action leaves her side, and does not flee as a prize.
  const flagA = a[0].faction
  const flagB = b[0].faction
  let sideA = a
  let sideB = b
  for (let round = 0; round < 3; round++) {
    const sa = sideStrength(state, sideA, scene)
    const sb = sideStrength(state, sideB, scene)
    if (sa === 0 || sb === 0) break
    const edge = Math.max(-3, Math.min(3, sa - sb))
    const hitsA = check(state.rng, 8, edge + leadCompetence(state, sideA))
    const hitsB = check(state.rng, 8, -edge + leadCompetence(state, sideB))
    if (hitsA) hit(state, at, lead(sideB), sideA)
    if (hitsB) hit(state, at, lead(sideA), sideB)
    sideA = sideA.filter((s) => state.ships[s.id] && s.location.kind === 'world' && s.faction === flagA)
    sideB = sideB.filter((s) => state.ships[s.id] && s.location.kind === 'world' && s.faction === flagB)
    if (sideA.length === 0 || sideB.length === 0) break
    // Whoever no longer likes the odds and is in the open tries to get clear.
    if (!engages(state, sideA, sideB, scene)) sideA = sideA.filter((s) => docked(state, s, at, scene.arriving) || !breakOff(state, s, at))
    if (!engages(state, sideB, sideA, scene)) sideB = sideB.filter((s) => docked(state, s, at, scene.arriving) || !breakOff(state, s, at))
    if (sideA.length === 0 || sideB.length === 0) break
  }
}

/** A point of damage on `ship`, from `by`. Knocked out at zero: an unarmed hull knocked out by pirates is robbed, not kept. */
function hit(state: GameState, at: WorldId, ship: Ship, by: Ship[]): void {
  ship.damage += 1
  if (effectiveStrength(ship) > 0) {
    recordEvent(state, at, { kind: 'ship_damaged', valence: 'neutral', against: ship.faction, favours: by[0].faction, severity: 1, ship })
    return
  }
  if (ship.strength === 0 && by[0].faction === PIRATES) {
    ship.damage = 0
    overtaken(state, ship, at, by)
    return
  }
  if (roll(state.rng) >= 9 || hullStrength(by) === 0) destroy(state, ship, at, by[0].faction)
  else capture(state, ship, at, by)
}

/**
 * Two hostile groups in one system decide what to do about each other.
 * If both will fight, they fight, the docked side under its port's guns.
 * Otherwise the hunters take what they can catch in the open — hulls that
 * want no part of it try to break off — and then decide, on the odds
 * against hulls-plus-guns, whether to go for the port as well. Whatever is
 * caught is fought or, if it has neither guns nor a port, simply taken.
 */
function encounter(state: GameState, scene: Scene, a: Ship[], b: Ship[]): void {
  const { at, arriving } = scene
  const wantsA = engages(state, a, b, scene)
  const wantsB = engages(state, b, a, scene)
  if (!wantsA && !wantsB) return
  if (wantsA && wantsB) {
    battle(state, scene, a, b)
    return
  }
  const [hunters, quarry] = wantsA ? [a, b] : [b, a]
  const open = quarry.filter((s) => !docked(state, s, at, arriving))
  const underGuns = quarry.filter((s) => docked(state, s, at, arriving))
  const targets = open.filter((s) => !breakOff(state, s, at))
  // The port is a harder proposition: its guns and everything under them, taken together.
  if (underGuns.length > 0 && odds(postureOf(state, hunters), sideStrength(state, hunters, scene), sideStrength(state, underGuns, scene))) targets.push(...underGuns)
  if (targets.length === 0) return
  if (sideStrength(state, targets, scene) === 0) {
    for (const s of targets) overtaken(state, s, at, hunters)
    return
  }
  battle(state, scene, hunters, targets)
}

/**
 * Every system where hostile hulls lie together this week. Groups are by
 * faction; each hostile pair has its encounter, recomputed as hulls flee
 * or change hands. Runs after hulls land and before they unload; `landed`
 * are this week's arrivals, still in the open.
 */
export function fightAtWorlds(state: GameState, landed: readonly ShipId[] = []): void {
  const arriving = new Set(landed)
  const ids = Object.keys(state.worlds).sort() as WorldId[]
  for (const at of ids) {
    const factions = [...new Set(shipsAt(state, at).map((s) => s.faction))].sort()
    for (let i = 0; i < factions.length; i++) {
      for (let j = i + 1; j < factions.length; j++) {
        if (!hostile(factions[i], factions[j])) continue
        const a = shipsAt(state, at).filter((s) => s.faction === factions[i])
        const b = shipsAt(state, at).filter((s) => s.faction === factions[j])
        if (a.length === 0 || b.length === 0) continue
        encounter(state, { at, arriving }, a, b)
      }
    }
  }
}

/**
 * A knocked-about hull lying docked at a port of class C or better is
 * patched up a point a week. A hull knocked out — nothing left to fight
 * with — is a job for a dockyard: a C port cannot begin on her, and she
 * lies there a hulk until she is got to a B or better. Pirates refit only
 * at a haven they know.
 */
export function repairShips(state: GameState): void {
  for (const ship of Object.values(state.ships)) {
    if (ship.damage === 0 || ship.location.kind !== 'world') continue
    const world = state.worlds[ship.location.world]
    if (!docked(state, ship, world.id) || !['A', 'B', 'C'].includes(world.profile.starport)) continue
    if (knockedOut(ship) && !hasDockyard(world.profile.starport)) continue
    ship.damage -= 1
  }
}
