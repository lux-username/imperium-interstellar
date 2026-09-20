/**
 * The inbox: every report that has reached the desk. Each row starts
 * compressed — who wrote it, a subject line, when it was sent and when it
 * arrived — and opens on click to show the full stamps and the report.
 * This week's arrivals are highlighted. Sortable by arrival or observation.
 */
import { useEffect, useRef, useState } from 'react'
import type { PlayerView, Report, ReportId, WorldId } from '../sim/view'
import { ago, eventText, subjectWorld, unrestWord, weekLabel, worldName } from './format'

interface Props {
  view: PlayerView
  onSelect: (world: WorldId) => void
  /** A report to open and scroll to, e.g. the source of a claim in the dossier. Changes each time it is requested. */
  focus: { id: ReportId; nonce: number } | null
}

type Sort = 'arrived' | 'observed'

export function Inbox({ view, onSelect, focus }: Props) {
  const [sort, setSort] = useState<Sort>('arrived')
  const [onlyNew, setOnlyNew] = useState(false)
  const [open, setOpen] = useState<Set<ReportId>>(() => new Set())
  const [seenFocus, setSeenFocus] = useState<number | null>(null)
  const rows = useRef<Record<string, HTMLLIElement | null>>({})

  // A new focus request opens its row and lifts the "new only" filter so the row is on screen.
  if (focus && focus.nonce !== seenFocus) {
    setSeenFocus(focus.nonce)
    setOpen((prev) => new Set(prev).add(focus.id))
    setOnlyNew(false)
  }

  useEffect(() => {
    if (!focus) return
    rows.current[focus.id]?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [focus])

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
            <li
              key={r.id}
              ref={(el) => {
                rows.current[r.id] = el
              }}
              className={[r.delivered === view.week ? 'new' : '', isOpen ? 'open' : '', focus?.id === r.id ? 'flash' : ''].join(' ')}
              onClick={() => toggle(r)}
            >
              <div className="line1">
                <span className="kind">{r.snapshot.kind === 'world' ? '◉' : r.snapshot.kind === 'ship' ? '▲' : '~'}</span>
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
                  {r.events.length > 0 && (
                    <ul className="events">
                      {r.events.map((e) => (
                        <li key={e.id}>{eventText(e)}</li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** One line that says what the report is about. A letter leads with what happened, if anything did. */
function subject(r: Report): string {
  if (r.snapshot.kind === 'world') {
    const w = r.snapshot.world
    if (r.events.length > 0) return `${w.name}: ${eventText(r.events[0]).replace(/\.$/, '')}${r.events.length > 1 ? ` (+${r.events.length - 1})` : ''}`
    const hulls = w.ships.length > 0 ? `, ${w.ships.length} hull${w.ships.length === 1 ? '' : 's'} in port` : ''
    return `${w.name}: ${unrestWord(w.unrest)}, garrison ${w.garrison}${hulls}`
  }
  if (r.snapshot.kind === 'ship') return `${r.snapshot.ship.name} sighted`
  return eventText(r.snapshot.event)
}

function body(r: Report): string {
  if (r.snapshot.kind === 'world') {
    const w = r.snapshot.world
    const gov = w.governorName ? `Governor ${w.governorName}` : 'no governor'
    const hulls = w.ships.length > 0 ? ` In port: ${w.ships.map((s) => `${s.name} (${s.role})`).join(', ')}.` : ' No hulls in port.'
    return `${gov}. The world is ${unrestWord(w.unrest)} (unrest ${w.unrest}); garrison strength ${w.garrison}.${hulls}`
  }
  if (r.snapshot.kind === 'ship') return `${r.snapshot.ship.name}, a ${r.snapshot.ship.role}, was seen in port.`
  return eventText(r.snapshot.event)
}
