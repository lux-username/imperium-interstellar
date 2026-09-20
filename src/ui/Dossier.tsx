/**
 * One world, as the desk knows it: the newest report, its age, the hulls
 * last seen there, every report ever received about it, and the one thing
 * the player can do — write to its governor and ask for news.
 */
import { hexLabel } from '../sim/hex'
import { expectedArrival, route, type CharacterId, type Order, type PlayerView, type ReportId, type ShipId, type WorldId } from '../sim/view'
import { ago, eventText, profileString, unrestWord, weekLabel, worldName } from './format'
import { OrderForm } from './OrderForm'

interface Props {
  view: PlayerView
  world: WorldId | null
  onRequest: (world: WorldId, governor: CharacterId) => void
  onOrder: (ship: ShipId, order: Order) => void
  /** Show the report a claim rests on. */
  onShowReport: (id: ReportId) => void
}

/** Reports the desk made itself (the capital, seen directly) have no message behind them. */
function isDeskObservation(id: ReportId): boolean {
  return id.startsWith('r-desk-') || id.startsWith('r-survey-')
}

export function Dossier({ view, world, onRequest, onOrder, onShowReport }: Props) {
  if (!world) return <p className="empty">Select a world on the map or a report in the inbox.</p>
  const entry = view.chart[world]
  const report = view.known.worlds[world]
  const snap = report?.snapshot.kind === 'world' ? report.snapshot.world : null
  const isCapital = world === view.capital
  const lanes = Object.fromEntries(view.lanes.map((l) => [l.id, l]))
  const path = route(lanes, view.capital, world)
  const eta = path ? expectedArrival(lanes, path, view.week + 1) : null
  const replyEta = path && eta !== null ? expectedArrival(lanes, [...path].reverse(), eta) : null

  const shipsHere = Object.values(view.known.ships)
    .filter((s) => s.ship.at === world)
    .sort((a, b) => b.observed - a.observed || (a.ship.name < b.ship.name ? -1 : 1))
  const history = view.inbox.filter((r) => r.snapshot.kind === 'world' && r.snapshot.world.id === world)
  const pending = view.outgoing.filter((d) => d.envelope.destination.kind === 'world' && d.envelope.destination.world === world)

  return (
    <div className="dossier">
      <h3>
        {entry?.name ?? world} <span className="muted">{entry ? hexLabel(entry.hex) : ''}</span>
        {isCapital && <span className="tag">capital</span>}
      </h3>

      {!snap && <p className="empty">No report about this world has ever reached the desk.</p>}
      {snap && report && (
        <>
          <p className="asof">
            {isCapital && 'Seen directly from the desk.'}
            {!isCapital && isDeskObservation(report.id) && `As of ${weekLabel(report.observed)} — ${ago(view.week, report.observed)}, from ${report.observerName}.`}
            {!isCapital && !isDeskObservation(report.id) && (
              <>
                As of {weekLabel(report.observed)} — {ago(view.week, report.observed)}, reported by {report.observerName}.{' '}
                <button type="button" className="link" onClick={() => onShowReport(report.id)}>
                  show report
                </button>
              </>
            )}
          </p>
          <dl>
            <dt>Profile</dt>
            <dd>
              {profileString(snap.profile)} <span className="muted">(port · size · atmo · hydro · pop · gov · law – tech)</span>
            </dd>
            <dt>Governor</dt>
            <dd>{snap.governorName ?? <span className="muted">none — unpopulated</span>}</dd>
            <dt>Unrest</dt>
            <dd className={snap.unrest >= 6 ? 'warn' : ''}>
              {snap.unrest} — {unrestWord(snap.unrest)}
            </dd>
            <dt>Garrison</dt>
            <dd>{snap.garrison}</dd>
            <dt>Route</dt>
            <dd>
              {isCapital && 'This is the desk.'}
              {!isCapital && !path && <span className="warn">Off the lanes. No packet calls here; nothing will arrive unless a hull is sent.</span>}
              {!isCapital && path && (
                <>
                  {path.length - 1} jump{path.length - 1 === 1 ? '' : 's'} via {path.slice(1, -1).map((id) => worldName(view, id)).join(', ') || 'direct lane'}.
                  {eta !== null && (
                    <>
                      {' '}
                      A letter posted now should land {weekLabel(eta)}
                      {replyEta !== null && <>; the reply by {weekLabel(replyEta)}</>}.
                    </>
                  )}
                </>
              )}
            </dd>
          </dl>
        </>
      )}

      {!isCapital && snap?.governor && path && (
        <div className="actions">
          <button type="button" onClick={() => onRequest(world, snap.governor as CharacterId)}>
            Write to Governor {snap.governorName} for a report
          </button>
          {pending.length > 0 && (
            <ul className="pending">
              {pending.map((d) => (
                <li key={d.id}>
                  Letter sent {weekLabel(d.envelope.sent)}, expected to land {d.envelope.eta !== null ? weekLabel(d.envelope.eta) : 'never'}.
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {!isCapital && <OrderForm view={view} world={world} onOrder={onOrder} />}

      {shipsHere.length > 0 && (
        <>
          <h4>Hulls last seen here</h4>
          <ul className="ships">
            {shipsHere.map((s) => (
              <li key={s.ship.id}>
                {s.ship.name} <span className="muted">({s.ship.role}) — {ago(view.week, s.observed)}</span>{' '}
                {isDeskObservation(s.report) ? (
                  <span className="muted">(seen from the desk)</span>
                ) : (
                  <button type="button" className="link" onClick={() => onShowReport(s.report)}>
                    show report
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {history.length > 0 && (
        <>
          <h4>Reports received</h4>
          <ul className="history">
            {history.map((r) => r.snapshot.kind === 'world' && (
              <li key={r.id}>
                <span className="muted">obs. {weekLabel(r.observed)}, arrived {weekLabel(r.delivered ?? 0)}, {r.observerName}:</span>{' '}
                {r.events.length > 0 ? r.events.map(eventText).join(' ') : `unrest ${r.snapshot.world.unrest}, garrison ${r.snapshot.world.garrison}, Governor ${r.snapshot.world.governorName ?? '—'}`}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
