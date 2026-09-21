/**
 * One hull, as Government House knows it: what she is and whose, who commands her
 * if she is ours, where she was last seen and by which letter, the orders
 * Government House sent her, and every report that mentions her — or, for one of
 * ours, only the letters her captain wrote. Nothing here is the truth
 * about where she is; it is the newest word and Government House's own mail.
 */
import { useState } from 'react'
import { isGovernmentHouseObservation, mentionsShip, type PlayerView, type ReportId, type ShipId, type WorldId } from '../sim/view'
import { ago, coloursOf, conditionText, eventText, hullKind, lastOrderSent, orderText, signature, weekLabel, worldName } from './format'

interface Props {
  /** The picture being shown: the present, or what Government House now knows of an earlier week. */
  view: PlayerView
  /** The present, for Government House's books and mail, which are not a matter of belief. */
  now: PlayerView
  ship: ShipId
  onSelectWorld: (world: WorldId) => void
  onOrders: (ship: ShipId) => void
  onShowReport: (id: ReportId) => void
}

const COLOUR_WORDS = { own: 'ours', warlord: 'Warlord', pirates: 'pirate', rebels: 'independent', other: 'unknown' } as const

export function ShipDossier({ view, now, ship, onSelectWorld, onOrders, onShowReport }: Props) {
  const [onlyOwn, setOnlyOwn] = useState(true)
  const entry = now.roster.find((r) => r.id === ship) ?? null
  const seen = view.known.ships[ship] ?? now.known.ships[ship] ?? null
  const snap = seen?.ship ?? null
  const name = entry?.name ?? snap?.name ?? ship
  const faction = snap?.faction ?? (entry ? now.faction : null)
  const colours = faction ? coloursOf(now, faction) : 'other'
  const ours = entry !== null
  const order = ours ? lastOrderSent(now, ship) : null

  const written = ours ? now.inbox.filter((r) => r.observerShipId === ship) : []
  const mentioned = now.inbox.filter((r) => mentionsShip(r, ship))
  const reports = ours && onlyOwn ? written : mentioned
  const talk = now.rumours.filter((r) => mentionsShip(r, ship))

  return (
    <div className="dossier">
      <h3>
        {name} <span className="muted">{snap ? hullKind(now, snap) : entry ? entry.role : ''}</span>
        <span className={`tag ${colours}`}>{COLOUR_WORDS[colours]}</span>
        {entry && !entry.commanderName && <span className="tag warn">prize</span>}
        {snap?.hulk ? <span className="tag warn">hulk</span> : snap?.damaged ? <span className="tag warn">damaged</span> : null}
      </h3>

      <dl>
        {ours && (
          <>
            <dt>Captain</dt>
            <dd>{entry.commanderName ?? <span className="warn">none — a prize waiting for an officer</span>}</dd>
            <dt>Class</dt>
            <dd>
              {entry.role}, J-{entry.jump}
              {entry.fuel > 0 ? `, fuel for ${entry.fuel} jumps when full` : ', fuel scoops'}
              {entry.troops > 0 ? `, berths for ${entry.troops} detachment${entry.troops === 1 ? '' : 's'}` : ''}
            </dd>
          </>
        )}
        <dt>Last seen</dt>
        <dd>
          {!seen && <span className="muted">never seen.</span>}
          {seen && (
            <>
              <button type="button" className="link" onClick={() => onSelectWorld(seen.ship.at)}>
                {worldName(now, seen.ship.at)}
              </button>
              , {weekLabel(seen.observed)} ({ago(view.week, seen.observed)})
              {seen.ship.fuel !== null && entry ? `, fuel for ${seen.ship.fuel} of ${entry.fuel}` : ''}
              {conditionText(seen.ship)}
              {isGovernmentHouseObservation(seen.report) ? (
                <span className="muted"> — seen from Government House</span>
              ) : (
                <>
                  {' '}
                  —{' '}
                  <button type="button" className="link" onClick={() => onShowReport(seen.report)}>
                    show report
                  </button>
                </>
              )}
            </>
          )}
        </dd>
        {ours && (
          <>
            <dt>Orders</dt>
            <dd>
              {order && order.payload.kind === 'order' ? (
                <>
                  Sent {weekLabel(order.envelope.sent)} to {worldName(now, order.envelope.destination.kind === 'world' ? order.envelope.destination.world : now.capital)}: {orderText(now, order.payload.order)}.
                  {order.envelope.eta !== null && order.envelope.eta > now.week && <span className="muted"> The order should land {weekLabel(order.envelope.eta)}.</span>}
                  {order.payload.standing && (
                    <div className="muted">
                      Standing: {order.payload.standing.onContact ? `engage ${order.payload.standing.onContact}` : ''}
                      {order.payload.standing.rally !== undefined ? `; rally ${order.payload.standing.rally ? worldName(now, order.payload.standing.rally) : 'nowhere — hold where the order ends'}` : ''}.
                    </div>
                  )}
                </>
              ) : (
                <span className="muted">No orders sent. She holds where she is.</span>
              )}
            </dd>
          </>
        )}
      </dl>

      {ours && entry.commanderName && (
        <div className="actions">
          <button type="button" onClick={() => onOrders(ship)}>
            Give orders…
          </button>
        </div>
      )}

      <h4>
        Reports{' '}
        {ours && (
          <span className="sort">
            <button type="button" className={onlyOwn ? 'small on' : 'small'} onClick={() => setOnlyOwn(true)}>
              from this hull ({written.length})
            </button>{' '}
            <button type="button" className={!onlyOwn ? 'small on' : 'small'} onClick={() => setOnlyOwn(false)}>
              all mentioning her ({mentioned.length})
            </button>
          </span>
        )}
      </h4>
      {reports.length === 0 && <p className="empty">{ours && onlyOwn ? 'Her captain has not written.' : 'No report mentions her.'}</p>}
      {reports.length > 0 && (
        <ul className="history">
          {reports.map((r) => {
            const about = r.events.filter((e) => e.ship?.id === ship)
            return (
              <li key={r.id}>
                <span className="muted">
                  obs. {weekLabel(r.observed)}, arrived {weekLabel(r.delivered ?? 0)}, {signature(r)}, {worldName(now, r.observedAt)}:
                </span>{' '}
                {about.length > 0 ? about.map((e) => `${e.at !== r.observedAt || e.week !== r.observed ? `${worldName(now, e.at)}, ${weekLabel(e.week)}: ` : ''}${eventText(e)}`).join(' ') : r.observerShipId === ship ? r.lede : `${name} was in port.`}{' '}
                <button type="button" className="link" onClick={() => onShowReport(r.id)}>
                  show
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {talk.length > 0 && (
        <>
          <h4>What the docks say</h4>
          <ul className="history">
            {talk.map((r) => r.snapshot.kind === 'event' && (
              <li key={r.id}>
                <span className="muted">
                  around {weekLabel(r.observed)}, heard {weekLabel(r.delivered ?? 0)}, {worldName(now, r.snapshot.event.at)}:
                </span>{' '}
                {eventText(r.snapshot.event)}{' '}
                <button type="button" className="link" onClick={() => onShowReport(r.id)}>
                  show
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
