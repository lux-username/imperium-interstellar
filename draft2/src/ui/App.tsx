/**
 * The shell. The map pane draws the player's belief; the port pane is a
 * list of places to go, each a short scene. One button advances the week.
 * The god view is the single sanctioned look at ground truth, for
 * development only.
 */
import { useEffect, useMemo, useState } from 'react'
import { advanceWeek, askCaptain, askForRoute, askToStand, buyGoods, buyRegister, goAshore, hail, lieOff, maintain, newGame, quoteBuy, quoteSale, ransomFor_, ransomSelf, registerFee, round, refuel, repair, respond, sail, seeLender, sellGoods, takeFreight, takePassage, talkAtBar } from '../sim/game'
import { buildPlayerView } from '../sim/player'
import { deserialize, serialize } from '../sim/save'
import type { GameState } from '../sim/types'
import { stanceKey, type CharacterId, type EmpireId, type Good, type PlayerView, type WorldId } from '../sim/view'
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
        <button className="advance" disabled={!!view.pending} onClick={act(() => advanceWeek(state))}>
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
          {view.pending && <EncounterPane view={view} state={state} act={act} />}
          {view.captive && (
            <section className="captive">
              <h2>A prisoner</h2>
              <p>
                Taken {ago(view.week, view.captive.since)}, {view.captive.of ? `a prisoner of ${empireName(view, view.captive.of)}` : "an outlaw's prisoner"}
                {view.captive.at ? `, held at ${view.chart[view.captive.at].name}` : view.captive.aboard ? `, aboard the ${view.captive.aboard}` : ''}.
              </p>
              {view.captive.at && (
                <p>
                  They ask {cr(view.captive.ransom)}.{' '}
                  <button disabled={view.purse < view.captive.ransom} onClick={act(() => ransomSelf(state))}>
                    pay the ransom
                  </button>
                  {view.captive.term !== null && <span className="muted"> Failing that, {view.captive.of ? 'parole' : 'they will tire of you'} about week {view.captive.term}, or sooner at a peace.</span>}
                </p>
              )}
            </section>
          )}
          {here && !view.pending ? (
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
              {place === 'captain' && <Captain view={view} state={state} act={act} />}
              {place === 'bar' && <Bar view={view} state={state} act={act} />}
            </section>
          ) : (
            <section>
              <h2>In jump</h2>
              <p>Nothing to see but the inside of the hull. {view.body.kind === 'aboard' && `${view.chart[view.body.to].name} next week.`}</p>
            </section>
          )}
          {selected && <Dossier view={view} world={selected} />}
          <Book view={view} />
        </aside>
      </main>
    </>
  )
}

type PaneProps = { view: PlayerView; state: GameState; act: (f: () => unknown) => () => void }

function EncounterPane({ view, state, act }: PaneProps) {
  const p = view.pending!
  const other = p.mine === 'attacker' ? p.defender : p.attacker
  return (
    <section className="encounter">
      <h2>In the approaches of {view.chart[view.here?.world ?? (view.body.kind === 'world' ? view.body.world : view.body.to)].name}</h2>
      <p>
        <b>{other.name}</b>, {TYPE_WORDS[other.type]} of {empireName(view, other.empire)}, {other.guns} gun{other.guns === 1 ? '' : 's'}. You have {view.ship?.guns ?? 0}.
      </p>
      <ul className="log">
        {p.log.map((l, i) => (
          <li key={i}>{l}</li>
        ))}
      </ul>
      {p.mine === 'defender' ? (
        <>
          {p.ally && <p className="muted">{p.ally} stands with you.</p>}
          {view.allies.length > 0 && (
            <p>
              {view.allies.map((a) => (
                <button key={a.ship} onClick={act(() => askToStand(state, a.ship))}>
                  ask {a.captain} of the {a.name} ({a.guns} gun{a.guns === 1 ? '' : 's'}) to stand with you
                </button>
              ))}
            </p>
          )}
          <p>
            <button onClick={act(() => respond(state, 'run'))}>run for the port</button> <button onClick={act(() => respond(state, 'fight'))}>fight</button> <button onClick={act(() => respond(state, 'strike'))}>strike</button>
          </p>
        </>
      ) : (
        <p>
          <button disabled={!p.quarrel} onClick={act(() => hail(state, 'attack'))}>
            attack
          </button>{' '}
          <button onClick={act(() => hail(state, 'let_pass'))}>let her pass</button>
          {!p.quarrel && <span className="muted"> You have no quarrel with her; an attack would be piracy.</span>}
        </p>
      )}
    </section>
  )
}

function Docks({ view, state, act }: PaneProps) {
  const here = view.here!
  const ship = view.ship
  const [course, setCourse] = useState<string>(ship?.course ?? '')
  return (
    <div className="scene">
      {ship ? (
        <>
          <p>
            <b>{ship.name}</b>, {TYPE_WORDS[ship.type]} · jump-{ship.jump} · {ship.guns} gun{ship.guns === 1 ? '' : 's'} · fuel {ship.fuel}/{ship.tanks} tanks · hold {ship.holdUsed}/{ship.holdTons} t{ship.damage > 0 ? ` · damage ${ship.damage}` : ''}
          </p>
          <p>
            {view.lyingOff ? (
              <>
                Lying off the port, watching what comes in. <button onClick={act(() => lieOff(state, false))}>come in and dock</button>
              </>
            ) : (
              <>
                Docked. <button onClick={act(() => lieOff(state, true))}>lie off the port</button>
              </>
            )}
            {ship.damage > 0 && (here.starport === 'A' || here.starport === 'B') && (
              <>
                {' '}
                <button disabled={view.purse < 1000} onClick={act(() => repair(state))}>
                  mend a point (1,000 Cr)
                </button>
              </>
            )}
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
          <p className={ship.maintenanceDueIn < 0 ? 'warn' : 'muted'}>
            {ship.inYard !== null
              ? `In the yard for her maintenance; out in week ${ship.inYard}.`
              : ship.maintenanceDueIn < 0
                ? `Maintenance ${-ship.maintenanceDueIn} wk overdue: her drive is a risk on every jump.`
                : `Maintenance due in ${ship.maintenanceDueIn} wk (${cr(ship.maintenanceCost)}, four weeks in a dockyard).`}
            {ship.inYard === null && (here.starport === 'A' || here.starport === 'B') && (
              <>
                {' '}
                <button disabled={view.purse < ship.maintenanceCost} onClick={act(() => maintain(state))}>
                  lay her up
                </button>
              </>
            )}
          </p>
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
        <p>
          You have no hull of your own.
          {view.lenderHere ? (
            <>
              {' '}
              A lender here would set you up with a free trader, nothing down, on top of what you still owe.{' '}
              <button onClick={act(() => seeLender(state))}>see the lender</button>
            </>
          ) : (
            <span className="muted"> A lender would want a dockyard port of your own empire.</span>
          )}
        </p>
      )}
      <h3>In port</h3>
      <ul className="hulls">
        {here.hulls.map((h) => (
          <li key={h.id} className={empireClass(view, h.empire)}>
            <span className="dot" /> <b>{h.name}</b>, {TYPE_WORDS[h.type]} of {empireName(view, h.empire)}
            {h.captainName ? `, ${h.captainName}` : ''}
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
      {view.prisoners.length > 0 && (
        <>
          <h3>Held here</h3>
          <ul>
            {view.prisoners.map((pr) => (
              <li key={pr.id} className={empireClass(view, pr.empire)}>
                <span className="dot" /> <b>{pr.name}</b>, a prisoner. Their captors ask {cr(pr.ransom)}.{' '}
                <button disabled={view.purse < pr.ransom} onClick={act(() => ransomFor_(state, pr.id))}>
                  pay their ransom
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
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

/** A slider and a number box for how many tons, from 1 to `most`. */
function Tons({ most, value, onChange }: { most: number; value: number; onChange: (n: number) => void }) {
  const clamp = (n: number) => Math.max(1, Math.min(most, Math.round(n) || 1))
  return (
    <>
      <input type="range" min={1} max={most} step={1} value={value} onChange={(e) => onChange(clamp(Number(e.target.value)))} />
      <input type="number" min={1} max={most} value={value} onChange={(e) => onChange(clamp(Number(e.target.value)))} className="tons" />
      <button className="tiny" onClick={() => onChange(most)}>
        max
      </button>
    </>
  )
}

/** The buy row: how much to take off the dock, and what that lot would cost a ton and in all. */
function BuyLot({ good, state, act, smuggle, tell, version }: { good: Good; state: GameState; act: PaneProps['act']; smuggle: boolean; tell: (o: ReturnType<typeof buyGoods>) => void; version: number }) {
  const [n, setN] = useState(10)
  const q = quoteBuy(state, good, n, smuggle)
  void version
  if (!q || q.most <= 0) return <span className="muted">nothing to buy</span>
  const want = Math.min(n, q.most)
  const qq = want === n ? q : quoteBuy(state, good, want, smuggle)!
  return (
    <span className="lot">
      <Tons most={q.most} value={want} onChange={setN} />
      <span className="quote">
        buy {want} t at {cr(qq.price)}/t → {cr(qq.credits)}
        {qq.duty > 0 ? <span className="muted"> (duty {cr(qq.duty)})</span> : null}
      </span>
      <button onClick={act(() => tell(buyGoods(state, good, want, smuggle)))}>buy</button>
    </span>
  )
}

/** The sell row: how much of the hold to part with, and what that lot would fetch a ton and in all. */
function SellLot({ good, tons, state, act, smuggle, tell }: { good: Good; tons: number; state: GameState; act: PaneProps['act']; smuggle: boolean; tell: (o: ReturnType<typeof sellGoods>) => void }) {
  const [n, setN] = useState(tons)
  const want = Math.min(n, tons)
  const q = quoteSale(state, good, want, smuggle)
  return (
    <span className="lot">
      <Tons most={tons} value={want} onChange={setN} />
      <span className="quote">
        sell {want} t at {q ? cr(q.price) : '?'}/t → {q ? cr(q.credits) : '?'}
        {q && q.duty > 0 ? <span className="muted"> (duty {cr(q.duty)})</span> : null}
      </span>
      <button onClick={act(() => tell(sellGoods(state, good, want, smuggle)))}>sell</button>
    </span>
  )
}

function Brokers({ view, state, act }: PaneProps) {
  const here = view.here!
  const ship = view.ship
  const [smuggle, setSmuggle] = useState(false)
  const [last, setLast] = useState<string | null>(null)
  const tell = (o: ReturnType<typeof buyGoods>) => {
    if (o.kind === 'ok') setLast(o.duty > 0 ? `${o.tons} t, ${cr(o.credits)}, of which ${cr(o.duty)} duty.` : `${o.tons} t, ${cr(o.credits)}, off the books.`)
    else if (o.kind === 'refused') setLast(here.closed ? 'The brokers will not deal with an enemy. Not on the books, anyway.' : 'No deal.')
    else setLast(`The customs house was waiting. ${o.tons} t seized and a fine of ${cr(o.fine)}${o.arrested ? ', which you could not pay: you are under arrest.' : '.'}`)
  }
  return (
    <div className="scene">
      <p className="muted">
        {here.closed ? `At war: no lawful trade here for a subject of ${empireName(view, view.player.empire)}. ` : `Duty here is ${Math.round(here.duty * 100)}% on what you buy and what you sell. `}
        <label>
          <input type="checkbox" checked={smuggle || here.closed} disabled={here.closed} onChange={(e) => setSmuggle(e.target.checked)} /> off the books
        </label>{' '}
        {(smuggle || here.closed) && <span className="warn">(the customs house looks into about {Math.round(here.inspection * 100)} in 100 such trades)</span>}
      </p>
      {last && <p>{last}</p>}
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
              <td>{Math.floor(r.stock)} t</td>
              <td>{r.holding ? `${r.holding.tons} t @ ${cr(r.holding.paid)}` : ''}</td>
              <td>
                {ship && (
                  <>
                    <BuyLot key={`b-${r.good}-${r.stock}-${view.purse}`} good={r.good} state={state} act={act} smuggle={smuggle || here.closed} tell={tell} version={r.stock} />
                    {r.holding && (
                      <>
                        <br />
                        <SellLot key={`s-${r.good}-${r.holding.tons}-${r.stock}`} good={r.good} tons={r.holding.tons} state={state} act={act} smuggle={smuggle || here.closed} tell={tell} />
                      </>
                    )}
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

function Captain({ view, state, act }: PaneProps) {
  const eids = Object.keys(view.empires).sort() as EmpireId[]
  const here = view.here!
  const report = view.known.worlds[here.world]
  const news = report?.snapshot.kind === 'world' ? report.snapshot.world.news : []
  const fee = registerFee(state)
  const [bought, setBought] = useState<number | null>(null)
  return (
    <div className="scene">
      <p>The port captain's notices.</p>
      <p>
        {fee === null ? (
          <span className="muted">No register is kept at a port of this class.</span>
        ) : (
          <>
            The administrator will sell you the year's register for {cr(fee)}: every hull's week here on the books, where from, where for, what sold and bought.{' '}
            <button disabled={view.purse < fee} onClick={act(() => setBought(buyRegister(state)))}>
              buy the register
            </button>
            {bought !== null && <span className="muted"> {bought > 0 ? `${bought} lines you did not have.` : 'Nothing you did not already know.'}</span>}
          </>
        )}
      </p>
      <h3>News</h3>
      <ul>
        {[...news].reverse().map((n, i) => (
          <li key={i}>
            <span className="muted">week {n.week}:</span> {n.text}
          </li>
        ))}
        {news.length === 0 && <li className="muted">Nothing has happened here lately, the port captain says.</li>}
      </ul>
      <h3>The imperial trade</h3>
      <ul>
        {eids.map((e) => (
          <li key={e}>
            {empireName(view, e)} ships in {view.empires[e].exports.join(' and ')} from its capital and sends home {view.empires[e].imports.join(' and ')}.
          </li>
        ))}
      </ul>
      <h3>Between the powers</h3>
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

/** Ask a well-disposed captain to leave a good at a world to you. */
function AskRoute({ view, captain, state, act }: { view: PlayerView; captain: CharacterId; state: GameState; act: PaneProps['act'] }) {
  const [open, setOpen] = useState(false)
  const [world, setWorld] = useState<string>(view.here?.destinations[0]?.world ?? '')
  const [good, setGood] = useState<string>('grain')
  if (!open)
    return (
      <button className="tiny" onClick={() => setOpen(true)}>
        ask them to leave a route to you
      </button>
    )
  return (
    <span className="askroute">
      leave the{' '}
      <select value={good} onChange={(e) => setGood(e.target.value)}>
        {(view.here?.market ?? []).map((r) => (
          <option key={r.good} value={r.good}>
            {r.good}
          </option>
        ))}
      </select>{' '}
      at{' '}
      <select value={world} onChange={(e) => setWorld(e.target.value)}>
        {[view.here!.world, ...(view.here?.destinations.map((d) => d.world) ?? [])].map((w) => (
          <option key={w} value={w}>
            {view.chart[w].name}
          </option>
        ))}
      </select>{' '}
      to me{' '}
      <button
        onClick={act(() => {
          askForRoute(state, captain, world as WorldId, good as Good)
          setOpen(false)
        })}
      >
        ask
      </button>
    </span>
  )
}

function Bar({ view, state, act }: PaneProps) {
  const here = view.here!
  const [heard, setHeard] = useState<string | null>(null)
  const captains = here.hulls.filter((h) => h.captain && h.captainName)
  const MOOD = { glad: 'would gladly tell you what they know', fence: 'might, for a round', tight: 'keeps their own counsel' }
  const ask = (h: (typeof captains)[number], bribe: boolean) => () => {
    const a = askCaptain(state, h.captain!, bribe)
    setHeard(a === 'told' ? `${h.captainName} tells you what they know of prices.` : a === 'refused' ? `${h.captainName} talks of anything but prices.` : a === 'already' ? 'You asked already this week.' : a === 'no_use' ? 'A round would not change their mind.' : 'They are not here.')
  }
  return (
    <div className="scene">
      <p>
        The bar by the docks. <button onClick={act(() => setHeard(((n) => (n > 0 ? `You pick up ${n} prices going round the docks.` : 'Nothing going round you had not heard.'))(talkAtBar(state))))}>listen</button>
      </p>
      {heard && <p>{heard}</p>}
      <ul>
        {captains.map((h) => (
          <li key={h.id}>
            <b>{h.captainName}</b> of the {h.name}, {TYPE_WORDS[h.type]}, {empireName(view, h.empire)}
            {h.guild ? ', guild' : ''} · {MOOD[h.mood ?? 'tight']}
            {h.greeting && <div className="greeting">“{h.greeting}”</div>}
            {h.roundWelcome && (
              <button disabled={view.purse < 500} onClick={act(() => round(state, h.captain!))}>
                stand a round (500 Cr)
              </button>
            )}
            {h.wouldGrant && <AskRoute view={view} captain={h.captain!} state={state} act={act} />}
            {!h.asked && (
              <>
                {' '}
                <button onClick={act(ask(h, false))}>ask</button>
              </>
            )}
            {h.asked && !h.told && h.roundWouldHelp && (
              <>
                {' '}
                <span className="muted">They might come round for a drink.</span>{' '}
                <button disabled={view.purse < 500} onClick={act(ask(h, true))}>
                  stand a round (500 Cr)
                </button>
              </>
            )}
          </li>
        ))}
        {captains.length === 0 && <li className="muted">{here.hulls.length > 0 ? "Only scouts' crews, who go unnamed and say nothing." : 'Nobody in from anywhere.'}</li>}
      </ul>
    </div>
  )
}

/** The Book: everyone you have dealt with or watched. */
function Book({ view }: { view: PlayerView }) {
  const [open, setOpen] = useState<string | null>(null)
  const [all, setAll] = useState(false)
  const pages = all ? view.book : view.book.slice(0, 8)
  return (
    <section className="book">
      <h2>
        The Book <span className="muted">· {view.book.length} people</span>{' '}
        {view.book.length > 8 && (
          <button className="tiny" onClick={() => setAll(!all)}>
            {all ? 'fewer' : 'all'}
          </button>
        )}
      </h2>
      {view.book.some((p) => p.askedOfYou) && (
        <p className="warn">
          Asked of you:{' '}
          {view.book
            .filter((p) => p.askedOfYou)
            .map((p) => `${p.name}: the ${p.askedOfYou!.good} at ${view.chart[p.askedOfYou!.world].name}`)
            .join('; ')}
          .
        </p>
      )}
      {view.book.length === 0 && <p className="muted">Nobody yet. Ask at the bar; watch the docks.</p>}
      <ul>
        {pages.map((p) => (
          <li key={p.id} className={empireClass(view, p.empire)}>
            <span className="dot" />{' '}
            <button className="link" onClick={() => setOpen(open === p.id ? null : p.id)}>
              <b>{p.name}</b>
            </button>{' '}
            <span className="muted">
              {p.hull ? `of the ${p.hull}, ` : ''}
              {empireName(view, p.empire)}
              {p.guild ? ', guild' : ''}
              {p.outlaw ? ', outlaw' : ''} · {p.standing} · {p.esteem}
              {p.impression.length ? ` · ${p.impression.join(', ')}` : ''}
            </span>
            {open === p.id && (
              <div className="page">
                {p.lastSeen && (
                  <p className="muted">
                    Last seen at {view.chart[p.lastSeen.world].name}, {ago(view.week, p.lastSeen.week)}. Their word has proved {p.trust >= 0.7 ? 'good' : p.trust <= 0.3 ? 'bad' : 'neither here nor there'}.
                  </p>
                )}
                {p.askedOfYou && (
                  <p className="warn">
                    {p.askedOfYou.tone === 'solid' ? 'Asked you, as a favour,' : 'Warned you'} to leave the {p.askedOfYou.good} at {view.chart[p.askedOfYou.world].name} to them, week {p.askedOfYou.since}.
                  </p>
                )}
                {p.askedByYou && (
                  <p className="muted">
                    You asked them to leave the {p.askedByYou.good} at {view.chart[p.askedByYou.world].name} to you, week {p.askedByYou.since}.
                  </p>
                )}
                {(p.friends.length > 0 || p.enemies.length > 0) && (
                  <p className="muted">
                    {p.friends.length > 0 && `Counts ${p.friends.map((f) => `${f.name} (so says ${f.from})`).join(', ')} a friend. `}
                    {p.enemies.length > 0 && `Counts ${p.enemies.map((f) => `${f.name} (so says ${f.from})`).join(', ')} an enemy.`}
                  </p>
                )}
                {p.notes.length > 0 && (
                  <ul className="notes">
                    {p.notes.map((n, i) => (
                      <li key={i}>{n}</li>
                    ))}
                  </ul>
                )}
                {p.seenTrading.length > 0 && (
                  <ul className="notes">
                    {p.seenTrading.map((n, i) => (
                      <li key={i}>{n}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Who came and went at a world, as far as the player knows, newest first, with how they know. */
function Traffic({ view, world }: { view: PlayerView; world: WorldId }) {
  const [open, setOpen] = useState(false)
  const lines = view.known.traffic[world] ?? []
  if (lines.length === 0) return <p className="muted">You know nothing of who comes and goes here.</p>
  const shown = open ? lines : lines.slice(0, 6)
  const SRC = { seen: 'seen', register: 'register', heard: 'heard' }
  return (
    <div className="traffic">
      <h3>
        Comings and goings{' '}
        {lines.length > 6 && (
          <button className="tiny" onClick={() => setOpen(!open)}>
            {open ? 'fewer' : `all ${lines.length}`}
          </button>
        )}
      </h3>
      <ul>
        {shown.map((k) => {
          const m = k.movement
          const what = [
            m.from ? `in from ${view.chart[m.from]?.name ?? m.from}` : '',
            ...m.sold.map((x) => `sold ${x.tons}t ${x.good} @${cr(x.price)}`),
            ...m.bought.map((x) => `bought ${x.tons}t ${x.good} @${cr(x.price)}`),
            m.to ? `sailed for ${view.chart[m.to]?.name ?? m.to}` : '',
          ].filter(Boolean)
          return (
            <li key={`${m.week}-${m.ship}`} className={empireClass(view, m.empire)}>
              <span className="muted">wk {m.week}</span> <span className="dot" /> <b>{m.shipName}</b>
              {m.captainName ? `, ${m.captainName}` : ''}: {what.join('; ') || 'lay in port'} <span className="muted">[{SRC[k.source]}]</span>
            </li>
          )
        })}
      </ul>
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
            {snap.profile.specialty && <b> · {snap.profile.specialty.kind === 'maker' ? `famous for its ${snap.profile.specialty.good}` : `a great market for ${snap.profile.specialty.good}`}</b>}
          </p>
          {goods.length > 0 ? (
            <table className="market small">
              <tbody>
                {goods.map((g) => (
                  <tr key={g} className={prices[g]!.heard ? 'heard' : ''}>
                    <td>{g}</td>
                    <td>{cr(prices[g]!.price)}</td>
                    <td>{Math.floor(prices[g]!.stock)} t</td>
                    <td className="muted">
                      {ago(view.week, prices[g]!.observed)}
                      {prices[g]!.heard ? ' · heard' : ''}
                    </td>
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
          <Traffic view={view} world={world} />
          <p className="muted">Settled by {entry.cultures.join(', ')}.</p>
        </>
      ) : (
        <p>Nothing is known of it.</p>
      )}
    </section>
  )
}
