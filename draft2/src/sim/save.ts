/**
 * Save and load. A GameState is plain data, so a save is just JSON with a
 * format tag; the RNG state rides along, so a loaded game continues exactly
 * as the unloaded one would have.
 */
import type { GameState } from './types'

const FORMAT = 'imperium-interstellar/draft2'
export const SAVE_VERSION = 6

interface SaveFile {
  format: typeof FORMAT
  version: number
  state: GameState
}

export function serialize(state: GameState): string {
  const file: SaveFile = { format: FORMAT, version: SAVE_VERSION, state }
  return JSON.stringify(file)
}

export function deserialize(json: string): GameState {
  const file = JSON.parse(json) as Partial<SaveFile>
  if (file.format !== FORMAT) throw new Error('Not an Imperium Interstellar draft 2 save')
  if (file.version !== SAVE_VERSION) throw new Error(`Save is version ${file.version}; this build reads version ${SAVE_VERSION}`)
  if (!file.state) throw new Error('Save has no game in it')
  return file.state
}

/** A deep copy through JSON, which is exactly what save-then-load does. */
export function clone(state: GameState): GameState {
  return JSON.parse(JSON.stringify(state)) as GameState
}
