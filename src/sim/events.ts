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
import type { EventId, GameState, Ship, WorldId } from './types'
import type { Event, EventKind, Valence } from './view'
import { snapshotShip } from './mail'

/** Events older than this are forgotten by the sim. Long enough for the slowest routine letter and any rumour still travelling. */
export const EVENT_MEMORY = 26

interface Draft {
  kind: EventKind
  valence: Valence
  severity: number
  ship?: Ship
  person?: string | null
  level?: number | null
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

/** Unrest moved a step. Rising unrest is bad news that gets worse as it climbs; falling is good. */
export function unrestEvent(state: GameState, at: WorldId, level: number, rose: boolean): Event {
  const severity = rose ? (level >= 8 ? 3 : level >= 6 ? 2 : 1) : 1
  return recordEvent(state, at, { kind: rose ? 'unrest_rose' : 'unrest_fell', valence: rose ? 'bad' : 'good', severity, level })
}

/** A new governor holds the seal. Neutral, but a new governor always introduces themselves. */
export function governorChangedEvent(state: GameState, at: WorldId, name: string): Event {
  return recordEvent(state, at, { kind: 'governor_changed', valence: 'neutral', severity: 1, person: name })
}

/** A hull made port. Routine traffic is neutral; a hull of another faction is worth a letter. */
export function hullArrivedEvent(state: GameState, at: WorldId, ship: Ship): Event {
  const foreign = ship.faction !== state.worlds[at]?.faction
  return recordEvent(state, at, { kind: 'hull_arrived', valence: foreign ? 'bad' : 'neutral', severity: foreign ? 2 : 0, ship })
}

export function hullDepartedEvent(state: GameState, at: WorldId, ship: Ship): Event {
  return recordEvent(state, at, { kind: 'hull_departed', valence: 'neutral', severity: 0, ship })
}

/** Mail from the desk was opened here. */
export function dispatchReceivedEvent(state: GameState, at: WorldId): Event {
  return recordEvent(state, at, { kind: 'dispatch_received', valence: 'neutral', severity: 0 })
}
