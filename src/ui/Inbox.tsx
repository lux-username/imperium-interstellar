/**
 * The inbox: every report that has reached the desk. Each row starts
 * compressed — who wrote it, a subject line, when it was sent and when it
 * arrived — and opens on click to show the full stamps and the report.
 * This week's arrivals are highlighted. Sortable by arrival or observation.
 */
import { useState } from 'react'
import type { PlayerView, Report, ReportId, WorldId } from '../sim/view'
import { ago, subjectWorld, unrestWord, weekLabel, worldName } from './format'

interface Props {
  view: PlayerView
  onSelect: (world: WorldId) => void
}

type Sort = 'arrived' | 'observed'

export function Inbox({ view, onSelect }: Props) {
  const [sort, setSort] = useState<Sort>('arrived')
  const [onlyNew, setOnlyNew] = useState(false)
  const [open, setOpen] = useState<Set<ReportId>>(() => new Set())

  let reports = view.inbox
  if (onlyNew) reports = reports.filter((r) => r.delivered === view.week)
  if (sort === 'observed') reports = [...reports].sort((a, b) => b.observed - a.observed || (b.delivered ?? 0) - (a.delivered ?? 0))

  const fresh = view.inbox.filter((r) => r.delivered === view.week).length

  const toggle = (r: Report) => {
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(r.id)) next.delete(r.id)
      else next.add(r.id)
      return next
    })
    onSelect(subjectWorld(r))
  }

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
        {reports.map((r) => {
          const isOpen = open.has(r.id)
          return (
            <li key={r.id} className={[r.delivered === view.week ? 'new' : '', isOpen ? 'open' : ''].join(' ')} onClick={() => toggle(r)}>
              <div className="line1">
                <span className="kind">{r.snapshot.kind === 'world' ? '◉' : '▲'}</span>
                <span className="subject">{subject(r)}</span>
                <span className="arrived">
                  sent {weekLabel(r.envelope.sent)} · arr. {weekLabel(r.delivered ?? 0)}
                </span>
              </div>
              <div className="from">{r.observerName}, {worldName(view, r.observedAt)}</div>
              {isOpen && (
                <>
                  <div className="line2">
                    observed {weekLabel(r.observed)} ({ago(view.week, r.observed)}) · sent {weekLabel(r.envelope.sent)} · arrived {weekLabel(r.delivered ?? 0)}
                    {r.delivered !== null && r.delivered - r.observed > 0 && <> · {r.delivered - r.observed} wk in transit</>}
                    {r.envelope.route.length > 2 && <> · via {r.envelope.route.slice(1, -1).map((id) => worldName(view, id)).join(', ')}</>}
                  </div>
                  <div className="line3">{body(r)}</div>
                </>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** One line that says what the report is about. */
function subject(r: Report): string {
  if (r.snapshot.kind === 'world') {
    const w = r.snapshot.world
    return `${w.name}: ${unrestWord(w.unrest)}, garrison ${w.garrison}`
  }
  const s = r.snapshot.ship
  return `${s.name} in port`
}

function body(r: Report): string {
  if (r.snapshot.kind === 'world') {
    const w = r.snapshot.world
    const gov = w.governorName ? `Governor ${w.governorName}` : 'no governor'
    return `${gov}. The world is ${unrestWord(w.unrest)} (unrest ${w.unrest}); garrison strength ${w.garrison}. Starport ${w.profile.starport}.`
  }
  const s = r.snapshot.ship
  return `${s.name}, a ${s.role}, was in port.`
}
