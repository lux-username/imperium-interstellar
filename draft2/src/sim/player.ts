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
import { esteemWord, greeting, regardOf, remarkable, standingWord, traitsOf } from './people'
import { possibleAllies } from './combat'
import { quarrel } from './combat'
import { playerShip, portClosed } from './game'
import { beliefOf, characterLocation, readerOf, shipsAt } from './mail'
import { sailsOn, otherEnd } from './scouts'
import { fuelPrice, holdUsed, holding, MAINTENANCE_EVERY, maintenanceCost, reachable } from './ships'
import { SHIP_CLASSES, type CharacterId, type GameState, type WorldId } from './types'
import type { BookEntry, ChartEntry, Dispatch, EmpireEntry, HullHere, OwnShip, PlayerView, Report } from './view'

export function buildPlayerView(state: GameState): PlayerView {
  const chart: Record<string, ChartEntry> = {}
  for (const w of Object.values(state.worlds)) chart[w.id] = { id: w.id, name: w.name, hex: { ...w.hex }, cultures: [...w.cultures] }
  const empires: Record<string, EmpireEntry> = {}
  for (const e of Object.values(state.empires)) empires[e.id] = { id: e.id, name: e.name, seat: e.seat, exports: [...e.exports], imports: [...e.imports] }

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
  const known = beliefOf(state, state.player)
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
              return { id: s.id, name: s.name, type: s.type, empire: s.empire, captain: s.captain, captainName: cap?.name ?? null, mood: w === null ? null : w >= 0.7 ? 'glad' : onTheFence(w) ? 'fence' : 'tight', guild: !!cap?.guild, asked: !!s.captain && state.asked[s.captain]?.week === state.week, told: !!s.captain && state.asked[s.captain]?.week === state.week && state.asked[s.captain].told, roundWouldHelp: !!s.captain && roundWouldHelp(state, s.captain), greeting: s.captain ? greeting(state, s.captain, me.id) : null, roundWelcome: !!s.captain && (state.relations[`${s.captain}|${me.id}`]?.lastRound === undefined || state.week - (state.relations[`${s.captain}|${me.id}`]?.lastRound ?? -99) >= 4), wouldGrant: !!s.captain && regardOf(state, s.captain, me.id) >= 1 && !state.relations[`${me.id}|${s.captain}`]?.request, sailsTo: s.run ? otherEnd(state.lanes[s.run.lane], at) : null, sailsOn: next }
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
    ? { attacker: hull(pend.attacker), defender: hull(pend.defender), mine: (pend.attacker === own?.id ? 'attacker' : 'defender') as 'attacker' | 'defender', round: pend.round, log: [...pend.log], quarrel: own ? quarrel(state, state.ships[pend.attacker], state.ships[pend.defender]) : false, ally: pend.ally ? (state.ships[pend.ally]?.name ?? null) : null }
    : null
  const cap = me.captive ?? null
  const captive = cap ? { of: cap.of, since: cap.since, at: cap.at, aboard: cap.at || !cap.by ? null : (state.ships[cap.by]?.name ?? null), ransom: ransomFor(me), term: cap.term ?? null } : null
  const lenderHere = !own && !cap && world !== null && world.empire === me.empire && ['A', 'B'].includes(world.profile.starport)

  // The Book: a page for everyone the player has dealt with, been told of, or watched trade.
  const pages = new Map<string, BookEntry>()
  const pageFor = (id: CharacterId): BookEntry | null => {
    const c = state.characters[id]
    if (!c || id === state.player) return null
    let p = pages.get(id)
    if (p) return p
    const r = state.relations[`${state.player}|${id}`]
    const seen = known.people[id]
    const dealings = r?.dealings ?? 0
    const words = remarkable(traitsOf(c))
    const impression = dealings >= 9 ? words : dealings >= 5 ? words.slice(0, 2) : dealings >= 2 ? words.slice(0, 1) : []
    p = {
      id,
      name: c.name,
      empire: c.empire,
      guild: !!c.guild,
      outlaw: !!c.outlaw,
      hull: seen?.person.aboard ? (state.ships[seen.person.aboard]?.name ?? null) : null,
      lastSeen: seen ? { world: seen.person.at, week: seen.observed } : null,
      standing: standingWord(r?.regard ?? 0),
      regard: r?.regard ?? 0,
      trust: r?.trust ?? 0.5,
      dealings,
      notes: r ? [...r.notes].reverse().map((n) => `wk ${n.week}: ${n.text}`) : [],
      esteem: esteemWord(r?.esteem ?? 0),
      askedOfYou: (() => { const t = state.relations[`${id}|${state.player}`]?.request; return t ? { world: t.world, good: t.good, since: t.since, tone: t.tone } : null })(),
      askedByYou: r?.request ? { world: r.request.world, good: r.request.good, since: r.request.since } : null,
      impression,
      seenTrading: [],
      friends: [],
      enemies: [],
    }
    pages.set(id, p)
    return p
  }
  for (const key of Object.keys(state.relations)) {
    const [a, b] = key.split('|') as [CharacterId, CharacterId]
    if (a === state.player) pageFor(b)
  }
  for (const id of Object.keys(known.people) as CharacterId[]) pageFor(id)
  for (const w of Object.keys(known.traffic) as WorldId[]) {
    for (const k of known.traffic[w]) {
      const m = k.movement
      if (!m.captain) continue
      const p = pageFor(m.captain)
      if (!p || p.seenTrading.length >= 5) continue
      const what = [...m.sold.map((x) => `sold ${x.tons}t ${x.good}`), ...m.bought.map((x) => `bought ${x.tons}t ${x.good}`)]
      if (what.length) p.seenTrading.push(`wk ${m.week} at ${state.worlds[w].name}: ${what.join(', ')} [${k.source}]`)
      if (!p.hull) p.hull = m.shipName
    }
  }
  for (const key of Object.keys(known.ties).sort()) {
    const [x, y] = key.split('|') as [CharacterId, CharacterId]
    const t = known.ties[key]
    const px = pageFor(x)
    const other = state.characters[y]
    if (!px || !other) continue
    void px
    const from = state.characters[t.from]?.name ?? 'someone'
    if (t.regard >= 1.5) px.friends.push({ name: other.name, from })
    else if (t.regard <= -1.5) px.enemies.push({ name: other.name, from })
  }
  const book = [...pages.values()].sort((a, b) => b.dealings - a.dealings || (b.lastSeen?.week ?? -1) - (a.lastSeen?.week ?? -1) || (a.name < b.name ? -1 : 1))

  return {
    week: state.week,
    player: { id: me.id, name: me.name, empire: me.empire },
    body,
    lanes: Object.values(state.lanes).sort((a, b) => (a.id < b.id ? -1 : 1)),
    chart,
    empires,
    known,
    here,
    purse: me.purse,
    debt: me.debt ? { ...me.debt } : null,
    ship,
    prisoners: at === null ? [] : (Object.keys(state.characters).sort() as CharacterId[]).filter((c) => c !== me.id && state.characters[c].captive?.at === at).map((c) => ({ id: c, name: state.characters[c].name, empire: state.characters[c].empire, ransom: ransomFor(state.characters[c]) })),
    allies: pend && pend.defender === own?.id && !pend.ally ? possibleAllies(state, pend).map((s) => ({ ship: s.id, name: s.name, captain: s.captain ? (state.characters[s.captain]?.name ?? '') : '', guns: SHIP_CLASSES[s.type].guns })) : [],
    pending,
    lyingOff: own?.lyingOff ?? false,
    captive,
    lenderHere,
    book,
    inbox,
    observations,
    outgoing,
  }
}
