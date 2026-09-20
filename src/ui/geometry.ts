/** Map geometry and the overlay contract, shared by the map and the dev god view. */
import { SUBSECTOR_COLS, SUBSECTOR_ROWS, type Hex } from '../sim/hex'
import type { WorldId } from '../sim/view'

export const SIZE = 30
export const W = SIZE * 2
export const H = Math.sqrt(3) * SIZE
const PAD = 16

/** Flat-topped hexes, odd (1-based) columns shifted down half a hex, matching hexDistance in the sim. */
export function hexCenter({ col, row }: Hex): { x: number; y: number } {
  const x = PAD + SIZE + (col - 1) * 1.5 * SIZE
  const y = PAD + H / 2 + (row - 1) * H + (col % 2 === 1 ? H / 2 : 0)
  return { x, y }
}

export const WIDTH = PAD * 2 + 1.5 * SIZE * (SUBSECTOR_COLS - 1) + W
export const HEIGHT = PAD * 2 + H * SUBSECTOR_ROWS + H / 2

export function hexPoints(cx: number, cy: number, r: number): string {
  const pts: string[] = []
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`)
  }
  return pts.join(' ')
}

/** Ground-truth markers the god view may lay over the map. Computed elsewhere; the map only draws them. */
export interface Overlay {
  ships: { hex: Hex; label: string; inTransit: boolean }[]
  unrest: Record<WorldId, number>
}

