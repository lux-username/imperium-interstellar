/**
 * The projection from ground truth to what the player may see. This is the
 * one place the sim hands anything to the UI, and it hands over only
 * delivered reports, the player's own outgoing mail, and public knowledge.
 */
import { COMMANDABLE_ROLES, type GameState } from './types'
import { fuelCapacity, troopCapacity } from './fleet'
import { knownHavens } from './belief'
import { isGovernmentHouseObservation, isRumour, type ChartEntry, type Dispatch, type FactionEntry, type PlayerView, type PoolEntry, type Report, type RosterEntry } from './view'

export function buildPlayerView(state: GameState): PlayerView {
  const chart: Record<string, ChartEntry> = {}
  for (const w of Object.values(state.worlds)) chart[w.id] = { id: w.id, name: w.name, hex: { ...w.hex }, cultures: [...w.cultures] }

  const inbox: Report[] = []
  const rumours: Report[] = []
  const observations: Report[] = []
  const outgoing: Dispatch[] = []
  for (const mail of Object.values(state.mail)) {
    if (mail.contents.kind === 'report') {
      const report = mail.contents.report
      if (report.delivered === null || mail.status.kind !== 'delivered') continue
      // Only what was addressed to Government House: the Warlord's seat reads its own mail.
      if (report.envelope.destination.kind !== 'world' || report.envelope.destination.world !== state.capital) continue
      if (isRumour(report.channel)) rumours.push(report)
      else if (isGovernmentHouseObservation(report.id)) observations.push(report)
      else inbox.push(report)
    } else if (mail.contents.dispatch.sender === state.player) {
      outgoing.push(mail.contents.dispatch)
    }
  }
  // Government House's books list its own hulls and the officers it gave them to; nothing about where they are now.
  const playerFaction = state.characters[state.player].faction
  const roster: RosterEntry[] = Object.values(state.ships)
    .filter((s) => s.faction === playerFaction && COMMANDABLE_ROLES.includes(s.role))
    .map((s) => ({ id: s.id, name: s.name, role: s.role, jump: s.jump, commander: s.commander, commanderName: s.commander ? (state.characters[s.commander]?.name ?? null) : null, troops: troopCapacity(s.role), fuel: fuelCapacity(s.role) }))
    .sort((a, b) => (a.id < b.id ? -1 : 1))
  // People and troops at the capital are seen from Government House's window, not learned by letter.
  const pool: PoolEntry[] = Object.values(state.characters)
    .filter((c) => c.faction === playerFaction && c.post.kind === 'unassigned' && c.post.at === state.capital)
    .map((c) => ({ id: c.id, name: c.name }))
    .sort((a, b) => (a.id < b.id ? -1 : 1))
  const names: Record<string, string> = {}
  for (const c of Object.values(state.characters)) if (c.faction === playerFaction) names[c.id] = c.name
  const capital = state.worlds[state.capital]
  const factions: Record<string, FactionEntry> = {}
  for (const f of Object.values(state.factions)) factions[f.id] = { id: f.id, name: f.name, kind: f.kind }

  const newestFirst = (a: Report, b: Report) => (b.delivered ?? 0) - (a.delivered ?? 0) || b.observed - a.observed || (a.id < b.id ? 1 : -1)
  inbox.sort(newestFirst)
  rumours.sort(newestFirst)
  observations.sort(newestFirst)
  const known = state.beliefs[state.player] ?? { worlds: {}, ships: {} }
  outgoing.sort((a, b) => b.envelope.sent - a.envelope.sent || (a.id < b.id ? 1 : -1))

  return {
    week: state.week,
    capital: state.capital,
    ending: state.ending,
    lanes: Object.values(state.lanes).sort((a, b) => (a.id < b.id ? -1 : 1)),
    chart,
    factions,
    faction: playerFaction,
    known,
    havens: knownHavens(inbox, known),
    roster,
    pool,
    names,
    reserve: { army: capital.garrison, marines: capital.marines },
    inbox,
    observations,
    rumours,
    outgoing,
  }
}
