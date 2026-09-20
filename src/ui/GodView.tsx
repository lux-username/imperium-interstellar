/**
 * DEV ONLY. The single sanctioned place the UI reads ground truth, for
 * debugging propagation: truth beside belief for the selected world, true
 * ship positions, and the mail in flight. App.tsx imports this file only
 * behind `import.meta.env.DEV`, so it is absent from production builds.
 */
import type { GameState, WorldId } from '../sim/types'
import type { PlayerView } from '../sim/view'
import { weekLabel } from './format'

interface Props {
  state: GameState
  view: PlayerView
  world: WorldId | null
}

export function GodView({ state, view, world }: Props) {
  const truth = world ? state.worlds[world] : null
  const known = world ? view.known.worlds[world] : null
  const snap = known?.snapshot.kind === 'world' ? known.snapshot.world : null
  const counts: Record<string, number> = {}
  for (const m of Object.values(state.mail)) counts[m.status.kind] = (counts[m.status.kind] ?? 0) + 1
  const waitingHere = world ? Object.values(state.mail).filter((m) => m.status.kind === 'awaiting_carrier' && m.status.at === world).length : 0

  return (
    <div className="godview">
      <h4>God view — ground truth (dev only)</h4>
      <div className="mailstats">
        mail: {Object.entries(counts).map(([k, n]) => `${k} ${n}`).join(' · ') || 'none'}
      </div>
      {truth && (
        <table>
          <thead>
            <tr>
              <th />
              <th>truth</th>
              <th>belief {known ? `(${weekLabel(known.observed)})` : ''}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>governor</td>
              <td>{truth.governor ? state.characters[truth.governor]?.name : '—'}</td>
              <td className={snap && snap.governorName !== (truth.governor ? state.characters[truth.governor]?.name : null) ? 'diff' : ''}>{snap?.governorName ?? '—'}</td>
            </tr>
            <tr>
              <td>unrest</td>
              <td>{truth.unrest}</td>
              <td className={snap && snap.unrest !== truth.unrest ? 'diff' : ''}>{snap?.unrest ?? '—'}</td>
            </tr>
            <tr>
              <td>garrison</td>
              <td>{truth.garrison}</td>
              <td className={snap && snap.garrison !== truth.garrison ? 'diff' : ''}>{snap?.garrison ?? '—'}</td>
            </tr>
            <tr>
              <td>mail waiting here</td>
              <td>{waitingHere}</td>
              <td />
            </tr>
          </tbody>
        </table>
      )}
      {!truth && <p className="muted">Select a world to compare truth with belief.</p>}
    </div>
  )
}
