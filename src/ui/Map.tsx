/**
 * The last-known map. Every marker is drawn from the newest delivered
 * report about that world, and carries the age of that report. Colour is
 * who Government House believes holds the world; age is the badge above it and a
 * dashed outline once the word is old. Hulls are drawn where they were
 * last seen, in the colours they flew; a hull picked out is ringed and,
 * if it is ours, the run its orders describe is drawn. The lane chart and
 * world positions are public; everything else is belief — as of the week
 * the view says, which may be a week gone by.
 */
import { SUBSECTOR_COLS, SUBSECTOR_ROWS, hexLabel, type Hex } from '../sim/hex'
import { hexRoute, route, type PlayerView, type Sighting, type WorldId } from '../sim/view'
import { ago, coloursOf, freshness, hullKind, lastOrderSent, orderStops, stateOf } from './format'
import { H, HEIGHT, SIZE, WIDTH, hexCenter, hexPoints, type Overlay } from './geometry'
import type { Selection } from './selection'

interface Props {
  view: PlayerView
  selected: Selection | null
  onSelect: (s: Selection) => void
  overlay?: Overlay | null
}

/** How many hulls are drawn beside a world before the rest are counted. */
const SHOWN = 5

function triangle(x: number, y: number, r: number): string {
  return `${x},${y - r} ${x + r * 1.2},${y} ${x},${y + r}`
}

export function Map({ view, selected, onSelect, overlay }: Props) {
  const grid: Hex[] = []
  for (let col = 1; col <= SUBSECTOR_COLS; col++) for (let row = 1; row <= SUBSECTOR_ROWS; row++) grid.push({ col, row })

  const chosenShip = selected?.kind === 'ship' ? selected.id : null

  // Hulls last seen at each world, ours first, then by name. The order never changes with the selection, so the ring lands on the triangle that was clicked.
  const shipsSeen: Record<string, Sighting[]> = {}
  for (const s of Object.values(view.known.ships)) (shipsSeen[s.ship.at] ??= []).push(s)
  for (const pile of Object.values(shipsSeen)) {
    pile.sort((a, b) => Number(b.ship.faction === view.faction) - Number(a.ship.faction === view.faction) || (a.ship.name < b.ship.name ? -1 : 1))
  }
  const havens = new Set(view.havens)
  const lanes = Object.fromEntries(view.lanes.map((l) => [l.id, l]))

  // The run the selected hull's orders describe, from where she was last seen.
  const roster = chosenShip ? view.roster.find((r) => r.id === chosenShip) : null
  const order = chosenShip && roster ? lastOrderSent(view, chosenShip)?.payload : null
  const run: WorldId[] = []
  if (roster && order?.kind === 'order') {
    let from: WorldId = view.known.ships[roster.id]?.ship.at ?? view.capital
    run.push(from)
    for (const stop of orderStops(order.order)) {
      if (stop === from) continue
      const leg = route(lanes, from, stop) ?? hexRoute(view.chart, from, stop, roster.jump) ?? [from, stop]
      run.push(...leg.slice(1))
      from = stop
    }
  }

  return (
    <svg className="map" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Subsector map">
      <g className="grid">
        {grid.map((h) => {
          const { x, y } = hexCenter(h)
          return (
            <g key={hexLabel(h)}>
              <polygon points={hexPoints(x, y, SIZE - 1)} />
              <text x={x} y={y - H / 2 + 9} className="hexlabel">
                {hexLabel(h)}
              </text>
            </g>
          )
        })}
      </g>

      <g className="lanes">
        {view.lanes.map((l) => {
          const a = view.chart[l.ends[0]]
          const b = view.chart[l.ends[1]]
          if (!a || !b) return null
          const p = hexCenter(a.hex)
          const q = hexCenter(b.hex)
          return (
            <line key={l.id} x1={p.x} y1={p.y} x2={q.x} y2={q.y} className={l.schedule.interval <= 2 ? 'fast' : 'slow'}>
              <title>
                {a.name} – {b.name}: packet every {l.schedule.interval} wk
              </title>
            </line>
          )
        })}
      </g>

      {run.length > 1 && (
        <g className="run">
          <polyline points={run.map((id) => view.chart[id]).filter(Boolean).map((e) => { const c = hexCenter(e.hex); return `${c.x},${c.y}` }).join(' ')} />
          {run.slice(1).map((id, i) => {
            const entry = view.chart[id]
            if (!entry) return null
            const { x, y } = hexCenter(entry.hex)
            return <circle key={`${id}-${i}`} cx={x} cy={y} r={SIZE - 4} />
          })}
        </g>
      )}

      <g className="worlds">
        {Object.values(view.chart).map((entry) => {
          const { x, y } = hexCenter(entry.hex)
          const report = view.known.worlds[entry.id]
          const snap = report?.snapshot.kind === 'world' ? report.snapshot.world : null
          const isCapital = entry.id === view.capital
          const fresh = report ? freshness(view.week, report.observed) : 'ancient'
          const port = snap?.profile.starport ?? '?'
          const radius = port === 'A' ? 9 : port === 'B' ? 8 : port === 'C' ? 7 : 6
          const pile = shipsSeen[entry.id] ?? []
          // The first few, plus the chosen hull if she is further down the row: she is drawn at the end so the ring has something to sit on.
          const hidden = pile.slice(SHOWN)
          const ships = [...pile.slice(0, SHOWN), ...hidden.filter((s) => s.ship.id === chosenShip)]
          const more = hidden.filter((s) => s.ship.id !== chosenShip).length
          const state = snap ? stateOf(view, snap) : 'unknown'
          const isSelected = selected?.kind === 'world' && selected.id === entry.id
          const cls = ['world', fresh, state, isCapital ? 'capital' : '', isSelected ? 'selected' : '', havens.has(entry.id) ? 'haven' : ''].join(' ')
          return (
            <g key={entry.id} className={cls}>
              <g onClick={() => onSelect({ kind: 'world', id: entry.id })} style={{ cursor: 'pointer' }}>
                {isSelected && <polygon points={hexPoints(x, y, SIZE - 2)} className="halo" />}
                {havens.has(entry.id) && <circle cx={x} cy={y} r={radius + 4} className="haven-ring" />}
                <circle cx={x} cy={y} r={radius} />
                <text x={x} y={y + 3.5} className="port">
                  {port}
                </text>
                <text x={x} y={y + H / 2 - 4} className="name">
                  {entry.name}
                </text>
                {!isCapital && report && (
                  <text x={x} y={y - radius - 3} className="age">
                    {ago(view.week, report.observed)}
                  </text>
                )}
                {isCapital && (
                  <text x={x} y={y - radius - 3} className="age">
                    {view.week === report?.observed ? 'Government House' : ago(view.week, report?.observed ?? view.week)}
                  </text>
                )}
              </g>
              {ships.length > 0 && (
                <g className="ships">
                  {ships.map((s, i) => {
                    const chosen = chosenShip === s.ship.id
                    const sx = x + radius + 4 + i * 6
                    return (
                      <g key={s.ship.id} className={[coloursOf(view, s.ship.faction), chosen ? 'chosen' : ''].join(' ')} onClick={() => onSelect({ kind: 'ship', id: s.ship.id })} style={{ cursor: 'pointer' }}>
                        {chosen && <circle cx={sx + 2} cy={y} r={6} className="ring" />}
                        <polygon points={triangle(sx, y, 3.5)}>
                          <title>
                            {s.ship.name} ({hullKind(view, s.ship)}), seen {ago(view.week, s.observed)}
                          </title>
                        </polygon>
                      </g>
                    )
                  })}
                  {more > 0 && (
                    <text x={x + radius + 4 + ships.length * 6} y={y + 3} className="more">
                      +{more}
                    </text>
                  )}
                </g>
              )}
            </g>
          )
        })}
      </g>

      {overlay && (
        <g className="overlay">
          {Object.entries(overlay.unrest).map(([id, unrest]) => {
            const entry = view.chart[id as WorldId]
            if (!entry) return null
            const { x, y } = hexCenter(entry.hex)
            return (
              <text key={id} x={x - SIZE + 6} y={y + 4} className="truth">
                {unrest}
              </text>
            )
          })}
          {overlay.ships.map((s, i) => {
            const { x, y } = hexCenter(s.hex)
            return (
              <g key={i} className={`${s.inTransit ? 'transit' : 'inport'} ${s.faction.replace('f-', '')}`}>
                <polygon points={`${x - 12 - (i % 3) * 5},${y + 9} ${x - 8 - (i % 3) * 5},${y + 12} ${x - 12 - (i % 3) * 5},${y + 15}`}>
                  <title>{s.label}</title>
                </polygon>
              </g>
            )
          })}
        </g>
      )}
    </svg>
  )
}
