/**
 * The Home Office. App holds the GameState only to hand it to the sim (advance a
 * week, post a letter, save); everything rendered comes from the PlayerView
 * the sim builds from delivered reports. The one exception is the dev-only
 * god view, loaded behind `import.meta.env.DEV` so production builds never
 * contain it.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { advanceWeek, newGame, orderShip, requestReport, sendByCourier } from '../sim/game'
import { buildPlayerView } from '../sim/player'
import { clone, deserialize, serialize } from '../sim/save'
import type { GameState } from '../sim/types'
import { beliefFrom, knownHavens, type CharacterId, type Order, type PlayerView, type ReportId, type ShipId, type StandingOrders, type Week, type WorldId } from '../sim/view'
import { Dossier } from './Dossier'
import { EnemyShips } from './EnemyShips'
import { Fleet } from './Fleet'
import { Inbox } from './Inbox'
import { Officers } from './Officers'
import { OrdersDialog, type OrdersDraft } from './OrdersDialog'
import { Map } from './Map'
import type { Overlay } from './geometry'
import { Outgoing } from './Outgoing'
import type { Selection } from './selection'
import { ShipDossier } from './ShipDossier'

const SAVE_KEY = 'imperium-interstellar/autosave'

function initialState(): GameState {
  try {
    const saved = localStorage.getItem(SAVE_KEY)
    if (saved) return deserialize(saved)
  } catch {
    // A bad or foreign save is ignored; start fresh.
  }
  return newGame(Date.now() >>> 0)
}

type GodModule = typeof import('./dev')

type Tab = 'inbox' | 'rumours' | 'fleet' | 'officers' | 'enemy' | 'outgoing'

/**
 * The picture as of an earlier week: the same reports the Home Office holds now,
 * folded with everything observed after that week left out. The map and
 * the dossiers read it in place of the present.
 */
function viewAsOf(view: PlayerView, week: Week): PlayerView {
  const known = beliefFrom([...view.inbox, ...view.observations], week)
  return { ...view, week, known, havens: knownHavens(view.inbox, known) }
}

export function App() {
  const [state, setState] = useState<GameState>(initialState)
  const [selected, setSelected] = useState<Selection | null>(null)
  const [tab, setTab] = useState<Tab>('inbox')
  /** The week the map is turned back to; null for the present. */
  const [asOf, setAsOf] = useState<Week | null>(null)
  /** Whether a dossier shows the week turned back to, or the present. */
  const [dossierPast, setDossierPast] = useState(true)
  const [focus, setFocus] = useState<{ id: ReportId; nonce: number } | null>(null)
  const [orders, setOrders] = useState<OrdersDraft | null>(null)
  const [seedText, setSeedText] = useState('')
  const [god, setGod] = useState(false)
  const [godModule, setGodModule] = useState<GodModule | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const view = useMemo(() => buildPlayerView(state), [state])
  const shown = useMemo(() => (asOf === null || asOf >= view.week ? view : viewAsOf(view, asOf)), [view, asOf])
  const past = shown !== view
  const dossierView = past && dossierPast ? shown : view

  useEffect(() => {
    try {
      localStorage.setItem(SAVE_KEY, serialize(state))
    } catch {
      // Storage full or unavailable: the game still plays, it just won't persist.
    }
  }, [state])

  useEffect(() => {
    if (import.meta.env.DEV) {
      import('./dev').then(setGodModule)
    }
  }, [])

  const mutate = (fn: (s: GameState) => void) => {
    const next = clone(state)
    fn(next)
    setState(next)
  }

  const startNew = () => {
    const seed = seedText.trim() === '' ? Date.now() >>> 0 : Number.parseInt(seedText, 10) >>> 0
    setState(newGame(seed))
    setSelected(null)
    setAsOf(null)
  }

  const advance = () => {
    mutate(advanceWeek)
    setAsOf(null)
  }

  const selectWorld = (id: WorldId) => setSelected({ kind: 'world', id })
  const selectShip = (id: ShipId) => setSelected({ kind: 'ship', id })

  const download = () => {
    const blob = new Blob([serialize(state)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `imperium-${state.seed}-wk${state.week}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const upload = (file: File | undefined) => {
    if (!file) return
    file.text().then((text) => {
      try {
        setState(deserialize(text))
        setSelected(null)
        setAsOf(null)
      } catch (e) {
        console.error(e)
      }
    })
  }

  const showReport = (id: ReportId) => {
    setTab(view.rumours.some((r) => r.id === id) ? 'rumours' : 'inbox')
    setFocus({ id, nonce: Date.now() })
  }

  const overlay: Overlay | null = import.meta.env.DEV && god && godModule ? godModule.overlayFor(state) : null

  return (
    <div className="shell">
      <header className="topbar">
        <h1>Imperium Interstellar</h1>
        <span className="seed muted">seed {state.seed}</span>
        <span className="week">Week {view.week}</span>
        <button type="button" className="primary" disabled={view.ending !== null} onClick={advance}>
          Advance Week
        </button>
        <span className="controls">
          <input type="text" inputMode="numeric" placeholder="seed" value={seedText} onChange={(e) => setSeedText(e.target.value)} size={10} />
          <button type="button" onClick={startNew}>
            New game
          </button>
          <button type="button" onClick={download}>
            Save file
          </button>
          <button type="button" onClick={() => fileInput.current?.click()}>
            Load file
          </button>
          <input ref={fileInput} type="file" accept="application/json" hidden onChange={(e) => upload(e.target.files?.[0])} />
          {import.meta.env.DEV && godModule && (
            <button type="button" className={god ? 'on' : ''} onClick={() => setGod((g) => !g)}>
              God view
            </button>
          )}
        </span>
      </header>
      {view.ending && (
        <div className="ending">
          <strong>The capital has fallen.</strong> Week {view.ending.week}: {view.factions[view.ending.by]?.name ?? 'the enemy'} hold the port and the palace, and you with them — for ransom, or for a show trial.
          The term is over. Start a new game, or load a save.
        </div>
      )}
      <main className="panes">
        <section className="pane left">
          <div className="tabs">
            <button type="button" className={tab === 'inbox' ? 'on' : ''} onClick={() => setTab('inbox')}>
              Inbox
            </button>
            <button type="button" className={tab === 'rumours' ? 'on' : ''} onClick={() => setTab('rumours')}>
              Rumours{view.rumours.some((r) => r.delivered === view.week) ? ' •' : ''}
            </button>
            <button type="button" className={tab === 'fleet' ? 'on' : ''} onClick={() => setTab('fleet')}>
              Fleet ({view.roster.length}){view.roster.some((r) => r.commanderName === null) ? ' · prize' : ''}
            </button>
            <button type="button" className={tab === 'officers' ? 'on' : ''} onClick={() => setTab('officers')}>
              Officers
            </button>
            <button type="button" className={tab === 'enemy' ? 'on' : ''} onClick={() => setTab('enemy')}>
              Enemy hulls ({Object.values(view.known.ships).filter((s) => s.ship.faction !== view.faction).length})
            </button>
            <button type="button" className={tab === 'outgoing' ? 'on' : ''} onClick={() => setTab('outgoing')}>
              Outgoing ({view.outgoing.length})
            </button>
          </div>
          {tab === 'inbox' && <Inbox view={view} pile="inbox" onSelect={selectWorld} focus={focus} />}
          {tab === 'rumours' && <Inbox view={view} pile="rumours" onSelect={selectWorld} focus={focus} />}
          {tab === 'fleet' && (
            <>
              <div className="toolbar">
                <span className="count">
                  At the capital: {view.reserve.army} army, {view.reserve.marines} marine detachments; {view.pool.length === 0 ? 'no officers' : `officers ${view.pool.map((p) => p.name).join(', ')}`} without a post.
                </span>
              </div>
              <Fleet view={view} onSelect={selectShip} onShowReport={showReport} onOrders={(ship) => setOrders({ ship })} />
            </>
          )}
          {tab === 'officers' && <Officers view={view} onSelect={setSelected} />}
          {tab === 'enemy' && <EnemyShips view={view} onSelect={selectShip} onShowReport={showReport} />}
          {tab === 'outgoing' && <Outgoing view={view} onSelect={selectWorld} />}
        </section>
        <section className="pane centre">
          <div className="scrubber">
            <label>
              <span className={past ? 'warn' : ''}>{past ? `Week ${shown.week} — what the Home Office now knows of it` : `Week ${view.week} — the present`}</span>
              <input type="range" min={0} max={view.week} value={asOf ?? view.week} onChange={(e) => setAsOf(Number.parseInt(e.target.value, 10))} disabled={view.week === 0} />
            </label>
            <button type="button" className="small" disabled={!past} onClick={() => setAsOf(null)}>
              Now
            </button>
          </div>
          <Map view={shown} selected={selected} onSelect={setSelected} overlay={past ? null : overlay} />
          <div className="legend">
            <span className="loyal"><i className="swatch" />loyal</span> <span className="unrest"><i className="swatch" />unrest</span> <span className="revolt"><i className="swatch" />revolt</span>{' '}
            <span className="contested"><i className="swatch" />contested</span> <span className="independent"><i className="swatch" />independent</span> <span className="warlord"><i className="swatch" />Warlord</span>{' '}
            <span className="pirates"><i className="swatch ring" />pirate haven</span>{' '}
            <span className="muted">— as the Home Office last heard; the badge says how long ago, a dashed ring means the word is old. Hulls where last seen:</span>{' '}
            <span className="own">▲ ours</span> <span className="warlord">▲ Warlord</span> <span className="pirates">▲ pirate</span> <span className="independent">▲ independent</span>{' '}
            <span className="muted">— click one for her dossier. Hover a lane for its packet.</span>
          </div>
        </section>
        <section className="pane right">
          {past && selected && (
            <div className="toolbar">
              <span className="count">Showing {dossierPast ? `as of wk ${shown.week}` : 'the present'}.</span>
              <button type="button" className="small" onClick={() => setDossierPast((p) => !p)}>
                {dossierPast ? 'Show the present' : `Show as of wk ${shown.week}`}
              </button>
            </div>
          )}
          {!selected && <p className="empty">Select a world or a hull on the map, or a report in the inbox.</p>}
          {selected?.kind === 'world' && (
            <Dossier
              view={dossierView}
              now={view}
              world={selected.id}
              onRequest={(world, governor: CharacterId) => mutate((s) => void requestReport(s, world, governor))}
              onOrders={(world) => setOrders({ destination: world })}
              onSelectShip={selectShip}
              onShowReport={showReport}
            />
          )}
          {selected?.kind === 'ship' && <ShipDossier view={dossierView} now={view} ship={selected.id} onSelectWorld={selectWorld} onOrders={(ship) => setOrders({ ship })} onShowReport={showReport} />}
          {import.meta.env.DEV && god && godModule && <godModule.GodView state={state} view={view} world={selected?.kind === 'world' ? selected.id : null} />}
        </section>
      </main>
      {orders && (
        <OrdersDialog
          view={view}
          draft={orders}
          onSubmit={(ship: ShipId, order: Order, address: WorldId, standing: Partial<StandingOrders>, courier: ShipId | null) =>
            mutate((s) => {
              const mail = orderShip(s, ship, order, address, standing)
              if (courier) sendByCourier(s, courier, mail)
            })
          }
          onClose={() => setOrders(null)}
        />
      )}
    </div>
  )
}
