/**
 * Events: the unit of news. Something happens at a world on a week and the
 * sim records it here as ground truth. Nothing reaches the player except
 * through a report that mentions one — a governor's letter carries the
 * events they chose to mention, a rumour is a degraded copy of one, and
 * later the Council's picture is a fold over the ones that reached it.
 *
 * The record is deliberately snapshot-safe (names and ids, no references),
 * so a report can carry a copy of it unchanged; see Event in ./view.ts.
 */
import type { EventId, FactionId, GameState, Ship, WorldId } from './types'
import type { Event, EventKind, Valence } from './view'
import { hostile } from './factions'
import { snapshotShip } from './mail'

/** Events older than this are forgotten by the sim. Long enough for the slowest routine letter and any rumour still travelling. */
export const EVENT_MEMORY = 26

interface Draft {
  kind: EventKind
  /** The bystander's reading. */
  valence: Valence
  against?: FactionId | null
  favours?: FactionId | null
  severity: number
  ship?: Ship
  person?: string | null
  level?: number | null
}

/**
 * How an event reads to someone of `faction`: bad if it went against them
 * or favoured an enemy, good if it favoured them or went against an
 * enemy, and otherwise as it reads to anyone. This is what a governor
 * weighs before writing home, and what the docks pass on — so the
 * Warlord's people see his losses as losses and yours as good news.
 */
export function valenceFor(event: Pick<Event, 'valence' | 'against' | 'favours'>, faction: FactionId): Valence {
  if (event.against === faction) return 'bad'
  if (event.favours === faction) return 'good'
  if (event.against && hostile(event.against, faction)) return 'good'
  if (event.favours && hostile(event.favours, faction)) return 'bad'
  return event.valence
}

/** Record that something happened at `at` this week. Returns the event. */
export function recordEvent(state: GameState, at: WorldId, draft: Draft): Event {
  const id = `e-${state.nextId}` as EventId
  state.nextId += 1
  const event: Event = {
    id,
    at,
    week: state.week,
    kind: draft.kind,
    valence: draft.valence,
    against: draft.against ?? null,
    favours: draft.favours ?? null,
    severity: draft.severity,
    ship: draft.ship ? snapshotShip(draft.ship, at) : null,
    person: draft.person ?? null,
    level: draft.level ?? null,
  }
  state.events[id] = event
  return event
}

/** Everything that happened at a world in a range of weeks, oldest first. */
export function eventsAt(state: GameState, at: WorldId, from: number, to: number): Event[] {
  return Object.values(state.events)
    .filter((e) => e.at === at && e.week >= from && e.week <= to)
    .sort((a, b) => a.week - b.week || (a.id < b.id ? -1 : 1))
}

/** Forget events nobody could still be talking about. */
export function forgetOldEvents(state: GameState): void {
  for (const e of Object.values(state.events)) {
    if (e.week < state.week - EVENT_MEMORY) delete state.events[e.id]
  }
}

// ---------------------------------------------------------------------------
// The events the week emits

/** The three moods a world can be in, as far as anyone writes home about. */
export type UnrestBand = 'content' | 'neutral' | 'hostile'

export function unrestBand(level: number): UnrestBand {
  return level <= 1 ? 'content' : level <= 5 ? 'neutral' : 'hostile'
}

/**
 * Whether a step in unrest is news. A world drifting a point within its
 * mood is not; crossing from one mood to another is, and so is reaching
 * either end of the scale — settled at last, or in open revolt.
 */
export function unrestCrossed(before: number, after: number): boolean {
  if (before === after) return false
  if (unrestBand(before) !== unrestBand(after)) return true
  return after === 0 || after === 10
}

/**
 * Whether this particular step is news here and now. A change of mood
 * always is. Reaching an end of the scale is news once: a world settling
 * to nothing, drifting to one and settling again is not two pieces of news,
 * so an extreme already reported as the last unrest event is not repeated.
 */
export function unrestIsNews(state: GameState, at: WorldId, before: number, after: number): boolean {
  if (!unrestCrossed(before, after)) return false
  if (unrestBand(before) !== unrestBand(after)) return true
  const last = eventsAt(state, at, state.week - EVENT_MEMORY, state.week)
    .filter((e) => e.kind === 'unrest_rose' || e.kind === 'unrest_fell')
    .pop()
  return last?.level !== after
}

/** Unrest crossed a threshold. Rising is bad news for whoever holds the world, and gets worse as it climbs; falling is good for them. */
export function unrestEvent(state: GameState, at: WorldId, level: number, rose: boolean): Event {
  const severity = rose ? (level >= 10 ? 3 : unrestBand(level) === 'hostile' ? 2 : 1) : 1
  const holder = state.worlds[at]?.faction ?? null
  return recordEvent(state, at, { kind: rose ? 'unrest_rose' : 'unrest_fell', valence: 'neutral', against: rose ? holder : null, favours: rose ? null : holder, severity, level })
}

/** A new governor holds the seal. Neutral, but a new governor always introduces themselves. */
export function governorChangedEvent(state: GameState, at: WorldId, name: string): Event {
  return recordEvent(state, at, { kind: 'governor_changed', valence: 'neutral', severity: 1, person: name })
}

/** A hull made port. Routine traffic is neutral; a hull of another faction is unwelcome news for whoever holds the port. */
export function hullArrivedEvent(state: GameState, at: WorldId, ship: Ship): Event {
  const holder = state.worlds[at]?.faction ?? null
  const foreign = holder !== null && ship.faction !== holder
  return recordEvent(state, at, { kind: 'hull_arrived', valence: 'neutral', against: foreign ? holder : null, severity: foreign ? 2 : 0, ship })
}

export function hullDepartedEvent(state: GameState, at: WorldId, ship: Ship): Event {
  return recordEvent(state, at, { kind: 'hull_departed', valence: 'neutral', severity: 0, ship })
}

/** Mail from the Home Office was opened here. */
export function dispatchReceivedEvent(state: GameState, at: WorldId): Event {
  return recordEvent(state, at, { kind: 'dispatch_received', valence: 'neutral', severity: 0 })
}
