/**
 * What a governor chooses to tell Government House. A governor writes when
 * something happened that they are willing to mention, and otherwise only
 * now and then to say all is quiet — so silence is itself a signal. Good
 * news always goes; bad news gets a disclosure roll shaded by who the
 * governor is; and the letter itself is coloured by the same traits: a
 * governor who harbours pirates leaves them out of it.
 *
 * The same shape holds one level up: the player's own monthly report to the
 * Council is selective in exactly this way (Phase 1c).
 */
import { isBold, isCautious } from './characters'
import { eventsAt, valenceFor } from './events'
import { PIRATES } from './factions'
import { snapshotWorld, writeReport } from './mail'
import { isHaven } from './pirates'
import { check, type Rng } from './rng'
import type { Character, GameState, Mail, World, WorldId } from './types'
import type { Event, Snapshot } from './view'

/** Weeks between "all quiet" letters, staggered by hex so the mail does not all arrive at once. */
export function quietInterval(world: World): number {
  return 8 + ((world.hex.col * 3 + world.hex.row) % 5)
}

/** Bad news that reflects on the governor's own handling of their world. */
function implicates(event: Event): boolean {
  return event.kind === 'unrest_rose'
}

/** Whether an event is about a pirate hull: her comings and goings, or the port's failure to seize her. */
function aboutPirates(event: Event): boolean {
  if (event.kind === 'pirates_harboured') return true
  return (event.kind === 'hull_arrived' || event.kind === 'hull_departed') && event.ship?.faction === PIRATES
}

/**
 * A governor who lets pirates use their port says nothing of them: not
 * their coming and going, and never that they lay there unmolested —
 * to do so would be to inform on themselves. A battle in orbit they may
 * still report, since silence about that would look worse.
 */
export function harbours(governor: Character): boolean {
  return governor.traits.loyalty === 'self'
}

/** Bad news whose natural letter is a request for help. */
function asksForHelp(event: Event): boolean {
  return event.kind === 'unrest_rose' || event.kind === 'revolt_began' || event.kind === 'troops_landed'
}

/**
 * Whether a governor mentions an event. Good news always; routine traffic
 * never, except that a new governor introduces themselves. Bad news is a
 * 2d6 roll against 8: worse news is harder to sit on, a self-serving
 * governor sits on anything that implicates them, a bold one believes they
 * can handle it, a cautious one writes early and asks for troops.
 */
export function discloses(rng: Rng, governor: Character, event: Event): boolean {
  const valence = valenceFor(event, governor.faction)
  if (valence === 'good') return true
  if (valence === 'neutral') return event.kind === 'governor_changed'
  if (harbours(governor) && aboutPirates(event)) return false
  let dm = event.severity
  if (governor.traits.loyalty === 'self' && implicates(event)) dm -= 3
  if (asksForHelp(event)) {
    if (isBold(governor)) dm -= 2
    if (isCautious(governor)) dm += 1
  }
  return check(rng, 8, dm)
}

/** A copy of the world as the governor describes it: as it is, but with no pirates in port if theirs is a haven. */
export function colouredSnapshot(state: GameState, world: World, governor: Character): Snapshot {
  const snapshot = snapshotWorld(state, world)
  if (snapshot.kind === 'world' && harbours(governor) && isHaven(state, world)) snapshot.world.ships = snapshot.world.ships.filter((s) => s.faction !== PIRATES)
  return snapshot
}

/** A copy of an event as the governor tells it. What they choose to mention is the colouring; the event itself is told straight. */
function colouredEvent(event: Event): Event {
  return JSON.parse(JSON.stringify(event)) as Event
}

/**
 * The governor's letter home: how the world stands, in their telling, and
 * the events since their last letter that they are willing to mention.
 * Writing resets the quiet clock.
 */
export function governorLetter(state: GameState, world: World, mention: Event[], requested = false): Mail | null {
  const id = world.actingGovernor
  const governor = id ? state.characters[id] : null
  if (!id || !governor) return null
  const mail = writeReport(state, id, world.id, colouredSnapshot(state, world, governor), { events: mention.map(colouredEvent), occasion: requested ? 'requested' : 'letter' })
  world.lastLetter = state.week
  return mail
}

/** Everything since the last letter that this governor would mention. */
export function eventsWorthMentioning(state: GameState, world: World, governor: Character): Event[] {
  return eventsAt(state, world.id, world.lastLetter + 1, state.week).filter((e) => discloses(state.rng, governor, e))
}

/**
 * Each week, every governor decides whether to write: yes if Government House
 * wrote asking (a full report, everything since the last letter that they
 * will admit to), yes if something happened this week that they will
 * mention, yes if it has been long enough since the last letter, otherwise
 * no. News buried this week stays buried unless Government House asks.
 */
export function governorsWrite(state: GameState): void {
  const ids = Object.keys(state.worlds).sort() as WorldId[]
  for (const id of ids) {
    const world = state.worlds[id]
    if (world.id === state.capital || !world.actingGovernor) continue
    const governor = state.characters[world.actingGovernor]
    if (!governor) continue
    const thisWeek = eventsAt(state, world.id, state.week, state.week)
    if (thisWeek.some((e) => e.kind === 'dispatch_received')) {
      governorLetter(state, world, eventsWorthMentioning(state, world, governor), true)
      continue
    }
    const mention = thisWeek.filter((e) => discloses(state.rng, governor, e))
    // A governor with a fight on their hands writes every other week whether or not anything new has happened.
    const interval = world.contest ? 2 : quietInterval(world)
    if (mention.length > 0) governorLetter(state, world, mention)
    else if (state.week - world.lastLetter >= interval) governorLetter(state, world, [])
  }
}
