/**
 * Rumour: merchants carry news along the lanes. An event at a port has a
 * chance of becoming talk; the talk hops lane to lane with commercial
 * traffic, slower than the packets, and reaches every port in time. What
 * arrives is a degraded copy of the event — the week and even the world
 * may be off — on the `merchant` channel if it came nearly first-hand and
 * `docks` if it has been through several mouths.
 *
 * A rumour is delivered to whoever reads reports at a world it reaches:
 * the desk at the capital now, the Warlord's and the Council's seats later.
 * The docks have no preference: good news and bad become talk alike.
 */
import { neighbours } from './chart'
import { EVENT_MEMORY, valenceFor } from './events'
import { capitalise, eventLabel, eventText } from './letters'
import { deliverDirect } from './mail'
import { personName, rollSex } from './names'
import { raided } from './pirates'
import { check, nextInt } from './rng'
import type { CharacterId, GameState, ReportId, Week, WorldId } from './types'
import type { Event, Report } from './view'

/** Nobody in particular: the observer of a rumour that came off the docks. */
export const THE_DOCKS = 'c-docks' as CharacterId

export interface Rumour {
  /** The event as it is being told, which may differ from what happened. */
  event: Event
  /** Where it started. */
  origin: WorldId
  born: Week
  /** Every world where it is being talked about, and how many hops it took to get there. */
  heard: Record<WorldId, number>
}

function hasPort(state: GameState, at: WorldId): boolean {
  const port = state.worlds[at]?.profile.starport
  return port === 'A' || port === 'B' || port === 'C'
}

/**
 * A copy of an event as talk would have it: mostly right, sometimes said
 * to be a week or two older than it was, now and then pinned on the wrong
 * world. Never newer: nothing is heard of before it happens.
 */
function degrade(state: GameState, event: Event): Event {
  const copy = JSON.parse(JSON.stringify(event)) as Event
  if (check(state.rng, 9)) copy.week -= nextInt(state.rng, 0, 2)
  if (check(state.rng, 11)) {
    // Never the capital: the desk sees that for itself, and talk about it would only confuse.
    const near = neighbours(state.lanes, event.at).filter((w) => w !== state.capital)
    if (near.length > 0) copy.at = near[nextInt(state.rng, 0, near.length - 1)]
  }
  return copy
}

/**
 * The 2d6 target for an event to become talk, by how interesting it is:
 * its severity. A world risen or lost, a hull sunk (3) is told nearly
 * always; a battle or a robbery (2) about a quarter of the time; a step of
 * unrest or a new governor (1) now and then. The docks have no preference
 * between good news and bad; routine traffic (0) never becomes talk.
 */
export function talkTarget(severity: number): number {
  return severity >= 3 ? 7 : severity === 2 ? 9 : 11
}

/** This week's events at ports may become rumours, good and bad alike. */
export function spawnRumours(state: GameState): void {
  // The docks tell it as the port's own side would hear it.
  const events = Object.values(state.events)
    .filter((e) => e.week === state.week && valenceFor(e, state.worlds[e.at].faction) !== 'neutral' && e.severity >= 1 && e.at !== state.capital && hasPort(state, e.at))
    .sort((a, b) => (a.id < b.id ? -1 : 1))
  for (const e of events) {
    if (!check(state.rng, talkTarget(e.severity))) continue
    state.rumours.push({ event: degrade(state, e), origin: e.at, born: state.week, heard: { [e.at]: 0 } })
  }
}

/**
 * Talk spreads one lane at a time, with a chance each week per lane, and
 * is delivered wherever someone reads. It goes no faster than a hull: a
 * rumour born this week makes its first hop next week at the soonest, so
 * nothing is heard of the week it happens. Old rumours are forgotten.
 */
export function spreadRumours(state: GameState): void {
  state.rumours = state.rumours.filter((r) => state.week - r.born <= EVENT_MEMORY)
  for (const rumour of state.rumours) {
    if (rumour.born >= state.week) continue
    const froms = Object.keys(rumour.heard).sort() as WorldId[]
    for (const from of froms) {
      for (const to of neighbours(state.lanes, from)) {
        if (to in rumour.heard) continue
        // Merchants think twice about a lane with a raider lying at either end, and their talk goes with them.
        // The better the story, the further it goes: a serious piece of news hops a lane more readily.
        const dm = rumour.event.severity >= 3 ? 1 : 0
        if (!check(state.rng, raided(state, from) || raided(state, to) ? 11 : 9, dm)) continue
        rumour.heard[to] = rumour.heard[from] + 1
        hearRumour(state, rumour, to)
      }
    }
  }
}

/** The trader who brought the word: one of the port's own people, so a Han world's merchants are Han. */
function merchantName(state: GameState, at: WorldId): string {
  const cultures = state.worlds[at].cultures
  const culture = cultures[nextInt(state.rng, 0, cultures.length - 1)]
  return personName(state.rng, culture, rollSex(state.rng))
}

/** A rumour reaches a world. If someone there keeps a picture of the subsector, it goes into it as a report. */
function hearRumour(state: GameState, rumour: Rumour, at: WorldId): void {
  const reader = state.worlds[at]?.actingGovernor
  if (!reader || !state.beliefs[reader]) return
  const hops = rumour.heard[at]
  const channel = hops <= 1 ? 'merchant' : 'docks'
  const report: Report = {
    id: `r-${state.nextId}` as ReportId,
    channel,
    observer: THE_DOCKS,
    observerName: channel === 'merchant' ? merchantName(state, at) : 'the docks',
    observerTitle: null,
    observerShip: null,
    observerShipId: null,
    subject: capitalise(eventLabel(rumour.event)),
    lede: eventText(rumour.event),
    observedAt: rumour.event.at,
    observed: rumour.event.week,
    snapshot: { kind: 'event', event: JSON.parse(JSON.stringify(rumour.event)) as Event },
    events: [],
    envelope: { origin: rumour.origin, destination: { kind: 'world', world: at }, sent: rumour.born, route: [rumour.origin, at], eta: null },
    delivered: state.week,
  }
  state.nextId += 1
  deliverDirect(state, reader, report)
}
