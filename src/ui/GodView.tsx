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
        <br />
        hulls: {Object.values(state.factions).map((f) => `${f.name} ${Object.values(state.ships).filter((s) => s.faction === f.id).length}`).join(' · ')}
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
              <td>
                {truth.garrison} + {truth.marines}m
              </td>
              <td className={snap && (snap.garrison !== truth.garrison || snap.marines !== truth.marines) ? 'diff' : ''}>{snap ? `${snap.garrison} + ${snap.marines}m` : '—'}</td>
            </tr>
            <tr>
              <td>held by</td>
              <td>{state.factions[truth.faction]?.name ?? truth.faction}</td>
              <td className={snap && snap.faction !== truth.faction ? 'diff' : ''}>{snap ? (state.factions[snap.faction]?.name ?? snap.faction) : '—'}</td>
            </tr>
            <tr>
              <td>contest</td>
              <td>{truth.contest ? `${state.factions[truth.contest.attacker]?.name}: ${truth.contest.attackers.army + truth.contest.attackers.marines} since wk ${truth.contest.since}` : '—'}</td>
              <td className={(snap?.contest === null) !== (truth.contest === null) ? 'diff' : ''}>{snap?.contest ? `${state.factions[snap.contest.attacker]?.name}: ${snap.contest.strength}` : '—'}</td>
            </tr>
            <tr>
              <td>haven</td>
              <td>{Object.values(state.ships).some((s) => s.havens?.includes(truth.id)) ? 'known to pirates' : '—'}</td>
              <td />
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
