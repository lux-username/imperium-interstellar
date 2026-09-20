/**
 * The inbox: every report that has reached the desk, each stamped with
 * where and when it was observed, when it was sent, and when it arrived.
 * This week's arrivals are highlighted. Sortable by arrival or observation.
 */
import { useState } from 'react'
import type { PlayerView, Report } from '../sim/view'
import { ago, subjectName, subjectWorld, unrestWord, weekLabel, worldName } from './format'

interface Props {
  view: PlayerView
  onSelect: (world: Report['observedAt']) => void
}

type Sort = 'arrived' | 'observed'

export function Inbox({ view, onSelect }: Props) {
  const [sort, setSort] = useState<Sort>('arrived')
  const [onlyNew, setOnlyNew] = useState(false)

  let reports = view.inbox
  if (onlyNew) reports = reports.filter((r) => r.delivered === view.week)
  if (sort === 'observed') reports = [...reports].sort((a, b) => b.observed - a.observed || (b.delivered ?? 0) - (a.delivered ?? 0))

  const fresh = view.inbox.filter((r) => r.delivered === view.week).length

  return (
    <div className="inbox-pane">
      <div className="toolbar">
        <span className="count">{fresh} new this week</span>
        <label>
          <input type="checkbox" checked={onlyNew} onChange={(e) => setOnlyNew(e.target.checked)} /> new only
        </label>
        <span className="sort">
          sort:{' '}
          <button type="button" className={sort === 'arrived' ? 'on' : ''} onClick={() => setSort('arrived')}>
            arrival
          </button>{' '}
          <button type="button" className={sort === 'observed' ? 'on' : ''} onClick={() => setSort('observed')}>
            observation
          </button>
        </span>
      </div>
      {reports.length === 0 && <p className="empty">Nothing has arrived yet. Advance the week.</p>}
      <ul className="reports">
        {reports.map((r) => (
          <li key={r.id} className={r.delivered === view.week ? 'new' : ''} onClick={() => onSelect(subjectWorld(r))}>
            <div className="line1">
              <span className="kind">{r.snapshot.kind === 'world' ? '◉' : '▲'}</span>
              <span className="subject">{subjectName(r)}</span>
              <span className="arrived">arrived {weekLabel(r.delivered ?? 0)}</span>
            </div>
            <div className="line2">
              from {r.observerName} at {worldName(view, r.observedAt)} · observed {weekLabel(r.observed)} ({ago(view.week, r.observed)}) · sent {weekLabel(r.envelope.sent)}
              {r.delivered !== null && r.delivered - r.observed > 0 && <> · {r.delivered - r.observed} wk in transit</>}
            </div>
            <div className="line3">{summary(r)}</div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function summary(r: Report): string {
  if (r.snapshot.kind === 'world') {
    const w = r.snapshot.world
    const gov = w.governorName ? `Governor ${w.governorName}` : 'no governor'
    return `${gov}. The world is ${unrestWord(w.unrest)} (unrest ${w.unrest}); garrison strength ${w.garrison}. Starport ${w.profile.starport}.`
  }
  const s = r.snapshot.ship
  return `${s.name}, a ${s.role}, was in port.`
}
