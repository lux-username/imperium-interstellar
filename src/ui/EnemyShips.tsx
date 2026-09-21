/**
 * Every hull not our own that a report has ever placed somewhere: whose
 * she is, what she is, and where and when she was last seen. Newest word
 * first. A row opens her dossier, with every report that mentions her.
 */
import { isDeskObservation, mentionsShip, type PlayerView, type ReportId, type ShipId } from '../sim/view'
import { ago, coloursOf, conditionText, hullKind, weekLabel, worldName } from './format'

interface Props {
  view: PlayerView
  onSelect: (ship: ShipId) => void
  onShowReport: (id: ReportId) => void
}

export function EnemyShips({ view, onSelect, onShowReport }: Props) {
  const seen = Object.values(view.known.ships)
    .filter((s) => s.ship.faction !== view.faction)
    .sort((a, b) => b.observed - a.observed || (a.ship.name < b.ship.name ? -1 : 1))
  if (seen.length === 0) return <p className="empty">No hull of another flag has been reported yet.</p>
  return (
    <ul className="fleet enemies">
      {seen.map((s) => {
        const n = view.inbox.filter((r) => mentionsShip(r, s.ship.id)).length
        return (
          <li key={s.ship.id} className={coloursOf(view, s.ship.faction)} onClick={() => onSelect(s.ship.id)}>
            <div className="line1">
              <span className="subject">
                <i className="swatch" />
                {s.ship.name}
              </span>
              <span className="muted">
                {hullKind(view, s.ship)}
                {conditionText(s.ship)}
              </span>
              <span className="arrived">
                {worldName(view, s.ship.at)}, {weekLabel(s.observed)} ({ago(view.week, s.observed)})
              </span>
            </div>
            <div className="line2 muted">
              {n} report{n === 1 ? '' : 's'} mention her
              {!isDeskObservation(s.report) && (
                <>
                  {' '}
                  ·{' '}
                  <button
                    type="button"
                    className="link"
                    onClick={(e) => {
                      e.stopPropagation()
                      onShowReport(s.report)
                    }}
                  >
                    last sighting
                  </button>
                </>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
