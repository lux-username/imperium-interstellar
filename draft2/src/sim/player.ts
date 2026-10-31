/**
 * The projection from ground truth to what the player may see. This is the
 * one place the sim hands anything to the UI, and it hands over only
 * delivered reports, the player's own mail, public knowledge, and what
 * their body can see from where it stands.
 */
import { beliefOf, characterLocation, readerOf, shipsAt } from './mail'
import { sailsOn, otherEnd } from './scouts'
import type { GameState } from './types'
import type { ChartEntry, Dispatch, EmpireEntry, HullHere, PlayerView, Report } from './view'

export function buildPlayerView(state: GameState): PlayerView {
  const chart: Record<string, ChartEntry> = {}
  for (const w of Object.values(state.worlds)) chart[w.id] = { id: w.id, name: w.name, hex: { ...w.hex }, cultures: [...w.cultures] }
  const empires: Record<string, EmpireEntry> = {}
  for (const e of Object.values(state.empires)) empires[e.id] = { id: e.id, name: e.name, seat: e.seat }

  const inbox: Report[] = []
  const observations: Report[] = []
  const outgoing: Dispatch[] = []
  for (const mail of Object.values(state.mail)) {
    if (mail.contents.kind === 'report') {
      if (mail.status.kind !== 'delivered' || readerOf(mail) !== state.player) continue
      const report = mail.contents.report
      if (report.observer === null && report.channel === 'port') observations.push(report)
      else inbox.push(report)
    } else if (mail.contents.dispatch.sender === state.player) {
      outgoing.push(mail.contents.dispatch)
    }
  }
  const newestFirst = (a: Report, b: Report) => (b.delivered ?? 0) - (a.delivered ?? 0) || b.observed - a.observed || (a.id < b.id ? 1 : -1)
  inbox.sort(newestFirst)
  observations.sort(newestFirst)
  outgoing.sort((a, b) => b.envelope.sent - a.envelope.sent || (a.id < b.id ? 1 : -1))

  const me = state.characters[state.player]
  const at = characterLocation(state, state.player)
  let body: PlayerView['body']
  if (me.body.kind === 'world') body = { kind: 'world', world: me.body.world }
  else {
    const ship = state.ships[me.body.ship]
    if (ship.location.kind === 'world') body = { kind: 'world', world: ship.location.world }
    else body = { kind: 'aboard', ship: ship.id, shipName: ship.name, from: ship.location.from, to: ship.location.to, arrives: ship.location.arrives }
  }
  const here =
    at === null
      ? null
      : {
          world: at,
          hulls: shipsAt(state, at).map((s): HullHere => {
            const next = sailsOn(state, s, at, state.week + 1)
            return { id: s.id, name: s.name, type: s.type, empire: s.empire, sailsTo: s.run ? otherEnd(state.lanes[s.run.lane], at) : null, sailsOn: next }
          }),
        }

  return {
    week: state.week,
    player: { id: me.id, name: me.name, empire: me.empire },
    body,
    lanes: Object.values(state.lanes).sort((a, b) => (a.id < b.id ? -1 : 1)),
    chart,
    empires,
    known: beliefOf(state, state.player),
    here,
    inbox,
    observations,
    outgoing,
  }
}
