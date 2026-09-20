/**
 * Original name generator for worlds and people. Names are built from
 * syllables so nothing here resembles any published setting; the syllable
 * lists are ours and can be tuned freely.
 */
import { nextInt, type Rng } from './rng'

const ONSETS = ['', '', 'b', 'br', 'c', 'ch', 'd', 'dr', 'f', 'g', 'gr', 'h', 'j', 'k', 'kr', 'l', 'm', 'n', 'p', 'pr', 'r', 's', 'sh', 'st', 't', 'th', 'tr', 'v', 'w', 'z']
const NUCLEI = ['a', 'e', 'i', 'o', 'u', 'a', 'e', 'o', 'ae', 'ai', 'au', 'ea', 'ei', 'ou', 'y']
const CODAS = ['', '', '', 'n', 'r', 's', 'l', 'th', 'x', 'm', 'nd', 'rn', 'sk', 'st', 'k', 'd', 't', 'll', 'ss']

function pick<T>(rng: Rng, list: T[]): T {
  return list[nextInt(rng, 0, list.length - 1)]
}

function syllable(rng: Rng, first: boolean): string {
  const onset = first ? pick(rng, ONSETS) : pick(rng, ONSETS.filter((o) => o.length <= 1 || o === 'th' || o === 'sh'))
  return onset + pick(rng, NUCLEI) + pick(rng, CODAS)
}

/** One capitalised word of two or three syllables. */
export function word(rng: Rng): string {
  const count = nextInt(rng, 2, 3)
  let s = ''
  for (let i = 0; i < count; i++) s += syllable(rng, i === 0)
  // Collapse doubled letters across syllable joins so "Kell" doesn't become "Kelll".
  s = s.replace(/(.)\1\1+/g, '$1$1')
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** A world name not already in `taken`. Adds it to `taken`. */
export function worldName(rng: Rng, taken: Set<string>): string {
  for (;;) {
    const name = word(rng)
    if (name.length >= 4 && name.length <= 10 && !taken.has(name)) {
      taken.add(name)
      return name
    }
  }
}

/** A person's name: given name and family name. */
export function personName(rng: Rng): string {
  return `${word(rng)} ${word(rng)}`
}
