/** Small formatting helpers shared by the panes. Everything takes PlayerView data only. */
import type { PlayerView, Report, Week, WorldId, WorldProfile } from '../sim/view'

/** "now", "1 wk ago", "14 wk ago". */
export function ago(week: Week, observed: Week): string {
  const n = week - observed
  if (n <= 0) return 'now'
  return `${n} wk ago`
}

export function weekLabel(week: Week): string {
  return `wk ${week}`
}

/** Compact profile string, e.g. "B567555-9". Same encoding the sim uses. */
export function profileString(p: WorldProfile): string {
  const d = (n: number) => n.toString(16).toUpperCase()
  return `${p.starport}${d(p.size)}${d(p.atmosphere)}${d(p.hydrographics)}${d(p.population)}${d(p.government)}${d(p.law)}-${d(p.tech)}`
}

export function worldName(view: PlayerView, id: WorldId): string {
  return view.chart[id]?.name ?? id
}

/** The world a report is about, for selection: the world itself, or where the ship was seen. */
export function subjectWorld(report: Report): WorldId {
  return report.snapshot.kind === 'world' ? report.snapshot.world.id : report.snapshot.ship.at
}

export function subjectName(report: Report): string {
  return report.snapshot.kind === 'world' ? report.snapshot.world.name : report.snapshot.ship.name
}

/** Freshness bucket for colouring: how old is what we know. */
export function freshness(week: Week, observed: Week): 'fresh' | 'aging' | 'stale' | 'ancient' {
  const n = week - observed
  if (n <= 4) return 'fresh'
  if (n <= 12) return 'aging'
  if (n <= 30) return 'stale'
  return 'ancient'
}

export const UNREST_WORDS = ['calm', 'calm', 'grumbling', 'grumbling', 'restive', 'restive', 'unruly', 'unruly', 'rioting', 'rioting', 'in revolt']

export function unrestWord(n: number): string {
  return UNREST_WORDS[Math.max(0, Math.min(10, n))]
}
