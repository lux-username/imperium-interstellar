/**
 * Send a hull to the world in the dossier. The order is a small record —
 * go, patrol for a while, or look and come back — with the capital as the
 * rendezvous by default. It goes out as a dispatch to wherever the desk
 * last saw the ship.
 */
import { useState } from 'react'
import type { Order, PlayerView, ShipId, WorldId } from '../sim/view'
import { ago, lastOrderSent, worldName } from './format'

interface Props {
  view: PlayerView
  world: WorldId
  onOrder: (ship: ShipId, order: Order) => void
}

type Kind = 'move' | 'patrol' | 'scout'

export function OrderForm({ view, world, onOrder }: Props) {
  const [ship, setShip] = useState<ShipId | ''>('')
  const [kind, setKind] = useState<Kind>('patrol')
  const [weeks, setWeeks] = useState(4)
  const [home, setHome] = useState(true)

  const then = home ? { kind: 'world' as const, world: view.capital } : null
  const submit = () => {
    if (!ship) return
    const order: Order =
      kind === 'move' ? { kind: 'move', to: world, then } : kind === 'scout' ? { kind: 'scout', world, then, lookedOn: null } : { kind: 'patrol', world, weeks, posture: 'favourable', then, began: null }
    onOrder(ship, order)
    setShip('')
  }

  return (
    <div className="orderform">
      <h4>Send a hull here</h4>
      <select value={ship} onChange={(e) => setShip(e.target.value as ShipId | '')}>
        <option value="">— choose a ship —</option>
        {view.roster.map((r) => {
          const seen = view.known.ships[r.id]
          const busy = lastOrderSent(view, r.id)
          return (
            <option key={r.id} value={r.id}>
              {r.name} ({r.role}) — {seen ? `${worldName(view, seen.ship.at)}, ${ago(view.week, seen.observed)}` : 'unseen'}
              {busy ? ' · has orders' : ''}
            </option>
          )
        })}
      </select>
      <div className="orderkind">
        <label>
          <input type="radio" name="kind" checked={kind === 'move'} onChange={() => setKind('move')} /> go there
        </label>
        <label>
          <input type="radio" name="kind" checked={kind === 'patrol'} onChange={() => setKind('patrol')} /> patrol for{' '}
          <input type="number" min={1} max={26} value={weeks} onChange={(e) => setWeeks(Math.max(1, Number.parseInt(e.target.value, 10) || 1))} size={3} /> wk
        </label>
        <label>
          <input type="radio" name="kind" checked={kind === 'scout'} onChange={() => setKind('scout')} /> scout and report
        </label>
        <label>
          <input type="checkbox" checked={home} onChange={(e) => setHome(e.target.checked)} /> then return to the capital
        </label>
      </div>
      <button type="button" disabled={!ship} onClick={submit}>
        Send orders
      </button>
    </div>
  )
}
