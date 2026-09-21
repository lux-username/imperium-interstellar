/**
 * One world, as the Home Office knows it: the newest report, its age, who holds
 * the world in that telling, the hulls last seen there, every report ever
 * received about it, and the things the player can do — write to its
 * governor, or send a hull.
 */
import { hexLabel } from '../sim/hex'
import { expectedArrival, isHomeObservation, nextDeparture, route, type CharacterId, type PlayerView, type ReportId, type ShipId, type WorldId } from '../sim/view'
import { ago, conditionText, eventText, holderText, hullKind, profileString, sailsText, signature, stateOf, weekLabel, worldName } from './format'

interface Props {
  /** The picture being shown: the present, or what the Home Office now knows of an earlier week. */
  view: PlayerView
  /** The present, for the timetable and the Home Office's own mail, which are not a matter of belief. */
  now: PlayerView
  world: WorldId
  onRequest: (world: WorldId, governor: CharacterId) => void
  /** Open the orders dialog with this world as the destination. */
  onOrders: (world: WorldId) => void
  onSelectShip: (ship: ShipId) => void
  /** Show the report a claim rests on. */
  onShowReport: (id: ReportId) => void
}

export function Dossier({ view, now, world, onRequest, onOrders, onSelectShip, onShowReport }: Props) {
  const entry = view.chart[world]
  const report = view.known.worlds[world]
  const snap = report?.snapshot.kind === 'world' ? report.snapshot.world : null
  const isCapital = world === view.capital
  const lanes = Object.fromEntries(view.lanes.map((l) => [l.id, l]))
  const path = route(lanes, view.capital, world)
  const eta = path ? expectedArrival(lanes, path, now.week + 1) : null
  const replyEta = path && eta !== null ? expectedArrival(lanes, [...path].reverse(), eta) : null
  const state = snap ? stateOf(view, snap) : null
  const ours = snap?.faction === view.faction
  const haven = view.havens.includes(world)

  const shipsHere = Object.values(view.known.ships)
    .filter((s) => s.ship.at === world)
    .sort((a, b) => b.observed - a.observed || (a.ship.name < b.ship.name ? -1 : 1))
  const history = now.inbox.filter((r) => r.snapshot.kind === 'world' && r.snapshot.world.id === world)
  const talk = now.rumours.filter((r) => r.snapshot.kind === 'event' && r.snapshot.event.at === world)
  const pending = now.outgoing.filter((d) => d.envelope.destination.kind === 'world' && d.envelope.destination.world === world)
  const touching = view.lanes.filter((l) => l.ends.includes(world))
  // What prisoners have said about this world, and what a captain saw. Not all of the former is true.
  const named = now.inbox.flatMap((r) => r.events.filter((e) => (e.kind === 'haven_named' || e.kind === 'pirates_harboured') && e.at === world).map((e) => ({ report: r, event: e })))

  return (
    <div className="dossier">
      <h3>
        {entry?.name ?? world} <span className="muted">{entry ? hexLabel(entry.hex) : ''}</span>
        {isCapital && <span className="tag">capital</span>}
        {state && !isCapital && <span className={`tag ${state}`}>{state === 'warlord' ? 'Warlord' : state}</span>}
        {haven && <span className="tag pirates">pirate haven</span>}
      </h3>

      {!snap && <p className="empty">No report about this world has ever reached the Home Office.</p>}
      {snap && report && (
        <>
          <p className="asof">
            {isCapital && (report.observed === now.week ? 'Seen directly from the Home Office.' : `As seen from the Home Office, ${weekLabel(report.observed)}.`)}
            {!isCapital && isHomeObservation(report.id) && `As of ${weekLabel(report.observed)} — ${ago(view.week, report.observed)}, from ${signature(report)}.`}
            {!isCapital && !isHomeObservation(report.id) && (
              <>
                As of {weekLabel(report.observed)} — {ago(view.week, report.observed)}, reported by {signature(report)}
                {report.channel === 'agent' ? ' (a scout’s watch: nothing shaded)' : ''}.{' '}
                <button type="button" className="link" onClick={() => onShowReport(report.id)}>
                  show report
                </button>
              </>
            )}
          </p>
          <dl>
            <dt>Held</dt>
            <dd className={state === 'revolt' || state === 'contested' || state === 'warlord' || state === 'independent' ? 'warn' : ''}>{holderText(view, snap)}</dd>
            <dt>Profile</dt>
            <dd>
              {profileString(snap.profile)} <span className="muted">(port · size · atmo · hydro · pop · gov · law – tech)</span>
            </dd>
            <dt>Governor</dt>
            <dd>{snap.governorName ?? <span className="muted">none — unpopulated</span>}</dd>
            <dt>Garrison</dt>
            <dd>
              {snap.garrison} army{snap.marines > 0 ? `, ${snap.marines} marine` : ''} <span className="muted">detachments</span>
              {isCapital && <span className="muted"> — the Home Office’s reserve; transports draw on it</span>}
            </dd>
            <dt>Route</dt>
            <dd>
              {isCapital && 'This is the Home Office.'}
              {!isCapital && !path && <span className="warn">Off the lanes. No packet calls here; nothing will arrive unless a hull is sent.</span>}
              {!isCapital && path && (
                <>
                  {path.length - 1} jump{path.length - 1 === 1 ? '' : 's'} via {path.slice(1, -1).map((id) => worldName(view, id)).join(', ') || 'direct lane'}.
                  {eta !== null && ours && (
                    <>
                      {' '}
                      A letter posted now should land {weekLabel(eta)}
                      {replyEta !== null && <>; the reply by {weekLabel(replyEta)}</>}.
                    </>
                  )}
                  {!ours && <span className="warn"> The port is closed to our packets while it is held against us.</span>}
                </>
              )}
            </dd>
            {touching.length > 0 && (
              <>
                <dt>Packets</dt>
                <dd>
                  {touching.map((l) => {
                    const other = l.ends[0] === world ? l.ends[1] : l.ends[0]
                    return (
                      <div key={l.id}>
                        to {worldName(view, other)} every {l.schedule.interval} wk; {sailsText(now.week, nextDeparture(l, world, now.week))}
                      </div>
                    )
                  })}
                </dd>
              </>
            )}
          </dl>
        </>
      )}

      {!isCapital && snap?.governor && path && ours && (
        <div className="actions">
          <button type="button" onClick={() => onRequest(world, snap.governor as CharacterId)}>
            Write to Governor {snap.governorName} for a report
          </button>
          {pending.length > 0 && (
            <ul className="pending">
              {pending.map((d) => (
                <li key={d.id}>
                  {d.payload.kind === 'letter' ? 'Letter' : 'Orders'} sent {weekLabel(d.envelope.sent)}, expected to land {d.envelope.eta !== null ? weekLabel(d.envelope.eta) : 'never'}.
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {!isCapital && (
        <div className="actions">
          <button type="button" onClick={() => onOrders(world)}>
            Send a hull here…
          </button>
        </div>
      )}

      {shipsHere.length > 0 && (
        <>
          <h4>Hulls last seen here</h4>
          <ul className="ships">
            {shipsHere.map((s) => (
              <li key={s.ship.id}>
                <button type="button" className="link" onClick={() => onSelectShip(s.ship.id)}>
                  {s.ship.name}
                </button>{' '}
                <span className="muted">
                  ({hullKind(view, s.ship)}
                  {conditionText(s.ship)}) — {weekLabel(s.observed)}, {ago(view.week, s.observed)}
                </span>{' '}
                {isHomeObservation(s.report) ? (
                  <span className="muted">(seen from the Home Office)</span>
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
                <span className="muted">obs. {weekLabel(r.observed)}, arrived {weekLabel(r.delivered ?? 0)}, {signature(r)}:</span>{' '}
                {r.events.length > 0 ? r.events.map(eventText).join(' ') : `${holderText(view, r.snapshot.world)}, garrison ${r.snapshot.world.garrison + r.snapshot.world.marines}, Governor ${r.snapshot.world.governorName ?? '—'}`}{' '}
                <button type="button" className="link" onClick={() => onShowReport(r.id)}>
                  show
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {named.length > 0 && (
        <>
          <h4>Pirates and this port</h4>
          <ul className="history">
            {named.map(({ report: r, event: e }) => (
              <li key={`${r.id}-${e.id}`}>
                <span className="muted">{weekLabel(e.week)}, {signature(r)}:</span> {e.kind === 'haven_named' ? `${e.person ?? 'prisoners'} named this world as a haven under questioning.` : eventText(e)}{' '}
                <button type="button" className="link" onClick={() => onShowReport(r.id)}>
                  show
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {talk.length > 0 && (
        <>
          <h4>What the docks say</h4>
          <ul className="history">
            {talk.map((r) => r.snapshot.kind === 'event' && (
              <li key={r.id}>
                <span className="muted">around {weekLabel(r.observed)}, heard {weekLabel(r.delivered ?? 0)}:</span> {eventText(r.snapshot.event)}{' '}
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
