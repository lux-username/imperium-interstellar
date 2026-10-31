/**
 * The projection from ground truth to what the player may see. This is the
 * one place the sim hands anything to the UI, and it hands over only
 * delivered reports, the player's own mail, public knowledge, and what
 * their body can see from where it stands.
 */
import { hexDistance } from './hex'
import { route } from './chart'
import { dutyRate, GOODS, inspectionChance } from './economy'
import { onTheFence, roundWouldHelp, willingness } from './agents'
import { ransomFor } from './captivity'
import { quarrel } from './combat'
import { playerShip, portClosed } from './game'
import { beliefOf, characterLocation, readerOf, shipsAt } from './mail'
import { sailsOn, otherEnd } from './scouts'
import { fuelPrice, holdUsed, holding, MAINTENANCE_EVERY, maintenanceCost, reachable } from './ships'
import { SHIP_CLASSES, type GameState } from './types'
import type { ChartEntry, Dispatch, EmpireEntry, HullHere, OwnShip, PlayerView, Report } from './view'

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
  const own = playerShip(state)
  const ship: OwnShip | null = own
    ? { id: own.id, name: own.name, type: own.type, jump: SHIP_CLASSES[own.type].jump, price: SHIP_CLASSES[own.type].price, fuel: own.fuel, maintenanceDueIn: own.maintained + MAINTENANCE_EVERY - state.week, inYard: own.inYard, maintenanceCost: maintenanceCost(own), tanks: SHIP_CLASSES[own.type].tanks, holdTons: SHIP_CLASSES[own.type].hold, holdUsed: holdUsed(own), hold: own.hold.map((l) => ({ ...l })), damage: own.damage, guns: SHIP_CLASSES[own.type].guns, course: own.course }
    : null
  const world = at === null ? null : state.worlds[at]
  const here =
    at === null || world === null
      ? null
      : {
          world: at,
          empire: world.empire,
          starport: world.profile.starport,
          hulls: shipsAt(state, at)
            .filter((s) => s.id !== own?.id)
            .map((s): HullHere => {
              const next = sailsOn(state, s, at, state.week + 1)
              const cap = s.captain ? state.characters[s.captain] : null
              const w = cap ? willingness(cap, me) : null
              return { id: s.id, name: s.name, type: s.type, empire: s.empire, captain: s.captain, captainName: cap?.name ?? null, mood: w === null ? null : w >= 0.7 ? 'glad' : onTheFence(w) ? 'fence' : 'tight', guild: !!cap?.guild, asked: !!s.captain && state.asked[s.captain]?.week === state.week, told: !!s.captain && state.asked[s.captain]?.week === state.week && state.asked[s.captain].told, roundWouldHelp: !!s.captain && roundWouldHelp(state, s.captain), sailsTo: s.run ? otherEnd(state.lanes[s.run.lane], at) : null, sailsOn: next }
            }),
          market: GOODS.map((good) => ({ good, price: world.market[good].price, stock: world.market[good].stock, holding: own ? holding(own, good) : null })),
          freight: world.freight.map((f) => ({ ...f })),
          duty: dutyRate(world, me.empire),
          closed: portClosed(state, world),
          inspection: inspectionChance(world, me.empire, portClosed(state, world)),
          refuel: fuelPrice(world.profile.starport),
          destinations: own
            ? reachable(state, at, SHIP_CLASSES[own.type].jump).map((w) => ({ world: w, parsecs: hexDistance(state.worlds[w].hex, world.hex), charted: route(state.lanes, at, w)?.length === 2 }))
            : [],
        }

  const pend = state.pending
  const hull = (id: typeof pend extends null ? never : NonNullable<typeof pend>['attacker']) => {
    const s = state.ships[id]
    return { id: s.id, name: s.name, type: s.type, empire: s.empire, guns: SHIP_CLASSES[s.type].guns }
  }
  const pending = pend
    ? { attacker: hull(pend.attacker), defender: hull(pend.defender), mine: (pend.attacker === own?.id ? 'attacker' : 'defender') as 'attacker' | 'defender', round: pend.round, log: [...pend.log], quarrel: own ? quarrel(state, state.ships[pend.attacker], state.ships[pend.defender]) : false }
    : null
  const cap = me.captive ?? null
  const captive = cap ? { of: cap.of, since: cap.since, at: cap.at, aboard: cap.at || !cap.by ? null : (state.ships[cap.by]?.name ?? null), ransom: ransomFor(me), term: cap.term ?? null } : null
  const lenderHere = !own && !cap && world !== null && world.empire === me.empire && ['A', 'B'].includes(world.profile.starport)

  return {
    week: state.week,
    player: { id: me.id, name: me.name, empire: me.empire },
    body,
    lanes: Object.values(state.lanes).sort((a, b) => (a.id < b.id ? -1 : 1)),
    chart,
    empires,
    known: beliefOf(state, state.player),
    here,
    purse: me.purse,
    debt: me.debt ? { ...me.debt } : null,
    ship,
    pending,
    lyingOff: own?.lyingOff ?? false,
    captive,
    lenderHere,
    inbox,
    observations,
    outgoing,
  }
}
