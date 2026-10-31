/** What a port tells of lately. Kept on the world for NEWS_WEEKS and carried in every snapshot of it. */
import type { GameState, WorldId } from './types'

/** Weeks a port keeps a piece of news on its board. */
export const NEWS_WEEKS = 8

export function postNewsItem(state: GameState, at: WorldId, text: string): void {
  const world = state.worlds[at]
  world.news.push({ week: state.week, text })
  world.news = world.news.filter((n) => state.week - n.week <= NEWS_WEEKS)
}
