import { describe, expect, it } from 'vitest'
import { CORE, CULTURES, WORLD } from './data/names'
import { newCharacter } from './characters'
import { cultureByName, officerCulture, personName, rollSex, worldCultures, worldName } from './names'
import { createRng } from './rng'
import type { CharacterId, FactionId } from './types'

const coreNames = new Set(CORE.map((w) => w.culture.name))
const worldNames = new Set(WORLD.map((w) => w.culture.name))

describe('worlds', () => {
  it('roll one to three distinct cultures from the world table', () => {
    const rng = createRng(1)
    const counts = [0, 0, 0, 0]
    for (let i = 0; i < 600; i++) {
      const c = worldCultures(rng)
      expect(c.length).toBeGreaterThanOrEqual(1)
      expect(c.length).toBeLessThanOrEqual(3)
      expect(new Set(c).size).toBe(c.length)
      for (const name of c) expect(worldNames.has(name), name).toBe(true)
      counts[c.length]++
    }
    // A flat 1d3: each count shows up about a third of the time.
    for (const n of [1, 2, 3]) expect(counts[n]).toBeGreaterThan(150)
  })

  it('take their name from one of their cultures, and never repeat one already on the chart', () => {
    const rng = createRng(2)
    const taken = new Set<string>()
    const cultures = ['Han', 'French']
    const places = new Set([...cultureByName('Han').places, ...cultureByName('French').places])
    for (let i = 0; i < 100; i++) {
      const name = worldName(rng, cultures, taken)
      expect(taken.has(name)).toBe(true)
      const bare = name.replace(/^(New|Port) /, '')
      expect(places.has(bare), name).toBe(true)
    }
    expect(taken.size).toBe(100)
  })

  it('fall back to New X or Port X when every bare toponym is taken', () => {
    const rng = createRng(3)
    const taken = new Set(cultureByName('Welsh').places)
    const name = worldName(rng, ['Welsh'], taken)
    expect(name).toMatch(/^(New|Port) /)
  })
})

describe('officers', () => {
  it('come from the core six times in ten and the wider world the other four', () => {
    const rng = createRng(4)
    let core = 0
    const n = 5000
    for (let i = 0; i < n; i++) {
      const c = officerCulture(rng)
      if (coreNames.has(c)) core++
      else expect(worldNames.has(c), c).toBe(true)
    }
    expect(core / n).toBeGreaterThan(0.56)
    expect(core / n).toBeLessThan(0.64)
  })

  it('are as often women as men', () => {
    const rng = createRng(5)
    let f = 0
    for (let i = 0; i < 2000; i++) if (rollSex(rng) === 'f') f++
    expect(f).toBeGreaterThan(900)
    expect(f).toBeLessThan(1100)
  })

  it('carry the culture and sex their name was drawn for, whichever side they serve', () => {
    const rng = createRng(6)
    for (let i = 0; i < 50; i++) {
      const c = newCharacter(rng, `c-${i}` as CharacterId, 'f-pirates' as FactionId, { kind: 'unassigned', at: 'w-x' as never })
      expect(c.culture && (coreNames.has(c.culture) || worldNames.has(c.culture))).toBe(true)
      expect(c.sex === 'm' || c.sex === 'f').toBe(true)
      expect(c.name).not.toMatch(/[{}]/)
      expect(c.name.trim().length).toBeGreaterThan(0)
    }
  })
})

describe('names by pattern', () => {
  it('every culture names both sexes with nothing left unfilled', () => {
    const rng = createRng(7)
    for (const c of CULTURES) {
      for (const sex of ['m', 'f'] as const) {
        const name = personName(rng, c.name, sex)
        expect(name, `${c.name} ${sex}`).not.toMatch(/[{}]/)
        expect(name, `${c.name} ${sex}`).not.toMatch(/\s\s|^\s|\s$/)
        expect(c.given[sex].some((g) => name.includes(g)), `${c.name} ${sex}: ${name}`).toBe(true)
      }
    }
  })

  it('puts the family name first where the tradition does', () => {
    const rng = createRng(8)
    const han = cultureByName('Han')
    const name = personName(rng, 'Han', 'm')
    const [first] = name.split(' ')
    expect(han.family).toContain(first)
  })

  it('gives a Russian woman the feminine surname', () => {
    const rng = createRng(9)
    const ru = cultureByName('Great Russian')
    for (let i = 0; i < 20; i++) {
      const name = personName(rng, 'Great Russian', 'f')
      const surname = name.split(' ').at(-1)!
      expect(ru.familyF, name).toContain(surname)
    }
  })

  it("builds a patronymic from a man's name where there were no surnames", () => {
    const rng = createRng(10)
    const kz = cultureByName('Kazakh')
    const m = personName(rng, 'Kazakh', 'm')
    const f = personName(rng, 'Kazakh', 'f')
    expect(m).toMatch(/uly$/)
    expect(f).toMatch(/qyzy$/)
    expect(kz.given.m.some((g) => f.includes(`${g}qyzy`)), f).toBe(true)
  })

  it('leaves a Javanese woman her one name', () => {
    const rng = createRng(11)
    const jv = cultureByName('Javanese')
    const name = personName(rng, 'Javanese', 'f')
    expect(jv.given.f).toContain(name)
  })

  it('never pairs a given name with a family name from another community', () => {
    const rng = createRng(12)
    for (const c of CULTURES) {
      if (!c.communities) continue
      const seen = new Set<string>()
      for (let i = 0; i < 300; i++) {
        const sex = i % 2 === 0 ? 'm' : 'f'
        const name = personName(rng, c.name, sex)
        const home = c.communities.filter((k) => k.given[sex].some((g) => name.startsWith(`${g} `)) && k.family.some((f) => name.endsWith(` ${f}`)))
        expect(home.length, `${c.name}: ${name}`).toBeGreaterThan(0)
        for (const k of home) seen.add(k.name)
      }
      // Every community gets drawn, the small ones included.
      expect(seen.size).toBe(c.communities.length)
    }
  })

  it('is reproducible from the seed', () => {
    const a = personName(createRng(13), 'Irish', 'f')
    const b = personName(createRng(13), 'Irish', 'f')
    expect(a).toBe(b)
  })

  it('rejects a culture that is not in the tables', () => {
    expect(() => personName(createRng(1), 'Atlantean', 'm')).toThrow(/Unknown culture/)
  })
})
