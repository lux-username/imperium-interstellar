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
import { deal, impressed, regardOf, rollTraits, traitsOf } from './people'
import { personName, rollSex } from './names'
import { roll } from './rng'
import { SHIP_CLASSES, stanceKey, type Character, type CharacterId, type Encounter, type EncounterOutcome, type GameState, type Ship, type ShipId, type Week, type WorldId } from './types'

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
  // A robber: a captain lying off on the raid, or one whose standing is already burned.
  if (h && (hunter.duty?.kind === 'raid' || h.outlaw)) {
    if (prey.duty?.kind === 'patrol') return false
    if (SHIP_CLASSES[prey.type].guns > SHIP_CLASSES[hunter.type].guns) return false
    if (!p) return true
    const regard = regardOf(state, h.id, p.id)
    // Never a friend; an enemy gladly; a countryman only with reluctance.
    if (regard >= 1) return false
    if (regard <= -1) return true
    // A countryman: only a captain of slight loyalty will, and not a guild-fellow.
    if (p.empire === h.empire) return traitsOf(h).loyalty <= 0.5 && !(h.guild && h.guild === p.guild)
    return true
  }
  // A navy hull takes an outlaw, and a hull lying off on the raid whoever she is.
  if (hunter.duty?.kind === 'patrol' && (p?.outlaw || prey.duty?.kind === 'raid')) return true
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
  return { attacker: attacker.id, defender: defender.id, at, round: 0, log: [`${who(state, attacker)} hails ${who(state, defender)} in the approaches of ${state.worlds[at].name}.`], outcome: null, ally: null }
}

/**
 * Hulls at the port that could stand with the defender: armed, in the
 * approaches this week or lying off, not scouts, not the attacker, with
 * a captain, of any empire. Whether they will is another matter.
 */
export function possibleAllies(state: GameState, e: Encounter): Ship[] {
  return (Object.keys(state.ships).sort() as ShipId[])
    .map((id) => state.ships[id])
    .filter((s) => s.id !== e.attacker && s.id !== e.defender && s.captain && s.type !== 'scout' && SHIP_CLASSES[s.type].guns > 0 && s.location.kind === 'world' && s.location.world === e.at && s.docked >= state.week - 1 && !state.characters[s.captain]?.captive)
}

/**
 * Whether a captain will stand with the defender: a friend will, whatever
 * flag either flies; a stranger of bold temper will if the odds are fair
 * and their empires are not at war as the port knows it; an enemy will
 * not; nobody stands with an outlaw, and an outlaw stands with nobody.
 */
export function willStand(state: GameState, ally: Ship, e: Encounter): boolean {
  const d = state.ships[e.defender]
  const a = state.ships[e.attacker]
  if (!ally.captain || !d.captain) return false
  if (state.characters[d.captain]?.outlaw || state.characters[ally.captain]?.outlaw) return false
  const regard = regardOf(state, ally.captain, d.captain)
  if (regard >= 1) return true
  if (regard <= -1) return false
  const port = state.worlds[e.at]
  if (ally.empire !== d.empire && port.board[stanceKey(ally.empire, d.empire)]?.stance === 'war') return false
  const t = traitsOf(state.characters[ally.captain])
  const odds = (SHIP_CLASSES[ally.type].guns + SHIP_CLASSES[d.type].guns) / Math.max(1, SHIP_CLASSES[a.type].guns)
  return t.caution <= 0.4 && odds >= 0.8
}

/** An ally joins: her guns fire beside the defender's from the next round. */
export function joinEncounter(state: GameState, e: Encounter, ally: Ship): void {
  e.ally = ally.id
  e.log.push(`${who(state, ally)} stands with ${state.ships[e.defender].name}.`)
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
    const ally = e.ally ? state.ships[e.ally] : null
    const hitA = fire(state, d, a) + (ally ? fire(state, ally, a) : 0)
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
  const caution = traitsOf(d.captain ? state.characters[d.captain] : undefined).caution
  if (SHIP_CLASSES[d.type].jump > SHIP_CLASSES[a.type].jump && e.round === 0) return 'run'
  // A careful captain strikes at two to one; a bold one not before four.
  const odds = 2 + 2 * (1 - caution)
  if (ga >= odds * Math.max(1, gd)) return e.round === 0 && roll(state.rng) >= 9 - Math.round(2 * caution) ? 'run' : 'strike'
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
  if (e.ally && outcome !== 'struck') {
    const ally = state.ships[e.ally]
    if (ally?.captain && d.captain) {
      const line = `we fought off the ${a.name} together off ${state.worlds[at].name}`
      deal(state, d.captain, ally.captain, 1, line, 'stood_together')
      deal(state, ally.captain, d.captain, 0.7, line, 'stood_together')
      for (const c of Object.keys(state.characters).sort() as CharacterId[]) {
        if (c === ally.captain || c === d.captain) continue
        if (state.characters[c].body.kind === 'aboard' && state.ships[state.characters[c].body.ship]?.location.kind === 'world' && (state.ships[state.characters[c].body.ship].location as { world: WorldId }).world === at) impressed(state, c, ally.captain, 0.5, `saw ${state.characters[ally.captain].name} stand with ${state.characters[d.captain].name} against the ${a.name}`)
      }
    }
  }
  if (outcome !== 'struck') {
    d.lyingOff = false
    return outcome === 'driven_off' ? `${d.name} drove off ${a.name} in the approaches.` : outcome === 'escaped' ? `${d.name} ran in from ${a.name} under the guns.` : `${a.name} let ${d.name} pass.`
  }
  const captor = a.captain ? state.characters[a.captain] : null
  const victim = d.captain ? state.characters[d.captain] : null
  const captorHasMarque = !!(captor?.marque && captor.marque.empire === a.empire)
  const victimIsFairGame = !!victim?.outlaw || (victim !== null && captor !== null && victim.empire !== captor.empire && state.worlds[at].board[stanceKey(victim.empire, captor.empire)]?.stance === 'war')
  // Lawful: a navy hull, or a private captain under her empire's letter of marque taking an outlaw or an enemy at war.
  const lawful = a.duty?.kind === 'patrol' || (captorHasMarque && victimIsFairGame)
  const where = state.worlds[at].name
  // A robber who cannot use a bulk freighter robs her: the strongbox, and all the cargo she can carry, and lets her go.
  if (!lawful && d.type === 'bulk_freighter') {
    if (captor) captor.purse += d.strongbox
    d.strongbox = 0
    let room = SHIP_CLASSES[a.type].hold - a.hold.reduce((t, l) => t + l.tons, 0)
    for (const lot of [...d.hold]) {
      if (room <= 0) break
      const tons = Math.min(room, lot.tons)
      a.hold.push({ kind: 'cargo', good: lot.good, tons, paid: 0, from: at, week })
      lot.tons -= tons
      room -= tons
    }
    d.hold = d.hold.filter((l) => l.tons > 0)
    d.lyingOff = false
    if (victim && captor) {
      deal(state, victim.id, captor.id, -2, `${captor.name} robbed the ${d.name} off ${where}`, 'robbed')
      if (captor.id !== state.player) captor.outlaw = true
    }
    return `${d.name} was robbed in the approaches by ${a.name} and let go.`
  }
  // Plunder: the strongbox and the cash aboard. A navy takes no cargo: it stays on the prize for the court.
  if (d.strongbox > 0) {
    if (lawful) a.strongbox += d.strongbox
    else if (captor) captor.purse += d.strongbox
    d.strongbox = 0
  }
  if (victim && captor) {
    deal(state, victim.id, captor.id, -3, `${captor.name} took the ${d.name} from me off ${where}`, 'robbed')
    deal(state, captor.id, victim.id, 0.2, `took ${victim.name}'s ${d.name} off ${where}`, 'other')
  }
  if (captor && !lawful && captor.id !== state.player) captor.outlaw = true
  if (victim) {
    if (captor && victim.purse > 0) {
      const aboard = Math.round(victim.purse / 2)
      captor.purse += aboard
      victim.purse -= aboard
    }
    victim.captive = { by: a.id, of: captor?.outlaw ? null : a.empire, since: week, at: null }
    victim.body = { kind: 'aboard', ship: a.id }
    if (!a.passengers.includes(victim.id)) a.passengers.push(victim.id)
  }
  d.captain = null
  d.course = null
  d.lyingOff = false
  d.duty = null
  d.location = { kind: 'world', world: at }
  if (lawful) {
    // A prize crew sails her to the captor's seat, where the court will sell her.
    d.owner = { kind: 'organisation', empire: a.empire, arm: 'navy' }
    d.empire = a.empire
    d.duty = { kind: 'prize', to: state.empires[a.empire].seat, taker: a.empire, captor: a.duty?.kind === 'patrol' ? null : (captor?.id ?? null) }
    return `${d.name} was taken in the approaches by ${a.name} and sent in as a prize${victim ? `; ${victim.name} is a prisoner` : ''}.`
  }
  // A robber takes a hull she can sail. If it is the better hull she moves into it and gives her old one to a loyal crewman; else the crewman has the prize.
  if (!captor) return `${d.name} was taken in the approaches by ${a.name}.`
  const better = SHIP_CLASSES[d.type].guns > SHIP_CLASSES[a.type].guns || (SHIP_CLASSES[d.type].guns === SHIP_CLASSES[a.type].guns && SHIP_CLASSES[d.type].hold > SHIP_CLASSES[a.type].hold)
  const mate = promote(state, captor, a)
  const old = a
  if (better) {
    // The captor shifts her flag: cargo across as far as it fits, prisoners and purse with her.
    for (const lot of [...old.hold]) {
      const room = SHIP_CLASSES[d.type].hold - d.hold.reduce((t, l) => t + l.tons, 0)
      if (room <= 0) break
      const tons = Math.min(room, lot.tons)
      d.hold.push({ ...lot, tons })
      lot.tons -= tons
    }
    old.hold = old.hold.filter((l) => l.tons > 0)
    d.passengers = [...old.passengers]
    old.passengers = []
    for (const p of d.passengers) {
      const c = state.characters[p]
      if (c) {
        c.body = { kind: 'aboard', ship: d.id }
        if (c.captive && c.captive.by === old.id) c.captive.by = d.id
      }
    }
    d.captain = captor.id
    d.owner = { kind: 'personal', character: captor.id }
    d.empire = captor.empire
    d.duty = old.duty
    d.lyingOff = old.lyingOff
    captor.body = { kind: 'aboard', ship: d.id }
    giveHull(state, old, mate, captor)
    return `${d.name} was taken in the approaches by ${a.name}; ${captor.name} has shifted into her${victim ? `, and ${victim.name} is a prisoner` : ''}.`
  }
  giveHull(state, d, mate, captor)
  return `${d.name} was taken in the approaches by ${a.name}${victim ? `; ${victim.name} is a prisoner` : ''}.`
}

/** A loyal crewman promoted to command: a new person of the captor's empire and culture, an outlaw with her, who owes her everything. */
function promote(state: GameState, captor: Character, aboard: Ship): Character {
  const id = `c-mate-${state.nextId++}` as CharacterId
  const culture = captor.culture
  const sex = rollSex(state.rng)
  const t = rollTraits(state.rng)
  const mate: Character = {
    id,
    name: personName(state.rng, culture, sex),
    culture,
    sex,
    empire: captor.empire,
    body: { kind: 'aboard', ship: aboard.id },
    purse: 2000,
    debt: null,
    outlaw: true,
    traits: { ...t, greed: Math.max(t.greed, 0.5), caution: Math.min(t.caution, 0.5), loyalty: Math.max(t.loyalty, 0.6) },
  }
  state.characters[id] = mate
  deal(state, id, captor.id, 2.5, `${captor.name} gave me my first command`, 'other')
  deal(state, captor.id, id, 1, `gave ${mate.name} the command`, 'other')
  return mate
}

/** A hull given to a promoted mate: hers now, on the raid with her captain's haven. */
function giveHull(state: GameState, hull: Ship, mate: Character, captor: Character): void {
  hull.captain = mate.id
  hull.owner = { kind: 'personal', character: mate.id }
  hull.empire = captor.empire
  hull.course = null
  hull.lyingOff = false
  const haven = captor.body.kind === 'aboard' ? (state.ships[captor.body.ship]?.duty as { haven?: WorldId } | null)?.haven : undefined
  hull.duty = { kind: 'raid', haven: haven ?? (hull.location.kind === 'world' ? hull.location.world : state.empires[captor.empire].seat), until: state.week + 2, since: state.week }
  mate.body = { kind: 'aboard', ship: hull.id }
}

