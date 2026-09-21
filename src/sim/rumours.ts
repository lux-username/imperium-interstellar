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
 * Bad news travels best.
 */
import { neighbours } from './chart'
import { EVENT_MEMORY, valenceFor } from './events'
import { capitalise, eventLabel, eventText } from './letters'
import { learn } from './mail'
import { personName, rollSex } from './names'
import { raided } from './pirates'
import { check, nextInt } from './rng'
import type { CharacterId, GameState, Mail, MailId, ReportId, Week, WorldId } from './types'
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

/** A copy of an event as talk would have it: mostly right, sometimes off by a week or two, now and then pinned on the wrong world. */
function degrade(state: GameState, event: Event): Event {
  const copy = JSON.parse(JSON.stringify(event)) as Event
  if (check(state.rng, 9)) copy.week += nextInt(state.rng, -2, 2)
  if (check(state.rng, 11)) {
    // Never the capital: the desk sees that for itself, and talk about it would only confuse.
    const near = neighbours(state.lanes, event.at).filter((w) => w !== state.capital)
    if (near.length > 0) copy.at = near[nextInt(state.rng, 0, near.length - 1)]
  }
  return copy
}

/** This week's events at ports may become rumours. Bad news does so more readily than good; routine traffic never. */
export function spawnRumours(state: GameState): void {
  // The docks tell it as the port's own side would hear it.
  const events = Object.values(state.events)
    .filter((e) => e.week === state.week && valenceFor(e, state.worlds[e.at].faction) !== 'neutral' && e.severity >= 1 && e.at !== state.capital && hasPort(state, e.at))
    .sort((a, b) => (a.id < b.id ? -1 : 1))
  for (const e of events) {
    if (!check(state.rng, valenceFor(e, state.worlds[e.at].faction) === 'bad' ? 7 : 9)) continue
    state.rumours.push({ event: degrade(state, e), origin: e.at, born: state.week, heard: { [e.at]: 0 } })
  }
}

/**
 * Talk spreads one lane at a time, with a chance each week per lane, and
 * is delivered wherever someone reads. Old rumours are forgotten.
 */
export function spreadRumours(state: GameState): void {
  state.rumours = state.rumours.filter((r) => state.week - r.born <= EVENT_MEMORY)
  for (const rumour of state.rumours) {
    const froms = Object.keys(rumour.heard).sort() as WorldId[]
    for (const from of froms) {
      for (const to of neighbours(state.lanes, from)) {
        if (to in rumour.heard) continue
        // Merchants think twice about a lane with a raider lying at either end, and their talk goes with them.
        if (!check(state.rng, raided(state, from) || raided(state, to) ? 11 : 9)) continue
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
  const mail: Mail = { id: `m-${state.nextId}` as MailId, contents: { kind: 'report', report }, status: { kind: 'delivered', week: state.week } }
  state.nextId += 1
  state.mail[mail.id] = mail
  learn(state, reader, report)
}
