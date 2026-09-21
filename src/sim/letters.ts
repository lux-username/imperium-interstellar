/**
 * How a letter is headed. Every report carries a subject line and a lede —
 * one sentence with the most important news — composed here when it is
 * written, from what the writer chose to say and which side they are on.
 * The wording is standard for now; later it varies with the writer's
 * character, which is why it is decided in the sim and not at the desk.
 *
 * The wording of single events lives here too, so the sim and the inbox
 * say the same thing about the same event.
 */
import { hostile } from './factions'
import type { FactionId, GameState, ShipId, WorldId } from './types'
import { worldStateOf, type Event, type Snapshot, type Week, type WorldSnapshot, type WorldState } from './view'

/** What a letter is: the subject a reader scans and the sentence they read first. */
export interface Heading {
  subject: string
  lede: string
}

/** Why a letter is being written, where that changes how it is headed. */
export type Occasion =
  /** A governor's letter home: something to mention, or nothing for a while. */
  | 'letter'
  /** A governor answering the desk's request for a full report. */
  | 'requested'
  /** A captain making port. */
  | 'arrival'
  /** A scout's look at a world. */
  | 'look'
  /** A patrol's closing letter as she leaves station. */
  | 'patrol_done'
  /** Something happened here this week: a quick update on it. */
  | 'action'
  /** The rendezvous made: everything since the last orders. */
  | 'general'
  /** A scout's watch complete. */
  | 'watch'
  /** Notes from questioning prisoners. */
  | 'notes'

// ---------------------------------------------------------------------------
// Words

export const UNREST_WORDS = ['calm', 'uneasy', 'grumbling', 'grumbling', 'restive', 'restive', 'unruly', 'unruly', 'rioting', 'rioting', 'in revolt']

export function unrestWord(n: number): string {
  return UNREST_WORDS[Math.max(0, Math.min(10, n))]
}

const STATE_PHRASE: Record<WorldState, string> = {
  loyal: 'quiet',
  unrest: 'restless',
  revolt: 'in revolt',
  contested: 'under attack',
  independent: 'independent',
  warlord: "in the Warlord's hands",
}

export function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function uncapitalise(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1)
}

function stripStop(s: string): string {
  return s.replace(/[.!]$/, '')
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

/** "the pirates", "the Warlord's hulls", "the rebels": how a letter names the other side. */
function enemyName(state: GameState, faction: FactionId | null | undefined): string {
  const kind = faction ? state.factions[faction]?.kind : undefined
  switch (kind) {
    case 'pirates':
      return 'the pirates'
    case 'rival':
      return "the Warlord's hulls"
    case 'rebels':
      return 'the rebels'
    case 'administration':
      return "the administration's hulls"
    default:
      return 'hostile hulls'
  }
}

/** "Pirates", "Warlord", "Rebels": the other side for a subject line. */
function enemyWord(state: GameState, faction: FactionId | null | undefined): string {
  const kind = faction ? state.factions[faction]?.kind : undefined
  return kind === 'pirates' ? 'pirates' : kind === 'rival' ? 'the Warlord' : kind === 'rebels' ? 'rebels' : kind === 'administration' ? 'the administration' : 'hostile hulls'
}

/** How a world stands, for a lede: "ours and quiet", "in the Warlord's hands". */
function standing(state: GameState, world: WorldSnapshot, side: FactionId): string {
  const holder = state.factions[world.faction]?.kind
  const contestant = world.contest ? state.factions[world.contest.attacker]?.kind : undefined
  const s = worldStateOf(holder, world.contest, world.unrest, contestant)
  if (s === 'warlord' || s === 'independent') return STATE_PHRASE[s]
  const whose = world.faction === side ? 'ours' : hostile(world.faction, side) ? `${enemyWord(state, world.faction)}'s` : 'theirs'
  return s === 'loyal' ? `${whose} and ${unrestWord(world.unrest)}` : `${whose} and ${STATE_PHRASE[s]}`
}

// ---------------------------------------------------------------------------
// Single events, as a letter or a rumour would put them

/** A few words for an event, for a subject line. */
export function eventLabel(e: Event): string {
  switch (e.kind) {
    case 'unrest_rose':
      return `unrest up, now ${unrestWord(e.level ?? 0)}`
    case 'unrest_fell':
      return `unrest down, now ${unrestWord(e.level ?? 0)}`
    case 'governor_changed':
      return `new governor ${e.person ?? ''}`.trim()
    case 'hull_arrived':
      return `${e.ship?.name ?? 'a hull'} made port`
    case 'hull_departed':
      return `${e.ship?.name ?? 'a hull'} sailed`
    case 'dispatch_received':
      return 'your letter received'
    case 'revolt_began':
      return 'the world has risen'
    case 'revolt_crushed':
      return 'the rising put down'
    case 'world_fell':
      return 'the world is lost'
    case 'governor_fled':
      return `Governor ${e.person ?? ''} fled`.replace('  ', ' ')
    case 'governor_killed':
      return `Governor ${e.person ?? ''} killed`.replace('  ', ' ')
    case 'troops_landed':
      return `${plural(e.level ?? 0, 'detachment')} landed`
    case 'troops_lost':
      return `${plural(e.level ?? 0, 'detachment')} lost in cryo`
    case 'world_taken':
      return `the world taken by ${e.person ?? 'force'}`
    case 'landing_repulsed':
      return 'a landing thrown back'
    case 'battle':
      return `action against ${e.ship?.name ?? 'hostile hulls'}`
    case 'ship_fled':
      return `${e.ship?.name ?? 'a hull'} broke off`
    case 'ship_damaged':
      return `${e.ship?.name ?? 'a hull'} damaged`
    case 'ship_destroyed':
      return `${e.ship?.name ?? 'a hull'} destroyed`
    case 'ship_captured':
      return `${e.ship?.name ?? 'a hull'} taken`
    case 'ship_robbed':
      return `${e.ship?.name ?? 'a hull'} stopped and robbed`
    case 'pirate_seized':
      return `pirate ${e.ship?.name ?? ''} seized in port`.replace('  ', ' ')
    case 'defection':
      return `${e.ship?.name ?? 'a hull'} gone over to the Warlord`
    case 'appointment_made':
      return `${e.person ?? 'a new governor'} installed`
    case 'appointment_refused':
      return `${e.person ?? 'the incumbent'} refuses to go`
    case 'officer_took_command':
      return `${e.person ?? 'an officer'} took command of ${e.ship?.name ?? 'a prize'}`
    case 'haven_named':
      return `named as a pirate haven`
    case 'pirates_harboured':
      return `${plural(e.level ?? 1, 'pirate hull')} harboured in port`
  }
}

/** One sentence for an event, as a letter or a rumour would put it. */
export function eventText(e: Event): string {
  switch (e.kind) {
    case 'unrest_rose':
      return `Unrest has risen: the world is ${unrestWord(e.level ?? 0)}.`
    case 'unrest_fell':
      return `Unrest has eased: the world is ${unrestWord(e.level ?? 0)}.`
    case 'governor_changed':
      return `${e.person ?? 'A new governor'} now holds the seal.`
    case 'hull_arrived':
      return `${e.ship?.name ?? 'A hull'}${e.ship ? ` (${e.ship.role})` : ''} made port.`
    case 'hull_departed':
      return `${e.ship?.name ?? 'A hull'} sailed.`
    case 'dispatch_received':
      return 'Your dispatch was received.'
    case 'revolt_began':
      return 'The world has risen against us. The garrison holds the port and the palace and is fighting for both; send troops.'
    case 'revolt_crushed':
      return 'The rising has been put down. The garrison holds.'
    case 'world_fell':
      return 'The garrison is gone. The world has declared itself independent; the port is closed to us.'
    case 'governor_fled':
      return `Governor ${e.person ?? ''} got off to a ship in orbit as the palace fell.`.replace('  ', ' ')
    case 'governor_killed':
      return `Governor ${e.person ?? ''} was killed when the palace fell.`.replace('  ', ' ')
    case 'troops_landed':
      return `${plural(e.level ?? 0, 'detachment')} came down from ${e.ship?.name ?? 'a transport'}.`
    case 'troops_lost':
      return `${plural(e.level ?? 0, 'detachment')} did not wake from the passage aboard ${e.ship?.name ?? 'the transport'}.`
    case 'world_taken':
      return `The world is in the hands of ${e.person ?? 'the attackers'}.`
    case 'landing_repulsed':
      return 'A landing was thrown back; the garrison holds.'
    case 'battle':
      return `Action was fought here against ${e.ship?.name ?? 'hostile hulls'}${e.ship ? ` (${e.ship.role})` : ''}.`
    case 'ship_fled':
      return `${e.ship?.name ?? 'A hull'} broke off and jumped clear.`
    case 'ship_damaged':
      return `${e.ship?.name ?? 'A hull'} took damage.`
    case 'ship_destroyed':
      return `${e.ship?.name ?? 'A hull'} was destroyed.`
    case 'ship_captured':
      return `${e.ship?.name ?? 'A hull'} was taken as a prize.`
    case 'ship_robbed':
      return `${e.ship?.name ?? 'A hull'} was stopped and her mail bag taken. Everything aboard is lost.`
    case 'pirate_seized':
      return `The pirate ${e.ship?.name ?? ''} put in here and was seized by the port.`.replace('  ', ' ')
    case 'defection':
      return `${e.ship?.name ?? 'A hull'} has gone over to the Warlord with her officers.`
    case 'appointment_made':
      return `${e.person ?? 'The new governor'} has taken the seal.`
    case 'appointment_refused':
      return `${e.person ?? 'The incumbent'} has read the appointment and declines to hand over the seal.`
    case 'officer_took_command':
      return `${e.person ?? 'An officer'} has taken command of ${e.ship?.name ?? 'the prize'}.`
    case 'haven_named':
      return `Under questioning, ${e.person ?? 'the prisoners'} named this world as a haven where pirates put in.`
    case 'pirates_harboured':
      return `${e.ship?.name ? `The pirate ${e.ship.name}` : 'A pirate hull'}${(e.level ?? 1) > 1 ? ` and ${plural((e.level ?? 1) - 1, 'other')}` : ''} lay docked at the port unmolested; ${e.person ? `Governor ${e.person}` : 'the port'} made no move to seize ${(e.level ?? 1) > 1 ? 'them' : 'her'}.`
  }
}

// ---------------------------------------------------------------------------
// The lead: the one thing a letter is about

/** Serious first; among equals, the latest. Battles outrank the hulls lost in them, which are told by the outcome. */
function weight(e: Event): number {
  return e.kind === 'battle' ? e.severity + 0.5 : e.severity
}

/** The event a letter leads with, if it mentions any. */
export function leadEvent(events: readonly Event[]): Event | null {
  let lead: Event | null = null
  for (const e of events) if (!lead || weight(e) >= weight(lead)) lead = e
  return lead
}

/** Hulls the writer's side lost or that broke off in the letter's telling, and the other side's. */
function tally(events: readonly Event[], side: FactionId) {
  const lost = (e: Event) => e.kind === 'ship_destroyed' || e.kind === 'ship_captured' || e.kind === 'ship_robbed'
  const ours = events.filter((e) => lost(e) && e.against === side).length
  const theirs = events.filter((e) => lost(e) && e.against !== null && e.against !== side && hostile(e.against, side)).length
  const fled = events.filter((e) => e.kind === 'ship_fled' && e.against === side).length
  return { ours, theirs, fled }
}

/**
 * How an action reads to one side of it: from the hulls the letter says
 * were lost or broke off. `own` is the writer's hull if they were in it.
 */
function battleHeading(state: GameState, e: Event, events: readonly Event[], side: FactionId, own: ShipId | null): Heading {
  const enemy = e.ship?.faction
  const them = enemyName(state, enemy)
  const word = enemyWord(state, enemy)
  const involved = enemy !== undefined && hostile(enemy, side)
  if (!involved) return { subject: 'Battle in orbit', lede: `Action was fought in orbit against ${them}.` }
  const t = tally(events, side)
  if (own && events.some((x) => x.kind === 'ship_fled' && x.ship?.id === own)) return { subject: `Defeated by ${word}`, lede: `${capitalise(them)} outnumbered us and I broke off.` }
  if (t.ours > 0 && t.theirs === 0) return { subject: `Defeated by ${word}`, lede: own ? `We were beaten by ${them}; ${plural(t.ours, 'hull')} lost.` : `Our forces in orbit were beaten by ${them}.` }
  if (t.theirs > 0 && t.ours === 0) return { subject: `Victory over ${word}`, lede: own ? `We engaged ${them} and had the better of it; ${plural(t.theirs, 'hull')} of theirs lost.` : `Our forces in orbit had the better of ${them}.` }
  if (t.ours === 0 && t.theirs === 0 && t.fled > 0) return { subject: `Retreat from ${word}`, lede: own ? `We met ${them} and broke off.` : `Our forces broke off from ${them}.` }
  return { subject: `Battle against ${word}`, lede: own ? `We engaged ${them}; the action was indecisive.` : `Action was fought in orbit against ${them}; the result was indecisive.` }
}

/**
 * How one event is headed from the writer's side. Most events read the
 * same from any side and take the standard wording; the ones with a
 * winner and a loser are told from the writer's.
 */
export function eventHeading(state: GameState, e: Event, events: readonly Event[], side: FactionId, own: ShipId | null): Heading {
  const mine = own !== null && e.ship?.id === own
  const forUs = e.favours === side
  switch (e.kind) {
    case 'battle':
      return battleHeading(state, e, events, side, own)
    case 'hull_arrived': {
      const foreign = e.ship && hostile(e.ship.faction, side)
      if (!foreign) return { subject: `${e.ship?.name ?? 'A hull'} made port`, lede: eventText(e) }
      const n = events.filter((x) => x.kind === 'hull_arrived' && x.ship && x.ship.faction === e.ship?.faction).length
      const word = enemyWord(state, e.ship?.faction)
      return { subject: `${capitalise(word)} sighted!`, lede: `${capitalise(plural(n, `${word === 'pirates' ? 'pirate' : word} hull`))} ${n === 1 ? 'was' : 'were'} sighted in the system.` }
    }
    case 'revolt_began':
      return { subject: 'The world has risen!', lede: 'The world has risen against us; the garrison is fighting for the port and the palace.' }
    case 'revolt_crushed':
      return { subject: 'Rising put down', lede: 'The rising has been put down; the garrison holds.' }
    case 'world_fell':
      return { subject: 'The world is lost', lede: 'The garrison is gone and the world has declared itself independent.' }
    case 'world_taken':
      return forUs ? { subject: 'The world is ours', lede: 'The world is in our hands.' } : { subject: 'The world is lost', lede: `The world is in the hands of ${e.person ?? 'the attackers'}.` }
    case 'troops_landed':
      if (mine) return { subject: 'Troops landed', lede: `We put ${plural(e.level ?? 0, 'detachment')} down on the world.` }
      if (forUs) return { subject: 'Reinforcements landed', lede: `${capitalise(plural(e.level ?? 0, 'detachment'))} came down from ${e.ship?.name ?? 'a transport'}.` }
      return { subject: 'Enemy landing!', lede: `${capitalise(plural(e.level ?? 0, 'detachment'))} of ${enemyWord(state, e.favours)} came down on the world.` }
    case 'landing_repulsed':
      return forUs ? { subject: 'Landing thrown back', lede: 'A landing was thrown back; the garrison holds.' } : { subject: 'Landing repulsed', lede: 'Our landing was thrown back.' }
    case 'troops_lost':
      return { subject: 'Losses in cryo', lede: mine ? `${capitalise(plural(e.level ?? 0, 'detachment'))} did not wake from the passage.` : eventText(e) }
    case 'ship_fled':
      return mine ? { subject: `Evaded ${enemyWord(state, e.favours ?? null)}`, lede: 'We got clear without an action.' } : { subject: `${e.ship?.name ?? 'A hull'} broke off`, lede: eventText(e) }
    case 'ship_damaged':
      return mine ? { subject: 'Damage taken', lede: 'We took damage in the action.' } : { subject: `${e.ship?.name ?? 'A hull'} damaged`, lede: eventText(e) }
    case 'ship_captured':
      return forUs ? { subject: 'Prize taken', lede: `${e.ship?.name ?? 'A hull'} was taken as a prize.` } : { subject: `${e.ship?.name ?? 'A hull'} taken`, lede: eventText(e) }
    case 'ship_destroyed':
      return forUs ? { subject: 'Enemy hull destroyed', lede: eventText(e) } : { subject: `${e.ship?.name ?? 'A hull'} destroyed`, lede: eventText(e) }
    case 'ship_robbed':
      return { subject: `${e.ship?.name ?? 'A hull'} robbed`, lede: eventText(e) }
    case 'governor_fled':
      return { subject: 'Governor fled', lede: eventText(e) }
    case 'governor_killed':
      return { subject: 'Governor killed', lede: eventText(e) }
    case 'governor_changed':
      return { subject: 'New governor', lede: eventText(e) }
    case 'unrest_rose':
      return { subject: 'Unrest rising', lede: eventText(e) }
    case 'unrest_fell':
      return { subject: 'Unrest easing', lede: eventText(e) }
    case 'pirate_seized':
      return { subject: 'Pirate seized in port', lede: eventText(e) }
    case 'defection':
      return { subject: `${e.ship?.name ?? 'A hull'} defected`, lede: eventText(e) }
    case 'appointment_made':
      return { subject: 'New governor installed', lede: eventText(e) }
    case 'appointment_refused':
      return { subject: 'Appointment refused!', lede: eventText(e) }
    case 'officer_took_command':
      return { subject: 'Prize under command', lede: eventText(e) }
    case 'haven_named':
      return { subject: 'Pirate haven named', lede: eventText(e) }
    case 'pirates_harboured':
      return { subject: 'Pirates harboured in port!', lede: `${e.person ? `Governor ${e.person} harbours pirates` : 'The port harbours pirates'}: ${uncapitalise(eventText(e))}` }
    case 'dispatch_received':
      return { subject: 'Your letter received', lede: eventText(e) }
    case 'hull_departed':
      return { subject: capitalise(eventLabel(e)), lede: eventText(e) }
  }
}

// ---------------------------------------------------------------------------
// Whole letters

export interface Letter {
  /** The writer's side. */
  side: FactionId
  /** The hull the writer commands, if they write from one. */
  ship: ShipId | null
  at: WorldId
  week: Week
  snapshot: Snapshot
  events: readonly Event[]
  occasion: Occasion
  /** For a general report: when the orders it covers were read. */
  since?: Week
}

/** "Pirates sighted!" from what lies in port, if anything hostile does. */
function sightingInPort(state: GameState, snapshot: Snapshot, side: FactionId): Heading | null {
  if (snapshot.kind !== 'world') return null
  const seen = snapshot.world.ships.filter((s) => hostile(s.faction, side))
  if (seen.length === 0) return null
  const faction = seen[0].faction
  const n = seen.filter((s) => s.faction === faction).length
  const word = enemyWord(state, faction)
  return { subject: `${capitalise(word)} sighted!`, lede: `${capitalise(plural(n, `${word === 'pirates' ? 'pirate' : word} hull`))} ${n === 1 ? 'lies' : 'lie'} at ${snapshot.world.name}.` }
}

/** A governor's letter with nothing to lead with. */
function governorQuiet(letter: Letter): Heading {
  const w = letter.snapshot.kind === 'world' ? letter.snapshot.world : null
  const asked = letter.occasion === 'requested'
  if (w?.contest) return { subject: asked ? 'Report as requested: fighting continues' : 'Fighting continues', lede: 'The garrison is still fighting for the port and the palace.' }
  if (w && w.unrest >= 6) return { subject: asked ? 'Report as requested: unrest continues' : 'Unrest continues', lede: `The world is ${unrestWord(w.unrest)}.` }
  return { subject: asked ? 'Report as requested: all quiet' : 'All quiet', lede: asked ? 'Your letter was received; the world is quiet.' : 'The world is quiet.' }
}

/** A captain's letter with nothing to lead with: where she is and what she sees. */
function captainQuiet(state: GameState, letter: Letter): Heading {
  const name = state.worlds[letter.at]?.name ?? 'the world'
  const w = letter.snapshot.kind === 'world' ? letter.snapshot.world : null
  const sighting = sightingInPort(state, letter.snapshot, letter.side)
  if (sighting) return sighting
  switch (letter.occasion) {
    case 'look':
      return { subject: `Looked in at ${name}`, lede: w ? `We looked in at ${name}; the world is ${standing(state, w, letter.side)}.` : `We looked in at ${name}.` }
    case 'patrol_done':
      return { subject: `Patrol of ${name} complete`, lede: `Our patrol of ${name} is complete; we are making for the rendezvous.` }
    default:
      return { subject: `Arrived at ${name}`, lede: w ? `We have made port at ${name}; the world is ${standing(state, w, letter.side)}.` : `We have made port at ${name}.` }
  }
}

/**
 * The heading for a letter. A letter with news leads with the worst of
 * it; one without says where things stand. A general report and a watch
 * report sum up a span of weeks and say so.
 */
export function heading(state: GameState, letter: Letter): Heading {
  const lead = leadEvent(letter.events)
  const own = letter.ship
  const at = state.worlds[letter.at]?.name ?? 'the world'
  const where = (e: Event) => `${state.worlds[e.at]?.name ?? 'a world'}${e.at === letter.at && e.week === letter.week ? '' : `, wk ${e.week}`}`
  switch (letter.occasion) {
    case 'general': {
      const since = letter.since !== undefined ? `since your orders of wk ${letter.since}` : 'since our last orders'
      if (!lead) return { subject: 'General report: nothing to report', lede: `We have made the rendezvous at ${at}; nothing of note has happened ${since}.` }
      const h = eventHeading(state, lead, letter.events, letter.side, own)
      return { subject: `General report: ${uncapitalise(h.subject)}`, lede: `We have made the rendezvous at ${at}; the most serious news ${since} is that ${uncapitalise(stripStop(h.lede))} (${where(lead)}).` }
    }
    case 'watch': {
      const n = letter.events.length
      const from = letter.since ?? letter.week
      const span = `We lay off ${at} from wk ${from} to wk ${letter.week}`
      if (!lead) return { subject: `Watch of ${at}: nothing seen`, lede: `${span} and saw nothing of note.` }
      const h = eventHeading(state, lead, letter.events, letter.side, own)
      return { subject: `Watch of ${at}: ${uncapitalise(h.subject)}`, lede: `${span}; ${plural(n, 'thing')} seen, the most serious that ${uncapitalise(stripStop(h.lede))} (wk ${lead.week}).` }
    }
    case 'notes': {
      const ship = letter.snapshot.kind === 'ship' ? letter.snapshot.ship.name : 'a prize'
      const n = letter.events.filter((e) => e.kind === 'haven_named').length
      return { subject: 'Prisoners questioned', lede: n > 0 ? `The crew of ${ship} named ${plural(n, 'haven')} under questioning.` : `The crew of ${ship} were questioned and named nothing.` }
    }
    default:
      break
  }
  if (lead) {
    const h = eventHeading(state, lead, letter.events, letter.side, own)
    const rest = letter.events.length - 1
    return rest > 0 ? { subject: `${h.subject} (+${rest})`, lede: h.lede } : h
  }
  return own !== null ? captainQuiet(state, letter) : governorQuiet(letter)
}
