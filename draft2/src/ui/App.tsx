/**
 * Keel-phase shell: a seed, the generated subsector drawn in god view, and
 * the list of worlds by empire. This is a developer's view of ground truth
 * and nothing in it survives into the game proper, where the UI reads only
 * the player's belief.
 */
import { useMemo, useState } from 'react'
import { generateSubsector } from '../sim/generate'
import { hexLabel, SUBSECTOR_COLS, SUBSECTOR_ROWS, type Hex } from '../sim/hex'
import { createRng } from '../sim/rng'
import { profileString } from '../sim/generate'

const R = 28
const H = Math.sqrt(3) * R

/** Flat-top hexes, odd columns shoved half a hex down, as ./sim/hex.ts assumes. */
function centre({ col, row }: Hex): [number, number] {
  return [R + (col - 1) * 1.5 * R, H / 2 + (row - 1) * H + (col % 2 === 1 ? H / 2 : 0) + H / 2]
}

const COLOURS = ['var(--e0)', 'var(--e1)', 'var(--e2)']

export function App() {
  const [seed, setSeed] = useState(1)
  const g = useMemo(() => generateSubsector(createRng(seed)), [seed])
  const empires = Object.values(g.empires)
  const colour = (empire: string) => COLOURS[empires.findIndex((e) => e.id === empire)] ?? 'white'
  const width = R + (SUBSECTOR_COLS - 1) * 1.5 * R + R
  const height = (SUBSECTOR_ROWS + 1) * H + H / 2

  return (
    <>
      <header>
        <h1>Imperium Interstellar — draft 2, keel</h1>
        <label>
          seed <input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value) || 0)} />
        </label>
        <span className="note">god view: ground truth, for development only · layout took {g.tries} {g.tries === 1 ? 'try' : 'tries'}</span>
      </header>
      <main>
        <svg viewBox={`0 0 ${width} ${height}`}>
          {Object.values(g.lanes).map((l) => {
            const [x1, y1] = centre(g.worlds[l.ends[0]].hex)
            const [x2, y2] = centre(g.worlds[l.ends[1]].hex)
            return <line key={l.id} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--lane)" strokeWidth={l.jumpDistance === 3 ? 1 : 2} strokeDasharray={l.jumpDistance === 3 ? '4 3' : undefined} />
          })}
          {Object.values(g.worlds).map((w) => {
            const [x, y] = centre(w.hex)
            const seat = empires.some((e) => e.seat === w.id)
            return (
              <g key={w.id}>
                <circle cx={x} cy={y} r={seat ? 8 : 5} fill={colour(w.empire)} stroke={seat ? 'white' : 'none'} strokeWidth={2} />
                <text x={x} y={y + 18} textAnchor="middle" fontSize={9} fill="var(--fg)">
                  {w.name}
                </text>
                <text x={x} y={y - 11} textAnchor="middle" fontSize={7} fill="var(--muted)">
                  {w.profile.starport}
                </text>
              </g>
            )
          })}
        </svg>
        <div className="worlds">
          {empires.map((e, i) => (
            <section key={e.id}>
              <h2 style={{ color: COLOURS[i], fontSize: 14, fontWeight: 'normal' }}>
                {e.name} · seat {g.worlds[e.seat].name} · capital {e.capitalWeeks} weeks away
              </h2>
              <ul style={{ padding: 0, margin: 0 }}>
                {Object.values(g.worlds)
                  .filter((w) => w.empire === e.id)
                  .sort((a, b) => (a.id < b.id ? -1 : 1))
                  .map((w) => (
                    <li key={w.id}>
                      {w.name} <code>{hexLabel(w.hex)} {profileString(w.profile)}</code>
                    </li>
                  ))}
              </ul>
            </section>
          ))}
        </div>
      </main>
    </>
  )
}
