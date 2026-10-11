import type { LayoutClass, WidthClass } from '@hangul-route/design-system';

/**
 * How a minigame arranges itself on the window it has (F-LAYOUT-001 §3.6,
 * §3.12). Pure, and token-free (the screen passes the sizes in), so the rules
 * are tested without a renderer.
 *
 * - `stacked`: the phone layout, prompt above the answers (today's layout).
 * - `side`:    prompt (and its picture or sound) on the left, the answers on the right.
 */
export type GameArrangement = 'stacked' | 'side';

/**
 * Match Sound, Culture Quiz and Odd One Out: prompt left, tiles right on a
 * `sideBySide` window, but the games opt out on a `short` one, so a landscape
 * phone (844 x 390) keeps the stacked layout it has today.
 */
export function gameArrangement(l: Pick<LayoutClass, 'sideBySide' | 'short'>): GameArrangement {
  return l.sideBySide && !l.short ? 'side' : 'stacked';
}

/**
 * Listen & Pick (a picture or a sound with text answers) follows `sideBySide`
 * at any height, like the story reader and the Discover pages: a landscape
 * phone gets two columns too (§3.6 "new specs" row, F-STORY-002 §3.3).
 */
export function pictureTextArrangement(l: Pick<LayoutClass, 'sideBySide'>): GameArrangement {
  return l.sideBySide ? 'side' : 'stacked';
}

/**
 * Width of the tile grid of a four-tile game. Phones keep today's wrapping row
 * (no cap); from `regular` up the grid holds two tiles and one gap, so the four
 * tiles sit 2 x 2 at their scaled size instead of a thin row across a tablet.
 */
export function tileGridWidth(width: WidthClass, tile: number, gap: number): number | undefined {
  return width === 'compact' ? undefined : 2 * tile + gap;
}
