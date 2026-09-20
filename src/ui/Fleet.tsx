/**
 * The desk's books: every hull it commands, where each was last seen and
 * by whom, and the last order sent to it. Nothing here is the truth about
 * where a ship is; it is the newest report and the desk's own mail.
 */
import type { PlayerView, ReportId, ShipId, WorldId } from '../sim/view'
import { ago, lastOrderSent, orderText, weekLabel, worldName } from './format'

interface Props {
  view: PlayerView
  onSelect: (world: WorldId) => void
  onShowReport: (id: ReportId) => void
  /** Open the orders dialog with this hull chosen. */
  onOrders: (ship: ShipId) => void
}

function isDeskObservation(id: ReportId): boolean {
  return id.startsWith('r-desk-') || id.startsWith('r-survey-')
}

export function Fleet({ view, onSelect, onShowReport, onOrders }: Props) {
  if (view.roster.length === 0) return <p className="empty">No hulls on the books.</p>
  return (
    <ul className="fleet">
      {view.roster.map((entry) => {
        const seen = view.known.ships[entry.id]
        const order = lastOrderSent(view, entry.id)
        return (
          <li key={entry.id} onClick={() => seen && onSelect(seen.ship.at)}>
            <div className="line1">
              <span className="subject">{entry.name}</span>
              <span className="muted">
                {entry.role}, J-{entry.jump}
              </span>
              <span className="arrived">{seen ? `${worldName(view, seen.ship.at)}, ${ago(view.week, seen.observed)}` : 'never seen'}</span>
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
            </div>
            <div className="line2">
              {entry.commanderName ? `Commander ${entry.commanderName}` : 'No commander'}
              {seen && !isDeskObservation(seen.report) && (
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
