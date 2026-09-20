/**
 * The one place orders are written. Opened from a world ("send a hull
 * here") or from a ship ("give orders"), it asks the same six things
 * either way: which hull, where to send the order, where the hull should
 * go, what to do there, its disposition if it meets trouble, and where to
 * go afterwards. The order leaves as a dispatch to the address chosen —
 * by default wherever the desk last saw the ship.
 */
import { useMemo, useState } from 'react'
import { expectedArrival, hexRoute, route, type Order, type PlayerView, type Posture, type ShipId, type StandingOrders, type WorldId } from '../sim/view'
import { hexLabel } from '../sim/hex'
import { ago, lastOrderSent, orderText, weekLabel, worldName } from './format'

export interface OrdersDraft {
  ship?: ShipId
  destination?: WorldId
}

interface Props {
  view: PlayerView
  draft: OrdersDraft
  onSubmit: (ship: ShipId, order: Order, address: WorldId, standing: Partial<StandingOrders>, courier: ShipId | null) => void
  onClose: () => void
}

type Task = 'hold' | 'patrol' | 'scout'

const POSTURES: { value: Posture; label: string }[] = [
  { value: 'never', label: 'never engage — run' },
  { value: 'overwhelming', label: 'engage only with overwhelming odds' },
  { value: 'favourable', label: 'engage at favourable odds' },
  { value: 'even', label: 'engage at even odds' },
  { value: 'always', label: 'always engage' },
]

export function OrdersDialog({ view, draft, onSubmit, onClose }: Props) {
  const worlds = useMemo(() => Object.values(view.chart).sort((a, b) => (a.name < b.name ? -1 : 1)), [view.chart])
  const lanes = useMemo(() => Object.fromEntries(view.lanes.map((l) => [l.id, l])), [view.lanes])

  const lastSeenAt = (ship: ShipId | ''): WorldId => (ship && view.known.ships[ship]?.ship.at) || view.capital

  const [ship, setShipState] = useState<ShipId | ''>(draft.ship ?? '')
  const [address, setAddress] = useState<WorldId>(lastSeenAt(draft.ship ?? ''))
  const [addressEdited, setAddressEdited] = useState(false)
  const [destination, setDestination] = useState<WorldId | ''>(draft.destination ?? '')
  const [task, setTask] = useState<Task>('patrol')
  const [weeks, setWeeks] = useState(4)
  const [posture, setPosture] = useState<Posture>('favourable')
  const [afterwards, setAfterwards] = useState<'return' | 'stay'>('return')
  const [rally, setRally] = useState<WorldId>(view.capital)
  const [courier, setCourier] = useState<ShipId | ''>('')
  const [byCourier, setByCourier] = useState(false)

  const setShip = (id: ShipId | '') => {
    setShipState(id)
    if (!addressEdited) setAddress(lastSeenAt(id))
  }

  const seen = ship ? view.known.ships[ship] : null
  const seenText = (id: ShipId) => {
    const s = view.known.ships[id]
    if (!s) return 'never seen'
    return `last known location: ${worldName(view, s.ship.at)}, ${s.observed === view.week ? 'seen this week' : ago(view.week, s.observed)}`
  }
  const path = route(lanes, view.capital, address)
  const landsAt = address === view.capital ? view.week : path ? expectedArrival(lanes, path, view.week + 1) : null
  const readAtOnce = address === view.capital && seen?.ship.at === view.capital && seen.observed === view.week

  // Where the hull is due, from the orders the desk sent it: write to where she will be, not where she was.
  const prior = ship ? lastOrderSent(view, ship) : null
  const priorOrder = prior?.payload.kind === 'order' ? prior.payload.order : null
  const dueAt = priorOrder && 'to' in priorOrder ? priorOrder.to : priorOrder && 'world' in priorOrder ? priorOrder.world : null
  const rendezvous = priorOrder && 'then' in priorOrder && priorOrder.then?.kind === 'world' ? priorOrder.then.world : null
  const addressChips: { label: string; world: WorldId }[] = []
  if (seen) addressChips.push({ label: 'last known', world: seen.ship.at })
  if (dueAt && dueAt !== seen?.ship.at) addressChips.push({ label: 'its destination', world: dueAt })
  if (rendezvous && rendezvous !== dueAt && rendezvous !== seen?.ship.at) addressChips.push({ label: 'its rendezvous', world: rendezvous })

  // A courier in port here could carry the orders itself: needed where no packet goes, worth it where it would land sooner.
  const couriers = view.roster.filter((r) => {
    const s = view.known.ships[r.id]
    return r.id !== ship && s?.ship.at === view.capital && s.observed === view.week && !lastOrderSent(view, r.id)
  })
  const chosenCourier = couriers.find((c) => c.id === courier) ?? couriers.find((c) => c.role === 'courier') ?? couriers[0] ?? null
  const courierPath = chosenCourier && address !== view.capital ? hexRoute(view.chart, view.capital, address, chosenCourier.jump) : null
  const courierLands = courierPath ? view.week + courierPath.length : null
  const courierOffered = couriers.length > 0 && address !== view.capital && (landsAt === null || (courierLands !== null && courierLands < landsAt - 1))
  const useCourier = courierOffered && (byCourier || landsAt === null) && chosenCourier !== null && courierPath !== null

  const then = afterwards === 'return' ? { kind: 'world' as const, world: rally } : null
  const order: Order | null = !destination
    ? null
    : task === 'hold'
      ? { kind: 'move', to: destination, then }
      : task === 'scout'
        ? { kind: 'scout', world: destination, then, lookedOn: null }
        : { kind: 'patrol', world: destination, weeks, posture, then, began: null }

  const deliverable = readAtOnce || landsAt !== null || useCourier

  const submit = () => {
    if (!ship || !order || !deliverable) return
    onSubmit(ship, order, address, { onContact: posture, rally: afterwards === 'return' ? rally : null }, useCourier && chosenCourier ? chosenCourier.id : null)
    onClose()
  }

  const worldOptions = worlds.map((w) => (
    <option key={w.id} value={w.id}>
      {w.name} {hexLabel(w.hex)}
    </option>
  ))

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal orders" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Orders">
        <h3>Orders</h3>

        <label className="field">
          <span>Hull</span>
          <select value={ship} onChange={(e) => setShip(e.target.value as ShipId | '')}>
            <option value="">— choose a ship —</option>
            {view.roster.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} ({r.role}) — {seenText(r.id)}
                {lastOrderSent(view, r.id) ? ' · has orders' : ''}
              </option>
            ))}
          </select>
          {ship && (
            <small className="muted">
              {seen ? `Last known location: ${worldName(view, seen.ship.at)} (${seen.observed === view.week ? 'seen this week' : ago(view.week, seen.observed)}).` : 'Never seen.'}{' '}
              {(() => {
                const prior = lastOrderSent(view, ship)
                return prior && prior.payload.kind === 'order' ? `Standing orders sent ${weekLabel(prior.envelope.sent)}: ${orderText(view, prior.payload.order)}.` : 'No orders sent.'
              })()}
            </small>
          )}
        </label>

        <label className="field">
          <span>Send the order to</span>
          <select
            value={address}
            onChange={(e) => {
              setAddress(e.target.value as WorldId)
              setAddressEdited(true)
            }}
          >
            {worldOptions}
          </select>
          {addressChips.length > 1 && (
            <span className="chips">
              {addressChips.map((c) => (
                <button
                  key={c.label}
                  type="button"
                  className={address === c.world ? 'small on' : 'small'}
                  onClick={() => {
                    setAddress(c.world)
                    setAddressEdited(true)
                  }}
                >
                  {c.label}: {worldName(view, c.world)}
                </button>
              ))}
            </span>
          )}
          <small className="muted">
            {readAtOnce && 'In port here: read at once.'}
            {!readAtOnce && landsAt !== null && `By packet, should land ${weekLabel(landsAt)} and wait there for the hull.`}
            {!readAtOnce && landsAt === null && !courierOffered && 'No packet goes there, and no hull is in port to carry it.'}
            {!readAtOnce && landsAt === null && courierOffered && 'No packet goes there.'}
          </small>
          {courierOffered && chosenCourier && courierLands !== null && (
            <small className="courier">
              {landsAt !== null && <input type="checkbox" checked={byCourier} onChange={(e) => setByCourier(e.target.checked)} />}{' '}
              Dispatch{' '}
              <select value={chosenCourier.id} onChange={(e) => setCourier(e.target.value as ShipId)}>
                {couriers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.role})
                  </option>
                ))}
              </select>{' '}
              to carry these orders, landing {weekLabel(courierLands)}, then return.
            </small>
          )}
        </label>

        <label className="field">
          <span>Destination</span>
          <select value={destination} onChange={(e) => setDestination(e.target.value as WorldId | '')}>
            <option value="">— choose a world —</option>
            {worldOptions}
          </select>
        </label>

        <fieldset className="field">
          <legend>On arrival</legend>
          <label>
            <input type="radio" name="task" checked={task === 'hold'} onChange={() => setTask('hold')} /> hold there
          </label>
          <label>
            <input type="radio" name="task" checked={task === 'patrol'} onChange={() => setTask('patrol')} /> patrol for{' '}
            <input type="number" min={1} max={52} value={weeks} onChange={(e) => setWeeks(Math.max(1, Number.parseInt(e.target.value, 10) || 1))} /> wk
          </label>
          <label>
            <input type="radio" name="task" checked={task === 'scout'} onChange={() => setTask('scout')} /> look for a week and report
          </label>
        </fieldset>

        <label className="field">
          <span>Disposition</span>
          <select value={posture} onChange={(e) => setPosture(e.target.value as Posture)}>
            {POSTURES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="field">
          <legend>Afterwards</legend>
          <label>
            <input type="radio" name="after" checked={afterwards === 'return'} onChange={() => setAfterwards('return')} /> proceed to{' '}
            <select value={rally} disabled={afterwards !== 'return'} onChange={(e) => setRally(e.target.value as WorldId)}>
              {worldOptions}
            </select>
          </label>
          <label>
            <input type="radio" name="after" checked={afterwards === 'stay'} onChange={() => setAfterwards('stay')} /> hold at the destination
          </label>
        </fieldset>

        {order && ship && (
          <p className="summary">
            {view.roster.find((r) => r.id === ship)?.name}: {orderText(view, order)}; {POSTURES.find((p) => p.value === posture)?.label}.
          </p>
        )}

        <div className="buttons">
          <button type="button" className="primary" disabled={!ship || !order || !deliverable} onClick={submit}>
            Send orders
          </button>
          <button type="button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
