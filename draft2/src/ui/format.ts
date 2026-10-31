/** Small formatting helpers shared by the panes. Everything takes PlayerView data only. */
import type { EmpireId, PlayerView, Week, WorldProfile } from '../sim/view'

/** "now", "1 wk ago", "14 wk ago". */
export function ago(week: Week, observed: Week): string {
  const n = week - observed
  if (n <= 0) return 'now'
  return `${n} wk ago`
}

/** Freshness bucket for colouring: how old is what we know. */
export function freshness(week: Week, observed: Week): 'fresh' | 'aging' | 'stale' | 'ancient' {
  const n = week - observed
  if (n <= 4) return 'fresh'
  if (n <= 12) return 'aging'
  if (n <= 30) return 'stale'
  return 'ancient'
}

/** The CSS class for an empire: e0, e1, e2 in chart order. */
export function empireClass(view: PlayerView, empire: EmpireId): string {
  const ids = Object.keys(view.empires).sort()
  const i = ids.indexOf(empire)
  return i < 0 ? 'e-none' : `e${i}`
}

export function empireName(view: PlayerView, empire: EmpireId): string {
  return view.empires[empire]?.name ?? 'an unknown power'
}

export function profileString(p: WorldProfile): string {
  const d = (n: number) => n.toString(16).toUpperCase()
  return `${p.starport}${d(p.size)}${d(p.atmosphere)}${d(p.hydrographics)}${d(p.population)}${d(p.government)}${d(p.law)}-${d(p.tech)}`
}

export const TYPE_WORDS: Record<string, string> = {
  scout: 'scout',
  free_trader: 'free trader',
  armed_trader: 'armed trader',
  far_trader: 'far trader',
  bulk_freighter: 'bulk freighter',
  patrol_boat: 'patrol boat',
  corvette: 'corvette',
  frigate: 'frigate',
}
