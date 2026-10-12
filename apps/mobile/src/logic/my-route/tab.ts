import type { IconName } from '@hangul-route/design-system';

/**
 * The learner tab bar (AMENDMENTS-ROUTE-LEARNING-ROUTE section 5.1 and section
 * 10; design/screens/learning-route/tab-bar.md). Pure data, so the order, the
 * glyphs and the label cap are unit-tested; `navigation/tabs.tsx` renders them.
 */

/** The tabs of `MainTabParamList` (`navigation/types.ts`). */
export type MainTabName = 'Home' | 'Route' | 'Journey' | 'Library';

/**
 * The tab order. Flag on (`flags.myRouteEnabled`): Today, Route, Journey,
 * Library (LR-OD-2: Route answers "where am I going" right after today's
 * work). Flag off: the three tabs of today, unchanged.
 */
export function mainTabs(myRouteEnabled: boolean): readonly MainTabName[] {
  return myRouteEnabled ? ['Home', 'Route', 'Journey', 'Library'] : ['Home', 'Journey', 'Library'];
}

/** Each tab's drawn glyph (never a character): the Route tab draws `route` (LR-2). */
export const TAB_ICON: Readonly<Record<MainTabName, IconName>> = {
  Home: 'home',
  Route: 'route',
  Journey: 'journey',
  Library: 'library',
};

/**
 * The native label of the four-tab bar (tab-bar.md "Large text", assumption a):
 * it grows with the text size up to 1.3 x caption, stays on one line, and a
 * label still wider than its 80 dp item shrinks to fit instead of being cut
 * off. `minimumFontScale` is the inverse of the cap, so on iOS a capped label
 * never drops below the caption size. React Native Web ignores all four (the
 * web label stays at the caption size; page zoom narrows the layout instead).
 */
export const FOUR_TAB_LABEL_FIT = {
  maxFontSizeMultiplier: 1.3,
  numberOfLines: 1,
  adjustsFontSizeToFit: true,
  minimumFontScale: 1 / 1.3,
} as const;

/**
 * What a screen reader says for a tab of the four-tab bar (LR-4, LR-OD-1). On
 * iOS the navigator draws a tab as a button and adds "tab, n of N" only to a
 * plain string label; the four-tab bar's label is a component (the native cap
 * above), so on iOS every tab spells it out itself: "Today, tab, 1 of 4",
 * "Learning Route, tab, 2 of 4". Elsewhere the tab role and its place are
 * announced by the platform, so only the Route tab is renamed to the full
 * name and the others keep their drawn label (`undefined`).
 */
export function tabAccessibilityLabel(
  name: MainTabName,
  order: readonly MainTabName[],
  spoken: {
    labels: Readonly<Record<MainTabName, string>>;
    routeName: string;
    position: (name: string, position: number, count: number) => string;
  },
  os: string,
): string | undefined {
  const said = name === 'Route' ? spoken.routeName : spoken.labels[name];
  if (os === 'ios') return spoken.position(said, order.indexOf(name) + 1, order.length);
  return name === 'Route' ? said : undefined;
}
