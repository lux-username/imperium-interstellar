/**
 * The culture weighting tables, as data. `CORE` is the imperial core (the
 * British Isles table in design/culture-tables.md); `WORLD` is the wider
 * population. Weights are percentages and each table sums to 100.
 *
 * Intended use: a world rolls 1d3 cultures from WORLD; an officer's name
 * comes from CORE 60% of the time and WORLD 40%.
 */
import type { Culture } from './culture'
import { english } from './english'
import { irish } from './irish'
import { scottish } from './scottish'
import { welsh } from './welsh'
import { han } from './han'
import { japanese } from './japanese'
import { korean } from './korean'
import { gangetic } from './gangetic'
import { bengali } from './bengali'
import { deccani } from './deccani'
import { russian } from './russian'
import { french } from './french'
import { german } from './german'
import { turkish } from './turkish'
import { persian } from './persian'
import { egyptian } from './egyptian'
import { javanese } from './javanese'
import { vietnamese } from './vietnamese'
import { siamese } from './siamese'
import { yoruba } from './yoruba'
import { igbo } from './igbo'
import { afroAmerican } from './afro-american'
import { quechua } from './quechua'
import { nahuatl } from './nahuatl'
import { maya } from './maya'
import { uzbek } from './uzbek'
import { kazakh } from './kazakh'
import { uyghur } from './uyghur'
import { aborigine } from './aborigine'
import { maori } from './maori'
import { hawaiian } from './hawaiian'

export type { Culture } from './culture'

export interface Weighted {
  culture: Culture
  weight: number
}

export const CORE: Weighted[] = [
  { culture: english, weight: 65 },
  { culture: irish, weight: 25 },
  { culture: scottish, weight: 8 },
  { culture: welsh, weight: 2 },
]

export const WORLD: Weighted[] = [
  { culture: han, weight: 14 },
  { culture: japanese, weight: 13 },
  { culture: korean, weight: 13 },
  { culture: gangetic, weight: 7 },
  { culture: bengali, weight: 7 },
  { culture: deccani, weight: 7 },
  { culture: russian, weight: 6 },
  { culture: french, weight: 6 },
  { culture: german, weight: 6 },
  { culture: turkish, weight: 2 },
  { culture: persian, weight: 2 },
  { culture: egyptian, weight: 2 },
  { culture: javanese, weight: 1 },
  { culture: vietnamese, weight: 1 },
  { culture: siamese, weight: 1 },
  { culture: yoruba, weight: 1 },
  { culture: igbo, weight: 1 },
  { culture: afroAmerican, weight: 1 },
  { culture: quechua, weight: 1 },
  { culture: nahuatl, weight: 1 },
  { culture: maya, weight: 1 },
  { culture: uzbek, weight: 1 },
  { culture: kazakh, weight: 1 },
  { culture: uyghur, weight: 1 },
  { culture: aborigine, weight: 1 },
  { culture: maori, weight: 1 },
  { culture: hawaiian, weight: 1 },
]

/** Every culture in either table, for lookups by name. */
export const CULTURES: Culture[] = [...CORE, ...WORLD].map((w) => w.culture)
