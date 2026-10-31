/**
 * The keel shell. The map pane draws the player's belief; the side pane
 * shows where their body is, what lies in port, the notices as they know
 * them, and the mail. One button advances the week. The god view is the
 * single sanctioned look at ground truth, for development only.
 */
import { useEffect, useMemo, useState } from 'react'
import { advanceWeek, goAshore, newGame, takePassage } from '../sim/game'
import { buildPlayerView } from '../sim/player'
import { deserialize, serialize } from '../sim/save'
import type { GameState } from '../sim/types'
import { stanceKey, type EmpireId, type WorldId } from '../sim/view'
import { Map } from './Map'
import { ago, empireClass, empireName, profileString, TYPE_WORDS } from './format'
import type { Overlay } from './geometry'

const AUTOSAVE = 'imperium-interstellar-draft2/autosave'

function loadAutosave(): GameState | null {
  try {
    const json = localStorage.getItem(AUTOSAVE)
    return json ? deserialize(json) : null
  } catch {
    return null
  }
}

function godOverlay(state: GameState): Overlay {
  const ships: Overlay['ships'] = []
  for (const s of Object.values(state.ships)) {
    const at = s.location.kind === 'world' ? s.location.world : s.location.to
    ships.push({ hex: state.worlds[at].hex, label: `${s.name} (${s.type}) ${s.location.kind === 'transit' ? `in jump from ${state.worlds[s.location.from].name}` : 'in port'}`, inTransit: s.location.kind === 'transit', empire: s.empire })
  }
  const empires: Record<string, string> = {}
  for (const w of Object.values(state.worlds)) empires[w.id] = w.empire
  return { ships, empires }
}

export function App() {
  const [state, setState] = useState<GameState>(() => loadAutosave() ?? newGame(1))
  const [tick, setTick] = useState(0)
  const [selected, setSelected] = useState<WorldId | null>(null)
  const [god, setGod] = useState(false)
  const [seed, setSeed] = useState(state.seed)

  // The sim mutates in place; `tick` is the version of `state` and is what the memos key on.
  const versioned = useMemo(() => ({ state, tick }), [state, tick])
  const view = useMemo(() => buildPlayerView(versioned.state), [versioned])
  const overlay = useMemo(() => (god ? godOverlay(versioned.state) : null), [versioned, god])

  useEffect(() => {
    try {
      localStorage.setItem(AUTOSAVE, serialize(versioned.state))
    } catch {
      /* no storage: play on without it */
    }
  }, [versioned])

  const bump = () => setTick((t) => t + 1)
  const here = view.here ? view.chart[view.here.world] : null
  const hereReport = view.here ? view.known.worlds[view.here.world] : null
  const hereSnap = hereReport?.snapshot.kind === 'world' ? hereReport.snapshot.world : null
  const chosen = selected ? view.chart[selected] : null
  const chosenReport = selected ? view.known.worlds[selected] : null
  const chosenSnap = chosenReport?.snapshot.kind === 'world' ? chosenReport.snapshot.world : null
  const eids = Object.keys(view.empires).sort() as EmpireId[]

  return (
    <>
      <header>
        <h1>Imperium Interstellar</h1>
        <span className="who">
          {view.player.name}, a subject of {empireName(view, view.player.empire)} · week {view.week}
        </span>
        <span className="where">
          {view.body.kind === 'world' ? `at ${view.chart[view.body.world].name}` : `aboard ${view.body.shipName}, in jump for ${view.chart[view.body.to].name}`}
        </span>
        <button
          className="advance"
          onClick={() => {
            advanceWeek(state)
            bump()
          }}
        >
          Advance week
        </button>
        <span className="dev">
          <label>
            <input type="checkbox" checked={god} onChange={(e) => setGod(e.target.checked)} /> god view
          </label>
          <label>
            seed <input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value) || 0)} />
          </label>
          <button
            onClick={() => {
              setState(newGame(seed))
              setSelected(null)
            }}
          >
            New game
          </button>
        </span>
      </header>
      <main>
        <Map view={view} selected={selected} onSelect={setSelected} overlay={overlay} />
        <aside>
          <section>
            <h2>Here</h2>
            {here && view.here ? (
              <>
                <p>
                  <b>{here.name}</b>, {empireName(view, hereSnap?.empire ?? view.player.empire)}
                  {view.body.kind === 'world' ? '' : ' (aboard, in port)'}
                </p>
                <ul className="hulls">
                  {view.here.hulls.map((h) => (
                    <li key={h.id} className={empireClass(view, h.empire)}>
                      <span className="dot" /> <b>{h.name}</b>, {TYPE_WORDS[h.type]} of {empireName(view, h.empire)}
                      {h.sailsTo && h.sailsOn !== null && (
                        <>
                          {' '}
                          · for {view.chart[h.sailsTo].name}, {h.sailsOn - view.week <= 1 ? 'sails next week' : `sails in ${h.sailsOn - view.week} wk`}
                          {view.body.kind === 'world' && (
                            <button
                              onClick={() => {
                                takePassage(state, h.id)
                                bump()
                              }}
                            >
                              take passage
                            </button>
                          )}
                        </>
                      )}
                    </li>
                  ))}
                  {view.here.hulls.length === 0 && <li>Nothing in port.</li>}
                </ul>
                {view.body.kind === 'world' ? null : (
                  <button
                    onClick={() => {
                      goAshore(state)
                      bump()
                    }}
                  >
                    go ashore
                  </button>
                )}
              </>
            ) : (
              <p>In jump. Nothing to see but the inside of the hull.</p>
            )}
          </section>

          <section>
            <h2>Notices</h2>
            <ul>
              {eids.flatMap((a, i) =>
                eids.slice(i + 1).map((b) => {
                  const d = view.known.stances[stanceKey(a, b)]
                  return (
                    <li key={`${a}${b}`}>
                      {empireName(view, a)} and {empireName(view, b)}: {d ? <b className={d.stance}>{d.stance}</b> : 'at peace'}
                      {d ? ` since week ${d.week}` : ', as far as you know'}
                    </li>
                  )
                }),
              )}
            </ul>
          </section>

          {chosen && (
            <section>
              <h2>{chosen.name}</h2>
              {chosenSnap && chosenReport ? (
                <>
                  <p>
                    {profileString(chosenSnap.profile)} · {empireName(view, chosenSnap.empire)} · as of {ago(view.week, chosenReport.observed)} ({chosenReport.observerName})
                  </p>
                  <ul className="hulls">
                    {chosenSnap.ships.map((s) => (
                      <li key={s.id} className={empireClass(view, s.empire)}>
                        <span className="dot" /> {s.name}, {TYPE_WORDS[s.type]}
                      </li>
                    ))}
                    {chosenSnap.ships.length === 0 && <li>No hulls were lying there.</li>}
                  </ul>
                  <p className="muted">Settled by {chosen.cultures.join(', ')}.</p>
                </>
              ) : (
                <p>Nothing is known of it.</p>
              )}
            </section>
          )}

          <section>
            <h2>Mail</h2>
            <ul className="mail">
              {view.inbox.slice(0, 20).map((r) => (
                <li key={r.id}>
                  <b>{r.subject}</b> — {r.observerName}, seen {ago(view.week, r.observed)}, arrived {ago(view.week, r.delivered ?? view.week)}
                </li>
              ))}
              {view.inbox.length === 0 && <li className="muted">No letters have reached you.</li>}
            </ul>
          </section>
        </aside>
      </main>
    </>
  )
}
