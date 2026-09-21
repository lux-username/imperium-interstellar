/**
 * The desk's people: every officer it knows of, by post — waiting at the
 * capital for one, holding a governor's seal, or commanding a hull — with
 * where the desk last placed them and how many reports mention them or
 * their charge. Governors are known only as the newest letter about each
 * world names them; commanders are on the desk's books; the pool is seen
 * from the window. A row opens the world or the hull they are attached to.
 */
import { Fragment } from 'react'
import { mentionsShip, type CharacterId, type PlayerView, type ShipId, type WorldId } from '../sim/view'
import { ago, lastOrderSent, worldName } from './format'
import type { Selection } from './selection'

interface Props {
  view: PlayerView
  onSelect: (s: Selection) => void
}

type Officer =
  | { kind: 'unassigned'; id: CharacterId; name: string; at: WorldId }
  | { kind: 'governor'; id: CharacterId; name: string; world: WorldId; observed: number }
  | { kind: 'commander'; id: CharacterId; name: string; ship: ShipId; shipName: string }
  | { kind: 'passenger'; id: CharacterId; name: string; ship: ShipId; shipName: string; sent: number }

const ORDER = { unassigned: 0, passenger: 1, governor: 2, commander: 3 }

function officers(view: PlayerView): Officer[] {
  const list: Officer[] = []
  const placed = new Set<CharacterId>()
  for (const p of view.pool) {
    list.push({ kind: 'unassigned', id: p.id, name: p.name, at: view.capital })
    placed.add(p.id)
  }
  for (const r of view.roster) {
    if (r.commander && r.commanderName) {
      list.push({ kind: 'commander', id: r.commander, name: r.commanderName, ship: r.id, shipName: r.name })
      placed.add(r.commander)
    }
  }
  for (const report of Object.values(view.known.worlds)) {
    if (report.snapshot.kind !== 'world') continue
    const w = report.snapshot.world
    if (w.id === view.capital || w.faction !== view.faction || !w.governor || !w.governorName) continue
    if (placed.has(w.governor)) continue
    list.push({ kind: 'governor', id: w.governor, name: w.governorName, world: w.id, observed: report.observed })
    placed.add(w.governor)
  }
  // An officer sent out aboard a transport, until a letter places them somewhere.
  for (const d of view.outgoing) {
    if (d.payload.kind !== 'order' || d.payload.order.kind !== 'transport' || !d.payload.order.passenger) continue
    const id = d.payload.order.passenger
    if (placed.has(id)) continue
    const hull = view.roster.find((r) => r.id === (d.payload as { ship: ShipId }).ship)
    if (!hull) continue
    list.push({ kind: 'passenger', id, name: view.names[id] ?? id, ship: hull.id, shipName: hull.name, sent: d.envelope.sent })
    placed.add(id)
  }
  return list.sort((a, b) => ORDER[a.kind] - ORDER[b.kind] || (a.name < b.name ? -1 : 1))
}

/** How many reports name this officer, or are about their world or hull. */
function mentions(view: PlayerView, o: Officer): number {
  return view.inbox.filter((r) => {
    if (r.observer === o.id || r.events.some((e) => e.person === o.name)) return true
    if (o.kind === 'governor') return r.snapshot.kind === 'world' && r.snapshot.world.id === o.world
    if (o.kind === 'commander' || o.kind === 'passenger') return mentionsShip(r, o.ship)
    return false
  }).length
}

const POST_WORDS = { unassigned: 'Without a post', passenger: 'Aboard a hull', governor: 'Governors', commander: 'Commanding' }

export function Officers({ view, onSelect }: Props) {
  const list = officers(view)
  if (list.length === 0) return <p className="empty">No officers on the books.</p>
  return (
    <ul className="fleet officers">
      {list.map((o, i) => {
        const heading = i === 0 || list[i - 1].kind !== o.kind ? <li className="heading">{POST_WORDS[o.kind]}</li> : null
        const seen = o.kind === 'commander' || o.kind === 'passenger' ? view.known.ships[o.ship] : null
        const n = mentions(view, o)
        const select = () => {
          if (o.kind === 'governor') onSelect({ kind: 'world', id: o.world })
          else if (o.kind === 'unassigned') onSelect({ kind: 'world', id: o.at })
          else onSelect({ kind: 'ship', id: o.ship })
        }
        return (
          <Fragment key={o.id}>
            {heading}
            <li onClick={select}>
              <div className="line1">
                <span className="subject">{o.name}</span>
                <span className="muted">
                  {o.kind === 'governor' && `Governor of ${worldName(view, o.world)}`}
                  {o.kind === 'commander' && `Captain, ${o.shipName}`}
                  {o.kind === 'passenger' && `passenger aboard ${o.shipName}, sent wk ${o.sent}`}
                  {o.kind === 'unassigned' && 'in the pool'}
                </span>
                <span className="arrived">
                  {o.kind === 'governor' && `${worldName(view, o.world)}, ${ago(view.week, o.observed)}`}
                  {o.kind === 'unassigned' && `${worldName(view, o.at)}, now`}
                  {(o.kind === 'commander' || o.kind === 'passenger') && (seen ? `${worldName(view, seen.ship.at)}, ${ago(view.week, seen.observed)}` : 'never seen')}
                </span>
              </div>
              <div className="line2 muted">
                {n} report{n === 1 ? '' : 's'} mention {o.kind === 'governor' ? 'them or their world' : o.kind === 'unassigned' ? 'them' : 'them or their hull'}
                {o.kind === 'commander' && lastOrderSent(view, o.ship) ? ' · under orders' : ''}
              </div>
            </li>
          </Fragment>
        )
      })}
    </ul>
  )
}
