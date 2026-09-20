/**
 * The desk. App holds the GameState only to hand it to the sim (advance a
 * week, post a letter, save); everything rendered comes from the PlayerView
 * the sim builds from delivered reports. The one exception is the dev-only
 * god view, loaded behind `import.meta.env.DEV` so production builds never
 * contain it.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { advanceWeek, newGame, requestReport } from '../sim/game'
import { buildPlayerView } from '../sim/player'
import { clone, deserialize, serialize } from '../sim/save'
import type { GameState } from '../sim/types'
import type { CharacterId, WorldId } from '../sim/view'
import { Dossier } from './Dossier'
import { Inbox } from './Inbox'
import { Map } from './Map'
import type { Overlay } from './geometry'
import { Outgoing } from './Outgoing'

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

export function App() {
  const [state, setState] = useState<GameState>(initialState)
  const [selected, setSelected] = useState<WorldId | null>(null)
  const [tab, setTab] = useState<'inbox' | 'outgoing'>('inbox')
  const [seedText, setSeedText] = useState('')
  const [god, setGod] = useState(false)
  const [godModule, setGodModule] = useState<GodModule | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const view = useMemo(() => buildPlayerView(state), [state])

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
  }

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
      } catch (e) {
        console.error(e)
      }
    })
  }

  const overlay: Overlay | null = import.meta.env.DEV && god && godModule ? godModule.overlayFor(state) : null

  return (
    <div className="shell">
      <header className="topbar">
        <h1>Imperium Interstellar</h1>
        <span className="seed muted">seed {state.seed}</span>
        <span className="week">Week {view.week}</span>
        <button type="button" className="primary" onClick={() => mutate(advanceWeek)}>
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
      <main className="panes">
        <section className="pane left">
          <div className="tabs">
            <button type="button" className={tab === 'inbox' ? 'on' : ''} onClick={() => setTab('inbox')}>
              Inbox
            </button>
            <button type="button" className={tab === 'outgoing' ? 'on' : ''} onClick={() => setTab('outgoing')}>
              Outgoing ({view.outgoing.length})
            </button>
          </div>
          {tab === 'inbox' ? <Inbox view={view} onSelect={setSelected} /> : <Outgoing view={view} onSelect={setSelected} />}
        </section>
        <section className="pane centre">
          <Map view={view} selected={selected} onSelect={setSelected} overlay={overlay} />
          <div className="legend">
            <span className="fresh">● ≤4 wk</span> <span className="aging">● ≤12 wk</span> <span className="stale">● ≤30 wk</span> <span className="ancient">● older</span>{' '}
            <span className="muted">— solid lane: packet every 2 wk; dashed: every 4 wk. ▲ hull last seen there.</span>
          </div>
        </section>
        <section className="pane right">
          <Dossier view={view} world={selected} onRequest={(world, governor: CharacterId) => mutate((s) => void requestReport(s, world, governor))} />
          {import.meta.env.DEV && god && godModule && <godModule.GodView state={state} view={view} world={selected} />}
        </section>
      </main>
    </div>
  )
}
