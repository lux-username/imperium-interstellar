/**
 * The shell. The map pane draws the player's belief; the port pane is a
 * list of places to go, each a short scene. One button advances the week.
 * The god view is the single sanctioned look at ground truth, for
 * development only.
 */
import { useEffect, useMemo, useState } from 'react'
import { advanceWeek, buyGoods, goAshore, newGame, refuel, sail, sellGoods, takeFreight, takePassage } from '../sim/game'
import { buildPlayerView } from '../sim/player'
import { deserialize, serialize } from '../sim/save'
import type { GameState } from '../sim/types'
import { stanceKey, type EmpireId, type PlayerView, type WorldId } from '../sim/view'
import { Map } from './Map'
import { ago, empireClass, empireName, profileString, TYPE_WORDS } from './format'
import type { Overlay } from './geometry'

const AUTOSAVE = 'imperium-interstellar-draft2/autosave'

type Place = 'docks' | 'brokers' | 'factor' | 'captain' | 'bar'
const PLACES: { id: Place; name: string }[] = [
  { id: 'docks', name: 'The docks' },
  { id: 'brokers', name: 'The brokers' },
  { id: 'factor', name: 'The guild factor' },
  { id: 'captain', name: 'The port captain' },
  { id: 'bar', name: 'The bar' },
]

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

const cr = (n: number) => `${n.toLocaleString('en-GB')} Cr`

export function App() {
  const [state, setState] = useState<GameState>(() => loadAutosave() ?? newGame(1))
  const [tick, setTick] = useState(0)
  const [selected, setSelected] = useState<WorldId | null>(null)
  const [place, setPlace] = useState<Place>('docks')
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

  const act = (f: () => unknown) => () => {
    f()
    setTick((t) => t + 1)
  }
  const here = view.here
  const hereName = here ? view.chart[here.world].name : null

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
        <span className="purse">{cr(view.purse)}</span>
        <button className="advance" onClick={act(() => advanceWeek(state))}>
          Advance week{view.ship?.course ? ` · sail for ${view.chart[view.ship.course].name}` : ''}
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
          {here ? (
            <section className="port">
              <h2>
                {hereName} <span className="muted">· {empireName(view, here.empire)} · port {here.starport}</span>
              </h2>
              <nav className="places">
                {PLACES.map((p) => (
                  <button key={p.id} className={place === p.id ? 'on' : ''} onClick={() => setPlace(p.id)}>
                    {p.name}
                  </button>
                ))}
              </nav>
              {place === 'docks' && <Docks view={view} state={state} act={act} />}
              {place === 'brokers' && <Brokers view={view} state={state} act={act} />}
              {place === 'factor' && <Factor view={view} />}
              {place === 'captain' && <Captain view={view} />}
              {place === 'bar' && <Bar view={view} />}
            </section>
          ) : (
            <section>
              <h2>In jump</h2>
              <p>Nothing to see but the inside of the hull. {view.body.kind === 'aboard' && `${view.chart[view.body.to].name} next week.`}</p>
            </section>
          )}
          {selected && <Dossier view={view} world={selected} />}
        </aside>
      </main>
    </>
  )
}

type PaneProps = { view: PlayerView; state: GameState; act: (f: () => unknown) => () => void }

function Docks({ view, state, act }: PaneProps) {
  const here = view.here!
  const ship = view.ship
  const [course, setCourse] = useState<string>(ship?.course ?? '')
  return (
    <div className="scene">
      {ship ? (
        <>
          <p>
            <b>{ship.name}</b>, {TYPE_WORDS[ship.type]} · jump-{ship.jump} · fuel {ship.fuel}/{ship.tanks} tanks · hold {ship.holdUsed}/{ship.holdTons} t{ship.damage > 0 ? ` · damage ${ship.damage}` : ''}
          </p>
          <p>
            {here.refuel === null ? (
              <span className="muted">No fuel to be had at a port of this class.</span>
            ) : (
              <>
                Fuel {cr(here.refuel)} a tank.{' '}
                <button disabled={ship.fuel >= ship.tanks || view.purse < here.refuel} onClick={act(() => refuel(state))}>
                  fill a tank
                </button>
              </>
            )}
          </p>
          <ul>
            {ship.hold.map((l, i) => (
              <li key={i}>
                {l.tons} t {l.good}
                {l.kind === 'cargo' ? ` bought at ${view.chart[l.from]?.name ?? l.from} for ${cr(l.paid)}/t` : ` freight for ${view.chart[l.to].name} at ${cr(l.rate)}/t`}
              </li>
            ))}
            {ship.hold.length === 0 && <li className="muted">The hold is empty.</li>}
          </ul>
          {view.debt && (
            <p className="muted">
              Owed on her: {cr(view.debt.balance)} · {cr(view.debt.payment)} due week {view.debt.nextDue}
              {view.debt.arrears > 0 ? ` · in arrears ${cr(view.debt.arrears)}` : ''}
            </p>
          )}
          <p>
            Course:{' '}
            <select value={course} onChange={(e) => setCourse(e.target.value)}>
              <option value="">stay in port</option>
              {here.destinations.map((d) => (
                <option key={d.world} value={d.world}>
                  {view.chart[d.world].name} · {d.parsecs} pc{d.charted ? ' · on the lanes' : ''}
                </option>
              ))}
            </select>{' '}
            <button disabled={ship.fuel < 1 && course !== ''} onClick={act(() => sail(state, (course || null) as WorldId | null))}>
              {course ? 'set course' : 'stay'}
            </button>
            {ship.fuel < 1 && <span className="muted"> no fuel</span>}
          </p>
        </>
      ) : (
        <p>You have no hull of your own.</p>
      )}
      <h3>In port</h3>
      <ul className="hulls">
        {here.hulls.map((h) => (
          <li key={h.id} className={empireClass(view, h.empire)}>
            <span className="dot" /> <b>{h.name}</b>, {TYPE_WORDS[h.type]} of {empireName(view, h.empire)}
            {h.sailsTo && h.sailsOn !== null && (
              <>
                {' '}
                · for {view.chart[h.sailsTo].name}, {h.sailsOn - view.week <= 1 ? 'sails next week' : `sails in ${h.sailsOn - view.week} wk`}
                {!ship && <button onClick={act(() => takePassage(state, h.id))}>take passage</button>}
              </>
            )}
          </li>
        ))}
        {here.hulls.length === 0 && <li className="muted">No other hull lies here.</li>}
      </ul>
      {view.body.kind === 'aboard' && !ship && <button onClick={act(() => goAshore(state))}>go ashore</button>}
      <h3>Mail</h3>
      <ul className="mail">
        {view.inbox.slice(0, 10).map((r) => (
          <li key={r.id}>
            <b>{r.subject}</b> — {r.observerName}, seen {ago(view.week, r.observed)}
          </li>
        ))}
        {view.inbox.length === 0 && <li className="muted">No letters have reached you.</li>}
      </ul>
    </div>
  )
}

function Brokers({ view, state, act }: PaneProps) {
  const here = view.here!
  const ship = view.ship
  return (
    <div className="scene">
      {here.tariff > 0 && <p className="muted">A foreign port: {Math.round(here.tariff * 100)}% duty on what you buy and what you sell.</p>}
      <table className="market">
        <thead>
          <tr>
            <th>good</th>
            <th>price</th>
            <th>on the dock</th>
            <th>in hold</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {here.market.map((r) => (
            <tr key={r.good}>
              <td>{r.good}</td>
              <td>{cr(r.price)}</td>
              <td>{r.stock} t</td>
              <td>{r.holding ? `${r.holding.tons} t @ ${cr(r.holding.paid)}` : ''}</td>
              <td>
                {ship && (
                  <>
                    <button disabled={r.stock === 0} onClick={act(() => buyGoods(state, r.good, 10))}>
                      buy 10
                    </button>
                    <button disabled={r.stock === 0} onClick={act(() => buyGoods(state, r.good, 999))}>
                      fill
                    </button>
                    <button disabled={!r.holding} onClick={act(() => sellGoods(state, r.good, 10))}>
                      sell 10
                    </button>
                    <button disabled={!r.holding} onClick={act(() => sellGoods(state, r.good, 999))}>
                      sell all
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3>Freight on offer</h3>
      <ul>
        {here.freight.map((f) => (
          <li key={f.id}>
            {f.tons} t {f.good} for {view.chart[f.to].name}, {cr(f.rate)}/t on delivery
            {ship && (
              <button disabled={f.tons > ship.holdTons - ship.holdUsed} onClick={act(() => takeFreight(state, f.id))}>
                take
              </button>
            )}
          </li>
        ))}
        {here.freight.length === 0 && <li className="muted">Nothing wants carrying this week.</li>}
      </ul>
    </div>
  )
}

function Factor({ view }: { view: PlayerView }) {
  const here = view.here!
  const own = here.empire === view.player.empire
  return (
    <div className="scene">
      <p>The guild factor's office of {empireName(view, here.empire)}.</p>
      <p className="muted">{own ? 'You are no member. The factor has nothing for an outsider, and says so civilly.' : 'A foreign guild. The clerk notes your name and nothing more.'}</p>
    </div>
  )
}

function Captain({ view }: { view: PlayerView }) {
  const eids = Object.keys(view.empires).sort() as EmpireId[]
  return (
    <div className="scene">
      <p>The port captain's notices.</p>
      <ul>
        {eids.flatMap((a, i) =>
          eids.slice(i + 1).map((b) => {
            const d = view.known.stances[stanceKey(a, b)]
            return (
              <li key={`${a}${b}`}>
                {empireName(view, a)} and {empireName(view, b)}: {d ? <b className={d.stance}>{d.stance}</b> : 'at peace'}
                {d ? ` since week ${d.week}` : ', as far as anyone here knows'}
              </li>
            )
          }),
        )}
      </ul>
    </div>
  )
}

function Bar({ view }: { view: PlayerView }) {
  const here = view.here!
  return (
    <div className="scene">
      <p>The bar by the docks.</p>
      <p className="muted">{here.hulls.length > 0 ? `Crews off ${here.hulls.map((h) => h.name).join(', ')} are drinking. Nobody has anything to tell you yet.` : 'Quiet. Nobody in from anywhere.'}</p>
    </div>
  )
}

function Dossier({ view, world }: { view: PlayerView; world: WorldId }) {
  const entry = view.chart[world]
  const report = view.known.worlds[world]
  const snap = report?.snapshot.kind === 'world' ? report.snapshot.world : null
  const prices = view.known.prices[world] ?? {}
  const goods = Object.keys(prices).sort() as (keyof typeof prices)[]
  return (
    <section>
      <h2>{entry.name}</h2>
      {snap && report ? (
        <>
          <p>
            {profileString(snap.profile)} · {empireName(view, snap.empire)} · as of {ago(view.week, report.observed)}
          </p>
          {goods.length > 0 ? (
            <table className="market small">
              <tbody>
                {goods.map((g) => (
                  <tr key={g}>
                    <td>{g}</td>
                    <td>{cr(prices[g]!.price)}</td>
                    <td>{prices[g]!.stock} t</td>
                    <td className="muted">{ago(view.week, prices[g]!.observed)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="muted">No prices known; nobody has told you what they ask there.</p>
          )}
          <ul className="hulls">
            {snap.ships.map((s) => (
              <li key={s.id} className={empireClass(view, s.empire)}>
                <span className="dot" /> {s.name}, {TYPE_WORDS[s.type]}
              </li>
            ))}
          </ul>
          <p className="muted">Settled by {entry.cultures.join(', ')}.</p>
        </>
      ) : (
        <p>Nothing is known of it.</p>
      )}
    </section>
  )
}
