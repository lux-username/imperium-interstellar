/**
 * Who is who, and who fights whom. The administration is the player's
 * faction; the Warlord's is the rival; pirates have no seat and fight
 * everyone; rebels are whoever has thrown a garrison out and now holds a
 * world for themselves. Stances are symmetric and fixed for this campaign —
 * the rogue path (Phase 2) is where allegiance starts to move.
 */
import type { CharacterId, Faction, FactionId, GameState, Stance, WorldId } from './types'

export const EMPIRE = 'f-empire' as FactionId
export const ADMINISTRATION = 'f-admin' as FactionId
export const WARLORD = 'f-warlord' as FactionId
export const PIRATES = 'f-pirates' as FactionId
export const REBELS = 'f-rebels' as FactionId

export const PLAYER = 'c-player' as CharacterId
export const THE_WARLORD = 'c-warlord' as CharacterId

export function stance(a: FactionId, b: FactionId): Stance {
  if (a === b) return 'friendly'
  if (a === EMPIRE || b === EMPIRE) return a === ADMINISTRATION || b === ADMINISTRATION ? 'friendly' : 'neutral'
  // Everyone else is at war with everyone else: the administration with the Warlord, both with pirates and rebels.
  return 'hostile'
}

export function hostile(a: FactionId, b: FactionId): boolean {
  return stance(a, b) === 'hostile'
}

/** The seat a faction's reports are addressed to, if it keeps one. */
export function capitalOf(state: GameState, faction: FactionId): WorldId | null {
  return state.factions[faction]?.capital ?? null
}

/** The factions every game starts with. The Warlord's capital is filled in when he is placed. */
export function startingFactions(capital: WorldId): Record<FactionId, Faction> {
  return {
    [EMPIRE]: { id: EMPIRE, name: 'The Empire', kind: 'empire', capital: null, leader: null },
    [ADMINISTRATION]: { id: ADMINISTRATION, name: 'The Subsector Administration', kind: 'administration', capital, leader: PLAYER },
    [WARLORD]: { id: WARLORD, name: 'The Warlord', kind: 'rival', capital: null, leader: THE_WARLORD },
    [PIRATES]: { id: PIRATES, name: 'Pirates', kind: 'pirates', capital: null, leader: null },
    [REBELS]: { id: REBELS, name: 'Independents', kind: 'rebels', capital: null, leader: null },
  }
}
