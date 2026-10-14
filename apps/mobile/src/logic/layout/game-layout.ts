import type { LayoutClass } from '@hangul-route/design-system';

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
 * Width of the tile grid of a four-tile game. Phones and any short window (a
 * landscape phone at 844 x 390 or 932 x 430 keeps today's single row of four,
 * §3.6 "short: as today") get no cap; from `regular` up the grid holds two
 * tiles and one gap, so the four tiles sit 2 x 2 at their scaled size instead
 * of a thin row across a tablet.
 */
export function tileGridWidth(l: Pick<LayoutClass, 'width' | 'short'>, tile: number, gap: number): number | undefined {
  return l.width === 'compact' || l.short ? undefined : 2 * tile + gap;
}

/**
 * Width the answers get: the `Screen` reading column (the window less two
 * gutters, capped at `maxWidth.reading`), or half of it less the column gap
 * beside the prompt. Insets are not known here, so a notch makes the real
 * column a little narrower. An unknown window gives 0.
 */
export function answersColumnWidth(
  l: Pick<LayoutClass, 'windowWidth' | 'gutter' | 'maxWidth'>,
  arrangement: GameArrangement,
  gap: number,
): number {
  if (!(l.windowWidth > 0)) return 0;
  const content = Math.max(0, Math.min(l.windowWidth - 2 * l.gutter, l.maxWidth.reading));
  return arrangement === 'side' ? Math.max(0, (content - gap) / 2) : content;
}

/** Whether two cards side by side in a column of this width each get at least `minCard`. */
export function twoUpFits(columnWidth: number, gap: number, minCard: number): boolean {
  return Number.isFinite(columnWidth) && columnWidth > 0 && (columnWidth - gap) / 2 >= minCard;
}

/**
 * How the prompt column stays in view beside a taller answer column (Realia Read, D-2 D7: the
 * realia stays readable beside long options). Side by side only, and only when the game asks:
 *
 * - `css`:     the web. The page scrolls as one; the prompt column is CSS `position: sticky`.
 * - `columns`: native (a tablet, a phone on its side). React Native has no sticky, so the screen
 *              stops scrolling and each column scrolls on its own: the prompt stays where it is
 *              while the answers scroll (and a prompt taller than the window can still be read).
 * - `none`:    stacked, or not asked: the plain columns, unchanged.
 */
export type StickyPromptMode = 'none' | 'css' | 'columns';

export function stickyPromptMode(arrangement: GameArrangement, requested: boolean, os: string): StickyPromptMode {
  if (!requested || arrangement !== 'side') return 'none';
  return os === 'web' ? 'css' : 'columns';
}

/** Whether the prompt column stays in view beside the answers, on any platform (`stickyPromptMode`). */
export function stickyPromptColumn(arrangement: GameArrangement, requested: boolean, os: string): boolean {
  return stickyPromptMode(arrangement, requested, os) !== 'none';
}
