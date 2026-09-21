/**
 * The last-known map. Every marker is drawn from the newest delivered
 * report about that world, and carries the age of that report. Colour is
 * who the desk believes holds the world; age is the badge above it and a
 * dashed outline once the word is old. The lane chart and world positions
 * are public; everything else is belief.
 */
import { SUBSECTOR_COLS, SUBSECTOR_ROWS, hexLabel, type Hex } from '../sim/hex'
import type { PlayerView, WorldId } from '../sim/view'
import { ago, freshness, stateOf } from './format'
import { H, HEIGHT, SIZE, WIDTH, hexCenter, hexPoints, type Overlay } from './geometry'

interface Props {
  view: PlayerView
  selected: WorldId | null
  onSelect: (id: WorldId) => void
  overlay?: Overlay | null
}

export function Map({ view, selected, onSelect, overlay }: Props) {
  const grid: Hex[] = []
  for (let col = 1; col <= SUBSECTOR_COLS; col++) for (let row = 1; row <= SUBSECTOR_ROWS; row++) grid.push({ col, row })

  // Ships last seen at each world, from delivered reports.
  const shipsSeen: Record<string, number> = {}
  for (const s of Object.values(view.known.ships)) shipsSeen[s.ship.at] = (shipsSeen[s.ship.at] ?? 0) + 1

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

      <g className="worlds">
        {Object.values(view.chart).map((entry) => {
          const { x, y } = hexCenter(entry.hex)
          const report = view.known.worlds[entry.id]
          const snap = report?.snapshot.kind === 'world' ? report.snapshot.world : null
          const isCapital = entry.id === view.capital
          const fresh = report ? freshness(view.week, report.observed) : 'ancient'
          const port = snap?.profile.starport ?? '?'
          const radius = port === 'A' ? 9 : port === 'B' ? 8 : port === 'C' ? 7 : 6
          const ships = shipsSeen[entry.id] ?? 0
          const state = snap ? stateOf(view, snap) : 'unknown'
          const cls = ['world', fresh, state, isCapital ? 'capital' : '', selected === entry.id ? 'selected' : ''].join(' ')
          return (
            <g key={entry.id} className={cls} onClick={() => onSelect(entry.id)} style={{ cursor: 'pointer' }}>
              {selected === entry.id && <polygon points={hexPoints(x, y, SIZE - 2)} className="halo" />}
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
                  the desk
                </text>
              )}
              {ships > 0 && (
                <g className="ships">
                  {Array.from({ length: Math.min(ships, 3) }, (_, i) => (
                    <polygon key={i} points={`${x + radius + 3 + i * 5},${y - 3} ${x + radius + 7 + i * 5},${y} ${x + radius + 3 + i * 5},${y + 3}`} />
                  ))}
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
