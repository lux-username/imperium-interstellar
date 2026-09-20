/**
 * Subsector hex grid. Columns and rows are 1-based as they appear on a
 * printed map ("0533" = column 05, row 33 within the sector), but within one
 * subsector we use 1..8 columns and 1..10 rows. One hex = one parsec.
 *
 * The grid is "odd-q" offset (flat-topped hexes, odd columns shifted down),
 * which matches the conventional look of a subsector map. Distances are
 * computed in cube coordinates.
 */
export interface Hex {
  col: number
  row: number
}

export const SUBSECTOR_COLS = 8
export const SUBSECTOR_ROWS = 10

interface Cube {
  q: number
  r: number
  s: number
}

function toCube({ col, row }: Hex): Cube {
  const q = col
  const r = row - (col - (col & 1)) / 2
  return { q, r, s: -q - r }
}

/** Distance in parsecs (jumps of 1) between two hexes. */
export function hexDistance(a: Hex, b: Hex): number {
  const ca = toCube(a)
  const cb = toCube(b)
  return Math.max(Math.abs(ca.q - cb.q), Math.abs(ca.r - cb.r), Math.abs(ca.s - cb.s))
}

/** Four-digit map label, e.g. { col: 5, row: 3 } -> "0503". */
export function hexLabel({ col, row }: Hex): string {
  return `${String(col).padStart(2, '0')}${String(row).padStart(2, '0')}`
}

export function hexEquals(a: Hex, b: Hex): boolean {
  return a.col === b.col && a.row === b.row
}

/** Every hex in the subsector, column-major, for iteration during generation. */
export function allHexes(): Hex[] {
  const hexes: Hex[] = []
  for (let col = 1; col <= SUBSECTOR_COLS; col++) {
    for (let row = 1; row <= SUBSECTOR_ROWS; row++) hexes.push({ col, row })
  }
  return hexes
}
