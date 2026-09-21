/**
 * Scouts are the agents. A scout sent to look at a world writes an
 * ordinary commander's letter on arrival; a scout sent to watch lies off
 * the world for the weeks ordered and then writes the one fully accurate
 * report in the game, on the `agent` channel: the world exactly as it is
 * and every event of the stay — every hull that called and left, every
 * step of unrest, any enemy scout that came to look — drawn straight from
 * the record the governor's letters are coloured from. Nothing is shaded.
 *
 * The record itself is the traffic log: ground truth keeps every event
 * for EVENT_MEMORY weeks (see ./events.ts), which is longer than any watch.
 */
import { eventsAt } from './events'
import { snapshotWorld, writeReport } from './mail'
import type { GameState, Ship, Week, WorldId } from './types'

/** The longest watch a scout can be ordered to keep, so the record still holds all of it when she writes. */
export const MAX_WATCH = 20

/**
 * The scout has watched `at` since `since`: she writes what she saw. At a
 * friendly port on the lanes the report goes by packet; anywhere else it
 * rides with her until she reaches one — a watcher over a hostile world
 * carries her own news home.
 */
export function watchReport(state: GameState, ship: Ship, at: WorldId, since: Week, friendlyPort: boolean): void {
  if (!ship.commander) return
  const world = state.worlds[at]
  const seen = eventsAt(state, at, since, state.week)
  const mail = writeReport(state, ship.commander, at, snapshotWorld(state, world), { channel: 'agent', events: seen, occasion: 'watch', since })
  if (!friendlyPort) {
    mail.status = { kind: 'aboard', ship: ship.id }
    ship.mailbag.push(mail.id)
  }
}
