import { describe, expect, it } from 'vitest'
import { buyGoods, newGame, PLAYER, playerShip, portClosed, sellGoods } from './game'
import { characterLocation } from './mail'
import { stanceKey, type WorldId } from './types'
import { GOODS } from './economy'

describe('smuggling', () => {
  it('an enemy port refuses lawful trade and allows it off the books, and the customs house catches some', () => {
    const state = newGame(71)
    const me = state.characters[PLAYER]
    const here = characterLocation(state, PLAYER) as WorldId
    const port = state.worlds[here]
    const foe = Object.keys(state.empires).find((e) => e !== me.empire)!
    // Make this port the enemy's and post the war on its board.
    port.empire = foe as never
    port.board[stanceKey(port.empire, me.empire)] = { pair: [port.empire, me.empire], stance: 'war', week: 0 }
    expect(portClosed(state, port)).toBe(true)
    const good = GOODS.find((g) => port.market[g].stock >= 50)!
    expect(buyGoods(state, good, 10).kind).toBe('refused')
    let caught = 0
    let ok = 0
    for (let i = 0; i < 40 && !me.captive; i++) {
      port.market[good].stock = 100
      const o = buyGoods(state, good, 1, true)
      if (o.kind === 'caught') caught++
      else if (o.kind === 'ok') {
        ok++
        expect(o.duty).toBe(0)
      }
    }
    expect(ok).toBeGreaterThan(0)
    expect(caught).toBeGreaterThan(0)
    expect(state.empires[foe as never].treasury).toBeGreaterThan(0)
    expect(port.news.some((n) => /customs house|arrested/.test(n.text))).toBe(true)
  })

  it('a smuggler who cannot pay the fine is arrested and held by that empire', () => {
    const state = newGame(72)
    const me = state.characters[PLAYER]
    const here = characterLocation(state, PLAYER) as WorldId
    const port = state.worlds[here]
    port.profile.law = 9
    const good = GOODS.find((g) => port.market[g].stock >= 50)!
    me.purse = port.market[good].price * 10 + 10
    let arrested = false
    for (let i = 0; i < 60 && !arrested; i++) {
      port.market[good].stock = 100
      const o = buyGoods(state, good, 10, true)
      if (o.kind === 'caught' && o.arrested) arrested = true
      else if (o.kind === 'ok') {
        const s = sellGoods(state, good, 10, true)
        if (s.kind === 'caught' && s.arrested) arrested = true
      }
      me.purse = Math.max(me.purse, port.market[good].price * 10 + 10)
    }
    expect(arrested).toBe(true)
    expect(me.captive?.of).toBe(port.empire)
    expect(me.captive?.at).toBe(here)
    expect(me.captive?.by).toBeNull()
    expect(playerShip(state)).not.toBeNull()
  })
})
