/**
 * Encounters in the approaches. A hull that came out of jump this week is
 * in the open before she docks; whoever lies off the port may hail her.
 * Then a round or two of choices — run, fight, strike — resolved by guns,
 * jump and dice against the other captain's agent. No tactical layer: a
 * round is one roll each way.
 *
 * The player's encounters stand as `state.pending` until they choose; an
 * NPC's are resolved on the spot with the same rules and the same menu.
 */
import { roll } from './rng'
import { SHIP_CLASSES, stanceKey, type Encounter, type EncounterOutcome, type GameState, type Ship, type Week, type WorldId } from './types'

export type Choice = 'run' | 'fight' | 'strike'
export type Hail = 'attack' | 'let_pass'

/** Points of damage a hull takes before she strikes whether her captain likes it or not. */
export function wreckAt(ship: Ship): number {
  return SHIP_CLASSES[ship.type].guns + 2
}

/** Whether a hull can still fight on. */
export function afloat(ship: Ship): boolean {
  return ship.damage < wreckAt(ship)
}

/** The captain's name, or the hull's for an unnamed crew. */
function who(state: GameState, ship: Ship): string {
  const c = ship.captain ? state.characters[ship.captain] : null
  return c ? `${c.name} of the ${ship.name}` : `the ${ship.name}`
}

/**
 * Whether `hunter`, lying off `at`, has a quarrel with `prey`: an outlaw
 * takes any trader; a navy hull takes outlaws and the hulls of an empire
 * her captain believes at war with hers; nobody takes a scout, which is
 * nobody's prize and carries everyone's mail.
 */
export function quarrel(state: GameState, hunter: Ship, prey: Ship): boolean {
  if (prey.type === 'scout' || prey.id === hunter.id) return false
  if (SHIP_CLASSES[hunter.type].guns === 0) return false
  const h = hunter.captain ? state.characters[hunter.captain] : null
  const p = prey.captain ? state.characters[prey.captain] : null
  if (h?.outlaw) return !p?.outlaw && prey.duty?.kind !== 'patrol'
  if (p?.outlaw) return true
  if (hunter.empire === prey.empire) return false
  const belief = h ? state.beliefs[h.id] : null
  return belief?.stances[stanceKey(hunter.empire, prey.empire)]?.stance === 'war'
}

/** 2d6 plus the guns, less the damage already taken: a round of fire from `from` at `to`. Returns the points that told. */
function fire(state: GameState, from: Ship, to: Ship): number {
  const r = roll(state.rng) + SHIP_CLASSES[from.type].guns - Math.floor(from.damage / 2)
  if (r >= 11) return 2
  if (r >= 8) return 1
  void to
  return 0
}

/** Whether `runner` gets clear of `chaser`: jump and dice, and a trader is slower off the mark than a warship. */
function getsAway(state: GameState, runner: Ship, chaser: Ship): boolean {
  const edge = SHIP_CLASSES[runner.type].jump - SHIP_CLASSES[chaser.type].jump
  const warship = SHIP_CLASSES[runner.type].guns >= 3 ? 1 : 0
  return roll(state.rng) + 2 * edge + warship - Math.floor(runner.damage / 2) >= 8
}

export function beginEncounter(state: GameState, attacker: Ship, defender: Ship, at: WorldId): Encounter {
  return { attacker: attacker.id, defender: defender.id, at, round: 0, log: [`${who(state, attacker)} hails ${who(state, defender)} in the approaches of ${state.worlds[at].name}.`], outcome: null }
}

/**
 * One round: the defender's choice, then the fire it brings. Mutates the
 * ships and the encounter. A struck hull is handed over by `settle`.
 */
export function resolveRound(state: GameState, e: Encounter, choice: Choice): void {
  if (e.outcome) return
  const a = state.ships[e.attacker]
  const d = state.ships[e.defender]
  e.round += 1
  if (choice === 'strike') {
    e.log.push(`${who(state, d)} strikes.`)
    e.outcome = 'struck'
    return
  }
  if (choice === 'run') {
    if (getsAway(state, d, a)) {
      e.log.push(`${d.name} runs for the port and gets in under the guns.`)
      e.outcome = 'escaped'
      return
    }
    const hit = fire(state, a, d)
    d.damage += hit
    e.log.push(`${d.name} runs; ${a.name} closes and fires${hit ? `, ${hit} point${hit === 1 ? '' : 's'} told` : ' and misses'}.`)
  } else {
    const hitA = fire(state, d, a)
    const hitD = fire(state, a, d)
    a.damage += hitA
    d.damage += hitD
    e.log.push(`An exchange: ${d.name} ${hitA ? `hits ${a.name} for ${hitA}` : 'misses'}; ${a.name} ${hitD ? `hits ${d.name} for ${hitD}` : 'misses'}.`)
    if (!afloat(a)) {
      e.log.push(`${a.name} is knocked about and sheers off.`)
      e.outcome = 'driven_off'
      return
    }
  }
  if (!afloat(d)) {
    e.log.push(`${d.name} can fight no more and strikes.`)
    e.outcome = 'struck'
    return
  }
  if (e.round >= 2) {
    e.log.push(`${d.name} makes the port, knocked about.`)
    e.outcome = 'docked'
  }
}

/** What an NPC captain chooses when hailed: run if she is the faster, strike if hopelessly outgunned, else fight. */
export function npcChoice(state: GameState, e: Encounter): Choice {
  const a = state.ships[e.attacker]
  const d = state.ships[e.defender]
  const ga = SHIP_CLASSES[a.type].guns
  const gd = SHIP_CLASSES[d.type].guns
  if (SHIP_CLASSES[d.type].jump > SHIP_CLASSES[a.type].jump && e.round === 0) return 'run'
  if (ga >= 3 * Math.max(1, gd)) return e.round === 0 && roll(state.rng) >= 9 ? 'run' : 'strike'
  if (!afloat(d)) return 'strike'
  return 'fight'
}

/**
 * The end of an encounter made good: a hull that struck changes hands,
 * her captain is taken, her cargo is the captor's. Everything else just
 * docks. Returns a line for the port's news.
 */
export function settle(state: GameState, e: Encounter): string {
  const a = state.ships[e.attacker]
  const d = state.ships[e.defender]
  const at = e.at
  const week: Week = state.week
  const outcome: EncounterOutcome = e.outcome ?? 'docked'
  if (outcome !== 'struck') {
    d.lyingOff = false
    return outcome === 'driven_off' ? `${d.name} drove off ${a.name} in the approaches.` : outcome === 'escaped' ? `${d.name} ran in from ${a.name} under the guns.` : `${a.name} let ${d.name} pass.`
  }
  // Plunder: the hold and the purse aboard.
  for (const lot of d.hold) a.hold.push({ kind: 'cargo', good: lot.good, tons: lot.tons, paid: 0, from: at, week })
  d.hold = []
  const captor = a.captain ? state.characters[a.captain] : null
  const victim = d.captain ? state.characters[d.captain] : null
  if (victim) {
    // The cash aboard is the captor's; the rest is at home, and is what a ransom comes out of.
    if (captor && victim.purse > 0) {
      const aboard = Math.round(victim.purse / 2)
      captor.purse += aboard
      victim.purse -= aboard
    }
    victim.captive = { by: a.id, of: captor?.outlaw ? null : a.empire, since: week, at: null }
    victim.body = { kind: 'aboard', ship: a.id }
    if (!a.passengers.includes(victim.id)) a.passengers.push(victim.id)
  }
  // The hull: an outlaw keeps her; a navy sends her in as a prize to lie at the port until the court sits (phase 4).
  d.captain = null
  d.course = null
  d.lyingOff = false
  d.duty = null
  if (captor?.outlaw) {
    d.owner = { kind: 'personal', character: captor.id }
    d.empire = a.empire
  } else {
    d.owner = { kind: 'organisation', empire: a.empire, arm: 'navy' }
    d.empire = a.empire
  }
  d.location = { kind: 'world', world: at }
  return `${d.name} was taken in the approaches by ${a.name}${victim ? `; ${victim.name} is a prisoner` : ''}.`
}
