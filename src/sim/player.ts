/**
 * The projection from ground truth to what the player may see. This is the
 * one place the sim hands anything to the UI, and it hands over only
 * delivered reports, the player's own outgoing mail, and public knowledge.
 */
import { COMMANDABLE_ROLES, type GameState } from './types'
import { isRumour, type ChartEntry, type Dispatch, type PlayerView, type Report, type RosterEntry } from './view'

export function buildPlayerView(state: GameState): PlayerView {
  const chart: Record<string, ChartEntry> = {}
  for (const w of Object.values(state.worlds)) chart[w.id] = { id: w.id, name: w.name, hex: { ...w.hex } }

  const inbox: Report[] = []
  const rumours: Report[] = []
  const outgoing: Dispatch[] = []
  for (const mail of Object.values(state.mail)) {
    if (mail.contents.kind === 'report') {
      const report = mail.contents.report
      if (report.delivered === null || mail.status.kind !== 'delivered') continue
      if (isRumour(report.channel)) rumours.push(report)
      else inbox.push(report)
    } else if (mail.contents.dispatch.sender === state.player) {
      outgoing.push(mail.contents.dispatch)
    }
  }
  // The desk's books list its own hulls and the officers it gave them to; nothing about where they are now.
  const playerFaction = state.characters[state.player]?.faction
  const roster: RosterEntry[] = Object.values(state.ships)
    .filter((s) => s.faction === playerFaction && COMMANDABLE_ROLES.includes(s.role))
    .map((s) => ({ id: s.id, name: s.name, role: s.role, jump: s.jump, commanderName: s.commander ? (state.characters[s.commander]?.name ?? null) : null }))
    .sort((a, b) => (a.id < b.id ? -1 : 1))

  const newestFirst = (a: Report, b: Report) => (b.delivered ?? 0) - (a.delivered ?? 0) || b.observed - a.observed || (a.id < b.id ? 1 : -1)
  inbox.sort(newestFirst)
  rumours.sort(newestFirst)
  outgoing.sort((a, b) => b.envelope.sent - a.envelope.sent || (a.id < b.id ? 1 : -1))

  return {
    week: state.week,
    capital: state.capital,
    lanes: Object.values(state.lanes).sort((a, b) => (a.id < b.id ? -1 : 1)),
    chart,
    known: state.beliefs[state.player] ?? { worlds: {}, ships: {} },
    roster,
    inbox,
    rumours,
    outgoing,
  }
}
