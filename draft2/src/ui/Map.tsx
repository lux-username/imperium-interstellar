/**
 * The last-known map. Every world marker is drawn from the newest delivered
 * report about it and carries that report's age. Colour is the empire the
 * player believes holds the world; age is the badge above it. Hulls are
 * drawn where they were last seen. The player's own body is the one thing
 * drawn from certainty: they know where they are. The chart and the lanes
 * are public; everything else is belief.
 */
import { SUBSECTOR_COLS, SUBSECTOR_ROWS, hexLabel, type Hex } from '../sim/hex'
import type { PlayerView, Sighting, WorldId } from '../sim/view'
import { ago, empireClass, freshness } from './format'
import { H, HEIGHT, SIZE, WIDTH, hexCenter, hexPoints, type Overlay } from './geometry'

interface Props {
  view: PlayerView
  selected: WorldId | null
  onSelect: (w: WorldId) => void
  overlay?: Overlay | null
}

const SHOWN = 5

function triangle(x: number, y: number, r: number): string {
  return `${x},${y - r} ${x + r * 1.2},${y} ${x},${y + r}`
}

export function Map({ view, selected, onSelect, overlay }: Props) {
  const grid: Hex[] = []
  for (let col = 1; col <= SUBSECTOR_COLS; col++) for (let row = 1; row <= SUBSECTOR_ROWS; row++) grid.push({ col, row })

  const shipsSeen: Record<string, Sighting[]> = {}
  for (const s of Object.values(view.known.ships)) (shipsSeen[s.ship.at] ??= []).push(s)
  for (const pile of Object.values(shipsSeen)) pile.sort((a, b) => (a.ship.name < b.ship.name ? -1 : 1))
  const seats = new Set(Object.values(view.empires).map((e) => e.seat))

  // Where the player's body is: a world, or along a lane between two.
  let me: { x: number; y: number } | null = null
  if (view.body.kind === 'world') me = hexCenter(view.chart[view.body.world].hex)
  else {
    const a = hexCenter(view.chart[view.body.from].hex)
    const b = hexCenter(view.chart[view.body.to].hex)
    me = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
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
                {a.name} – {b.name}: scout every {l.schedule.interval} wk
              </title>
            </line>
          )
        })}
      </g>

      <g className="guildlines">
        {Object.values(view.known.lines).map((k) => {
          const a = view.chart[k.line.from]
          const b = view.chart[k.line.to]
          if (!a || !b) return null
          const p = hexCenter(a.hex)
          const q = hexCenter(b.hex)
          return (
            <g key={`${k.line.from}|${k.line.to}`} className={empireClass(view, k.line.empire)}>
              <line x1={p.x} y1={p.y} x2={q.x} y2={q.y} />
              <text x={(p.x + q.x) / 2} y={(p.y + q.y) / 2 - 4} className="age">
                guild line · {ago(view.week, k.observed)}
              </text>
              <title>
                {view.empires[k.line.empire]?.name} runs a bulk line {a.name} – {b.name}, seen {ago(view.week, k.observed)}
              </title>
            </g>
          )
        })}
      </g>

      <g className="worlds">
        {Object.values(view.chart).map((entry) => {
          const { x, y } = hexCenter(entry.hex)
          const report = view.known.worlds[entry.id]
          const snap = report?.snapshot.kind === 'world' ? report.snapshot.world : null
          const fresh = report ? freshness(view.week, report.observed) : 'ancient'
          const port = snap?.profile.starport ?? '?'
          const radius = port === 'A' ? 9 : port === 'B' ? 8 : port === 'C' ? 7 : 6
          const pile = shipsSeen[entry.id] ?? []
          const ships = pile.slice(0, SHOWN)
          const more = pile.length - ships.length
          const holder = snap ? empireClass(view, snap.empire) : 'e-none'
          const cls = ['world', fresh, holder, seats.has(entry.id) ? 'seat' : '', selected === entry.id ? 'selected' : ''].join(' ')
          return (
            <g key={entry.id} className={cls}>
              <g onClick={() => onSelect(entry.id)} style={{ cursor: 'pointer' }}>
                {selected === entry.id && <polygon points={hexPoints(x, y, SIZE - 2)} className="halo" />}
                <circle cx={x} cy={y} r={radius} />
                <text x={x} y={y + 3.5} className="port">
                  {port}
                </text>
                <text x={x} y={y + H / 2 - 4} className="name">
                  {entry.name}
                </text>
                {report && (
                  <text x={x} y={y - radius - 3} className="age">
                    {ago(view.week, report.observed)}
                  </text>
                )}
              </g>
              {ships.length > 0 && (
                <g className="ships">
                  {ships.map((s, i) => (
                    <g key={s.ship.id} className={empireClass(view, s.ship.empire)}>
                      <polygon points={triangle(x + radius + 4 + i * 6, y, 3.5)}>
                        <title>
                          {s.ship.name} ({s.ship.type}), seen {ago(view.week, s.observed)}
                        </title>
                      </polygon>
                    </g>
                  ))}
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

      {me && (
        <g className="me">
          <circle cx={me.x} cy={me.y} r={SIZE - 6} />
          <title>You</title>
        </g>
      )}

      {overlay && (
        <g className="overlay">
          {Object.entries(overlay.empires).map(([id, empire]) => {
            const entry = view.chart[id as WorldId]
            if (!entry) return null
            const { x, y } = hexCenter(entry.hex)
            return <circle key={id} cx={x} cy={y} r={SIZE - 3} className={`truth ${empireClass(view, empire as never)}`} />
          })}
          {overlay.ships.map((s, i) => {
            const { x, y } = hexCenter(s.hex)
            return (
              <g key={i} className={`${s.inTransit ? 'transit' : 'inport'} ${empireClass(view, s.empire as never)}`}>
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
