/**
 * Government House's books: every hull it commands, where each was last seen and
 * by whom, and the last order sent to it — and the prizes taken in action,
 * which want an officer sent out before they are any use. Nothing here is
 * the truth about where a ship is; it is the newest report and Government House's
 * own mail. A row opens the hull's dossier.
 */
import { isGovernmentHouseObservation, type PlayerView, type ReportId, type ShipId } from '../sim/view'
import { ago, conditionText, lastOrderSent, orderText, weekLabel, worldName } from './format'

interface Props {
  view: PlayerView
  onSelect: (ship: ShipId) => void
  onShowReport: (id: ReportId) => void
  /** Open the orders dialog with this hull chosen. */
  onOrders: (ship: ShipId) => void
}

export function Fleet({ view, onSelect, onShowReport, onOrders }: Props) {
  if (view.roster.length === 0) return <p className="empty">No hulls on the books.</p>
  return (
    <ul className="fleet">
      {view.roster.map((entry) => {
        const seen = view.known.ships[entry.id]
        const order = lastOrderSent(view, entry.id)
        return (
          <li key={entry.id} onClick={() => onSelect(entry.id)}>
            <div className="line1">
              <span className="subject">{entry.name}</span>
              <span className="muted">
                {entry.role}, J-{entry.jump}
                {entry.fuel === 0 ? ', scoops' : seen?.ship.fuel !== null && seen?.ship.fuel !== undefined ? `, fuel for ${seen.ship.fuel} of ${entry.fuel}` : ''}
              </span>
              <span className="arrived">{seen ? `${worldName(view, seen.ship.at)}, ${ago(view.week, seen.observed)}` : 'never seen'}</span>
              {entry.commanderName !== null && (
                <button
                  type="button"
                  className="small"
                  onClick={(e) => {
                    e.stopPropagation()
                    onOrders(entry.id)
                  }}
                >
                  Give orders…
                </button>
              )}
            </div>
            <div className="line2">
              {entry.commanderName ? `Commander ${entry.commanderName}` : <span className="warn">Prize — no crew. Send an officer out to take command.</span>}
              {seen && (seen.ship.hulk || seen.ship.damaged) && <span className="warn">{conditionText(seen.ship)}</span>}
              {seen && !isGovernmentHouseObservation(seen.report) && (
                <>
                  {' '}
                  ·{' '}
                  <button
                    type="button"
                    className="link"
                    onClick={(e) => {
                      e.stopPropagation()
                      onShowReport(seen.report)
                    }}
                  >
                    last sighting
                  </button>
                </>
              )}
            </div>
            <div className="line3">
              {order && order.payload.kind === 'order' ? (
                <>
                  Ordered {weekLabel(order.envelope.sent)}: {orderText(view, order.payload.order)}
                  {order.envelope.eta !== null && order.envelope.eta > view.week && <span className="muted"> (order lands {weekLabel(order.envelope.eta)})</span>}
                </>
              ) : (
                <span className="muted">No orders sent.</span>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
