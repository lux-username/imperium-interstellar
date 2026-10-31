/**
 * Mail: how reports and letters are written, carried and delivered.
 *
 * A piece of mail is handed in at a world and waits there for the next hull
 * departing along the first leg of its route. At each stop it is unloaded;
 * if that stop is its address it is delivered, otherwise it waits again for
 * the next hull along the next leg. The arithmetic the whole game rests on
 * is: arrival = written + waiting + one week per jump.
 *
 * Draft 2's change: the address is a world, but the addressee is a body. A
 * letter reaches its reader only if their body is at the address when it
 * lands — ashore there, or aboard a hull lying there — and is otherwise
 * held at the port, poste restante, until they turn up or it is thrown out.
 * A sender writes to where they believe the reader is; the sim never routes
 * on ground truth.
 */
import { absorb, emptyBelief, hear } from './belief'
import { expectedArrival, route } from './chart'
import type { CharacterId, Declaration, DispatchId, GameState, Mail, MailId, ReportId, Ship, Week, World, WorldId } from './types'
import { stanceKey } from './types'
import type { Belief, Dispatch, Envelope, PersonSnapshot, Report, ShipSnapshot, Snapshot, WorldSnapshot } from './view'

// ---------------------------------------------------------------------------
// Minting

export function mint<K extends string>(state: GameState, prefix: string): K {
  const id = `${prefix}-${state.nextId}` as K
  state.nextId += 1
  return id
}

/** Postmark for mail handed in at `origin` on `sent`, addressed to `destination`. */
export function envelope(state: GameState, origin: WorldId, destination: WorldId, sent: Week): Envelope {
  const path = route(state.lanes, origin, destination) ?? [origin]
  return {
    origin,
    destination,
    sent,
    route: path,
    eta: path.length > 1 ? expectedArrival(state.lanes, path, sent) : path[0] === destination ? sent : null,
  }
}

// ---------------------------------------------------------------------------
// Snapshots: what an observer at a world can see there.

export function copyDeclaration(d: Declaration): Declaration {
  return { pair: [d.pair[0], d.pair[1]], stance: d.stance, week: d.week }
}

export function snapshotShip(state: GameState, ship: Ship, at: WorldId): ShipSnapshot {
  const { id, name, type, empire, captain } = ship
  return { id, name, type, empire, at, captain, captainName: captain ? (state.characters[captain]?.name ?? null) : null }
}

/** Ships in port at a world right now. */
export function shipsAt(state: GameState, world: WorldId): Ship[] {
  return Object.values(state.ships)
    .filter((s) => s.location.kind === 'world' && s.location.world === world)
    .sort((a, b) => (a.id < b.id ? -1 : 1))
}

/** People whose bodies are at a world right now: ashore, or aboard a hull lying there. */
export function peopleAt(state: GameState, world: WorldId): PersonSnapshot[] {
  const out: PersonSnapshot[] = []
  const ids = Object.keys(state.characters).sort() as CharacterId[]
  for (const id of ids) {
    const c = state.characters[id]
    if (c.body.kind === 'world' && c.body.world === world) out.push({ id, name: c.name, empire: c.empire, at: world, aboard: null })
    else if (c.body.kind === 'aboard') {
      const loc = state.ships[c.body.ship]?.location
      if (loc?.kind === 'world' && loc.world === world) out.push({ id, name: c.name, empire: c.empire, at: world, aboard: c.body.ship })
    }
  }
  return out
}

/** Where a character's body is, if at a world (ashore or aboard a docked hull). */
export function characterLocation(state: GameState, character: CharacterId): WorldId | null {
  const c = state.characters[character]
  if (!c) return null
  if (c.body.kind === 'world') return c.body.world
  const loc = state.ships[c.body.ship]?.location
  return loc?.kind === 'world' ? loc.world : null
}

/** A world as seen from its own port this week: its state, every hull lying there, everyone about, and the notice board. */
export function snapshotWorld(state: GameState, world: World): Snapshot {
  const { id, name, hex, profile, empire } = world
  const ships = shipsAt(state, id).map((s) => snapshotShip(state, s, id))
  const board = Object.keys(world.board)
    .sort()
    .map((k) => copyDeclaration(world.board[k]))
  const market: WorldSnapshot['market'] = {}
  for (const g of Object.keys(world.market).sort() as (keyof typeof world.market)[]) market[g] = { price: world.market[g].price, stock: world.market[g].stock }
  const lines: WorldSnapshot['lines'] = []
  for (const guild of Object.values(state.guilds).sort((a, b) => (a.empire < b.empire ? -1 : 1))) {
    for (const l of guild.lines) if (l.from === id || l.to === id) lines.push({ from: l.from, to: l.to, empire: guild.empire })
  }
  return { kind: 'world', world: { id, name, hex: { ...hex }, profile: { ...profile }, empire, ships, people: peopleAt(state, id), board, market, news: world.news.map((n) => ({ ...n })), lines } }
}

// ---------------------------------------------------------------------------
// Writing

export interface Writing {
  channel?: Report['channel']
  observerName?: string
  subject?: string
}

/**
 * An observer at `at` writes a report of `snapshot` addressed to `reader`
 * at `to` — where the writer believes the reader is — and hands it to the
 * port. If `to` is `at` the report is offered for delivery on the spot.
 */
export function writeReport(state: GameState, observer: CharacterId | null, at: WorldId, snapshot: Snapshot, reader: CharacterId, to: WorldId, writing: Writing = {}): Mail {
  const report: Report = {
    id: mint<ReportId>(state, 'r'),
    channel: writing.channel ?? 'official',
    observer,
    observerName: writing.observerName ?? (observer ? (state.characters[observer]?.name ?? 'Unknown') : `The port of ${state.worlds[at]?.name ?? at}`),
    subject: writing.subject ?? (snapshot.kind === 'world' ? `${snapshot.world.name}` : `${snapshot.ship.name}`),
    observedAt: at,
    observed: state.week,
    snapshot,
    envelope: envelope(state, at, to, state.week),
    delivered: null,
  }
  const mail: Mail = { id: mint<MailId>(state, 'm'), contents: { kind: 'report', report }, status: { kind: 'awaiting_carrier', at } }
  state.mail[mail.id] = mail
  mail.reader = reader
  if (at === to) deliver(state, mail, at)
  return mail
}

/**
 * A person at `from` writes a letter to `recipient`, addressed to `to`
 * where they believe the recipient is, and hands it to the port. Mail
 * written between weeks has missed this week's sailings.
 */
export function postLetter(state: GameState, sender: CharacterId, recipient: CharacterId, to: WorldId, text: string): Mail | null {
  const from = characterLocation(state, sender)
  if (from === null) return null
  const dispatch: Dispatch = {
    id: mint<DispatchId>(state, 'd'),
    sender,
    recipient,
    text,
    envelope: envelope(state, from, to, to === from ? state.week : state.week + 1),
  }
  const mail: Mail = { id: mint<MailId>(state, 'm'), contents: { kind: 'dispatch', dispatch }, status: { kind: 'awaiting_carrier', at: from } }
  state.mail[mail.id] = mail
  if (to === from) deliver(state, mail, to)
  return mail
}

// ---------------------------------------------------------------------------
// Carrying

export function envelopeOf(mail: Mail): Envelope {
  return mail.contents.kind === 'report' ? mail.contents.report.envelope : mail.contents.dispatch.envelope
}

/** Who the mail is for. */
export function readerOf(mail: Mail): CharacterId | null {
  return mail.contents.kind === 'dispatch' ? mail.contents.dispatch.recipient : (mail.reader ?? null)
}

function nextHop(mail: Mail, at: WorldId): WorldId | null {
  const r = envelopeOf(mail).route
  const i = r.indexOf(at)
  return i >= 0 && i + 1 < r.length ? r[i + 1] : null
}

/** Whether two empires are at war as the truth has it. The port hands bags over, or does not, on what it knows; see `atWarOnBoard`. */
export function atWar(state: GameState, a: string, b: string): boolean {
  if (a === b) return false
  return state.stances[stanceKey(a as never, b as never)]?.stance === 'war'
}

/** Whether a port's board says two empires are at war: what the harbourmaster goes by. */
export function atWarOnBoard(world: World, a: string, b: string): boolean {
  if (a === b) return false
  return world.board[stanceKey(a as never, b as never)]?.stance === 'war'
}

/** Letters a port holds for carriage beyond the newest few are thrown out. */
export const MAILBAG_CAP = 12

/** Weeks a port keeps a letter for someone who has not come for it. */
export const HELD_FOR = 52

/**
 * A ship about to jump from `from` to `to` takes everything at `from`
 * whose next leg is that jump. The port hands no bag to a hull of an
 * empire it believes itself at war with, and nothing addressed to a world
 * it believes at war with the hull's empire.
 */
export function loadMail(state: GameState, ship: Ship, from: WorldId, to: WorldId): void {
  const port = state.worlds[from]
  if (!port || atWarOnBoard(port, port.empire, ship.empire)) return
  const ids = Object.keys(state.mail).sort() as MailId[]
  for (const id of ids) {
    const mail = state.mail[id]
    if (mail.status.kind !== 'awaiting_carrier' || mail.status.at !== from) continue
    if (nextHop(mail, from) !== to) continue
    const dest = state.worlds[envelopeOf(mail).destination]
    if (dest && atWarOnBoard(port, dest.empire, ship.empire)) continue
    mail.status = { kind: 'aboard', ship: ship.id }
    ship.mailbag.push(mail.id)
  }
  // She carries the news as it stood on the board when she sailed.
  ship.news = {}
  for (const k of Object.keys(port.board)) ship.news[k] = copyDeclaration(port.board[k])
}

/**
 * A ship has arrived at `at`: everything aboard comes off and is delivered
 * or set down for the next leg. Mail that got here off its planned route
 * is re-routed from here; if no lane leads on, it stays aboard.
 */
export function unloadMail(state: GameState, ship: Ship, at: WorldId): void {
  const bag = ship.mailbag
  ship.mailbag = []
  for (const id of bag) {
    const mail = state.mail[id]
    if (!mail) continue
    const env = envelopeOf(mail)
    if (env.destination === at) {
      deliver(state, mail, at)
      continue
    }
    if (!env.route.includes(at)) {
      const path = route(state.lanes, at, env.destination)
      if (!path) {
        ship.mailbag.push(id)
        continue
      }
      env.route = path
      env.eta ??= expectedArrival(state.lanes, path, state.week)
    }
    mail.status = { kind: 'awaiting_carrier', at }
  }
  postNews(state.worlds[at], Object.values(ship.news))
}

/** News a hull brings goes up on the board where it is newer. Returns the declarations that were news here. */
export function postNews(world: World | undefined, news: Declaration[]): Declaration[] {
  if (!world) return []
  const fresh: Declaration[] = []
  for (const d of news) if (hear({ stances: world.board }, d)) fresh.push(d)
  return fresh
}

/** Ports throw out letters awaiting carriage beyond the newest few, and held letters nobody has come for. */
export function pruneMail(state: GameState): void {
  const waiting: Record<string, Mail[]> = {}
  for (const mail of Object.values(state.mail)) {
    if (mail.status.kind === 'held' && mail.status.expires !== null && state.week > mail.status.expires) {
      mail.status = { kind: 'lost', week: state.week }
      continue
    }
    if (mail.status.kind !== 'awaiting_carrier') continue
    ;(waiting[mail.status.at] ??= []).push(mail)
  }
  for (const pile of Object.values(waiting)) {
    if (pile.length <= MAILBAG_CAP) continue
    pile.sort((a, b) => envelopeOf(b).sent - envelopeOf(a).sent || (a.id < b.id ? 1 : -1))
    for (const mail of pile.slice(MAILBAG_CAP)) delete state.mail[mail.id]
  }
}

// ---------------------------------------------------------------------------
// Delivery

/**
 * Mail has reached its address. It reaches its reader if their body is
 * here; otherwise the port holds it for them.
 */
export function deliver(state: GameState, mail: Mail, at: WorldId): void {
  const reader = readerOf(mail)
  if (reader === null || characterLocation(state, reader) !== at) {
    mail.status = { kind: 'held', at, expires: state.week + HELD_FOR }
    return
  }
  mail.status = { kind: 'delivered', week: state.week }
  if (mail.contents.kind === 'report') {
    mail.contents.report.delivered = state.week
    learn(state, reader, mail.contents.report)
  }
}

/** Held mail is re-offered each week in case the reader has turned up. */
export function deliverHeld(state: GameState): void {
  const ids = Object.keys(state.mail).sort() as MailId[]
  for (const id of ids) {
    const mail = state.mail[id]
    if (mail.status.kind !== 'held') continue
    const reader = readerOf(mail)
    if (reader !== null && characterLocation(state, reader) === mail.status.at) deliver(state, mail, mail.status.at)
  }
}

export function beliefOf(state: GameState, reader: CharacterId): Belief {
  return (state.beliefs[reader] ??= emptyBelief())
}

/** A report enters a reader's belief where it is newer than what they already know (see ./belief.ts). */
export function learn(state: GameState, reader: CharacterId, report: Report): void {
  absorb(beliefOf(state, reader), report)
}

/**
 * A report that never travelled — the port seen with the reader's own
 * eyes — is read at once. The player keeps it as delivered mail, so their
 * pile of reports holds everything their picture rests on; anyone else
 * keeps only the fold.
 */
export function observe(state: GameState, reader: CharacterId, report: Report): void {
  report.delivered = state.week
  if (reader === state.player) {
    const mail: Mail = { id: mint<MailId>(state, 'm'), contents: { kind: 'report', report }, status: { kind: 'delivered', week: state.week } }
    mail.reader = reader
    state.mail[mail.id] = mail
  }
  learn(state, reader, report)
}
