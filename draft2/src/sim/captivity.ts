/**
 * Prisoners. A captain who strikes is carried aboard her captor until the
 * captor lands somewhere of her own — a navy at any port of its empire, an
 * outlaw at a haven — and is held there. Release comes by ransom from the
 * prisoner's own purse, by peace between the two empires as the port
 * hears of it, or by parole when the term runs out. Captivity as a social
 * scene waits for the People phase; this is the plumbing it will sit on.
 */
import { postNewsItem } from './news'
import { nextInt } from './rng'
import { stanceKey, type Character, type CharacterId, type GameState, type Ship, type WorldId } from './types'

/** Weeks a navy holds a prisoner before parole, failing peace or ransom. */
const NAVY_TERM: [number, number] = [20, 40]
/** Weeks an outlaw keeps a prisoner before putting them ashore, failing ransom. */
const OUTLAW_TERM: [number, number] = [12, 24]

/** What a captor asks: a fifth of what the prisoner still has, plus a sum for the trouble. */
export function ransomFor(c: Character): number {
  return Math.round(Math.max(0, c.purse) * 0.2) + 2000
}

/** Where a captor can land her prisoners: a navy at her empire's ports, an outlaw at her haven. */
function canLandPrisoners(state: GameState, captor: Ship, at: WorldId): boolean {
  if (captor.duty?.kind === 'raid') return at === captor.duty.haven
  const c = captor.captain ? state.characters[captor.captain] : null
  if (c?.outlaw) return false
  return state.worlds[at].empire === captor.empire
}

/** Captors that landed somewhere of their own put their prisoners ashore, under guard. */
export function landCaptives(state: GameState, landed: Ship[]): void {
  for (const ship of landed) {
    if (ship.location.kind !== 'world' || !canLandPrisoners(state, ship, ship.location.world)) continue
    const at = ship.location.world
    const keep: CharacterId[] = []
    for (const p of ship.passengers) {
      const c = state.characters[p]
      if (!c?.captive || c.captive.by !== ship.id) {
        keep.push(p)
        continue
      }
      c.captive.at = at
      c.captive.term = state.week + (c.captive.of ? nextInt(state.rng, NAVY_TERM[0], NAVY_TERM[1]) : nextInt(state.rng, OUTLAW_TERM[0], OUTLAW_TERM[1]))
      c.body = { kind: 'world', world: at }
      postNewsItem(state, at, `${ship.name} landed a prisoner, ${c.name}.`)
    }
    ship.passengers = keep
  }
}

/** Set free where they stand. */
export function release(state: GameState, c: Character, why: string): void {
  const at = c.captive?.at
  c.captive = null
  if (at !== null && at !== undefined) {
    c.body = { kind: 'world', world: at }
    postNewsItem(state, at, `${c.name}, ${why}, is at liberty.`)
  }
}

/** Pay the captor what they ask. Only from where the prisoner is held. */
export function payRansom(state: GameState, c: Character): boolean {
  const cap = c.captive
  if (!cap || cap.at === null) return false
  const sum = ransomFor(c)
  if (c.purse < sum) return false
  c.purse -= sum
  const captor = state.ships[cap.by]?.captain
  if (captor && state.characters[captor]) state.characters[captor].purse += sum
  release(state, c, 'ransomed')
  return true
}

/**
 * Each week: prisoners held ashore go free when the port hears of peace
 * between their empire and their captor's, or when their term is up; an
 * NPC with the means ransoms themselves.
 */
export function captivityTick(state: GameState): void {
  const ids = Object.keys(state.characters).sort() as CharacterId[]
  for (const id of ids) {
    const c = state.characters[id]
    const cap = c.captive
    if (!cap || cap.at === null) continue
    const port = state.worlds[cap.at]
    if (cap.of && cap.of !== c.empire) {
      const d = port.board[stanceKey(cap.of, c.empire)]
      if (d && d.stance === 'peace' && d.week > cap.since) {
        release(state, c, 'released at the peace')
        continue
      }
    }
    if (cap.term !== undefined && state.week >= cap.term) {
      release(state, c, cap.of ? 'paroled' : 'put ashore by her captors')
      continue
    }
    if (id !== state.player && c.purse >= ransomFor(c) + 5000) payRansom(state, c)
  }
}
