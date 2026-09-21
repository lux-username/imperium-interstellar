/**
 * Dispatches the player has sent. Their fate is unknown: the Home Office sees only
 * when they left and when the timetable says they should land.
 */
import type { PlayerView, WorldId } from '../sim/view'
import { orderText, weekLabel, worldName } from './format'

interface Props {
  view: PlayerView
  onSelect: (world: WorldId) => void
}

export function Outgoing({ view, onSelect }: Props) {
  if (view.outgoing.length === 0) return <p className="empty">Nothing sent. Open a world's dossier to write to its governor.</p>
  return (
    <ul className="outgoing">
      {view.outgoing.map((d) => {
        const to = d.envelope.destination.kind === 'world' ? d.envelope.destination.world : null
        const landed = d.envelope.eta !== null && d.envelope.eta <= view.week
        return (
          <li key={d.id} onClick={() => to && onSelect(to)}>
            <div className="line1">
              <span className="subject">{to ? worldName(view, to) : 'rally point'}</span>
              <span className="arrived">{landed ? 'should have landed' : 'in the post'}</span>
            </div>
            <div className="line2">
              {d.payload.kind === 'letter' ? 'Letter' : d.payload.kind === 'order' ? 'Orders' : d.payload.kind} · sent {weekLabel(d.envelope.sent)} · expected {d.envelope.eta !== null ? weekLabel(d.envelope.eta) : 'never'} · via{' '}
              {d.envelope.route.slice(1).map((id) => worldName(view, id)).join(' → ') || '—'}
            </div>
            {d.payload.kind === 'letter' && <div className="line3">“{d.payload.text}”</div>}
            {d.payload.kind === 'order' && (
              <div className="line3">
                To {view.roster.find((r) => r.id === (d.payload as { ship: string }).ship)?.name ?? d.payload.ship}: {orderText(view, d.payload.order)}
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
