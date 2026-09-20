import { SUBSECTOR_COLS, SUBSECTOR_ROWS } from '../sim/hex'

/**
 * Shell layout only. The real panes (Inbox, Map, Roster, Outgoing, Ledger)
 * arrive with Phase 0. Nothing here may read simulation ground truth; the UI
 * only ever sees a PlayerView built from delivered reports.
 */
export function App() {
  return (
    <div className="shell">
      <header className="topbar">
        <h1>Imperium Interstellar</h1>
        <span className="week">Week 1</span>
        <button type="button" disabled>
          Advance Week
        </button>
      </header>
      <main className="panes">
        <section className="pane inbox">
          <h2>Inbox</h2>
          <p className="empty">No dispatches have arrived.</p>
        </section>
        <section className="pane map">
          <h2>Subsector</h2>
          <p className="empty">
            {SUBSECTOR_COLS}×{SUBSECTOR_ROWS} parsecs. Last-known map will render here.
          </p>
        </section>
      </main>
    </div>
  )
}
