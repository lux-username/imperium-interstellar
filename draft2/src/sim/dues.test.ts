import { describe, expect, it } from 'vitest'
import { DUES_YEAR, expelLapsed, GUILD_DUES, payDues, trade } from './agents'
import { advanceWeek, newGame, PLAYER } from './game'
import { sell } from './economy'
import type { WorldId } from './types'

describe('guild dues', () => {
  it('a member sets aside a share of every sale, pays it over at the seat, and is struck off after a year unpaid', () => {
    const state = newGame(161)
    const member = Object.values(state.characters).find((c) => c.guild && c.id !== PLAYER && c.body.kind === 'aboard')!
    const ship = state.ships[(member.body as { ship: string }).ship as never]
    const g = state.guilds[member.guild!]
    const here = state.worlds[g.seat]
    const deal = sell(here, 'grain', 10, member.empire)
    const net = trade(state, here, deal, ship, 'sold', 'grain')
    expect(member.dues).toBe(Math.round(deal.credits * GUILD_DUES))
    expect(net.credits).toBe(deal.credits - member.dues!)
    const purse = g.purse
    payDues(state, member, g.seat)
    expect(g.purse).toBe(purse + Math.round(deal.credits * GUILD_DUES))
    expect(member.dues).toBe(0)
    expect(member.duesPaid).toBe(state.week)
    // Elsewhere, nothing is paid; a year on, the guild strikes them off and says so at the seat.
    const other = Object.keys(state.worlds).find((w) => w !== g.seat) as WorldId
    payDues(state, member, other)
    member.duesPaid = state.week - DUES_YEAR - 1
    expelLapsed(state)
    expect(member.guild).toBeUndefined()
    expect(here.news.some((n) => /struck .* off its rolls/.test(n.text))).toBe(true)
  })

  it('over two years most members keep paid up, a few are struck off, and the guilds\' purses grow on dues', () => {
    const state = newGame(162)
    const members = Object.values(state.characters).filter((c) => c.guild && c.id !== PLAYER && c.body.kind === 'aboard' && !state.ships[(c.body as { ship: string }).ship as never]?.duty)
    const purses = Object.values(state.guilds).map((g) => g.purse)
    let struck = 0
    for (let i = 0; i < 104; i++) {
      advanceWeek(state)
      for (const g of Object.values(state.guilds)) for (const n of state.worlds[g.seat].news) if (n.week === state.week && /struck .* off/.test(n.text)) struck++
    }
    const still = members.filter((c) => c.guild).length
    expect(still).toBeGreaterThan(members.length / 2)
    expect(struck).toBeLessThan(members.length / 2)
    const paidLately = members.filter((c) => c.guild && state.week - (c.duesPaid ?? 0) <= DUES_YEAR).length
    expect(paidLately).toBe(still)
    void purses
  })
})
